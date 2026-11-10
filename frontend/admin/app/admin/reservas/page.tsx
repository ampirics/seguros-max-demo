"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { AdminLayout } from "@/components/admin/admin-layout"
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { fechaHora } from "@/components/admin/inventario/ExistenciasPieza"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { inventarioApi, type EstadoReserva, type Reserva } from "@/lib/api/inventario"
import { cn } from "@/lib/utils"

const ESTADOS: { valor: EstadoReserva | "todas"; texto: string }[] = [
  { valor: "vigente", texto: "Vigentes" },
  { valor: "vencida", texto: "Vencidas" },
  { valor: "liberada", texto: "Liberadas" },
  { valor: "vendida", texto: "Vendidas" },
  { valor: "todas", texto: "Todas" },
]

const CLASE: Record<EstadoReserva, string> = {
  vigente: "bg-accent text-accent-foreground",
  vencida: "bg-warning-soft text-warning",
  liberada: "bg-secondary text-muted-foreground",
  vendida: "bg-success-soft text-success",
}

export default function ReservasPage() {
  const [estado, setEstado] = useState<EstadoReserva | "todas">("vigente")
  const [items, setItems] = useState<Reserva[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [liberando, setLiberando] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setItems(null)
    inventarioApi.reservas({ estado, limit: 200 })
      .then((r) => { if (vigente) { setItems(r); setError(false) } })
      .catch(() => { if (vigente) setError(true) })
    return () => { vigente = false }
  }, [estado, intento])

  const liberar = async (r: Reserva) => {
    setLiberando(r.id)
    try {
      await inventarioApi.liberar(r.id)
      toast.success("Reserva liberada: la pieza vuelve a estar disponible")
      setIntento((n) => n + 1)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo liberar la reserva.")
    } finally {
      setLiberando(null)
    }
  }

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-4">
        <SeccionTabs seccion="inventario" />
        <p className="text-sm text-muted-foreground">Piezas apartadas para un cliente. Mientras están vigentes no cuentan como disponibles; al vencer se liberan solas, salvo que su cotización esté aceptada: entonces quedan apartadas hasta la venta.</p>
        <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Estado">
          {ESTADOS.map((e) => (
            <button key={e.valor} type="button" aria-pressed={estado === e.valor} onClick={() => setEstado(e.valor)}
              className={cn("h-8 shrink-0 rounded-control px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                estado === e.valor ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
              {e.texto}
            </button>
          ))}
        </div>

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar las reservas</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !items ? (
          <Card className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">No hay reservas {estado === "todas" ? "" : ESTADOS.find((e) => e.valor === estado)?.texto.toLowerCase()}</p>
            <p className="mt-1 text-sm text-muted-foreground">Se crean cuando el cliente pide por WhatsApp que le aparten una pieza, o desde la ficha de la pieza.</p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {items.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/piezas/${r.pieza_id}`} className="truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none">{r.pieza}</Link>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", CLASE[r.estado])}>{ESTADOS.find((e) => e.valor === r.estado)?.texto.replace(/s$/, "")}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[`${r.cantidad} ${r.cantidad === 1 ? "unidad" : "unidades"}`, r.sucursal, r.ubicacion && `Ubicación ${r.ubicacion}`, r.creada_por && `por ${r.creada_por}`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.estado === "vendida" ? `Vendida ${fechaHora(r.liberada)}`
                        : r.estado === "liberada" ? `Liberada ${fechaHora(r.liberada)}`
                        : r.hasta_la_venta ? "Cotización aceptada: apartada hasta la venta"
                        : `${r.estado === "vencida" ? "Venció" : "Vence"} ${fechaHora(r.vence)}`}
                      {r.cotizacion_codigo && <> · <Link href={`/admin/cotizaciones/${r.cotizacion_codigo}`} className="underline-offset-2 hover:underline">{r.cotizacion_codigo}</Link></>}
                      {r.conversation_id && <> · <Link href={`/admin/chat?conversation=${r.conversation_id}`} className="underline-offset-2 hover:underline">Ver conversación</Link></>}
                    </p>
                  </div>
                  {r.estado === "vigente" && (
                    <Button variant="outline" size="sm" className="shrink-0" disabled={liberando === r.id} onClick={() => liberar(r)}>Liberar</Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
