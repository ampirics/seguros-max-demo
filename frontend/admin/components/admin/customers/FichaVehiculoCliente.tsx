"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarDays, Eye, CreditCard, FileText, PackageCheck, Search, SearchX, ShoppingBag, type LucideIcon } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatosDelVehiculo } from "@/components/chat/FichaVehiculo"
import {
  ESTADOS_VEHICULO, perfilApi, vehiculoTexto, type EventoCliente, type Pedida, type PiezasDelVehiculo, type TipoEvento,
  type VehiculoPerfil,
} from "@/lib/api/perfil"
import { cn, formatCurrency, nombrePieza } from "@/lib/utils"

export const TIPOS_PEDIDO: TipoEvento[] = ["pieza_vista", "cotizacion", "reserva", "orden", "pago", "cita", "busqueda_externa"]

const ICONO: Partial<Record<TipoEvento, LucideIcon>> = {
  pieza_vista: Eye, cotizacion: FileText, reserva: PackageCheck, orden: ShoppingBag, pago: CreditCard, cita: CalendarDays,
  busqueda_externa: SearchX,
}

const PEDIDA: Record<Pedida, { texto: string; clase: string }> = {
  comprada: { texto: "Comprada", clase: "bg-success-soft text-success" },
  apartada: { texto: "Apartada", clase: "bg-accent text-accent-foreground" },
  cotizada: { texto: "Cotizada", clase: "bg-accent text-accent-foreground" },
  vista: { texto: "La vio", clase: "bg-secondary text-foreground" },
}

const cuando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-DO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""

