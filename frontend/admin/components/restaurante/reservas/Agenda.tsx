"use client"

import Link from "next/link"
import { hora12, minutosDelDia, NOMBRE_ZONA, ZONAS } from "@/lib/restaurante/local"
import type { Cliente, Mesa, Reserva } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { ESTADO_RESERVA } from "./comun"

const INICIO = 10 * 60
const DURACION: Record<string, number> = { salon: 150, gazebo: 120, terraza: 105, muelle: 110 }

/** Minutos desde la medianoche; la madrugada cuenta como continuación de la noche. */
const minutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number)
  return (h < 6 ? h + 24 : h) * 60 + m
}

export function AgendaDia({ reservas, mesas, clientes, esHoy, ahora }: { reservas: Reserva[]; mesas: Mesa[]; clientes: Cliente[]; esHoy: boolean; ahora: number }) {
  const fin = Math.max(24 * 60, ...reservas.map((r) => minutos(r.hora) + (DURACION[r.zona] ?? 120)))
  const total = fin - INICIO
  const horas = Array.from({ length: Math.ceil(total / 60) + 1 }, (_, i) => INICIO + i * 60).filter((m) => m <= fin)
  const pos = (m: number) => `${((m - INICIO) / total) * 100}%`
  const ahoraMin = (() => {
    const m = minutosDelDia(ahora)
    return m < 6 * 60 ? m + 24 * 60 : m
  })()
  const sinMesa = reservas.filter((r) => !r.mesaId)
  const alergias = (r: Reserva) => clientes.find((c) => c.id === r.clienteId)?.alergias ?? []

  const Bloque = ({ r }: { r: Reserva }) => {
    const ini = Math.max(INICIO, minutos(r.hora))
    const dur = DURACION[r.zona] ?? 120
    const e = ESTADO_RESERVA[r.estado]
    const apagada = r.estado === "cancelada" || r.estado === "no_show" || r.estado === "completada"
    const al = alergias(r)
    return (
      <Link
        href={`/admin/reservaciones/${r.id}`}
        className={cn(
          "absolute top-1 bottom-1 z-[1] flex min-w-0 flex-col justify-center overflow-hidden rounded-md border-l-4 bg-card px-2 text-left shadow-sm ring-1 ring-border transition hover:z-[2] hover:ring-primary/50 focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          apagada && "opacity-55",
        )}
        style={{ left: pos(ini), width: `calc(${(dur / total) * 100}% - 3px)`, borderLeftColor: e.punto }}
        title={`${r.nombre}, ${r.personas} personas, ${hora12(r.hora)}. ${e.nombre}${r.ocasion ? `. ${r.ocasion}` : ""}`}
      >
        <span className="truncate text-xs font-medium">
          {hora12(r.hora)} · {r.nombre}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {r.personas} pers.{r.ocasion ? ` · ${r.ocasion}` : ""}
          {al.length ? <span className="text-destructive"> · Alergia: {al.join(", ")}</span> : null}
        </span>
      </Link>
    )
  }

  const Fila = ({ nombre, capacidad, lista }: { nombre: string; capacidad?: number; lista: Reserva[] }) => (
    <div className="flex h-12 border-b last:border-b-0">
      <div className="sticky left-0 z-[3] flex w-24 shrink-0 flex-col justify-center border-r bg-card px-3">
        <span className="text-sm font-medium leading-tight">{nombre}</span>
        {capacidad ? <span className="text-[11px] text-muted-foreground">{capacidad} sillas</span> : null}
      </div>
      <div className="relative flex-1">
        {horas.map((h) => (
          <span key={h} className="absolute inset-y-0 border-l border-dashed border-border/70" style={{ left: pos(h) }} aria-hidden />
        ))}
        {lista.map((r) => (
          <Bloque key={r.id} r={r} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="min-w-[880px]">
        <div className="sticky top-0 z-[4] flex h-9 border-b bg-card">
          <div className="sticky left-0 z-[5] w-24 shrink-0 border-r bg-card" />
          <div className="relative flex-1">
            {horas.map((h) => (
              <span key={h} className="absolute top-2 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground first:translate-x-0" style={{ left: pos(h) }}>
                {hora12(`${String(Math.floor(h / 60) % 24).padStart(2, "0")}:00`).replace(":00", "")}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          {esHoy && ahoraMin >= INICIO && ahoraMin <= fin && (
            <div className="pointer-events-none absolute inset-y-0 left-24 right-0 z-[2]" aria-hidden>
              <span className="absolute inset-y-0 w-0.5 bg-acento" style={{ left: pos(ahoraMin) }} />
            </div>
          )}
          {ZONAS.map((z) => {
            const deZona = mesas.filter((m) => m.zona === z.id)
            return (
              <section key={z.id} aria-label={z.nombre}>
                <div className="sticky left-0 border-b bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {z.nombre} · {reservas.filter((r) => r.zona === z.id && r.mesaId).length} reservas
                </div>
                {deZona.map((m) => (
                  <Fila key={m.id} nombre={m.nombre} capacidad={m.capacidad} lista={reservas.filter((r) => r.mesaId === m.id)} />
                ))}
              </section>
            )
          })}
          {sinMesa.length > 0 && (
            <section aria-label="Sin mesa asignada">
              <div className="sticky left-0 border-b bg-[#E8866A]/10 px-3 py-1.5 text-xs font-medium text-muted-foreground">Sin mesa asignada · {sinMesa.length}</div>
              {sinMesa.map((r) => (
                <Fila key={r.id} nombre={NOMBRE_ZONA[r.zona]} lista={[r]} />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
