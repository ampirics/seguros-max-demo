import type { StoreConfig } from './store-config-types'
// ApiClient.ts — Revisión y estandarización
// Nota: endpoints sin barra final, normalización de queries y headers,
// eliminación de duplicados y uso consistente de buildApiUrl.

import type {
  ApiResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  CreateProductRequest,
  UpdateProductRequest,
  ProductResponse,
  ProductsResponse,
  CreateOrderRequest,
  OrderResponse,
  OrdersResponse,
  CreateConversationRequest,
  ChatConversationResponse,
  ChatConversationsResponse,
  SendMessageRequest,
  ChatMessagesResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
  UsersResponse,
  ConversationNote,
} from './api-types'
import { config, buildApiUrl } from './config'

class ApiClient {
  // ===== Dashboard Admin Stats =====
  async getAdminDashboardStats(): Promise<any> {
    return this.request<any>('/admin/dashboard/stats')
  }
  // ===== Configuración de Tienda (CMS) =====

  async getStoreConfig(company_id?: string, noCache?: boolean, raw: boolean = true): Promise<ApiResponse<StoreConfig>> {
    const queryParams: any = company_id ? { company_id } : {}
    if (raw) {
      queryParams.raw = true
    }
    if (noCache) {
      queryParams.t = Date.now() // Cache buster
    }
    const query = this.buildQuery(queryParams)
    const res = await this.request(`/store-config${query}`)
    // Si la respuesta es un objeto plano, envuélvelo
    if (res && typeof res === 'object' && !('success' in res)) {
      return { success: true, data: res as StoreConfig } as ApiResponse<StoreConfig>
    }
    return res as ApiResponse<StoreConfig>
  }

