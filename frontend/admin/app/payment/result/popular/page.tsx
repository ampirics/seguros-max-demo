'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { PaymentShell } from '@/components/payment/payment-shell';
import {
  PaymentDetails,
  PaymentLoading,
  PaymentNote,
  PaymentStatusCard,
  PaymentSupport,
  formatPaymentAmount,
  type PaymentDetail,
} from '@/components/payment/payment-status';
import type { CompanyTheme } from '@/lib/payment-links-types';

export const dynamic = 'force-dynamic';

interface PaymentResult {
  status: 'success' | 'failed' | 'pending' | 'cancelled';
  order_id?: string;
  order_number?: string;
  transaction_id?: string;
  amount?: number;
  message?: string;
  timestamp?: string;
  payment_method?: string;
  total?: number;
  subtotal?: number;
  tax?: number;
  payment_reference?: string;
  customer_name?: string;
  company_theme?: CompanyTheme;
}

const actionButtonClass = 'h-12 w-full text-[15px]';

export default function PopularResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();

  const [result, setResult] = useState<PaymentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCleared, setCartCleared] = useState(false);

  useEffect(() => {
    if (!searchParams) {
      setLoading(false);
      return;
    }

    // Obtener parámetros de la URL
    const status = searchParams.get('status');
    // ✅ SEGURIDAD: Preferir order_id (UUID) sobre order_number para evitar enumeración
    const orderId = searchParams.get('order_id');
    // Firma del backend para ver el recibo (la pone en la URL de retorno).
    const receiptSig = searchParams.get('rt') || '';
    const orderNumber = searchParams.get('order_number');
    const amount = searchParams.get('amount');
    const transactionId = searchParams.get('transaction_id');
    const message = searchParams.get('message');
    const timestamp = searchParams.get('timestamp');

    // Si tenemos order_id (UUID), consultar al backend para obtener detalles completos
    if (status && orderId) {
      fetchOrderDetails(orderId, status);
      return;
    }

    // Fallback: Usar datos del query string (links antiguos con order_number)
    if (status) {
      setResult({
        status: status as 'success' | 'failed' | 'pending' | 'cancelled',
        order_number: orderNumber || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        transaction_id: transactionId || undefined,
        message: message || undefined,
        timestamp: timestamp || undefined,
        payment_method: 'Banco Popular',
      });
      setLoading(false);
      return;
    }

    // Opción 2: Consultar al backend por token del payment link
    const token = searchParams.get('token');
    if (token) {
      fetchPaymentStatus(token);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  // ✅ SEGURIDAD: Consultar detalles de orden usando UUID
  const fetchOrderDetails = async (orderId: string, status: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      // Firma del recibo que el backend puso en la URL de retorno (sin ella el recibo da 404).
      const receiptSig = searchParams?.get('rt') || '';
      const response = await fetch(`${backendUrl}/api/v1/payments/public/receipt/${orderId}?rt=${encodeURIComponent(receiptSig)}`);

      if (response.ok) {
        const data = await response.json();
        setResult({
          status: status as 'success' | 'failed' | 'pending' | 'cancelled',
          order_id: data.order_id,
          order_number: data.order_number,
          amount: data.total,
          total: data.total,
          subtotal: data.subtotal,
          tax: data.tax,
          transaction_id: data.payment_reference,
          payment_reference: data.payment_reference,
          customer_name: data.customer_name,
          payment_method: 'Banco Popular',
          company_theme: data.company_theme,
        });
      } else {
        setResult({
          status: status as 'success' | 'failed' | 'pending' | 'cancelled',
          message: 'No se pudo obtener detalles de la orden',
          payment_method: 'Banco Popular',
        });
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      setResult({
        status: status as 'success' | 'failed' | 'pending' | 'cancelled',
        message: 'Error al consultar detalles',
        payment_method: 'Banco Popular',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentStatus = async (token: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/v1/payments/popular/status/${token}`);

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        setResult({
          status: 'failed',
          message: 'No se pudo verificar el estado del pago',
        });
      }
    } catch (error) {
      console.error('Error fetching payment status:', error);
      setResult({
        status: 'failed',
        message: 'Error de conexión',
      });
    } finally {
      setLoading(false);
    }
  };

  // 🧹 Limpiar carrito y cache de productos cuando el pago es exitoso
  useEffect(() => {
    if (result?.status === 'success' && !cartCleared) {
      clearCart();
      // Limpiar cache de productos de la tienda
      localStorage.removeItem('products_cache');
      localStorage.removeItem('products_timestamp');
      // Invalidar cualquier cache de React Query o SWR
      if (typeof window !== 'undefined' && window.__NEXT_DATA__) {
        // Forzar revalidation de datos
        fetch(process.env.NEXT_PUBLIC_API_URL + '/api/v1/products', {
          headers: { 'Cache-Control': 'no-cache' }
        }).catch(() => {});
      }
      setCartCleared(true);
    }
  }, [result?.status, cartCleared, clearCart]);

  if (loading) {
    return (
      <PaymentShell>
        <PaymentLoading
          title="Verificando tu pago"
          description="Estamos consultando el estado de tu pago con Banco Popular."
        />
      </PaymentShell>
    );
  }

  if (!result) {
    return (
      <PaymentShell theme={undefined}>
        <PaymentStatusCard
          tone="warning"
          eyebrow="Sin información"
          title="Información no disponible"
          description="No se pudo obtener información sobre el pago."
          actions={
            <Button size="lg" className={actionButtonClass} onClick={() => router.push('/')}>
              Volver al inicio
            </Button>
          }
          footer={<PaymentSupport phone={undefined} />}
        />
      </PaymentShell>
    );
  }

  // Renderizar según el estado
  if (result.status === 'success') {
    const rows: PaymentDetail[] = [
      ...(result.order_number ? [{ label: 'Orden', value: result.order_number, className: 'font-medium' }] : []),
      ...(result.transaction_id ? [{ label: 'Comprobante', value: result.transaction_id, mono: true }] : []),
      ...(result.payment_method ? [{ label: 'Método', value: result.payment_method }] : []),
      ...(result.timestamp ? [{
        label: 'Fecha',
        value: new Date(parseInt(result.timestamp)).toLocaleString('es-DO', {
          dateStyle: 'short',
          timeStyle: 'short'
        }),
      }] : []),
    ];

    return (
      <PaymentShell theme={result.company_theme}>
        <PaymentStatusCard
          tone="success"
          eyebrow="Pagado"
          title="Pago confirmado"
          description="Tu pago ha sido procesado correctamente por Banco Popular."
          actions={
            <>
              <Button size="lg" className={actionButtonClass} onClick={() => router.push('/')}>
                Volver a la tienda
              </Button>
              <Button size="lg" variant="outline" className={actionButtonClass} onClick={() => window.print()}>
                <Printer aria-hidden />
                Imprimir recibo
              </Button>
              {result.order_id && (
                <Button
                  size="lg"
                  variant="ghost"
                  className={actionButtonClass}
                  onClick={() => router.push(`/orders/${result.order_id}`)}
                >
                  Ver detalles de la orden
                </Button>
              )}
            </>
          }
          footer={<PaymentSupport phone={result.company_theme?.support_phone} />}
        >
          {(result.order_number || result.amount || result.transaction_id) && (
            <PaymentDetails
              rows={rows}
              total={result.amount ? { label: 'Monto pagado', value: formatPaymentAmount(result.amount) } : undefined}
            />
          )}
        </PaymentStatusCard>
      </PaymentShell>
    );
  }

  if (result.status === 'failed') {
    return (
      <PaymentShell theme={result.company_theme}>
        <PaymentStatusCard
          tone="danger"
          eyebrow="Rechazado"
          title="Pago rechazado"
          description={result.message || 'No se pudo procesar el pago con Banco Popular.'}
          actions={
            <>
              <Button size="lg" className={actionButtonClass} onClick={() => router.back()}>
                Intentar nuevamente
              </Button>
              <Button size="lg" variant="outline" className={actionButtonClass} onClick={() => router.push('/')}>
                Volver al inicio
              </Button>
            </>
          }
          footer={<PaymentSupport phone={result.company_theme?.support_phone} />}
        >
          <PaymentNote tone="warning">
            <strong>Posibles causas:</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Fondos insuficientes</li>
              <li>Datos de tarjeta incorrectos</li>
              <li>Transacción cancelada por el usuario</li>
              <li>Error de comunicación con el banco</li>
            </ul>
          </PaymentNote>
        </PaymentStatusCard>
      </PaymentShell>
    );
  }

  if (result.status === 'cancelled') {
    return (
      <PaymentShell theme={result.company_theme}>
        <PaymentStatusCard
          tone="neutral"
          eyebrow="Cancelado"
          title="Pago cancelado"
          description={result.message || 'Has cancelado el pago. Tu carrito no fue modificado.'}
          actions={
            <>
              <Button size="lg" className={actionButtonClass} onClick={() => router.back()}>
                Intentar nuevamente
              </Button>
              <Button size="lg" variant="outline" className={actionButtonClass} onClick={() => router.push('/')}>
                Volver a la tienda
              </Button>
            </>
          }
          footer={<PaymentSupport phone={result.company_theme?.support_phone} />}
        >
          <PaymentNote tone="neutral">
            Si deseas completar la compra, vuelve al proceso de pago o revisa tu carrito.
          </PaymentNote>
        </PaymentStatusCard>
      </PaymentShell>
    );
  }

  // Estado pendiente
  return (
    <PaymentShell theme={result?.company_theme}>
      <PaymentLoading
        title="Procesando pago"
        description={result?.message || 'Por favor espera mientras verificamos tu pago.'}
      />
    </PaymentShell>
  );
}
