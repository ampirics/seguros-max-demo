import { getDb } from "./store"
import { ADMIN_USER_ID, BOT_GENERIC_REPLY, COMPANY, COMPANY_ID, DAY, newId, samePhone, digits } from "./data/common"
import { ADMIN_PERMISSIONS } from "./data/users"
import { ITBIS_RATE, buildOrderItem, isPaidStatus, recalcOrder, round2 } from "./data/orders"
import { precioSinItbis, totales, type CotizacionMock } from "./data/cotizaciones"
import { buscarPiezas, diagrama, fichaPieza, vehiculosDelCatalogo } from "./data/piezas"
import { REGLAS_MANTENIMIENTO, type VehiculoSeed } from "./data/vehiculos"
import { ETAPAS_ABIERTAS, MOTIVOS, type Etapa, type LeadMock } from "./data/leads"
import { BLOQUE_MIN } from "./data/agenda"
import { resultadosExternos } from "./data/busqueda-externa"
import extraccion from "./data/extraccion-piezas.json"
import { estadoReserva, existenciasSeed, reservaVigente, type ExistenciaMock } from "./data/inventario"
import { VPIC_DEMO, clavePieza, claveVehiculo, parsearMotor, vehiculosCatalogoSeed } from "./data/catalogo"
import { REF } from "./data/products"
import { plantillaCorreccion, plantillaRechazo } from "@/components/chat/plantillas"
import { modulosPorTipo } from "@/lib/api/negocio"
import { VERTICAL_INICIAL } from "@/lib/vertical"
import { registrarRestaurante } from "./restaurante"
import { registrarSeguros } from "./seguros"
import { registrarDatosRestaurante } from "./restaurante-datos"

export interface MockContext {
  method: string
  path: string
  params: Record<string, string>
  query: URLSearchParams
  body: any
}

export class MockResponse {
  constructor(public status: number, public body: unknown, public contentType = "application/json") {}
}

export const respond = (status: number, body: unknown, contentType?: string) => new MockResponse(status, body, contentType)
const notFound = (what = "Recurso") => respond(404, { detail: `${what} no encontrado` })

type Handler = (ctx: MockContext) => unknown | Promise<unknown>

interface Route {
  method: string
  regex: RegExp
  keys: string[]
  handler: Handler
  cuando?: () => boolean
}

const routes: Route[] = []

function on(method: string, pattern: string, handler: Handler, cuando?: () => boolean) {
  const keys: string[] = []
  const source = pattern
    .replace(/\/$/, "")
    .replace(/[.]/g, "\\.")
    .replace(/:(\w+)/g, (_, key) => {
      keys.push(key)
      return "([^/]+)"
    })
  routes.push({ method, regex: new RegExp(`^${source}/?$`), keys, handler, cuando })
}

export function matchRoute(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method && r.method !== "*") continue
    if (r.cuando && !r.cuando()) continue
    const m = r.regex.exec(path)
    if (!m) continue
    const params: Record<string, string> = {}
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
    return { handler: r.handler, params }
  }
  return null
}

registrarSeguros(on, respond)
registrarDatosRestaurante(on, respond)
registrarRestaurante(on, respond)

const now = () => new Date().toISOString()
const num = (v: string | null, fallback: number) => (v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : fallback)
const page = <T,>(list: T[], q: URLSearchParams, defLimit = 100) => {
  const skip = num(q.get("skip"), 0)
  const limit = num(q.get("limit"), defLimit)
  return { items: list.slice(skip, skip + limit), skip, limit, total: list.length, has_more: skip + limit < list.length }
}
const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
const matches = (term: string | null, ...fields: unknown[]) => !term || fields.some((f) => norm(f).includes(norm(term)))

// ===== Sesión =====

function base64url(text: string): string {
  return btoa(text).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
}

export function mockToken(): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  for (let n = 0; ; n++) {
    const raw = JSON.stringify({
      sub: ADMIN_USER_ID,
      exp: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
      iat: Math.floor(Date.now() / 1000),
      user_role: "admin",
      active_company_id: COMPANY_ID,
      user_companies: [{ id: COMPANY_ID, name: COMPANY.name, is_active: true }],
      permissions: ADMIN_PERMISSIONS,
      mock: n,
    })
    const payload = btoa(raw).replace(/=+$/, "")
    if (!/[+/]/.test(payload)) return `${header}.${payload}.${base64url("mock-signature")}`
  }
}

const me = () => getDb().users[0]

function loginResponse() {
  return {
    access_token: mockToken(),
    refresh_token: "mock-refresh",
    token_type: "bearer",
    user: me(),
    companies: [COMPANY],
    active_company_id: COMPANY_ID,
  }
}

on("POST", "/auth/login", loginResponse)
on("POST", "/auth/refresh", loginResponse)
on("POST", "/auth/select-company", loginResponse)
on("POST", "/auth/logout", () => ({ message: "Sesión cerrada" }))
on("GET", "/auth/me", () => me())
on("POST", "/auth/change-password", () => ({ message: "Contraseña actualizada" }))
on("GET", "/companies/me/companies", () => [COMPANY])
on("GET", "/companies", () => [COMPANY])
on("GET", "/companies/:id", () => COMPANY)
on("GET", "/admin/company-settings", () => ({ company_id: COMPANY_ID, sap_validation_enabled: false, currency: "DOP", timezone: "America/Santo_Domingo" }))
// Marca del cliente. En mock se guarda en el navegador para que sobreviva a la recarga.
const MARCA_MOCK = "mock-marca"
const IA_MOCK = "mock_ia_config"
const IA_BASE = {
  nombre_asistente: "el asistente de La Casa del Colt",
  revelar_ia: true,
  handoff: {
    frases: ["hablar con una persona", "hablar con alguien", "hablar con un vendedor", "quiero un humano", "persona real"],
    queja: true, descuento: false, devolucion: true,
    mensaje: "Claro, en breve te atiende una persona del equipo por aquí.",
    despues_de_cotizar: "vendedor",
  },
  tono: { estilo: "cercano", emojis: true, largo: "corto" },
  demora_segundos: 2,
  sesion_horas: 24,
  confianza_minima: 80,
  privacidad: {
    activo: true,
    texto: "Guardamos tus mensajes y los datos de tu vehículo para atenderte. Si quieres que los borremos, escríbenos 'borrar mis datos'.",
  },
  seguimiento: {
    consulta_sin_compra: false, horas: 20, volvio_a_haber: false, dias_volvio: 15, mantenimiento: false,
    reglas_mantenimiento: [{ pieza: "aceite", dias: 90 }, { pieza: "filtro de aire", dias: 180 }], max_por_semana: 2,
  },
  venta: { compra_sin_vendedor: false, monto_maximo: 0 },
  voz: { respuesta_audio: "si_nota", limite_mensual: 0 },
  seguridad: {
    activo: true, consultas_dia: 15, consultas_semana: 40, vehiculos_distintos: 4, cotizaciones_sin_compra: 5,
    puntaje_sospechoso: 60, accion: "sin_precios", duracion_dias: 30,
    mensaje_bloqueado: "Para atenderte mejor, un vendedor de la tienda te escribe por aquí.",
  },
}
on("GET", "/ia/configuracion", () => ({ ...IA_BASE, ...JSON.parse(localStorage.getItem(IA_MOCK) || "{}") }))
on("PUT", "/ia/configuracion", ({ body }) => {
  const nueva = { ...IA_BASE, ...JSON.parse(localStorage.getItem(IA_MOCK) || "{}"), ...(body as object) }
  localStorage.setItem(IA_MOCK, JSON.stringify(nueva))
  return nueva
})
on("GET", "/ia/origen-datos", () => ({
  activo: "sistema",
  fuentes: [
    { clave: "sistema", nombre: "Catálogo de este sistema", estado: "activo" },
    { clave: "sheets", nombre: "Google Sheets", estado: "proximamente" },
    { clave: "csv", nombre: "Archivo CSV o Excel", estado: "proximamente" },
    { clave: "erp", nombre: "ERP o API externa", estado: "proximamente" },
  ],
  productos: 641, marcas: ["Hyundai", "Mitsubishi"], actualizado: new Date().toISOString(),
}))
on("GET", "/marca", () => JSON.parse(localStorage.getItem(MARCA_MOCK) || "{}"))
on("PUT", "/marca", ({ body }) => {
  localStorage.setItem(MARCA_MOCK, JSON.stringify(body))
  return body
})
on("GET", "/store-config", () => ({ company_id: COMPANY_ID, store_name: COMPANY.name, logo_url: COMPANY.logo_url, primary_color: "#E8141C", currency: "DOP" }))

// ===== Productos =====

function filterProducts(q: URLSearchParams) {
  const visibility = q.get("visibility")
  const price = q.get("price")
  const onSale = q.get("on_sale")
  const category = q.get("category_code")
  const term = q.get("search")
  return getDb().products.filter((p) => {
    if (q.get("visible_only") === "true" || visibility === "visible") {
      if (!p.is_visible) return false
    } else if (visibility === "hidden" && p.is_visible) return false
    if (price === "zero" && p.price > 0) return false
    if (price === "priced" && !(p.price > 0)) return false
    if (onSale != null && String(p.is_on_sale) !== onSale) return false
    if (category && p.external_category_code !== category) return false
    return matches(term, p.name, p.sku, p.external_category_code, p.description)
  })
}

function listProducts({ query }: MockContext) {
  const list = filterProducts(query).slice().sort((a, b) => Number(!a.image) - Number(!b.image) || a.name.localeCompare(b.name, "es"))
  const pg = page(list, query)
  if (query.get("with_total") === "true") return { items: pg.items, total: pg.total, skip: pg.skip, limit: pg.limit }
  return pg.items
}

const findProduct = (id: string) => getDb().products.find((p) => p.id === id)

function bestSellers({ query }: MockContext) {
  const limit = num(query.get("limit"), 10)
  const days = num(query.get("days"), 30)
  const since = Date.now() - days * DAY
  const acc = new Map<string, any>()
  for (const o of getDb().orders) {
    if (!isPaidStatus(o.status) || new Date(o.created_at).getTime() < since) continue
    for (const it of o.items) {
      const row = acc.get(it.product_id) || {
        id: it.product_id, name: it.name, image: it.image, price: it.price, unit_quantity: 1, unit_type: "unidades",
        total_sold: 0, total_revenue: 0, order_count: 0,
      }
      row.total_sold += it.quantity
      row.total_revenue = round2(row.total_revenue + it.subtotal)
      row.order_count += 1
      acc.set(it.product_id, row)
    }
  }
  const best_sellers = [...acc.values()].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, limit)
  return { best_sellers, period_days: days, total_products: best_sellers.length }
}

on("GET", "/admin/products/stats/best-sellers", bestSellers)
on("POST", "/admin/products/generate-sku", () => ({ success: true, sku: `LCC-${Date.now().toString().slice(-6)}` }))
on("POST", "/admin/products/generate-sku-dynamic", () => ({ success: true, sku: `LCC-${Date.now().toString().slice(-6)}` }))
on("POST", "/admin/products/generate-skus-dynamic", () => ({ success: true, skus: [] }))
on("POST", "/admin/products/generate-skus-bulk", () => ({ success: true, skus: [] }))
on("POST", "/admin/products/import-csv", () => ({ success: true, created: 0, updated: 0, errors: [], dry_run: true }))
on("GET", "/admin/products", listProducts)
on("GET", "/products", listProducts)
on("GET", "/admin/products/:id", ({ params }) => findProduct(params.id) ?? notFound("Producto"))
on("GET", "/products/:id", ({ params }) => findProduct(params.id) ?? notFound("Producto"))
on("POST", "/admin/products", ({ body }) => {
  const product = {
    colors: [], sizes: [], details: [], generated_skus: [], images: [], gallery: [], image: "",
    ...body,
    id: newId("prod"),
    is_visible: body?.is_visible ?? true,
    isVisible: body?.is_visible ?? true,
    company_id: COMPANY_ID,
    created_at: now(),
    updated_at: now(),
  }
  getDb().products.unshift(product)
  return product
})
on("PUT", "/admin/products/:id", ({ params, body }) => {
  const p = findProduct(params.id)
  if (!p) return notFound("Producto")
  Object.assign(p, body, { updated_at: now() })
  if (body && "is_visible" in body) p.isVisible = body.is_visible
  return p
})
on("DELETE", "/admin/products/:id", ({ params }) => {
  const db = getDb()
  db.products = db.products.filter((p) => p.id !== params.id)
  return { message: "Product deleted successfully" }
})

// ===== Clientes =====

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)
const findCustomer = (id: string) => getDb().customers.find((c) => c.id === id)

on("GET", "/customers/stats", () => {
  const list = getDb().customers
  return {
    total_customers: list.length,
    customers_with_email: list.filter((c) => c.email).length,
    customers_with_phone: list.filter((c) => c.phone).length,
    customers_with_address: list.filter((c) => c.address).length,
    new_this_month: list.filter((c) => Date.now() - new Date(c.created_at).getTime() < 30 * DAY).length,
    completion_percentage: {
      email: pct(list.filter((c) => c.email).length, list.length),
      phone: pct(list.filter((c) => c.phone).length, list.length),
      address: pct(list.filter((c) => c.address).length, list.length),
    },
  }
})
on("GET", "/customers/find", ({ query }) => {
  const phone = query.get("phone")
  const doc = query.get("document")
  const c = getDb().customers.find((x) => (phone && samePhone(x.phone, phone)) || (doc && digits(x.document_id) === digits(doc)))
  return c ?? notFound("Cliente")
})
on("GET", "/customers", ({ query }) => {
  const phone = query.get("phone")
  const list = getDb().customers.filter(
    (c) => (!phone || samePhone(c.phone, phone)) && matches(query.get("search") || query.get("document"), c.name, c.email, c.phone, c.document_id, c.external_reference),
  )
  const pg = page(list, query, 50)
  return { data: pg.items, total: pg.total, has_more: pg.has_more, skip: pg.skip, limit: pg.limit }
})
on("GET", "/customers/:id/stats", ({ params }) => {
  const c = findCustomer(params.id)
  if (!c) return notFound("Cliente")
  const orders = getDb().orders.filter((o) => o.customer_id === c.id)
  const pending = orders.filter((o) => ["PENDING", "AWAITING_CONFIRMATION", "CONFIRMED"].includes(o.status))
  return {
    customer_id: c.id,
    customer_name: c.name,
    customer_phone: c.phone,
    order_stats: {
      pending: pending.length,
      paid: orders.filter((o) => isPaidStatus(o.status)).length,
      cancelled: orders.filter((o) => o.status === "CANCELLED").length,
      total: orders.length,
    },
    pending_orders: pending.map((o) => ({ order_number: o.order_number, order_id: o.id, date: o.created_at, amount: o.total, status: o.status })),
    total_pending_amount: round2(pending.reduce((s, o) => s + o.total, 0)),
  }
})
on("GET", "/customers/:id", ({ params }) => findCustomer(params.id) ?? notFound("Cliente"))
on("POST", "/customers", ({ body }) => {
  const c = { ...body, id: newId("cus"), company_id: COMPANY_ID, source: "manual", sap_active: null, created_at: now() }
  getDb().customers.unshift(c)
  return c
})
on("PUT", "/customers/:id", ({ params, body }) => {
  const c = findCustomer(params.id)
  if (!c) return notFound("Cliente")
  return Object.assign(c, body, { updated_at: now() })
})
on("DELETE", "/customers/:id", ({ params }) => {
  const db = getDb()
  db.customers = db.customers.filter((c) => c.id !== params.id)
  return { message: "Cliente eliminado" }
})
on("GET", "/customer-contacts/by-phone/:phone", ({ params }) => ({
  customers: getDb().customers.filter((c) => samePhone(c.phone, params.phone)),
}))
on("GET", "/customer-contacts/:id/contacts", ({ params }) => {
  const c = findCustomer(params.id)
  return c ? [{ id: `${c.id}-ct1`, customer_id: c.id, name: c.name, phone: c.phone, email: c.email, role: "Principal", is_primary: true }] : []
})

// ===== Órdenes =====

const findOrder = (id: string) => getDb().orders.find((o) => o.id === id || o.order_number === id)

function searchOrders(q: URLSearchParams) {
  const status = q.get("status")
  const after = q.get("created_after")
  const before = q.get("created_before")
  const term = q.get("search_text") || q.get("search")
  const dir = q.get("order_dir") === "asc" ? 1 : -1
  return getDb()
    .orders.filter((o) => {
      if (status && o.status.toUpperCase() !== status.toUpperCase()) return false
      if (after && o.created_at < new Date(after).toISOString()) return false
      if (before && o.created_at > new Date(before).toISOString()) return false
      return matches(term, o.order_number, o.customer_info?.name, o.customer_info?.phone, o.customer_info?.email, o.external_reference)
    })
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1) * dir)
}

on("GET", "/orders/search", ({ query }) => {
  const list = searchOrders(query)
  const pg = page(list, query, 10)
  return { orders: pg.items, total: pg.total, has_more: pg.has_more, created_after: query.get("created_after"), created_before: query.get("created_before") }
})
on("GET", "/orders/export/csv", ({ query }) => {
  const rows = searchOrders(query).map((o) =>
    [o.order_number, o.created_at, o.customer_info?.name, o.customer_info?.phone, o.status, o.subtotal, o.tax_amount, o.total].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
  )
  return respond(200, ["Orden,Fecha,Cliente,Teléfono,Estado,Subtotal,ITBIS,Total", ...rows].join("\n"), "text/csv")
})
on("POST", "/orders/calculate-taxes", ({ body }) => {
  const items: any[] = body?.items || []
  const subtotal = round2(items.reduce((s, it) => s + Number(it.subtotal ?? Number(it.unit_price) * Number(it.quantity)), 0))
  const amount = round2(subtotal * ITBIS_RATE)
  return { subtotal, taxes: [{ tax_id: "tax-itbis", name: "ITBIS", percentage: 18, subtotal_used: subtotal, amount }], total_taxes: amount, total: round2(subtotal + amount) }
})
on("POST", "/orders/product-taxes", () => ({ taxes: [{ tax_id: "tax-itbis", name: "ITBIS", percentage: 18 }] }))
on("GET", "/orders", ({ query }) => {
  const list = searchOrders(query)
  const pg = page(list, query, 50)
  return { orders: pg.items, total: pg.total }
})
const siguienteNumeroOrden = () => `LCC-${1037 + getDb().orders.length}`
on("POST", "/orders", ({ body }) => {
  const id = newId("ord")
  const items = (body?.items || []).map((it: any, i: number) =>
    buildOrderItem(id, { id: it.product_id, sku: it.product_sku || "", name: it.product_name || it.name || "Producto", price: Number(it.price) || 0, image: it.product_image || "" }, Number(it.quantity) || 1, Number(it.price) || 0, i),
  )
  const order = recalcOrder({
    id,
    order_number: siguienteNumeroOrden(),
    company_id: COMPANY_ID,
    status: (body?.status || "PENDING").toUpperCase(),
    customer_info: { name: body?.name, email: body?.email, phone: body?.phone, address: body?.address },
    notes: body?.notes || "",
    items,
    created_at: now(),
    updated_at: now(),
  })
  getDb().orders.unshift(order)
  return order
})
on("GET", "/orders/:id", ({ params }) => findOrder(params.id) ?? notFound("Orden"))
on("PUT", "/orders/:id", ({ params, body }) => {
  const o = findOrder(params.id)
  if (!o) return notFound("Orden")
  const { items, ...rest } = body || {}
  Object.assign(o, rest, { updated_at: now() })
  if (rest.status) o.status = String(rest.status).toUpperCase()
  if (rest.customer_name || rest.customer_phone || rest.customer_email || rest.shipping_address) {
    o.customer_info = {
      ...o.customer_info,
      ...(rest.customer_name ? { name: rest.customer_name } : {}),
      ...(rest.customer_phone ? { phone: rest.customer_phone } : {}),
      ...(rest.customer_email ? { email: rest.customer_email } : {}),
      ...(rest.shipping_address ? { address: rest.shipping_address } : {}),
    }
  }
  return recalcOrder(o)
})
on("GET", "/orders/:id/items", ({ params }) => findOrder(params.id)?.items ?? [])
on("GET", "/orders/:id/available-products", ({ query }) => {
  const term = query.get("search")
  const limit = num(query.get("limit"), 20)
  return getDb().products.filter((p) => p.is_visible && matches(term, p.name, p.sku)).slice(0, limit)
})
on("POST", "/orders/:id/items", ({ params, body }) => {
  const o = findOrder(params.id)
  if (!o) return notFound("Orden")
  const p = findProduct(String(body?.product_id))
  const ref = p
    ? { id: p.id, sku: p.sku, name: p.name, price: p.price, image: p.image }
    : { id: String(body?.product_id || ""), sku: body?.product_sku || "", name: body?.product_name || "Producto", price: Number(body?.price) || 0, image: "" }
  const item = buildOrderItem(o.id, ref, Number(body?.quantity) || 1, body?.price != null ? Number(body.price) : undefined, o.items.length)
  item.id = newId(`${o.id}-i`)
  o.items.push(item)
  recalcOrder(o)
  return item
})
on("PUT", "/orders/:id/items/:itemId", ({ params, body }) => {
  const o = findOrder(params.id)
  const it = o?.items.find((x: any) => x.id === params.itemId)
  if (!o || !it) return notFound("Ítem")
  Object.assign(it, body)
  it.subtotal = round2(Number(it.price) * Number(it.quantity))
  recalcOrder(o)
  return it
})
on("DELETE", "/orders/:id/items/:itemId", ({ params }) => {
  const o = findOrder(params.id)
  if (!o) return notFound("Orden")
  o.items = o.items.filter((x: any) => x.id !== params.itemId)
  recalcOrder(o)
  return { message: "Ítem eliminado" }
})

// ===== Dashboard y asistente =====

function dashboardStats() {
  const db = getDb()
  const t = Date.now()
  const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const startPrev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime()
  const startDay = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
  const ts = (o: any) => new Date(o.created_at).getTime()
  const paid = db.orders.filter((o) => isPaidStatus(o.status))
  const sum = (list: any[]) => round2(list.reduce((s, o) => s + o.total, 0))
  const counts = new Map<string, number>()
  for (const o of paid) for (const it of o.items) counts.set(it.name, (counts.get(it.name) || 0) + it.quantity)
  const star = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const onSale = db.products.filter((p) => p.is_on_sale)
  return {
    total_products: db.products.length,
    total_variants: 0,
    total_orders: db.orders.length,
    total_customers: db.customers.length,
    recent_orders: db.orders.filter((o) => t - ts(o) < 7 * DAY).length,
    revenue_last_month: sum(paid.filter((o) => ts(o) >= startPrev && ts(o) < startMonth)),
    revenue_this_month: sum(paid.filter((o) => ts(o) >= startMonth)),
    daily_sales: paid.filter((o) => ts(o) >= startDay).length,
    conversion_rate: Math.round((paid.length / Math.max(db.orders.length, 1)) * 1000) / 10,
    star_product: star,
    active_products: db.products.filter((p) => p.is_visible).length,
    products_on_sale: onSale.length,
    average_discount: onSale.length ? Math.round(onSale.reduce((s, p) => s + (p.discount_percentage || 0), 0) / onSale.length) : null,
    agent_requested_conversations: db.conversations.filter((c) => c.agent_requested).length,
    pending_payment_orders: db.orders.filter((o) => ["PENDING", "AWAITING_CONFIRMATION"].includes(o.status)).length,
    payment_failed_24h: 0,
    sap_pending_orders: null,
  }
}

const SUGGESTIONS = [
  "¿Cuántos pedidos quedaron pendientes de pago esta semana?",
  "¿Cuál es el producto más vendido del mes?",
  "¿Qué clientes mayoristas compraron en septiembre?",
  "¿Cuántas conversaciones esperan un agente?",
]

