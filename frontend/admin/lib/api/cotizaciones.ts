import { apiClient } from '@/lib/api-client'
import { buildApiUrl } from '@/lib/config'
import type { Cotizacion, EstadoCotizacion } from '@/lib/api-types'

export type { Cotizacion, EstadoCotizacion }

export interface LineaCotizacion {
  pieza_id: string
  cantidad: number
  precio_dop?: number
}

export interface EnvioWhatsApp {
  enviada: boolean
  mensaje_id: string | null
  error: string | null
}

const base = (codigo: string) => `/cotizaciones/${encodeURIComponent(codigo)}`

export const cotizacionesApi = {
  listar: (params?: { estado?: string; conversation_id?: string; cliente_id?: string; desde?: string; hasta?: string; ocultar_cerradas?: boolean; limit?: number }) =>
    apiClient.get<{ items: Cotizacion[] }>('/cotizaciones', params).then((r) => r.items ?? []),
  obtener: (codigo: string, version?: number | null) =>
    apiClient.get<Cotizacion>(base(codigo), version ? { version } : undefined),
  crear: (datos: { items: LineaCotizacion[]; conversation_id?: string | null; cliente_id?: string | null; vehiculo?: string | null; vehiculo_id?: string | null; lead_id?: string | null }) =>
    apiClient.post<Cotizacion>('/cotizaciones', datos),
  nuevaVersion: (codigo: string, items: LineaCotizacion[], vehiculo?: string | null) =>
    apiClient.put<Cotizacion>(base(codigo), { items, vehiculo: vehiculo || undefined }),
  enviarWhatsApp: (codigo: string) => apiClient.post<EnvioWhatsApp>(`${base(codigo)}/enviar-whatsapp`),
  validar: (codigo: string) => apiClient.post<Cotizacion & { mensaje: EnvioWhatsApp | null }>(`${base(codigo)}/validar`),
  cambiarEstado: (codigo: string, estado: 'aceptada' | 'rechazada') =>
    apiClient.post<Cotizacion>(`${base(codigo)}/estado`, { estado }),
  convertirEnOrden: (codigo: string) =>
    apiClient.post<{ orden_id: string; numero: string }>(`${base(codigo)}/convertir-en-orden`),
  async descargarPdf(codigo: string, version?: number | null) {
    const url = buildApiUrl(`${base(codigo)}/pdf${version ? `?version=${version}` : ''}`)
    const headers: Record<string, string> = {}
    const token = localStorage.getItem('auth_token')
    const empresa = localStorage.getItem('active_company_id')
    if (token) headers.Authorization = `Bearer ${token}`
    if (empresa) headers['X-Company-ID'] = empresa
    const resp = await fetch(url, { headers })
    if (!resp.ok) throw new Error(`No se pudo descargar el PDF (HTTP ${resp.status})`)
    const blob = await resp.blob()
    const enlace = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = enlace
    a.download = `${codigo}${version ? `-v${version}` : ''}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(enlace), 1000)
  },
}

export const clienteTexto = (c: Pick<Cotizacion, 'cliente'>) =>
  c.cliente?.nombre || (c.cliente?.telefono ? `+${c.cliente.telefono.replace(/^\+/, '')}` : 'Cliente sin nombre')
