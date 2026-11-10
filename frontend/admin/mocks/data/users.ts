import { ADMIN_USER_ID, COMPANY_ID } from "./common"

const FULL = { view: true, create: true, edit: true, delete: true }

export const ADMIN_PERMISSIONS = {
  users: FULL,
  products: FULL,
  orders: { ...FULL, export: true },
  dashboard: { view: true },
  customers: FULL,
  chat: FULL,
}

export const users = [
  {
    id: ADMIN_USER_ID,
    email: "cristian@casadelcolt.com",
    name: "Cristian Sánchez",
    role: "admin",
    is_active: true,
    must_change_password: false,
    company_id: COMPANY_ID,
    permissions: ADMIN_PERMISSIONS,
    created_at: "2024-02-12T14:05:00Z",
    updated_at: "2026-09-28T10:00:00Z",
  },
  {
    id: "u0170000-0000-4000-8000-000000000002",
    email: "yanelis@casadelcolt.com",
    name: "Yanelis Guzmán",
    role: "agent",
    is_active: true,
    company_id: COMPANY_ID,
    created_at: "2024-03-01T13:00:00Z",
    updated_at: "2026-09-15T13:00:00Z",
  },
  {
    id: "u0170000-0000-4000-8000-000000000003",
    email: "luisalberto@casadelcolt.com",
    name: "Luis Alberto Mercedes",
    role: "agent",
    is_active: true,
    company_id: COMPANY_ID,
    created_at: "2024-05-20T13:00:00Z",
    updated_at: "2026-08-02T13:00:00Z",
  },
  {
    id: "u0170000-0000-4000-8000-000000000004",
    email: "ventas@casadelcolt.com",
    name: "Pedro Julio Almonte",
    role: "manager",
    is_active: true,
    company_id: COMPANY_ID,
    created_at: "2024-02-15T13:00:00Z",
    updated_at: "2026-07-11T13:00:00Z",
  },
  {
    id: "u0170000-0000-4000-8000-000000000005",
    email: "almacen@casadelcolt.com",
    name: "Wilkin Reyes",
    role: "almacen",
    is_active: false,
    company_id: COMPANY_ID,
    created_at: "2025-01-10T13:00:00Z",
    updated_at: "2026-04-30T13:00:00Z",
  },
]
