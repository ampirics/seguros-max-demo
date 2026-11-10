"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Database, Download, Loader2, Search, Upload } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { ImportarExistencias } from "@/components/admin/inventario/ImportarExistencias"
import { MinimoDialog } from "@/components/admin/inventario/ExistenciasPieza"
import { SapExistencias } from "@/components/admin/inventario/SapExistencias"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useAdmin } from "@/contexts/admin-context"
import { inventarioApi, type ExistenciaFila, type Sucursal } from "@/lib/api/inventario"
import { canAccessSection } from "@/lib/permissions"
import { cn, nombrePieza } from "@/lib/utils"

const PAGINA = 50

export default function ExistenciasPage() {
  const { user } = useAdmin()
  const [q, setQ] = useState("")
  const [sucursal, setSucursal] = useState("todas")
  const [conExistencia, setConExistencia] = useState(false)
  const [bajoMinimo, setBajoMinimo] = useState(false)
  const [minimo, setMinimo] = useState<ExistenciaFila | null>(null)
  const [sap, setSap] = useState(false)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [res, setRes] = useState<{ total: number; items: ExistenciaFila[] } | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [importar, setImportar] = useState(false)
  const [exportando, setExportando] = useState(false)

  useEffect(() => { inventarioApi.sucursales().then(setSucursales).catch(() => setSucursales([])) }, [])
  useEffect(() => { if (new URLSearchParams(window.location.search).get("bajo_minimo")) setBajoMinimo(true) }, [])

  const params = (skip: number) => ({
    q: q.trim() || undefined,
    sucursal_id: sucursal === "todas" ? undefined : sucursal,
    solo_con_existencia: conExistencia || undefined,
    bajo_minimo: bajoMinimo || undefined,
    limit: PAGINA,
    skip,
  })

  useEffect(() => {
    let vigente = true
    const t = setTimeout(() => {
      inventarioApi.existencias(params(0))
        .then((r) => { if (vigente) { setRes(r); setError(false) } })
        .catch(() => { if (vigente) setError(true) })
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, sucursal, conExistencia, bajoMinimo, intento])

  const cargarMas = async () => {
    if (!res) return
    setCargandoMas(true)
    try {
      const r = await inventarioApi.existencias(params(res.items.length))
      setRes({ total: r.total, items: [...res.items, ...r.items] })
    } catch {
      toast.error("No se pudieron cargar más existencias.")
    } finally {
      setCargandoMas(false)
    }
  }

  const exportar = async (formato: "csv" | "xlsx") => {
    setExportando(true)
    try {
      await inventarioApi.exportar(sucursal === "todas" ? undefined : sucursal, formato)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo exportar.")
    } finally {
      setExportando(false)
    }
  }

  const puedeImportar = canAccessSection(user?.role, "/admin/products")

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-4">
        <SeccionTabs seccion="inventario" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Cantidad de cada pieza por sucursal. Disponible es lo que hay menos lo apartado.</p>
          <div className="flex shrink-0 gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={exportando}>
                  {exportando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportar("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportar("csv")}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {puedeImportar && (
              <Button variant="outline" className="gap-2" onClick={() => setImportar(true)}>
                <Upload className="h-4 w-4" aria-hidden /> Importar
              </Button>
            )}
            {puedeImportar && (
              <Button variant="outline" className="gap-2" onClick={() => setSap(true)}>
                <Database className="h-4 w-4" aria-hidden /> SAP
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU o ubicación" aria-label="Buscar existencias" className="h-10 bg-card pl-9" />
          </div>
          <Select value={sucursal} onValueChange={setSucursal}>
            <SelectTrigger className="h-10 bg-card sm:w-56" aria-label="Sucursal"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las sucursales</SelectItem>
              {sucursales.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="con-existencia" checked={conExistencia} onCheckedChange={setConExistencia} />
            <Label htmlFor="con-existencia" className="text-sm">Solo con existencia</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="bajo-minimo" checked={bajoMinimo} onCheckedChange={setBajoMinimo} />
            <Label htmlFor="bajo-minimo" className="text-sm">Bajo el mínimo</Label>
          </div>
        </div>

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar las existencias</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !res ? (
          <Card className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</Card>
        ) : res.items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">{bajoMinimo ? "Ninguna pieza está bajo su mínimo" : "No hay existencias con esos filtros"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Carga las cantidades con un Excel o CSV, o registra una entrada desde la ficha de la pieza.</p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Pieza</th>
                    <th className="px-4 py-2 font-medium">Sucursal</th>
                    <th className="px-4 py-2 font-medium">Ubicación</th>
                    <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-4 py-2 text-right font-medium">Apartadas</th>
                    <th className="px-4 py-2 text-right font-medium">Disponible</th>
                    <th className="px-4 py-2 text-right font-medium">Mínimo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {res.items.map((e) => (
                    <tr key={`${e.pieza_id}-${e.sucursal_id}`} className={cn(!e.sucursal_activa && "text-muted-foreground")}>
                      <td className="max-w-[320px] px-4 py-2">
                        <Link href={`/admin/piezas/${e.pieza_id}`} className="block truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none">{nombrePieza(e.nombre)}</Link>
                        <span className="text-xs text-muted-foreground">{e.sku}</span>
                      </td>
                      <td className="px-4 py-2">{e.sucursal}{!e.sucursal_activa && " (inactiva)"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.ubicacion ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{e.cantidad}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{e.reservado || "—"}</td>
                      <td className={cn("px-4 py-2 text-right font-medium tabular-nums", e.disponible === 0 && "text-destructive")}>{e.disponible}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {puedeImportar ? (
                          <button type="button" onClick={() => setMinimo(e)}
                            className={cn("rounded px-1 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none", e.bajo_minimo ? "font-medium text-warning" : "text-muted-foreground")}
                            aria-label={`Mínimo de ${e.nombre} en ${e.sucursal}`}>
                            {e.minimo ?? "—"}
                          </button>
                        ) : (
                          <span className={e.bajo_minimo ? "font-medium text-warning" : "text-muted-foreground"}>{e.minimo ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
              <span>{res.items.length} de {res.total}</span>
              {res.items.length < res.total && (
                <Button variant="outline" size="sm" onClick={cargarMas} disabled={cargandoMas}>
                  {cargandoMas && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />} Ver más
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
      <MinimoDialog fila={minimo} onClose={() => setMinimo(null)} onHecho={() => { setMinimo(null); setIntento((n) => n + 1) }} />
      <SapExistencias abierto={sap} onClose={() => setSap(false)} onAplicado={() => setIntento((n) => n + 1)} />
      <ImportarExistencias abierto={importar} onClose={() => setImportar(false)}
        onAplicado={() => { setImportar(false); setIntento((n) => n + 1) }} />
    </AdminLayout>
  )
}
