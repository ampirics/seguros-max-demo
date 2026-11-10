"use client"

import { ETAPAS, MOTIVOS, ORIGEN, sla } from "@/components/admin/leads/LeadFicha"
import type { Lead } from "@/lib/api-types"
import { cn, formatCurrency } from "@/lib/utils"

export const sumaMonto = (ls: Lead[]) => ls.reduce((s, l) => s + (l.monto_dop ?? 0), 0)

export function Tuberia({
  leads,
  ahora,
  ocultarCerradas,
  onAbrir,
}: {
  leads: Lead[]
  ahora: number
  ocultarCerradas?: boolean
  onAbrir: (lead: Lead) => void
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="region" aria-label="Tablero de leads" tabIndex={0}>
      <div className="flex gap-3">
        {ETAPAS.filter((e) => !(ocultarCerradas && (e.clave === "ganada" || e.clave === "perdida"))).map((e) => {
          const lista = leads.filter((l) => l.etapa === e.clave)
          return (
            <section key={e.clave} className="flex w-72 shrink-0 flex-col rounded-lg bg-secondary/50 p-2" aria-label={e.label}>
              <header className="flex items-baseline justify-between gap-2 px-1 pb-2">
                <h2 className="text-sm font-semibold">{e.label} <span className="font-normal text-muted-foreground">{lista.length}</span></h2>
                {sumaMonto(lista) > 0 && <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(sumaMonto(lista))}</span>}
              </header>
              <ul className="space-y-2">
                {lista.length === 0 && <li className="px-1 py-4 text-center text-xs text-muted-foreground">Sin leads</li>}
                {lista.map((l) => {
                  const s = sla(l, ahora)
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => onAbrir(l)}
                        className="w-full rounded-md border bg-card p-3 text-left shadow-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring">
                        <p className="truncate text-sm font-medium">{l.cliente}</p>
                        {l.interes && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{l.interes}</p>}
                        {l.vehiculo && <p className="mt-0.5 truncate text-xs text-muted-foreground">{[l.vehiculo.marca, l.vehiculo.modelo, l.vehiculo.anio].filter(Boolean).join(" ")}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded bg-secondary px-1.5 leading-5">{ORIGEN[l.origen] ?? l.origen}</span>
                          <span className="truncate text-muted-foreground">{l.responsable}</span>
                          {l.monto_dop != null && <span className="ml-auto font-semibold tabular-nums">{formatCurrency(l.monto_dop)}</span>}
                        </div>
                        {s && (
                          <p className={cn("mt-2 rounded px-1.5 text-[11px] font-medium leading-5", s.vencido ? "bg-destructive-soft text-destructive" : "bg-warning-soft text-warning")}>{s.texto}</p>
                        )}
                        {l.motivo_perdida && <p className="mt-2 text-[11px] text-destructive">Motivo: {MOTIVOS[l.motivo_perdida]}</p>}
                        {l.etapa === "ganada" && l.vendedor_cierre && <p className="mt-2 text-[11px] text-success">Cerró {l.vendedor_cierre}</p>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
