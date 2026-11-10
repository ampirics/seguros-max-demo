import { apiClient } from "@/lib/api-client"

export type Canal = "simulado" | "real"
export type ModoReinicio = "nuevo" | "solo_conversacion" | "conocido"

export interface RelojPrueba {
  fecha_local: string
  hora_local: string
  zona: string
  ahora?: string
}

export interface EstadoPruebas {
  habilitado: boolean
  entorno: string
  empresa_id: string
  telefonos: string[]
  rango_ficticio: { desde: string; hasta: string }
  canal_activo: Canal | null
  canal_real_vence: string | null
  llamadas_graph: number | null
  bloqueadas_graph: number | null
  contador_desde: string | null
  reloj: RelojPrueba | null
  existencias: string
  precios_incluyen_itbis?: boolean
  itbis_tasa?: number
  ultimo_reinicio: { fecha: string; telefonos: string[]; modo: ModoReinicio; usuario: string | null } | null
  ora: { disponible: boolean; error: string | null }
}

export interface Reinicio {
  modo: ModoReinicio
  telefonos: string[]
  simulado: boolean
  mg: Record<string, number>
  ora: Record<string, number | string[]>
  ora_error: string | null
  productos_del_caso: { products: number; vehiculos_catalogo: number }
  existencias: { antes: string; despues: string; anterior: string | null; coincide: boolean | null }
  citas_google: { canceladas: number; con_error: number }
  reloj: RelojPrueba | null
  perfil: Record<string, unknown> | null
}

export interface PedidoReinicio {
  telefono: string
  modo: ModoReinicio
  perfil?: Record<string, unknown>
  simular?: boolean
  confirmar_reales?: boolean
  reloj?: { fecha_local: string; hora_local: string } | null
}

export interface CasoResumen {
  id: string
  nombre: string
  area: string
  prioridad: string | null
  demo: boolean
  grupo: string
  nivel: string
  con_historial: boolean
  primer_mensaje: string
  pasos: number
  variantes: string[]
  consola: boolean
}

export type TipoEntrada = "cliente" | "boton" | "lista" | "rafaga" | "audio" | "foto" | "documento" | "ubicacion" | "sticker" | "web" | "accion" | "ninguna"

export interface ReglaCaso {
  id: string
  tipo: string
  etiqueta: string
  texto: string
  evaluable: boolean
}

export interface PasoCaso {
  n: number
  entrada: { tipo: TipoEntrada; texto: string; enviable: boolean; valor?: string | number; partes?: string[]; de?: string }
  reglas: ReglaCaso[]
  pausa_seg: number | null
  nota: string | null
  nombra_pieza: boolean
}

export interface CasoDetalle extends Omit<CasoResumen, "pasos"> {
  clave: string
  variante: number | null
  reiniciar: "nuevo" | "solo-conversacion" | "conocido" | "no"
  perfil_nombre: string | null
  perfil: Record<string, unknown> | null
  telefono: string
  telefono_del_caso: string
  reloj: { fecha_local: string; hora_local: string } | null
  vehiculo: string | null
  tipo_cliente: string | null
  flujo: string | null
  max_turnos_hasta_precio: number | null
  juicio: string[]
  notas: string | null
  continua_de: string | number | null
  config: Record<string, unknown> | null
  acciones: string[]
  origen: string | null
  pasos: PasoCaso[]
}

export type ResultadoRegla = "pasa" | "falla" | "esperando" | "solo_banco"

export interface ReglaEvaluada extends ReglaCaso {
  resultado: ResultadoRegla
  detalle: string[]
}

export interface Evaluacion {
  paso: number
  reglas: ReglaEvaluada[]
  con_monto: boolean
  respuestas: number
}

export interface OpcionInteractiva {
  id: string
  titulo: string
  descripcion?: string
}

export interface MensajePrueba {
  id: string
  sender: string
  autor: string | null
  bot: boolean
  texto: string
  tipo: string
  fecha: string | null
  interactivo: Record<string, any> | null
  wamid: string | null
  piezas: string[]
}

export interface ConversacionPrueba {
  telefono: string
  conversaciones: string[]
  conversation_id: string | null
  mensajes: MensajePrueba[]
  costo_usd: number | null
  consultas_con_costo: number
}

export interface PedidoMensaje {
  telefono: string
  texto?: string
  boton?: OpcionInteractiva | string | number
  lista?: OpcionInteractiva | string | number
}

export interface TelefonoLibre {
  telefono: string
  libre: boolean
  ultimo_uso: string | null
  reiniciar: boolean
  mensaje: string
  saltados: string[]
}

export interface ReinicioTotal {
  reinicio: Reinicio
  clientes: string[]
  clientes_error: string | null
}

const consulta = (valores: Record<string, string | number | null | undefined>) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(valores)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v))
  const texto = q.toString()
  return texto ? `?${texto}` : ""
}

