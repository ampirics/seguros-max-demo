'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PaymentLinkValidation } from '@/lib/payment-links-types';
import { cn, formatCurrency } from '@/lib/utils';
import PaymentMethodSelector, { type PaymentSelection } from '@/components/payment/payment-method-selector';
import AzulCheckoutForm from '@/components/payment/azul-checkout-form';
import { PaymentShell } from '@/components/payment/payment-shell';
import { PaymentRedirect } from '@/components/payment/payment-redirect';
import {
  PaymentLoading,
  PaymentStatusCard,
  PaymentSupport,
  StoreLinkButton,
} from '@/components/payment/payment-status';

// Componente para auto-submit de Popular
interface PopularAutoSubmitProps {
  htmlContent: string;
}

function PopularAutoSubmit({ htmlContent }: PopularAutoSubmitProps) {
  useEffect(() => {

    // Crear un contenedor temporal para parsear el HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Buscar el formulario
    const form = tempDiv.querySelector('form');
    if (form) {
      const action = form.getAttribute('action');

      // Crear un nuevo formulario en el DOM actual
      const newForm = document.createElement('form');
      newForm.method = 'POST';
      newForm.action = action || '';
      newForm.style.display = 'none';

      // Copiar todos los campos hidden
      const inputs = form.querySelectorAll('input[type="hidden"]');
      inputs.forEach(input => {
        const newInput = document.createElement('input');
        newInput.type = 'hidden';
        newInput.name = input.getAttribute('name') || '';
        newInput.value = input.getAttribute('value') || '';
        newForm.appendChild(newInput);
      });

      // Agregar al DOM y submitir
      document.body.appendChild(newForm);
      newForm.submit();
    } else {
      console.error('PopularAutoSubmit - No form found in HTML content');
    }
  }, [htmlContent]);

  return (
    <PaymentShell>
      <PaymentRedirect providerKey="popular" />
    </PaymentShell>
  );
}

interface PaymentProvider {
  id: string;
  provider_key: string;
  display_name: string;
  description: string;
  category: 'card' | 'bank_transfer' | 'digital_wallet';
  environment: 'sandbox' | 'production';
  is_active: boolean;
}

interface CheckoutData {
  checkout_url: string;
  payload: any;
  provider: string;
  order_id?: string;
  html_content?: string; // Para respuestas HTML de Popular
  redirect_url?: string; // Para BHD
}

interface PaymentPageProps {
  token: string;
  initialValidation?: PaymentLinkValidation | null;
  initialProviders?: PaymentProvider[];
}

