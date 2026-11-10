import { apiClient } from './api-client';

export interface PaymentPageData {
  page_type: string;
  title: string;
  subtitle: string;
  content: string;
  button_text: string;
  button_url: string;
  custom_css: string;
  is_active: boolean;
}

export type PaymentPageType = 'approved' | 'declined' | 'cancelled';

// Contenido por defecto si no hay configuración personalizada
const defaultPages: Record<PaymentPageType, PaymentPageData> = {
  approved: {
    page_type: 'approved',
    title: '¡Pago Exitoso!',
    subtitle: 'Tu pago ha sido procesado correctamente',
    content: `<div class="text-center">
      <h2>¡Gracias por tu compra!</h2>
      <p>Tu pago ha sido procesado exitosamente. Recibirás un email de confirmación en los próximos minutos.</p>
      <p>Número de confirmación: #{{order_number}}</p>
    </div>`,
    button_text: 'Volver a la tienda',
    button_url: '/',
    custom_css: '.payment-success { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); }',
    is_active: true
  },
  declined: {
    page_type: 'declined',
    title: 'Pago Declinado',
    subtitle: 'Tu pago no pudo ser procesado',
    content: `<div class="text-center">
      <h2>Pago no procesado</h2>
      <p>Tu pago no pudo ser completado. Por favor verifica tus datos de pago e intenta nuevamente.</p>
      <p>Si el problema persiste, contacta con soporte.</p>
    </div>`,
    button_text: 'Intentar de nuevo',
    button_url: '/checkout',
    custom_css: '.payment-error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }',
    is_active: true
  },
  cancelled: {
    page_type: 'cancelled',
    title: 'Pago Cancelado',
    subtitle: 'Has cancelado el proceso de pago',
    content: `<div class="text-center">
      <h2>Pago cancelado</h2>
      <p>Has cancelado el proceso de pago. Tu orden no ha sido procesada.</p>
      <p>Puedes intentar de nuevo cuando gustes o continuar navegando en nuestra tienda.</p>
    </div>`,
    button_text: 'Volver a la tienda',
    button_url: '/',
    custom_css: '.payment-cancelled { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }',
    is_active: true
  }
};

/**
 * Obtiene la configuración de una página de pago desde el CMS o usa la configuración por defecto
 */
export async function getPaymentPageConfig(
  pageType: PaymentPageType, 
  companyId?: string
): Promise<PaymentPageData> {
  try {
    // Si no hay companyId, usar configuración por defecto
    if (!companyId) {
      return defaultPages[pageType];
    }

    // Intentar obtener configuración personalizada del backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(
      `${backendUrl}/api/v1/payment-pages/public/${companyId}/${pageType}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const customConfig = await response.json();
      return {
        ...defaultPages[pageType],
        ...customConfig
      };
    }
  } catch (error) {
  }

  // Si no hay configuración personalizada o hubo error, usar por defecto
  return defaultPages[pageType];
}

/**
 * Procesa el contenido reemplazando variables como {{order_number}}
 */
export function processPaymentPageContent(
  content: string,
  variables: Record<string, string>
): string {
  let processedContent = content;
  
  // Reemplazar variables en el formato {{variable}}
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return processedContent;
}

/**
 * Valida un pago con el backend
 */
export async function validatePayment(searchParams: URLSearchParams) {
  try {
    const response = await fetch('/api/v1/payments/azul/return?' + searchParams.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Error validando pago:', error);
    return { status: 'error', message: 'Error validando el pago' };
  }
}