export const pruebasApi = {
  estado: () => apiClient.get<EstadoPruebas>("/pruebas/estado"),
  reiniciar: (pedido: PedidoReinicio) => apiClient.post<Reinicio>("/pruebas/reiniciar", pedido),
  telefonoLibre: () => apiClient.get<TelefonoLibre>("/pruebas/telefono-libre"),
  canal: (canal: Canal) => apiClient.put<EstadoPruebas>("/pruebas/canal", { canal }),
  reloj: (fecha_local: string | null, hora_local: string | null) =>
    apiClient.put<{ reloj: RelojPrueba | null; ora_error: string | null }>("/pruebas/reloj", { fecha_local, hora_local }),
  reiniciarTodo: () => apiClient.post<ReinicioTotal>("/pruebas/reiniciar-todo", { confirmar: true }),
  casos: () => apiClient.get<{ casos: CasoResumen[] }>("/pruebas/casos"),
  caso: (id: string, variante?: number | null, telefono?: string | null) =>
    apiClient.get<CasoDetalle>(`/pruebas/casos/${encodeURIComponent(id)}${consulta({ variante, telefono })}`),
  evaluar: (id: string, datos: { telefono: string; paso: number; variante: number | null; mensajes: string[]; desde: string | null }) =>
    apiClient.post<Evaluacion>(`/pruebas/casos/${encodeURIComponent(id)}/evaluar`, datos),
  conversacion: (telefono: string) => apiClient.get<ConversacionPrueba>(`/pruebas/conversacion${consulta({ telefono })}`),
  mensaje: (pedido: PedidoMensaje) => apiClient.post<{ wamid: string }>("/pruebas/mensaje", pedido),
}

export function opcionesDe(interactivo: Record<string, any> | null | undefined): { tipo: "botones" | "lista" | null; opciones: OpcionInteractiva[] } {
  if (!interactivo) return { tipo: null, opciones: [] }
  if (interactivo.tipo === "botones") {
    return { tipo: "botones", opciones: (interactivo.botones ?? []).map((b: any) => ({ id: String(b.id), titulo: String(b.titulo) })) }
  }
  if (interactivo.tipo === "lista") {
    return {
      tipo: "lista",
      opciones: (interactivo.filas ?? []).map((f: any) => ({ id: String(f.id), titulo: String(f.titulo), descripcion: f.descripcion ? String(f.descripcion) : "" })),
    }
  }
  const accion = interactivo.action ?? {}
  if (interactivo.type === "button") {
    return { tipo: "botones", opciones: (accion.buttons ?? []).map((b: any) => ({ id: String(b.reply?.id), titulo: String(b.reply?.title) })) }
  }
  if (interactivo.type === "list") {
    const filas = (accion.sections ?? []).flatMap((s: any) => s.rows ?? [])
    return { tipo: "lista", opciones: filas.map((f: any) => ({ id: String(f.id), titulo: String(f.title), descripcion: f.description ? String(f.description) : "" })) }
  }
  return { tipo: null, opciones: [] }
}

export function normalizarTexto(valor: string): string {
  return valor.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

export const MODOS: { valor: ModoReinicio; texto: string; detalle: string }[] = [
  { valor: "nuevo", texto: "Cliente nuevo", detalle: "Borra todo lo del teléfono en MG y en ORA." },
  { valor: "solo_conversacion", texto: "Solo la conversación", detalle: "Conserva el cliente, sus vehículos y su historial." },
  { valor: "conocido", texto: "Cliente conocido", detalle: "Borra todo y siembra el perfil que pegues abajo." },
]

const TABLAS: Record<string, string> = {
  chat_conversations: "Conversaciones",
  chat_messages: "Mensajes",
  customers: "Clientes",
  vehiculos: "Vehículos",
  cotizaciones: "Cotizaciones",
  citas: "Citas",
  reservas_inventario: "Reservas",
  movimientos_inventario: "Movimientos de inventario",
  existencias_devueltas: "Existencias devueltas",
  orders: "Órdenes",
  order_items: "Líneas de órdenes",
  consultas: "Consultas del bot",
  seguimientos: "Seguimientos",
  busquedas_externas: "Búsquedas externas",
  notificaciones: "Avisos",
  solicitud_historial: "Historial de la solicitud",
  seguridad_eventos: "Eventos de seguridad",
  products: "Piezas agregadas en el caso",
  vehiculos_catalogo: "Vehículos agregados en el caso",
  clients: "Clientes",
  client_phones: "Teléfonos del cliente",
  clients_context: "Contexto limpiado",
  conversations: "Conversaciones",
  messages: "Mensajes",
  conversation_events: "Eventos",
  escalations: "Pases a vendedor",
  followups: "Seguimientos",
  state_transitions: "Cambios de etapa",
  mock_outbound_log: "Salidas del simulador",
  scheduled_jobs: "Trabajos programados",
  debounce: "Envíos pendientes cancelados",
}

export function nombreTabla(tabla: string): string {
  return TABLAS[tabla] ?? tabla
}

export function filasDe(conteos: Record<string, unknown> | null | undefined): [string, number][] {
  return Object.entries(conteos ?? {})
    .filter((e): e is [string, number] => typeof e[1] === "number" && e[1] > 0)
    .sort((a, b) => nombreTabla(a[0]).localeCompare(nombreTabla(b[0]), "es"))
}

export function normalizarTelefono(valor: string): string | null {
  let d = valor.replace(/\D/g, "")
  if (d.length === 10) d = `1${d}`
  return d.length >= 11 && d.length <= 15 ? `+${d}` : null
}

export function urlSimulador(telefono: string): string {
  return `http://localhost:3002/?canal=colt-demo-pn&tel=${telefono.replace(/\D/g, "")}`
}

export function textoTelefonoLibre(t: TelefonoLibre): string {
  const d = t.telefono.replace(/\D/g, "")
  const legible = `+${d.slice(0, 1)} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  return t.libre ? `Usa el ${legible}` : `Usa el ${legible}: ninguno está libre, es el que hace más tiempo no se usa y se reinicia como cliente nuevo`
}

export function esFicticio(telefono: string, rango: { desde: string; hasta: string }): boolean {
  const n = Number(telefono.replace(/\D/g, ""))
  return n >= Number(rango.desde.replace(/\D/g, "")) && n <= Number(rango.hasta.replace(/\D/g, ""))
}
