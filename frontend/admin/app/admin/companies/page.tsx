'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Globe,
  Phone,
  Mail,
  MapPin,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAdmin } from '@/contexts/admin-context'
import { toast } from 'react-toastify'

interface Company {
  id: string
  name: string
  description?: string
  logo_url?: string
  website?: string
  email?: string
  phone?: string
  address?: string
  api_key?: string | null
  store_api_key?: string | null
  has_server_key?: boolean
  settings: any
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function CompaniesPage() {
  const { user, isLoading: isAuthLoading } = useAdmin()
  // Crear, desactivar y (re)activar empresas es de plataforma: solo super_admin.
  const isSuperAdmin = String((user as any)?.role) === 'super_admin'
  const [formError, setFormError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({})
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    website: '',
    email: '',
    phone: '',
    address: '',
    is_active: true
  })

  const loadCompanies = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.getCompanies()
      setCompanies(data)
    } catch (error) {
      console.error('Error loading companies:', error)
      toast.error((error as any)?.message || 'No se pudieron cargar las empresas')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      loadCompanies()
    }
  }, [user?.role])

  if (isAuthLoading) {
    return (
      <AdminLayout title="Empresas">
        <div className="text-center py-12">
          <p className="text-gray-500">Verificando permisos...</p>
        </div>
      </AdminLayout>
    )
  }

  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return (
      <AdminLayout title="Empresas">
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Acceso denegado</h3>
          <p className="mt-1 text-sm text-gray-500">
            Solo administradores y super administradores pueden gestionar empresas.
          </p>
        </div>
      </AdminLayout>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    
    try {
      if (editingCompany) {
        await apiClient.updateCompany(editingCompany.id, formData)
      } else {
        await apiClient.createCompany(formData)
      }
      
      await loadCompanies()
      setIsCreateModalOpen(false)
      setEditingCompany(null)
      setFormData({
        name: '',
        description: '',
        logo_url: '',
        website: '',
        email: '',
        phone: '',
        address: '',
        is_active: true
      })
    } catch (error: any) {
      console.error('Error saving company:', error)
      // El modal queda abierto con el motivo (antes no se explicaba nada).
      setFormError(error?.message || 'No se pudo guardar la empresa')
    }
  }

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name,
      description: company.description || '',
      logo_url: company.logo_url || '',
      website: company.website || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      is_active: company.is_active
    })
    setIsCreateModalOpen(true)
  }

  const handleDelete = async (companyId: string) => {
    const company = companies.find(c => c.id === companyId)
    const typed = prompt(
      `Desactivar «${company?.name}»: su tienda publicada, el bot y sus usuarios dejarán de funcionar.\n\n` +
      `Escribe el nombre exacto de la empresa para confirmar:`
    )
    if (!typed || typed.trim() !== (company?.name || '').trim()) {
      if (typed !== null) toast.error('El nombre no coincide; no se desactivó nada.')
      return
    }

    try {
      await apiClient.deleteCompany(companyId)
      toast.success('Empresa desactivada')
      await loadCompanies()
    } catch (error: any) {
      console.error('Error deleting company:', error)
      toast.error(error?.message || 'No se pudo desactivar la empresa')
    }
  }

  const toggleApiKeyVisibility = (companyId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }))
  }

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey)
  }

  return (
    <AdminLayout title="Gestión de Empresas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Empresas</h2>
            <p className="text-gray-600">Gestiona las empresas, dominios de catálogo y configuración</p>
          </div>
          
          <Dialog open={isCreateModalOpen} onOpenChange={(o) => { setIsCreateModalOpen(o); if (!o) setFormError(null) }}>
            {isSuperAdmin && (
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  Nueva Empresa
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Nombre de la empresa *</Label>
                    <Input
                      id="name"
                      placeholder="Ej: Repuestos La Casa del Colt"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="website" className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-blue-600" />
                      Sitio Web / URL del Catálogo (Tienda)
                    </Label>
                    <Input
                      id="website"
                      placeholder="https://casadelcolt.com"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta es la URL que el Bot de WhatsApp enviará a los clientes de esta empresa.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-gray-500" />
                      Teléfono
                    </Label>
                    <Input
                      id="phone"
                      placeholder="809-555-0100"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-gray-500" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ventas@casadelcolt.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="address" className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      Dirección física
                    </Label>
                    <Input
                      id="address"
                      placeholder="Av. 27 de Febrero #123, Santo Domingo"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="logo_url">URL del Logo</Label>
                    <Input
                      id="logo_url"
                      type="url"
                      placeholder="https://..."
                      value={formData.logo_url}
                      onChange={(e) => setFormData({...formData, logo_url: e.target.value})}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      placeholder="Descripción de la empresa..."
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={2}
                    />
                  </div>
                </div>
                
                {isSuperAdmin && (
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">Empresa activa</Label>
                  </div>
                )}
                {formError && (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
                )}
                
                <div className="flex gap-2 pt-4 border-t">
                  <Button type="submit" className="flex-1">
                    {editingCompany ? 'Guardar Cambios' : 'Crear Empresa'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsCreateModalOpen(false)
                      setEditingCompany(null)
                      setFormData({
                        name: '',
                        description: '',
                        logo_url: '',
                        website: '',
                        email: '',
                        phone: '',
                        address: '',
                        is_active: true
                      })
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p>Cargando empresas...</p>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay empresas</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza creando tu primera empresa.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>URL Catálogo (Tienda)</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {company.logo_url ? (
                            <img
                              src={company.logo_url}
                              alt={`Logo de ${company.name}`}
                              className="w-9 h-9 rounded object-cover border"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded bg-blue-50 flex items-center justify-center border">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900">{company.name}</div>
                            {company.description && (
                              <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px]">
                                {company.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {company.website ? (
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[180px]">{company.website}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No configurado</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 text-xs text-gray-600">
                          {company.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span>{company.phone}</span>
                            </div>
                          )}
                          {company.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span>{company.email}</span>
                            </div>
                          )}
                          {!company.phone && !company.email && (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {/* Clave PÚBLICA de la tienda (pk_live_…): la que se usa al compilar
                            una tienda. La de servidor no se muestra ni se copia desde el
                            panel: en el navegador fue como se filtró. */}
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono" title="Clave pública de la tienda">
                            {company.store_api_key
                              ? showApiKey[company.id]
                                ? company.store_api_key
                                : `${company.store_api_key.substring(0, 12)}...`
                              : 'Sin clave de tienda'}
                          </code>
                          {company.store_api_key && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => toggleApiKeyVisibility(company.id)}
                                title={showApiKey[company.id] ? "Ocultar" : "Mostrar"}
                              >
                                {showApiKey[company.id] ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => copyApiKey(company.store_api_key || "")}
                                title="Copiar clave pública de la tienda"
                              >
                                <Key className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Clave de servidor: {company.has_server_key ? 'configurada (no se muestra)' : 'no configurada'}
                        </p>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={company.is_active ? 'default' : 'secondary'}>
                          {company.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                            onClick={() => handleEdit(company)}
                            title="Editar empresa"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                              onClick={() => handleDelete(company.id)}
                              title="Desactivar empresa"
                              aria-label={`Desactivar ${company.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
