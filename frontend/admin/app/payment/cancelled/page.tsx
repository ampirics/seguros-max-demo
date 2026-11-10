"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Home, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { getPaymentPageConfig, processPaymentPageContent, PaymentPageData } from '@/lib/payment-pages';

export default function PaymentCancelledPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [pageConfig, setPageConfig] = useState<PaymentPageData | null>(null);

  useEffect(() => {
    const initializePage = async () => {
      try {
        // Para cancelled, no necesitamos validar con el backend
        // Solo cargar la configuración del CMS
        const companyId = undefined; // Por ahora sin company específica
        const config = await getPaymentPageConfig('cancelled', companyId);

        // Procesar contenido con variables si hay parámetros
        const orderNumber = searchParams?.get('OrderNumber');
        const amount = searchParams?.get('Amount');
        
        const processedConfig = {
          ...config,
          content: processPaymentPageContent(config.content, {
            order_number: orderNumber || '',
            amount: amount ? (parseInt(amount) / 100).toFixed(2) : '0.00'
          })
        };

        setPageConfig(processedConfig);
      } catch (error) {
        console.error('Error inicializando página:', error);
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [searchParams]);

  // Estado de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Loader2 className="animate-spin h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Cargando...</h1>
          <p className="text-gray-600">Por favor espere...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (!pageConfig) {
    return (
      <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-6 text-yellow-500" />
          <h1 className="text-3xl font-bold mb-4 text-yellow-800">Error</h1>
          <p className="text-gray-600 mb-6">No se pudo cargar la página de cancelación.</p>
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
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* CSS personalizado del CMS */}
        {pageConfig.custom_css && (
          <style dangerouslySetInnerHTML={{ __html: pageConfig.custom_css }} />
        )}

        {/* Contenido principal */}
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-6 text-yellow-500" />
          
          {/* Título desde el CMS */}
          <h1 className="text-3xl font-bold mb-4 text-yellow-800">
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
              <h3 className="font-semibold text-gray-800 mb-2">Detalles</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium">Número de Orden:</span> {searchParams.get('OrderNumber')}</p>
                {searchParams.get('Amount') && (
                  <p><span className="font-medium">Monto:</span> RD${(parseInt(searchParams.get('Amount')!) / 100).toFixed(2)}</p>
                )}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="space-y-3">
            <Link 
              href={pageConfig.button_url || '/'} 
              className="flex items-center justify-center w-full bg-yellow-600 text-white px-6 py-3 rounded-md hover:bg-yellow-700 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              {pageConfig.button_text || 'Volver a la Tienda'}
            </Link>
            
            <Link 
              href="/checkout" 
              className="flex items-center justify-center w-full bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/85 transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Intentar de Nuevo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}