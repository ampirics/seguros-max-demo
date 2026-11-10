// Imports
import { Color, Product, User, CartItem, ProductDetail } from './types'

// Tipos base para respuestas API
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Productos
export interface ProductResponse extends ApiResponse<Product> {}
export interface ProductsResponse extends PaginatedResponse<Product> {}

export interface CreateProductRequest {
  name: string
  price: number
  description: string
  image: string
  images: string[]
  colors: Color[]
  sizes: string[]
  details: ProductDetail[]
  isVisible?: boolean
  // Campos de descuento
  original_price?: number
  discount_percentage?: number
  is_on_sale?: boolean
  // Campos de unidades
  unit_quantity?: number
  unit_type?: string
  unit_measurement_id?: string
  // Campos de SKU
  sku?: string
  external_category_code?: string
  sku_mask?: string
  generated_skus?: Array<{sku: string, size: string, color: string, combination: string}>
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

// Autenticación
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse extends ApiResponse<{
  user: User
  token: string
  refreshToken: string
}> {
  access_token: any;
}

export interface RefreshTokenRequest {
  refreshToken: string
}

// Órdenes
export interface CreateOrderRequest {
  items: CartItem[]
  customerInfo: {
    name: string
    email: string
    phone: string
    address?: string
  }
  notes?: string
}

export interface OrderResponse extends ApiResponse<Order> {}
export interface OrdersResponse extends PaginatedResponse<Order> {}

export interface Order {
  id: string
  items: CartItem[]
  customerInfo: {
    name: string
    email: string
    phone: string
    address?: string
  }
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  total: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// Chat
export interface ChatConversationResponse extends ApiResponse<ChatConversation> {}
export interface ChatConversationsResponse extends PaginatedResponse<ChatConversation> {}
export interface ChatMessagesResponse extends PaginatedResponse<ChatMessage> {}

export interface CreateConversationRequest {
  customerName: string
  customerPhone: string
  initialMessage: string
}

export interface SendMessageRequest {
  message: string
  sender: 'user' | 'admin'
  reply_to_id?: string | null  // Feature 1.4
}

export interface RepliedToMessage {
  id: string
  sender: string
  message: string
  is_deleted: boolean
}

export type ConversationMgmtStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface ChatConversation {
  id: string
  customerName: string
  customerPhone: string
  status: 'pending' | 'active' | 'closed'
  conversation_status: ConversationMgmtStatus
  resolved_at?: string | null
  assigned_to_id?: string | null
  assigned_to_name?: string | null
  assigned_at?: string | null
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  createdAt: Date
}

export interface PiezaSugerida {
  product_id: string | number
  nombre: string
  mpn?: string | null
  precio_dop: number
  disponible: boolean
  imagen?: string | null
  sku?: string | null
  calidad?: string | null
  existencias?: { sucursal_id?: string; sucursal: string; disponible: number }[]
  demo?: boolean
}

export interface Pieza {
  id: string
  sku: string | null
  nombre: string
  oem: string | null
  mpn?: string | null
  fabricante: string | null
  condicion: 'original' | 'alterna' | 'remanufacturada' | 'usada' | null
  sistema: string | null
  posicion: string | null
  precio_dop: number
  disponible: boolean
  imagen: string | null
  vehiculo: { marca: string; modelo: string | null; anios: string | null; motor?: string | null } | null
  existencias?: { sucursal_id: string; sucursal: string; disponible: number }[]
  calidad?: Calidad | null
  reemplaza_a?: { id: string | null; nombre: string | null; numero: string | null }
}

export type Calidad = 'original' | 'alterna'

export type TipoRelacion = 'reemplaza' | 'reemplazada_por' | 'kit' | 'lado_opuesto' | 'equivalente'

export interface PiezaRelacionada {
  relacion_id: string | null
  tipo: TipoRelacion
  nota: string | null
  numero: string | null
  id: string | null
  nombre: string | null
  sku: string | null
  precio_dop: number | null
  disponible: boolean
  calidad: Calidad | null
  imagen: string | null
}

export interface PiezaFicha extends Pieza {
  compatibilidad: NonNullable<Pieza['vehiculo']>[]
  equivalencias: { id: string; nombre: string; relacion: 'oem_equivalente' | 'alterna' | 'lado_opuesto' | 'kit'; fabricante: string | null; precio_dop: number; disponible: boolean; imagen: string | null }[]
  existencia: { sucursal: string; cantidad: number; ubicacion: string | null; sucursal_id?: string; reservado?: number; disponible?: number; actualizado?: string | null }[]
  precio_mayoreo_dop: number | null
  garantia: string | null
  imagenes: string[]
  url?: string | null
  relacionadas?: PiezaRelacionada[]
}

export interface BusquedaPiezas {
  total: number
  vehiculo_detectado: { marca: string | null; modelo: string | null; anios?: string | null; anio?: number | null; motor?: string | null; vin?: string } | null
  items: Pieza[]
}

export interface VehiculoCatalogo {
  marca: string
  modelo: string
  desde: number
  hasta: number
  motores?: { motor: string; motor_codigo: string | null; cilindrada: string | null; combustible: string | null; desde: number | null; hasta: number | null }[]
}

export type EstadoCotizacion = 'borrador' | 'enviada' | 'aceptada' | 'vencida' | 'rechazada'

export interface LineaCotizacionDetalle {
  pieza_id: string | number
  sku?: string | null
  descripcion: string
  cantidad: number
  precio_dop: number
  precio_lista_dop?: number
}

export interface CotizacionResumen {
  codigo: string
  version: number
  estado: EstadoCotizacion
  creada: string
  vence: string
  cliente: { id: string | null; nombre: string | null; telefono?: string | null }
  conversation_id: string | null
  vehiculo_id: string | null
  vehiculo: string | null
  items: LineaCotizacionDetalle[]
  subtotal_dop: number
  itbis_dop: number
  total_dop: number
  precios_incluyen_itbis: boolean
  origen: 'ia' | 'panel'
  enviada_at: string | null
  validada_por: string | null
  validada_at: string | null
  pdf_url: string
  versiones: number[]
  orden: { id: string; numero: string } | null
}

export type Cotizacion = CotizacionResumen

export interface VehiculoCliente {
  id: string
  cliente_id: string | null
  cliente: string | null
  cliente_telefono: string | null
  marca: string | null
  modelo: string | null
  anio: number | null
  motor: string | null
  vin: string | null
  placa: string | null
  kilometraje: number | null
  atenciones: number
  ultima_atencion: string | null
  conversacion_id: string | null
}

export interface EventoCronograma {
  fecha: string
  canal: 'whatsapp' | 'llamada' | 'mostrador' | 'tienda_web'
  atendio: string
  tipo: 'consulta' | 'cotizacion' | 'venta' | 'nota' | 'cita'
  detalle: string
  monto_dop?: number | null
  km?: number | null
  conversacion_id?: string | null
  cotizacion_id?: string | null
  estado?: string
  orden_id?: string
  orden_numero?: string
  cita_estado?: 'programada' | 'completada' | 'no_asistio' | 'cancelada'
}

export interface PlanMantenimientoItem {
  clave: string
  descripcion: string
  cada_km: number
  ultimo_km: number | null
  proximo_km: number | null
  cuando: string
  prioridad: 'alta' | 'media' | 'baja'
  pieza_id: string | null
  pieza: { id: string; nombre: string; precio_dop: number; disponible: boolean; imagen: string | null } | null
}

export type EtapaLead = 'nueva' | 'en_atencion' | 'pendiente_datos' | 'cotizada' | 'ganada' | 'perdida'
export type MotivoPerdida = 'precio' | 'sin_existencia' | 'tiempo_entrega' | 'compro_en_otro_lado' | 'no_responde' | 'otro'
export type EstadoCita = 'programada' | 'completada' | 'no_asistio' | 'cancelada'

export interface Lead {
  id: string
  cliente: string
  cliente_id: string | null
  telefono: string | null
  interes: string | null
  etapa: EtapaLead
  etapa_manual?: boolean
  origen: 'whatsapp' | 'llamada' | 'mostrador' | 'tienda_web' | 'panel'
  responsable: string
  vendedor_cierre: string | null
  motivo_perdida: MotivoPerdida | null
  nota_perdida?: string | null
  monto_dop: number | null
  creado: string
  sla_vence: string | null
  actualizado: string | null
  conversacion_id: string | null
  cotizacion_codigo: string | null
  cotizacion_estado: string | null
  solicitud_etapa?: string | null
  orden_id?: string | null
  orden_numero?: string | null
  vehiculo: { id: string; marca: string | null; modelo: string | null; anio: number | null } | null
  citas?: { id: string; tipo: 'visita' | 'llamada'; estado: EstadoCita; inicio: string; fin: string; vendedor: string | null }[]
}

export interface TurnoAgenda { dia: 1 | 2 | 3 | 4 | 5 | 6; desde: string; hasta: string }

export interface VendedorAgenda {
  id: string
  nombre: string
  sucursal: string | null
  horario: TurnoAgenda[]
}

export interface BloqueAgenda { vendedor_id: string; vendedor?: string | null; inicio: string; fin: string; libre: boolean; sucursal?: string | null }

export interface Cita {
  id: string
  tipo: 'visita' | 'llamada'
  estado: EstadoCita
  cliente: string | null
  cliente_id: string | null
  telefono: string | null
  vendedor_id: string
  vendedor: string | null
  sucursal: string | null
  motivo: string | null
  origen: 'whatsapp' | 'llamada' | 'mostrador' | 'tienda_web' | 'panel' | 'ia' | 'tienda'
  inicio: string
  fin: string
  conversacion_id: string | null
  lead_id: string | null
  vehiculo_id: string | null
  google_event_id: string | null
  google_error?: string | null
  recordatorio_enviado: boolean
  recordatorio_error?: string | null
  sucursal_id?: string | null
  llego_at?: string | null
  cotizacion_codigo?: string | null
  order_id?: string | null
}

export type TipoNotificacion = 'nuevo_lead' | 'mensaje_sin_responder' | 'pieza_no_encontrada' | 'sla_por_vencer' | 'cita_proxima' | 'cotizacion_por_validar' | 'reserva' | 'reserva_vencida' | 'stock_bajo' | 'se_acaba' | 'pedida_sin_existencia' | 'visita_sucursal'

export interface Notificacion {
  id: string
  tipo: TipoNotificacion
  titulo: string
  detalle?: string | null
  leida: boolean
  creada: string
  conversacion_id: string | null
  lead_id?: string | null
  cita_id?: string | null
  busqueda_id?: string | null
}

export interface ResumenReportes {
  periodo: { desde: string; hasta: string }
  consultas: number
  cotizadas: number
  ganadas: number
  perdidas: number
  abiertas: number
  conversion: number | null
  monto_ganado_dop: number
  monto_perdido_dop: number
  tiempo_respuesta_mediano_seg: number | null
  respuestas_medidas: number
  sla_vencido: number
  atendidas_ia: number
  por_motivo: { motivo: MotivoPerdida; cantidad: number; monto_dop: number }[]
  por_canal: { origen: Lead['origen']; consultas: number; ganadas: number }[]
  por_vendedor: { vendedor: string; consultas: number; ganadas: number; perdidas: number; monto_dop: number; tiempo_respuesta_mediano_seg: number | null }[]
}

export interface ActividadIA {
  resumen: {
    conversaciones: number
    sin_humano: number
    pasadas_a_vendedor: number
    cotizaciones_armadas: number
    sin_existencia: number
    primera_respuesta_mediana_seg: number | null
    consultas_herramientas: number
    escrituras: number
  }
  pasadas: { conversacion_id: string; cliente: string; motivo: string; a: string | null; estado_atencion: string; fecha: string | null }[]
  herramientas: {
    conversacion_id: string
    cliente: string
    fecha: string
    metodo: 'GET'
    herramienta: string
    ruta: string
    parametros: Record<string, string | number | undefined>
    resultados: number | null
    ms: number | null
  }[]
}

export interface ChatMessage {
  id: string
  conversationId: string
  sender: 'user' | 'admin' | 'bot'
  message: string
  timestamp: Date
  read: boolean
  is_edited?: boolean
  edited_at?: string | null
  original_content?: string | null
  is_deleted?: boolean
  deleted_at?: string | null
  reactions?: MessageReactionGroup[]
  // Feature 1.4 - Reply to messages
  reply_to_id?: string | null
  replied_to_message?: RepliedToMessage | null
  message_type?: string
  autor?: 'cliente' | 'ia' | 'vendedor' | 'sistema' | null
  media_url?: string | null
  duracion_seg?: number | null
  transcripcion?: string | null
  transcripcion_estado?: 'pendiente' | 'lista' | 'error' | null
  piezas?: PiezaSugerida[] | null
  ia_pasos?: string[] | null
  metadata?: {
    client_source?: 'web' | 'meta' | 'mcp'
    sent_via_whatsapp?: boolean
    whatsapp_error?: string
    whatsapp_method?: string
    whatsapp_response?: any
    whatsapp_message_id?: string
    sent_at?: string
    sent_from?: string
    admin_id?: string
    phone?: string
    sent_via_lambda?: boolean
    [key: string]: any
  }
}

export interface MessageReactionUser {
  user_id: string
  user_name?: string | null
}

export interface MessageReactionGroup {
  emoji: string
  count: number
  reacted_by_me: boolean
  users: MessageReactionUser[]
}

// Usuarios
export interface UserResponse extends ApiResponse<User> {}
export interface UsersResponse extends PaginatedResponse<User> {}

export interface CreateUserRequest {
  name: string
  email: string
  role: 'admin' | 'manager' | 'operator'
  isActive?: boolean
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {}

// Errores
export interface ApiError {
  code: string
  message: string
  details?: any
}

// AI Assistant
export interface AIAssistantResponse {
  response: string
  context: {
    schema?: any
    company_id?: string
  }
  suggestions: string[]
}

export interface DatabaseSchema {
  schema: Record<string, {
    columns: Array<{
      name: string
      type: string
      nullable: boolean
      primary_key: boolean
    }>
    foreign_keys: Array<{
      column: string
      references: string
    }>
  }>
  total_tables: number
  company_id?: string
}

export interface AISuggestions {
  suggestions: string[]
  categories: Array<{
    name: string
    questions: string[]
  }>
}

// ── Notas Internas ────────────────────────────────────────────────────────

export interface ConversationNote {
  id: string
  conversation_id: string
  author_id: string
  author_name: string | null
  content: string
  created_at: string
  updated_at: string
}

export interface ChatTag {
  id: string
  company_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface MCPToolResult {
  tool_name: string
  status: 'success' | 'error' | 'blocked'
  duration_ms?: number
  output?: Record<string, any>
  error_message?: string | null
}

export interface MCPChatResponse {
  reply: string
  model_used: string
  handoff_requested: boolean
  tool_calls: MCPToolResult[]
  timestamp: string
}

export interface MCPAuditEntry {
  id: string
  company_id: string
  conversation_id?: string | null
  customer_phone: string
  tool_name: string
  tool_input: Record<string, any>
  tool_output?: Record<string, any> | null
  status: 'success' | 'error' | 'blocked'
  error_message?: string | null
  duration_ms?: number | null
  model_used?: string | null
  timestamp: string
}


export type TipoFuenteExterna = 'catalogo_oem' | 'marketplace' | 'subasta' | 'desarmadero' | 'proveedor'

export interface CompatibilidadExterna {
  marca: string
  modelo: string
  anio_desde: number | null
  anio_hasta: number | null
  motor?: string | null
  mercado?: string | null
  notas?: string | null
}

export interface ResultadoExterno {
  id: string
  titulo: string
  tipo: 'resultado' | 'enlace' | TipoFuenteExterna
  fuente: string
  condicion?: 'nueva' | 'usada' | null
  precio: number | null
  moneda: string | null
  origen: string | null
  dias_estimados: number | null
  url: string
  imagen: string | null
  proveedor?: { id: string; nombre: string; origen: string | null }
  disponibles?: number
  agotado?: boolean
  pieza?: { numero: string; marca_pieza: string | null; nombre: string; compatibilidad: CompatibilidadExterna[]; uso_general: boolean }
  ya_en_catalogo?: { sku: string } | null
  simulado?: boolean
}

export type EstadoBusquedaExterna = 'pendiente' | 'ofrecida' | 'aceptada' | 'descartada'

export interface BusquedaExterna {
  id: string
  pieza: string
  vehiculo: { marca: string | null; modelo: string | null; anio: number | null; motor?: string | null } | null
  cliente: { id: string | null; nombre: string } | null
  conversacion_id: string | null
  lead_id: string | null
  origen: 'ia' | 'vendedor'
  estado: EstadoBusquedaExterna
  oferta: { resultado: ResultadoExterno; precio_dop: number; dias_estimados: number | null; mensaje: string; enviada: string; por: string } | null
  creada: string
  actualizada: string
}
