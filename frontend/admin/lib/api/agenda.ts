import type { Cita, EstadoCita } from '@/lib/api-types'

type CitaApi = Partial<Cita> & {
  id: string
  tipo: Cita['tipo']
  estado: string
  inicio: string
  fin: string
  vendedor_id: string
  cliente_telefono?: string | null
  conversation_id?: string | null
  notas?: string | null
}

export const estadoCita = (estado: string): EstadoCita => (estado === 'confirmada' ? 'programada' : (estado as EstadoCita))

export const estadoApi = (estado: EstadoCita) => (estado === 'programada' ? 'confirmada' : estado)

export function aCita(c: CitaApi): Cita {
  const conversacion = c.conversacion_id ?? c.conversation_id ?? null
  return {
    id: c.id,
    tipo: c.tipo,
    estado: estadoCita(c.estado),
    cliente: c.cliente ?? c.cliente_telefono ?? null,
    cliente_id: c.cliente_id ?? null,
    telefono: c.telefono ?? c.cliente_telefono ?? null,
    vendedor_id: c.vendedor_id,
    vendedor: c.vendedor ?? null,
    sucursal: c.sucursal ?? null,
    motivo: c.motivo ?? c.notas ?? null,
    origen: c.origen ?? 'panel',
    inicio: c.inicio,
    fin: c.fin,
    conversacion_id: conversacion,
    lead_id: c.lead_id ?? conversacion,
    vehiculo_id: c.vehiculo_id ?? null,
    google_event_id: c.google_event_id ?? null,
    google_error: c.google_error ?? null,
    recordatorio_enviado: !!c.recordatorio_enviado,
    recordatorio_error: c.recordatorio_error ?? null,
    sucursal_id: c.sucursal_id ?? null,
    llego_at: c.llego_at ?? null,
    cotizacion_codigo: c.cotizacion_codigo ?? null,
    order_id: c.order_id ?? null,
  }
}

export const fechaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
