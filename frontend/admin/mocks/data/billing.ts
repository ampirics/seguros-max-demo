import { COMPANY_ID, DAY, HOUR, ago } from "./common"

export const taxes = [
  {
    id: "tax-itbis",
    company_id: COMPANY_ID,
    name: "ITBIS",
    description: "Impuesto sobre la transferencia de bienes industrializados y servicios",
    percentage: 18,
    is_active: true,
    is_compound: false,
    category_codes: ["Mitsubishi", "Hyundai", "Productos genericos"],
    created_at: "2024-02-12T14:00:00Z",
    updated_at: "2026-01-05T14:00:00Z",
  },
]

export const taxCategories = [
  { code: "Mitsubishi", name: "Mitsubishi", product_name: "Mitsubishi" },
  { code: "Hyundai", name: "Hyundai", product_name: "Hyundai" },
  { code: "Productos genericos", name: "Productos genéricos", product_name: "Productos genéricos" },
]

const link = (id: string, data: Record<string, any>) => {
  const token = `pl_${id.replace(/\W/g, "")}x7k2`
  return {
    id,
    token,
    company_id: 1,
    currency: "DOP",
    auto_capture: true,
    allowed_providers: ["azul", "bhd"],
    expires_in_hours: 48,
    payment_url: `https://pagos.casadelcolt.com/pay/${token}`,
    used_at: null,
    updated_at: data.created_at,
    ...data,
  }
}

export function buildPaymentLinks() {
  return [
    link("pl-002", { order_id: "ord-1047", order_number: "LCC-1047", amount: 15540.6, description: "Pedido mayorista filtros de aceite", recipient_name: "Repuestos El Cibao", recipient_email: "compras@repuestoselcibao.do", status: "active", created_at: ago(90 * 60 * 1000), expires_at: new Date(Date.now() + 46 * HOUR).toISOString() }),
    link("pl-003", { order_id: "ord-1045", order_number: "LCC-1045", amount: 8496, description: "Batería Interstate MTP-24", recipient_name: "Yokasta Peralta", recipient_email: "yokasta.peralta@outlook.com", status: "used", created_at: ago(5 * DAY), used_at: ago(5 * DAY - HOUR), expires_at: ago(3 * DAY) }),
    link("pl-004", { order_id: "ord-1040", order_number: "LCC-1040", amount: 1180, description: "Correa de distribución Lancer", recipient_name: "Franklin De los Santos", recipient_email: "franklin.dls@gmail.com", status: "expired", created_at: ago(9 * DAY), expires_at: ago(7 * DAY) }),
    link("pl-005", { amount: 2500, description: "Abono pedido especial", recipient_name: "Taller Hnos. Peña", recipient_email: "tallerhnospena@hotmail.com", status: "cancelled", created_at: ago(15 * DAY), expires_at: ago(13 * DAY) }),
  ]
}
