"use client";

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertCircle, Save, Eye, Monitor } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '@/lib/api-client';

interface PaymentPageData {
  page_type: string;
  title: string;
  subtitle: string;
  content: string;
  button_text: string;
  button_url: string;
  custom_css: string;
  is_active: boolean;
}

const initialData: Record<string, PaymentPageData> = {
  approved: {
    page_type: 'approved',
    title: '¡Pago Exitoso!',
    subtitle: 'Tu pago ha sido procesado correctamente',
    content: `<div class="text-center">
      <h2>¡Gracias por tu compra!</h2>
      <p>Tu pago ha sido procesado exitosamente. Recibirás un email de confirmación en los próximos minutos.</p>
      <p>Número de confirmación: #{{order_number}}</p>
    </div>`,
    button_text: 'Volver a la tienda',
    button_url: '/',
    custom_css: '.payment-success { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); }',
    is_active: true
  },
  declined: {
    page_type: 'declined',
    title: 'Pago Declinado',
    subtitle: 'Tu pago no pudo ser procesado',
    content: `<div class="text-center">
      <h2>Pago no procesado</h2>
      <p>Tu pago no pudo ser completado. Por favor verifica tus datos de pago e intenta nuevamente.</p>
      <p>Si el problema persiste, contacta con soporte.</p>
    </div>`,
    button_text: 'Intentar de nuevo',
    button_url: '/checkout',
    custom_css: '.payment-error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }',
    is_active: true
  },
  cancelled: {
    page_type: 'cancelled',
    title: 'Pago Cancelado',
    subtitle: 'Has cancelado el proceso de pago',
    content: `<div class="text-center">
      <h2>Pago cancelado</h2>
      <p>Has cancelado el proceso de pago. Tu orden no ha sido procesada.</p>
      <p>Puedes intentar de nuevo cuando gustes o continuar navegando en nuestra tienda.</p>
    </div>`,
    button_text: 'Volver a la tienda',
    button_url: '/',
    custom_css: '.payment-cancelled { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }',
    is_active: true
  }
};

