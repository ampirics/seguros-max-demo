"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { ProductForm } from "@/components/admin/product-form"
import type { Product } from "@/lib/types"
import { toast } from "react-toastify"
import { apiClient } from "@/lib/api-client"

export default function EditProductPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const params = useParams()
  const productId = (params?.id ?? '') as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Cargar producto
  const loadProduct = useCallback(async () => {
    if (!productId || typeof productId !== 'string' || productId === 'undefined') return
    try {
      setLoading(true)
      const data = await apiClient.getAdminProduct(productId)
      setProduct(data)
    } catch (error: any) {
      if (error?.response?.status === 404) {
        toast.error('Producto no encontrado')
        router.push('/admin/products')
      } else {
        console.error('Error loading product:', error)
        toast.error('Error al cargar el producto')
      }
    } finally {
      setLoading(false)
    }
  }, [productId, router])

  // Esperar a que el usuario esté cargado antes de redirigir
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  // Cargar producto cuando el usuario está disponible
  useEffect(() => {
    if (user && productId && typeof productId === 'string' && productId !== 'undefined') {
      loadProduct()
    }
  }, [user, productId, loadProduct])

  // Guardar cambios
  const handleSubmit = async (productData: Omit<Product, "id">) => {
    setSaving(true)
    try {
      const payload: any = {
        ...productData,
        is_visible: productData.isVisible,
        images: productData.images || [],
      }
      // La galería no se edita en este formulario: antes se sustituía por las
      // imágenes principales y se perdía.
      delete payload.gallery

      if ((!payload.image || payload.image === "") && payload.images.length > 0) {
        payload.image = payload.images[0]
      }

      if (!payload.is_on_sale) {
        delete payload.original_price
        delete payload.discount_percentage
      }

      // La empresa del producto no se cambia desde aquí.
      delete payload.company_id
      if (!payload.sku) delete payload.sku

      await apiClient.request(`/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Producto actualizado correctamente')
      router.push("/admin/products")
    } catch (error: any) {
      console.error('Error updating product:', error)
      toast.error(error?.message || 'Error al actualizar el producto')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push("/admin/products")
  }

  if (isLoading || loading) {
    return (
      <AdminLayout title="Editar producto">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando producto...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!user || !product) return null

  return (
    <AdminLayout title="Editar producto">
      <div className="max-w-4xl mx-auto">
        <ProductForm 
          product={product}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={saving}
        />
      </div>
    </AdminLayout>
  )
}
