"use client"

import Link from "next/link"
import { AlarmClock, Clock, Sparkles } from "lucide-react"
import { hace, NOMBRE_ETAPA, rdCorto } from "@/lib/seguros/catalogo"
import type { Cliente, Oportunidad } from "@/lib/seguros/tipos"
import { Chip, EsEmpresa, Persona, PrioridadPunto, Ramo, TONO_ETAPA } from "@/components/seguros/comun"
import { cn } from "@/lib/utils"
import { ETAPAS_ABIERTAS, ordenTablero, primaPotencial, vencida } from "./util"

const BORDE_ETAPA: Record<string, string> = {
  nueva: "bg-warning",
  calificada: "bg-primary/60",
  en_cotizacion: "bg-info",
  propuesta_enviada: "bg-primary",
  en_decision: "bg-success",
}

export function Puntuacion({ valor, className }: { valor: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`Puntuación ${valor} de 100`}>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-secondary">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", valor >= 75 ? "bg-success" : valor >= 55 ? "bg-primary" : "bg-warning")} style={{ width: `${valor}%` }} />
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{valor}</span>
    </span>
  )
}

export const MarcaIA = () => (
  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary" title="La abrió el asistente">
    <Sparkles className="h-3 w-3" aria-hidden />
    IA
  </span>
)

export function TarjetaOportunidad({ o, cliente, ahora }: { o: Oportunidad; cliente?: Cliente; ahora: number }) {
  const prima = primaPotencial(o)
  const tarde = vencida(o, ahora)
  return (
    <Link
      href={`/admin/oportunidades/${o.id}`}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tarde && "border-destructive/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <PrioridadPunto prioridad={o.prioridad} />
          <span className="font-mono text-[11px] font-medium text-muted-foreground">{o.codigo}</span>
          {o.creadaPor === "ia" && <MarcaIA />}
        </span>
        <Puntuacion valor={o.puntuacion} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold leading-snug group-hover:text-primary">
          <span className="truncate">{cliente?.nombre ?? "Cliente"}</span>
          <EsEmpresa si={o.segmento === "empresa"} />
        </p>
        <Ramo ramo={o.ramo} />
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{o.resumen.split(": ").slice(1).join(": ") || o.resumen}</p>
      {prima > 0 && (
        <p className="text-xs">
          <span className="font-semibold tabular-nums">{rdCorto(prima)}</span> <span className="text-muted-foreground">al año</span>
        </p>
      )}
      {o.siguiente && (
        <p className={cn("flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-snug", tarde ? "bg-destructive-soft text-destructive" : "bg-secondary text-muted-foreground")}>
          {tarde ? <AlarmClock className="mt-px h-3 w-3 shrink-0" aria-hidden /> : <Clock className="mt-px h-3 w-3 shrink-0" aria-hidden />}
          <span>
            {o.siguiente.texto}
            {tarde && <span className="font-semibold"> · vencida</span>}
          </span>
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <Persona id={o.ejecutivoId} conNombre={false} />
        <span className="text-[11px] text-muted-foreground">{hace(o.actualizada, ahora)}</span>
      </div>
    </Link>
  )
}

export function Tablero({ lista, clientes, ahora }: { lista: Oportunidad[]; clientes: Map<string, Cliente>; ahora: number }) {
  const orden = ordenTablero(ahora)
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-max grid-flow-col auto-cols-[16.5rem] gap-3 xl:min-w-0 xl:auto-cols-fr">
        {ETAPAS_ABIERTAS.map((e) => {
          const items = lista.filter((o) => o.etapa === e.id).sort(orden)
          const suma = items.reduce((s, o) => s + primaPotencial(o), 0)
          return (
            <section key={e.id} className="flex min-w-0 flex-col rounded-xl border bg-secondary/40" aria-label={NOMBRE_ETAPA[e.id]}>
              <header className="flex flex-col gap-1 border-b px-3 pb-2.5 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", BORDE_ETAPA[e.id])} />
                    <h3 className="text-sm font-semibold">{e.nombre}</h3>
                  </span>
                  <Chip tono={TONO_ETAPA[e.id]}>{items.length}</Chip>
                </div>
                <span className="text-[11px] text-muted-foreground">{suma > 0 ? `${rdCorto(suma)} en primas` : "Sin primas cargadas"}</span>
              </header>
              <div className="flex max-h-[68vh] flex-col gap-2 overflow-y-auto p-2">
                {items.map((o) => (
                  <TarjetaOportunidad key={o.id} o={o} cliente={clientes.get(o.clienteId)} ahora={ahora} />
                ))}
                {!items.length && <p className="px-2 py-8 text-center text-xs text-muted-foreground">Nada en esta etapa</p>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
