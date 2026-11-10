import type { EventoCronograma, PlanMantenimientoItem, VehiculoCliente } from '@/lib/api-types'
import { urlImagen } from './piezas'

type VehiculoApi = Partial<VehiculoCliente> & { id: string; conversation_id?: string | null }

export const aVehiculo = (v: VehiculoApi): VehiculoCliente => ({
  id: v.id,
  cliente_id: v.cliente_id ?? null,
  cliente: v.cliente ?? null,
  cliente_telefono: v.cliente_telefono ?? null,
  marca: v.marca ?? null,
  modelo: v.modelo ?? null,
  anio: v.anio ?? null,
  motor: v.motor ?? null,
  vin: v.vin ?? null,
  placa: v.placa ?? null,
  kilometraje: v.kilometraje ?? null,
  atenciones: v.atenciones ?? 0,
  ultima_atencion: v.ultima_atencion ?? null,
  conversacion_id: v.conversacion_id ?? v.conversation_id ?? null,
})

type PlanApi = Omit<Partial<PlanMantenimientoItem>, 'pieza'> & {
  descripcion: string
  cuando: string
  prioridad: PlanMantenimientoItem['prioridad']
  pieza?: PlanMantenimientoItem['pieza'] | string | null
  precio_dop?: number | null
  imagen?: string | null
  disponible?: boolean | null
}

export function aPlan(p: PlanApi, i: number): PlanMantenimientoItem {
  const pieza = typeof p.pieza === 'string'
    ? p.pieza_id ? { id: String(p.pieza_id), nombre: p.pieza, precio_dop: p.precio_dop ?? 0, disponible: p.disponible ?? true, imagen: urlImagen(p.imagen) } : null
    : p.pieza ? { ...p.pieza, id: String(p.pieza.id), imagen: urlImagen(p.pieza.imagen) } : null
  return {
    clave: p.clave ?? `${i}-${p.descripcion}`,
    descripcion: p.descripcion,
    cada_km: p.cada_km ?? 0,
    ultimo_km: p.ultimo_km ?? null,
    proximo_km: p.proximo_km ?? null,
    cuando: p.cuando,
    prioridad: p.prioridad,
    pieza_id: p.pieza_id != null ? String(p.pieza_id) : null,
    pieza,
  }
}

export const aEvento = (e: EventoCronograma & { conversation_id?: string | null }): EventoCronograma => ({
  ...e,
  conversacion_id: e.conversacion_id ?? e.conversation_id ?? null,
})

export const nombreVehiculo = (v: Pick<VehiculoCliente, 'marca' | 'modelo' | 'anio'>) =>
  [v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || 'Vehículo sin datos'
