"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, Bot, Briefcase, Clock, FileStack, LifeBuoy, MessageSquare, Sparkles } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdmin } from "@/contexts/admin-context"
import { Chip, EtapaChip, Indicador, Persona, Ramo, SiniestroChip, Tarjeta } from "@/components/seguros/comun"
import { DIA, ETAPAS, NOMBRE_CANAL, PROCEDIMIENTOS, diaSemana, duracion, fechaLarga, hace, horaLocal, numero, rdCorto } from "@/lib/seguros/catalogo"
import { segurosApi, useSeguros, type Metricas } from "@/lib/seguros/cliente"
import type { Estado } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"

const ABIERTAS = ETAPAS.filter((e) => e.abierta).map((e) => e.id)

export function InicioSeguros() {
  const { estado, ahora } = useSeguros()
  const { user } = useAdmin()
  const [m, setM] = useState<Metricas | null>(null)
  useEffect(() => {
    segurosApi.metricas(30).then(setM).catch(() => setM(null))
  }, [estado?.version])

  const h = Number(horaLocal(ahora).slice(0, 2))
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"

  return (
    <AdminLayout title="Inicio">
      <div className="flex flex-col gap-5">
        <section className="relative overflow-hidden rounded-2xl bg-[#06193f]">
          <img src="/max/fotos/portada-max-corredores-seguros-empresas-personas.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06193f] via-[#0a2a6b]/90 to-[#0047BB]/40" />
          <div className="relative flex flex-col gap-5 px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#9fbcf0]">
              {diaSemana(ahora)}, {fechaLarga(ahora)}
            </div>
            <h2 className="max-w-3xl font-display text-3xl font-bold leading-[1.05] sm:text-5xl">
              {saludo}
              {user?.name ? `, ${user.name.split(" ")[0]}` : ""}. <span className="text-[#9fbcf0]">Así va MAX hoy.</span>
            </h2>
            {estado ? <Resumen estado={estado} ahora={ahora} m={m} /> : <Skeleton className="h-16 w-full max-w-2xl bg-white/10" />}
          </div>
        </section>

        {!estado ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <Atencion estado={estado} ahora={ahora} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador etiqueta="Primera respuesta (30 días)" valor={m?.resumen.primeraRespuestaSeg != null ? duracion(m.resumen.primeraRespuestaSeg) : "…"} detalle={m ? `Antes de ORA: ${m.comparacion.antes.primeraRespuestaSeg != null ? duracion(m.comparacion.antes.primeraRespuestaSeg) : "sin dato"}` : undefined} tono="bien" href="/admin/indicadores" />
              <Indicador etiqueta="Solicitudes nuevas (30 días)" valor={m ? numero(m.resumen.oportunidades) : "…"} detalle={m ? `${numero(m.resumen.atendidasPorIa)} las atendió la IA primero; ${numero(m.resumen.fueraDeHorario)} fuera de horario` : undefined} href="/admin/oportunidades" />
              <Indicador etiqueta="Prima nueva emitida (30 días)" valor={m ? rdCorto(m.resumen.primaNueva) : "…"} detalle={m ? `${m.resumen.ganadas} pólizas nuevas, cierre ${Math.round(m.resumen.conversionPoliza * 100)} %` : undefined} href="/admin/indicadores" />
              <Cartera estado={estado} />
            </div>
            <div className="grid gap-5 xl:grid-cols-3">
              <Bandeja estado={estado} ahora={ahora} />
              <Embudo estado={estado} ahora={ahora} />
              <Renovaciones estado={estado} ahora={ahora} />
            </div>
            <div className="grid gap-5 xl:grid-cols-3">
              <Siniestros estado={estado} ahora={ahora} />
              <Equipo estado={estado} />
              <Actividad estado={estado} ahora={ahora} />
            </div>
            <p className="text-xs text-muted-foreground">Asegurados, primas y montos de ejemplo para la demostración. Ramos, aseguradoras aliadas y procedimientos son los publicados por MAX.</p>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function Resumen({ estado, ahora, m }: { estado: Estado; ahora: number; m: Metricas | null }) {
  const hoy = ahora - (ahora % DIA) + 4 * 3600000
  const desde = hoy > ahora ? hoy - DIA : hoy
  const conv = estado.conversaciones.filter((c) => c.actualizada >= desde).length
  const esperan = estado.conversaciones.filter((c) => c.estado === "esperando_equipo").length
  const nuevas = estado.oportunidades.filter((o) => o.creada >= desde).length
  const datos = [
    { n: conv, t: conv === 1 ? "conversación hoy" : "conversaciones hoy" },
    { n: nuevas, t: nuevas === 1 ? "solicitud nueva" : "solicitudes nuevas" },
    { n: esperan, t: esperan === 1 ? "espera un ejecutivo" : "esperan un ejecutivo" },
    { n: m ? `${Math.round(m.resumen.contencion * 100)} %` : "…", t: "resueltas por la IA" },
  ]
  return (
    <div className="grid max-w-3xl grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
      {datos.map((d) => (
        <div key={d.t}>
          <div className="font-display text-3xl font-bold tabular-nums">{d.n}</div>
          <div className="text-xs text-white/75">{d.t}</div>
        </div>
      ))}
    </div>
  )
}

function Atencion({ estado, ahora }: { estado: Estado; ahora: number }) {
  const cliente = (id: string) => estado.clientes.find((c) => c.id === id)
  const items: { tono: "rojo" | "ambar"; texto: string; detalle: string; href: string }[] = []
  for (const c of estado.conversaciones.filter((x) => x.estado === "esperando_equipo"))
    items.push({ tono: "rojo", texto: `${cliente(c.clienteId)?.nombre ?? "Cliente"} espera a ${c.asignadoA ? estado.equipo.find((p) => p.id === c.asignadoA)?.nombre.split(" ")[0] : "un ejecutivo"}`, detalle: `${c.pase?.motivo ?? c.tema} · ${hace(c.pase?.desde ?? c.actualizada, ahora)}`, href: `/admin/chat?conversacion=${c.id}` })
  for (const s of estado.siniestros.filter((x) => x.lesionados && !["resuelto", "cerrado"].includes(x.estado)))
    items.push({ tono: "rojo", texto: `Siniestro con lesionados: ${s.codigo}`, detalle: `${cliente(s.clienteId)?.nombre} · ${s.lugar}`, href: `/admin/siniestros/${s.id}` })
  const vencidas = estado.oportunidades.filter((o) => ABIERTAS.includes(o.etapa) && o.siguiente && o.siguiente.vence < ahora)
  if (vencidas.length) items.push({ tono: "ambar", texto: vencidas.length === 1 ? "1 oportunidad con el seguimiento vencido" : `${vencidas.length} oportunidades con el seguimiento vencido`, detalle: `${rdCorto(vencidas.reduce((t, o) => t + (o.cotizaciones.find((c) => c.recomendada)?.prima ?? 0), 0))} en primas cotizadas`, href: "/admin/oportunidades" })
  const sinAviso = estado.polizas.filter((p) => p.estado === "por_renovar" && p.renovacion === "sin_iniciar" && p.vence - ahora < 30 * DIA)
  if (sinAviso.length) items.push({ tono: "ambar", texto: sinAviso.length === 1 ? "1 póliza vence en menos de 30 días sin aviso de renovación" : `${sinAviso.length} pólizas vencen en menos de 30 días sin aviso de renovación`, detalle: `${rdCorto(sinAviso.reduce((t, p) => t + p.primaAnual, 0))} de prima en riesgo`, href: "/admin/cartera" })
  const docs = estado.siniestros.filter((s) => s.estado === "documentos" && ahora - s.reportado > 5 * DIA)
  if (docs.length) items.push({ tono: "ambar", texto: docs.length === 1 ? "1 siniestro lleva más de 5 días esperando documentos" : `${docs.length} siniestros llevan más de 5 días esperando documentos`, detalle: "Recordar al asegurado lo que falta", href: "/admin/siniestros" })
  if (!items.length) return null
  return (
    <Tarjeta titulo={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden />Requiere atención</span>}>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.slice(0, 8).map((i) => (
          <li key={i.texto + i.href}>
            <Link href={i.href} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.tono === "rojo" ? "bg-destructive" : "bg-warning")} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{i.texto}</span>
                <span className="block truncate text-xs text-muted-foreground">{i.detalle}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

function Cartera({ estado }: { estado: Estado }) {
  const vig = estado.polizas.filter((p) => p.estado === "vigente" || p.estado === "por_renovar")
  return <Indicador etiqueta="Cartera vigente" valor={rdCorto(vig.reduce((t, p) => t + p.primaAnual, 0))} detalle={`${numero(vig.length)} pólizas de ${numero(new Set(vig.map((p) => p.clienteId)).size)} asegurados`} href="/admin/cartera" />
}

const ESTADO_CONV = { ia: { t: "IA atendiendo", c: "info" }, esperando_equipo: { t: "Espera ejecutivo", c: "rojo" }, equipo: { t: "Con el equipo", c: "azul" }, cerrada: { t: "Resuelta", c: "gris" } } as const

function Bandeja({ estado, ahora }: { estado: Estado; ahora: number }) {
  const lista = [...estado.conversaciones].sort((a, b) => b.actualizada - a.actualizada).slice(0, 6)
  return (
    <Tarjeta titulo={<span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" aria-hidden />Bandeja en vivo</span>} accion={<Link href="/admin/chat" className="text-xs font-medium text-primary hover:underline">Abrir bandeja</Link>}>
      <ul className="flex flex-col divide-y">
        {lista.map((c) => {
          const cli = estado.clientes.find((x) => x.id === c.clienteId)
          const e = ESTADO_CONV[c.estado]
          return (
            <li key={c.id}>
              <Link href={`/admin/chat?conversacion=${c.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{(cli?.nombre ?? "?").split(" ").slice(0, 2).map((x) => x[0]).join("")}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{cli?.nombre}</span>
                    {c.noLeidos > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{c.noLeidos}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{NOMBRE_CANAL[c.canal]} · {c.tema}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Chip tono={e.c}>{e.t}</Chip>
                  <span className="text-[11px] text-muted-foreground">{hace(c.actualizada, ahora)}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}

function Embudo({ estado, ahora }: { estado: Estado; ahora: number }) {
  const abiertas = estado.oportunidades.filter((o) => ABIERTAS.includes(o.etapa))
  const max = Math.max(1, ...ETAPAS.filter((e) => e.abierta).map((e) => abiertas.filter((o) => o.etapa === e.id).length))
  const recientes = [...abiertas].sort((a, b) => b.creada - a.creada).slice(0, 3)
  return (
    <Tarjeta titulo={<span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" aria-hidden />Embudo comercial</span>} accion={<Link href="/admin/oportunidades" className="text-xs font-medium text-primary hover:underline">Ver oportunidades</Link>}>
      <div className="flex flex-col gap-2">
        {ETAPAS.filter((e) => e.abierta).map((e) => {
          const n = abiertas.filter((o) => o.etapa === e.id).length
          return (
            <div key={e.id} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-muted-foreground">{e.nombre}</span>
              <span className="h-6 flex-1 overflow-hidden rounded-md bg-secondary">
                <span className="flex h-full items-center rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground" style={{ width: `${Math.max(10, (n / max) * 100)}%` }}>{n}</span>
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 border-t pt-3">
        <span className="etiqueta">Lo más reciente</span>
        {recientes.map((o) => (
          <Link key={o.id} href={`/admin/oportunidades/${o.id}`} className="flex items-center gap-3 hover:text-primary">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                {estado.clientes.find((c) => c.id === o.clienteId)?.nombre}
                {o.creadaPor === "ia" && <Bot className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Captada por la IA" />}
              </span>
              <span className="flex items-center gap-2"><Ramo ramo={o.ramo} /><span className="text-[11px] text-muted-foreground">{hace(o.creada, ahora)}</span></span>
            </span>
            <EtapaChip etapa={o.etapa} />
          </Link>
        ))}
      </div>
    </Tarjeta>
  )
}

function Renovaciones({ estado, ahora }: { estado: Estado; ahora: number }) {
  const por = estado.polizas.filter((p) => p.estado === "por_renovar")
  const ventanas = [15, 30, 60].map((d, i, l) => {
    const desde = i ? l[i - 1] : -999
    const lista = por.filter((p) => (p.vence - ahora) / DIA <= d && (p.vence - ahora) / DIA > desde)
    return { d, n: lista.length, prima: lista.reduce((t, p) => t + p.primaAnual, 0), confirmadas: lista.filter((p) => p.renovacion === "confirmada").length }
  })
  return (
    <Tarjeta titulo={<span className="flex items-center gap-2"><FileStack className="h-4 w-4 text-primary" aria-hidden />Renovaciones</span>} accion={<Link href="/admin/cartera" className="text-xs font-medium text-primary hover:underline">Ver cartera</Link>}>
      <div className="grid grid-cols-3 gap-2">
        {ventanas.map((v) => (
          <div key={v.d} className="rounded-lg bg-secondary p-3">
            <div className="text-[11px] text-muted-foreground">Vencen en {v.d} días</div>
            <div className="font-display text-2xl font-bold">{v.n}</div>
            <div className="text-[11px] text-muted-foreground">{rdCorto(v.prima)}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-success" style={{ width: `${v.n ? (v.confirmadas / v.n) * 100 : 0}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{v.confirmadas} confirmadas</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
        El aviso sale por WhatsApp con un clic y la IA registra la respuesta del asegurado.
      </p>
    </Tarjeta>
  )
}

function Siniestros({ estado, ahora }: { estado: Estado; ahora: number }) {
  const abiertos = estado.siniestros.filter((s) => !["resuelto", "cerrado"].includes(s.estado)).sort((a, b) => b.reportado - a.reportado)
  return (
    <Tarjeta titulo={<span className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-primary" aria-hidden />Siniestros abiertos ({abiertos.length})</span>} accion={<Link href="/admin/siniestros" className="text-xs font-medium text-primary hover:underline">Ver siniestros</Link>}>
      <ul className="flex flex-col divide-y">
        {abiertos.slice(0, 5).map((s) => {
          const rec = s.documentos.filter((d) => d.recibido).length
          return (
            <li key={s.id}>
              <Link href={`/admin/siniestros/${s.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {s.codigo}
                    {s.creadoPor === "ia" && <Bot className="h-3.5 w-3.5 text-primary" aria-label="Reportado a la IA" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{PROCEDIMIENTOS[s.tipo].nombre} · {estado.clientes.find((c) => c.id === s.clienteId)?.nombre}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <SiniestroChip estado={s.estado} />
                  <span className="text-[11px] text-muted-foreground">Documentos {rec}/{s.documentos.length} · {hace(s.reportado, ahora)}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}

function Equipo({ estado }: { estado: Estado }) {
  const filas = estado.equipo
    .filter((p) => p.area.startsWith("comercial"))
    .map((p) => {
      const l = estado.oportunidades.filter((o) => o.ejecutivoId === p.id && ABIERTAS.includes(o.etapa))
      return { p, n: l.length, espera: estado.conversaciones.filter((c) => c.asignadoA === p.id && c.estado === "esperando_equipo").length, prima: l.reduce((t, o) => t + (o.cotizaciones.find((c) => c.recomendada)?.prima ?? 0), 0) }
    })
    .sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...filas.map((f) => f.n))
  return (
    <Tarjeta titulo="Carga de los ejecutivos">
      <ul className="flex flex-col gap-3">
        {filas.map((f) => (
          <li key={f.p.id} className="flex items-center gap-3">
            <Persona id={f.p.id} className="w-40 shrink-0" />
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(f.n / max) * 100}%` }} />
            </span>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {f.n} abiertas{f.espera ? <span className="text-destructive"> · {f.espera} esperan</span> : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">La IA reparte cada solicitud por ramo, sucursal y carga; los asegurados vuelven con su ejecutivo de siempre.</p>
    </Tarjeta>
  )
}

function Actividad({ estado, ahora }: { estado: Estado; ahora: number }) {
  return (
    <Tarjeta titulo={<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" aria-hidden />Actividad</span>}>
      <ul className="flex max-h-80 flex-col gap-2.5 overflow-y-auto pr-1">
        {estado.eventos.slice(0, 14).map((e) => {
          const cuerpo = (
            <>
              <span className="text-sm">{e.texto}</span>
              <span className="text-[11px] text-muted-foreground">{hace(e.ts, ahora)}</span>
            </>
          )
          return (
            <li key={e.id}>
              {e.enlace ? <Link href={e.enlace} className="flex flex-col hover:text-primary">{cuerpo}</Link> : <div className="flex flex-col">{cuerpo}</div>}
            </li>
          )
        })}
        {!estado.eventos.length && <li className="text-sm text-muted-foreground">Sin actividad todavía.</li>}
      </ul>
    </Tarjeta>
  )
}

