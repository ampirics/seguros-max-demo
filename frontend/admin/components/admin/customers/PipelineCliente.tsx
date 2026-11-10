"use client"

import { useEffect, useState } from "react"
import { Bell, CalendarDays, Check, Mail, MessageCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { perfilApi, type NotificacionCliente, type PipelineCliente as Pipeline } from "@/lib/api/perfil"
import { cn } from "@/lib/utils"

const corto = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-DO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null

const CANAL = { whatsapp: MessageCircle, correo: Mail, panel: Bell } as const
const ESTADO_AVISO: Record<NotificacionCliente["estado"], string> = {
  enviada: "text-success",
  simulada: "text-muted-foreground",
  fallida: "text-destructive",
}

export function usePipeline(clienteId?: string | null, conversationId?: string | null, refrescar: unknown = 0) {
  const [datos, setDatos] = useState<Pipeline | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!clienteId && !conversationId) return
    let vigente = true
    setError(false)
    const pedir = clienteId ? perfilApi.pipeline(clienteId, conversationId) : perfilApi.pipelineDeConversacion(conversationId!)
    pedir.then((d) => { if (vigente) setDatos(d) }).catch(() => { if (vigente) setError(true) })
    return () => { vigente = false }
  }, [clienteId, conversationId, refrescar])
  return { datos, error }
}

function Avisos({ avisos, max }: { avisos: NotificacionCliente[]; max: number }) {
  if (!avisos.length) return <p className="text-xs text-muted-foreground">Todavía no se le ha enviado ningún aviso.</p>
  return (
    <ul className="space-y-1.5">
      {avisos.slice(0, max).map((a, i) => {
        const Icono = CANAL[a.canal] ?? Bell
        return (
          <li key={`${a.fecha}-${i}`} className="flex items-start gap-2 text-xs">
            <Icono className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ESTADO_AVISO[a.estado])} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{a.titulo}</span>
              <span className="text-muted-foreground"> · {corto(a.fecha)}{a.estado !== "enviada" ? ` · ${a.estado}` : ""}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function PipelineCliente({ datos, error, compacto = false }: { datos: Pipeline | null; error?: boolean; compacto?: boolean }) {
  if (error) return <p className="text-sm text-muted-foreground">No se pudo cargar el recorrido del cliente.</p>
  if (!datos) return <Skeleton className={compacto ? "h-40 w-full" : "h-20 w-full"} />

  if (compacto) {
    return (
      <div className="space-y-3">
        <ol className="space-y-0">
          {datos.etapas.map((e, i) => (
            <li key={e.clave} className="relative flex gap-2.5 pb-2.5 last:pb-0">
              {i < datos.etapas.length - 1 && (
                <span className={cn("absolute left-[9px] top-5 h-[calc(100%-12px)] w-0.5", e.estado === "hecho" ? "bg-primary" : "bg-border")} aria-hidden />
              )}
              <Punto estado={e.estado} />
              <span className="min-w-0 flex-1 text-xs">
                <span className={cn("font-medium", e.estado === "pendiente" && "text-muted-foreground")}>{e.titulo}</span>
                {e.fecha && <span className="text-muted-foreground"> · {corto(e.fecha)}</span>}
                {e.detalle && <span className="block text-muted-foreground">{e.detalle}</span>}
              </span>
            </li>
          ))}
        </ol>
        {datos.proxima_cita && <Cita cita={datos.proxima_cita} />}
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Avisos enviados</p>
          <Avisos avisos={datos.notificaciones} max={4} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-7" aria-label="Recorrido del cliente">
        {datos.etapas.map((e, i) => (
          <li key={e.clave} className="relative flex min-w-0 flex-col gap-1.5 pr-2">
            <div className="flex items-center">
              <Punto estado={e.estado} />
              {i < datos.etapas.length - 1 && (
                <span className={cn("ml-1.5 hidden h-0.5 flex-1 lg:block", e.estado === "hecho" ? "bg-primary" : "bg-border")} aria-hidden />
              )}
            </div>
            <span className={cn("text-sm font-medium", e.estado === "pendiente" && "text-muted-foreground")}>{e.titulo}</span>
            <span className="text-xs text-muted-foreground">{[corto(e.fecha), e.detalle].filter(Boolean).join(" · ") || (e.estado === "actual" ? "Siguiente paso" : "—")}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {datos.proxima_cita ? <Cita cita={datos.proxima_cita} /> : <p className="text-xs text-muted-foreground">Sin cita agendada.</p>}
        <Avisos avisos={datos.notificaciones} max={3} />
      </div>
    </div>
  )
}

function Punto({ estado }: { estado: "hecho" | "actual" | "pendiente" }) {
  return (
    <span className={cn("relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
      estado === "hecho" && "bg-primary text-primary-foreground",
      estado === "actual" && "border-2 border-primary bg-background",
      estado === "pendiente" && "border-2 border-border bg-background")}>
      {estado === "hecho" && <Check className="h-3 w-3" aria-hidden />}
      {estado === "actual" && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />}
      <span className="sr-only">{estado === "hecho" ? "hecho" : estado === "actual" ? "siguiente" : "pendiente"}</span>
    </span>
  )
}

function Cita({ cita }: { cita: NonNullable<Pipeline["proxima_cita"]> }) {
  return (
    <p className="flex items-start gap-2 rounded-control bg-accent/60 px-3 py-2 text-xs">
      <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span><span className="font-medium">Cita: {corto(cita.inicio)}</span>{cita.sucursal ? ` · ${cita.sucursal}` : ""} · {cita.estado}</span>
    </p>
  )
}
