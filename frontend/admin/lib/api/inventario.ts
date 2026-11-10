import { apiClient } from '@/lib/api-client'
import { buildApiUrl } from '@/lib/config'

export interface Sucursal {
  id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  horario: string | null
  activa?: boolean
  almacen_sap?: string | null
}

export interface ExistenciaSucursal {
  sucursal_id: string
  sucursal: string
  cantidad: number
  reservado: number
  disponible: number
  ubicacion: string | null
  actualizado: string | null
  minimo?: number | null
  bajo_minimo?: boolean
}

export interface ExistenciaFila extends ExistenciaSucursal {
  pieza_id: string
  sku: string | null
  nombre: string
  sucursal_activa: boolean
}

export type TipoMovimiento = 'entrada' | 'venta' | 'ajuste' | 'traslado' | 'reserva' | 'liberacion'

export interface Movimiento {
  id: string
  pieza_id: string
  pieza: string | null
  sucursal_id: string
  sucursal: string | null
  tipo: TipoMovimiento
  cantidad: number
  resultante: number | null
  motivo: string | null
  referencia: string | null
  usuario: string | null
  fecha: string
}

export type EstadoReserva = 'vigente' | 'vencida' | 'liberada' | 'vendida'

export interface Reserva {
  id: string
  pieza_id: string
  pieza: string
  sku: string | null
  sucursal_id: string
  sucursal: string
  ubicacion: string | null
  cantidad: number
  vence: string
  estado: EstadoReserva
  conversation_id: string | null
  cotizacion_codigo?: string | null
  hasta_la_venta?: boolean
  order_id?: string | null
  creada: string | null
  liberada: string | null
  creada_por: string | null
}

export interface FilaImportacion {
  fila: number
  sku: string | null
  sucursal: string | null
  pieza_id: string | null
  pieza: string | null
  sucursal_id: string | null
  cantidad: number | null
  ubicacion: string | null
  minimo?: number | null
  actual: number | null
  diferencia: number | null
  accion: 'nueva' | 'cambio' | 'sin_cambio' | 'error'
  errores: string[]
}

export interface ResultadoImportacion {
  filas: FilaImportacion[]
  total: number
  errores: number
  cambios: number
  sin_cambio: number
  aplicado: boolean
}

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  venta: 'Venta',
  ajuste: 'Ajuste',
  traslado: 'Traslado',
  reserva: 'Reserva',
  liberacion: 'Liberación',
}

export interface CambioSap {
  pieza_id: string
  pieza: string
  sku: string
  sucursal_id: string
  sucursal: string
  almacen: string
  actual: number | null
  cantidad: number
}

export interface EstadoSap {
  conexion: boolean
  mensaje: string | null
  activo: boolean
  intervalo_minutos: number
  proxima: string | null
  ultima_ejecucion: string | null
  ultimo_estado: string | null
  ultimo_error: string | null
  almacenes: { sucursal_id: string; sucursal: string; activa: boolean; almacen_sap: string | null }[]
}

export interface ResultadoSap {
  cambios: CambioSap[]
  sin_cambio: number
  skus_no_encontrados: string[]
  almacenes_sin_sucursal: string[]
  items_leidos: number
  aplicado: boolean
}

const patch = <T,>(endpoint: string, datos: unknown) =>
  apiClient.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(datos), headers: { 'Content-Type': 'application/json' } })

const cabeceras = () => {
  const headers: Record<string, string> = {}
  const token = localStorage.getItem('auth_token')
  const empresa = localStorage.getItem('active_company_id')
  if (token) headers.Authorization = `Bearer ${token}`
  if (empresa) headers['X-Company-ID'] = empresa
  return headers
}

export const inventarioApi = {
  sucursales: (todas = false) => apiClient.get<Sucursal[]>('/sucursales', todas ? { todas: true } : undefined),
  crearSucursal: (datos: Partial<Sucursal>) => apiClient.post<Sucursal>('/sucursales', datos),
  actualizarSucursal: (id: string, datos: Partial<Sucursal>) => patch<Sucursal>(`/sucursales/${id}`, datos),

  existencias: (params: { q?: string; sucursal_id?: string; pieza_id?: string; solo_con_existencia?: boolean; bajo_minimo?: boolean; limit?: number; skip?: number }) =>
    apiClient.get<{ total: number; items: ExistenciaFila[] }>('/inventario/existencias', params),
  definirMinimo: (datos: { pieza_id: string; sucursal_id: string; minimo: number | null }) =>
    patch<ExistenciaFila>('/inventario/existencias/minimo', datos),
  movimientos: (params: { pieza_id?: string; sucursal_id?: string; limit?: number }) =>
    apiClient.get<{ items: Movimiento[] }>('/inventario/movimientos', params).then((r) => r.items ?? []),
  registrarMovimiento: (datos: { pieza_id: string; sucursal_id: string; tipo: 'entrada' | 'venta' | 'ajuste' | 'traslado'; cantidad: number; motivo?: string; ubicacion?: string; destino_id?: string }) =>
    apiClient.post<{ items: Movimiento[] }>('/inventario/movimientos', datos),

  sap: () => apiClient.get<EstadoSap>('/inventario/sap'),
  configurarSap: (datos: { activo?: boolean; intervalo_minutos?: number; almacenes?: Record<string, string | null> }) =>
    apiClient.request<EstadoSap>('/inventario/sap', { method: 'PUT', body: JSON.stringify(datos), headers: { 'Content-Type': 'application/json' } }),
  sincronizarSap: (aplicar: boolean) => apiClient.post<ResultadoSap>('/inventario/sap/sincronizar', { aplicar }),

  reservas: (params: { estado?: EstadoReserva | 'todas'; pieza_id?: string; sucursal_id?: string; limit?: number }) =>
    apiClient.get<{ items: Reserva[] }>('/inventario/reservas', params).then((r) => r.items ?? []),
  reservar: (datos: { pieza_id: string; cantidad?: number; sucursal_id?: string; horas?: number; conversation_id?: string | null; lead_id?: string | null }) =>
    apiClient.post<Reserva>('/inventario/reservas', datos),
  liberar: (id: string) => apiClient.delete<Reserva>(`/inventario/reservas/${id}`),

  importar: (archivo: File, aplicar: boolean) => {
    const datos = new FormData()
    datos.append('archivo', archivo)
    return apiClient.request<ResultadoImportacion>(`/inventario/importar${aplicar ? '?aplicar=true' : ''}`, { method: 'POST', body: datos })
  },
  async exportar(sucursal_id?: string, formato: 'csv' | 'xlsx' = 'csv') {
    const query = new URLSearchParams({ formato, ...(sucursal_id ? { sucursal_id } : {}) })
    const url = buildApiUrl(`/inventario/exportar?${query}`)
    const resp = await fetch(url, { headers: cabeceras() })
    if (!resp.ok) throw new Error(`No se pudo exportar (HTTP ${resp.status})`)
    const enlace = URL.createObjectURL(await resp.blob())
    const a = document.createElement('a')
    a.href = enlace
    a.download = `existencias.${formato}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(enlace), 1000)
  },
}

export const unidades = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`