  async updateStoreConfig(config: StoreConfig, company_id?: string): Promise<ApiResponse<StoreConfig>> {
    const query = this.buildQuery(company_id ? { company_id } : undefined)
    return this.request<ApiResponse<StoreConfig>>(`/store-config${query}`, {
      method: 'PUT',
      body: JSON.stringify(config),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ===== Métodos HTTP genéricos =====

  async get<T = any>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const query = this.buildQuery(params)
    return this.request<T>(`${endpoint}${query}`, { method: 'GET' })
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  private baseUrl: string
  private token: string | null = null
  private storeApiKey: string

  constructor(baseUrl?: string) {
    // Usar base URL sin versión; buildApiUrl se encarga de versionar y normalizar.
    this.baseUrl = baseUrl || config.api.baseUrl
    this.storeApiKey = config.apiKeys.store
    this.loadToken()
  }

  // ===== Utilidades privadas =====

  private loadToken() {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem(config.auth.tokenKey)

      if (storedToken) {
        // Verificar si el token no está expirado antes de usarlo
        try {
          const payload = JSON.parse(atob(storedToken.split('.')[1]))
          const currentTime = Math.floor(Date.now() / 1000)

          if (payload.exp && payload.exp > currentTime + 60) { // 60 segundos de buffer
            this.token = storedToken
          } else {
            localStorage.removeItem(config.auth.tokenKey)
            this.token = null
          }
        } catch (error) {
          console.warn('[apiClient.loadToken] Error verificando token, limpiando:', error)
          localStorage.removeItem(config.auth.tokenKey)
          this.token = null
        }
      } else {
        this.token = null
      }
    }
  }

  private buildQuery(params?: Record<string, unknown>): string {
    if (!params) return ''
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue
      sp.append(k, String(v))
    }
    const qs = sp.toString()
    return qs ? `?${qs}` : ''
  }

  private isPublicProductRoute(endpoint: string, method: string = 'GET'): boolean {
    // Solo GET, nunca admin ni auth
    if (method.toUpperCase() !== 'GET') return false;
    if (endpoint.startsWith('/admin') || endpoint.startsWith('/auth')) return false;
    // Rutas públicas típicas
    return (
      endpoint.startsWith('/products') ||
      endpoint.startsWith('/store-config') ||
      endpoint.startsWith('/bug-reports') ||
      endpoint.startsWith('/media')
    );
  }

  private requiresStoreApiKey(endpoint: string): boolean {
    // Rutas que requieren X-API-Key (para multi-tenant)
    return (
      endpoint.startsWith('/payments/') ||
      endpoint.startsWith('/public/payment-links/') ||
      endpoint.startsWith('/public/payment-providers') || // Siempre usar API Key para endpoints públicos de pago
      endpoint.startsWith('/customers') || // Los customers requieren API key para multi-tenant
      endpoint.startsWith('/customer-contacts') || // Contactos de clientes
      endpoint.includes('/calculate-taxes') || // Cálculo de impuestos en carrito (multi-tenant)
      endpoint.includes('/product-taxes') || // Impuestos de productos (multi-tenant)
      this.isPublicProductRoute(endpoint)
    );
  }

  private shouldAlwaysUseApiKey(endpoint: string): boolean {
    // Rutas que SIEMPRE deben usar API Key, incluso si no hay token JWT
    return (
      endpoint.startsWith('/public/payment-links/') ||
      endpoint.startsWith('/public/payment-providers')
    );
  }

  // Método base de request con normalización
  public async request<T>(endpoint: string, options: RequestInit = {}, retried = false): Promise<T> {
    // Asegurar que endpoint inicie con '/'
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = buildApiUrl(normalizedEndpoint)

    // Refrescar token (por si cambió en localStorage)
    this.loadToken()

    const headers: Record<string, string> = {}

    // Content-Type solo si el body no es FormData y si no viene ya en options
    const hasFormData = options.body instanceof FormData
    if (!hasFormData && !('Content-Type' in (options.headers || {}))) {
      // Para GET normalmente no se envía content-type, pero tampoco molesta
      if ((options.method || 'GET').toUpperCase() !== 'GET') {
        headers['Content-Type'] = 'application/json'
      }
    }

    // Para rutas públicas de pago, SIEMPRE usar API Key
    if (this.shouldAlwaysUseApiKey(normalizedEndpoint)) {
      if (this.storeApiKey) {
        headers['X-API-Key'] = this.storeApiKey
      }
    } else if (this.token) {
      // Sesión de admin: el JWT (con active_company_id) manda siempre.
      // La X-API-Key es una key fija de build (una sola empresa) y usarla
      // aquí haría que el backend resuelva la empresa equivocada.
      headers['Authorization'] = `Bearer ${this.token}`
      if (typeof window !== 'undefined') {
        const storedCompanyId = localStorage.getItem('active_company_id')
        if (storedCompanyId) {
          headers['X-Company-ID'] = storedCompanyId
          headers['X-Active-Company-Id'] = storedCompanyId
        }
      }
    } else if (this.requiresStoreApiKey(normalizedEndpoint) && this.storeApiKey) {
      headers['X-API-Key'] = this.storeApiKey
    }

    // DEBUG: Imprimir detalles de la petición
    if (process.env.NODE_ENV === 'development') {
    }

    const response = await fetch(url, {
      ...options,
      // La cookie httpOnly de refresco solo viaja a /auth/* (login la crea; refresh y logout la usan)
      ...(normalizedEndpoint.startsWith('/auth/') ? { credentials: 'include' as RequestCredentials } : {}),
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    })

    if (!response.ok) {
      // 401 = token expirado/inválido → limpiar sesión y redirigir al login
      if (response.status === 401) {
        const isPublicRoute = normalizedEndpoint.startsWith('/public/')
        if (!isPublicRoute && !retried && !normalizedEndpoint.startsWith('/auth/')) {
          if (await this.refreshSession()) {
            return this.request<T>(endpoint, options, true)
          }
        }
        if (!isPublicRoute) {
          console.warn('[apiClient.request] Token expirado o inválido, limpiando sesión')
          this.token = null
          if (typeof window !== 'undefined') {
            localStorage.removeItem(config.auth.tokenKey)
            const currentPath = window.location.pathname
            if (!currentPath.includes('/login') && !currentPath.includes('/auth') && !currentPath.includes('/pay')) {
              window.location.href = '/admin/login'
              return Promise.reject(new Error('Sesión expirada, redirigiendo al login'))
            }
          }
        }
      }
      // 403 = autenticado pero sin permisos → NO limpiar token, NO redirigir
      // El componente que llama recibirá el error y lo manejará apropiadamente

      let detail: string | undefined
      try {
        const err = await response.json()
        detail = err?.detail
      } catch {
        detail = await response.text()
      }

      if (response.status === 401) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
      }
      if (response.status === 403) {
        throw new Error(detail || 'No tienes permisos para realizar esta acción.')
      }

      throw new Error(detail || `API Error ${response.status}: ${response.statusText}`)
    }

    const ct = response.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      return response.json() as Promise<T>
    }
    // fallback a texto si no es JSON
    return (response.text() as unknown) as T
  }

  // ===== Autenticación =====

  async login(credentials: { username: string; password: string }): Promise<LoginResponse> {
    const formData = new FormData()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    const data = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: formData,
    })

    if (data?.access_token) {
      this.token = data.access_token
      if (typeof window !== 'undefined') {
        localStorage.setItem(config.auth.tokenKey, data.access_token)
        localStorage.setItem(ApiClient.SESSION_HINT, '1')
      }
    }

    return data
  }

  private refreshing: Promise<boolean> | null = null
  private refreshFailedAt = 0

  // Marca (no secreta) de que este navegador inició sesión y puede tener la
  // cookie httpOnly de refresco. Sin ella no se intenta renovar: antes, abrir el
  // login sin sesión disparaba /auth/refresh (401) varias veces en cada visita.
  private static SESSION_HINT = 'auth:has_refresh'

  /**
   * Renueva el token de acceso con la cookie httpOnly de refresco (JavaScript no
   * la puede leer). Una sola renovación a la vez aunque fallen varias peticiones.
   */
  async refreshSession(): Promise<boolean> {
    if (typeof window === 'undefined') return false
    if (!this.refreshing) {
      let hint: string | null = null
      try {
        // El token guardado también cuenta: sesiones abiertas antes de existir la marca.
        hint = localStorage.getItem(ApiClient.SESSION_HINT) || localStorage.getItem(config.auth.tokenKey)
      } catch { /* almacenamiento bloqueado */ }
      // Sin sesión previa, o un intento fallido hace segundos: no hay nada que renovar.
      if (!hint || Date.now() - this.refreshFailedAt < 10_000) return false
      this.refreshing = (async () => {
        try {
          const res = await fetch(buildApiUrl('/auth/refresh'), { method: 'POST', credentials: 'include' })
          if (!res.ok) {
            this.refreshFailedAt = Date.now()
            if (res.status === 401) localStorage.removeItem(ApiClient.SESSION_HINT)
            return false
          }
          const data = await res.json()
          if (!data?.access_token) return false
          this.token = data.access_token
          localStorage.setItem(config.auth.tokenKey, data.access_token)
          window.dispatchEvent(new Event('auth:token-changed'))
          return true
        } catch {
          return false
        } finally {
          setTimeout(() => { this.refreshing = null }, 0)
        }
      })()
    }
    return this.refreshing
  }

  async logout(): Promise<void> {
    // Revoca en el servidor todas las sesiones del usuario y borra la cookie de refresco.
    try {
      if (this.token) {
        await fetch(buildApiUrl('/auth/logout'), {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${this.token}` },
        })
      }
    } catch {
      /* sin red: igual se limpia la sesión local */
    }
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(config.auth.tokenKey)
      localStorage.removeItem(ApiClient.SESSION_HINT)
    }
  }

  async getCurrentUser(): Promise<UserResponse> {

    // Intentar cargar el token desde localStorage si no existe
    if (!this.token) {
      this.loadToken()
    }

    if (!this.token) {
      await this.refreshSession()
    }

    if (!this.token) {
      return null as any
    }

    try {
      const result = await this.request<UserResponse>('/auth/me')
      return result
    } catch (error) {
      console.error('[apiClient.getCurrentUser] Error en request:', error)
      // Si el error es 401, probablemente el token expiró
      if (error instanceof Error && error.message.includes('401')) {
        this.token = null
        if (typeof window !== 'undefined') {
          localStorage.removeItem(config.auth.tokenKey)
        }
      }
      throw error
    }
  }

  // ===== Integraciones de API (Admin) =====

  async getApiIntegrations(params?: { skip?: number; limit?: number }): Promise<any[]> {
    const query = this.buildQuery({
      skip: params?.skip ?? 0,
      limit: params?.limit ?? 50,
    })
    return this.request<any[]>(`/admin/integrations/${query}`)
  }

  async createApiIntegration(data: any): Promise<any> {
    return this.request<any>('/admin/integrations/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getApiIntegration(id: string): Promise<any> {
    return this.request<any>(`/admin/integrations/${id}`)
  }

  async updateApiIntegration(id: string, data: any): Promise<any> {
    return this.request<any>(`/admin/integrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteApiIntegration(id: string): Promise<void> {
    await this.request<void>(`/admin/integrations/${id}`, { method: 'DELETE' })
  }

  async syncApiIntegration(id: string): Promise<any> {
    return this.request<any>(`/admin/integrations/${id}/sync`, {
      method: 'POST',
      body: JSON.stringify({ integration_id: id, dry_run: false }),
    })
  }

  async testApiIntegrationAuth(id: string, config: any): Promise<any> {
    return this.request<any>(`/admin/integrations/${id}/test-auth`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async testApiConnection(data: any): Promise<any> {
    return this.request<any>('/admin/integrations/test-connection', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ===== Payment Providers (Admin) =====

  async getPaymentProviders(): Promise<any> {
    return this.request<any>('/payments/providers')
  }

  async getConfiguredPaymentProviders(): Promise<any> {
    return this.request<any>('/payments/providers/configured')
  }

  async getPaymentMethodFees(): Promise<any> {
    return this.request<any>('/payment-methods/fees')
  }

  async getPaymentMethodFee(paymentMethod: string, integrationId?: string): Promise<any> {
    const url = integrationId
      ? `/payment-methods/fees/${paymentMethod}?integration_id=${integrationId}`
      : `/payment-methods/fees/${paymentMethod}`
    return this.request<any>(url)
  }

  async createPaymentMethodFee(data: any): Promise<any> {
    return this.request<any>('/payment-methods/fees', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updatePaymentMethodFee(paymentMethod: string, data: any, integrationId?: string): Promise<any> {
    const url = integrationId
      ? `/payment-methods/fees/${paymentMethod}?integration_id=${integrationId}`
      : `/payment-methods/fees/${paymentMethod}`
    return this.request<any>(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async getPaymentIntegrations(): Promise<any[]> {
    // Usar el endpoint de payments que ya funciona
    const result = await this.request<any>('/payments/providers/configured');
    return result.providers || result;
  }

  async getPaymentIntegration(id: string): Promise<any> {
    // Usar el endpoint específico para obtener detalles completos por ID
    return this.request<any>(`/payments/integrations/${id}`);
  }

  async createPaymentIntegration(data: any): Promise<any> {
    // Usar el endpoint correcto de payments
    const providerKey = data.provider_key || 'azul';
    return this.request<any>(`/payments/providers/${providerKey}/configure`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePaymentIntegration(id: string, data: any): Promise<any> {
    // Usar el endpoint específico para updates por ID
    return this.request<any>(`/payments/integrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deletePaymentIntegration(id: string): Promise<any> {
    // Endpoint para desactivar/eliminar una integración
    return this.request<any>(`/payments/integrations/${id}`, {
      method: 'DELETE',
    })
  }

  // Payment Pages methods
  async getPaymentPages(): Promise<any[]> {
    return this.request<any[]>('/payment-pages/');
  }

  async getPaymentPage(pageType: string): Promise<any> {
    return this.request<any>(`/payment-pages/${pageType}`);
  }

  async savePaymentPage(pageType: string, data: any): Promise<any> {
    return this.request<any>(`/payment-pages/${pageType}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getPublicPaymentPage(companyId: string, pageType: string): Promise<any> {
    return this.request<any>(`/payment-pages/public/${companyId}/${pageType}`);
  }

  // ===== Productos (Store) =====

  // Obtiene productos públicos (sin requiere JWT)
  async getProducts(params?: { search?: string; skip?: number; limit?: number; category_code?: string; company_id?: string }): Promise<any[]> {
    const query = this.buildQuery({
      search: params?.search,
      skip: params?.skip,
      limit: params?.limit,
      category_code: params?.category_code,
    })
    return this.request<any[]>(`/products${query}`)
  }

  // Obtiene productos como admin (requiere JWT)
  /** Listado paginado en el servidor con total real. */
  async listAdminProducts(params: {
    search?: string; visibility?: 'all' | 'visible' | 'hidden'; price?: 'all' | 'zero' | 'priced';
    on_sale?: boolean; skip?: number; limit?: number
  }, signal?: AbortSignal): Promise<{ items: any[]; total: number }> {
    const query = this.buildQuery({ ...params, with_total: true })
    return this.request<{ items: any[]; total: number }>(`/admin/products${query}`, signal ? { signal } : {})
  }

  async getAdminProducts(params?: { visible_only?: boolean; search?: string; skip?: number; limit?: number; category_code?: string; company_id?: string }): Promise<any[]> {
    const query = this.buildQuery({
      visible_only: params?.visible_only,
      search: params?.search,
      skip: params?.skip,
      limit: params?.limit,
      category_code: params?.category_code,
    })
    return this.request<any[]>(`/admin/products${query}`)
  }

  // Obtiene un producto público (store)
  async getProduct(id: string): Promise<any> {
    return this.request<any>(`/products/${id}`)
  }

  // Obtiene un producto como admin (requiere JWT y permisos)
  async getAdminProduct(id: string): Promise<any> {
    return this.request<any>(`/admin/products/${id}`)
  }

  async createProduct(product: any): Promise<any> {
    return this.request<any>('/admin/products/', {
      method: 'POST',
      body: JSON.stringify(product),
    })
  }

  async importProductsFromCSV(csvFile: File, dryRun = false): Promise<any> {
    const formData = new FormData()
    formData.append('file', csvFile)

    return this.request<any>(`/admin/products/import-csv${dryRun ? '?dry_run=true' : ''}`, {
      method: 'POST',
      body: formData,
    })
  }

  async updateProduct(id: string, updates: any): Promise<any> {
    return this.request<any>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteProduct(id: string): Promise<void> {
    await this.request<void>(`/admin/products/${id}`, { method: 'DELETE' })
  }

  // ===== Órdenes =====

  async createOrder(orderData: any): Promise<any> {
    return this.request<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
  }

  async getOrders(params?: { skip?: number; limit?: number }): Promise<{ orders: any[]; total: number }> {
    const query = this.buildQuery({ skip: params?.skip, limit: params?.limit })
    return this.request<{ orders: any[]; total: number }>(`/orders${query}`)
  }

  async searchOrders(params?: {
    skip?: number
    limit?: number
    status?: string
    status_in?: string
    created_after?: string
    created_before?: string
    search_text?: string
    order_by?: string
    order_dir?: string
  }): Promise<{ orders: any[]; total: number; has_more: boolean; created_after?: string; created_before?: string }> {
    const query = this.buildQuery(params)
    return this.request<{ orders: any[]; total: number; has_more: boolean; created_after?: string; created_before?: string }>(`/orders/search${query}`)
  }

  async exportOrdersCsv(params?: {
    status?: string
    status_in?: string
    created_after?: string
    created_before?: string
    search_text?: string
    order_by?: string
    order_dir?: string
  }): Promise<string> {
    const query = this.buildQuery(params)
    return this.request<string>(`/orders/export/csv${query}`)
  }

  async getOrder(id: string): Promise<any> {
    return this.request<any>(`/orders/${id}`)
  }

  async updateOrderStatus(id: string, status: string): Promise<any> {
    return this.request<any>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  async updateOrder(id: string, orderData: any): Promise<any> {
    return this.request<any>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    })
  }

  async getOrderItems(orderId: string): Promise<any> {
    return this.request<any>(`/orders/${orderId}/items`)
  }

  async addOrderItem(orderId: string, itemData: any): Promise<any> {
    return this.request<any>(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify(itemData),
    })
  }

  async updateOrderItem(orderId: string, itemId: string, itemData: any): Promise<any> {
    return this.request<any>(`/orders/${orderId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    })
  }

  async deleteOrderItem(orderId: string, itemId: string): Promise<any> {
    return this.request<any>(`/orders/${orderId}/items/${itemId}`, {
      method: 'DELETE',
    })
  }

  async getAvailableProductsForOrder(orderId: string, search?: string, limit?: number): Promise<any> {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (limit) params.append('limit', limit.toString())

    const queryString = params.toString()
    const url = `/orders/${orderId}/available-products${queryString ? `?${queryString}` : ''}`

    return this.request<any>(url)
  }

  // ===== Chat =====

  async getConversations(params?: { skip?: number; limit?: number }): Promise<any[]> {
    const query = this.buildQuery({ skip: params?.skip, limit: params?.limit })
    return this.request<any[]>(`/chat/conversations${query}`)
  }

  /**
   * Listado liviano de conversaciones para el sidebar del chat: metadata + preview
   * del último mensaje (last_message_text, last_message_timestamp), SIN la lista
   * completa de mensajes. Reemplaza a getConversations() en el mount del chat
   * sin romper a callers que sí necesitan los mensajes inline.
   */
  async getConversationsLite(params?: { skip?: number; limit?: number }): Promise<any[]> {
    const query = this.buildQuery({ skip: params?.skip, limit: params?.limit })
    return this.request<any[]>(`/chat/conversations/lite${query}`)
  }

  /**
   * Lista compacta de conversaciones que solicitaron agente. Reemplaza al patrón
   * de pedir TODAS las conversaciones (con mensajes inline) sólo para filtrar
   * las que tienen agent_requested=true. Sirve para el indicador global del admin.
   */
  async getAgentRequests(params?: { limit?: number }): Promise<Array<{
    id: string
    customer_name: string
    customer_phone: string
    agent_requested_at: string | null
  }>> {
    const query = this.buildQuery({ limit: params?.limit })
    return this.request(`/chat/agent-requests${query}`)
  }

  // Summary endpoint used by admin dashboard (counts and optional top lists)
  async getConversationsSummary(params?: { days?: number; top_n?: number; include_lists?: boolean }): Promise<any> {
    const query = this.buildQuery({ days: params?.days, top_n: params?.top_n, include_lists: params?.include_lists })
    return this.request<any>(`/chat/conversations/summary${query}`)
  }

  async createConversation(conversation: any): Promise<any> {
    return this.request<any>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(conversation),
    })
  }

  async getMessages(conversationId: string, params?: { skip?: number; limit?: number }): Promise<any> {
    const query = this.buildQuery(params);
    return this.request<any>(`/chat/conversations/${conversationId}/messages${query}`)
  }

  async sendMessage(conversationId: string, message: any): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    })
  }

  async sendWhatsAppMessage(conversationId: string, message: any): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/send-whatsapp`, {
      method: 'POST',
      body: JSON.stringify(message),
    })
  }

  async sendWhatsAppQuickMessage(conversationId: string, messageData: any): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/send-whatsapp-quick`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    })
  }

  // Nuevo endpoint mejorado que usa específicamente las integraciones de la BD
  async sendWhatsAppWithIntegration(conversationId: string, data: {
    message: string,
    integration_id?: string,
    tempId?: string
  }): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/send-whatsapp-integration`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Obtener integraciones de WhatsApp disponibles para el chat
  async getWhatsAppIntegrations(): Promise<any> {
    return this.request<any>('/chat/whatsapp/integrations')
  }

  // Marcar que cliente solicita hablar con agente
  async requestAgent(conversationId: string): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/request-agent`, {
      method: 'POST'
    })
  }

  // Limpiar solicitud de agente (cuando agente responde)
  async clearAgentRequest(conversationId: string): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/clear-agent-request`, {
      method: 'POST'
    })
  }

  // ── Credenciales de aplicación (servidor-a-servidor, por empresa) ──

  async listAppCredentials(): Promise<any[]> {
    return this.request<any[]>('/admin/app-credentials/')
  }

  // Devuelve el secreto en claro UNA sola vez; no vuelve a ser recuperable.
  async createAppCredential(data: { name: string; description?: string; scopes?: string[] }): Promise<any> {
    return this.request<any>('/admin/app-credentials/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Emite un secreto nuevo dejando el anterior válido durante la ventana de
  // solapamiento, para no cortar el servicio mientras se actualiza el consumidor.
  async rotateAppCredential(credentialId: string): Promise<any> {
    return this.request<any>(`/admin/app-credentials/${credentialId}/rotate`, { method: 'POST' })
  }

  async revokeAppCredential(credentialId: string): Promise<void> {
    await this.request<void>(`/admin/app-credentials/${credentialId}`, { method: 'DELETE' })
  }

  async getAvailableScopes(): Promise<string[]> {
    return this.request<string[]>('/admin/app-credentials/available-scopes')
  }

  // Finalizar sesión de agente: devuelve al cliente al menú y marca resuelta
  async endAgentSession(conversationId: string): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/end-agent-session`, {
      method: 'POST'
    })
  }

  // Subir archivo multimedia para WhatsApp
  async uploadWhatsAppMedia(file: File, conversationId: string, caption: string = ""): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('conversation_id', conversationId)
    formData.append('caption', caption)

    return fetch(`${this.baseUrl}/media/whatsapp/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
  }

  // Enviar archivo multimedia por WhatsApp
  async sendWhatsAppMedia(conversationId: string, data: {
    media_url: string,
    media_type: string,
    caption?: string,
    filename?: string,
    tempId?: string
  }): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}/send-media-whatsapp`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Descargar archivo multimedia de WhatsApp
  async downloadWhatsAppMedia(mediaId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/media/whatsapp/download/${mediaId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.blob()
  }

  async detectCustomerWhatsApp(customerId: string): Promise<any> {
    return this.request<any>(`/chat/customers/${customerId}/detect-whatsapp`, {
      method: 'POST',
    })
  }

  async getWhatsAppStatus(): Promise<any> {
    return this.request<any>('/chat/whatsapp/status')
  }

  async getWhatsAppConfigStatus(): Promise<any> {
    return this.request<any>('/chat/whatsapp/config-status')
  }

  async testWhatsAppConnection(): Promise<any> {
    return this.request<any>('/chat/whatsapp/test', {
      method: 'POST',
    })
  }

  // ===== API Integrations =====

  async getIntegrations(params?: { integration_type?: string; is_active?: boolean }): Promise<any> {
    const query = this.buildQuery(params)
    return this.request<any>(`/admin/integrations${query}`)
  }

  async getIntegrationById(id: string): Promise<any> {
    return this.request<any>(`/admin/integrations/${id}`)
  }

  async getIntegrationTemplates(): Promise<any> {
    return this.request<any>('/admin/integrations/templates')
  }

  // ===== Clientes =====

  async getCustomers(params?: { skip?: number; limit?: number; phone?: string; document?: string; search?: string }): Promise<any> {
    const query = this.buildQuery({
      skip: params?.skip ?? 0,
      limit: params?.limit ?? 100,
      phone: params?.phone,
      document: params?.document,
      // La búsqueda la resuelve el backend: con miles de clientes, filtrar
      // solo la página cargada deja fuera casi todo.
      search: params?.search,
    })
    return this.request<any>(`/customers/${query}`)
  }

  async getCustomer(id: string): Promise<any> {
    return this.request<any>(`/customers/${id}`)
  }

  async createCustomer(customer: any): Promise<any> {
    return this.request<any>('/customers/', {
      method: 'POST',
      body: JSON.stringify(customer),
    })
  }

  async updateCustomer(id: string, customer: any): Promise<any> {
    return this.request<any>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    })
  }

  async deleteCustomer(id: string): Promise<any> {
    return this.request<any>(`/customers/${id}`, {
      method: 'DELETE',
    })
  }

  async findCustomer(params: { phone?: string; document?: string }): Promise<any> {
    const query = this.buildQuery(params)
    return this.request<any>(`/customers/find${query}`)
  }

  async getCustomerStats(): Promise<any> {
    return this.request<any>('/customers/stats')
  }

  // ===== Contactos de Clientes =====
  async getCustomerContacts(customerId: string): Promise<any> {
    return this.request<any>(`/customer-contacts/${customerId}/contacts`)
  }

  async addCustomerContact(customerId: string, contact: any): Promise<any> {
    return this.request<any>(`/customer-contacts/${customerId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(contact),
    })
  }

  async updateCustomerContact(contactId: string, contact: any): Promise<any> {
    return this.request<any>(`/customer-contacts/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(contact),
    })
  }

  async deleteCustomerContact(contactId: string): Promise<any> {
    return this.request<any>(`/customer-contacts/contacts/${contactId}`, {
      method: 'DELETE',
    })
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    await this.request<void>(`/chat/conversations/${conversationId}/mark-read`, { method: 'POST' })
  }

  // Estado "legacy" (pending/active/closed/blocked) del dropdown del header del chat.
  // Distinto del management status (open/in_progress/resolved/closed) de updateConversationStatus.
  async updateConversationLegacyStatus(conversationId: string, status: string): Promise<any> {
    return this.request<any>(`/chat/conversations/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  // ===== Usuarios =====

  async getUsers(params?: { skip?: number; limit?: number }): Promise<any[]> {
    const query = this.buildQuery({
      skip: params?.skip ?? 0,
      limit: params?.limit ?? 100,
    })
    return this.request<any[]>(`/users${query}`)
  }

  async getUser(id: string): Promise<any> {
    return this.request<any>(`/users/${id}`)
  }

  async createUser(userData: any): Promise<any> {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async updateUser(id: string, userData: any): Promise<any> {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(id: string): Promise<void> {
    await this.request<void>(`/users/${id}`, { method: 'DELETE' })
  }

  async getUsersByCompany(companyId: string): Promise<any[]> {
    return this.request<any[]>(`/users/company/${companyId}`)
  }

  // ===== Credenciales de usuario =====

  async resetUserPassword(userId: string): Promise<any> {
    return this.request<any>(`/user-credentials/reset-password/${userId}`, { method: 'POST' })
  }

  async exportUserCredentials(userId: string): Promise<{ success: boolean; message: string }> {
    // Descarga de archivo (CSV) — se realiza con fetch directo por manejo de blob
    const token = this.token || (typeof window !== 'undefined' ? localStorage.getItem(config.auth.tokenKey) : null)
    if (!token) throw new Error('No hay token de autenticación')

    const url = buildApiUrl(`/user-credentials/export-credentials/${userId}`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      let detail: string | undefined
      try { detail = (await response.json())?.detail } catch { detail = await response.text() }
      throw new Error(detail || `Error ${response.status}: ${response.statusText}`)
    }

    const blob = await response.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const contentDisposition = response.headers.get('content-disposition')
    const filename = contentDisposition?.match(/filename=(.+)/)?.[1]?.replace(/"/g, '') || 'credenciales.csv'

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(objectUrl)

    return { success: true, message: 'Credenciales exportadas exitosamente' }
  }

  async getPasswordRequirements(): Promise<any> {
    return this.request<any>('/user-credentials/password-requirements')
  }

  // ===== Companies =====

  async getMyCompanies(): Promise<any[]> {
    return this.request<any[]>('/companies/me/companies')
  }

  async getCompanies(): Promise<any[]> {
    return this.request<any[]>('/companies')
  }

  async getCompany(id: string): Promise<any> {
    return this.request<any>(`/companies/${id}`)
  }

  async createCompany(companyData: any): Promise<any> {
    return this.request<any>('/companies', {
      method: 'POST',
      body: JSON.stringify(companyData),
    })
  }

  async updateCompany(id: string, companyData: any): Promise<any> {
    return this.request<any>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(companyData),
    })
  }

  async deleteCompany(id: string): Promise<void> {
    await this.request<void>(`/companies/${id}`, { method: 'DELETE' })
  }

  async selectCompany(data: { company_id: string }): Promise<any> {
    return this.request<any>('/auth/select-company', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async addUserToCompany(companyId: string, userData: any): Promise<any> {
    return this.request<any>(`/companies/${companyId}/users`, {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async removeUserFromCompany(companyId: string, userId: string): Promise<void> {
    await this.request<void>(`/companies/${companyId}/users/${userId}`, { method: 'DELETE' })
  }

  // ===== Bug Reports (Store) =====

  async createBugReport(report: any): Promise<any> {
    return this.request<any>('/bug-reports', {
      method: 'POST',
      body: JSON.stringify(report),
      headers: { 'X-API-Key': config.apiKeys.store },
    })
  }

  async getBugReports(params?: {
    status?: string
    type?: string
    search?: string
    skip?: number
    limit?: number
  }): Promise<any[]> {
    const query = this.buildQuery({
      status: params?.status,
      type: params?.type,
      search: params?.search,
      skip: params?.skip,
      limit: params?.limit,
    })

    return this.request<any[]>(`/bug-reports${query}`, {
      headers: { 'X-API-Key': config.apiKeys.store },
    })
  }

  async getBugReportStats(): Promise<any> {
    return this.request<any>('/bug-reports/stats', {
      headers: { 'X-API-Key': config.apiKeys.store },
    })
  }

  // ===== Media =====

  async getMediaItems(params?: {
    skip?: number
    limit?: number
    file_type?: string
    source_type?: string
    search?: string
  }): Promise<any> {
    const query = this.buildQuery({
      skip: params?.skip,
      limit: params?.limit,
      file_type: params?.file_type,
      source_type: params?.source_type,
      search: params?.search,
    })
    return this.request<any>(`/media${query}`)
  }

  async deleteMediaItem(mediaId: string): Promise<void> {
    await this.request<void>(`/media/${mediaId}`, { method: 'DELETE' })
  }

  async uploadMediaFile(formData: FormData): Promise<any> {
    return this.request<any>('/media/upload-file', {
      method: 'POST',
      body: formData,
    })
  }

  // ===== AI Assistant =====
  // Sin X-API-Key de la tienda: con ella el backend podía resolver la empresa de
  // la clave (A) en vez de la de la sesión. Estos endpoints exigen sesión.

  async getBusinessStats(): Promise<any> {
    return this.request<any>('/ai-assistant/stats')
  }

  async getDatabaseSchema(): Promise<any> {
    return this.request<any>('/ai-assistant/schema')
  }

  async chatWithAssistant(message: string, context?: string): Promise<any> {
    return this.request<any>('/ai-assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context })
    })
  }

  async getAISuggestions(): Promise<any> {
    return this.request<any>('/ai-assistant/suggestions')
  }

  // ===== Auditoría =====
  auditLogs = {
    getAuditLogs: async (params: URLSearchParams): Promise<any[]> => {
      return this.request<any[]>(`/admin/audit/audit-logs?${params.toString()}`)
    },

    getAuditLogDetail: async (logId: string): Promise<any> => {
      return this.request<any>(`/admin/audit/audit-logs/${logId}`)
    },

    getStats: async (days: number): Promise<any> => {
      return this.request<any>(`/admin/audit/audit-stats?days=${days}`)
    },

    getRecentActivity: async (limit: number): Promise<any[]> => {
      return this.request<any[]>(`/admin/audit/audit-logs/recent?limit=${limit}`)
    },

    exportCSV: async (params: URLSearchParams): Promise<Blob> => {
      const headers: Record<string, string> = {}

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`
      }

      const response = await fetch(buildApiUrl(`/admin/audit/audit-logs/export/csv?${params.toString()}`), {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return response.blob()
    }
  }

  // ===== SYSTEM LOGS / LOGS DEL SISTEMA =====

  systemLogs = {
    getLogs: async (params: URLSearchParams): Promise<any[]> => {
      return this.request<any[]>(`/admin/system-logs?${params.toString()}`)
    },

    getStats: async (hours: number, allCompanies = false): Promise<any> => {
      return this.request<any>(`/admin/system-logs/stats?hours=${hours}&all_companies=${allCompanies}`)
    },

    getById: async (logId: string): Promise<any> => {
      return this.request<any>(`/admin/system-logs/${logId}`)
    },

    resolve: async (logId: string, status: string = 'resolved'): Promise<any> => {
      return this.request<any>(`/admin/system-logs/${logId}/resolve?status=${status}`, {
        method: 'PATCH',
      })
    },

    purge: async (): Promise<any> => {
      return this.request<any>(`/admin/system-logs/purge`, { method: 'POST' })
    },

    exportCSV: async (params: URLSearchParams): Promise<Blob> => {
      const headers: Record<string, string> = {}
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`
      const response = await fetch(buildApiUrl(`/admin/system-logs/export/csv?${params.toString()}`), {
        method: 'GET',
        headers,
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      return response.blob()
    },
  }

  // ===== TAXES / IMPUESTOS =====

  taxes = {
    // Crear impuesto
    create: async (data: any): Promise<any> => {
      return this.request<any>('/admin/taxes', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },

    // Listar impuestos
    list: async (skip: number = 0, limit: number = 100): Promise<any> => {
      const query = this.buildQuery({ skip, limit })
      return this.request<any>(`/admin/taxes${query}`)
    },

    // Obtener impuesto específico
    get: async (taxId: string): Promise<any> => {
      return this.request<any>(`/admin/taxes/${taxId}`)
    },

    // Actualizar impuesto
    update: async (taxId: string, data: any): Promise<any> => {
      return this.request<any>(`/admin/taxes/${taxId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },

    // Eliminar impuesto
    delete: async (taxId: string): Promise<any> => {
      return this.request<any>(`/admin/taxes/${taxId}`, {
        method: 'DELETE'
      })
    },

    // Obtener categorías disponibles
    getAvailableCategories: async (): Promise<any> => {
      return this.request<any>('/admin/taxes/categories/available')
    },

    // Calcular impuestos para una orden
    calculateForOrder: async (items: any[]): Promise<any> => {
      return this.request<any>('/orders/calculate-taxes', {
        method: 'POST',
        body: JSON.stringify({ items })
      })
    },

    // Obtener impuestos para productos específicos.
    // Usa /orders/product-taxes en vez de /admin/taxes/product-taxes: ambos
    // llaman a TaxCalculator.get_taxes_for_products y devuelven lo mismo, pero
    // el de /admin depende de get_current_user_with_api_key, que resuelve la
    // x-api-key pública a un usuario ADMINISTRADOR. Consultar impuestos de
    // catálogo no necesita ese privilegio; la versión de /orders solo resuelve
    // la empresa.
    getProductTaxes: async (products: any[]): Promise<any> => {
      return this.request<any>('/orders/product-taxes', {
        method: 'POST',
        body: JSON.stringify({ products })
      })
    }
  }

  // ===== Validación de Inventario en SAP =====
  async validateInventory(items: Array<{
    product_id: string
    sku?: string
    quantity: number
    unit_quantity: number
    color?: string
    size?: string
  }>): Promise<Record<string, {
    available: boolean
    requested: number
    stock: number
    message: string
  }>> {
    try {
      console.log('📡 Llamando a /sap/validate-inventory con items:', items)

      const response = await this.request<any>('/sap/validate-inventory', {
        method: 'POST',
        body: JSON.stringify({ items })
      })

      console.log('✅ Respuesta de /sap/validate-inventory:', response)

      // Transformar respuesta a formato esperado
      if (response && typeof response === 'object') {
        const result: Record<string, any> = {}

        // Si la respuesta es un array, mapear cada item
        if (Array.isArray(response)) {
          response.forEach((item: any) => {
            const key = item.sku || `${item.product_id}-${item.color}-${item.size}`
            result[key] = {
              available: item.available !== false,
              requested: item.requested || item.quantity || 0,
              stock: item.stock || 0,
              message: item.message || (item.available ? 'Disponible' : 'No disponible')
            }
          })
        } else {
          // Si es un objeto, usarlo directamente
          return response
        }

        return result
      }

      return {}
    } catch (error) {
      console.error('❌ Error en /sap/validate-inventory:', error)
      // En caso de error, retornar todos como disponibles (fallback)
      const result: Record<string, any> = {}
      items.forEach(item => {
        const key = item.sku || `${item.product_id}-${item.color}-${item.size}`
        result[key] = {
          available: true,
          requested: item.quantity,
          stock: item.quantity,
          message: 'No validado'
        }
      })
      return result
    }
  }

  // ===== Configuración de Compañía =====
  async getCompanySettings(): Promise<any> {
    try {
      const response = await this.request<any>('/admin/company-settings/')
      // Si la respuesta tiene estructura { settings: {...} }, extrae settings
      if (response?.settings) {
        return response.settings
      }
      return response || {}
    } catch (error) {
      console.warn('⚠️ No se pudo obtener configuración de compañía:', error)
      return {}
    }
  }

  async updateCompanySettings(settings: {
    disable_sap_validation?: boolean
    mcp_enabled?: boolean
    mcp_provider?: string
    mcp_model?: string
    mcp_system_prompt?: string | null
    mcp_api_key?: string
  }): Promise<any> {
    return this.request<any>('/admin/company-settings/', {
      method: 'PUT',
      body: JSON.stringify(settings),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async getCompanySettingsPublic(companyId: string): Promise<any> {
    try {
      // Endpoint público que no requiere autenticación
      const response = await this.request<any>(`/admin/company-settings/public/sap-validation?company_id=${companyId}`)
      return response || { disable_sap_validation: false }
    } catch (error) {
      console.warn('⚠️ No se pudo obtener status de SAP validation:', error)
      // Por defecto, ACTIVAR validación (safe default)
      return { disable_sap_validation: false }
    }
  }

  // ── Notas Internas ─────────────────────────────────────────────────────────

  async getNotes(conversationId: string): Promise<ConversationNote[]> {
    return this.request<ConversationNote[]>(`/chat/conversations/${conversationId}/notes`)
  }

  async createNote(conversationId: string, content: string): Promise<ConversationNote> {
    return this.request<ConversationNote>(`/chat/conversations/${conversationId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async updateNote(conversationId: string, noteId: string, content: string): Promise<ConversationNote> {
    return this.request<ConversationNote>(`/chat/conversations/${conversationId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async deleteNote(conversationId: string, noteId: string): Promise<void> {
    return this.request<void>(`/chat/conversations/${conversationId}/notes/${noteId}`, {
      method: 'DELETE',
    })
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async listTags(): Promise<import('./api-types').ChatTag[]> {
    return this.request('/chat/tags')
  }

  async createTag(data: { name: string; color: string }): Promise<import('./api-types').ChatTag> {
    return this.request('/chat/tags', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateTag(tagId: string, data: { name?: string; color?: string }): Promise<import('./api-types').ChatTag> {
    return this.request(`/chat/tags/${tagId}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteTag(tagId: string): Promise<void> {
    return this.request(`/chat/tags/${tagId}`, { method: 'DELETE' })
  }

  async getConversationTags(conversationId: string): Promise<import('./api-types').ChatTag[]> {
    return this.request(`/chat/conversations/${conversationId}/tags`)
  }

  async setConversationTags(conversationId: string, tagIds: string[]): Promise<import('./api-types').ChatTag[]> {
    return this.request(`/chat/conversations/${conversationId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tag_ids: tagIds }),
    })
  }

  async updateConversationStatus(
    conversationId: string,
    conversation_status: import('./api-types').ConversationMgmtStatus,
  ): Promise<{ id: string; conversation_status: string; resolved_at: string | null }> {
    return this.request(`/chat/conversations/${conversationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ conversation_status }),
    })
  }

  // Favorito/destacado (pin) privados del usuario actual.
  async setConversationFavorite(conversationId: string, is_favorite: boolean): Promise<{ id: string; is_favorite: boolean }> {
    return this.request(`/chat/conversations/${conversationId}/favorite`, {
      method: 'PATCH',
      body: JSON.stringify({ is_favorite }),
    })
  }

  async setConversationPin(conversationId: string, is_pinned: boolean): Promise<{ id: string; is_pinned: boolean }> {
    return this.request(`/chat/conversations/${conversationId}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ is_pinned }),
    })
  }

  async assignConversation(
    conversationId: string,
    assigned_to_id: string | null,
  ): Promise<{ id: string; assigned_to_id: string | null; assigned_to_name: string | null; assigned_at: string | null }> {
    return this.request(`/chat/conversations/${conversationId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to_id }),
    })
  }

  async getConversationAgents(): Promise<{ id: string; name: string; email: string; role: string }[]> {
    return this.request('/chat/conversations/agents')
  }

  async editMessage(
    conversationId: string,
    messageId: string,
    newContent: string,
  ): Promise<any> {
    return this.request(`/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ message: newContent }),
    })
  }

  async deleteMessageForAll(conversationId: string, messageId: string): Promise<any> {
    return this.request(`/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
    })
  }

  async toggleMessageReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<any> {
    return this.request(`/chat/conversations/${conversationId}/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    })
  }

  // ── MCP / Knowledge ───────────────────────────────────────────────────────

  async getMcpAudit(params?: {
    conversation_id?: string
    customer_phone?: string
    status?: 'success' | 'error' | 'blocked'
    skip?: number
    limit?: number
  }): Promise<import('./api-types').MCPAuditEntry[]> {
    const search = new URLSearchParams()
    if (params?.conversation_id) search.set('conversation_id', params.conversation_id)
    if (params?.customer_phone) search.set('customer_phone', params.customer_phone)
    if (params?.status) search.set('status', params.status)
    if (typeof params?.skip === 'number') search.set('skip', String(params.skip))
    if (typeof params?.limit === 'number') search.set('limit', String(params.limit))

    const query = search.toString()
    return this.request(`/mcp/audit${query ? `?${query}` : ''}`)
  }

  async sendMcpChat(payload: {
    customer_phone: string
    message: string
    conversation_id?: string
    language?: string
  }): Promise<import('./api-types').MCPChatResponse> {
    return this.request('/mcp/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async listKnowledge(params?: { type?: 'policy' | 'term' | 'faq'; skip?: number; limit?: number }) {
    const search = new URLSearchParams()
    if (params?.type) search.set('knowledge_type', params.type)
    if (typeof params?.skip === 'number') search.set('skip', String(params.skip))
    if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
    const query = search.toString()
    return this.request(`/knowledge${query ? `?${query}` : ''}`)
  }

  async createKnowledge(payload: {
    type: 'policy' | 'term' | 'faq'
    title: string
    content: string
    question?: string
    answer?: string
    is_active?: boolean
  }) {
    return this.request('/knowledge', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateKnowledge(itemId: string, payload: {
    type?: 'policy' | 'term' | 'faq'
    title?: string
    content?: string
    question?: string
    answer?: string
    is_active?: boolean
  }) {
    return this.request(`/knowledge/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async deleteKnowledge(itemId: string): Promise<void> {
    return this.request(`/knowledge/${itemId}`, { method: 'DELETE' })
  }

  async importKnowledgeFromUrl(payload: { url: string; title?: string; type?: 'policy' | 'term' | 'faq' }) {
    return this.request('/knowledge/import-from-url', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
}

export const apiClient = new ApiClient()
export default apiClient
