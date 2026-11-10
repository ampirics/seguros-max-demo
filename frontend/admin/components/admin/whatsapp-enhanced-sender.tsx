import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  Phone, 
  UserCheck,
  MessageCircle,
  Zap,
  Settings,
  Check,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'

interface WhatsAppIntegration {
  id: string
  name: string
  description: string
  environment: string
  is_active: boolean
  phone_number_id?: string
  business_account_id?: string
}

interface WhatsAppEnhancedSenderProps {
  conversationId: string
  customerPhone?: string
  onMessageSent?: () => void
  disabled?: boolean
}

interface MessageTemplate {
  id: string
  name: string
  icon: React.ReactNode
  prefix: string
  placeholder: string
}

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'simple',
    name: 'Simple',
    icon: <MessageSquare className="w-4 h-4" />,
    prefix: '',
    placeholder: 'Escribe tu mensaje...'
  },
  {
    id: 'greeting',
    name: 'Saludo',
    icon: <UserCheck className="w-4 h-4" />,
    prefix: '👋 ¡Hola! ',
    placeholder: '¿Cómo puedo ayudarte hoy?'
  },
  {
    id: 'follow_up',
    name: 'Seguimiento',
    icon: <MessageCircle className="w-4 h-4" />,
    prefix: '🔄 Seguimiento: ',
    placeholder: 'Queremos saber cómo va todo...'
  },
  {
    id: 'support',
    name: 'Soporte',
    icon: <Sparkles className="w-4 h-4" />,
    prefix: '🎧 Soporte: ',
    placeholder: 'Estamos aquí para ayudarte...'
  }
]

export default function WhatsAppEnhancedSender({
  conversationId,
  customerPhone,
  onMessageSent,
  disabled = false
}: WhatsAppEnhancedSenderProps) {
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('simple')
  const [sending, setSending] = useState(false)
  const [quickSending, setQuickSending] = useState(false)
  const [integrations, setIntegrations] = useState<WhatsAppIntegration[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<string>('')
  const [loadingIntegrations, setLoadingIntegrations] = useState(true)
  const [whatsappStatus, setWhatsappStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown')

  // Cargar integraciones de WhatsApp al montar el componente
  useEffect(() => {
    loadWhatsAppIntegrations()
  }, [])

  const loadWhatsAppIntegrations = async () => {
    try {
      setLoadingIntegrations(true)
      const response = await apiClient.getWhatsAppIntegrations()
      
      if (response.success && response.integrations) {
        setIntegrations(response.integrations)
        // Seleccionar automáticamente la primera integración activa
        if (response.integrations.length > 0) {
          setSelectedIntegration(response.integrations[0].id)
          setWhatsappStatus('available')
        } else {
          setWhatsappStatus('unavailable')
        }
      } else {
        setWhatsappStatus('unavailable')
      }
    } catch (error) {
      console.error('Error cargando integraciones WhatsApp:', error)
      setWhatsappStatus('unavailable')
      toast.error('Error cargando configuración de WhatsApp')
    } finally {
      setLoadingIntegrations(false)
    }
  }

  const selectedTemplateData = MESSAGE_TEMPLATES.find(t => t.id === selectedTemplate) || MESSAGE_TEMPLATES[0]

  const handleSendWhatsApp = async () => {
    if (!message.trim() || sending || disabled) return

    if (!selectedIntegration) {
      toast.error('Selecciona una integración de WhatsApp')
      return
    }

    setSending(true)
    try {
      // Usar el nuevo endpoint con integración específica
      const response = await apiClient.sendWhatsAppWithIntegration(conversationId, {
        message: message.trim(),
        integration_id: selectedIntegration
      })

      if (response.success) {
        setMessage('')
        const integrationName = integrations.find(i => i.id === selectedIntegration)?.name || 'WhatsApp'
        toast.success(`✅ Mensaje enviado via ${integrationName}`)
        onMessageSent?.()
      } else {
        throw new Error(response.whatsapp_result?.error || 'Error enviando mensaje')
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      toast.error('❌ Error al enviar por WhatsApp')
    } finally {
      setSending(false)
    }
  }

  const handleQuickSend = async () => {
    if (!message.trim() || quickSending || disabled) return

    setQuickSending(true)
    try {
      const result = await apiClient.sendWhatsAppQuickMessage(conversationId, {
        message: message.trim(),
        template_type: selectedTemplate
      })

      if (result.success) {
        setMessage('')
        toast.success(`✅ Mensaje enviado: ${selectedTemplateData.name}`)
        onMessageSent?.()
      } else {
        toast.error('❌ Error al enviar mensaje rápido')
      }
    } catch (error) {
      console.error('Error sending quick WhatsApp message:', error)
      toast.error('❌ Error al enviar por WhatsApp')
    } finally {
      setQuickSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter = envío rápido con template
        e.preventDefault()
        handleQuickSend()
      } else {
        // Enter = envío normal
        e.preventDefault()
        handleSendWhatsApp()
      }
    }
  }

  if (!customerPhone) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="flex items-center justify-center text-gray-500 space-x-2">
          <Phone className="w-5 h-5" />
          <span>Sin teléfono de WhatsApp disponible</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
      {/* Header con info del teléfono */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${whatsappStatus === 'available' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-sm font-medium text-green-700">
            WhatsApp: {customerPhone}
          </span>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-300">
          <MessageSquare className="w-3 h-3 mr-1" />
          {whatsappStatus === 'available' ? 'Activo' : 'Sin configurar'}
        </Badge>
      </div>

      {/* Selector de integración */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Integración WhatsApp:</label>
        {loadingIntegrations ? (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span>Cargando integraciones...</span>
          </div>
        ) : integrations.length > 0 ? (
          <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar integración" />
            </SelectTrigger>
            <SelectContent>
              {integrations.map((integration) => (
                <SelectItem key={integration.id} value={integration.id}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${integration.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span>{integration.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {integration.environment}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center space-x-2 text-sm text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
            <AlertCircle className="w-4 h-4" />
            <span>No hay integraciones WhatsApp configuradas</span>
          </div>
        )}
      </div>

      {/* Selector de template */}
      <div className="flex items-center space-x-2">
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESSAGE_TEMPLATES.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center space-x-2">
                  {template.icon}
                  <span>{template.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTemplate !== 'simple' && (
          <div className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
            {selectedTemplateData.prefix}
          </div>
        )}
      </div>

      {/* Input para el mensaje */}
      <div className="flex space-x-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={selectedTemplateData.placeholder}
          disabled={disabled || sending || quickSending || !selectedIntegration}
          className="flex-1"
        />
        
        {/* Botón envío normal */}
        <Button
          onClick={handleSendWhatsApp}
          disabled={!message.trim() || sending || quickSending || disabled || !selectedIntegration}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>

        {/* Botón envío rápido con template */}
        {selectedTemplate !== 'simple' && (
          <Button
            onClick={handleQuickSend}
            disabled={!message.trim() || sending || quickSending || disabled || !selectedIntegration}
            size="sm"
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-100"
          >
            {quickSending ? (
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Indicaciones de uso */}
      <div className="text-xs text-green-600 space-y-1">
        <div>• <kbd>Enter</kbd> = Envío normal</div>
        {selectedTemplate !== 'simple' && (
          <div>• <kbd>Shift + Enter</kbd> = Envío con template "{selectedTemplateData.name}"</div>
        )}
      </div>
    </div>
  )
}