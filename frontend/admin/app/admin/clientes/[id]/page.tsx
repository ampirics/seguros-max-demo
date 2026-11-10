"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CalendarCheck, CreditCard, Mail, MessageCircle, MessageSquare, Phone, Receipt, Star, UtensilsCrossed, UserPlus, Armchair } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CanalChip, EstadoReservaChip, fechaHora } from "@/components/restaurante/reservas/comun"
import { haceDias, iniciales } from "@/components/restaurante/clientes/segmentos"
import { PLATOS, rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { hora12, NOMBRE_ZONA } from "@/lib/restaurante/local"
import type { Cliente, Conversacion, PasoRecorrido, Reserva, TipoPaso, Visita } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

type Ficha = { cliente: Cliente; reservas: Reserva[]; visitas: Visita[]; favoritos: string[]; conversacion: Conversacion | null }

const PASO: Record<TipoPaso, { nombre: string; icono: typeof Phone; color: string }> = {
  contacto: { nombre: "Primer contacto", icono: UserPlus, color: "bg-[#7FCFCB]" },
  conversacion: { nombre: "Conversación", icono: MessageCircle, color: "bg-[#4A7BD0]" },
  reserva: { nombre: "Reserva", icono: CalendarCheck, color: "bg-[#9B8CE8]" },
  llegada: { nombre: "Llegada", icono: Armchair, color: "bg-[#F2C14E]" },
  pedido: { nombre: "Pedido", icono: UtensilsCrossed, color: "bg-[#E8866A]" },
  pago: { nombre: "Pago", icono: CreditCard, color: "bg-[#6BBF8A]" },
  resena: { nombre: "Reseña", icono: Star, color: "bg-[#E86A9B]" },
  evento: { nombre: "Evento", icono: CalendarCheck, color: "bg-[#9B8CE8]" },
  puntos: { nombre: "Puntos", icono: Star, color: "bg-[#F2C14E]" },
}

const fechaCorta = (ts: number) => new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))

