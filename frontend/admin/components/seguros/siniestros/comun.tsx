"use client"

import { Car, CloudRain, FileQuestion, Flame, HeartPulse, ShieldAlert, Sparkles, Wrench } from "lucide-react"
import type { EstadoSiniestro, Siniestro, TipoSiniestro } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"

export const ICONO_TIPO: Record<TipoSiniestro, typeof Car> = {
  automovil: Car,
  incendio: Flame,
  inundacion: CloudRain,
  robo: ShieldAlert,
  averia: Wrench,
  salud: HeartPulse,
  otros: FileQuestion,
}

export const ABIERTOS: EstadoSiniestro[] = ["reportado", "documentos", "inspeccion", "en_aseguradora"]
export const abierto = (s: Siniestro) => ABIERTOS.includes(s.estado)
export const recibidos = (s: Siniestro) => s.documentos.filter((d) => d.recibido).length

export function MarcaIA({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground", className)} title="Lo reportó el cliente con la IA">
      <Sparkles className="h-3 w-3" aria-hidden />
      IA
    </span>
  )
}
