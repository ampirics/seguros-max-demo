import { COMPANY_ID, DAY, HOUR, ago } from "./common"
import { customers } from "./customers"

export const metaTemplates = [
  {
    id: "tpl-oferta-amortiguadores",
    name: "oferta_amortiguadores",
    language: "es",
    status: "APPROVED",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "IMAGE" },
      { type: "BODY", text: "Hola {{1}}, esta semana los amortiguadores KAYABA y PARTS MALL tienen 10% de descuento en La Casa del Colt. Escríbenos para cotizar." },
      { type: "FOOTER", text: "Responde BAJA para no recibir más mensajes" },
    ],
  },
  {
    id: "tpl-recordatorio-mantenimiento",
    name: "recordatorio_mantenimiento",
    language: "es",
    status: "APPROVED",
    category: "MARKETING",
    components: [
      { type: "BODY", text: "Hola {{1}}, ya le toca el mantenimiento a tu {{2}}. Tenemos filtros, bujías y correas originales. ¿Te separamos el kit?" },
    ],
  },
  {
    id: "tpl-pedido-listo",
    name: "pedido_listo_retiro",
    language: "es",
    status: "APPROVED",
    category: "UTILITY",
    components: [
      { type: "BODY", text: "Hola {{1}}, tu pedido {{2}} está listo para retirar en Villas Agrícolas. Horario: L-V 8:00-6:00, S 8:00-1:00." },
    ],
  },
  {
    id: "tpl-feriado",
    name: "aviso_feriado",
    language: "es",
    status: "PENDING",
    category: "UTILITY",
    components: [{ type: "BODY", text: "La Casa del Colt estará cerrada el {{1}} por feriado. Te esperamos el día siguiente." }],
  },
]

const recipientsFor = (campaignId: string, statuses: string[]) =>
  customers.map((c, i) => ({
    id: `${campaignId}-r${i + 1}`,
    campaign_id: campaignId,
    customer_id: c.id,
    customer_name: c.name,
    phone_e164: "+1" + c.phone.replace(/\D/g, ""),
    status: statuses[i % statuses.length],
    attempts: statuses[i % statuses.length] === "FAILED" ? 3 : 1,
    error_message: statuses[i % statuses.length] === "FAILED" ? "Número sin WhatsApp (131026)" : null,
  }))

function campaign(id: string, data: Record<string, any>, recipientStatuses: string[]) {
  const recipients = recipientsFor(id, recipientStatuses)
  const count = (s: string[]) => recipients.filter((r) => s.includes(r.status)).length
  const sent = count(["SENT", "DELIVERED", "READ"])
  return {
    campaign: {
      id,
      company_id: COMPANY_ID,
      language_code: "es",
      segment_definition: { has_phone: true },
      total_recipients: recipients.length,
      sent_count: sent,
      delivered_count: count(["DELIVERED", "READ"]),
      read_count: count(["READ"]),
      failed_count: count(["FAILED"]),
      opted_out_count: 0,
      ...data,
    },
    recipients,
  }
}

export function buildCampaigns() {
  return [
    campaign("cmp-001", { name: "Amortiguadores 10% · Septiembre", status: "SENT", template_name: "oferta_amortiguadores", created_at: ago(12 * DAY), sent_at: ago(12 * DAY) }, ["READ", "READ", "DELIVERED", "READ", "FAILED", "DELIVERED", "READ", "SENT", "READ", "DELIVERED"]),
    campaign("cmp-002", { name: "Recordatorio de mantenimiento", status: "SENT", template_name: "recordatorio_mantenimiento", created_at: ago(4 * DAY), sent_at: ago(4 * DAY) }, ["DELIVERED", "READ", "READ", "DELIVERED", "DELIVERED"]),
    campaign("cmp-003", { name: "Talleres: precios especiales octubre", status: "SCHEDULED", template_name: "oferta_amortiguadores", created_at: ago(1 * DAY), scheduled_at: new Date(Date.now() + 2 * DAY).toISOString() }, ["PENDING"]),
    campaign("cmp-004", { name: "Aviso feriado 6 de noviembre", status: "DRAFT", template_name: "aviso_feriado", created_at: ago(3 * HOUR) }, ["PENDING"]),
  ]
}
