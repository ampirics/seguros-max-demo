'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CreditCard, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { usePaymentFees } from '@/hooks/usePaymentFees';
import { PROVIDER_BRANDS } from '@/components/payment/payment-providers';

export interface PaymentProvider {
  id: string;
  provider_key: string;
  display_name: string;
  description: string;
  category: 'card' | 'bank_transfer' | 'digital_wallet';
  environment: 'sandbox' | 'production';
  is_active: boolean;
  button_label?: string; // Etiqueta personalizada del botón
  fee?: {
    id: string;
    payment_method: string;
    fee_type: 'charge' | 'discount';
    fee_percentage: number;
    min_amount: number | null;
    max_amount: number | null;
    is_active: boolean;
    show_fee_calculation: boolean;
    description: string | null;
    apply_to?: 'subtotal' | 'total';
  };
}

export interface FeePreview {
  feeAmount: number;
  total: number;
  feePercentage: number;
  feeType: 'charge' | 'discount';
  shouldShow: boolean;
  feeDescription?: string | null;
  paymentMethod: string;
}

export interface PaymentSelection {
  provider: PaymentProvider;
  preview: FeePreview | null;
}

interface PaymentMethodSelectorProps {
  providers: PaymentProvider[];
  totalAmount: number;
  orderId?: number; // Opcional ahora
  cartItems?: any[]; // Para checkout directo desde carrito
  customerInfo?: any; // Para checkout directo desde carrito
  paymentLinkToken?: string; // Para payment links
  onPaymentInitiated: (checkoutData: any) => void;
  onPaymentMethodSelected?: (methodKey: string | null) => void;
  // Método elegido (antes de pagar) con su cargo/descuento, para mostrarlo en un resumen
  onPreviewChange?: (selection: PaymentSelection | null) => void;
  isLoading?: boolean;
}

const CATEGORY_LABELS: Record<PaymentProvider['category'], string> = {
  card: 'Tarjeta de crédito o débito',
  bank_transfer: 'Transferencia bancaria',
  digital_wallet: 'Billetera digital',
};

