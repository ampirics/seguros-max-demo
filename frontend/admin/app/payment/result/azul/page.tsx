"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/contexts/cart-context';
import { cn } from '@/lib/utils';
import { PaymentShell } from '@/components/payment/payment-shell';
import {
  PaymentDetails,
  PaymentLoading,
  PaymentNote,
  PaymentStatusCard,
  PaymentSupport,
  StoreLinkButton,
  formatPaymentAmount,
  toneTextClass,
  type PaymentDetail,
  type PaymentTone,
} from '@/components/payment/payment-status';
import type { CompanyTheme } from '@/lib/payment-links-types';

export const dynamic = 'force-dynamic';

interface OrderDetails {
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  currency: string;
  transaction_id?: string;
  created_at?: string;
  updated_at?: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  company_theme?: CompanyTheme;
}

export default function AzulPaymentResultPage() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartCleared, setCartCleared] = useState(false);

  // Azul puede enviar 'approved', 'declined', 'cancelled' directamente
  // O el backend puede enviar 'success', 'failed', 'cancelled' después de procesar
  const rawStatus = searchParams?.get('status') || 'failed';
  const status = rawStatus === 'approved' ? 'success' : rawStatus;
  // ✅ SEGURIDAD: Preferir order_id (UUID) sobre order_number para evitar enumeración
  const orderId = searchParams?.get('order_id');
  // Firma del backend para ver el recibo (la pone en la URL de retorno).
  const receiptSig = searchParams?.get('rt') || '';
  const orderNumber = searchParams?.get('order_number') || searchParams?.get('OrderNumber') || '';

  useEffect(() => {
    const fetchOrderDetails = async () => {
      // Preferir order_id (UUID) sobre order_number
      if (!orderId && !orderNumber) {
        setError('Identificador de orden no proporcionado');
        setLoading(false);
        return;
      }

      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        // ✅ SEGURIDAD: Usar endpoint con UUID si disponible, fallback a order_number
        let endpoint: string;
        if (orderId) {
          endpoint = `${backendUrl}/api/v1/payments/public/receipt/${orderId}?rt=${encodeURIComponent(receiptSig)}`;
        } else {
          endpoint = `${backendUrl}/api/v1/payments/public/order/${orderNumber}/details`;
        }

        const response = await fetch(endpoint);

        if (!response.ok) {
          if (response.status === 404) {
            setError(`La orden no fue encontrada en el sistema. Esto puede ocurrir si:\n• La orden fue creada en otro ambiente (desarrollo/producción)\n• El identificador es incorrecto\n• La orden aún no ha sido procesada`);
          } else if (response.status === 400) {
            setError('Identificador de orden inválido');
          } else {
            setError('No se pudo obtener la información de la orden');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setOrderDetails(data);
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Error al obtener los detalles de la orden. Verifica que el backend esté corriendo en ' + (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'));
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, orderNumber]);

  // 🧹 Limpiar carrito y cache de productos cuando el pago es exitoso
  useEffect(() => {
    if (orderDetails?.payment_status === 'paid' && !cartCleared) {
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
  }, [orderDetails?.payment_status, cartCleared, clearCart]);

  // Estado de carga
  if (loading) {
    return (
      <PaymentShell theme={orderDetails?.company_theme}>
        <PaymentLoading
          title="Verificando tu pago"
          description="Estamos confirmando tu transacción. No cierres esta ventana."
        />
      </PaymentShell>
    );
  }

  // Estado de error
  if (error || !orderDetails) {
    return (
      <PaymentShell theme={orderDetails?.company_theme}>
        <PaymentStatusCard
          tone="danger"
          eyebrow="Error"
          title="No pudimos consultar tu orden"
          description={
            <p className="whitespace-pre-line">{error || 'No se pudieron obtener los detalles de la orden'}</p>
          }
          actions={<StoreLinkButton />}
          footer={<PaymentSupport phone={orderDetails?.company_theme?.support_phone} />}
        >
          {orderNumber && (
            <PaymentDetails rows={[{ label: 'Número de orden buscado', value: orderNumber, mono: true }]} />
          )}
        </PaymentStatusCard>
      </PaymentShell>
    );
  }

  // Determinar el estado visual basado en payment_status de la BD
  const isSuccess = orderDetails.payment_status === 'paid' || status === 'success';
  const isCancelled = status === 'cancelled' || orderDetails.payment_status === 'cancelled';
  const isFailed = !isSuccess && !isCancelled;
  const currency = orderDetails.currency;

  const view: { tone: PaymentTone; eyebrow: string; title: string; description: string; statusLabel: string } =
    isSuccess ? {
      tone: 'success', eyebrow: 'Pagado', title: 'Pago confirmado', statusLabel: 'Pagado',
      description: 'Tu pago ha sido procesado correctamente.',
    } : isCancelled ? {
      tone: 'neutral', eyebrow: 'Cancelado', title: 'Pago cancelado', statusLabel: 'Cancelado',
      description: 'El pago fue cancelado por el usuario.',
    } : {
      tone: 'danger', eyebrow: 'Fallido', title: 'Pago no completado', statusLabel: 'Fallido',
      description: 'No se pudo procesar tu pago.',
    };

  const rows: PaymentDetail[] = [
    { label: 'Orden', value: orderDetails.order_number, className: 'font-medium' },
    { label: 'Estado del pago', value: view.statusLabel, className: cn('font-medium', toneTextClass(view.tone)) },
    { label: 'Método', value: 'Azul · Tarjeta' },
    ...(orderDetails.transaction_id ? [{ label: 'ID de transacción', value: orderDetails.transaction_id, mono: true }] : []),
    ...(orderDetails.customer ? [{ label: 'Cliente', value: orderDetails.customer.name }] : []),
    ...(orderDetails.customer?.email ? [{ label: 'Email', value: orderDetails.customer.email }] : []),
    ...(orderDetails.updated_at ? [{
      label: 'Fecha',
      value: new Date(orderDetails.updated_at).toLocaleString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    }] : []),
  ];

  return (
    <PaymentShell theme={orderDetails?.company_theme}>
      <PaymentStatusCard
        tone={view.tone}
        eyebrow={view.eyebrow}
        title={view.title}
        description={view.description}
        actions={<StoreLinkButton />}
        footer={<PaymentSupport phone={orderDetails?.company_theme?.support_phone} />}
      >
        <PaymentDetails rows={rows} total={{ label: 'Monto total', value: formatPaymentAmount(orderDetails.total, currency) }} />

        {/* Mensaje informativo */}
        {isSuccess && (
          <PaymentNote tone="success">
            <strong>¡Gracias por tu compra!</strong> Recibirás un correo de confirmación con los detalles de tu orden.
            {orderDetails.customer?.email && ` El correo será enviado a ${orderDetails.customer.email}.`}
          </PaymentNote>
        )}

        {isCancelled && (
          <PaymentNote tone="neutral">
            <strong>Pago cancelado.</strong> No se realizó ningún cargo. Puedes intentar nuevamente cuando lo desees.
          </PaymentNote>
        )}

        {isFailed && (
          <PaymentNote tone="danger">
            <strong>El pago no pudo ser procesado.</strong> Por favor verifica tu información e intenta nuevamente.
            Si el problema persiste, contacta a tu banco o intenta con otra tarjeta.
          </PaymentNote>
        )}
      </PaymentStatusCard>
    </PaymentShell>
  );
}
