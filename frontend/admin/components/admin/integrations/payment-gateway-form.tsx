"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { TestTube, CreditCard, Shield, Globe } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PaymentGatewayConfig {
  provider: 'azul' | 'boton_popular' | 'bhd' | 'stripe' | 'paypal' | 'custom'
  environment: 'sandbox' | 'production'
  merchant_id: string
  api_credentials: {
    public_key?: string
    private_key?: string
    secret_key?: string
    merchant_number?: string
    certificate_path?: string
    passphrase?: string
  }
  supported_currencies: string[]
  supported_payment_methods: string[]
  webhook_config: {
    enabled: boolean
    url?: string
    events: string[]
  }
  security_settings: {
    require_cvv: boolean
    require_3ds: boolean
    fraud_detection: boolean
    ip_whitelist?: string[]
  }
  transaction_limits: {
    min_amount: number
    max_amount: number
    daily_limit?: number
  }
  fees_config: {
    percentage_fee: number
    fixed_fee: number
    currency: string
  }
  custom_fields?: {
    field_name: string
    field_value: string
    required: boolean
  }[]
}

interface PaymentGatewayFormProps {
  config: PaymentGatewayConfig
  onChangeAction: (config: PaymentGatewayConfig) => void
  onTestAction?: () => void
}

export function PaymentGatewayForm({ config, onChangeAction, onTestAction }: PaymentGatewayFormProps) {
  const updateConfig = (updates: Partial<PaymentGatewayConfig>) => {
    onChangeAction({ ...config, ...updates })
  }

  const updateApiCredentials = (updates: Partial<PaymentGatewayConfig['api_credentials']>) => {
    updateConfig({
      api_credentials: { ...config.api_credentials, ...updates }
    })
  }

  const updateSecuritySettings = (updates: Partial<PaymentGatewayConfig['security_settings']>) => {
    updateConfig({
      security_settings: { ...config.security_settings, ...updates }
    })
  }

  const updateWebhookConfig = (updates: Partial<PaymentGatewayConfig['webhook_config']>) => {
    updateConfig({
      webhook_config: { ...config.webhook_config, ...updates }
    })
  }

  const getProviderInfo = (provider: string) => {
    const providers = {
      azul: { name: 'Azul', flag: '🇩🇴', description: 'Principal procesador de pagos en República Dominicana' },
      boton_popular: { name: 'Botón de Pago Popular', flag: '🇩🇴', description: 'Banco Popular Dominicano' },
      bhd: { name: 'BHD León', flag: '🇩🇴', description: 'Banco BHD León' },
      stripe: { name: 'Stripe', flag: '🌍', description: 'Procesador global de pagos' },
      paypal: { name: 'PayPal', flag: '🌍', description: 'Sistema de pagos global' },
      custom: { name: 'Personalizado', flag: '⚙️', description: 'Configuración personalizada' }
    }
    return providers[provider as keyof typeof providers] || providers.custom
  }

  const providerInfo = getProviderInfo(config.provider)

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Configuración de Pasarela de Pagos
          </CardTitle>
          <CardDescription>
            Configura tu proveedor de pagos para procesar transacciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="provider">Proveedor de Pagos *</Label>
              <Select
                value={config.provider}
                onValueChange={(value: any) => updateConfig({ provider: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="azul">
                    <div className="flex items-center gap-2">
                      🇩🇴 Azul (República Dominicana)
                    </div>
                  </SelectItem>
                  <SelectItem value="boton_popular">
                    <div className="flex items-center gap-2">
                      🇩🇴 Botón Popular (Banco Popular)
                    </div>
                  </SelectItem>
                  <SelectItem value="bhd">
                    <div className="flex items-center gap-2">
                      🇩🇴 BHD León
                    </div>
                  </SelectItem>
                  <SelectItem value="stripe">
                    <div className="flex items-center gap-2">
                      🌍 Stripe (Global)
                    </div>
                  </SelectItem>
                  <SelectItem value="paypal">
                    <div className="flex items-center gap-2">
                      🌍 PayPal (Global)
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      ⚙️ Personalizado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="environment">Entorno</Label>
              <Select
                value={config.environment}
                onValueChange={(value: 'sandbox' | 'production') => updateConfig({ environment: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">
                    <div className="flex items-center gap-2">
                      🧪 Sandbox (Pruebas)
                    </div>
                  </SelectItem>
                  <SelectItem value="production">
                    <div className="flex items-center gap-2">
                      🚀 Producción
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Alert>
            <Globe className="h-4 w-4" />
            <AlertDescription>
              <strong>{providerInfo.flag} {providerInfo.name}</strong> - {providerInfo.description}
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="merchant_id">ID de Comerciante *</Label>
            <Input
              id="merchant_id"
              value={config.merchant_id}
              onChange={(e) => updateConfig({ merchant_id: e.target.value })}
              placeholder="Ingresa tu ID de comerciante"
            />
          </div>
        </CardContent>
      </Card>

      {/* API Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Credenciales de API
          </CardTitle>
          <CardDescription>
            Configura las credenciales proporcionadas por tu proveedor de pagos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(config.provider === 'azul' || config.provider === 'custom') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Clave Pública</Label>
                  <Input
                    type="password"
                    value={config.api_credentials.public_key || ''}
                    onChange={(e) => updateApiCredentials({ public_key: e.target.value })}
                    placeholder="pk_..."
                  />
                </div>
                <div>
                  <Label>Clave Privada</Label>
                  <Input
                    type="password"
                    value={config.api_credentials.private_key || ''}
                    onChange={(e) => updateApiCredentials({ private_key: e.target.value })}
                    placeholder="sk_..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Número de Comerciante</Label>
                  <Input
                    value={config.api_credentials.merchant_number || ''}
                    onChange={(e) => updateApiCredentials({ merchant_number: e.target.value })}
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <Label>Clave Secreta</Label>
                  <Input
                    type="password"
                    value={config.api_credentials.secret_key || ''}
                    onChange={(e) => updateApiCredentials({ secret_key: e.target.value })}
                    placeholder="secret_..."
                  />
                </div>
              </div>
            </>
          )}

          {config.provider === 'boton_popular' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Ruta del Certificado</Label>
                  <Input
                    value={config.api_credentials.certificate_path || ''}
                    onChange={(e) => updateApiCredentials({ certificate_path: e.target.value })}
                    placeholder="/path/to/certificate.p12"
                  />
                </div>
                <div>
                  <Label>Passphrase del Certificado</Label>
                  <Input
                    type="password"
                    value={config.api_credentials.passphrase || ''}
                    onChange={(e) => updateApiCredentials({ passphrase: e.target.value })}
                    placeholder="passphrase"
                  />
                </div>
              </div>
            </>
          )}

          {config.provider === 'stripe' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Publishable Key</Label>
                  <Input
                    value={config.api_credentials.public_key || ''}
                    onChange={(e) => updateApiCredentials({ public_key: e.target.value })}
                    placeholder="pk_test_... o pk_live_..."
                  />
                </div>
                <div>
                  <Label>Secret Key</Label>
                  <Input
                    type="password"
                    value={config.api_credentials.secret_key || ''}
                    onChange={(e) => updateApiCredentials({ secret_key: e.target.value })}
                    placeholder="sk_test_... o sk_live_..."
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>💳 Configuración de Pagos</CardTitle>
          <CardDescription>
            Configura métodos de pago, monedas y límites de transacciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Monedas Soportadas</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['DOP', 'USD', 'EUR'].map((currency) => (
                  <Badge
                    key={currency}
                    variant={config.supported_currencies.includes(currency) ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => {
                      const currencies = config.supported_currencies.includes(currency)
                        ? config.supported_currencies.filter(c => c !== currency)
                        : [...config.supported_currencies, currency]
                      updateConfig({ supported_currencies: currencies })
                    }}
                  >
                    {currency}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Métodos de Pago</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['card', 'bank_transfer', 'wallet', 'cash'].map((method) => (
                  <Badge
                    key={method}
                    variant={config.supported_payment_methods.includes(method) ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => {
                      const methods = config.supported_payment_methods.includes(method)
                        ? config.supported_payment_methods.filter(m => m !== method)
                        : [...config.supported_payment_methods, method]
                      updateConfig({ supported_payment_methods: methods })
                    }}
                  >
                    {method === 'card' && '💳'}
                    {method === 'bank_transfer' && '🏦'}
                    {method === 'wallet' && '👛'}
                    {method === 'cash' && '💵'}
                    {method.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Monto Mínimo</Label>
              <Input
                type="number"
                value={config.transaction_limits.min_amount}
                onChange={(e) => updateConfig({
                  transaction_limits: {
                    ...config.transaction_limits,
                    min_amount: parseFloat(e.target.value)
                  }
                })}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label>Monto Máximo</Label>
              <Input
                type="number"
                value={config.transaction_limits.max_amount}
                onChange={(e) => updateConfig({
                  transaction_limits: {
                    ...config.transaction_limits,
                    max_amount: parseFloat(e.target.value)
                  }
                })}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label>Límite Diario (opcional)</Label>
              <Input
                type="number"
                value={config.transaction_limits.daily_limit || ''}
                onChange={(e) => updateConfig({
                  transaction_limits: {
                    ...config.transaction_limits,
                    daily_limit: e.target.value ? parseFloat(e.target.value) : undefined
                  }
                })}
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>🔒 Configuración de Seguridad</CardTitle>
          <CardDescription>
            Configura las medidas de seguridad para las transacciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.security_settings.require_cvv}
                  onCheckedChange={(checked) => updateSecuritySettings({ require_cvv: checked })}
                />
                <Label>Requerir CVV</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.security_settings.require_3ds}
                  onCheckedChange={(checked) => updateSecuritySettings({ require_3ds: checked })}
                />
                <Label>Autenticación 3D Secure</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.security_settings.fraud_detection}
                  onCheckedChange={(checked) => updateSecuritySettings({ fraud_detection: checked })}
                />
                <Label>Detección de Fraude</Label>
              </div>
            </div>
            <div>
              <Label>IPs Permitidas (opcional)</Label>
              <Textarea
                value={config.security_settings.ip_whitelist?.join('\n') || ''}
                onChange={(e) => updateSecuritySettings({
                  ip_whitelist: e.target.value.split('\n').filter(ip => ip.trim())
                })}
                placeholder="192.168.1.1\n10.0.0.1"
                rows={4}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>🔄 Configuración de Webhooks</CardTitle>
          <CardDescription>
            Configura notificaciones automáticas para eventos de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.webhook_config.enabled}
              onCheckedChange={(checked) => updateWebhookConfig({ enabled: checked })}
            />
            <Label>Habilitar Webhooks</Label>
          </div>

          {config.webhook_config.enabled && (
            <>
              <div>
                <Label>URL del Webhook</Label>
                <Input
                  value={config.webhook_config.url || ''}
                  onChange={(e) => updateWebhookConfig({ url: e.target.value })}
                  placeholder="https://tu-dominio.com/webhook/payments"
                />
              </div>
              <div>
                <Label>Eventos</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['payment.success', 'payment.failed', 'payment.refunded', 'payment.cancelled'].map((event) => (
                    <Badge
                      key={event}
                      variant={config.webhook_config.events.includes(event) ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => {
                        const events = config.webhook_config.events.includes(event)
                          ? config.webhook_config.events.filter(e => e !== event)
                          : [...config.webhook_config.events, event]
                        updateWebhookConfig({ events })
                      }}
                    >
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Test Connection */}
      {onTestAction && (
        <Card>
          <CardHeader>
            <CardTitle>🧪 Prueba de Conexión</CardTitle>
            <CardDescription>
              Verifica que la configuración de pagos funcione correctamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={onTestAction} variant="outline" className="w-full">
              <TestTube className="h-4 w-4 mr-2" />
              Probar Pasarela de Pagos
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}