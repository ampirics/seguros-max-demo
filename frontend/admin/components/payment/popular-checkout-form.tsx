'use client';

import { useEffect, useRef } from 'react';

interface PopularCheckoutFormProps {
  checkoutUrl: string;
  payload: Record<string, string>;
  orderNumber: string;
}

const PopularCheckoutForm = ({ checkoutUrl, payload, orderNumber }: PopularCheckoutFormProps) => {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Auto-submit inmediato sin mostrar nada
    if (formRef.current) {
      formRef.current.submit();
    }
  }, []);

  return (
    <>
      {/* Form oculto que se auto-submite inmediatamente */}
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
    </>
  );
};

export default PopularCheckoutForm;
