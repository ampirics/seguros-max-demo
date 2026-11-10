"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, TestTube } from "lucide-react"

interface FieldMapping {
  localField: string
  externalField: string
  transform?: string
  required: boolean
}

interface ProductSyncConfig {
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
  product_identifier_field: string
  external_identifier_field: string
  field_mappings: FieldMapping[]
  sync_frequency: string
  auto_update_enabled: boolean
  batch_size: number
  test_mode: boolean
}

interface ProductSyncFormProps {
  config: ProductSyncConfig
  onChangeAction: (config: ProductSyncConfig) => void
  onTestAction?: () => void
}

export function ProductSyncForm({ config, onChangeAction, onTestAction }: ProductSyncFormProps) {
  const updateConfig = (updates: Partial<ProductSyncConfig>) => {
    onChangeAction({ ...config, ...updates })
  }

  const updateAuthCredentials = (updates: Partial<ProductSyncConfig['auth_credentials']>) => {
    updateConfig({
      auth_credentials: { ...config.auth_credentials, ...updates }
    })
  }

  const addFieldMapping = () => {
    const newMapping: FieldMapping = {
      localField: '',
      externalField: '',
      required: false
    }
    updateConfig({
      field_mappings: [...config.field_mappings, newMapping]
    })
  }

  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    const updatedMappings = config.field_mappings.map((mapping, i) =>
      i === index ? { ...mapping, ...updates } : mapping
    )
    updateConfig({ field_mappings: updatedMappings })
  }

  const removeFieldMapping = (index: number) => {
    updateConfig({
      field_mappings: config.field_mappings.filter((_, i) => i !== index)
    })
  }

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📦 Configuración de API de Productos
          </CardTitle>
          <CardDescription>
            Configura la conexión con tu sistema externo de productos
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
                placeholder="https://api.proveedor.com/v1/productos"
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
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>🔐 Autenticación</CardTitle>
          <CardDescription>
            Configura las credenciales para acceder a la API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="auth_type">Tipo de Autenticación</Label>
            <Select
              value={config.auth_type}
              onValueChange={(value) => updateConfig({ auth_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin Autenticación</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.auth_type === 'api_key' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="api_key">API Key *</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={config.auth_credentials.api_key || ''}
                  onChange={(e) => updateAuthCredentials({ api_key: e.target.value })}
                  placeholder="tu-api-key-secreta"
                />
              </div>
              <div>
                <Label htmlFor="header_name">Nombre del Header</Label>
                <Input
                  id="header_name"
                  value={config.auth_credentials.header_name || 'X-API-Key'}
                  onChange={(e) => updateAuthCredentials({ header_name: e.target.value })}
                  placeholder="X-API-Key"
                />
              </div>
            </div>
          )}

          {config.auth_type === 'bearer' && (
            <div>
              <Label htmlFor="token">Bearer Token *</Label>
              <Input
                id="token"
                type="password"
                value={config.auth_credentials.token || ''}
                onChange={(e) => updateAuthCredentials({ token: e.target.value })}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
              />
            </div>
          )}

          {config.auth_type === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Usuario *</Label>
                <Input
                  id="username"
                  value={config.auth_credentials.username || ''}
                  onChange={(e) => updateAuthCredentials({ username: e.target.value })}
                  placeholder="usuario"
                />
              </div>
              <div>
                <Label htmlFor="password">Contraseña *</Label>
                <Input
                  id="password"
                  type="password"
                  value={config.auth_credentials.password || ''}
                  onChange={(e) => updateAuthCredentials({ password: e.target.value })}
                  placeholder="contraseña"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Identification */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Identificación de Productos</CardTitle>
          <CardDescription>
            Configura cómo se identifican los productos entre sistemas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="product_identifier">Campo Local (Tu Sistema) *</Label>
              <Select
                value={config.product_identifier_field}
                onValueChange={(value) => updateConfig({ product_identifier_field: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">ID</SelectItem>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="barcode">Código de Barras</SelectItem>
                  <SelectItem value="external_id">ID Externo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="external_identifier">Campo Externo (API) *</Label>
              <Input
                id="external_identifier"
                value={config.external_identifier_field}
                onChange={(e) => updateConfig({ external_identifier_field: e.target.value })}
                placeholder="product_id, sku, codigo, etc."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🗂️ Mapeo de Campos
            <Button type="button" onClick={addFieldMapping} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Campo
            </Button>
          </CardTitle>
          <CardDescription>
            Mapea los campos entre tu sistema y la API externa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.field_mappings.map((mapping, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Campo {index + 1}</h4>
                <Button type="button"
                  onClick={() => removeFieldMapping(index)}
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Campo Local *</Label>
                  <Select
                    value={mapping.localField}
                    onValueChange={(value) => updateFieldMapping(index, { localField: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nombre</SelectItem>
                      <SelectItem value="description">Descripción</SelectItem>
                      <SelectItem value="price">Precio</SelectItem>
                      <SelectItem value="sale_price">Precio de Oferta</SelectItem>
                      <SelectItem value="stock_quantity">Stock</SelectItem>
                      <SelectItem value="category">Categoría</SelectItem>
                      <SelectItem value="weight">Peso</SelectItem>
                      <SelectItem value="dimensions">Dimensiones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Campo Externo *</Label>
                  <Input
                    value={mapping.externalField}
                    onChange={(e) => updateFieldMapping(index, { externalField: e.target.value })}
                    placeholder="nombre_producto, precio_unitario, etc."
                  />
                </div>
                <div className="flex items-center space-x-2 mt-6">
                  <Switch
                    checked={mapping.required}
                    onCheckedChange={(checked) => updateFieldMapping(index, { required: checked })}
                  />
                  <Label>Requerido</Label>
                </div>
              </div>
              <div>
                <Label>Transformación (opcional)</Label>
                <Input
                  value={mapping.transform || ''}
                  onChange={(e) => updateFieldMapping(index, { transform: e.target.value })}
                  placeholder="parseFloat, toUpperCase, etc."
                />
              </div>
            </div>
          ))}
          
          {config.field_mappings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay campos mapeados. Agrega al menos un campo para sincronizar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Configuración de Sincronización</CardTitle>
          <CardDescription>
            Configura cómo y cuándo se ejecutará la sincronización
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sync_frequency">Frecuencia</Label>
              <Select
                value={config.sync_frequency}
                onValueChange={(value) => updateConfig({ sync_frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="hourly">Cada Hora</SelectItem>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="batch_size">Tamaño de Lote</Label>
              <Input
                id="batch_size"
                type="number"
                value={config.batch_size}
                onChange={(e) => updateConfig({ batch_size: parseInt(e.target.value) })}
                min="1"
                max="1000"
              />
            </div>
            <div className="flex items-center space-x-2 mt-6">
              <Switch
                checked={config.auto_update_enabled}
                onCheckedChange={(checked) => updateConfig({ auto_update_enabled: checked })}
              />
              <Label>Auto-actualización</Label>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.test_mode}
              onCheckedChange={(checked) => updateConfig({ test_mode: checked })}
            />
            <Label>Modo de Prueba (no actualiza datos reales)</Label>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection */}
      {onTestAction && (
        <Card>
          <CardHeader>
            <CardTitle>🧪 Prueba de Conexión</CardTitle>
            <CardDescription>
              Verifica que la configuración funcione correctamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={onTestAction} variant="outline" className="w-full">
              <TestTube className="h-4 w-4 mr-2" />
              Probar Conexión
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}