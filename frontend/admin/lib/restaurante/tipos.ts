export type Zona = "terraza" | "muelle" | "gazebo" | "salon"

export type Estacion = "caliente" | "fria" | "postres"

export type EstadoMesa = "libre" | "reservada" | "ocupada" | "en_cocina" | "servida" | "cuenta" | "limpieza"

export type Canal = "whatsapp" | "instagram" | "web" | "telefono" | "voz" | "presencial"

export type MetodoPago = "efectivo" | "tarjeta" | "transferencia"

export type Rol = "dueno" | "gerente" | "anfitriona" | "mesero" | "cocina"

export interface Plato {
  id: string
  nombre: string
  categoria: string
  estacion: Estacion
  precio: number
  porLibra?: boolean
  minutos: number
  foto?: string
  descripcion?: string
  alergenos?: string[]
  opciones?: { nombre: string; valores: string[] }[]
  destacado?: boolean
}

/** Marcas de tiempo de la visita en curso: de ahí salen las duraciones de cada tramo. */
export interface Tramos {
  llegada: number
  orden?: number
  primerPlato?: number
  cuenta?: number
  pago?: number
}

export interface Mesa {
  id: string
  nombre: string
  zona: Zona
  capacidad: number
  x: number
  y: number
  /** Giro de la mesa en grados, para el plano 3D. */
  rot?: number
  estado: EstadoMesa
  desde: number
  pedidoId?: string
  reservaId?: string
  meseroId?: string
  clienteId?: string
  comensales?: number
  tramos?: Tramos
  llamado?: { tipo: "mesero" | "cuenta"; desde: number; origen: "qr" | "mesero" }
  manual?: boolean
}

export type EstadoItem = "pendiente" | "preparando" | "listo" | "servido"

export interface ItemPedido {
  id: string
  platoId: string
  nombre: string
  cantidad: number
  precio: number
  estacion: Estacion
  mods: string[]
  notas?: string
  estado: EstadoItem
  ronda: number
  enviado: number
  inicio?: number
  listo?: number
  servido?: number
  minutos: number
}

export interface Pedido {
  id: string
  numero: number
  mesaId: string
  meseroId: string
  clienteId?: string
  reservaId?: string
  comensales: number
  items: ItemPedido[]
  abierto: number
  rondas: number
  historial: { ts: number; texto: string; quien: string }[]
  /** Sesión abierta al escanear el QR de la mesa. */
  sesionId?: string
}

export interface SesionMesa {
  id: string
  mesaId: string
  pedidoId: string
  clienteId?: string
  creada: number
  visitaId?: string
}

export type EstadoReserva =
  | "solicitada"
  | "confirmada"
  | "recordada"
  | "asistencia_confirmada"
  | "sentada"
  | "completada"
  | "no_show"
  | "cancelada"
  | "lista_espera"

export interface AvisoReserva {
  ts: number
  tipo: "confirmacion" | "recordatorio" | "respuesta" | "cambio" | "cancelacion" | "nota"
  texto: string
  canal: Canal | "correo"
  quien: string
  estado?: "enviado" | "fallido" | "vista_previa"
  /** Para el correo en vista previa: dónde se ve tal cual le llegaría al cliente. */
  enlace?: string
}

export interface Reserva {
  id: string
  codigo: string
  clienteId: string
  nombre: string
  telefono: string
  fecha: string
  hora: string
  personas: number
  zona: Zona
  mesaId?: string
  ocasion?: string
  canal: Canal
  estado: EstadoReserva
  notas?: string
  creada: number
  conversacionId?: string
  visitaId?: string
  avisos: AvisoReserva[]
  correo?: string
  /** Creada durante la demo (por la IA o el panel): a estas sí les salen correos y PDF de verdad. */
  real?: boolean
  /** Quién la creó: la IA ya confirma en el chat; desde la bandeja el equipo escribe; desde el panel la confirma el sistema. */
  creadaPor?: "ia" | "bandeja" | "panel"
  /** La anfitriona los marcó en la puerta y todavía no los sienta. */
  llegoEn?: number
  /** Evento en el Google Calendar conectado. */
  eventoGoogle?: string
}

export type TipoPaso = "contacto" | "conversacion" | "reserva" | "llegada" | "pedido" | "pago" | "resena" | "evento" | "puntos"

export interface PasoRecorrido {
  ts: number
  tipo: TipoPaso
  texto: string
  canal?: Canal
  quien?: string
  enlace?: string
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  correo?: string
  idioma?: "es" | "en"
  canalOrigen: Canal
  creado: number
  visitas: number
  gasto: number
  puntos: number
  ultimaVisita?: number
  preferencias: string[]
  ocasiones: string[]
  alergias?: string[]
  cumpleanos?: string
  etiqueta?: string
  empresa?: string
  conversacionId?: string
  recorrido: PasoRecorrido[]
}

export type TipoTarea = "reposo" | "recibir" | "tomar" | "servir" | "atender" | "cobrar" | "limpiar"

export interface Persona {
  id: string
  nombre: string
  rol: Rol
  color: string
  zonas: Zona[]
  estacion?: Estacion
  tarea: { tipo: TipoTarea; mesaId?: string; hasta: number }
}

