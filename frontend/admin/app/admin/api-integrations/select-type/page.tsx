'use client'

import { AdminLayout } from '@/components/admin/admin-layout'
import { useAdmin } from '@/contexts/admin-context'
import { Loader2 } from 'lucide-react'

export default function SelectIntegrationTypePage() {
  const { isLoading } = useAdmin()

  if (isLoading) {
    return (
      <AdminLayout title="Seleccionar Tipo de Integración">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Seleccionar Tipo de Integración">
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Seleccionar Tipo de Integración</h1>
          <p className="text-gray-600 mt-2">
            Selecciona el tipo de integración que deseas configurar
          </p>
        </div>
        
        <div className="text-center py-8">
          <p className="text-gray-500">Funcionalidad en desarrollo...</p>
        </div>
      </div>
    </AdminLayout>
  )
}