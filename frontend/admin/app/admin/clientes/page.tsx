"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { CanalChip } from "@/components/restaurante/reservas/comun"
import { enSegmento, haceDias, iniciales, SEGMENTOS, type Segmento } from "@/components/restaurante/clientes/segmentos"
import { rd } from "@/lib/restaurante/carta"
import { useRestaurante } from "@/lib/restaurante/cliente"
import { cn } from "@/lib/utils"

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

type Orden = "ultima" | "gasto" | "visitas" | "nombre"

export default function ClientesPage() {
  const { estado, ahora } = useRestaurante()
  const [q, setQ] = useState("")
  const [segmento, setSegmento] = useState<Segmento>("todos")
  const [orden, setOrden] = useState<Orden>("ultima")

  const conteos = useMemo(() => {
    if (!estado) return {} as Record<Segmento, number>
    return Object.fromEntries(SEGMENTOS.map((s) => [s.id, estado.clientes.filter((c) => enSegmento(s.id, c, estado.reservas, ahora)).length])) as Record<Segmento, number>
    // el conteo no necesita recalcularse cada segundo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado?.version])

  if (!estado) {
    return (
      <AdminLayout title="Clientes">
        <Skeleton className="h-96 w-full" />
      </AdminLayout>
    )
  }

  const lista = estado.clientes
    .filter((c) => enSegmento(segmento, c, estado.reservas, ahora))
    .filter((c) => !q || norm(`${c.nombre} ${c.telefono} ${c.empresa ?? ""} ${c.correo ?? ""}`).includes(norm(q)))
    .sort((a, b) =>
      orden === "gasto" ? b.gasto - a.gasto : orden === "visitas" ? b.visitas - a.visitas : orden === "nombre" ? a.nombre.localeCompare(b.nombre) : (b.ultimaVisita ?? b.creado) - (a.ultimaVisita ?? a.creado),
    )
  const total = estado.clientes.reduce((s, c) => s + c.gasto, 0)
  const actual = SEGMENTOS.find((s) => s.id === segmento)!

  return (
    <AdminLayout title="Clientes">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">Cada cliente, del primer mensaje a la última visita</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Clientes</h1>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Con ficha</p>
              <p className="text-xl font-semibold tabular-nums">{estado.clientes.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consumo registrado</p>
              <p className="text-xl font-semibold tabular-nums">{rd(total)}</p>
            </div>
          </div>
        </header>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Segmentos">
          {SEGMENTOS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={segmento === s.id}
              onClick={() => setSegmento(s.id)}
              title={s.detalle}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                segmento === s.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
              )}
            >
              {s.nombre}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", segmento === s.id ? "bg-primary-foreground/20" : "bg-secondary")}>{conteos[s.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{actual.detalle}</p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, teléfono o empresa" aria-label="Buscar cliente" className="pl-9" />
            </div>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              aria-label="Ordenar"
              className="h-10 rounded-control border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ultima">Última actividad</option>
              <option value="gasto">Mayor consumo</option>
              <option value="visitas">Más visitas</option>
              <option value="nombre">Nombre</option>
            </select>
          </div>
        </div>

        {lista.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center text-sm text-muted-foreground">No hay clientes en este segmento{q ? " con esa búsqueda" : ""}.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)] gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span>Cliente</span>
              <span className="text-right">Visitas</span>
              <span className="text-right">Consumo</span>
              <span className="text-right">Puntos</span>
              <span>Última visita</span>
              <span>Llegó por</span>
            </div>
            <ul className="divide-y">
              {lista.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/clientes/${c.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-accent md:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{iniciales(c.nombre) || "C"}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{c.nombre}</span>
                          {c.etiqueta && <span className="hidden shrink-0 rounded-full bg-[#E8866A]/15 px-2 py-0.5 text-[10px] font-medium text-[#B5532F] dark:text-[#F0A48A] sm:inline">{c.etiqueta}</span>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.telefono}
                          {c.alergias?.length ? <span className="text-destructive"> · Alergia: {c.alergias.join(", ")}</span> : null}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums md:block">
                      <span className="md:hidden">{rd(c.gasto)}</span>
                      <span className="hidden md:inline">{c.visitas}</span>
                    </span>
                    <span className="hidden text-right text-sm tabular-nums md:block">{rd(c.gasto)}</span>
                    <span className="hidden text-right text-sm tabular-nums md:block">{c.puntos}</span>
                    <span className="col-span-2 text-xs text-muted-foreground md:col-span-1 md:text-sm">
                      <span className="md:hidden">{c.visitas} visitas · </span>
                      {haceDias(c.ultimaVisita, ahora)}
                    </span>
                    <span className="hidden md:block">
                      <CanalChip canal={c.canalOrigen} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
