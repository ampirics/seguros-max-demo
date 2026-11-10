"use client"

import { ReactNode, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { canAccessSection, canAccessPath, firstAllowedPath, usarSeccionesPropias } from "@/lib/permissions"
import { rutaOculta, useNegocio } from "@/lib/api/negocio"
import { useAdmin } from "@/contexts/admin-context"
import { useCompany } from "@/contexts/company-context"
import { useAgentNotifications } from "@/contexts/agent-notifications-context"
import { CampanaNotificaciones } from "@/components/admin/notificaciones/Notificaciones"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  ShieldAlert,
  Lightbulb,
  Store,
  TrendingUp,
  Package,
  Users,
  MessageSquare,
  ShoppingCart,
  CalendarDays,
  BarChart3,
  LayoutGrid,
  LogOut,
  User,
  ExternalLink,
  BookOpen,
  Bot,
  Send,
  KeyRound,
  Palette,
  Plug,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  BellRing,
  FlaskConical,
  PackageSearch,
  Presentation,
  PanelLeftClose,
  PanelLeftOpen,
  Armchair,
  CalendarCheck,
  Wallet,
  Boxes,
  Truck,
  Receipt,
  DoorOpen,
  ClipboardList,
  ChefHat,
  UtensilsCrossed,
  Contact,
  LineChart,
  Briefcase,
  FileStack,
  LifeBuoy,
  Building2,
  Gauge,
  type LucideIcon
} from "lucide-react"
import { usePalabras, useVertical } from "@/lib/vertical"
import { useTheme } from "next-themes"
import { Logo } from "@/components/marca/logo"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getTiendaUrl, guardarModoDemo, rutaEnModoDemo, useModoDemo } from "@/lib/config"
import { CompanySwitcher } from "./company-switcher"
import { CompanySelectionModal } from "./company-selection-modal"
import { HintLayer } from "./hint-layer"

interface AdminLayoutProps {
  title: string
  children: ReactNode
}

// Agrupación solo visual del menú; los permisos siguen saliendo de lib/permissions.ts
const NAV_GROUPS = ["General", "Seguros", "Restaurante", "Administración", "Comercio", "Comunicación", "Configuración"] as const
type NavGroup = (typeof NAV_GROUPS)[number]

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  group: NavGroup
  // Otras rutas que marcan activa esta entrada (Inventario agrupa Piezas y la administración del catálogo).
  also?: string[]
}

