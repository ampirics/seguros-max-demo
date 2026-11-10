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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "react-toastify"
import { Save, X, Plus, Minus, Edit2, Trash2, ShoppingCart } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { AddProductToOrderModal } from "./add-product-to-order-modal"
import { formatPrice, formatNumber } from "@/utils/format"

interface OrderEditModalProps {
  order: any
  isOpen: boolean
  onClose: () => void
  onUpdate: (orderId: string, orderData: any) => Promise<void>
}

// Los `value` deben coincidir EXACTAMENTE con el enum OrderStatus del backend
// (app/models/order.py), que los define en MAYUSCULAS. Estaban en minusculas y
// Pydantic rechazaba cualquier cambio de estado con 422: el modal no podia
// guardar ninguno de los seis. Ademas, como `order.status` llega en mayusculas,
// ningun value coincidia y el desplegable aparecia vacio al abrir.
const ORDER_STATUSES = [
  { value: "PENDING", label: "Pendiente", color: "bg-warning-soft text-warning" },
  { value: "AWAITING_CONFIRMATION", label: "Esperando Confirmación", color: "bg-warning-soft text-warning" },
  { value: "CONFIRMED", label: "Confirmada", color: "bg-blue-100 text-blue-800" },
  { value: "PAID", label: "Pagada", color: "bg-success-soft text-success" },
  { value: "PROCESSING", label: "Procesando", color: "bg-secondary text-muted-foreground" },
  { value: "SHIPPED", label: "Listo para Retiro / Enviada", color: "bg-warning-soft text-warning" },
  { value: "DELIVERED", label: "Entregada / Retirada", color: "bg-success-soft text-success" },
  { value: "CANCELLED", label: "Cancelada", color: "bg-destructive-soft text-destructive" },
  { value: "PAYMENT_FAILED", label: "Pago Fallido", color: "bg-rose-100 text-rose-800" },
]

