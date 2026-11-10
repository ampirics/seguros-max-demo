'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiClient } from '@/lib/api-client'
import { decodeJWT, AUTH_TOKEN_EVENT } from '@/lib/auth'
import { asegurarEmpresaEnToken } from '@/lib/ws-auth'

import type { Company as GlobalCompany } from '@/lib/types'
type Company = GlobalCompany

import type { User as GlobalUser } from '@/lib/types'
type User = GlobalUser

interface CompanyContextType {
  activeCompany: Company | null
  availableCompanies: Company[]
  user: User | null
  setActiveCompany: (company?: Company) => void
  setAvailableCompanies: (companies: Company[]) => void
  setUser: (user?: User) => void
  refreshUserData: () => Promise<void>
  isLoading: boolean
  needsCompanySelection: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)
const ACTIVE_COMPANY_KEY = 'active_company_id'

interface CompanyProviderProps {
  children: ReactNode
}

export function CompanyProvider({ children }: CompanyProviderProps) {
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null)
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([])
  const [user, setUserState] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsCompanySelection, setNeedsCompanySelection] = useState(false)

  // --- Helpers ---
  const handleSetActiveCompany = (company?: Company) => {
    setActiveCompanyState(company ?? null)
    if (company) {
      localStorage.setItem(ACTIVE_COMPANY_KEY, company.id)
    } else {
      localStorage.removeItem(ACTIVE_COMPANY_KEY)
    }
    setNeedsCompanySelection(false)
  }

  const handleSetUser = (user?: User) => {
    setUserState(user ?? null)
  }

  const refreshUserData = async () => {
    setIsLoading(true)
    try {
      const currentUser = await apiClient.getCurrentUser()
  handleSetUser(currentUser.data as User)
    } catch (error) {
      console.error('CompanyContext - refreshUserData error', error)
      setUserState(null)
      setAvailableCompanies([])
      setActiveCompanyState(null)
      setNeedsCompanySelection(false)
      localStorage.removeItem(ACTIVE_COMPANY_KEY)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Inicialización desde JWT al montar ---
  useEffect(() => {
    const updateCompaniesFromToken = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      if (token) {
        const decoded = decodeJWT(token)
        let companies: Company[] = []
        if (decoded?.user_companies && Array.isArray(decoded.user_companies)) {
          companies = decoded.user_companies
        } else if (decoded?.companies && Array.isArray(decoded.companies)) {
          companies = decoded.companies
        }
        setAvailableCompanies(companies)
        let activeCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY) || decoded?.active_company_id
        let initialCompany: Company | null = null
        // Si solo hay una empresa, seleccionarla siempre y actualizar storage
        if (companies.length === 1) {
          initialCompany = companies[0]
          localStorage.setItem(ACTIVE_COMPANY_KEY, initialCompany.id)
          activeCompanyId = initialCompany.id
        } else if (activeCompanyId) {
          initialCompany = companies.find((c: any) => c.id === activeCompanyId) || null
          // Si el id guardado no existe, limpiar storage
          if (!initialCompany) {
            localStorage.removeItem(ACTIVE_COMPANY_KEY)
          }
        }
        setActiveCompanyState(initialCompany)
        setNeedsCompanySelection(!initialCompany && companies.length > 1)
        if (initialCompany && String(decoded?.active_company_id ?? '') !== String(initialCompany.id)) {
          asegurarEmpresaEnToken(initialCompany.id)
        }
      } else {
        setAvailableCompanies([])
        setActiveCompanyState(null)
        setNeedsCompanySelection(false)
        localStorage.removeItem(ACTIVE_COMPANY_KEY)
      }
      setIsLoading(false)
    }
    updateCompaniesFromToken()
    // Escuchar cambios del token en OTRAS pestañas (evento nativo `storage`)...
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'auth_token') {
        updateCompaniesFromToken()
      }
    }
    // ...y en la MISMA pestaña (evento propio disparado por setAuthToken/
    // clearAuthToken). El `storage` nativo no se emite en la pestaña que escribe,
    // por eso tras un login same-tab necesitamos este evento para re-derivar la
    // empresa sin recargar la página.
    const handleTokenChange = () => updateCompaniesFromToken()
    window.addEventListener('storage', handleStorage)
    window.addEventListener(AUTH_TOKEN_EVENT, handleTokenChange)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(AUTH_TOKEN_EVENT, handleTokenChange)
    }
  }, [])

  // --- Logs de depuración solo en desarrollo ---
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    }
  }, [availableCompanies, user, activeCompany])

  const value: CompanyContextType = {
    activeCompany,
    availableCompanies,
    user,
    setActiveCompany: handleSetActiveCompany,
    setAvailableCompanies,
    setUser: handleSetUser,
    refreshUserData,
    isLoading,
    needsCompanySelection
  }

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  )
}

// --- Hooks de conveniencia ---
export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
}

export function useActiveCompany() {
  return useCompany().activeCompany
}

export function useAvailableCompanies() {
  return useCompany().availableCompanies
}