on("GET", "/admin/dashboard/stats", dashboardStats)
on("GET", "/ai-assistant/stats", () => {
  const db = getDb()
  return {
    stats: {
      total_orders: db.orders.length,
      new_orders: db.orders.filter((o) => Date.now() - new Date(o.created_at).getTime() < 7 * DAY).length,
      active_conversations: db.conversations.filter((c) => c.status !== "closed").length,
      total_users: db.users.length,
    },
  }
})
on("GET", "/ai-assistant/suggestions", () => ({ suggestions: SUGGESTIONS, categories: [{ name: "Ventas", questions: SUGGESTIONS }] }))
on("GET", "/ai-assistant/schema", () => ({ schema: {}, total_tables: 0, company_id: COMPANY_ID }))
on("POST", "/ai-assistant/chat", () => ({ response: BOT_GENERIC_REPLY, context: { company_id: COMPANY_ID }, suggestions: SUGGESTIONS.slice(0, 2) }))
on("POST", "/mcp/chat", () => ({ reply: BOT_GENERIC_REPLY, model_used: "mock", handoff_requested: false, tool_calls: [], timestamp: now() }))
on("GET", "/mcp/audit", () => [])

// ===== Chat / WhatsApp =====

const findConv = (id: string) => getDb().conversations.find((c) => c.id === id)

function sortedConversations() {
  return getDb().conversations.slice().sort((a, b) => (a.last_message_timestamp < b.last_message_timestamp ? 1 : -1))
}

function pushMessage(convId: string, data: { sender: string; message: string; metadata?: any; reply_to_id?: string | null }) {
  const db = getDb()
  const conv = findConv(convId)
  const list = (db.messages[convId] ||= [])
  const parent = data.reply_to_id ? list.find((m) => m.id === data.reply_to_id) : null
  const msg = {
    id: newId("msg"),
    conversation_id: convId,
    conversationId: convId,
    sender: data.sender,
    message: data.message,
    timestamp: now(),
    read: true,
    is_read: true,
    is_edited: false,
    is_deleted: false,
    reactions: [],
    reply_to_id: parent?.id ?? null,
    replied_to_message: parent ? { id: parent.id, sender: parent.sender, message: parent.message, is_deleted: parent.is_deleted } : null,
    message_type: data.metadata?.media_type ? "media" : "text",
    metadata: data.metadata ?? null,
  }
  list.push(msg)
  if (conv) {
    conv.last_message_text = data.metadata?.media_type === "audio" ? "🎤 Nota de voz" : data.message
    conv.last_message_timestamp = msg.timestamp
    conv.updated_at = msg.timestamp
    if (data.sender !== "user" && conv.status === "pending") conv.status = "active"
  }
  return msg
}

function sendWhatsApp({ params, body }: MockContext) {
  if (!findConv(params.id)) return notFound("Conversación")
  const msg = pushMessage(params.id, {
    sender: "admin",
    message: body?.message ?? "",
    reply_to_id: body?.reply_to_id,
    metadata: {
      sent_via_whatsapp: true,
      client_source: "web",
      whatsapp_message_id: `wamid.${Date.now()}`,
      admin_id: ADMIN_USER_ID,
      sent_at: now(),
      ...(body?.tempId ? { tempId: body.tempId } : {}),
    },
  })
  return {
    success: true,
    message: msg,
    whatsapp_result: { success: true, integration_id: "int-whatsapp", integration_name: "WhatsApp Colt", message_id: msg.metadata?.whatsapp_message_id, error: null },
    method: "database_integration",
  }
}

const agentsList = () =>
  getDb()
    .users.filter((u) => u.is_active && ["admin", "agent", "manager"].includes(u.role))
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))

on("GET", "/chat/conversations/lite", ({ query }) => page(sortedConversations(), query).items)
on("GET", "/chat/conversations/agents", agentsList)
on("GET", "/chat/conversations/blocked", () => [])
on("GET", "/chat/conversations/summary", ({ query }) => {
  const days = num(query.get("days"), 30)
  const list = getDb().conversations.filter((c) => Date.now() - new Date(c.updated_at).getTime() < days * DAY)
  const short = (rows: any[]) => rows.map(({ id, customer_name, customer_phone, status, unread_count, created_at, updated_at }) => ({ id, customer_name, customer_phone, status, unread_count, created_at, updated_at }))
  const by = (status: string) => list.filter((c) => c.status === status)
  return {
    nuevas: by("pending").filter((c) => c.unread_count > 0).length,
    pendientes: by("pending").length,
    activas: by("active").length,
    cerradas: by("closed").length,
    agente: list.filter((c) => c.agent_requested).length,
    days,
    ...(query.get("include_lists") === "true"
      ? { listas: { nuevas: short(by("pending").filter((c) => c.unread_count > 0)), pendientes: short(by("pending")), activas: short(by("active")), cerradas: short(by("closed")) } }
      : {}),
  }
})
on("GET", "/ws/ping", () => ({ ok: true }))
on("GET", "/pbx-config/status", () => ({ configured: false, extension_assigned: false }))
on("GET", "/chat/conversations", ({ query }) =>
  page(sortedConversations(), query).items.map((c) => ({ ...c, messages: getDb().messages[c.id] || [] })),
)
on("GET", "/chat/agent-requests", () =>
  getDb()
    .conversations.filter((c) => c.agent_requested)
    .map((c) => ({ id: c.id, customer_name: c.customer_name, customer_phone: c.customer_phone, agent_requested_at: c.agent_requested_at })),
)
on("GET", "/chat/conversations/:id", ({ params }) => {
  const c = findConv(params.id)
  return c ? { ...c, messages: getDb().messages[c.id] || [] } : notFound("Conversación")
})
on("GET", "/chat/conversations/:id/messages", ({ params, query }) => {
  const list = (getDb().messages[params.id] || []).slice().reverse()
  return page(list, query, 30).items
})
on("POST", "/chat/conversations/:id/messages", ({ params, body }) => {
  if (!findConv(params.id)) return notFound("Conversación")
  return pushMessage(params.id, { sender: body?.sender || "admin", message: body?.message ?? "", reply_to_id: body?.reply_to_id })
})
on("POST", "/chat/conversations/:id/send-whatsapp-integration", sendWhatsApp)
on("POST", "/chat/conversations/:id/send-whatsapp", sendWhatsApp)
on("POST", "/chat/conversations/:id/send-whatsapp-quick", sendWhatsApp)
on("POST", "/chat/conversations/:id/send-media-whatsapp", ({ params, body }) => {
  if (!findConv(params.id)) return notFound("Conversación")
  const type = body?.media_type || body?.type || "document"
  const msg = pushMessage(params.id, {
    sender: "admin",
    message: body?.caption || (type === "audio" ? "🎤 Nota de voz" : "📎 Archivo"),
    metadata: { sent_via_whatsapp: true, client_source: "web", media_type: type, media_url: body?.media_url || body?.url || "", filename: body?.filename },
  })
  return { success: true, message: msg }
})
on("POST", "/media/whatsapp/upload", () => ({ success: true, media_id: newId("media"), url: "", media_url: "" }))
on("POST", "/chat/conversations/:id/mark-read", ({ params }) => {
  const c = findConv(params.id)
  if (c) c.unread_count = 0
  return { success: true }
})
on("PUT", "/chat/conversations/:id", ({ params, body }) => {
  const c = findConv(params.id)
  if (!c) return notFound("Conversación")
  return Object.assign(c, body, { updated_at: now() })
})
on("PATCH", "/chat/conversations/:id/status", ({ params, body }) => {
  const c = findConv(params.id)
  if (!c) return notFound("Conversación")
  c.conversation_status = body?.status || c.conversation_status
  c.resolved_at = ["resolved", "closed"].includes(c.conversation_status) ? now() : null
  return { id: c.id, conversation_status: c.conversation_status, resolved_at: c.resolved_at }
})
on("PATCH", "/chat/conversations/:id/favorite", ({ params, body }) => {
  const c = findConv(params.id)
  if (c) c.is_favorite = !!body?.is_favorite
  return { id: params.id, is_favorite: !!body?.is_favorite }
})
on("PATCH", "/chat/conversations/:id/pin", ({ params, body }) => {
  const c = findConv(params.id)
  if (c) c.is_pinned = !!body?.is_pinned
  return { id: params.id, is_pinned: !!body?.is_pinned }
})
on("PATCH", "/chat/conversations/:id/assign", ({ params, body }) => {
  const c = findConv(params.id)
  if (!c) return notFound("Conversación")
  const agent = getDb().users.find((u) => u.id === body?.user_id || u.id === body?.assigned_to_id)
  c.assigned_to_id = agent?.id ?? null
  c.assigned_to_name = agent?.name ?? null
  c.assigned_at = agent ? now() : null
  return { id: c.id, assigned_to_id: c.assigned_to_id, assigned_to_name: c.assigned_to_name, assigned_at: c.assigned_at }
})
on("POST", "/chat/conversations/:id/request-agent", ({ params }) => {
  const c = findConv(params.id)
  if (c) Object.assign(c, { agent_requested: true, agent_requested_at: now() })
  return { success: true }
})
on("POST", "/chat/conversations/:id/clear-agent-request", ({ params }) => {
  const c = findConv(params.id)
  if (c) Object.assign(c, { agent_requested: false, agent_requested_at: null })
  return { success: true }
})
on("POST", "/chat/conversations/:id/end-agent-session", ({ params }) => {
  const c = findConv(params.id)
  if (c) Object.assign(c, { agent_requested: false, status: "active" })
  return { success: true, message: "El bot vuelve a atender esta conversación" }
})
function atencion(c: any, estado: string, agent: any) {
  Object.assign(c, {
    estado_atencion: estado,
    assigned_to_id: agent?.id ?? null,
    assigned_to_name: agent?.name ?? null,
    assigned_at: agent ? now() : null,
    agent_requested: false,
    ia_pasos: [],
  })
  return { estado_atencion: c.estado_atencion, asignado_a: c.assigned_to_id }
}
on("POST", "/chat/conversations/:id/tomar", ({ params }) => {
  const c = findConv(params.id)
  return c ? atencion(c, "vendedor", me()) : notFound("Conversación")
})
on("POST", "/chat/conversations/:id/devolver-a-ia", ({ params }) => {
  const c = findConv(params.id)
  return c ? atencion(c, "ia", null) : notFound("Conversación")
})
on("POST", "/chat/conversations/:id/transferir", ({ params, body }) => {
  const c = findConv(params.id)
  const agent = findUser(body?.a_usuario_id)
  if (!c || !agent) return notFound(c ? "Usuario" : "Conversación")
  return atencion(c, "vendedor", agent)
})
// ===== Piezas =====

const vehiculoDe = (q: URLSearchParams) => ({ marca: q.get("marca"), modelo: q.get("modelo"), anio: q.get("anio") ? Number(q.get("anio")) : null })
on("GET", "/piezas/vehiculos", () => vehiculosDelCatalogo(getDb().piezas).map((v) => ({
  ...v,
  motores: catalogoVehiculos()
    .filter((c) => c.estado === "aprobado" && c.motor && norm(c.marca) === norm(v.marca) && norm(c.modelo) === norm(v.modelo))
    .map((c) => ({ motor: c.motor, motor_codigo: c.motor_codigo, cilindrada: c.cilindrada, combustible: c.combustible, desde: c.anio_desde, hasta: c.anio_hasta })),
})))
on("GET", "/piezas/diagrama", ({ query }) => diagrama(getDb().piezas, vehiculoDe(query)))
on("GET", "/piezas/buscar", ({ query }) => {
  const r = buscarPiezas(getDb().piezas, { ...vehiculoDe(query), q: query.get("q"), sistema: query.get("sistema"), vin: query.get("vin"), sort: query.get("sort") })
  const items = page(r.items, query, 20).items.map(conExistencias).map(conCalidad)
  const reemplazos = reemplazosDe(query.get("q"))
  const nuevas = reemplazos.filter((x) => !items.some((i) => String(i.id) === String(x.pieza.id))).map((x) => conCalidad(conExistencias(x.pieza)))
  const marcadas = [...nuevas, ...items].map((i) => {
    const x = reemplazos.find((y) => String(y.pieza.id) === String(i.id))
    return x ? { ...i, reemplaza_a: x.reemplaza_a } : i
  })
  return { total: r.items.length + nuevas.length, vehiculo_detectado: r.vehiculo_detectado, items: marcadas }
})
// Proveedores simulados: respuestas de scripts/extraccion_piezas/proveedores_simulados.py para los casos de prueba.
const proveedoresDe = (q: string, v: { marca: string | null; modelo: string | null; anio: number | null }) => {
  if (!v.marca || !v.modelo || !v.anio) return []
  const clave = Object.keys(extraccion.proveedores).find((k) => norm(q).includes(k))
  const items = clave ? (extraccion.proveedores as Record<string, any[]>)[clave] : []
  return items.filter((r) => r.pieza.compatibilidad.some((c: any) =>
    norm(c.marca) === norm(v.marca) && norm(c.modelo) === norm(v.modelo) && v.anio! >= c.anio_desde && v.anio! <= (c.anio_hasta ?? 9999)))
}
on("GET", "/piezas/busqueda-externa", ({ query }) => {
  const q = query.get("q") ?? ""
  const v = vehiculoDe(query)
  const proveedores = proveedoresDe(q, v)
  return { items: [...proveedores, ...resultadosExternos(q, v)], aviso: v.anio ? extraccion.aviso : null }
})
on("POST", "/proveedores/agregar-al-inventario", ({ body }) => {
  const r = body?.resultado
  if (!r?.pieza?.numero) return respond(422, { detail: "Elige el resultado del proveedor." })
  if (r.ya_en_catalogo) return respond(409, { detail: `Ya está en el catálogo: SKU ${r.ya_en_catalogo.sku}` })
  const sku = `PEND-${String(r.pieza.numero).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`
  if (getDb().piezas.some((x) => x.sku === sku)) return respond(409, { detail: `Ya está en el catálogo: SKU ${sku}` })
  const id = Math.max(0, ...getDb().piezas.map((x) => Number(x.id) || 0)) + 1
  const c = r.pieza.compatibilidad?.[0]
  getDb().piezas.push({
    id, sku, nombre: `${r.pieza.nombre} ${r.pieza.numero} - ${r.pieza.marca_pieza}`, oem: r.pieza.numero, mpn: r.pieza.numero,
    fabricante: r.pieza.marca_pieza, condicion: "alterna", sistema: null, posicion: null, precio_dop: 0, disponible: false,
    imagen: r.imagen ?? null, vehiculo: c ? { marca: c.marca, modelo: c.modelo, anios: `${c.anio_desde}-${c.anio_hasta}`, motor: c.motor } : null,
  } as any)
  return respond(201, { id: String(id), sku })
})
on("GET", "/piezas/:id", ({ params }) => {
  const ficha = fichaPieza(getDb().piezas, getDb().catalogo, Number(params.id))
  if (!ficha) return notFound("Pieza")
  const filas = existenciasDe(String(ficha.id))
  const base = { ...conCalidad(ficha), relacionadas: relacionadasDe(String(ficha.id)) }
  return filas.length ? { ...conExistencias(base), existencia: filas } : { ...base, existencias: [] }
})
on("GET", "/piezas/:id/relaciones", ({ params }) => ({ relacionadas: relacionadasDe(params.id) }))
on("POST", "/piezas/:id/relaciones", ({ params, body }) => {
  if (!piezaDe(params.id) || (body?.relacionada_id && !piezaDe(body.relacionada_id))) return notFound("Pieza")
  if (!body?.relacionada_id && !body?.numero) return respond(422, { detail: "indica la pieza relacionada o el número" })
  if (body?.numero && !body?.relacionada_id && body?.tipo !== "reemplaza") return respond(422, { detail: "solo un reemplazo puede apuntar a un número que no está en el catálogo" })
  if (String(body?.relacionada_id) === params.id) return respond(422, { detail: "una pieza no se relaciona consigo misma" })
  const repetida = getDb().relaciones.some((r) => r.pieza_id === params.id && r.tipo === body.tipo
    && (body.relacionada_id ? r.relacionada_id === String(body.relacionada_id) : norm(r.numero) === norm(body.numero)))
  if (repetida) return respond(422, { detail: "esa relación ya existe" })
  getDb().relaciones.push({ id: newId("rel"), pieza_id: params.id, relacionada_id: body.relacionada_id ? String(body.relacionada_id) : null,
    numero: body.relacionada_id ? null : String(body.numero).trim(), tipo: body.tipo, nota: body.nota || null })
  return respond(201, { relacionadas: relacionadasDe(params.id) })
})
on("DELETE", "/piezas/:id/relaciones/:rel", ({ params }) => {
  const i = getDb().relaciones.findIndex((r) => r.id === params.rel && r.pieza_id === params.id)
  if (i < 0) return notFound("Relación")
  getDb().relaciones.splice(i, 1)
  return { ok: true }
})
on("PATCH", "/piezas/:id", ({ params, body }) => {
  const p = piezaDe(params.id)
  if (!p) return notFound("Pieza")
  if (!["original", "alterna"].includes(body?.calidad)) return respond(422, { detail: "calidad debe ser original o alterna" })
  ;(p as any).calidad = body.calidad
  const ficha = fichaPieza(getDb().piezas, getDb().catalogo, Number(params.id))
  return { ...conCalidad(ficha!), relacionadas: relacionadasDe(params.id), existencias: [] }
})

// ===== Inventario: sucursales, existencias, movimientos y reservas =====

const existencias = () => {
  const db = getDb()
  if (!db.existencias && db.piezas.length) db.existencias = existenciasSeed(db.piezas, db.sucursales)
  return db.existencias ?? []
}
const sucursalDe = (id: string) => getDb().sucursales.find((s) => s.id === id)
const piezaDe = (id: string) => getDb().piezas.find((p) => String(p.id) === String(id))
const reservado = (piezaId: string, sucursalId: string) =>
  getDb().reservas.filter((r) => r.pieza_id === piezaId && r.sucursal_id === sucursalId && reservaVigente(r)).reduce((n, r) => n + r.cantidad, 0)
const filaExistencia = (e: ExistenciaMock) => {
  const s = sucursalDe(e.sucursal_id)
  const r = reservado(e.pieza_id, e.sucursal_id)
  const disponible = Math.max(0, e.cantidad - r)
  return { sucursal_id: e.sucursal_id, sucursal: s?.nombre ?? "", cantidad: e.cantidad, reservado: r, disponible, ubicacion: e.ubicacion, actualizado: e.actualizado,
    minimo: e.minimo ?? null, bajo_minimo: e.minimo != null && disponible < e.minimo }
}
const existenciasDe = (piezaId: string) =>
  existencias().filter((e) => e.pieza_id === piezaId && sucursalDe(e.sucursal_id)?.activa).map(filaExistencia)
const conExistencias = <T extends { id: number | string; disponible: boolean }>(p: T) => {
  const filas = existenciasDe(String(p.id))
  return {
    ...p,
    disponible: filas.length ? filas.some((f) => f.disponible > 0) : p.disponible,
    existencias: filas.map(({ sucursal_id, sucursal, disponible }) => ({ sucursal_id, sucursal, disponible })),
  }
}
const sucursalVista = (s: ReturnType<typeof getDb>["sucursales"][number], completa: boolean) => {
  const { activa, ...resto } = s
  return completa ? s : resto
}
const existenciaDe = (piezaId: string, sucursalId: string) => {
  let e = existencias().find((x) => x.pieza_id === piezaId && x.sucursal_id === sucursalId)
  if (!e) {
    e = { pieza_id: piezaId, sucursal_id: sucursalId, cantidad: 0, ubicacion: null, actualizado: now() }
    existencias().push(e)
  }
  return e
}
const movimientoVista = (m: ReturnType<typeof getDb>["movimientos"][number]) =>
  ({ ...m, pieza: piezaDe(m.pieza_id)?.nombre ?? null, sucursal: sucursalDe(m.sucursal_id)?.nombre ?? null })
const mover = (piezaId: string, sucursalId: string, tipo: string, cantidad: number, motivo: string | null, ubicacion?: string | null, entra = false) => {
  const e = existenciaDe(piezaId, sucursalId)
  const antes = e.cantidad
  const despues = entra || tipo === "entrada" ? antes + cantidad : tipo === "ajuste" ? cantidad : antes - cantidad
  if (despues < 0) return null
  e.cantidad = despues
  if (ubicacion !== undefined) e.ubicacion = ubicacion || null
  e.actualizado = now()
  const m = { id: newId("mov"), pieza_id: piezaId, sucursal_id: sucursalId, tipo, cantidad: despues - antes, resultante: despues, motivo, referencia: null, usuario: "Cristian Sánchez", fecha: now() }
  getDb().movimientos.unshift(m)
  return m
}
const reservaVista = (r: ReturnType<typeof getDb>["reservas"][number]) => {
  const p = piezaDe(r.pieza_id)
  const e = existencias().find((x) => x.pieza_id === r.pieza_id && x.sucursal_id === r.sucursal_id)
  return { ...r, pieza: p?.nombre ?? "", sku: p?.sku ?? null, sucursal: sucursalDe(r.sucursal_id)?.nombre ?? "", ubicacion: e?.ubicacion ?? null, estado: estadoReserva(r),
    cotizacion_codigo: (r as any).cotizacion_codigo ?? null, hasta_la_venta: false, order_id: null }
}

on("GET", "/sucursales", ({ query }) => {
  const todas = query.get("todas") === "true"
  return getDb().sucursales.filter((s) => todas || s.activa).map((s) => sucursalVista(s, todas))
})
on("POST", "/sucursales", ({ body }) => {
  const nombre = String(body?.nombre ?? "").trim()
  if (!nombre) return respond(422, { detail: "nombre obligatorio" })
  if (getDb().sucursales.some((s) => norm(s.nombre) === norm(nombre))) return respond(409, { detail: "ya hay una sucursal con ese nombre" })
  const s = { id: newId("suc"), nombre, direccion: body?.direccion || null, telefono: body?.telefono || null, horario: body?.horario || null, activa: body?.activa !== false }
  getDb().sucursales.push(s)
  return respond(201, s)
})
on("PATCH", "/sucursales/:id", ({ params, body }) => {
  const s = sucursalDe(params.id)
  if (!s) return notFound("Sucursal")
  Object.assign(s, Object.fromEntries(Object.entries(body ?? {}).filter(([k]) => ["nombre", "direccion", "telefono", "horario", "activa", "almacen_sap"].includes(k))))
  return s
})
on("DELETE", "/sucursales/:id", ({ params }) => {
  const s = sucursalDe(params.id)
  if (!s) return notFound("Sucursal")
  s.activa = false
  return s
})

