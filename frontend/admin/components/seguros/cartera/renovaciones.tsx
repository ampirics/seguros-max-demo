"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, MoreHorizontal, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Aseguradora, Filtro, Persona, Ramo, RenovacionChip } from "@/components/seguros/comun"
import { ESTADO_RENOVACION, dentroDe, fechaCorta, rd, rdCorto } from "@/lib/seguros/catalogo"
import type { Cliente, EstadoRenovacion, Poliza } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"
import { activa, diasPara, useAccion } from "./util"

const VENTANAS = [
  { id: "15", titulo: "Vencen en 15 días", desde: -Infinity, hasta: 15 },
  { id: "30", titulo: "Vencen en 16 a 30 días", desde: 16, hasta: 30 },
  { id: "60", titulo: "Vencen en 31 a 60 días", desde: 31, hasta: 60 },
]

const FILTROS: { id: string; nombre: string; estados: EstadoRenovacion[] | null }[] = [
  { id: "todas", nombre: "Todas", estados: null },
  { id: "sin", nombre: "Sin aviso", estados: ["sin_iniciar"] },
  { id: "gestion", nombre: "En gestión", estados: ["aviso_enviado", "quiere_renovar", "cotizando"] },
  { id: "confirmadas", nombre: "Confirmadas", estados: ["confirmada"] },
  { id: "no", nombre: "No renuevan", estados: ["no_renueva"] },
]

