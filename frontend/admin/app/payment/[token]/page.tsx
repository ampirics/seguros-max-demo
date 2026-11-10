import { Metadata } from 'next';
import PaymentPage from '@/components/payment-links/payment-page';

interface PaymentLinkPageProps {
  // En esta versión de Next params es una Promise: leer params.token sin await
  // daba undefined y la página de pago cargaba sin token.
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: 'Procesar Pago',
  description: 'Completa tu pago de forma segura',
};

export default async function PaymentLinkPage({ params }: PaymentLinkPageProps) {
  const { token } = await params;
  return <PaymentPage token={token} />;
}
