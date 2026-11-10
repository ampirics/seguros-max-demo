"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Minus, Plus } from "lucide-react"
import { rd } from "@/lib/restaurante/carta"
import type { Plato } from "@/lib/restaurante/tipos"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { fotoDe, QUITAR } from "./util"

export interface LineaCarrito {
  clave: string
  platoId: string
  nombre: string
  cantidad: number
  mods: string[]
  notas?: string
  importe: number
}

export function Personalizar({
  plato,
  alergiasCliente = [],
  onCerrar,
  onAgregar,
}: {
  plato: Plato | null
  alergiasCliente?: string[]
  onCerrar: () => void
  onAgregar: (l: LineaCarrito) => void
}) {
  const [cantidad, setCantidad] = useState(1)
  const [opciones, setOpciones] = useState<Record<string, string>>({})
  const [quitar, setQuitar] = useState<string[]>([])
  const [nota, setNota] = useState("")

  useEffect(() => {
    if (!plato) return
    setCantidad(plato.porLibra ? 1.5 : 1)
    setOpciones(Object.fromEntries((plato.opciones ?? []).map((o) => [o.nombre, o.valores[0]])))
    setQuitar([])
    setNota("")
  }, [plato])

  if (!plato) return null
  const paso = plato.porLibra ? 0.5 : 1
  const minimo = plato.porLibra ? 1 : 1
  const choque = (plato.alergenos ?? []).filter((a) => alergiasCliente.some((c) => c.toLowerCase().includes(a) || a.includes(c.toLowerCase())))
  const foto = fotoDe(plato)

  return (
    <Dialog open={!!plato} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {foto && <img src={foto} alt="" className="h-40 w-full object-cover sm:rounded-t-lg" />}
        <div className="flex flex-col gap-5 p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl leading-tight">{plato.nombre}</DialogTitle>
            <DialogDescription>
              {rd(plato.precio)}{plato.porLibra ? " por libra" : ""} · {plato.minutos} min{plato.descripcion ? ` · ${plato.descripcion}` : ""}
            </DialogDescription>
          </DialogHeader>

          {!!plato.alergenos?.length && (
            <div className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-sm", choque.length ? "bg-destructive-soft text-destructive" : "bg-secondary text-muted-foreground")}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Contiene {plato.alergenos.join(", ")}.
                {choque.length ? <strong> El cliente tiene alergia registrada: {choque.join(", ")}.</strong> : null}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{plato.porLibra ? "Libras" : "Cantidad"}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setCantidad((c) => Math.max(minimo, +(c - paso).toFixed(1)))} aria-label="Menos">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-14 text-center text-xl font-semibold tabular-nums">{cantidad}</span>
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setCantidad((c) => +(c + paso).toFixed(1))} aria-label="Más">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {(plato.opciones ?? []).map((o) => (
            <fieldset key={o.nombre} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{o.nombre}</legend>
              <div className="flex flex-wrap gap-2">
                {o.valores.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOpciones((x) => ({ ...x, [o.nombre]: v }))}
                    aria-pressed={opciones[o.nombre] === v}
                    className={cn(
                      "min-h-10 rounded-full border px-3.5 text-sm transition-colors",
                      opciones[o.nombre] === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Cambios</legend>
            <div className="flex flex-wrap gap-2">
              {QUITAR.map((v) => {
                const on = quitar.includes(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setQuitar((x) => (on ? x.filter((y) => y !== v) : [...x, v]))}
                    aria-pressed={on}
                    className={cn("min-h-10 rounded-full border px-3.5 text-sm transition-colors", on ? "border-acento bg-acento/15 text-foreground" : "bg-card hover:border-acento/50")}
                  >
                    {v}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota para cocina (opcional)" rows={2} aria-label="Nota para cocina" />

          <Button
            size="lg"
            className="h-12 w-full text-base"
            onClick={() => {
              const mods = [...Object.entries(opciones).map(([k, v]) => `${k}: ${v}`), ...quitar]
              onAgregar({
                clave: `${plato.id}-${Date.now()}`,
                platoId: plato.id,
                nombre: plato.nombre,
                cantidad,
                mods,
                notas: nota.trim() || undefined,
                importe: Math.round(plato.precio * cantidad),
              })
            }}
          >
            Agregar a la ronda · {rd(plato.precio * cantidad)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
