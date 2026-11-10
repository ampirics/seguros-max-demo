"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { ProductForm } from "@/components/admin/product-form"
import { apiClient } from "@/lib/api-client"
import type { Product } from "@/lib/types"
import { toast } from "react-toastify"

export default function NewProductPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  const handleSubmit = async (productData: Omit<Product, "id">) => {
    setSaving(true)
    try {
      const payload: any = {
        ...productData,
        is_visible: productData.isVisible,
        images: productData.images || [],
      }
      if (!payload.image && payload.images.length > 0) payload.image = payload.images[0]
      // Sin oferta no se mandan: el backend rechaza original_price = 0.
      if (!payload.is_on_sale) {
        delete payload.original_price
        delete payload.discount_percentage
      }
      if (!payload.sku) delete payload.sku
      delete payload.company_id

      // Antes: fetch('api/v1/admin/products/') sin barra inicial → 404 siempre.
      await apiClient.request('/admin/products/', { method: 'POST', body: JSON.stringify(payload) })
      toast.success('Producto creado correctamente')
      router.push("/admin/products")
    } catch (error: any) {
      console.error("Error creating product:", error)
      toast.error(error?.message || 'No se pudo crear el producto')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push("/admin/products")
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return null
  }

  return (
    <AdminLayout title="Nuevo producto">
      <div className="max-w-4xl mx-auto">
        <ProductForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={saving} />
      </div>
    </AdminLayout>
  )
}
