import { apiClient } from '@/lib/api-client'
import type { Cotizacion } from '@/lib/api-types'
import type { EnvioWhatsApp } from '@/lib/api/cotizaciones'
import type { VehiculoConversacion } from '@/lib/api/conversaciones'

export interface VehiculoCaso extends VehiculoConversacion {
  conversation_id?: string | null
  chasis?: string | null
  version?: string | null
  carroceria?: string | null
  traccion?: string | null
  transmision?: string | null
  combustible?: string | null
  fuente_identificacion?: string | null
  verificado?: boolean | null
  confirmado_por_cliente?: boolean | null
}

export const FUENTE_IDENTIFICACION: Record<string, string> = {
  vin: 'VIN',
  vin_vpic: 'VIN',
  chasis: 'Chasis',
  plaquita: 'Plaquita del motor',
  numero_pieza: 'Número de la pieza vieja',
  descripcion: 'Lo describió el cliente',
  cliente: 'Lo describió el cliente',
  foto: 'Foto del documento',
  vendedor: 'Corregido por un vendedor',
  panel: 'Registrado en el panel',
}

export const fuenteTexto = (fuente?: string | null) =>
  fuente ? FUENTE_IDENTIFICACION[fuente] ?? fuente.replace(/_/g, ' ') : ''

export const CALIDAD: Record<string, string> = {
  original: 'Original',
  oem: 'OEM',
  alterna: 'Alterna',
  economica: 'Económica',
}

export const calidadTexto = (calidad?: string | null) => (calidad ? CALIDAD[calidad] ?? calidad : '')

export const esPiezaDemo = (p: { sku?: string | null; nombre?: string | null; demo?: boolean | null }) =>
  !!p.demo || /^DEMO-/i.test(p.sku ?? '') || /^DEMO-/i.test(p.nombre ?? '')

export const skuParaVendedor = (sku?: string | null, otroDato?: string | null) =>
  sku && /^CC9/i.test(sku) && otroDato?.trim() ? null : sku ?? null

export const vehiculoCorto = (v: { marca?: string | null; modelo?: string | null; anio?: number | null }) =>
  [v.marca, v.modelo, v.anio].filter(Boolean).join(' ')

export interface OpcionBrief {
  numero: number | null
  product_id: string | null
  sku: string | null
  nombre: string
  calidad: string | null
  precio_dop: number | null
  cantidad: number | null
  sucursales: string[]
}

export interface PiezaBrief {
  nombre: string
  posicion: string | null
  lado: string | null
  cantidad: number | null
}

export interface BriefPase {
  motivo: string | null
  motivo_texto: string | null
  desde: string | null
  resumen: string | null
  detalle: string | null
  cotizacion: { codigo: string; version?: number; estado?: string; total_dop?: number; vence?: string } | null
  compra_anterior: { tipo: 'orden' | 'cotizacion'; codigo: string | null; fecha: string | null; piezas: string[]; total_dop: number | null } | null
  nombre: string | null
  vehiculo: (Partial<VehiculoCaso> & { texto: string }) | null
  piezas: PiezaBrief[]
  opciones: OpcionBrief[]
  falta: string[]
  ultima_pregunta: string | null
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const numero = (v: unknown): number | null => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v))
const lista = (v: unknown): any[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : [])

