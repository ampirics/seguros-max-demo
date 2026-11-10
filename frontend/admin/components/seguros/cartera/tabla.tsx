"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Aseguradora, Chip, Filtro, Persona, Ramo, RenovacionChip, Tarjeta } from "@/components/seguros/comun"
import { ASEGURADORA, ASEGURADORAS, EQUIPO, RAMOS, RAMO_CORTO, dentroDe, fechaCorta, rd, rdCorto } from "@/lib/seguros/catalogo"
import type { Cliente, Poliza, Ramo as TRamo } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"
import { BarrasPrima, type Barra } from "./graficos"
import { activa, diasPara } from "./util"

const ESTADOS = [
  { id: "todas", nombre: "Todas" },
  { id: "vigente", nombre: "Vigentes" },
  { id: "por_renovar", nombre: "Por renovar" },
  { id: "atrasado", nombre: "Pago atrasado" },
] as const
type FiltroEstado = (typeof ESTADOS)[number]["id"]

const PASO = 40
const selectCls = "h-10 w-full min-w-0 rounded-control border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function TablaCartera({ polizas, clientes, ahora }: { polizas: Poliza[]; clientes: Map<string, Cliente>; ahora: number }) {
  const [q, setQ] = useState("")
  const [ramo, setRamo] = useState("")
  const [aseg, setAseg] = useState("")
  const [ejec, setEjec] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todas")
  const [orden, setOrden] = useState<"vence" | "prima">("prima")
  const [limite, setLimite] = useState(PASO)

  const base = useMemo(() => polizas.filter(activa), [polizas])
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return base
      .filter((p) => (!ramo || p.ramo === ramo) && (!aseg || p.aseguradoraId === aseg) && (!ejec || p.ejecutivoId === ejec))
      .filter((p) => (estado === "todas" ? true : estado === "atrasado" ? !p.pagoAlDia : p.estado === estado))
      .filter((p) => {
        if (!t) return true
        const c = clientes.get(p.clienteId)
        return [p.numero, p.bien, p.plan, c?.nombre, c?.documento].some((x) => x?.toLowerCase().includes(t))
      })
      .sort((a, b) => (orden === "prima" ? b.primaAnual - a.primaAnual : a.vence - b.vence))
  }, [base, q, ramo, aseg, ejec, estado, orden, clientes])

  const porRamo = useMemo(() => agrupar(filtradas, (p) => p.ramo, (id) => RAMO_CORTO[id as TRamo]), [filtradas])
  const porAseg = useMemo(() => agrupar(filtradas, (p) => p.aseguradoraId, (id) => ASEGURADORA[id]?.corto ?? id), [filtradas])
  const prima = filtradas.reduce((t, p) => t + p.primaAnual, 0)
  const ejecutivos = EQUIPO.filter((e) => base.some((p) => p.ejecutivoId === e.id))
  const hayFiltros = q || ramo || aseg || ejec || estado !== "todas"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => (setQ(e.target.value), setLimite(PASO))} placeholder="Buscar por asegurado, cédula, número o bien" className="h-10 pl-9" aria-label="Buscar póliza" />
          </div>
          <select className={selectCls} value={ramo} onChange={(e) => setRamo(e.target.value)} aria-label="Ramo">
            <option value="">Todos los ramos</option>
            {RAMOS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <select className={selectCls} value={aseg} onChange={(e) => setAseg(e.target.value)} aria-label="Aseguradora">
            <option value="">Todas las aseguradoras</option>
            {ASEGURADORAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
          <select className={selectCls} value={ejec} onChange={(e) => setEjec(e.target.value)} aria-label="Ejecutivo">
            <option value="">Todos los ejecutivos</option>
            {ejecutivos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {ESTADOS.map((e) => (
              <Filtro key={e.id} activo={estado === e.id} onClick={() => setEstado(e.id)}>
                {e.nombre}
              </Filtro>
            ))}
          </div>
          {hayFiltros && (
            <Button variant="ghost" size="sm" onClick={() => (setQ(""), setRamo(""), setAseg(""), setEjec(""), setEstado("todas"))}>
              Quitar filtros
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Prima por ramo" accion={<span className="text-xs text-muted-foreground">Toque una barra para filtrar</span>}>
          <BarrasPrima datos={porRamo} activo={ramo} onElegir={(id) => setRamo(ramo === id ? "" : id)} />
        </Tarjeta>
        <Tarjeta titulo="Prima por aseguradora" accion={<span className="text-xs text-muted-foreground">{porAseg.length} aseguradoras</span>}>
          <BarrasPrima datos={porAseg} activo={aseg} onElegir={(id) => setAseg(aseg === id ? "" : id)} />
        </Tarjeta>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{filtradas.length}</span> pólizas · <span className="font-semibold tabular-nums">{rdCorto(prima)}</span> en prima anual
          </p>
          <div className="flex gap-1.5">
            <Filtro activo={orden === "prima"} onClick={() => setOrden("prima")}>
              Mayor prima
            </Filtro>
            <Filtro activo={orden === "vence"} onClick={() => setOrden("vence")}>
              Vencen primero
            </Filtro>
          </div>
        </header>
        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-3 border-b bg-secondary/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
          <span>Asegurado y póliza</span>
          <span>Ramo</span>
          <span>Aseguradora</span>
          <span>Ejecutivo</span>
          <span className="text-right">Prima anual</span>
          <span>Vence</span>
        </div>
        <ul className="divide-y">
          {filtradas.slice(0, limite).map((p) => {
            const c = clientes.get(p.clienteId)
            const dias = diasPara(p.vence, ahora)
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/cartera/${p.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-accent/40 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c?.nombre ?? "Asegurado"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.numero} · {p.bien}
                    </p>
                  </div>
                  <span className="text-right text-sm font-semibold tabular-nums lg:hidden">{rd(p.primaAnual)}</span>
                  <span className="col-span-2 flex flex-wrap items-center gap-3 lg:col-span-1">
                    <Ramo ramo={p.ramo} />
                    <span className="lg:hidden">
                      <Aseguradora id={p.aseguradoraId} tamano="sm" />
                    </span>
                    <span className="text-xs text-muted-foreground lg:hidden">{fechaCorta(p.vence)}</span>
                    {!p.pagoAlDia && (
                      <span className="lg:hidden">
                        <Chip tono="rojo">Pago atrasado</Chip>
                      </span>
                    )}
                  </span>
                  <span className="hidden lg:block">
                    <Aseguradora id={p.aseguradoraId} tamano="sm" />
                  </span>
                  <span className="hidden min-w-0 lg:block">
                    <Persona id={p.ejecutivoId} />
                  </span>
                  <span className="hidden text-right text-sm font-semibold tabular-nums lg:block">{rd(p.primaAnual)}</span>
                  <span className="hidden flex-col items-start gap-1 lg:flex">
                    <span className="text-xs">
                      <span className="font-medium">{fechaCorta(p.vence)}</span>
                      <span className={cn("ml-1.5", dias <= 30 ? "text-warning" : "text-muted-foreground")}>{dias <= 60 ? dentroDe(p.vence, ahora) : ""}</span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {p.estado === "por_renovar" && <RenovacionChip estado={p.renovacion} />}
                      {!p.pagoAlDia && <Chip tono="rojo">Pago atrasado</Chip>}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        {!filtradas.length && <p className="py-12 text-center text-sm text-muted-foreground">Ninguna póliza cumple esos filtros.</p>}
        {filtradas.length > limite && (
          <div className="border-t p-3 text-center">
            <Button variant="outline" size="sm" onClick={() => setLimite((l) => l + PASO)}>
              Ver {Math.min(PASO, filtradas.length - limite)} más de {filtradas.length - limite}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

function agrupar(polizas: Poliza[], clave: (p: Poliza) => string, nombre: (id: string) => string): Barra[] {
  const m = new Map<string, Barra>()
  for (const p of polizas) {
    const id = clave(p)
    const b = m.get(id) ?? { id, nombre: nombre(id), prima: 0, polizas: 0 }
    b.prima += p.primaAnual
    b.polizas++
    m.set(id, b)
  }
  return [...m.values()].sort((a, b) => b.prima - a.prima)
}
