import { apiClient } from '@/lib/api-client'

export type EstadoAtencion = 'ia' | 'esperando_vendedor' | 'vendedor' | 'cerrada'
export type Etapa = 'recibida' | 'en_revision' | 'respondida' | 'cotizada' | 'validada'
export type Autor = 'cliente' | 'ia' | 'vendedor' | 'sistema'

export const ETAPAS: { valor: Etapa; label: string }[] = [
  { valor: 'recibida', label: 'Recibida' },
  { valor: 'en_revision', label: 'En revisión' },
  { valor: 'respondida', label: 'Respondida' },
  { valor: 'cotizada', label: 'Cotizada' },
  { valor: 'validada', label: 'Validada' },
]

export interface CambioAtencion {
  estado_atencion: EstadoAtencion
  asignado_a: string | null
}

export interface Solicitud {
  etapa: Etapa
  codigo_solicitud: string | null
  cotizacion: { codigo: string; version: number; estado: string; total_dop: number; vence: string } | null
  cita: { id: string; tipo: string; inicio: string } | null
  texto_cliente: string
}

export interface Copiloto {
  texto: string
  fuente: 'ia' | 'plantilla'
  piezas?: { id: string; nombre: string; precio_dop: number }[]
}

export interface VehiculoConversacion {
  id: string
  marca: string
  modelo: string
  anio: number | null
  motor: string | null
  vin: string | null
  placa: string | null
  kilometraje: number | null
}

const base = (id: string) => `/chat/conversations/${id}`

export const conversacionesApi = {
  tomar: (id: string) => apiClient.post<CambioAtencion>(`${base(id)}/tomar`),
  devolverAIa: (id: string) => apiClient.post<CambioAtencion>(`${base(id)}/devolver-a-ia`),
  transferir: (id: string, aUsuarioId: string, nota?: string) =>
    apiClient.post<CambioAtencion>(`${base(id)}/transferir`, { a_usuario_id: aUsuarioId, nota: nota?.trim() || undefined }),
  solicitud: (id: string) => apiClient.get<Solicitud>(`${base(id)}/solicitud`),
  cambiarEtapa: (id: string, etapa: Etapa) =>
    apiClient.request<{ etapa: Etapa }>(`${base(id)}/etapa`, { method: 'PATCH', body: JSON.stringify({ etapa }) }),
  sugerencia: (id: string) => apiClient.get<Copiloto>(`${base(id)}/sugerencia`),
  resumen: (id: string) => apiClient.get<Copiloto>(`${base(id)}/resumen`),
  vehiculos: (id: string) =>
    apiClient.get<{ items: VehiculoConversacion[] }>('/vehiculos', { conversation_id: id }).then((r) => r.items ?? []),
}

export const fotoPieza = (imagen?: string | null): string | null => {
  if (!imagen) return null
  if (/^(https?:|data:|\/)/.test(imagen)) return imagen
  const i = imagen.indexOf('colt/')
  return i >= 0 ? `/${imagen.slice(i)}` : null
}

let catalogo: Promise<Map<string, string>> | null = null
export const fotoDelCatalogo = (nombre: string): Promise<string | null> => {
  catalogo ??= fetch('/colt/productos.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((items: { nombre: string; imagenes?: string[] }[]) =>
      new Map(items.filter((p) => p.imagenes?.length).map((p) => [p.nombre.trim().toLowerCase(), p.imagenes![0]])))
    .catch(() => new Map())
  return catalogo.then((m) => fotoPieza(m.get(nombre.trim().toLowerCase())))
}