// El brief lo arma el backend con reglas (contrato/conversaciones.md, P0-21); aquí solo se ordena para mostrarlo.
export function normalizarBrief(brief: unknown, motivo?: string | null, desde?: string | null): BriefPase | null {
  const b = brief && typeof brief === 'object' ? (brief as Record<string, any>) : null
  if (!b && !motivo) return null
  const v = b?.vehiculo && typeof b.vehiculo === 'object' ? b.vehiculo : null
  const cliente = b?.cliente && typeof b.cliente === 'object' ? b.cliente : null
  return {
    motivo: texto(b?.motivo) ?? motivo ?? null,
    motivo_texto: texto(b?.motivo_texto),
    desde: texto(b?.esperando_desde) ?? texto(b?.desde) ?? desde ?? null,
    resumen: texto(b?.resumen),
    detalle: texto(b?.detalle),
    cotizacion: b?.cotizacion && typeof b.cotizacion === 'object' && texto(b.cotizacion.codigo) ? b.cotizacion : null,
    compra_anterior: b?.compra_anterior && typeof b.compra_anterior === 'object' ? {
      tipo: b.compra_anterior.tipo === 'orden' ? 'orden' : 'cotizacion',
      codigo: texto(b.compra_anterior.codigo),
      fecha: texto(b.compra_anterior.fecha),
      piezas: lista(b.compra_anterior.piezas).map(texto).filter((x): x is string => !!x),
      total_dop: numero(b.compra_anterior.total_dop),
    } : null,
    nombre: texto(b?.nombre) ?? texto(cliente?.nombre),
    vehiculo: v ? { ...v, texto: texto(v.texto) ?? vehiculoCorto(v) } : null,
    piezas: lista(b?.piezas ?? b?.pieza).map((p) => ({
      nombre: texto(p?.nombre) ?? texto(p?.pieza) ?? '',
      posicion: texto(p?.posicion),
      lado: texto(p?.lado),
      cantidad: numero(p?.cantidad),
    })).filter((p) => p.nombre),
    opciones: lista(b?.opciones ?? b?.opciones_mostradas).map((o, i) => ({
      numero: numero(o?.numero) ?? i + 1,
      product_id: o?.product_id != null ? String(o.product_id) : null,
      sku: texto(o?.sku),
      nombre: texto(o?.nombre) ?? '',
      calidad: texto(o?.calidad),
      precio_dop: numero(o?.precio_dop),
      cantidad: numero(o?.cantidad),
      sucursales: lista(o?.sucursales).map((x) => texto(typeof x === 'string' ? x : x?.sucursal ?? x?.nombre)).filter((x): x is string => !!x),
    })).filter((o) => o.nombre || o.sku),
    falta: lista(b?.falta ?? b?.lo_que_falta).map(texto).filter((x): x is string => !!x),
    ultima_pregunta: texto(b?.ultima_pregunta),
  }
}

export const LADO: Record<string, string> = {
  izquierdo: 'izquierdo', derecho: 'derecho', ambos: 'los dos lados', lh: 'izquierdo', rh: 'derecho',
}

export { MOTIVOS_CORRECCION, motivoCorreccionTexto, plantillaCorreccion, plantillaRechazo } from './plantillas'

export interface ExistenciaSucursal {
  sucursal_id?: string
  sucursal: string
  cantidad?: number
  reservado?: number
  disponible: number
  ubicacion?: string | null
}

export interface FichaPieza {
  id: string | number
  sku?: string | null
  nombre: string
  mpn?: string | null
  calidad?: string | null
  precio_dop: number
  disponible: boolean
  imagen?: string | null
  existencia?: ExistenciaSucursal[]
  existencias?: ExistenciaSucursal[]
  demo?: boolean
}

export interface VehiculoEditable {
  marca: string
  modelo: string
  anio: number | null
  motor: string | null
  version: string | null
  carroceria: string | null
  traccion: string | null
  vin: string | null
  chasis: string | null
}

export interface ModeloCatalogo {
  marca: string
  modelo: string
  desde?: number | null
  hasta?: number | null
  motores?: (string | { motor?: string | null })[]
}

export const casoApi = {
  corregirVehiculo: (id: string, datos: VehiculoEditable) =>
    apiClient.request<VehiculoCaso>(`/vehiculos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...datos, fuente_identificacion: 'vendedor' }),
    }),
  registrarVehiculo: (conversationId: string, datos: VehiculoEditable) =>
    apiClient.post<VehiculoCaso>('/vehiculos', { ...datos, conversation_id: conversationId, fuente_identificacion: 'vendedor' }),
  modelos: () => apiClient.get<ModeloCatalogo[]>('/piezas/vehiculos'),
  ficha: (id: string | number) => apiClient.get<FichaPieza>(`/piezas/${encodeURIComponent(String(id))}`),
  rechazar: (codigo: string, datos: { motivo: string; nota?: string; avisar_cliente: boolean }) =>
    apiClient.post<Cotizacion & { mensaje: EnvioWhatsApp | null }>(`/cotizaciones/${encodeURIComponent(codigo)}/rechazar`, datos),
  corregir: (codigo: string, datos: { items: { pieza_id: string; cantidad: number; precio_dop?: number }[]; motivo: string; nota?: string }) =>
    apiClient.post<Cotizacion & { mensaje: EnvioWhatsApp | null }>(`/cotizaciones/${encodeURIComponent(codigo)}/corregir`, datos),
}
