import { buildAuditLogs, buildDiscounts } from "./data/admin"
import { buildCampaigns, metaTemplates } from "./data/campaigns"
import { COMPANY_ID } from "./data/common"
import { buildConversationRecords, chatTags } from "./data/conversations"
import { buildCotizaciones } from "./data/cotizaciones"
import { customers } from "./data/customers"
import { knowledge } from "./data/knowledge"
import { buildOrders } from "./data/orders"
import { buildPaymentLinks, taxCategories, taxes } from "./data/billing"
import { COLT_CATALOG_URL, mapColtProduct, type ColtProduct } from "./data/products"
import { toPieza, type Pieza } from "./data/piezas"
import { users } from "./data/users"
import { vehiculos } from "./data/vehiculos"
import { buildLeads } from "./data/leads"
import { buildCitas, vendedoresAgenda } from "./data/agenda"
import { buildBusquedasExternas } from "./data/busqueda-externa"
import { sucursalesSeed, type ExistenciaMock, type MovimientoMock, type ReservaMock } from "./data/inventario"
import type { RelacionMock, VehiculoCatalogoMock } from "./data/catalogo"

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function seed() {
  const chat = buildConversationRecords()
  const campaigns = buildCampaigns()
  const leads = buildLeads()
  const tagAt = new Date().toISOString()
  return {
    products: [] as any[],
    catalogo: [] as ColtProduct[],
    piezas: [] as Pieza[],
    customers: clone(customers) as any[],
    orders: buildOrders(),
    users: clone(users) as any[],
    conversations: chat.conversations,
    messages: chat.messages,
    conversationTags: chat.tagsByConversation,
    notes: chat.notes,
    cotizaciones: buildCotizaciones(),
    vehiculos: clone(vehiculos),
    leads,
    busquedasExternas: buildBusquedasExternas(chat.conversations, leads),
    agendaVendedores: clone(vendedoresAgenda),
    citas: buildCitas() as any[],
    notifLeidas: [] as string[],
    tags: chatTags.map((t) => ({ ...t, company_id: COMPANY_ID, created_at: tagAt, updated_at: tagAt })),
    campaigns: campaigns.map((c) => c.campaign) as any[],
    campaignRecipients: Object.fromEntries(campaigns.map((c) => [c.campaign.id, c.recipients])) as Record<string, any[]>,
    templates: clone(metaTemplates) as any[],
    knowledge: clone(knowledge) as any[],
    taxes: clone(taxes) as any[],
    taxCategories: clone(taxCategories),
    paymentLinks: buildPaymentLinks() as any[],
    discounts: buildDiscounts() as Record<string, any[]>,
    auditLogs: buildAuditLogs() as any[],
    sucursales: sucursalesSeed(),
    existencias: null as ExistenciaMock[] | null,
    movimientos: [] as MovimientoMock[],
    reservas: [] as ReservaMock[],
    vehiculosCatalogo: null as VehiculoCatalogoMock[] | null,
    relaciones: [] as RelacionMock[],
    piezasExternas: [] as any[],
    sapInventario: { activo: false, intervalo_minutos: 60 },
  }
}

export type MockDb = ReturnType<typeof seed>

let db: MockDb | null = null
let productsReady: Promise<void> | null = null

export function getDb(): MockDb {
  if (!db) db = seed()
  return db
}

export function ensureProducts(originalFetch: typeof fetch): Promise<void> {
  if (!productsReady) {
    productsReady = originalFetch(COLT_CATALOG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ColtProduct[]>
      })
      .then((list) => {
        getDb().products = list.map(mapColtProduct)
        getDb().catalogo = list
        getDb().piezas = list.map(toPieza)
      })
      .catch((error) => {
        console.warn("[mock] no se pudo cargar el catálogo de Colt; corre `npm run predev`", error)
        productsReady = null
      })
  }
  return productsReady ?? Promise.resolve()
}