on("GET", "/inventario/existencias", ({ query }) => {
  const q = query.get("q")
  const list = existencias()
    .filter((e) => (!query.get("sucursal_id") || e.sucursal_id === query.get("sucursal_id"))
      && (!query.get("pieza_id") || e.pieza_id === query.get("pieza_id"))
      && (query.get("solo_con_existencia") !== "true" || e.cantidad > 0)
      && (query.get("bajo_minimo") !== "true" || filaExistencia(e).bajo_minimo)
      && matches(q, piezaDe(e.pieza_id)?.nombre, piezaDe(e.pieza_id)?.sku, e.ubicacion))
    .map((e) => {
      const p = piezaDe(e.pieza_id)
      return { pieza_id: e.pieza_id, sku: p?.sku ?? null, nombre: p?.nombre ?? "", sucursal_activa: !!sucursalDe(e.sucursal_id)?.activa, ...filaExistencia(e) }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.sucursal.localeCompare(b.sucursal))
  const { items, total } = page(list, query, 50)
  return { total, items }
})
on("PATCH", "/inventario/existencias/minimo", ({ body }) => {
  const p = piezaDe(body?.pieza_id)
  if (!p) return notFound("Pieza")
  if (!sucursalDe(body?.sucursal_id)) return notFound("Sucursal")
  const e = existenciaDe(String(p.id), body.sucursal_id)
  e.minimo = body.minimo == null || body.minimo === "" ? null : Number(body.minimo)
  return { pieza_id: e.pieza_id, sku: p.sku, nombre: p.nombre, sucursal_activa: !!sucursalDe(e.sucursal_id)?.activa, ...filaExistencia(e) }
})
on("GET", "/inventario/movimientos", ({ query }) => ({
  items: getDb().movimientos
    .filter((m) => (!query.get("pieza_id") || m.pieza_id === query.get("pieza_id")) && (!query.get("sucursal_id") || m.sucursal_id === query.get("sucursal_id")))
    .slice(0, num(query.get("limit"), 100))
    .map(movimientoVista),
}))
on("POST", "/inventario/movimientos", ({ body }) => {
  const { pieza_id, sucursal_id, tipo, cantidad, motivo, ubicacion, destino_id } = body ?? {}
  if (!piezaDe(pieza_id)) return notFound("Pieza")
  if (!sucursalDe(sucursal_id) || (tipo === "traslado" && !sucursalDe(destino_id))) return notFound("Sucursal")
  const salida = mover(String(pieza_id), sucursal_id, tipo, Number(cantidad), motivo || null, tipo === "traslado" ? undefined : ubicacion)
  if (!salida) return respond(409, { detail: "existencia_insuficiente" })
  const items = [salida]
  if (tipo === "traslado") items.push(mover(String(pieza_id), destino_id, tipo, Number(cantidad), motivo || null, undefined, true)!)
  return respond(201, { items: items.map(movimientoVista) })
})

on("GET", "/inventario/reservas", ({ query }) => {
  const estado = query.get("estado") ?? "vigente"
  return {
    items: getDb().reservas
      .filter((r) => (estado === "todas" || estadoReserva(r) === estado) && (!query.get("pieza_id") || r.pieza_id === query.get("pieza_id")))
      .map(reservaVista),
  }
})
on("POST", "/inventario/reservas", ({ body }) => {
  const piezaId = String(body?.pieza_id ?? "")
  const cantidad = Number(body?.cantidad ?? 1)
  if (!piezaDe(piezaId)) return notFound("Pieza")
  const opciones = existenciasDe(piezaId).filter((e) => e.disponible >= cantidad && (!body?.sucursal_id || e.sucursal_id === body.sucursal_id))
  const elegida = opciones.sort((a, b) => b.disponible - a.disponible || b.cantidad - a.cantidad)[0]
  if (!elegida) return respond(409, { detail: "sin_disponible" })
  const r = { id: newId("res"), pieza_id: piezaId, sucursal_id: elegida.sucursal_id, cantidad, conversation_id: body?.conversation_id ?? (body?.lead_id ? findLead(body.lead_id)?.conversacion_id : null) ?? null, lead_id: body?.lead_id ?? null, cotizacion_codigo: body?.cotizacion_codigo ?? null,
    vence: new Date(Date.now() + (Number(body?.horas) || 24) * 3600_000).toISOString(), liberada: null, creada: now(), creada_por: "Cristian Sánchez" }
  getDb().reservas.unshift(r)
  getDb().movimientos.unshift({ id: newId("mov"), pieza_id: piezaId, sucursal_id: elegida.sucursal_id, tipo: "reserva", cantidad, resultante: elegida.cantidad, motivo: null, referencia: `reserva ${r.id}`, usuario: r.creada_por, fecha: now() })
  return respond(201, reservaVista(r))
})
on("DELETE", "/inventario/reservas/:id", ({ params }) => {
  const r = getDb().reservas.find((x) => x.id === params.id)
  if (!r) return notFound("Reserva")
  if (r.liberada) return respond(409, { detail: "la reserva ya está liberada" })
  r.liberada = now()
  getDb().movimientos.unshift({ id: newId("mov"), pieza_id: r.pieza_id, sucursal_id: r.sucursal_id, tipo: "liberacion", cantidad: r.cantidad, resultante: null, motivo: null, referencia: `reserva ${r.id}`, usuario: "Cristian Sánchez", fecha: now() })
  return reservaVista(r)
})

on("POST", "/inventario/importar", async ({ body, query }) => {
  const texto: string = typeof body?.archivo?.text === "function" ? await body.archivo.text() : String(body?.archivo ?? "")
  const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim())
  const sep = (lineas[0] ?? "").split(";").length > (lineas[0] ?? "").split(",").length ? ";" : ","
  const cols = (lineas[0] ?? "").split(sep).map((c) => norm(c).trim())
  if (!["sku", "sucursal", "cantidad"].every((c) => cols.includes(c))) return respond(422, { detail: "faltan columnas: sku, sucursal, cantidad" })
  const vistos = new Set<string>()
  const filas = lineas.slice(1).map((linea, i) => {
    const v = Object.fromEntries(linea.split(sep).map((x, j) => [cols[j], x.trim()]))
    const p = getDb().piezas.find((x) => norm(x.sku) === norm(v.sku))
    const s = getDb().sucursales.find((x) => x.activa && norm(x.nombre) === norm(v.sucursal))
    const errores: string[] = []
    if (!p) errores.push("SKU no encontrado")
    if (!s) errores.push("sucursal no encontrada")
    const cantidad = /^\d+$/.test(v.cantidad ?? "") ? Number(v.cantidad) : null
    if (cantidad == null) errores.push("cantidad debe ser un número entero de 0 o más")
    const clave = `${p?.id}:${s?.id}`
    if (p && s && vistos.has(clave)) errores.push("la pieza y la sucursal ya están en otra fila")
    vistos.add(clave)
    const actual = p && s ? existencias().find((e) => e.pieza_id === String(p.id) && e.sucursal_id === s.id) : undefined
    const ubicacion = v.ubicacion || actual?.ubicacion || null
    const accion = errores.length ? "error" : !actual ? "nueva" : actual.cantidad !== cantidad || ubicacion !== actual.ubicacion ? "cambio" : "sin_cambio"
    return { fila: i + 2, sku: v.sku || null, sucursal: s?.nombre ?? v.sucursal ?? null, pieza_id: p ? String(p.id) : null, pieza: p?.nombre ?? null,
      sucursal_id: s?.id ?? null, cantidad, ubicacion, actual: actual?.cantidad ?? null,
      diferencia: !errores.length && cantidad != null ? cantidad - (actual?.cantidad ?? 0) : null, accion, errores }
  })
  const errores = filas.filter((f) => f.errores.length).length
  const cambios = filas.filter((f) => f.accion === "nueva" || f.accion === "cambio")
  const resumen = { filas, total: filas.length, errores, cambios: cambios.length, sin_cambio: filas.filter((f) => f.accion === "sin_cambio").length, aplicado: false }
  if (query.get("aplicar") !== "true") return resumen
  if (errores) return respond(422, { detail: `el archivo tiene ${errores} filas con errores; corrígelas antes de aplicar` })
  cambios.forEach((f) => mover(f.pieza_id!, f.sucursal_id!, "ajuste", f.cantidad!, "importación de existencias", f.ubicacion))
  return { ...resumen, aplicado: true }
})
on("GET", "/inventario/exportar", ({ query }) => {
  const filas = existencias().filter((e) => !query.get("sucursal_id") || e.sucursal_id === query.get("sucursal_id")).map((e) => {
    const p = piezaDe(e.pieza_id)
    const f = filaExistencia(e)
    return [p?.sku ?? "", f.sucursal, f.cantidad, f.ubicacion ?? "", `"${(p?.nombre ?? "").replace(/"/g, '""')}"`, f.reservado, f.disponible].join(",")
  })
  return respond(200, ["sku,sucursal,cantidad,ubicacion,nombre,reservado,disponible", ...filas].join("\n"), "text/csv")
})

// ===== Catálogo de vehículos, calidad, relaciones, piezas externas y SAP =====

const conCalidad = <T extends { condicion?: string | null }>(p: T) =>
  ({ ...p, calidad: ((p as any).calidad ?? (p.condicion === "original" ? "original" : "alterna")) as "original" | "alterna" })
const numeroLimpio = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
const relacionVista = (r: { id: string | null; tipo: string; nota: string | null; numero: string | null }, otra?: ReturnType<typeof piezaDe>) => {
  if (!otra) return { relacion_id: r.id, tipo: r.tipo, nota: r.nota, numero: r.numero, id: null, nombre: null, sku: null, precio_dop: null, disponible: false, calidad: null, imagen: null }
  const item = conCalidad(conExistencias(otra))
  return { relacion_id: r.id, tipo: r.tipo, nota: r.nota, numero: r.numero ?? otra.oem ?? null, id: String(otra.id), nombre: otra.nombre, sku: otra.sku,
    precio_dop: otra.precio_dop, disponible: item.disponible, calidad: item.calidad, imagen: otra.imagen }
}
function relacionadasDe(piezaId: string) {
  const db = getDb()
  const salientes = db.relaciones.filter((r) => r.pieza_id === piezaId).map((r) => relacionVista(r, r.relacionada_id ? piezaDe(r.relacionada_id) : undefined))
  const entrantes = db.relaciones.filter((r) => r.relacionada_id === piezaId && r.tipo === "reemplaza")
    .map((r) => relacionVista({ ...r, tipo: "reemplazada_por" }, piezaDe(r.pieza_id)))
  const lista = [...salientes, ...entrantes]
  if (!lista.some((r) => r.tipo === "lado_opuesto")) {
    const ficha = fichaPieza(db.piezas, db.catalogo, Number(piezaId))
    const opuesta = ficha?.equivalencias.find((e) => e.relacion === "lado_opuesto")
    if (opuesta) lista.push(relacionVista({ id: null, tipo: "lado_opuesto", nota: null, numero: null }, piezaDe(String(opuesta.id))))
  }
  return lista
}
function reemplazosDe(q: string | null) {
  const numeros = (q?.match(/[A-Za-z0-9][A-Za-z0-9-]{3,}[A-Za-z0-9]/g) ?? []).map(numeroLimpio).filter((n) => n.length >= 5 && /\d/.test(n))
  if (!numeros.length) return []
  return getDb().relaciones.filter((r) => r.tipo === "reemplaza").flatMap((r) => {
    const vieja = r.relacionada_id ? piezaDe(r.relacionada_id) : undefined
    const claves = [r.numero, vieja?.oem, vieja?.sku].map(numeroLimpio).filter(Boolean)
    const pieza = piezaDe(r.pieza_id)
    return pieza && numeros.some((n) => claves.includes(n))
      ? [{ pieza, reemplaza_a: { id: vieja ? String(vieja.id) : null, nombre: vieja?.nombre ?? null, numero: r.numero ?? vieja?.oem ?? null } }]
      : []
  })
}
const catalogoVehiculos = () => {
  const db = getDb()
  if (!db.vehiculosCatalogo && db.piezas.length) db.vehiculosCatalogo = vehiculosCatalogoSeed(db.piezas)
  return db.vehiculosCatalogo ?? []
}
const piezasDelVehiculo = (v: ReturnType<typeof catalogoVehiculos>[number]) => getDb().piezas.filter((p) => clavePieza(p) === claveVehiculo(v)).length
const CAMPOS_VEHICULO = ["marca", "modelo", "generacion", "anio_desde", "anio_hasta", "motor", "motor_codigo", "cilindrada", "combustible", "version", "transmision", "mercado"]
const datosVehiculo = (body: any) => Object.fromEntries(CAMPOS_VEHICULO.filter((k) => k in (body ?? {}))
  .map((k) => [k, k.startsWith("anio_") ? (body[k] === "" || body[k] == null ? null : Number(body[k])) : (String(body[k] ?? "").trim() || null)]))

on("GET", "/vehiculos-catalogo", ({ query }) => {
  const lista = catalogoVehiculos()
    .filter((v) => (!query.get("marca") || norm(v.marca) === norm(query.get("marca"))) && (!query.get("estado") || v.estado === query.get("estado"))
      && (!query.get("fuente") || v.fuente === query.get("fuente")) && matches(query.get("modelo"), v.modelo)
      && matches(query.get("q"), v.modelo, v.motor, v.motor_codigo, v.generacion))
    .sort((a, b) => a.marca.localeCompare(b.marca) || a.modelo.localeCompare(b.modelo) || (a.anio_desde ?? 9999) - (b.anio_desde ?? 9999) || (a.motor ?? "").localeCompare(b.motor ?? ""))
    .map((v) => ({ ...v, piezas: piezasDelVehiculo(v) }))
  const { items, total } = page(lista, query, 100)
  return { total, marcas: [...new Set(catalogoVehiculos().map((v) => v.marca))].sort(), items }
})
on("POST", "/vehiculos-catalogo/vpic", ({ body }) => {
  const marca = String(body?.marca ?? "").trim()
  const anio = Number(body?.anio)
  if (!marca || !anio) return respond(422, { detail: "marca y año son obligatorios" })
  const lista = catalogoVehiculos()
  const propuestos: string[] = []
  const ya: string[] = []
  for (const modelo of VPIC_DEMO[norm(marca)] ?? []) {
    if (lista.some((v) => norm(v.marca) === norm(marca) && norm(v.modelo) === norm(modelo) && (v.anio_desde ?? 0) <= anio && anio <= (v.anio_hasta ?? 9999))) { ya.push(modelo); continue }
    lista.push({ id: newId("vc"), marca: lista.find((v) => norm(v.marca) === norm(marca))?.marca ?? marca, modelo, generacion: null, anio_desde: anio, anio_hasta: anio,
      motor: null, motor_codigo: null, cilindrada: null, combustible: null, version: null, transmision: null, mercado: "EE. UU.", fuente: "vpic",
      estado: "propuesto", propuesto_por: "Cristian Sánchez", aprobado_por: null, aprobado_en: null })
    propuestos.push(modelo)
  }
  return { marca, anio, propuestos, ya_estaban: ya }
})
on("POST", "/vehiculos-catalogo/sembrar", () => ({ creados: 0, enlazados: 0, total: catalogoVehiculos().length }))
on("POST", "/vehiculos-catalogo", ({ body }) => {
  const datos = datosVehiculo(body)
  if (!datos.marca || !datos.modelo) return respond(422, { detail: "marca y modelo son obligatorios" })
  const v = { id: newId("vc"), marca: "", modelo: "", generacion: null, anio_desde: null, anio_hasta: null, transmision: null, mercado: null,
    ...parsearMotor((datos.motor as string) ?? null), ...datos, fuente: "manual" as const, estado: "propuesto" as const,
    propuesto_por: "Cristian Sánchez", aprobado_por: null, aprobado_en: null } as ReturnType<typeof catalogoVehiculos>[number]
  catalogoVehiculos().push(v)
  return respond(201, { ...v, piezas: 0 })
})
on("PATCH", "/vehiculos-catalogo/:id", ({ params, body }) => {
  const v = catalogoVehiculos().find((x) => x.id === params.id)
  if (!v) return notFound("Vehículo")
  Object.assign(v, datosVehiculo(body), { estado: "propuesto", propuesto_por: "Cristian Sánchez", aprobado_por: null, aprobado_en: null })
  return { ...v, piezas: piezasDelVehiculo(v) }
})
on("POST", "/vehiculos-catalogo/:id/aprobar", ({ params }) => {
  const v = catalogoVehiculos().find((x) => x.id === params.id)
  if (!v) return notFound("Vehículo")
  Object.assign(v, { estado: "aprobado", aprobado_por: "Cristian Sánchez", aprobado_en: now() })
  return { ...v, piezas: piezasDelVehiculo(v) }
})
on("DELETE", "/vehiculos-catalogo/:id", ({ params }) => {
  const lista = catalogoVehiculos()
  const i = lista.findIndex((x) => x.id === params.id)
  if (i < 0) return notFound("Vehículo")
  if (piezasDelVehiculo(lista[i])) return respond(409, { detail: "el vehículo tiene piezas ligadas" })
  lista.splice(i, 1)
  return { ok: true }
})

const FUENTE_EXTERNA = { fuente: "autoparts", nombre: "Auto Parts Catalog API", configurada: false, mensaje: "Sin conexión configurada: falta AUTOPARTS_API_KEY en el servidor." }
on("GET", "/piezas-externas", ({ query }) => {
  const estado = query.get("estado") ?? "propuesto"
  return { fuente: FUENTE_EXTERNA, items: getDb().piezasExternas.filter((p) => estado === "todas" || p.estado === estado) }
})
on("POST", "/piezas-externas/consultar", () => respond(409, { detail: "sin conexión configurada" }))
on("GET", "/piezas-externas/fuentes", () => ({ fuentes: extraccion.fuentes }))
// Lotes de scripts/extraccion_piezas/servicio.py para cada vehículo de las fuentes; el del boletín es de muestra.
on("POST", "/piezas-externas/traer", ({ body }) => {
  const fuente = extraccion.fuentes.find((f) => f.clave === body?.fuente)
  if (!fuente) return respond(422, { detail: `la fuente '${body?.fuente}' no se usa desde el panel.` })
  const doc = fuente.necesita_documento ? fuente.documentos.find((d) => d.id === body?.documento) : null
  if (fuente.necesita_documento && !doc) return respond(422, { detail: body?.documento ? `no existe el documento '${body.documento}'.` : `la fuente '${fuente.clave}' necesita elegir un documento.` })
  const anio = Number(body?.anio)
  const v = ((doc?.vehiculos ?? fuente.vehiculos) as { marca: string; modelo: string; anio_desde: number; anio_hasta: number }[])
    .find((x) => norm(x.marca) === norm(body?.marca) && norm(x.modelo) === norm(body?.modelo))
  if (!v || !(anio >= v.anio_desde && anio <= v.anio_hasta)) return respond(422, { detail: "vehículo no válido para esta fuente." })
  const lote = (extraccion.lotes as Record<string, any>)[`${fuente.clave}|${doc?.id ?? ""}|${v.marca}|${v.modelo}`]
  const referencia = [norm(v.modelo).replace(/\s+/g, "-"), anio, fuente.clave, doc?.id].filter(Boolean).join("-")
  const ya = new Set(getDb().piezasExternas.map((p) => p.resumen.id_fuente))
  const nuevos = (lote?.articulos ?? []).filter((a: any) => !ya.has(a.articleId))
  getDb().piezasExternas.unshift(...nuevos.map((a: any) => ({
    id: newId("pext"), fuente: lote.fuente.nombre, version: lote.fuente.version, fecha: now(), referencia, estado: "propuesto",
    resumen: { numero: a.articleNo, marca: a.supplierName, nombre: a.articleProductName, oem: a.oemNumbers.map((o: any) => o.oemNumber),
      imagen: a.s3image ? `/${String(a.s3image).replace(/^assets\//, "")}` : null, id_fuente: a.articleId },
    datos: a, revisado_por: null, revisado_en: null, nota: null, pieza_id: null,
  })))
  const total = lote?.articulos.length ?? 0
  return { referencia, nuevas: nuevos.length, ya_estaban: total - nuevos.length, resumen: lote?.resumen ?? { piezas: 0, avisos: [] }, notas: lote?.notas ?? [] }
})
on("POST", "/piezas-externas/:id/aprobar", ({ params }) => {
  const p = getDb().piezasExternas.find((x) => x.id === params.id)
  if (!p) return notFound("Pieza externa")
  Object.assign(p, { estado: "aprobado", revisado_por: me().name, revisado_en: now() })
  return p
})
on("DELETE", "/piezas-externas/lotes/:referencia", ({ params }) => {
  const db = getDb()
  const referencia = decodeURIComponent(params.referencia)
  const antes = db.piezasExternas.length
  db.piezasExternas = db.piezasExternas.filter((p) => !(p.referencia === referencia && p.estado === "propuesto"))
  const borradas = antes - db.piezasExternas.length
  if (!borradas) return respond(404, { detail: "el lote no tiene piezas por revisar" })
  return { referencia, borradas }
})
on("POST", "/piezas-externas/:id/incorporar", ({ params, body }) => {
  const p = getDb().piezasExternas.find((x) => x.id === params.id)
  if (!p) return notFound("Pieza externa")
  if (!body?.vehiculo_id) return respond(422, { detail: "falta el vehículo" })
  const v = catalogoVehiculos().find((x) => x.id === body.vehiculo_id)
  if (!v) return notFound("Vehículo")
  if (v.estado !== "aprobado") return respond(409, { detail: "el vehículo está propuesto: apruébalo antes de incorporar" })
  if (p.estado !== "propuesto") return respond(409, { detail: "la pieza ya no está por revisar" })
  Object.assign(p, { estado: "aprobado", revisado_por: me().name, revisado_en: now(), nota: "Pendiente por comprar" })
  return p
})
on("POST", "/piezas-externas/:id/rechazar", ({ params }) => {
  const p = getDb().piezasExternas.find((x) => x.id === params.id)
  if (!p) return notFound("Pieza externa")
  p.estado = "rechazado"
  return p
})

const estadoSap = () => ({
  conexion: false, mensaje: "Sin conexión configurada: no hay una integración SAP activa con credenciales.",
  activo: getDb().sapInventario.activo, intervalo_minutos: getDb().sapInventario.intervalo_minutos,
  proxima: getDb().sapInventario.activo ? new Date(Date.now() + getDb().sapInventario.intervalo_minutos * 60_000).toISOString() : null,
  ultima_ejecucion: null, ultimo_estado: null, ultimo_error: null,
  almacenes: getDb().sucursales.map((s) => ({ sucursal_id: s.id, sucursal: s.nombre, activa: s.activa, almacen_sap: s.almacen_sap ?? null })),
})
on("GET", "/inventario/sap", () => estadoSap())
on("PUT", "/inventario/sap", ({ body }) => {
  for (const [id, almacen] of Object.entries(body?.almacenes ?? {})) {
    const s = sucursalDe(id)
    if (s) s.almacen_sap = String(almacen ?? "").trim() || null
  }
  if (body?.activo != null) getDb().sapInventario.activo = !!body.activo
  if (body?.intervalo_minutos) getDb().sapInventario.intervalo_minutos = Number(body.intervalo_minutos)
  return estadoSap()
})
on("POST", "/inventario/sap/sincronizar", () => respond(409, { detail: "Sin conexión configurada: no hay una integración SAP activa con credenciales." }))

// ===== Búsqueda externa =====

const ORDEN_BUSQUEDA = { pendiente: 0, ofrecida: 1, aceptada: 2, descartada: 3 }
const findBusqueda = (id: string) => getDb().busquedasExternas.find((b) => b.id === id)
const leadDeBusqueda = (b: { lead_id: string | null }) => (b.lead_id ? getDb().leads.find((l) => l.id === b.lead_id) : undefined)

