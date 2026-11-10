"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, CalendarCheck, Contact, CreditCard, Star, Users } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { COLORES, minutos, Tarjeta, Vacio, ZONA_COLOR } from "@/components/restaurante/metricas/piezas"
import { ITBIS, PLATOS, rd, SERVICIO } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { diaLargo, fechaLocal, horaLocal, hora12, NOMBRE_CANAL, NOMBRE_ZONA } from "@/lib/restaurante/local"
import { EQUIPO_BASE, MESAS_BASE } from "@/lib/restaurante/plano"
import type { Visita } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const METODO: Record<Visita["metodo"], string> = { tarjeta: "Tarjeta", efectivo: "Efectivo", transferencia: "Transferencia" }

export default function VisitaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [visita, setVisita] = useState<Visita | null>(null)
  const [error, setError] = useState("")
  const { estado } = useRestaurante()

  useEffect(() => {
    restauranteApi.visita(id).then(setVisita).catch((e) => setError(e.message))
  }, [id])

  return (
    <AdminLayout title="Visita">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-16">
        <Link href="/admin/metricas" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Métricas
        </Link>
        {error ? (
          <Vacio texto={`No encontré esta visita (${error}).`} />
        ) : !visita ? (
          <div className="grid gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <Ficha v={visita} nombreCliente={visita.clienteId ? estado?.clientes.find((c) => c.id === visita.clienteId)?.nombre : undefined} />
        )}
      </div>
    </AdminLayout>
  )
}

function Ficha({ v, nombreCliente }: { v: Visita; nombreCliente?: string }) {
  const mesa = MESAS_BASE.find((m) => m.id === v.mesaId)
  const mesero = EQUIPO_BASE.find((p) => p.id === v.meseroId)
  const total = (v.salida - v.llegada) / 60000
  const tramos = [
    { nombre: "Llegó y ordenó", desde: v.llegada, hasta: v.orden, color: COLORES.oro },
    { nombre: "Esperó el primer plato", desde: v.orden, hasta: v.primerPlato, color: COLORES.coral },
    { nombre: "Comió", desde: v.primerPlato, hasta: v.cuenta, color: COLORES.mar },
    { nombre: "Pidió la cuenta y pagó", desde: v.cuenta, hasta: v.pago, color: COLORES.rosa },
    { nombre: "Se levantó", desde: v.pago, hasta: v.salida, color: COLORES.gris },
  ].map((t) => ({ ...t, min: Math.max(0, (t.hasta - t.desde) / 60000) }))
  const fecha = fechaLocal(v.llegada)

  return (
    <>
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-acento">{diaLargo(fecha)}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-tight">
            Mesa{" "}
            <Link href={`/admin/salon/mesas/${v.mesaId}`} className="underline-offset-4 hover:underline">
              {mesa?.nombre ?? v.mesaId}
            </Link>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ZONA_COLOR[v.zona] }} />
              {NOMBRE_ZONA[v.zona]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden /> {v.personas} personas
            </span>
            <span>Atendió {mesero?.nombre ?? v.meseroId}</span>
            <span>
              {hora12(horaLocal(v.llegada))} a {hora12(horaLocal(v.salida))}
            </span>
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-xs text-muted-foreground">Total pagado</p>
          <p className="font-display text-4xl font-semibold tabular-nums">{rd(v.total)}</p>
          <p className="text-sm text-muted-foreground">en {minutos(total)}</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Enlace icono={<Contact className="h-4 w-4" aria-hidden />} titulo="Cliente" valor={v.clienteId ? nombreCliente ?? "Ver ficha" : "Sin ficha"} href={v.clienteId ? `/admin/clientes/${v.clienteId}` : undefined} />
        <Enlace icono={<CalendarCheck className="h-4 w-4" aria-hidden />} titulo="Reserva" valor={v.reservaId ? `Por ${NOMBRE_CANAL[v.canal]}` : "Llegó sin reserva"} href={v.reservaId ? `/admin/reservaciones/${v.reservaId}` : undefined} />
        <Enlace icono={<Star className="h-4 w-4" aria-hidden />} titulo="Reseña" valor={v.calificacion ? `${v.calificacion} de 5${v.comentario ? `: “${v.comentario}”` : ""}` : "Sin calificar"} />
      </div>

      <Tarjeta titulo="Cómo se fue el tiempo">
        <div className="flex h-9 w-full overflow-hidden rounded-lg" role="img" aria-label="Tramos de la visita">
          {tramos.map((t) => (
            <div key={t.nombre} style={{ width: `${(t.min / Math.max(1, total)) * 100}%`, background: t.color }} title={`${t.nombre}: ${minutos(t.min)}`} />
          ))}
        </div>
        <ol className="mt-4 space-y-3">
          {tramos.map((t) => (
            <li key={t.nombre} className="flex items-center gap-3 text-sm">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: t.color }} />
              <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{hora12(horaLocal(t.desde))}</span>
              <span className="min-w-0 flex-1">{t.nombre}</span>
              <span className="shrink-0 font-medium tabular-nums">{minutos(t.min)}</span>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Lo que pidió">
          <ul className="divide-y">
            {v.platos.map((p, i) => {
              const plato = PLATOS.get(p.platoId)
              const objetivo = plato?.minutos ?? 0
              const tarde = objetivo && p.minutosCocina > objetivo * 1.3
              return (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  {plato?.foto ? (
                    <img src={`/boca-marina/${plato.foto}`} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted font-display text-muted-foreground">{(plato?.nombre ?? "?")[0]}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {plato?.porLibra ? `${p.cantidad} lb ` : p.cantidad > 1 ? `${p.cantidad} x ` : ""}
                      {plato?.nombre ?? p.platoId}
                    </p>
                    <p className={cn("text-xs", tarde ? "font-medium text-destructive" : "text-muted-foreground")}>
                      Cocina {minutos(p.minutosCocina)}
                      {objetivo ? ` · objetivo ${minutos(objetivo)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">{rd(p.importe)}</span>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
        <div className="flex min-w-0 flex-col gap-4">
          <Tarjeta titulo="Cuenta">
            <dl className="space-y-1.5 text-sm tabular-nums">
              <Fila t="Subtotal" v={rd(v.subtotal)} />
              <Fila t={`ITBIS ${ITBIS * 100} %`} v={rd(v.itbis)} />
              <Fila t={`Servicio ${SERVICIO * 100} %`} v={rd(v.servicio)} />
              <Fila t="Propina" v={v.propina ? rd(v.propina) : "-"} />
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{rd(v.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" aria-hidden /> {METODO[v.metodo]} · {rd(Math.round(v.subtotal / Math.max(1, v.personas)))} por persona
            </p>
          </Tarjeta>
          <Tarjeta titulo="Atención">
            <p className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
              {v.llamados ? `${v.llamados} ${v.llamados === 1 ? "llamado" : "llamados"} desde el QR, respondidos en ${v.esperaLlamado} s en promedio` : "No llamó al mesero"}
            </p>
          </Tarjeta>
        </div>
      </div>
    </>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{t}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  )
}

function Enlace({ icono, titulo, valor, href }: { icono: React.ReactNode; titulo: string; valor: string; href?: string }) {
  const contenido = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">{icono}</span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{titulo}</span>
        <span className={cn("block truncate text-sm font-medium", href && "text-primary")}>{valor}</span>
      </span>
    </>
  )
  return href ? (
    <Link href={href} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent">
      {contenido}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">{contenido}</div>
  )
}
