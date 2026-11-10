"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "react-hot-toast"
import { AlarmClock, AlertTriangle, Building2, CalendarClock, Check, Loader2, MessageCircle, Send, User } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/contexts/admin-context"
import { ASEGURADORA, CAMPO, dentroDe, duracion, EQUIPO, ESTADO_POLIZA, fechaCorta, fechaLarga, hace, NOMBRE_ORIGEN, NOMBRE_SUCURSAL, PERSONA, RAMO, rd } from "@/lib/seguros/catalogo"
import { segurosApi, useFicha, useSeguros } from "@/lib/seguros/cliente"
import type { Etapa, Oportunidad } from "@/lib/seguros/tipos"
import { Aseguradora, Chip, EtapaChip, Historial, PrioridadPunto, Ramo, Tarjeta } from "@/components/seguros/comun"
import { Comparativo } from "@/components/seguros/oportunidades/comparativo"
import { MarcaIA } from "@/components/seguros/oportunidades/tablero"
import { abierta, ETAPAS_ABIERTAS, vencida } from "@/components/seguros/oportunidades/util"
import { cn } from "@/lib/utils"

const EJECUTIVOS = EQUIPO.filter((p) => p.area === "comercial_personas" || p.area === "comercial_empresas")

function valorDe(v: string | number | boolean | null | undefined, k: string) {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "boolean") return v ? "Sí" : "No"
  if (typeof v === "number" && /valor|monto|facturacion|suma/.test(k)) return rd(v)
  return String(v)
}

