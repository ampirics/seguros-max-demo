"use client"

import { urlImagen } from '@/lib/api/piezas'
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Product } from "@/lib/types"
import { apiClient } from "@/lib/api-client"
import { 
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Tag,
  DollarSign,
  Palette,
  Ruler,
  Calendar,
  Building,
  Loader2,
  MoreHorizontal
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import Link from "next/link"
import { toast } from "react-toastify"

export default function ProductDetailPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const params = useParams()
  const productId = (params?.id ?? '') as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user && productId && typeof productId === 'string' && productId !== 'undefined') {
      loadProduct()
    }
  }, [user, productId])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(price)
  }

  const loadProduct = async () => {
    try {
      setLoading(true)
      
      try {
        const data: any = await apiClient.request(`/admin/products/${productId}`)
        setProduct(data)
      } catch (err: any) {
        if (/404|not found|no encontrado/i.test(String(err?.message))) {
          toast.error('Producto no encontrado')
          router.push('/admin/products')
        } else {
          throw err
        }
      }
    } catch (error) {
      console.error('Error loading product:', error)
      toast.error('Error de conexión al cargar el producto')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!product) return
    
    if (!confirm("¿Estás seguro de que quieres eliminar este producto?")) {
      return
    }

    try {
      await apiClient.request(`/admin/products/${product.id}`, { method: 'DELETE' })
      toast.success('Producto eliminado correctamente')
      router.push('/admin/products')
    } catch (error: any) {
      console.error('Error deleting product:', error)
      toast.error(error?.message || 'No se pudo eliminar. Si tiene pedidos, ocúltalo en su lugar.')
    }
  }

  const toggleProductVisibility = async () => {
    if (!product) return

    const newVisibility = !(product.isVisible || product.is_visible)

    try {
      // Antes: proxy de Next (/api/admin/products, sin v1) que respondía «ok»
      // aunque el backend fallara, y reenviaba el producto entero.
      const updatedProduct: any = await apiClient.request(`/admin/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_visible: newVisibility }),
      })
      setProduct(updatedProduct)
      toast.success(`Producto ${newVisibility ? 'mostrado' : 'ocultado'} correctamente`)
    } catch (error: any) {
      console.error('Error toggling product visibility:', error)
      toast.error(error?.message || 'No se pudo cambiar la visibilidad')
    }
  }

  if (isLoading || loading || !productId || typeof productId !== 'string' || productId === 'undefined') {
    return (
      <AdminLayout title="Producto">
        <div className="flex h-96 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando producto…
        </div>
      </AdminLayout>
    )
  }

  if (!user || !product) {
    return null
  }


  const visible = !!(product.isVisible || product.is_visible)

  return (
    <AdminLayout title="Producto">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="ghost" size="icon" asChild className="mt-0.5 h-9 w-9 shrink-0">
              <Link href="/admin/products" aria-label="Volver a productos">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold [overflow-wrap:anywhere]">{product.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {product.sku && <span className="font-mono">SKU {product.sku}</span>}
                {!visible && <Badge variant="secondary">Oculto en la tienda</Badge>}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={toggleProductVisibility} className="gap-2">
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {visible ? "Ocultar" : "Mostrar"}
            </Button>
            <Button asChild>
              <Link href={`/admin/products/${product.id}/edit`} className="gap-2">
                <Edit className="h-4 w-4" />
                Editar
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDeleteProduct} className="text-destructive focus:text-destructive">
                  <Trash2 /> Eliminar producto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Las fotos del catálogo traen fondo blanco: el marco bg-foto las integra en los dos modos */}
          <Card className="overflow-hidden lg:col-span-1 lg:self-start">
            <div className={`relative aspect-square bg-foto ${visible ? "" : "opacity-60"}`}>
              {product.image ? (
                <Image
                  src={urlImagen(product.image) ?? ""}
                  alt={product.name}
                  fill
                  className="object-contain p-6 dark:brightness-90"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-product.png'
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-xs text-muted-foreground">Precio</p>
                  <p className="font-display text-3xl font-semibold tabular-nums">{formatPrice(product.price)}</p>
                </div>
                {product.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Descripción</p>
                    <p className="mt-0.5 text-sm leading-relaxed">{product.description}</p>
                  </div>
                )}
                <dl className="grid grid-cols-1 gap-4 border-t pt-5 text-sm sm:grid-cols-2">
                  {product.sku && (
                    <div>
                      <dt className="text-xs text-muted-foreground">SKU</dt>
                      <dd className="mt-0.5 font-mono">{product.sku}</dd>
                    </div>
                  )}
                  {product.external_category_code && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Categoría</dt>
                      <dd className="mt-0.5">{product.external_category_code}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Variaciones Disponibles */}
            {((product.colors && product.colors.length > 0) ||
              (product.sizes && product.sizes.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Variaciones
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {product.colors?.length || 0} colores · {product.sizes?.length || 0} tallas ·{" "}
                    {(product.colors?.length || 0) * (product.sizes?.length || 0)} combinaciones posibles
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {product.colors && product.colors.length > 0 && (
                      <div>
                        <p className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
                          <Palette className="h-3.5 w-3.5" />
                          Colores ({product.colors.length})
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {product.colors.map((color, index) => (
                            <div key={index} className="flex items-center gap-3 rounded-lg border p-2">
                              <div
                                className="h-6 w-6 rounded-full border"
                                style={{ backgroundColor: typeof color === 'string' ? '#cccccc' : color.value }}
                                title={typeof color === 'string' ? color : color.value}
                              />
                              <span className="text-sm font-medium">
                                {typeof color === 'string' ? color : color.name}
                              </span>
                              {typeof color !== 'string' && (
                                <span className="ml-auto font-mono text-xs text-muted-foreground">{color.value}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {product.sizes && product.sizes.length > 0 && (
                      <div>
                        <p className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
                          <Ruler className="h-3.5 w-3.5" />
                          Tallas ({product.sizes.length})
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {product.sizes.map((size, index) => (
                            <Badge key={index} variant="outline" className="justify-center py-1.5">
                              {size}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SKUs de variantes */}
            {product.generated_skus && product.generated_skus.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Variantes ({product.generated_skus.length})
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y text-xs text-muted-foreground">
                        <th className="px-6 py-2 text-left font-medium">SKU</th>
                        <th className="px-3 py-2 text-left font-medium">Talla</th>
                        <th className="px-3 py-2 text-left font-medium">Color</th>
                        <th className="px-3 py-2 text-left font-medium">Combinación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {product.generated_skus.map((item, index) => (
                        <tr key={index} className="hover:bg-secondary/50">
                          <td className="px-6 py-2 font-mono">{item.sku}</td>
                          <td className="px-3 py-2">{item.size}</td>
                          <td className="px-3 py-2">{item.color}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.combination}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Datos técnicos: solo para soporte, plegados por defecto */}
            <details className="group rounded-lg border bg-card px-6 py-4 text-sm">
              <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Datos técnicos</summary>
              <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Creado</dt>
                  <dd className="mt-0.5">No disponible</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Actualizado</dt>
                  <dd className="mt-0.5">No disponible</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Building className="h-3.5 w-3.5" /> ID de empresa</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">{product.company_id || 'No disponible'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">ID del producto</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">{product.id}</dd>
                </div>
              </dl>
            </details>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
