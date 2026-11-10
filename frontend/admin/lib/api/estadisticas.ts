import { apiClient } from '@/lib/api-client'
import { buildApiUrl } from '@/lib/config'

export type VistaEstadistica =
  | 'mas_vendidos' | 'se_acaba' | 'sugerencia_compra' | 'inventario_parado' | 'mas_consultados' | 'no_hay'
  | 'cotizado_sin_venta' | 'vehiculos' | 'picos' | 'descuentos' | 'clientes'

export interface FiltrosEstadisticas {
  desde: string
  hasta: string
  sucursal_id?: string
  marca?: string
  modelo?: string
}

export interface PiezaFila {
  pieza_id: string | null
  nombre: string
  sku: string | null
}

export interface ResumenEstadisticas {
  consultas: number
  sin_resultado: number
  pidieron_descuento: number
  unidades_vendidas: number
  monto_vendido_dop: number
  costo_ia_usd: number
  latencia_mediana_ms: number | null
  conversaciones?: number
  resueltas_sin_vendedor?: number
  con_pase?: number
  con_vendedor?: number
  sin_cerrar?: number
  costo_por_conversacion_usd?: number | null
  conversaciones_con_costo?: number
}

export interface Picos {
  matriz: number[][]
  dias: string[]
  por_dia: number[]
  por_hora: number[]
  total: number
  pico: { dia: string; hora: number; mensajes: number } | null
}

export interface ClienteFila {
  cliente_id: string
  nombre: string
  telefono: string | null
  compras: number
  total_dop: number
  ticket_promedio_dop: number
  ultima_compra: string | null
  primera_compra: string | null
  dias_sin_comprar: number | null
}

export interface Clientes {
  mejores: ClienteFila[]
  inactivos: ClienteFila[]
  dias_inactivo: number
  clientes_con_compras: number
  recurrentes: number
}

export interface Alertas {
  activo: boolean
  dias_se_acaba: number
  veces_no_hay: number
  ventana_dias: number
}

export type Fila = Record<string, any>

const limpiar = (f: FiltrosEstadisticas, extra?: Record<string, unknown>) =>
  Object.fromEntries(Object.entries({ ...f, ...extra }).filter(([, v]) => v !== undefined && v !== '' && v !== null))

const cabeceras = () => {
  const headers: Record<string, string> = {}
  const token = localStorage.getItem('auth_token')
  const empresa = localStorage.getItem('active_company_id')
  if (token) headers.Authorization = `Bearer ${token}`
  if (empresa) headers['X-Company-ID'] = empresa
  return headers
}

export const estadisticasApi = {
  resumen: (f: FiltrosEstadisticas) => apiClient.get<ResumenEstadisticas>('/estadisticas/resumen', limpiar(f)),
  vista: <T = { items: Fila[] }>(vista: VistaEstadistica, f: FiltrosEstadisticas, extra?: Record<string, unknown>) =>
    apiClient.get<T>(`/estadisticas/${vista}`, limpiar(f, extra)),
  alertas: () => apiClient.get<Alertas>('/estadisticas/alertas'),
  guardarAlertas: (datos: Partial<Alertas>) => apiClient.put<Alertas>('/estadisticas/alertas', datos),
  revisarAlertas: () => apiClient.post<{ se_acaba: number; pedida_sin_existencia: number }>('/estadisticas/alertas/revisar'),
  async excel(vista: VistaEstadistica, f: FiltrosEstadisticas, extra?: Record<string, unknown>) {
    const query = new URLSearchParams({ ...(limpiar(f, extra) as Record<string, string>), formato: 'xlsx' })
    const resp = await fetch(buildApiUrl(`/estadisticas/${vista}?${query}`), { headers: cabeceras() })
    if (!resp.ok) throw new Error(`No se pudo exportar (HTTP ${resp.status})`)
    const enlace = URL.createObjectURL(await resp.blob())
    const a = document.createElement('a')
    a.href = enlace
    a.download = `${vista}-${f.desde}-${f.hasta}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(enlace), 1000)
  },
  plantillas: () =>
    apiClient.get<{ templates: { name: string; body: string }[] }>('/admin/campaigns/templates').then((r) => r.templates ?? []),
  crearCampana: (nombre: string, plantilla: string, clientes: string[]) =>
    apiClient.post<{ id: string }>('/admin/campaigns', {
      name: nombre,
      template_name: plantilla,
      language_code: 'es',
      segment_definition: { customer_ids: clientes, has_ordered: true },
    }),
}
