import Link from "next/link"
import type { ReactNode } from "react"
import { AlertTriangle, Check, Clock, Loader2, MessageCircle, RotateCcw, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { STORE_SUPPORT_WHATSAPP } from "@/components/payment/payment-shell"

// Piezas compartidas de las páginas de resultado de pago (Azul, BHD, Popular y
// páginas CMS). Cada página decide su estado; aquí solo vive la presentación.

export type PaymentTone = "success" | "info" | "warning" | "danger" | "neutral"

const TONES: Record<PaymentTone, { icon: LucideIcon; soft: string; text: string }> = {
  success: { icon: Check, soft: "bg-success-soft text-success", text: "text-success" },
  info: { icon: Clock, soft: "bg-info-soft text-info", text: "text-info" },
  warning: { icon: AlertTriangle, soft: "bg-warning-soft text-warning", text: "text-warning" },
  danger: { icon: X, soft: "bg-destructive-soft text-destructive", text: "text-destructive" },
  neutral: { icon: RotateCcw, soft: "bg-secondary text-muted-foreground", text: "text-muted-foreground" },
}

export function toneTextClass(tone: PaymentTone) {
  return TONES[tone].text
}

// Mismo formato que usaban las páginas de resultado: RD$1,234.00
export function formatPaymentAmount(value: number, currency = "DOP") {
  return `${currency === "DOP" ? "RD$" : "$"}${value.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface PaymentStatusCardProps {
  tone: PaymentTone
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
}

export function PaymentStatusCard({ tone, eyebrow, title, description, children, actions, footer }: PaymentStatusCardProps) {
  const { icon: Icon, soft, text } = TONES[tone]
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex flex-col gap-7 rounded-lg border bg-card p-6 sm:p-10 print:border-0 print:p-0">
        <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", soft)}>
          <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex flex-col gap-3">
          <span className={cn("text-xs font-semibold uppercase tracking-[0.14em]", text)}>{eyebrow}</span>
          <h1 className="font-display text-4xl font-medium leading-[1.05] sm:text-[2.75rem]">{title}</h1>
          {description && <div className="text-[15px] leading-relaxed text-muted-foreground">{description}</div>}
        </div>
        {children}
        {actions && <div className="flex flex-col gap-3 print:hidden">{actions}</div>}
        {footer}
      </div>
    </div>
  )
}

export interface PaymentDetail {
  label: string
  value: ReactNode
  mono?: boolean
  className?: string
}

export function PaymentDetails({ rows, total }: { rows: PaymentDetail[]; total?: { label: string; value: ReactNode } }) {
  return (
    <dl className="flex flex-col gap-3 rounded-md bg-background p-5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4">
          <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
          <dd className={cn("min-w-0 break-words text-right", row.mono && "font-mono text-[13px]", row.className)}>
            {row.value}
          </dd>
        </div>
      ))}
      {total && (
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-4">
          <dt className="font-semibold">{total.label}</dt>
          <dd className="font-display text-3xl font-semibold leading-none">{total.value}</dd>
        </div>
      )}
    </dl>
  )
}

export function PaymentNote({ tone, children }: { tone: PaymentTone; children: ReactNode }) {
  return <div className={cn("rounded-md px-4 py-3 text-sm leading-relaxed", TONES[tone].soft)}>{children}</div>
}

export function PaymentSupport({ 
  className, 
  phone, 
  whatsappUrl 
}: { 
  className?: string; 
  phone?: string | null; 
  whatsappUrl?: string | null;
} = {}) {
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : null;
  const rawNumber = cleanPhone ? cleanPhone.replace(/^\+/, '') : null;
  const href = whatsappUrl || (rawNumber ? `https://wa.me/${rawNumber}` : STORE_SUPPORT_WHATSAPP.href);
  const label = phone || STORE_SUPPORT_WHATSAPP.label;

  return (
    <p className={cn("flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground print:hidden", className)}>
      <MessageCircle className="h-4 w-4" aria-hidden />
      ¿Necesitas ayuda?
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        WhatsApp {label}
      </a>
    </p>
  )
}

export function StoreLinkButton({ variant = "default", label = "Volver a la tienda" }: { variant?: "default" | "outline"; label?: string }) {
  return (
    <Button asChild size="lg" variant={variant} className="h-12 w-full text-[15px]">
      <Link href="/">{label}</Link>
    </Button>
  )
}

export function PaymentLoading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 animate-spin text-brand" aria-hidden />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-medium leading-tight">{title}</h1>
        {description && <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}
