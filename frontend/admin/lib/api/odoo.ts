import { apiClient } from '@/lib/api-client'

export type QueOdoo = 'productos' | 'clientes' | 'ordenes' | 'pagos'

export interface EstadoOdoo {
  configurado: boolean
  url: string | null
  base: string | null
  usuario: string | null
  diario_pagos: string | null
}

export interface ExportacionOdoo {
  que: QueOdoo
  creados: number
  actualizados?: number
  omitidas?: number
}

export const odooApi = {
  estado: () => apiClient.get<EstadoOdoo>('/odoo/estado'),
  probar: () => apiClient.post<{ ok: boolean; uid: number }>('/odoo/probar'),
  exportar: (que: QueOdoo, limite = 2000) => apiClient.post<ExportacionOdoo>('/odoo/exportar', { que, limite }),
}
