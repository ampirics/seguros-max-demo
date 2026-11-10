"use client"

import Link from "next/link"
import { hace } from "@/lib/restaurante/local"
import type { Estado, Evento } from "@/lib/restaurante/tipos"

const COLOR: Record<Evento["tipo"], string> = {
  mesa: "#7FCFCB",
  cocina: "#E8866A",
  reserva: "#9B8CE8",
  pago: "#6BBF8A",
  llamado: "#E86A9B",
  ia: "#F2C14E",
  sistema: "#AEB5AA",
}

export function Bitacora({ estado, ahora, onMesa, limite = 40 }: { estado: Estado; ahora: number; onMesa?: (id: string) => void; limite?: number }) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border bg-card">
      <h3 className="border-b px-4 py-3 text-sm font-semibold">Lo que está pasando</h3>
      <ol className="max-h-[420px] overflow-y-auto px-2 py-2 text-sm">
        {estado.eventos.slice(0, limite).map((e) => (
          <li key={e.id} className="flex gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR[e.tipo] }} aria-hidden />
            <div className="min-w-0 flex-1">
              {e.mesaId && onMesa ? (
                <button className="text-left hover:underline" onClick={() => onMesa(e.mesaId!)}>{e.texto}</button>
              ) : e.reservaId ? (
                <Link className="hover:underline" href={`/admin/reservaciones/${e.reservaId}`}>{e.texto}</Link>
              ) : (
                <span>{e.texto}</span>
              )}
              <span className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground">hace {hace(e.ts, ahora)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
