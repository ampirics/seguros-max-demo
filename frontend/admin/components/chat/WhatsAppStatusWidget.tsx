'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  MessageSquare,
  Settings,
  TestTube
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface WhatsAppStatusWidgetProps {
  className?: string
  onStatusChange?: (isConnected: boolean) => void
}

interface WhatsAppStatus {
  is_configured: boolean
  is_connected: boolean
  integration_active: boolean
  last_check: string
  error?: string
  config_source: 'integration' | 'environment' | 'none'
}

export default function WhatsAppStatusWidget({ className = '', onStatusChange }: WhatsAppStatusWidgetProps) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadStatus = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getWhatsAppConfigStatus()
      setStatus(response)
      setLastRefresh(new Date())
      
      // Notificar cambio de estado
      if (onStatusChange) {
        onStatusChange(response.is_configured && response.is_connected)
      }
    } catch (error) {
      console.error('Error loading WhatsApp status:', error)
      toast.error('Error al verificar estado de WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      setTesting(true)
      const response = await apiClient.testWhatsAppConnection()
      
      if (response.success) {
        toast.success('Conexión WhatsApp exitosa')
        // Recargar estado después de la prueba
        await loadStatus()
      } else {
        toast.error(response.error || 'Error en la conexión WhatsApp')
      }
    } catch (error) {
      console.error('Error testing WhatsApp:', error)
      toast.error('Error al probar la conexión WhatsApp')
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // Recargar estado cada 30 segundos
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = () => {
    if (!status) return <RefreshCw className="h-4 w-4 animate-spin" />
    
    if (!status.is_configured) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
    
    if (!status.is_connected) {
      return <XCircle className="h-4 w-4 text-destructive" />
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getStatusBadge = () => {
    if (!status) return <Badge variant="secondary">Verificando...</Badge>
    
    if (!status.is_configured) {
      return <Badge variant="secondary">No Configurado</Badge>
    }
    
    if (!status.is_connected) {
      return <Badge variant="destructive">Desconectado</Badge>
    }
    
    return <Badge variant="default" className="bg-green-600">Conectado</Badge>
  }

  const getConfigSourceText = () => {
    if (!status) return ''
    
    switch (status.config_source) {
      case 'integration':
        return 'Usando API de Integraciones'
      case 'environment':
        return 'Usando variables de entorno'
      case 'none':
        return 'Sin configuración'
      default:
        return 'Fuente desconocida'
    }
  }

  return (
    <Card className={`${className} border-l-4 ${
      status?.is_connected ? 'border-l-green-500' : 
      status?.is_configured ? 'border-l-yellow-500' : 
      'border-l-red-500'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-medium">WhatsApp Business</div>
              <div className="text-sm text-gray-600">
                {getConfigSourceText()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {getStatusIcon()}
          </div>
        </div>
        
        {status?.error && (
          <div className="mt-3 p-2 bg-destructive-soft border border-destructive/30 rounded text-sm text-destructive">
            {status.error}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-gray-500">
            Última verificación: {lastRefresh.toLocaleTimeString()}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            {status?.is_configured && (
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={testing}
              >
                {testing ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <TestTube className="h-3 w-3" />
                )}
                Probar
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('/admin/integrations', '_blank')}
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}