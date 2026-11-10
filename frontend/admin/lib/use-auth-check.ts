import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { config } from './config'

/**
 * Hook para verificar automáticamente si el token está expirado
 * y redirigir al login si es necesario
 */
export function useTokenCheck() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkToken = () => {
      if (typeof window === 'undefined') return

      // No verificar en páginas de login/auth
      const currentPath = pathname || window.location.pathname
      if (currentPath.includes('/login') || currentPath.includes('/auth')) {
        return
      }

      const token = localStorage.getItem(config.auth.tokenKey)
      
      if (!token) {
        router.push('/admin/login')
        return
      }

      // Verificar si el token está expirado (si está en formato JWT)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const currentTime = Math.floor(Date.now() / 1000)
        const timeToExpire = payload.exp - currentTime
        
        
        if (payload.exp && payload.exp < currentTime) {
          localStorage.removeItem(config.auth.tokenKey)
          localStorage.removeItem('adminUser') // Usar la clave correcta del usuario
          localStorage.setItem('tokenExpired', 'true')
          router.push('/admin/login')
        }
      } catch (error) {
        console.warn('[useTokenCheck] Error verificando token (posiblemente no es JWT válido):', error)
        // Solo limpiar si realmente parece ser un token corrupto
        if (token.includes('.')) { // Parece ser JWT pero está corrupto
          localStorage.removeItem(config.auth.tokenKey)
          localStorage.removeItem('adminUser')
          router.push('/admin/login')
        }
      }
    }

    // Verificar inmediatamente
    checkToken()

    // Verificar cada 5 minutos en lugar de cada 30 segundos (menos agresivo)
    const interval = setInterval(checkToken, 5 * 60 * 1000)

    // Limpiar el intervalo al desmontar
    return () => clearInterval(interval)
  }, [router, pathname])
}

/**
 * Hook para escuchar eventos de storage y detectar cuando el token
 * se elimina en otra pestaña
 */
export function useTokenStorageSync() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // No reaccionar en páginas de login/auth
      const currentPath = pathname || window.location.pathname
      if (currentPath.includes('/login') || currentPath.includes('/auth')) {
        return
      }

      // Si se elimina el token en otra pestaña, redirigir también en esta
      if (e.key === config.auth.tokenKey && e.newValue === null) {
        router.push('/admin/login')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [router, pathname])
}

/**
 * Hook combinado que incluye ambas verificaciones
 */
export function useAuthCheck() {
  useTokenCheck()
  useTokenStorageSync()
}