"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Car, Loader2, Search } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { PiezaFila, SISTEMAS } from "@/components/admin/piezas/PiezaFila"
import { VehiculoFiltro, filtroDeUrl, type FiltroVehiculo } from "@/components/admin/piezas/VehiculoFiltro"
import { apiClient } from "@/lib/api-client"
import type { BusquedaPiezas } from "@/lib/api-types"
import { aBusqueda } from "@/lib/api/piezas"
import { cn } from "@/lib/utils"

const EJEMPLOS = ["amortiguadores delanteros tucson 2012", "pastillas de freno L200 2003", "54651-2S000", "KM8JU3AC5CU000000"]
const PAGINA = 20

export default function PiezasPage() {
  const [q, setQ] = useState("")
  const [vehiculo, setVehiculo] = useState<FiltroVehiculo>({ marca: null, modelo: null, anio: null })
  useEffect(() => { const f = filtroDeUrl(); if (f) setVehiculo(f) }, [])
  const [sistema, setSistema] = useState<string | null>(null)
  const [sort, setSort] = useState("relevancia")
  const [res, setRes] = useState<BusquedaPiezas | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  const params = (skip: number) => ({
    q: q.trim() || undefined,
    marca: vehiculo.marca ?? undefined,
    modelo: vehiculo.modelo ?? undefined,
    anio: vehiculo.anio ?? undefined,
    sistema: sistema ?? undefined,
    sort: sort === "relevancia" ? undefined : sort,
    todos: true,
    skip,
    limit: PAGINA,
  })

  useEffect(() => {
    let vigente = true
    setLoading(true)
    const t = setTimeout(() => {
      apiClient
        .get<BusquedaPiezas>("/piezas/buscar", params(0))
        .then((r) => { if (vigente) { setRes(aBusqueda(r)); setError(false) } })
        .catch(() => { if (vigente) setError(true) })
        .finally(() => { if (vigente) setLoading(false) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, vehiculo, sistema, sort, intento])

  const cargarMas = async () => {
    if (!res) return
    setLoadingMore(true)
    try {
      const r = await apiClient.get<BusquedaPiezas>("/piezas/buscar", params(res.items.length))
      setRes({ ...r, items: [...res.items, ...aBusqueda(r).items] })
    } catch {
      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const det = res?.vehiculo_detectado
  const detTexto = det && [det.marca, det.modelo, det.anios ?? det.anio, det.motor].filter(Boolean).join(" ")

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-4">
        <SeccionTabs seccion="inventario" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Busca por número de pieza, OEM, vehículo, VIN o describe lo que necesitas.</p>
          <Button asChild variant="outline" className="shrink-0 gap-2">
            <Link href="/admin/piezas/diagrama"><Car className="h-4 w-4" aria-hidden /> Diagrama del vehículo</Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej.: amortiguadores delanteros Tucson 2012"
            aria-label="Buscar piezas"
            className="h-12 bg-card pl-10 text-base"
            autoFocus
          />
        </div>
        {!q && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Prueba:</span>
            {EJEMPLOS.map((e) => (
              <button key={e} type="button" onClick={() => setQ(e)}
                className="rounded-control bg-secondary px-2.5 py-1 text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {e}
              </button>
            ))}
          </div>
        )}

        <VehiculoFiltro value={vehiculo} onChange={setVehiculo} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="scrollbar-hide -mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 max-sm:basis-full sm:mx-0 sm:px-0" role="group" aria-label="Sistema">
            {[{ clave: null, nombre: "Todos los sistemas" }, ...SISTEMAS].map((s) => (
              <button key={s.clave ?? "todos"} type="button" aria-pressed={sistema === s.clave} onClick={() => setSistema(s.clave)}
                className={cn("h-8 shrink-0 rounded-control px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sistema === s.clave ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {s.nombre}
              </button>
            ))}
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-8 w-auto gap-2 bg-card text-xs" aria-label="Ordenar"><SelectValue /></SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="relevancia">Disponibles primero</SelectItem>
              <SelectItem value="precio">Precio: menor a mayor</SelectItem>
              <SelectItem value="-precio">Precio: mayor a menor</SelectItem>
              <SelectItem value="nombre">Nombre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-live="polite">
          {res && !loading && <span className="text-muted-foreground">{res.total} {res.total === 1 ? "pieza" : "piezas"}</span>}
          {detTexto && (
            <span className="inline-flex items-center gap-1.5">
              <Car className="h-4 w-4 text-primary" aria-hidden />
              Vehículo detectado: <strong className="font-medium">{detTexto}</strong>
              {det?.vin && <span className="text-muted-foreground">(por VIN; el modelo no viene en el VIN)</span>}
            </span>
          )}
        </div>

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudo buscar en el catálogo</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : loading && !res ? (
          <Card className="divide-y overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-16 w-16 rounded-md" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-full max-w-[320px]" /><Skeleton className="h-3 w-full max-w-[200px]" /></div>
              </div>
            ))}
          </Card>
        ) : res && res.items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">No hay piezas que coincidan</p>
            <p className="mt-1 text-sm text-muted-foreground">Revisa el número, quita filtros o describe la pieza con otras palabras.</p>
            {q.trim() && (
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/admin/busqueda-externa?${new URLSearchParams(Object.entries({ q: q.trim(), marca: vehiculo.marca, modelo: vehiculo.modelo, anio: vehiculo.anio }).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))}`}>
                  Buscar en fuentes externas
                </Link>
              </Button>
            )}
          </CardContent></Card>
        ) : res ? (
          <Card className={cn("overflow-hidden transition-opacity", loading && "opacity-60")}>
            <ul className="divide-y">
              {res.items.map((p) => <PiezaFila key={p.id} pieza={p} />)}
            </ul>
            {res.items.length < res.total && (
              <div className="flex justify-center border-t p-3">
                <Button variant="outline" size="sm" onClick={cargarMas} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {loadingMore ? "Cargando…" : `Ver más (${res.total - res.items.length})`}
                </Button>
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </AdminLayout>
  )
}