export function AdminLayout({ title, children }: AdminLayoutProps) {
  const { user, logout } = useAdmin()
  usarSeccionesPropias((user as { secciones?: string[] } | null)?.secciones)
  const [tiendaUrl, setTiendaUrl] = useState("")
  useEffect(() => setTiendaUrl(getTiendaUrl()), [])
  const { agentRequestCount } = useAgentNotifications()
  const {
    activeCompany,
    availableCompanies,
    needsCompanySelection,
    isLoading: companyLoading,
    setActiveCompany
  } = useCompany()
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [menuCompacto, setMenuCompacto] = useState(false)
  useEffect(() => { try { setMenuCompacto(localStorage.getItem("menu-compacto") === "1") } catch {} }, [])
  const alternarMenu = () => setMenuCompacto((v) => { try { localStorage.setItem("menu-compacto", v ? "0" : "1") } catch {} return !v })
  const negocio = useNegocio()
  const vertical = useVertical()
  const palabras = usePalabras()
  const modoDemo = useModoDemo()

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/admin/login")
    } catch (error) {
      console.error('Logout error:', error)
      router.push("/admin/login")
    }
  }

  // Mostrar modal de selección si es necesario
  useEffect(() => {
    if (needsCompanySelection && !companyLoading) {
      setShowCompanyModal(true)
    }
  }, [needsCompanySelection, companyLoading])

  // Cerrar el menú móvil al navegar o con Escape
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mobileNavOpen])

  const handleCompanySelected = (company: any) => {
    setActiveCompany(company)
    setShowCompanyModal(false)
  }

  // Lo que se usa en la demo. Las demás pantallas siguen en su ruta, fuera del menú
  // (integraciones, auditoría, logs, impuestos, descuentos, empresas, CMS...).
  const navigation: NavItem[] = [
    { name: vertical === "repuestos" ? "CRM" : "Inicio", href: "/admin", icon: LayoutGrid, group: "General" },
    { name: "Bandeja", href: "/admin/chat", icon: MessageSquare, group: "General" },
    { name: "Oportunidades", href: "/admin/oportunidades", icon: Briefcase, group: "Seguros" },
    { name: "Cartera y renovaciones", href: "/admin/cartera", icon: FileStack, group: "Seguros" },
    { name: "Siniestros", href: "/admin/siniestros", icon: LifeBuoy, group: "Seguros" },
    { name: "Asegurados", href: "/admin/asegurados", icon: Building2, group: "Seguros" },
    { name: "Indicadores", href: "/admin/indicadores", icon: Gauge, group: "Seguros" },
    { name: "Salón en vivo", href: "/admin/salon", icon: Armchair, group: "Restaurante", also: ["/admin/visitas"] },
    { name: "Llegadas", href: "/admin/llegadas", icon: DoorOpen, group: "Restaurante" },
    { name: "Reservas", href: "/admin/reservaciones", icon: CalendarCheck, group: "Restaurante" },
    { name: "Órdenes", href: "/admin/ordenes", icon: ClipboardList, group: "Restaurante" },
    { name: "Cocina", href: "/admin/cocina", icon: ChefHat, group: "Restaurante" },
    { name: "Carta", href: "/admin/carta", icon: UtensilsCrossed, group: "Restaurante" },
    { name: "Clientes", href: "/admin/clientes", icon: Contact, group: "Restaurante" },
    { name: "Métricas", href: "/admin/metricas", icon: LineChart, group: "Restaurante" },
    ...(vertical === "restaurante" ? [{ name: "Asistente", href: "/admin/dashboard", icon: Bot, group: "Restaurante" as NavGroup }] : []),
    { name: "Caja", href: "/admin/caja", icon: Wallet, group: "Administración" },
    { name: "Inventario", href: "/admin/inventario", icon: Boxes, group: "Administración" },
    { name: "Compras", href: "/admin/compras", icon: Truck, group: "Administración" },
    { name: "Gastos", href: "/admin/gastos", icon: Receipt, group: "Administración" },
    { name: "Finanzas", href: "/admin/finanzas", icon: TrendingUp, group: "Administración" },
    { name: "Calendario", href: "/admin/calendario", icon: CalendarDays, group: "General" },
    { name: "Inventario", href: "/admin/piezas", icon: Package, group: "Comercio", also: ["/admin/products", "/admin/existencias", "/admin/reservas", "/admin/sucursales", "/admin/vehiculos-catalogo", "/admin/piezas-externas"] },
    { name: "Búsqueda externa", href: "/admin/busqueda-externa", icon: PackageSearch, group: "Comercio" },
    { name: "Ventas", href: "/admin/leads", icon: ShoppingCart, group: "Comercio", also: ["/admin/cotizaciones", "/admin/orders", "/admin/payment-links"] },
    { name: "Clientes", href: "/admin/customers", icon: Users, group: "Comercio", also: ["/admin/vehiculos"] },
    { name: "Reportes", href: "/admin/reportes", icon: BarChart3, group: "Comercio" },
    { name: "Estadísticas", href: "/admin/estadisticas", icon: TrendingUp, group: "Comercio" },
    { name: "Campañas", href: "/admin/campaigns", icon: Send, group: "Comunicación" },
    { name: "Conocimiento", href: "/admin/knowledge", icon: BookOpen, group: "Comunicación" },
    { name: "Memoria colectiva", href: "/admin/memoria", icon: Lightbulb, group: "Comunicación" },
    { name: "Seguridad", href: "/admin/seguridad", icon: ShieldAlert, group: "Comercio" },
    { name: "Configuración IA", href: "/admin/ia", icon: Bot, group: "Configuración" },
    { name: "Usuarios", href: "/admin/users", icon: User, group: "Configuración" },
    { name: "Marca", href: "/admin/marca", icon: Palette, group: "Configuración" },
    { name: "Tipo de negocio", href: "/admin/negocio", icon: Store, group: "Configuración" },
    { name: "Conectores", href: "/admin/conectores", icon: Plug, group: "Configuración" },
    { name: "Pruebas", href: "/admin/pruebas", icon: FlaskConical, group: "Configuración" },
  ]

  // Filtrar navegación por rol (RBAC, ver lib/permissions.ts) y por el modo demo (lib/config.ts)
  // Una entrada que agrupa pantallas lleva a la primera que el rol puede abrir.
  const SOLO_SEGUROS = ["/admin", "/admin/chat", "/admin/oportunidades", "/admin/cartera", "/admin/siniestros", "/admin/asegurados", "/admin/indicadores", "/admin/users", "/admin/marca", "/admin/negocio"]
  const filteredNavigation = navigation.filter((item) => vertical !== "seguros" || SOLO_SEGUROS.includes(item.href)).flatMap((item) => {
    const href = [item.href, ...(item.also ?? [])].find(
      (h) => canAccessSection(user?.role, h) && !rutaOculta(h, negocio) && (!modoDemo || rutaEnModoDemo(h))
    )
    return href ? [{ ...item, href }] : []
  })
  const puedeVerBandeja = canAccessSection(user?.role, "/admin/chat")
  const enEspera = puedeVerBandeja ? agentRequestCount : 0
  const textoEnEspera = enEspera === 1 ? `1 conversación esperando ${palabras.persona}` : `${enEspera} conversaciones esperando ${palabras.persona}`

  // Guard de ruta: si el rol entra (por URL) a una sección que no le corresponde,
  // redirigir a su primera sección permitida.
  useEffect(() => {
    if (!user?.role || !pathname) return
    if (!canAccessPath(user.role, pathname) || rutaOculta(pathname, negocio)) {
      router.replace(firstAllowedPath(user.role))
    }
  }, [user?.role, pathname, router, negocio])

  const iconOnlyNav = menuCompacto

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || !!pathname?.startsWith(`${href}/`)

  const displayName = user?.name || 'Admin'
  const initials = (user?.name || user?.email || "A")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("")
    .toUpperCase()

  const renderSidebar = (compact: boolean, movil = false) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center border-b", compact ? "justify-center px-2" : "px-5")}>
        <Link href="/admin" aria-label="Inicio" className="flex min-w-0 items-center">
          <Logo conNombre={!compact} />
        </Link>
      </div>

      <nav
        className={cn("flex-1 overflow-y-auto py-6", compact ? "px-2" : "px-3")}
        aria-label="Secciones del panel"
        ref={(el) => {
          if (!el || el.dataset.restaurado) return
          el.dataset.restaurado = "1"
          try {
            el.scrollTop = Number(sessionStorage.getItem("menu-scroll") || 0)
          } catch {}
        }}
        onScroll={(e) => {
          try {
            sessionStorage.setItem("menu-scroll", String(e.currentTarget.scrollTop))
          } catch {}
        }}
      >
        {NAV_GROUPS.map((group) => {
          const items = filteredNavigation.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className={cn("last:mb-0", compact ? "mb-3 border-b pb-3 last:border-b-0 last:pb-0" : "mb-7")}>
              {!compact && <p className="etiqueta px-3 pb-1.5 text-xs">{group}</p>}
              <ul className="flex flex-col gap-px">
                {items.map((item) => {
                  const Icon = item.icon
                  const active = [item.href, ...(item.also ?? [])].some(isActive)
                  const isChat = item.href === "/admin/chat"
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={compact ? item.name : undefined}
                        title={compact ? item.name : undefined}
                        className={cn(
                          "group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          compact ? "justify-center px-0" : "px-3",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        )}
                      >
                        <Icon
                          className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
                          strokeWidth={1.8}
                          aria-hidden
                        />
                        {!compact && <span className="truncate">{item.name}</span>}
                        {compact && isChat && enEspera > 0 && (
                          <span
                            className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
                            aria-label={textoEnEspera}
                          >
                            {enEspera > 9 ? "9+" : enEspera}
                          </span>
                        )}
                        {!compact && isChat && enEspera > 0 && (
                          <span
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              router.push("/admin/chat?tag=agent_requested")
                            }}
                            className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground"
                            title="Abrir la Bandeja con las conversaciones en espera"
                            aria-label={textoEnEspera}
                          >
                            {enEspera}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
      {movil && (
        <div className="shrink-0 border-t px-3 py-3 sm:hidden">
          <CompanySwitcher />
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <HintLayer />
      {/* Sidebar escritorio */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r bg-background lg:block print:!hidden",
          iconOnlyNav ? "w-16" : "w-64"
        )}
      >
        {renderSidebar(iconOnlyNav)}
      </aside>

      {/* Sidebar móvil */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r bg-background animate-in slide-in-from-left duration-200">
            {renderSidebar(false, true)}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-3"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Cerrar menú"
            >
              <X />
            </Button>
          </aside>
        </div>
      )}

      <div className={cn(iconOnlyNav ? "lg:pl-16" : "lg:pl-64", "print:!pl-0")}>
        {/* Header */}
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur print:hidden">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="relative -ml-2 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label={enEspera > 0 ? `Abrir menú (${textoEnEspera})` : "Abrir menú"}
            >
              <Menu />
              {enEspera > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" aria-hidden />}
            </Button>
            <Button variant="ghost" size="icon" className="-ml-2 hidden lg:inline-flex print:hidden" onClick={alternarMenu}
              aria-label={menuCompacto ? "Mostrar el menú" : "Ocultar el menú"} title={menuCompacto ? "Mostrar el menú" : "Ocultar el menú"}>
              {menuCompacto ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <h1 className="min-w-0 truncate font-display text-lg font-semibold">{title}</h1>

            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              {enEspera > 0 && (
                <Link
                  href="/admin/chat?tag=agent_requested"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`${textoEnEspera}. Abrir la Bandeja`}
                  title="Abrir la Bandeja con las conversaciones en espera"
                >
                  <BellRing className="h-4 w-4" aria-hidden />
                  <span className="tabular-nums">{enEspera}</span>
                  <span className="hidden sm:inline">en espera</span>
                </Link>
              )}

              <div className="hidden sm:block">
                <CompanySwitcher />
              </div>

              <a
                href={tiendaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", vertical === "repuestos" && "md:flex")}
              >
                Ver tienda
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>

              {canAccessSection(user?.role, "/admin/notificaciones") && <CampanaNotificaciones />}

              <Button
                variant="ghost"
                size="icon"
                className="hidden h-9 w-9 sm:inline-flex"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label="Cambiar entre modo claro y oscuro"
                title="Modo claro / oscuro"
              >
                <Sun className="hidden dark:block" aria-hidden />
                <Moon className="dark:hidden" aria-hidden />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2" aria-label="Menú de usuario">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground">
                      {initials}
                    </span>
                    <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">{displayName}</span>
                    <ChevronDown className="hidden text-muted-foreground md:block" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className={cn("md:hidden", vertical !== "repuestos" && "hidden")}>
                    <a href={tiendaUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      <span>Ver tienda</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/account/password">
                      <KeyRound className="mr-2 h-4 w-4" />
                      <span>Cambiar contraseña</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="sm:hidden" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                    <Sun className="mr-2 hidden h-4 w-4 dark:block" aria-hidden />
                    <Moon className="mr-2 h-4 w-4 dark:hidden" aria-hidden />
                    <span>Modo claro / oscuro</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => guardarModoDemo(!modoDemo)}>
                    <Presentation className="mr-2 h-4 w-4" />
                    <span>{modoDemo ? "Salir del modo demo" : "Modo demo"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      {/* Company Selection Modal */}
      <CompanySelectionModal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        companies={availableCompanies}
        onCompanySelected={handleCompanySelected}
      />
    </div>
  )
}
