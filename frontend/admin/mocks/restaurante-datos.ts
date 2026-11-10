import { CARTA, FUENTE_PRECIOS } from "@/lib/restaurante/carta"
import { fechaLocal, hora12, NEGOCIO, ZONAS } from "@/lib/restaurante/local"
import type { Conversacion, Estado, Mensaje } from "@/lib/restaurante/tipos"
import { EMPRESA_RESTAURANTE, EMPRESA_RESTAURANTE_ID, esRestaurante, guardarEquipo, USUARIOS_RESTAURANTE, usuariosEquipo } from "./restaurante"

// Datos de Boca Marina para las pantallas de Comunicación y Configuración en la vertical restaurante.

type On = (method: string, pattern: string, handler: (ctx: any) => unknown, cuando?: () => boolean) => void

const SRV = "/srv/restaurante"
const DIA = 24 * 3600 * 1000
const ahoraIso = () => new Date().toISOString()
const hace = (ms: number) => new Date(Date.now() - ms).toISOString()
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

async function srv<T>(ruta: string): Promise<T> {
  const r = await fetch(`${SRV}${ruta}`)
  if (!r.ok) throw new Error("Error del servidor del restaurante")
  return r.json()
}

// ---------- Configuración de la IA ----------

const CLAVE_IA = "mock_ia_config_restaurante"
const IA_BASE = {
  nombre_asistente: "el asistente de Boca Marina",
  revelar_ia: true,
  handoff: {
    frases: ["hablar con una persona", "hablar con el encargado", "quiero un humano", "persona real"],
    queja: true,
    eventos: true,
    precio_sin_aprobar: true,
    mensaje: "Te paso con alguien del equipo; te escribe por aquí en unos minutos.",
  },
  reservas: {
    primera: NEGOCIO.primeraReserva,
    ultima: NEGOCIO.ultimaReserva,
    grupo_maximo: NEGOCIO.grupoMaximo,
    anticipacion_dias: 90,
    recordatorio_horas: 3,
    pedir_confirmacion: true,
    liberar_minutos: 25,
    lista_espera: true,
  },
  tono: { estilo: "cercano", trato: "tu", largo: "corto" },
  voz: { respuesta_audio: "si_nota" },
  demora_segundos: 2,
  privacidad: {
    activo: true,
    texto: "Guardamos tus mensajes, tus reservas y tus preferencias (como alergias u ocasiones especiales) para atenderte. Si quieres que los borremos, escríbenos 'borrar mis datos'.",
  },
}
const leerIa = () => {
  try {
    return { ...IA_BASE, ...JSON.parse(localStorage.getItem(CLAVE_IA) || "{}") }
  } catch {
    return IA_BASE
  }
}

// ---------- Conocimiento ----------

