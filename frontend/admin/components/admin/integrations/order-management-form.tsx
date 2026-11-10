"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, TestTube, ShoppingCart, Package, DollarSign } from "lucide-react"

interface OrderStatusMapping {
  internal_status: string
  external_status: string
  enabled: boolean
}

interface OrderFieldMapping {
  local_field: string
  external_field: string
  type: 'order' | 'item' | 'amount'
  required: boolean
}

interface OrderManagementConfig {
  api_url: string
  http_method: string
  auth_type: string
  auth_credentials: {
    api_key?: string
    header_name?: string
    username?: string
    password?: string
    token?: string
  }
  order_identifier_field: string
  external_order_identifier: string
  status_mappings: OrderStatusMapping[]
  field_mappings: OrderFieldMapping[]
  sync_frequency: string
  auto_status_update: boolean
  webhook_enabled: boolean
  webhook_url?: string
}

interface OrderManagementFormProps {
  config: OrderManagementConfig
  onChangeAction: (config: OrderManagementConfig) => void
  onTestAction?: () => void
}

export function OrderManagementForm({ config, onChangeAction, onTestAction }: OrderManagementFormProps) {
  const updateConfig = (updates: Partial<OrderManagementConfig>) => {
    onChangeAction({ ...config, ...updates })
  }

  const addStatusMapping = () => {
    const newMapping: OrderStatusMapping = {
      internal_status: '',
      external_status: '',
      enabled: true
    }
    updateConfig({ status_mappings: [...config.status_mappings, newMapping] })
  }

  const updateStatusMapping = (index: number, updates: Partial<OrderStatusMapping>) => {
    const updatedMappings = config.status_mappings.map((mapping, i) =>
      i === index ? { ...mapping, ...updates } : mapping
    )
    updateConfig({ status_mappings: updatedMappings })
  }

  const addFieldMapping = () => {
    const newMapping: OrderFieldMapping = {
      local_field: '',
      external_field: '',
      type: 'order',
      required: false
    }
    updateConfig({ field_mappings: [...config.field_mappings, newMapping] })
  }

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-green-600" />
            Configuración de API de Órdenes
          </CardTitle>
          <CardDescription>
            Configura la conexión con tu sistema externo de gestión de órdenes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="api_url">URL de la API *</Label>
              <Input
                id="api_url"
                value={config.api_url}
                onChange={(e) => updateConfig({ api_url: e.target.value })}
                placeholder="https://api.sistema-ordenes.com/v1/orders"
              />
            </div>
            <div>
              <Label htmlFor="http_method">Método HTTP</Label>
              <Select
                value={config.http_method}
                onValueChange={(value) => updateConfig({ http_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET - Consultar órdenes</SelectItem>
                  <SelectItem value="POST">POST - Crear órdenes</SelectItem>
                  <SelectItem value="PUT">PUT - Actualizar órdenes</SelectItem>
                  <SelectItem value="PATCH">PATCH - Actualizar estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="order_identifier">Campo Identificador Local *</Label>
              <Select
                value={config.order_identifier_field}
                onValueChange={(value) => updateConfig({ order_identifier_field: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">ID de Orden</SelectItem>
                  <SelectItem value="order_number">Número de Orden</SelectItem>
                  <SelectItem value="external_id">ID Externo</SelectItem>
                  <SelectItem value="invoice_number">Número de Factura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="external_identifier">Campo Identificador Externo *</Label>
              <Input
                id="external_identifier"
                value={config.external_order_identifier}
                onChange={(e) => updateConfig({ external_order_identifier: e.target.value })}
                placeholder="order_id, order_number, etc."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            📊 Mapeo de Estados de Órdenes
            <Button type="button" onClick={addStatusMapping} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Estado
            </Button>
          </CardTitle>
          <CardDescription>
            Mapea los estados de órdenes entre tu sistema y el sistema externo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.status_mappings.map((mapping, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Mapeo de Estado {index + 1}</h4>
                <Button type="button"
                  onClick={() => {
                    const updatedMappings = config.status_mappings.filter((_, i) => i !== index)
                    updateConfig({ status_mappings: updatedMappings })
                  }}
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Estado Interno *</Label>
                  <Select
                    value={mapping.internal_status}
                    onValueChange={(value) => updateStatusMapping(index, { internal_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">🟡 Pendiente</SelectItem>
                      <SelectItem value="processing">🔄 Procesando</SelectItem>
                      <SelectItem value="shipped">📦 Enviado</SelectItem>
                      <SelectItem value="delivered">✅ Entregado</SelectItem>
                      <SelectItem value="cancelled">❌ Cancelado</SelectItem>
                      <SelectItem value="refunded">💰 Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado Externo *</Label>
                  <Input
                    value={mapping.external_status}
                    onChange={(e) => updateStatusMapping(index, { external_status: e.target.value })}
                    placeholder="confirmed, shipped, etc."
                  />
                </div>
                <div className="flex items-center space-x-2 mt-6">
                  <Switch
                    checked={mapping.enabled}
                    onCheckedChange={(checked) => updateStatusMapping(index, { enabled: checked })}
                  />
                  <Label>Activo</Label>
                </div>
              </div>
            </div>
          ))}
          
          {config.status_mappings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay estados mapeados. Agrega mapeos de estados para sincronizar órdenes.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Field Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🗂️ Mapeo de Campos de Órdenes
            <Button type="button" onClick={addFieldMapping} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Campo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.field_mappings.map((mapping, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  Campo {index + 1}
                  <Badge variant="outline">
                    {mapping.type === 'order' && <ShoppingCart className="h-3 w-3 mr-1" />}
                    {mapping.type === 'item' && <Package className="h-3 w-3 mr-1" />}
                    {mapping.type === 'amount' && <DollarSign className="h-3 w-3 mr-1" />}
                    {mapping.type}
                  </Badge>
                </h4>
                <Button type="button"
                  onClick={() => {
                    const updatedMappings = config.field_mappings.filter((_, i) => i !== index)
                    updateConfig({ field_mappings: updatedMappings })
                  }}
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={mapping.type}
                    onValueChange={(value: 'order' | 'item' | 'amount') => {
                      const updatedMappings = config.field_mappings.map((m, i) =>
                        i === index ? { ...m, type: value } : m
                      )
                      updateConfig({ field_mappings: updatedMappings })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order">🛒 Orden</SelectItem>
                      <SelectItem value="item">📦 Item</SelectItem>
                      <SelectItem value="amount">💰 Monto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Campo Local *</Label>
                  <Select
                    value={mapping.local_field}
                    onValueChange={(value) => {
                      const updatedMappings = config.field_mappings.map((m, i) =>
                        i === index ? { ...m, local_field: value } : m
                      )
                      updateConfig({ field_mappings: updatedMappings })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {mapping.type === 'order' && (
                        <>
                          <SelectItem value="customer_name">Nombre Cliente</SelectItem>
                          <SelectItem value="customer_email">Email Cliente</SelectItem>
                          <SelectItem value="shipping_address">Dirección Envío</SelectItem>
                          <SelectItem value="order_date">Fecha Orden</SelectItem>
                        </>
                      )}
                      {mapping.type === 'item' && (
                        <>
                          <SelectItem value="product_name">Nombre Producto</SelectItem>
                          <SelectItem value="product_sku">SKU</SelectItem>
                          <SelectItem value="quantity">Cantidad</SelectItem>
                          <SelectItem value="unit_price">Precio Unitario</SelectItem>
                        </>
                      )}
                      {mapping.type === 'amount' && (
                        <>
                          <SelectItem value="subtotal">Subtotal</SelectItem>
                          <SelectItem value="tax_amount">Impuestos</SelectItem>
                          <SelectItem value="shipping_cost">Costo Envío</SelectItem>
                          <SelectItem value="total_amount">Total</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Campo Externo *</Label>
                  <Input
                    value={mapping.external_field}
                    onChange={(e) => {
                      const updatedMappings = config.field_mappings.map((m, i) =>
                        i === index ? { ...m, external_field: e.target.value } : m
                      )
                      updateConfig({ field_mappings: updatedMappings })
                    }}
                    placeholder="campo_externo"
                  />
                </div>
                <div className="flex items-center space-x-2 mt-6">
                  <Switch
                    checked={mapping.required}
                    onCheckedChange={(checked) => {
                      const updatedMappings = config.field_mappings.map((m, i) =>
                        i === index ? { ...m, required: checked } : m
                      )
                      updateConfig({ field_mappings: updatedMappings })
                    }}
                  />
                  <Label>Requerido</Label>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Configuración de Sincronización</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Frecuencia de Sincronización</Label>
              <Select
                value={config.sync_frequency}
                onValueChange={(value) => updateConfig({ sync_frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real_time">Tiempo Real</SelectItem>
                  <SelectItem value="hourly">Cada Hora</SelectItem>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.auto_status_update}
                  onCheckedChange={(checked) => updateConfig({ auto_status_update: checked })}
                />
                <Label>Auto-actualizar Estados</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.webhook_enabled}
                  onCheckedChange={(checked) => updateConfig({ webhook_enabled: checked })}
                />
                <Label>Webhook Habilitado</Label>
              </div>
            </div>
          </div>

          {config.webhook_enabled && (
            <div>
              <Label>URL del Webhook</Label>
              <Input
                value={config.webhook_url || ''}
                onChange={(e) => updateConfig({ webhook_url: e.target.value })}
                placeholder="https://tu-dominio.com/webhook/orders"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Connection */}
      {onTestAction && (
        <Card>
          <CardHeader>
            <CardTitle>🧪 Prueba de Conexión</CardTitle>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={onTestAction} variant="outline" className="w-full">
              <TestTube className="h-4 w-4 mr-2" />
              Probar Integración de Órdenes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}