export function OrderEditModal({ order, isOpen, onClose, onUpdate }: OrderEditModalProps) {
  const [formData, setFormData] = useState({
    status: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    shipping_address: "",
    notes: "",
    external_reference: ""
  })
  
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  // Borradores por línea: se guardan al salir del campo o con Enter (antes cada
  // tecla lanzaba un PUT: "150" enviaba 1, 15 y 150, y borrar el precio guardaba 0).
  const [drafts, setDrafts] = useState<Record<string, { quantity?: string; price?: string }>>({})
  // Pedido pagado o ya en SAP: cambiar líneas descuadraría lo cobrado y la orden de SAP.
  const statusUpper = String(order?.status || "").toUpperCase()
  const linesLocked = Boolean(order?.external_reference) || ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(statusUpper)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [showAddProductModal, setShowAddProductModal] = useState(false)

  // Inicializar formulario y cargar items cuando se abra el modal
  useEffect(() => {
    if (order && isOpen) {
      setFormData({
        status: (order.status || "").toUpperCase(),
        customer_name: order.customer_info?.name || "",
        customer_email: order.customer_info?.email || "",
        customer_phone: order.customer_info?.phone || "",
        shipping_address: order.customer_info?.address || "",
        notes: order.notes || "",
        external_reference: order.external_reference || ""
      })
      
      // Cargar items de la orden
      loadOrderItems()
    }
  }, [order, isOpen])

  const loadOrderItems = async () => {
    if (!order?.id) return
    
    try {
      setItemsLoading(true)
      const orderItems = await apiClient.getOrderItems(order.id)
      setItems(orderItems || order.items || [])
    } catch (error) {
      console.error("Error loading order items:", error)
      setItems(order.items || [])
    } finally {
      setItemsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      await onUpdate(order.id, formData)
      toast.success("Orden actualizada correctamente")
      onClose()
    } catch (error) {
      console.error("Error updating order:", error)
      toast.error("Error al actualizar la orden")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateItemQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return
    
    try {
      await apiClient.updateOrderItem(order.id, itemId, { quantity: newQuantity })
      await loadOrderItems()
      toast.success("Cantidad actualizada")
    } catch (error) {
      console.error("Error updating item quantity:", error)
      toast.error("Error al actualizar cantidad")
    }
  }

  const updateItemPrice = async (itemId: string, newPrice: number) => {
    if (newPrice < 0) return
    
    try {
      await apiClient.updateOrderItem(order.id, itemId, { price: newPrice })
      await loadOrderItems()
      toast.success("Precio actualizado")
    } catch (error) {
      console.error("Error updating item price:", error)
      toast.error("Error al actualizar precio")
    }
  }

  const draftValue = (item: any, field: "quantity" | "price") =>
    drafts[item.id]?.[field] ?? String(field === "quantity" ? (item.quantity || 1) : (item.price ?? ""))

  const setDraft = (itemId: string, field: "quantity" | "price", value: string) =>
    setDrafts(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }))

  const commitDraft = async (item: any, field: "quantity" | "price") => {
    const raw = drafts[item.id]?.[field]
    if (raw === undefined) return
    const clear = () => setDrafts(prev => {
      const next = { ...prev }
      if (next[item.id]) { delete next[item.id][field]; if (!Object.keys(next[item.id]).length) delete next[item.id] }
      return next
    })
    if (field === "quantity") {
      const q = parseInt(raw, 10)
      if (!Number.isFinite(q) || q < 1) { toast.error("La cantidad debe ser 1 o más"); clear(); return }
      if (q !== Number(item.quantity)) await updateItemQuantity(item.id, q)
    } else {
      const pr = parseFloat(raw.replace(",", "."))
      if (!Number.isFinite(pr) || pr <= 0) { toast.error("El precio debe ser mayor que 0"); clear(); return }
      if (pr !== Number(item.price)) await updateItemPrice(item.id, Math.round(pr * 100) / 100)
    }
    clear()
  }

  const removeItem = async (itemId: string) => {
    if (!window.confirm("¿Quitar este producto del pedido?")) return
    try {
      await apiClient.deleteOrderItem(order.id, itemId)
      await loadOrderItems()
      toast.success("Item eliminado")
    } catch (error) {
      console.error("Error removing item:", error)
      toast.error("Error al eliminar item")
    }
  }

  const calculateItemTotal = (item: any) => {
    const price = parseFloat(item.price || 0)
    const quantity = parseInt(item.quantity || 0)
    const unitQuantity = parseInt(item.unit_quantity || 1)
    // Fórmula: cantidad × unidad × precio (unit_quantity opcional por compatibilidad)
    return price * quantity * unitQuantity
  }

  const calculateOrderTotal = () => {
    return items.reduce((total, item) => {
      const itemTotal = calculateItemTotal(item)
      return total + itemTotal
    }, 0)
  }

  const handleProductAdded = async () => {
    // Refrescar la lista de items después de agregar un producto
    await loadOrderItems()
  }

  const getStatusColor = (status: string) => {
    return ORDER_STATUSES.find(s => s.value === status)?.color || "bg-gray-100 text-gray-800"
  }

  const getStatusLabel = (status: string) => {
    return ORDER_STATUSES.find(s => s.value === status)?.label || status
  }

  if (!order) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Orden #{order.order_number || order.id.slice(-8)}
          </DialogTitle>
          <DialogDescription>
            Modifica los detalles de la orden. Los cambios se aplicarán inmediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado de la Orden */}
          <div className="space-y-2">
            <Label htmlFor="status">Estado de la Orden</Label>
            <div className="flex items-center gap-3">
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.status && (
                <Badge className={getStatusColor(formData.status)}>
                  {getStatusLabel(formData.status)}
                </Badge>
              )}
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Nombre del Cliente</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleInputChange("customer_name", e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_email">Email</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => handleInputChange("customer_email", e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_phone">Teléfono</Label>
            <Input
              id="customer_phone"
              value={formData.customer_phone}
              onChange={(e) => handleInputChange("customer_phone", e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Dirección de Envío */}
          <div className="space-y-2">
            <Label htmlFor="shipping_address">Dirección de Envío</Label>
            <Textarea
              id="shipping_address"
              value={formData.shipping_address}
              onChange={(e) => handleInputChange("shipping_address", e.target.value)}
              placeholder="Dirección completa de envío"
              rows={3}
            />
          </div>

          {/* Referencia Externa */}
          <div className="space-y-2">
            <Label htmlFor="external_reference">N.º de orden en SAP</Label>
            <Input
              id="external_reference"
              value={formData.external_reference}
              readOnly
              className="bg-muted"
              placeholder="Aún no se ha creado en SAP"
              title="Lo asigna la integración con SAP; cambiarlo rompería el enlace con la orden de SAP"
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Internas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Notas adicionales sobre la orden"
              rows={3}
            />
          </div>

          {/* Items de la Orden */}
          <div className="space-y-4">
            {linesLocked && (
              <div role="note" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
                Este pedido ya está pagado o creado en SAP: los productos, cantidades y precios no se pueden cambiar aquí
                (el total dejaría de cuadrar con lo cobrado). Puedes editar datos de contacto, dirección y notas.
              </div>
            )}
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-lg">Productos</h4>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={linesLocked}
                  onClick={() => setShowAddProductModal(true)}
                  className="flex items-center gap-1"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Agregar Producto
                </Button>
                <Badge variant="outline">
                  Total: ${calculateOrderTotal()}
                </Badge>
              </div>
            </div>
            
            {itemsLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {items.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {item.product_name || item.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          SKU: {item.product_sku || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Unidades: {item.unit_quantity || 1} por producto
                        </div>
                        {(item.selected_color || item.color) && (
                          <div className="text-xs text-gray-500">
                            Color: {item.selected_color || item.color}
                          </div>
                        )}
                        {(item.selected_size || item.size) && (
                          <div className="text-xs text-gray-500">
                            Talla: {item.selected_size || item.size}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Cantidad */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateItemQuantity(item.id, (item.quantity || 1) - 1)}
                            disabled={linesLocked || loading || (item.quantity || 1) <= 1}
                            aria-label="Restar uno"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={draftValue(item, "quantity")}
                            onChange={(e) => setDraft(item.id, "quantity", e.target.value)}
                            onBlur={() => commitDraft(item, "quantity")}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                            className="w-16 text-center"
                            min="1"
                            aria-label="Cantidad"
                            disabled={linesLocked}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateItemQuantity(item.id, (item.quantity || 1) + 1)}
                            disabled={linesLocked || loading}
                            aria-label="Sumar uno"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Precio: lo fija el catálogo (el backend ya no acepta precios del navegador) */}
                        <div className="text-sm text-muted-foreground w-24 text-right" title="Precio de catálogo">
                          {formatPrice(item.price || 0)} c/u
                        </div>
                        
                        {/* Total del Item */}
                        <div className="text-sm font-medium w-24 text-right">
                          <div className="font-semibold">
                            {formatPrice(calculateItemTotal(item))}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.quantity || 1} × {item.unit_quantity || 1} × {formatPrice(item.price || 0)}
                          </div>
                        </div>
                        
                        {/* Eliminar Item */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(item.id)}
                          disabled={linesLocked || loading}
                          aria-label="Quitar producto"
                          className="text-destructive hover:text-destructive hover:bg-destructive-soft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay items en esta orden
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Información de la Orden (Solo lectura) */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Información de la Orden</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">ID:</span> {order.id}
              </div>
              <div>
                <span className="text-gray-500">Número:</span> {order.order_number || "No asignado"}
              </div>
              <div>
                <span className="text-gray-500">Total:</span> {formatPrice(calculateOrderTotal())} 
                {calculateOrderTotal() !== order.total && (
                  <span className="text-xs text-warning ml-1">
                    (Original: {formatPrice(order.total || 0)})
                  </span>
                )}
              </div>
              <div>
                <span className="text-gray-500">Items:</span> {items.length}
              </div>
              <div>
                <span className="text-gray-500">Creada:</span> {new Date(order.created_at).toLocaleDateString()}
              </div>
              <div>
                <span className="text-gray-500">Actualizada:</span> {new Date(order.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Modal para agregar productos */}
      <AddProductToOrderModal
        orderId={order?.id}
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onProductAdded={handleProductAdded}
      />
    </Dialog>
  )
}