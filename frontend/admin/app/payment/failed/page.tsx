"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle, Home, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { getPaymentPageConfig, processPaymentPageContent, validatePayment, PaymentPageData } from '@/lib/payment-pages';

export default function PaymentFailedPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [pageConfig, setPageConfig] = useState<PaymentPageData | null>(null);

  // Obtener parámetros de Azul
  const orderNumber = searchParams?.get('OrderNumber');
  const amount = searchParams?.get('Amount');
  const responseMessage = searchParams?.get('ResponseMessage');
  const errorDescription = searchParams?.get('ErrorDescription');

  useEffect(() => {
    const initializePage = async () => {
      if (!searchParams) {
        setValidationResult({ status: 'error', message: 'Parámetros de pago faltantes' });
        setLoading(false);
        return;
      }

      try {
        // Obtener parámetros de Azul
        const orderNumber = searchParams.get('OrderNumber');
        const amount = searchParams.get('Amount');
        const authorizationCode = searchParams.get('AuthorizationCode');
        const responseMessage = searchParams.get('ResponseMessage');
        const authHash = searchParams.get('AuthHash');

        // Si tenemos parámetros de Azul, validar el pago
        if (orderNumber && authHash) {
          const params = new URLSearchParams();
          searchParams.forEach((value, key) => {
            params.append(key, value);
          });
          
          const validationResult = await validatePayment(params);
          setValidationResult(validationResult);
        } else {
          setValidationResult({ status: 'failed', message: 'Pago no completado' });
        }

        // Obtener configuración de la página desde el CMS
        const companyId = undefined; // Por ahora sin company específica
        const config = await getPaymentPageConfig('declined', companyId);

        // Procesar contenido con variables
        const processedConfig = {
          ...config,
          content: processPaymentPageContent(config.content, {
            order_number: orderNumber || '',
            amount: amount ? (parseInt(amount) / 100).toFixed(2) : '0.00',
            authorization_code: authorizationCode || '',
            response_message: responseMessage || ''
          })
        };

        setPageConfig(processedConfig);
      } catch (error) {
        console.error('Error inicializando página:', error);
        setValidationResult({ status: 'error', message: 'Error procesando el pago' });
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [searchParams]);

  // Estado de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Loader2 className="animate-spin h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Verificando Pago</h1>
          <p className="text-gray-600">Por favor espere...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (!pageConfig) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-6 text-red-500" />
          <h1 className="text-3xl font-bold mb-4 text-red-800">Error</h1>
          <p className="text-gray-600 mb-6">No se pudo cargar la página de confirmación.</p>
          <Link 
            href="/" 
            className="flex items-center justify-center w-full bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/85 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Volver a la Tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* CSS personalizado del CMS */}
        {pageConfig.custom_css && (
          <style dangerouslySetInnerHTML={{ __html: pageConfig.custom_css }} />
        )}

        {/* Contenido principal */}
        <div className="text-center">
          <XCircle className="w-16 h-16 mx-auto mb-6 text-red-500" />
          
          {/* Título desde el CMS */}
          <h1 className="text-3xl font-bold mb-4 text-red-800">
            {pageConfig.title}
          </h1>

          {/* Subtítulo desde el CMS */}
          {pageConfig.subtitle && (
            <p className="text-lg text-gray-600 mb-6">{pageConfig.subtitle}</p>
          )}

          {/* Contenido HTML personalizable desde el CMS */}
          <div 
            className="mb-6 text-gray-700"
            dangerouslySetInnerHTML={{ __html: pageConfig.content }} 
          />

          {/* Información del pago si está disponible */}
          {searchParams?.get('OrderNumber') && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Detalles del Pago</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium">Número de Orden:</span> {searchParams.get('OrderNumber')}</p>
                {searchParams.get('Amount') && (
                  <p><span className="font-medium">Monto:</span> RD${(parseInt(searchParams.get('Amount')!) / 100).toFixed(2)}</p>
                )}
                {searchParams.get('ResponseMessage') && (
                  <p><span className="font-medium">Estado:</span> {searchParams.get('ResponseMessage')}</p>
                )}
              </div>
            </div>
          )}

          {/* Estado de validación */}
          {validationResult?.message && (
            <div className="p-3 rounded-md mb-6 bg-red-100 text-red-800">
              {validationResult.message}
            </div>
          )}

          {/* Botones de acción */}
          <div className="space-y-3">
            <Link 
              href={pageConfig.button_url || '/checkout'} 
              className="flex items-center justify-center w-full bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {pageConfig.button_text || 'Intentar de Nuevo'}
            </Link>
            
            <Link 
              href="/" 
              className="flex items-center justify-center w-full bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Volver a la Tienda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}