import { COMPANY_ID, DAY, HOUR, ago } from "./common"
import { customers } from "./customers"
import { REF, type ProductRef } from "./products"

export const ITBIS_RATE = 0.18

interface SeedOrder {
  number: number
  customerId: string
  at: number
  status: string
  items: Array<[ProductRef, number, number?]>
  notes?: string
  delivery?: boolean
  paymentReference?: string
  cotizacion?: string
}

const SEED: SeedOrder[] = [
  { number: 1047, customerId: "cus-003", at: 2 * HOUR, status: "AWAITING_CONFIRMATION", items: [[REF.filtroAceiteSonata, 50], [REF.filtroAceiteFram, 30]], notes: "Mayorista. Envío por Caribe Tours.", cotizacion: "COT-0409" },
  { number: 1046, customerId: "cus-005", at: 5 * HOUR, status: "PAID", items: [[REF.cablesSantaFe, 2]], paymentReference: "AZUL-884512" },
  { number: 1045, customerId: "cus-007", at: 5 * DAY, status: "DELIVERED", items: [[REF.bateriaMtp24, 1]], delivery: true, paymentReference: "LINK-7Q2K9" },
  { number: 1044, customerId: "cus-006", at: 2 * DAY, status: "DELIVERED", items: [[REF.cadenaMontero, 1], [REF.tensorMontero, 1]], notes: "Retiro en tienda.", cotizacion: "COT-0398" },
  { number: 1043, customerId: "cus-002", at: 3 * DAY, status: "PROCESSING", items: [[REF.bandasL200, 4]], notes: "Crédito 30 días." },
  { number: 1042, customerId: "cus-010", at: 4 * DAY, status: "SHIPPED", items: [[REF.coilIo, 1]], notes: "Retiro en tienda." },
  { number: 1041, customerId: "cus-008", at: 6 * DAY, status: "CONFIRMED", items: [[REF.amortMontero, 4], [REF.cadenaMontero, 1]] },
  { number: 1040, customerId: "cus-009", at: 9 * DAY, status: "CANCELLED", items: [[REF.correaLancer, 1]], notes: "El cliente compró en otro lugar." },
  { number: 1039, customerId: "cus-004", at: 12 * DAY, status: "PAID", items: [[REF.tensorAccent, 1]], paymentReference: "BHD-552310" },
  { number: 1038, customerId: "cus-003", at: 18 * DAY, status: "DELIVERED", items: [[REF.bandasL200Orig, 10]], paymentReference: "TRANSF-0918" },
  { number: 1037, customerId: "cus-001", at: 34 * DAY, status: "DELIVERED", items: [[REF.filtroAceiteSonata, 2]] },
]

const PAID_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"])

export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(status.toUpperCase())
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function recalcOrder(order: any): any {
  const subtotal = round2(order.items.reduce((s: number, it: any) => s + Number(it.price) * Number(it.quantity), 0))
  const tax = round2(subtotal * ITBIS_RATE)
  order.subtotal = subtotal
  order.tax_amount = tax
  order.total = round2(subtotal + tax)
  order.original_total = order.total
  order.paid_amount = isPaidStatus(order.status) ? order.total : 0
  return order
}

export function buildOrderItem(orderId: string, ref: ProductRef, quantity: number, price?: number, idx = 0) {
  const unit = price ?? ref.price
  return {
    id: `${orderId}-i${idx + 1}`,
    order_id: orderId,
    product_id: ref.id,
    product_sku: ref.sku,
    sku: ref.sku,
    name: ref.name,
    product_name: ref.name,
    image: ref.image,
    product_image: ref.image,
    price: unit,
    unit_price: unit,
    quantity,
    unit_quantity: 1,
    discount: 0,
    subtotal: round2(unit * quantity),
    total_price: round2(unit * quantity),
    color: "",
    size: "",
  }
}

export function buildOrders(): any[] {
  return SEED.map((s) => {
    const id = `ord-${s.number}`
    const c = customers.find((x) => x.id === s.customerId)!
    const created = ago(s.at)
    return recalcOrder({
      id,
      order_number: `LCC-${s.number}`,
      company_id: COMPANY_ID,
      status: s.status,
      payment_status: isPaidStatus(s.status) ? "paid" : s.status === "CANCELLED" ? "cancelled" : "pending",
      payment_reference: s.paymentReference ?? null,
      payment_fee_amount: 0,
      payment_fee_type: null,
      external_reference: s.number < 1045 ? `SAP-${20500 + s.number}` : null,
      customer_id: c.id,
      customer_name: c.name,
      customer_email: c.email,
      customer_phone: c.phone,
      shipping_address: s.delivery ? c.address : "Retiro en tienda · Villas Agrícolas",
      shipping_method: s.delivery ? "delivery" : "pickup",
      customer_info: { name: c.name, email: c.email, phone: c.phone, address: c.address },
      notes: s.notes ?? "",
      cotizacion_codigo: s.cotizacion ?? null,
      items: s.items.map(([ref, qty, price], i) => buildOrderItem(id, ref, qty, price, i)),
      created_at: created,
      updated_at: created,
      sap_payment_sent: isPaidStatus(s.status),
    })
  })
}