on("GET", "/busquedas-externas", ({ query }) => {
  const estado = query.get("estado")
  const items = getDb()
    .busquedasExternas.filter((b) => !estado || b.estado === estado)
    .sort((a, b) => ORDEN_BUSQUEDA[a.estado] - ORDEN_BUSQUEDA[b.estado] || b.actualizada.localeCompare(a.actualizada))
  return { total: items.length, items }
})
on("POST", "/busquedas-externas", ({ body }) => {
  const pieza = String(body?.pieza ?? "").trim().toLowerCase()
  if (!pieza) return respond(422, { detail: "Indica la pieza que buscas." })
  const v = body?.vehiculo
  const vehiculo = v?.marca && v?.modelo && v?.anio ? { marca: String(v.marca), modelo: String(v.modelo), anio: Number(v.anio) } : null
  const igual = getDb().busquedasExternas.find((b) => b.estado === "pendiente" && b.pieza === pieza && JSON.stringify(b.vehiculo) === JSON.stringify(vehiculo))
  if (igual) return igual
  const b = { id: newId("be"), pieza, vehiculo, cliente: null, conversacion_id: null, lead_id: null, origen: "vendedor" as const, estado: "pendiente" as const, oferta: null, creada: now(), actualizada: now() }
  getDb().busquedasExternas.unshift(b)
  return respond(201, b)
})
on("POST", "/busquedas-externas/:id/oferta", ({ params, body }) => {
  const b = findBusqueda(params.id)
  if (!b) return notFound("Búsqueda")
  if (!b.conversacion_id || !findConv(b.conversacion_id)) return respond(409, { detail: "Esta búsqueda no tiene una conversación a la que enviar la oferta." })
  if (b.estado === "aceptada" || b.estado === "descartada") return respond(409, { detail: "La búsqueda ya está cerrada." })
  const r = body?.resultado
  const precio = Number(body?.precio_dop)
  const dias = Number(body?.dias_estimados)
  const mensaje = String(body?.mensaje ?? "").trim()
  if (!r?.titulo) return respond(422, { detail: "Elige el resultado que vas a ofrecer." })
  if (!(precio > 0)) return respond(422, { detail: "Indica el precio al cliente." })
  if (!Number.isInteger(dias) || dias < 1) return respond(422, { detail: "Indica en cuántos días llega." })
  if (!mensaje) return respond(422, { detail: "Escribe el mensaje para el cliente." })
  const msg = pushMessage(b.conversacion_id, {
    sender: "admin",
    message: mensaje,
    metadata: { sent_via_whatsapp: true, client_source: "web", whatsapp_message_id: `wamid.${Date.now()}`, admin_id: ADMIN_USER_ID, sent_at: now() },
  })
  b.oferta = { resultado: r, precio_dop: round2(precio), dias_estimados: dias, mensaje, enviada: msg.timestamp, por: me().name }
  b.estado = "ofrecida"
  b.actualizada = now()
  const lead = leadDeBusqueda(b)
  if (lead && lead.etapa !== "ganada") Object.assign(lead, { etapa: "cotizada", motivo_perdida: null, nota_perdida: null, actualizado: now() })
  return b
})
on("PATCH", "/busquedas-externas/:id", ({ params, body }) => {
  const b = findBusqueda(params.id)
  if (!b) return notFound("Búsqueda")
  if (body?.estado !== "aceptada" && body?.estado !== "descartada") return respond(422, { detail: "Estado no válido." })
  if (b.estado === "aceptada" || b.estado === "descartada") return respond(409, { detail: "La búsqueda ya está cerrada." })
  if (body.estado === "aceptada" && b.estado !== "ofrecida") return respond(409, { detail: "Primero envía una oferta al cliente." })
  b.estado = body.estado
  b.actualizada = now()
  const lead = leadDeBusqueda(b)
  if (lead && lead.etapa !== "ganada") {
    if (b.estado === "aceptada") Object.assign(lead, { etapa: "ganada", vendedor_cierre: me().name, actualizado: now() })
    else if (lead.etapa !== "perdida") Object.assign(lead, { etapa: "perdida", motivo_perdida: "sin_existencia", nota_perdida: null, actualizado: now() })
  }
  return b
})

// ===== Cotizaciones =====

const versionesDe = (codigo: string) => getDb().cotizaciones.filter((q) => q.codigo === codigo).sort((a, b) => a.version - b.version)
const vigente = (codigo: string) => versionesDe(codigo).at(-1)
const ordenDe = (codigo: string) => {
  const o = getDb().orders.find((x) => x.cotizacion_codigo === codigo)
  return o ? { id: o.id, numero: o.order_number } : null
}
const vehiculoTexto = (v: CotizacionMock["vehiculo"] | string) =>
  !v || typeof v === "string" ? v ?? null : [v.marca, v.modelo, v.anio].filter(Boolean).join(" ")
const conVersiones = (q: CotizacionMock) => ({ ...q, vehiculo: vehiculoTexto(q.vehiculo), versiones: versionesDe(q.codigo).map((v) => v.version), orden: ordenDe(q.codigo) })

const enPeriodo = (iso: string, q: URLSearchParams) => {
  const desde = q.get("desde")
  const hasta = q.get("hasta")
  const t = new Date(iso).getTime()
  return (!desde || t >= new Date(`${desde}T00:00:00`).getTime()) && (!hasta || t < new Date(`${hasta}T00:00:00`).getTime() + DAY)
}

on("GET", "/cotizaciones", ({ query }) => {
  const estado = query.get("estado")
  const conv = query.get("conversation_id")
  const codigos = [...new Set(getDb().cotizaciones.map((q) => q.codigo))]
  const list = codigos
    .map((c) => vigente(c)!)
    .filter((q) => (!estado || q.estado === estado)
      && (!conv || q.conversacion_id === conv || findConv(conv)?.cotizacion_codigo === q.codigo)
      && (!query.get("cliente_id") || q.cliente.id === query.get("cliente_id"))
      && (!query.get("vendedor_id") || q.vendedor.id === query.get("vendedor_id"))
      && matches(query.get("q"), q.codigo, q.cliente.nombre, q.vehiculo?.modelo)
      && enPeriodo(q.creada, query)
      && !(query.get("ocultar_cerradas") === "true" && ["aceptada", "rechazada", "vencida"].includes(q.estado)))
    .sort((a, b) => b.creada.localeCompare(a.creada))
  return {
    total: list.length,
    items: page(list, query, 50).items.map((q) => ({ ...q, vehiculo: vehiculoTexto(q.vehiculo), orden: ordenDe(q.codigo) })),
  }
})
on("GET", "/cotizaciones/:codigo", ({ params, query }) => {
  const version = query.get("version")
  const q = version ? versionesDe(params.codigo).find((v) => v.version === Number(version)) : vigente(params.codigo)
  return q ? conVersiones(q) : notFound("Cotización")
})
const lineaDe = (i: any) => {
  const p = piezaDe(String(i?.pieza_id))
  return p ? { pieza_id: Number(p.id), descripcion: p.nombre, cantidad: Number(i.cantidad ?? 1), precio_dop: Number(i.precio_dop ?? p.precio_dop) } : null
}
const ligarLeads = (codigo: string, convId: string | null, leadId: string | null) => {
  for (const l of getDb().leads.filter((x) => x.id === leadId || (convId && x.conversacion_id === convId))) {
    if (!l.cotizacion_codigo || l.id === leadId) l.cotizacion_codigo = codigo
    l.actualizado = now()
  }
}
on("POST", "/cotizaciones", ({ body }) => {
  const items = (body?.items ?? []).map(lineaDe).filter(Boolean)
  if (!items.length) return respond(422, { detail: "la cotización necesita al menos una pieza del catálogo" })
  const db = getDb()
  const conv = body?.conversation_id ? findConv(body.conversation_id) : null
  const lead = body?.lead_id ? findLead(body.lead_id) : null
  const clienteId = body?.cliente_id ?? (conv as any)?.customer_id ?? lead?.cliente_id ?? null
  const cliente = db.customers.find((x) => x.id === clienteId)
  const v = db.vehiculos.find((x) => x.id === (body?.vehiculo_id ?? lead?.vehiculo_id))
  const numero = Math.max(0, ...db.cotizaciones.map((q) => Number(q.codigo.replace(/\D/g, "")) || 0)) + 1
  const creada = new Date()
  const q: CotizacionMock = {
    codigo: `COT-${String(numero).padStart(4, "0")}`, version: 1, estado: "borrador",
    creada: creada.toISOString(), vence: new Date(creada.getTime() + 7 * DAY).toISOString().slice(0, 10),
    cliente: { id: cliente?.id ?? clienteId ?? "", nombre: cliente?.name ?? conv?.customer_name ?? lead?.cliente ?? "Cliente" },
    vehiculo_id: v?.id ?? null, vehiculo: v ? { id: v.id, marca: v.marca, modelo: v.modelo, anio: v.anio, motor: v.motor ?? "" } : null,
    vendedor: { id: me().id, nombre: me().name }, conversacion_id: conv?.id ?? lead?.conversacion_id ?? null,
    items, ...totales(items), pdf_url: "",
  }
  q.pdf_url = `/api/v1/cotizaciones/${q.codigo}/pdf`
  db.cotizaciones.push(q)
  ligarLeads(q.codigo, q.conversacion_id, lead?.id ?? null)
  return respond(201, conVersiones(q))
})
on("PUT", "/cotizaciones/:codigo", ({ params, body }) => {
  const q = vigente(params.codigo)
  if (!q) return notFound("Cotización")
  if (q.estado !== "borrador" || ordenDe(q.codigo)) return respond(409, { detail: "Solo se edita una cotización en borrador. Crea una nueva versión." })
  for (const i of body?.items ?? []) {
    const actual = q.items.find((x) => x.pieza_id === Number(i.pieza_id))
    if (actual) Object.assign(actual, { cantidad: Number(i.cantidad), ...(i.precio_dop != null ? { precio_dop: Number(i.precio_dop) } : {}) })
    else { const nueva = lineaDe(i); if (nueva) q.items.push(nueva) }
  }
  q.items = q.items.filter((i) => i.cantidad > 0)
  Object.assign(q, totales(q.items))
  return conVersiones(q)
})
on("POST", "/cotizaciones/:codigo/versiones", ({ params }) => {
  const q = vigente(params.codigo)
  if (!q) return notFound("Cotización")
  if (q.estado === "borrador") return respond(409, { detail: "Esta cotización ya tiene un borrador abierto." })
  if (ordenDe(q.codigo)) return respond(409, { detail: "Esta cotización ya se convirtió en orden." })
  const creada = new Date()
  const nueva = {
    ...JSON.parse(JSON.stringify(q)),
    version: q.version + 1,
    estado: "borrador",
    creada: creada.toISOString(),
    vence: new Date(creada.getTime() + 7 * DAY).toISOString().slice(0, 10),
  }
  getDb().cotizaciones.push(nueva)
  return conVersiones(nueva)
})
on("POST", "/cotizaciones/:codigo/convertir-en-orden", ({ params }) => {
  const q = vigente(params.codigo)
  if (!q) return notFound("Cotización")
  const previa = ordenDe(q.codigo)
  if (previa) return respond(409, { detail: `Ya se convirtió en la orden ${previa.numero}.` })
  if (q.estado === "vencida" || q.estado === "rechazada") return respond(409, { detail: "Una cotización vencida o rechazada no se convierte. Crea una nueva versión." })
  const c = getDb().customers.find((x) => x.id === q.cliente.id)
  const id = newId("ord")
  const items = q.items.map((it, i) => {
    const p = getDb().piezas.find((x) => x.id === it.pieza_id)
    return buildOrderItem(id, { id: String(it.pieza_id), sku: p?.sku ?? "", name: it.descripcion, price: it.precio_dop, image: p?.imagen ?? "" }, it.cantidad, precioSinItbis(it.precio_dop), i)
  })
  const contacto = { name: q.cliente.nombre, email: c?.email ?? "", phone: c?.phone ?? "", address: c?.address ?? "" }
  const orden = recalcOrder({
    id,
    order_number: siguienteNumeroOrden(),
    company_id: COMPANY_ID,
    status: "PENDING",
    payment_status: "pending",
    payment_reference: null,
    customer_id: q.cliente.id,
    customer_name: contacto.name,
    customer_email: contacto.email,
    customer_phone: contacto.phone,
    shipping_address: "Retiro en tienda · Villas Agrícolas",
    shipping_method: "pickup",
    customer_info: contacto,
    notes: `Desde la cotización ${q.codigo} v${q.version}.`,
    cotizacion_codigo: q.codigo,
    items,
    created_at: now(),
    updated_at: now(),
  })
  getDb().orders.unshift(orden)
  q.estado = "aceptada"
  avanzarLead(q.codigo, "ganada")
  return { orden_id: orden.id, numero: orden.order_number }
})
on("POST", "/cotizaciones/:codigo/enviar-whatsapp", ({ params }) => {
  const q = vigente(params.codigo)
  if (!q) return notFound("Cotización")
  if (q.estado === "borrador") q.estado = "enviada"
  avanzarLead(q.codigo, "cotizada")
  const c = (q.conversacion_id && findConv(q.conversacion_id)) || getDb().conversations.find((x) => x.cotizacion_codigo === q.codigo)
  if (!c) return { enviada: true, mensaje_id: null }
  Object.assign(c, { resultado: "cotizada", ia_pasos: [], cotizacion_codigo: q.codigo })
  const msg = pushMessage(c.id, {
    sender: "admin",
    message: `Cotización ${q.codigo} v${q.version} · Total RD$${q.total_dop.toLocaleString("en-US")} · Vence ${q.vence}`,
    metadata: { sent_via_whatsapp: true, client_source: "web", whatsapp_message_id: `wamid.${Date.now()}`, media_type: "document", media_url: q.pdf_url, filename: `${q.codigo}-v${q.version}.pdf` },
  })
  return { enviada: true, mensaje_id: msg.id }
})
on("POST", "/chat/conversations/:id/unblock", () => ({ success: true, message: "Conversación desbloqueada" }))
on("PATCH", "/chat/conversations/:id/messages/:mid", ({ params, body }) => {
  const m = (getDb().messages[params.id] || []).find((x) => x.id === params.mid)
  if (!m) return notFound("Mensaje")
  return Object.assign(m, { original_content: m.original_content ?? m.message, message: body?.message ?? body?.content ?? m.message, is_edited: true, edited_at: now() })
})
on("DELETE", "/chat/conversations/:id/messages/:mid", ({ params }) => {
  const m = (getDb().messages[params.id] || []).find((x) => x.id === params.mid)
  if (!m) return notFound("Mensaje")
  return Object.assign(m, { is_deleted: true, deleted_at: now(), message: "Este mensaje fue eliminado" })
})
on("POST", "/chat/conversations/:id/messages/:mid/reactions", ({ params, body }) => {
  const m = (getDb().messages[params.id] || []).find((x) => x.id === params.mid)
  if (!m) return notFound("Mensaje")
  const emoji = body?.emoji
  const existing = m.reactions.find((r: any) => r.emoji === emoji)
  if (existing?.reacted_by_me) m.reactions = m.reactions.filter((r: any) => r.emoji !== emoji)
  else m.reactions.push({ emoji, count: 1, reacted_by_me: true, users: [{ user_id: ADMIN_USER_ID, user_name: me().name }] })
  return m
})
on("GET", "/chat/conversations/:id/notes", ({ params }) => getDb().notes[params.id] || [])
on("POST", "/chat/conversations/:id/notes", ({ params, body }) => {
  const note = { id: newId("note"), conversation_id: params.id, author_id: ADMIN_USER_ID, author_name: me().name, content: body?.content ?? "", created_at: now(), updated_at: now() }
  ;(getDb().notes[params.id] ||= []).unshift(note)
  return note
})
on("PUT", "/chat/conversations/:id/notes/:noteId", ({ params, body }) => {
  const n = (getDb().notes[params.id] || []).find((x) => x.id === params.noteId)
  if (!n) return notFound("Nota")
  return Object.assign(n, { content: body?.content ?? n.content, updated_at: now() })
})
on("DELETE", "/chat/conversations/:id/notes/:noteId", ({ params }) => {
  const db = getDb()
  db.notes[params.id] = (db.notes[params.id] || []).filter((x) => x.id !== params.noteId)
  return respond(204, null)
})
const tagsOf = (convId: string) => {
  const db = getDb()
  return (db.conversationTags[convId] || []).map((id) => db.tags.find((t) => t.id === id)).filter(Boolean)
}
on("GET", "/chat/tags", () => getDb().tags)
on("POST", "/chat/tags", ({ body }) => {
  const tag = { id: newId("tag"), company_id: COMPANY_ID, name: body?.name, color: body?.color || "#64748b", created_at: now(), updated_at: now() }
  getDb().tags.push(tag)
  return tag
})
on("PUT", "/chat/tags/:id", ({ params, body }) => {
  const t = getDb().tags.find((x) => x.id === params.id)
  if (!t) return notFound("Etiqueta")
  return Object.assign(t, body, { updated_at: now() })
})
on("DELETE", "/chat/tags/:id", ({ params }) => {
  const db = getDb()
  db.tags = db.tags.filter((t) => t.id !== params.id)
  return respond(204, null)
})
on("GET", "/chat/conversations/:id/tags", ({ params }) => tagsOf(params.id))
on("PUT", "/chat/conversations/:id/tags", ({ params, body }) => {
  getDb().conversationTags[params.id] = body?.tag_ids || []
  return tagsOf(params.id)
})
on("GET", "/chat/whatsapp/status", () => ({ status: "connected", connected: true, phone_number: "+1 809-684-1243", display_name: COMPANY.name, quality_rating: "GREEN" }))
on("GET", "/chat/whatsapp/config-status", () => ({ configured: true, success: true, status: "ok", integration_name: "WhatsApp Colt", phone_number: "+1 809-684-1243" }))
on("GET", "/chat/whatsapp/integrations", () => ({ integrations: [{ id: "int-whatsapp", name: "WhatsApp Colt", is_active: true, phone_number: "+18096841243" }] }))
on("POST", "/chat/whatsapp/test", () => ({ success: true, message: "Conexión con WhatsApp OK (simulada)" }))

// ===== Campañas =====

const withBody = (t: any) => ({ ...t, body: t.components?.find((c: any) => c.type === "BODY")?.text || "" })
const findCampaign = (id: string) => getDb().campaigns.find((c) => c.id === id)
const audience = () => {
  const list = getDb().customers.filter((c) => c.phone)
  return { count: list.length, excluded_no_optin: 0, excluded_no_phone: getDb().customers.length - list.length, sample: list.slice(0, 5).map((c) => ({ name: c.name, phone_e164: "+1" + digits(c.phone) })) }
}

on("GET", "/admin/campaigns/templates/meta", () => ({ success: true, templates: getDb().templates.map(withBody) }))
on("POST", "/admin/campaigns/templates/meta", ({ body }) => {
  const t = { id: newId("tpl"), name: body?.name, language: body?.language || "es", category: body?.category || "MARKETING", status: "PENDING", components: [{ type: "BODY", text: body?.body_text || "" }] }
  getDb().templates.push(t)
  return { success: true, name: t.name, status: t.status, id: t.id }
})
on("POST", "/admin/campaigns/preview-audience", audience)
on("GET", "/admin/campaigns", ({ query }) => {
  const status = query.get("status")
  const list = getDb()
    .campaigns.filter((c) => (!status || c.status === status) && matches(query.get("q"), c.name, c.template_name))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const pg = page(list, query, 20)
  return { items: pg.items, total: pg.total }
})
on("POST", "/admin/campaigns", ({ body }) => {
  const id = newId("cmp")
  const c = { id, company_id: COMPANY_ID, status: "DRAFT", total_recipients: 0, sent_count: 0, delivered_count: 0, read_count: 0, failed_count: 0, opted_out_count: 0, created_at: now(), ...body }
  getDb().campaigns.unshift(c)
  getDb().campaignRecipients[id] = []
  return c
})
on("GET", "/admin/campaigns/:id", ({ params }) => findCampaign(params.id) ?? notFound("Campaña"))
on("GET", "/admin/campaigns/:id/stats", ({ params }) => {
  const c = findCampaign(params.id)
  if (!c) return notFound("Campaña")
  const { total_recipients, sent_count, delivered_count, read_count, failed_count, opted_out_count } = c
  return { total_recipients, sent_count, delivered_count, read_count, failed_count, opted_out_count }
})
on("GET", "/admin/campaigns/:id/recipients", ({ params }) => ({ items: getDb().campaignRecipients[params.id] || [] }))
on("POST", "/admin/campaigns/:id/send", ({ params }) => {
  const c = findCampaign(params.id)
  if (!c) return notFound("Campaña")
  const recipients = getDb().customers.filter((x) => x.phone).map((x, i) => ({ id: `${c.id}-r${i + 1}`, campaign_id: c.id, phone_e164: "+1" + digits(x.phone), status: "SENT", attempts: 1, error_message: null }))
  getDb().campaignRecipients[c.id] = recipients
  Object.assign(c, { status: "SENT", sent_at: now(), total_recipients: recipients.length, sent_count: recipients.length })
  return { success: true, status: c.status }
})
on("DELETE", "/admin/campaigns/:id", ({ params }) => {
  const db = getDb()
  db.campaigns = db.campaigns.filter((c) => c.id !== params.id)
  return { success: true }
})

// ===== Conocimiento =====

on("GET", "/knowledge", ({ query }) => {
  const type = query.get("type")
  return getDb().knowledge.filter((k) => !type || k.type === type)
})
on("POST", "/knowledge/import-from-url", ({ body }) => {
  const item = { id: newId("kn"), company_id: COMPANY_ID, type: body?.type || "policy", title: body?.title || "Contenido importado", content: `Contenido importado desde ${body?.url ?? "la URL indicada"} (simulado).`, question: null, answer: null, is_active: true, created_at: now(), updated_at: now() }
  getDb().knowledge.unshift(item)
  return item
})
on("POST", "/knowledge", ({ body }) => {
  const item = { id: newId("kn"), company_id: COMPANY_ID, question: null, answer: null, is_active: true, ...body, created_at: now(), updated_at: now() }
  getDb().knowledge.unshift(item)
  return item
})
on("PUT", "/knowledge/:id", ({ params, body }) => {
  const k = getDb().knowledge.find((x) => x.id === params.id)
  if (!k) return notFound("Entrada")
  return Object.assign(k, body, { updated_at: now() })
})
on("DELETE", "/knowledge/:id", ({ params }) => {
  const db = getDb()
  db.knowledge = db.knowledge.filter((k) => k.id !== params.id)
  return respond(204, null)
})

// ===== Usuarios =====

const findUser = (id: string) => getDb().users.find((u) => u.id === id)

on("GET", "/users", ({ query }) => page(getDb().users, query).items)
on("GET", "/users/company/:companyId", () => getDb().users)
on("GET", "/users/:id", ({ params }) => findUser(params.id) ?? notFound("Usuario"))
on("POST", "/users", ({ body }) => {
  const { password: _password, ...rest } = body || {}
  const u = { is_active: true, role: "agent", ...rest, id: newId("usr"), company_id: COMPANY_ID, must_change_password: true, created_at: now(), updated_at: now() }
  getDb().users.push(u)
  return { ...u, temporary_password: "Colt-Temporal-2026" }
})
on("PUT", "/users/:id", ({ params, body }) => {
  const u = findUser(params.id)
  if (!u) return notFound("Usuario")
  const { password: _password, ...rest } = body || {}
  return Object.assign(u, rest, { updated_at: now() })
})
on("DELETE", "/users/:id", ({ params }) => {
  const db = getDb()
  db.users = db.users.filter((u) => u.id !== params.id)
  return { success: true, message: "Usuario eliminado" }
})
on("POST", "/companies/:id/users", ({ body }) => ({ success: true, ...body }))
on("DELETE", "/companies/:id/users/:userId", () => respond(204, null))
on("POST", "/user-credentials/reset-password/:id", () => ({ success: true, temporary_password: "Colt-Temporal-2026", message: "Contraseña restablecida" }))
on("GET", "/user-credentials/password-requirements", () => ({ min_length: 10, require_uppercase: true, require_lowercase: true, require_digit: true, require_special: false }))

// ===== Impuestos =====

on("GET", "/admin/taxes/categories/available", () => ({ category_codes: getDb().taxCategories }))
on("GET", "/admin/taxes", () => getDb().taxes)
on("GET", "/admin/taxes/:id", ({ params }) => getDb().taxes.find((t) => t.id === params.id) ?? notFound("Impuesto"))
on("POST", "/admin/taxes", ({ body }) => {
  const t = { id: newId("tax"), company_id: COMPANY_ID, is_active: true, is_compound: false, category_codes: [], ...body, created_at: now(), updated_at: now() }
  getDb().taxes.push(t)
  return t
})
on("PUT", "/admin/taxes/:id", ({ params, body }) => {
  const t = getDb().taxes.find((x) => x.id === params.id)
  if (!t) return notFound("Impuesto")
  return Object.assign(t, body, { updated_at: now() })
})
on("DELETE", "/admin/taxes/:id", ({ params }) => {
  const db = getDb()
  db.taxes = db.taxes.filter((t) => t.id !== params.id)
  return { success: true }
})

