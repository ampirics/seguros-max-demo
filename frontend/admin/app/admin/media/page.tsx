"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { apiClient } from "@/lib/api-client"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  ImageIcon, 
  Search, 
  Upload, 
  Trash2, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  ExternalLink,
  Copy,
  Check
} from "lucide-react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "react-toastify"

interface MediaItem {
  id: string
  name: string
  original_filename: string
  file_extension: string
  source_type: string
  source_path: string
  public_url?: string
  alt_text?: string
  description?: string
  tags?: string[]
  file_size?: number
  usage_count: number
  last_used_at?: string
  created_at: string
  updated_at: string
}

interface MediaListResponse {
  items: MediaItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const FILE_TYPE_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "jpeg", label: "JPEG" },
  { value: "gif", label: "GIF" },
  { value: "webp", label: "WebP" }
]

const SOURCE_TYPE_OPTIONS = [
  { value: "all", label: "Todas las fuentes" },
  { value: "s3_bucket", label: "S3 Bucket" },
  { value: "sftp_server", label: "SFTP Server" },
  { value: "local_folder", label: "Carpeta Local" },
  { value: "server_folder", label: "Carpeta del Servidor" },
  { value: "external_url", label: "URL Externa" },
  { value: "database_binary", label: "Base de Datos" }
]

