"use client"

import { useState, useEffect, useMemo } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Edit2, X, Search, CheckSquare } from "lucide-react"
import apiClient from "@/lib/api-client"
import { getAdminProducts } from "@/lib/admin-products"
import type { Tax, TaxFormData, CategoryCode } from "@/lib/types/tax"

export default function TaxesAdminPage() {
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [categories, setCategories] = useState<CategoryCode[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  
  const [formData, setFormData] = useState<TaxFormData>({
    name: "",
    description: "",
    percentage: 0,
    category_codes: [],
    is_active: true,
    is_compound: false
  })

  // Cargar datos
  useEffect(() => {
    fetchTaxes()
    fetchCategories()
    fetchProducts()
  }, [])

  const fetchTaxes = async () => {
    try {
      setLoading(true)
      const response = await apiClient.taxes.list(0, 100)
      setTaxes(Array.isArray(response) ? response : response.data || [])
      setError(null)
    } catch (err) {
      setError("Error cargando impuestos")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await apiClient.taxes.getAvailableCategories()
      const codes = response.category_codes || []
      // Mapear para soportar tanto formato antiguo como nuevo
      setCategories(codes.map((item: any) => ({
        code: typeof item === 'string' ? item : item.code,
        product_name: typeof item === 'string' ? item : (item.product_name || item.code),
        name: typeof item === 'string' ? item : (item.name || item.code)
      })))
    } catch (err) {
      console.error("Error cargando categorías:", err)
    }
  }

  const fetchProducts = async () => {
    try {
      const prods = await getAdminProducts()
      setProducts(prods || [])
    } catch (err) {
      console.error("Error cargando productos:", err)
      // Si falla, simplemente continuamos sin productos - no es crítico
      setProducts([])
    }
  }

  // Filtrar categorías por búsqueda de producto, nombre o descripción
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    
    const query = searchQuery.toLowerCase()
    
    // Buscar categorías que coincidan con productos que contienen el nombre
    const matchingProductCodes = products
      .filter(p => p.name?.toLowerCase().includes(query) || p.code?.toLowerCase().includes(query))
      .map(p => p.code)
    
    // Retornar categorías que coincidan con productos, códigos o product_name
    return categories.filter(cat => 
      cat.code.toLowerCase().includes(query) ||
      (cat.product_name && cat.product_name.toLowerCase().includes(query)) ||
      matchingProductCodes.includes(cat.code)
    )
  }, [categories, searchQuery, products])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!(formData.percentage > 0 && formData.percentage <= 100)) {
      setError("El porcentaje debe estar entre 0 y 100.")
      return
    }
    if (formData.category_codes.length === 0 &&
        !confirm("Este impuesto no se aplicará a ninguna categoría. ¿Guardar igualmente?")) {
      return
    }
    try {
      setLoading(true)

      if (editingId) {
        await apiClient.taxes.update(editingId, formData)
      } else {
        await apiClient.taxes.create(formData)
      }

      await fetchTaxes()
      resetForm()
      setError(null)
    } catch (err: any) {
      // El formulario queda abierto con el motivo real (antes se cerraba igual).
      setError(err?.message || "Error guardando impuesto")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const tax = taxes.find(t => t.id === id)
    const n = tax?.category_codes?.length ?? 0
    if (!confirm(`¿Eliminar «${tax?.name ?? "este impuesto"}»? Dejará de aplicarse a ${n} categoría(s) en los pedidos nuevos. Los pedidos existentes no cambian.`)) return

    try {
      setLoading(true)
      await apiClient.taxes.delete(id)
      fetchTaxes()
      setError(null)
    } catch (err: any) {
      setError(err?.message || "Error eliminando impuesto")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (tax: Tax) => {
    setFormData({
      name: tax.name,
      description: tax.description || "",
      percentage: tax.percentage,
      category_codes: tax.category_codes,
      is_active: tax.is_active,
      is_compound: tax.is_compound
    })
    setEditingId(tax.id)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      percentage: 0,
      category_codes: [],
      is_active: true,
      is_compound: false
    })
    setEditingId(null)
    setShowForm(false)
  }

  const toggleCategory = (code: string) => {
    setFormData(prev => ({
      ...prev,
      category_codes: prev.category_codes.includes(code)
        ? prev.category_codes.filter(c => c !== code)
        : [...prev.category_codes, code]
    }))
  }

  const applyToAllCategories = () => {
    setFormData(prev => ({
      ...prev,
      category_codes: filteredCategories.map(cat => cat.code)
    }))
  }

  const clearAllCategories = () => {
    setFormData(prev => ({
      ...prev,
      category_codes: []
    }))
  }

  return (
    <AdminLayout title="Gestión de Impuestos">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Gestión de Impuestos</h1>
            <p className="text-gray-600">Configura impuestos y cargos por categoría de producto</p>
          </div>
          <Button
            onClick={() => !showForm ? setShowForm(true) : resetForm()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {showForm ? "Cancelar" : "Nuevo Impuesto"}
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex justify-between items-center">
          <span className="text-red-800">{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Editar Impuesto" : "Crear Nuevo Impuesto"}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Impuesto *
                </label>
                <Input
                  type="text"
                  placeholder="Ej: ITBIS, Envío, Descuento Regional"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="border-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Porcentaje (%) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  placeholder="Ej: 18.00"
                  value={Number.isNaN(formData.percentage) ? "" : formData.percentage}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    percentage: e.target.value === "" ? (NaN as any) : parseFloat(e.target.value)
                  }))}
                  required
                  className="border-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción (opcional)
              </label>
              <Input
                type="text"
                placeholder="Descripción del impuesto"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="border-gray-300"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Activo</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_compound}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_compound: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Impuesto Compuesto (aplica sobre otros impuestos)</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Aplicar a Categorías
              </label>

              {/* Búsqueda */}
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre de producto o código de categoría..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-300"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  onClick={applyToAllCategories}
                  disabled={filteredCategories.length === 0}
                  className="flex-1 bg-primary hover:bg-primary/85 text-primary-foreground text-sm disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Aplicar a Todos ({filteredCategories.length})
                </Button>
                <Button
                  type="button"
                  onClick={clearAllCategories}
                  disabled={formData.category_codes.length === 0}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white text-sm disabled:opacity-50"
                >
                  Limpiar Selección ({formData.category_codes.length})
                </Button>
              </div>

              {/* Grid de categorías/productos */}
              <div className="max-h-64 overflow-y-auto p-3 border rounded-lg bg-gray-50">
                {filteredCategories.length > 0 ? (
                  <div className="space-y-2">
                    {filteredCategories.map(cat => (
                        <label
                          key={cat.code}
                          className="flex items-start space-x-3 cursor-pointer hover:bg-white p-3 rounded border border-transparent hover:border-gray-300 transition"
                        >
                          <input
                            type="checkbox"
                            checked={formData.category_codes.includes(cat.code)}
                            onChange={() => toggleCategory(cat.code)}
                            className="w-4 h-4 mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 line-clamp-2">
                              {cat.product_name || cat.code}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Categoría: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{cat.code}</span>
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {searchQuery.trim() ? "No hay categorías que coincidan con la búsqueda" : "No hay categorías disponibles"}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Mostrando {formData.category_codes.length} categoría(s) seleccionada(s)
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={loading || !formData.name}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {loading ? "Guardando..." : editingId ? "Actualizar" : "Crear"} Impuesto
              </Button>
              <Button
                type="button"
                onClick={resetForm}
                className="flex-1 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Taxes Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading && taxes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Cargando impuestos...
          </div>
        ) : taxes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay impuestos configurados
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">%</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Categorías</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {taxes.map(tax => (
                <tr key={tax.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{tax.name}</p>
                      {tax.description && (
                        <p className="text-sm text-gray-500">{tax.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold">
                    <span className={tax.percentage < 0 ? "text-green-600" : "text-orange-600"}>
                      {tax.percentage > 0 ? "+" : ""}{tax.percentage.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tax.is_compound 
                        ? "bg-purple-100 text-purple-800" 
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {tax.is_compound ? "Compuesto" : "Simple"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-1 flex-wrap">
                      {tax.category_codes.length > 0 ? (
                        tax.category_codes.map(code => (
                          <span key={code} className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs font-mono">
                            {code}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-xs">Sin categorías</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tax.is_active 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {tax.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(tax)}
                      disabled={loading}
                      className="text-blue-600 hover:text-blue-800 disabled:opacity-50 inline-block"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tax.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 inline-block"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </AdminLayout>
  )
}
