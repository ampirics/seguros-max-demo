"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAdmin } from '@/contexts/admin-context'
import { useAuthCheck } from '@/lib/use-auth-check'
import { config } from '@/lib/config'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
  excludePaths?: string[]
}

/**
 * Componente que protege rutas requiriendo autenticación
 * Redirige automáticamente al login si no hay usuario autenticado
 */
export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = '/admin/login',
  excludePaths = ['/admin/login', '/admin/auth']
}: AuthGuardProps) {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Verificar si la ruta actual está excluida de la protección
  const isExcludedPath = pathname ? excludePaths.some(path => pathname.startsWith(path)) : false

  // IMPORTANTE: Siempre llamar useAuthCheck, pero solo actuar si no está excluida
  // Los hooks deben llamarse siempre en el mismo orden
  useAuthCheck()

  useEffect(() => {
    // Si la ruta está excluida, permitir acceso sin verificación
    if (isExcludedPath) {
      setIsAuthorized(true)
      return
    }

    if (isLoading) return

    if (requireAuth && !user) {
      router.push(redirectTo)
      return
    }

    setIsAuthorized(true)
  }, [user, isLoading, requireAuth, redirectTo, router, isExcludedPath, pathname])

  // Si la ruta está excluida, mostrar contenido inmediatamente
  if (isExcludedPath) {
    return <>{children}</>
  }

  // Mostrar loading mientras se verifica
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  // Si requiere auth pero no hay usuario, no mostrar nada (se está redirigiendo)
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="text-center">
          <div className="animate-pulse text-red-600 text-lg">Redirigiendo al login...</div>
        </div>
      </div>
    )
  }

  // Si está autorizado, mostrar el contenido
  if (isAuthorized) {
    return <>{children}</>
  }

  return null
}

/**
 * Hook para obtener el estado de autenticación con verificación automática
 */
export function useAuthState() {
  const { user, isLoading } = useAdmin()
  
  useAuthCheck()

  const [tokenExists, setTokenExists] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(config.auth.tokenKey)
      setTokenExists(!!token)
    }
  }, [user])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    tokenExists
  }
}