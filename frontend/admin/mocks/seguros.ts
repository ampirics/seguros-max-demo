import { VERTICAL_INICIAL } from "@/lib/vertical"
import type { Conversacion, Mensaje } from "@/lib/seguros/tipos"

// Vertical seguros en modo demo: la bandeja, la sesión y los usuarios salen del servidor de MAX
// que corre dentro del panel (/srv/seguros). Las rutas de las otras verticales siguen intactas.

const CLAVE_NEGOCIO = "mock-negocio"
const CLAVE_USUARIO = "mock-usuario-seguros"
export const EMPRESA_MAX_ID = "0a0c0000-0000-4000-8000-000000000001"

export function esSeguros(): boolean {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_NEGOCIO) || "{}")
    return (g.tipo ?? VERTICAL_INICIAL) === "seguros"
  } catch {
    return VERTICAL_INICIAL === "seguros"
  }
}

export const EMPRESA_MAX = {
  id: EMPRESA_MAX_ID,
  name: "MAX Corredores de Seguros",
  description: "Intermediación y asesoría en seguros · Santo Domingo, Santiago y Punta Cana",
  logo_url: "/marca/logo-max.png",
  logoUrl: "/marca/logo-max.png",
  is_active: true,
  isActive: true,
  phone: "(809) 519-0655",
  email: "servicio@max.demo",
  address: "Av. 27 de Febrero esq. Abraham Lincoln, Unicentro Plaza, 5to. nivel, Santo Domingo",
  currency: "DOP",
  created_at: "2026-11-09T14:00:00Z",
  updated_at: "2026-11-09T14:00:00Z",
}

const FULL = { view: true, create: true, edit: true, delete: true }

// Una persona ficticia por perfil. Se entra con el correo del perfil y cualquier contraseña.
export const USUARIOS_MAX = [
  { id: "ricardo", email: "direccion@max.demo", name: "Ricardo Almánzar", role: "direccion", perfil: "Dirección comercial" },
  { id: "patricia", email: "patricia@max.demo", name: "Patricia Gómez", role: "ejecutivo", perfil: "Ejecutiva de personas" },
  { id: "manuel", email: "manuel@max.demo", name: "Manuel Ortega", role: "ejecutivo", perfil: "Ejecutivo de empresas" },
  { id: "yesenia", email: "servicio@max.demo", name: "Yesenia Marte", role: "servicio", perfil: "Servicio al cliente" },
  { id: "julio", email: "siniestros@max.demo", name: "Julio Pichardo", role: "siniestros", perfil: "Siniestros" },
  { id: "max-admin", email: "admin@max.demo", name: "Administrador", role: "admin", perfil: "Administración" },
].map((u) => ({
  ...u,
  is_active: true,
  must_change_password: false,
  company_id: EMPRESA_MAX_ID,
  permissions: { users: FULL, dashboard: { view: true }, customers: FULL, chat: FULL, orders: FULL, products: FULL },
  created_at: "2026-11-09T14:00:00Z",
  updated_at: "2026-11-09T14:00:00Z",
}))

const EXTRA = [
  { id: "eduardo", email: "eduardo@max.demo", name: "Eduardo Méndez", role: "ejecutivo", perfil: "Ejecutivo de personas" },
  { id: "luis", email: "luis@max.demo", name: "Luis Fernández", role: "ejecutivo", perfil: "Ejecutivo de personas, Santiago" },
  { id: "nicole", email: "nicole@max.demo", name: "Nicole Batista", role: "ejecutivo", perfil: "Ejecutiva de personas, Punta Cana" },
  { id: "gabriela", email: "gabriela@max.demo", name: "Gabriela Sosa", role: "ejecutivo", perfil: "Ejecutiva de empresas, Santiago" },
  { id: "ana", email: "ana@max.demo", name: "Ana Luisa Peña", role: "siniestros", perfil: "Siniestros, Santiago" },
].map((u) => ({ ...u, is_active: true, must_change_password: false, company_id: EMPRESA_MAX_ID, created_at: "2026-11-09T14:00:00Z", updated_at: "2026-11-09T14:00:00Z" }))

