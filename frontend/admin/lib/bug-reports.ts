// lib/bug-reports.ts

import { apiClient } from './api-client'
import { config, buildEndpointUrl } from './config'

export interface BugReport {
  id?: string
  title: string
  description: string
  type: 'bug' | 'feature_request' | 'improvement' | 'question'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status?: 'open' | 'in_progress' | 'resolved' | 'closed'
  
  // Información del usuario (opcional)
  user_email?: string
  user_name?: string
  
  // Información técnica
  browser?: string
  os?: string
  screen_resolution?: string
  url?: string
  user_agent?: string
  
  // Información adicional para bugs
  steps_to_reproduce?: string
  expected_behavior?: string
  actual_behavior?: string
  
  // Campos de administración
  admin_notes?: string
  is_public?: boolean
  
  // Metadatos
  created_at?: string
  updated_at?: string
  resolved_at?: string
}

export interface BugReportStats {
  total: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  by_type: Record<string, number>
  by_priority: Record<string, number>
}

class BugReportsAPI {
  private baseUrl: string

  constructor() {
    // Construir URL usando configuración centralizada
    const baseUrl = config.api.baseUrl
    const version = config.api.version
    const endpoint = config.api.endpoints.bugReports
    
    this.baseUrl = `${baseUrl}${version}${endpoint}`
  }


  async createReport(report: Omit<BugReport, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<BugReport> {
    // Capturar información técnica automáticamente
    const enhancedReport = {
      ...report,
      browser: this.getBrowserInfo(),
      os: this.getOSInfo(),
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      url: window.location.href,
      user_agent: navigator.userAgent
    }

    return apiClient.createBugReport(enhancedReport)
  }

  async getReports(filters?: {
    status?: string
    type?: string
    search?: string
    skip?: number
    limit?: number
  }): Promise<BugReport[]> {
    return apiClient.getBugReports(filters)
  }

  async getReport(id: string): Promise<BugReport> {
    const response = await fetch(`${this.baseUrl}/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async getStats(): Promise<BugReportStats> {
    return apiClient.getBugReportStats()
  }

  // Métodos para administradores (requieren autenticación)
  /** Filtros y total en el servidor (antes se filtraba la página en el navegador). */
  async getAllReportsAdmin(
    skip = 0,
    limit = 20,
    filters: { status?: string; type?: string; search?: string } = {},
  ): Promise<{ items: BugReport[]; total: number }> {
    const token = localStorage.getItem(config.auth.tokenKey)
    if (!token) {
      throw new Error('No hay token de autenticación disponible')
    }
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) })
    if (filters.status && filters.status !== 'all') qs.set('status', filters.status)
    if (filters.type && filters.type !== 'all') qs.set('type', filters.type)
    if (filters.search?.trim()) qs.set('search', filters.search.trim())
    const response = await fetch(`${this.baseUrl}/admin/all?${qs.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) {
      let detail = ''
      try { detail = (await response.json())?.detail } catch { /* sin cuerpo */ }
      throw new Error(detail || `Error ${response.status} al cargar los reportes`)
    }
    return response.json()
  }

  async updateReportAdmin(id: string, updates: Partial<BugReport>): Promise<BugReport> {
    const token = localStorage.getItem(config.auth.tokenKey)
    
    const response = await fetch(`${this.baseUrl}/admin/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async updateReportStatusAdmin(id: string, status: string): Promise<BugReport> {
    const token = localStorage.getItem(config.auth.tokenKey)
    
    const response = await fetch(`${this.baseUrl}/admin/${id}/status?new_status=${encodeURIComponent(status)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  private getBrowserInfo(): string {
    const ua = navigator.userAgent
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari')) return 'Safari'
    if (ua.includes('Edge')) return 'Edge'
    return 'Unknown'
  }

  private getOSInfo(): string {
    const platform = navigator.platform
    if (platform.includes('Win')) return 'Windows'
    if (platform.includes('Mac')) return 'macOS'
    if (platform.includes('Linux')) return 'Linux'
    if (platform.includes('iPhone') || platform.includes('iPad')) return 'iOS'
    if (platform.includes('Android')) return 'Android'
    return 'Unknown'
  }
}

export const bugReportsAPI = new BugReportsAPI()
