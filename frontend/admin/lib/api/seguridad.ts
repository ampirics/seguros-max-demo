import { apiClient } from '@/lib/api-client'

export type NivelSeguridad = 'normal' | 'sospechoso' | 'bloqueado'
export type TipoEventoSeguridad = 'alerta' | 'sospechoso' | 'bloqueo' | 'desbloqueo' | 'vencido' | 'lista_blanca'

export interface SeguridadCliente {
  nivel: NivelSeguridad
  puntaje: number
  senales: string[]
  alerta?: boolean
  lista_blanca?: boolean
  lista_blanca_motivo?: string | null
  bloqueo_vence?: string | null
}

export interface ClienteEnRiesgo extends SeguridadCliente {
  id: string
  nombre: string
  telefono: string | null
  tipo: string
  bloqueado_at: string | null
  bloqueo_motivo: string | null
  ultima_consulta: string | null
  conversacion_id: string | null
}

export interface EventoSeguridad {
  id: string
  tipo: TipoEventoSeguridad
  cliente_id: string
  cliente: string
  nivel: string | null
  puntaje: number | null
  senales: string[]
  motivo: string | null
  usuario: string | null
  automatico: boolean
  fecha: string | null
}

export interface ConfigSeguridad {
  activo: boolean
  consultas_dia: number
  consultas_semana: number
  vehiculos_distintos: number
  cotizaciones_sin_compra: number
  puntaje_sospechoso: number
  accion: 'avisar' | 'sin_precios' | 'bloquear'
  duracion_dias: number
  mensaje_bloqueado: string
}

export const NIVELES: Record<NivelSeguridad, { texto: string; clase: string }> = {
  normal: { texto: 'Normal', clase: 'bg-secondary text-foreground' },
  sospechoso: { texto: 'Sospechoso', clase: 'bg-warning-soft text-warning' },
  bloqueado: { texto: 'Bloqueado', clase: 'bg-destructive-soft text-destructive' },
}

export const EVENTOS: Record<TipoEventoSeguridad, string> = {
  alerta: 'Alerta',
  sospechoso: 'Sospechoso',
  bloqueo: 'Bloqueo',
  desbloqueo: 'Desbloqueo',
  vencido: 'Bloqueo vencido',
  lista_blanca: 'Lista blanca',
}

export const seguridadApi = {
  clientes: (params?: { nivel?: NivelSeguridad; limite?: number }) =>
    apiClient.get<{ resumen: { sospechosos: number; bloqueados: number; alertas_7d: number; lista_blanca: number }; items: ClienteEnRiesgo[] }>(
      '/seguridad/clientes', params),
  eventos: (params?: { tipo?: string; cliente_id?: string; limite?: number }) =>
    apiClient.get<EventoSeguridad[]>('/seguridad/eventos', params),
}