// ===== Links de pago =====

const findLink = (id: string) => getDb().paymentLinks.find((l) => l.id === id)

on("GET", "/admin/payment-links/dashboard/stats", () => {
  const list = getDb().paymentLinks
  const by = (s: string) => list.filter((l) => l.status === s)
  const recent = list.filter((l) => Date.now() - new Date(l.created_at).getTime() < 30 * DAY)
  const total = round2(list.reduce((s, l) => s + l.amount, 0))
  const used = round2(by("used").reduce((s, l) => s + l.amount, 0))
  return {
    total_links: list.length,
    active_links: by("active").length,
    used_links: by("used").length,
    expired_links: by("expired").length,
    recent_links_30d: recent.length,
    recent_used_30d: recent.filter((l) => l.status === "used").length,
    total_amount: total,
    used_amount: used,
    conversion_rate: Math.round((by("used").length / Math.max(list.length, 1)) * 1000) / 10,
    successful_payments: by("used").length,
  }
})
on("GET", "/admin/payment-links/list", ({ query }) => {
  const status = query.get("status")
  const limit = num(query.get("limit"), 20)
  const pageNum = num(query.get("page"), 1)
  const list = getDb()
    .paymentLinks.filter((l) => (!status || status === "all" || l.status === status) && matches(query.get("search"), l.description, l.recipient_name, l.order_number))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const totalPages = Math.max(1, Math.ceil(list.length / limit))
  return {
    payment_links: list.slice((pageNum - 1) * limit, pageNum * limit),
    total: list.length,
    page: pageNum,
    limit,
    total_pages: totalPages,
    has_next: pageNum < totalPages,
    has_prev: pageNum > 1,
  }
})
on("GET", "/admin/payment-links/config/providers", () => ({
  providers: [
    { key: "azul", name: "AZUL", enabled: true },
    { key: "bhd", name: "BHD", enabled: true },
    { key: "popular", name: "Banco Popular", enabled: false },
  ],
  total: 3,
  company_id: 1,
}))
on("GET", "/admin/payment-links/reports", () => ({ items: [], total: 0, total_amount: 0, summary: {} }))
on("POST", "/admin/payment-links/create", ({ body }) => {
  const id = newId("pl")
  const token = `pl_${id.replace(/\W/g, "")}`
  const hours = body?.expires_in_hours ?? 48
  const l = {
    id, token, company_id: 1, currency: "DOP", status: "active", auto_capture: true, allowed_providers: ["azul", "bhd"],
    ...body,
    expires_in_hours: hours,
    payment_url: `https://pagos.casadelcolt.com/pay/${token}`,
    expires_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
    created_at: now(),
    updated_at: now(),
  }
  getDb().paymentLinks.unshift(l)
  return l
})
on("GET", "/admin/payment-links/:id", ({ params }) => findLink(params.id) ?? notFound("Link de pago"))
on("PUT", "/admin/payment-links/:id", ({ params, body }) => {
  const l = findLink(params.id)
  if (!l) return notFound("Link de pago")
  return Object.assign(l, body, { updated_at: now() })
})
on("DELETE", "/admin/payment-links/:id", ({ params }) => {
  const db = getDb()
  db.paymentLinks = db.paymentLinks.filter((l) => l.id !== params.id)
  return { message: "Link eliminado" }
})
on("POST", "/admin/payment-links/:id/cancel", ({ params }) => {
  const l = findLink(params.id)
  if (l) l.status = "cancelled"
  return { message: "Link cancelado", status: "cancelled" }
})
for (const action of ["regenerate-token", "renew", "reactivate"]) {
  on("POST", `/admin/payment-links/:id/${action}`, ({ params }) => {
    const l = findLink(params.id)
    if (!l) return notFound("Link de pago")
    return Object.assign(l, { status: "active", expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), updated_at: now() })
  })
}

// ===== Descuentos =====

on("GET", "/admin/discounts/statistics", () => {
  const d = getDb().discounts
  const active = (list: any[]) => list.filter((x) => x.is_active ?? x.status === "active").length
  const used = d.coupons.reduce((s, c) => s + (c.times_used || 0), 0)
  const limit = d.coupons.reduce((s, c) => s + (c.usage_limit || 0), 0)
  return {
    coupons: { total: d.coupons.length, active: active(d.coupons), usage_rate: limit ? Math.round((used / limit) * 100) : 0 },
    product_discounts: { total: d.productDiscounts.length, active: active(d.productDiscounts) },
    category_discounts: { total: d.categoryDiscounts.length, active: active(d.categoryDiscounts) },
  }
})
on("GET", "/admin/discounts/coupons", () => getDb().discounts.coupons)
on("GET", "/admin/discounts/products/discounts", () => getDb().discounts.productDiscounts)
on("GET", "/admin/discounts/categories/discounts", () => getDb().discounts.categoryDiscounts)

// ===== Auditoría =====

on("GET", "/admin/audit/audit-logs/recent", ({ query }) =>
  getDb().auditLogs.slice(0, num(query.get("limit"), 10)).map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    description: `${l.action} · ${l.resource_name}`,
    user: l.user.email,
    success: l.success,
    resource_name: l.resource_name,
  })),
)
on("GET", "/admin/audit/audit-stats", ({ query }) => {
  const logs = getDb().auditLogs
  const count = (key: string) => [...logs.reduce((m, l) => m.set(l[key], (m.get(l[key]) || 0) + 1), new Map<string, number>())]
  const days = num(query.get("days"), 7)
  return {
    total_activities: logs.length,
    actions: count("action").map(([action, n]) => ({ action, count: n })),
    resources: count("resource_type").map(([resource_type, n]) => ({ resource_type, count: n })),
    active_users: [{ name: me().name, email: me().email, activity_count: logs.length }],
    success_rate: { successful: logs.filter((l) => l.success).length, failed: logs.filter((l) => !l.success).length },
    period: { start_date: new Date(Date.now() - days * DAY).toISOString(), end_date: now() },
  }
})
on("GET", "/admin/audit/audit-logs", ({ query }) => page(getDb().auditLogs, query, 50).items)
on("GET", "/admin/audit/audit-logs/:id", ({ params }) => getDb().auditLogs.find((l) => l.id === params.id) ?? notFound("Registro"))

// ===== Medios =====

function mediaItems() {
  return getDb()
    .products.filter((p) => p.image)
    .flatMap((p) =>
      (p.images as string[]).map((url, i) => {
        const filename = url.split("/").pop() || ""
        return {
          id: `media-${p.id}-${i + 1}`,
          name: filename.replace(/\.\w+$/, ""),
          original_filename: filename,
          file_extension: filename.split(".").pop() || "jpg",
          source_type: "local_folder",
          source_path: url,
          public_url: url,
          alt_text: p.name,
          description: p.name,
          tags: [p.external_category_code],
          file_size: 40000 + ((Number(p.id) * 977) % 90000),
          usage_count: 1,
          last_used_at: p.updated_at,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }
      }),
    )
}

on("GET", "/media", ({ query }) => {
  const type = query.get("file_type")
  const list = mediaItems().filter((m) => (!type || m.file_extension === type) && matches(query.get("search"), m.name, m.description))
  const pg = page(list, query, 24)
  return { items: pg.items, total: pg.total, page: Math.floor(pg.skip / pg.limit) + 1, per_page: pg.limit, total_pages: Math.max(1, Math.ceil(pg.total / pg.limit)) }
})
on("POST", "/media/upload-file", () => ({ success: true, id: newId("media") }))
on("DELETE", "/media/:id", () => respond(204, null))

// ===== Vehículos =====

const PRIORIDAD = { alta: 0, media: 1, baja: 2 } as const
const findVehiculo = (id: string) => getDb().vehiculos.find((v) => v.id === id)

function piezasTexto(lista: [number, number][]) {
  const items = lista.flatMap(([id, n]) => {
    const p = getDb().piezas.find((x) => x.id === id)
    return p ? [{ p, n }] : []
  })
  return {
    detalle: items.map(({ p, n }) => `${n} × ${p.nombre}`).join(", "),
    monto: round2(items.reduce((s, { p, n }) => s + p.precio_dop * n, 0) * (1 + ITBIS_RATE)),
  }
}

