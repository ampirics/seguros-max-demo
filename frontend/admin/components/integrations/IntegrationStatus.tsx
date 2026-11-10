'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Settings, TestTube } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface Integration {
  id: string
  integration_type: string
  name: string
  description?: string
  is_active: boolean
  is_configured: boolean
  last_tested_at?: string
  created_at: string
  updated_at: string
}

interface IntegrationStatusProps {
  showTestButton?: boolean
  className?: string
}

export default function IntegrationStatus({ showTestButton = true, className = '' }: IntegrationStatusProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getIntegrations()
      setIntegrations(response.data || [])
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error loading integrations:', error)
      toast.error('Error al cargar las integraciones')
    } finally {
      setLoading(false)
    }
  }

  const testWhatsAppConnection = async () => {
    try {
      setTesting('whatsapp')
      const response = await apiClient.testWhatsAppConnection()
      if (response.success) {
        toast.success('Conexión WhatsApp exitosa')
      } else {
        toast.error(response.error || 'Error en la conexión WhatsApp')
      }
    } catch (error) {
      console.error('Error testing WhatsApp:', error)
      toast.error('Error al probar la conexión WhatsApp')
    } finally {
      setTesting(null)
    }
  }

  useEffect(() => {
    loadIntegrations()
  }, [])

  const getStatusIcon = (integration: Integration) => {
    if (!integration.is_active) {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    if (!integration.is_configured) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getStatusBadge = (integration: Integration) => {
    if (!integration.is_active) {
      return <Badge variant="destructive">Inactivo</Badge>
    }
    if (!integration.is_configured) {
      return <Badge variant="secondary">No Configurado</Badge>
    }
    return <Badge variant="default" className="bg-green-600">Activo</Badge>
  }

  const getIntegrationDisplayName = (type: string) => {
    const names: Record<string, string> = {
      'whatsapp': 'WhatsApp Business',
      'email': 'Correo Electrónico',
      'sms': 'SMS',
      'facebook': 'Facebook',
      'instagram': 'Instagram',
      'payment': 'Pasarela de Pago',
      'shipping': 'Envíos',
      'analytics': 'Analytics'
    }
    return names[type] || type.charAt(0).toUpperCase() + type.slice(1)
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Estado de Integraciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Cargando integraciones...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Estado de Integraciones
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadIntegrations}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <span className="text-xs text-gray-500">
              Actualizado: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {integrations.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No hay integraciones configuradas
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(integration)}
                  <div>
                    <div className="font-medium">
                      {integration.name || getIntegrationDisplayName(integration.integration_type)}
                    </div>
                    {integration.description && (
                      <div className="text-sm text-gray-500">
                        {integration.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Tipo: {integration.integration_type}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {getStatusBadge(integration)}
                  
                  {integration.last_tested_at && (
                    <div className="text-xs text-gray-500">
                      Probado: {new Date(integration.last_tested_at).toLocaleDateString()}
                    </div>
                  )}
                  
                  {showTestButton && integration.integration_type === 'whatsapp' && integration.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testWhatsAppConnection}
                      disabled={testing === 'whatsapp'}
                    >
                      {testing === 'whatsapp' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Probar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {integrations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Total: {integrations.length} integraciones
              {' • '}
              Activas: {integrations.filter(i => i.is_active && i.is_configured).length}
              {' • '}
              Configuradas: {integrations.filter(i => i.is_configured).length}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}