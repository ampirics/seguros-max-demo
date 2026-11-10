"use client"

import { useEffect, useState } from "react"
import { ArrowDownUp, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ZONAS } from "@/lib/restaurante/local"
import type { Estado, Mesa, Zona } from "@/lib/restaurante/tipos"

export type FiltroEstado = "todas" | "con_clientes" | "ocupada" | "en_cocina" | "servida" | "cuenta" | "reservada" | "libre" | "limpieza"
export type Orden = "urgente" | "tiempo_desc" | "tiempo_asc" | "consumo_desc" | "consumo_asc" | "comensales_desc" | "numero"

export interface Filtro {
  estado: FiltroEstado
  zona: Zona | "todas"
  orden: Orden
}

const ESTADOS: [FiltroEstado, string][] = [
  ["todas", "Todas las mesas"],
  ["con_clientes", "Con clientes"],
  ["ocupada", "Por ordenar"],
  ["en_cocina", "En cocina"],
  ["servida", "Servidas"],
  ["cuenta", "Pidieron la cuenta"],
  ["reservada", "Reservadas"],
  ["libre", "Libres"],
  ["limpieza", "En limpieza"],
]

const ORDENES: [Orden, string][] = [
  ["urgente", "Lo urgente primero"],
  ["tiempo_desc", "Más tiempo en la mesa"],
  ["tiempo_asc", "Menos tiempo en la mesa"],
  ["consumo_desc", "Mayor consumo"],
  ["consumo_asc", "Menor consumo"],
  ["comensales_desc", "Más comensales"],
  ["numero", "Por número"],
]

const CLAVE = "filtro-mesas"
const INICIAL: Filtro = { estado: "todas", zona: "todas", orden: "urgente" }

export function useFiltroMesas() {
  const [filtro, setFiltro] = useState<Filtro>(INICIAL)
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE) || "null")
      if (g) setFiltro({ ...INICIAL, ...g })
    } catch {}
  }, [])
  const cambiar = (c: Partial<Filtro>) =>
    setFiltro((f) => {
      const n = { ...f, ...c }
      try {
        localStorage.setItem(CLAVE, JSON.stringify(n))
      } catch {}
      return n
    })
  return [filtro, cambiar] as const
}

const CON_CLIENTES = ["ocupada", "en_cocina", "servida", "cuenta"]

/** Filtra y ordena; `urgencia` da el orden por defecto de la pantalla que la usa (menor = primero). */
export function aplicarFiltro(mesas: Mesa[], estado: Estado, f: Filtro, urgencia: (m: Mesa) => number) {
  const consumo = (m: Mesa) => estado.pedidos.find((p) => p.id === m.pedidoId)?.items.reduce((s, i) => s + i.precio, 0) ?? 0
  const tiempo = (m: Mesa) => (CON_CLIENTES.includes(m.estado) ? (m.tramos?.llegada ? Date.now() - m.tramos.llegada : Date.now() - m.desde) : -1)
  const numero = (a: Mesa, b: Mesa) => a.id.localeCompare(b.id, "es", { numeric: true })
  const lista = mesas.filter(
    (m) => (f.zona === "todas" || m.zona === f.zona) && (f.estado === "todas" || (f.estado === "con_clientes" ? CON_CLIENTES.includes(m.estado) : m.estado === f.estado)),
  )
  const comparar: Record<Orden, (a: Mesa, b: Mesa) => number> = {
    urgente: (a, b) => urgencia(a) - urgencia(b) || numero(a, b),
    tiempo_desc: (a, b) => tiempo(b) - tiempo(a) || numero(a, b),
    tiempo_asc: (a, b) => (tiempo(a) < 0 ? 1 : tiempo(b) < 0 ? -1 : tiempo(a) - tiempo(b)) || numero(a, b),
    consumo_desc: (a, b) => consumo(b) - consumo(a) || numero(a, b),
    consumo_asc: (a, b) => (consumo(a) === 0 ? 1 : consumo(b) === 0 ? -1 : consumo(a) - consumo(b)) || numero(a, b),
    comensales_desc: (a, b) => (b.comensales ?? 0) - (a.comensales ?? 0) || numero(a, b),
    numero,
  }
  return lista.sort(comparar[f.orden])
}

export function FiltroMesas({ filtro, onCambio, total, visibles }: { filtro: Filtro; onCambio: (c: Partial<Filtro>) => void; total: number; visibles: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Select value={filtro.estado} onValueChange={(v) => onCambio({ estado: v as FiltroEstado })}>
        <SelectTrigger className="h-10 w-[180px]" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
        <SelectContent>{ESTADOS.map(([v, t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filtro.zona} onValueChange={(v) => onCambio({ zona: v as Zona | "todas" })}>
        <SelectTrigger className="h-10 w-[190px]" aria-label="Filtrar por zona"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las zonas</SelectItem>
          {ZONAS.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      <ArrowDownUp className="ml-1 h-4 w-4 text-muted-foreground" aria-hidden />
      <Select value={filtro.orden} onValueChange={(v) => onCambio({ orden: v as Orden })}>
        <SelectTrigger className="h-10 w-[210px]" aria-label="Ordenar mesas"><SelectValue /></SelectTrigger>
        <SelectContent>{ORDENES.map(([v, t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">{visibles === total ? `${total} mesas` : `${visibles} de ${total} mesas`}</span>
    </div>
  )
}
