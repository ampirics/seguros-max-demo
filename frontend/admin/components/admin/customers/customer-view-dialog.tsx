"use client"

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { PerfilCliente, usePerfil } from '@/components/chat/PerfilCliente'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  ExternalLink,
  Edit,
  Loader2,
  Star
} from "lucide-react"

interface CustomerContact {
  id: string
  phone: string
  contact_type: string
  is_primary: boolean
  is_verified: boolean
  is_active: boolean
  label?: string
}

interface Customer {
  id: string
  document_id?: string | null
  document_type?: string | null
  source?: string | null
  sap_active?: boolean | null
  name: string
  email?: string
  phone?: string
  address?: string
  external_reference?: string
}

interface CustomerViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onEdit?: () => void
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cedula: 'Cédula',
  pasaporte: 'Pasaporte', 
  rnc: 'RNC',
  otro: 'Otro'
}
const docLabel = (t?: string | null) => (t ? DOCUMENT_TYPE_LABELS[t.toLowerCase()] ?? null : null)

export function CustomerViewDialog({ open, onOpenChange, customer, onEdit }: CustomerViewDialogProps) {
  const [contacts, setContacts] = useState<CustomerContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)

  // Cargar contactos cuando se abre el diálogo
  useEffect(() => {
    const loadContacts = async () => {
      if (customer?.id && open) {
        setLoadingContacts(true)
        try {
          const data = await apiClient.getCustomerContacts(customer.id)
          setContacts(data?.contacts || [])
        } catch (error) {
          console.error('Error loading contacts:', error)
        } finally {
          setLoadingContacts(false)
        }
      }
    }

    loadContacts()
  }, [customer?.id, open])

  if (!customer) return null

  const CONTACT_TYPE_LABELS: Record<string, string> = {
    whatsapp: 'WhatsApp',
    phone: 'Teléfono',
    mobile: 'Móvil',
    work: 'Trabajo',
    home: 'Casa'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Detalles del cliente
          </DialogTitle>
          <DialogDescription>
            Información completa del cliente
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Avatar y nombre */}
          <div className="flex items-center gap-4 rounded-lg bg-secondary/50 p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <span className="text-xl font-semibold">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{customer.name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {customer.document_id && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {customer.document_id}
                  </Badge>
                )}
                {docLabel(customer.document_type) && (
                  <span className="text-sm text-muted-foreground">({docLabel(customer.document_type)})</span>
                )}
                {customer.source === 'sap' && <Badge className="border-transparent bg-secondary text-xs text-muted-foreground hover:bg-secondary">SAP</Badge>}
                {customer.source === 'sap' && customer.sap_active === false && (
                  <Badge className="border-transparent bg-destructive-soft text-xs text-destructive hover:bg-destructive-soft">Inactivo en SAP</Badge>
                )}
              </div>
            </div>
          </div>

          <PerfilDesdeConversaciones customerId={customer.id} />

          {/* Información de contacto */}
          <div className="space-y-4">
            <h4 className="border-b pb-2 font-medium text-foreground">Información de contacto</h4>
            
            <div className="grid gap-3">
              {customer.email && (
                <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                  <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                  </div>
                </div>
              )}
              
              {customer.phone && (
                <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                  <Phone className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Teléfono</p>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  </div>
                </div>
              )}
              
              {customer.address && (
                <div className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3">
                  <MapPin className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Dirección</p>
                    <p className="text-sm text-muted-foreground">{customer.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Información adicional */}
          {customer.external_reference && (
            <div className="space-y-4">
              <h4 className="border-b pb-2 font-medium text-foreground">Información adicional</h4>
              
              <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">CardCode / referencia externa</p>
                  <p className="text-sm text-muted-foreground font-mono">{customer.external_reference}</p>
                </div>
              </div>
            </div>
          )}

          {/* Identificación */}
          <div className="space-y-4">
            <h4 className="border-b pb-2 font-medium text-foreground">Identificación</h4>
            
            <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {docLabel(customer.document_type) || 'Documento'}
                </p>
                <p className="text-sm text-muted-foreground font-mono">{customer.document_id || 'Sin documento'}</p>
              </div>
            </div>
          </div>

          {/* Contactos adicionales */}
          <div className="space-y-4">
            <h4 className="border-b pb-2 font-medium text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Contactos adicionales
            </h4>
            
            {loadingContacts ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          {contact.is_primary && (
                            <Star className="w-4 h-4 fill-current text-primary" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {contact.phone}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CONTACT_TYPE_LABELS[contact.contact_type] || contact.contact_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contact.label || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {contact.is_verified && (
                              <Badge className="border-transparent bg-success-soft text-xs text-success hover:bg-success-soft">
                                Verificado
                              </Badge>
                            )}
                            {contact.is_active && (
                              <Badge className="border-transparent bg-secondary text-xs text-muted-foreground hover:bg-secondary">
                                Activo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay contactos adicionales registrados
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {onEdit && (
            <Button onClick={onEdit} className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Editar cliente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PerfilDesdeConversaciones({ customerId }: { customerId: string }) {
  const { perfil, cargado } = usePerfil(`/perfil/cliente/${customerId}`)
  if (!cargado || !perfil || (perfil.conversaciones === 0 && perfil.vehiculos.length === 0)) return null
  return (
    <div className="space-y-3">
      <h4 className="border-b pb-2 font-medium text-foreground">Perfil desde WhatsApp</h4>
      <PerfilCliente perfil={perfil} />
    </div>
  )
}
