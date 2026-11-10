'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CheckCircle2, ArrowLeft, Download } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';
import { STORE_SUPPORT_WHATSAPP } from '@/components/payment/payment-shell';

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const orderNumber = params?.order_number as string;

  // 🧹 Limpiar carrito cuando el cliente llega al recibo
  useEffect(() => {
    if (orderNumber) {
      clearCart();
    }
  }, [orderNumber, clearCart]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Pago Exitoso!</h1>
          <p className="text-gray-600">Tu transacción ha sido procesada correctamente</p>
        </div>

        {/* Receipt Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 px-8 py-6">
            <h2 className="text-2xl font-bold text-white">Recibo de Pago</h2>
            <p className="text-green-100 mt-1">Orden #{orderNumber}</p>
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-6">
            <div className="text-center py-8">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Pago Confirmado</h3>
              <p className="text-gray-600 mb-4">
                Tu pago ha sido procesado exitosamente por Banco Popular
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-800">
                  Recibirás un correo de confirmación con los detalles de tu orden.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Número de Orden</p>
                <p className="text-xl font-bold text-gray-900">{orderNumber}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-6 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => window.print()}
              className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="w-5 h-5 mr-2" />
              Imprimir
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-primary-foreground bg-primary hover:bg-primary/85 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver a la tienda
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            ¿Necesitas ayuda? Escríbenos por WhatsApp al {STORE_SUPPORT_WHATSAPP.label}
          </p>
        </div>
      </div>
    </div>
  );
}