// Atenciones del vehículo: historial propio + WhatsApp + cotizaciones + órdenes que salen de ellas.
function cronograma(v: VehiculoSeed) {
  const db = getDb()
  const eventos: any[] = v.historial.map((e) => {
    const pz = e.piezas ? piezasTexto(e.piezas) : null
    return {
      fecha: new Date(Date.now() - e.hace).toISOString(),
      canal: e.canal,
      atendio: e.atendio,
      tipo: e.tipo,
      detalle: [e.detalle, pz?.detalle].filter(Boolean).join(": "),
      monto_dop: pz?.monto ?? null,
      km: e.km ?? null,
    }
  })
  for (const c of db.conversations.filter((x) => x.vehiculo?.id === v.id)) {
    const msgs = db.messages[c.id] || []
    const primera = msgs.find((m: any) => m.sender === "user")
    eventos.push({
      fecha: c.created_at,
      canal: "whatsapp",
      atendio: c.assigned_to_name || (msgs.some((m: any) => m.sender === "bot") ? "Asistente IA" : "Sin asignar"),
      tipo: "consulta",
      detalle: primera?.transcripcion || primera?.message || "Conversación por WhatsApp",
      conversacion_id: c.id,
    })
  }
  for (const codigo of new Set(db.cotizaciones.filter((q) => q.vehiculo_id === v.id).map((q) => q.codigo))) {
    const vs = versionesDe(codigo)
    const q = vs[vs.length - 1]
    const canal = q.conversacion_id ? "whatsapp" : "mostrador"
    eventos.push({
      fecha: vs[0].creada,
      canal,
      atendio: q.vendedor.nombre,
      tipo: "cotizacion",
      detalle: q.items.map((i) => `${i.cantidad} × ${i.descripcion}`).join(", "),
      cotizacion_id: q.codigo,
      estado: q.estado,
      monto_dop: q.total_dop,
    })
    const o = db.orders.find((x) => x.cotizacion_codigo === codigo)
    if (o) {
      eventos.push({
        fecha: o.created_at,
        canal,
        atendio: q.vendedor.nombre,
        tipo: "venta",
        detalle: o.items.map((i: any) => `${i.quantity} × ${i.name}`).join(", "),
        orden_id: o.id,
        orden_numero: o.order_number,
        monto_dop: o.total,
      })
    }
  }
  for (const c of db.citas.filter((x) => citaDelVehiculo(x) === v.id)) {
    eventos.push({
      fecha: c.inicio,
      canal: c.tipo === "visita" ? "mostrador" : "llamada",
      atendio: c.vendedor,
      tipo: "cita",
      detalle: `${c.tipo === "visita" ? "Visita a la tienda" : "Llamada"}: ${c.motivo}`,
      cita_estado: c.estado,
    })
  }
  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

// La cita no guarda vehículo: lo toma del lead o de la conversación con que se agendó.
function citaDelVehiculo(c: any): string | null {
  const db = getDb()
  return c.vehiculo_id
    ?? db.leads.find((l) => l.id === c.lead_id)?.vehiculo_id
    ?? db.conversations.find((x) => x.id === c.conversacion_id)?.vehiculo?.id
    ?? null
}

function vehiculoResumen(v: VehiculoSeed) {
  const c = getDb().customers.find((x) => x.id === v.cliente_id)
  const eventos = cronograma(v)
  const { historial, servicios, ...datos } = v
  return {
    ...datos,
    cliente: c?.name ?? "",
    cliente_telefono: c?.phone ?? "",
    atenciones: eventos.length,
    ultima_atencion: eventos[0]?.fecha ?? null,
    conversacion_id: eventos.find((e) => e.conversacion_id)?.conversacion_id ?? null,
  }
}

function planMantenimiento(v: VehiculoSeed) {
  const fmt = (n: number) => n.toLocaleString("en-US")
  return REGLAS_MANTENIMIENTO.map((r) => {
    const ultimo = v.servicios[r.clave] ?? null
    const restante = ultimo == null ? null : ultimo + r.cada_km - v.kilometraje
    const pieza = r.buscar
      .map((q) => buscarPiezas(getDb().piezas, { q, marca: v.marca, modelo: v.modelo, anio: v.anio }).items[0])
      .find(Boolean)
    const prioridad: keyof typeof PRIORIDAD = restante == null ? "media" : restante < 0 ? "alta" : restante <= r.cada_km * 0.2 ? "media" : "baja"
    return {
      clave: r.clave,
      descripcion: r.descripcion,
      cada_km: r.cada_km,
      ultimo_km: ultimo,
      proximo_km: ultimo == null ? null : ultimo + r.cada_km,
      cuando: restante == null ? "Sin registro: revisar" : restante < 0 ? `Vencido hace ${fmt(-restante)} km` : `En ${fmt(restante)} km`,
      prioridad,
      pieza_id: pieza?.id ?? null,
      pieza: pieza ? { id: pieza.id, nombre: pieza.nombre, precio_dop: pieza.precio_dop, disponible: pieza.disponible, imagen: pieza.imagen } : null,
    }
  }).sort((a, b) => PRIORIDAD[a.prioridad] - PRIORIDAD[b.prioridad])
}

on("GET", "/vehiculos", ({ query }) => {
  const cliente = query.get("cliente_id")
  const list = getDb()
    .vehiculos.filter((v) => !cliente || v.cliente_id === cliente)
    .map(vehiculoResumen)
    .filter((v) => matches(query.get("q"), v.marca, v.modelo, v.anio, v.placa, v.vin, v.cliente))
    .sort((a, b) => (b.ultima_atencion ?? "").localeCompare(a.ultima_atencion ?? ""))
  return { total: list.length, items: page(list, query, 50).items }
})
on("GET", "/vehiculos/:id/cronograma", ({ params }) => {
  const v = findVehiculo(params.id)
  return v ? { eventos: cronograma(v) } : notFound("Vehículo")
})
on("GET", "/vehiculos/:id/plan", ({ params }) => {
  const v = findVehiculo(params.id)
  return v ? { kilometraje: v.kilometraje, items: planMantenimiento(v) } : notFound("Vehículo")
})
on("GET", "/vehiculos/:id", ({ params }) => {
  const v = findVehiculo(params.id)
  return v ? vehiculoResumen(v) : notFound("Vehículo")
})

// ===== Oportunidades =====

const ETAPAS: Etapa[] = ["nueva", "en_atencion", "pendiente_datos", "cotizada", "ganada", "perdida"]
const findLead = (id: string) => getDb().leads.find((l) => l.id === id)

function leadVista(l: LeadMock) {
  const db = getDb()
  const q = l.cotizacion_codigo ? vigente(l.cotizacion_codigo) : null
  const orden = l.orden_id
    ? db.orders.find((o) => o.id === l.orden_id)
    : l.cotizacion_codigo ? db.orders.find((o) => o.cotizacion_codigo === l.cotizacion_codigo) : null
  const v = l.vehiculo_id ? db.vehiculos.find((x) => x.id === l.vehiculo_id) : null
  const c = l.cliente_id ? db.customers.find((x) => x.id === l.cliente_id) : null
  return {
    ...l,
    telefono: c?.phone ?? l.telefono,
    monto_dop: orden?.total ?? q?.total_dop ?? null,
    cotizacion_estado: q?.estado ?? null,
    orden_id: orden?.id ?? null,
    orden_numero: orden?.order_number ?? null,
    vehiculo: v ? { id: v.id, marca: v.marca, modelo: v.modelo, anio: v.anio } : null,
    citas: db.citas
      .filter((c) => c.lead_id === l.id)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map(({ id, tipo, estado, inicio, fin, vendedor }) => ({ id, tipo, estado, inicio, fin, vendedor })),
  }
}

// Enviar la cotización la pasa a cotizada; convertirla en orden la gana.
function avanzarLead(codigo: string, etapa: "cotizada" | "ganada") {
  for (const l of getDb().leads.filter((x) => x.cotizacion_codigo === codigo)) {
    if (etapa === "ganada" || ETAPAS_ABIERTAS.includes(l.etapa)) {
      l.etapa = etapa
      if (etapa === "ganada") l.vendedor_cierre = me().name
      l.actualizado = now()
    }
  }
}

on("GET", "/leads", ({ query }) => {
  const etapa = query.get("etapa")
  const origen = query.get("origen")
  const responsable = query.get("responsable")
  const list = getDb()
    .leads.filter((l) => (!etapa || l.etapa === etapa) && (!origen || l.origen === origen) && (!responsable || l.responsable === responsable))
    .map(leadVista)
    .filter((l) => matches(query.get("q"), l.cliente, l.interes, l.telefono, l.vehiculo?.modelo) && enPeriodo(l.creado, query)
      && !(query.get("ocultar_cerradas") === "true" && (l.etapa === "ganada" || l.etapa === "perdida")))
    .sort((a, b) => b.creado.localeCompare(a.creado))
  return { total: list.length, items: page(list, query, 100).items }
})
on("GET", "/leads/:id", ({ params }) => {
  const l = findLead(params.id)
  return l ? leadVista(l) : notFound("Lead")
})
on("PATCH", "/leads/:id", ({ params, body }) => {
  const l = findLead(params.id)
  if (!l) return notFound("Lead")
  if (body?.etapa !== undefined) {
    if (!ETAPAS.includes(body.etapa)) return respond(422, { detail: "Etapa no válida." })
    if (body.etapa === "perdida" && !MOTIVOS.includes(body.motivo_perdida)) {
      return respond(422, { detail: "Para marcarlo perdido hay que indicar el motivo." })
    }
    l.etapa = body.etapa
    l.motivo_perdida = body.etapa === "perdida" ? body.motivo_perdida : null
    l.nota_perdida = body.etapa === "perdida" ? body.nota_perdida || null : null
    if (body.etapa === "ganada") l.vendedor_cierre = body.vendedor_cierre || me().name
  }
  if (typeof body?.responsable === "string") l.responsable = body.responsable
  l.actualizado = now()
  return leadVista(l)
})

// ===== Agenda =====

const ESTADOS_CITA = ["programada", "completada", "no_asistio", "cancelada"]
const aMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const findAgendaVendedor = (id: string) => getDb().agendaVendedores.find((v) => v.id === id)

function dentroDeHorario(vendedorId: string, inicio: Date, fin: Date) {
  const v = findAgendaVendedor(vendedorId)
  if (!v || inicio.toDateString() !== new Date(fin.getTime() - 1).toDateString()) return false
  const ini = inicio.getHours() * 60 + inicio.getMinutes()
  const finMin = ini + Math.round((fin.getTime() - inicio.getTime()) / 60000)
  return v.horario.some((t) => t.dia === inicio.getDay() && aMin(t.desde) <= ini && finMin <= aMin(t.hasta))
}

function ocupado(vendedorId: string, inicio: Date, fin: Date) {
  return getDb().citas.some((c) => c.vendedor_id === vendedorId && c.estado === "programada"
    && new Date(c.inicio) < fin && inicio < new Date(c.fin))
}

function rango(query: URLSearchParams) {
  const desde = query.get("desde") ? new Date(query.get("desde")!) : new Date(new Date().setHours(0, 0, 0, 0))
  const hasta = query.get("hasta") ? new Date(query.get("hasta")!) : new Date(desde.getTime() + 7 * DAY)
  return { desde, hasta }
}

on("GET", "/agenda/vendedores", ({ query }) =>
  getDb().agendaVendedores.filter((v) => !query.get("sucursal") || v.sucursal === query.get("sucursal")))
on("PUT", "/agenda/vendedores/:id/horario", ({ params, body }) => {
  const v = findAgendaVendedor(params.id)
  if (!v) return notFound("Vendedor")
  const horario = Array.isArray(body?.horario) ? body.horario : null
  const valido = horario?.every((t: any) => [1, 2, 3, 4, 5, 6].includes(t.dia) && /^\d{2}:\d{2}$/.test(t.desde) && /^\d{2}:\d{2}$/.test(t.hasta)
    && aMin(t.desde) >= aMin("07:00") && aMin(t.hasta) <= aMin("19:00") && aMin(t.desde) < aMin(t.hasta))
  if (!valido) return respond(422, { detail: "Revisa el horario: cada día abre antes de cerrar, entre 7:00 a. m. y 7:00 p. m." })
  v.horario = horario
  return v
})
on("GET", "/agenda/disponibilidad", ({ query }) => {
  const { desde, hasta } = rango(query)
  const bloques: any[] = []
  for (const v of getDb().agendaVendedores) {
    if (query.get("vendedor_id") && v.id !== query.get("vendedor_id")) continue
    if (query.get("sucursal") && v.sucursal !== query.get("sucursal")) continue
    for (const d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) {
      for (const t of v.horario.filter((x) => x.dia === d.getDay())) {
        for (let m = aMin(t.desde); m + BLOQUE_MIN <= aMin(t.hasta); m += BLOQUE_MIN) {
          const inicio = new Date(d)
          inicio.setHours(Math.floor(m / 60), m % 60, 0, 0)
          const fin = new Date(inicio.getTime() + BLOQUE_MIN * 60000)
          if (inicio < desde || fin > hasta) continue
          bloques.push({ vendedor_id: v.id, inicio: inicio.toISOString(), fin: fin.toISOString(), libre: inicio > new Date() && !ocupado(v.id, inicio, fin) })
        }
      }
    }
  }
  return { bloques }
})
on("GET", "/agenda/citas", ({ query }) => {
  const { desde, hasta } = rango(query)
  const items = getDb()
    .citas.filter((c) => new Date(c.fin) > desde && new Date(c.inicio) < hasta
      && (!query.get("vendedor_id") || c.vendedor_id === query.get("vendedor_id"))
      && (!query.get("sucursal") || c.sucursal === query.get("sucursal"))
      && (!query.get("estado") || c.estado === query.get("estado")))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  return { items }
})
on("POST", "/agenda/citas", ({ body }) => {
  const v = findAgendaVendedor(body?.vendedor_id)
  const inicio = new Date(body?.inicio)
  const fin = body?.fin ? new Date(body.fin) : new Date(inicio.getTime() + BLOQUE_MIN * 60000)
  const cliente = getDb().customers.find((x) => x.id === body?.cliente_id)
  const nombre = cliente?.name ?? String(body?.cliente ?? "").trim()
  if (!v) return respond(422, { detail: "Elige un vendedor." })
  if (!["visita", "llamada"].includes(body?.tipo)) return respond(422, { detail: "El tipo es visita o llamada." })
  if (!nombre) return respond(422, { detail: "Indica el cliente." })
  if (isNaN(inicio.getTime()) || inicio < new Date()) return respond(422, { detail: "Elige una hora que no haya pasado." })
  if (!dentroDeHorario(v.id, inicio, fin)) return respond(422, { detail: `Esa hora está fuera del horario de ${v.nombre}.` })
  if (ocupado(v.id, inicio, fin)) return respond(409, { detail: "Ese horario ya no está libre. Elige otro." })
  const cita = {
    id: newId("cita"),
    tipo: body.tipo,
    estado: "programada",
    cliente: nombre,
    cliente_id: cliente?.id ?? null,
    telefono: cliente?.phone ?? String(body?.telefono ?? ""),
    vendedor_id: v.id,
    vendedor: v.nombre,
    sucursal: v.sucursal,
    motivo: String(body?.motivo ?? "").trim(),
    origen: "panel",
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    conversacion_id: body?.conversacion_id ?? null,
    lead_id: body?.lead_id ?? null,
    vehiculo_id: body?.vehiculo_id ?? null,
    google_event_id: null,
    recordatorio_enviado: false,
  }
  getDb().citas.push(cita)
  return cita
})
on("PATCH", "/agenda/citas/:id", ({ params, body }) => {
  const c = getDb().citas.find((x) => x.id === params.id)
  if (!c) return notFound("Cita")
  if (!ESTADOS_CITA.includes(body?.estado)) return respond(422, { detail: "Estado no válido." })
  c.estado = body.estado
  return c
})

// ===== Notificaciones =====
// Salen de los datos actuales (leads, conversaciones, citas); solo se guarda cuáles se leyeron.

const SLA_AVISO_MIN = 15

function notificaciones() {
  const db = getDb()
  const ahora = Date.now()
  const hace = (iso: string, min: number) => new Date(Math.min(ahora, new Date(iso).getTime() - min * 60000)).toISOString()
  const items: any[] = []

  for (const l of db.leads.filter((x) => x.etapa === "nueva")) {
    items.push({ id: `ntf-lead-${l.id}`, tipo: "nuevo_lead", titulo: `Nuevo lead: ${l.cliente}`, detalle: l.interes, lead_id: l.id, conversacion_id: l.conversacion_id, creada: l.creado })
  }
  for (const c of db.conversations) {
    const msgs = db.messages[c.id] || []
    const ultimo = msgs[msgs.length - 1]
    // Un humano debe responder (no la IA) y lo último lo escribió el cliente.
    const esperando = ["esperando_vendedor", "vendedor"].includes(c.estado_atencion) && ultimo?.sender === "user"
    if (esperando && ultimo) {
      items.push({ id: `ntf-msg-${c.id}-${ultimo.id}`, tipo: "mensaje_sin_responder", titulo: `${c.customer_name} espera respuesta`, detalle: ultimo.transcripcion || ultimo.message, conversacion_id: c.id, creada: ultimo.timestamp })
    }
  }
  for (const b of db.busquedasExternas.filter((x) => x.estado === "pendiente" && x.origen === "ia")) {
    const v = b.vehiculo ? ` · ${b.vehiculo.marca} ${b.vehiculo.modelo} ${b.vehiculo.anio}` : ""
    items.push({ id: `ntf-pieza-${b.id}`, tipo: "pieza_no_encontrada", titulo: `Sin existencia: ${b.pieza}${v}`, detalle: `Lo pidió ${b.cliente?.nombre ?? "un cliente"}`, conversacion_id: b.conversacion_id, lead_id: b.lead_id, busqueda_id: b.id, creada: b.creada })
  }
  for (const l of db.leads.filter((x) => ETAPAS_ABIERTAS.includes(x.etapa))) {
    const min = Math.round((new Date(l.sla_vence).getTime() - ahora) / 60000)
    if (min <= SLA_AVISO_MIN) {
      items.push({
        id: `ntf-sla-${l.id}`, tipo: "sla_por_vencer",
        titulo: min < 0 ? `SLA vencido: ${l.cliente}` : `SLA por vencer: ${l.cliente} (${min} min)`,
        detalle: `${l.interes} · responsable: ${l.responsable}`, lead_id: l.id, conversacion_id: l.conversacion_id, creada: hace(l.sla_vence, SLA_AVISO_MIN),
      })
    }
  }
  for (const c of db.citas.filter((x) => x.estado === "programada")) {
    const falta = new Date(c.inicio).getTime() - ahora
    if (falta > 0 && falta <= DAY) {
      const hora = new Date(c.inicio).toLocaleString("es-DO", { weekday: "short", hour: "numeric", minute: "2-digit" })
      items.push({ id: `ntf-cita-${c.id}`, tipo: "cita_proxima", titulo: `${c.tipo === "visita" ? "Visita" : "Llamada"} ${hora}: ${c.cliente}`, detalle: `${c.motivo} · con ${c.vendedor}`, cita_id: c.id, conversacion_id: c.conversacion_id, lead_id: c.lead_id, creada: hace(c.inicio, 24 * 60) })
    }
  }
  const leidas = new Set(db.notifLeidas)
  return items
    .map((n) => ({ lead_id: null, cita_id: null, conversacion_id: null, busqueda_id: null, ...n, leida: leidas.has(n.id) }))
    .sort((a, b) => b.creada.localeCompare(a.creada))
}

on("GET", "/notificaciones", ({ query }) => {
  const todas = notificaciones()
  const items = todas.filter((n) => (query.get("no_leidas") !== "true" || !n.leida) && (!query.get("tipo") || n.tipo === query.get("tipo")))
  return { no_leidas: todas.filter((n) => !n.leida).length, items: items.slice(0, num(query.get("limit"), 100)) }
})
on("POST", "/notificaciones/leer-todas", () => {
  getDb().notifLeidas = notificaciones().map((n) => n.id)
  return { no_leidas: 0 }
})
on("POST", "/notificaciones/:id/leida", ({ params }) => {
  if (!getDb().notifLeidas.includes(params.id)) getDb().notifLeidas.push(params.id)
  return { id: params.id, leida: true }
})

// ===== Reportes =====

const mediana = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

// Segundos entre el primer mensaje del cliente y la primera respuesta (IA o vendedor).
function primeraRespuestaSeg(conversacionId: string | null) {
  if (!conversacionId) return null
  const msgs = getDb().messages[conversacionId] || []
  const i = msgs.findIndex((m: any) => m.sender === "user")
  const r = i >= 0 ? msgs.slice(i + 1).find((m: any) => m.sender !== "user") : null
  return r ? Math.round((new Date(r.timestamp).getTime() - new Date(msgs[i].timestamp).getTime()) / 1000) : null
}

on("GET", "/reportes/resumen", ({ query }) => {
  const desde = query.get("desde") ? new Date(query.get("desde")!) : new Date(Date.now() - 30 * DAY)
  const hasta = query.get("hasta") ? new Date(query.get("hasta")!) : new Date()
  const vendedor = query.get("vendedor")
  const leads = getDb()
    .leads.filter((l) => new Date(l.creado) >= desde && new Date(l.creado) <= hasta)
    .filter((l) => !vendedor || l.responsable === vendedor || l.vendedor_cierre === vendedor)
    .map(leadVista)
  const ganadas = leads.filter((l) => l.etapa === "ganada")
  const perdidas = leads.filter((l) => l.etapa === "perdida")
  const cotizadas = leads.filter((l) => l.cotizacion_codigo || l.etapa === "ganada")
  const monto = (ls: typeof leads) => round2(ls.reduce((s, l) => s + (l.monto_dop ?? 0), 0))
  const respuestas = leads.map((l) => primeraRespuestaSeg(l.conversacion_id)).filter((x): x is number => x != null)
  const cerradas = ganadas.length + perdidas.length
  const nombres = [...new Set(leads.flatMap((l) => [l.responsable, l.vendedor_cierre]).filter((n): n is string => !!n && n !== "Sin asignar"))]
  return {
    periodo: { desde: desde.toISOString(), hasta: hasta.toISOString() },
    consultas: leads.length,
    cotizadas: cotizadas.length,
    ganadas: ganadas.length,
    perdidas: perdidas.length,
    abiertas: leads.length - cerradas,
    conversion: cerradas ? round2(ganadas.length / cerradas) : null,
    monto_ganado_dop: monto(ganadas),
    monto_perdido_dop: monto(perdidas),
    tiempo_respuesta_mediano_seg: mediana(respuestas),
    respuestas_medidas: respuestas.length,
    sla_vencido: leads.filter((l) => ETAPAS_ABIERTAS.includes(l.etapa) && new Date(l.sla_vence).getTime() < Date.now()).length,
    atendidas_ia: leads.filter((l) => l.responsable === "Asistente IA").length,
    por_motivo: MOTIVOS.map((m) => {
      const ls = perdidas.filter((l) => l.motivo_perdida === m)
      return { motivo: m, cantidad: ls.length, monto_dop: monto(ls) }
    }).filter((x) => x.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad),
    por_canal: (["whatsapp", "llamada", "mostrador", "tienda_web"] as const).map((o) => {
      const ls = leads.filter((l) => l.origen === o)
      return { origen: o, consultas: ls.length, ganadas: ls.filter((l) => l.etapa === "ganada").length }
    }).filter((x) => x.consultas > 0).sort((a, b) => b.consultas - a.consultas),
    por_vendedor: nombres.map((n) => {
      const atendidas = leads.filter((l) => l.responsable === n)
      const cerro = ganadas.filter((l) => l.vendedor_cierre === n)
      const perdio = perdidas.filter((l) => l.responsable === n)
      const t = atendidas.map((l) => primeraRespuestaSeg(l.conversacion_id)).filter((x): x is number => x != null)
      return {
        vendedor: n,
        consultas: atendidas.length,
        ganadas: cerro.length,
        perdidas: perdio.length,
        monto_dop: monto(cerro),
        tiempo_respuesta_mediano_seg: mediana(t),
      }
    }).sort((a, b) => b.monto_dop - a.monto_dop || b.consultas - a.consultas),
  }
})

// ===== Actividad de la IA =====
// Sale de las conversaciones: qué atendió, qué pasó a un vendedor y qué consultó (siempre lectura).

function consultasIA(c: any) {
  const db = getDb()
  const msgs = db.messages[c.id] || []
  const v = c.vehiculo
  // La IA busca con lo que entendió del pedido, no con el mensaje entero.
  const interes = db.leads.find((l) => l.conversacion_id === c.id)?.interes
  const consulta = (texto: string) => (interes ?? texto.split(/\s+/).slice(0, 6).join(" ")).toLowerCase().replace(/[?¿.,]/g, "")
  const out: any[] = []
  msgs.forEach((m: any, i: number) => {
    if (m.sender !== "bot") return
    const antes = new Date(new Date(m.timestamp).getTime() - 4000).toISOString()
    const pregunta = [...msgs.slice(0, i)].reverse().find((x: any) => x.sender === "user")
    const texto = String(pregunta?.transcripcion || pregunta?.message || "")
    const base = { conversacion_id: c.id, cliente: c.customer_name, fecha: antes, metodo: "GET" }
    if (m.piezas?.length) {
      out.push({ ...base, herramienta: "buscar_piezas", ruta: "/piezas/buscar", parametros: { q: consulta(texto), marca: v?.marca, modelo: v?.modelo, anio: v?.anio, limit: 5, fields: "id,nombre,precio_dop,disponible" }, resultados: m.piezas.length, ms: 180 + (i * 37) % 120 })
      out.push({ ...base, fecha: new Date(new Date(antes).getTime() + 1500).toISOString(), herramienta: "consultar_existencia", ruta: `/piezas/${m.piezas[0].product_id}`, parametros: { fields: "existencia,precio_dop" }, resultados: 1, ms: 60 + (i * 13) % 40 })
    } else if (/horario|abren|quedan/i.test(texto)) {
      out.push({ ...base, herramienta: "consultar_conocimiento", ruta: "/conocimiento", parametros: { tema: "horario y ubicación", limit: 2 }, resultados: 2, ms: 90 })
    } else if (c.resultado === "sin_existencia" && /no tenemos/i.test(m.message)) {
      out.push({ ...base, herramienta: "buscar_piezas", ruta: "/piezas/buscar", parametros: { q: consulta(texto), marca: v?.marca, modelo: v?.modelo, anio: v?.anio, limit: 5, fields: "id,nombre,precio_dop,disponible" }, resultados: 0, ms: 210 })
    }
  })
  return out
}

on("GET", "/ia/actividad", ({ query }) => {
  const db = getDb()
  const desde = query.get("desde") ? new Date(query.get("desde")!) : new Date(Date.now() - 30 * DAY)
  const convs = db.conversations.filter((c) => (db.messages[c.id] || []).some((m: any) => m.sender === "bot") && new Date(c.updated_at) >= desde)
  const humano = (c: any) => (db.messages[c.id] || []).some((m: any) => m.sender === "admin" && !String(m.message).startsWith("🔄"))
  const pasadas = convs.filter((c) => c.agent_requested || c.assigned_to_id || ["esperando_vendedor", "vendedor"].includes(c.estado_atencion) || humano(c))
  const tiempos = convs.map((c) => primeraRespuestaSeg(c.id)).filter((x): x is number => x != null)
  const herramientas = convs.flatMap(consultasIA).sort((a, b) => b.fecha.localeCompare(a.fecha))
  return {
    resumen: {
      conversaciones: convs.length,
      sin_humano: convs.length - pasadas.length,
      pasadas_a_vendedor: pasadas.length,
      cotizaciones_armadas: db.cotizaciones.filter((q) => q.version === 1 && q.vendedor.id == null).length,
      sin_existencia: convs.filter((c) => c.resultado === "sin_existencia").length,
      primera_respuesta_mediana_seg: mediana(tiempos),
      consultas_herramientas: herramientas.length,
      escrituras: 0,
    },
    pasadas: pasadas.map((c) => {
      const bot = (db.messages[c.id] || []).filter((m: any) => m.sender === "bot").pop()
      return {
        conversacion_id: c.id,
        cliente: c.customer_name,
        motivo: c.agent_requested ? "El cliente pidió hablar con una persona"
          : /asesor/i.test(bot?.message ?? "") ? "La IA lo pasó a un asesor"
          : "Lo tomó un vendedor",
        a: c.assigned_to_name ?? null,
        estado_atencion: c.estado_atencion,
        fecha: c.updated_at,
      }
    }).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    herramientas: herramientas.slice(0, num(query.get("limit"), 50)),
  }
})

// Perfil del cliente (contrato/perfil.md). El cliente de una conversación se encuentra por teléfono.
const perfilExtra: Record<string, any> = {}
const ESTADO_COMPRA = ["CONFIRMED", "PROCESSING", "PAID", "SHIPPED", "DELIVERED"]
const convsDelCliente = (c: any) => getDb().conversations.filter((v: any) => v.customer_id === c.id || samePhone(v.customer_phone, c.phone))
const vehiculosDelCliente = (c: any) => getDb().vehiculos.filter((v: any) => v.cliente_id === c.id)
const mensajesDelCliente = (c: any) => convsDelCliente(c).flatMap((v: any) => (getDb().messages[v.id] || []).map((m: any) => ({ ...m, conv: v })))

function perfilMock(c: any) {
  const extra = perfilExtra[c.id] ?? (perfilExtra[c.id] = { tipo: /taller/i.test(c.name) ? "taller" : "particular", sucursal: null, vendedor: null, bloqueo: null, anonimizado_at: null, resumen: null, estados: {} })
  const db = getDb()
  const convs = convsDelCliente(c)
  const msgs = mensajesDelCliente(c)
  const cots = new Map<string, any>()
  for (const q of db.cotizaciones as any[]) if (q.cliente?.id === c.id && (!cots.has(q.codigo) || q.version > cots.get(q.codigo).version)) cots.set(q.codigo, q)
  const ordenes = (db.orders as any[]).filter((o) => o.customer_id === c.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const compras = ordenes.filter((o) => ESTADO_COMPRA.includes(o.status)).map((o) => o.created_at).sort()
  const citas = (db.citas as any[]).filter((x) => x.cliente_id === c.id)
  const delCliente = msgs.filter((m: any) => m.sender === "user")
  const hace30 = Date.now() - 30 * DAY
  const dias = new Set(delCliente.filter((m: any) => new Date(m.timestamp).getTime() >= hace30).map((m: any) => m.timestamp.slice(0, 10))).size
  const compro30 = compras.some((f) => new Date(f).getTime() >= hace30)
  const riesgo = dias >= 3 && !compro30 ? { nivel: "alto", motivo: `${dias} días con consultas en 30 días y ninguna compra` }
    : dias >= 1 && !compro30 ? { nivel: "medio", motivo: "consultó en los últimos 30 días sin comprar" }
    : { nivel: "bajo", motivo: compro30 ? "compró en los últimos 30 días" : "sin consultas recientes" }
  const cotizaciones = [...cots.values()].sort((a, b) => b.creada.localeCompare(a.creada))
  const telefonos = [c.phone].filter(Boolean)
  return {
    cliente: {
      id: c.id, nombre: c.name, telefono: c.phone ?? null, telefonos, correo: c.email ?? null, documento: c.document_id ?? null, documento_tipo: c.document_type ?? null,
      direccion: c.address ?? null, origen: c.source ?? "manual", tipo: extra.tipo,
      sucursal_preferida: extra.sucursal, vendedor: extra.vendedor,
      bloqueado: !!extra.bloqueo, bloqueado_at: extra.bloqueo?.fecha ?? null, bloqueo_motivo: extra.bloqueo?.motivo ?? null,
      anonimizado: !!extra.anonimizado_at, anonimizado_at: extra.anonimizado_at, sin_telefono: telefonos.length === 0,
      seguridad: seguridadMock(c, extra, compras.length, dias), no_molestar: !!extra.no_molestar, lista_blanca: !!extra.lista_blanca,
    },
    vehiculos: vehiculosDelCliente(c).map((v: any) => ({
      id: v.id, marca: v.marca, modelo: v.modelo, anio: v.anio, motor: v.motor, vin: v.vin, placa: v.placa,
      kilometraje: v.kilometraje, estado: extra.estados[v.id] ?? "activo", fotos: 0, creado: null,
      version: v.version ?? null, carroceria: v.carroceria ?? null, traccion: v.traccion ?? null, chasis: v.chasis ?? null,
      fuente_identificacion: v.fuente_identificacion ?? null, verificado: v.verificado ?? null, confirmado_por_cliente: v.confirmado_por_cliente ?? null,
    })),
    piezas_consultadas: msgs.flatMap((m: any) => (m.piezas ?? m.metadata?.piezas ?? []).map((p: any) => ({
      id: String(p.product_id ?? p.id), nombre: p.nombre, precio_dop: p.precio_dop ?? null, visto: m.timestamp,
    }))).slice(0, 10),
    cotizaciones: cotizaciones.map((q) => ({
      id: `${q.codigo}-${q.version}`, codigo: q.codigo, estado: q.estado, total_dop: q.total_dop, fecha: q.creada, vehiculo_id: q.vehiculo_id,
      vehiculo: q.vehiculo ? `${q.vehiculo.marca} ${q.vehiculo.modelo} ${q.vehiculo.anio}` : null,
    })),
    citas: citas.map((x) => ({ id: x.id, tipo: x.tipo, inicio: x.inicio, estado: x.estado, proxima: new Date(x.inicio).getTime() > Date.now() })),
    ordenes: ordenes.map((o) => ({ id: o.id, numero: o.order_number, estado: o.status, total_dop: Number(o.total ?? 0),
      pagada: o.payment_status === "paid", compra: ESTADO_COMPRA.includes(o.status), fecha: o.created_at })),
    senales: {
      total_comprado_dop: round2(ordenes.filter((o) => ESTADO_COMPRA.includes(o.status)).reduce((s, o) => s + Number(o.total ?? 0), 0)),
      compras: compras.length,
      frecuencia_dias: compras.length >= 2 ? Math.round((new Date(compras[compras.length - 1]).getTime() - new Date(compras[0]).getTime()) / DAY / (compras.length - 1)) : null,
      ultima_compra: compras[compras.length - 1] ?? null,
      consultas_30d: dias,
      riesgo,
    },
    interes: cotizaciones.some((q) => q.estado === "aceptada") ? { nivel: "alto", motivo: "aceptó una cotización" }
      : citas.length ? { nivel: "alto", motivo: "agendó una cita" }
      : cotizaciones.length ? { nivel: "alto", motivo: "pidió cotización" }
      : { nivel: "medio", motivo: "vio opciones con precio" },
    conversaciones: convs.length,
    conversacion_id: convs[0]?.id ?? null,
    mensajes_del_cliente: delCliente.length,
    ultima_interaccion: msgs.map((m: any) => m.timestamp).sort().pop() ?? null,
    ultimo_mensaje: delCliente.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp)).pop()?.message ?? null,
    resumen: extra.resumen,
  }
}

const clienteMock = (id: string) => getDb().customers.find((c: any) => c.id === id)

