import { useCompany } from "@/contexts/company-context"

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: any
  headers?: Record<string, string>
}

// Función para obtener el token del localStorage
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export function useApi() {
  const { activeCompany } = useCompany()

  const request = async (endpoint: string, options: RequestOptions = {}) => {
    const { method = 'GET', data, headers = {} } = options
    
    // Construir URL completa
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
    const url = `${baseUrl}/api/v1${endpoint}`
    
    // Headers por defecto
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Agregar token de autenticación si existe
    const token = getAuthToken()
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`
    }
    
    // Agregar company ID si existe (para multi-tenant)
    if (activeCompany?.id) {
      defaultHeaders['X-Company-ID'] = activeCompany.id
    }
    
    // Combinar headers
    const finalHeaders = { ...defaultHeaders, ...headers }
    
    // Configurar request
    const requestConfig: RequestInit = {
      method,
      headers: finalHeaders,
    }
    
    // Agregar body si es necesario
    if (data && method !== 'GET') {
      requestConfig.body = JSON.stringify(data)
    }
    
    try {
      const response = await fetch(url, requestConfig)
      
      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Si la respuesta está vacía (como en DELETE), devolver objeto vacío
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        return {}
      }
      
      return await response.json()
    } catch (error) {
      console.error('API request error:', error)
      throw error
    }
  }

  return { request }
}

export default useApi