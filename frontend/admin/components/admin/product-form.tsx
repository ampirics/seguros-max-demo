"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Product, Color, ProductDetail } from "@/lib/types"
import { Plus, X, Zap } from "lucide-react"

interface ProductFormProps {
  product?: Product
  onSubmit: (productData: Omit<Product, "id">) => void
  onCancel: () => void
  isLoading?: boolean
}

export function ProductForm({ product, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    external_category_code: product?.external_category_code || "",
    sku_mask: product?.sku_mask || "external_category_code-Size(2)-Color(2)",
    price: product?.price || 0,
    original_price: product?.original_price || 0,
    discount_percentage: product?.discount_percentage || 0,
    is_on_sale: product?.is_on_sale || false,
    unit_quantity: product?.unit_quantity || 1,
    unit_type: product?.unit_type || "unidad",
    description: product?.description || "",
    image: product?.image || "",
    images: product?.images || [],
    colors: product?.colors || [],
    sizes: product?.sizes || [],
    details: product?.details || [],
    isVisible: product?.isVisible ?? true,
  })

  // Estado para SKUs generados
  const [generatedSKUs, setGeneratedSKUs] = useState<Array<{sku: string, size: string, color: string, combination: string, active?: boolean, price?: number}>>([])
  const [showSKUTable, setShowSKUTable] = useState(false)
  // Marca: el usuario tocó manualmente los SKUs en esta sesión.
  // Evita que un re-render del padre (ej. setProduct tras refetch) sobrescriba
  // los toggles `active` recién hechos antes de hacer submit.
  const [skusUserDirty, setSkusUserDirty] = useState(false)

  // Inicializar SKUs generados cuando se carga un producto existente.
  // Si el usuario ya editó los SKUs en esta sesión, NO sobrescribir desde el prop.
  useEffect(() => {
    if (skusUserDirty) return
    if (product?.generated_skus && Array.isArray(product.generated_skus) && product.generated_skus.length > 0) {
      setGeneratedSKUs(product.generated_skus as any)
      setShowSKUTable(true)
    } else {
      setGeneratedSKUs([])
      setShowSKUTable(false)
    }
  }, [product, skusUserDirty])

  // Función para generar SKU automáticamente
  const generateSKU = async () => {
    if (!formData.external_category_code) {
      alert("Por favor, ingrese el código de categoría externa primero")
      return
    }

    const firstSize = formData.sizes.find(size => size.trim() !== "") || ""
    const firstColor = formData.colors.find(color => color.name.trim() !== "")?.name || ""

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/v1/admin/products/generate-sku-dynamic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          external_category_code: formData.external_category_code,
          size: firstSize,
          color: firstColor,
          sku_mask: formData.sku_mask
        })
      })

      if (response.ok) {
        const data = await response.json()
        setFormData(prev => ({ ...prev, sku: data.sku }))
      } else {
        console.error('Error generando SKU:', response.statusText)
      }
    } catch (error) {
      console.error('Error generando SKU:', error)
    }
  }

  // Función para generar múltiples SKUs
  const generateMultipleSKUs = async () => {
    if (!formData.external_category_code) {
      alert("Por favor, ingrese el código de categoría externa primero")
      return
    }

    const validSizes = formData.sizes.filter(size => size.trim() !== "")
    const validColors = formData.colors.filter(color => color.name.trim() !== "").map(c => c.name)

    if (validSizes.length === 0 || validColors.length === 0) {
      alert("Por favor, añada al menos una talla y un color")
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/v1/admin/products/generate-skus-dynamic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          external_category_code: formData.external_category_code,
          sizes: validSizes,
          colors: validColors,
          sku_mask: formData.sku_mask
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedSKUs(data.skus)
        setShowSKUTable(true)
      } else {
        console.error('Error generando SKUs múltiples:', response.statusText)
      }
    } catch (error) {
      console.error('Error generando SKUs múltiples:', error)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Normalizar SKUs generados: garantizar que cada uno tenga el campo
    // `active` explícito (default true) para que el backend pueda persistir
    // correctamente las desactivaciones.
    const normalizedSKUs = (generatedSKUs && Array.isArray(generatedSKUs))
      ? generatedSKUs.map((s: any) => ({
          ...s,
          active: s.active === false ? false : true,
        }))
      : []

    // Filter out empty values
    const cleanedData = {
      ...formData,
      images: formData.images.filter((img) => img.trim() !== ""),
      colors: formData.colors.filter((color) => color.name.trim() !== ""),
      sizes: formData.sizes.filter((size) => size.trim() !== ""),
      details: formData.details.filter((detail) => detail.label.trim() !== "" && detail.value.trim() !== ""),
      // Incluir los SKUs generados si existen (siempre con campo `active`)
      generated_skus: normalizedSKUs.length > 0 ? normalizedSKUs : undefined,
    }

    // DEBUG temporal
    try {
      const inactive = normalizedSKUs.filter((s: any) => s.active === false).map((s: any) => s.sku)
      console.log("[FORM SUBMIT] generatedSKUs.length=", generatedSKUs.length, "inactivos=", inactive, "sample0=", normalizedSKUs[0])
    } catch (_) {}

    onSubmit(cleanedData)
  }

  const addImage = () => {
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ""],
    }))
  }

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
  }

  const updateImage = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => (i === index ? value : img)),
    }))
  }

  const addColor = () => {
    setFormData((prev) => ({
      ...prev,
      colors: [...prev.colors, { name: "", value: "#000000" }],
    }))
  }

  const removeColor = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }))
  }

  const updateColor = (index: number, field: keyof Color, value: string) => {
    setFormData((prev) => ({
      ...prev,
      colors: prev.colors.map((color, i) => (i === index ? { ...color, [field]: value } : color)),
    }))
  }

  const addSize = () => {
    setFormData((prev) => ({
      ...prev,
      sizes: [...prev.sizes, ""],
    }))
  }

  const removeSize = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }))
  }

  const updateSize = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.map((size, i) => (i === index ? value : size)),
    }))
  }

  const addDetail = () => {
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, { label: "", value: "" }],
    }))
  }

  const removeDetail = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index),
    }))
  }

  const updateDetail = (index: number, field: keyof ProductDetail, value: string) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.map((detail, i) => (i === index ? { ...detail, [field]: value } : detail)),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Polo Premium 100% Algodón"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <div className="flex gap-2">
              <Input
                value={formData.sku}
                onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                placeholder="Ej: 456-SS-NE (se generará automáticamente si está vacío)"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={generateSKU}
                size="sm"
                variant="outline"
                className="px-3"
                title="Generar SKU automáticamente"
              >
                <Zap className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Si se deja vacío, se generará automáticamente basado en el código de categoría, talla y color
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de Categoría Externa</label>
            <Input
              value={formData.external_category_code}
              onChange={(e) => setFormData((prev) => ({ ...prev, external_category_code: e.target.value }))}
              placeholder="Ej: 8708 (partes de vehículos)"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Código interno que identifica la categoría del producto
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máscara de SKU</label>
            <Input
              value={formData.sku_mask}
              onChange={(e) => setFormData((prev) => ({ ...prev, sku_mask: e.target.value }))}
              placeholder="external_category_code-Size(2)-Color(2)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato para generar el SKU. Ej: external_category_code-Size(2)-Color(2) generará "406-SS-NE"
            </p>
          </div>

          {/* Botón para generar múltiples SKUs */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-gray-700">Generación Múltiple de SKUs</h4>
                <p className="text-xs text-gray-500">Genera SKUs para todas las combinaciones de tallas y colores</p>
              </div>
              <Button
                type="button"
                onClick={generateMultipleSKUs}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Generar Todos los SKUs
              </Button>
            </div>

            {/* Tabla de SKUs generados */}
            {showSKUTable && generatedSKUs && Array.isArray(generatedSKUs) && generatedSKUs.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  SKUs Generados ({generatedSKUs.length} combinaciones)
                </h5>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium">SKU</th>
                        <th className="text-left py-2 font-medium">Talla</th>
                        <th className="text-left py-2 font-medium">Color</th>
                        <th className="text-left py-2 font-medium">Precio (RD$)</th>
                        <th className="text-center py-2 font-medium">Activo</th>
                        <th className="text-left py-2 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedSKUs && generatedSKUs.map((item, index) => {
                        const isInactive = (item as any).active === false
                        return (
                        <tr
                          key={index}
                          className={`border-b border-gray-100 ${isInactive ? 'bg-red-50 opacity-60 line-through' : ''}`}
                        >
                          <td className="py-2">
                            <input
                              type="text"
                              value={item.sku}
                              onChange={(e) => {
                                const updatedSKUs = [...generatedSKUs]
                                updatedSKUs[index] = { ...updatedSKUs[index], sku: e.target.value }
                                setGeneratedSKUs(updatedSKUs)
                              }}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded font-mono text-green-600 focus:border-blue-400 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-gray-700">{item.size}</td>
                          <td className="py-2 text-gray-700">{item.color}</td>
                          <td className="py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price !== undefined && item.price !== null ? item.price : ''}
                              onChange={(e) => {
                                const updatedSKUs = [...generatedSKUs]
                                updatedSKUs[index] = {
                                  ...updatedSKUs[index],
                                  price: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                                setGeneratedSKUs(updatedSKUs)
                              }}
                              placeholder="Usa del producto"
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:border-blue-400 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={(item as any).active !== false}
                              onChange={(e) => {
                                const next = e.target.checked
                                console.log('[SKU TOGGLE]', (item as any).sku, '->', next)
                                const updatedSKUs = generatedSKUs.map((s: any, i: number) =>
                                  i === index ? { ...s, active: next } : s
                                )
                                setGeneratedSKUs(updatedSKUs)
                                setSkusUserDirty(true)
                              }}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updatedSKUs = generatedSKUs.filter((_, i) => i !== index)
                                setGeneratedSKUs(updatedSKUs)
                                if (updatedSKUs.length === 0) {
                                  setShowSKUTable(false)
                                }
                              }}
                              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    💡 Tip: Puedes editar cada SKU individualmente antes de guardar
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedSKUs([])
                      setShowSKUTable(false)
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Limpiar Todos
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio (RD$)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: Number.parseFloat(e.target.value) || 0 }))}
              placeholder="24.99"
              required
            />
          </div>

          {/* Nuevos campos para unidades y descuentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad por Unidad</label>
              <Input
                type="number"
                min="1"
                value={formData.unit_quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit_quantity: parseInt(e.target.value) || 1 }))}
                placeholder="1"
              />
              <p className="text-xs text-gray-500 mt-1">Cantidad de productos por unidad de venta</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Unidad</label>
              <select
                value={formData.unit_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="unidad">Unidad</option>
                <option value="unidades">Unidades</option>
                <option value="par">Par</option>
                <option value="pares">Pares</option>
                <option value="pieza">Pieza</option>
                <option value="piezas">Piezas</option>
                <option value="pack">Pack</option>
                <option value="caja">Caja</option>
                <option value="docena">Docena</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Información de Descuentos y Ofertas</h3>
            
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="is_on_sale"
                checked={formData.is_on_sale}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_on_sale: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_on_sale" className="ml-2 block text-sm text-gray-900">
                Este producto está en oferta
              </label>
            </div>

            {formData.is_on_sale && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Original (RD$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.original_price}
                    onChange={(e) => {
                      const originalPrice = Number.parseFloat(e.target.value) || 0
                      const currentPrice = formData.price
                      const discount = originalPrice > 0 ? ((originalPrice - currentPrice) / originalPrice) * 100 : 0
                      setFormData((prev) => ({ 
                        ...prev, 
                        original_price: originalPrice,
                        discount_percentage: Math.round(discount * 100) / 100
                      }))
                    }}
                    placeholder="35.99"
                  />
                  <p className="text-xs text-gray-500 mt-1">Precio antes del descuento</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Descuento (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => {
                      const discount = Number.parseFloat(e.target.value) || 0
                      const originalPrice = formData.original_price || 0
                      const newPrice = originalPrice > 0 ? originalPrice * (1 - discount / 100) : formData.price
                      setFormData((prev) => ({ 
                        ...prev, 
                        discount_percentage: discount,
                        price: Math.round(newPrice * 100) / 100
                      }))
                    }}
                    placeholder="15.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Se calculará automáticamente el precio final</p>
                </div>
              </div>
            )}

            {formData.is_on_sale && formData.original_price > 0 && formData.discount_percentage > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-700">
                    <strong>Precio Original:</strong> RD$ {formData.original_price.toFixed(2)}
                  </span>
                  <span className="text-green-700">
                    <strong>Descuento:</strong> {formData.discount_percentage.toFixed(1)}%
                  </span>
                  <span className="text-green-700">
                    <strong>Precio Final:</strong> RD$ {formData.price.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-green-600">
                  Ahorro: RD$ {(formData.original_price - formData.price).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción detallada del producto..."
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen Principal</label>
            <Input
              value={formData.image}
              onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
              placeholder="/placeholder.svg?height=300&width=300"
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Product Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Visibilidad en la Tienda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isVisible"
              checked={formData.isVisible}
              onChange={(e) => setFormData((prev) => ({ ...prev, isVisible: e.target.checked }))}
              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
            />
            <label htmlFor="isVisible" className="text-sm font-medium text-gray-700">
              Mostrar producto en la tienda
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {formData.isVisible
              ? "Este producto será visible para los clientes en la tienda"
              : "Este producto estará oculto y no aparecerá en la tienda"}
          </p>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Galería de Imágenes
            <Button type="button" onClick={addImage} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Agregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.images.map((image, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                value={image}
                onChange={(e) => updateImage(index, e.target.value)}
                placeholder="/placeholder.svg?height=400&width=400"
                className="flex-1"
              />
              {formData.images.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeImage(index)}
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Colores Disponibles
            <Button type="button" onClick={addColor} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Agregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.colors.map((color, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                value={color.name}
                onChange={(e) => updateColor(index, "name", e.target.value)}
                placeholder="Nombre del color (ej: Rojo)"
                className="flex-1"
              />
              <input
                type="color"
                value={color.value}
                onChange={(e) => updateColor(index, "value", e.target.value)}
                className="w-12 h-10 rounded border border-gray-300"
              />
              {formData.colors.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeColor(index)}
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sizes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Tallas Disponibles
            <Button type="button" onClick={addSize} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Agregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {formData.sizes.map((size, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={size}
                  onChange={(e) => updateSize(index, e.target.value)}
                  placeholder="S, M, L, XL..."
                  className="flex-1"
                />
                {formData.sizes.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeSize(index)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Product Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Detalles del Producto
            <Button type="button" onClick={addDetail} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Agregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.details.map((detail, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                value={detail.label}
                onChange={(e) => updateDetail(index, "label", e.target.value)}
                placeholder="Etiqueta (ej: Tipo de tejido)"
                className="flex-1"
              />
              <Input
                value={detail.value}
                onChange={(e) => updateDetail(index, "value", e.target.value)}
                placeholder="Valor (ej: 100% Algodón)"
                className="flex-1"
              />
              {formData.details.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeDetail(index)}
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex space-x-4">
        <Button type="submit" disabled={isLoading} className="flex-1 bg-primary hover:bg-primary/90 text-white">
          {isLoading ? "Guardando..." : product ? "Actualizar Producto" : "Crear Producto"}
        </Button>
        <Button type="button" onClick={onCancel} variant="outline" className="flex-1 bg-transparent">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
