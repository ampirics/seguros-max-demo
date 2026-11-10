import { apiClient } from '@/lib/api-client'

export interface NoEntendida {
  texto: string
  ejemplo: string
  veces: number
  ultima: string | null
  vehiculos: string[]
}

export interface Sinonimo {
  id: string
  palabra: string
  significa: string
  pieza_id: string | null
  estado: 'propuesto' | 'aprobado' | 'ignorado'
  veces: number
  creado_por: string | null
  aprobado_por: string | null
  aprobado_en: string | null
  creado: string | null
}

export type EstadoPropuesta = 'propuesto' | 'aprobado' | 'rechazado' | 'revisar'

export interface PropuestaFaq {
  pregunta: string
  respuesta: string
}

export interface PropuestaCompatibilidad {
  pieza_id: string
  pieza: string
  sku: string | null
  marca: string
  modelo: string
  anio: number | null
  motor: string | null
  ventas: number
  devoluciones: number
}

export interface Propuesta {
  id: string
  tipo: 'faq' | 'compatibilidad'
  estado: EstadoPropuesta
  datos: PropuestaFaq | PropuestaCompatibilidad
  veces: number
  nota: string | null
  revisado_por: string | null
  revisado_en: string | null
  resultado_id: string | null
  creado: string | null
  actualizado: string | null
}

export const memoriaApi = {
  noEntendidas: (dias = 30) => apiClient.get<NoEntendida[]>('/memoria/no-entendidas', { dias }),
  ignorar: (texto: string) => apiClient.post<Sinonimo>('/memoria/no-entendidas/ignorar', { texto }),
  sinonimos: (estado?: Sinonimo['estado']) => apiClient.get<Sinonimo[]>('/memoria/sinonimos', estado ? { estado } : undefined),
  guardarSinonimo: (datos: { palabra: string; significa?: string; pieza_id?: string; aprobar?: boolean }) =>
    apiClient.post<Sinonimo>('/memoria/sinonimos', datos),
  aprobarSinonimo: (id: string) => apiClient.post<Sinonimo>(`/memoria/sinonimos/${id}/aprobar`),
  eliminarSinonimo: (id: string) => apiClient.delete<{ ok: boolean }>(`/memoria/sinonimos/${id}`),
  propuestas: (tipo: Propuesta['tipo'], estado?: string) =>
    apiClient.get<Propuesta[]>('/memoria/propuestas', estado ? { tipo, estado } : { tipo }),
  generar: () => apiClient.post<{ faq: number; compatibilidades: number }>('/memoria/propuestas/generar'),
  aprobar: (id: string, datos?: { pregunta?: string; respuesta?: string; nota?: string }) =>
    apiClient.post<Propuesta>(`/memoria/propuestas/${id}/aprobar`, datos ?? {}),
  rechazar: (id: string, nota?: string) => apiClient.post<Propuesta>(`/memoria/propuestas/${id}/rechazar`, { nota }),
}
