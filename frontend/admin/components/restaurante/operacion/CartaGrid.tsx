"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { CARTA, CATEGORIAS, rd } from "@/lib/restaurante/carta"
import type { Plato } from "@/lib/restaurante/tipos"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { fotoDe } from "./util"

const DESTACADOS = "Más pedidos"

export function CartaGrid({ onElegir, compacta = false, agotados }: { onElegir: (p: Plato) => void; compacta?: boolean; agotados?: Set<string> }) {
  const [cat, setCat] = useState<string>(DESTACADOS)
  const [q, setQ] = useState("")
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t) return CARTA.filter((p) => p.nombre.toLowerCase().includes(t) || (p.descripcion ?? "").toLowerCase().includes(t))
    if (cat === DESTACADOS) return CARTA.filter((p) => p.destacado)
    return CARTA.filter((p) => p.categoria === cat)
  }, [cat, q])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la carta" className="h-11 pl-9" aria-label="Buscar en la carta" />
      </div>
      {!q && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-hide" role="tablist" aria-label="Categorías">
          {[DESTACADOS, ...CATEGORIAS].map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={cn(
                "h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <div className={cn("grid gap-2.5", compacta ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4")}>
        {lista.map((p) => {
          const foto = fotoDe(p)
          const agotado = agotados?.has(p.id)
          return (
            <button
              key={p.id}
              onClick={() => onElegir(p)}
              disabled={agotado}
              className="group relative flex disabled:cursor-not-allowed disabled:opacity-50 min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              {agotado && <span className="absolute left-2 top-2 z-10 rounded-full bg-[#0B2A2E] px-2 py-0.5 text-[11px] font-semibold text-[#F4ECDF]">Agotado</span>}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                {foto ? (
                  <img src={foto} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center font-display text-lg leading-tight text-muted-foreground/70">{p.categoria}</div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <span className="line-clamp-2 text-sm font-medium leading-snug">{p.nombre}</span>
                <span className="mt-auto flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{rd(p.precio)}{p.porLibra ? "/lb" : ""}</span>
                  <span>{p.minutos} min</span>
                </span>
              </div>
            </button>
          )
        })}
        {!lista.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No hay platos con ese nombre.</p>}
      </div>
    </div>
  )
}
