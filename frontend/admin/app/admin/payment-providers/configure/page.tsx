"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, CreditCard, DollarSign } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'react-toastify';

interface AzulConfig {
  merchant_id: string;
  merchant_name: string;
  secret_key: string;
  base_url: string;
  approved_url?: string;
  declined_url?: string;
  cancelled_url?: string;
}

interface PopularConfig {
  convenio: string;  // CNV - ID del convenio
  secret_key: string;  // PSW - Clave secreta para HMAC-SHA512
  base_url?: string;
  environment?: 'sandbox' | 'production';
  test_mode?: boolean;
  approved_url?: string;
  declined_url?: string;
  cancelled_url?: string;
}

interface BHDConfig {
  provider_name: string;
  provider_id: string;
  service_id: string; 
  client_id: string;
  client_secret: string;
  base_url?: string;  // URL del frontend para redirecciones
  approved_url?: string;
  declined_url?: string;
  cancelled_url?: string;
  environment?: 'sandbox' | 'production';
}

type ConfigType = AzulConfig | PopularConfig | BHDConfig;

interface FormDataType {
  name: string;
  description: string;
  environment: 'sandbox' | 'production';
  is_active: boolean;
  enabled_for_store: boolean;
  enabled_for_payment_links: boolean;
  config: ConfigType;
  // Campos de Fee
  feeType?: 'charge' | 'discount';
  feePercentage?: number;
  applyTo?: 'subtotal' | 'total';  // NEW: subtotal o total (con impuestos)
  minAmount?: number | null;
  maxAmount?: number | null;
  showFeeCalculation?: boolean;
  feeDescription?: string | null;
}