/** Visita cerrada: la unidad de las métricas. */
export interface Visita {
  id: string
  mesaId: string
  zona: Zona
  personas: number
  meseroId: string
  clienteId?: string
  reservaId?: string
  canal: Canal
  llegada: number
  orden: number
  primerPlato: number
  cuenta: number
  pago: number
  salida: number
  platos: { platoId: string; cantidad: number; importe: number; minutosCocina: number }[]
  subtotal: number
  itbis: number
  servicio: number
  propina: number
  total: number
  metodo: MetodoPago
  llamados: number
  esperaLlamado: number
  calificacion?: number
  comentario?: string
  /** Sesión del QR de la mesa con la que el cliente siguió su cuenta. */
  sesionId?: string
}

export type Remitente = "cliente" | "ia" | "equipo" | "sistema"

export interface PasoIA {
  herramienta: string
  resumen: string
  ok: boolean
}

export interface Adjunto {
  tipo: "imagen" | "audio" | "pdf"
  url: string
  nombre: string
  mime: string
  segundos?: number
}

export interface Mensaje {
  id: string
  conversacionId: string
  ts: number
  de: Remitente
  texto: string
  autor?: string
  voz?: { segundos: number }
  pasos?: PasoIA[]
  reservaId?: string
  adjunto?: Adjunto
}

export type EstadoAtencion = "ia" | "esperando_equipo" | "equipo" | "cerrada"

export interface Conversacion {
  id: string
  clienteId: string
  canal: Canal
  tema: string
  estado: EstadoAtencion
  asignadoA?: string
  noLeidos: number
  etiquetas: string[]
  reservaIds: string[]
  creada: number
  actualizada: number
  resultado?: "reserva" | "cambio" | "cancelacion" | "evento" | "consulta" | "queja"
  /** Llegó por WhatsApp real (Meta): las respuestas salen también por ahí. */
  externo?: "meta"
}

export interface Evento {
  id: string
  ts: number
  tipo: "mesa" | "cocina" | "reserva" | "pago" | "llamado" | "ia" | "sistema"
  texto: string
  mesaId?: string
  reservaId?: string
  clienteId?: string
  quien?: string
}

export interface Config {
  piloto: boolean
  cocinaAuto: boolean
  velocidad: number
  iaActiva: boolean
  /** Minutos antes de la reserva en que sale el recordatorio. */
  recordatorioMinutos: number
}

export interface Estado {
  ahora: number
  version: number
  mesas: Mesa[]
  pedidos: Pedido[]
  reservas: Reserva[]
  clientes: Cliente[]
  equipo: Persona[]
  eventos: Evento[]
  conversaciones: Conversacion[]
  config: Config
  /** Visitas cerradas hoy (las de días anteriores solo viven en el servidor para las métricas). */
  visitasHoy: Visita[]
  /** Llegaron sin reserva y se anotaron en la entrada (QR de la puerta). */
  entrada?: Entrada[]
  insumos?: Insumo[]
  compras?: OrdenCompra[]
  caja?: Caja
  cajasCerradas?: Caja[]
}

export interface Insumo {
  id: string
  nombre: string
  unidad: "kg" | "l" | "unidad" | "botella"
  /** Costo de ejemplo por unidad, en RD$. */
  costo: number
  existencia: number
  minimo: number
  proveedorId: string
  categoria: string
}

export interface Proveedor {
  id: string
  nombre: string
  contacto: string
  telefono: string
  correo?: string
  dias: string
  categorias: string[]
}

export interface OrdenCompra {
  id: string
  codigo: string
  proveedorId: string
  estado: "borrador" | "enviada" | "recibida" | "cancelada"
  lineas: { insumoId: string; cantidad: number; costo: number }[]
  total: number
  creada: number
  enviada?: number
  recibida?: number
  pagada?: { ts: number; metodo: MetodoPago; deCaja: boolean }
  quien: string
}

export type CategoriaGasto = "insumos" | "nomina" | "servicios" | "mantenimiento" | "otros"

export interface Gasto {
  id: string
  ts: number
  categoria: CategoriaGasto
  descripcion: string
  monto: number
  metodo: MetodoPago | "credito"
  proveedorId?: string
  compraId?: string
  deCaja: boolean
  comprobante?: string
  quien: string
}

export interface MovimientoCaja {
  ts: number
  tipo: "venta" | "ingreso" | "retiro" | "gasto"
  metodo: MetodoPago
  monto: number
  texto: string
  mesaId?: string
  visitaId?: string
  gastoId?: string
  compraId?: string
}

export interface MovimientoInsumo {
  ts: number
  insumoId: string
  /** Positivo entra, negativo sale. */
  cantidad: number
  tipo: "consumo" | "compra" | "ajuste"
  texto: string
  mesaId?: string
  compraId?: string
  quien?: string
}

export interface Caja {
  id: string
  abierta: number
  cajero: string
  fondo: number
  movimientos: MovimientoCaja[]
  cerrada?: number
  contado?: number
  esperado?: number
  diferencia?: number
  nota?: string
}

export interface Entrada {
  id: string
  nombre: string
  telefono?: string
  personas: number
  ts: number
}
