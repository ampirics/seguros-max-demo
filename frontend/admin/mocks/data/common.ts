export const COMPANY_ID = "c0170000-0000-4000-8000-000000000001"
export const ADMIN_USER_ID = "u0170000-0000-4000-8000-000000000001"

export const COMPANY = {
  id: COMPANY_ID,
  name: "Repuestos La Casa del Colt",
  description: "Repuestos para Mitsubishi, Hyundai y Kia · Santo Domingo",
  logo_url: "/colt/lcdc500x150pcx2.png",
  logoUrl: "/colt/lcdc500x150pcx2.png",
  is_active: true,
  isActive: true,
  phone: "809-684-1243",
  email: "ventas@casadelcolt.com",
  address: "Villas Agrícolas, Santo Domingo, República Dominicana",
  currency: "DOP",
  created_at: "2024-02-12T14:00:00Z",
  updated_at: "2026-09-20T14:00:00Z",
}

export const MINUTE = 60 * 1000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

export function newId(prefix = "mock"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function digits(value?: string | null): string {
  return (value || "").replace(/\D/g, "")
}

export function samePhone(a?: string | null, b?: string | null): boolean {
  const da = digits(a).slice(-10)
  const db = digits(b).slice(-10)
  return da.length >= 7 && da === db
}

export const BOT_GENERIC_REPLY =
  "Gracias por escribir a La Casa del Colt. Estamos revisando tu solicitud y un asesor te responde en breve."
