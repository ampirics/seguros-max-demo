// Decodifica un JWT sin validar la firma (solo para lectura FE)
export function decodeJWT(token: string): any {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Token inválido')
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Formato de JWT inválido')
    }

    const payload = parts[1]
    
    // Normalizar el padding Base64
    let normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    while (normalizedPayload.length % 4) {
      normalizedPayload += '='
    }
    
    // Decodificar Base64
    const decoded = atob(normalizedPayload)
    
    // Convertir bytes a string UTF-8 de forma segura
    const bytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i)
    }
    
    const textDecoder = new TextDecoder('utf-8')
    const jsonString = textDecoder.decode(bytes)
    
    return JSON.parse(jsonString)
  } catch (e) {
    console.error('decodeJWT error:', e)
    return null
  }
}
import type { User } from "./types"
import { apiClient } from "./api-client"

// Clave del token y evento propio para notificar cambios de token en la MISMA
// pestaña. El evento nativo `storage` solo se dispara en OTRAS pestañas, por lo
// que tras un login (que hace setItem en el mismo tab) los contextos no se
// enteran. Con este evento el CompanyContext puede re-derivar la empresa sin
// necesidad de recargar la página.
export const AUTH_TOKEN_KEY = 'auth_token'
export const AUTH_TOKEN_EVENT = 'auth:token-changed'

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  window.dispatchEvent(new Event(AUTH_TOKEN_EVENT))
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  window.dispatchEvent(new Event(AUTH_TOKEN_EVENT))
}

export const adminCredentials = {
  email: "admin@casadelcolt.com",
  password: "admin123",
}

const USERS_KEY = "admin_users"

export function getUsersFromStorage(): User[] {
  if (typeof window === "undefined") return []
  try {
    const users = localStorage.getItem(USERS_KEY)
    return users ? JSON.parse(users) : []
  } catch (error) {
    console.error("Error getting users:", error)
    return []
  }
}

export function saveUsers(users: User[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch (error) {
    console.error("Error saving users:", error)
  }
}

export function initializeUsers(): void {
  if (typeof window === "undefined") return

  const existingUsers = getUsersFromStorage()
  if (existingUsers.length === 0) {
    // Usuarios de ejemplo solo para desarrollo local, ajustados al tipo User
    const defaultUsers: User[] = [
      {
        id: "1",
        email: adminCredentials.email,
        name: "Administrador Principal",
        role: "admin",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        email: "manager@casadelcolt.com",
        name: "Gerente de Tienda",
        role: "user",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "3",
        email: "editor@casadelcolt.com",
        name: "Editor de Contenido",
        role: "user",
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ]
    saveUsers(defaultUsers)
  }
}

export async function loginAdmin(email: string, password: string): Promise<{ user: User | null }> {
  if (!email || !password) {
    return { user: null }
  }
  try {
    const response = await apiClient.login({ username: email, password })
    if (response.access_token) {
      setAuthToken(response.access_token)
      // Obtener el usuario actual tras login
      const user = await apiClient.getCurrentUser()
      // Si la respuesta es { data: User }, extraer el user
      if (user && (user as any).data) {
        return { user: (user as any).data }
      }
      return { user: user as unknown as User }
    }
    return { user: null }
  } catch (error) {
    console.error('Login error:', error)
    throw error
  }
}

export async function logoutAdmin(): Promise<void> {
  await apiClient.logout()
}

export async function getCurrentUser(): Promise<User | null> {
  
  try {
    const user = await apiClient.getCurrentUser()
    
    if (user && (user as any).data) {
      return (user as any).data
    }
    return user as unknown as User
  } catch (error) {
    console.error('[auth.getCurrentUser] Error obteniendo usuario actual:', error)
    
    // Solo hacer logout automático si el error es de autenticación
    if (error instanceof Error && (
      error.message.includes('No authentication token') ||
      error.message.includes('401') ||
      error.message.includes('Unauthorized')
    )) {
      await apiClient.logout()
    } else {
    }
    
    return null
  }
}

export async function getCurrentAdmin(): Promise<User | null> {
  return getCurrentUser()
}

export async function getUsers(): Promise<User[]> {
  try {
    const users = await apiClient.getUsers()
    if (Array.isArray(users)) return users as User[]
    if (users && (users as any).data) return (users as any).data as User[]
    return []
  } catch (error) {
    console.error('Error getting users:', error)
    return []
  }
}

export async function createUser(userData: Omit<User, "id" | "created_at">): Promise<User> {
  try {
    const user = await apiClient.createUser(userData)
    if (user && (user as any).data) return (user as any).data as User
    // Se devuelve la respuesta completa: recortarla perdía temporary_password.
    return user as any
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  try {
    const user = await apiClient.updateUser(id, updates)
    if (user && (user as any).data) return (user as any).data as User
    return user as unknown as User
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    await apiClient.deleteUser(id)
  } catch (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const users = await getUsers()
    return users.find((u) => u.id === id) || null
  } catch (error) {
    console.error('Error getting user by ID:', error)
    return null
  }
}

// Permisos: placeholder, depende de cómo se manejen en el backend
export async function hasPermission(_permission: string): Promise<boolean> {
  // Implementar según la estructura real de permisos en el backend
  return true
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPassword(password: string): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(password)
}
