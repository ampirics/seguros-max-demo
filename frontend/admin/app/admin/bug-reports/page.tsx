"use client"

import { useEffect, useState } from 'react'
import { useAdmin } from '@/contexts/admin-context'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Bug, MessageSquare, Lightbulb, HelpCircle, Search, Eye, Edit, TrendingUp, Clock, CheckCircle, XCircle, Download, FileText, Upload } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useToast } from "@/components/ui/use-toast" // ← CAMBIO AQUÍ
import { bugReportsAPI, type BugReport, type BugReportStats } from '@/lib/bug-reports'
import { config } from '@/lib/config'

export default function BugReportsAdminPage() {
  const { user, isLoading } = useAdmin()
  const { toast } = useToast() // ← CAMBIO AQUÍ
  const [reports, setReports] = useState<BugReport[]>([])
  const [stats, setStats] = useState<BugReportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null)
  const [editingReport, setEditingReport] = useState<BugReport | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(config.pagination.adminPageSize) // Usar configuración centralizada
  const [totalItems, setTotalItems] = useState(0)
  
  // Estado para exportar
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = '/admin/login'
    }
  }, [user, isLoading])

  // Estado, tipo y búsqueda se filtran en el servidor con total real (antes:
  // sobre la página ya cortada, y el total bajando todos los reportes).
  const [appliedSearch, setAppliedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setAppliedSearch(searchTerm); setCurrentPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    loadReports()
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, currentPage, appliedSearch])

  const loadReports = async (page = currentPage) => {
    try {
      setLoading(true)
      const skip = (page - 1) * itemsPerPage
      const data = await bugReportsAPI.getAllReportsAdmin(skip, itemsPerPage, {
        status: statusFilter, type: typeFilter, search: appliedSearch,
      })
      setReports(data.items || [])
      setTotalItems(data.total || 0)
    } catch (error: any) {
      console.error('Error loading reports:', error)
      toast({ title: "Error", description: error?.message || "Error al cargar los reportes", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await bugReportsAPI.getStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    try {
      await bugReportsAPI.updateReportStatusAdmin(reportId, newStatus)
      toast({ title: "Éxito", description: "Estado actualizado correctamente" })
      // El detalle abierto también (antes volvía al estado anterior).
      setSelectedReport(prev => (prev && prev.id === reportId ? { ...prev, status: newStatus as any } : prev))
      loadReports()
      loadStats()
    } catch (error) {
      console.error('Error updating status:', error)
      toast({ title: "Error", description: "Error al actualizar el estado", variant: "destructive" })
    }
  }

  const handleUpdateReport = async (reportId: string, updates: Partial<BugReport>) => {
    try {
      await bugReportsAPI.updateReportAdmin(reportId, updates)
      toast({ title: "Éxito", description: "Reporte actualizado correctamente" })
      setEditingReport(null)
      loadReports()
    } catch (error) {
      console.error('Error updating report:', error)
      toast({ title: "Error", description: "Error al actualizar el reporte", variant: "destructive" })
    }
  }

  const handleCreateReport = async (newReport: Omit<BugReport, 'id' | 'status' | 'created_at' | 'updated_at'>) => {
    try {
      await bugReportsAPI.createReport(newReport)
      toast({ title: "Éxito", description: "Reporte creado correctamente" })
      setShowCreateModal(false)
      loadReports()
      loadStats()
    } catch (error) {
      console.error('Error creating report:', error)
      toast({ title: "Error", description: "Error al crear el reporte", variant: "destructive" })
    }
  }

  // Función para exportar reportes
  const exportReports = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setExportLoading(true)
      
      // Verificar que hay token
      const token = localStorage.getItem(config.auth.tokenKey)
      if (!token) {
        toast({ title: "Error", description: "No hay token de autenticación. Por favor, inicia sesión nuevamente.", variant: "destructive" })
        return
      }
      
      
      // Obtener todos los reportes con paginación (límite del backend: configuración centralizada)
      let allReports: BugReport[] = []
      let skip = 0
      const limit = config.pagination.maxLimit // Límite máximo permitido por el backend
      let hasMore = true
      
      while (hasMore) {
        const res = await bugReportsAPI.getAllReportsAdmin(skip, limit, {
          status: statusFilter, type: typeFilter, search: appliedSearch,
        })
        const batch = res.items || []

        if (batch && batch.length > 0) {
          allReports = [...allReports, ...batch]
          skip += batch.length
          
          // Si recibimos menos que el límite, no hay más datos
          hasMore = batch.length === limit
        } else {
          hasMore = false
        }
      }
      
      
      if (!allReports || allReports.length === 0) {
        toast({ title: "Advertencia", description: "No hay reportes para exportar", variant: "default" })
        return
      }
      
      if (format === 'csv') {
        exportToCSV(allReports)
      } else {
        exportToJSON(allReports)
      }
      
      toast({ title: "Éxito", description: `${allReports.length} reportes exportados en formato ${format.toUpperCase()}` })
      
    } catch (error) {
      console.error('Error exporting reports:', error)
      
      // Mejorar mensaje de error basado en el tipo
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Token inválido')) {
          toast({ title: "Error", description: "Sesión expirada. Por favor, inicia sesión nuevamente.", variant: "destructive" })
        } else if (error.message.includes('404')) {
          toast({ title: "Error", description: "API no encontrada. Verifica que el backend esté funcionando.", variant: "destructive" })
        } else if (error.message.includes('422')) {
          toast({ title: "Error", description: "Error de validación en el servidor. Los parámetros no son válidos.", variant: "destructive" })
        } else if (error.message.includes('500')) {
          toast({ title: "Error", description: "Error del servidor. Intenta más tarde.", variant: "destructive" })
        } else {
          toast({ title: "Error", description: `Error al exportar: ${error.message}`, variant: "destructive" })
        }
      } else {
        toast({ title: "Error", description: "Error desconocido al exportar los reportes", variant: "destructive" })
      }
    } finally {
      setExportLoading(false)
    }
  }

  const generateFileName = (format: 'csv' | 'json'): string => {
    const now = new Date()
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_')
    return `bug-reports_${timestamp}.${format}`
  }

  const exportToCSV = (data: BugReport[]) => {
    const headers = [
      'ID', 'Título', 'Descripción', 'Tipo', 'Prioridad', 'Estado',
      'Email Usuario', 'Nombre Usuario', 'Navegador', 'SO',
      'Pasos para Reproducir', 'Comportamiento Esperado', 'Comportamiento Actual',
      'Notas Admin', 'Fecha Creación', 'Fecha Actualización'
    ]
    
    const escapeCSV = (value: string | null | undefined): string => {
      if (!value) return ''
      const stringValue = String(value)
      // Escapar comillas dobles y envolver en comillas si contiene comas, saltos de línea o comillas
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }
    
    const csvContent = [
      headers.join(','),
      ...data.map(report => [
        escapeCSV(report.id),
        escapeCSV(report.title),
        escapeCSV(report.description),
        escapeCSV(report.type),
        escapeCSV(report.priority),
        escapeCSV(report.status),
        escapeCSV(report.user_email),
        escapeCSV(report.user_name),
        escapeCSV(report.browser),
        escapeCSV(report.os),
        escapeCSV(report.steps_to_reproduce),
        escapeCSV(report.expected_behavior),
        escapeCSV(report.actual_behavior),
        escapeCSV(report.admin_notes),
        escapeCSV(report.created_at),
        escapeCSV(report.updated_at)
      ].join(','))
    ].join('\n')
    
    downloadFile(csvContent, generateFileName('csv'), 'text/csv;charset=utf-8')
  }

  const exportToJSON = (data: BugReport[]) => {
    const jsonContent = JSON.stringify(data, null, 2)
    downloadFile(jsonContent, generateFileName('json'), 'application/json')
  }

  const downloadFile = (content: string, filename: string, contentType: string) => {
    try {
      // Agregar BOM para UTF-8 si es CSV para mejor compatibilidad con Excel
      const BOM = contentType.includes('csv') ? '\uFEFF' : ''
      const blob = new Blob([BOM + content], { type: contentType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
      toast({ title: "Error", description: "Error al descargar el archivo", variant: "destructive" })
    }
  }

  // Componente para editar reportes
  const EditReportForm = ({ report, onSave, onCancel }: {
    report: BugReport
    onSave: (reportId: string, updates: Partial<BugReport>) => void
    onCancel: () => void
  }) => {
    const [formData, setFormData] = useState({
      title: report.title,
      description: report.description,
      priority: report.priority,
      admin_notes: report.admin_notes || ''
    })

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      onSave(report.id!, formData)
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={4}
            required
          />
        </div>

        <div>
          <Label htmlFor="priority">Prioridad</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="admin_notes">Notas del Administrador</Label>
          <Textarea
            id="admin_notes"
            value={formData.admin_notes}
            onChange={(e) => setFormData(prev => ({ ...prev, admin_notes: e.target.value }))}
            rows={3}
            placeholder="Notas internas para el equipo..."
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            Guardar Cambios
          </Button>
        </div>
      </form>
    )
  }

  // Componente para crear nuevos reportes
  const CreateReportForm = ({ onSave, onCancel }: {
    onSave: (report: Omit<BugReport, 'id' | 'status' | 'created_at' | 'updated_at'>) => void
    onCancel: () => void
  }) => {
    const [formData, setFormData] = useState({
      title: '',
      description: '',
      type: 'bug' as BugReport['type'],
      priority: 'medium' as BugReport['priority'],
      user_name: user?.name || '',
      user_email: user?.email || '',
      steps_to_reproduce: '',
      expected_behavior: '',
      actual_behavior: '',
      admin_notes: ''
    })

    const [uploadedImages, setUploadedImages] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      
      // Crear el reporte con los datos del formulario
      const reportData: Omit<BugReport, 'id' | 'status' | 'created_at' | 'updated_at'> = {
        ...formData,
        is_public: true
      }
      
      onSave(reportData)
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      const imageFiles = files.filter(file => 
        config.files.allowedImageTypes.includes(file.type) && 
        file.size <= config.files.maxImageSize
      )
      
      if (imageFiles.length !== files.length) {
        const invalidFiles = files.filter(file => 
          !config.files.allowedImageTypes.includes(file.type) || 
          file.size > config.files.maxImageSize
        )
        
        if (invalidFiles.some(f => !config.files.allowedImageTypes.includes(f.type))) {
          toast({ title: "Advertencia", description: "Solo se permiten archivos de imagen (JPG, PNG, GIF, WebP)", variant: "default" })
        }
        if (invalidFiles.some(f => f.size > config.files.maxImageSize)) {
          toast({ title: "Advertencia", description: `Archivos demasiado grandes. Máximo ${config.files.maxImageSize / 1024 / 1024}MB`, variant: "default" })
        }
      }
      
      // Limitar según configuración
      const totalImages = uploadedImages.length + imageFiles.length
      if (totalImages > config.files.maxImagesPerReport) {
        toast({ title: "Advertencia", description: `Máximo ${config.files.maxImagesPerReport} imágenes permitidas`, variant: "default" })
        return
      }
      
      setUploadedImages(prev => [...prev, ...imageFiles])
    }

    const removeImage = (index: number) => {
      setUploadedImages(prev => prev.filter((_, i) => i !== index))
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Resumen breve del problema"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="type">Tipo *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Error/Bug</SelectItem>
                <SelectItem value="feature_request">Nueva Funcionalidad</SelectItem>
                <SelectItem value="improvement">Mejora</SelectItem>
                <SelectItem value="question">Pregunta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="priority">Prioridad *</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="user_name">Nombre del Reportador</Label>
            <Input
              id="user_name"
              value={formData.user_name}
              onChange={(e) => setFormData(prev => ({ ...prev, user_name: e.target.value }))}
              placeholder="Nombre completo"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="user_email">Email del Reportador</Label>
          <Input
            id="user_email"
            type="email"
            value={formData.user_email}
            onChange={(e) => setFormData(prev => ({ ...prev, user_email: e.target.value }))}
            placeholder="email@ejemplo.com"
          />
        </div>
        
        <div>
          <Label htmlFor="description">Descripción *</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={4}
            placeholder="Describe detalladamente el problema o sugerencia"
            required
          />
        </div>

        {formData.type === 'bug' && (
          <>
            <div>
              <Label htmlFor="steps_to_reproduce">Pasos para Reproducir</Label>
              <Textarea
                id="steps_to_reproduce"
                value={formData.steps_to_reproduce}
                onChange={(e) => setFormData(prev => ({ ...prev, steps_to_reproduce: e.target.value }))}
                rows={3}
                placeholder="1. Paso uno&#10;2. Paso dos&#10;3. Paso tres"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expected_behavior">Comportamiento Esperado</Label>
                <Textarea
                  id="expected_behavior"
                  value={formData.expected_behavior}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_behavior: e.target.value }))}
                  rows={2}
                  placeholder="¿Qué debería haber pasado?"
                />
              </div>
              
              <div>
                <Label htmlFor="actual_behavior">Comportamiento Actual</Label>
                <Textarea
                  id="actual_behavior"
                  value={formData.actual_behavior}
                  onChange={(e) => setFormData(prev => ({ ...prev, actual_behavior: e.target.value }))}
                  rows={2}
                  placeholder="¿Qué pasó realmente?"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <Label htmlFor="admin_notes">Notas del Administrador</Label>
          <Textarea
            id="admin_notes"
            value={formData.admin_notes}
            onChange={(e) => setFormData(prev => ({ ...prev, admin_notes: e.target.value }))}
            rows={3}
            placeholder="Notas internas para el equipo..."
          />
        </div>

        {/* Sección de imágenes */}
        <div>
          <Label>Imágenes Adjuntas (Opcional)</Label>
          <div className="mt-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="h-4 w-4" />
                <span className="text-sm">Subir Imágenes</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              <span className="text-sm text-muted-foreground">
                Máximo {config.files.maxImagesPerReport} imágenes, hasta {config.files.maxImageSize / 1024 / 1024}MB cada una
              </span>
            </div>
            
            {uploadedImages.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                {uploadedImages.map((file, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={uploading}>
            {uploading ? 'Creando...' : 'Crear Reporte'}
          </Button>
        </div>
      </form>
    )
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="h-4 w-4" />
      case 'feature_request': return <Lightbulb className="h-4 w-4" />
      case 'improvement': return <MessageSquare className="h-4 w-4" />
      case 'question': return <HelpCircle className="h-4 w-4" />
      default: return <Bug className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bug': return 'Error/Bug'
      case 'feature_request': return 'Nueva Funcionalidad'
      case 'improvement': return 'Mejora'
      case 'question': return 'Pregunta'
      default: return 'Error/Bug'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Abierto</Badge>
      case 'in_progress':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En Progreso</Badge>
      case 'resolved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Resuelto</Badge>
      case 'closed':
        return <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Cerrado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Crítica</Badge>
      case 'high':
        return <Badge variant="destructive">Alta</Badge>
      case 'medium':
        return <Badge variant="secondary">Media</Badge>
      case 'low':
        return <Badge variant="outline">Baja</Badge>
      default:
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return null
  }

  return (
    <AdminLayout title="Bug Reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Bug Reports</h1>
            <p className="text-muted-foreground">Gestiona reportes de errores y sugerencias</p>
          </div>
          
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Bug className="h-4 w-4 mr-2" />
                Crear Nuevo Reporte
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Reporte</DialogTitle>
              </DialogHeader>
              <CreateReportForm 
                onSave={handleCreateReport}
                onCancel={() => setShowCreateModal(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abiertos</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.open}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.in_progress}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resueltos</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cerrados</CardTitle>
                <CheckCircle className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => exportReports('csv')}
                  disabled={exportLoading}
                  className="text-sm"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {exportLoading ? 'Exportando...' : 'Exportar CSV'}
                </Button>
                <Button
                  variant="outline" 
                  onClick={() => exportReports('json')}
                  disabled={exportLoading}
                  className="text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportLoading ? 'Exportando...' : 'Exportar JSON'}
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar reportes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="resolved">Resuelto</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="bug">Error/Bug</SelectItem>
                  <SelectItem value="feature_request">Nueva Funcionalidad</SelectItem>
                  <SelectItem value="improvement">Mejora</SelectItem>
                  <SelectItem value="question">Pregunta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de reportes */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Cargando reportes...</div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Bug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay reportes que coincidan con los filtros</p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(report.type)}
                        <h3 className="font-semibold">{report.title}</h3>
                        {getStatusBadge(report.status!)}
                        {getPriorityBadge(report.priority)}
                      </div>
                      
                      <p className="text-muted-foreground mb-2 line-clamp-2">
                        {report.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{getTypeLabel(report.type)}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(report.created_at!), { addSuffix: true, locale: es })}</span>
                        {report.user_name && (
                          <>
                            <span>•</span>
                            <span>Por: {report.user_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              {getTypeIcon(report.type)}
                              {report.title}
                            </DialogTitle>
                          </DialogHeader>
                          
                          {selectedReport && (
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                {getStatusBadge(selectedReport.status!)}
                                {getPriorityBadge(selectedReport.priority)}
                              </div>
                              
                              <div>
                                <h4 className="font-medium mb-2">Descripción</h4>
                                <p className="text-muted-foreground">{selectedReport.description}</p>
                              </div>
                              
                              {selectedReport.steps_to_reproduce && (
                                <div>
                                  <h4 className="font-medium mb-2">Pasos para reproducir</h4>
                                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.steps_to_reproduce}</p>
                                </div>
                              )}
                              
                              {selectedReport.expected_behavior && (
                                <div>
                                  <h4 className="font-medium mb-2">Comportamiento esperado</h4>
                                  <p className="text-muted-foreground">{selectedReport.expected_behavior}</p>
                                </div>
                              )}
                              
                              {selectedReport.actual_behavior && (
                                <div>
                                  <h4 className="font-medium mb-2">Comportamiento actual</h4>
                                  <p className="text-muted-foreground">{selectedReport.actual_behavior}</p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <h4 className="font-medium mb-1">Información técnica</h4>
                                  <p>Navegador: {selectedReport.browser || 'N/A'}</p>
                                  <p>OS: {selectedReport.os || 'N/A'}</p>
                                  <p>Resolución: {selectedReport.screen_resolution || 'N/A'}</p>
                                  <p>URL: {selectedReport.url || 'N/A'}</p>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium mb-1">Información de contacto</h4>
                                  <p>Nombre: {selectedReport.user_name || 'Anónimo'}</p>
                                  <p>Email: {selectedReport.user_email || 'N/A'}</p>
                                </div>
                              </div>
                              
                              <div className="border-t pt-4">
                                <Label htmlFor="status">Cambiar estado</Label>
                                <Select 
                                  value={selectedReport.status} 
                                  onValueChange={(value) => handleUpdateStatus(selectedReport.id!, value)}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Abierto</SelectItem>
                                    <SelectItem value="in_progress">En Progreso</SelectItem>
                                    <SelectItem value="resolved">Resuelto</SelectItem>
                                    <SelectItem value="closed">Cerrado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingReport(report)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Paginación */}
        {!loading && reports.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} a {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} reportes
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, Math.ceil(totalItems / itemsPerPage)) }, (_, i) => {
                      const pageNumber = Math.max(1, currentPage - 2) + i
                      if (pageNumber <= Math.ceil(totalItems / itemsPerPage)) {
                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNumber)}
                          >
                            {pageNumber}
                          </Button>
                        )
                      }
                      return null
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(Math.ceil(totalItems / itemsPerPage), currentPage + 1))}
                    disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Edición */}
        {editingReport && (
          <Dialog open={!!editingReport} onOpenChange={(open) => !open && setEditingReport(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Reporte</DialogTitle>
              </DialogHeader>
              <EditReportForm 
                report={editingReport}
                onSave={handleUpdateReport}
                onCancel={() => setEditingReport(null)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  )
}