const PaymentMethodSelector = ({
  providers,
  totalAmount,
  orderId,
  cartItems,
  customerInfo,
  paymentLinkToken,
  onPaymentInitiated,
  onPaymentMethodSelected,
  onPreviewChange,
  isLoading = false
}: PaymentMethodSelectorProps) => {
  // chosenKey: método marcado en la lista. selectedProvider: método cuyo pago se está iniciando.
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const { fees, feesEnabled, calculateFeeForMethod, loading: feesLoading } = usePaymentFees();

  // Transferencias primero y luego tarjetas, como antes
  const orderedProviders = useMemo(() => [
    ...(providers || []).filter(p => p.category === 'bank_transfer'),
    ...(providers || []).filter(p => p.category === 'card'),
  ], [providers]);

  // Con un solo método disponible, dejarlo marcado; si el marcado desaparece, desmarcar
  useEffect(() => {
    if (orderedProviders.length === 1) {
      setChosenKey(orderedProviders[0].provider_key);
    } else if (chosenKey && !orderedProviders.some(p => p.provider_key === chosenKey)) {
      setChosenKey(null);
    }
  }, [orderedProviders, chosenKey]);

  // Calcular subtotal desde cartItems si existen
  const calculatedSubtotal = cartItems && cartItems.length > 0
    ? cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    : totalAmount / 1.18; // Aproximación si no hay items

  // Cargo o descuento que se mostrará para un método. Prioriza el fee que viene en el
  // provider (desde /public/payment-providers); solo las tarjetas caen al hook
  // usePaymentFees cuando el provider no trae fee.
  const getFeePreview = (provider: PaymentProvider): FeePreview | null => {
    const fee = provider.fee;
    if (fee) {
      if (!fee.is_active) return null;
      const applyTo = fee.apply_to || 'total';
      const baseAmount = applyTo === 'subtotal'
        ? calculatedSubtotal
        : totalAmount;

      const feeAmount = baseAmount * (fee.fee_percentage / 100);
      let finalTotal = totalAmount;

      if (applyTo === 'subtotal') {
        const subtotalAfterFee = fee.fee_type === 'charge'
          ? calculatedSubtotal + feeAmount
          : calculatedSubtotal - feeAmount;
        const newTax = subtotalAfterFee * 0.18;
        finalTotal = subtotalAfterFee + newTax;
      } else {
        finalTotal = fee.fee_type === 'charge'
          ? totalAmount + feeAmount
          : totalAmount - feeAmount;
      }

      return {
        feeAmount: Math.round(feeAmount * 100) / 100,
        total: Math.round(finalTotal * 100) / 100,
        feePercentage: fee.fee_percentage,
        feeType: fee.fee_type,
        shouldShow: fee.show_fee_calculation,
        feeDescription: fee.description,
        paymentMethod: provider.provider_key,
      };
    }
    if (provider.category === 'card' && feesEnabled) {
      return calculateFeeForMethod(provider.provider_key, totalAmount, calculatedSubtotal) as FeePreview | null;
    }
    return null;
  };

  const chosenProvider = orderedProviders.find(p => p.provider_key === chosenKey) || null;
  const chosenPreview = chosenProvider ? getFeePreview(chosenProvider) : null;

  useEffect(() => {
    if (!onPreviewChange) return;
    onPreviewChange(chosenProvider ? { provider: chosenProvider, preview: chosenPreview } : null);
    // chosenProvider/chosenPreview se derivan de estas dependencias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenKey, totalAmount, feesEnabled, fees, providers]);

  const handlePaymentSelection = async (providerKey: string) => {
    if (initiatingPayment) return;

    setSelectedProvider(providerKey);
    setInitError(null);
    // Emitir el método seleccionado
    onPaymentMethodSelected?.(providerKey);
    setInitiatingPayment(true);

    try {
      // 1. Calcular fee si existe para este método de pago
      let finalAmount = totalAmount;
      let feeInfo = null;

      if (!feesLoading && fees.length > 0) {
        const feeForMethod = fees.find(f =>
          f.payment_method === providerKey ||
          f.payment_method?.toLowerCase() === providerKey?.toLowerCase()
        );

        if (feeForMethod && feeForMethod.is_active) {
          // Calcular el fee basado en apply_to
          const applyTo = feeForMethod.apply_to || 'total';
          const baseAmount = applyTo === 'subtotal' && cartItems?.length
            ? cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            : totalAmount;

          const calculatedFee = baseAmount * (feeForMethod.fee_percentage / 100);
          finalAmount = feeForMethod.fee_type === 'charge'
            ? totalAmount + calculatedFee
            : totalAmount - calculatedFee;

          feeInfo = {
            fee_type: feeForMethod.fee_type,
            fee_percentage: feeForMethod.fee_percentage,
            fee_amount: calculatedFee,
            apply_to: applyTo,
          };
        }
      }

      let checkoutData: any;

      if (paymentLinkToken) {
        // Para payment links, usar el endpoint público específico
        const response = await apiClient.request(`/public/payment-links/checkout/${paymentLinkToken}?provider_key=${providerKey}`, {
          method: 'POST',
          body: feeInfo ? JSON.stringify({
            payment_fee: feeInfo,
            total: finalAmount
          }) : undefined,
          headers: feeInfo ? {
            'Content-Type': 'application/json'
          } : undefined
        });

        // Popular ahora devuelve JSON con html_content
        if (providerKey === 'popular' && response && typeof response === 'object' && 'html_content' in response) {
          checkoutData = response;
        } else {
          // Para otros proveedores, usar la respuesta como antes
          checkoutData = response;
        }
      } else if (orderId) {
        // Usar endpoint legacy si hay orden existente
        checkoutData = await apiClient.request(`/payments/checkout/${orderId}?provider_key=${providerKey}`, {
          method: 'POST',
        });
      } else {
        // Para payment links o checkout directo desde carrito
        if (cartItems && cartItems.length > 0) {
          // Usar endpoint nuevo con datos del carrito
          const requestBody = {
            cart_items: cartItems,
            customer_info: customerInfo || {
              name: "Cliente Temporal",
              email: "temp@example.com",
              phone: "809-000-0000"
            },
            total: finalAmount,  // Usar total con fee incluido
            currency: "DOP",
            // Incluir información del fee si existe
            ...(feeInfo && { payment_fee: feeInfo })
          };

          checkoutData = await apiClient.request(`/payments/checkout?provider_key=${providerKey}`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json'
            }
          });

          console.log('[PaymentMethodSelector] Checkout data recibida del backend:', {
            provider: checkoutData.provider,
            payloadKeys: checkoutData.payload ? Object.keys(checkoutData.payload) : [],
            hasRedirectUrl: !!checkoutData.payload?.redirect_url,
            redirectUrl: checkoutData.payload?.redirect_url?.substring(0, 100) + '...'
          });
        } else {
          // Para payment links sin carrito, simular datos de checkout
          checkoutData = {
            checkout_url: `https://checkout.${providerKey}.com/pay?amount=${finalAmount}&currency=DOP`,
            payload: {
              amount: finalAmount.toString(),
              currency: "DOP",
              provider: providerKey
            },
            provider: providerKey,
            order_id: null
          };
        }
      }

      onPaymentInitiated(checkoutData);
    } catch (error) {
      console.error('Error:', error);
      setInitError('No pudimos iniciar el pago. Por favor intenta de nuevo.');
    } finally {
      setInitiatingPayment(false);
      setSelectedProvider(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-lg border bg-card px-6 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
        Cargando métodos de pago…
      </div>
    );
  }

  if (orderedProviders.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-6 py-10 text-center">
        <p className="font-medium">No hay métodos de pago configurados</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacta al administrador para configurar los métodos de pago
        </p>
      </div>
    );
  }

  const chosenShowsFee = !!chosenPreview?.shouldShow;
  const chosenName = chosenProvider?.display_name;
  const payLabel = !chosenProvider
    ? 'Elige un método de pago'
    : chosenProvider.button_label
      ? chosenProvider.button_label
      : chosenPreview && !chosenShowsFee
        ? `Pagar con ${chosenName}`
        : `Pagar ${formatCurrency(chosenShowsFee ? chosenPreview!.total : totalAmount)} con ${chosenName}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span id="payment-methods-label" className="text-sm font-semibold">Método de pago</span>
        <div role="radiogroup" aria-labelledby="payment-methods-label" className="flex flex-col gap-3">
          {orderedProviders.map((provider) => {
            const preview = getFeePreview(provider);
            const showFee = !!preview?.shouldShow;
            const isDiscount = preview?.feeType === 'discount';
            const isChosen = chosenKey === provider.provider_key;
            const brand = PROVIDER_BRANDS[provider.provider_key];
            const feeBadge = showFee && preview && (
              <span className={cn(
                'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
                isDiscount ? 'bg-accent text-accent-foreground' : 'bg-warning-soft text-warning'
              )}>
                {isDiscount ? `${preview.feePercentage}% de descuento` : `Cargo de ${preview.feePercentage}%`}
              </span>
            );

            return (
              <button
                key={provider.id}
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={initiatingPayment}
                onClick={() => {
                  setChosenKey(provider.provider_key);
                  setInitError(null);
                }}
                className={cn(
                  'flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3.5 text-left transition-[border-color,box-shadow] sm:px-5 sm:py-4',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  isChosen
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'hover:border-input'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'order-last flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] sm:order-first',
                    isChosen ? 'border-primary' : 'border-input'
                  )}
                >
                  {isChosen && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>

                <span className="flex h-12 w-[72px] shrink-0 items-center justify-center rounded-lg border border-border/80 bg-white p-2 shadow-xs sm:h-14 sm:w-[88px] sm:p-2.5">
                  {brand ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        // Fallback si la imagen no carga
                        const img = e.target as HTMLImageElement;
                        img.src = '/placeholder-logo.png';
                      }}
                    />
                  ) : provider.category === 'bank_transfer' ? (
                    <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
                  ) : (
                    <CreditCard className="h-6 w-6 text-muted-foreground" aria-hidden />
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] font-semibold leading-tight">{provider.display_name}</span>
                  <span className="text-[13px] leading-snug text-muted-foreground">
                    {provider.description || CATEGORY_LABELS[provider.category]}
                  </span>
                  {provider.fee?.description && (
                    <span className="text-[13px] leading-snug text-accent-foreground">{provider.fee.description}</span>
                  )}
                  {feeBadge && <span className="mt-0.5 sm:hidden">{feeBadge}</span>}
                </span>

                <span className="hidden shrink-0 flex-col items-end gap-1.5 text-right sm:flex">
                  {feeBadge}
                  <span className="flex items-baseline gap-2">
                    {showFee && isDiscount && (
                      <span className="text-[13px] text-muted-foreground line-through">{formatCurrency(totalAmount)}</span>
                    )}
                    <span className="text-[15px] font-semibold">
                      {formatCurrency(showFee && preview ? preview.total : totalAmount)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-background/95 py-4 backdrop-blur sm:static sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
        {initError && (
          <p role="alert" className="rounded-md bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {initError}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          className="h-14 w-full gap-2.5 whitespace-normal text-base font-semibold"
          disabled={!chosenProvider || initiatingPayment}
          onClick={() => chosenProvider && handlePaymentSelection(chosenProvider.provider_key)}
        >
          {initiatingPayment && selectedProvider ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Conectando con {chosenName}…
            </>
          ) : (
            <>
              {chosenProvider && <Lock aria-hidden />}
              {payLabel}
            </>
          )}
        </Button>
        {chosenProvider && (
          <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
            {chosenProvider.category === 'card'
              ? `Te llevaremos a ${chosenName} para ingresar los datos de tu tarjeta y volverás aquí al terminar.`
              : `Te llevaremos a ${chosenName} para autorizar el pago y volverás aquí al terminar.`}
            {' '}Al continuar, aceptas los términos y condiciones de pago.
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
