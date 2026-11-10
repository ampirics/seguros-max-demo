"use client"

import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "react-toastify"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  Loader2,
  MoreHorizontal,
  Search,
  ShoppingCart,
} from "lucide-react"

import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { OrderDetailModal } from "@/components/admin/order-detail-modal"
import { OrderEditModal } from "@/components/admin/order-edit-modal"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/utils/format"

interface Order {
  id: string
  order_number?: string
  status: string
  payment_status?: string
  total: number
  external_reference?: string
  payment_reference?: string
  customer_info?: {
    name?: string
    email?: string
    phone?: string
    address?: string
  }
  created_at: string
  updated_at?: string
  items?: Array<{ id: string }>
}

const ITEMS_PER_PAGE = 10
const EDITABLE_STATUSES = ["pending", "awaiting_confirmation", "confirmed", "paid"]

// Fecha LOCAL (toISOString daba la fecha UTC: después de las 8 p. m. en RD "hoy" era mañana).
function toDateInputValue(date: Date): string {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// Límites del día en hora local convertidos a ISO con zona (el backend los compara en UTC).
const dayStartIso = (d: string) => new Date(`${d}T00:00:00`).toISOString()
const dayEndIso = (d: string) => new Date(`${d}T23:59:59.999`).toISOString()

function getDefaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 30)
  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  }
}

function normalizeStatus(status?: string): string {
  return (status || "").toLowerCase()
}

// Tonos suaves por familia de estado: espera, en curso, cerrada bien, cerrada mal.
function getStatusColor(status?: string): string {
  switch (normalizeStatus(status)) {
    case "pending":
    case "awaiting_confirmation":
      return "bg-warning-soft text-warning"
    case "confirmed":
    case "processing":
    case "shipped":
      return "bg-info-soft text-info"
    case "paid":
    case "delivered":
      return "bg-success-soft text-success"
    case "cancelled":
    case "payment_failed":
      return "bg-destructive-soft text-destructive"
    default:
      return "bg-secondary text-muted-foreground"
  }
}

function getStatusText(status?: string, shippingMethod?: string): string {
  switch (normalizeStatus(status)) {
    case "pending":
      return "Pendiente"
    case "awaiting_confirmation":
      return "Esperando confirmación"
    case "confirmed":
      return "Confirmada"
    case "paid":
      return "Pagada"
    case "processing":
      return "Procesando"
    case "shipped":
      if (shippingMethod && (shippingMethod.toLowerCase().includes('pickup') || shippingMethod.toLowerCase().includes('retiro'))) {
        return "Listo para retiro"
      }
      return "Listo para retiro"
    case "delivered":
      return "Entregada / Retirada"
    case "cancelled":
      return "Cancelada"
    case "payment_failed":
      return "Pago fallido"
    default:
      return status || "N/A"
  }
}