const zonas = ZONAS.map((z) => `${z.nombre}: ${z.descripcion.toLowerCase()}`).join(". ")
const kn = (id: string, type: "policy" | "term" | "faq", title: string, datos: { content?: string; question?: string; answer?: string }, activo = true) => ({
  id,
  company_id: EMPRESA_RESTAURANTE_ID,
  type,
  title,
  content: datos.content ?? null,
  question: datos.question ?? null,
  answer: datos.answer ?? null,
  is_active: activo,
  created_at: "2026-10-24T14:00:00Z",
  updated_at: "2026-10-24T14:00:00Z",
})
let conocimiento = [
  kn("kn-bm-horario", "faq", "Horario", { question: "¿A qué hora abren?", answer: `${NEGOCIO.horario}. Las reservas se toman de ${hora12(NEGOCIO.primeraReserva)} a ${hora12(NEGOCIO.ultimaReserva)}.` }),
  kn("kn-bm-ubicacion", "faq", "Ubicación", { question: "¿Dónde están ubicados?", answer: `En ${NEGOCIO.direccion}, sobre el muelle, frente al mar Caribe. WhatsApp ${NEGOCIO.whatsapp}.` }),
  kn("kn-bm-zonas", "term", "Zonas del restaurante", { content: `${zonas}.` }),
  kn("kn-bm-grupos", "policy", "Grupos y eventos", { content: `Las reservas en línea son para grupos de hasta ${NEGOCIO.grupoMaximo} personas. Grupos más grandes, bodas, cumpleaños grandes y eventos privados se cotizan aparte con el equipo de eventos.` }),
  kn("kn-bm-reservas", "policy", "Reservas", { content: "Cada reserva queda con un código y una mesa asignada. El día de la reserva se envía un recordatorio por WhatsApp; si el cliente no llega 25 minutos después de la hora, la mesa se libera para la lista de espera." }),
  kn("kn-bm-itbis", "term", "ITBIS y servicio", { content: "Los precios de la carta no incluyen el 18 % de ITBIS ni el 10 % de servicio de ley; ambos se suman en la cuenta." }),
  kn("kn-bm-carta", "term", "Carta y precios", { content: `La IA solo da precios de la carta oficial (${CARTA.length} platos; precios de la ${FUENTE_PRECIOS}). Pescados enteros y langostas se cobran por libra. Bebidas, montajes y paquetes los confirma el equipo.` }),
  kn("kn-bm-alergias", "policy", "Alergias", { content: "Cada plato de la carta indica sus alérgenos. Cuando un cliente menciona una alergia, la IA la anota en su ficha y en la reserva para que la vea cocina. La contaminación cruzada la confirma el equipo de cocina." }),
  kn("kn-bm-ocasiones", "faq", "Ocasiones especiales", { question: "¿Preparan algo especial para un aniversario o una propuesta?", answer: "Sí: cumpleaños, aniversarios, propuestas de matrimonio, montajes románticos y comidas de negocios. Al reservar se anota la ocasión; el costo de un montaje lo confirma el equipo." }),
  kn("kn-bm-temporada", "faq", "Fechas especiales", { question: "¿Tienen menú para fechas especiales?", answer: "San Valentín, Semana Santa, Día de las Madres y Fin de año tienen propuestas de temporada. La fecha exacta, el menú y los precios los confirma el equipo cuando el restaurante los publica." }),
  kn("kn-bm-parqueo", "faq", "Parqueo y mascotas", { question: "¿Tienen parqueo? ¿Aceptan mascotas?", answer: "Pendiente de confirmar con la gerencia. Mientras tanto, la IA pasa la pregunta al equipo." }, false),
]

// ---------- Memoria colectiva ----------

const sinonimos: any[] = [
  { id: "sin-bm-1", palabra: "la cama", significa: "cama balinesa del gazebo", pieza_id: null, estado: "aprobado", veces: 6, creado_por: "Carolina Reyes", aprobado_por: "Lorena Paulino", aprobado_en: hace(5 * DIA), creado: hace(6 * DIA) },
  { id: "sin-bm-2", palabra: "frente al agua", significa: "muelle frente al mar", pieza_id: null, estado: "aprobado", veces: 9, creado_por: "Carolina Reyes", aprobado_por: "Lorena Paulino", aprobado_en: hace(9 * DIA), creado: hace(10 * DIA) },
]
const noEntendidas = [
  { texto: "algo pa picar", ejemplo: "algo pa picar mientras llegan los demás", veces: 4, vehiculos: [] as string[] },
  { texto: "la terraza de arriba", ejemplo: "una mesa en la terraza de arriba", veces: 3, vehiculos: [] as string[] },
  { texto: "el combo del muelle", ejemplo: "quiero el combo del muelle", veces: 2, vehiculos: [] as string[] },
]
const propuestas: any[] = [
  {
    id: "prop-bm-1", tipo: "faq", estado: "propuesto", veces: 4, nota: null, revisado_por: null, revisado_en: null, resultado_id: null, creado: hace(2 * DIA), actualizado: hace(DIA),
    datos: { pregunta: "¿Se puede llevar bizcocho propio para un cumpleaños?", respuesta: "El equipo lo confirma al reservar; anótalo en la reserva para que cocina lo tenga en cuenta." },
  },
  {
    id: "prop-bm-2", tipo: "faq", estado: "propuesto", veces: 3, nota: null, revisado_por: null, revisado_en: null, resultado_id: null, creado: hace(3 * DIA), actualizado: hace(DIA),
    datos: { pregunta: "¿A qué hora es el atardecer para reservar en el muelle?", respuesta: "Para el atardecer conviene reservar el muelle o el gazebo un poco antes de la puesta del sol; el equipo sugiere la hora según la fecha." },
  },
]
const normal = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

