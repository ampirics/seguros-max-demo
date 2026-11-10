"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, TestTube, Code, Key, FileText, Settings, Copy } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Header {
  key: string
  value: string
  enabled: boolean
  description?: string
}

interface QueryParam {
  key: string
  value: string
  enabled: boolean
  description?: string
}

interface AuthConfig {
  type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2'
  api_key?: {
    key: string
    value: string
    add_to: 'header' | 'query'
  }
  bearer?: {
    token: string
    prefix?: string
  }
  basic?: {
    username: string
    password: string
  }
  oauth2?: {
    access_token_url: string
    client_id: string
    client_secret: string
    scope?: string
  }
}

interface RequestBody {
  type: 'none' | 'json' | 'form_data' | 'form_urlencoded' | 'raw' | 'binary'
  content: string
  form_data?: { key: string; value: string; type: 'text' | 'file'; enabled: boolean }[]
}

interface CustomAPIConfig {
  name: string
  description?: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  auth: AuthConfig
  headers: Header[]
  query_params: QueryParam[]
  body: RequestBody
  timeout: number
  follow_redirects: boolean
  ssl_verification: boolean
  proxy?: {
    enabled: boolean
    host?: string
    port?: number
    username?: string
    password?: string
  }
  pre_request_script?: string
  post_request_script?: string
  tests?: {
    status_code?: number
    response_time_max?: number
    response_contains?: string[]
    json_schema?: string
  }
}

interface CustomAPIFormProps {
  config: CustomAPIConfig
  onChangeAction: (config: CustomAPIConfig) => void
  onTestAction?: () => void
}

