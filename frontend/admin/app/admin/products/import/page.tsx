"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { importProductsFromCSV } from "@/lib/admin-products"

import {
  Upload, Download, FileSpreadsheet, CheckCircle, XCircle, ArrowLeft, Loader2, ShieldCheck, RotateCcw,
} from "lucide-react"
import { toast } from "react-toastify"

// Mismos límites que el backend (admin_products.IMPORT_MAX_*)
const MAX_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 1000

const COLUMNS = [
  "name", "sku", "external_category_code", "price", "description", "image", "gallery", "colors", "sizes",
  "details", "is_visible", "unit_quantity", "unit_type", "original_price", "discount_percentage", "is_on_sale",
] as const

type Row = Record<string, string>

interface RowError { row: number; error: string; product_name?: string }

interface ServerResult {
  dry_run: boolean
  total_rows: number
  imported: number
  errors: number
  import_errors: RowError[]
}

/** Parser CSV RFC 4180: comillas, "" escapadas, saltos de línea dentro de celdas, BOM y ; o , */
function parseCSV(text: string): { headers: string[]; rows: Row[] } {
  const src = text.replace(/^﻿/, "")
  const firstLine = src.split(/\r?\n/, 1)[0] || ""
  const delim = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ","
  const records: string[][] = []
  let field = ""
  let record: string[] = []
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) { record.push(field); field = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      record.push(field); records.push(record); record = []; field = ""
    } else field += ch
  }
  if (field || record.length) { record.push(field); records.push(record) }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim()))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase())
  const rows = nonEmpty.slice(1).map((values) => {
    const row: Row = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim() })
    return row
  })
  return { headers, rows }
}

