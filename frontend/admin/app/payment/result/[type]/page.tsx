"use client";

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Home, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, sanitizeHtml, sanitizeText } from '@/lib/utils';
import { PaymentShell, STORE_SUPPORT_WHATSAPP } from '@/components/payment/payment-shell';
import { MARCA_BASE } from '@/lib/marca';
import {
  PaymentDetails,
  PaymentLoading,
  PaymentNote,
  PaymentStatusCard,
  StoreLinkButton,
  type PaymentTone,
} from '@/components/payment/payment-status';

interface PaymentPageData {
  page_type: string;
  title: string;
  subtitle: string;
  content: string;
  button_text: string;
  button_url: string;
  custom_css: string;
}

interface PaymentValidation {
  isValid: boolean;
  orderVerified: boolean;
  paymentProcessed: boolean;
  message?: string;
}

export default function PaymentResultPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [pageData, setPageData] = useState<PaymentPageData | null>(null);
  const [validation, setValidation] = useState<PaymentValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageType = params?.type as string;
  const companyId = "73b64a8a-290c-4e2c-a6ac-399dff12c97e"; // Company ID from token data

  // Obtener parámetros adicionales de la URL (como order_number, amount, etc.)
  const orderNumber = searchParams?.get('order_number') || searchParams?.get('OrderNumber');
  const amount = searchParams?.get('amount') || searchParams?.get('Amount');
  const authorizationCode = searchParams?.get('authorization_code') || searchParams?.get('AuthorizationCode');
  const dateTime = searchParams?.get('datetime') || searchParams?.get('DateTime');
  const customerName = searchParams?.get('customer_name');

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const response = await fetch(`/api/v1/payment-pages/public/${companyId}/${pageType}`);
        if (!response.ok) {
          throw new Error('No se pudo cargar la página');
        }
        const data = await response.json();
        setPageData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    const validatePaymentSource = async () => {
      // Solo validar si tenemos información suficiente del pago
      if (orderNumber && pageType === 'approved') {
        try {
          const response = await fetch(`/api/v1/payments/validate-result`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order_number: orderNumber,
              amount: amount,
              authorization_code: authorizationCode,
              datetime: dateTime,
              result_type: pageType
            })
          });

          if (response.ok) {
            const validationData = await response.json();
            setValidation(validationData);
          } else {
            setValidation({
              isValid: false,
              orderVerified: false,
              paymentProcessed: false,
              message: 'No se pudo validar el origen del pago'
            });
          }
        } catch (err) {
          console.warn('Error validando fuente del pago:', err);
          setValidation({
            isValid: false,
            orderVerified: false,
            paymentProcessed: false,
            message: 'Error de validación'
          });
        }
      } else {
        // Para pagos declinados o sin información suficiente, no validamos
        setValidation({
          isValid: pageType !== 'approved', // Solo requiere validación para approved
          orderVerified: false,
          paymentProcessed: false
        });
      }
    };

    if (pageType && companyId) {
      fetchPageData();
      validatePaymentSource();
    }
  }, [pageType, companyId, orderNumber, amount, authorizationCode, dateTime]);

  const getTone = (): { tone: PaymentTone; eyebrow: string } => {
    switch (pageType) {
      case 'approved':
        return { tone: 'success', eyebrow: 'Aprobado' };
      case 'declined':
        return { tone: 'danger', eyebrow: 'Declinado' };
      case 'cancelled':
        return { tone: 'warning', eyebrow: 'Cancelado' };
      default:
        return { tone: 'neutral', eyebrow: 'Resultado del pago' };
    }
  };

  const processContent = (content: string) => {
    // Reemplazar variables dinámicas asegurando sanitización de texto plano [A-04]
    let processedContent = content || '';
    if (orderNumber) {
      processedContent = processedContent.replace(/\{\{order_number\}\}/g, sanitizeText(orderNumber));
    }
    if (amount) {
      processedContent = processedContent.replace(/\{\{total_amount\}\}/g, sanitizeText(amount));
    }
    if (customerName) {
      processedContent = processedContent.replace(/\{\{customer_name\}\}/g, sanitizeText(customerName));
    }

    // Variables por defecto de la tienda
    processedContent = processedContent.replace(/\{\{store_name\}\}/g, MARCA_BASE.nombre);
    processedContent = processedContent.replace(/\{\{support_email\}\}/g, STORE_SUPPORT_WHATSAPP.label);
    if (typeof window !== 'undefined') {
      processedContent = processedContent.replace(/\{\{store_url\}\}/g, sanitizeText(window.location.origin));
    }

    // Sanitizar HTML final con DOMPurify para neutralizar cualquier carga XSS
    return sanitizeHtml(processedContent);
  };

  // "Aprobado" solo se afirma si el backend confirma la orden y el pago. Antes,
  // abrir /payment/result/approved sin nada mostraba "¡Pago Exitoso!" y
  // prometía un correo: cualquiera podía fabricar ese enlace.
  const approvedPending = pageType === 'approved' && validation === null;
  const approvedUnconfirmed =
    pageType === 'approved' && validation !== null && !(validation.isValid && validation.orderVerified);

  if (loading || approvedPending) {
    return (
      <PaymentShell>
        <PaymentLoading title="Cargando…" />
      </PaymentShell>
    );
  }

  if (approvedUnconfirmed) {
    return (
      <PaymentShell>
        <PaymentStatusCard
          tone="warning"
          eyebrow="Sin confirmar"
          title="No pudimos confirmar este pago"
          description={
            orderNumber
              ? `No encontramos un pago confirmado para la orden ${sanitizeText(orderNumber)}.`
              : 'Esta página no trae los datos de ninguna orden.'
          }
          actions={<StoreLinkButton label="Volver a la tienda" />}
        >
          <PaymentNote tone="warning">
            Si realizaste un pago, no lo repitas: revisa el comprobante del banco y contáctanos con tu número de orden
            para confirmarlo.
          </PaymentNote>
        </PaymentStatusCard>
      </PaymentShell>
    );
  }

  if (error || !pageData) {
    return (
      <PaymentShell>
        <PaymentStatusCard
          tone="danger"
          eyebrow="Error"
          title="No se pudo cargar la página"
          description={error || 'No se pudo cargar la página'}
          actions={<StoreLinkButton label="Volver al inicio" />}
        />
      </PaymentShell>
    );
  }

  const { tone, eyebrow } = getTone();

  return (
    <PaymentShell>
      {/* Inyectar CSS personalizado */}
      {pageData.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: pageData.custom_css }} />
      )}

      <PaymentStatusCard
        tone={tone}
        eyebrow={eyebrow}
        title={pageData.title}
        description={pageData.subtitle || undefined}
        actions={
          (pageData.button_text && pageData.button_url) || pageData.button_url !== '/' ? (
            <>
              {pageData.button_text && pageData.button_url && (
                <Button asChild size="lg" className="h-12 w-full text-[15px]">
                  <Link href={pageData.button_url}>
                    {pageType === 'declined' ? <RefreshCw aria-hidden /> : <Home aria-hidden />}
                    {pageData.button_text}
                  </Link>
                </Button>
              )}

              {/* Botón secundario para volver al inicio */}
              {pageData.button_url !== '/' && <StoreLinkButton variant="outline" label="Volver al inicio" />}
            </>
          ) : undefined
        }
        footer={
          <p className="text-center text-sm text-muted-foreground print:hidden">
            ¿Tienes preguntas? Escríbenos por WhatsApp:
            <a href={STORE_SUPPORT_WHATSAPP.href} target="_blank" rel="noopener noreferrer" className="ml-1 font-medium text-primary underline-offset-4 hover:underline">
              {STORE_SUPPORT_WHATSAPP.label}
            </a>
          </p>
        }
      >
        {/* Contenido personalizado */}
        <div
          className="prose max-w-none text-foreground/80"
          dangerouslySetInnerHTML={{
            __html: processContent(pageData.content)
          }}
        />

        {/* Información adicional para pagos exitosos */}
        {pageType === 'approved' && (orderNumber || amount) && (
          <div className="flex flex-col gap-3">
            <PaymentDetails
              rows={[
                ...(orderNumber ? [{ label: 'Número de orden', value: orderNumber, className: 'font-medium' }] : []),
                ...(amount ? [{ label: 'Monto', value: `$${amount}` }] : []),
                ...(authorizationCode ? [{ label: 'Código de autorización', value: authorizationCode, mono: true }] : []),
                { label: 'Fecha', value: new Date().toLocaleDateString() },
              ]}
            />

            {/* Indicador de validación de seguridad */}
            {validation && (
              <div className="flex flex-col items-center gap-1 text-center">
                <span className={cn('flex items-center gap-2 text-xs font-medium', validation.isValid ? 'text-success' : 'text-destructive')}>
                  <Shield className="h-4 w-4" aria-hidden />
                  {validation.isValid ? 'Pago verificado y seguro' : 'Verificación pendiente'}
                </span>
                {validation.message && (
                  <span className="text-xs text-muted-foreground">{validation.message}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alerta de validación para pagos no verificados */}
        {pageType === 'approved' && validation && !validation.isValid && (
          <PaymentNote tone="warning">
            <span className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" aria-hidden />
              Verificación en proceso
            </span>
            <span className="mt-1 block">
              Tu pago está siendo verificado. Si tienes dudas, contacta nuestro soporte.
            </span>
          </PaymentNote>
        )}
      </PaymentStatusCard>
    </PaymentShell>
  );
}
