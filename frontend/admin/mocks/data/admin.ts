import { ADMIN_USER_ID, DAY, HOUR, MINUTE, ago } from "./common"

export function buildDiscounts() {
  return {
    coupons: [
      { id: "cpn-001", code: "TALLER10", name: "Talleres registrados 10%", discount_type: "percentage", discount_value: 10, status: "active", times_used: 37, usage_limit: null, start_date: "2026-01-01T00:00:00Z", end_date: null, is_valid: true },
      { id: "cpn-002", code: "DELIVERY0", name: "Delivery gratis Gran Santo Domingo", discount_type: "fixed_amount", discount_value: 350, status: "active", times_used: 12, usage_limit: 100, start_date: ago(20 * DAY), end_date: new Date(Date.now() + 10 * DAY).toISOString(), is_valid: true },
      { id: "cpn-003", code: "PADRES2026", name: "Día de los Padres", discount_type: "percentage", discount_value: 15, status: "expired", times_used: 64, usage_limit: 200, start_date: "2026-07-20T00:00:00Z", end_date: "2026-07-27T23:59:59Z", is_valid: false },
    ],
    productDiscounts: [
      { id: "pd-001", product_id: "558", name: "Amortiguador Endeavor MITSUBISHI (RH)", discount_type: "percentage", discount_value: 15, is_active: true, start_date: ago(5 * DAY), end_date: new Date(Date.now() + 25 * DAY).toISOString(), is_valid: true },
      { id: "pd-002", product_id: "559", name: "Amortiguador Endeavor MITSUBISHI (LH)", discount_type: "percentage", discount_value: 15, is_active: true, start_date: ago(5 * DAY), end_date: new Date(Date.now() + 25 * DAY).toISOString(), is_valid: true },
      { id: "pd-003", product_id: "10", name: "Batería Interstate MTP-24", discount_type: "percentage", discount_value: 10, is_active: true, start_date: null, end_date: null, is_valid: true },
    ],
    categoryDiscounts: [
      { id: "cd-001", category_code: "Hyundai", category_name: "Hyundai", name: "Filtros Hyundai por volumen", discount_type: "volume_discount", discount_value: 8, is_active: true, start_date: null, end_date: null, is_valid: true },
    ],
  }
}

const AUDIT_SEED: Array<[number, string, string, string, string, boolean]> = [
  [4 * MINUTE, "login", "auth", "Inicio de sesión", "POST /api/v1/auth/login", true],
  [40 * MINUTE, "update", "conversation", "Conversación con Repuestos El Cibao", "PATCH /api/v1/chat/conversations/conv-004/assign", true],
  [2 * HOUR, "create", "payment_link", "Link de pago LCC-1047", "POST /api/v1/admin/payment-links/create", true],
  [5 * HOUR, "update", "product", "Cables de Bujia 27501-37B00 - PARTS MALL", "PUT /api/v1/admin/products/405", true],
  [9 * HOUR, "update", "order", "Orden LCC-1043", "PUT /api/v1/orders/ord-1043", true],
  [1 * DAY, "delete", "product", "Producto duplicado", "DELETE /api/v1/admin/products/xxx", false],
  [2 * DAY, "create", "campaign", "Talleres: precios especiales octubre", "POST /api/v1/admin/campaigns", true],
  [3 * DAY, "update", "user", "Wilkin Reyes", "PUT /api/v1/users/u0170000-0000-4000-8000-000000000005", true],
  [5 * DAY, "login", "auth", "Inicio de sesión", "POST /api/v1/auth/login", false],
]

export function buildAuditLogs() {
  return AUDIT_SEED.map(([at, action, resource_type, resource_name, call, success], i) => {
    const [method, endpoint] = call.split(" ")
    return {
      id: `aud-${String(i + 1).padStart(3, "0")}`,
      timestamp: ago(at),
      user_id: ADMIN_USER_ID,
      action,
      resource_type,
      resource_id: null,
      resource_name,
      method,
      endpoint,
      ip_address: "190.167.42.18",
      success,
      error_message: success ? null : "Permiso denegado",
      user: { email: "cristian@casadelcolt.com", first_name: "Cristian", last_name: "Sánchez" },
    }
  })
}