const equipo = () => [...USUARIOS_MAX, ...(EXTRA as typeof USUARIOS_MAX)]

export function usuarioActual() {
  let id: string | null = null
  try {
    id = localStorage.getItem(CLAVE_USUARIO)
  } catch {}
  return equipo().find((u) => u.id === id) ?? USUARIOS_MAX[0]
}

function elegirUsuario(email?: string) {
  const e = (email ?? "").toLowerCase()
  const u = equipo().find((x) => x.email === e) ?? equipo().find((x) => e.startsWith(x.email.split("@")[0])) ?? USUARIOS_MAX[0]
  try {
    localStorage.setItem(CLAVE_USUARIO, u.id)
  } catch {}
  return u
}

const iso = (ts: number) => new Date(ts).toISOString()
const ATENCION: Record<Conversacion["estado"], string> = { ia: "ia", esperando_equipo: "esperando_vendedor", equipo: "vendedor", cerrada: "cerrada" }

type ConvServidor = Conversacion & { cliente: { nombre: string; telefono: string } | null; ultimo: Mensaje | null }

function aConversacion(c: ConvServidor) {
  const asignado = equipo().find((u) => u.id === c.asignadoA)
  const ultimo = c.ultimo
  return {
    id: c.id,
    company_id: EMPRESA_MAX_ID,
    customer_name: c.cliente?.nombre ?? "Cliente",
    customer_phone: c.cliente?.telefono ?? "",
    cliente_id: c.clienteId,
    status: c.estado === "cerrada" ? "closed" : "active",
    conversation_status: c.estado === "cerrada" ? "resolved" : "open",
    unread_count: c.noLeidos,
    agent_requested: c.estado === "esperando_equipo",
    agent_requested_at: c.estado === "esperando_equipo" ? iso(c.pase?.desde ?? c.actualizada) : null,
    esperando_desde: c.estado === "esperando_equipo" ? iso(c.pase?.desde ?? c.actualizada) : null,
    is_whatsapp: c.canal === "whatsapp",
    channel: c.canal,
    canal: c.canal,
    assigned_to_id: c.asignadoA ?? null,
    assigned_to_name: asignado?.name ?? null,
    assigned_at: c.asignadoA ? iso(c.actualizada) : null,
    resolved_at: c.estado === "cerrada" ? iso(c.actualizada) : null,
    created_at: iso(c.creada),
    updated_at: iso(c.actualizada),
    last_message_text: ultimo ? (ultimo.voz ? "Nota de voz" : ultimo.adjunto ? `${ultimo.adjunto.tipo === "imagen" ? "Foto" : "Archivo"}: ${ultimo.texto}` : ultimo.texto) : "",
    last_message_timestamp: iso(ultimo?.ts ?? c.actualizada),
    last_inbound_text: ultimo?.de === "cliente" ? ultimo.texto : undefined,
    is_favorite: false,
    is_pinned: false,
    contact_match: "customer",
    contact_name: c.cliente?.nombre,
    customer_display_name: c.cliente?.nombre,
    estado_atencion: ATENCION[c.estado],
    motivo_pase_texto: c.pase?.motivo ?? null,
    brief_pase: c.pase?.brief ?? null,
    tema: c.tema,
    etiquetas: c.etiquetas,
    ia_pasos: [],
  }
}

