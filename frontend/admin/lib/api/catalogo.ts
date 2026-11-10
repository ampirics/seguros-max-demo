import { apiClient } from '@/lib/api-client'
import type { Calidad, CompatibilidadExterna, PiezaFicha, PiezaRelacionada, ResultadoExterno, TipoRelacion } from '@/lib/api-types'

export type EstadoCatalogo = 'propuesto' | 'aprobado'

export interface VehiculoDelCatalogo {
  id: string
  marca: string
  modelo: string
  generacion: string | null
  anio_desde: number | null
  anio_hasta: number | null
  motor: string | null
  motor_codigo: string | null
  cilindrada: string | null
  combustible: string | null
  version: string | null
  transmision: string | null
  mercado: string | null
  fuente: 'catalogo' | 'vpic' | 'manual' | 'externa'
  estado: EstadoCatalogo
  propuesto_por: string | null
  aprobado_por: string | null
  aprobado_en: string | null
  piezas?: number
}

export type DatosVehiculo = Partial<Omit<VehiculoDelCatalogo, 'id' | 'fuente' | 'estado' | 'propuesto_por' | 'aprobado_por' | 'aprobado_en' | 'piezas'>>

export interface FuenteExterna {
  fuente: string
  nombre: string
  configurada: boolean
  mensaje: string | null
}

export interface PiezaExterna {
  id: string
  fuente: string
  version: string | null
  fecha: string | null
  referencia: string | null
  estado: 'propuesto' | 'aprobado' | 'rechazado'
  resumen: { numero: string | null; marca: string | null; nombre: string | null; oem: string[]; imagen: string | null; id_fuente: string | null }
  datos: Record<string, unknown>
  revisado_por: string | null
  revisado_en: string | null
  nota: string | null
  pieza_id: string | null
}

export interface FuenteTraer {
  clave: 'simulada' | 'pdf' | 'proveedor'
  nombre: string
  descripcion: string
  necesita_documento: boolean
  disponible: boolean
  motivo: string | null
  vehiculos: CompatibilidadExterna[]
  documentos: { id: string; titulo: string; listo: boolean; motivo: string | null; vehiculos: CompatibilidadExterna[] }[]
}

export interface ResultadoTraer {
  referencia: string
  nuevas: number
  ya_estaban: number
  resumen: { piezas: number; avisos: string[] }
  notas: unknown[]
}

const json = { 'Content-Type': 'application/json' }
const patch = <T,>(endpoint: string, datos: unknown) =>
  apiClient.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(datos), headers: json })

export const FUENTES: Record<VehiculoDelCatalogo['fuente'], string> = {
  catalogo: 'Catálogo de la tienda',
  vpic: 'NHTSA vPIC',
  manual: 'Agregado en el panel',
  externa: 'Base externa',
}

export const TIPOS_RELACION: Record<TipoRelacion, string> = {
  reemplaza: 'Reemplaza a',
  reemplazada_por: 'Reemplazada por',
  kit: 'Va en kit con',
  lado_opuesto: 'Lado opuesto',
  equivalente: 'Equivale a',
}

export const catalogoApi = {
  vehiculos: (params: { marca?: string; modelo?: string; estado?: EstadoCatalogo; fuente?: string; q?: string; limit?: number; skip?: number }) =>
    apiClient.get<{ total: number; marcas: string[]; items: VehiculoDelCatalogo[] }>('/vehiculos-catalogo', params),
  crearVehiculo: (datos: DatosVehiculo) => apiClient.post<VehiculoDelCatalogo>('/vehiculos-catalogo', datos),
  actualizarVehiculo: (id: string, datos: DatosVehiculo) => patch<VehiculoDelCatalogo>(`/vehiculos-catalogo/${id}`, datos),
  aprobarVehiculo: (id: string) => apiClient.post<VehiculoDelCatalogo>(`/vehiculos-catalogo/${id}/aprobar`),
  eliminarVehiculo: (id: string) => apiClient.delete<{ ok: boolean }>(`/vehiculos-catalogo/${id}`),
  completarVpic: (marca: string, anio: number) =>
    apiClient.post<{ marca: string; anio: number; propuestos: string[]; ya_estaban: string[] }>('/vehiculos-catalogo/vpic', { marca, anio }),

  cambiarCalidad: (piezaId: string, calidad: Calidad) => patch<PiezaFicha>(`/piezas/${piezaId}`, { calidad }),
  relacionar: (piezaId: string, datos: { tipo: Exclude<TipoRelacion, 'reemplazada_por'>; relacionada_id?: string; numero?: string; nota?: string }) =>
    apiClient.post<{ relacionadas: PiezaRelacionada[] }>(`/piezas/${piezaId}/relaciones`, datos),
  quitarRelacion: (piezaId: string, relacionId: string) => apiClient.delete<{ ok: boolean }>(`/piezas/${piezaId}/relaciones/${relacionId}`),

  externas: (estado: PiezaExterna['estado'] | 'todas' = 'propuesto') =>
    apiClient.get<{ fuente: FuenteExterna; items: PiezaExterna[] }>('/piezas-externas', { estado }),
  consultarExterna: (numero: string) =>
    apiClient.post<{ consultado: string; nuevas: number; items: PiezaExterna[] }>('/piezas-externas/consultar', { numero }),
  aprobarExterna: (id: string, datos: { sku: string; precio_dop: number; nombre?: string; vehiculo_id?: string; calidad?: Calidad; nota?: string }) =>
    apiClient.post<PiezaExterna>(`/piezas-externas/${id}/aprobar`, datos),
  incorporarExterna: (id: string, datos: { vehiculo_id: string; sku?: string; nombre?: string; calidad?: Calidad; nota?: string }) =>
    apiClient.post<PiezaExterna>(`/piezas-externas/${id}/incorporar`, datos),
  borrarLote: (referencia: string) =>
    apiClient.delete<{ referencia: string; borradas: number }>(`/piezas-externas/lotes/${encodeURIComponent(referencia)}`),
  rechazarExterna: (id: string, nota?: string) => apiClient.post<PiezaExterna>(`/piezas-externas/${id}/rechazar`, { nota }),
  fuentesTraer: () => apiClient.get<{ fuentes: FuenteTraer[] }>('/piezas-externas/fuentes'),
  traer: (datos: { fuente: FuenteTraer['clave']; documento?: string; marca: string; modelo: string; anio: number }) =>
    apiClient.post<ResultadoTraer>('/piezas-externas/traer', datos),
  agregarDeProveedor: (resultado: ResultadoExterno) =>
    apiClient.post<{ id: string; sku: string }>('/proveedores/agregar-al-inventario', { resultado }),
}

export const compatibilidadTexto = (c: CompatibilidadExterna[] | null | undefined) =>
  c?.length
    ? c.map((v) => [v.marca, v.modelo, aniosTexto(v), v.motor && `· ${v.motor}`].filter(Boolean).join(' ')).join('; ')
    : 'Uso general'

export const aniosTexto = (v: Pick<VehiculoDelCatalogo, 'anio_desde' | 'anio_hasta'>) =>
  v.anio_desde ? (v.anio_hasta && v.anio_hasta !== v.anio_desde ? `${v.anio_desde}-${v.anio_hasta}` : `${v.anio_desde}`) : 'Años sin confirmar'
