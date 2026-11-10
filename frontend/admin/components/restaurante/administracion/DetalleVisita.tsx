"use client"

import Link from "next/link"
import { ArrowUpRight, Clock, Contact, UserRound, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLATOS, rd } from "@/lib/restaurante/carta"
import { useRestaurante } from "@/lib/restaurante/cliente"
import { NOMBRE_ZONA } from "@/lib/restaurante/local"
import { EQUIPO_BASE, MESAS_BASE } from "@/lib/restaurante/plano"
import type { Visita } from "@/lib/restaurante/tipos"
import { Bloque, Cargando, ChipMetodo, Dato, fechaHora, hora, Titulo, useDatos } from "./comun"
import { useDetalle } from "./contexto"

export function DetalleVisita({ id }: { id: string }) {
  const { estado } = useRestaurante()
  const { cerrar } = useDetalle()
  const { datos: v, error } = useDatos<Visita>(`/visitas/${encodeURIComponent(id)}`)
  if (!v) return <Cargando error={error} />

  const mesa = estado?.mesas.find((m) => m.id === v.mesaId) ?? MESAS_BASE.find((m) => m.id === v.mesaId)
  const mesero = estado?.equipo.find((p) => p.id === v.meseroId) ?? EQUIPO_BASE.find((p) => p.id === v.meseroId)
  const cliente = v.clienteId ? estado?.clientes.find((c) => c.id === v.clienteId) : undefined
  const minutos = Math.round((v.salida - v.llegada) / 60000)
  const enMesa = minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`
  const filas: [string, number][] = [
    ["Subtotal", v.subtotal],
    ["ITBIS", v.itbis],
    ["Servicio", v.servicio],
    ["Propina", v.propina],
  ]

  return (
    <div className="flex flex-col gap-5">
      <Titulo
        etiqueta="Visita cobrada"
        titulo={`Mesa ${mesa?.nombre ?? v.mesaId}`}
        sub={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {NOMBRE_ZONA[v.zona]} · {fechaHora(v.llegada)} <ChipMetodo metodo={v.metodo} />
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Dato titulo="Personas" valor={<span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden /> {v.personas}</span>} />
        <Dato titulo="Mesero" valor={<span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" aria-hidden /> {mesero?.nombre ?? v.meseroId}</span>} />
        <Dato titulo="En la mesa" valor={<span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden /> {enMesa}</span>} />
        <Dato titulo="Pagó" valor={hora(v.pago)} />
      </div>

      <Bloque titulo="Cliente">
        {cliente ? (
          <Link href={`/admin/clientes/${cliente.id}`} onClick={cerrar} className="flex min-h-[44px] items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-secondary/60">
            <Contact className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{cliente.nombre}</span>
              <span className="block text-xs text-muted-foreground">{cliente.visitas} visitas · {cliente.telefono}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        ) : (
          <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">Llegó sin reserva y sin dejar sus datos.</p>
        )}
      </Bloque>

      <Bloque titulo={`Lo que pidieron (${v.platos.length})`}>
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {v.platos.map((p, k) => (
            <li key={`${p.platoId}-${k}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="tabular-nums text-muted-foreground">{p.cantidad}× </span>
                {PLATOS.get(p.platoId)?.nombre ?? p.platoId}
              </span>
              <span className="shrink-0 tabular-nums">{rd(p.importe)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid gap-1 px-3 text-sm">
          {filas.map(([t, n]) => (
            <div key={t} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t}</dt>
              <dd className="tabular-nums">{rd(n)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{rd(v.total)}</dd>
          </div>
        </dl>
      </Bloque>

      {v.calificacion != null && (
        <Bloque titulo="Reseña del cliente">
          <p className="text-sm">
            <span className="font-semibold text-[#C8593B]">{"★".repeat(v.calificacion)}</span>
            <span className="text-muted-foreground">{"★".repeat(5 - v.calificacion)}</span> {v.calificacion} de 5
          </p>
          {v.comentario && <p className="mt-1 text-sm italic text-muted-foreground">“{v.comentario}”</p>}
        </Bloque>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild className="h-11">
          <Link href={`/admin/visitas/${v.id}`} onClick={cerrar}>Ver la visita completa</Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/admin/salon/mesas/${v.mesaId}`} onClick={cerrar}>Ver la mesa</Link>
        </Button>
      </div>
    </div>
  )
}