function aMensaje(m: Mensaje) {
  const sender = m.de === "cliente" ? "user" : m.de === "ia" ? "bot" : m.de === "equipo" ? "admin" : "system"
  const texto = m.voz && !m.adjunto ? `Nota de voz · ${Math.floor(m.voz.segundos / 60)}:${String(m.voz.segundos % 60).padStart(2, "0")}` : m.texto
  return {
    id: m.id,
    conversation_id: m.conversacionId,
    conversationId: m.conversacionId,
    sender,
    message: texto,
    timestamp: iso(m.ts),
    read: true,
    is_read: true,
    is_edited: false,
    is_deleted: false,
    reactions: [],
    reply_to_id: null,
    replied_to_message: null,
    message_type: sender === "system" ? "aviso" : "text",
    metadata: {
      client_source: m.de === "ia" ? "mcp" : "web",
      ...(m.de === "equipo" ? { sent_via_whatsapp: true, autor: m.autor } : {}),
      ...(m.pasos ? { pasos_ia: m.pasos } : {}),
      ...(m.adjunto
        ? { media_type: m.adjunto.tipo === "imagen" ? "image" : m.adjunto.tipo === "pdf" ? "document" : "audio", media_url: m.adjunto.url, filename: m.adjunto.nombre, mime_type: m.adjunto.mime, is_voice: m.adjunto.tipo === "audio" }
        : {}),
    },
    ...(m.adjunto?.tipo === "audio" ? { media_url: m.adjunto.url, duracion_seg: m.adjunto.segundos ?? m.voz?.segundos, transcripcion: m.texto, transcripcion_estado: "lista" } : {}),
    ia_pasos: m.pasos?.map((p) => (p.ok ? p.resumen : `Pendiente: ${p.resumen}`)),
  }
}

const SRV = "/srv/seguros"

async function srv<T = any>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${SRV}${ruta}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error ?? "Error del servidor de MAX")
  return j
}

async function conversaciones() {
  const lista = await srv<ConvServidor[]>("/conversaciones")
  return lista.map(aConversacion).sort((a, b) => (a.last_message_timestamp < b.last_message_timestamp ? 1 : -1))
}

const patch = (id: string, cambios: Partial<Conversacion>) => srv(`/conversaciones/${id}`, { method: "PATCH", body: JSON.stringify(cambios) })

type On = (method: string, pattern: string, handler: (ctx: any) => unknown, cuando?: () => boolean) => void