export default function PaymentPage({ token, initialValidation, initialProviders }: PaymentPageProps) {
  const [validation, setValidation] = useState<PaymentLinkValidation | null>(initialValidation || null);
  const [providers, setProviders] = useState<PaymentProvider[]>(initialProviders || []);
  const [loading, setLoading] = useState(!initialValidation);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [pendingAuthorization, setPendingAuthorization] = useState(false);
  const [selection, setSelection] = useState<PaymentSelection | null>(null);

  useEffect(() => {
    if (!initialValidation) {
      validatePaymentLink();
    }
  }, [token, initialValidation]);

  const validatePaymentLink = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.request(`/public/payment-links/validate/${token}`, {
        method: 'GET',
      }) as PaymentLinkValidation;

      if (response.valid) {
        setValidation(response);
        // Una vez validado el link, cargar los métodos de pago reales de la empresa
        await loadPaymentProviders();
      } else {
        const errorMsg = response.message || (
          response.reason === 'expired' ? 'Este enlace de pago ha expirado' :
          response.reason === 'used' ? 'Este enlace de pago ya ha sido utilizado' :
          response.reason === 'cancelled' ? 'Este enlace de pago ha sido cancelado' :
          'Link de pago inválido o expirado'
        );
        setError(errorMsg);
        setPendingAuthorization(response.reason === 'pending_authorization');
        if (response.company_theme) {
          setValidation(response);
        }
      }
    } catch (err) {
      console.error('Error validating payment link:', err);
      setError('Error al validar el link de pago');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentProviders = async () => {
    try {
      setLoadingProviders(true);
      const url = token ? `/public/payment-providers?token=${encodeURIComponent(token)}` : '/public/payment-providers';
      const response = await apiClient.request(url, {
        method: 'GET',
      }) as { providers: PaymentProvider[] };

      setProviders(response.providers || []);
    } catch (err) {
      console.error('Error loading payment providers:', err);
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  };

  const handlePaymentInitiated = async (data: CheckoutData) => {
    setCheckoutData(data);
  };

  if (loading) {
    return (
      <PaymentShell theme={validation?.company_theme}>
        <PaymentLoading title="Preparando tu pago" description="Estamos validando tu enlace de pago." />
      </PaymentShell>
    );
  }

  if (error || !validation || !validation.valid) {
    return (
      <PaymentShell theme={validation?.company_theme}>
        <PaymentStatusCard
          tone={pendingAuthorization ? 'info' : 'danger'}
          eyebrow={pendingAuthorization ? 'Estado del pago' : 'Enlace no disponible'}
          title={pendingAuthorization ? 'Pago pendiente de autorización' : 'No pudimos abrir este pago'}
          description={error || 'Link de pago inválido'}
          actions={<StoreLinkButton variant="outline" />}
          footer={<PaymentSupport />}
        />
      </PaymentShell>
    );
  }

  // Si ya se inició el checkout, mostrar el form correspondiente
  if (checkoutData) {
    if (checkoutData.provider === 'bhd' && checkoutData.payload?.redirect_url) {
      window.location.href = checkoutData.payload.redirect_url;
      return (
        <PaymentShell theme={validation?.company_theme}>
          <PaymentRedirect providerKey="bhd" />
        </PaymentShell>
      );
    }

    if (checkoutData.provider === 'azul') {
      return (
        <PaymentShell theme={validation?.company_theme}>
          <AzulCheckoutForm
            checkoutUrl={checkoutData.checkout_url}
            payload={checkoutData.payload}
            orderNumber={`PAY-${token.slice(0, 8)}`}
          />
        </PaymentShell>
      );
    }

    if (checkoutData.provider === 'popular') {
      // Popular: Usar HTML auto-submit directo del backend (sin página intermedia)
      if (checkoutData.html_content) {

        // En lugar de usar dangerouslySetInnerHTML, crear un componente que haga auto-submit
        return <PopularAutoSubmit htmlContent={checkoutData.html_content} />;
      }

      // Si no hay HTML content, error
      return (
        <PaymentShell theme={validation?.company_theme}>
          <PaymentStatusCard
            tone="danger"
            eyebrow="Error"
            title="No pudimos conectar con Banco Popular"
            description="Error configurando el pago con Popular. Intenta de nuevo o elige otro método."
            footer={<PaymentSupport />}
          />
        </PaymentShell>
      );
    }
  }

  const amount = validation.amount || 0;
  const currency = validation.currency || 'DOP';
  const preview = selection?.preview?.shouldShow ? selection.preview : null;
  const totalToPay = preview ? preview.total : amount;

  const summary = (
    <div className="flex flex-col gap-5 rounded-lg border bg-card p-5 sm:p-8">
      <h2 className="font-display text-3xl font-medium leading-tight">Resumen</h2>
      <dl className="flex flex-col gap-3 text-sm">
        {validation.description && (
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted-foreground">Descripción</dt>
            <dd className="min-w-0 break-words text-right">{validation.description}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Monto</dt>
          <dd>{formatCurrency(amount, currency)}</dd>
        </div>
        {preview && selection && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {preview.feeType === 'discount' ? 'Descuento' : 'Cargo'} {selection.provider.display_name} ({preview.feePercentage}%)
            </dt>
            <dd className={cn('shrink-0', preview.feeType === 'discount' ? 'text-success' : 'text-warning')}>
              {preview.feeType === 'discount' ? '−' : '+'} {formatCurrency(preview.feeAmount, currency)}
            </dd>
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t pt-5">
          <dt className="text-sm font-semibold">Total a pagar</dt>
          <dd className="font-display text-4xl font-semibold leading-none">{formatCurrency(totalToPay, currency)}</dd>
        </div>
      </dl>
      <div className="flex gap-3 rounded-md bg-background p-4 text-[13px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.6} aria-hidden />
        <span>Los datos de tu tarjeta o cuenta se ingresan en el portal del banco. Nunca pasan por nuestra tienda.</span>
      </div>
    </div>
  );

  return (
    <PaymentShell theme={validation?.company_theme}>
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <section className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Pago en línea</span>
            <h1 className="font-display text-[2.6rem] font-medium leading-[1.02] sm:text-6xl">Completa tu pago</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Elige cómo quieres pagar. La autorización se hace en el portal seguro de tu banco.
            </p>
          </div>

          <div className="lg:hidden">{summary}</div>

          <PaymentMethodSelector
            providers={providers}
            totalAmount={amount}
            paymentLinkToken={token}
            onPaymentInitiated={handlePaymentInitiated}
            onPreviewChange={setSelection}
            isLoading={loadingProviders}
          />
        </section>

        <aside className="hidden flex-col gap-5 self-start lg:sticky lg:top-8 lg:flex">
          {summary}
          <PaymentSupport 
            className="justify-start" 
            phone={validation?.company_theme?.support_phone} 
          />
        </aside>
      </div>
      <PaymentSupport 
        className="mt-6 lg:hidden" 
        phone={validation?.company_theme?.support_phone} 
      />
    </PaymentShell>
  );
}
