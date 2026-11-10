// RBAC a nivel UI: qué secciones del panel admin puede ver/usar cada rol.
// Cada sección se identifica por el href base de su ruta.
// NOTA: esto gatea la UI (menú + navegación). La autorización real en los
// endpoints del backend es una capa aparte (pendiente).

export const ADMIN_SECTIONS = [
  "/admin",                 // Dashboard
  "/admin/dashboard",       // Dashboard KPI
  "/admin/products",
  "/admin/customers",
  "/admin/discounts",
  "/admin/taxes",
  "/admin/orders",
  "/admin/payment-links",
  "/admin/users",
  "/admin/chat",
  "/admin/campaigns",
  "/admin/knowledge",
  "/admin/api-integrations",
  "/admin/app-credentials",
  "/admin/payment-providers",
  "/admin/frontlabels",
  "/admin/store-config",
  "/admin/cron-jobs",
  "/admin/audit",
  "/admin/logs",
  "/admin/system-events",   // Bandeja de eventos de integracion (outbox)
  "/admin/bug-reports",
  "/admin/companies",
  "/admin/marca",           // Colores, logo y nombre del cliente
  "/admin/ia",              // Configuración del asistente de IA y origen de datos
  "/admin/piezas",          // Búsqueda, ficha y diagrama
  "/admin/busqueda-externa", // Piezas que no hay: fuentes externas
  "/admin/existencias",     // Existencias por sucursal, importar y exportar
  "/admin/reservas",        // Piezas apartadas
  "/admin/sucursales",
  "/admin/vehiculos-catalogo", // Catálogo de vehículos (marca, modelo, motor) con aprobación
  "/admin/piezas-externas",    // Piezas de una base externa en revisión
  "/admin/cotizaciones",
  "/admin/vehiculos",       // Vehículos de clientes y cronograma
  "/admin/leads",           // Oportunidades
  "/admin/calendario",          // Citas y disponibilidad de vendedores
  "/admin/notificaciones",      // Avisos del panel (campana)
  "/admin/reportes",
  "/admin/estadisticas",        // Más vendidos, lo que se acaba, lo que piden y no hay, clientes, alertas
  "/admin/seguridad",           // Seguridad de precios: ranking, alertas y bloqueos
  "/admin/memoria",             // Memoria colectiva: palabras, respuestas y compatibilidades
  "/admin/negocio",             // Tipo de negocio, módulos y catálogos oficiales
  "/admin/conectores",          // De dónde salen los datos: Trama, SAP, Odoo
  "/admin/pruebas",             // Reinicio por teléfono y canal simulado o real
  "/admin/salon",               // Restaurante: operación en vivo y página de cada mesa
  "/admin/reservaciones",       // Restaurante: reservas de mesa
  "/admin/llegadas",            // Restaurante: la anfitriona recibe y sienta
  "/admin/caja",
  "/admin/gastos",
  "/admin/inventario",
  "/admin/compras",
  "/admin/finanzas",
  "/admin/ordenes",             // Restaurante: toma de órdenes y cobro
  "/admin/cocina",              // Restaurante: pantalla de cocina
  "/admin/carta",
  "/admin/clientes",            // Restaurante: ficha del cliente de punta a punta
  "/admin/metricas",
  "/admin/visitas",
  "/admin/oportunidades",       // Seguros: embudo por ramo y comparativo de aseguradoras
  "/admin/cartera",             // Seguros: pólizas y renovaciones
  "/admin/siniestros",          // Seguros: reportes, documentos y seguimiento con la aseguradora
  "/admin/asegurados",          // Seguros: personas y empresas con su recorrido
  "/admin/indicadores",         // Seguros: indicadores del piloto
] as const

const RESTAURANTE_GERENCIA = ["/admin/salon", "/admin/llegadas", "/admin/caja", "/admin/gastos", "/admin/inventario", "/admin/compras", "/admin/finanzas", "/admin/reservaciones", "/admin/ordenes", "/admin/cocina", "/admin/carta", "/admin/clientes", "/admin/metricas", "/admin/visitas"]

