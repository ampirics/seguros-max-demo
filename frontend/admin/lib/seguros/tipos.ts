export type Canal = "whatsapp" | "web" | "instagram" | "telefono" | "correo" | "presencial"
export type Sucursal = "santo_domingo" | "santiago" | "punta_cana"
export type Segmento = "persona" | "empresa"

export type Ramo =
  | "vehiculo"
  | "salud"
  | "vida"
  | "hogar"
  | "viaje"
  | "accidentes"
  | "incendio"
  | "responsabilidad_civil"
  | "transporte"
  | "fianzas"
  | "colectivo"
  | "maquinaria"

export type Area = "comercial_personas" | "comercial_empresas" | "servicio" | "siniestros" | "direccion"

export interface Persona {
  id: string
  nombre: string
  cargo: string
  area: Area
  sucursal: Sucursal
  correo: string
  iniciales: string
}

export interface Aseguradora {
  id: string
  nombre: string
  corto: string
  logo?: string
  ramos: Ramo[]
}

export type TipoRecorrido = "contacto" | "conversacion" | "oportunidad" | "cotizacion" | "poliza" | "renovacion" | "siniestro" | "pago" | "nota"

export interface PasoRecorrido {
  ts: number
  tipo: TipoRecorrido
  texto: string
  enlace?: string
}

export interface Cliente {
  id: string
  segmento: Segmento
  nombre: string
  documento: string
  telefono: string
  correo?: string
  ciudad: string
  sucursal: Sucursal
  ejecutivoId: string
  desde: number
  sector?: string
  empleados?: number
  contacto?: string
  etiquetas: string[]
  notas?: string
  consentimiento?: { ts: number; canal: Canal }
  verificadoHasta?: number
  conversacionId?: string
  recorrido: PasoRecorrido[]
}

export type EstadoPoliza = "vigente" | "por_renovar" | "renovada" | "vencida" | "cancelada"
export type EstadoRenovacion = "sin_iniciar" | "aviso_enviado" | "quiere_renovar" | "cotizando" | "confirmada" | "no_renueva"
export type FormaPago = "anual" | "semestral" | "trimestral" | "mensual"

export interface Poliza {
  id: string
  numero: string
  clienteId: string
  ramo: Ramo
  aseguradoraId: string
  plan: string
  bien: string
  sumaAsegurada: number
  primaAnual: number
  formaPago: FormaPago
  inicio: number
  vence: number
  estado: EstadoPoliza
  renovacion: EstadoRenovacion
  ejecutivoId: string
  pagoAlDia: boolean
  historial: { ts: number; texto: string; quien?: string }[]
}

export type Etapa = "nueva" | "calificada" | "en_cotizacion" | "propuesta_enviada" | "en_decision" | "ganada" | "perdida"
export type Prioridad = "alta" | "media" | "baja"
export type Origen = Canal | "referido" | "renovacion" | "venta_cruzada" | "cotizador_web"

export interface CotizacionAseguradora {
  aseguradoraId: string
  prima: number
  deducible: string
  coberturas: string[]
  notas?: string
  recomendada?: boolean
}

export interface Oportunidad {
  id: string
  codigo: string
  clienteId: string
  segmento: Segmento
  ramo: Ramo
  origen: Origen
  etapa: Etapa
  prioridad: Prioridad
  puntuacion: number
  ejecutivoId?: string
  sucursal: Sucursal
  creada: number
  actualizada: number
  primerContacto?: number
  ficha: Record<string, string | number | boolean | null>
  faltantes: string[]
  resumen: string
  cotizaciones: CotizacionAseguradora[]
  propuestaEnviada?: number
  elegida?: string
  primaGanada?: number
  motivoPerdida?: string
  polizaId?: string
  conversacionId?: string
  siguiente?: { texto: string; vence: number }
  historial: { ts: number; texto: string; quien?: string }[]
  creadaPor: "ia" | "equipo" | "sistema"
}

export type TipoSiniestro = "automovil" | "incendio" | "inundacion" | "robo" | "averia" | "salud" | "otros"
export type EstadoSiniestro = "reportado" | "documentos" | "inspeccion" | "en_aseguradora" | "resuelto" | "cerrado"

export interface DocumentoSiniestro {
  nombre: string
  recibido?: number
}

export interface Siniestro {
  id: string
  codigo: string
  clienteId: string
  polizaId?: string
  tipo: TipoSiniestro
  ocurrido: number
  reportado: number
  lugar: string
  descripcion: string
  lesionados: boolean
  terceros: boolean
  estado: EstadoSiniestro
  resultado?: string
  documentos: DocumentoSiniestro[]
  responsableId: string
  numeroAseguradora?: string
  montoEstimado?: number
  montoResuelto?: number
  conversacionId?: string
  creadoPor: "ia" | "equipo"
  historial: { ts: number; texto: string; quien?: string }[]
}

export interface PasoIA {
  herramienta: string
  resumen: string
  ok: boolean
}

export interface Adjunto {
  tipo: "imagen" | "pdf" | "audio"
  url: string
  nombre: string
  mime: string
  segundos?: number
}

export type EstadoConversacion = "ia" | "esperando_equipo" | "equipo" | "cerrada"

export interface Pase {
  motivo: string
  area: Area
  brief: string[]
  desde: number
}

export interface Conversacion {
  id: string
  clienteId: string
  canal: Canal
  tema: string
  estado: EstadoConversacion
  asignadoA?: string
  noLeidos: number
  etiquetas: string[]
  creada: number
  actualizada: number
  oportunidadId?: string
  siniestroId?: string
  pase?: Pase
  trato?: "usted" | "tu"
  primeraRespuestaSeg?: number
  externo?: "meta"
}

export interface Mensaje {
  id: string
  conversacionId: string
  ts: number
  de: "cliente" | "ia" | "equipo" | "sistema"
  texto: string
  autor?: string
  pasos?: PasoIA[]
  voz?: { segundos: number }
  adjunto?: Adjunto
}

export interface Evento {
  id: string
  ts: number
  tipo: "conversacion" | "oportunidad" | "siniestro" | "renovacion" | "poliza" | "sistema" | "pago"
  texto: string
  enlace?: string
}

export interface Config {
  iaActiva: boolean
  horario: { abre: string; cierra: string; sabado: string }
}

export interface Estado {
  ahora: number
  version: number
  clientes: Cliente[]
  polizas: Poliza[]
  oportunidades: Oportunidad[]
  siniestros: Siniestro[]
  conversaciones: Conversacion[]
  equipo: Persona[]
  eventos: Evento[]
  config: Config
}
