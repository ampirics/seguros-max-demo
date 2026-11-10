"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Briefcase, Building2, Car, Flame, HeartPulse, Home, Plane, Scale, ShieldCheck, Truck, Umbrella, Users, Wrench, FileSignature } from "lucide-react"
import { ASEGURADORA, ESTADO_RENOVACION, ESTADO_SINIESTRO, NOMBRE_ETAPA, PERSONA, RAMO_CORTO } from "@/lib/seguros/catalogo"
import type { Etapa, EstadoRenovacion, EstadoSiniestro, Prioridad, Ramo } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"

export const ICONO_RAMO: Record<Ramo, typeof Car> = {
  vehiculo: Car,
  salud: HeartPulse,
  vida: Umbrella,
  hogar: Home,
  viaje: Plane,
  accidentes: ShieldCheck,
  incendio: Flame,
  responsabilidad_civil: Scale,
  transporte: Truck,
  fianzas: FileSignature,
  colectivo: Users,
  maquinaria: Wrench,
}

export function Ramo({ ramo, className }: { ramo: Ramo; className?: string }) {
  const I = ICONO_RAMO[ramo] ?? Briefcase
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <I className="h-3.5 w-3.5 text-primary" aria-hidden />
      {RAMO_CORTO[ramo]}
    </span>
  )
}

const TONO = {
  azul: "bg-accent text-accent-foreground",
  verde: "bg-success-soft text-success",
  ambar: "bg-warning-soft text-warning",
  rojo: "bg-destructive-soft text-destructive",
  gris: "bg-secondary text-muted-foreground",
  info: "bg-info-soft text-info",
} as const
export type Tono = keyof typeof TONO

export function Chip({ tono = "gris", children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", TONO[tono], className)}>{children}</span>
}

export const TONO_ETAPA: Record<Etapa, Tono> = { nueva: "ambar", calificada: "azul", en_cotizacion: "info", propuesta_enviada: "info", en_decision: "azul", ganada: "verde", perdida: "gris" }
export const EtapaChip = ({ etapa }: { etapa: Etapa }) => <Chip tono={TONO_ETAPA[etapa]}>{NOMBRE_ETAPA[etapa]}</Chip>

export const TONO_SINIESTRO: Record<EstadoSiniestro, Tono> = { reportado: "ambar", documentos: "ambar", inspeccion: "info", en_aseguradora: "azul", resuelto: "verde", cerrado: "gris" }
export const SiniestroChip = ({ estado }: { estado: EstadoSiniestro }) => <Chip tono={TONO_SINIESTRO[estado]}>{ESTADO_SINIESTRO[estado]}</Chip>

export const TONO_RENOVACION: Record<EstadoRenovacion, Tono> = { sin_iniciar: "rojo", aviso_enviado: "ambar", quiere_renovar: "info", cotizando: "azul", confirmada: "verde", no_renueva: "gris" }
export const RenovacionChip = ({ estado }: { estado: EstadoRenovacion }) => <Chip tono={TONO_RENOVACION[estado]}>{ESTADO_RENOVACION[estado]}</Chip>

export const PrioridadPunto = ({ prioridad }: { prioridad: Prioridad }) => (
  <span className={cn("inline-block h-2 w-2 rounded-full", prioridad === "alta" ? "bg-destructive" : prioridad === "media" ? "bg-warning" : "bg-muted-foreground/40")} title={`Prioridad ${prioridad}`} />
)

export function Aseguradora({ id, tamano = "md", conNombre = false }: { id: string; tamano?: "sm" | "md" | "lg"; conNombre?: boolean }) {
  const a = ASEGURADORA[id]
  if (!a) return null
  const h = tamano === "sm" ? "h-6 w-10" : tamano === "lg" ? "h-12 w-20" : "h-8 w-14"
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white", h)}>
        {a.logo ? <img src={a.logo} alt={a.nombre} className="h-full w-full object-contain" /> : <span className="text-[10px] font-bold text-slate-700">{a.corto}</span>}
      </span>
      {conNombre && <span className="text-sm font-medium">{a.nombre}</span>}
    </span>
  )
}

export function Persona({ id, conNombre = true, className }: { id?: string; conNombre?: boolean; className?: string }) {
  const p = id ? PERSONA[id] : undefined
  if (!p) return <span className={cn("text-xs text-muted-foreground", className)}>Sin asignar</span>
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)} title={`${p.nombre}, ${p.cargo}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{p.iniciales}</span>
      {conNombre && <span className="truncate text-sm">{p.nombre}</span>}
    </span>
  )
}

export function Encabezado({ titulo, detalle, acciones, volver }: { titulo: string; detalle?: ReactNode; acciones?: ReactNode; volver?: { href: string; texto: string } }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {volver && (
          <Link href={volver.href} className="text-xs font-medium text-muted-foreground hover:text-primary">
            ← {volver.texto}
          </Link>
        )}
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{titulo}</h1>
        {detalle && <div className="max-w-3xl text-sm text-muted-foreground">{detalle}</div>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  )
}

export function Indicador({ etiqueta, valor, detalle, tono, href }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "alerta" | "bien"; href?: string }) {
  const cuerpo = (
    <div className={cn("flex h-full flex-col gap-1 rounded-xl border bg-card p-4 transition-colors", href && "hover:border-primary/40")}>
      <span className="text-xs font-medium text-muted-foreground">{etiqueta}</span>
      <span className={cn("font-display text-3xl font-bold tabular-nums leading-none", tono === "alerta" && "text-destructive", tono === "bien" && "text-success")}>{valor}</span>
      {detalle && <span className="text-xs text-muted-foreground">{detalle}</span>}
    </div>
  )
  return href ? <Link href={href}>{cuerpo}</Link> : cuerpo
}

export function Tarjeta({ titulo, accion, children, className }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5", className)}>
      {(titulo || accion) && (
        <div className="flex items-center justify-between gap-3">
          {titulo && <h2 className="font-display text-lg font-semibold">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  )
}

export function Filtro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", activo ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}
    >
      {children}
    </button>
  )
}

export function Historial({ items }: { items: { ts: number; texto: string; quien?: string }[] }) {
  const fmt = new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
  return (
    <ol className="relative flex flex-col gap-3 border-l pl-4">
      {[...items].reverse().map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
          <p className="text-sm">{h.texto}</p>
          <p className="text-xs text-muted-foreground">
            {fmt.format(new Date(h.ts))}
            {h.quien ? ` · ${h.quien}` : ""}
          </p>
        </li>
      ))}
    </ol>
  )
}

export const EsEmpresa = ({ si }: { si: boolean }) => (si ? <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-label="Empresa" /> : null)

export const NotaEjemplo = () => <p className="text-xs text-muted-foreground">Primas, sumas y montos de ejemplo para la demostración; no salen de ninguna aseguradora.</p>
