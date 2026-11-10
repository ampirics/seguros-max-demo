"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { frontLabelApi } from "@/lib/frontlabel-api"

export default function FrontLabelsDebugPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testConnection = async () => {
    setLoading(true)
    setError(null)
    setData(null)
    
    try {
      
      // Test 1: Check token
      const token = localStorage.getItem('auth_token')
      
      // Test 2: Make API call
      const result = await frontLabelApi.list(0, 5)
      setData(result)
      
    } catch (e: any) {
      console.error('API call failed:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    testConnection()
  }, [])

  return (
    <AdminLayout title="FrontLabels Debug">
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Debug de Conexión FrontLabel API</h2>
          
          <Button onClick={testConnection} disabled={loading}>
            {loading ? 'Probando...' : 'Probar Conexión'}
          </Button>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              <h3 className="font-semibold">Error:</h3>
              <pre className="mt-2 text-sm whitespace-pre-wrap">{error}</pre>
            </div>
          )}
          
          {data && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              <h3 className="font-semibold">Éxito:</h3>
              <pre className="mt-2 text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
          
          <div className="mt-4 p-4 bg-gray-100 border border-gray-400 text-gray-700 rounded">
            <h3 className="font-semibold">Información del Entorno:</h3>
            <p>URL Base: {typeof window !== 'undefined' ? window.location.origin : 'SSR'}</p>
            <p>Token presente: {typeof window !== 'undefined' ? !!localStorage.getItem('auth_token') : 'Desconocido'}</p>
            <p>Navegador: {typeof window !== 'undefined' ? navigator.userAgent : 'SSR'}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}