export default function ClientePage() {
  const id = useParams<{ id: string }>()?.id ?? ""
  const { estado, ahora } = useRestaurante()
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [error, setError] = useState(false)
  const vivo = estado?.clientes.find((c) => c.id === id)
  const pasos = vivo?.recorrido.length ?? 0

  useEffect(() => {
    restauranteApi.cliente(id).then(setFicha).catch(() => setError(true))
  }, [id, pasos])

  if (error) {
    return (
      <AdminLayout title="Cliente">
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <p className="font-medium">No encontré ese cliente.</p>
          <Link href="/admin/clientes" className="mt-2 inline-block text-sm text-primary hover:underline">Volver a clientes</Link>
        </div>
      </AdminLayout>
    )
  }
  if (!ficha) {
    return (
      <AdminLayout title="Cliente">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    )
  }

  const c = vivo ?? ficha.cliente
  const visitas = ficha.visitas
  const ticket = visitas.length ? visitas.reduce((s, v) => s + v.total, 0) / visitas.length : 0
  const duracion = visitas.length ? visitas.reduce((s, v) => s + (v.salida - v.llegada), 0) / visitas.length / 60000 : 0
  const porPersona = visitas.length ? visitas.reduce((s, v) => s + v.subtotal, 0) / Math.max(1, visitas.reduce((s, v) => s + v.personas, 0)) : 0
  const zonaFav = (() => {
    const m = new Map<string, number>()
    for (const v of visitas) m.set(v.zona, (m.get(v.zona) ?? 0) + 1)
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    return top ? NOMBRE_ZONA[top[0] as keyof typeof NOMBRE_ZONA] : null
  })()
  const proximas = ficha.reservas.filter((r) => ["solicitada", "confirmada", "recordada", "asistencia_confirmada", "lista_espera", "sentada"].includes(r.estado))
  const recorrido = [...c.recorrido].sort((a, b) => b.ts - a.ts)

  return (
    <AdminLayout title={c.nombre}>
      <div className="flex min-w-0 flex-col gap-5">
        <Link href="/admin/clientes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Clientes
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-5 rounded-xl border bg-card p-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">{iniciales(c.nombre) || "C"}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{c.nombre}</h1>
                {c.etiqueta && <span className="rounded-full bg-[#E8866A]/15 px-2.5 py-0.5 text-xs font-medium text-[#B5532F] dark:text-[#F0A48A]">{c.etiqueta}</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" aria-hidden />{c.telefono}</span>
                {c.correo && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" aria-hidden />{c.correo}</span>}
                <span>Cliente desde {fechaCorta(c.creado)}</span>
                <span className="inline-flex items-center gap-1">Llegó por <CanalChip canal={c.canalOrigen} /></span>
              </div>
              {c.alergias?.length ? (
                <p className="mt-3 inline-flex rounded-md bg-destructive-soft px-3 py-1.5 text-sm font-medium text-destructive">Alergia: {c.alergias.join(", ")}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.preferencias.map((p) => (
                  <span key={p} className="rounded-full border px-2.5 py-0.5 text-xs">{p}</span>
                ))}
                {c.ocasiones.map((o) => (
                  <span key={o} className="rounded-full bg-[#9B8CE8]/15 px-2.5 py-0.5 text-xs text-[#6B5BC8] dark:text-[#B9AEF2]">{o}</span>
                ))}
                {c.cumpleanos && <span className="rounded-full bg-[#F2C14E]/20 px-2.5 py-0.5 text-xs">Cumpleaños {Number(c.cumpleanos.slice(3))} de {new Intl.DateTimeFormat("es-DO", { month: "long" }).format(new Date(2026, Number(c.cumpleanos.slice(0, 2)) - 1, 1))}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.conversacionId && (
              <Button asChild>
                <Link href={`/admin/chat?conversacion=${c.conversacionId}`}>
                  <MessageSquare className="h-4 w-4" aria-hidden /> Ver conversación
                </Link>
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { t: "Visitas", v: String(c.visitas), s: haceDias(c.ultimaVisita, ahora) },
            { t: "Consumo total", v: rd(c.gasto), s: "Con impuestos y servicio" },
            { t: "Ticket por visita", v: rd(ticket), s: visitas.length ? `${visitas.length} cuentas` : "Sin visitas" },
            { t: "Por persona", v: rd(porPersona), s: "Sin impuestos" },
            { t: "Duración de la mesa", v: duracion ? `${Math.round(duracion)} min` : "-", s: zonaFav ? `Prefiere ${zonaFav}` : "Sin zona preferida" },
            { t: "Puntos", v: String(c.puntos), s: "1 punto por cada RD$ 100" },
          ].map((x) => (
            <div key={x.t} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{x.t}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{x.v}</p>
              <p className="truncate text-[11px] text-muted-foreground">{x.s}</p>
            </div>
          ))}
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Recorrido de punta a punta</h2>
            <p className="text-xs text-muted-foreground">Del primer contacto a la última reseña. Lo más reciente arriba.</p>
            <ol className="mt-4 flex flex-col">
              {recorrido.map((p, i) => (
                <Paso key={`${p.ts}-${i}`} p={p} ultimo={i === recorrido.length - 1} />
              ))}
            </ol>
          </section>

          <aside className="flex min-w-0 flex-col gap-5">
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Lo que suele pedir</h2>
              {ficha.favoritos.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Todavía no hay pedidos registrados.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {ficha.favoritos.map((f) => {
                    const p = PLATOS.get(f)
                    if (!p) return null
                    return (
                      <li key={f} className="flex items-center gap-3">
                        {p.foto ? (
                          <img src={`/boca-marina/${p.foto}`} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-secondary"><UtensilsCrossed className="h-4 w-4 text-muted-foreground" aria-hidden /></span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.nombre}</span>
                          <span className="block text-xs text-muted-foreground">{p.categoria} · {rd(p.precio)}{p.porLibra ? " por libra" : ""}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Reservas activas</h2>
              {proximas.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sin reservas por venir.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {proximas.map((r) => (
                    <li key={r.id}>
                      <Link href={`/admin/reservaciones/${r.id}`} className="block rounded-lg border px-3 py-2 transition hover:bg-accent">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{r.fecha} · {hora12(r.hora)}</span>
                          <EstadoReservaChip estado={r.estado} />
                        </span>
                        <span className="block text-xs text-muted-foreground">{r.personas} personas · {NOMBRE_ZONA[r.zona]}{r.ocasion ? ` · ${r.ocasion}` : ""}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        <Tabs defaultValue="visitas" className="min-w-0">
          <TabsList>
            <TabsTrigger value="visitas">Visitas ({visitas.length})</TabsTrigger>
            <TabsTrigger value="reservas">Todas las reservas ({ficha.reservas.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="visitas">
            {visitas.length === 0 ? (
              <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Todavía no ha venido.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {visitas.map((v) => (
                  <li key={v.id}>
                    <Link href={`/admin/visitas/${v.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-accent">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{fechaCorta(v.llegada)} · {NOMBRE_ZONA[v.zona]}, mesa {v.mesaId}</span>
                        <span className="block text-xs text-muted-foreground">
                          {v.personas} personas · {Math.round((v.salida - v.llegada) / 60000)} min · {v.platos.length} platos{v.calificacion ? ` · ${v.calificacion} de 5` : ""}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-medium tabular-nums">
                        <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
                        {rd(v.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="reservas">
            {ficha.reservas.length === 0 ? (
              <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Sin reservas.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {ficha.reservas.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/reservaciones/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-accent">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{r.fecha} · {hora12(r.hora)} · {r.codigo}</span>
                        <span className="block text-xs text-muted-foreground">{r.personas} personas · {NOMBRE_ZONA[r.zona]}{r.ocasion ? ` · ${r.ocasion}` : ""}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <CanalChip canal={r.canal} compacto />
                        <EstadoReservaChip estado={r.estado} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}

function Paso({ p, ultimo }: { p: PasoRecorrido; ultimo: boolean }) {
  const d = PASO[p.tipo]
  const Icono = d.icono
  const contenido = (
    <>
      <p className="text-sm">
        <span className="font-medium">{d.nombre}</span> · {p.texto}
      </p>
      <p className="text-xs text-muted-foreground">
        {fechaHora(p.ts)}
        {p.quien ? ` · ${p.quien}` : ""}
      </p>
    </>
  )
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!ultimo && <span className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-border" aria-hidden />}
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#0B2A2E]", d.color)}>
        <Icono className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        {p.enlace ? (
          <Link href={p.enlace} className="block rounded-md hover:underline">
            {contenido}
          </Link>
        ) : (
          contenido
        )}
      </div>
    </li>
  )
}
