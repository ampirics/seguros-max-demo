"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { ArrowLeft, Armchair, Bell, CalendarClock, Check, MessageSquare, Receipt, UserRound, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CanalChip, DialogoMover, EstadoReservaChip, ESTADOS_ACTIVOS, fechaHora, Seguimiento } from "@/components/restaurante/reservas/comun"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { diaLargo, hora12, NOMBRE_CANAL, NOMBRE_ZONA, tsLocal } from "@/lib/restaurante/local"
import type { AvisoReserva, EstadoReserva, Reserva } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const TIPO_AVISO: Record<AvisoReserva["tipo"], string> = {
  confirmacion: "Confirmación",
  recordatorio: "Recordatorio",
  respuesta: "Respuesta del cliente",
  cambio: "Cambio",
  cancelacion: "Cancelación",
  nota: "Nota",
}

export default function ReservaPage() {
  const id = useParams<{ id: string }>()?.id ?? ""
  const { estado, ahora } = useRestaurante()
  const [cargada, setCargada] = useState<Reserva | null>(null)
  const [error, setError] = useState(false)
  const [mover, setMover] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const viva = estado?.reservas.find((r) => r.id === id || r.codigo === id)
  useEffect(() => {
    if (viva || !estado) return
    restauranteApi.reserva(id).then(setCargada).catch(() => setError(true))
  }, [id, viva, estado])
  const r = viva ?? cargada

  if (error) {
    return (
      <AdminLayout title="Reserva">
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <p className="font-medium">No encontré esa reserva.</p>
          <Link href="/admin/reservaciones" className="mt-2 inline-block text-sm text-primary hover:underline">Volver a la agenda</Link>
        </div>
      </AdminLayout>
    )
  }
  if (!r || !estado) {
    return (
      <AdminLayout title="Reserva">
        <Skeleton className="h-64 w-full" />
      </AdminLayout>
    )
  }

  const cliente = estado.clientes.find((c) => c.id === r.clienteId)
  const mesa = r.mesaId ? estado.mesas.find((m) => m.id === r.mesaId) : undefined
  const activa = ESTADOS_ACTIVOS.includes(r.estado)
  const cuando = tsLocal(r.fecha, r.hora)
  const falta = cuando - ahora
  const cuandoTexto = falta > 0 ? `Faltan ${falta > 3600000 ? `${Math.floor(falta / 3600000)} h ` : ""}${Math.round((falta % 3600000) / 60000)} min` : r.estado === "completada" ? "Visita cerrada" : `Hace ${Math.round(-falta / 60000)} min`

  const cambiar = async (estadoNuevo: EstadoReserva, ok: string, nota?: string) => {
    setOcupado(true)
    try {
      await restauranteApi.accion({ tipo: "reservaEstado", reservaId: r.id, estado: estadoNuevo, nota })
      toast.success(ok)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  const recordar = async () => {
    setOcupado(true)
    try {
      await restauranteApi.accion({ tipo: "recordatorio", reservaId: r.id })
      toast.success("Recordatorio enviado por WhatsApp")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <AdminLayout title={`Reserva ${r.codigo}`}>
      <div className="flex min-w-0 flex-col gap-5">
        <Link href="/admin/reservaciones" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Agenda de reservas
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="etiqueta">{r.codigo}</span>
              <EstadoReservaChip estado={r.estado} />
              <CanalChip canal={r.canal} />
            </div>
            <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{r.nombre}</h1>
            <p className="mt-1 text-base first-letter:uppercase">
              {diaLargo(r.fecha)}, {hora12(r.hora)} · {r.personas} personas
            </p>
            <p className="text-sm text-muted-foreground">
              {NOMBRE_ZONA[r.zona]}{mesa ? `, ${mesa.nombre}` : ", sin mesa asignada"} · {cuandoTexto}
            </p>
            {r.ocasion && <p className="mt-2 inline-flex rounded-full bg-[#E8866A]/15 px-2.5 py-0.5 text-xs font-medium text-[#B5532F] dark:text-[#F0A48A]">{r.ocasion}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {r.estado === "solicitada" || r.estado === "lista_espera" ? (
              <Button disabled={ocupado} onClick={() => cambiar("confirmada", "Reserva confirmada y cliente avisado")}>
                <Check className="h-4 w-4" aria-hidden /> Confirmar
              </Button>
            ) : null}
            {activa && r.estado !== "lista_espera" && (
              <Button variant="outline" disabled={ocupado} onClick={recordar}>
                <Bell className="h-4 w-4" aria-hidden /> Enviar recordatorio
              </Button>
            )}
            {activa && r.mesaId && (
              <Button variant="outline" disabled={ocupado} onClick={() => cambiar("sentada", "Llegaron: la mesa quedó abierta en el salón")}>
                <Armchair className="h-4 w-4" aria-hidden /> Llegaron
              </Button>
            )}
            {activa && (
              <Button variant="outline" disabled={ocupado} onClick={() => setMover(true)}>
                <CalendarClock className="h-4 w-4" aria-hidden /> Mover
              </Button>
            )}
            {activa && falta < 0 && (
              <Button variant="outline" disabled={ocupado} onClick={() => cambiar("no_show", "Marcada como no se presentó", "Marcado por el equipo")}>No se presentó</Button>
            )}
            {activa && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={ocupado} onClick={() => cambiar("cancelada", "Reserva cancelada y mesa liberada", "Cancelada por el equipo")}>
                <X className="h-4 w-4" aria-hidden /> Cancelar
              </Button>
            )}
          </div>
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-5">
            {(r.notas || cliente?.alergias?.length) && (
              <section className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold">Para el equipo</h2>
                {cliente?.alergias?.length ? (
                  <p className="mt-2 rounded-md bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive">Alergia: {cliente.alergias.join(", ")}</p>
                ) : null}
                {r.notas && <p className="mt-2 text-sm leading-relaxed">{r.notas}</p>}
              </section>
            )}

            <section className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Seguimiento</h2>
                <Seguimiento r={r} />
              </div>
              <ol className="mt-4 flex flex-col">
                {[{ ts: r.creada, tipo: "nota" as const, texto: `Reserva creada por ${NOMBRE_CANAL[r.canal]}`, canal: r.canal, quien: r.canal === "presencial" || r.canal === "telefono" ? "Equipo" : "Asistente" }, ...r.avisos]
                  .sort((a, b) => a.ts - b.ts)
                  .map((a, i, l) => (
                    <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < l.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />}
                      <span className={cn("mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-card ring-1", a.tipo === "cancelacion" ? "bg-destructive ring-destructive/40" : a.tipo === "respuesta" ? "bg-success ring-success/40" : "bg-primary ring-primary/30")} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{i === 0 ? "Reserva" : TIPO_AVISO[a.tipo]}</span> · {a.texto}
                          {"enlace" in a && a.enlace && (
                            <a href={a.enlace} target="_blank" rel="noreferrer" className="ml-1.5 font-medium text-primary hover:underline">
                              Ver el correo
                            </a>
                          )}
                          {"estado" in a && a.estado === "fallido" && <span className="ml-1.5 text-xs font-medium text-destructive">No salió</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{fechaHora(a.ts)} · {a.quien} · {NOMBRE_CANAL[a.canal]}</p>
                      </div>
                    </li>
                  ))}
              </ol>
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-3">
            <Enlace href={cliente ? `/admin/clientes/${cliente.id}` : undefined} icono={UserRound} titulo="Cliente" detalle={cliente ? `${cliente.nombre} · ${cliente.telefono}` : r.telefono || "Sin ficha"} extra={cliente ? `${cliente.visitas} visitas · ${cliente.puntos} puntos` : undefined} />
            <Enlace href={r.mesaId ? `/admin/salon/mesas/${r.mesaId}` : undefined} icono={Armchair} titulo="Mesa" detalle={mesa ? `${mesa.nombre}, ${NOMBRE_ZONA[mesa.zona]} · ${mesa.capacidad} sillas` : "Sin mesa asignada"} />
            <Enlace href={r.conversacionId ? `/admin/chat?conversacion=${r.conversacionId}` : undefined} icono={MessageSquare} titulo="Conversación" detalle={r.conversacionId ? "Ver el chat con el cliente" : "Sin conversación"} />
            <Enlace href={r.visitaId ? `/admin/visitas/${r.visitaId}` : undefined} icono={Receipt} titulo="Visita" detalle={r.visitaId ? "Consumo, tiempos y cuenta" : "Se crea cuando la mesa paga"} />
          </aside>
        </div>
      </div>
      <DialogoMover r={r} abierto={mover} onCerrar={() => setMover(false)} />
    </AdminLayout>
  )
}

function Enlace({ href, icono: Icono, titulo, detalle, extra }: { href?: string; icono: typeof UserRound; titulo: string; detalle: string; extra?: string }) {
  const cuerpo = (
    <>
      <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="truncate text-sm font-medium">{detalle}</p>
        {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      </div>
    </>
  )
  return href ? (
    <Link href={href} className="flex gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:bg-accent">
      {cuerpo}
    </Link>
  ) : (
    <div className="flex gap-3 rounded-xl border bg-card p-4 opacity-70">{cuerpo}</div>
  )
}
