import type { ReactNode } from "react"
import { MARCA_BASE } from "@/lib/marca"
import { PROVIDER_BRANDS } from "@/components/payment/payment-providers"

interface PaymentRedirectProps {
  providerKey: string
  orderNumber?: string
  children?: ReactNode
}

// Pantalla de transición mientras el navegador sale hacia el portal del banco
export function PaymentRedirect({ providerKey, orderNumber, children }: PaymentRedirectProps) {
  const brand = PROVIDER_BRANDS[providerKey]
  const bankName = brand?.name ?? "el banco"

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 py-10 text-center sm:py-16" role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-24 items-center justify-center rounded-md border bg-card p-2">
          <img src={MARCA_BASE.logo} alt={MARCA_BASE.nombre} className="max-h-full max-w-full object-contain" />
        </span>
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </span>
        <span className="flex h-14 w-24 items-center justify-center rounded-md border bg-white p-2">
          {brand ? (
            <img src={brand.logo} alt={bankName} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-sm font-medium">{bankName}</span>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-medium leading-tight">Te llevamos a {bankName}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Autoriza el pago en el portal seguro del banco. Al terminar volverás aquí. No cierres esta ventana.
        </p>
        {orderNumber && (
          <p className="text-sm text-muted-foreground">
            Orden <span className="font-medium text-foreground">{orderNumber}</span>
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