function tokenDe(u: (typeof USUARIOS_MAX)[number]) {
  const b64 = (t: string) => btoa(unescape(encodeURIComponent(t))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
  const cuerpo = {
    sub: u.id,
    exp: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
    iat: Math.floor(Date.now() / 1000),
    user_role: u.role,
    active_company_id: EMPRESA_MAX_ID,
    user_companies: [{ id: EMPRESA_MAX_ID, name: EMPRESA_MAX.name, is_active: true }],
    permissions: u.permissions,
  }
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(cuerpo))}.${b64("mock-signature")}`
}

export function registrarSeguros(on: On, respond: (status: number, body: unknown) => unknown) {
  const si = esSeguros
  const login = ({ body }: any) => {
    const u = elegirUsuario(body?.email ?? body?.username)
    return { access_token: tokenDe(u), refresh_token: "mock-refresh", token_type: "bearer", user: u, companies: [EMPRESA_MAX], active_company_id: EMPRESA_MAX_ID }
  }
  on("POST", "/auth/login", login, si)
  on("POST", "/auth/refresh", () => login({ body: { email: usuarioActual().email } }), si)
  on("POST", "/auth/select-company", () => login({ body: { email: usuarioActual().email } }), si)
  on("GET", "/auth/me", () => usuarioActual(), si)
  on("GET", "/companies/me/companies", () => [EMPRESA_MAX], si)
  on("GET", "/companies", () => [EMPRESA_MAX], si)
  on("GET", "/companies/:id", () => EMPRESA_MAX, si)
  on("GET", "/users", () => equipo(), si)
  on("GET", "/users/", () => equipo(), si)
  on("GET", "/store-config", () => ({ company_id: EMPRESA_MAX_ID, store_name: EMPRESA_MAX.name, logo_url: EMPRESA_MAX.logo_url, primary_color: "#0047BB", currency: "DOP" }), si)
  on("GET", "/admin/company-settings", () => ({ company_id: EMPRESA_MAX_ID, sap_validation_enabled: false, currency: "DOP", timezone: "America/Santo_Domingo" }), si)
  on("GET", "/notificaciones", () => [], si)
  on("GET", "/notificaciones/no-leidas", () => ({ total: 0 }), si)

  const agentes = () => equipo().filter((u) => ["ejecutivo", "servicio", "siniestros", "direccion"].includes(u.role)).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
  on("GET", "/chat/conversations/agents", agentes, si)
  on("GET", "/chat/conversations/blocked", () => [], si)
  on("GET", "/chat/conversations/lite", () => conversaciones(), si)
  on("GET", "/chat/conversations/summary", async () => {
    const l = await conversaciones()
    return { total: l.length, open: l.filter((c) => c.status !== "closed").length, unread: l.reduce((s, c) => s + c.unread_count, 0), conversations: l }
  }, si)
  on("GET", "/chat/conversations", async () => {
    const l = await conversaciones()
    return Promise.all(l.map(async (c) => ({ ...c, messages: (await srv<Mensaje[]>(`/conversaciones/${c.id}/mensajes`)).map(aMensaje) })))
  }, si)
  on("GET", "/chat/agent-requests", async () =>
    (await conversaciones()).filter((c) => c.agent_requested).map((c) => ({ id: c.id, customer_name: c.customer_name, customer_phone: c.customer_phone, agent_requested_at: c.agent_requested_at, motivo_texto: c.motivo_pase_texto })),
  si)
  on("GET", "/chat/conversations/:id", async ({ params }: any) => {
    const c = (await conversaciones()).find((x) => x.id === params.id)
    if (!c) return respond(404, { detail: "Conversación no encontrada" })
    return { ...c, messages: (await srv<Mensaje[]>(`/conversaciones/${c.id}/mensajes`)).map(aMensaje) }
  }, si)
  on("GET", "/chat/conversations/:id/messages", async ({ params, query }: any) => {
    const lista = (await srv<Mensaje[]>(`/conversaciones/${params.id}/mensajes`)).map(aMensaje).reverse()
    const skip = Number(query.get("skip") ?? 0)
    const limit = Number(query.get("limit") ?? 30)
    return lista.slice(skip, skip + limit)
  }, si)
  const enviar = async ({ params, body }: any) => {
    const u = usuarioActual()
    const m = await srv<Mensaje>(`/conversaciones/${params.id}/mensajes`, { method: "POST", body: JSON.stringify({ texto: body?.message ?? "", autor: u.name, autorId: u.id }) })
    const msg = { ...aMensaje(m), metadata: { ...aMensaje(m).metadata, ...(body?.tempId ? { tempId: body.tempId } : {}) } }
    return { success: true, message: msg, whatsapp_result: { success: true, integration_id: "int-whatsapp", integration_name: "WhatsApp MAX", message_id: m.id, error: null }, method: "database_integration" }
  }
  on("POST", "/chat/conversations/:id/send-whatsapp-integration", enviar, si)
  on("POST", "/chat/conversations/:id/send-whatsapp", enviar, si)
  on("POST", "/chat/conversations/:id/send-whatsapp-quick", enviar, si)
  on("POST", "/chat/conversations/:id/messages", async (ctx: any) => (await enviar(ctx)).message, si)
  on("POST", "/chat/conversations/:id/mark-read", async ({ params }: any) => {
    await patch(params.id, { noLeidos: 0 })
    return { success: true }
  }, si)
  on("PATCH", "/chat/conversations/:id/status", async ({ params, body }: any) => {
    const cerrar = ["resolved", "closed"].includes(body?.status)
    await patch(params.id, { estado: cerrar ? "cerrada" : "ia" })
    return { id: params.id, conversation_status: cerrar ? "resolved" : "open", resolved_at: cerrar ? new Date().toISOString() : null }
  }, si)
  on("PATCH", "/chat/conversations/:id/assign", async ({ params, body }: any) => {
    const u = equipo().find((x) => x.id === body?.user_id || x.id === body?.assigned_to_id)
    await patch(params.id, { asignadoA: u?.id })
    return { id: params.id, assigned_to_id: u?.id ?? null, assigned_to_name: u?.name ?? null, assigned_at: u ? new Date().toISOString() : null }
  }, si)
  const atencion = async (id: string, estado: Conversacion["estado"], u?: { id: string }) => {
    await patch(id, { estado, ...(u ? { asignadoA: u.id } : {}) })
    return { estado_atencion: ATENCION[estado], asignado_a: u?.id ?? null }
  }
  on("POST", "/chat/conversations/:id/tomar", ({ params }: any) => atencion(params.id, "equipo", usuarioActual()), si)
  on("POST", "/chat/conversations/:id/devolver-a-ia", ({ params }: any) => atencion(params.id, "ia"), si)
  on("POST", "/chat/conversations/:id/transferir", ({ params, body }: any) => atencion(params.id, "equipo", equipo().find((u) => u.id === body?.a_usuario_id)), si)
  on("POST", "/chat/conversations/:id/request-agent", ({ params }: any) => atencion(params.id, "esperando_equipo"), si)
  on("POST", "/chat/conversations/:id/clear-agent-request", async ({ params }: any) => {
    await atencion(params.id, "equipo", usuarioActual())
    return { success: true }
  }, si)
  on("POST", "/chat/conversations/:id/end-agent-session", async ({ params }: any) => {
    await atencion(params.id, "ia")
    return { success: true, message: "La IA vuelve a atender esta conversación" }
  }, si)
}

/** Tiempo real de la bandeja: los avisos de MAX llegan como si fueran del WebSocket de ORA. */
export function puenteSeguros(url: string, emitir: (datos: unknown) => void): () => void {
  if (!esSeguros() || !url.includes("/ws/")) return () => {}
  const conversacionId = new URL(url, location.href).searchParams.get("conversation_id")
  const es = new EventSource(`${SRV}/stream`)
  const refrescar = (id: string, extra?: (conv: ReturnType<typeof aConversacion>, c: ConvServidor) => void) =>
    void srv<ConvServidor[]>("/conversaciones").then((l) => {
      const c = l.find((x) => x.id === id)
      if (!c) return
      const conv = aConversacion(c)
      extra?.(conv, c)
    })
  es.addEventListener("mensaje", (e) => {
    const { mensaje, conversacion } = JSON.parse((e as MessageEvent).data) as { mensaje: Mensaje; conversacion: Conversacion }
    if (conversacionId) {
      if (mensaje.conversacionId === conversacionId) emitir({ type: "new_message", message: aMensaje(mensaje) })
      return
    }
    refrescar(conversacion.id, (conv, c) => {
      emitir({ type: "conversation.updated", conversation: conv, last_message: aMensaje(mensaje) })
      if (c.estado === "esperando_equipo" && mensaje.de === "cliente")
        emitir({ type: "agent_requested", conversation_id: c.id, customer_name: conv.customer_name, customer_phone: conv.customer_phone, timestamp: new Date().toISOString(), motivo_texto: c.pase?.motivo ?? c.tema })
    })
  })
  es.addEventListener("conversacion", (e) => {
    const { conversacion } = JSON.parse((e as MessageEvent).data) as { conversacion: Conversacion }
    if (conversacionId && conversacion.id !== conversacionId) return
    refrescar(conversacion.id, (conv, c) => {
      emitir({ type: "conversation.status_changed", conversation_id: c.id, estado_atencion: conv.estado_atencion, asignado_a: c.asignadoA ?? null, agent_requested: conv.agent_requested })
      if (!conversacionId) emitir({ type: "conversation.updated", conversation: conv })
      if (c.estado === "esperando_equipo" && !conversacionId) emitir({ type: "agent_requested", conversation_id: c.id, customer_name: conv.customer_name, customer_phone: conv.customer_phone, timestamp: new Date().toISOString(), motivo_texto: c.pase?.motivo ?? c.tema })
    })
  })
  es.addEventListener("escribiendo", (e) => {
    const { conversacionId: id, activo } = JSON.parse((e as MessageEvent).data) as { conversacionId: string; activo: boolean }
    if (conversacionId && id === conversacionId) emitir({ type: activo ? "typing_start" : "typing_stop", sender_id: "ia", sender_name: "Asistente" })
  })
  return () => es.close()
}