// ---------- Campañas ----------

const plantilla = (id: string, name: string, category: string, status: string, body: string, imagen = false) => ({
  id, name, language: "es", status, category,
  components: [...(imagen ? [{ type: "HEADER", format: "IMAGE" }] : []), { type: "BODY", text: body }, { type: "FOOTER", text: "Responde BAJA para no recibir más mensajes" }],
})
const plantillas = [
  plantilla("tpl-bm-cumple", "cumpleanos_del_mes", "MARKETING", "APPROVED", "Hola {{1}}, en Boca Marina queremos celebrar tu cumpleaños frente al mar. Reserva tu mesa respondiendo a este mensaje.", true),
  plantilla("tpl-bm-vuelve", "te_extranamos", "MARKETING", "APPROVED", "Hola {{1}}, hace tiempo no te vemos en el muelle. El atardecer te espera: responde y te reservamos mesa."),
  plantilla("tpl-bm-sanvalentin", "san_valentin", "MARKETING", "PENDING", "Hola {{1}}, este San Valentín tenemos cenas para dos y mesa romántica frente al mar. Reserva por aquí: los cupos del gazebo son pocos.", true),
  plantilla("tpl-bm-recordatorio", "recordatorio_reserva", "UTILITY", "APPROVED", "Hola {{1}}, te recordamos tu reserva de hoy a las {{2}} en Boca Marina. Responde SÍ para confirmar o NO si no puedes venir."),
]
const conCuerpo = (t: any) => ({ ...t, body: t.components?.find((c: any) => c.type === "BODY")?.text || "" })
let campanas: any[] | null = null
const destinatarios: Record<string, any[]> = {}

async function asegurarCampanas() {
  if (campanas) return campanas
  let clientes: { id: string; nombre: string; telefono: string }[] = []
  try {
    clientes = (await srv<Estado>("/estado")).clientes.filter((c) => c.telefono)
  } catch {}
  const estados = ["READ", "READ", "DELIVERED", "READ", "DELIVERED", "SENT", "READ", "FAILED", "DELIVERED", "READ"]
  const armar = (id: string, datos: Record<string, any>, n: number, enviada: boolean) => {
    const lista = clientes.slice(0, n).map((c, i) => ({
      id: `${id}-r${i + 1}`, campaign_id: id, customer_id: c.id, customer_name: c.nombre, phone_e164: "+1" + c.telefono.replace(/\D/g, "").slice(-10),
      status: enviada ? estados[i % estados.length] : "PENDING", attempts: 1, error_message: enviada && estados[i % estados.length] === "FAILED" ? "Número sin WhatsApp (131026)" : null,
    }))
    destinatarios[id] = lista
    const cuenta = (s: string[]) => lista.filter((r) => s.includes(r.status)).length
    return {
      id, company_id: EMPRESA_RESTAURANTE_ID, language_code: "es", segment_definition: { has_phone: true },
      total_recipients: lista.length, sent_count: cuenta(["SENT", "DELIVERED", "READ"]), delivered_count: cuenta(["DELIVERED", "READ"]), read_count: cuenta(["READ"]),
      failed_count: cuenta(["FAILED"]), opted_out_count: 0, ...datos,
    }
  }
  campanas = [
    armar("cmp-bm-1", { name: "Cumpleaños de octubre", status: "SENT", template_name: "cumpleanos_del_mes", created_at: hace(20 * DIA), sent_at: hace(20 * DIA) }, 8, true),
    armar("cmp-bm-2", { name: "Te extrañamos: clientes sin volver en 60 días", status: "SENT", template_name: "te_extranamos", created_at: hace(6 * DIA), sent_at: hace(6 * DIA) }, 10, true),
    armar("cmp-bm-3", { name: "Cumpleaños de noviembre", status: "SCHEDULED", template_name: "cumpleanos_del_mes", created_at: hace(DIA), scheduled_at: new Date(Date.now() + 7 * DIA).toISOString() }, 6, false),
    armar("cmp-bm-4", { name: "San Valentín: mesa romántica frente al mar", status: "DRAFT", template_name: "san_valentin", created_at: hace(3 * 3600 * 1000) }, 0, false),
  ]
  return campanas
}