export function CustomAPIForm({ config, onChangeAction, onTestAction }: CustomAPIFormProps) {
  const [activeTab, setActiveTab] = useState('request')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateConfig = (updates: Partial<CustomAPIConfig>) => {
    onChangeAction({ ...config, ...updates })
  }

  const updateAuth = (updates: Partial<AuthConfig>) => {
    updateConfig({ auth: { ...config.auth, ...updates } })
  }

  const addHeader = () => {
    const newHeader: Header = { key: '', value: '', enabled: true }
    updateConfig({ headers: [...config.headers, newHeader] })
  }

  const updateHeader = (index: number, updates: Partial<Header>) => {
    const updatedHeaders = config.headers.map((header, i) =>
      i === index ? { ...header, ...updates } : header
    )
    updateConfig({ headers: updatedHeaders })
  }

  const removeHeader = (index: number) => {
    updateConfig({ headers: config.headers.filter((_, i) => i !== index) })
  }

  const addQueryParam = () => {
    const newParam: QueryParam = { key: '', value: '', enabled: true }
    updateConfig({ query_params: [...config.query_params, newParam] })
  }

  const updateQueryParam = (index: number, updates: Partial<QueryParam>) => {
    const updatedParams = config.query_params.map((param, i) =>
      i === index ? { ...param, ...updates } : param
    )
    updateConfig({ query_params: updatedParams })
  }

  const removeQueryParam = (index: number) => {
    updateConfig({ query_params: config.query_params.filter((_, i) => i !== index) })
  }

  const addFormDataField = () => {
    if (!config.body.form_data) {
      updateConfig({
        body: { ...config.body, form_data: [] }
      })
    }
    const newField = { key: '', value: '', type: 'text' as const, enabled: true }
    updateConfig({
      body: {
        ...config.body,
        form_data: [...(config.body.form_data || []), newField]
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Basic Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-600" />
            Configuración de API Personalizada
          </CardTitle>
          <CardDescription>
            Configura una integración personalizada similar a Postman
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="api_name">Nombre de la Integración *</Label>
              <Input
                id="api_name"
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                placeholder="Mi API personalizada"
              />
            </div>
            <div>
              <Label htmlFor="api_description">Descripción</Label>
              <Textarea
                id="api_description"
                value={config.description || ''}
                onChange={(e) => updateConfig({ description: e.target.value })}
                placeholder="Descripción de qué hace esta integración..."
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="request">🌐 Request</TabsTrigger>
          <TabsTrigger value="auth">🔐 Auth</TabsTrigger>
          <TabsTrigger value="body">📄 Body</TabsTrigger>
          <TabsTrigger value="tests">🧪 Tests</TabsTrigger>
        </TabsList>

        {/* Request Tab */}
        <TabsContent value="request" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Request</CardTitle>
              <CardDescription>
                Configura la URL, método y parámetros de la petición
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label>Método</Label>
                  <Select
                    value={config.method}
                    onValueChange={(value: any) => updateConfig({ method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">
                        <Badge variant="secondary">GET</Badge>
                      </SelectItem>
                      <SelectItem value="POST">
                        <Badge variant="default">POST</Badge>
                      </SelectItem>
                      <SelectItem value="PUT">
                        <Badge variant="outline">PUT</Badge>
                      </SelectItem>
                      <SelectItem value="PATCH">
                        <Badge variant="outline">PATCH</Badge>
                      </SelectItem>
                      <SelectItem value="DELETE">
                        <Badge variant="destructive">DELETE</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Label>URL *</Label>
                  <Input
                    value={config.url}
                    onChange={(e) => updateConfig({ url: e.target.value })}
                    placeholder="https://api.ejemplo.com/v1/endpoint"
                  />
                </div>
              </div>

              {/* Query Parameters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Query Parameters</Label>
                  <Button type="button" onClick={addQueryParam} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {config.query_params.map((param, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Switch
                        checked={param.enabled}
                        onCheckedChange={(checked) => updateQueryParam(index, { enabled: checked })}
                      />
                      <Input
                        value={param.key}
                        onChange={(e) => updateQueryParam(index, { key: e.target.value })}
                        placeholder="key"
                        className="flex-1"
                      />
                      <Input
                        value={param.value}
                        onChange={(e) => updateQueryParam(index, { value: e.target.value })}
                        placeholder="value"
                        className="flex-1"
                      />
                      <Button type="button"
                        onClick={() => removeQueryParam(index)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Headers</Label>
                  <Button type="button" onClick={addHeader} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {config.headers.map((header, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Switch
                        checked={header.enabled}
                        onCheckedChange={(checked) => updateHeader(index, { enabled: checked })}
                      />
                      <Input
                        value={header.key}
                        onChange={(e) => updateHeader(index, { key: e.target.value })}
                        placeholder="Content-Type"
                        className="flex-1"
                      />
                      <Input
                        value={header.value}
                        onChange={(e) => updateHeader(index, { value: e.target.value })}
                        placeholder="application/json"
                        className="flex-1"
                      />
                      <Button type="button"
                        onClick={() => removeHeader(index)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auth Tab */}
        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Autenticación
              </CardTitle>
              <CardDescription>
                Configura el tipo de autenticación para la API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo de Autenticación</Label>
                <Select
                  value={config.auth.type}
                  onValueChange={(value: any) => updateAuth({ type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin Autenticación</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.auth.type === 'api_key' && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Key</Label>
                      <Input
                        value={config.auth.api_key?.key || ''}
                        onChange={(e) => updateAuth({
                          api_key: { ...config.auth.api_key!, key: e.target.value }
                        })}
                        placeholder="X-API-Key"
                      />
                    </div>
                    <div>
                      <Label>Value</Label>
                      <Input
                        type="password"
                        value={config.auth.api_key?.value || ''}
                        onChange={(e) => updateAuth({
                          api_key: { ...config.auth.api_key!, value: e.target.value }
                        })}
                        placeholder="tu-api-key"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Añadir a</Label>
                    <Select
                      value={config.auth.api_key?.add_to || 'header'}
                      onValueChange={(value: 'header' | 'query') => updateAuth({
                        api_key: { ...config.auth.api_key!, add_to: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header">Header</SelectItem>
                        <SelectItem value="query">Query Parameter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {config.auth.type === 'bearer' && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div>
                    <Label>Token</Label>
                    <Input
                      type="password"
                      value={config.auth.bearer?.token || ''}
                      onChange={(e) => updateAuth({
                        bearer: { ...config.auth.bearer!, token: e.target.value }
                      })}
                      placeholder="eyJhbGciOiJIUzI1NiIs..."
                    />
                  </div>
                  <div>
                    <Label>Prefix (opcional)</Label>
                    <Input
                      value={config.auth.bearer?.prefix || 'Bearer'}
                      onChange={(e) => updateAuth({
                        bearer: { ...config.auth.bearer!, prefix: e.target.value }
                      })}
                      placeholder="Bearer"
                    />
                  </div>
                </div>
              )}

              {config.auth.type === 'basic' && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={config.auth.basic?.username || ''}
                        onChange={(e) => updateAuth({
                          basic: { ...config.auth.basic!, username: e.target.value }
                        })}
                        placeholder="usuario"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={config.auth.basic?.password || ''}
                        onChange={(e) => updateAuth({
                          basic: { ...config.auth.basic!, password: e.target.value }
                        })}
                        placeholder="contraseña"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Body Tab */}
        <TabsContent value="body" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cuerpo de la Petición
              </CardTitle>
              <CardDescription>
                Configura el contenido del cuerpo para métodos POST, PUT, PATCH
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo de Contenido</Label>
                <Select
                  value={config.body.type}
                  onValueChange={(value: any) => updateConfig({
                    body: { ...config.body, type: value, content: value === 'none' ? '' : config.body.content }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="form_data">Form Data</SelectItem>
                    <SelectItem value="form_urlencoded">Form URL-Encoded</SelectItem>
                    <SelectItem value="raw">Raw</SelectItem>
                    <SelectItem value="binary">Binary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.body.type === 'json' && (
                <div>
                  <Label>JSON Content</Label>
                  <Textarea
                    value={config.body.content}
                    onChange={(e) => updateConfig({
                      body: { ...config.body, content: e.target.value }
                    })}
                    placeholder={`{
  "key": "value",
  "number": 123,
  "array": ["item1", "item2"]
}`}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {config.body.type === 'form_data' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Form Data Fields</Label>
                    <Button type="button" onClick={addFormDataField} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Campo
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {config.body.form_data?.map((field, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Switch
                          checked={field.enabled}
                          onCheckedChange={(checked) => {
                            const updatedFormData = config.body.form_data!.map((f, i) =>
                              i === index ? { ...f, enabled: checked } : f
                            )
                            updateConfig({
                              body: { ...config.body, form_data: updatedFormData }
                            })
                          }}
                        />
                        <Input
                          value={field.key}
                          onChange={(e) => {
                            const updatedFormData = config.body.form_data!.map((f, i) =>
                              i === index ? { ...f, key: e.target.value } : f
                            )
                            updateConfig({
                              body: { ...config.body, form_data: updatedFormData }
                            })
                          }}
                          placeholder="key"
                          className="flex-1"
                        />
                        <Select
                          value={field.type}
                          onValueChange={(value: 'text' | 'file') => {
                            const updatedFormData = config.body.form_data!.map((f, i) =>
                              i === index ? { ...f, type: value } : f
                            )
                            updateConfig({
                              body: { ...config.body, form_data: updatedFormData }
                            })
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="file">File</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={field.value}
                          onChange={(e) => {
                            const updatedFormData = config.body.form_data!.map((f, i) =>
                              i === index ? { ...f, value: e.target.value } : f
                            )
                            updateConfig({
                              body: { ...config.body, form_data: updatedFormData }
                            })
                          }}
                          placeholder="value"
                          className="flex-1"
                        />
                        <Button type="button"
                          onClick={() => {
                            const updatedFormData = config.body.form_data!.filter((_, i) => i !== index)
                            updateConfig({
                              body: { ...config.body, form_data: updatedFormData }
                            })
                          }}
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(config.body.type === 'raw' || config.body.type === 'form_urlencoded') && (
                <div>
                  <Label>Content</Label>
                  <Textarea
                    value={config.body.content}
                    onChange={(e) => updateConfig({
                      body: { ...config.body, content: e.target.value }
                    })}
                    placeholder={config.body.type === 'form_urlencoded' 
                      ? "key1=value1&key2=value2" 
                      : "Raw content here..."
                    }
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Configuración de Tests
              </CardTitle>
              <CardDescription>
                Define validaciones automáticas para la respuesta de la API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Código de Estado Esperado</Label>
                  <Input
                    type="number"
                    value={config.tests?.status_code || ''}
                    onChange={(e) => updateConfig({
                      tests: { 
                        ...config.tests, 
                        status_code: parseInt(e.target.value) 
                      }
                    })}
                    placeholder="200"
                  />
                </div>
                <div>
                  <Label>Tiempo Máximo de Respuesta (ms)</Label>
                  <Input
                    type="number"
                    value={config.tests?.response_time_max || ''}
                    onChange={(e) => updateConfig({
                      tests: { 
                        ...config.tests, 
                        response_time_max: parseInt(e.target.value) 
                      }
                    })}
                    placeholder="5000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Timeout (segundos)</Label>
                  <Input
                    type="number"
                    value={config.timeout}
                    onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) })}
                    min="1"
                    max="300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.follow_redirects}
                      onCheckedChange={(checked) => updateConfig({ follow_redirects: checked })}
                    />
                    <Label>Seguir Redirecciones</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.ssl_verification}
                      onCheckedChange={(checked) => updateConfig({ ssl_verification: checked })}
                    />
                    <Label>Verificación SSL</Label>
                  </div>
                </div>
              </div>

              {onTestAction && (
                <div className="pt-4">
                  <Button type="button" onClick={onTestAction} className="w-full">
                    <TestTube className="h-4 w-4 mr-2" />
                    Probar API
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}