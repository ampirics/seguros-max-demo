'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://dev.api.mgonzalez.com.do';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://dev.store.mgonzalez.com.do';

interface PopularMPOUT {
  CODRET: string;
  DESCRET: string;
  IDCOM: string;
  IDTRX: string;
  TOTAL: string;
  NROPAGOS: string;
  FECHATRX: string;
  FECHACONT: string;
  IDREG: string;
  NUMCOMP?: string;
}

export default function PopularCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Procesando tu pago...');

  useEffect(() => {
    // Esta página se carga cuando Popular hace POST con el formulario
    // Banco Popular envía los datos via POST form
    const handleFormSubmit = async () => {
      try {
        // Obtener datos del formulario enviado por Popular
        // Popular hace POST a esta URL con los datos en form-urlencoded
        
        // Los datos vienen en el query string si es GET redirect
        // o necesitamos interceptar el POST
        const urlParams = new URLSearchParams(window.location.search);
        const xmlData = urlParams.get('data');
        
        if (!xmlData) {
          // Si no hay datos en query, esta página debe tener un formulario oculto
          // que Popular llena y submite
          return;
        }

        
        // Parsear XML (simplificado - Popular envía estructura conocida)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
        
        const mpout = xmlDoc.querySelector('MPOUT');
        if (!mpout) {
          throw new Error('XML inválido');
        }

        const paymentData: PopularMPOUT = {
          CODRET: mpout.querySelector('CODRET')?.textContent || '',
          DESCRET: mpout.querySelector('DESCRET')?.textContent || '',
          IDCOM: mpout.querySelector('IDCOM')?.textContent || '',
          IDTRX: mpout.querySelector('IDTRX')?.textContent || '',
          TOTAL: mpout.querySelector('TOTAL')?.textContent || '0',
          NROPAGOS: mpout.querySelector('NROPAGOS')?.textContent || '1',
          FECHATRX: mpout.querySelector('FECHATRX')?.textContent || '',
          FECHACONT: mpout.querySelector('FECHACONT')?.textContent || '',
          IDREG: mpout.querySelector('IDREG')?.textContent || '',
          NUMCOMP: mpout.querySelector('NUMCOMP')?.textContent || undefined,
        };


        // Enviar al backend para procesar
        setMessage('Validando pago con el servidor...');
        
        const response = await fetch(`${BACKEND_URL}/api/v1/payments/popular/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Error procesando pago');
        }

        const result = await response.json();

        // Redirigir a página de resultado
        const redirectUrl = `${FRONTEND_URL}/payment/result/popular?` + new URLSearchParams({
          status: result.status || (paymentData.CODRET === '0000' ? 'success' : paymentData.CODRET === '0001' ? 'failed' : 'pending'),
          order_number: result.order_number || paymentData.IDTRX,
          transaction_id: result.transaction_id || paymentData.IDREG,
          amount: paymentData.TOTAL,
          message: result.message || paymentData.DESCRET,
          timestamp: Date.now().toString()
        }).toString();

        setStatus('success');
        setMessage('Pago procesado exitosamente. Redirigiendo...');
        
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1500);

      } catch (error: any) {
        console.error('❌ Error procesando callback:', error);
        setStatus('error');
        setMessage(error.message || 'Error procesando el pago');
        
        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    };

    handleFormSubmit();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md w-full bg-white shadow-2xl rounded-2xl p-8 text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Procesando tu pago
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Pago Exitoso!
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Error
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