export default function AdminOrdersPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()

  const defaultRange = useMemo(() => getDefaultDateRange(), [])

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [searchInput, setSearchInput] = useState("")
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [fromDate, setFromDate] = useState(defaultRange.from)
  const [toDate, setToDate] = useState(defaultRange.to)
  const [dateError, setDateError] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(totalOrders / ITEMS_PER_PAGE))

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  // Enlaces del Dashboard («Requiere atención»): ?status=pending&days=1 abre la
  // lista ya filtrada.
  useEffect(() => {
    if (typeof window === "undefined") return
    const q = new URLSearchParams(window.location.search)
    const st = q.get("status")
    if (st) setStatusFilter(st.toLowerCase())
    const d = Number(q.get("days"))
    if (d > 0 && d <= 365) {
      const from = new Date()
      from.setDate(from.getDate() - (d - 1))
      setFromDate(toDateInputValue(from))
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, fromDate, toDate])

  useEffect(() => {
    if (!user) return
    void loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentPage, statusFilter, appliedSearchTerm, fromDate, toDate])

  const applySearch = () => {
    const normalizedSearch = searchInput.trim()

    if (normalizedSearch === appliedSearchTerm) {
      if (currentPage !== 1) {
        setCurrentPage(1)
      } else {
        void loadOrders()
      }
      return
    }

    setAppliedSearchTerm(normalizedSearch)
    setCurrentPage(1)
  }

  const validateDateRange = (from: string, to: string): string => {
    if (!from || !to) return ""
    const fromDt = new Date(from)
    const toDt = new Date(to)
    if (toDt < fromDt) return "La fecha fin debe ser posterior al inicio"
    const diffDays = Math.floor((toDt.getTime() - fromDt.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 180) return "El rango máximo permitido es 180 días"
    return ""
  }

  const loadOrders = async () => {
    try {
      const nextDateError = validateDateRange(fromDate, toDate)
      setDateError(nextDateError)
      if (nextDateError) return

      setLoading(true)
      const skip = (currentPage - 1) * ITEMS_PER_PAGE

      const params: Record<string, string | number> = {
        skip,
        limit: ITEMS_PER_PAGE,
        created_after: dayStartIso(fromDate),
        created_before: dayEndIso(toDate),
        // Lo más reciente primero (el backend ordena ascendente por defecto y las
        // órdenes de hoy quedaban en la última página).
        order_by: "created_at",
        order_dir: "desc",
      }

      if (statusFilter !== "all") {
        params.status = statusFilter.toUpperCase()
      }

      if (appliedSearchTerm) {
        params.search_text = appliedSearchTerm
      }

      const response = await apiClient.searchOrders(params)
      setOrders(response.orders || [])
      setTotalOrders(response.total || 0)
    } catch (error) {
      console.error("Error loading orders:", error)
      setOrders([])
      setTotalOrders(0)
      toast.error("No se pudieron cargar las órdenes")
    } finally {
      setLoading(false)
    }
  }

  const openOrderDetail = async (orderId: string) => {
    try {
      const detail = await apiClient.getOrder(orderId)
      setSelectedOrder(detail)
      setIsDetailModalOpen(true)
    } catch (error) {
      console.error("Error loading order detail:", error)
      toast.error("No se pudo cargar el detalle de la orden")
    }
  }

  // ?orden=<id> abre el detalle (enlace desde la cotización convertida).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("orden")
    if (id) openOrderDetail(id)
  }, [])

  const openOrderEdit = async (orderId: string) => {
    try {
      const detail = await apiClient.getOrder(orderId)
      setSelectedOrderForEdit(detail)
      setIsEditModalOpen(true)
    } catch (error) {
      console.error("Error loading order for edit:", error)
      toast.error("No se pudo cargar la orden para editar")
    }
  }

  const closeOrderDetail = () => {
    setSelectedOrder(null)
    setIsDetailModalOpen(false)
  }

  const closeOrderEdit = () => {
    setSelectedOrderForEdit(null)
    setIsEditModalOpen(false)
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    await apiClient.updateOrderStatus(orderId, newStatus.toUpperCase())
    // El detalle abierto también debe reflejar el estado nuevo (antes seguía viejo
    // e invitaba a repetir la acción).
    try {
      const fresh = await apiClient.getOrder(orderId)
      setSelectedOrder((prev: any) => (prev && prev.id === orderId ? fresh : prev))
    } catch { /* la lista igual se recarga */ }
    await loadOrders()
  }

  const updateOrder = async (orderId: string, orderData: any) => {
    await apiClient.updateOrder(orderId, orderData)
    await loadOrders()
  }

  const resetToLastMonth = () => {
    const range = getDefaultDateRange()
    setFromDate(range.from)
    setToDate(range.to)
    setDateError("")
  }

  const exportToCSV = async () => {
    try {
      const nextDateError = validateDateRange(fromDate, toDate)
      setDateError(nextDateError)
      if (nextDateError) return

      setExporting(true)

      const params: Record<string, string> = {
        created_after: dayStartIso(fromDate),
        created_before: dayEndIso(toDate),
        order_by: "created_at",
        order_dir: "asc",
      }

      if (statusFilter !== "all") {
        params.status = statusFilter.toUpperCase()
      }

      if (appliedSearchTerm) {
        params.search_text = appliedSearchTerm
      }

      const csvText = await apiClient.exportOrdersCsv(params)
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `ordenes_${fromDate}_${toDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("Exportación completada")
    } catch (error) {
      console.error("Error exporting orders:", error)
      toast.error("Error al exportar órdenes")
    } finally {
      setExporting(false)
    }
  }

  if (isLoading || !user) {
    return (
      <AdminLayout title="Ventas">
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando…
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Ventas">
      <div className="space-y-5">
        <SeccionTabs seccion="ventas" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Pedidos del rango de fechas elegido, del más reciente al más antiguo.
          </p>
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="w-fit shrink-0 gap-2"
            disabled={exporting || !!dateError || totalOrders === 0}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {exporting ? "Exportando..." : "Exportar CSV"}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Buscar por orden, cliente, teléfono, email, referencia de pago o SAP"
                aria-label="Buscar órdenes"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    applySearch()
                  }
                }}
                className="h-10 bg-card pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={applySearch} className="h-10 bg-card">
                Buscar
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-auto min-w-36 bg-card" aria-label="Estado">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="awaiting_confirmation">Esperando confirmación</SelectItem>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                  <SelectItem value="shipped">Listo para retiro / Enviada</SelectItem>
                  <SelectItem value="delivered">Entregada / Retirada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="payment_failed">Pago fallido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Desde
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                max={toDate}
                className="h-10 w-40 bg-card text-foreground"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Hasta
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate}
                max={toDateInputValue(new Date())}
                className="h-10 w-40 bg-card text-foreground"
              />
            </label>
            <Button type="button" variant="ghost" onClick={resetToLastMonth} className="h-10">
              Últimos 30 días
            </Button>
            <span className="whitespace-nowrap text-sm text-muted-foreground md:ml-auto">
              {loading ? "…" : `${totalOrders} resultado(s)`}
            </span>
          </div>

          {dateError && <p className="text-sm text-destructive">{dateError}</p>}
        </div>

        {loading && orders.length === 0 ? (
          <Card className="divide-y overflow-hidden" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 max-w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-muted-foreground" aria-hidden />
              <h3 className="mb-1 font-medium">No se encontraron órdenes</h3>
              <p className="text-sm text-muted-foreground">Ajusta los filtros para ver resultados.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className={cn("divide-y overflow-hidden", loading && "opacity-60")} aria-busy={loading}>
            {orders.map((order) => {
              const numero = order.order_number || order.id.slice(-8)
              const contacto = [order.customer_info?.phone, order.customer_info?.email].filter(Boolean).join(" · ") || "Sin contacto"
              const hace = formatDistanceToNowStrict(new Date(order.created_at), { addSuffix: true, locale: es })
              return (
                <div
                  key={order.id}
                  onClick={() => openOrderDetail(order.id)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
                >
                  {/* Sin onClick propio: el clic (o Enter) sube a la fila y abre el detalle una sola vez */}
                  <button
                    type="button"
                    aria-label={`Ver orden ${numero}`}
                    className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate text-sm">
                      <span className="font-medium">#{numero}</span>
                      <span className="text-muted-foreground"> · </span>
                      {order.customer_info?.name || "Cliente sin nombre"}
                      {order.external_reference ? (
                        <span className="text-xs text-muted-foreground"> · SAP {order.external_reference}</span>
                      ) : null}
                      {(order as any).cotizacion_codigo ? (
                        <span className="text-xs text-muted-foreground"> · De {(order as any).cotizacion_codigo}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {contacto}
                      <span className="md:hidden"> · {hace}</span>
                    </span>
                  </button>
                  <span className="hidden w-28 shrink-0 whitespace-nowrap text-xs text-muted-foreground md:block">{hace}</span>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <Badge variant="outline" className={cn("border-transparent", getStatusColor(order.status))}>
                      {getStatusText(order.status)}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums text-foreground sm:w-28 sm:text-right">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                  {/* Los clics del menú (en portal) también burbujean por React: se cortan aquí para no abrir el detalle */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones de la orden ${numero}`}>
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openOrderDetail(order.id)}>
                          <Eye aria-hidden /> Ver
                        </DropdownMenuItem>
                        {EDITABLE_STATUSES.includes(normalizeStatus(order.status)) ? (
                          <DropdownMenuItem onClick={() => openOrderEdit(order.id)}>
                            <Edit3 aria-hidden /> Editar
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </Card>
        )}

        {totalOrders > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Página anterior"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Página siguiente"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      <OrderDetailModal
        order={selectedOrder}
        isOpen={isDetailModalOpen}
        onClose={closeOrderDetail}
        onStatusUpdate={updateOrderStatus}
      />

      <OrderEditModal
        order={selectedOrderForEdit}
        isOpen={isEditModalOpen}
        onClose={closeOrderEdit}
        onUpdate={updateOrder}
      />
    </AdminLayout>
  )
}
