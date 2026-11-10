"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Home, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getPaymentPageConfig, processPaymentPageContent, validatePayment, PaymentPageData } from '@/lib/payment-pages';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [pageConfig, setPageConfig] = useState<PaymentPageData | null>(null);

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

        // Validar que tenemos los parámetros necesarios
        if (!orderNumber || !authHash) {
          setValidationResult({ status: 'error', message: 'Parámetros de pago faltantes' });
          setLoading(false);
          return;
        }

        // Validar el pago con el backend
        const params = new URLSearchParams();
        searchParams.forEach((value, key) => {
          params.append(key, value);
        });

        const validationResult = await validatePayment(params);
        setValidationResult(validationResult);

        // Obtener configuración de la página desde el CMS
        // TODO: Obtener companyId del contexto o parámetros
        const companyId = undefined; // Por ahora sin company específica
        const config = await getPaymentPageConfig('approved', companyId);

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
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Loader2 className="animate-spin h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Validando Pago</h1>
          <p className="text-gray-600">Por favor espere mientras verificamos su transacción...</p>
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

  const isSuccess = validationResult?.status === 'approved';

  return (
    <div className={`min-h-screen ${isSuccess ? 'bg-green-50' : 'bg-red-50'} flex items-center justify-center`}>
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* CSS personalizado del CMS */}
        {pageConfig.custom_css && (
          <style dangerouslySetInnerHTML={{ __html: pageConfig.custom_css }} />
        )}

        {/* Contenido principal */}
        <div className="text-center">
          <CheckCircle className={`w-16 h-16 mx-auto mb-6 ${isSuccess ? 'text-green-500' : 'text-red-500'}`} />
          
          {/* Título desde el CMS */}
          <h1 className={`text-3xl font-bold mb-4 ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
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

          {/* Información adicional del pago */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">Detalles del Pago</h3>
            <div className="space-y-2 text-sm text-gray-600">
              {searchParams?.get('OrderNumber') && (
                <p><span className="font-medium">Número de Orden:</span> {searchParams.get('OrderNumber')}</p>
              )}
              {searchParams?.get('Amount') && (
                <p><span className="font-medium">Monto:</span> RD${(parseInt(searchParams.get('Amount')!) / 100).toFixed(2)}</p>
              )}
              {searchParams?.get('AuthorizationCode') && (
                <p><span className="font-medium">Código de Autorización:</span> {searchParams.get('AuthorizationCode')}</p>
              )}
              {searchParams?.get('ResponseMessage') && (
                <p><span className="font-medium">Estado:</span> {searchParams.get('ResponseMessage')}</p>
              )}
            </div>
          </div>

          {/* Estado de validación */}
          {validationResult?.message && (
            <div className={`p-3 rounded-md mb-6 ${
              isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {validationResult.message}
            </div>
          )}

          {/* Botón personalizable desde el CMS */}
          <div className="space-y-3">
            <Link 
              href={pageConfig.button_url || '/'} 
              className="flex items-center justify-center w-full bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/85 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              {pageConfig.button_text || 'Volver a la Tienda'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}