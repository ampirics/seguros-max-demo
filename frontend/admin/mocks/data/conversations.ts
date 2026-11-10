import { ADMIN_USER_ID, COMPANY_ID, DAY, HOUR, MINUTE, ago } from "./common"
import { REF, type ProductRef } from "./products"

type Sender = "user" | "bot" | "admin"

interface SeedMessage {
  at: number
  sender: Sender
  text: string
  metadata?: Record<string, any>
  extra?: Record<string, any>
}

interface Vehiculo {
  id: string
  marca: string
  modelo: string
  anio: number
  motor: string
}

interface SeedConversation {
  id: string
  customer_name: string
  customer_phone: string
  status: "pending" | "active" | "closed"
  conversation_status: "open" | "in_progress" | "resolved" | "closed"
  unread_count: number
  agent_requested?: boolean
  assigned_to_id?: string | null
  assigned_to_name?: string | null
  is_favorite?: boolean
  is_pinned?: boolean
  tags?: string[]
  notes?: string[]
  estado_atencion: "ia" | "esperando_vendedor" | "vendedor" | "cerrada"
  resultado?: "cotizada" | "cita_agendada" | "sin_existencia"
  vehiculo?: Vehiculo
  ia_pasos?: string[]
  cotizacion_codigo?: string
  messages: SeedMessage[]
}

const rd = (n: number) => `RD$${n.toLocaleString("en-US")}`

const agent = (text: string): Omit<SeedMessage, "at"> => ({
  sender: "admin",
  text,
  metadata: { sent_via_whatsapp: true, client_source: "web", whatsapp_message_id: "wamid.mock" },
})

const pieza = (r: ProductRef) => ({
  product_id: Number(r.id),
  nombre: r.name,
  mpn: r.mpn ?? "",
  precio_dop: r.price,
  disponible: true,
  imagen: r.image,
})

const bot = (text: string, piezas?: ProductRef[]): Omit<SeedMessage, "at"> => ({
  sender: "bot",
  text,
  metadata: { client_source: "mcp" },
  extra: piezas ? { piezas: piezas.map(pieza) } : undefined,
})

const user = (text: string, metadata?: Record<string, any>): Omit<SeedMessage, "at"> => ({
  sender: "user",
  text,
  metadata,
})

const voz = (transcripcion: string, segundos: number): Omit<SeedMessage, "at"> => ({
  sender: "user",
  text: "Nota de voz",
  metadata: {
    media_type: "audio",
    media_url: silentWavDataUri(segundos),
    mime_type: "audio/wav",
    filename: "nota-de-voz.wav",
    is_voice: true,
  },
  extra: { duracion_seg: segundos, transcripcion, transcripcion_estado: "lista" },
})

function timeline(start: number, step: number, items: Array<Omit<SeedMessage, "at">>): SeedMessage[] {
  return items.map((m, i) => ({ ...m, at: start - i * step }))
}

