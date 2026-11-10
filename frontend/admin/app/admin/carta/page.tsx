"use client"

import { useMemo, useState } from "react"
import { Clock, Search } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Input } from "@/components/ui/input"
import { CARTA, CATEGORIAS, ESTACIONES, FUENTE_PRECIOS, ITBIS, SERVICIO, rd } from "@/lib/restaurante/carta"
import { useRestaurante } from "@/lib/restaurante/cliente"
import { margen, platosAgotados } from "@/lib/restaurante/inventario"
import { fotoDe } from "@/components/restaurante/operacion/util"
import { cn } from "@/lib/utils"

const ALERGENOS = Array.from(new Set(CARTA.flatMap((p) => p.alergenos ?? []))).sort()

export default function CartaPage() {
  const { estado } = useRestaurante()
  const [q, setQ] = useState("")
  const [sin, setSin] = useState<string | null>(null)
  const [cat, setCat] = useState<string | null>(null)

  const vendidos = useMemo(() => {
    const m = new Map<string, number>()
    if (!estado) return m
    for (const v of estado.visitasHoy) for (const p of v.platos) m.set(p.platoId, (m.get(p.platoId) ?? 0) + 1)
    for (const p of estado.pedidos) for (const i of p.items) m.set(i.platoId, (m.get(i.platoId) ?? 0) + 1)
    return m
  }, [estado])
  const agotados = useMemo(() => platosAgotados(estado?.insumos), [estado?.insumos])

  const lista = CARTA.filter(
    (p) =>
      (!q || p.nombre.toLowerCase().includes(q.toLowerCase()) || (p.descripcion ?? "").toLowerCase().includes(q.toLowerCase())) &&
      (!sin || !(p.alergenos ?? []).includes(sin)) &&
      (!cat || p.categoria === cat),
  )
  const categorias = CATEGORIAS.filter((c) => lista.some((p) => p.categoria === c))

  return (
    <AdminLayout title="Carta">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-4xl leading-tight">La carta de Boca Marina</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {CARTA.length} platos. Precios en pesos de la {FUENTE_PRECIOS.toLowerCase()}, sin {ITBIS * 100} % de ITBIS ni {SERVICIO * 100} % de servicio de ley. La IA y el mesero usan solo estos precios.
          </p>
          <p className="max-w-3xl text-xs text-muted-foreground">
            Costo y food cost con costos de ejemplo: Boca Marina todavía no ha compartido los suyos.{agotados.size ? ` Hoy hay ${agotados.size} ${agotados.size === 1 ? "plato agotado" : "platos agotados"} por falta de insumos.` : ""}
          </p>
        </header>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plato" className="h-11 pl-9" aria-label="Buscar plato" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="etiqueta mr-1">Categoría</span>
            <Chip activo={!cat} onClick={() => setCat(null)}>Todas</Chip>
            {CATEGORIAS.map((c) => (
              <Chip key={c} activo={cat === c} onClick={() => setCat(cat === c ? null : c)}>{c}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="etiqueta mr-1">Sin alérgeno</span>
            <Chip activo={!sin} onClick={() => setSin(null)}>Cualquiera</Chip>
            {ALERGENOS.map((a) => (
              <Chip key={a} activo={sin === a} onClick={() => setSin(sin === a ? null : a)}>Sin {a}</Chip>
            ))}
          </div>
        </div>

        {categorias.map((c) => (
          <section key={c} className="flex flex-col gap-3">
            <h2 className="font-display text-2xl">{c}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista
                .filter((p) => p.categoria === c)
                .map((p) => {
                  const foto = fotoDe(p)
                  const hoy = vendidos.get(p.id) ?? 0
                  const m = margen(p.id, estado?.insumos)
                  const agotado = agotados.has(p.id)
                  return (
                    <article key={p.id} className={cn("flex min-w-0 gap-3 overflow-hidden rounded-xl border bg-card p-3", agotado && "border-destructive/30")}>
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
                        {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-2 text-center font-display text-sm text-muted-foreground">{c}</div>}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-snug">
                            {p.nombre}
                            {agotado && <span className="ml-1.5 inline-flex rounded-full bg-destructive-soft px-2 py-0.5 align-middle text-[11px] font-medium text-destructive">Agotado</span>}
                          </h3>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{rd(p.precio)}{p.porLibra ? "/lb" : ""}</span>
                        </div>
                        {p.descripcion && <p className="line-clamp-2 text-xs text-muted-foreground">{p.descripcion}</p>}
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span>{ESTACIONES.find((e) => e.id === p.estacion)?.nombre}</span>
                          <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" aria-hidden /> {p.minutos} min</span>
                          {hoy > 0 && <span className="font-medium text-foreground">Hoy: {hoy}</span>}
                        </p>
                        {m && m.costo > 0 && (
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" title="Costo de ejemplo">
                            <span>Costo ej. {rd(m.costo)}</span>
                            <span>Margen {rd(m.precio - m.costo)}</span>
                            <span className={cn("font-medium", m.pct <= 35 ? "text-success" : m.pct <= 45 ? "text-warning" : "text-destructive")}>{m.pct} % food cost</span>
                          </p>
                        )}
                        {(p.opciones?.length || p.alergenos?.length) ? (
                          <div className="mt-auto flex flex-wrap gap-1 pt-1">
                            {p.opciones?.map((o) => (
                              <span key={o.nombre} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">{o.nombre}</span>
                            ))}
                            {p.alergenos?.map((a) => (
                              <span key={a} className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">{a}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
            </div>
          </section>
        ))}
        {!categorias.length && <p className="py-10 text-center text-sm text-muted-foreground">Ningún plato cumple esos filtros.</p>}
      </div>
    </AdminLayout>
  )
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={cn("h-8 rounded-full border px-3 text-xs font-medium transition-colors", activo ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}
    >
      {children}
    </button>
  )
}
