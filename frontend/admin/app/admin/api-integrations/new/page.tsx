"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Import specialized form components
import { ProductSyncForm } from "@/components/admin/integrations/product-sync-form"
import { WhatsAppForm } from "@/components/admin/integrations/whatsapp-form"
import { WhatsAppConnect } from "@/components/admin/integrations/whatsapp-connect"
import { CustomAPIForm } from "@/components/admin/integrations/custom-api-form"
import { OrderManagementForm } from "@/components/admin/integrations/order-management-form"
import { PaymentGatewayForm } from "@/components/admin/integrations/payment-gateway-form"
import { SAPForm } from "@/components/admin/integrations/sap-form"
import { SAPPaymentMethodsForm } from "@/components/admin/integrations/sap-payment-methods-form"
import { PBXForm, EMPTY_PBX_CONFIG, isPbxConfigComplete, type PBXConfig } from "@/components/admin/integrations/pbx-form"
import { 
  ArrowLeft,
  Plus,
  Trash2,
  TestTube,
  Save,
  AlertCircle,
  CheckCircle,
  Copy,
  Settings,
  Zap,
  Lock,
  Loader2,
  ArrowRight,
  Key
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { AdminLayout } from "@/components/admin/admin-layout"
import { useAdmin } from "@/contexts/admin-context"
import { useCompany } from "@/contexts/company-context"
import apiClientInstance from "@/lib/api-client"
import { runSapSyncJob, SapSyncProgress } from "@/lib/sap-sync"

interface FieldMapping {
  external_field: string
  internal_field: string
  transform: string
  is_required: boolean
}

interface ApiIntegration {
  id?: string
  name: string
  description: string
  integration_type: string
  api_url: string
  http_method: string
  auth_type: string
  auth_credentials: Record<string, string>
  custom_headers: Record<string, string>
  query_params: Record<string, string>
  request_body: Record<string, any>
  field_mappings: FieldMapping[]
  product_identifier_field: string
  external_identifier_field: string
  sync_frequency: string
  is_active: boolean
  auto_update_enabled: boolean
  config?: any // Configuración específica del tipo de integración
  provider_key?: string // sap_b1, pbx…
}

interface IntegrationTemplate {
  name: string
  description: string
  icon: string
  color: string
  fields: {
    required: string[]
    optional: string[]
  }
  default_values: Record<string, any>
  auth_types: string[]
  example_config: Record<string, any>
}

const defaultIntegration: ApiIntegration = {
  name: "",
  description: "",
  integration_type: "",
  api_url: "",
  http_method: "GET",
  auth_type: "none",
  auth_credentials: {},
  custom_headers: {},
  query_params: {},
  request_body: {},
  field_mappings: [],
  product_identifier_field: "sku",
  external_identifier_field: "",
  sync_frequency: "manual",
  is_active: true,
  auto_update_enabled: false
}

const internalFields = [
  { value: "name", label: "Nombre del producto" },
  { value: "description", label: "Descripción" },
  { value: "price", label: "Precio" },
  { value: "sku", label: "SKU" },
  { value: "external_category_code", label: "Código de categoría externa" },
  { value: "image", label: "Imagen principal" },
  { value: "is_visible", label: "Visible en tienda" }
]

export default function ApiIntegrationFormPage() {
  const [integration, setIntegration] = useState<ApiIntegration>(defaultIntegration)
  const [templates, setTemplates] = useState<Record<string, IntegrationTemplate>>({})
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState("type")
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [templateError, setTemplateError] = useState<string | null>(null)
  
  // Estados para configuraciones especializadas
  const [productSyncConfig, setProductSyncConfig] = useState<any>({
    api_url: "",
    http_method: "GET",
    auth_type: "none",
    auth_credentials: {
      api_key: "",
      header_name: "X-API-Key",
      token: "",
      username: "",
      password: ""
    },
    field_mappings: [],
    sync_frequency: "manual",
    auto_update_enabled: false,
    category_mapping_enabled: false
  })
  
  const [whatsappConfig, setWhatsappConfig] = useState<any>({
    phone_number_id: "",
    access_token: "",
    verify_token: "",
    business_account_id: "",
    app_id: "",
    app_secret: "",
    webhook_config: {
      url: "",
      verify_token: "",
      webhook_url: "",
      events: ["messages", "message_deliveries", "message_reads"],
      fields: ["messages", "message_deliveries"]
    },
    message_templates: [],
    auto_responses: {
      enabled: false,
      welcome_message: "",
      default_response: ""
    },
    business_hours: {
      enabled: false,
      start_time: "09:00",
      end_time: "17:00",
      timezone: "America/Santo_Domingo"
    },
    rate_limit: {
      messages_per_minute: 60,
      messages_per_day: 1000
    }
  })
  
  const [customApiConfig, setCustomApiConfig] = useState<any>({
    api_url: "",
    http_method: "GET",
    auth_type: "none",
    auth_credentials: {},
    headers: [],
    query_params: [],
    request_body: {},
    response_format: "json",
    auth: {
      type: "none",
      api_key: { key: "", value: "", add_to: "header" },
      bearer: { token: "", prefix: "Bearer" },
      basic: { username: "", password: "" }
    },
    body: {
      type: "json",
      json_content: "",
      form_data: [],
      raw_content: ""
    }
  })
  
  const [orderConfig, setOrderConfig] = useState<any>({
    api_url: "",
    http_method: "GET",
    auth_type: "none",
    auth_credentials: {},
    order_identifier_field: "id",
    external_order_identifier: "",
    status_mappings: [],
    field_mappings: [],
    sync_frequency: "manual",
    auto_status_update: false,
    webhook_enabled: false,
    webhook_url: ""
  })
  
  const [paymentConfig, setPaymentConfig] = useState<any>({
    provider: "azul",
    environment: "sandbox",
    merchant_id: "",
    api_credentials: {},
    supported_currencies: ["DOP"],
    supported_payment_methods: ["card"],
    webhook_config: {
      enabled: false,
      url: "",
      events: []
    },
    security_settings: {
      require_cvv: true,
      require_3ds: false,
      fraud_detection: true
    },
    transaction_limits: {
      min_amount: 1,
      max_amount: 1000000
    },
    fees_config: {
      percentage_fee: 0,
      fixed_fee: 0,
      currency: "DOP"
    }
  })
  
  const [sapConfig, setSapConfig] = useState<any>({
    service_layer_url: "",
    CompanyDB: "",
    UserName: "",
    Password: "",
    verify_ssl: false,
    timeout: 30,
    price_list: 2,
    warehouse_id: "4",
    use_generated_skus: true,
    unmatched_action: "skip",
    sync_frequency: "manual",
    auto_update_enabled: false
  })

  const [sapSyncProgress, setSapSyncProgress] = useState<SapSyncProgress | null>(null)

  const [pbxConfig, setPbxConfig] = useState<PBXConfig>(EMPTY_PBX_CONFIG)

  // SAP y PBX se configuran enteros en "Configuración Específica": no usan URL, frecuencia ni auth genéricos
  const configuredInSpecificStep = ['sap_b1', 'pbx'].includes(integration.integration_type)

  const router = useRouter()
  const params = useParams()
  const apiClient = apiClientInstance
  const { toast } = useToast()
  const { user, isLoading } = useAdmin()
  const { activeCompany } = useCompany()
  const isEditing = !!(params?.id)
  // Con el login de Meta la configuración manual casi nunca hace falta; se
  // abre sola al editar una integración que se configuró a mano.
  const [showManualWhatsApp, setShowManualWhatsApp] = useState(false)

  // Helper function para obtener URLs de pasarelas de pago
  const getPaymentGatewayUrl = (provider: string, environment: string): string => {
    const urls = {
      azul: {
        sandbox: 'https://pruebas.azul.com.do/WebServices/JSON/Default.aspx',
        production: 'https://pagos.azul.com.do/WebServices/JSON/Default.aspx'
      },
      boton_popular: {
        sandbox: 'https://sandbox.popular.com.do/api/v1/payments',
        production: 'https://api.popular.com.do/v1/payments'
      },
      stripe: {
        sandbox: 'https://api.stripe.com/v1',
        production: 'https://api.stripe.com/v1'
      },
      custom: {
        sandbox: '',
        production: ''
      }
    }
    return urls[provider as keyof typeof urls]?.[environment as keyof typeof urls.azul] || ''
  }

  const steps = [
    { id: "type", title: "Tipo de Integración", icon: "🎯" },
    { id: "basic", title: "Configuración Básica", icon: <Settings className="h-4 w-4" /> },
    { id: "auth", title: "Autenticación", icon: "🔐" },
    { id: "mapping", title: "Configuración Específica", icon: <Zap className="h-4 w-4" /> },
    { id: "test", title: "Pruebas", icon: <TestTube className="h-4 w-4" /> }
  ]

  // Cargar plantillas de integración
  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true)
      setTemplateError(null)
      const response = await apiClient.request<any>('/admin/integrations/templates')
      setTemplates(response.templates || {})
      setCategories(response.categories || [])
    } catch (error) {
      console.error('🚫 [ERROR] Error cargando plantillas:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setTemplateError(errorMessage)
      toast({
        title: "Error",
        description: `No se pudieron cargar las plantillas: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setLoadingTemplates(false)
    }
  }

  // Aplicar plantilla seleccionada
  const applyTemplate = (templateKey: string) => {
    const template = templates[templateKey]
    if (!template) return
    if (templateKey === 'pricing') {
      // Gestión de precios tiene su propio editor (petición tipo Postman, mapeo y webhook).
      router.push('/admin/api-integrations/pricing/new')
      return
    }

    setIntegration(prev => ({
      ...prev,
      integration_type: templateKey,
      name: template.name,
      description: template.description,
      ...template.default_values,
      // Aplicar configuración de ejemplo si existe
      ...(template.example_config || {})
    }))

    // Avanzar al siguiente paso automáticamente
    setCurrentStep("basic")
  }

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

  // Cargar plantillas al montar el componente
  useEffect(() => {
    // Cargar plantillas cuando el usuario esté disponible O cuando termine de cargar (para test)
    if (user || (!isLoading && !user)) {
      loadTemplates()
    }
  }, [user, isLoading])

  useEffect(() => {
    if (isEditing && user) {
      loadIntegration()
    }
  }, [params?.id, user])

  // Funciones de validación por paso
  const validateTypeStep = () => {
    return !!integration.integration_type
  }

  const validateBasicStep = () => {
    // Para SAP y PBX, solo requerimos nombre (la conexión se configura en su formulario)
    if (configuredInSpecificStep) {
      return !!integration.name
    }
    return !!(integration.name && integration.api_url)
  }

  const validateAuthStep = () => {
    // Para SAP y PBX, la autenticación se configura en su formulario
    if (configuredInSpecificStep) return true
    if (integration.auth_type === 'none') return true
    
    const creds = integration.auth_credentials
    
    switch (integration.auth_type) {
      case 'api_key':
        return !!(creds.api_key && creds.header_name)
      case 'bearer_token':
        return !!creds.token
      case 'basic_auth':
        return !!(creds.username && creds.password)
      case 'custom_header':
        return !!(creds.header_name && creds.header_value)
      default:
        return true
    }
  }

  const validateMappingStep = () => {
    if (integration.integration_type === 'pbx') return isPbxConfigComplete(pbxConfig)

    // Para WhatsApp, pagos y SAP no requieren mapeo de campos manual
    if (['whatsapp', 'payment_gateway', 'sap_b1'].includes(integration.integration_type)) {
      return true
    }
    
    return integration.external_identifier_field && 
           integration.field_mappings.length > 0 && 
           integration.field_mappings.every(m => m.external_field && m.internal_field)
  }

  const validateTestStep = () => {
    return testResult && testResult.success
  }

  const canProceedToNext = () => {
    switch (currentStep) {
      case "type":
        return validateTypeStep()
      case "basic":
        return validateBasicStep()
      case "auth":
        return validateAuthStep()
      case "mapping":
        return validateMappingStep()
      case "test":
        return validateTestStep()
      default:
        return false
    }
  }

  const canCreateIntegration = () => {
    return validateTypeStep() && validateBasicStep() && validateAuthStep() && validateMappingStep() && 
           (integration.sync_frequency === 'manual' || validateTestStep())
  }

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep)
  }

  const goToNextStep = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id)
    }
  }

  const goToPreviousStep = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id)
    }
  }

  const getStepStatus = (stepId: string) => {
    switch (stepId) {
      case "type":
        return validateTypeStep() ? "completed" : "pending"
      case "basic":
        return validateBasicStep() ? "completed" : "pending"
      case "auth":
        return validateAuthStep() ? "completed" : "pending"
      case "mapping":
        return validateMappingStep() ? "completed" : "pending"
      case "test":
        return validateTestStep() ? "completed" : "pending"
      default:
        return "pending"
    }
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

  const loadIntegration = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getApiIntegration(String(params?.id))
      if (response?.integration_type === 'pricing') {
        router.replace(`/admin/api-integrations/pricing/${params?.id}`)
        return
      }
      setIntegration(response)
      
      // En modo edición, ir directamente a configuración específica
      setCurrentStep("mapping")
      
      // Si es SAP, cargar los datos en sapConfig
      if (response.integration_type === 'sap_b1' || response.provider_key === 'sap_b1') {
        const creds = response.auth_credentials || {}
        const config = response.config || {}
        const syncSettings = config.sync_settings || {}
        setSapConfig({
          service_layer_url: creds.service_layer_url || response.api_url || "",
          CompanyDB: creds.company_db || creds.CompanyDB || "",
          UserName: creds.username || creds.UserName || "",
          Password: creds.password || creds.Password || "",
          verify_ssl: config.verify_ssl ?? false,
          timeout: config.timeout ?? 30,
          price_list: config.price_list ?? 1,
          warehouse_id: config.warehouse_id || "WH001",
          use_generated_skus: config.use_generated_skus ?? true,
          unmatched_action: config.unmatched_action || "skip",
          sync_frequency: response.sync_frequency || "manual",
          auto_update_enabled: response.auto_update_enabled ?? false,
          sync: config.sync,
          // Performance / sync_settings (per-company override de defaults backend)
          chunk_size: syncSettings.chunk_size,
          connection_timeout: syncSettings.connection_timeout,
          query_timeout: syncSettings.query_timeout,
          max_retries: syncSettings.max_retries,
          retry_backoff: syncSettings.retry_backoff,
          rate_limit: syncSettings.rate_limit,
          max_concurrent_syncs: syncSettings.max_concurrent_syncs,
        })
      }
      
      if (response.integration_type === 'pbx' || response.provider_key === 'pbx') {
        const creds = response.auth_credentials || {}
        const cfg = response.config || {}
        setPbxConfig({
          sip_server: creds.sip_server || response.api_url || "",
          sip_domain: creds.sip_domain || "",
          sip_extension: creds.sip_extension || "",
          sip_password: creds.sip_password || "",
          ai_mode: cfg.ai_mode || "general",
          ai_anthropic_key: cfg.ai_anthropic_key || "",
          ai_deepgram_key: cfg.ai_deepgram_key || "",
          ai_model: cfg.ai_model || "claude-haiku-4-5-20251001",
          ai_voice: cfg.ai_voice || "es-DO-EmilioNeural",
          ai_system_prompt: cfg.ai_system_prompt || "",
        })
      }

      // Si es WhatsApp, cargar whatsappConfig
      if (response.integration_type === 'whatsapp') {
        const config = response.config || {}
        setWhatsappConfig({
          ...whatsappConfig,
          ...config,
          access_token: response.auth_credentials?.token || config.access_token || ""
        })
        if (!config.embedded_signup && config.phone_number_id) setShowManualWhatsApp(true)
      }
      
      // Si es product sync, cargar productSyncConfig
      if (response.integration_type === 'actualizacion_productos') {
        setProductSyncConfig({
          ...productSyncConfig,
          ...response.config,
          api_url: response.api_url,
          http_method: response.http_method,
          auth_type: response.auth_type,
          auth_credentials: response.auth_credentials || {},
          field_mappings: response.field_mappings || []
        })
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar la integración",
        variant: "destructive",
      })
      router.push('/admin/api-integrations')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!integration.name || !integration.integration_type) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      
      // Construir el payload basado en el tipo de integración
      let finalIntegration = { ...integration }
      
      // Agregar configuración específica basada en el tipo
      switch (integration.integration_type) {
        case 'actualizacion_productos':
          finalIntegration = {
            ...finalIntegration,
            api_url: productSyncConfig.api_url,
            http_method: productSyncConfig.http_method,
            auth_type: productSyncConfig.auth_type,
            auth_credentials: productSyncConfig.auth_credentials,
            field_mappings: productSyncConfig.field_mappings,
            sync_frequency: productSyncConfig.sync_frequency,
            auto_update_enabled: productSyncConfig.auto_update_enabled,
            config: productSyncConfig
          }
          break
          
        case 'whatsapp':
          finalIntegration = {
            ...finalIntegration,
            api_url: `https://graph.facebook.com/v18.0/${whatsappConfig.phone_number_id}/messages`,
            http_method: 'POST',
            auth_type: 'bearer_token',
            auth_credentials: { token: whatsappConfig.access_token },
            config: whatsappConfig
          }
          break
          
        case 'gestion_ordenes':
          finalIntegration = {
            ...finalIntegration,
            api_url: orderConfig.api_url,
            http_method: orderConfig.http_method,
            auth_type: orderConfig.auth_type,
            auth_credentials: orderConfig.auth_credentials,
            sync_frequency: orderConfig.sync_frequency,
            config: orderConfig
          }
          break
          
        case 'pasarela_pagos':
          finalIntegration = {
            ...finalIntegration,
            api_url: getPaymentGatewayUrl(paymentConfig.provider, paymentConfig.environment),
            auth_type: 'api_key',
            auth_credentials: paymentConfig.api_credentials,
            config: paymentConfig
          }
          break
          
        case 'custom':
          finalIntegration = {
            ...finalIntegration,
            api_url: customApiConfig.api_url,
            http_method: customApiConfig.http_method,
            auth_type: customApiConfig.auth_type,
            auth_credentials: customApiConfig.auth_credentials,
            custom_headers: customApiConfig.headers,
            query_params: customApiConfig.query_params,
            request_body: customApiConfig.request_body,
            config: customApiConfig
          }
          break
          
        case 'sap_b1':
          finalIntegration = {
            ...finalIntegration,
            provider_key: 'sap_b1',
            api_url: sapConfig.service_layer_url,
            http_method: 'POST',
            auth_type: 'basic_auth',
            auth_credentials: {
              service_layer_url: sapConfig.service_layer_url,
              company_db: sapConfig.CompanyDB,
              username: sapConfig.UserName,
              password: sapConfig.Password
            },
            config: {
              price_list: sapConfig.price_list,
              warehouse_id: sapConfig.warehouse_id,
              use_generated_skus: sapConfig.use_generated_skus,
              unmatched_action: sapConfig.unmatched_action,
              verify_ssl: sapConfig.verify_ssl,
              timeout: sapConfig.timeout,
              // Horario por proceso: es la fuente de verdad del scheduler.
              sync: sapConfig.sync,
              sync_settings: {
                chunk_size: sapConfig.chunk_size,
                connection_timeout: sapConfig.connection_timeout,
                query_timeout: sapConfig.query_timeout,
                max_retries: sapConfig.max_retries,
                retry_backoff: sapConfig.retry_backoff,
                rate_limit: sapConfig.rate_limit,
                max_concurrent_syncs: sapConfig.max_concurrent_syncs,
              },
            },
            sync_frequency: sapConfig.sync_frequency,
            auto_update_enabled: sapConfig.auto_update_enabled
          }
          break

        case 'pbx':
          finalIntegration = {
            ...finalIntegration,
            provider_key: 'pbx',
            api_url: pbxConfig.sip_server.trim(),
            http_method: 'GET',
            auth_type: 'basic_auth',
            auth_credentials: {
              sip_server: pbxConfig.sip_server.trim(),
              sip_domain: pbxConfig.sip_domain.trim(),
              sip_extension: pbxConfig.sip_extension.trim(),
              sip_password: pbxConfig.sip_password
            },
            config: {
              features: { softphone: true },
              ai_mode: pbxConfig.ai_mode,
              ai_anthropic_key: pbxConfig.ai_anthropic_key,
              ai_deepgram_key: pbxConfig.ai_deepgram_key,
              ai_model: pbxConfig.ai_model,
              ai_voice: pbxConfig.ai_voice,
              ai_system_prompt: pbxConfig.ai_system_prompt,
            },
            field_mappings: [],
            sync_frequency: 'manual',
            auto_update_enabled: false
          }
          break
      }
      
      if (isEditing) {
        await apiClient.updateApiIntegration(String(params?.id), finalIntegration)
        toast({
          title: "Integración actualizada",
          description: "La integración ha sido actualizada exitosamente",
        })
      } else {
        await apiClient.createApiIntegration(finalIntegration)
        toast({
          title: "Integración creada",
          description: "La integración ha sido creada exitosamente",
        })
      }
      
      router.push('/admin/api-integrations')
    } catch (error: any) {
      console.error('Error completo:', error)
      console.error('Error response:', error.response?.data)
      toast({
        title: "Error",
        description: error.response?.data?.detail || error.message || "No se pudo guardar la integración",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Prueba real contra la integración guardada (antes: «éxito» simulado y, en
  // los formularios por tipo, un console.log).
  const handleTestConnection = async () => {
    if (!isEditing || !params?.id) {
      toast({
        title: "Guarda primero",
        description: "Guarda la integración y luego prueba la conexión desde su ficha.",
      })
      return
    }
    try {
      setTesting(true)
      const response: any = await apiClient.request(`/admin/integrations/${params.id}/test`)
      setTestResult(response)
      toast({
        title: response.success ? "Conexión correcta" : "Error de conexión",
        description: response.message,
        variant: response.success ? undefined : "destructive",
      })
    } catch (error: any) {
      setTestResult({ success: false, message: error?.message })
      toast({
        title: "No se pudo probar",
        description: error?.message || "Error al probar la conexión",
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }


  const addFieldMapping = () => {
    setIntegration(prev => ({
      ...prev,
      field_mappings: [...prev.field_mappings, {
        external_field: "",
        internal_field: "",
        transform: "none",
        is_required: false
      }]
    }))
  }

  const updateFieldMapping = (index: number, field: keyof FieldMapping, value: any) => {
    setIntegration(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.map((mapping, i) => 
        i === index ? { ...mapping, [field]: value } : mapping
      )
    }))
  }

  const removeFieldMapping = (index: number) => {
    setIntegration(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.filter((_, i) => i !== index)
    }))
  }

  const addKeyValuePair = (section: 'custom_headers' | 'query_params', key: string = "", value: string = "") => {
    setIntegration(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }))
  }

  const updateKeyValuePair = (section: 'custom_headers' | 'query_params', oldKey: string, newKey: string, value: string) => {
    setIntegration(prev => {
      const updated = { ...prev[section] }
      if (oldKey !== newKey) {
        delete updated[oldKey]
      }
      updated[newKey] = value
      return { ...prev, [section]: updated }
    })
  }

  const removeKeyValuePair = (section: 'custom_headers' | 'query_params', key: string) => {
    setIntegration(prev => {
      const updated = { ...prev[section] }
      delete updated[key]
      return { ...prev, [section]: updated }
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mt-2 animate-pulse"></div>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <AdminLayout title={isEditing ? 'Editar Integración' : 'Nueva Integración de API'}>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEditing ? 'Editar Integración' : 'Nueva Integración'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Modifica la configuración de la integración' : 'Configura una nueva integración de API externa'}
              {user.role === 'admin' && activeCompany && (
                <span className="ml-2 text-sm">• {activeCompany.name}</span>
              )}
            </p>
          </div>
        </div>

      <form onSubmit={handleSubmit}>
        {/* Indicador de progreso */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const status = getStepStatus(step.id)
              const isActive = currentStep === step.id
              const isCompleted = status === "completed"
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex items-center">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                        ${isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : isCompleted 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div className={`
                      w-12 h-0.5 mx-4
                      ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Tabs value={currentStep} onValueChange={setCurrentStep} className="space-y-6">
          <TabsList className="hidden">
            {steps.map((step) => (
              <TabsTrigger key={step.id} value={step.id}>
                {typeof step.icon === 'string' ? step.icon : step.icon}
                <span className="ml-2">{step.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Paso 1: Selección de Tipo de Integración */}
          <TabsContent value="type" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    🎯 Selecciona el Tipo de Integración
                  </span>
                  {validateTypeStep() && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Tipo Seleccionado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Elige el tipo de integración que mejor se adapte a tus necesidades
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando opciones...</span>
                  </div>
                ) : templateError ? (
                  <div className="flex flex-col items-center justify-center py-8 text-red-600">
                    <AlertCircle className="h-8 w-8 mr-2" />
                    <div className="text-center mb-4">
                      <p className="font-semibold">Error cargando plantillas</p>
                      <p className="text-sm">{templateError}</p>
                    </div>
                    <Button onClick={loadTemplates} variant="outline" className="mt-2">
                      Reintentar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {categories.map((category) => (
                      <div key={category.id} className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {category.types.map((typeKey: string) => {
                            const template = templates[typeKey]
                            if (!template) return null
                            
                            const isSelected = integration.integration_type === typeKey
                            const colorClass = {
                              blue: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
                              green: 'border-green-200 bg-green-50 hover:bg-green-100',
                              emerald: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
                              purple: 'border-purple-200 bg-purple-50 hover:bg-purple-100',
                              teal: 'border-teal-200 bg-teal-50 hover:bg-teal-100',
                              amber: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
                              red: 'border-red-200 bg-red-50 hover:bg-red-100'
                            }[template.color] || 'border-gray-200 bg-gray-50 hover:bg-gray-100'

                            return (
                              <Card 
                                key={typeKey} 
                                className={`cursor-pointer transition-all hover:shadow-md ${
                                  isSelected 
                                    ? `ring-2 ring-blue-500 ${colorClass}` 
                                    : `border-2 ${colorClass}`
                                }`}
                                onClick={() => applyTemplate(typeKey)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start space-x-3">
                                    <div className="text-2xl">{template.icon}</div>
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-sm text-gray-900">
                                        {template.name}
                                      </h4>
                                      <p className="text-xs text-gray-600 mt-1">
                                        {template.description}
                                      </p>
                                      {isSelected && (
                                        <div className="flex items-center mt-2">
                                          <CheckCircle className="h-4 w-4 text-blue-600" />
                                          <span className="text-xs text-blue-600 ml-1 font-medium">
                                            Seleccionado
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Información adicional sobre la integración seleccionada */}
            {integration.integration_type && templates[integration.integration_type] && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {templates[integration.integration_type].icon} {templates[integration.integration_type].name}
                  </CardTitle>
                  <CardDescription>
                    Configuración que se aplicará automáticamente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Campos Requeridos:</h4>
                      <ul className="space-y-1">
                        {templates[integration.integration_type].fields.required.map((field) => (
                          <li key={field} className="flex items-center text-gray-600">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
                            {field}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Campos Opcionales:</h4>
                      <ul className="space-y-1">
                        {templates[integration.integration_type].fields.optional.map((field) => (
                          <li key={field} className="flex items-center text-gray-600">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></div>
                            {field}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              
              <Button
                type="button"
                onClick={goToNextStep}
                disabled={!canProceedToNext()}
                className={`transition-all duration-300 ${
                  canProceedToNext() 
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {canProceedToNext() ? 'Continuar con Configuración' : 'Selecciona un Tipo'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Información General
                  {validateBasicStep() && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completo
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {integration.integration_type === 'sap_b1' 
                    ? 'Nombre y descripción de la integración SAP'
                    : integration.integration_type === 'pbx'
                    ? 'Nombre y descripción de la central telefónica'
                    : 'Configuración básica de la integración'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center">
                      Nombre de la integración *
                      {!integration.name && (
                        <AlertCircle className="h-3 w-3 ml-1 text-red-500" />
                      )}
                    </Label>
                    <Input
                      id="name"
                      value={integration.name}
                      onChange={(e) => setIntegration(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={integration.integration_type === 'sap_b1' ? "Ej: SAP B1 Producción" : "Ej: API de Productos Principal"}
                      className={!integration.name ? 'border-red-300' : ''}
                    />
                  </div>
                  
                  {!configuredInSpecificStep && (
                    <div className="space-y-2">
                      <Label htmlFor="sync_frequency">Frecuencia de sincronización</Label>
                      <Select
                        value={integration.sync_frequency}
                        onValueChange={(value) => setIntegration(prev => ({ ...prev, sync_frequency: value }))}
                      >
                        <SelectTrigger id="sync_frequency">
                          <SelectValue placeholder="Selecciona frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="hourly">Cada hora</SelectItem>
                          <SelectItem value="daily">Diario</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={integration.description}
                    onChange={(e) => setIntegration(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={integration.integration_type === 'sap_b1' 
                      ? "Ej: Conexión a SAP Business One para sincronización de precios e inventario"
                      : "Describe el propósito de esta integración..."}
                  />
                </div>

                {/* Solo mostrar URL y método HTTP si NO es SAP ni PBX */}
                {!configuredInSpecificStep && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="api_url" className="flex items-center">
                          URL de la API *
                          {!integration.api_url && (
                            <AlertCircle className="h-3 w-3 ml-1 text-red-500" />
                          )}
                        </Label>
                        <Input
                          id="api_url"
                          type="url"
                          value={integration.api_url}
                          onChange={(e) => setIntegration(prev => ({ ...prev, api_url: e.target.value }))}
                          placeholder="https://api.ejemplo.com/productos"
                          className={!integration.api_url ? 'border-red-300' : ''}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="http_method">Método HTTP</Label>
                        <Select
                          value={integration.http_method}
                          onValueChange={(value) => setIntegration(prev => ({ ...prev, http_method: value }))}
                        >
                          <SelectTrigger id="http_method">
                            <SelectValue placeholder="Selecciona método" />
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
                  </>
                )}

                {integration.integration_type === 'pbx' && (
                  <div className="p-4 bg-teal-50 dark:bg-teal-950 rounded-lg border border-teal-200 dark:border-teal-800">
                    <div className="flex items-start gap-3">
                      <Settings className="h-5 w-5 text-teal-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-teal-900 dark:text-teal-100">Configuración PBX</h4>
                        <p className="text-sm text-teal-700 dark:text-teal-300 mt-1">
                          El servidor, el dominio y la extensión SIP se configuran en el paso "Configuración Específica".
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info box para SAP */}
                {integration.integration_type === 'sap_b1' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">Configuración SAP</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          La URL del Service Layer, credenciales y opciones de sincronización se configuran en el paso "Configuración Específica".
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={integration.is_active}
                    onCheckedChange={(checked) => setIntegration(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Integración activa</Label>
                </div>

                {!configuredInSpecificStep && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto_update_enabled"
                      checked={integration.auto_update_enabled}
                      onCheckedChange={(checked) => setIntegration(prev => ({ ...prev, auto_update_enabled: checked }))}
                    />
                    <Label htmlFor="auto_update_enabled">Permitir creación automática de productos</Label>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auth" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Autenticación
                  {validateAuthStep() && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completo
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {integration.integration_type === 'sap_b1'
                    ? 'Las credenciales SAP se configuran en el siguiente paso'
                    : integration.integration_type === 'pbx'
                    ? 'Las credenciales de la extensión se configuran en el siguiente paso'
                    : 'Configura cómo autenticarse con la API externa'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integration.integration_type === 'pbx' ? (
                  <div className="p-6 bg-teal-50 dark:bg-teal-950 rounded-lg border border-teal-200 dark:border-teal-800">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-teal-100 dark:bg-teal-900 rounded-lg">
                        <Key className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-teal-900 dark:text-teal-100 text-lg">Autenticación SIP</h4>
                        <p className="text-teal-700 dark:text-teal-300 mt-2">
                          El teléfono se registra en la central con la extensión y su contraseña, que se configuran en el paso <strong>"Configuración Específica"</strong>.
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400">
                          <CheckCircle className="h-4 w-4" />
                          <span>Puedes continuar al siguiente paso</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : integration.integration_type === 'sap_b1' ? (
                  <div className="p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Key className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 text-lg">Autenticación SAP B1</h4>
                        <p className="text-blue-700 dark:text-blue-300 mt-2">
                          SAP Business One utiliza autenticación mediante sesión B1SESSION. Las credenciales (usuario, contraseña y base de datos de empresa) se configuran en el paso <strong>"Configuración Específica"</strong>.
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                          <CheckCircle className="h-4 w-4" />
                          <span>Puedes continuar al siguiente paso</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="auth_type">Tipo de autenticación</Label>
                      <Select
                        value={integration.auth_type}
                        onValueChange={(value) => {
                          let newCredentials = {}
                          
                          // Initialize credentials based on auth type
                          switch (value) {
                            case 'api_key':
                              newCredentials = { api_key: '', header_name: 'X-API-Key' }
                              break
                            case 'bearer_token':
                              newCredentials = { token: '' }
                              break
                            case 'basic_auth':
                              newCredentials = { username: '', password: '' }
                              break
                            case 'custom_header':
                              newCredentials = { header_name: '', header_value: '' }
                              break
                            default:
                              newCredentials = {}
                          }
                      
                      setIntegration(prev => ({ 
                        ...prev, 
                        auth_type: value,
                        auth_credentials: newCredentials
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin autenticación</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="bearer_token">Bearer Token</SelectItem>
                      <SelectItem value="basic_auth">Basic Auth</SelectItem>
                      <SelectItem value="custom_header">Header personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {integration.auth_type === 'api_key' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api_key">API Key</Label>
                      <Input
                        id="api_key"
                        type="password"
                        value={integration.auth_credentials.api_key || ''}
                        onChange={(e) => setIntegration(prev => ({
                          ...prev,
                          auth_credentials: { ...prev.auth_credentials, api_key: e.target.value }
                        }))}
                        placeholder="Tu API Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="header_name">Nombre del header</Label>
                      <Input
                        id="header_name"
                        value={integration.auth_credentials.header_name || 'X-API-Key'}
                        onChange={(e) => setIntegration(prev => ({
                          ...prev,
                          auth_credentials: { ...prev.auth_credentials, header_name: e.target.value }
                        }))}
                        placeholder="X-API-Key"
                      />
                    </div>
                  </div>
                )}

                {integration.auth_type === 'bearer_token' && (
                  <div className="space-y-2">
                    <Label htmlFor="token">Bearer Token</Label>
                    <Input
                      id="token"
                      type="password"
                      value={integration.auth_credentials.token || ''}
                      onChange={(e) => setIntegration(prev => ({
                        ...prev,
                        auth_credentials: { ...prev.auth_credentials, token: e.target.value }
                      }))}
                      placeholder="Tu Bearer Token"
                    />
                  </div>
                )}

                {integration.auth_type === 'basic_auth' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Usuario</Label>
                      <Input
                        id="username"
                        value={integration.auth_credentials.username || ''}
                        onChange={(e) => setIntegration(prev => ({
                          ...prev,
                          auth_credentials: { ...prev.auth_credentials, username: e.target.value }
                        }))}
                        placeholder="Usuario"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        id="password"
                        type="password"
                        value={integration.auth_credentials.password || ''}
                        onChange={(e) => setIntegration(prev => ({
                          ...prev,
                          auth_credentials: { ...prev.auth_credentials, password: e.target.value }
                        }))}
                        placeholder="Contraseña"
                      />
                    </div>
                  </div>
                )}

                {integration.auth_type === 'custom_header' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="custom_header_name">Nombre del header</Label>
                      <Input
                        id="custom_header_name"
                        value={integration.auth_credentials.header_name || ''}
                        onChange={(e) => setIntegration(prev => ({
                          ...prev,
                          auth_credentials: { ...prev.auth_credentials, header_name: e.target.value }
                        }))}
                        placeholder="X-Custom-Auth"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom_header_value">Valor del header</Label>
                      <Input
                        id="custom_header_value"
                        type="password"
                        value={integration.auth_credentials.header_value || ''}
                        onChange={(e) => setIntegration(prev => ({
                          ...prev,
                          auth_credentials: { ...prev.auth_credentials, header_value: e.target.value }
                        }))}
                        placeholder="Valor de autenticación"
                      />
                    </div>
                  </div>
                )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mapping" className="space-y-6">
            {/* Renderizar formularios especializados basados en el tipo de integración */}
            {integration.integration_type === 'actualizacion_productos' && (
              <ProductSyncForm
                config={productSyncConfig}
                onChangeAction={setProductSyncConfig}
                onTestAction={handleTestConnection}
              />
            )}
            
            {integration.integration_type === 'whatsapp' && (
              <div className="space-y-4">
                <WhatsAppConnect
                  integrationId={isEditing ? String(params?.id) : undefined}
                  config={whatsappConfig}
                  onConnected={(r) => {
                    // Ya quedó guardada en el backend: se abre (o recarga) la integración.
                    if (isEditing && String(params?.id) === r.integration_id) loadIntegration()
                    else router.push(`/admin/api-integrations/${r.integration_id}`)
                  }}
                />
                <button
                  type="button"
                  className="text-sm text-slate-600 underline-offset-2 hover:underline"
                  onClick={() => setShowManualWhatsApp((v) => !v)}
                >
                  {showManualWhatsApp ? "Ocultar configuración manual" : "Configuración manual (avanzado): token, webhook y plantillas"}
                </button>
                {showManualWhatsApp && (
                  <WhatsAppForm
                    config={whatsappConfig}
                    onChangeAction={setWhatsappConfig}
                    onTestAction={handleTestConnection}
                  />
                )}
              </div>
            )}
            
            {integration.integration_type === 'gestion_ordenes' && (
              <OrderManagementForm
                config={orderConfig}
                onChangeAction={setOrderConfig}
                onTestAction={handleTestConnection}
              />
            )}
            
            {integration.integration_type === 'pasarela_pagos' && (
              <PaymentGatewayForm
                config={paymentConfig}
                onChangeAction={setPaymentConfig}
                onTestAction={handleTestConnection}
              />
            )}
            
            {integration.integration_type === 'custom' && (
              <CustomAPIForm
                config={customApiConfig}
                onChangeAction={setCustomApiConfig}
                onTestAction={handleTestConnection}
              />
            )}
            
            {integration.integration_type === 'sap_b1' && (
              <SAPForm
                config={sapConfig}
                onChangeAction={setSapConfig}
                onTestAction={async () => {
                  try {
                    const response = await apiClient.post('/sap-sync/test-connection', {
                      service_layer_url: sapConfig.service_layer_url,
                      CompanyDB: sapConfig.CompanyDB,
                      UserName: sapConfig.UserName,
                      // La contraseña guardada llega enmascarada: si no se cambió, no se envía y SAP usa la guardada.
                      Password: sapConfig.Password && sapConfig.Password !== '********' ? sapConfig.Password : undefined,
                      verify_ssl: sapConfig.verify_ssl,
                    })
                    return response
                  } catch (error: any) {
                    return { success: false, message: error.message || 'Error de conexión' }
                  }
                }}
                syncProgress={sapSyncProgress}
                onPreviewSyncAction={async () => {
                  setSapSyncProgress({ current: 0, total: 0, message: 'Iniciando preview...' })
                  try {
                    const result = await runSapSyncJob('/sap-sync/sync-prices/preview', {
                      price_list: sapConfig.price_list,
                      use_generated_skus: sapConfig.use_generated_skus,
                      unmatched_action: sapConfig.unmatched_action,
                      dry_run: true,
                    }, {
                      onProgress: setSapSyncProgress,
                    })
                    return result
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error?.error || error?.message || 'Error al obtener vista previa',
                      variant: "destructive",
                    })
                    throw error
                  } finally {
                    setSapSyncProgress(null)
                  }
                }}
                onSyncAction={async () => {
                  setSapSyncProgress({ current: 0, total: 0, message: 'Iniciando sincronización...' })
                  try {
                    const result = await runSapSyncJob('/sap-sync/sync-prices', {
                      price_list: sapConfig.price_list,
                      use_generated_skus: sapConfig.use_generated_skus,
                      unmatched_action: sapConfig.unmatched_action,
                      dry_run: false,
                    }, {
                      onProgress: setSapSyncProgress,
                    })
                    toast({
                      title: "Sincronización completada",
                      description: `${result?.summary?.updated_count || 0} productos actualizados`,
                    })
                    return result
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error?.error || error?.message || 'Error al sincronizar',
                      variant: "destructive",
                    })
                    throw error
                  } finally {
                    setSapSyncProgress(null)
                  }
                }}
              />
            )}

            {integration.integration_type === 'sap_b1' && (
              <SAPPaymentMethodsForm enabled={isEditing} />
            )}

            {integration.integration_type === 'sap_b1' && (
              <Card>
                <CardHeader>
                  <CardTitle>Documentos SAP</CardTitle>
                  <CardDescription>
                    Campos que se envían en la orden, el pago, el anticipo y el picking: agrega U_, cambia valores
                    (fijos o según la pasarela) o deja de enviarlos, sin tocar código.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button type="button" variant="outline" onClick={() => router.push('/admin/api-integrations/sap-documents')}>
                    Configurar documentos SAP <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {integration.integration_type === 'pbx' && (
              <PBXForm config={pbxConfig} onChangeAction={setPbxConfig} />
            )}

            {!integration.integration_type && (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-gray-500">
                    <div className="text-4xl mb-4">🎯</div>
                    <h3 className="text-lg font-medium mb-2">Selecciona un tipo de integración</h3>
                    <p className="text-sm">Ve al paso anterior para elegir el tipo de integración que deseas configurar.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Probar Conexión
                  {validateTestStep() && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Prueba exitosa
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Verifica que la conexión con la API externa funcione correctamente
                  {integration.sync_frequency === 'manual' && (
                    <span className="block text-sm text-blue-600 mt-1">
                      ℹ️ Como la frecuencia es manual, la prueba es opcional
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing || !integration.api_url}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    {testing ? 'Probando...' : 'Probar Conexión'}
                  </Button>
                  
                  {testResult && (
                    <div className="flex items-center space-x-2">
                      {testResult.success ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <Badge variant="default">Conexión exitosa</Badge>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <Badge variant="destructive">Error de conexión</Badge>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {testResult && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {testResult.status_code && (
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Código de estado</Label>
                          <p className="text-sm text-muted-foreground">{testResult.status_code}</p>
                        </div>
                      )}
                      
                      {testResult.response_time_ms && (
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Tiempo de respuesta</Label>
                          <p className="text-sm text-muted-foreground">{testResult.response_time_ms.toFixed(0)}ms</p>
                        </div>
                      )}
                      
                      {testResult.success && (
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Estado</Label>
                          <p className="text-sm text-green-600">Exitoso</p>
                        </div>
                      )}
                    </div>
                    
                    {testResult.error_message && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-red-600">Error</Label>
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{testResult.error_message}</p>
                      </div>
                    )}
                    
                    {testResult.response_sample && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Muestra de respuesta</Label>
                        <div className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
                          <pre className="text-xs">{JSON.stringify(testResult.response_sample, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Botones de navegación */}
        <div className="flex justify-between items-center pt-6">
          <div>
            {getCurrentStepIndex() > 0 && (
              <Button type="button" variant="outline" onClick={goToPreviousStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
            )}
          </div>
          
          <div className="flex space-x-4">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancelar
            </Button>

            {/* En edición: guardar directo desde cualquier paso (sin recorrer el wizard) */}
            {isEditing && (
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            )}

            {getCurrentStepIndex() < steps.length - 1 ? (
              <Button 
                type="button" 
                onClick={goToNextStep}
                disabled={!canProceedToNext()}
              >
                Siguiente
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={saving || !canCreateIntegration()}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear')} Integración
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
    </AdminLayout>
  )
}
