import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Phone, 
  Search, 
  MessageSquare, 
  User, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'

interface CustomerWhatsAppDetectorProps {
  customerId: string
  customerName?: string
  onConversationDetected?: (conversationData: any) => void
  className?: string
}

interface DetectionResult {
  success: boolean
  conversation_id?: string
  customer_phone?: string
  customer_name?: string
  whatsapp_configured?: boolean
  error?: string
}

export default function CustomerWhatsAppDetector({
  customerId,
  customerName,
  onConversationDetected,
  className = ''
}: CustomerWhatsAppDetectorProps) {
  const [detecting, setDetecting] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)

  const handleDetectWhatsApp = async () => {
    setDetecting(true)
    setResult(null)

    try {
      const response = await apiClient.detectCustomerWhatsApp(customerId)
      setResult(response)

      if (response.success) {
        toast.success(`✅ WhatsApp detectado: ${response.customer_phone}`)
        onConversationDetected?.(response)
      } else {
        toast.warning(`⚠️ ${response.error}`)
      }
    } catch (error) {
      console.error('Error detecting WhatsApp:', error)
      const errorResult = {
        success: false,
        error: 'Error de conexión al detectar WhatsApp'
      }
      setResult(errorResult)
      toast.error('❌ Error al detectar WhatsApp')
    } finally {
      setDetecting(false)
    }
  }

  const openWhatsAppConversation = () => {
    if (result?.conversation_id) {
      // Aquí podrías navegar a la conversación o emitir un evento
      onConversationDetected?.(result)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Botón de detección */}
      <div className="flex items-center space-x-3">
        <Button
          onClick={handleDetectWhatsApp}
          disabled={detecting}
          size="sm"
          variant="outline"
          className="flex-shrink-0"
        >
          {detecting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          Detectar WhatsApp
        </Button>

        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>{customerName || `Cliente ${customerId.slice(-6)}`}</span>
        </div>
      </div>

      {/* Resultado de la detección */}
      {result && (
        <div className={`p-3 rounded-lg border ${
          result.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          
          {result.success ? (
            <div className="space-y-2">
              {/* Éxito */}
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">
                  WhatsApp encontrado
                </span>
              </div>

              {/* Información del teléfono */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-mono">
                    {result.customer_phone}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {result.whatsapp_configured ? (
                    <Badge className="bg-green-100 text-green-800">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Sin configurar
                    </Badge>
                  )}
                </div>
              </div>

              {/* Botón para abrir conversación */}
              <Button
                onClick={openWhatsAppConversation}
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!result.whatsapp_configured}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Abrir Chat de WhatsApp
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Error o sin teléfono */}
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">
                  Sin WhatsApp disponible
                </span>
              </div>
              
              <div className="text-sm text-yellow-700">
                {result.error}
              </div>

              {/* Sugerencias */}
              <div className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded">
                💡 <strong>Sugerencias:</strong>
                <ul className="mt-1 space-y-1 ml-4">
                  <li>• Agregar teléfono en la sección "Contactos" del cliente</li>
                  <li>• Marcar un teléfono como "Principal"</li>
                  <li>• Verificar que el teléfono esté en formato internacional</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estado de configuración general */}
      {result?.whatsapp_configured === false && (
        <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
          ⚠️ WhatsApp no está configurado en el sistema. Contacta al administrador.
        </div>
      )}
    </div>
  )
}