"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { ArrowLeft, Bell, CalendarClock, ChefHat, Clock, QrCode, Receipt, Users } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ESTADO_MESA } from "@/components/restaurante/plano/estados"
import { ESTADO_ITEM } from "@/components/restaurante/salon/ResumenMesa"
import { PLATOS, rd, totales } from "@/lib/restaurante/carta"
import { conError, restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { cronometro, fechaLocal, hace, hora12, horaLocal, NOMBRE_CANAL, NOMBRE_ZONA, tsLocal } from "@/lib/restaurante/local"
import type { Estado, Mesa, MetodoPago, Pedido, Visita } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const MIN = 60000
const avisar = (m: string) => toast.error(m)
const min = (ms: number) => Math.max(0, Math.round(ms / MIN))
const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export default function MesaPage() {
  const id = useParams<{ id: string }>()?.id ?? ""
  const { estado, ahora } = useRestaurante()
  const [historia, setHistoria] = useState<Visita[] | null>(null)
  const mesa = estado?.mesas.find((m) => m.id === id)
  const visitasHoy = estado?.visitasHoy.length ?? 0

  useEffect(() => {
    restauranteApi.visitas({ mesa: id, dias: 30 }).then(setHistoria).catch(() => setHistoria([]))
  }, [id, visitasHoy])

  return (
    <AdminLayout title={mesa ? `Mesa ${mesa.nombre}` : "Mesa"}>
      <div className="mb-4">
        <Link href="/admin/salon" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Salón en vivo
        </Link>
      </div>
      {!estado ? (
        <Skeleton className="h-96 w-full" />
      ) : !mesa ? (
        <p className="text-sm text-muted-foreground">No existe la mesa {id}.</p>
      ) : (
        <Contenido estado={estado} ahora={ahora} mesa={mesa} historia={historia} />
      )}
    </AdminLayout>
  )
}

function Contenido({ estado, ahora, mesa, historia }: { estado: Estado; ahora: number; mesa: Mesa; historia: Visita[] | null }) {
  const pedido = mesa.pedidoId ? estado.pedidos.find((p) => p.id === mesa.pedidoId) : undefined
  const cliente = mesa.clienteId ? estado.clientes.find((c) => c.id === mesa.clienteId) : undefined
  const reserva = mesa.reservaId ? estado.reservas.find((r) => r.id === mesa.reservaId) : undefined
  const mesero = estado.equipo.find((q) => q.id === mesa.meseroId)
  const e = ESTADO_MESA[mesa.estado]
  const ocupada = !["libre", "reservada", "limpieza"].includes(mesa.estado)

  const esperado = useMemo(() => {
    if (!historia?.length) return null
    const parecidas = historia.filter((v) => Math.abs(v.personas - (mesa.comensales ?? 2)) <= 1)
    const base = parecidas.length >= 3 ? parecidas : historia
    return {
      duracion: Math.round(prom(base.map((v) => (v.salida - v.llegada) / MIN))),
      aOrdenar: Math.round(prom(base.map((v) => (v.orden - v.llegada) / MIN))),
      primerPlato: Math.round(prom(base.map((v) => (v.primerPlato - v.orden) / MIN))),
      ticket: Math.round(prom(base.map((v) => v.total))),
      muestra: base.length,
    }
  }, [historia, mesa.comensales])

  const hoy = fechaLocal(ahora)
  const proximas = estado.reservas
    .filter((r) => r.mesaId === mesa.id && r.fecha >= hoy && ["confirmada", "recordada", "asistencia_confirmada", "solicitada"].includes(r.estado) && r.id !== reserva?.id)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .slice(0, 4)

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-sm text-muted-foreground">{NOMBRE_ZONA[mesa.zona]} · {mesa.capacidad} sillas</div>
              <h2 className="font-display text-4xl font-semibold leading-tight">Mesa {mesa.nombre}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: e.color, color: e.texto }}>{e.nombre}</span>
                <span className="text-muted-foreground">desde hace {hace(mesa.desde, ahora)}</span>
                {mesa.llamado && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-acento/20 px-2.5 py-0.5 text-xs font-medium">
                    <Bell className="h-3 w-3" aria-hidden /> {mesa.llamado.tipo === "cuenta" ? "Pidió la cuenta" : "Llama al mesero"} · {hace(mesa.llamado.desde, ahora)}
                  </span>
                )}
              </div>
            </div>
            <Acciones mesa={mesa} pedido={pedido} reservaPersonas={reserva?.personas} reservaCliente={reserva?.clienteId} />
          </div>
          {ocupada && mesa.tramos && <LineaTiempo mesa={mesa} ahora={ahora} esperado={esperado} />}
        </section>

        {ocupada && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Tarjeta icono={Users} t="En la mesa" v={`${mesa.comensales ?? "-"} personas`} s={mesero ? `Atiende ${mesero.nombre}` : "Sin mesero"} />
            <Tarjeta icono={Clock} t="Llevan" v={mesa.tramos ? `${min(ahora - mesa.tramos.llegada)} min` : "-"} s={esperado ? `Una mesa así dura ${esperado.duracion} min; terminaría cerca de las ${horaLocal((mesa.tramos?.llegada ?? ahora) + esperado.duracion * MIN)}` : "Calculando lo esperado"} />
            <Tarjeta icono={Receipt} t="Consumo" v={pedido ? rd(totales(pedido.items.reduce((s, i) => s + i.precio, 0)).total) : rd(0)} s={esperado ? `El promedio de esta mesa es ${rd(esperado.ticket)}` : "Con ITBIS y servicio"} />
          </div>
        )}

        {pedido ? <Orden pedido={pedido} ahora={ahora} /> : ocupada ? <Vacio texto="Todavía no han ordenado." /> : null}

        <Historial historia={historia} ahora={ahora} />
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        {cliente ? (
          <section className="rounded-xl border bg-card px-4 py-3">
            <h3 className="text-sm font-semibold">Quién está</h3>
            <Link href={`/admin/clientes/${cliente.id}`} className="mt-2 block font-display text-2xl font-semibold hover:underline">{cliente.nombre}</Link>
            <div className="text-xs text-muted-foreground">{cliente.visitas} visitas · {rd(cliente.gasto)} gastados · {cliente.puntos} puntos</div>
            {cliente.etiqueta && <div className="mt-1 inline-block rounded-full bg-acento/15 px-2 py-0.5 text-xs">{cliente.etiqueta}</div>}
            {cliente.alergias?.length ? <div className="mt-2 rounded-lg bg-destructive-soft px-3 py-2 text-xs font-medium text-destructive">Alergia: {cliente.alergias.join(", ")}</div> : null}
            {cliente.preferencias.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Prefiere: {cliente.preferencias.join(", ")}</div>}
            {cliente.conversacionId && (
              <Link href={`/admin/chat?conversacion=${cliente.conversacionId}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Abrir su conversación</Link>
            )}
          </section>
        ) : ocupada ? (
          <section className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">Clientes sin ficha. Si dejan su teléfono al pagar, la visita queda en su historial.</section>
        ) : null}

        {reserva && (
          <section className="rounded-xl border bg-card px-4 py-3">
            <h3 className="text-sm font-semibold">Reserva</h3>
            <Link href={`/admin/reservaciones/${reserva.id}`} className="mt-1 block font-medium hover:underline">{reserva.codigo} · {hora12(reserva.hora)} · {reserva.personas} personas</Link>
            <div className="text-xs text-muted-foreground">Por {NOMBRE_CANAL[reserva.canal]}{reserva.ocasion ? ` · ${reserva.ocasion}` : ""}</div>
            {reserva.notas && <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-xs">{reserva.notas}</p>}
          </section>
        )}

        <section className="rounded-xl border bg-card px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4" aria-hidden /> Próximas reservas de esta mesa</h3>
          {proximas.length ? (
            <ul className="mt-2 divide-y text-sm">
              {proximas.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/reservaciones/${r.id}`} className="min-w-0 truncate hover:underline">{r.nombre}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.fecha === hoy ? "Hoy" : r.fecha.slice(5)} · {hora12(r.hora)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Sin reservas próximas.</p>
          )}
        </section>

        <Rendimiento historia={historia} />

        <section className="rounded-xl border bg-card px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><QrCode className="h-4 w-4" aria-hidden /> QR de la mesa</h3>
          <p className="mt-1 text-xs text-muted-foreground">El cliente lo escanea para ver la carta, llamar al mesero, pedir la cuenta y seguir su pedido.</p>
          <a href={`/mesa/${mesa.id}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Abrir lo que ve el cliente</a>
        </section>
      </aside>
    </div>
  )
}

function Acciones({ mesa, pedido, reservaPersonas, reservaCliente }: { mesa: Mesa; pedido?: Pedido; reservaPersonas?: number; reservaCliente?: string }) {
  const [comensales, setComensales] = useState(reservaPersonas ?? Math.min(2, mesa.capacidad))
  const [cobrando, setCobrando] = useState(false)
  const accion = (a: Parameters<typeof restauranteApi.accion>[0], ok?: string) =>
    conError(() => restauranteApi.accion(a).then(() => ok && toast.success(ok)), avisar)
  const listos = pedido?.items.filter((i) => i.estado === "listo").length ?? 0

  if (mesa.estado === "libre" || mesa.estado === "reservada")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border">
          <Button size="sm" variant="ghost" className="h-9 w-9 px-0" onClick={() => setComensales((n) => Math.max(1, n - 1))} aria-label="Menos personas">−</Button>
          <span className="w-16 text-center text-sm tabular-nums">{comensales} pers.</span>
          <Button size="sm" variant="ghost" className="h-9 w-9 px-0" onClick={() => setComensales((n) => Math.min(mesa.capacidad + 2, n + 1))} aria-label="Más personas">+</Button>
        </div>
        <Button onClick={() => accion({ tipo: "sentar", mesaId: mesa.id, comensales, clienteId: reservaCliente, manual: true }, `Mesa ${mesa.nombre} abierta`)}>
          {mesa.estado === "reservada" ? "Llegó la reserva" : "Sentar clientes"}
        </Button>
      </div>
    )

  if (mesa.estado === "limpieza") return <Button onClick={() => accion({ tipo: "liberar", mesaId: mesa.id }, "Mesa lista")}>Marcar limpia</Button>

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mesa.llamado?.tipo === "mesero" && <Button variant="secondary" onClick={() => accion({ tipo: "atender", mesaId: mesa.id }, "Llamado atendido")}>Atender llamado</Button>}
      {listos > 0 && <Button variant="secondary" onClick={() => accion({ tipo: "servir", mesaId: mesa.id }, `${listos} platos servidos`)}>Servir {listos} listos</Button>}
      <Button variant="outline" asChild><Link href={`/admin/ordenes?mesa=${mesa.id}`}>Agregar platos</Link></Button>
      {pedido && !cobrando && <Button onClick={() => setCobrando(true)}>Cobrar</Button>}
      {pedido && cobrando && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1">
          {(["tarjeta", "efectivo", "transferencia"] as MetodoPago[]).map((m) => (
            <Button key={m} size="sm" variant="ghost" className="capitalize" onClick={() => { setCobrando(false); accion({ tipo: "cobrar", mesaId: mesa.id, metodo: m, propinaPct: 10 }, "Cuenta cobrada") }}>
              {m}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setCobrando(false)}>Cancelar</Button>
        </div>
      )}
    </div>
  )
}

function LineaTiempo({ mesa, ahora, esperado }: { mesa: Mesa; ahora: number; esperado: { duracion: number; aOrdenar: number; primerPlato: number } | null }) {
  const t = mesa.tramos!
  const pasos = [
    { n: "Llegaron", ts: t.llegada },
    { n: "Ordenaron", ts: t.orden, esperado: esperado?.aOrdenar },
    { n: "Primer plato", ts: t.primerPlato, esperado: esperado?.primerPlato },
    { n: "Pidieron la cuenta", ts: t.cuenta },
    { n: "Pagaron", ts: t.pago },
  ]
  const actual = pasos.findIndex((p) => !p.ts)
  return (
    <ol className="grid grid-cols-5 border-t bg-secondary/40">
      {pasos.map((p, i) => {
        const previo = i > 0 ? pasos[i - 1].ts : undefined
        const dur = p.ts && previo ? min(p.ts - previo) : null
        const enCurso = i === actual && previo
        const tarde = enCurso && p.esperado && min(ahora - previo!) > p.esperado * 1.3
        return (
          <li key={p.n} className={cn("border-r px-3 py-3 last:border-r-0", i === actual && "bg-card")}>
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", p.ts ? "bg-success" : i === actual ? "bg-acento" : "bg-border")} />
              <span className="truncate text-[11px] font-medium sm:text-xs">{p.n}</span>
            </div>
            <div className="mt-1 text-sm tabular-nums">{p.ts ? horaLocal(p.ts) : enCurso ? `${cronometro(previo!, ahora)}` : "-"}</div>
            <div className={cn("text-[11px] text-muted-foreground", tarde && "font-medium text-destructive")}>
              {dur != null ? `${dur} min` : enCurso ? (p.esperado ? `lo normal: ${p.esperado} min` : "en curso") : ""}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Orden({ pedido, ahora }: { pedido: Pedido; ahora: number }) {
  const rondas = Array.from(new Set(pedido.items.map((i) => i.ronda)))
  const t = totales(pedido.items.reduce((s, i) => s + i.precio, 0))
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ChefHat className="h-4 w-4" aria-hidden /> Orden #{pedido.numero}</h3>
        <span className="text-xs text-muted-foreground">abierta hace {hace(pedido.abierto, ahora)}</span>
      </div>
      {rondas.map((r) => (
        <div key={r} className="border-b px-5 py-3 last:border-b-0">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Ronda {r}</div>
          <ul className="divide-y">
            {pedido.items.filter((i) => i.ronda === r).map((i) => {
              const plato = PLATOS.get(i.platoId)
              const corriendo = i.estado === "preparando" && i.inicio
              const tarde = corriendo && (ahora - i.enviado) / MIN > i.minutos * 1.3
              return (
                <li key={i.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-start gap-3">
                    {plato?.foto ? <img src={`/boca-marina/${plato.foto}`} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" /> : <div className="h-10 w-10 shrink-0 rounded-md bg-secondary" />}
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{i.cantidad !== 1 ? `${i.cantidad}${Number.isInteger(i.cantidad) ? "×" : " lb"} ` : ""}{i.nombre}</div>
                      {(i.mods.length > 0 || i.notas) && <div className="text-xs text-muted-foreground">{[...i.mods, i.notas].filter(Boolean).join(" · ")}</div>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={cn("rounded-full px-2 text-[11px] font-medium", ESTADO_ITEM[i.estado].clase)}>
                      {ESTADO_ITEM[i.estado].nombre}{corriendo ? ` ${cronometro(i.enviado, ahora)}` : ""}
                    </span>
                    <span className={cn("text-[11px] tabular-nums text-muted-foreground", tarde && "font-medium text-destructive")}>
                      {i.listo ? `salió en ${min(i.listo - i.enviado)} min` : `meta ${i.minutos} min`} · {rd(i.precio)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div className="grid gap-0.5 border-t px-5 py-3 text-sm">
        <Fila t="Subtotal" v={rd(t.subtotal)} />
        <Fila t="ITBIS 18 %" v={rd(t.itbis)} />
        <Fila t="Servicio 10 %" v={rd(t.servicio)} />
        <div className="mt-1 flex justify-between font-display text-xl font-semibold"><span>Total</span><span className="tabular-nums">{rd(t.total)}</span></div>
      </div>
      <details className="border-t px-5 py-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Historial de la orden</summary>
        <ol className="mt-2 grid gap-1">
          {pedido.historial.map((h, i) => <li key={i}>{horaLocal(h.ts)} · {h.texto} · {h.quien}</li>)}
        </ol>
      </details>
    </section>
  )
}

function Historial({ historia, ahora }: { historia: Visita[] | null; ahora: number }) {
  const hoy = fechaLocal(ahora)
  const lista = (historia ?? []).filter((v) => fechaLocal(v.llegada) === hoy)
  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b px-5 py-3">
        <h3 className="text-sm font-semibold">Esta mesa hoy</h3>
        <p className="text-xs text-muted-foreground">{lista.length ? `Rotó ${lista.length} ${lista.length === 1 ? "vez" : "veces"} y vendió ${rd(lista.reduce((s, v) => s + v.total, 0))}` : "Todavía no se ha cerrado ninguna cuenta en esta mesa hoy."}</p>
      </div>
      {historia === null ? (
        <Skeleton className="m-5 h-16" />
      ) : lista.length > 0 && (
        <ul className="divide-y">
          {lista.map((v) => (
            <li key={v.id}>
              <Link href={`/admin/visitas/${v.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-secondary/60">
                <span className="tabular-nums">{horaLocal(v.llegada)} a {horaLocal(v.salida)}</span>
                <span className="text-muted-foreground">{v.personas} pers. · {min(v.salida - v.llegada)} min</span>
                <span className="tabular-nums font-medium">{rd(v.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Rendimiento({ historia }: { historia: Visita[] | null }) {
  if (!historia?.length) return null
  const dias = new Set(historia.map((v) => fechaLocal(v.llegada))).size || 1
  const conteo = new Map<string, number>()
  for (const v of historia) for (const p of v.platos) conteo.set(p.platoId, (conteo.get(p.platoId) ?? 0) + 1)
  const top = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  return (
    <section className="rounded-xl border bg-card px-4 py-3">
      <h3 className="text-sm font-semibold">Esta mesa en 30 días</h3>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Mini v={(historia.length / dias).toFixed(1)} t="rotaciones al día" />
        <Mini v={`${Math.round(prom(historia.map((v) => (v.salida - v.llegada) / MIN)))} min`} t="dura una mesa" />
        <Mini v={rd(prom(historia.map((v) => v.total)))} t="por cuenta" />
      </div>
      <div className="mt-3 text-xs text-muted-foreground">Lo que más se pide aquí</div>
      <ul className="mt-1 grid gap-1 text-sm">
        {top.map(([id, n]) => <li key={id} className="flex justify-between gap-2"><span className="truncate">{PLATOS.get(id)?.nombre}</span><span className="shrink-0 tabular-nums text-muted-foreground">{n}</span></li>)}
      </ul>
    </section>
  )
}

function Mini({ v, t }: { v: string; t: string }) {
  return (
    <div className="rounded-lg bg-secondary px-2 py-2">
      <div className="font-display text-lg font-semibold tabular-nums">{v}</div>
      <div className="text-[10px] text-muted-foreground">{t}</div>
    </div>
  )
}

function Tarjeta({ icono: Icono, t, v, s }: { icono: typeof Users; t: string; v: string; s: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icono className="h-3.5 w-3.5" aria-hidden /> {t}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{v}</div>
      <div className="text-xs text-muted-foreground">{s}</div>
    </div>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{t}</span><span className="tabular-nums">{v}</span></div>
}

function Vacio({ texto }: { texto: string }) {
  return <section className="rounded-xl border border-dashed bg-card px-5 py-8 text-center text-sm text-muted-foreground">{texto}</section>
}