function Pasos({ o, mover, ocupado }: { o: Oportunidad; mover: (e: Etapa) => void; ocupado: boolean }) {
  const idx = ETAPAS_ABIERTAS.findIndex((e) => e.id === o.etapa)
  const ganada = o.etapa === "ganada"
  const pasos = [...ETAPAS_ABIERTAS, { id: "ganada" as Etapa, nombre: "Póliza emitida", abierta: false }]
  const actual = ganada ? pasos.length - 1 : idx
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="Etapas">
      {pasos.map((p, i) => {
        const hecho = o.etapa !== "perdida" && i < actual
        const ahora = o.etapa !== "perdida" && i === actual
        const puede = abierta(o.etapa) && p.abierta && p.id !== o.etapa
        return (
          <li key={p.id} className="flex min-w-0 flex-col gap-1.5">
            <button
              type="button"
              disabled={!puede || ocupado}
              onClick={() => mover(p.id)}
              title={puede ? `Mover a ${p.nombre.toLowerCase()}` : p.nombre}
              className={cn("h-1.5 rounded-full transition-colors", hecho ? "bg-primary" : ahora ? (ganada ? "bg-success" : "bg-primary") : "bg-secondary", puede && "hover:bg-primary/50")}
            />
            <span className={cn("hidden truncate text-[11px] sm:block", ahora ? "font-semibold text-foreground" : "text-muted-foreground")}>{p.nombre}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function OportunidadPage() {
  const id = useParams<{ id: string }>()?.id ?? ""
  const { ahora } = useSeguros()
  const { user } = useAdmin()
  const quien = (user as { name?: string } | null)?.name
  const { datos, error } = useFicha(() => segurosApi.oportunidad(id), [id])
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState("")

  async function accion(fn: () => Promise<unknown>, exito: string) {
    setOcupado(true)
    try {
      await fn()
      toast.success(exito)
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    } finally {
      setOcupado(false)
    }
  }

  if (error && !datos)
    return (
      <AdminLayout title="Oportunidad">
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-warning" aria-hidden />
          <p className="font-semibold">{error}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/oportunidades">Volver a oportunidades</Link>
          </Button>
        </div>
      </AdminLayout>
    )

  if (!datos)
    return (
      <AdminLayout title="Oportunidad">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-xl lg:col-span-2" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </AdminLayout>
    )

  const { oportunidad: o, cliente: c, polizas, conversacion } = datos
  const info = RAMO[o.ramo]
  const claves = Array.from(new Set([...info.requeridos, ...info.opcionales, ...Object.keys(o.ficha)]))
  const campos = claves.map((k) => ({ k, v: valorDe(o.ficha[k], k), falta: o.faltantes.includes(k), requerido: info.requeridos.includes(k) })).filter((x) => x.v !== null || x.falta || x.requerido)
  const otrasFaltas = o.faltantes.filter((k) => !claves.includes(k))
  const convId = conversacion?.id ?? o.conversacionId
  const tarde = vencida(o, ahora)

  const mover = (e: Etapa) => accion(() => segurosApi.accion({ tipo: "etapa", oportunidadId: o.id, etapa: e, quien }), `Movida a ${ETAPAS_ABIERTAS.find((x) => x.id === e)?.nombre.toLowerCase()}`)
  const reasignar = (ej: string) => accion(() => segurosApi.accion({ tipo: "asignar", oportunidadId: o.id, ejecutivoId: ej, quien }), `Asignada a ${PERSONA[ej]?.nombre}`)
  async function guardarNota() {
    if (!nota.trim()) return
    if (await accion(() => segurosApi.accion({ tipo: "nota", oportunidadId: o.id, texto: nota.trim(), quien }), "Nota guardada")) setNota("")
  }

  return (
    <AdminLayout title={o.codigo}>
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-4">
          <Link href="/admin/oportunidades" className="text-xs font-medium text-muted-foreground hover:text-primary">
            ← Oportunidades
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-muted-foreground">{o.codigo}</span>
                <EtapaChip etapa={o.etapa} />
                {o.creadaPor === "ia" && <MarcaIA />}
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PrioridadPunto prioridad={o.prioridad} />
                  Prioridad {o.prioridad}
                </span>
              </div>
              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                <Link href={`/admin/asegurados/${c.id}`} className="hover:text-primary">
                  {c.nombre}
                </Link>
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <Ramo ramo={o.ramo} className="text-sm" />
                <span className="inline-flex items-center gap-1.5">
                  {o.segmento === "empresa" ? <Building2 className="h-3.5 w-3.5" aria-hidden /> : <User className="h-3.5 w-3.5" aria-hidden />}
                  {o.segmento === "empresa" ? "Empresa" : "Persona"}
                </span>
                <span>Llegó por {NOMBRE_ORIGEN[o.origen]}</span>
                <span>{NOMBRE_SUCURSAL[o.sucursal]}</span>
                <span>Creada {hace(o.creada, ahora)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">
              <Select value={o.ejecutivoId ?? ""} onValueChange={reasignar} disabled={ocupado}>
                <SelectTrigger className="h-10 w-full sm:w-60" aria-label="Ejecutivo">
                  <SelectValue placeholder="Asignar ejecutivo" />
                </SelectTrigger>
                <SelectContent>
                  {EJECUTIVOS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{p.iniciales}</span>
                        {p.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {convId && (
                <Button asChild variant="outline">
                  <Link href={`/admin/chat?conversacion=${convId}`}>
                    <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                    Abrir conversación
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <Pasos o={o} mover={mover} ocupado={ocupado} />
        </header>

        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <Comparativo key={o.id} o={o} quien={quien} />

            <Tarjeta
              titulo="Ficha del prospecto"
              accion={
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Puntuación</span>
                  <span className={cn("font-display text-2xl font-bold tabular-nums", o.puntuacion >= 75 ? "text-success" : o.puntuacion >= 55 ? "text-primary" : "text-warning")}>{o.puntuacion}</span>
                </span>
              }
            >
              <p className="text-sm text-muted-foreground">{o.resumen}</p>
              {(o.faltantes.length > 0 || otrasFaltas.length > 0) && (
                <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Falta para cotizar: {o.faltantes.map((k) => (CAMPO[k] ?? k).toLowerCase()).join(", ")}.
                  </span>
                </p>
              )}
              <dl className="grid gap-2 sm:grid-cols-2">
                {campos.map(({ k, v, falta }) => (
                  <div key={k} className={cn("flex flex-col gap-0.5 rounded-lg border px-3 py-2", falta ? "border-warning/50 bg-warning-soft/50" : "bg-background")}>
                    <dt className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      {CAMPO[k] ?? k}
                      {falta ? <Chip tono="ambar">Falta</Chip> : <Check className="h-3.5 w-3.5 text-success" aria-hidden />}
                    </dt>
                    <dd className={cn("text-sm font-medium", falta && "text-muted-foreground")}>{v ?? "Sin dato"}</dd>
                  </div>
                ))}
                {otrasFaltas.map((k) => (
                  <div key={k} className="flex flex-col gap-0.5 rounded-lg border border-warning/50 bg-warning-soft/50 px-3 py-2">
                    <dt className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      {CAMPO[k] ?? k}
                      <Chip tono="ambar">Falta</Chip>
                    </dt>
                    <dd className="text-sm font-medium text-muted-foreground">Pendiente</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                Contacto: {c.telefono}
                {c.correo ? ` · ${c.correo}` : ""}
                {c.consentimiento ? ` · Autorizó sus datos el ${fechaCorta(c.consentimiento.ts)}` : ""}
              </p>
            </Tarjeta>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Tarjeta titulo="Siguiente acción">
              {o.siguiente ? (
                <div className={cn("flex items-start gap-3 rounded-lg p-3", tarde ? "bg-destructive-soft" : "bg-accent/60")}>
                  {tarde ? <AlarmClock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden /> : <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />}
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">{o.siguiente.texto}</p>
                    <p className={cn("text-xs", tarde ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {dentroDe(o.siguiente.vence, ahora).replace(/^./, (x) => x.toUpperCase())} · {fechaLarga(o.siguiente.vence)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{abierta(o.etapa) ? "Sin acción pendiente." : "La oportunidad está cerrada."}</p>
              )}
              <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                <span>Primera respuesta</span>
                <span className="font-medium text-foreground">{o.primerContacto ? duracion(Math.max(1, (o.primerContacto - o.creada) / 1000)) : "Pendiente"}</span>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Pólizas del cliente" accion={<span className="text-xs text-muted-foreground">{polizas.length}</span>}>
              {polizas.length ? (
                <ul className="flex flex-col divide-y">
                  {polizas.map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/cartera/${p.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                        <Aseguradora id={p.aseguradoraId} tamano="sm" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{RAMO[p.ramo].nombre}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {p.numero} · {ASEGURADORA[p.aseguradoraId]?.corto}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className="text-xs font-semibold tabular-nums">{rd(p.primaAnual)}</span>
                          <span className={cn("text-[11px]", p.estado === "vigente" ? "text-success" : p.estado === "por_renovar" ? "text-warning" : "text-muted-foreground")}>{ESTADO_POLIZA[p.estado]}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Prospecto nuevo, todavía sin pólizas con MAX.</p>
              )}
            </Tarjeta>

            <Tarjeta titulo="Historial">
              <div className="flex flex-col gap-2">
                <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Agregar una nota" rows={2} className="text-sm" />
                <Button size="sm" variant="secondary" className="self-end" onClick={guardarNota} disabled={ocupado || !nota.trim()}>
                  {ocupado ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                  Guardar nota
                </Button>
              </div>
              <Historial items={o.historial} />
            </Tarjeta>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
