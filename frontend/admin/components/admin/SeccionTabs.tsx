'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdmin } from '@/contexts/admin-context'
import { canAccessSection } from '@/lib/permissions'
import { rutaOculta, useNegocio } from '@/lib/api/negocio'
import { rutaEnModoDemo, useModoDemo } from '@/lib/config'
import { cn } from '@/lib/utils'

// Una entrada del menú que agrupa varias pantallas; cada pestaña respeta el permiso de su ruta.
export const SECCIONES = {
  clientes: {
    label: 'Clientes',
    tabs: [
      { href: '/admin/customers', label: 'Clientes' },
      { href: '/admin/vehiculos', label: 'Vehículos' },
    ],
  },
  inventario: {
    label: 'Inventario',
    tabs: [
      { href: '/admin/piezas', label: 'Buscar piezas' },
      { href: '/admin/existencias', label: 'Existencias' },
      { href: '/admin/reservas', label: 'Reservas' },
      { href: '/admin/sucursales', label: 'Sucursales' },
      { href: '/admin/vehiculos-catalogo', label: 'Vehículos' },
      { href: '/admin/piezas-externas', label: 'Piezas externas', tambien: ['/admin/busqueda-externa'] },
      { href: '/admin/products', label: 'Administrar' },
    ],
  },
  ventas: {
    label: 'Ventas',
    tabs: [
      { href: '/admin/leads', label: 'Leads' },
      { href: '/admin/cotizaciones', label: 'Cotizaciones' },
      { href: '/admin/orders', label: 'Órdenes' },
      { href: '/admin/payment-links', label: 'Links de pago' },
    ],
  },
}

export function SeccionTabs({ seccion }: { seccion: keyof typeof SECCIONES }) {
  const pathname = usePathname() ?? ''
  const { user } = useAdmin()
  const negocio = useNegocio()
  const modoDemo = useModoDemo()
  const { label, tabs } = SECCIONES[seccion] as { label: string; tabs: { href: string; label: string; tambien?: string[] }[] }
  const visibles = tabs.filter(
    (t) => canAccessSection(user?.role, t.href) && !rutaOculta(t.href, negocio) && (!modoDemo || rutaEnModoDemo(t.href))
  )
  if (visibles.length < 2) return null
  return (
    <nav aria-label={label} className="scrollbar-hide -mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      {visibles.map((t) => {
        const activo = [t.href, ...(t.tambien ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`))
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activo ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

const PIEZAS_EXTERNAS = [
  { href: '/admin/busqueda-externa', label: 'Lo que piden y no hay' },
  { href: '/admin/piezas-externas', label: 'Traer piezas de un vehículo' },
]

export function PiezasExternasTabs() {
  const pathname = usePathname() ?? ''
  return (
    <div className="inline-flex gap-1 rounded-control bg-secondary p-1" role="tablist" aria-label="Piezas externas">
      {PIEZAS_EXTERNAS.map((t) => {
        const activo = pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link key={t.href} href={t.href} role="tab" aria-selected={activo}
            className={cn('rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activo ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