// Matriz rol → secciones permitidas (confirmada con el cliente).
const ROLE_SECTIONS: Record<string, string[]> = {
  super_admin: [...ADMIN_SECTIONS],
  // admin = acceso total (en dev no existe super_admin; "superadmin@" es admin).
  // Si en el futuro se usa super_admin, mover "/admin/companies" a solo super_admin.
  admin: [...ADMIN_SECTIONS],
  manager: [
    "/admin", "/admin/dashboard", "/admin/reportes", "/admin/estadisticas", "/admin/notificaciones", "/admin/calendario", "/admin/piezas", "/admin/existencias", "/admin/reservas", "/admin/sucursales", "/admin/vehiculos-catalogo", "/admin/piezas-externas", "/admin/busqueda-externa", "/admin/leads", "/admin/cotizaciones", "/admin/customers", "/admin/vehiculos",
    "/admin/orders", "/admin/payment-links", "/admin/users", "/admin/bug-reports", "/admin/seguridad", "/admin/memoria",
  ],
  // Restaurante: cada perfil ve solo lo suyo.
  gerente: ["/admin", "/admin/dashboard", "/admin/chat", ...RESTAURANTE_GERENCIA, "/admin/campaigns", "/admin/knowledge", "/admin/users", "/admin/notificaciones", "/admin/memoria"],
  anfitriona: ["/admin/llegadas", "/admin", "/admin/chat", "/admin/reservaciones", "/admin/salon", "/admin/clientes", "/admin/visitas", "/admin/notificaciones"],
  mesero: ["/admin/ordenes", "/admin/salon", "/admin/cocina", "/admin/notificaciones"],
  cocina: ["/admin/cocina", "/admin/carta", "/admin/inventario"],
  cajero: ["/admin/caja", "/admin/ordenes", "/admin/gastos", "/admin/notificaciones"],
  supervisor_restaurante: ["/admin", "/admin/salon", "/admin/llegadas", "/admin/reservaciones", "/admin/ordenes", "/admin/cocina", "/admin/caja", "/admin/inventario", "/admin/compras", "/admin/gastos", "/admin/notificaciones"],
  compras: ["/admin/inventario", "/admin/compras", "/admin/gastos", "/admin/carta", "/admin/notificaciones"],
  supervisor: [
    "/admin", "/admin/dashboard", "/admin/reportes", "/admin/estadisticas", "/admin/notificaciones", "/admin/calendario", "/admin/piezas", "/admin/existencias", "/admin/reservas", "/admin/busqueda-externa", "/admin/leads", "/admin/cotizaciones", "/admin/orders", "/admin/bug-reports",
  ],
  editor: [
    "/admin", "/admin/frontlabels", "/admin/store-config", "/admin/bug-reports",
  ],
  agent: [
    "/admin", "/admin/customers", "/admin/vehiculos", "/admin/chat", "/admin/notificaciones", "/admin/calendario", "/admin/piezas", "/admin/existencias", "/admin/reservas", "/admin/busqueda-externa", "/admin/leads", "/admin/cotizaciones", "/admin/bug-reports", "/admin/memoria",
  ],
  // Inventario (/admin/products) solo para admin y almacén: los demás buscan en Piezas.
  almacen: [
    "/admin", "/admin/piezas", "/admin/existencias", "/admin/reservas", "/admin/sucursales", "/admin/vehiculos-catalogo", "/admin/piezas-externas", "/admin/busqueda-externa", "/admin/products", "/admin/bug-reports",
  ],
  user: [
    "/admin", "/admin/piezas", "/admin/busqueda-externa", "/admin/bug-reports",
  ],
  viewer: [
    "/admin", "/admin/dashboard", "/admin/reportes", "/admin/estadisticas", "/admin/piezas", "/admin/busqueda-externa", "/admin/orders", "/admin/bug-reports",
  ],
  // Corredor de seguros: cada perfil ve lo suyo.
  direccion: ["/admin", "/admin/chat", "/admin/oportunidades", "/admin/cartera", "/admin/siniestros", "/admin/asegurados", "/admin/indicadores", "/admin/notificaciones", "/admin/users", "/admin/marca", "/admin/negocio"],
  ejecutivo: ["/admin", "/admin/chat", "/admin/oportunidades", "/admin/cartera", "/admin/asegurados", "/admin/notificaciones"],
  servicio: ["/admin/chat", "/admin", "/admin/cartera", "/admin/asegurados", "/admin/siniestros", "/admin/notificaciones"],
  siniestros: ["/admin/siniestros", "/admin", "/admin/chat", "/admin/asegurados", "/admin/notificaciones"],
  customer: [],
}

let seccionesPropias: string[] | null = null

/** Accesos elegidos para la persona que entró (Usuarios > Accesos); sin lista, valen los de su rol. */
export function usarSeccionesPropias(lista: string[] | null | undefined) {
  seccionesPropias = lista?.length ? lista : null
}

export function allowedSections(role?: string): string[] {
  if (!role) return []
  if (seccionesPropias && role !== "admin" && role !== "super_admin") return seccionesPropias
  return ROLE_SECTIONS[role] ?? ["/admin"] // rol desconocido: solo dashboard
}

/** ¿El rol puede ver/usar la sección identificada por su href base? */
export function canAccessSection(role: string | undefined, href: string): boolean {
  if (!role) return false
  return allowedSections(role).includes(href)
}

/** Sección catalogada que corresponde a un pathname (prefijo más largo). */
function sectionForPath(pathname: string): string | null {
  if (pathname === "/admin") return "/admin"
  let best: string | null = null
  for (const s of ADMIN_SECTIONS) {
    if (s === "/admin") continue
    if (pathname === s || pathname.startsWith(s + "/")) {
      if (!best || s.length > best.length) best = s
    }
  }
  return best
}

/**
 * ¿El rol puede acceder a esta ruta? Las sub-páginas de una sección heredan su
 * permiso (prefijo). Una ruta admin NO catalogada solo la abren admin y
 * super_admin: antes cualquier rol (agente, viewer…) entraba en pantallas
 * fuera del menú y veía errores del backend.
 */
export function canAccessPath(role: string | undefined, pathname: string): boolean {
  if (!role) return false
  // Cuenta propia (cambiar contraseña): cualquier rol del panel, también con
  // contraseña temporal; si no, un agente no podría salir de la temporal.
  if (pathname === "/admin/account" || pathname.startsWith("/admin/account/")) return role !== "customer"
  const section = sectionForPath(pathname)
  if (!section) return pathname === "/admin" || role === "admin" || role === "super_admin"
  return allowedSections(role).includes(section)
}

/** Primera ruta permitida del rol (para redirigir si entra a algo no permitido). */
export function firstAllowedPath(role?: string): string {
  const secs = allowedSections(role)
  return secs[0] ?? "/"
}
