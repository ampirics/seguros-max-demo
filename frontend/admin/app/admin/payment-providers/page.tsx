"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Settings, CreditCard, Building2 } from 'lucide-react';
import { useAvailableProviders, usePaymentProviders } from '@/hooks/use-payment-providers';
import { EstadoProveedores } from '@/components/payment/EstadoProveedores';

export default function PaymentProvidersPage() {
  const router = useRouter();
  const { providers: configuredProviders, loading: configuredLoading, refetch } = usePaymentProviders();
  const { availableProviders, loading: availableLoading } = useAvailableProviders();

  const getProviderIcon = (category: string) => {
    switch (category) {
      case 'card':
        return <CreditCard className="h-5 w-5" />;
      case 'bank_transfer':
        return <Building2 className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const getProviderColor = (category: string) => {
    switch (category) {
      case 'card':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'bank_transfer':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isProviderConfigured = (providerKey: string) => {
    return configuredProviders.some(p => p.provider_key === providerKey);
  };

  const handleConfigureProvider = (providerKey: string) => {
    // Redirigir a la página de configuración específica del provider
    router.push(`/admin/payment-providers/configure?provider=${providerKey}`);
  };

  const handleEditProvider = (providerId: string, providerKey: string) => {
    router.push(`/admin/payment-providers/configure?mode=edit&id=${providerId}&provider=${providerKey}`);
  };

  return (
    <AdminLayout title="Proveedores de Pago">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Proveedores de Pago</h1>
          <p className="text-muted-foreground">
            Configura los métodos de pago disponibles para tu tienda
          </p>
        </div>

      <EstadoProveedores />

      <Tabs defaultValue="configured" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configured">Configurados</TabsTrigger>
          <TabsTrigger value="available">Disponibles</TabsTrigger>
        </TabsList>

        {/* Providers configurados */}
        <TabsContent value="configured" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Métodos de Pago Configurados</h2>
            <Button onClick={() => router.push('/admin/payment-providers/configure?provider=azul')}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Agregar Método de Pago
            </Button>
          </div>

          {configuredLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : configuredProviders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay métodos de pago configurados</h3>
                <p className="text-gray-600 mb-4">
                  Agrega tu primer método de pago para que los clientes puedan comprar en tu tienda
                </p>
                <Button onClick={() => router.push('/admin/payment-providers/configure?provider=azul')}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Configurar Primer Método
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {configuredProviders.map((provider) => (
                  <Card key={provider.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getProviderIcon(provider.category)}
                          <CardTitle className="text-lg">{provider.display_name}</CardTitle>
                        </div>
                        <Badge 
                          variant={provider.is_active ? "default" : "secondary"}
                        >
                          {provider.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <CardDescription>{provider.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Entorno:</span>
                          <Badge 
                            variant="outline" 
                            className={provider.environment === 'production' ? 
                              'bg-green-100 text-green-800 border-green-200' : 
                              'bg-yellow-100 text-yellow-800 border-yellow-200'
                            }
                          >
                            {provider.environment === 'production' ? 'Producción' : 'Prueba'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Tipo:</span>
                          <Badge 
                            variant="outline" 
                            className={getProviderColor(provider.category)}
                          >
                            {provider.category === 'card' ? 'Tarjetas' : 'Transferencia'}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1 text-sm">
                          <span className="text-gray-600 text-xs font-medium">Canales Activos:</span>
                          <div className="flex flex-wrap gap-1">
                            {provider.config?.enabled_for_store !== false && (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                🛒 Tienda
                              </Badge>
                            )}
                            {provider.config?.enabled_for_payment_links !== false && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                🔗 Links Pago
                              </Badge>
                            )}
                            {provider.config?.enabled_for_store === false && provider.config?.enabled_for_payment_links === false && (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">
                                Ninguno
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleEditProvider(provider.id, provider.provider_key)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configurar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Providers disponibles */}
        <TabsContent value="available" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Métodos de Pago Disponibles</h2>
            <p className="text-muted-foreground">
              Estos son los proveedores de pago que puedes configurar para tu tienda
            </p>
          </div>

          {availableLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableProviders.map((provider: any) => {
                const isConfigured = isProviderConfigured(provider.key);
                
                return (
                  <Card key={provider.key} className={isConfigured ? 'opacity-60' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        {getProviderIcon(provider.category)}
                        <CardTitle className="text-lg">{provider.display_name}</CardTitle>
                      </div>
                      <CardDescription>{provider.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Badge 
                          variant="outline" 
                          className={getProviderColor(provider.category)}
                        >
                          {provider.category === 'card' ? 'Procesamiento de tarjetas' : 'Transferencias bancarias'}
                        </Badge>

                        {isConfigured ? (
                          <Button variant="outline" size="sm" className="w-full" disabled>
                            Ya Configurado
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            className="w-full"
                            onClick={() => handleConfigureProvider(provider.key)}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Configurar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información Importante</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Configuración de Producción</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Asegúrate de tener las credenciales de producción</li>
                <li>• Prueba todos los flujos en ambiente sandbox primero</li>
                <li>• Configura las URLs de retorno correctas</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Soporte</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Azul: Procesamiento de tarjetas de crédito/débito</li>
                <li>• Botón Popular: Transferencias bancarias</li>
                <li>• BHD: Transferencias bancarias</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}
