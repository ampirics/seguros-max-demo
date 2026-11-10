"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useCompany } from "@/contexts/company-context"
import { getCurrentUser, loginAdmin, logoutAdmin } from "@/lib/auth"
import { useAuthCheck } from "@/lib/use-auth-check"
import type { User } from "@/lib/types"

interface AdminContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

export const CHANGE_PASSWORD_PATH = "/admin/account/password"

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Usar el hook de verificación automática de token
  useAuthCheck()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true)
        const currentUser = await getCurrentUser()
        
        if (currentUser) {
          setUser(currentUser)
        } else {
          setUser(null)
          
          // Solo redirigir si estamos en una página que requiere autenticación
          const currentPath = window.location.pathname
          const isAuthPage = currentPath.includes('/login') || currentPath.includes('/auth')
          
          if (!isAuthPage) {
            router.push('/admin/login')
          }
        }
      } catch (error) {
        console.error('[AdminContext] Error en verificación de auth:', error)
        setUser(null)
        
        // Solo redirigir si es un error de autenticación y no estamos ya en login
        const currentPath = window.location.pathname
        const isAuthPage = currentPath.includes('/login') || currentPath.includes('/auth')
        
        if (!isAuthPage && error instanceof Error && (
          error.message.includes('No authentication token') ||
          error.message.includes('401') ||
          error.message.includes('Unauthorized')
        )) {
          router.push('/admin/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // Propaga el error del backend (429 por intentos, usuario inactivo…) para
  // que la pantalla de login muestre el motivo real.
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const loginResult = await loginAdmin(email, password)
      if (loginResult.user) {
        setUser(loginResult.user)
        return true
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await logoutAdmin()
      setUser(null)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Contraseña temporal (alta o reset): obligar a cambiarla antes de usar el panel.
  useEffect(() => {
    if (!user?.must_change_password) return
    if (!pathname?.startsWith(CHANGE_PASSWORD_PATH)) {
      router.replace(CHANGE_PASSWORD_PATH)
    }
  }, [user, pathname, router])

  return (
    <AdminContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider")
  }
  return context
}
