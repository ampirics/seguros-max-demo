"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, CheckCircle, XCircle, Package, User, MapPin, Phone, Mail, Calendar, DollarSign, Edit3, Save, X, MessageCircle, Loader } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "react-toastify"
import { apiClient } from "@/lib/api-client"

// Función para formatear moneda con separadores de miles
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

interface OrderItem {
  id: string
  product_id: string
  name: string
  price: number
  quantity: number
  color: string
  size: string
  image: string
}

interface Order {
  id: string
  status: string
  payment_status?: string
  subtotal?: number
  tax_amount?: number
  total: number
  original_total?: number
  paid_amount?: number
  payment_fee_percentage?: number
  payment_fee_amount?: number
  payment_fee_type?: 'charge' | 'discount' | string | null
  external_reference: string
  payment_reference?: string
  customer_info: {
    name: string
    email: string
    phone: string
    address: string
  }
  notes: string
  created_at: string
  updated_at: string
  items: OrderItem[]
  // Campos de sincronización SAP
  sap_payment_sent?: boolean
  sap_payment_doc_entry?: number
  sap_payment_doc_num?: string
  sap_down_payment_invoice_doc_entry?: number
  sap_down_payment_invoice_doc_num?: string
}

interface OrderDetailModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  onStatusUpdate: (orderId: string, newStatus: string) => Promise<void>
  autoEditStatus?: boolean
}

const statusOptions = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-warning-soft text-warning', icon: Clock },
  { value: 'AWAITING_CONFIRMATION', label: 'Esperando confirmación', color: 'bg-warning-soft text-warning', icon: Clock },
  { value: 'CONFIRMED', label: 'Confirmada', color: 'bg-info-soft text-info', icon: CheckCircle },
  { value: 'PAID', label: 'Pagada', color: 'bg-success-soft text-success', icon: CheckCircle },
  { value: 'PROCESSING', label: 'Procesando', color: 'bg-info-soft text-info', icon: Package },
  { value: 'SHIPPED', label: 'Listo para retiro / Enviada', color: 'bg-info-soft text-info', icon: Package },
  { value: 'DELIVERED', label: 'Entregada / Retirada', color: 'bg-success-soft text-success', icon: CheckCircle },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-destructive-soft text-destructive', icon: XCircle },
  { value: 'PAYMENT_FAILED', label: 'Pago fallido', color: 'bg-destructive-soft text-destructive', icon: XCircle },
]

