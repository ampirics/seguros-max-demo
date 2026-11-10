"use client"

import { createContext, useContext } from "react"
import type { Caja, Gasto, MovimientoCaja } from "@/lib/restaurante/tipos"

export type Detalle =
  | { tipo: "visita"; id: string }
  | { tipo: "insumo"; id: string }
  | { tipo: "compra"; id: string }
  | { tipo: "proveedor"; id: string }
  | { tipo: "gasto"; id?: string; gasto?: Gasto; buscar?: { texto: string; monto: number; ts: number } }
  | { tipo: "cierre"; caja: Caja }
  | { tipo: "movimiento"; movimiento: MovimientoCaja }

export const ContextoDetalle = createContext<{ abrir: (d: Detalle) => void; cerrar: () => void }>({ abrir: () => {}, cerrar: () => {} })

export const useDetalle = () => useContext(ContextoDetalle)

export function detalleDeMovimiento(m: MovimientoCaja): Detalle {
  if (m.tipo === "venta" && m.visitaId) return { tipo: "visita", id: m.visitaId }
  if (m.tipo === "gasto") {
    if (m.compraId) return { tipo: "compra", id: m.compraId }
    if (m.gastoId) return { tipo: "gasto", id: m.gastoId }
    const oc = m.texto.match(/^Pago (OC-\d+)/)
    if (oc) return { tipo: "compra", id: oc[1] }
    return { tipo: "gasto", buscar: { texto: m.texto, monto: m.monto, ts: m.ts } }
  }
  return { tipo: "movimiento", movimiento: m }
}
