'use client'

import { useEffect } from 'react'
import { PaymentRedirect } from '@/components/payment/payment-redirect'

interface BhdCheckoutFormProps {
  checkoutUrl?: string
  payload?: Record<string, any>
  orderNumber?: string
  amount?: number
  currency?: string
  orderId?: string
  customerInfo?: {
    name: string
    email: string
    phone?: string
  }
}

export default function BhdCheckoutForm({
  checkoutUrl,
  payload,
  orderNumber,
  amount,
  currency = 'DOP',
  orderId,
  customerInfo
}: BhdCheckoutFormProps) {

  useEffect(() => {
    console.log('[BHD Component] Mounted with payload:', {
      provider: payload?.provider,
      hasRedirectUrl: !!payload?.redirect_url,
      redirectUrl: payload?.redirect_url?.substring(0, 80) + '...',
      orderNumber
    })

    // Auto-redirect si tenemos la redirect_url
    if (payload?.redirect_url) {
      console.log('[BHD Component] Auto-redirecting to BHD')
      // Sin delay, redirect inmediatamente
      window.location.href = payload.redirect_url
    }
  }, [payload, orderNumber])

  // Mientras se redirige, mostrar pantalla de carga
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-8">
      <PaymentRedirect providerKey="bhd" orderNumber={orderNumber}>
        <p className="text-[13px] text-muted-foreground">
          Si no eres redirigido automáticamente,
          <a
            href={payload?.redirect_url || '#'}
            className="ml-1 font-medium text-primary underline underline-offset-4"
          >
            haz clic aquí
          </a>
        </p>
      </PaymentRedirect>
    </div>
  )
}
