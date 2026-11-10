import Link from "next/link"
import type { ReactNode } from "react"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CompanyTheme } from "@/lib/payment-links-types"
import { MARCA_BASE } from "@/lib/marca"

// Contacto de soporte que se muestra en las páginas públicas de pago
export const STORE_SUPPORT_WHATSAPP = {
  href: "https://wa.me/18096841243",
  label: "809-684-1243",
}

interface PaymentShellProps {
  children: ReactNode
  className?: string
  theme?: CompanyTheme | null
}

const HEX = /^#([0-9a-f]{3}){1,2}$/i

// Marco de las páginas públicas de pago (enlace de pago y resultados): marca de la
// tienda arriba y contenido centrado. Llegan desde WhatsApp, así que es móvil primero.
export function PaymentShell({ children, className, theme }: PaymentShellProps) {
  const logoUrl = theme?.logo_url && (theme.logo_url.startsWith('/') || theme.logo_url.startsWith('http')) && anyImageExt(theme.logo_url)
    ? theme.logo_url
    : MARCA_BASE.logo
  const companyName = theme?.name || MARCA_BASE.nombre

  // El color de la empresa del enlace reemplaza la marca; el resto de la paleta se deriva de él.
  const dynamicStyle: Record<string, string> = {}
  if (theme?.primary_color && HEX.test(theme.primary_color)) dynamicStyle['--marca'] = theme.primary_color

  return (
    <div className="flex min-h-screen flex-col bg-background" style={dynamicStyle as React.CSSProperties}>
      <header className="border-b bg-card print:border-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-20 sm:px-8">
          <Link href="/" aria-label={`Ir a ${companyName}`} className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-9 w-auto max-w-[180px] object-contain sm:h-11" />
            ) : (
              <span className="font-display text-lg font-bold text-foreground">{companyName}</span>
            )}
          </Link>
          <span className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <Lock className="h-4 w-4 text-success" aria-hidden />
            Pago seguro
          </span>
        </div>
      </header>
      <main className={cn("flex-1 px-5 py-8 sm:px-8 sm:py-14", className)}>{children}</main>
    </div>
  )
}

function anyImageExt(url: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'].some(ext => url.toLowerCase().endsWith(ext))
}