export function silentWavDataUri(seconds = 2): string {
  const rate = 8000
  const samples = rate * seconds
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i)
  }
  write(0, "RIFF")
  view.setUint32(4, 36 + samples, true)
  write(8, "WAVE")
  write(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  write(36, "data")
  view.setUint32(40, samples, true)
  bytes.fill(128, 44)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:audio/wav;base64,${btoa(binary)}`
}

export const AGENT_YANELIS = { id: "u0170000-0000-4000-8000-000000000002", name: "Yanelis Guzmán" }

export const chatTags = [
  { id: "tag-cotizacion", name: "Cotización", color: "#2563eb" },
  { id: "tag-mayorista", name: "Mayorista", color: "#7c3aed" },
  { id: "tag-urgente", name: "Urgente", color: "#dc2626" },
  { id: "tag-delivery", name: "Delivery", color: "#059669" },
]

export function seedConversations(): SeedConversation[] {
  const { tucsonDelIzq: izq, tucsonDelDer: der } = REF
  return [
    {
      id: "conv-001",
      customer_name: "José Miguel Rosario",
      customer_phone: "18295550193",
      status: "active",
      conversation_status: "in_progress",
      unread_count: 1,
      is_pinned: true,
      tags: ["tag-cotizacion"],
      estado_atencion: "ia",
      vehiculo: { id: "veh_1", marca: "Hyundai", modelo: "Tucson", anio: 2012, motor: "2.0 Litros" },
      ia_pasos: ["Buscando pieza", "Revisando existencia", "Armando cotización"],
      cotizacion_codigo: "COT-0412",
      messages: [
        { at: 14 * MINUTE, ...user("Buenas, tienen los amortiguadores delanteros de una Tucson 2012?") },
        { at: 13 * MINUTE, ...bot("Sí. Para Tucson 2009-2013 2.0 tenemos Parts Mall, izquierdo y derecho:", [izq, der]) },
        { at: 2 * MINUTE, ...voz("Mándame los dos, paso a buscarlos a las 3. ¿Cuánto sería todo?", 7) },
      ],
    },
    {
      id: "conv-002",
      customer_name: "Taller Hnos. Peña",
      customer_phone: "18095550142",
      status: "pending",
      conversation_status: "open",
      unread_count: 3,
      agent_requested: true,
      tags: ["tag-urgente"],
      notes: ["Cliente de crédito, 30 días. Confirmar límite con Pedro Julio antes de despachar."],
      estado_atencion: "esperando_vendedor",
      vehiculo: { id: "veh_2", marca: "Mitsubishi", modelo: "L200", anio: 2003, motor: "2.0 Litros 4G63" },
      messages: timeline(22 * MINUTE, 2 * MINUTE, [
        user("Saludos, necesito 4 juegos de bandas delanteras para L200 2003 4G63"),
        bot("Para L200 1997-2005 (2.0 L 4G63) tenemos estas bandas delanteras:", [REF.bandasL200, REF.bandasL200Orig]),
        user("Necesito precio de taller por los 4 juegos y saber si me lo despachan hoy"),
        bot("Te paso con un asesor para el precio especial de taller. Un momento por favor."),
        user("Ok, quiero hablar con una persona por favor"),
      ]),
    },
    {
      id: "conv-003",
      customer_name: "María Altagracia Fernández",
      customer_phone: "18495550121",
      status: "pending",
      conversation_status: "open",
      unread_count: 2,
      estado_atencion: "ia",
      vehiculo: { id: "veh_3", marca: "Hyundai", modelo: "Accent", anio: 2008, motor: "1.6 Litros" },
      messages: [
        { at: 9 * MINUTE, ...user("Hola buenas tardes, el carro mío es un Accent 2008") },
        { at: 8 * MINUTE, ...voz("Necesito el tensor de la correa de tiempo, el carro está sonando mucho. ¿Lo tienen?", 9) },
        { at: 7 * MINUTE, ...bot("Sí, para Accent 2006-2012 tenemos este tensor:", [REF.tensorAccent]) },
      ],
    },
    {
      id: "conv-004",
      customer_name: "Repuestos El Cibao",
      customer_phone: "18095550187",
      status: "active",
      conversation_status: "in_progress",
      unread_count: 0,
      assigned_to_id: ADMIN_USER_ID,
      assigned_to_name: "Cristian Sánchez",
      is_favorite: true,
      tags: ["tag-mayorista", "tag-cotizacion"],
      notes: ["Mayorista de Santiago. Envío por Caribe Tours, ellos pagan el flete."],
      estado_atencion: "vendedor",
      resultado: "cotizada",
      cotizacion_codigo: "COT-0409",
      messages: timeline(3 * HOUR, 6 * MINUTE, [
        user("Buen día. Cotízame 50 filtros de aceite PARTS MALL 26320-3C250 y 30 FRAM PH-3593A"),
        bot("Gracias por escribir a La Casa del Colt. Un asesor de ventas mayoristas te atiende en breve."),
        { sender: "admin", text: "🔄 Estado del admin: conversación asignada a Cristian Sánchez" },
        agent(`Buen día, con gusto. Cotización COT-0409:\n• 50 × ${REF.filtroAceiteSonata.name} — ${rd(REF.filtroAceiteSonata.price)} c/u\n• 30 × ${REF.filtroAceiteFram.name} — ${rd(REF.filtroAceiteFram.price)} c/u\nSubtotal: ${rd(50 * REF.filtroAceiteSonata.price + 30 * REF.filtroAceiteFram.price)} + ITBIS`),
        user("Perfecto, despáchenlo mañana por Caribe Tours"),
        agent("Listo, te mando el link de pago y mañana sale en la guagua de las 10:00 a. m."),
      ]),
    },
    {
      id: "conv-005",
      customer_name: "Ramón Antonio Tavárez",
      customer_phone: "18295550158",
      status: "closed",
      conversation_status: "resolved",
      unread_count: 0,
      assigned_to_id: AGENT_YANELIS.id,
      assigned_to_name: AGENT_YANELIS.name,
      estado_atencion: "cerrada",
      vehiculo: { id: "veh_5", marca: "Mitsubishi", modelo: "Montero", anio: 2005, motor: "2.8 Litros Diesel" },
      messages: timeline(2 * DAY, 10 * MINUTE, [
        user("Tienen cadena de tiempo para Montero 2005 diesel 2.8?"),
        bot("Sí, tenemos la cadena y el tensor:", [REF.cadenaMontero, REF.tensorMontero]),
        user("Voy mañana a buscarlas"),
        agent("Perfecto Don Ramón, se las dejamos separadas a su nombre en Villas Agrícolas."),
        user("Gracias, ya las retiré. Todo bien 👍"),
      ]),
    },
    {
      id: "conv-006",
      customer_name: "Yokasta Peralta",
      customer_phone: "18495550134",
      status: "closed",
      conversation_status: "closed",
      unread_count: 0,
      assigned_to_id: AGENT_YANELIS.id,
      assigned_to_name: AGENT_YANELIS.name,
      tags: ["tag-delivery"],
      estado_atencion: "cerrada",
      vehiculo: { id: "veh_6", marca: "Kia", modelo: "Sportage", anio: 2014, motor: "2.4 Litros" },
      messages: timeline(5 * DAY, 8 * MINUTE, [
        user("Necesito una batería para una Kia Sportage 2014"),
        bot(`Te recomiendo la ${REF.bateriaMtp24.name}, en oferta a ${rd(REF.bateriaMtp24.price)}.`),
        user("Ok la quiero con delivery a Bella Vista"),
        agent("Te envié el link de pago. Al confirmarse sale el delivery."),
        user("Pagado ✅"),
      ]),
    },
    {
      id: "conv-007",
      customer_name: "Auto Servicio Bello",
      customer_phone: "18095550176",
      status: "active",
      conversation_status: "open",
      unread_count: 0,
      estado_atencion: "ia",
      resultado: "cita_agendada",
      vehiculo: { id: "veh_7", marca: "Hyundai", modelo: "Santa Fe", anio: 2004, motor: "2.7 Litros V6" },
      messages: timeline(70 * MINUTE, 2 * MINUTE, [
        user("Tienen cables de bujía para Santa Fe 2004 V6 2.7?"),
        bot("Sí, en oferta. ¿Te lo separo?", [REF.cablesSantaFe]),
        user("Sepárame 2 juegos, paso en la tarde"),
        bot("Listo, quedan separados 2 juegos a nombre de Auto Servicio Bello. Te agendé la visita para hoy a las 4:00 p. m. en Villas Agrícolas."),
      ]),
    },
    {
      id: "conv-008",
      customer_name: "Franklin De los Santos",
      customer_phone: "18295550165",
      status: "active",
      conversation_status: "open",
      unread_count: 1,
      estado_atencion: "ia",
      resultado: "sin_existencia",
      vehiculo: { id: "veh_8", marca: "Mitsubishi", modelo: "Lancer", anio: 1998, motor: "1.8 Litros" },
      messages: timeline(4 * HOUR, 1 * MINUTE, [
        user("A qué hora abren los sábados? y dónde quedan?"),
        bot("Abrimos de lunes a viernes de 8:00 a. m. a 6:00 p. m. y sábados de 8:00 a. m. a 1:00 p. m. Estamos en Villas Agrícolas, Santo Domingo."),
        user("Ok. Y la bomba de gasolina del Lancer 98 1.8?"),
        bot("Ahora mismo no tenemos la bomba de gasolina para Lancer 1996-2000. Te aviso por aquí cuando llegue."),
        user("Ok, avísame"),
      ]),
    },
  ]
}

export function buildConversationRecords() {
  const seeds = seedConversations()
  const conversations: any[] = []
  const messages: Record<string, any[]> = {}
  const tagsByConversation: Record<string, string[]> = {}
  const notes: Record<string, any[]> = {}

  for (const seed of seeds) {
    const msgs = seed.messages
      .slice()
      .sort((a, b) => b.at - a.at)
      .map((m, i) => ({
        id: `${seed.id}-m${String(i + 1).padStart(2, "0")}`,
        conversation_id: seed.id,
        conversationId: seed.id,
        sender: m.sender,
        message: m.text,
        timestamp: ago(m.at),
        read: m.sender !== "user" || i < seed.messages.length - seed.unread_count,
        is_read: m.sender !== "user",
        is_edited: false,
        is_deleted: false,
        reactions: [],
        reply_to_id: null,
        replied_to_message: null,
        message_type: m.metadata?.media_type ? "media" : "text",
        metadata: m.metadata ?? null,
        ...m.extra,
      }))
    messages[seed.id] = msgs
    const last = msgs[msgs.length - 1]
    const first = msgs[0]
    const lastInbound = [...msgs].reverse().find((m) => m.sender === "user")
    const lastText = last.metadata?.media_type === "audio" ? "Nota de voz" : last.message
    conversations.push({
      id: seed.id,
      company_id: COMPANY_ID,
      customer_name: seed.customer_name,
      customer_phone: seed.customer_phone,
      status: seed.status,
      conversation_status: seed.conversation_status,
      unread_count: seed.unread_count,
      agent_requested: !!seed.agent_requested,
      agent_requested_at: seed.agent_requested ? last.timestamp : null,
      is_whatsapp: true,
      channel: "whatsapp",
      assigned_to_id: seed.assigned_to_id ?? null,
      assigned_to_name: seed.assigned_to_name ?? null,
      assigned_at: seed.assigned_to_id ? first.timestamp : null,
      resolved_at: seed.conversation_status === "resolved" || seed.conversation_status === "closed" ? last.timestamp : null,
      created_at: first.timestamp,
      updated_at: last.timestamp,
      last_message_text: lastText,
      last_message_timestamp: last.timestamp,
      is_favorite: !!seed.is_favorite,
      is_pinned: !!seed.is_pinned,
      contact_match: "customer",
      contact_name: seed.customer_name,
      customer_display_name: seed.customer_name,
      last_inbound_at: lastInbound?.timestamp ?? null,
      estado_atencion: seed.estado_atencion,
      resultado: seed.resultado ?? null,
      vehiculo: seed.vehiculo ?? null,
      ia_pasos: seed.ia_pasos ?? [],
      cotizacion_codigo: seed.cotizacion_codigo ?? null,
    })
    tagsByConversation[seed.id] = seed.tags ?? []
    notes[seed.id] = (seed.notes ?? []).map((content, i) => ({
      id: `${seed.id}-n${i + 1}`,
      conversation_id: seed.id,
      author_id: ADMIN_USER_ID,
      author_name: "Cristian Sánchez",
      content,
      created_at: first.timestamp,
      updated_at: first.timestamp,
    }))
  }

  return { conversations, messages, tagsByConversation, notes }
}