export default function AdminMediaPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  
  // Estados principales
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  
  // Estados de filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState("")
  // "all" en vez de "": un SelectItem con value "" rompe Radix Select al abrirse.
  const [fileTypeFilter, setFileTypeFilter] = useState("all")
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all")
  const [loadError, setLoadError] = useState<string | null>(null)
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  
  // Estados de modales
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  
  // Estado para copiar URL
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadSourceType, setUploadSourceType] = useState<string>('database_binary')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadData, setUploadData] = useState({
    name: '',
    alt_text: '',
    description: '',
    tags: '',
    source_path: '',
    external_url: ''
  })
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) {
      loadMediaItems()
    }
  }, [user, currentPage, searchTerm, fileTypeFilter, sourceTypeFilter])

  const loadMediaItems = async () => {
    try {
      setLoading(true)
      const params = {
        skip: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(fileTypeFilter !== "all" && { file_type: fileTypeFilter }),
        ...(sourceTypeFilter !== "all" && { source_type: sourceTypeFilter })
      }

      setLoadError(null)
      const data: MediaListResponse = await apiClient.getMediaItems(params)
      setMediaItems(data.items)
      setTotalItems(data.total)
    } catch (error: any) {
      console.error('Error loading media items:', error)
      // Antes el fallo se veía como biblioteca vacía.
      setLoadError(error?.message || 'No se pudo cargar la biblioteca')
      setMediaItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('¿Eliminar esta imagen? Si está en uso (productos o tienda) no se podrá borrar.')) {
      return
    }

    try {
      await apiClient.deleteMediaItem(mediaId)
      toast.success('Imagen eliminada')
      loadMediaItems()
    } catch (error: any) {
      toast.error(error?.message || 'Error al eliminar la imagen')
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      toast.success('URL copiada al portapapeles')
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (error) {
      toast.error('Error al copiar URL')
    }
  }

  // Solo subida de archivo (las demás «fuentes» no existían en el backend).
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  const handleUploadMedia = async () => {
    if (!selectedFile) {
      toast.error('Selecciona una imagen')
      return
    }
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      toast.error('Formato no admitido: PNG, JPG, GIF o WebP')
      return
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      toast.error('La imagen supera 8 MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', uploadData.name.trim() || selectedFile.name)
      if (uploadData.alt_text) formData.append('alt_text', uploadData.alt_text)

      await apiClient.uploadMediaFile(formData)
      toast.success('Imagen subida')
      setShowUploadModal(false)
      resetUploadForm()
      loadMediaItems()
    } catch (error: any) {
      toast.error(error?.message || 'Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const resetUploadForm = () => {
    setSelectedFile(null)
    setUploadSourceType('database_binary')
    setUploadData({
      name: '',
      alt_text: '',
      description: '',
      tags: '',
      source_path: '',
      external_url: ''
    })
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!uploadData.name) {
        const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '')
        setUploadData(prev => ({ ...prev, name: nameWithoutExtension }))
      }
    }
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return 'N/A'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getSourceTypeLabel = (sourceType: string) => {
    const option = SOURCE_TYPE_OPTIONS.find(opt => opt.value === sourceType)
    return option?.label || sourceType
  }

  if (isLoading) {
    return (
      <AdminLayout title="Gestión de Media">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Gestión de Media">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Media</h1>
            <p className="text-gray-600 mt-1">
              Administra archivos de imagen desde múltiples fuentes
            </p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4" />
            Subir Media
          </Button>
        </div>

        {/* Filtros y búsqueda */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de archivo" />
                </SelectTrigger>
                <SelectContent>
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Fuente" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BarChart3 className="w-4 h-4" />
                {totalItems} archivo{totalItems !== 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de media items */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="bg-gray-300 h-48 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
            <p>{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={loadMediaItems}>Reintentar</Button>
          </div>
        ) : mediaItems.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay archivos de media</h3>
              <p className="text-gray-600 mb-4">El sistema de media está listo para configurar</p>
              <Badge variant="outline">Sistema multi-tenant preparado</Badge>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {mediaItems.map((item) => (
              <Card key={item.id} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  {/* Imagen */}
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-4 aspect-square">
                    {item.public_url ? (
                      <Image
                        src={item.public_url}
                        alt={item.alt_text || item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = '/placeholder-image.png'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Overlay con acciones */}
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedMedia(item)
                          setIsDetailModalOpen(true)
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
                      {item.public_url && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopyUrl(item.public_url!)}
                        >
                          {copiedUrl === item.public_url ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteMedia(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Información */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm truncate" title={item.name}>
                      {item.name}
                    </h3>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{item.file_extension.toUpperCase()}</span>
                      <span>{formatFileSize(item.file_size)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getSourceTypeLabel(item.source_type)}
                      </Badge>
                      
                      {item.usage_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {item.usage_count} uso{item.usage_count !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Creado {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} archivos
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              
              <span className="text-sm font-medium">
                Página {currentPage} de {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Modal de subida */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Subir Nuevo Media</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nombre</label>
                  <Input
                    value={uploadData.name}
                    onChange={(e) => setUploadData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del archivo"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Texto Alternativo</label>
                  <Input
                    value={uploadData.alt_text}
                    onChange={(e) => setUploadData(prev => ({ ...prev, alt_text: e.target.value }))}
                    placeholder="Descripción para accesibilidad"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Descripción</label>
                <Input
                  value={uploadData.description}
                  onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del archivo"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tags (separados por comas)</label>
                <Input
                  value={uploadData.tags}
                  onChange={(e) => setUploadData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              {/* Campos específicos según tipo de fuente */}
              {(
                <div>
                  <label className="text-sm font-medium mb-2 block">Archivo * <span className="font-normal text-gray-500">(PNG, JPG, GIF o WebP; máx. 8 MB)</span></label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      Archivo seleccionado: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false)
                    resetUploadForm()
                  }}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUploadMedia}
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? 'Subiendo...' : 'Subir imagen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de detalle */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalles del Media</DialogTitle>
            </DialogHeader>
            
            {selectedMedia && (
              <div className="space-y-4">
                {/* Imagen grande */}
                <div className="relative bg-gray-100 rounded-lg overflow-hidden h-64">
                  {selectedMedia.public_url ? (
                    <Image
                      src={selectedMedia.public_url}
                      alt={selectedMedia.alt_text || selectedMedia.name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>
                
                {/* Información detallada */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Nombre:</span>
                    <p className="text-gray-600">{selectedMedia.name}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium">Archivo original:</span>
                    <p className="text-gray-600">{selectedMedia.original_filename}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium">Tipo:</span>
                    <p className="text-gray-600">{selectedMedia.file_extension.toUpperCase()}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium">Tamaño:</span>
                    <p className="text-gray-600">{formatFileSize(selectedMedia.file_size)}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium">Fuente:</span>
                    <p className="text-gray-600">{getSourceTypeLabel(selectedMedia.source_type)}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium">Usos:</span>
                    <p className="text-gray-600">{selectedMedia.usage_count}</p>
                  </div>
                </div>
                
                {selectedMedia.description && (
                  <div>
                    <span className="font-medium text-sm">Descripción:</span>
                    <p className="text-gray-600 text-sm">{selectedMedia.description}</p>
                  </div>
                )}
                
                {selectedMedia.public_url && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyUrl(selectedMedia.public_url!)}
                      className="flex-1"
                    >
                      {copiedUrl === selectedMedia.public_url ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar URL
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedMedia.public_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