on("GET", "/perfil/cliente/:id", ({ params }) => {
  const c = clienteMock(params.id)
  return c ? perfilMock(c) : notFound("Cliente")
})
on("GET", "/perfil/conversacion/:id", ({ params }) => {
  const conv = getDb().conversations.find((v: any) => v.id === params.id)
  if (!conv) return notFound("Conversación")
  const c = getDb().customers.find((x: any) => x.id === conv.customer_id || samePhone(x.phone, conv.customer_phone))
  return c ? perfilMock(c) : null
})
on("PATCH", "/perfil/cliente/:id", ({ params, body }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  perfilMock(c)
  const extra = perfilExtra[c.id]
  if (body.tipo) extra.tipo = body.tipo
  if ("sucursal_preferida_id" in body) {
    const s = getDb().sucursales.find((x: any) => x.id === body.sucursal_preferida_id)
    extra.sucursal = s ? { id: s.id, nombre: s.nombre } : null
  }
  if ("vendedor_id" in body) {
    const u = getDb().agendaVendedores.find((x: any) => x.id === body.vendedor_id)
    extra.vendedor = u ? { id: u.id, nombre: u.nombre } : null
  }
  if ("documento" in body || "documento_tipo" in body) {
    const tipo = body.documento_tipo ?? c.document_type ?? "cedula"
    const numero = String(body.documento ?? "").replace(tipo === "cedula" || tipo === "rnc" ? /\D/g : /[\s-]/g, "").toUpperCase()
    if (numero && tipo === "cedula" && numero.length !== 11) return respond(422, { detail: "la cédula lleva 11 dígitos" })
    if (numero && tipo === "rnc" && numero.length !== 9) return respond(422, { detail: "el RNC lleva 9 dígitos" })
    c.document_type = tipo
    c.document_id = numero || null
  }
  return perfilMock(c)
})
on("GET", "/perfil/cliente/:id/vehiculos/:vid/piezas", ({ params }) => {
  const c = clienteMock(params.id)
  const v = c && vehiculosDelCliente(c).find((x: any) => x.id === params.vid)
  if (!v) return notFound("Vehículo")
  const r = buscarPiezas(getDb().piezas, { marca: v.marca, modelo: v.modelo, anio: v.anio, q: null, sistema: null, vin: null, sort: "nombre" } as any)
  const vistas = new Set(perfilMock(c).piezas_consultadas.map((p: any) => String(p.id)))
  const sistemas = new Map<string, any>()
  for (const i of r.items.map(conExistencias).map(conCalidad) as any[]) {
    const nombre = i.sistema || "Otros"
    const s = sistemas.get(nombre) ?? sistemas.set(nombre, { clave: nombre, nombre, total: 0, piezas: [] }).get(nombre)
    const motor = i.vehiculo?.motor ?? null
    s.piezas.push({ id: String(i.id), sku: i.sku ?? null, nombre: i.nombre, sistema: i.sistema ?? null, etiqueta_calidad: i.etiqueta_calidad ?? null,
      precio_dop: i.precio_dop, disponible: !!i.disponible, existencias: i.existencias ?? [], motor,
      depende_del_motor: !v.motor && !!motor, pedida: vistas.has(String(i.id)) ? "vista" : null })
    s.total += 1
  }
  const lista = [...sistemas.values()]
  const depende = lista.reduce((n, s) => n + s.piezas.filter((p: any) => p.depende_del_motor).length, 0)
  return { vehiculo: v, motor_identificado: !!v.motor, total: r.items.length, dependen_del_motor: depende,
    pedidas: lista.reduce((n, s) => n + s.piezas.filter((p: any) => p.pedida).length, 0),
    aviso: depende && !v.motor ? "El motor no está identificado: se muestran las piezas del modelo. Las marcadas \"depende del motor\" hay que confirmarlas con el VIN, el chasis o la pieza vieja." : null,
    sistemas: lista }
})
on("POST", "/perfil/cliente/:id/bloqueo", ({ params, body }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  if (!String(body.motivo ?? "").trim()) return respond(422, { detail: body.bloqueado ? "indica el motivo del bloqueo" : "indica el motivo del desbloqueo" })
  perfilMock(c)
  perfilExtra[c.id].bloqueo = body.bloqueado ? { motivo: body.motivo.trim(), fecha: now() } : null
  eventosSeguridad.unshift(eventoSeguridad(c, body.bloqueado ? "bloqueo" : "desbloqueo", body.motivo.trim()))
  const b = perfilExtra[c.id].bloqueo
  return { bloqueado: !!b, bloqueado_at: b?.fecha ?? null, bloqueo_motivo: b?.motivo ?? null }
})
on("PATCH", "/perfil/cliente/:id/vehiculos/:vid", ({ params, body }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  perfilMock(c)
  perfilExtra[c.id].estados[params.vid] = body.estado
  return perfilMock(c).vehiculos.find((v: any) => v.id === params.vid) ?? notFound("Vehículo")
})
on("GET", "/perfil/cliente/:id/eventos", ({ params, query }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  const p = perfilMock(c)
  const items: any[] = []
  const porDia = new Map<string, any>()
  for (const m of mensajesDelCliente(c) as any[]) {
    const enlace = `/admin/chat?conversation=${m.conv.id}`
    const vehiculo_id = m.conv.vehiculo?.id ?? null
    if (m.sender === "bot" && (m.piezas ?? m.metadata?.piezas)?.length) {
      const ps = m.piezas ?? m.metadata.piezas
      items.push({ id: m.id, tipo: "pieza_vista", fecha: m.timestamp, titulo: `Vio ${ps.length} pieza${ps.length === 1 ? "" : "s"}`,
        detalle: ps.map((x: any) => x.nombre).join(", "), canal: "whatsapp", atendio: "IA", enlace, vehiculo_id })
    }
    const clave = `${m.conv.id}-${m.timestamp.slice(0, 10)}`
    const d = porDia.get(clave) ?? { id: m.id, tipo: "mensajes", fecha: m.timestamp, n: 0, detalle: null, atendio: new Set<string>(), enlace, vehiculo_id }
    porDia.set(clave, d)
    if (m.sender === "user") {
      d.n++
      d.detalle ??= m.message
      if (/descuento|rebaj|más barato/i.test(m.message)) items.push({ id: `d-${m.id}`, tipo: "descuento", fecha: m.timestamp, titulo: "Pidió descuento", detalle: m.message, canal: "whatsapp", atendio: null, enlace, vehiculo_id })
    } else d.atendio.add(m.sender === "bot" ? "IA" : m.conv.assigned_to_name ?? "Vendedor")
    if (m.timestamp < d.fecha) d.fecha = m.timestamp
  }
  for (const d of porDia.values()) if (d.n) items.push({ ...d, titulo: `Escribió por WhatsApp (${d.n} mensaje${d.n === 1 ? "" : "s"})`, atendio: [...d.atendio].join(", ") || null, canal: "whatsapp", n: undefined })
  for (const q of p.cotizaciones) items.push({ id: q.id, tipo: "cotizacion", fecha: q.fecha, titulo: `Cotización ${q.codigo}`, detalle: `${q.estado} · RD$${Math.round(q.total_dop).toLocaleString("en-US")}`, canal: "whatsapp", atendio: null, enlace: `/admin/cotizaciones/${q.codigo}`, vehiculo_id: q.vehiculo_id })
  for (const x of p.citas) items.push({ id: x.id, tipo: "cita", fecha: x.inicio, titulo: x.tipo === "visita" ? "Visita a la tienda" : "Llamada", detalle: x.estado, canal: "panel", atendio: null, enlace: "/admin/calendario", vehiculo_id: null })
  for (const o of p.ordenes) {
    items.push({ id: o.id, tipo: "orden", fecha: o.fecha, titulo: `Orden ${o.numero}`, detalle: `${o.estado} · RD$${Math.round(o.total_dop).toLocaleString("en-US")}`, canal: "tienda", atendio: null, enlace: `/admin/orders?orden=${o.id}`, vehiculo_id: null })
    if (o.pagada) items.push({ id: `pago-${o.id}`, tipo: "pago", fecha: o.fecha, titulo: `Pago de la orden ${o.numero}`, detalle: `RD$${Math.round(o.total_dop).toLocaleString("en-US")}`, canal: "tienda", atendio: null, enlace: `/admin/orders?orden=${o.id}`, vehiculo_id: null })
  }
  for (const v of vehiculosDelCliente(c)) for (const h of v.historial ?? []) {
    const fecha = new Date(Date.now() - h.hace).toISOString()
    items.push({ id: `${v.id}-${h.hace}`, tipo: h.tipo === "venta" ? "orden" : h.tipo === "cita" ? "cita" : "mensajes", fecha,
      titulo: h.tipo === "venta" ? "Venta en mostrador" : h.tipo === "nota" ? "Nota" : "Consulta", detalle: h.detalle ?? null, canal: h.canal, atendio: h.atendio, enlace: null, vehiculo_id: v.id })
  }
  const tipos = query.get("tipo")?.split(",")
  const vehiculo = query.get("vehiculo_id")
  const lista = items.filter((e) => (!tipos || tipos.includes(e.tipo)) && (!vehiculo || e.vehiculo_id === vehiculo))
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
  return { items: lista.slice(0, num(query.get("limite"), 200)), tipos: ["mensajes", "nota_de_voz", "archivo", "pieza_vista", "descuento", "queja", "devolucion", "cotizacion", "cita", "reserva", "orden", "pago"] }
})
const archivosMock: Record<string, any[]> = {}
on("GET", "/perfil/cliente/:id/archivos", ({ params }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  if (!archivosMock[c.id]) {
    const v = vehiculosDelCliente(c)[0]
    const conv = convsDelCliente(c)[0]
    archivosMock[c.id] = v && conv ? [{
      id: `arch-${c.id}`, tipo: "image", url: "/colt/productos/1ms_1997-07_d6086_kas_1.jpg", mime_type: "image/jpeg",
      nombre: "Foto de la pieza", texto: "[image] así está la pieza", fecha: new Date(Date.now() - 2 * DAY).toISOString(),
      de_cliente: true, conversation_id: conv.id, vehiculo_id: null, eliminado: !!perfilExtra[c.id]?.anonimizado_at,
    }] : []
  }
  return archivosMock[c.id]
})
on("PATCH", "/perfil/archivos/:mid", ({ params, body }) => {
  const a = Object.values(archivosMock).flat().find((x) => x.id === params.mid)
  if (!a) return notFound("Archivo")
  a.vehiculo_id = body.vehiculo_id ?? null
  return { id: a.id, vehiculo_id: a.vehiculo_id }
})
on("GET", "/perfil/cliente/:id/resumen", ({ params }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  const p = perfilMock(c)
  const activos = p.vehiculos.filter((v: any) => v.estado === "activo").map((v: any) => `${v.marca} ${v.modelo} ${v.anio}`)
  const abierta = p.cotizaciones.find((q: any) => q.estado === "borrador" || q.estado === "enviada")
  const r = {
    lineas: [
      `- Vehículo: ${activos.join("; ") || "sin vehículo registrado"}`,
      `- Busca: ${p.ultimo_mensaje ?? "sin detalle"}`,
      `- Historial: ${p.cotizaciones.length ? `${p.cotizaciones.length} cotización${p.cotizaciones.length === 1 ? "" : "es"}` : "sin cotizaciones"}; ${p.senales.compras ? `${p.senales.compras} compras` : "sin compras"}`,
      `- Próximo paso: ${abierta ? `dar seguimiento a la cotización ${abierta.codigo}.` : "preguntar qué pieza necesita y para qué vehículo."}`,
    ],
    fuente: "plantilla",
    fecha: now(),
  }
  perfilExtra[c.id].resumen = r
  return r
})
on("POST", "/perfil/cliente/:id/borrar-datos", ({ params, body }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  if (body?.confirmar !== "BORRAR") return respond(422, { detail: "Solicitud inválida" })
  perfilMock(c)
  const mensajes = mensajesDelCliente(c).filter((m: any) => m.sender === "user").length
  const conversaciones = convsDelCliente(c).length
  for (const conv of convsDelCliente(c)) {
    for (const m of getDb().messages[conv.id] || []) if (m.sender === "user") m.message = "[borrado a pedido del cliente]"
    conv.customer_name = "Cliente borrado"
    conv.customer_phone = `borrado-${conv.id}`
  }
  Object.assign(c, { name: "Cliente borrado", phone: null, email: null, address: null, document_id: null, document_type: null })
  perfilExtra[c.id].anonimizado_at = now()
  perfilExtra[c.id].resumen = null
  for (const a of archivosMock[c.id] ?? []) Object.assign(a, { eliminado: true, url: null })
  return { cliente_id: c.id, anonimizado_at: perfilExtra[c.id].anonimizado_at, conversaciones, mensajes, archivos: (archivosMock[c.id] ?? []).length }
})

// Seguridad de precios (contrato/seguridad.md). El puntaje del mock sale de los días con consultas sin compra.
const eventosSeguridad: any[] = []
function eventoSeguridad(c: any, tipo: string, motivo: string | null, extra: Record<string, unknown> = {}) {
  return { id: newId(), tipo, cliente_id: c.id, cliente: c.name, nivel: tipo === "bloqueo" ? "bloqueado" : "normal", puntaje: null,
    senales: [], motivo, usuario: "Cristian Sánchez", automatico: false, fecha: now(), ...extra }
}
function seguridadMock(c: any, extra: any, compras: number, dias: number) {
  const motivoBlanca = extra.lista_blanca ? "marcado a mano" : compras ? "ya compró" : extra.tipo === "taller" ? "es taller" : null
  const puntaje = Math.min(100, dias * 15)
  const senales = dias >= 3 ? [`consultó ${dias} días sin comprar`, "nunca cotiza, agenda ni compra"] : []
  const nivel = extra.bloqueo ? "bloqueado" : !motivoBlanca && puntaje >= 60 ? "sospechoso" : "normal"
  return { nivel, puntaje, senales, alerta: puntaje >= 60 && !motivoBlanca, lista_blanca: !!motivoBlanca, lista_blanca_motivo: motivoBlanca, bloqueo_vence: null }
}
on("GET", "/seguridad/clientes", ({ query }) => {
  const items = (getDb().customers as any[]).map((c) => {
    const p = perfilMock(c)
    return { id: c.id, nombre: c.name, telefono: c.phone ?? null, tipo: p.cliente.tipo, ...p.cliente.seguridad,
      bloqueado_at: p.cliente.bloqueado_at, bloqueo_motivo: p.cliente.bloqueo_motivo, ultima_consulta: p.ultima_interaccion,
      conversacion_id: p.conversacion_id }
  }).filter((i) => i.puntaje > 0 || i.nivel !== "normal" || i.lista_blanca)
    .filter((i) => !query.get("nivel") || i.nivel === query.get("nivel"))
    .sort((a, b) => Number(b.nivel === "bloqueado") - Number(a.nivel === "bloqueado") || b.puntaje - a.puntaje)
  return {
    resumen: { sospechosos: items.filter((i) => i.nivel === "sospechoso").length, bloqueados: items.filter((i) => i.nivel === "bloqueado").length,
      alertas_7d: eventosSeguridad.filter((e) => ["alerta", "sospechoso", "bloqueo"].includes(e.tipo)).length,
      lista_blanca: items.filter((i) => i.lista_blanca).length },
    items: items.slice(0, num(query.get("limite"), 50)),
  }
})
on("GET", "/seguridad/eventos", ({ query }) => {
  const tipos = query.get("tipo")?.split(",")
  return eventosSeguridad.filter((e) => (!tipos || tipos.includes(e.tipo)) && (!query.get("cliente_id") || e.cliente_id === query.get("cliente_id")))
    .slice(0, num(query.get("limite"), 100))
})
on("POST", "/perfil/cliente/:id/lista-blanca", ({ params, body }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  perfilMock(c)
  perfilExtra[c.id].lista_blanca = !!body.activo
  eventosSeguridad.unshift(eventoSeguridad(c, "lista_blanca", body.motivo ?? (body.activo ? "agregado a la lista blanca" : "quitado de la lista blanca")))
  return { lista_blanca: !!body.activo, seguridad: perfilMock(c).cliente.seguridad }
})
on("POST", "/perfil/cliente/:id/no-molestar", ({ params, body }) => {
  const c = clienteMock(params.id)
  if (!c) return notFound("Cliente")
  perfilMock(c)
  perfilExtra[c.id].no_molestar = body.activo !== false
  return { cliente_id: c.id, no_molestar: perfilExtra[c.id].no_molestar }
})
on("POST", "/perfil/conversacion/:id/no-molestar", ({ params, body }) => {
  const conv = getDb().conversations.find((v: any) => v.id === params.id)
  const c = conv && getDb().customers.find((x: any) => x.id === conv.customer_id || samePhone(x.phone, conv.customer_phone))
  if (!c) return notFound("Conversación")
  perfilMock(c)
  perfilExtra[c.id].no_molestar = body.activo !== false
  return { cliente_id: c.id, no_molestar: perfilExtra[c.id].no_molestar }
})

// Memoria colectiva (contrato/memoria.md)
const sinonimosMock: any[] = [
  { id: newId(), palabra: "pastillas", significa: "banda de freno", pieza_id: null, estado: "aprobado", veces: 4, creado_por: "Ana", aprobado_por: "Ana", aprobado_en: now(), creado: now() },
]
const noEntendidasMock = [
  { texto: "guardalodo", ejemplo: "guardalodo", veces: 5, vehiculos: ["Mitsubishi L200 2015"] },
  { texto: "chupones de la puerta", ejemplo: "chupones de la puerta", veces: 3, vehiculos: ["Hyundai Accent 2012"] },
  { texto: "bomper", ejemplo: "bomper", veces: 2, vehiculos: [] },
]
const propuestasMock: any[] = [
  { id: newId(), tipo: "faq", estado: "propuesto", veces: 3, nota: null, revisado_por: null, revisado_en: null, resultado_id: null, creado: now(), actualizado: now(),
    datos: { pregunta: "¿hacen envíos al interior?", respuesta: "Sí, enviamos a todo el país con Vimenpaq; llega en dos o tres días laborables." } },
  { id: newId(), tipo: "compatibilidad", estado: "propuesto", veces: 2, nota: null, revisado_por: null, revisado_en: null, resultado_id: null, creado: now(), actualizado: now(),
    datos: { pieza_id: "demo", pieza: "Amortiguador delantero", sku: "IM100889", marca: "Hyundai", modelo: "Tucson", anio: 2016, motor: null, ventas: 2, devoluciones: 0 } },
  { id: newId(), tipo: "compatibilidad", estado: "revisar", veces: 1, nota: "una devolución la puso en duda", revisado_por: null, revisado_en: null, resultado_id: null, creado: now(), actualizado: now(),
    datos: { pieza_id: "demo", pieza: "Banda de freno trasera", sku: null, marca: "Mitsubishi", modelo: "Montero", anio: 2008, motor: null, ventas: 1, devoluciones: 1 } },
]
const normalizarMock = (t: string) => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
on("GET", "/ia/sinonimos", () => sinonimosMock.filter((s) => s.estado === "aprobado").map(({ palabra, significa }) => ({ palabra, significa })))
on("GET", "/memoria/no-entendidas", () => noEntendidasMock
  .filter((n) => !sinonimosMock.some((s) => s.palabra === n.texto)).map((n) => ({ ...n, ultima: now() })))
on("POST", "/memoria/no-entendidas/ignorar", ({ body }) => {
  const s = { id: newId(), palabra: normalizarMock(body.texto), significa: "", pieza_id: null, estado: "ignorado", veces: 0, creado_por: "Cristian Sánchez", aprobado_por: null, aprobado_en: null, creado: now() }
  sinonimosMock.unshift(s)
  return s
})
on("GET", "/memoria/sinonimos", ({ query }) => sinonimosMock.filter((s) => !query.get("estado") || s.estado === query.get("estado")))
on("POST", "/memoria/sinonimos", ({ body }) => {
  const palabra = normalizarMock(String(body.palabra ?? ""))
  if (!palabra || !String(body.significa ?? "").trim()) return respond(422, { detail: "indica la palabra y qué significa" })
  const previo = sinonimosMock.findIndex((s) => s.palabra === palabra)
  if (previo >= 0) sinonimosMock.splice(previo, 1)
  const s = { id: newId(), palabra, significa: body.significa.trim(), pieza_id: body.pieza_id ?? null, estado: body.aprobar === false ? "propuesto" : "aprobado",
    veces: noEntendidasMock.find((n) => n.texto === palabra)?.veces ?? 0, creado_por: "Cristian Sánchez", aprobado_por: "Cristian Sánchez", aprobado_en: now(), creado: now() }
  sinonimosMock.unshift(s)
  return s
})
on("POST", "/memoria/sinonimos/:id/aprobar", ({ params }) => {
  const s = sinonimosMock.find((x) => x.id === params.id)
  return s ? Object.assign(s, { estado: "aprobado", aprobado_por: "Cristian Sánchez", aprobado_en: now() }) : notFound("Sinónimo")
})
on("DELETE", "/memoria/sinonimos/:id", ({ params }) => {
  const i = sinonimosMock.findIndex((x) => x.id === params.id)
  if (i < 0) return notFound("Sinónimo")
  sinonimosMock.splice(i, 1)
  return { ok: true }
})
on("GET", "/memoria/propuestas", ({ query }) => {
  const estados = query.get("estado")?.split(",")
  return propuestasMock.filter((p) => (!query.get("tipo") || p.tipo === query.get("tipo")) && (!estados || estados.includes(p.estado)))
})
on("POST", "/memoria/propuestas/generar", () => ({ faq: 0, compatibilidades: 0 }))
on("POST", "/memoria/propuestas/:id/aprobar", ({ params, body }) => {
  const p = propuestasMock.find((x) => x.id === params.id)
  if (!p) return notFound("Propuesta")
  if (p.tipo === "faq") p.datos = { pregunta: body?.pregunta ?? p.datos.pregunta, respuesta: body?.respuesta ?? p.datos.respuesta }
  return Object.assign(p, { estado: "aprobado", revisado_por: "Cristian Sánchez", revisado_en: now(), resultado_id: newId() })
})
on("POST", "/memoria/propuestas/:id/rechazar", ({ params, body }) => {
  const p = propuestasMock.find((x) => x.id === params.id)
  return p ? Object.assign(p, { estado: "rechazado", nota: body?.nota ?? null, revisado_por: "Cristian Sánchez", revisado_en: now() }) : notFound("Propuesta")
})

// Tipo de negocio, catálogo oficial, almacenamiento y Odoo
const NEGOCIO_MOCK = "mock-negocio"
const TIPOS_NEGOCIO = [
  { valor: "seguros", nombre: "Corredor de seguros" }, { valor: "repuestos", nombre: "Repuestos de vehículos" }, { valor: "tienda", nombre: "Tienda en línea" },
  { valor: "restaurante", nombre: "Restaurante" }, { valor: "salon", nombre: "Salón de belleza" }, { valor: "clinica", nombre: "Clínica" }, { valor: "otro", nombre: "Otro" },
]
function negocioMock() {
  const g = JSON.parse(localStorage.getItem(NEGOCIO_MOCK) || "{}")
  const tipo = g.tipo ?? VERTICAL_INICIAL
  const propios = g.modulos ?? {}
  return {
    tipo, tipos: TIPOS_NEGOCIO, modulos: { ...modulosPorTipo(tipo), ...propios }, modulos_propios: propios,
    catalogos_oficiales: g.catalogos_oficiales ?? ["Mitsubishi", "Hyundai", "Kia"].map((marca) => ({ marca, url: "https://partsouq.com/en/search/all?q={oem}" })),
  }
}
on("GET", "/empresa/negocio", () => negocioMock())
on("PUT", "/empresa/negocio", ({ body }) => {
  const g = JSON.parse(localStorage.getItem(NEGOCIO_MOCK) || "{}")
  if (body.tipo && !TIPOS_NEGOCIO.some((t) => t.valor === body.tipo)) return respond(422, { detail: "tipo de negocio inválido" })
  if (body.tipo && body.tipo !== g.tipo) g.modulos = {}
  if (body.tipo) g.tipo = body.tipo
  if (body.modulos) g.modulos = { ...(g.modulos ?? {}), ...body.modulos }
  if (body.catalogos_oficiales) g.catalogos_oficiales = body.catalogos_oficiales
  localStorage.setItem(NEGOCIO_MOCK, JSON.stringify(g))
  return negocioMock()
})
on("GET", "/empresa/almacenamiento", () => ({ modo: "local", bucket: null, retencion: { audio_horas: 24, fotos: null, documentos_dias: null }, url_firmada_segundos: 604800 }))
on("GET", "/odoo/estado", () => ({ configurado: true, url: "http://localhost:8069", base: "colt", usuario: "admin", diario_pagos: null }))
on("POST", "/odoo/probar", () => ({ ok: true, uid: 2 }))
on("POST", "/odoo/exportar", ({ body }) => {
  const db = getDb()
  const compras = db.orders.filter((o: any) => o.status !== "cancelled").length
  const r: Record<string, object> = {
    productos: { creados: 0, actualizados: db.piezas.length },
    clientes: { creados: 0, actualizados: db.customers.length },
    ordenes: { creados: compras, omitidas: 0 },
    pagos: { creados: compras, omitidas: 0 },
  }
  return r[body?.que] ? { que: body.que, ...r[body.que] } : respond(422, { detail: "qué exportar: productos, clientes, ordenes o pagos" })
})

