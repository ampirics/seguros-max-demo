import type { Pieza } from "./piezas"

// Sucursales y existencias de demo (backend: scripts/seed_inventario_colt.py). Cantidades de ejemplo, fijas por SKU.

export interface SucursalMock {
  id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  horario: string | null
  activa: boolean
  almacen_sap?: string | null
}

export interface ExistenciaMock {
  pieza_id: string
  sucursal_id: string
  cantidad: number
  ubicacion: string | null
  actualizado: string
  minimo?: number | null
}

export interface MovimientoMock {
  id: string
  pieza_id: string
  sucursal_id: string
  tipo: string
  cantidad: number
  resultante: number | null
  motivo: string | null
  referencia: string | null
  usuario: string | null
  fecha: string
}

export interface ReservaMock {
  id: string
  pieza_id: string
  sucursal_id: string
  cantidad: number
  conversation_id: string | null
  vence: string
  liberada: string | null
  creada: string
  creada_por: string | null
}

export const sucursalesSeed = (): SucursalMock[] => [
  { id: "suc-villas", nombre: "Villas Agrícolas", direccion: "Villas Agrícolas, Santo Domingo, República Dominicana", telefono: "809-684-1243", horario: null, activa: true },
  { id: "suc-2", nombre: "Sucursal 2 (por confirmar)", direccion: null, telefono: null, horario: null, activa: true },
]

const MODELOS = ["Tucson", "L200", "Lancer"]

const hash = (texto: string) => [...texto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function existenciasSeed(piezas: Pieza[], sucursales: SucursalMock[]): ExistenciaMock[] {
  const ahora = new Date().toISOString()
  return piezas
    .filter((p) => p.vehiculo && MODELOS.includes(p.vehiculo.modelo ?? ""))
    .flatMap((p) => sucursales.map((s, i) => {
      const n = hash(`${p.sku}:${i}`)
      return {
        pieza_id: String(p.id),
        sucursal_id: s.id,
        cantidad: i === 0 ? n % 9 : n % 3 ? n % 5 : 0,
        ubicacion: i === 0 ? `demo ${"ABCD"[n % 4]}-${(n % 40) + 1}` : "demo",
        actualizado: ahora,
      }
    }))
}

export const reservaVigente = (r: ReservaMock, ahora = Date.now()) => !r.liberada && new Date(r.vence).getTime() > ahora
export const estadoReserva = (r: ReservaMock) => (r.liberada ? "liberada" : reservaVigente(r) ? "vigente" : "vencida")
