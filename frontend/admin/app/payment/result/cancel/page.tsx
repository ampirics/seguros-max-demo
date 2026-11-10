'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/contexts/cart-context';
import { apiClient } from '@/lib/api-client';
import { PaymentShell } from '@/components/payment/payment-shell';
import {
  PaymentNote,
  PaymentStatusCard,
  PaymentSupport,
  StoreLinkButton,
} from '@/components/payment/payment-status';
import type { CompanyTheme } from '@/lib/payment-links-types';

export const dynamic = 'force-dynamic';

export default function PaymentCancelPage() {
  const { clearCart } = useCart();
  const [theme, setTheme] = useState<CompanyTheme | null>(null);

  useEffect(() => {
    apiClient.getStoreConfig().then((res: any) => {
      const cfg = res?.data || res;
      if (cfg) {
        const themeCfg = cfg?.theme || {};
        setTheme({
          name: cfg?.store_name || cfg?.name || "Tienda",
          logo_url: themeCfg?.logo_url || cfg?.logo_url,
          primary_color: themeCfg?.primary_color || themeCfg?.primary || "#0056B3",
          accent_color: themeCfg?.accent_color || themeCfg?.accent || "#FFC107",
          background: themeCfg?.background_color || themeCfg?.background || cfg?.background,
          background_color: themeCfg?.background_color || themeCfg?.background || cfg?.background,
          support_phone: cfg?.whatsapp_phone || cfg?.support_phone || "809-830-1176",
          support_email: cfg?.support_email || cfg?.email,
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <PaymentShell theme={theme}>
      <PaymentStatusCard
        tone="neutral"
        eyebrow="Cancelado"
        title="Pago cancelado"
        description="La transacción no fue completada. No se realizó ningún cargo en tu tarjeta o cuenta."
        actions={<StoreLinkButton label="Volver a la tienda" />}
        footer={<PaymentSupport phone={theme?.support_phone} />}
      >
        <PaymentNote tone="neutral">
          <strong>¿Qué pasó?</strong>
          <p className="mt-1">
            La ventana de pago fue cerrada o la transacción fue cancelada antes de finalizarla. Puedes intentarlo nuevamente cuando desees.
          </p>
        </PaymentNote>
      </PaymentStatusCard>
    </PaymentShell>
  );
}