// Estadísticas (contrato/estadisticas.md): se calculan con las órdenes, cotizaciones y mensajes del mock.
const ALERTAS_MOCK = "mock-alertas-estadisticas"
const ALERTAS_BASE = { activo: true, dias_se_acaba: 7, veces_no_hay: 5, ventana_dias: 30 }
const enPeriodoEst = (iso: string | undefined, query: URLSearchParams) => {
  if (!iso) return false
  const dia = iso.slice(0, 10)
  return (!query.get("desde") || dia >= query.get("desde")!) && (!query.get("hasta") || dia <= query.get("hasta")!)
}
function vendidosMock(query: URLSearchParams) {
  const porPieza = new Map<string, { pieza_id: string; nombre: string; sku: string | null; unidades: number; monto_dop: number }>()
  for (const o of getDb().orders as any[]) {
    if (!isPaidStatus(String(o.status)) || !enPeriodoEst(o.created_at, query)) continue
    for (const it of o.items ?? []) {
      const f = porPieza.get(it.product_id) ?? { pieza_id: it.product_id, nombre: it.product_name, sku: it.product_sku ?? null, unidades: 0, monto_dop: 0 }
      f.unidades += it.quantity
      f.monto_dop = round2(f.monto_dop + it.total_price)
      porPieza.set(it.product_id, f)
    }
  }
  return [...porPieza.values()].sort((a, b) => b.unidades - a.unidades)
}
on("GET", "/estadisticas/resumen", ({ query }) => {
  const v = vendidosMock(query)
  return { consultas: 0, sin_resultado: 0, pidieron_descuento: 0, unidades_vendidas: v.reduce((n, x) => n + x.unidades, 0),
    monto_vendido_dop: round2(v.reduce((n, x) => n + x.monto_dop, 0)), costo_ia_usd: 0, latencia_mediana_ms: null }
})
on("GET", "/estadisticas/alertas", () => ({ ...ALERTAS_BASE, ...JSON.parse(localStorage.getItem(ALERTAS_MOCK) || "{}") }))
on("PUT", "/estadisticas/alertas", ({ body }) => {
  const nueva = { ...ALERTAS_BASE, ...JSON.parse(localStorage.getItem(ALERTAS_MOCK) || "{}"), ...(body as object) }
  localStorage.setItem(ALERTAS_MOCK, JSON.stringify(nueva))
  return nueva
})
on("POST", "/estadisticas/alertas/revisar", () => ({ se_acaba: 0, pedida_sin_existencia: 0 }))
on("GET", "/estadisticas/:vista", ({ params, query }) => {
  const vista = params.vista
  if (vista === "mas_vendidos") return { items: vendidosMock(query) }
  if (vista === "no_hay") {
    const grupos = new Map<string, any>()
    for (const b of getDb().busquedasExternas as any[]) {
      const cuando = b.creada ?? b.created_at
      if (!enPeriodoEst(cuando, query)) continue
      const clave = String(b.pieza).toLowerCase()
      const g = grupos.get(clave) ?? { pieza: b.pieza, veces: 0, vehiculos: [], fuentes: { busqueda_externa: 0 }, ultima: cuando }
      g.veces += 1
      g.fuentes.busqueda_externa += 1
      grupos.set(clave, g)
    }
    return { items: [...grupos.values()].sort((a, b) => b.veces - a.veces) }
  }
  if (vista === "cotizado_sin_venta") {
    const porPieza = new Map<string, any>()
    for (const c of getDb().cotizaciones as any[]) {
      for (const it of c.items ?? []) {
        const f = porPieza.get(String(it.pieza_id)) ?? { pieza_id: String(it.pieza_id), nombre: it.descripcion, sku: null, cotizaciones: 0, ventas: 0, precio_dop: it.precio_dop }
        f.cotizaciones += 1
        if (c.estado === "aceptada") f.ventas += 1
        porPieza.set(f.pieza_id, f)
      }
    }
    return { items: [...porPieza.values()].map((f) => ({ ...f, sin_venta: f.cotizaciones - f.ventas, conversion: f.ventas / f.cotizaciones })).sort((a, b) => b.sin_venta - a.sin_venta) }
  }
  if (vista === "picos") {
    const dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    const matriz: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const lista of Object.values(getDb().messages) as any[][]) {
      for (const m of lista) {
        if (m.sender !== "user") continue
        const d = new Date(m.timestamp)
        matriz[(d.getDay() + 6) % 7][d.getHours()] += 1
      }
    }
    let pico: { dia: string; hora: number; mensajes: number } | null = null
    matriz.forEach((f, d) => f.forEach((n, h) => { if (n && (!pico || n > pico.mensajes)) pico = { dia: dias[d], hora: h, mensajes: n } }))
    return {
      matriz, dias, pico, total: matriz.flat().reduce((a, b) => a + b, 0),
      por_dia: matriz.map((f) => f.reduce((a, b) => a + b, 0)),
      por_hora: Array.from({ length: 24 }, (_, h) => matriz.reduce((n, f) => n + f[h], 0)),
    }
  }
  if (vista === "clientes") {
    const por = new Map<string, any>()
    for (const o of getDb().orders as any[]) {
      if (!isPaidStatus(String(o.status))) continue
      const f = por.get(o.customer_id) ?? { cliente_id: o.customer_id, nombre: o.customer_name, telefono: o.customer_phone, compras: 0, total_dop: 0, ultima_compra: o.created_at, primera_compra: o.created_at }
      f.compras += 1
      f.total_dop = round2(f.total_dop + Number(o.total))
      if (o.created_at > f.ultima_compra) f.ultima_compra = o.created_at
      por.set(o.customer_id, f)
    }
    const dias = Number(query.get("dias_inactivo") || 90)
    const filas = [...por.values()].map((f) => ({ ...f, ticket_promedio_dop: round2(f.total_dop / f.compras), dias_sin_comprar: Math.floor((Date.now() - new Date(f.ultima_compra).getTime()) / DAY) }))
    return { mejores: [...filas].sort((a, b) => b.total_dop - a.total_dop), inactivos: filas.filter((f) => f.dias_sin_comprar > dias),
      dias_inactivo: dias, clientes_con_compras: filas.length, recurrentes: filas.filter((f) => f.compras > 1).length }
  }
  return { items: [] }
})

// Visitas de hoy por sucursal, llegada y venta en tienda (contrato/agenda.md)
on("GET", "/agenda/hoy", () => {
  const hoy = new Date().toDateString()
  const citas = (getDb().citas as any[]).filter((c) => c.tipo === "visita" && c.estado !== "cancelada" && new Date(c.inicio).toDateString() === hoy)
  const grupos = new Map<string, any>()
  for (const c of citas) {
    const g = grupos.get(c.sucursal ?? "") ?? { sucursal_id: null, sucursal: c.sucursal ?? "Sin sucursal", citas: [] }
    g.citas.push({ ...c, hora: new Date(c.inicio).toTimeString().slice(0, 5), cliente_telefono: c.telefono, conversation_id: c.conversacion_id,
      vehiculo: null, piezas: [], cotizacion: null, orden: null, llego_at: c.llego_at ?? null })
    grupos.set(c.sucursal ?? "", g)
  }
  return { fecha: new Date().toISOString().slice(0, 10), total: citas.length, sucursales: [...grupos.values()] }
})
on("POST", "/agenda/citas/:id/llego", ({ params }) => {
  const c = (getDb().citas as any[]).find((x) => x.id === params.id)
  if (!c) return notFound("Cita")
  c.llego_at = c.llego_at ?? new Date().toISOString()
  c.estado = "completada"
  return c
})
on("POST", "/agenda/citas/:id/venta", () => respond(422, { detail: "la cita no tiene cotización: crea una o indica cotizacion_codigo" }))
on("POST", "/cotizaciones/:codigo/link-pago", ({ params }) => {
  const q = vigente(params.codigo)
  if (!q) return notFound("Cotización")
  return { url: `${window.location.origin}/pay/demo-${q.codigo}`, codigo: q.codigo, orden: null, monto_dop: q.total_dop, vence: new Date(Date.now() + DAY).toISOString() }
})
on("GET", "/payments/providers/estado", () => ({
  cobro_real: false, listos: 0,
  proveedores: [
    { clave: "azul", nombre: "Azul", estado: "sin_configurar", modo_prueba: true, faltan: [{ clave: "merchant_id", nombre: "Merchant ID", da: "Azul" }, { clave: "secret_key", nombre: "Auth key (clave secreta)", da: "Azul" }] },
    { clave: "bhd", nombre: "BHD", estado: "sin_configurar", modo_prueba: true, faltan: [{ clave: "client_id", nombre: "Client ID", da: "BHD" }, { clave: "client_secret", nombre: "Client secret", da: "BHD" }] },
    { clave: "popular", nombre: "Banco Popular", estado: "sin_configurar", modo_prueba: true, faltan: [{ clave: "convenio", nombre: "Convenio (CNV)", da: "Banco Popular" }, { clave: "secret_key", nombre: "Clave secreta", da: "Banco Popular" }] },
  ],
}))

// ===== Caso del mostrador: pase con motivo y brief, vehículo corregible, rechazar y corregir la cotización =====
// Formas en contrato/conversaciones.md (motivo_pase, brief_pase, last_inbound_text), contrato/vehiculos.md y
// contrato/cotizaciones.md. Precios y SKU del brief salen del catálogo (REF).

const ultimoDelCliente = (convId: string) => [...(getDb().messages[convId] || [])].reverse().find((m: any) => m.sender === "user")
const VEHICULO_IDENTIFICADO: Record<string, Record<string, unknown>> = {
  veh_1: { version: "GL", carroceria: "SUV", traccion: "4x2", combustible: "gasolina", fuente_identificacion: "vin", verificado: true, confirmado_por_cliente: true },
  veh_2: { version: null, carroceria: "Camioneta doble cabina", traccion: "4x2", combustible: "gasolina", fuente_identificacion: "vin", verificado: true, confirmado_por_cliente: true },
  veh_3: { version: null, carroceria: "Sedán", traccion: null, combustible: "gasolina", fuente_identificacion: "descripcion", verificado: false, confirmado_por_cliente: true },
}

function sembrarCasoMostrador() {
  const db = getDb()
  for (const c of db.conversations as any[]) {
    if (c.last_inbound_text !== undefined) continue
    const m: any = ultimoDelCliente(c.id)
    c.last_inbound_text = m ? m.transcripcion || (m.metadata?.media_type === "audio" ? "Nota de voz" : m.message) : null
  }
  for (const v of db.vehiculos as any[]) {
    for (const [campo, valor] of Object.entries(VEHICULO_IDENTIFICADO[v.id] ?? {})) if (v[campo] === undefined) v[campo] = valor
  }
  const taller: any = db.conversations.find((c: any) => c.id === "conv-002")
  const l200: any = db.vehiculos.find((v: any) => v.id === "veh_2")
  if (taller && l200 && taller.motivo_pase === undefined) {
    taller.motivo_pase = "pide_persona"
    taller.motivo_pase_texto = "Pide hablar con una persona"
    taller.esperando_desde = taller.agent_requested_at
    taller.brief_pase = {
      motivo: "pide_persona",
      motivo_texto: "Pide hablar con una persona",
      esperando_desde: taller.agent_requested_at,
      nombre: taller.customer_name,
      vehiculo: {
        marca: l200.marca, modelo: l200.modelo, anio: l200.anio, motor: l200.motor, vin: l200.vin, chasis: null,
        fuente_identificacion: l200.fuente_identificacion, verificado: l200.verificado, confirmado_por_cliente: l200.confirmado_por_cliente,
      },
      piezas: [{ nombre: "Bandas de freno delanteras", posicion: "delanteras", lado: null, cantidad: 4 }],
      opciones: [REF.bandasL200, REF.bandasL200Orig].map((r, i) => ({
        numero: i + 1, product_id: r.id, sku: r.sku, nombre: r.name, calidad: i === 0 ? "alterna" : "original", precio_dop: r.price, cantidad: 4,
      })),
      falta: ["Precio de taller por los 4 juegos (lo decide el mostrador)", "Si se despacha hoy"],
      ultima_pregunta: null,
    }
  }
}
sembrarCasoMostrador()

const CAMPOS_VEHICULO_CLIENTE = ["marca", "modelo", "anio", "motor", "version", "carroceria", "traccion", "vin", "chasis", "placa", "kilometraje"] as const
const datosVehiculoCliente = (body: any) => Object.fromEntries(CAMPOS_VEHICULO_CLIENTE.filter((k) => body?.[k] !== undefined).map((k) => [k, body[k]]))
const resumenEnConversaciones = (v: any) => {
  for (const c of getDb().conversations as any[]) {
    if (c.vehiculo?.id === v.id || c.vehiculo_id === v.id) c.vehiculo = { id: v.id, marca: v.marca, modelo: v.modelo, anio: v.anio, motor: v.motor ?? "" }
  }
}

on("PATCH", "/vehiculos/:id", ({ params, body }) => {
  const v: any = findVehiculo(params.id)
  if (!v) return notFound("Vehículo")
  Object.assign(v, datosVehiculoCliente(body))
  if (body?.fuente_identificacion === "vendedor") Object.assign(v, { fuente_identificacion: "vendedor", verificado: true })
  resumenEnConversaciones(v)
  return vehiculoResumen(v)
})
on("POST", "/vehiculos", ({ body }) => {
  if (!body?.marca || !body?.modelo) return respond(422, { detail: "marca y modelo son obligatorios" })
  const conv: any = body.conversation_id ? findConv(body.conversation_id) : null
  const v: any = {
    id: newId("veh"), cliente_id: body.cliente_id ?? conv?.customer_id ?? null, conversation_id: conv?.id ?? null,
    marca: null, modelo: null, anio: null, motor: null, vin: null, placa: null, kilometraje: null,
    servicios: {}, historial: [], ...datosVehiculoCliente(body),
    fuente_identificacion: body.fuente_identificacion ?? "panel", verificado: body.fuente_identificacion === "vendedor",
  }
  getDb().vehiculos.push(v)
  if (conv) {
    conv.vehiculo_id = v.id
    conv.vehiculo = { id: v.id, marca: v.marca, modelo: v.modelo, anio: v.anio, motor: v.motor ?? "" }
  }
  return respond(201, vehiculoResumen(v))
})

const cerradaParaCambios = (q: CotizacionMock) => !!ordenDe(q.codigo) || ["aceptada", "rechazada", "vencida"].includes(q.estado)
const avisoAlCliente = (q: CotizacionMock, texto: string, plantilla: string) => {
  const c: any = q.conversacion_id ? findConv(q.conversacion_id) : null
  if (!c) return null
  const msg = pushMessage(c.id, { sender: "admin", message: texto, metadata: { sent_via_whatsapp: true, client_source: "web", autor: "sistema", aviso: plantilla, cotizacion: q.codigo } })
  return { enviada: true, mensaje_id: msg.id, error: null }
}

on("POST", "/cotizaciones/:codigo/rechazar", ({ params, body }) => {
  const q: any = vigente(params.codigo)
  if (!q) return notFound("Cotización")
  if (cerradaParaCambios(q)) return respond(409, { detail: "Esta cotización ya no se puede rechazar." })
  if (!body?.motivo) return respond(422, { detail: "Falta el motivo del rechazo." })
  Object.assign(q, { estado: "rechazada", rechazo: { motivo: body.motivo, nota: body.nota ?? null, por: me().name, at: now() } })
  const mensaje = body.avisar_cliente ? avisoAlCliente(q, plantillaRechazo(q.codigo, q.cliente?.nombre), "colt_cotizacion_rechazada") : null
  return { ...conVersiones(q), mensaje }
})
on("POST", "/cotizaciones/:codigo/corregir", ({ params, body }) => {
  const q: any = vigente(params.codigo)
  if (!q) return notFound("Cotización")
  if (cerradaParaCambios(q)) return respond(409, { detail: "Esta cotización ya no se puede corregir." })
  if (!body?.motivo) return respond(422, { detail: "Falta el motivo de la corrección." })
  const items = (body?.items ?? []).map(lineaDe).filter(Boolean)
  if (!items.length) return respond(422, { detail: "la cotización necesita al menos una pieza del catálogo" })
  const creada = new Date()
  const nueva: any = {
    ...JSON.parse(JSON.stringify(q)),
    version: q.version + 1,
    estado: "enviada",
    creada: creada.toISOString(),
    vence: new Date(creada.getTime() + 7 * DAY).toISOString().slice(0, 10),
    items,
    ...totales(items),
    correccion: { motivo: body.motivo, nota: body.nota ?? null, por: me().name, at: now(), reemplaza_version: q.version },
  }
  getDb().cotizaciones.push(nueva)
  const mensaje = avisoAlCliente(nueva, plantillaCorreccion(q.codigo, nueva.version, body.motivo, q.cliente?.nombre), "colt_cotizacion_corregida")
  return { ...conVersiones(nueva), mensaje }
})

// ── Pruebas (contrato/pruebas.md): reinicio por teléfono, canal simulado o real y reloj ──
const PRUEBAS_TELEFONOS = ["+18294640814", "+18295242360", "+18294994556"]
const pruebas: { canal: "simulado" | "real"; vence: string | null; desde: string; reloj: { fecha_local: string; hora_local: string } | null; ultimo: any } = {
  canal: "simulado", vence: null, desde: new Date().toISOString(), reloj: null, ultimo: null,
}
const estadoPruebas = () => ({
  habilitado: true, entorno: "development", empresa_id: COMPANY_ID, telefonos: PRUEBAS_TELEFONOS,
  rango_ficticio: { desde: "+18095550100", hasta: "+18095550199" },
  canal_activo: pruebas.canal, canal_real_vence: pruebas.canal === "real" ? pruebas.vence : null,
  llamadas_graph: 0, bloqueadas_graph: 0, contador_desde: pruebas.desde,
  reloj: pruebas.reloj ? { ...pruebas.reloj, zona: "America/Santo_Domingo", ahora: `${pruebas.reloj.fecha_local}T${pruebas.reloj.hora_local}:00-04:00` } : null,
  existencias: "demo0000000000000000", precios_incluyen_itbis: false, itbis_tasa: ITBIS_RATE,
  ultimo_reinicio: pruebas.ultimo, ora: { disponible: true, error: null },
})
const telefonoDePrueba = (t: string) => {
  const d = digits(t).length === 10 ? `1${digits(t)}` : digits(t)
  const n = Number(d)
  return PRUEBAS_TELEFONOS.includes(`+${d}`) || (n >= 18095550100 && n <= 18095550199) ? `+${d}` : null
}
on("GET", "/pruebas/estado", () => estadoPruebas())
on("PUT", "/pruebas/canal", ({ body }) => {
  if (body?.canal !== "simulado" && body?.canal !== "real") return respond(422, { detail: "canal inválido: simulado o real" })
  Object.assign(pruebas, { canal: body.canal, vence: body.canal === "real" ? new Date(Date.now() + 2 * 3600_000).toISOString() : null, desde: new Date().toISOString() })
  return estadoPruebas()
})
on("PUT", "/pruebas/reloj", ({ body }) => {
  pruebas.reloj = body?.fecha_local && body?.hora_local ? { fecha_local: body.fecha_local, hora_local: body.hora_local } : null
  return { reloj: estadoPruebas().reloj, ora_error: null }
})
on("POST", "/pruebas/reiniciar", ({ body }) => {
  const telefono = telefonoDePrueba(String(body?.telefono ?? ""))
  if (!telefono) return respond(403, { detail: "teléfono fuera de la lista de prueba" })
  const modo = String(body?.modo ?? "").replace("-", "_")
  if (!["nuevo", "solo_conversacion", "conocido"].includes(modo)) return respond(422, { detail: "modo inválido: nuevo, solo_conversacion o conocido" })
  if (modo === "conocido" && !body?.perfil?.nombre) return respond(422, { detail: "conocido necesita perfil con nombre" })
  const db = getDb()
  const convs = db.conversations.filter((c: any) => samePhone(c.customer_phone ?? c.customerPhone ?? "", telefono))
  const mensajes = convs.reduce((n: number, c: any) => n + (db.messages?.[c.id]?.length ?? 0), 0)
  const mg: Record<string, number> = convs.length ? { chat_conversations: convs.length, chat_messages: mensajes } : {}
  if (!body?.simular) {
    db.conversations = db.conversations.filter((c: any) => !convs.includes(c))
    pruebas.ultimo = { fecha: new Date().toISOString(), telefonos: [telefono], modo, usuario: me().email ?? null }
  }
  return {
    modo, telefonos: [telefono], simulado: !!body?.simular, mg,
    ora: convs.length ? { clients: modo === "solo_conversacion" ? 0 : 1, conversations: convs.length, messages: mensajes } : {},
    ora_error: null, productos_del_caso: { products: 0, vehiculos_catalogo: 0 },
    existencias: { antes: "demo0000000000000000", despues: "demo0000000000000000", anterior: pruebas.ultimo ? "demo0000000000000000" : null, coincide: pruebas.ultimo ? true : null },
    citas_google: { canceladas: 0, con_error: 0 }, reloj: estadoPruebas().reloj,
    perfil: modo === "conocido" && !body?.simular ? { customer_id: newId(), vehiculos: body.perfil.vehiculos?.length ?? 0, cotizaciones: [], ordenes: 0, citas: 0, reservas: 0, conversacion: null } : null,
  }
})

on("GET", "/pruebas/telefono-libre", () => {
  const db = getDb()
  const fijos = new Set([100, 101, 181, 182, 183, 184, 185, 186, 187, 188, 189])
  for (let n = 100; n <= 199; n++) {
    const telefono = `+18095550${n}`
    if (fijos.has(n) || db.conversations.some((c: any) => samePhone(c.customer_phone ?? c.customerPhone ?? "", telefono))) continue
    return { telefono, libre: true, ultimo_uso: null, reiniciar: false, mensaje: `Usa el ${telefono}: no tiene nada en MG.`, saltados: [...fijos].map((f) => `+18095550${f}`) }
  }
  return { telefono: "+18095550102", libre: false, ultimo_uso: null, reiniciar: true, mensaje: "Ninguno libre: usa el +18095550102; se reinicia como cliente nuevo al iniciar el caso.", saltados: [] }
})

// Consola de casos (/admin/pruebas/casos): un caso de ejemplo; el bot simulado no responde en modo mock
const CASO_MOCK = {
  id: "340", nombre: "Saluda y pide de una vez: alante o atrás y el motor, y el precio en pocas respuestas", area: "Saludo, identificación y turnos",
  prioridad: "P0", demo: false, grupo: "Saludo, experto, seguridad y correo", nivel: "N2", con_historial: false,
  primer_mensaje: "buenas, quiero unas bandas pa un lancer 2005", pasos: 2, variantes: ["con buenas", "con klk"], consola: true,
}
const pasoMock = (n: number, texto: string, reglas: [string, string, string][]) => ({
  n, entrada: { tipo: "cliente", texto, enviable: true }, pausa_seg: null, nota: null, nombra_pieza: n === 1,
  reglas: reglas.map(([id, etiqueta, t]) => ({ id, tipo: id.split(".")[0], etiqueta, texto: t, evaluable: true })),
})
const mensajesConsola: Record<string, any[]> = {}
on("GET", "/pruebas/casos", () => ({ casos: [CASO_MOCK] }))
on("GET", "/pruebas/casos/:id", ({ params, query }) => params.id !== "340" ? respond(404, { detail: "caso desconocido" }) : ({
  ...CASO_MOCK, clave: `340.${query.get("variante") ?? 1}`, variante: Number(query.get("variante") ?? 1), reiniciar: "nuevo",
  perfil_nombre: null, perfil: null, telefono: query.get("telefono") ?? "+18095550101", telefono_del_caso: "auto",
  reloj: { fecha_local: "2026-10-15", hora_local: "15:30" }, vehiculo: "Lancer CS 1.3", tipo_cliente: "nuevo", flujo: null,
  max_turnos_hasta_precio: 3, juicio: ["Contesta a la pieza en la primera respuesta"], notas: null, continua_de: null, config: null,
  acciones: [], origen: null,
  pasos: [
    pasoMock(1, "buenas, quiero unas bandas pa un lancer 2005", [["debe.0", "Debe decir", "banda"], ["saludo", "Saluda", ""], ["sin_precios", "Sin precios todavía", ""]]),
    pasoMock(2, "las de alante, el 1.3", [["sin_saludo", "No vuelve a saludar", ""], ["con_precios", "Da precios", ""]]),
  ],
}))
on("POST", "/pruebas/casos/:id/evaluar", ({ body }) => ({
  paso: body?.paso, con_monto: false, respuestas: (body?.mensajes ?? []).length,
  reglas: [{ id: "debe.0", tipo: "debe", etiqueta: "Debe decir", texto: "banda", evaluable: true, resultado: (body?.mensajes ?? []).length ? "pasa" : "esperando", detalle: [] }],
}))
on("GET", "/pruebas/conversacion", ({ query }) => {
  const telefono = telefonoDePrueba(String(query.get("telefono") ?? ""))
  if (!telefono) return respond(403, { detail: "teléfono fuera de la lista de prueba" })
  return { telefono, conversaciones: [], conversation_id: null, mensajes: mensajesConsola[telefono] ?? [], costo_usd: null, consultas_con_costo: 0 }
})
on("POST", "/pruebas/mensaje", ({ body }) => {
  const telefono = telefonoDePrueba(String(body?.telefono ?? ""))
  if (!telefono) return respond(403, { detail: "teléfono fuera de la lista de prueba" })
  if (pruebas.canal === "real") return respond(409, { detail: "con WhatsApp real se escribe desde el teléfono" })
  const texto = body?.texto ?? body?.boton?.titulo ?? body?.lista?.titulo ?? String(body?.boton ?? body?.lista ?? "")
  ;(mensajesConsola[telefono] ??= []).push({ id: newId(), sender: "user", autor: "cliente", bot: false, texto, tipo: "text", fecha: new Date().toISOString(), interactivo: null, wamid: null, piezas: [] })
  return { wamid: `wamid.consola.${newId()}`, telefono, mensaje: {} }
})
on("POST", "/pruebas/reiniciar-todo", () => {
  for (const k of Object.keys(mensajesConsola)) delete mensajesConsola[k]
  pruebas.reloj = null
  return { reinicio: { modo: "nuevo", telefonos: [...PRUEBAS_TELEFONOS, "+18095550100 a +18095550199"], simulado: false, mg: {}, ora: {}, ora_error: null }, clientes: [], clientes_error: null }
})