export default function ConfigurePaymentProviderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Datos del formulario
  const [formData, setFormData] = useState<FormDataType>({
    name: '',
    description: '',
    environment: 'sandbox',
    is_active: true,
    enabled_for_store: true,
    enabled_for_payment_links: true,
    config: {
      merchant_id: '',
      merchant_name: '',
      secret_key: '',
      base_url: 'https://tu-dominio.com'
    } as ConfigType
  });

  const providerKey = searchParams?.get('provider') || 'azul';
  const isEdit = searchParams?.get('mode') === 'edit';
  const integrationId = searchParams?.get('id');

  // DEBUG: Log de parámetros recibidos
  useEffect(() => {
  }, [searchParams]);

  useEffect(() => {
    // Configurar valores por defecto según el provider
    if (providerKey === 'azul') {
      setFormData(prev => ({
        ...prev,
        name: prev.name || 'Azul - Procesamiento de Tarjetas',
        description: prev.description || 'Procesamiento de tarjetas de crédito y débito a través de Azul',
        config: {
          merchant_id: '',
          merchant_name: '',
          secret_key: '',
          base_url: 'https://tu-dominio.com'
        } as ConfigType
      }));
    } else if (providerKey === 'popular') {
      setFormData(prev => ({
        ...prev,
        name: prev.name || 'Banco Popular - MPINI',
        description: prev.description || 'Procesamiento de tarjetas de crédito y débito a través de Banco Popular',
        config: {
          convenio: '622',
          secret_key: '',
          base_url: '',
          environment: 'sandbox',
          test_mode: true
        } as ConfigType
      }));
    } else if (providerKey === 'bhd') {
      setFormData(prev => ({
        ...prev,
        name: prev.name || 'BHD León - Botón de Pago',
        description: prev.description || 'Procesamiento de pagos online vía BHD León',
        config: {
          provider_name: '',
          provider_id: '',
          service_id: '',
          client_id: '',
          client_secret: '',
          base_url: 'https://tu-dominio.com',  // URL del frontend para redirecciones
          environment: 'sandbox',
          approved_url: '',
          declined_url: '',
          cancelled_url: ''
        } as ConfigType
      }));
    }

    // Si es edición, cargar datos existentes
    if (isEdit && integrationId) {
      loadExistingIntegration();
    }
  }, [providerKey, isEdit, integrationId]);

  const loadExistingIntegration = async () => {
    setLoading(true);
    try {
      if (integrationId) {
        const data: any = await apiClient.getPaymentIntegration(integrationId);
        const cfg = (data.config || {}) as any;
        const enabledForStore = cfg.enabled_for_store !== false && (
          !cfg.channels || cfg.channels.includes('store') || cfg.channels.includes('all') || cfg.channels.includes('both')
        );
        const enabledForPaymentLinks = cfg.enabled_for_payment_links !== false && (
          !cfg.channels || cfg.channels.includes('payment_links') || cfg.channels.includes('all') || cfg.channels.includes('both')
        );
        setFormData(prev => ({
          ...prev,
          name: data.name,
          description: data.description || '',
          environment: data.environment,
          is_active: data.is_active,
          enabled_for_store: enabledForStore,
          enabled_for_payment_links: enabledForPaymentLinks,
          config: data.config || {}
        }));
        
        // Cargar configuración de fees si existe
        // AHORA PASAMOS integration_id para cargar el fee específico de esta integración
        if (providerKey) {
          try {
            const feeResponse = await apiClient.getPaymentMethodFee(providerKey, integrationId);
            if (feeResponse?.data) {
              // Si el fee está inactivo o el porcentaje es 0, tratarlo como "sin cargo"
              if (!feeResponse.data.is_active || feeResponse.data.fee_percentage === 0) {
                setFormData(prev => ({
                  ...prev,
                  feeType: undefined,  // "Sin cargo"
                  feePercentage: 0,
                  applyTo: 'total',
                  minAmount: null,
                  maxAmount: null,
                  showFeeCalculation: false,
                  feeDescription: null
                }));
              } else {
                // Hay un fee activo, cargar los valores
                setFormData(prev => ({
                  ...prev,
                  feeType: feeResponse.data.fee_type as 'charge' | 'discount',
                  feePercentage: feeResponse.data.fee_percentage,
                  applyTo: feeResponse.data.apply_to as 'subtotal' | 'total' ?? 'total',
                  minAmount: feeResponse.data.min_amount,
                  maxAmount: feeResponse.data.max_amount,
                  showFeeCalculation: feeResponse.data.show_fee_calculation ?? true,
                  feeDescription: feeResponse.data.description
                }));
              }
            }
          } catch (error) {
            console.error('Error loading fee config:', error);
            // No es crítico si no hay fee configurado
            // Dejar los valores por defecto (sin cargo)
          }
        }
      }
    } catch (error) {
      console.error('Error loading integration:', error);
      toast.error('Error al cargar la configuración de pago');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validación básica
      if (!formData.name.trim()) {
        toast.error('El nombre es requerido');
        return;
      }

      const channels = [
        ...(formData.enabled_for_store ? ['store'] : []),
        ...(formData.enabled_for_payment_links ? ['payment_links'] : [])
      ];

      const payload = {
        name: formData.name,
        description: formData.description,
        integration_type: 'payment_provider',
        provider_key: providerKey,
        environment: formData.environment,
        config: {
          ...(typeof formData.config === 'object' ? formData.config : {}),
          enabled_for_store: formData.enabled_for_store,
          enabled_for_payment_links: formData.enabled_for_payment_links,
          channels: channels
        },
        is_active: formData.is_active
      };


      let result;
      if (isEdit && integrationId) {
        result = await apiClient.updatePaymentIntegration(integrationId, payload);
        toast.success(`Proveedor ${providerKey} actualizado exitosamente`);
      } else {
        result = await apiClient.createPaymentIntegration(payload);
        toast.success(`Proveedor ${providerKey} configurado exitosamente`);
      }


      // Guardar configuración de fees (incluyendo "sin cargo")
      // CAMBIO: pasar integration_id al crear/actualizar fees
      const newIntegrationId = result.id || integrationId;  // Si es nuevo, usar el ID del resultado
      
      try {
        // Si se seleccionó "sin cargo", eliminar el fee existente
        if (!formData.feeType) {
          try {
            // Intentar eliminar el fee existente para esta integración específica
            const existingFee = await apiClient.getPaymentMethodFee(providerKey, newIntegrationId);
            if (existingFee?.data) {
              // Si existe un fee, eliminarlo sería ideal pero vamos a dejarlo inactivo
              await apiClient.updatePaymentMethodFee(providerKey, {
                payment_method: providerKey,
                integration_id: newIntegrationId,
                fee_type: 'charge',
                fee_percentage: 0,
                apply_to: 'total',
                min_amount: null,
                max_amount: null,
                show_fee_calculation: false,
                description: null,
                is_active: false  // Desactivar el fee
              }, newIntegrationId);
              toast.success('Fee desactivado correctamente');
            }
          } catch (error) {
            // Si no existe fee, no hay problema
          }
        } else if (formData.feeType && formData.feePercentage) {
          // Si hay fee configurado, guardarlo para esta integración específica
          const feePayload = {
            payment_method: providerKey,
            integration_id: newIntegrationId,  // NUEVO: incluir integration_id
            fee_type: formData.feeType,
            fee_percentage: formData.feePercentage,
            apply_to: formData.applyTo || 'total',
            min_amount: formData.minAmount || null,
            max_amount: formData.maxAmount || null,
            show_fee_calculation: formData.showFeeCalculation ?? true,
            description: formData.feeDescription || null,
            is_active: formData.is_active
          };
          // Verificar si existe fee anterior para esta integración
          try {
            const existingFee = await apiClient.getPaymentMethodFee(providerKey, newIntegrationId);
            
            if (existingFee?.data) {
              // Fee existe, actualizar
              await apiClient.updatePaymentMethodFee(providerKey, feePayload, newIntegrationId);
            } else {
              // No existe, crear
              await apiClient.createPaymentMethodFee(feePayload);
            }
          } catch (feeError) {
            // Si no existe, crear
            await apiClient.createPaymentMethodFee(feePayload);
          }

          toast.success('Configuración de fees actualizada');
        }
      } catch (feeError) {
        console.error('Error saving fees:', feeError);
        toast.warning('Proveedor guardado pero hubo error con configuración de fees');
      }

      router.push('/admin/payment-providers');
    } catch (error) {
      console.error('Error saving integration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al guardar la configuración: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      } as ConfigType
    }));
  };

  const getProviderTitle = () => {
    switch (providerKey) {
      case 'azul':
        return 'Configurar Azul';
      case 'popular':
        return 'Configurar Banco Popular';
      default:
        return 'Configurar Proveedor de Pago';
    }
  };

  if (loading) {
    return (
      <AdminLayout title={getProviderTitle()}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2">Cargando configuración...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={getProviderTitle()}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/payment-providers')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{getProviderTitle()}</h1>
              <p className="text-muted-foreground">
                {isEdit ? 'Editar configuración existente' : 'Nueva configuración de pago'}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuración General */}
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
              <CardDescription>
                Configuración básica del proveedor de pago
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre descriptivo del método de pago"
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del método de pago"
                />
              </div>

              <div>
                <Label htmlFor="environment">Entorno</Label>
                <Select
                  value={formData.environment}
                  onValueChange={(value: 'sandbox' | 'production') => 
                    setFormData(prev => ({ ...prev, environment: value }))
                  }
                >
                  <SelectTrigger id="environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Pruebas (Sandbox)</SelectItem>
                    <SelectItem value="production">Producción</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor="is_active">Proveedor activo</Label>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label className="text-base font-semibold">Canales de Disponibilidad</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define en qué canales de venta se mostrará y procesará este medio de pago.
                  </p>
                </div>
                <div className="grid gap-3 pt-1">
                  <div className="flex items-center justify-between rounded-lg border p-3.5 bg-background shadow-xs">
                    <div className="space-y-0.5">
                      <Label htmlFor="enabled_for_store" className="text-sm font-medium flex items-center gap-2">
                        🛒 Tienda Online (Ecommerce)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Disponible para clientes que compran directamente en la tienda web.
                      </p>
                    </div>
                    <Switch
                      id="enabled_for_store"
                      checked={formData.enabled_for_store}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, enabled_for_store: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3.5 bg-background shadow-xs">
                    <div className="space-y-0.5">
                      <Label htmlFor="enabled_for_payment_links" className="text-sm font-medium flex items-center gap-2">
                        🔗 Enlaces de Pago (WhatsApp / Directos)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Disponible cuando se genera y envía un enlace de pago al cliente.
                      </p>
                    </div>
                    <Switch
                      id="enabled_for_payment_links"
                      checked={formData.enabled_for_payment_links}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, enabled_for_payment_links: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuración específica de Azul */}
          {providerKey === 'azul' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Configuración de Azul
                </CardTitle>
                <CardDescription>
                  Credenciales y configuración específica de Azul
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="merchant_id">Merchant ID</Label>
                  <Input
                    id="merchant_id"
                    value={(formData.config as AzulConfig)?.merchant_id || ''}
                    onChange={(e) => updateConfig('merchant_id', e.target.value)}
                    placeholder="ID del comercio en Azul"
                  />
                </div>

                <div>
                  <Label htmlFor="merchant_name">Merchant Name</Label>
                  <Input
                    id="merchant_name"
                    value={(formData.config as AzulConfig)?.merchant_name || ''}
                    onChange={(e) => updateConfig('merchant_name', e.target.value)}
                    placeholder="Nombre del comercio"
                  />
                </div>

                <div>
                  <Label htmlFor="secret_key">Secret Key</Label>
                  <Input
                    id="secret_key"
                    type="password"
                    value={(formData.config as AzulConfig)?.secret_key || ''}
                    onChange={(e) => updateConfig('secret_key', e.target.value)}
                    placeholder="Clave secreta de Azul"
                  />
                </div>

                <div>
                  <Label htmlFor="base_url">URL Base</Label>
                  <Input
                    id="base_url"
                    value={(formData.config as AzulConfig)?.base_url || ''}
                    onChange={(e) => updateConfig('base_url', e.target.value)}
                    placeholder="https://tu-dominio.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL base para callbacks de Azul
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuración específica de Popular */}
          {providerKey === 'popular' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Configuración de Banco Popular
                </CardTitle>
                <CardDescription>
                  Credenciales y configuración MPINI para Banco Popular
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="convenio">Convenio (CNV)</Label>
                  <Input
                    id="convenio"
                    value={(formData.config as PopularConfig)?.convenio || ''}
                    onChange={(e) => updateConfig('convenio', e.target.value)}
                    placeholder="Ej: 622 (para testing)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ID del convenio asignado por Banco Popular
                  </p>
                </div>

                <div>
                  <Label htmlFor="popular_secret_key">Clave Secreta (PSW)</Label>
                  <Input
                    id="popular_secret_key"
                    type="password"
                    value={(formData.config as PopularConfig)?.secret_key || ''}
                    onChange={(e) => updateConfig('secret_key', e.target.value)}
                    placeholder="Clave secreta para firmar MPINI"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Clave secreta proporcionada por Popular para firmar mensajes MPINI
                  </p>
                </div>

                <div>
                  <Label htmlFor="popular_base_url">URL Base</Label>
                  <Input
                    id="popular_base_url"
                    value={(formData.config as PopularConfig)?.base_url || ''}
                    onChange={(e) => updateConfig('base_url', e.target.value)}
                    placeholder="http://localhost:8000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL base de tu sistema para URLs de retorno
                  </p>
                </div>

                <div>
                  <Label htmlFor="popular_environment">Ambiente</Label>
                  <Select
                    value={(formData.config as PopularConfig)?.environment || 'sandbox'}
                    onValueChange={(value) => updateConfig('environment', value)}
                  >
                    <SelectTrigger id="popular_environment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">QA/Pruebas (pruebaboton.bpd.com.do:8080)</SelectItem>
                      <SelectItem value="production">Producción (boton.bpd.com.do)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="popular_test_mode"
                    checked={(formData.config as PopularConfig)?.test_mode !== false}
                    onCheckedChange={(checked) => updateConfig('test_mode', checked)}
                  />
                  <Label htmlFor="popular_test_mode">Modo de prueba</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuración específica de BHD */}
          {providerKey === 'bhd' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Configuración de BHD León
                </CardTitle>
                <CardDescription>
                  Credenciales para Botón de Pago BHD León
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Provider ID */}
                <div>
                  <Label htmlFor="bhd_provider_id">Proveedor ID</Label>
                  <Input
                    id="bhd_provider_id"
                    value={(formData.config as unknown as BHDConfig)?.provider_id || ''}
                    onChange={(e) => updateConfig('provider_id', e.target.value)}
                    placeholder="Ej: 90909321"
                  />
                </div>

                {/* Service ID */}
                <div>
                  <Label htmlFor="bhd_service_id">Servicio ID</Label>
                  <Input
                    id="bhd_service_id"
                    value={(formData.config as unknown as BHDConfig)?.service_id || ''}
                    onChange={(e) => updateConfig('service_id', e.target.value)}
                    placeholder="Ej: 123457112"
                  />
                </div>

                {/* Client ID */}
                <div>
                  <Label htmlFor="bhd_client_id">Client ID</Label>
                  <Input
                    id="bhd_client_id"
                    value={(formData.config as unknown as BHDConfig)?.client_id || ''}
                    onChange={(e) => updateConfig('client_id', e.target.value)}
                    placeholder="UUID del cliente"
                  />
                </div>

                {/* Client Secret */}
                <div>
                  <Label htmlFor="bhd_client_secret">Client Secret</Label>
                  <Input
                    id="bhd_client_secret"
                    type="password"
                    value={(formData.config as unknown as BHDConfig)?.client_secret || ''}
                    onChange={(e) => updateConfig('client_secret', e.target.value)}
                    placeholder="Secret proporcionado por BHD"
                  />
                </div>

                {/* Provider Name */}
                <div>
                  <Label htmlFor="bhd_provider_name">Nombre del Proveedor</Label>
                  <Input
                    id="bhd_provider_name"
                    value={(formData.config as unknown as BHDConfig)?.provider_name || ''}
                    onChange={(e) => updateConfig('provider_name', e.target.value)}
                    placeholder="Ej: REPUESTOS LA CASA DEL COLT SRL"
                  />
                </div>

                {/* Environment */}
                <div>
                  <Label htmlFor="bhd_environment">Ambiente</Label>
                  <Select
                    value={(formData.config as unknown as BHDConfig)?.environment || 'sandbox'}
                    onValueChange={(value) => updateConfig('environment', value)}
                  >
                    <SelectTrigger id="bhd_environment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Pruebas (Sandbox)</SelectItem>
                      <SelectItem value="production">Producción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Base URL for frontend redirects */}
                <div>
                  <Label htmlFor="bhd_base_url">URL Base del Frontend</Label>
                  <Input
                    id="bhd_base_url"
                    value={(formData.config as unknown as BHDConfig)?.base_url || ''}
                    onChange={(e) => updateConfig('base_url', e.target.value)}
                    placeholder="https://tu-dominio.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL del frontend donde se redirigirá al usuario después del pago (ej: https://tu-dominio.com)
                  </p>
                </div>

                {/* URLs de Retorno para BHD */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">URLs de Retorno</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="bhd_approved">Approved URL</Label>
                      <Input
                        id="bhd_approved"
                        value={(formData.config as unknown as BHDConfig)?.approved_url || ''}
                        onChange={(e) => updateConfig('approved_url', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bhd_declined">Declined URL</Label>
                      <Input
                        id="bhd_declined"
                        value={(formData.config as unknown as BHDConfig)?.declined_url || ''}
                        onChange={(e) => updateConfig('declined_url', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bhd_cancelled">Cancelled URL</Label>
                      <Input
                        id="bhd_cancelled"
                        value={(formData.config as unknown as BHDConfig)?.cancelled_url || ''}
                        onChange={(e) => updateConfig('cancelled_url', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          {/* URLs de Retorno específicas para Azul */}
          {providerKey === 'azul' && (
            <Card>
              <CardHeader>
                <CardTitle>Información de Configuración</CardTitle>
                <CardDescription>
                  URLs de retorno para diferentes estados del pago
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="approved_url">Approved</Label>
                  <Input
                    id="approved_url"
                    value={formData.config.approved_url || ''}
                    onChange={(e) => updateConfig('approved_url', e.target.value)}
                    placeholder="https://api.tu-dominio.com/api/v1/payments/azul/return"
                  />
                </div>

                <div>
                  <Label htmlFor="declined_url">Declined</Label>
                  <Input
                    id="declined_url"
                    value={formData.config.declined_url || ''}
                    onChange={(e) => updateConfig('declined_url', e.target.value)}
                    placeholder="https://api.tu-dominio.com/api/v1/payments/azul/return"
                  />
                </div>

                <div>
                  <Label htmlFor="cancelled_url">Cancel</Label>
                  <Input
                    id="cancelled_url"
                    value={formData.config.cancelled_url || ''}
                    onChange={(e) => updateConfig('cancelled_url', e.target.value)}
                    placeholder="https://api.tu-dominio.com/api/v1/payments/azul/return"
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-md">
                  <h4 className="font-medium mb-2 text-blue-900">Configuración en Azul</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Configura estas URLs en tu panel de Azul</li>
                    <li>• Asegúrate de usar el entorno correcto</li>
                    <li>• Prueba en sandbox antes de producción</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuración de Fees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Configuración de Cargos/Descuentos
              </CardTitle>
              <CardDescription>
                Aplica cargos (%) o descuentos por este método de pago
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fee Type */}
              <div>
                <Label htmlFor="fee_type">Tipo de Fee</Label>
                <Select
                  value={formData.feeType || 'none'}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    feeType: value === 'none' ? undefined : value as 'charge' | 'discount'
                  }))}
                >
                  <SelectTrigger id="fee_type">
                    <SelectValue placeholder="Selecciona una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cargo/descuento</SelectItem>
                    <SelectItem value="charge">Cargo adicional (+)</SelectItem>
                    <SelectItem value="discount">Descuento (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fee Percentage */}
              {formData.feeType && (
                <>
                  <div>
                    <Label htmlFor="fee_percentage">Porcentaje</Label>
                    <div className="flex gap-2">
                      <Input
                        id="fee_percentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="99.99"
                        value={formData.feePercentage || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          feePercentage: e.target.value ? parseFloat(e.target.value) : undefined
                        }))}
                        placeholder="5.00"
                      />
                      <span className="flex items-center text-gray-500">%</span>
                    </div>
                  </div>

                  {/* Apply To: Subtotal o Total */}
                  <div>
                    <Label htmlFor="apply_to">Aplicar a:</Label>
                    <Select
                      value={formData.applyTo || 'total'}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        applyTo: value as 'subtotal' | 'total'
                      }))}
                    >
                      <SelectTrigger id="apply_to">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subtotal">
                          Subtotal (solo productos)
                        </SelectItem>
                        <SelectItem value="total">
                          Total (subtotal + impuestos)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.applyTo === 'subtotal' 
                        ? 'El descuento/cargo se aplica solo al subtotal de productos' 
                        : 'El descuento/cargo se aplica al total incluyendo impuestos'}
                    </p>
                  </div>

                  {/* Preview de Cálculo - Subtotal y Total */}
                  {formData.feePercentage && (
                    <div className="space-y-3">
                      {/* Opción 1: Aplicar a Subtotal */}
                      <div className={`p-3 rounded-md space-y-2 ${formData.applyTo === 'subtotal' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                        <h4 className="font-medium text-sm">
                          Cálculo sobre SUBTOTAL {formData.applyTo === 'subtotal' && '✓ SELECCIONADO'}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Subtotal:</div>
                          <div className="text-right">RD$ 1,000.00</div>
                          <div className={formData.feeType === 'charge' ? 'text-red-600' : 'text-green-600'}>
                            {formData.feeType === 'charge' ? '+' : '-'} Fee ({formData.feePercentage}% de subtotal):
                          </div>
                          <div className={`text-right ${formData.feeType === 'charge' ? 'text-red-600' : 'text-green-600'}`}>
                            RD$ {(1000 * (formData.feePercentage / 100)).toFixed(2)}
                          </div>
                          <div>Sub:</div>
                          <div className="text-right">
                            RD$ {(formData.feeType === 'charge' 
                              ? (1000 + (1000 * (formData.feePercentage / 100)))
                              : (1000 - (1000 * (formData.feePercentage / 100)))
                            ).toFixed(2)}
                          </div>
                          <div>Impuesto (18%):</div>
                          <div className="text-right">
                            RD$ {((formData.feeType === 'charge' 
                              ? (1000 + (1000 * (formData.feePercentage / 100)))
                              : (1000 - (1000 * (formData.feePercentage / 100)))
                            ) * 0.18).toFixed(2)}
                          </div>
                          <div className="border-t pt-1 font-bold">TOTAL FINAL:</div>
                          <div className="border-t pt-1 text-right font-bold">
                            RD$ {(
                              (formData.feeType === 'charge' 
                                ? (1000 + (1000 * (formData.feePercentage / 100)))
                                : (1000 - (1000 * (formData.feePercentage / 100)))
                              ) + 
                              ((formData.feeType === 'charge' 
                                ? (1000 + (1000 * (formData.feePercentage / 100)))
                                : (1000 - (1000 * (formData.feePercentage / 100)))
                              ) * 0.18)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Opción 2: Aplicar a Total */}
                      <div className={`p-3 rounded-md space-y-2 ${formData.applyTo === 'total' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                        <h4 className="font-medium text-sm">
                          Cálculo sobre TOTAL (con impuestos) {formData.applyTo === 'total' && '✓ SELECCIONADO'}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Subtotal:</div>
                          <div className="text-right">RD$ 1,000.00</div>
                          <div>Impuesto (18%):</div>
                          <div className="text-right">RD$ 180.00</div>
                          <div className="border-t pt-1">Subtotal + Impuesto:</div>
                          <div className="border-t pt-1 text-right">RD$ 1,180.00</div>
                          <div className={formData.feeType === 'charge' ? 'text-red-600' : 'text-green-600'}>
                            {formData.feeType === 'charge' ? '+' : '-'} Fee ({formData.feePercentage}% del total):
                          </div>
                          <div className={`text-right ${formData.feeType === 'charge' ? 'text-red-600' : 'text-green-600'}`}>
                            RD$ {(1180 * (formData.feePercentage / 100)).toFixed(2)}
                          </div>
                          <div className="border-t pt-1 font-bold">TOTAL FINAL:</div>
                          <div className="border-t pt-1 text-right font-bold">
                            RD$ {(formData.feeType === 'charge' 
                              ? (1180 * (1 + (formData.feePercentage / 100)))
                              : (1180 * (1 - (formData.feePercentage / 100)))
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Min/Max Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="min_amount">Monto Mínimo (Opcional)</Label>
                      <Input
                        id="min_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.minAmount || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          minAmount: e.target.value ? parseFloat(e.target.value) : undefined
                        }))}
                        placeholder="100.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_amount">Monto Máximo (Opcional)</Label>
                      <Input
                        id="max_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.maxAmount || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          maxAmount: e.target.value ? parseFloat(e.target.value) : undefined
                        }))}
                        placeholder="10000.00"
                      />
                    </div>
                  </div>

                  {/* Show Fee Description */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show_fee"
                      checked={formData.showFeeCalculation ?? true}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        showFeeCalculation: checked
                      }))}
                    />
                    <Label htmlFor="show_fee">Mostrar descripción en el checkout</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Si está habilitado, se mostrará la descripción del fee en la página de checkout
                  </p>

                  {/* Description */}
                  <div>
                    <Label htmlFor="fee_description">Descripción (Opcional)</Label>
                    <Input
                      id="fee_description"
                      value={formData.feeDescription || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        feeDescription: e.target.value
                      }))}
                      placeholder="Ej: Cargo por procesamiento de tarjeta"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Información de ayuda */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Configuración</CardTitle>
          </CardHeader>
          <CardContent>
            {providerKey === 'azul' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">URLs de Retorno</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Approved: {(formData.config as AzulConfig)?.base_url}/api/payments/azul/return</li>
                    <li>• Declined: {(formData.config as AzulConfig)?.base_url}/api/payments/azul/return</li>
                    <li>• Cancel: {(formData.config as AzulConfig)?.base_url}/api/payments/azul/return</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Configuración en Azul</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Configura estas URLs en tu panel de Azul</li>
                    <li>• Asegúrate de usar el entorno correcto</li>
                    <li>• Prueba en sandbox antes de producción</li>
                  </ul>
                </div>
              </div>
            )}
            {providerKey === 'popular' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Configuración MPINI</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• <strong>CNV:</strong> {(formData.config as PopularConfig)?.convenio}</li>
                    <li>• <strong>Ambiente:</strong> {(formData.config as PopularConfig)?.environment === 'production' ? 'Producción' : 'QA/Pruebas'}</li>
                    <li>• <strong>Modo Test:</strong> {(formData.config as PopularConfig)?.test_mode !== false ? 'Habilitado' : 'Deshabilitado'}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Endpoints de Popular</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {(formData.config as PopularConfig)?.environment === 'production' ? (
                      <>
                        <li>• <strong>Producción:</strong> boton.bpd.com.do</li>
                        <li>• Se usa para transacciones en vivo</li>
                      </>
                    ) : (
                      <>
                        <li>• <strong>QA:</strong> pruebaboton.bpd.com.do:8080</li>
                        <li>• Se usa para pruebas y testing</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
