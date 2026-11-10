"use client"

import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { NIVELES, type SeguridadCliente as Seguridad } from "@/lib/api/seguridad"
import { cn } from "@/lib/utils"
import { fecha } from "./perfil-secciones"

export function SeguridadCliente({ seguridad, listaBlanca, noMolestar, editable, ocupado, onListaBlanca, onNoMolestar }: {
  seguridad?: Seguridad
  listaBlanca: boolean
  noMolestar: boolean
  editable: boolean
  ocupado: boolean
  onListaBlanca: (v: boolean) => void
  onNoMolestar: (v: boolean) => void
}) {
  const nivel = NIVELES[seguridad?.nivel ?? "normal"]
  const puntaje = seguridad?.puntaje ?? 0
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="titulo-seguridad">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-seguridad" className="flex items-center gap-2 font-display text-base font-semibold">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden /> Seguridad de precios
        </h2>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", nivel.clase)}>{nivel.texto}</span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Puntaje</span>
          <span className="font-semibold tabular-nums">{puntaje} / 100</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={puntaje} aria-label="Puntaje de riesgo">
          <div className={cn("h-full rounded-full", puntaje >= 60 ? "bg-destructive" : puntaje >= 30 ? "bg-warning" : "bg-primary")} style={{ width: `${puntaje}%` }} />
        </div>
      </div>

      {seguridad?.senales.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {seguridad.senales.map((s) => <li key={s} className="flex gap-2"><span aria-hidden className="text-muted-foreground">·</span>{s}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Sin señales de que esté sacando precios.</p>
      )}
      {seguridad?.nivel === "sospechoso" && <p className="mt-2 text-xs text-warning">El bot no le da precios y le ofrece que lo llame un vendedor.</p>}
      {seguridad?.bloqueo_vence && <p className="mt-2 text-xs text-muted-foreground">El bloqueo vence el {fecha(seguridad.bloqueo_vence)}.</p>}

      <div className="mt-3 divide-y border-t">
        <div className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <Label htmlFor="lista-blanca" className="text-sm font-medium">Lista blanca</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {seguridad?.lista_blanca && seguridad.lista_blanca_motivo !== "marcado a mano"
                ? `Entra sola: ${seguridad.lista_blanca_motivo}.`
                : "Nunca se bloquea ni pierde precios por las señales."}
            </p>
          </div>
          <Switch id="lista-blanca" checked={listaBlanca} disabled={!editable || ocupado} onCheckedChange={onListaBlanca} />
        </div>
        <div className="flex items-start justify-between gap-3 pt-3">
          <div className="min-w-0">
            <Label htmlFor="no-molestar" className="text-sm font-medium">No molestar</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">No recibe seguimientos ni mensajes automáticos.</p>
          </div>
          <Switch id="no-molestar" checked={noMolestar} disabled={!editable || ocupado} onCheckedChange={onNoMolestar} />
        </div>
      </div>
      <Link href="/admin/seguridad" className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground">Ver todos en Seguridad</Link>
    </section>
  )
}
