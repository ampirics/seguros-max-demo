import { apiClient } from '@/lib/api-client'
import type { SeguridadCliente } from '@/lib/api/seguridad'

export type TipoCliente = 'particular' | 'taller' | 'flotilla'
export type EstadoVehiculo = 'activo' | 'ya_no_lo_tiene' | 'de_un_tercero'
export type Nivel = 'alto' | 'medio' | 'bajo'
export type TipoDocumento = 'cedula' | 'pasaporte' | 'rnc' | 'otro'
export type Pedida = 'comprada' | 'apartada' | 'cotizada' | 'vista'

export interface PiezaDelVehiculo {
  id: string
  sku: string | null
  nombre: string
  sistema: string | null
  etiqueta_calidad: string | null
  precio_dop: number
  disponible: boolean
  existencias: { sucursal_id: string; sucursal: string; disponible: number }[]
  motor: string | null
  depende_del_motor: boolean
  pedida: Pedida | null
  imagen?: string | null
  oem?: string | null
  calidad?: 'original' | 'oem' | 'alterna' | 'economica' | null
}

export interface PiezasDelVehiculo {
  motor_identificado: boolean
  aviso: string | null
  total: number
  dependen_del_motor: number
  pedidas: number
  sistemas: { clave: string; nombre: string; total: number; piezas: PiezaDelVehiculo[] }[]
}

export interface VehiculoPerfil {
  id: string
  marca: string
  modelo: string
  anio: number | null
  motor?: string | null
  vin?: string | null
  chasis?: string | null
  version?: string | null
  placa?: string | null
  fuente_identificacion?: string | null
  verificado?: boolean | null
  kilometraje?: number | null
  estado?: EstadoVehiculo
  fotos?: number
  creado?: string | null
}

export interface SenalesCliente {
  total_comprado_dop: number
  compras: number
  frecuencia_dias: number | null
  ultima_compra: string | null
  consultas_30d: number
  riesgo: { nivel: Nivel; motivo: string }
}

export interface ResumenCliente {
  lineas: string[]
  fuente: 'ia' | 'plantilla'
  fecha?: string
}

export interface PerfilDelCliente {
  cliente: {
    id: string
    nombre: string
    telefono: string | null
    telefonos?: string[]
    correo: string | null
    documento?: string | null
    documento_tipo?: TipoDocumento | null
    direccion?: string | null
    origen: string | null
    tipo?: TipoCliente
    sucursal_preferida?: { id: string; nombre: string } | null
    vendedor?: { id: string; nombre: string } | null
    bloqueado?: boolean
    bloqueado_at?: string | null
    bloqueo_motivo?: string | null
    anonimizado?: boolean
    anonimizado_at?: string | null
    sin_telefono?: boolean
    seguridad?: SeguridadCliente
    no_molestar?: boolean
    lista_blanca?: boolean
  }
  vehiculos: VehiculoPerfil[]
  piezas_consultadas: { id: string; nombre: string; precio_dop: number | null; visto: string }[]
  cotizaciones: { id?: string; codigo: string; estado: string; total_dop: number; vehiculo?: string | null; vehiculo_id?: string | null; origen?: string | null; validada_at?: string | null; fecha: string | null }[]
  citas: { id: string; tipo: string; inicio: string; estado: string; proxima: boolean }[]
  ordenes?: { id: string; numero: string | null; estado: string | null; total_dop: number; pagada: boolean; compra: boolean; fecha: string | null }[]
  senales?: SenalesCliente
  interes: { nivel: Nivel; motivo: string }
  conversaciones: number
  conversacion_id?: string | null
  mensajes_del_cliente: number
  ultima_interaccion: string | null
  ultimo_mensaje: string | null
  resumen?: ResumenCliente | null
}

export type TipoEvento =
  | 'mensajes' | 'nota_de_voz' | 'archivo' | 'pieza_vista' | 'descuento' | 'queja' | 'devolucion'
  | 'cotizacion' | 'cita' | 'reserva' | 'orden' | 'pago' | 'busqueda_externa' | 'notificacion'

export interface EventoCliente {
  id: string
  tipo: TipoEvento
  fecha: string | null
  titulo: string
  detalle: string | null
  canal: string
  atendio: string | null
  enlace: string | null
  vehiculo_id: string | null
}

export interface ArchivoCliente {
  id: string
  tipo: 'image' | 'document' | 'video'
  url: string | null
  mime_type: string | null
  nombre: string | null
  texto: string | null
  fecha: string | null
  de_cliente: boolean
  conversation_id: string
  vehiculo_id: string | null
  foto_del_vehiculo?: boolean
  eliminado: boolean
}

export type DatosEditables = {
  correo?: string | null
  tipo?: TipoCliente
  sucursal_preferida_id?: string | null
  vendedor_id?: string | null
  documento_tipo?: TipoDocumento
  documento?: string | null
}

export type ClaveEtapa = 'escribio' | 'vehiculo' | 'cotizo' | 'aparto' | 'agendo' | 'visito' | 'compro'

