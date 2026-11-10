"use client"

import { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "react-toastify"
import { Search, Plus, Package, ShoppingCart } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import Image from "next/image"
import { formatPrice } from "@/utils/format"

interface AddProductToOrderModalProps {
  orderId: string
  isOpen: boolean
  onClose: () => void
  onProductAdded: () => void
}

interface Product {
  id: string
  name: string
  sku: string
  price: number
  unit_quantity: number
  unit_type: string
  image: string
  description: string
}

export function AddProductToOrderModal({ 
  orderId, 
  isOpen, 
  onClose, 
  onProductAdded 
}: AddProductToOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  // Cargar productos cuando se abre el modal
  useEffect(() => {
    if (isOpen && orderId) {
      loadProducts()
    }
  }, [isOpen, orderId, search])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const productList = await apiClient.getAvailableProductsForOrder(orderId, search)
      setProducts(productList)
    } catch (error) {
      console.error("Error cargando productos:", error)
      toast.error("Error al cargar productos")
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = async () => {
    if (!selectedProduct) {
      toast.error("Selecciona un producto")
      return
    }

    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a 0")
      return
    }

    try {
      setAdding(true)
      
      await apiClient.addOrderItem(orderId, {
        product_id: selectedProduct.id,
        quantity: quantity,
        price: selectedProduct.price,
        unit_quantity: selectedProduct.unit_quantity
      })

      toast.success("Producto agregado a la orden")
      setSelectedProduct(null)
      setQuantity(1)
      onProductAdded()
      onClose()
    } catch (error) {
      console.error("Error agregando producto:", error)
      toast.error("Error al agregar producto")
    } finally {
      setAdding(false)
    }
  }

  const calculateTotal = (product: Product, qty: number) => {
    // Fórmula completa: cantidad × unidad × precio
    return product.price * qty * product.unit_quantity
  }

  const handleClose = () => {
    setSelectedProduct(null)
    setQuantity(1)
    setSearch("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Agregar Producto a la Orden
          </DialogTitle>
          <DialogDescription>
            Selecciona un producto para agregar a la orden. Los cálculos se harán automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de productos */}
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full w-6 h-6 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">Cargando productos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
              {products.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Package className="mx-auto w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-gray-500">No se encontraron productos</p>
                </div>
              ) : (
                products.map((product) => (
                  <Card
                    key={product.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedProduct?.id === product.id
                        ? "ring-2 ring-blue-500 border-blue-500"
                        : "border-gray-200"
                    }`}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name}
                            width={50}
                            height={50}
                            className="rounded-md object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{product.name}</h4>
                          <p className="text-xs text-gray-500 mb-1">{product.sku}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {formatPrice(product.price)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {product.unit_quantity} {product.unit_type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Detalles del producto seleccionado */}
          {selectedProduct && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Producto Seleccionado</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm"><strong>Nombre:</strong> {selectedProduct.name}</p>
                    <p className="text-sm"><strong>SKU:</strong> {selectedProduct.sku}</p>
                    <p className="text-sm"><strong>Precio:</strong> {formatPrice(selectedProduct.price)}</p>
                    <p className="text-sm"><strong>Unidades:</strong> {selectedProduct.unit_quantity} {selectedProduct.unit_type}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Cantidad</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full"
                    />
                    <p className="text-sm text-gray-600">
                      <strong>Total:</strong> {quantity} × {selectedProduct.unit_quantity} × {formatPrice(selectedProduct.price)} = 
                      <span className="text-blue-600 font-medium ml-1">
                        {formatPrice(calculateTotal(selectedProduct, quantity))}
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAddProduct} 
            disabled={!selectedProduct || adding}
            className="flex items-center gap-2"
          >
            {adding ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Agregando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Agregar Producto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}