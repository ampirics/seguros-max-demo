import PaymentPage from '@/components/payment-links/payment-page'
import { PaymentShell } from '@/components/payment/payment-shell'
import { PaymentStatusCard, PaymentSupport } from '@/components/payment/payment-status'
import type { PaymentLinkValidation } from '@/lib/payment-links-types'
import type { PaymentProvider } from '@/components/payment/payment-method-selector'

const BACKEND_INTERNAL_URL = process.env.BACKEND_URL || 'http://localhost:8000'

async function getPaymentLinkData(token: string) {
  try {
    const validateRes = await fetch(`${BACKEND_INTERNAL_URL}/api/v1/public/payment-links/validate/${token}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      }
    })
    
    if (!validateRes.ok) {
      return { validation: null, providers: [], error: 'Error al validar el enlace de pago' }
    }
    
    const validation: PaymentLinkValidation = await validateRes.json()
    
    if (!validation.valid) {
      return { validation, providers: [], error: validation.message || 'Enlace no válido o expirado' }
    }

    // Cargar proveedores directamente en el servidor usando el token del enlace
    const providersRes = await fetch(`${BACKEND_INTERNAL_URL}/api/v1/public/payment-providers?token=${token}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      }
    })

    let providers: PaymentProvider[] = []
    if (providersRes.ok) {
      const pData = await providersRes.json()
      providers = pData.providers || []
    }

    return { validation, providers, error: null }
  } catch (err) {
    console.error('[SSR /pay/[token]] Error fetching from backend:', err)
    return { validation: null, providers: [], error: 'Error de conexión con el servidor' }
  }
}

export default async function PublicPaymentLinkPage({ 
  params 
}: { 
  params: Promise<{ token: string }> 
}) {
  const resolvedParams = await params
  const token = resolvedParams?.token

  if (!token) {
    return (
      <PaymentShell>
        <PaymentStatusCard
          tone="danger"
          eyebrow="Enlace no disponible"
          title="Token no válido"
          description="El enlace de pago no es válido o ha expirado."
          footer={<PaymentSupport />}
        />
      </PaymentShell>
    )
  }

  const { validation, providers, error } = await getPaymentLinkData(token)

  if (error || !validation || !validation.valid) {
    const reason = validation?.reason
    // Pago enviado y el banco lo está validando: no es un error, es una espera.
    const pendiente = reason === 'pending_authorization'
    const errorTitle = pendiente ? 'Pago pendiente de autorización' :
                       reason === 'expired' ? 'Enlace expirado' :
                       reason === 'used' ? 'Enlace ya utilizado' :
                       reason === 'cancelled' ? 'Enlace cancelado' :
                       'Enlace no disponible'
    const errorDesc = validation?.message || error || 'El enlace de pago no es válido o ha expirado.'

    return (
      <PaymentShell theme={validation?.company_theme}>
        <PaymentStatusCard
          tone={pendiente ? 'info' : 'danger'}
          eyebrow="Estado del pago"
          title={errorTitle}
          description={errorDesc}
          footer={<PaymentSupport phone={validation?.company_theme?.support_phone} />}
        />
      </PaymentShell>
    )
  }

  return (
    <PaymentPage 
      token={token} 
      initialValidation={validation} 
      initialProviders={providers} 
    />
  )
}
