'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PaymentRedirect } from '@/components/payment/payment-redirect';

interface AzulCheckoutFormProps {
  checkoutUrl: string;
  payload: Record<string, string>;
  orderNumber: string;
}

const AzulCheckoutForm = ({ checkoutUrl, payload, orderNumber }: AzulCheckoutFormProps) => {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Auto-submit el form cuando el componente se monta
    if (formRef.current) {
      formRef.current.submit();
    }
  }, []);

  return (
    <PaymentRedirect providerKey="azul" orderNumber={orderNumber}>
      {/* Form oculto que se auto-submite */}
      <form
        ref={formRef}
        method="POST"
        action={checkoutUrl}
        style={{ display: 'none' }}
      >
        {Object.entries(payload).map(([key, value]) => (
          <input
            key={key}
            type="hidden"
            name={key}
            value={value}
          />
        ))}
      </form>

      {/* Form visible como fallback */}
      <form method="POST" action={checkoutUrl} className="flex w-full flex-col items-center gap-3">
        {Object.entries(payload).map(([key, value]) => (
          <input
            key={key}
            type="hidden"
            name={key}
            value={value}
          />
        ))}
        <p className="text-[13px] text-muted-foreground">Si no eres redirigido automáticamente:</p>
        <Button type="submit" variant="outline" size="lg" className="h-12 w-full max-w-xs">
          Continuar con Azul
        </Button>
      </form>
    </PaymentRedirect>
  );
};

export default AzulCheckoutForm;
