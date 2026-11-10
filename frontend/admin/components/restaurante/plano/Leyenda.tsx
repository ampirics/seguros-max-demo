"use client"

import type { Estado } from "@/lib/restaurante/tipos"
import { ESTADO_MESA, ORDEN_ESTADOS } from "./estados"

export function Leyenda({ estado }: { estado: Estado }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Estados de las mesas">
      {ORDEN_ESTADOS.map((e) => {
        const n = estado.mesas.filter((m) => m.estado === e).length
        return (
          <li key={e} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-black/10" style={{ background: ESTADO_MESA[e].color }} />
            <span>{ESTADO_MESA[e].nombre}</span>
            <span className="tabular-nums text-foreground/70">{n}</span>
          </li>
        )
      })}
    </ul>
  )
}