/** Celda segura para Excel: comillas escapadas y sin fórmulas (=, +, -, @ al inicio). */
function csvCell(value: string | number): string {
  let s = String(value ?? "")
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

const TEMPLATE_ROWS: Row[] = [
  {
    name: "Polo Premium 100% Algodón", sku: "", external_category_code: "456", price: "24.99",
    description: "Polo de algodón, ajuste entallado y logo bordado.",
    image: "https://ejemplo.com/imagenes/polo.jpg",
    gallery: "https://ejemplo.com/imagenes/polo-1.jpg|https://ejemplo.com/imagenes/polo-2.jpg",
    colors: "Rojo:#f21212|Azul:#4273c4", sizes: "S|M|L|XL",
    details: "Material:100% Algodón|Cuidado:Lavar a máquina", is_visible: "TRUE",
    unit_quantity: "1", unit_type: "unidad", original_price: "29.99", discount_percentage: "", is_on_sale: "TRUE",
  },
  {
    name: "Calcetines deportivos", sku: "CALC-001", external_category_code: "", price: "9.50",
    description: "Pack de calcetines.", image: "", gallery: "", colors: "", sizes: "",
    details: "", is_visible: "FALSE", unit_quantity: "3", unit_type: "pares",
    original_price: "", discount_percentage: "", is_on_sale: "FALSE",
  },
]

const FORMAT_HELP: [string, string][] = [
  ["name, price", "Obligatorios. El precio admite decimales con punto (24.99)."],
  ["sku", "Opcional. Si lo dejas vacío se genera uno (IMP-XXXXXX-0001). No puede repetirse."],
  ["external_category_code", "Opcional. Con él se generan los SKUs por talla y color (ej. 456-MD-RO)."],
  ["colors", "Nombre:#hex separados por | (Rojo:#ff0000|Azul:#0000ff)"],
  ["sizes", "Separadas por | (S|M|L|XL)"],
  ["image, gallery", "URLs http(s); la galería separada por |"],
  ["details", "Etiqueta:Valor separados por | (Material:Algodón|Origen:RD)"],
  ["is_visible, is_on_sale", "TRUE o FALSE"],
  ["original_price / discount_percentage", "Con uno basta: el otro se calcula."],
]

export default function ImportProductsPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"validate" | "import" | null>(null)
  const [validation, setValidation] = useState<ServerResult | null>(null)
  const [result, setResult] = useState<ServerResult | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push("/admin/login")
  }, [user, isLoading, router])

  const reset = () => {
    setFile(null); setRows([]); setFileError(null); setValidation(null); setResult(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const downloadTemplate = () => {
    const lines = [
      COLUMNS.join(","),
      ...TEMPLATE_ROWS.map((row) => COLUMNS.map((c) => csvCell(row[c] ?? "")).join(",")),
    ]
    // BOM para que Excel abra el UTF-8 con tildes correctas
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "plantilla_productos.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    setValidation(null); setResult(null); setRows([]); setFileError(null)
    if (!selected) { setFile(null); return }
    setFile(selected)
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setFileError("El archivo debe ser .csv (en Excel: Guardar como → CSV UTF-8).")
      return
    }
    if (selected.size > MAX_BYTES) {
      setFileError("El archivo supera 5 MB. Divídelo en varios archivos.")
      return
    }
    try {
      const { headers, rows: parsed } = parseCSV(await selected.text())
      const missing = ["name", "price"].filter((c) => !headers.includes(c))
      if (missing.length) setFileError(`Faltan columnas obligatorias: ${missing.join(", ")}`)
      else if (parsed.length === 0) setFileError("El archivo no tiene filas de productos.")
      else if (parsed.length > MAX_ROWS) setFileError(`El archivo tiene ${parsed.length} filas; el máximo es ${MAX_ROWS}.`)
      setRows(parsed)
    } catch {
      setFileError("No se pudo leer el archivo.")
    }
  }

  const run = async (dryRun: boolean) => {
    if (!file) return
    setBusy(dryRun ? "validate" : "import")
    try {
      const res: ServerResult = await importProductsFromCSV(file, dryRun)
      if (dryRun) {
        setValidation(res)
        if (res.errors === 0) toast.success(`Las ${res.imported} filas están listas para importar`)
      } else {
        setResult(res)
        if (res.imported > 0) toast.success(`${res.imported} productos importados`)
        if (res.errors > 0) toast.warn(`${res.errors} filas no se importaron`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar el archivo")
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
  }
  if (!user) return null

  const errorsByRow = new Map((validation?.import_errors || []).map((e) => [e.row, e.error]))
  const preview = rows.slice(0, 10)
  const canImport = !!file && !fileError && !!validation && validation.imported > 0 && !result

  return (
    <AdminLayout title="Importar productos">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="outline" onClick={() => router.push("/admin/products")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a productos
        </Button>

        {/* Paso 1: plantilla */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              1. Prepara el archivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-600">
                Descarga la plantilla, complétala en Excel o Google Sheets y guárdala como <strong>CSV UTF-8</strong>.
                Máximo {MAX_ROWS} productos y 5 MB por archivo.
              </p>
              <Button onClick={downloadTemplate} variant="outline" className="shrink-0">
                <Download className="w-4 h-4 mr-2" />
                Descargar plantilla
              </Button>
            </div>
            <details className="rounded-lg border bg-gray-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-gray-800">Formato de las columnas</summary>
              <dl className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr]">
                {FORMAT_HELP.map(([col, help]) => (
                  <div key={col} className="contents">
                    <dt className="font-mono text-xs text-gray-700">{col}</dt>
                    <dd className="text-gray-600">{help}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </CardContent>
        </Card>

        {/* Paso 2: subir y validar */}
        <Card>
          <CardHeader>
            <CardTitle>2. Sube y valida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
            {file && (
              <p className="text-sm text-gray-600">
                <strong>{file.name}</strong> · {(file.size / 1024).toFixed(1)} KB
                {rows.length > 0 && ` · ${rows.length} filas`}
              </p>
            )}
            {fileError && (
              <p className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                <XCircle className="w-4 h-4 shrink-0" /> {fileError}
              </p>
            )}

            {preview.length > 0 && !fileError && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="p-2 w-14">Fila</th>
                      <th className="p-2">Nombre</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Precio</th>
                      <th className="p-2">Tallas × colores</th>
                      <th className="p-2">Visible</th>
                      {validation && <th className="p-2">Validación</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const line = i + 2
                      const err = errorsByRow.get(line)
                      const sizes = (row.sizes || "").split("|").filter((s) => s.trim()).length
                      const colors = (row.colors || "").split("|").filter((c) => c.includes(":")).length
                      return (
                        <tr key={line} className={`border-t ${err ? "bg-red-50" : ""}`}>
                          <td className="p-2 text-gray-500">{line}</td>
                          <td className="p-2 max-w-[240px] truncate" title={row.name}>{row.name || "—"}</td>
                          <td className="p-2 font-mono text-xs">{row.sku || <span className="text-gray-400">automático</span>}</td>
                          <td className="p-2">{row.price || "—"}</td>
                          <td className="p-2">{sizes && colors ? `${sizes} × ${colors}` : "—"}</td>
                          <td className="p-2">{/^(false|0|no)$/i.test(row.is_visible || "") ? "No" : "Sí"}</td>
                          {validation && (
                            <td className="p-2">
                              {err ? <span className="text-red-700">{err}</span> : <span className="text-green-700">OK</span>}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {rows.length > preview.length && (
                  <p className="border-t px-3 py-2 text-xs text-gray-500">
                    Mostrando {preview.length} de {rows.length} filas. La validación revisa todas.
                  </p>
                )}
              </div>
            )}

            {validation && (
              <div className={`rounded-lg p-3 text-sm ${validation.errors ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-900"}`}>
                <p className="font-medium">
                  {validation.imported} filas listas · {validation.errors} con errores
                  {validation.errors > 0 && " (no se importarán)"}
                </p>
                {validation.errors > 0 && (
                  <ul className="mt-2 max-h-48 list-disc overflow-y-auto pl-5 space-y-0.5">
                    {validation.import_errors.map((e) => (
                      <li key={`${e.row}-${e.error}`}>Fila {e.row}{e.product_name ? ` (${e.product_name})` : ""}: {e.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => run(true)} variant="outline" disabled={!file || !!fileError || !!busy || !!result}>
                {busy === "validate" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Validar archivo
              </Button>
              <Button onClick={() => run(false)} disabled={!canImport || !!busy} className="bg-primary hover:bg-primary/90 text-white">
                {busy === "import" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {validation ? `Importar ${validation.imported} productos` : "Importar productos"}
              </Button>
            </div>
            {!validation && file && !fileError && (
              <p className="text-xs text-gray-500">Valida primero: se revisan todas las filas sin guardar nada.</p>
            )}
          </CardContent>
        </Card>

        {/* Paso 3: resultado */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Importación terminada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm text-green-900">Importados</p>
                  <p className="text-2xl font-bold text-green-900">{result.imported}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm text-red-900">No importados</p>
                  <p className="text-2xl font-bold text-red-900">{result.errors}</p>
                </div>
              </div>
              {result.errors > 0 && (
                <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-sm text-red-800 space-y-0.5">
                  {result.import_errors.map((e) => (
                    <li key={`${e.row}-${e.error}`}>Fila {e.row}{e.product_name ? ` (${e.product_name})` : ""}: {e.error}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => router.push("/admin/products")} className="bg-primary hover:bg-primary/90 text-white">
                  Ver productos
                </Button>
                <Button onClick={reset} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Importar otro archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
