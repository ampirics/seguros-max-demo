"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, Bot, CalendarCheck, ChefHat, MessageSquare, Receipt, Users } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { ESTADO_MESA, ORDEN_ESTADOS } from "@/components/restaurante/plano/estados"
import { useAdmin } from "@/contexts/admin-context"
import { PLATOS, rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { diaLargo, fechaLocal, hace, hora12, minutosDelDia, NOMBRE_CANAL, NOMBRE_ZONA, tsLocal } from "@/lib/restaurante/local"
import type { Metricas } from "@/lib/restaurante/servidor/metricas"
import type { Estado } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

export function InicioRestaurante() {
  const { estado, ahora } = useRestaurante()
  const { user } = useAdmin()
  const [mes, setMes] = useState<Metricas | null>(null)
  useEffect(() => {
    restauranteApi.metricas(30).then(setMes).catch(() => setMes(null))
  }, [])

  const min = minutosDelDia(ahora)
  const saludo = min < 12 * 60 ? "Buenos días" : min < 19 * 60 ? "Buenas tardes" : "Buenas noches"

  return (
    <AdminLayout title="Inicio">
      <div className="flex flex-col gap-5">
        <section className="relative overflow-hidden rounded-2xl">
          <img src="/boca-marina/hero-sunset.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B2A2E]/90 via-[#0B2A2E]/65 to-[#0B2A2E]/10" />
          <div className="relative flex flex-col gap-4 px-6 py-8 text-[#F4ECDF] sm:px-10 sm:py-10">
            <div className="text-xs uppercase tracking-[0.25em] text-[#7FCFCB]">{diaLargo(fechaLocal(ahora))}</div>
            <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">
              {saludo}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}. <em className="font-medium text-[#E8866A]">Así va Boca Marina hoy.</em>
            </h2>
            {estado ? <Resumen estado={estado} ahora={ahora} /> : <Skeleton className="h-16 w-full max-w-2xl bg-white/10" />}
          </div>
        </section>

        {!estado ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <Alertas estado={estado} ahora={ahora} />
            <div className="grid gap-5 xl:grid-cols-3">
              <Salon estado={estado} />
              <Bandeja estado={estado} ahora={ahora} />
              <Reservas estado={estado} ahora={ahora} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <MasVendido estado={estado} />
              <Mes mes={mes} />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function Resumen({ estado, ahora }: { estado: Estado; ahora: number }) {
  const hoy = fechaLocal(ahora)
  const ventas = estado.visitasHoy.reduce((s, v) => s + v.total, 0)
  const comensalesHoy = estado.visitasHoy.reduce((s, v) => s + v.personas, 0) + estado.mesas.reduce((s, m) => s + (["libre", "reservada", "limpieza"].includes(m.estado) ? 0 : m.comensales ?? 0), 0)
  const reservas = estado.reservas.filter((r) => r.fecha === hoy && r.estado !== "cancelada")
  const ia = estado.conversaciones.filter((c) => fechaLocal(c.actualizada) === hoy)
  const items = [
    { t: "Ventas cerradas", v: rd(ventas) },
    { t: "Comensales", v: String(comensalesHoy) },
    { t: "Reservas de hoy", v: String(reservas.length) },
    { t: "Chats atendidos", v: String(ia.length) },
  ]
  return (
    <dl className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((x) => (
        <div key={x.t}>
          <dt className="text-xs text-[#F4ECDF]/70">{x.t}</dt>
          <dd className="font-display text-3xl font-semibold tabular-nums">{x.v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Alertas({ estado, ahora }: { estado: Estado; ahora: number }) {
  const hoy = fechaLocal(ahora)
  const alertas: { texto: string; href: string }[] = []
  const esperando = estado.conversaciones.filter((c) => c.estado === "esperando_equipo")
  if (esperando.length) alertas.push({ texto: `${esperando.length} ${esperando.length === 1 ? "cliente espera" : "clientes esperan"} a alguien del equipo en la bandeja`, href: "/admin/chat?tag=agent_requested" })
  const llamados = estado.mesas.filter((m) => m.llamado && ahora - m.llamado.desde > 90_000)
  if (llamados.length) alertas.push({ texto: `${llamados.map((m) => m.nombre).join(", ")}: llamado sin atender hace más de 1 minuto`, href: "/admin/salon" })
  const tarde = estado.pedidos.flatMap((p) => p.items.filter((i) => (i.estado === "pendiente" || i.estado === "preparando") && (ahora - i.enviado) / 60000 > i.minutos * 1.3).map(() => p.mesaId))
  if (tarde.length) alertas.push({ texto: `${tarde.length} platos pasados de su tiempo en cocina`, href: "/admin/cocina" })
  const sinConfirmar = estado.reservas.filter((r) => r.fecha === hoy && (r.estado === "solicitada" || r.estado === "lista_espera"))
  if (sinConfirmar.length) alertas.push({ texto: `${sinConfirmar.length} reservas de hoy por confirmar o en lista de espera`, href: "/admin/reservaciones" })
  const sinRespuesta = estado.reservas.filter((r) => r.fecha === hoy && r.estado === "recordada")
  if (sinRespuesta.length) alertas.push({ texto: `${sinRespuesta.length} recordatorios sin respuesta del cliente`, href: "/admin/reservaciones" })
  if (!alertas.length) return null
  return (
    <section className="rounded-xl border border-acento/40 bg-acento/5">
      <h3 className="flex items-center gap-1.5 border-b border-acento/20 px-5 py-3 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-acento" aria-hidden /> Requiere atención</h3>
      <ul className="divide-y divide-acento/15">
        {alertas.map((a) => (
          <li key={a.texto}>
            <Link href={a.href} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-acento/10">
              {a.texto} <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Tarjeta({ titulo, icono: Icono, href, enlace, children }: { titulo: string; icono: typeof Users; href: string; enlace: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Icono className="h-4 w-4 text-muted-foreground" aria-hidden /> {titulo}</h3>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">{enlace}</Link>
      </div>
      <div className="flex-1 px-5 py-4">{children}</div>
    </section>
  )
}

function Salon({ estado }: { estado: Estado }) {
  const total = estado.mesas.length
  const ocupadas = estado.mesas.filter((m) => !["libre", "reservada", "limpieza"].includes(m.estado)).length
  return (
    <Tarjeta titulo="El salón ahora" icono={Users} href="/admin/salon" enlace="Ver en vivo">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-display text-4xl font-semibold tabular-nums">{Math.round((ocupadas / total) * 100)}%</div>
          <div className="text-xs text-muted-foreground">de ocupación · {ocupadas} de {total} mesas</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{estado.pedidos.flatMap((p) => p.items).filter((i) => i.estado === "pendiente" || i.estado === "preparando").length} platos en cocina</div>
          <div>{estado.mesas.filter((m) => m.llamado).length} llamados abiertos</div>
        </div>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-secondary">
        {ORDEN_ESTADOS.map((e) => {
          const n = estado.mesas.filter((m) => m.estado === e).length
          return n ? <div key={e} style={{ width: `${(n / total) * 100}%`, background: ESTADO_MESA[e].color }} title={`${ESTADO_MESA[e].nombre}: ${n}`} /> : null
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {ORDEN_ESTADOS.map((e) => (
          <li key={e} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: ESTADO_MESA[e].color }} />{ESTADO_MESA[e].nombre}</span>
            <span className="tabular-nums text-muted-foreground">{estado.mesas.filter((m) => m.estado === e).length}</span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

function Bandeja({ estado, ahora }: { estado: Estado; ahora: number }) {
  const lista = [...estado.conversaciones].sort((a, b) => b.actualizada - a.actualizada).slice(0, 5)
  const resueltas = estado.conversaciones.filter((c) => c.estado === "ia" || c.estado === "cerrada").length
  return (
    <Tarjeta titulo="La bandeja" icono={MessageSquare} href="/admin/chat" enlace="Abrir la bandeja">
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
        <Bot className="h-4 w-4 text-primary" aria-hidden />
        La IA atiende {resueltas} de {estado.conversaciones.length} conversaciones sin ayuda del equipo.
      </div>
      <ul className="grid gap-2.5">
        {lista.map((c) => {
          const cli = estado.clientes.find((x) => x.id === c.clienteId)
          return (
            <li key={c.id}>
              <Link href={`/admin/chat?conversacion=${c.id}`} className="flex items-start justify-between gap-3 hover:underline">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{cli?.nombre ?? "Cliente"}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.tema} · {NOMBRE_CANAL[c.canal]}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", c.estado === "esperando_equipo" ? "bg-warning-soft text-warning" : c.estado === "equipo" ? "bg-info-soft text-info" : "bg-success-soft text-success")}>
                    {c.estado === "esperando_equipo" ? "Espera al equipo" : c.estado === "equipo" ? "Con el equipo" : c.estado === "cerrada" ? "Resuelta" : "IA"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">hace {hace(c.actualizada, ahora)}</span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}

function Reservas({ estado, ahora }: { estado: Estado; ahora: number }) {
  const hoy = fechaLocal(ahora)
  const deHoy = estado.reservas.filter((r) => r.fecha === hoy && !["cancelada"].includes(r.estado))
  const proximas = deHoy.filter((r) => ["confirmada", "recordada", "asistencia_confirmada", "solicitada"].includes(r.estado) && tsLocal(r.fecha, r.hora) > ahora - 20 * 60000).sort((a, b) => a.hora.localeCompare(b.hora)).slice(0, 4)
  const confirmaron = deHoy.filter((r) => r.estado === "asistencia_confirmada").length
  return (
    <Tarjeta titulo="Reservas de hoy" icono={CalendarCheck} href="/admin/reservaciones" enlace="Ver la agenda">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini v={String(deHoy.length)} t="reservas" />
        <Mini v={String(deHoy.reduce((s, r) => s + r.personas, 0))} t="personas" />
        <Mini v={String(confirmaron)} t="confirmaron" />
      </div>
      <ul className="mt-3 grid gap-2">
        {proximas.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/reservaciones/${r.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
              <span className="min-w-0 truncate"><span className="font-medium tabular-nums">{hora12(r.hora)}</span> · {r.nombre}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{r.personas} · {NOMBRE_ZONA[r.zona]}</span>
            </Link>
          </li>
        ))}
        {!proximas.length && <li className="text-sm text-muted-foreground">No quedan reservas por llegar hoy.</li>}
      </ul>
    </Tarjeta>
  )
}

function MasVendido({ estado }: { estado: Estado }) {
  const conteo = new Map<string, number>()
  for (const v of estado.visitasHoy) for (const p of v.platos) conteo.set(p.platoId, (conteo.get(p.platoId) ?? 0) + (Number.isInteger(p.cantidad) ? p.cantidad : 1))
  for (const p of estado.pedidos) for (const i of p.items) conteo.set(i.platoId, (conteo.get(i.platoId) ?? 0) + (Number.isInteger(i.cantidad) ? i.cantidad : 1))
  const top = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  return (
    <Tarjeta titulo="Lo que más sale hoy" icono={ChefHat} href="/admin/carta" enlace="Ver la carta">
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay platos pedidos hoy.</p>
      ) : (
        <ul className="grid gap-2.5">
          {top.map(([id, n]) => {
            const p = PLATOS.get(id)
            return (
              <li key={id} className="flex items-center gap-3">
                {p?.foto ? <img src={`/boca-marina/${p.foto}`} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" /> : <div className="h-10 w-10 shrink-0 rounded-md bg-secondary" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p?.nombre}</div>
                  <div className="text-xs text-muted-foreground">{p?.categoria} · {rd(p?.precio ?? 0)}</div>
                </div>
                <span className="font-display text-xl font-semibold tabular-nums">{n}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Tarjeta>
  )
}

function Mes({ mes }: { mes: Metricas | null }) {
  return (
    <Tarjeta titulo="Los últimos 30 días" icono={Receipt} href="/admin/metricas" enlace="Ver las métricas">
      {!mes ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini v={rd(mes.resumen.ventas)} t="ventas" />
            <Mini v={rd(mes.resumen.ticketPersona)} t="por persona" />
            <Mini v={`${Math.round(mes.resumen.duracion)} min`} t="dura una mesa" />
            <Mini v={`${mes.reservas.noShow}%`} t="no se presentan" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {(() => {
              const z = [...mes.porZona].sort((a, b) => b.ticketPersona - a.ticketPersona)[0]
              const top = mes.platos[0]
              return z && top ? `${z.nombre} es la zona que más deja por persona (${rd(z.ticketPersona)}). El plato que más sale es ${top.nombre}, en ${top.mesasPct}% de las mesas.` : ""
            })()}
          </p>
        </>
      )}
    </Tarjeta>
  )
}

function Mini({ v, t }: { v: string; t: string }) {
  return (
    <div className="rounded-lg bg-secondary px-2 py-2 text-center">
      <div className="truncate font-display text-xl font-semibold tabular-nums">{v}</div>
      <div className="text-[10px] text-muted-foreground">{t}</div>
    </div>
  )
}