// ---------- Notificaciones ----------

const CLAVE_LEIDAS = "mock-notif-leidas-restaurante"
const leidas = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LEIDAS) || "[]")
  } catch {
    return []
  }
}
const guardarLeidas = (ids: string[]) => {
  try {
    localStorage.setItem(CLAVE_LEIDAS, JSON.stringify(ids.slice(-300)))
  } catch {}
}

async function notificaciones() {
  const est = await srv<Estado>("/estado")
  const ahora = Date.now()
  const hoy = fechaLocal(ahora)
  const nombre = (id?: string) => est.clientes.find((c) => c.id === id)?.nombre ?? "Cliente"
  const items: any[] = []
  for (const r of est.reservas) {
    if (ahora - r.creada < DIA && r.estado !== "cancelada")
      items.push({ id: `ntf-res-${r.id}`, tipo: "reserva_nueva", titulo: `Reserva nueva: ${r.nombre}`, detalle: `${r.fecha === hoy ? "Hoy" : r.fecha} a las ${hora12(r.hora)} · ${r.personas} personas${r.ocasion ? ` · ${r.ocasion}` : ""}`, reserva_id: r.id, conversacion_id: r.conversacionId ?? null, creada: new Date(r.creada).toISOString() })
    if (r.fecha === hoy && r.estado === "recordada") {
      const recordatorio = r.avisos.find((a) => a.tipo === "recordatorio")
      items.push({ id: `ntf-conf-${r.id}`, tipo: "sin_confirmar", titulo: `${r.nombre} no ha confirmado`, detalle: `Reserva de hoy a las ${hora12(r.hora)} · recordatorio sin respuesta`, reserva_id: r.id, conversacion_id: r.conversacionId ?? null, creada: new Date(recordatorio?.ts ?? r.creada).toISOString() })
    }
    if (r.fecha === hoy && r.estado === "lista_espera")
      items.push({ id: `ntf-espera-${r.id}`, tipo: "lista_espera", titulo: `${r.nombre} en lista de espera`, detalle: `${r.personas} personas a las ${hora12(r.hora)}`, reserva_id: r.id, conversacion_id: r.conversacionId ?? null, creada: new Date(r.creada).toISOString() })
  }
  for (const c of est.conversaciones as Conversacion[]) {
    if (c.estado === "esperando_equipo")
      items.push({ id: `ntf-conv-${c.id}-${c.actualizada}`, tipo: "espera_equipo", titulo: `${nombre(c.clienteId)} espera al equipo`, detalle: c.tema, conversacion_id: c.id, creada: new Date(c.actualizada).toISOString() })
  }
  for (const p of est.pedidos) {
    const mesa = est.mesas.find((m) => m.id === p.mesaId)
    const tarde = p.items.filter((i) => (i.estado === "pendiente" || i.estado === "preparando") && (ahora - i.enviado) / 60000 > i.minutos * 1.3)
    if (tarde.length)
      items.push({ id: `ntf-cocina-${p.id}-${tarde.length}`, tipo: "plato_tarde", titulo: `${mesa?.nombre ?? p.mesaId}: ${tarde.length} ${tarde.length === 1 ? "plato pasado" : "platos pasados"} de tiempo`, detalle: tarde.map((i) => i.nombre).join(", "), mesa_id: p.mesaId, creada: new Date(Math.min(...tarde.map((i) => i.enviado))).toISOString() })
  }
  for (const m of est.mesas) {
    if (m.llamado && ahora - m.llamado.desde > 60_000)
      items.push({ id: `ntf-llamado-${m.id}-${m.llamado.desde}`, tipo: "llamado_mesa", titulo: `${m.nombre} ${m.llamado.tipo === "cuenta" ? "pidió la cuenta" : "llama al mesero"}`, detalle: `Sin atender hace ${Math.round((ahora - m.llamado.desde) / 60000)} min`, mesa_id: m.id, creada: new Date(m.llamado.desde).toISOString() })
  }
  const vistas = new Set(leidas())
  return items
    .map((n) => ({ lead_id: null, cita_id: null, busqueda_id: null, conversacion_id: null, ...n, leida: vistas.has(n.id) }))
    .sort((a, b) => b.creada.localeCompare(a.creada))
}

