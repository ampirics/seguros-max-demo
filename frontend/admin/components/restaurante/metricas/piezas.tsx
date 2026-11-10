"use client"

import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

export const COLORES = {
  mar: "#7FCFCB",
  coral: "#E8866A",
  oro: "#F2C14E",
  lila: "#9B8CE8",
  verde: "#6BBF8A",
  rosa: "#E86A9B",
  gris: "#AEB5AA",
}

export const ZONA_COLOR: Record<string, string> = { terraza: COLORES.mar, muelle: COLORES.coral, gazebo: COLORES.lila, salon: COLORES.oro }

export const EJE = { fill: "var(--muted-foreground)", fontSize: 11 }

export function minutos(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "-"
  const total = Math.round(n)
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function rdCorto(n: number) {
  if (n >= 1_000_000) return `RD$ ${(n / 1_000_000).toFixed(1)} M`
  if (n >= 100_000) return `RD$ ${Math.round(n / 1000)} mil`
  return `RD$ ${Math.round(n).toLocaleString("es-DO")}`
}

export function pct(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} %`
}

export function Seccion({ id, titulo, descripcion, children, className }: { id?: string; titulo: string; descripcion?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-24 space-y-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{titulo}</h2>
        {descripcion && <p className="max-w-2xl text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </section>
  )
}

export function Tarjeta({ titulo, children, className, accion }: { titulo?: string; children: ReactNode; className?: string; accion?: ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-xl border bg-card p-4 sm:p-5", className)}>
      {(titulo || accion) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {titulo && <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>}
          {accion}
        </div>
      )}
      {children}
    </div>
  )
}

export function Kpi({ titulo, valor, detalle, variacion, invertir }: { titulo: string; valor: string; detalle?: string; variacion?: number | null; invertir?: boolean }) {
  const buena = variacion == null ? null : invertir ? variacion < 0 : variacion >= 0
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3.5">
      <p className="truncate text-xs font-medium text-muted-foreground">{titulo}</p>
      <p className="mt-1 truncate font-display text-[1.9rem] font-semibold leading-none tabular-nums">{valor}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {variacion != null && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", buena ? "text-success" : "text-destructive")}>
            {variacion >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
            {pct(Math.abs(variacion))}
          </span>
        )}
        {detalle && <span className="truncate">{detalle}</span>}
      </div>
    </div>
  )
}

export function Lectura({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-foreground">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-acento" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Lista de barras horizontales: etiqueta, barra proporcional y valor a la derecha. */
export function Barras({
  filas,
  formato,
  color = "var(--primary)",
  max,
}: {
  filas: { etiqueta: ReactNode; valor: number; detalle?: ReactNode; color?: string; marca?: number }[]
  formato: (n: number) => string
  color?: string
  max?: number
}) {
  const tope = max ?? Math.max(1, ...filas.map((f) => Math.max(f.valor, f.marca ?? 0)))
  return (
    <ul className="space-y-2.5">
      {filas.map((f, i) => (
        <li key={i} className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{f.etiqueta}</span>
            <span className="shrink-0 font-medium tabular-nums">{formato(f.valor)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (f.valor / tope) * 100)}%`, background: f.color ?? color }} />
            {f.marca != null && (
              <span className="absolute top-[-3px] h-3.5 w-0.5 rounded bg-foreground/70" style={{ left: `${Math.min(100, (f.marca / tope) * 100)}%` }} aria-hidden />
            )}
          </div>
          {f.detalle && <p className="mt-1 text-xs text-muted-foreground">{f.detalle}</p>}
        </li>
      ))}
    </ul>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{texto}</p>
}

export function CajaTooltip({ titulo, filas }: { titulo: string; filas: { nombre: string; valor: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{titulo}</p>
      {filas.map((f) => (
        <p key={f.nombre} className="flex items-center gap-2 text-muted-foreground">
          {f.color && <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />}
          {f.nombre}: <span className="font-medium tabular-nums text-foreground">{f.valor}</span>
        </p>
      ))}
    </div>
  )
}
