import type { ChatMessage, ConversationMgmtStatus } from '@/lib/api-types'

// Tolera null, vacío y fechas inválidas: devuelve la época como centinela para que ordenar y formatear no fallen.
export const parseUTCTimestamp = (timestamp: string | Date | null | undefined): Date => {
  if (timestamp === null || timestamp === undefined || timestamp === '') return new Date(0)
  if (typeof timestamp === 'string') {
    const hasTimezone = timestamp.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(timestamp)
    const result = hasTimezone ? new Date(timestamp) : new Date(timestamp + 'Z')
    return isNaN(result.getTime()) ? new Date(0) : result
  }
  return isNaN(timestamp.getTime()) ? new Date(0) : timestamp
}

export const iniciales = (nombre?: string | null) =>
  (nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

// Hora como en WhatsApp: 10:32 hoy, "Ayer", o la fecha corta.
export const horaCorta = (d: Date) => {
  const hoy = new Date()
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' })
}

export const esperaTexto = (desde: string | null | undefined, ahora = Date.now()) => {
  if (!desde) return ''
  const t = parseUTCTimestamp(desde).getTime()
  if (!t) return ''
  const min = Math.max(0, Math.floor((ahora - t) / 60000))
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'día' : 'días'}`
}

// Quién atiende: la IA, nadie (el cliente pidió un vendedor), un vendedor, o ya se cerró.
export type EstadoAtencion = 'ia' | 'esperando_vendedor' | 'vendedor' | 'cerrada'
export const ESTADO_ATENCION: Record<EstadoAtencion, { label: string; punto: string }> = {
  ia: { label: 'IA atendiendo', punto: 'bg-success' },
  esperando_vendedor: { label: 'Esperando vendedor', punto: 'bg-warning' },
  vendedor: { label: 'Con vendedor', punto: 'bg-primary' },
  cerrada: { label: 'Cerrada', punto: 'bg-muted-foreground/50' },
}
const ATENCION_RESTAURANTE: Record<EstadoAtencion, string> = { ia: 'IA atendiendo', esperando_vendedor: 'Espera al equipo', vendedor: 'Con el equipo', cerrada: 'Cerrada' }
const ATENCION_SEGUROS: Record<EstadoAtencion, string> = { ia: 'IA atendiendo', esperando_vendedor: 'Espera al ejecutivo', vendedor: 'Con el ejecutivo', cerrada: 'Cerrada' }
export const etiquetaAtencion = (estado: EstadoAtencion, vertical: 'repuestos' | 'restaurante' | 'seguros') =>
  vertical === 'restaurante' ? ATENCION_RESTAURANTE[estado] : vertical === 'seguros' ? ATENCION_SEGUROS[estado] : ESTADO_ATENCION[estado].label
// Sin estado_atencion (backend MG): se deduce de los campos que ya existen.
export const estadoAtencion = (c: { estado_atencion?: string | null; status?: string; assigned_to_id?: string | null; agent_requested?: boolean }): EstadoAtencion =>
  (c.estado_atencion as EstadoAtencion) ||
  (c.status === 'closed' ? 'cerrada' : c.assigned_to_id ? 'vendedor' : c.agent_requested ? 'esperando_vendedor' : 'ia')

export const RESULTADO: Record<string, string> = {
  cotizada: 'Cotizada',
  cita_agendada: 'Cita agendada',
  sin_existencia: 'Sin existencia',
}

export const MOTIVO_PASE: Record<string, string> = {
  pide_persona: 'Pide hablar con una persona',
  pide_llamada: 'Pide que lo llamen',
  queja: 'Queja',
  privacidad: 'Pide borrar sus datos',
  pago: 'Pago por confirmar',
  regateo_insiste: 'Insiste en un descuento',
  vehiculo_no_identificado: 'Vehículo no identificado',
  requiere_muestra: 'Requiere la pieza vieja',
  audio_ilegible: 'Audio que no se entendió',
  cotizacion_por_validar: 'Cotización por validar',
  encargo: 'Encargo por confirmar',
  comprobante_fiscal: 'Pide comprobante fiscal',
  pregunta_no_configurada: 'Pregunta sin respuesta configurada',
}

export const MOTIVO_CORTO: Record<string, string> = {
  pide_persona: 'Pide persona',
  pide_llamada: 'Pide llamada',
  queja: 'Queja',
  privacidad: 'Borrar datos',
  pago: 'Pago por confirmar',
  regateo_insiste: 'Pide descuento',
  vehiculo_no_identificado: 'Vehículo sin identificar',
  requiere_muestra: 'Pieza vieja',
  audio_ilegible: 'Audio no claro',
  cotizacion_por_validar: 'Cotización por validar',
  encargo: 'Encargo',
  comprobante_fiscal: 'Comprobante fiscal',
  pregunta_no_configurada: 'Pregunta sin respuesta',
}

export const motivoCorto = (c: Pick<BandejaConversacion, 'motivo_pase' | 'motivo_pase_texto'>) =>
  (c.motivo_pase && MOTIVO_CORTO[c.motivo_pase]) || motivoDe(c)

export const motivoTexto = (motivo?: string | null) => {
  if (!motivo) return ''
  const s = MOTIVO_PASE[motivo] ?? motivo.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface BandejaConversacion {
  id: string
  customer_name: string
  customer_phone: string
  status: string
  conversation_status: ConversationMgmtStatus
  resolved_at?: string | null
  assigned_to_id?: string | null
  assigned_to_name?: string | null
  assigned_at?: string | null
  unread_count: number
  agent_requested?: boolean
  agent_requested_at?: string
  agent_notified?: boolean
  is_favorite?: boolean
  is_pinned?: boolean
  channel?: string | null
  contact_name?: string | null
  customer_display_name?: string | null
  contact_match?: string | null
  estado_atencion?: EstadoAtencion | null
  resultado?: string | null
  vehiculo?: { id: string; marca: string; modelo: string; anio: number; motor: string } | null
  ia_pasos?: string[]
  cotizacion_codigo?: string | null
  etapa?: string | null
  codigo_solicitud?: string | null
  vehiculo_id?: string | null
  last_inbound_at?: string | null
  last_inbound_text?: string | null
  last_message_text?: string | null
  last_message_timestamp?: string | null
  lastMessage?: string
  motivo_pase?: string | null
  motivo_pase_texto?: string | null
  esperando_desde?: string | null
  pase_vencido_at?: string | null
  brief_pase?: unknown
  cliente_id?: string | null
  cliente_telefono?: string | null
  sin_telefono?: boolean
  created_at: string
  updated_at: string
}

export const esperaDesde = (c: BandejaConversacion): string | null => {
  const brief = c.brief_pase as { esperando_desde?: string | null } | null | undefined
  return c.esperando_desde || (brief && typeof brief === 'object' && brief.esperando_desde) || c.agent_requested_at || null
}

// La etiqueta la manda el servidor (motivo_pase_texto); sin motivo, "Espera un vendedor".
export const motivoDe = (c: Pick<BandejaConversacion, 'motivo_pase' | 'motivo_pase_texto'>) =>
  c.motivo_pase_texto || motivoTexto(c.motivo_pase) || 'Espera un vendedor'

// Vista previa: lo último que escribió el cliente; si no se sabe, el último mensaje sin el prefijo técnico del bot.
export const vistaPrevia = (c: BandejaConversacion): string => {
  const cliente = String(c.last_inbound_text || '').trim()
  if (cliente) return cliente
  const raw = String(c.last_message_text || c.lastMessage || '').trim()
  if (!raw) return ''
  if (raw.startsWith('🔄 Estado del admin')) return raw.replace(/^🔄\s*Estado del admin:\s*/, 'Bot: ')
  if (raw.startsWith('🤖')) return 'Bot: ' + raw.replace(/^🤖\s*/, '')
  return raw
}

export const getMessageOrigin = (message: ChatMessage): 'bot' | 'human' => {
  const source = message.metadata?.client_source
  if (source === 'mcp' || source === 'meta') return 'bot'
  if (source === 'web') return 'human'
  if (message.sender === 'bot') return 'bot'
  // El Lambda del bot registra sus respuestas como sender "admin" con prefijo de robot.
  if (message.sender === 'admin' && typeof message.message === 'string' && message.message.startsWith('🤖')) return 'bot'
  return 'human'
}

// client: lo escribió el cliente · bot: respuesta automática · agent: vendedor por WhatsApp
// note: nota interna (el cliente no la ve) · event: cambio de estado del bot · system: cotización, cita, llamada
export type MessageKind = 'client' | 'bot' | 'agent' | 'note' | 'event' | 'system'
const TIPOS_SISTEMA = ['llamada', 'cotizacion', 'cita', 'recordatorio']
export const getMessageKind = (message: ChatMessage): MessageKind => {
  const text = typeof message.message === 'string' ? message.message : ''
  const autor = message.autor ?? message.metadata?.autor
  if (autor === 'cliente' || (message.sender !== 'admin' && message.sender !== 'bot')) return 'client'
  if (text.startsWith('🔄 Estado del admin')) return 'event'
  if (autor === 'sistema' || TIPOS_SISTEMA.includes(message.message_type ?? '')) return 'system'
  if (autor === 'ia' || getMessageOrigin(message) === 'bot') return 'bot'
  const meta: Record<string, any> = message.metadata || {}
  if (meta.nota_interna) return 'note'
  if (autor === 'vendedor' || meta.sent_via_whatsapp !== undefined || meta.integration_method || meta.whatsapp_error || meta.temporary || meta.whatsapp_message_id || message.message_type === 'media') return 'agent'
  return 'note'
}

const CAMPOS_METADATA = ['autor', 'piezas', 'ia_pasos', 'transcripcion', 'transcripcion_estado', 'media_url', 'duracion_seg'] as const
export const normalizarMensaje = (m: any): ChatMessage => {
  const meta = m?.metadata || {}
  const out: any = { ...m, message_type: m.message_type ?? meta.tipo ?? m.type }
  for (const campo of CAMPOS_METADATA) if (out[campo] == null && meta[campo] != null) out[campo] = meta[campo]
  return out as ChatMessage
}

export const ETIQUETA_SISTEMA: Record<string, string> = {
  cotizacion: 'Cotización enviada al cliente',
  cita: 'Confirmación de cita',
  recordatorio: 'Recordatorio de cita',
}

// Estado de entrega de un mensaje saliente. Un envío del vendedor que ORA no entregó llega con sent_via_whatsapp en false.
export type EstadoEntrega = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
export const estadoEntrega = (message: ChatMessage): EstadoEntrega => {
  const meta: Record<string, any> = message.metadata || {}
  if (meta.sending) return 'sending'
  if (meta.envio_fallido) return 'failed'
  if (meta.delivery_status) return meta.delivery_status
  if (meta.whatsapp_error) return 'failed'
  if (meta.sent_via_whatsapp === false && !meta.nota_interna && getMessageKind(message) === 'agent') return 'failed'
  return 'sent'
}

export const motivoFalla = (message: ChatMessage): string | undefined => {
  const meta: Record<string, any> = message.metadata || {}
  const motivo: string | undefined = meta.entrega_error?.motivo ?? meta.whatsapp_error ?? meta.error ?? undefined
  return motivo && /^ORA no respondi/i.test(motivo) ? 'el servicio de mensajes no respondió' : motivo
}