export function OrderDetailModal({ order, isOpen, onClose, onStatusUpdate, autoEditStatus = false }: OrderDetailModalProps) {
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null)
  const [quickUpdating, setQuickUpdating] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  // Cargar mensajes cuando se abre el modal o cambia la orden
  useEffect(() => {
    if (isOpen && order?.customer_info?.phone) {
      loadConversation(order.customer_info?.phone)
    }
  }, [isOpen, order?.customer_info?.phone])

  useEffect(() => {
    if (!isOpen || !order) {
      return
    }

    if (autoEditStatus) {
      setSelectedStatus((order.status || '').toUpperCase())
      setIsEditingStatus(true)
      setActiveTab('details')
    } else {
      setIsEditingStatus(false)
      setSelectedStatus('')
    }
  }, [isOpen, order, autoEditStatus])

  // by-phone solo ubica la conversación (devuelve messages: []); los mensajes se
  // piden aparte. Antes la ruta llevaba /api/v1 duplicado y siempre daba 404.
  const loadConversation = async (phone: string) => {
    try {
      setLoadingMessages(true)
      setMessagesError(null)
      const conv: any = await apiClient.get(`/chat/conversations/by-phone/${encodeURIComponent(phone)}`)
      if (!conv?.id) { setConversationId(null); setMessages([]); return }
      setConversationId(conv.id)
      const res: any = await apiClient.getMessages(conv.id, { skip: 0, limit: 50 })
      const list = Array.isArray(res) ? res : (res?.data || [])
      setMessages([...list].reverse())
    } catch (error) {
      console.error('Error loading conversation:', error)
      setMessagesError('No se pudieron cargar los mensajes.')
    } finally {
      setLoadingMessages(false)
    }
  }

  // Acciones rápidas: cancelar o marcar pagada tienen efectos en SAP y en el
  // enlace de pago, así que piden confirmación y muestran el resultado.
  const runQuickStatus = async (statusValue: string) => {
    try {
      setQuickUpdating(true)
      await onStatusUpdate(order!.id, statusValue)
      toast.success('Estado actualizado')
    } catch (error) {
      toast.error('No se pudo actualizar el estado')
    } finally {
      setQuickUpdating(false)
      setConfirmStatus(null)
    }
  }

  if (!order) return null

  const originalTotal = typeof order.original_total === 'number' ? order.original_total : order.total
  const paidAmount = typeof order.paid_amount === 'number' ? order.paid_amount : order.total
  const paymentFeeAmount = typeof order.payment_fee_amount === 'number' ? Math.abs(order.payment_fee_amount) : 0
  const hasPaymentAdjustment = paymentFeeAmount > 0 && !!order.payment_fee_type
  const isDiscount = order.payment_fee_type === 'discount'

  const currentStatus = statusOptions.find(
    (s) => s.value.toUpperCase() === (order.status || '').toUpperCase()
  )
  const StatusIcon = currentStatus?.icon || Clock

  const handleEditStatus = () => {
    setSelectedStatus((order.status || '').toUpperCase())
    setIsEditingStatus(true)
  }

  const handleSaveStatus = async () => {
    if (selectedStatus.toUpperCase() === (order.status || '').toUpperCase()) {
      setIsEditingStatus(false)
      return
    }

    try {
      setIsUpdating(true)
      await onStatusUpdate(order.id, selectedStatus.toUpperCase())
      setIsEditingStatus(false)
      toast.success('Estado actualizado correctamente')
    } catch (error) {
      toast.error('Error al actualizar el estado')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingStatus(false)
    setSelectedStatus('')
  }

  const getNextStatusOptions = (currentStatus: string) => {
    const s = (currentStatus || '').toUpperCase()
    const workflow: Record<string, string[]> = {
      'PENDING': ['CONFIRMED', 'AWAITING_CONFIRMATION', 'PAID', 'CANCELLED'],
      'AWAITING_CONFIRMATION': ['PAID', 'CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED'],
      'CONFIRMED': ['PAID', 'PROCESSING', 'CANCELLED'],
      'PAID': ['PROCESSING', 'SHIPPED', 'CANCELLED'],
      'PROCESSING': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED'],
      'DELIVERED': [],
      'CANCELLED': [],
      'PAYMENT_FAILED': ['PENDING', 'CANCELLED'],
    }
    return workflow[s] || []
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Orden {(order as any).order_number || `#${order.id.slice(-8)}`}{order.external_reference ? ` · SAP ${order.external_reference}` : ''}</span>
            <div className="flex items-center gap-2">
              {isEditingStatus ? (
                <div className="flex items-center gap-2">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleSaveStatus}
                    disabled={isUpdating}
                  >
                    {isUpdating ? '...' : <Save className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isUpdating}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`border-transparent ${currentStatus?.color ?? 'bg-secondary text-muted-foreground'}`}>
                    <StatusIcon className="w-4 h-4 mr-1" />
                    {currentStatus?.label}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditStatus}
                    className="h-8 w-8 p-0"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Creada {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
            {(order as any).cotizacion_codigo && (
              <>
                {" · Desde la cotización "}
                <Link href={`/admin/cotizaciones/${(order as any).cotizacion_codigo}`} className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
                  {(order as any).cotizacion_codigo}
                </Link>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 px-4 font-medium text-sm transition ${
              activeTab === 'details'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Detalles
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`pb-2 px-4 font-medium text-sm flex items-center gap-2 transition ${
              activeTab === 'messages'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Mensajes ({messages.length})
          </button>
        </div>

        {/* Tab: Detalles */}
        {activeTab === 'details' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-muted-foreground" />
                Información del cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_info?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{order.customer_info?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{order.customer_info?.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>{order.customer_info?.address}</span>
              </div>
            </CardContent>
          </Card>

          {/* Información de la Orden */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-muted-foreground" />
                Detalles de la orden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mostrar desglose de precios si está disponible */}
              {order.subtotal !== undefined && order.subtotal !== null ? (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.tax_amount !== undefined && order.tax_amount !== null && order.tax_amount > 0 && (
                    <>
                      <div className="border-t"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Impuestos (ITBIS 18%):</span>
                        <span className="font-medium">{formatCurrency(order.tax_amount)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t"></div>
                  <div className="flex justify-between items-center font-semibold text-lg">
                    <span className="text-foreground">Total orden:</span>
                    <span className="text-foreground">{formatCurrency(originalTotal)}</span>
                  </div>
                  {hasPaymentAdjustment && (
                    <>
                      <div className="border-t"></div>
                      <div className="flex justify-between items-center">
                        <span className={isDiscount ? "text-success" : "text-destructive"}>
                          {isDiscount ? "Descuento método de pago:" : "Cargo método de pago:"}
                        </span>
                        <span className={isDiscount ? "font-medium text-success" : "font-medium text-destructive"}>
                          {isDiscount ? '-' : '+'}{formatCurrency(paymentFeeAmount)}
                        </span>
                      </div>
                      <div className="border-t"></div>
                      <div className="flex justify-between items-center font-semibold text-lg">
                        <span className="text-foreground">Monto cobrado:</span>
                        <span className="tabular-nums text-foreground">{formatCurrency(paidAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Total orden:</span>
                    </div>
                    <span className="font-medium">{formatCurrency(originalTotal)}</span>
                  </div>
                  {hasPaymentAdjustment && (
                    <>
                      <div className="border-t"></div>
                      <div className="flex items-center justify-between">
                        <span className={isDiscount ? "text-success" : "text-destructive"}>
                          {isDiscount ? "Descuento método de pago:" : "Cargo método de pago:"}
                        </span>
                        <span className={isDiscount ? "font-medium text-success" : "font-medium text-destructive"}>
                          {isDiscount ? '-' : '+'}{formatCurrency(paymentFeeAmount)}
                        </span>
                      </div>
                      <div className="border-t"></div>
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-foreground">Monto cobrado:</span>
                        <span className="tabular-nums text-foreground">{formatCurrency(paidAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span>{order.items.length} producto{order.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Creada: {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Actualizada: {format(new Date(order.updated_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
              </div>
              {order.payment_reference && (
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <p className="text-sm font-medium text-foreground mb-1">Referencia de pago:</p>
                  <p className="text-sm font-mono text-foreground bg-card px-2 py-1 rounded">{order.payment_reference}</p>
                </div>
              )}
              {order.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground mb-1">Notas:</p>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Productos */}
        <Card>
          <CardHeader>
            <CardTitle>Productos ordenados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={item.name}
                          className="w-16 h-16 object-cover"
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                    {((item as any).sku || (item as any).product_sku) && (
                      <p className="text-xs font-mono text-muted-foreground">{(item as any).sku || (item as any).product_sku}</p>
                    )}
                    {(item.color || item.size) && (
                      <p className="text-sm text-muted-foreground">
                        {[item.color && `Color: ${item.color}`, item.size && `Talla: ${item.size}`].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Cantidad: {item.quantity}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.price)} c/u
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Total */}
              <div className="border-t pt-4 space-y-2">
                {order.subtotal !== undefined && order.subtotal !== null && (
                  <>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.tax_amount !== undefined && order.tax_amount !== null && order.tax_amount > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Impuestos (ITBIS 18%):</span>
                        <span>{formatCurrency(order.tax_amount)}</span>
                      </div>
                    )}
                    <div className="border-t"></div>
                  </>
                )}
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total de la orden:</span>
                  <span className="tabular-nums text-foreground">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sincronización SAP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-muted-foreground" />
              Sincronización con el sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Estado de sincronización */}
            <div className="flex items-center gap-2">
              {order.sap_payment_sent ? (
                <>
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="font-medium text-success">Sincronizado con el sistema</span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-warning" />
                  <span className="font-medium text-warning">Pendiente de sincronización</span>
                </>
              )}
            </div>

            {/* Detalles de pago SAP */}
            {order.sap_payment_doc_num && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">No. Recibo de Pago:</span>
                  <span className="font-medium">{order.sap_payment_doc_num}</span>
                </div>
                {order.sap_payment_doc_entry && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Doc Entry Pago:</span>
                    <span className="font-medium">{order.sap_payment_doc_entry}</span>
                  </div>
                )}
              </div>
            )}

            {/* Detalles de anticipo SAP */}
            {order.sap_down_payment_invoice_doc_num && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-foreground mb-2">Factura de anticipo</p>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">No. Documento:</span>
                  <span className="font-medium">{order.sap_down_payment_invoice_doc_num}</span>
                </div>
                {order.sap_down_payment_invoice_doc_entry && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Doc Entry:</span>
                    <span className="font-medium">{order.sap_down_payment_invoice_doc_entry}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mensaje cuando no hay datos */}
            {!order.sap_payment_sent && !order.sap_payment_doc_num && (
              <p className="text-sm text-muted-foreground">
                Esta orden aún no ha sido procesada en el sistema contable.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Acciones rápidas */}
        {!isEditingStatus && getNextStatusOptions(order.status).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {getNextStatusOptions(order.status).map((statusValue) => {
                  const statusOption = statusOptions.find(s => s.value === statusValue)
                  if (!statusOption) return null
                  
                  return (
                    <Button
                      key={statusValue}
                      onClick={() => (['CANCELLED', 'PAID'].includes(statusValue) ? setConfirmStatus(statusValue) : runQuickStatus(statusValue))}
                      disabled={quickUpdating}
                      className="flex items-center gap-2"
                      variant={statusValue === 'CANCELLED' ? 'destructive' : 'default'}
                    >
                      <statusOption.icon className="w-4 h-4" />
                      {statusOption.label}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {/* End Tab: Detalles */}
        </>
        )}

        {/* Tab: Mensajes */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {conversationId && (
              <div className="flex justify-end">
                <Button asChild size="sm" variant="outline">
                  <a href={`/admin/chat?conversation=${conversationId}`}>
                    <MessageCircle className="w-4 h-4 mr-1" /> Abrir en el chat
                  </a>
                </Button>
              </div>
            )}
            {messagesError && (
              <div role="alert" className="rounded-md border border-transparent bg-destructive-soft px-3 py-2 text-sm text-destructive">{messagesError}</div>
            )}
            {loadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-muted-foreground">Cargando mensajes...</span>
              </div>
            ) : messages.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                    <p className="text-center">No hay mensajes en la conversación</p>
                    <p className="text-sm text-muted-foreground mt-1">Los mensajes aparecerán aquí cuando el cliente envíe mensajes</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Historial de conversación</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">{messages.length} mensajes en total</p>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-muted/50 border-l-2 border-muted-foreground/40'
                          : msg.sender === 'bot'
                          ? 'bg-muted/50 border-l-2 border-primary'
                          : 'bg-muted/50 border-l-2 border-border'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm text-foreground">
                          {msg.sender === 'user' ? 'Cliente' :
                           msg.sender === 'bot' ? 'Sistema' :
                           'Admin'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp && format(new Date(msg.timestamp), 'dd/MM HH:mm', { locale: es })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{msg.message}</p>
                      {msg.message_type && msg.message_type !== 'text' && (
                        <span className="inline-block mt-2 text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                          {msg.message_type}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
        {/* End Tab: Mensajes */}
        {confirmStatus && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setConfirmStatus(null)}>
            <div role="alertdialog" aria-modal="true" className="bg-background rounded-lg shadow-xl p-5 max-w-sm w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold">
                {confirmStatus === 'CANCELLED' ? '¿Cancelar este pedido?' : '¿Marcar como pagado?'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {confirmStatus === 'CANCELLED'
                  ? 'El pedido quedará cancelado y su enlace de pago dejará de servir. Si ya existe en SAP, revisa allí la orden.'
                  : 'Úsalo solo si confirmaste el cobro por otra vía: se registrará como pagado sin pasar por la pasarela.'}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmStatus(null)} disabled={quickUpdating}>Volver</Button>
                <Button size="sm" variant={confirmStatus === 'CANCELLED' ? 'destructive' : 'default'} disabled={quickUpdating}
                  onClick={() => runQuickStatus(confirmStatus)}>
                  {quickUpdating ? 'Guardando…' : confirmStatus === 'CANCELLED' ? 'Sí, cancelar' : 'Sí, marcar pagado'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