// ---------- Actividad de la IA ----------

async function actividad(desde: number) {
  const lista = await srv<(Conversacion & { cliente: { nombre: string } | null })[]>("/conversaciones")
  const resumen = { conversaciones: 0, sin_humano: 0, pasadas_a_vendedor: 0, cotizaciones_armadas: 0, sin_existencia: 0, primera_respuesta_mediana_seg: null as number | null, consultas_herramientas: 0, escrituras: 0 }
  const pasadas: any[] = []
  const herramientas: any[] = []
  const tiempos: number[] = []
  for (const c of lista) {
    if (c.actualizada < desde) continue
    const ms = await srv<Mensaje[]>(`/conversaciones/${c.id}/mensajes`)
    if (!ms.some((m) => m.de === "ia")) continue
    resumen.conversaciones++
    const humano = ms.some((m) => m.de === "equipo") || c.estado === "equipo" || c.estado === "esperando_equipo"
    if (humano) {
      resumen.pasadas_a_vendedor++
      const pase = [...ms].reverse().find((m) => m.pasos?.some((p) => p.herramienta === "pasar_a_equipo"))
      pasadas.push({
        conversacion_id: c.id,
        cliente: c.cliente?.nombre ?? "Cliente",
        motivo: pase?.pasos?.find((p) => p.herramienta === "pasar_a_equipo")?.resumen ?? (ms.some((m) => m.de === "equipo") ? "Lo tomó alguien del equipo" : "El cliente pidió una persona"),
        a: USUARIOS_RESTAURANTE.find((u) => u.id === c.asignadoA)?.name ?? null,
        estado_atencion: { ia: "ia", esperando_equipo: "esperando_vendedor", equipo: "vendedor", cerrada: "cerrada" }[c.estado],
        fecha: new Date(c.actualizada).toISOString(),
      })
    } else resumen.sin_humano++
    const primero = ms.find((m) => m.de === "cliente")
    const respuesta = primero && ms.find((m) => m.de === "ia" && m.ts >= primero.ts)
    if (primero && respuesta) tiempos.push(Math.max(1, Math.round((respuesta.ts - primero.ts) / 1000)))
    for (const m of ms) {
      for (const p of m.pasos ?? []) {
        resumen.consultas_herramientas++
        if (["crear_reserva", "modificar_reserva", "cancelar_reserva", "actualizar_ficha", "confirmar_asistencia"].includes(p.herramienta)) resumen.escrituras++
        if (p.herramienta === "crear_reserva" && p.ok) resumen.cotizaciones_armadas++
        if (!p.ok && ["validar_reglas", "sin_precio", "sin_dato"].includes(p.herramienta)) resumen.sin_existencia++
        herramientas.push({ fecha: new Date(m.ts).toISOString(), herramienta: p.herramienta, cliente: c.cliente?.nombre ?? "Cliente", metodo: "IA", ruta: p.resumen, parametros: {}, resultados: null, ms: null, conversacion_id: c.id })
      }
    }
  }
  tiempos.sort((a, b) => a - b)
  resumen.primera_respuesta_mediana_seg = tiempos.length ? tiempos[Math.floor(tiempos.length / 2)] : null
  return { resumen, pasadas: pasadas.sort((a, b) => b.fecha.localeCompare(a.fecha)), herramientas: herramientas.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 60) }
}

// ---------- Usuarios ----------

const listaUsuarios = () => usuariosEquipo() as any[]

