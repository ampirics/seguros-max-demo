"use client"

import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminLayout } from "@/components/admin/admin-layout"
import { useCompany } from "@/contexts/company-context"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Users,
  Download,
  Loader2,
  MoreHorizontal,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "react-toastify"
import { CustomerFormDialog } from "@/components/admin/customers/customer-form-dialog"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/api-client"

interface Customer {
  id: string
  document_id?: string | null
  document_type?: string | null
  name: string
  email?: string
  phone?: string
  address?: string
  external_reference?: string
  company_id: string
  source?: string | null
  sap_active?: boolean | null
}

// SAP guarda el tipo de documento como código; aquí se muestra legible.
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cedula: 'Cédula', rnc: 'RNC', passport: 'Pasaporte', pasaporte: 'Pasaporte', other: 'Otro',
}
const documentTypeLabel = (t?: string | null) => (t ? DOCUMENT_TYPE_LABELS[t.toLowerCase()] ?? null : null)

// Una celda que empieza por = + - @ la ejecuta Excel como fórmula (inyección CSV).
const csvCell = (v: unknown) => {
  let text = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

const PAGE_SIZE = 50

export default function AdminCustomersPage() {
  const { activeCompany } = useCompany()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // Solo la última petición pinta: al escribir rápido en el buscador una
  // respuesta vieja podía llegar después y pisar a la nueva.
  const requestSeq = useRef(0)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  // Paginación real: con miles de clientes no se pueden traer todos y filtrar
  // en el navegador — se veían solo los primeros 100.
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [appliedSearch, setAppliedSearch] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const loadCustomers = async () => {
    const seq = ++requestSeq.current
    try {
      setLoading(true)
      setLoadError(false)
      const customerData = await apiClient.getCustomers({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        search: appliedSearch || undefined,
      })
      if (seq !== requestSeq.current) return
      if (customerData && typeof customerData === 'object' && 'data' in customerData && Array.isArray(customerData.data)) {
        setCustomers(customerData.data)
        setTotal(typeof customerData.total === 'number' ? customerData.total : customerData.data.length)
      } else {
        const lista = Array.isArray(customerData) ? customerData : []
        setCustomers(lista)
        setTotal(lista.length)
      }
    } catch (error) {
      if (seq !== requestSeq.current) return
      console.error('Error loading customers:', error)
      setLoadError(true)
      setCustomers([])
      setTotal(0)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (activeCompany?.id) {
      loadCustomers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id, page, appliedSearch])

  // Exporta lo que se está viendo (todas las páginas de la búsqueda actual).
  const handleExport = async () => {
    setExporting(true)
    try {
      const rows: Customer[] = []
      for (let skip = 0; skip < 20000; skip += 200) {
        const res = await apiClient.getCustomers({ skip, limit: 200, search: appliedSearch || undefined })
        const data: Customer[] = Array.isArray(res?.data) ? res.data : []
        rows.push(...data)
        if (!res?.has_more || data.length === 0) break
      }
      const header = ['CardCode', 'Nombre', 'Tipo documento', 'Documento', 'Email', 'Teléfono', 'Dirección', 'Origen', 'Activo en SAP']
      const lines = rows.map(c => [
        c.external_reference, c.name, documentTypeLabel(c.document_type) ?? c.document_type, c.document_id,
        c.email, c.phone, c.address, c.source === 'sap' ? 'SAP' : 'Manual',
        c.source === 'sap' ? (c.sap_active === false ? 'No' : 'Sí') : '',
      ].map(csvCell).join(','))
      // BOM para que Excel abra bien las tildes.
      const blob = new Blob(['\ufeff' + [header.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(`${rows.length} cliente(s) exportado(s)`)
    } catch (error: any) {
      console.error('Error exporting customers:', error)
      toast.error(error?.message || 'No se pudo exportar')
    } finally {
      setExporting(false)
    }
  }

  // La búsqueda se manda al backend, con una pausa para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch(searchTerm.trim())
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  // El backend ya devuelve la página filtrada.
  const filteredCustomers = customers

  // Manejar crear/editar cliente
  const handleCustomerSave = async (customerData: any) => {
    try {
      let result;
      if (selectedCustomer) {
        // Editar
        result = await apiClient.updateCustomer(selectedCustomer.id, customerData)
        toast.success('Cliente actualizado correctamente')
      } else {
        // Crear
        result = await apiClient.createCustomer(customerData)
        toast.success('Cliente creado correctamente')
      }
      
      await loadCustomers()
      setFormDialogOpen(false)
      setSelectedCustomer(null)
      return result
    } catch (error: any) {
      console.error('Error saving customer:', error)
      toast.error(error?.message || 'Error al guardar el cliente')
      throw error
    }
  }

  // Manejar eliminar cliente
  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return
    
    try {
      await apiClient.deleteCustomer(customerToDelete.id)
      toast.success('Cliente eliminado correctamente')
      await loadCustomers()
    } catch (error: any) {
      console.error('Error deleting customer:', error)
      // El backend explica por qué (tiene pedidos, viene de SAP…).
      toast.error(error?.message || 'Error al eliminar el cliente')
    } finally {
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
    }
  }

  // Funciones de utilidad
  const openCreateDialog = () => {
    setSelectedCustomer(null)
    setFormDialogOpen(true)
  }

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer)
    setFormDialogOpen(true)
  }

  const openViewDialog = (customer: Customer) => router.push(`/admin/customers/${customer.id}`)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ver")
    if (id) router.replace(`/admin/customers/${id}`)
  }, [router])

  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  if (!activeCompany) {
    return (
      <AdminLayout title="Clientes">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground" aria-hidden />
            <h3 className="mb-1 font-medium">Selecciona una empresa</h3>
            <p className="text-sm text-muted-foreground">Debes seleccionar una empresa para gestionar clientes</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Clientes">
      <div className="space-y-5">
        <SeccionTabs seccion="clientes" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Administra los clientes de {activeCompany.name}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="flex items-center gap-2"
              title={appliedSearch ? 'Exporta los clientes de la búsqueda actual' : 'Exporta todos los clientes'}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              Exportar CSV
            </Button>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo cliente
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Buscar por nombre, CardCode, documento, email o teléfono"
              aria-label="Buscar clientes"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 bg-card pl-9"
            />
          </div>
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {loading ? '…' : `${total.toLocaleString('es-DO')} cliente${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <Card className="divide-y overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full max-w-[250px]" />
                  <Skeleton className="h-3 w-full max-w-[160px]" />
                </div>
              </div>
            ))}
          </Card>
        ) : loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="font-medium">No se pudieron cargar los clientes</p>
              <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo.</p>
              <Button variant="outline" onClick={loadCustomers}>Reintentar</Button>
            </CardContent>
          </Card>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground" aria-hidden />
              <h3 className="mb-1 font-medium">
                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes'}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Comienza creando tu primer cliente'
                }
              </p>
              {!searchTerm && (
                <Button onClick={openCreateDialog} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  Crear cliente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Documento</th>
                    <th className="px-4 py-3 font-medium">Contacto</th>
                    <th className="hidden px-4 py-3 font-medium 2xl:table-cell">Dirección</th>
                    <th className="w-12 px-4 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="cursor-pointer transition-colors hover:bg-secondary/50 focus:outline-none focus-visible:bg-secondary/50"
                      onClick={() => openViewDialog(customer)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          openViewDialog(customer)
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground" aria-hidden>
                            {customer.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                          </span>
                          <div className="min-w-[11rem]">
                            <div className="font-medium text-foreground">{customer.name}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {customer.external_reference && (
                                <span className="font-mono text-xs text-muted-foreground">{customer.external_reference}</span>
                              )}
                              {customer.source === 'sap' && (
                                <Badge className="h-5 border-transparent bg-secondary px-1.5 text-[10px] text-muted-foreground hover:bg-secondary">SAP</Badge>
                              )}
                              {customer.source === 'sap' && customer.sap_active === false && (
                                <Badge className="h-5 border-transparent bg-destructive-soft px-1.5 text-[10px] text-destructive hover:bg-destructive-soft">Inactivo en SAP</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {customer.document_id ? (
                          <>
                            <div className="whitespace-nowrap font-mono text-foreground">{customer.document_id}</div>
                            {documentTypeLabel(customer.document_type) && (
                              <div className="mt-0.5 text-xs text-muted-foreground">{documentTypeLabel(customer.document_type)}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sin documento</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-muted-foreground">
                          {customer.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 shrink-0" aria-hidden />
                              {customer.email}
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 shrink-0" aria-hidden />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 2xl:table-cell">
                        {customer.address ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="max-w-[16rem] truncate">{customer.address}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sin dirección</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {/* modal={false}: si el menú se cierra al abrir un
                            diálogo, deja el body con pointer-events:none y la
                            página entera se queda sin recibir clics. */}
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones para ${customer.name}`}>
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openViewDialog(customer)}>
                              <Eye aria-hidden /> Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                              <Edit aria-hidden /> Editar
                            </DropdownMenuItem>
                            {/* Los de SAP se dan de baja en SAP: aquí volverían en la próxima sincronización. */}
                            {customer.source !== 'sap' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(customer)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 aria-hidden /> Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {total > PAGE_SIZE && !loadError && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString('es-DO')}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || loading}
                onClick={() => setPage(current => Math.max(0, current - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Anterior
              </Button>
              <span className="text-sm font-medium">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        <CustomerFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          customer={selectedCustomer}
          onSave={handleCustomerSave}
          onChanged={loadCustomers}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Eliminar al cliente "{customerToDelete?.name}"? Esta acción no se puede deshacer.
                Si el cliente tiene pedidos no se podrá eliminar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  )
}
