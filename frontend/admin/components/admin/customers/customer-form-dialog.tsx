"use client"

import { useState, useEffect } from 'react'
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, Star, RefreshCw, Lock } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface CustomerContact {
  id?: string
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
  contacts?: CustomerContact[]
}

interface CustomerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSave: (data: any) => Promise<any>
  /** Tras «Actualizar desde SAP», para refrescar el listado. */
  onChanged?: () => void
}

const onlyDigits = (v: string) => v.replace(/\D/g, '')

/** Mensaje de error del documento, o null si es válido. */
function documentError(type: string, value: string): string | null {
  const digits = onlyDigits(value)
  if (type === 'cedula' && digits.length !== 11) return 'La cédula debe tener 11 dígitos.'
  if (type === 'rnc' && digits.length !== 9) return 'El RNC debe tener 9 dígitos.'
  return null
}

const DOCUMENT_TYPES = [
  { value: 'cedula', label: 'Cédula' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'rnc', label: 'RNC' },
  { value: 'otro', label: 'Otro' },
]

export function CustomerFormDialog({ open, onOpenChange, customer, onSave, onChanged }: CustomerFormDialogProps) {
  const { toast } = useToast()
  // Los clientes de SAP se editan en SAP: sus datos aquí son de solo lectura
  // (la sincronización pisaba cualquier cambio local sin avisar).
  const isSap = customer?.source === 'sap'
  const [refreshing, setRefreshing] = useState(false)
  // Estado SAP tras "Actualizar desde SAP": el prop `customer` queda viejo hasta recargar la lista.
  const [sapActive, setSapActive] = useState<boolean | null | undefined>(undefined)
  // Contactos quitados en el formulario: antes solo desaparecían de la
  // pantalla y volvían al reabrir, porque nunca se llamaba al DELETE.
  const [removedContactIds, setRemovedContactIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    document_id: '',
    document_type: 'cedula',
    name: '',
    email: '',
    phone: '',
    address: '',
    external_reference: '',
  })
  const [contacts, setContacts] = useState<CustomerContact[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)

  // Cargar contactos del cliente
  // Otro cliente u otra apertura: se vuelve al estado que trae el prop.
  useEffect(() => { setSapActive(undefined) }, [customer?.id, open])

  useEffect(() => {
    const loadContacts = async () => {
      if (customer?.id) {
        setLoadingContacts(true)
        try {
          const data = await apiClient.getCustomerContacts(customer.id)
          setContacts(data?.contacts || [])
        } catch (error) {
          console.error('Error loading contacts:', error)
        } finally {
          setLoadingContacts(false)
        }
      } else {
        setContacts([])
      }
    }

    if (open) {
      setRemovedContactIds([])
      loadContacts()
    }
  }, [customer?.id, open])

  // Actualizar formulario cuando cambia el cliente
  useEffect(() => {
    if (customer) {
      setFormData({
        document_id: customer.document_id || '',
        document_type: customer.document_type || (customer.source === 'sap' ? '' : 'cedula'),
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        external_reference: customer.external_reference || '',
      })
    } else {
      setFormData({
        document_id: '',
        document_type: 'cedula',
        name: '',
        email: '',
        phone: '',
        address: '',
        external_reference: '',
      })
    }
  }, [customer, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSap) {
      if (!formData.document_id.trim() || !formData.name.trim()) {
        toast({
          title: "Campos requeridos",
          description: "El documento y el nombre son obligatorios.",
          variant: "destructive"
        })
        return
      }
      const docError = documentError(formData.document_type, formData.document_id)
      if (docError) {
        toast({ title: "Documento inválido", description: docError, variant: "destructive" })
        return
      }
    }

    // Validar correo si se completó
    const cleanEmail = formData.email.trim()
    if (!isSap && cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast({
        title: "Correo inválido",
        description: "Por favor ingresa un correo electrónico válido (ej. usuario@dominio.com) o déjalo vacío.",
        variant: "destructive"
      })
      return
    }

    const invalidContact = contacts.find(c => c.phone.trim() && onlyDigits(c.phone).length < 10)
    if (invalidContact) {
      toast({
        title: "Teléfono inválido",
        description: `«${invalidContact.phone}» no es un número completo (10 dígitos, ej. 809 555 0123).`,
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    let stage: 'customer' | 'contacts' = 'customer'
    try {
      // Cliente de SAP: solo se guardan sus contactos.
      const sanitizedData = isSap ? {} : {
        ...formData,
        document_id: formData.document_id.trim(),
        name: formData.name.trim(),
        email: cleanEmail || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        external_reference: formData.external_reference.trim() || null,
      }

      // Al editar, los contactos van antes: onSave cierra el diálogo, y si un
      // contacto falla (número repetido) el usuario debe poder corregirlo.
      // Al crear, el cliente primero porque los contactos necesitan su id.
      if (customer?.id) {
        stage = 'contacts'
        await saveContacts(customer.id)
        stage = 'customer'
        await onSave(sanitizedData)
      } else {
        const result = await onSave(sanitizedData)
        if (result?.id) {
          stage = 'contacts'
          await saveContacts(result.id)
        }
      }
    } catch (error: any) {
      console.error('Error saving customer:', error)
      // Los errores del cliente ya los muestra la página; aquí solo los de contactos.
      if (stage === 'contacts') {
        toast({
          title: "Error al guardar los contactos",
          description: error?.message || "Ocurrió un error al guardar los contactos.",
          variant: "destructive"
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSapRefresh = async () => {
    if (!customer?.id) return
    setRefreshing(true)
    try {
      const res: any = await apiClient.request(`/customers/${customer.id}/sap-refresh`, { method: 'POST' })
      const c = res?.customer
      if (c) {
        setSapActive(c.sap_active)
        setFormData({
          document_id: c.document_id || '',
          document_type: c.document_type || '',
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          external_reference: c.external_reference || '',
        })
      }
      const data = await apiClient.getCustomerContacts(customer.id)
      setContacts(data?.contacts || [])
      setRemovedContactIds([])
      toast({ title: "Actualizado desde SAP", description: "Se trajeron los datos y contactos actuales de SAP." })
      onChanged?.()
    } catch (error: any) {
      toast({ title: "No se pudo actualizar", description: error?.message || "Error consultando SAP.", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }

  const saveContacts = async (customerId: string) => {
    for (const contactId of removedContactIds) {
      await apiClient.deleteCustomerContact(contactId)
    }
    setRemovedContactIds([])
    for (const contact of contacts) {
      if (!contact.phone || !contact.phone.trim()) continue
      
      const payload = {
        phone: contact.phone.trim(),
        contact_type: contact.contact_type || 'whatsapp',
        is_primary: !!contact.is_primary,
        is_verified: !!contact.is_verified,
        is_active: contact.is_active !== undefined ? contact.is_active : true,
        label: contact.label || null
      }

      if (contact.id) {
        // Actualizar contacto existente
        await apiClient.updateCustomerContact(contact.id, payload)
      } else {
        // Crear nuevo contacto
        await apiClient.addCustomerContact(customerId, payload)
      }
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddContact = () => {
    setContacts(prev => [...prev, {
      phone: '',
      contact_type: 'whatsapp',
      is_primary: prev.length === 0,
      is_verified: false,
      is_active: true,
      label: ''
    }])
  }

  const handleRemoveContact = (index: number) => {
    const removed = contacts[index]
    if (removed?.id) setRemovedContactIds(prev => [...prev, removed.id as string])
    setContacts(prev => prev.filter((_, i) => i !== index))
  }

  const handleContactChange = (index: number, field: keyof CustomerContact, value: any) => {
    setContacts(prev => prev.map((contact, i) => 
      i === index ? { ...contact, [field]: value } : contact
    ))
  }

  const handleSetPrimary = (index: number) => {
    setContacts(prev => prev.map((contact, i) => ({
      ...contact,
      is_primary: i === index
    })))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {customer ? 'Editar cliente' : 'Nuevo cliente'}
          </DialogTitle>
          <DialogDescription>
            {customer ? 'Modifica los datos del cliente y gestiona sus contactos' : 'Ingresa los datos del nuevo cliente'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSap && (
            <div className="flex flex-col gap-2 rounded-lg bg-info-soft p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                <span>
                  Cliente gestionado por SAP{customer?.external_reference ? ` (${customer.external_reference})` : ''}.
                  Sus datos se editan en SAP; aquí solo se gestionan los contactos.
                  {(sapActive !== undefined ? sapActive : customer?.sap_active) === false && ' Está inactivo en SAP.'}
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleSapRefresh} disabled={refreshing} className="shrink-0 bg-card">
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Actualizar desde SAP
              </Button>
            </div>
          )}
          <fieldset disabled={isSap} className="space-y-4 disabled:opacity-80">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document_type">Tipo de documento</Label>
              <Select 
                value={formData.document_type} 
                onValueChange={(value) => handleInputChange('document_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="document_id">Número de documento {!isSap && '*'}</Label>
              <Input
                id="document_id"
                value={formData.document_id}
                onChange={(e) => handleInputChange('document_id', e.target.value)}
                placeholder={formData.document_type === 'rnc' ? 'Ej: 101234567' : 'Ej: 00112345678'}
                inputMode="numeric"
                required={!isSap}
                aria-invalid={!isSap && !!formData.document_id && !!documentError(formData.document_type, formData.document_id)}
              />
              {!isSap && formData.document_id && documentError(formData.document_type, formData.document_id) && (
                <p className="text-xs text-destructive">{documentError(formData.document_type, formData.document_id)}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Nombre completo del cliente"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1 (809) 555-0123"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Dirección completa del cliente"
              rows={3}
            />
          </div>
          </fieldset>

          {customer && (
            <>
              <Separator className="my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Contactos adicionales</Label>
                    <p className="text-sm text-muted-foreground">
                      Gestiona números de teléfono y WhatsApp del cliente
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddContact}
                    disabled={loadingContacts}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>

                {loadingContacts ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : contacts.length > 0 ? (
                  <div className="space-y-3">
                    {contacts.map((contact, index) => (
                      <div key={contact.id ?? `new-${index}`} className="flex gap-2 items-start p-3 border rounded-lg">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Teléfono"
                              value={contact.phone}
                              onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                            />
                            <Select
                              value={contact.contact_type}
                              onValueChange={(value) => handleContactChange(index, 'contact_type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="phone">Teléfono</SelectItem>
                                <SelectItem value="telegram">Telegram</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            placeholder="Etiqueta (ej: Personal, Trabajo)"
                            value={contact.label || ''}
                            onChange={(e) => handleContactChange(index, 'label', e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant={contact.is_primary ? "default" : "ghost"}
                          size="icon"
                          onClick={() => handleSetPrimary(index)}
                          title={contact.is_primary ? "Principal" : "Marcar como principal"}
                          aria-label={contact.is_primary ? "Contacto principal" : "Marcar como principal"}
                          aria-pressed={contact.is_primary}
                        >
                          <Star className={`h-4 w-4 ${contact.is_primary ? 'fill-current' : ''}`} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveContact(index)}
                          aria-label="Quitar contacto"
                          title="Quitar contacto (se aplica al guardar)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay contactos adicionales
                  </p>
                )}
              </div>

              <Separator className="my-4" />
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="external_reference">CardCode / referencia externa</Label>
            <Input
              id="external_reference"
              value={formData.external_reference}
              onChange={(e) => handleInputChange('external_reference', e.target.value)}
              placeholder="Código del cliente en SAP u otro sistema"
              // El CardCode es la identidad del cliente: una vez enlazado no se cambia.
              disabled={isSap || !!customer?.external_reference}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={saving || (!isSap && (!formData.document_id.trim() || !formData.name.trim()))}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSap ? 'Guardar contactos' : customer ? 'Actualizar cliente' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}