export function Renovaciones({ polizas, clientes, ahora }: { polizas: Poliza[]; clientes: Map<string, Cliente>; ahora: number }) {
  const [filtro, setFiltro] = useState("todas")
  const [sel, setSel] = useState<Set<string>>(new Set())
  const { correr, ocupado } = useAccion()

  const proximas = useMemo(
    () => polizas.filter((p) => activa(p) && diasPara(p.vence, ahora) <= 60).sort((a, b) => a.vence - b.vence),
    [polizas, ahora],
  )
  const estados = FILTROS.find((f) => f.id === filtro)?.estados
  const visibles = estados ? proximas.filter((p) => estados.includes(p.renovacion)) : proximas
  const sinAviso = proximas.filter((p) => p.renovacion === "sin_iniciar")
  const elegidas = proximas.filter((p) => sel.has(p.id) && p.renovacion === "sin_iniciar")

  const alternar = (ids: string[], marcar: boolean) =>
    setSel((s) => {
      const n = new Set(s)
      ids.forEach((i) => (marcar ? n.add(i) : n.delete(i)))
      return n
    })

  async function enviar() {
    const ids = elegidas.map((p) => p.id)
    if (!ids.length) return
    const r = await correr("aviso", { tipo: "avisoRenovacion", polizaIds: ids }, ids.length === 1 ? "Aviso de renovación enviado por WhatsApp" : `${ids.length} avisos de renovación enviados por WhatsApp`)
    if (r) setSel(new Set())
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => {
            const n = f.estados ? proximas.filter((p) => f.estados!.includes(p.renovacion)).length : proximas.length
            return (
              <Filtro key={f.id} activo={filtro === f.id} onClick={() => setFiltro(f.id)}>
                {f.nombre} <span className="ml-1 tabular-nums opacity-70">{n}</span>
              </Filtro>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => alternar(sinAviso.map((p) => p.id), elegidas.length < sinAviso.length)} disabled={!sinAviso.length}>
            {elegidas.length && elegidas.length === sinAviso.length ? "Quitar selección" : `Seleccionar las ${sinAviso.length} sin aviso`}
          </Button>
          <Button size="sm" onClick={enviar} disabled={!elegidas.length || ocupado === "aviso"}>
            <Send aria-hidden />
            Enviar aviso de renovación{elegidas.length ? ` (${elegidas.length})` : ""}
          </Button>
        </div>
      </div>

      {VENTANAS.map((v) => {
        const lista = visibles.filter((p) => {
          const d = diasPara(p.vence, ahora)
          return d >= v.desde && d <= v.hasta
        })
        if (!lista.length) return null
        const libres = lista.filter((p) => p.renovacion === "sin_iniciar")
        const todas = libres.length > 0 && libres.every((p) => sel.has(p.id))
        const prima = lista.reduce((t, p) => t + p.primaAnual, 0)
        const confirmadas = lista.filter((p) => p.renovacion === "confirmada").length
        return (
          <section key={v.id} className="overflow-hidden rounded-xl border bg-card">
            <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-secondary/40 px-4 py-3">
              <label className={cn("flex items-center gap-2", !libres.length && "opacity-40")}>
                <Checkbox checked={todas} onCheckedChange={(c) => alternar(libres.map((p) => p.id), !!c)} disabled={!libres.length} aria-label={`Seleccionar las sin aviso: ${v.titulo}`} />
              </label>
              <h3 className="font-display text-base font-semibold">{v.titulo}</h3>
              <span className="text-xs text-muted-foreground">
                {lista.length} {lista.length === 1 ? "póliza" : "pólizas"} · {rdCorto(prima)} en prima · {confirmadas} confirmadas · {libres.length} sin aviso
              </span>
            </header>
            <ul className="divide-y">
              {lista.map((p) => (
                <Fila key={p.id} p={p} cliente={clientes.get(p.clienteId)} ahora={ahora} marcada={sel.has(p.id)} onMarcar={(m) => alternar([p.id], m)} />
              ))}
            </ul>
          </section>
        )
      })}
      {!visibles.length && <p className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">No hay pólizas en ese estado en los próximos 60 días.</p>}
    </div>
  )
}

function Fila({ p, cliente, ahora, marcada, onMarcar }: { p: Poliza; cliente?: Cliente; ahora: number; marcada: boolean; onMarcar: (m: boolean) => void }) {
  const router = useRouter()
  const { correr, ocupado } = useAccion()
  const dias = diasPara(p.vence, ahora)
  const puede = p.renovacion === "sin_iniciar"
  const cambiar = (r: EstadoRenovacion) => correr(r, { tipo: "renovacion", polizaId: p.id, renovacion: r }, `${p.numero}: ${ESTADO_RENOVACION[r].toLowerCase()}`)
  const parar = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <li
      onClick={() => router.push(`/admin/cartera/${p.id}`)}
      className={cn("grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/40 lg:grid-cols-[auto_minmax(0,2.2fr)_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1.1fr)_auto]", marcada && "bg-accent/50")}
    >
      <span onClick={parar} className="flex items-center">
        <Checkbox checked={marcada} onCheckedChange={(c) => onMarcar(!!c)} disabled={!puede} aria-label={`Seleccionar ${p.numero}`} className={cn(!puede && "opacity-30")} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{cliente?.nombre ?? "Asegurado"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {p.numero} · {p.bien}
        </p>
      </div>
      <div className="flex items-center justify-end gap-1 lg:order-last" onClick={parar}>
        {p.renovacion !== "confirmada" && p.renovacion !== "no_renueva" && (
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => cambiar("confirmada")} disabled={!!ocupado}>
            <Check aria-hidden />
            <span className="hidden sm:inline">Confirmar</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Más acciones">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Renovación</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["quiere_renovar", "cotizando", "confirmada"] as EstadoRenovacion[]).map((r) => (
              <DropdownMenuItem key={r} disabled={p.renovacion === r} onSelect={() => cambiar(r)}>
                {ESTADO_RENOVACION[r]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem disabled={p.renovacion === "no_renueva"} onSelect={() => cambiar("no_renueva")} className="text-destructive">
              <X className="h-4 w-4" aria-hidden /> No renueva
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="col-span-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-7 lg:col-span-1 lg:pl-0">
        <Ramo ramo={p.ramo} />
        <span className="lg:hidden">
          <Aseguradora id={p.aseguradoraId} tamano="sm" />
        </span>
        <span className="text-sm font-semibold tabular-nums lg:hidden">{rd(p.primaAnual)}</span>
        <span className="lg:hidden">
          <RenovacionChip estado={p.renovacion} />
        </span>
      </div>
      <span className="hidden lg:block">
        <Aseguradora id={p.aseguradoraId} tamano="sm" />
      </span>
      <span className="hidden text-right text-sm font-semibold tabular-nums lg:block">{rd(p.primaAnual)}</span>
      <div className="col-span-3 flex items-center justify-between gap-3 pl-7 lg:col-span-1 lg:flex-col lg:items-start lg:gap-1 lg:pl-0">
        <span className="text-xs">
          <span className="font-medium">{fechaCorta(p.vence)}</span>
          <span className={cn("ml-1.5", dias <= 15 ? "font-semibold text-destructive" : "text-muted-foreground")}>{dentroDe(p.vence, ahora)}</span>
        </span>
        <span className="hidden lg:inline-flex">
          <RenovacionChip estado={p.renovacion} />
        </span>
        <span className="lg:hidden">
          <Persona id={p.ejecutivoId} conNombre={false} />
        </span>
      </div>
    </li>
  )
}
