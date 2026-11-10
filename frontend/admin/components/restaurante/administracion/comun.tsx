"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { hora12, horaLocal, ZONA_HORARIA } from "@/lib/restaurante/local"
import type { Caja, Gasto, Insumo, MetodoPago, MovimientoCaja } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

export const cant = (n: number) => n.toLocaleString("es-DO", { maximumFractionDigits: 2 })
export const UNIDAD: Record<Insumo["unidad"], [string, string]> = { kg: ["kg", "kg"], l: ["l", "l"], unidad: ["unidad", "unidades"], botella: ["botella", "botellas"] }
export const conUnidad = (n: number, u: Insumo["unidad"]) => `${cant(n)} ${UNIDAD[u][Math.abs(n) === 1 ? 0 : 1]}`

export const NOMBRE_METODO: Record<MetodoPago | "credito", string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", credito: "Crédito (por pagar)" }
export const NOMBRE_CATEGORIA_GASTO: Record<Gasto["categoria"], string> = { insumos: "Insumos", nomina: "Nómina", servicios: "Servicios", mantenimiento: "Mantenimiento", otros: "Otros" }

const fmtDia = new Intl.DateTimeFormat("es-DO", { timeZone: ZONA_HORARIA, weekday: "short", day: "numeric", month: "short" })
export const hora = (ts: number) => hora12(horaLocal(ts))
export const fecha = (ts: number) => fmtDia.format(new Date(ts))
export const fechaHora = (ts: number) => `${fecha(ts)}, ${hora(ts)}`

export function resumenCaja(c: Caja) {
  const suma = (f: (m: MovimientoCaja) => boolean) => c.movimientos.filter(f).reduce((s, m) => s + m.monto, 0)
  const venta = (metodo: MetodoPago) => suma((m) => m.tipo === "venta" && m.metodo === metodo)
  const ventas = { efectivo: venta("efectivo"), tarjeta: venta("tarjeta"), transferencia: venta("transferencia") }
  const ingresos = suma((m) => m.tipo === "ingreso")
  const retiros = suma((m) => m.tipo === "retiro")
  const salidas = suma((m) => (m.tipo === "retiro" || m.tipo === "gasto") && m.metodo === "efectivo")
  return { ventas, ingresos, retiros, gastos: salidas - retiros, salidas, esperado: c.fondo + ventas.efectivo + ingresos - salidas }
}

export function useDatos<T>(ruta: string | null, clave = 0) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!ruta) return
    let vivo = true
    fetch(`/srv/restaurante${ruta}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j?.ok === false) throw new Error(j?.error ?? "No se pudo cargar")
        return j as T
      })
      .then((j) => vivo && (setDatos(j), setError("")))
      .catch((e) => vivo && setError((e as Error).message))
    return () => {
      vivo = false
    }
  }, [ruta, clave])
  return { datos, error }
}

export function Titulo({ etiqueta, titulo, sub, extra }: { etiqueta: string; titulo: React.ReactNode; sub?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="etiqueta">{etiqueta}</p>
        <h2 className="break-words font-display text-2xl font-semibold leading-tight sm:text-3xl">{titulo}</h2>
        {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
      </div>
      {extra && <div className="shrink-0">{extra}</div>}
    </div>
  )
}

export function Bloque({ titulo, accion, children, className }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  )
}

export function Dato({ titulo, valor, className }: { titulo: string; valor: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-card px-3 py-2", className)}>
      <div className="text-[11px] text-muted-foreground">{titulo}</div>
      <div className="break-words font-semibold tabular-nums">{valor}</div>
    </div>
  )
}

export function FilaBoton({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("group flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60", className)}>
      <span className="flex min-w-0 flex-1 items-center gap-3">{children}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  )
}

export function Lista({ children }: { children: React.ReactNode }) {
  return <div className="divide-y overflow-hidden rounded-xl border bg-card">{children}</div>
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{texto}</p>
}

export function Cargando({ error }: { error?: string }) {
  if (error) return <p className="rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-4 text-sm text-destructive">{error}</p>
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

export function ChipMetodo({ metodo, deCaja }: { metodo: MetodoPago | "credito"; deCaja?: boolean }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", metodo === "credito" ? "bg-warning-soft text-warning" : "bg-secondary text-foreground")}>
      {NOMBRE_METODO[metodo]}
      {deCaja ? " · de caja" : ""}
    </span>
  )
}
