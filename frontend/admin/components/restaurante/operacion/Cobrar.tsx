"use client"

import { useState } from "react"
import { Banknote, CreditCard, Landmark } from "lucide-react"
import { rd, totales } from "@/lib/restaurante/carta"
import type { MetodoPago } from "@/lib/restaurante/tipos"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const METODOS: { id: MetodoPago; nombre: string; icono: typeof CreditCard }[] = [
  { id: "tarjeta", nombre: "Tarjeta", icono: CreditCard },
  { id: "efectivo", nombre: "Efectivo", icono: Banknote },
  { id: "transferencia", nombre: "Transferencia", icono: Landmark },
]

export function Cobrar({
  abierto,
  mesa,
  subtotal,
  ocupado,
  onCerrar,
  onCobrar,
}: {
  abierto: boolean
  mesa: string
  subtotal: number
  ocupado: boolean
  onCerrar: () => void
  onCobrar: (metodo: MetodoPago, propinaPct: number) => void
}) {
  const [metodo, setMetodo] = useState<MetodoPago>("tarjeta")
  const [propina, setPropina] = useState(10)
  const t = totales(subtotal, Math.round((subtotal * propina) / 100))
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl">Cobrar mesa {mesa}</DialogTitle>
          <DialogDescription>Elige el método y la propina. El ITBIS y el servicio de ley se suman solos.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map(({ id, nombre, icono: Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMetodo(id)}
              aria-pressed={metodo === id}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors",
                metodo === id ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:border-primary/40",
              )}
            >
              <Icono className="h-5 w-5" aria-hidden />
              {nombre}
            </button>
          ))}
        </div>
        <div>
          <p className="etiqueta mb-2">Propina</p>
          <div className="grid grid-cols-4 gap-2">
            {[0, 5, 10, 15].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPropina(p)}
                aria-pressed={propina === p}
                className={cn("h-11 rounded-lg border text-sm font-medium", propina === p ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
              >
                {p} %
              </button>
            ))}
          </div>
        </div>
        <dl className="space-y-1 rounded-lg bg-secondary p-3 text-sm">
          <Fila t="Consumo" v={rd(t.subtotal)} />
          <Fila t="ITBIS 18 %" v={rd(t.itbis)} />
          <Fila t="Servicio de ley 10 %" v={rd(t.servicio)} />
          <Fila t={`Propina ${propina} %`} v={rd(t.propina)} />
          <div className="flex justify-between border-t pt-2 text-lg font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{rd(t.total)}</dd>
          </div>
        </dl>
        <Button size="lg" className="h-12 w-full text-base" disabled={ocupado} onClick={() => onCobrar(metodo, propina)}>
          Cobrar {rd(t.total)}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{t}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  )
}
