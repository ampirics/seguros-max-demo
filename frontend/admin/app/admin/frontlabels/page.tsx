"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Tag, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Save,
  X,
  AlertCircle,
  FileText,
  Hash,
  Users,
  FolderTree,
  Copy
} from "lucide-react"
import { frontLabelApi } from "@/lib/frontlabel-api"
import type { FrontLabel, FrontLabelCreate, FrontLabelUpdate } from "@/lib/frontlabel-types"
import { toast } from "react-toastify"

const PAGE_SIZE = 10

export default function FrontLabelsPage() {
  // Estados principales
  const [items, setItems] = useState<FrontLabel[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  
  // Estados de modal y formulario
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FrontLabel | null>(null)
  const [form, setForm] = useState<Partial<FrontLabelCreate>>({})
  
  // Estados de filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState("")
  const [groupFilter, setGroupFilter] = useState("")
  const [parentFilter, setParentFilter] = useState("")
  
  // Estados auxiliares
  const [error, setError] = useState<string | null>(null)
  const [parents, setParents] = useState<FrontLabel[]>([])
  const [groups, setGroups] = useState<string[]>([])

  // Calcular paginación
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const skip = (currentPage - 1) * PAGE_SIZE

  // Cargar datos
  const fetchData = async (page = currentPage) => {
    setLoading(true)
    setError(null)
    try {
      const pageSkip = (page - 1) * PAGE_SIZE
      
      const res = await frontLabelApi.list(pageSkip, PAGE_SIZE)
      
      setItems(res.items || [])
      setTotal(res.total || 0)
      
      // Extraer grupos únicos para el filtro
      const uniqueGroups = [...new Set((res.items || []).map(item => item.group_id).filter(Boolean))] as string[]
      setGroups(uniqueGroups)
      
    } catch (e: any) {
      console.error("FrontLabels Page - Error fetching data:", e)
      setError(e.message || "Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  // Cargar elementos padre para el selector
  const fetchParents = async () => {
    try {
      const res = await frontLabelApi.list(0, PAGE_SIZE * 20)
      setParents(res.items || [])
    } catch (e) {
      console.error("Error fetching parents:", e)
    }
  }

  // Efectos
  useEffect(() => {
    fetchData(1)
    fetchParents()
  }, [])

  // Handlers del formulario
  const handleCreate = () => {
    setEditing(null)
    setForm({})
    setIsDialogOpen(true)
  }

  const handleEdit = (item: FrontLabel) => {
    setEditing(item)
    setForm({
      code: item.code,
      value1: item.value1,
      value2: item.value2,
      value3: item.value3,
      value4: item.value4,
      value5: item.value5,
      description: item.description,
      group_id: item.group_id,
      idparent: item.idparent
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (item: FrontLabel) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${item.code}"?`)) return
    
    setLoading(true)
    try {
      await frontLabelApi.delete(item.id)
      toast.success("FrontLabel eliminado exitosamente")
      fetchData(currentPage)
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar")
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code?.trim()) {
      toast.error("El código es requerido")
      return
    }

    setLoading(true)
    try {
      if (editing) {
        await frontLabelApi.update(editing.id, form as FrontLabelUpdate)
        toast.success("FrontLabel actualizado exitosamente")
      } else {
        await frontLabelApi.create(form as FrontLabelCreate)
        toast.success("FrontLabel creado exitosamente")
      }
      
      setIsDialogOpen(false)
      setForm({})
      setEditing(null)
      fetchData(currentPage)
    } catch (e: any) {
      toast.error(e.message || "Error al guardar")
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFormChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Filtros aplicados
  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === "" || 
      item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.value1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesGroup = groupFilter === "" || item.group_id === groupFilter
    const matchesParent = parentFilter === "" || String(item.idparent) === parentFilter

    return matchesSearch && matchesGroup && matchesParent
  })

  const getParentName = (parentId: number | null | undefined) => {
    if (!parentId) return null
    const parent = parents.find(p => p.id === parentId)
    return parent ? `${parent.code} (${parent.value1 || 'Sin título'})` : `ID: ${parentId}`
  }

  return (
    <AdminLayout title="FrontLabels">
      <div className="space-y-6">
        {/* Header con controles */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">FrontLabels</h1>
            <p className="text-gray-600">Gestiona las etiquetas y valores del frontend</p>
          </div>
          
          <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo FrontLabel
          </Button>
        </div>

        {/* Filtros y búsqueda */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros y Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Código, nombre o descripción..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="group">Grupo</Label>
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger id="group">
                    <SelectValue placeholder="Todos los grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los grupos</SelectItem>
                    {groups.map(group => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="parent">Padre</Label>
                <Select value={parentFilter} onValueChange={setParentFilter}>
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="Todos los padres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los padres</SelectItem>
                    {parents.map(parent => (
                      <SelectItem key={parent.id} value={String(parent.id)}>
                        {parent.code} - {parent.value1 || 'Sin título'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery("")
                    setGroupFilter("")
                    setParentFilter("")
                  }}
                  className="w-full"
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Tag className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FolderTree className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Grupos</p>
                  <p className="text-2xl font-bold">{groups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Con Padre</p>
                  <p className="text-2xl font-bold">{items.filter(i => i.idparent).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Mostrados</p>
                  <p className="text-2xl font-bold">{filteredItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla principal */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de FrontLabels</CardTitle>
            <CardDescription>
              Página {currentPage} de {totalPages} - {total} elementos totales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Grupo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Padre</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Valores</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        Cargando...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No se encontraron elementos
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-mono">{item.id}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{item.code}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-900">{item.value1 || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          {item.group_id ? (
                            <Badge variant="secondary">{item.group_id}</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.idparent ? (
                            <span className="text-sm text-blue-600">{getParentName(item.idparent)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {[item.value1, item.value2, item.value3, item.value4, item.value5]
                              .filter(Boolean)
                              .slice(0, 3)
                              .map((value, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {value}
                                </Badge>
                              ))}
                            {[item.value1, item.value2, item.value3, item.value4, item.value5]
                              .filter(Boolean).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{[item.value1, item.value2, item.value3, item.value4, item.value5]
                                  .filter(Boolean).length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(item)}
                              disabled={loading}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(item)}
                              disabled={loading}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Mostrando {filteredItems.length} de {total} elementos
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentPage(prev => Math.max(1, prev - 1))
                    fetchData(Math.max(1, currentPage - 1))
                  }}
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages, prev + 1))
                    fetchData(Math.min(totalPages, currentPage + 1))
                  }}
                  disabled={currentPage >= totalPages || loading}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de creación/edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editing ? 'Editar FrontLabel' : 'Crear FrontLabel'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Modifica los datos del FrontLabel' : 'Completa los datos para crear un nuevo FrontLabel'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={form.code || ''}
                  onChange={(e) => handleFormChange('code', e.target.value)}
                  placeholder="Ej: HEADER_TITLE"
                  disabled={!!editing}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="value1">Nombre/Título *</Label>
                <Input
                  id="value1"
                  value={form.value1 || ''}
                  onChange={(e) => handleFormChange('value1', e.target.value)}
                  placeholder="Nombre principal"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={form.description || ''}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Descripción del elemento"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="group_id">Grupo</Label>
                <Input
                  id="group_id"
                  value={form.group_id || ''}
                  onChange={(e) => handleFormChange('group_id', e.target.value)}
                  placeholder="Ej: navigation, footer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent">Padre</Label>
                <Select 
                  value={form.idparent ? String(form.idparent) : ''} 
                  onValueChange={(value) => handleFormChange('idparent', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un padre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin padre</SelectItem>
                    {parents.map(parent => (
                      <SelectItem key={parent.id} value={String(parent.id)}>
                        {parent.code} - {parent.value1 || 'Sin título'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Valores Adicionales</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="value2">Value 2</Label>
                  <Input
                    id="value2"
                    value={form.value2 || ''}
                    onChange={(e) => handleFormChange('value2', e.target.value)}
                    placeholder="Valor 2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value3">Value 3</Label>
                  <Input
                    id="value3"
                    value={form.value3 || ''}
                    onChange={(e) => handleFormChange('value3', e.target.value)}
                    placeholder="Valor 3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value4">Value 4</Label>
                  <Input
                    id="value4"
                    value={form.value4 || ''}
                    onChange={(e) => handleFormChange('value4', e.target.value)}
                    placeholder="Valor 4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value5">Value 5</Label>
                  <Input
                    id="value5"
                    value={form.value5 || ''}
                    onChange={(e) => handleFormChange('value5', e.target.value)}
                    placeholder="Valor 5"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {editing ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