export function LoQuePidio({ eventos }: { eventos: EventoCliente[] | null }) {
  if (eventos === null) return <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
  if (eventos.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Todavía no ha pedido piezas, cotizado, apartado, comprado ni agendado nada para este vehículo.</p>
  return (
    <ul className="divide-y rounded-lg border" aria-label="Lo que pidió para este vehículo">
      {eventos.map((e) => {
        const Icono = ICONO[e.tipo] ?? FileText
        const cuerpo = (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Icono className="h-3.5 w-3.5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium">{nombrePieza(e.titulo)}</span>
              <span className="block text-xs text-muted-foreground">{[nombrePieza(e.detalle), cuando(e.fecha), e.atendio && `Atendió: ${e.atendio}`].filter(Boolean).join(" · ")}</span>
            </span>
          </>
        )
        return (
          <li key={`${e.tipo}-${e.id}`}>
            {e.enlace ? (
              <Link href={e.enlace} className="flex gap-3 px-3 py-2.5 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{cuerpo}</Link>
            ) : <div className="flex gap-3 px-3 py-2.5">{cuerpo}</div>}
          </li>
        )
      })}
    </ul>
  )
}

export function PiezasQueLeSirven({ datos, error }: { datos: PiezasDelVehiculo | null; error: boolean }) {
  const [filtro, setFiltro] = useState("")
  const sistemas = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return (datos?.sistemas ?? []).map((s) => ({ ...s, piezas: q ? s.piezas.filter((p) => `${p.nombre} ${p.sku ?? ""}`.toLowerCase().includes(q)) : s.piezas }))
      .filter((s) => s.piezas.length > 0)
  }, [datos, filtro])

  if (error) return <p className="py-6 text-center text-sm text-muted-foreground">No se pudieron cargar las piezas de este vehículo.</p>
  if (datos === null) return <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
  if (datos.total === 0) return <p className="py-6 text-center text-sm text-muted-foreground">El catálogo no tiene piezas para este vehículo.</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {datos.total} pieza{datos.total === 1 ? "" : "s"} del catálogo{datos.pedidas ? ` · ${datos.pedidas} ya las pidió` : ""}
        {datos.dependen_del_motor ? ` · ${datos.dependen_del_motor} dependen del motor` : ""}
      </p>
      {datos.aviso && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{datos.aviso}
        </p>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input className="pl-9" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nombre o SKU" aria-label="Filtrar piezas" />
      </div>
      {sistemas.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Ninguna pieza coincide.</p>}
      {sistemas.map((s) => (
        <section key={s.clave} aria-label={s.nombre}>
          <h3 className="sticky top-0 z-[1] bg-background py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.nombre} <span className="tabular-nums">({s.piezas.length})</span></h3>
          <ul className="mt-1 divide-y rounded-lg border">
            {s.piezas.map((p) => (
              <li key={p.id} className={cn("space-y-1.5 px-3 py-2.5", p.pedida && "bg-accent/30")} data-pieza={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 basis-48 break-words text-sm font-medium">{nombrePieza(p.nombre)}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(p.precio_dop)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {p.pedida && <span className={cn("rounded-full px-2 py-0.5 font-medium", PEDIDA[p.pedida].clase)}>{PEDIDA[p.pedida].texto}</span>}
                  {p.depende_del_motor && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning" title={p.motor ?? undefined}>Depende del motor{p.motor ? `: ${p.motor}` : ""}</span>}
                  {p.etiqueta_calidad && <span className="rounded-full bg-secondary px-2 py-0.5">{p.etiqueta_calidad}</span>}
                  {p.sku && <span className="font-mono text-muted-foreground">{p.sku}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.existencias.length ? p.existencias.map((x) => (
                    <span key={x.sucursal_id} className={cn("mr-3 inline-block", x.disponible > 0 ? "text-success" : "")}>{x.sucursal}: {x.disponible}</span>
                  )) : p.disponible ? "Disponible" : "Sin existencia"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function FichaVehiculoCliente({ clienteId, vehiculo, onCerrar }: {
  clienteId: string
  vehiculo: VehiculoPerfil | null
  onCerrar: () => void
}) {
  const [eventos, setEventos] = useState<EventoCliente[] | null>(null)
  const [piezas, setPiezas] = useState<PiezasDelVehiculo | null>(null)
  const [error, setError] = useState(false)
  const id = vehiculo?.id

  useEffect(() => {
    if (!id) return
    let vigente = true
    setEventos(null); setPiezas(null); setError(false)
    perfilApi.eventos(clienteId, { vehiculo_id: id, tipo: TIPOS_PEDIDO.join(","), limite: 200 })
      .then((e) => { if (vigente) setEventos(e) }).catch(() => { if (vigente) setEventos([]) })
    perfilApi.piezasDelVehiculo(clienteId, id)
      .then((p) => { if (vigente) setPiezas(p) }).catch(() => { if (vigente) setError(true) })
    return () => { vigente = false }
  }, [clienteId, id])

  const estado = ESTADOS_VEHICULO.find((e) => e.valor === (vehiculo?.estado ?? "activo"))?.texto

  return (
    <Dialog open={!!vehiculo} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl gap-3 overflow-y-auto overflow-x-hidden p-4 sm:p-6" data-testid="ficha-carro">
        {vehiculo && (
          <>
            <DialogHeader className="pr-6 text-left">
              <DialogTitle className="break-words">{vehiculoTexto(vehiculo)}</DialogTitle>
              <DialogDescription>
                {[estado, vehiculo.kilometraje != null && `${vehiculo.kilometraje.toLocaleString("es-DO")} km`].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>
            <DatosDelVehiculo vehiculo={vehiculo} className="rounded-lg bg-secondary/50 p-3" />
            <Tabs defaultValue="pidio" className="min-w-0">
              <TabsList className="h-auto w-full">
                <TabsTrigger value="pidio" className="h-auto min-h-8 flex-1 whitespace-normal py-1 text-xs sm:text-sm">Lo que pidió{eventos ? ` (${eventos.length})` : ""}</TabsTrigger>
                <TabsTrigger value="piezas" className="h-auto min-h-8 flex-1 whitespace-normal py-1 text-xs sm:text-sm">Piezas que le sirven{piezas ? ` (${piezas.total})` : ""}</TabsTrigger>
              </TabsList>
              <TabsContent value="pidio" className="mt-3"><LoQuePidio eventos={eventos} /></TabsContent>
              <TabsContent value="piezas" className="mt-3"><PiezasQueLeSirven datos={piezas} error={error} /></TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
