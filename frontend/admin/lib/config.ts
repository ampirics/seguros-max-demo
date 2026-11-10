// lib/config.ts
// Configuración centralizada de la aplicación

import { useSyncExternalStore } from 'react'

/**
 * Determina la URL base de la API.
 * Prioriza variables públicas de entorno y evita defaults atados a una máquina específica.
 */
const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    return `${protocol}//${hostname}:8000`
  }

  return 'http://localhost:8000'
}

export const API_BASE_URL = getApiBaseUrl()

// La tienda corre aparte: en producción en su propio dominio y en local en el puerto 3001.
export const getTiendaUrl = (): string =>
  process.env.NEXT_PUBLIC_TIENDA_URL
  || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001')

/**
 * Modo demo del menú: solo estas secciones (y sus pestañas). Las demás siguen en su ruta, fuera del menú.
 * Por defecto con NEXT_PUBLIC_MODO_DEMO=true; cada navegador lo cambia en Configuración IA o en el menú de usuario.
 */
export const RUTAS_MODO_DEMO: readonly string[] = [
  '/admin',
  '/admin/chat',
  '/admin/customers',
  '/admin/vehiculos',
  '/admin/piezas',
  '/admin/existencias',
  '/admin/reservas',
  '/admin/busqueda-externa',
  '/admin/calendario',
  '/admin/estadisticas',
  '/admin/salon',
  '/admin/visitas',
  '/admin/reservaciones',
  '/admin/llegadas',
  '/admin/caja',
  '/admin/gastos',
  '/admin/inventario',
  '/admin/compras',
  '/admin/finanzas',
  '/admin/ordenes',
  '/admin/cocina',
  '/admin/carta',
  '/admin/clientes',
  '/admin/metricas',
  '/admin/dashboard',
]

// Dentro de una sección visible, lo que tampoco se muestra (el diagrama del vehículo se dejó fuera el 04-10).
export const RUTAS_OCULTAS_MODO_DEMO: readonly string[] = ['/admin/piezas/diagrama']

export const MODO_DEMO_POR_DEFECTO = process.env.NEXT_PUBLIC_MODO_DEMO === 'true'

const CLAVE_MODO_DEMO = 'panel:modo_demo'
const EVENTO_MODO_DEMO = 'panel:modo-demo'

const coincide = (href: string, ruta: string) =>
  ruta === '/admin' ? href === ruta : href === ruta || href.startsWith(`${ruta}/`)

/** ¿La ruta se muestra en el menú y las pestañas con el modo demo encendido? */
export const rutaEnModoDemo = (href: string): boolean => {
  const ruta = href.split('?')[0]
  return RUTAS_MODO_DEMO.some((r) => coincide(ruta, r)) && !RUTAS_OCULTAS_MODO_DEMO.some((r) => coincide(ruta, r))
}

export function leerModoDemo(): boolean {
  if (typeof window === 'undefined') return MODO_DEMO_POR_DEFECTO
  try {
    const guardado = localStorage.getItem(CLAVE_MODO_DEMO)
    return guardado === null ? MODO_DEMO_POR_DEFECTO : guardado === '1'
  } catch {
    return MODO_DEMO_POR_DEFECTO
  }
}

export function guardarModoDemo(activo: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CLAVE_MODO_DEMO, activo ? '1' : '0')
  } catch { /* almacenamiento bloqueado: queda el valor por defecto */ }
  window.dispatchEvent(new Event(EVENTO_MODO_DEMO))
}

const suscribirModoDemo = (aviso: () => void) => {
  const onStorage = (e: StorageEvent) => { if (e.key === CLAVE_MODO_DEMO) aviso() }
  window.addEventListener(EVENTO_MODO_DEMO, aviso)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENTO_MODO_DEMO, aviso)
    window.removeEventListener('storage', onStorage)
  }
}

export function useModoDemo(): boolean {
  return useSyncExternalStore(suscribirModoDemo, leerModoDemo, () => MODO_DEMO_POR_DEFECTO)
}

/**
 * Verifica si la URL base ya incluye la versión de la API
 */
const hasApiVersion = (url: string): boolean => {
  return url.includes('/api/v1')
}

/**
 * Configuración de URLs de la aplicación
 */
export const config = {
  // URLs de API
  api: {
    baseUrl: getApiBaseUrl(),
    version: hasApiVersion(getApiBaseUrl()) ? '' : '/api/v1', // Solo agregar si no está incluido
    endpoints: {
      auth: '/auth',
      products: '/products',
      orders: '/orders',
      users: '/users',
      companies: '/companies',
      chat: '/chat',
      bugReports: '/bug-reports',
      frontlabel: '/frontlabel'
    }
  },
  
  // Configuración de autenticación
  auth: {
    tokenKey: 'auth_token',
    storeTokenKey: 'store_token',
    storeTokenExpiryKey: 'store_token_expiry'
  },
  
  // API Keys
  apiKeys: {
    store: process.env.NEXT_PUBLIC_STORE_API_KEY || process.env.NEXT_PUBLIC_WACOMMERCE_API_KEY || ''
  },
  
  // Configuración de paginación
  pagination: {
    defaultLimit: 50,
    maxLimit: 100,
    adminPageSize: 20
  },
  
  // Configuración de archivos
  files: {
    maxImageSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as string[],
    maxImagesPerReport: 5
  }
} as const

/**
 * Construye una URL completa de la API
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = config.api.baseUrl
  const version = config.api.version
  
  // Remover barras duplicadas y asegurar que empiece con /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  const finalUrl = `${baseUrl}${version}${cleanEndpoint}`
  
  return finalUrl
}

/**
 * Construye una URL de endpoint específico
 */
export const buildEndpointUrl = (endpointKey: keyof typeof config.api.endpoints, path = ''): string => {
  const baseUrl = config.api.baseUrl
  const version = config.api.version  
  const endpoint = config.api.endpoints[endpointKey]
  
  // Construir la URL completa
  const fullPath = path ? `${endpoint}${path.startsWith('/') ? path : `/${path}`}` : endpoint
  
  return `${baseUrl}${version}${fullPath}`
}

/**
 * Configuración para diferentes entornos
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  
  const configs = {
    development: {
      debug: true,
      apiTimeout: 30000,
      retryAttempts: 3
    },
    production: {
      debug: false,
      apiTimeout: 15000,
      retryAttempts: 2
    },
    test: {
      debug: false,
      apiTimeout: 5000,
      retryAttempts: 1
    }
  }
  
  return configs[env as keyof typeof configs] || configs.development
}

export default config