export default function PaymentPagesAdmin() {
  const [pages, setPages] = useState(initialData);
  const [activeTab, setActiveTab] = useState('approved');
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Cargar datos desde el backend al iniciar
  useEffect(() => {
    const loadPaymentPages = async () => {
      try {
        // Cargar cada tipo de página
        for (const pageType of ['approved', 'declined', 'cancelled']) {
          try {
            const pageData = await apiClient.getPaymentPage(pageType);
            setPages(prev => ({
              ...prev,
              [pageType]: {
                ...prev[pageType],
                ...pageData
              }
            }));
          } catch (error) {
            // Si no existe, mantener los valores por defecto
          }
        }
      } catch (error) {
        console.error('Error loading payment pages:', error);
      }
    };

    loadPaymentPages();
  }, []);

  const pageIcons = {
    approved: <CheckCircle className="h-5 w-5 text-green-600" />,
    declined: <XCircle className="h-5 w-5 text-red-600" />,
    cancelled: <AlertCircle className="h-5 w-5 text-orange-600" />
  };

  const pageColors = {
    approved: 'bg-green-100 text-green-800 border-green-200',
    declined: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-orange-100 text-orange-800 border-orange-200'
  };

  const handleInputChange = (pageType: string, field: string, value: string | boolean) => {
    setPages(prev => ({
      ...prev,
      [pageType]: {
        ...prev[pageType],
        [field]: value
      }
    }));
  };

  const handleSave = async (pageType: string) => {
    setLoading(true);
    try {
      await apiClient.savePaymentPage(pageType, pages[pageType]);
      toast.success(`Página de "${getPageDisplayName(pageType)}" guardada exitosamente`);
    } catch (error) {
      console.error('Error saving payment page:', error);
      toast.error('Error al guardar la página');
    } finally {
      setLoading(false);
    }
  };

  const getPageDisplayName = (pageType: string) => {
    const names = {
      approved: 'Pago Exitoso',
      declined: 'Pago Declinado',
      cancelled: 'Pago Cancelado'
    };
    return names[pageType as keyof typeof names] || pageType;
  };

  const renderPreview = (pageData: PaymentPageData) => (
    <div className="border rounded-lg p-6 bg-white min-h-[400px]">
      <style dangerouslySetInnerHTML={{ __html: pageData.custom_css }} />
      <div className="text-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{pageData.title}</h1>
          {pageData.subtitle && (
            <p className="text-xl text-gray-600">{pageData.subtitle}</p>
          )}
        </div>
        
        <div 
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: pageData.content }}
        />
        
        {pageData.button_text && (
          <div className="pt-4">
            <button className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/85 transition-colors">
              {pageData.button_text}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout title="Páginas de Pago">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Páginas de Pago</h1>
          <p className="text-muted-foreground">
            Personaliza las páginas que ven los clientes después de realizar un pago
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            {Object.keys(pages).map((pageType) => (
              <TabsTrigger 
                key={pageType} 
                value={pageType}
                className="flex items-center space-x-2"
              >
                {pageIcons[pageType as keyof typeof pageIcons]}
                <span>{getPageDisplayName(pageType)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(pages).map(([pageType, pageData]) => (
            <TabsContent key={pageType} value={pageType} className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Editor */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          {pageIcons[pageType as keyof typeof pageIcons]}
                          <span>Configurar {getPageDisplayName(pageType)}</span>
                        </CardTitle>
                        <CardDescription>
                          Personaliza el contenido y diseño de esta página
                        </CardDescription>
                      </div>
                      <Badge className={pageColors[pageType as keyof typeof pageColors]}>
                        {pageData.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Título */}
                    <div>
                      <Label htmlFor="title">Título Principal</Label>
                      <Input
                        id="title"
                        value={pageData.title}
                        onChange={(e) => handleInputChange(pageType, 'title', e.target.value)}
                        placeholder="Título de la página"
                      />
                    </div>

                    {/* Subtítulo */}
                    <div>
                      <Label htmlFor="subtitle">Subtítulo</Label>
                      <Input
                        id="subtitle"
                        value={pageData.subtitle}
                        onChange={(e) => handleInputChange(pageType, 'subtitle', e.target.value)}
                        placeholder="Subtítulo descriptivo"
                      />
                    </div>

                    {/* Contenido */}
                    <div>
                      <Label htmlFor="content">Contenido HTML</Label>
                      <Textarea
                        id="content"
                        rows={6}
                        value={pageData.content}
                        onChange={(e) => handleInputChange(pageType, 'content', e.target.value)}
                        placeholder="Contenido HTML de la página"
                        className="font-mono"
                      />
                    </div>

                    <Separator />

                    {/* Botón */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="button_text">Texto del Botón</Label>
                        <Input
                          id="button_text"
                          value={pageData.button_text}
                          onChange={(e) => handleInputChange(pageType, 'button_text', e.target.value)}
                          placeholder="Texto del botón"
                        />
                      </div>
                      <div>
                        <Label htmlFor="button_url">URL del Botón</Label>
                        <Input
                          id="button_url"
                          value={pageData.button_url}
                          onChange={(e) => handleInputChange(pageType, 'button_url', e.target.value)}
                          placeholder="/ruta-destino"
                        />
                      </div>
                    </div>

                    {/* CSS Personalizado */}
                    <div>
                      <Label htmlFor="custom_css">CSS Personalizado</Label>
                      <Textarea
                        id="custom_css"
                        rows={4}
                        value={pageData.custom_css}
                        onChange={(e) => handleInputChange(pageType, 'custom_css', e.target.value)}
                        placeholder="Estilos CSS personalizados"
                        className="font-mono"
                      />
                    </div>

                    <Separator />

                    {/* Estado */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="is_active">Página Activa</Label>
                        <p className="text-sm text-gray-500">
                          Activa esta página para que sea visible a los clientes
                        </p>
                      </div>
                      <Switch
                        id="is_active"
                        checked={pageData.is_active}
                        onCheckedChange={(checked) => handleInputChange(pageType, 'is_active', checked)}
                      />
                    </div>

                    {/* Botones de acción */}
                    <div className="flex space-x-2 pt-4">
                      <Button 
                        onClick={() => handleSave(pageType)}
                        disabled={loading}
                        className="flex-1"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setPreviewMode(!previewMode)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Vista Previa
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Vista Previa */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Monitor className="h-5 w-5" />
                      <span>Vista Previa</span>
                    </CardTitle>
                    <CardDescription>
                      Así se verá la página para los clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderPreview(pageData)}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Información adicional */}
        <Card>
          <CardHeader>
            <CardTitle>Variables Disponibles</CardTitle>
            <CardDescription>
              Puedes usar estas variables en el contenido y serán reemplazadas automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Variables de Orden</h4>
                <ul className="space-y-1 text-gray-600">
                  <li><code className="bg-gray-100 px-2 py-1 rounded">{'{{order_number}}'}</code> - Número de orden</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">{'{{total_amount}}'}</code> - Monto total</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">{'{{customer_name}}'}</code> - Nombre del cliente</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Variables de Tienda</h4>
                <ul className="space-y-1 text-gray-600">
                  <li><code className="bg-gray-100 px-2 py-1 rounded">{'{{store_name}}'}</code> - Nombre de la tienda</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">{'{{support_email}}'}</code> - Email de soporte</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">{'{{store_url}}'}</code> - URL de la tienda</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
