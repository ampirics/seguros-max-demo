"use client"

import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ESTADOS_COTIZACION, EstadoCotizacion, fechaCorta } from "@/components/admin/cotizaciones/EstadoCotizacion"
import { FILTRO_INICIAL, FiltroPeriodo, rangoDe } from "@/components/admin/FiltroPeriodo"
import { clienteTexto, cotizacionesApi } from "@/lib/api/cotizaciones"
import type { CotizacionResumen, EstadoCotizacion as Estado } from "@/lib/api-types"
import { cn, formatCurrency } from "@/lib/utils"

export default function CotizacionesPage() {
  const [q, setQ] = useState("")
  const [estado, setEstado] = useState<Estado | null>(null)
  const [filtro, setFiltro] = useState(FILTRO_INICIAL)
  const cerrada = estado === "aceptada" || estado === "rechazada" || estado === "vencida"
  const [items, setItems] = useState<CotizacionResumen[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    const t = setTimeout(() => {
      cotizacionesApi
        .listar({ estado: estado ?? undefined, ...rangoDe(filtro), ocultar_cerradas: filtro.ocultarCerradas && !cerrada, limit: 200 })
        .then((r) => { if (vigente) { setItems(r); setError(false) } })
        .catch(() => { if (vigente) setError(true) })
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [estado, filtro, intento])

  const termino = q.trim().toLowerCase()
  const visibles = items?.filter((c) => !termino || [c.codigo, c.cliente.nombre, c.cliente.telefono, c.vehiculo, ...c.items.map((i) => i.descripcion)]
    .some((t) => t?.toLowerCase().includes(termino))) ?? null

  return (
    <AdminLayout title="Ventas">
      <div className="space-y-4">
        <SeccionTabs seccion="ventas" />
        <p className="text-sm text-muted-foreground">Cada cotización guarda sus versiones. Se muestra la versión vigente.</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, cliente, teléfono, vehículo o pieza" aria-label="Buscar cotizaciones" className="h-10 bg-card pl-9" />
        </div>
        <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Estado">
          {([[null, "Todas"], ...Object.entries(ESTADOS_COTIZACION).map(([k, v]) => [k, v.label])] as [Estado | null, string][]).map(([valor, label]) => (
            <button key={label} type="button" aria-pressed={estado === valor} onClick={() => setEstado(valor)}
              className={cn("h-8 shrink-0 rounded-control px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                estado === valor ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <FiltroPeriodo value={filtro} onChange={setFiltro} cerradasTexto={cerrada ? "Ocultar cerradas (no aplica a este estado)" : "Ocultar aceptadas, rechazadas y vencidas"} />

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar las cotizaciones</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !visibles ? (
          <Card className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</Card>
        ) : visibles.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">No hay cotizaciones con esos filtros</p>
            <p className="mt-1 text-sm text-muted-foreground">Las cotizaciones se crean desde la bandeja, cuando la IA o un vendedor arma una.</p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {visibles.map((c) => (
                <li key={c.codigo}>
                  <Link href={`/admin/cotizaciones/${c.codigo}`}
                    className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.codigo}</span>
                        <span className="text-xs text-muted-foreground">v{c.version}</span>
                        <EstadoCotizacion estado={c.estado} cotizacion={c} />
                        {c.orden && <span className="text-xs text-muted-foreground">Orden {c.orden.numero}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-sm">{clienteTexto(c)}{c.vehiculo && <span className="text-muted-foreground"> · {c.vehiculo}</span>}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.origen === "ia" ? "Armada por la IA" : "Armada en el panel"}{c.validada_por ? ` · validada por ${c.validada_por}` : ""} · {c.items.length} {c.items.length === 1 ? "pieza" : "piezas"} · Vence {fechaCorta(c.vence)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(c.total_dop)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
