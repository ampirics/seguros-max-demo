"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Plus, 
  Settings, 
  PlayCircle, 
  Pause, 
  Trash2, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Building2,
  Lock,
  Loader2,
  Zap,
  Shield,
  Bot
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import apiClientInstance from "@/lib/api-client"
import { AdminLayout } from "@/components/admin/admin-layout"
import { useAdmin } from "@/contexts/admin-context"
import { useCompany } from "@/contexts/company-context"
import { AdvancedAuthComponent } from "@/components/admin/advanced-auth-component"

interface ApiIntegration {
  id: string
  integration_type?: string
  name: string
  description?: string
  api_url: string
  auth_type: string
  sync_frequency: string
  is_active: boolean
  last_sync_at?: string
  last_success_sync_at?: string
  created_at: string
  company_id?: string
  company_name?: string
}

interface Company {
  id: string
  name: string
}

interface MCPIntegrationSettings {
  disable_sap_validation: boolean
  mcp_enabled: boolean
  mcp_provider: string
  mcp_model: string
  mcp_system_prompt: string
  mcp_has_api_key: boolean
}

const MCP_PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
]

const MCP_MODEL_PRESETS_BY_PROVIDER: Record<string, Array<{ value: string; label: string }>> = {
  anthropic: [
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
}

const getMcpModelPresets = (provider: string) => MCP_MODEL_PRESETS_BY_PROVIDER[provider] || []

export default function ApiIntegrationsPage() {
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([])
  const [filteredIntegrations, setFilteredIntegrations] = useState<ApiIntegration[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [mcpLoading, setMcpLoading] = useState(true)
  const [mcpSaving, setMcpSaving] = useState(false)
  const [mcpApiKeyInput, setMcpApiKeyInput] = useState("")
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [mcpModelPreset, setMcpModelPreset] = useState<string>("claude-3-5-haiku-20241022")
  const [mcpSettings, setMcpSettings] = useState<MCPIntegrationSettings>({
    disable_sap_validation: false,
    mcp_enabled: false,
    mcp_provider: "anthropic",
    mcp_model: "claude-3-5-haiku-20241022",
    mcp_system_prompt: "",
    mcp_has_api_key: false,
  })
  
  // Estados para configuración avanzada de autenticación
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false)
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("")
  const [advancedAuthConfig, setAdvancedAuthConfig] = useState<any>({
    auth_type: 'none',
    auth_credentials: {},
    pre_auth_config: {
      enabled: false,
      method: 'POST',
      url: '',
      headers: {},
      body: {},
      token_path: 'access_token',
      token_variable: 'auth_token',
      refresh_threshold_minutes: 5
    },
    auth_variables: {},
    auth_refresh_config: {
      enabled: false,
      method: 'POST',
      url: '',
      headers: {},
      body: {},
      use_refresh_token: false
    },
    dynamic_headers: [],
    dynamic_query_params: [],
    auth_interceptors: [],
    request_interceptors: [],
    response_interceptors: []
  })
  const [testingAuth, setTestingAuth] = useState(false)
  
  const router = useRouter()
  // Usar apiClient centralizado
  const apiClient = apiClientInstance
  const { toast } = useToast()
  const { user, isLoading } = useAdmin()
  const { activeCompany } = useCompany()

  // Verificar autenticación y permisos
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/admin/login')
      return
    }

    if (user && !['super_admin', 'admin'].includes(user.role)) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta sección",
        variant: "destructive",
      })
      router.push('/admin')
      return
    }
  }, [user, isLoading, router, toast])

  // Cargar datos iniciales
  useEffect(() => {
    if (user && ['super_admin', 'admin'].includes(user.role)) {
      loadData()
    }
  }, [user])

  // Filtrar integraciones
  useEffect(() => {
    let filtered = integrations

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(integration => 
        integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        integration.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        integration.api_url.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por empresa (solo para super admin)
    if (user?.role === 'super_admin' && selectedCompany !== 'all') {
      filtered = filtered.filter(integration => integration.company_id === selectedCompany)
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(integration => integration.is_active)
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(integration => !integration.is_active)
      } else if (statusFilter === 'synced') {
        filtered = filtered.filter(integration => integration.last_success_sync_at)
      } else if (statusFilter === 'never_synced') {
        filtered = filtered.filter(integration => !integration.last_success_sync_at)
      }
    }

    setFilteredIntegrations(filtered)
  }, [integrations, searchTerm, selectedCompany, statusFilter, user])

  const loadData = async () => {
    try {
      setLoading(true)
      // Cargar integraciones
      const integrationsResponse = await apiClient.getApiIntegrations()
      setIntegrations(integrationsResponse)

      try {
        setMcpLoading(true)
        const companySettings = await apiClient.getCompanySettings()
        const nextSettings: MCPIntegrationSettings = {
          disable_sap_validation: Boolean(companySettings?.disable_sap_validation),
          mcp_enabled: Boolean(companySettings?.mcp_enabled),
          mcp_provider: companySettings?.mcp_provider || "anthropic",
          mcp_model: companySettings?.mcp_model || "claude-3-5-haiku-20241022",
          mcp_system_prompt: companySettings?.mcp_system_prompt || "",
          mcp_has_api_key: Boolean(companySettings?.mcp_has_api_key),
        }
        setMcpSettings(nextSettings)

        const presetExists = getMcpModelPresets(nextSettings.mcp_provider).some((preset) => preset.value === nextSettings.mcp_model)
        setMcpModelPreset(presetExists ? nextSettings.mcp_model : "custom")
      } catch (error) {
        console.error('Error loading MCP settings:', error)
      } finally {
        setMcpLoading(false)
      }

      // Cargar empresas (solo para super admin)
      if (user?.role === 'super_admin') {
        try {
          // NOTA: Si hay un método centralizado para companies, usarlo aquí
          const companiesResponse = await apiClient.getCompanies()
          setCompanies(companiesResponse)
        } catch (error) {
          console.error('Error loading companies:', error)
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las integraciones",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveMcpSettings = async () => {
    try {
      setMcpSaving(true)
      const response = await apiClient.updateCompanySettings({
        disable_sap_validation: mcpSettings.disable_sap_validation,
        mcp_enabled: mcpSettings.mcp_enabled,
        mcp_provider: mcpSettings.mcp_provider,
        mcp_model: mcpSettings.mcp_model,
        mcp_system_prompt: mcpSettings.mcp_system_prompt?.trim() || null,
        mcp_api_key: mcpApiKeyInput.trim() || undefined,
      })

      const savedSettings = response?.settings || mcpSettings
      setMcpSettings((prev) => ({
        ...prev,
        disable_sap_validation: Boolean(savedSettings.disable_sap_validation),
        mcp_enabled: Boolean(savedSettings.mcp_enabled),
        mcp_provider: savedSettings.mcp_provider || prev.mcp_provider,
        mcp_model: savedSettings.mcp_model || prev.mcp_model,
        mcp_system_prompt: savedSettings.mcp_system_prompt || "",
        mcp_has_api_key: Boolean(savedSettings.mcp_has_api_key),
      }))
      setMcpApiKeyInput("")

      const savedModel = savedSettings.mcp_model || mcpSettings.mcp_model
      const savedProvider = savedSettings.mcp_provider || mcpSettings.mcp_provider
      const presetExists = getMcpModelPresets(savedProvider).some((preset) => preset.value === savedModel)
      setMcpModelPreset(presetExists ? savedModel : "custom")

      toast({
        title: "Integración MCP actualizada",
        description: "La configuración de MCP se guardó correctamente.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración de MCP.",
        variant: "destructive",
      })
    } finally {
      setMcpSaving(false)
    }
  }

  const currentMcpPresets = getMcpModelPresets(mcpSettings.mcp_provider)

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await apiClient.updateApiIntegration(id, { is_active: !currentState })
      setIntegrations(prev => 
        prev.map(integration => 
          integration.id === id 
            ? { ...integration, is_active: !currentState }
            : integration
        )
      )
      toast({
        title: "Integración actualizada",
        description: `La integración ha sido ${!currentState ? 'activada' : 'desactivada'}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la integración",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la integración "${name}"?\n\nEsta acción no se puede deshacer.`)) {
      return
    }
    try {
      await apiClient.deleteApiIntegration(id)
      setIntegrations(prev => prev.filter(integration => integration.id !== id))
      toast({
        title: "Integración eliminada",
        description: `La integración "${name}" ha sido eliminada`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la integración",
        variant: "destructive",
      })
    }
  }

  const handleSync = async (id: string, name: string) => {
    try {
      setSyncingIds(prev => new Set([...prev, id]))
      // No hay método específico en apiClient, usar request genérico
  await apiClient.syncApiIntegration(id)
      toast({
        title: "Sincronización iniciada",
        description: `La sincronización de "${name}" ha comenzado`,
      })
      // Recargar la lista para actualizar el timestamp
      setTimeout(() => {
        loadData()
      }, 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo iniciar la sincronización",
        variant: "destructive",
      })
    } finally {
      setSyncingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  // Funciones para configuración avanzada de autenticación
  const handleOpenAdvancedAuth = (integration: ApiIntegration) => {
    setSelectedIntegrationId(integration.id)
    
    // Cargar configuración existente si la hay
    setAdvancedAuthConfig({
      auth_type: integration.auth_type || 'none',
      auth_credentials: {},
      pre_auth_config: {
        enabled: false,
        method: 'POST',
        url: '',
        headers: {},
        body: {},
        token_path: 'access_token',
        token_variable: 'auth_token',
        refresh_threshold_minutes: 5
      },
      auth_variables: {},
      auth_refresh_config: {
        enabled: false,
        method: 'POST',
        url: '',
        headers: {},
        body: {},
        use_refresh_token: false
      },
      dynamic_headers: [],
      dynamic_query_params: [],
      auth_interceptors: [],
      request_interceptors: [],
      response_interceptors: []
    })
    
    setShowAdvancedAuth(true)
  }

  const handleSaveAdvancedAuth = async () => {
    try {
      setLoading(true)
      
      // Actualizar la integración con la nueva configuración
      await apiClient.updateApiIntegration(selectedIntegrationId, {
        auth_type: advancedAuthConfig.auth_type,
        auth_credentials: advancedAuthConfig.auth_credentials,
        pre_auth_config: advancedAuthConfig.pre_auth_config,
        auth_variables: advancedAuthConfig.auth_variables,
        auth_refresh_config: advancedAuthConfig.auth_refresh_config,
        dynamic_headers: advancedAuthConfig.dynamic_headers,
        dynamic_query_params: advancedAuthConfig.dynamic_query_params,
        auth_interceptors: advancedAuthConfig.auth_interceptors,
        request_interceptors: advancedAuthConfig.request_interceptors,
        response_interceptors: advancedAuthConfig.response_interceptors
      })
      
      toast({
        title: "Éxito",
        description: "Configuración de autenticación actualizada correctamente"
      })
      
      setShowAdvancedAuth(false)
      await loadData() // Recargar datos
      
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración de autenticación",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestAuth = async () => {
    try {
      setTestingAuth(true)
      
      // Llamar al endpoint de prueba de autenticación
      await apiClient.testApiIntegrationAuth(selectedIntegrationId, advancedAuthConfig)
      
      toast({
        title: "Éxito",
        description: "La autenticación funciona correctamente",
        variant: "default"
      })
      
    } catch (error: any) {
      toast({
        title: "Error de Autenticación",
        description: error.response?.data?.detail || "La autenticación falló",
        variant: "destructive"
      })
    } finally {
      setTestingAuth(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Nunca"
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (integration: ApiIntegration) => {
    if (!integration.is_active) {
      return <Badge variant="secondary">Inactiva</Badge>
    }
    
    if (!integration.last_success_sync_at) {
      return <Badge variant="outline">Sin sincronizar</Badge>
    }
    
    if (integration.last_sync_at === integration.last_success_sync_at) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Sincronizada</Badge>
    }
    
    return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Con errores</Badge>
  }

  const getSyncIcon = (integration: ApiIntegration) => {
    if (syncingIds.has(integration.id)) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
    }
    
    if (!integration.last_success_sync_at) {
      return <Clock className="h-4 w-4 text-gray-400" />
    }
    
    if (integration.last_sync_at === integration.last_success_sync_at) {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    
    return <AlertCircle className="h-4 w-4 text-yellow-600" />
  }

  // Mostrar loader mientras autentica
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  // Verificar permisos
  if (!['super_admin', 'admin'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Acceso denegado</h3>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Integraciones de APIs</h1>
            <p className="text-muted-foreground">
              Gestiona las integraciones con APIs externas para sincronizar productos
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title="Integraciones de APIs">
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Integración MCP (Asistente IA)
          </CardTitle>
          <CardDescription>
            Habilita MCP para la empresa activa y selecciona el modelo/GPT que deseas usar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mcpLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando configuración MCP...
            </div>
          ) : (
            <>
              {user.role === 'super_admin' && !activeCompany ? (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                  Selecciona una empresa en el selector superior para configurar MCP.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">Habilitar MCP</p>
                      <p className="text-sm text-muted-foreground">
                        Cuando está activo, el asistente MCP puede responder en el chat de esta empresa.
                      </p>
                    </div>
                    <Switch
                      checked={mcpSettings.mcp_enabled}
                      onCheckedChange={(checked) => setMcpSettings((prev) => ({ ...prev, mcp_enabled: checked }))}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Proveedor IA</Label>
                      <Select
                        value={mcpSettings.mcp_provider}
                        onValueChange={(value) => {
                          const nextPresets = getMcpModelPresets(value)
                          const nextModel = nextPresets[0]?.value || ""
                          setMcpModelPreset(nextModel || "custom")
                          setMcpSettings((prev) => ({
                            ...prev,
                            mcp_provider: value,
                            mcp_model: nextModel || prev.mcp_model,
                          }))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {MCP_PROVIDER_OPTIONS.map((provider) => (
                            <SelectItem key={provider.value} value={provider.value}>
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Modelo predefinido</Label>
                      <Select
                        value={mcpModelPreset}
                        onValueChange={(value) => {
                          setMcpModelPreset(value)
                          if (value !== "custom") {
                            setMcpSettings((prev) => ({ ...prev, mcp_model: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentMcpPresets.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              {preset.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Modelo/GPT personalizado</Label>
                      <Input
                        placeholder="Ej: gpt-4.1, gpt-4o, claude-sonnet-4"
                        value={mcpSettings.mcp_model}
                        onChange={(e) => {
                          setMcpModelPreset("custom")
                          setMcpSettings((prev) => ({ ...prev, mcp_model: e.target.value }))
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>API Key del proveedor</Label>
                    <Input
                      type="password"
                      placeholder={mcpSettings.mcp_has_api_key ? "API key configurada. Escribe una nueva para reemplazarla" : "Pega aquí la API key del proveedor IA"}
                      value={mcpApiKeyInput}
                      onChange={(e) => setMcpApiKeyInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {mcpSettings.mcp_has_api_key
                        ? "Si dejas este campo vacío, se conserva la API key actual."
                        : "La API key se guardará en la configuración de esta empresa."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>System Prompt MCP</Label>
                    <Textarea
                      value={mcpSettings.mcp_system_prompt}
                      onChange={(e) => setMcpSettings((prev) => ({ ...prev, mcp_system_prompt: e.target.value }))}
                      placeholder="Escribe el comportamiento base del asistente para esta empresa..."
                      rows={5}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveMcpSettings}
                      disabled={mcpSaving || !mcpSettings.mcp_provider.trim() || !mcpSettings.mcp_model.trim()}
                    >
                      {mcpSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando MCP...
                        </>
                      ) : (
                        <>
                          <Bot className="mr-2 h-4 w-4" />
                          Guardar Integración MCP
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-muted-foreground">
              Gestiona las integraciones con APIs externas para sincronizar productos
              {user.role === 'admin' && activeCompany && (
                <span className="ml-2 text-sm">• {activeCompany.name}</span>
              )}
          </p>
        </div>
        <Button onClick={() => router.push('/admin/api-integrations/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Integración
        </Button>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Búsqueda */}
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nombre, descripción o URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtro por empresa (solo super admin) */}
            {user.role === 'super_admin' && (
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger>
                    <Building2 className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filtro por estado */}
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                  <SelectItem value="synced">Sincronizadas</SelectItem>
                  <SelectItem value="never_synced">Sin sincronizar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resumen */}
            <div className="space-y-2">
              <Label>Resumen</Label>
              <div className="text-sm text-muted-foreground">
                <div>{filteredIntegrations.length} de {integrations.length} integraciones</div>
                <div>{filteredIntegrations.filter(i => i.is_active).length} activas</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de integraciones */}
      {filteredIntegrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {integrations.length === 0 ? 'No hay integraciones configuradas' : 'No se encontraron integraciones'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {integrations.length === 0 
                ? 'Crea tu primera integración para comenzar a sincronizar productos desde APIs externas'
                : 'Intenta ajustar los filtros de búsqueda'
              }
            </p>
            {integrations.length === 0 && (
              <Button onClick={() => router.push('/admin/api-integrations/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera integración
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => (
            <Card key={integration.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {integration.name}
                    {user.role === 'super_admin' && integration.company_name && (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {integration.company_name}
                      </Badge>
                    )}
                  </CardTitle>
                  {getStatusBadge(integration)}
                </div>
                <CardDescription>
                  {integration.description || "Sin descripción"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">URL:</span>
                    <span className="truncate ml-2 max-w-[200px]" title={integration.api_url}>
                      {integration.api_url}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Autenticación:</span>
                    <span className="capitalize">{integration.auth_type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frecuencia:</span>
                    <span className="capitalize">{integration.sync_frequency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Última sincronización:</span>
                    <div className="flex items-center space-x-1">
                      {getSyncIcon(integration)}
                      <span className="text-xs">
                        {formatDate(integration.last_sync_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(integration.integration_type === 'pricing'
                      ? `/admin/api-integrations/pricing/${integration.id}`
                      : `/admin/api-integrations/${integration.id}`)}
                  >
                    <Settings className="mr-1 h-3 w-3" />
                    Configurar
                  </Button>
                  
                  {/* Sin «Auth Avanzada»: abría vacío y al guardar borraba las
                      credenciales. La autenticación se edita en «Configurar». */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(integration.id, integration.is_active)}
                  >
                    {integration.is_active ? (
                      <>
                        <Pause className="mr-1 h-3 w-3" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-1 h-3 w-3" />
                        Activar
                      </>
                    )}
                  </Button>
                  
                  {/* Solo SAP sabe sincronizar: en los demás tipos el backend respondía 400. */}
                  {integration.is_active && ((integration as any).integration_type === 'sap_b1' || (integration as any).provider_key === 'sap_b1') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(integration.id, integration.name)}
                      disabled={syncingIds.has(integration.id)}
                    >
                      {syncingIds.has(integration.id) ? (
                        <>
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Sincronizar
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(integration.id, integration.name)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Configuración Avanzada de Autenticación */}
      <Dialog open={showAdvancedAuth} onOpenChange={setShowAdvancedAuth}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <span>Configuración Avanzada de Autenticación</span>
            </DialogTitle>
            <DialogDescription>
              Configura autenticación flexible como Postman: múltiples headers, OAuth2, 
              pre-autenticación, variables dinámicas y más.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <AdvancedAuthComponent
              config={advancedAuthConfig}
              onChangeAction={(config) => setAdvancedAuthConfig(config)}
              onTestAction={handleTestAuth}
              isTestingAuth={testingAuth}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowAdvancedAuth(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAdvancedAuth}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  )
}
