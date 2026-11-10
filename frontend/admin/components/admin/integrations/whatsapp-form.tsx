"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, TestTube, MessageCircle, Phone, Key } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface MessageTemplate {
  name: string
  language: string
  category: string
  components: {
    type: 'HEADER' | 'BODY' | 'FOOTER'
    format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO'
    text?: string
    example?: { header_text?: string[]; body_text?: string[][] }
  }[]
}

interface WebhookConfig {
  verify_token: string
  webhook_url: string
  fields: string[]
}

interface WhatsAppConfig {
  access_token: string
  phone_number_id: string
  business_account_id?: string
  webhook_config: WebhookConfig
  message_templates: MessageTemplate[]
  environment: 'sandbox' | 'production'
  auto_reply_enabled: boolean
  business_hours: {
    enabled: boolean
    start_time: string
    end_time: string
    timezone: string
  }
  allowed_countries: string[]
  rate_limit: {
    messages_per_minute: number
    messages_per_day: number
  }
}

interface WhatsAppFormProps {
  config: WhatsAppConfig
  onChangeAction: (config: WhatsAppConfig) => void
  onTestAction?: () => void
}

export function WhatsAppForm({ config, onChangeAction, onTestAction }: WhatsAppFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateConfig = (updates: Partial<WhatsAppConfig>) => {
    onChangeAction({ ...config, ...updates })
  }

  const updateWebhookConfig = (updates: Partial<WebhookConfig>) => {
    updateConfig({
      webhook_config: { ...config.webhook_config, ...updates }
    })
  }

  const updateBusinessHours = (updates: Partial<WhatsAppConfig['business_hours']>) => {
    updateConfig({
      business_hours: { ...config.business_hours, ...updates }
    })
  }

  const addMessageTemplate = () => {
    const newTemplate: MessageTemplate = {
      name: '',
      language: 'es',
      category: 'UTILITY',
      components: [
        { type: 'BODY', text: '' }
      ]
    }
    updateConfig({
      message_templates: [...config.message_templates, newTemplate]
    })
  }

  const updateMessageTemplate = (index: number, updates: Partial<MessageTemplate>) => {
    const updatedTemplates = config.message_templates.map((template, i) =>
      i === index ? { ...template, ...updates } : template
    )
    updateConfig({ message_templates: updatedTemplates })
  }

  const removeMessageTemplate = (index: number) => {
    updateConfig({
      message_templates: config.message_templates.filter((_, i) => i !== index)
    })
  }

  return (
    <div className="space-y-6">
      {/* Basic Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Configuración Básica de WhatsApp Business
          </CardTitle>
          <CardDescription>
            Configura las credenciales principales de tu cuenta de WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Puedes obtener estas credenciales desde el <strong>Meta for Developers</strong> dashboard en tu aplicación de WhatsApp Business.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="access_token">Access Token *</Label>
              <Input
                id="access_token"
                type="password"
                value={config.access_token}
                onChange={(e) => updateConfig({ access_token: e.target.value })}
                placeholder="Token de acceso de Meta (EAA…)"
              />
            </div>
            <div>
              <Label htmlFor="phone_number_id">Phone Number ID *</Label>
              <Input
                id="phone_number_id"
                value={config.phone_number_id}
                onChange={(e) => updateConfig({ phone_number_id: e.target.value })}
                placeholder="744775248724051"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="business_account_id">Business Account ID (opcional)</Label>
              <Input
                id="business_account_id"
                value={config.business_account_id || ''}
                onChange={(e) => updateConfig({ business_account_id: e.target.value })}
                placeholder="123456789012345"
              />
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
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Configuración de Webhook
          </CardTitle>
          <CardDescription>
            Configura cómo WhatsApp enviará los mensajes entrantes a tu sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="verify_token">Token de Verificación *</Label>
              <Input
                id="verify_token"
                value={config.webhook_config.verify_token}
                onChange={(e) => updateWebhookConfig({ verify_token: e.target.value })}
                placeholder="tu-token-secreto-123"
              />
            </div>
            <div>
              <Label htmlFor="webhook_url">URL del Webhook</Label>
              <Input
                id="webhook_url"
                value={config.webhook_config.webhook_url}
                onChange={(e) => updateWebhookConfig({ webhook_url: e.target.value })}
                placeholder="https://tu-dominio.com/webhook/whatsapp"
              />
            </div>
          </div>

          <div>
            <Label>Campos de Webhook</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['messages', 'message_deliveries', 'message_reads', 'messaging_postbacks'].map((field) => (
                <Badge
                  key={field}
                  variant={config.webhook_config.fields.includes(field) ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => {
                    const fields = config.webhook_config.fields.includes(field)
                      ? config.webhook_config.fields.filter(f => f !== field)
                      : [...config.webhook_config.fields, field]
                    updateWebhookConfig({ fields })
                  }}
                >
                  {field}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            📝 Plantillas de Mensajes
            <Button type="button" onClick={addMessageTemplate} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Plantilla
            </Button>
          </CardTitle>
          <CardDescription>
            Configura plantillas de mensajes pre-aprobadas por WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.message_templates.map((template, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Plantilla {index + 1}</h4>
                <Button type="button"
                  onClick={() => removeMessageTemplate(index)}
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Nombre de la Plantilla *</Label>
                  <Input
                    value={template.name}
                    onChange={(e) => updateMessageTemplate(index, { name: e.target.value })}
                    placeholder="orden_confirmada"
                  />
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Select
                    value={template.language}
                    onValueChange={(value) => updateMessageTemplate(index, { language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">Inglés</SelectItem>
                      <SelectItem value="pt">Portugués</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Select
                    value={template.category}
                    onValueChange={(value) => updateMessageTemplate(index, { category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTILITY">Utilidad</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="AUTHENTICATION">Autenticación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Contenido del Mensaje *</Label>
                <Textarea
                  value={template.components.find(c => c.type === 'BODY')?.text || ''}
                  onChange={(e) => {
                    const updatedComponents = template.components.map(c => 
                      c.type === 'BODY' ? { ...c, text: e.target.value } : c
                    )
                    updateMessageTemplate(index, { components: updatedComponents })
                  }}
                  placeholder="Hola {{1}}, tu pedido {{2}} ha sido confirmado."
                  rows={3}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Usa {'{{1}}'}, {'{{2}}'}, etc. para variables dinámicas
                </p>
              </div>
            </div>
          ))}
          
          {config.message_templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay plantillas configuradas. Agrega plantillas para enviar mensajes automatizados.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Settings */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Configuración de Negocio</CardTitle>
          <CardDescription>
            Configura horarios de atención y límites de mensajes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.auto_reply_enabled}
              onCheckedChange={(checked) => updateConfig({ auto_reply_enabled: checked })}
            />
            <Label>Respuestas Automáticas Habilitadas</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={config.business_hours.enabled}
              onCheckedChange={(checked) => updateBusinessHours({ enabled: checked })}
            />
            <Label>Horario de Atención</Label>
          </div>

          {config.business_hours.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6">
              <div>
                <Label>Hora de Inicio</Label>
                <Input
                  type="time"
                  value={config.business_hours.start_time}
                  onChange={(e) => updateBusinessHours({ start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Hora de Fin</Label>
                <Input
                  type="time"
                  value={config.business_hours.end_time}
                  onChange={(e) => updateBusinessHours({ end_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Zona Horaria</Label>
                <Select
                  value={config.business_hours.timezone}
                  onValueChange={(value) => updateBusinessHours({ timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Santo_Domingo">República Dominicana (AST)</SelectItem>
                    <SelectItem value="America/New_York">Nueva York (EST)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Los Ángeles (PST)</SelectItem>
                    <SelectItem value="Europe/Madrid">Madrid (CET)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Mensajes por Minuto</Label>
              <Input
                type="number"
                value={config.rate_limit.messages_per_minute}
                onChange={(e) => updateConfig({ 
                  rate_limit: { 
                    ...config.rate_limit, 
                    messages_per_minute: parseInt(e.target.value) 
                  } 
                })}
                min="1"
                max="100"
              />
            </div>
            <div>
              <Label>Mensajes por Día</Label>
              <Input
                type="number"
                value={config.rate_limit.messages_per_day}
                onChange={(e) => updateConfig({ 
                  rate_limit: { 
                    ...config.rate_limit, 
                    messages_per_day: parseInt(e.target.value) 
                  } 
                })}
                min="1"
                max="10000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection */}
      {onTestAction && (
        <Card>
          <CardHeader>
            <CardTitle>🧪 Prueba de Conexión</CardTitle>
            <CardDescription>
              Verifica que la configuración de WhatsApp funcione correctamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={onTestAction} variant="outline" className="w-full">
              <TestTube className="h-4 w-4 mr-2" />
              Probar Conexión con WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}