export function registrarDatosRestaurante(on: On, respond: (status: number, body: unknown) => unknown) {
  const si = esRestaurante
  const noEncontrado = (q: string) => respond(404, { detail: `${q} no encontrado` })

  on("GET", "/ia/configuracion", () => leerIa(), si)
  on("PUT", "/ia/configuracion", ({ body }: any) => {
    const nueva = { ...leerIa(), ...(body as object) }
    try {
      localStorage.setItem(CLAVE_IA, JSON.stringify(nueva))
    } catch {}
    return nueva
  }, si)
  on("GET", "/ia/origen-datos", () => ({
    activo: "sistema",
    fuentes: [{ clave: "sistema", nombre: "Carta y agenda de Boca Marina", estado: "activo" }],
    productos: CARTA.length,
    marcas: [],
    actualizado: ahoraIso(),
  }), si)
  on("GET", "/ia/sinonimos", () => sinonimos.filter((s) => s.estado === "aprobado").map(({ palabra, significa }) => ({ palabra, significa })), si)
  on("GET", "/ia/actividad", ({ query }: any) => actividad(query.get("desde") ? Date.parse(query.get("desde")) : Date.now() - 30 * DIA), si)
  on("GET", "/store-config", () => ({ company_id: EMPRESA_RESTAURANTE_ID, store_name: EMPRESA_RESTAURANTE.name, logo_url: EMPRESA_RESTAURANTE.logo_url, primary_color: "#0B2A2E", currency: "DOP" }), si)
  on("GET", "/admin/company-settings", () => ({ company_id: EMPRESA_RESTAURANTE_ID, sap_validation_enabled: false, currency: "DOP", timezone: "America/Santo_Domingo" }), si)
  on("GET", "/odoo/estado", () => ({ configurado: true, url: "http://localhost:8069", base: "bocamarina", usuario: "admin", diario_pagos: null }), si)

  on("GET", "/knowledge", ({ query }: any) => conocimiento.filter((k) => !query.get("type") || k.type === query.get("type")), si)
  on("POST", "/knowledge/import-from-url", ({ body }: any) => {
    const item = kn(nuevoId("kn"), body?.type || "policy", body?.title || "Contenido importado", { content: `Contenido importado desde ${body?.url ?? "la URL indicada"} (simulado).` })
    conocimiento = [item, ...conocimiento]
    return item
  }, si)
  on("POST", "/knowledge", ({ body }: any) => {
    const item = { ...kn(nuevoId("kn"), body?.type || "faq", body?.title || "", {}), ...body, created_at: ahoraIso(), updated_at: ahoraIso() }
    conocimiento = [item, ...conocimiento]
    return item
  }, si)
  on("PUT", "/knowledge/:id", ({ params, body }: any) => {
    const k = conocimiento.find((x) => x.id === params.id)
    return k ? Object.assign(k, body, { updated_at: ahoraIso() }) : noEncontrado("Entrada")
  }, si)
  on("DELETE", "/knowledge/:id", ({ params }: any) => {
    conocimiento = conocimiento.filter((k) => k.id !== params.id)
    return respond(204, null)
  }, si)

  const yo = () => {
    try {
      return USUARIOS_RESTAURANTE.find((u) => u.id === localStorage.getItem("mock-usuario-restaurante"))?.name ?? "Gerardo Núñez"
    } catch {
      return "Gerardo Núñez"
    }
  }
  on("GET", "/memoria/no-entendidas", () => noEntendidas.filter((n) => !sinonimos.some((s) => s.palabra === n.texto)).map((n) => ({ ...n, ultima: hace(3 * 3600 * 1000) })), si)
  on("POST", "/memoria/no-entendidas/ignorar", ({ body }: any) => {
    const s = { id: nuevoId("sin"), palabra: normal(body.texto), significa: "", pieza_id: null, estado: "ignorado", veces: 0, creado_por: yo(), aprobado_por: null, aprobado_en: null, creado: ahoraIso() }
    sinonimos.unshift(s)
    return s
  }, si)
  on("GET", "/memoria/sinonimos", ({ query }: any) => sinonimos.filter((s) => !query.get("estado") || s.estado === query.get("estado")), si)
  on("POST", "/memoria/sinonimos", ({ body }: any) => {
    const palabra = normal(String(body.palabra ?? ""))
    if (!palabra || !String(body.significa ?? "").trim()) return respond(422, { detail: "indica la palabra y qué significa" })
    const previo = sinonimos.findIndex((s) => s.palabra === palabra)
    if (previo >= 0) sinonimos.splice(previo, 1)
    const s = { id: nuevoId("sin"), palabra, significa: body.significa.trim(), pieza_id: null, estado: body.aprobar === false ? "propuesto" : "aprobado", veces: noEntendidas.find((n) => n.texto === palabra)?.veces ?? 0, creado_por: yo(), aprobado_por: yo(), aprobado_en: ahoraIso(), creado: ahoraIso() }
    sinonimos.unshift(s)
    return s
  }, si)
  on("POST", "/memoria/sinonimos/:id/aprobar", ({ params }: any) => {
    const s = sinonimos.find((x) => x.id === params.id)
    return s ? Object.assign(s, { estado: "aprobado", aprobado_por: yo(), aprobado_en: ahoraIso() }) : noEncontrado("Sinónimo")
  }, si)
  on("DELETE", "/memoria/sinonimos/:id", ({ params }: any) => {
    const i = sinonimos.findIndex((x) => x.id === params.id)
    if (i < 0) return noEncontrado("Sinónimo")
    sinonimos.splice(i, 1)
    return { ok: true }
  }, si)
  on("GET", "/memoria/propuestas", ({ query }: any) => {
    const estados = query.get("estado")?.split(",")
    return propuestas.filter((p) => (!query.get("tipo") || p.tipo === query.get("tipo")) && (!estados || estados.includes(p.estado)))
  }, si)
  on("POST", "/memoria/propuestas/generar", () => ({ faq: 0, compatibilidades: 0 }), si)
  on("POST", "/memoria/propuestas/:id/aprobar", ({ params, body }: any) => {
    const p = propuestas.find((x) => x.id === params.id)
    if (!p) return noEncontrado("Propuesta")
    p.datos = { pregunta: body?.pregunta ?? p.datos.pregunta, respuesta: body?.respuesta ?? p.datos.respuesta }
    conocimiento = [kn(nuevoId("kn"), "faq", p.datos.pregunta, { question: p.datos.pregunta, answer: p.datos.respuesta }), ...conocimiento]
    return Object.assign(p, { estado: "aprobado", revisado_por: yo(), revisado_en: ahoraIso(), resultado_id: nuevoId("kn") })
  }, si)
  on("POST", "/memoria/propuestas/:id/rechazar", ({ params, body }: any) => {
    const p = propuestas.find((x) => x.id === params.id)
    return p ? Object.assign(p, { estado: "rechazado", nota: body?.nota ?? null, revisado_por: yo(), revisado_en: ahoraIso() }) : noEncontrado("Propuesta")
  }, si)

  on("GET", "/admin/campaigns/templates/meta", () => ({ success: true, templates: plantillas.map(conCuerpo) }), si)
  on("POST", "/admin/campaigns/templates/meta", ({ body }: any) => {
    const t = plantilla(nuevoId("tpl"), body?.name, body?.category || "MARKETING", "PENDING", body?.body_text || "")
    plantillas.push(t)
    return { success: true, name: t.name, status: t.status, id: t.id }
  }, si)
  on("POST", "/admin/campaigns/preview-audience", async () => {
    const est = await srv<Estado>("/estado")
    const lista = est.clientes.filter((c) => c.telefono)
    return { count: lista.length, excluded_no_optin: 0, excluded_no_phone: est.clientes.length - lista.length, sample: lista.slice(0, 5).map((c) => ({ name: c.nombre, phone_e164: "+1" + c.telefono.replace(/\D/g, "").slice(-10) })) }
  }, si)
  on("GET", "/admin/campaigns", async ({ query }: any) => {
    const lista = (await asegurarCampanas()).filter((c) => (!query.get("status") || c.status === query.get("status")) && (!query.get("q") || `${c.name} ${c.template_name}`.toLowerCase().includes(query.get("q").toLowerCase())))
    return { items: lista, total: lista.length }
  }, si)
  on("POST", "/admin/campaigns", async ({ body }: any) => {
    const id = nuevoId("cmp")
    const c = { id, company_id: EMPRESA_RESTAURANTE_ID, status: "DRAFT", total_recipients: 0, sent_count: 0, delivered_count: 0, read_count: 0, failed_count: 0, opted_out_count: 0, created_at: ahoraIso(), ...body }
    ;(await asegurarCampanas()).unshift(c)
    destinatarios[id] = []
    return c
  }, si)
  on("GET", "/admin/campaigns/:id", async ({ params }: any) => (await asegurarCampanas()).find((c) => c.id === params.id) ?? noEncontrado("Campaña"), si)
  on("GET", "/admin/campaigns/:id/stats", async ({ params }: any) => {
    const c = (await asegurarCampanas()).find((x) => x.id === params.id)
    if (!c) return noEncontrado("Campaña")
    const { total_recipients, sent_count, delivered_count, read_count, failed_count, opted_out_count } = c
    return { total_recipients, sent_count, delivered_count, read_count, failed_count, opted_out_count }
  }, si)
  on("GET", "/admin/campaigns/:id/recipients", ({ params }: any) => ({ items: destinatarios[params.id] || [] }), si)
  on("POST", "/admin/campaigns/:id/send", async ({ params }: any) => {
    const c = (await asegurarCampanas()).find((x) => x.id === params.id)
    if (!c) return noEncontrado("Campaña")
    const est = await srv<Estado>("/estado")
    const lista = est.clientes.filter((x) => x.telefono).map((x, i) => ({ id: `${c.id}-r${i + 1}`, campaign_id: c.id, customer_name: x.nombre, phone_e164: "+1" + x.telefono.replace(/\D/g, "").slice(-10), status: "SENT", attempts: 1, error_message: null }))
    destinatarios[c.id] = lista
    Object.assign(c, { status: "SENT", sent_at: ahoraIso(), total_recipients: lista.length, sent_count: lista.length })
    return { success: true, status: c.status }
  }, si)
  on("DELETE", "/admin/campaigns/:id", async ({ params }: any) => {
    campanas = (await asegurarCampanas()).filter((c) => c.id !== params.id)
    return { success: true }
  }, si)

  on("GET", "/notificaciones", async ({ query }: any) => {
    const todas = await notificaciones()
    const items = todas.filter((n) => (query.get("no_leidas") !== "true" && query.get("solo_no_leidas") !== "true" || !n.leida) && (!query.get("tipo") || n.tipo === query.get("tipo")))
    return { no_leidas: todas.filter((n) => !n.leida).length, items: items.slice(0, Number(query.get("limit") ?? 100)) }
  }, si)
  on("POST", "/notificaciones/leer-todas", async () => {
    guardarLeidas([...leidas(), ...(await notificaciones()).map((n) => n.id)])
    return { no_leidas: 0 }
  }, si)
  on("POST", "/notificaciones/:id/leida", ({ params }: any) => {
    guardarLeidas([...leidas(), params.id])
    return { id: params.id, leida: true }
  }, si)

  on("GET", "/users", () => listaUsuarios(), si)
  on("GET", "/admin/users", () => listaUsuarios(), si)
  on("GET", "/users/company/:companyId", () => listaUsuarios(), si)
  on("GET", "/users/:id", ({ params }: any) => listaUsuarios().find((u) => u.id === params.id) ?? noEncontrado("Usuario"), si)
  on("POST", "/users", ({ body }: any) => {
    const u = { id: nuevoId("u"), is_active: true, must_change_password: false, company_id: EMPRESA_RESTAURANTE_ID, created_at: ahoraIso(), updated_at: ahoraIso(), ...body }
    guardarEquipo([...listaUsuarios(), u])
    return u
  }, si)
  on("PUT", "/users/:id", ({ params, body }: any) => {
    const lista = listaUsuarios()
    const u = lista.find((x) => x.id === params.id)
    if (!u) return noEncontrado("Usuario")
    Object.assign(u, body, { updated_at: ahoraIso() })
    guardarEquipo(lista)
    return u
  }, si)
  on("DELETE", "/users/:id", ({ params }: any) => {
    guardarEquipo(listaUsuarios().filter((u) => u.id !== params.id))
    return respond(204, null)
  }, si)

  on("GET", "/ai-assistant/suggestions", async () => {
    const r = await srv<{ sugerencias: string[] }>("/copiloto")
    return { suggestions: r.sugerencias, categories: [{ name: "Restaurante", questions: r.sugerencias }] }
  }, si)
  on("POST", "/ai-assistant/chat", async ({ body }: any) => {
    const r = await fetch(`${SRV}/copiloto`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta: body?.message ?? body?.pregunta ?? "" }) })
    const j = await r.json()
    return { response: j.respuesta ?? j.error ?? "No pude responder.", context: { company_id: EMPRESA_RESTAURANTE_ID }, suggestions: j.sugerencias ?? [] }
  }, si)
}