export interface EtapaPipeline {
  clave: ClaveEtapa
  titulo: string
  estado: 'hecho' | 'actual' | 'pendiente'
  fecha: string | null
  detalle: string | null
}

export interface NotificacionCliente {
  canal: 'whatsapp' | 'correo' | 'panel'
  tipo: string
  titulo: string
  fecha: string
  estado: 'enviada' | 'simulada' | 'fallida'
  destino: string | null
}

export interface PipelineCliente {
  cliente_id: string | null
  etapas: EtapaPipeline[]
  proxima_cita: { inicio: string; sucursal: string | null; estado: string } | null
  notificaciones: NotificacionCliente[]
}

const base = (id: string) => `/perfil/cliente/${encodeURIComponent(id)}`

const patch = <T,>(ruta: string, datos: unknown) =>
  apiClient.request<T>(ruta, { method: 'PATCH', body: JSON.stringify(datos), headers: { 'Content-Type': 'application/json' } })

export const perfilApi = {
  ver: (id: string) => apiClient.get<PerfilDelCliente>(base(id)),
  editar: (id: string, datos: DatosEditables) =>
    patch<PerfilDelCliente>(base(id), datos),
  bloquear: (id: string, bloqueado: boolean, motivo?: string, dias?: number) =>
    apiClient.post<{ bloqueado: boolean; bloqueado_at: string | null; bloqueo_motivo: string | null; bloqueo_vence?: string | null }>(
      `${base(id)}/bloqueo`, { bloqueado, motivo, dias }),
  listaBlanca: (id: string, activo: boolean, motivo?: string) =>
    apiClient.post<{ lista_blanca: boolean; seguridad: SeguridadCliente }>(`${base(id)}/lista-blanca`, { activo, motivo }),
  noMolestar: (id: string, activo: boolean) =>
    apiClient.post<{ cliente_id: string; no_molestar: boolean }>(`${base(id)}/no-molestar`, { activo }),
  estadoVehiculo: (id: string, vehiculoId: string, estado: EstadoVehiculo) =>
    patch<VehiculoPerfil>(`${base(id)}/vehiculos/${vehiculoId}`, { estado }),
  eventos: (id: string, params?: { tipo?: string; vehiculo_id?: string; limite?: number }) =>
    apiClient.get<{ items: EventoCliente[]; tipos: TipoEvento[] }>(`${base(id)}/eventos`, params).then((r) => r.items ?? []),
  piezasDelVehiculo: (id: string, vehiculoId: string) =>
    apiClient.get<PiezasDelVehiculo>(`${base(id)}/vehiculos/${encodeURIComponent(vehiculoId)}/piezas`),
  archivos: (id: string) => apiClient.get<ArchivoCliente[]>(`${base(id)}/archivos`),
  ligarArchivo: (mensajeId: string, vehiculoId: string | null, fotoDelVehiculo = false) =>
    patch<{ id: string; vehiculo_id: string | null; foto_del_vehiculo: boolean }>(`/perfil/archivos/${mensajeId}`, { vehiculo_id: vehiculoId, foto_del_vehiculo: fotoDelVehiculo }),
  pipeline: (id: string, conversationId?: string | null) =>
    apiClient.get<PipelineCliente>(`${base(id)}/pipeline`, conversationId ? { conversation_id: conversationId } : undefined),
  pipelineDeConversacion: (conversationId: string) =>
    apiClient.get<PipelineCliente>(`/chat/conversations/${encodeURIComponent(conversationId)}/pipeline`),
  resumen: (id: string, refrescar = false) =>
    apiClient.get<ResumenCliente>(`${base(id)}/resumen`, refrescar ? { refrescar: true } : undefined),
  borrarDatos: (id: string) =>
    apiClient.post<{ cliente_id: string; anonimizado_at: string; conversaciones: number; mensajes: number; archivos: number }>(
      `${base(id)}/borrar-datos`, { confirmar: 'BORRAR' }),
}

export const TIPOS_CLIENTE: { valor: TipoCliente; texto: string }[] = [
  { valor: 'particular', texto: 'Particular' },
  { valor: 'taller', texto: 'Taller' },
  { valor: 'flotilla', texto: 'Flotilla' },
]

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; texto: string }[] = [
  { valor: 'cedula', texto: 'Cédula' },
  { valor: 'pasaporte', texto: 'Pasaporte' },
  { valor: 'rnc', texto: 'RNC' },
  { valor: 'otro', texto: 'Otro' },
]

export const ESTADOS_VEHICULO: { valor: EstadoVehiculo; texto: string }[] = [
  { valor: 'activo', texto: 'Activo' },
  { valor: 'ya_no_lo_tiene', texto: 'Ya no lo tiene' },
  { valor: 'de_un_tercero', texto: 'De un tercero' },
]

export const vehiculoTexto = (v: Pick<VehiculoPerfil, 'marca' | 'modelo' | 'anio'>) =>
  `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ''}`
