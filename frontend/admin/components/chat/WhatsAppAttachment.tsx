"use client"

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Paperclip, Image, FileText, Music, Video, Send, X, Eye } from "lucide-react"
import { toast } from "react-hot-toast"

interface WhatsAppAttachmentProps {
  conversationId: string
  onSendSuccess?: () => void
  disabled?: boolean
}

const WhatsAppAttachment = ({ conversationId, onSendSuccess, disabled }: WhatsAppAttachmentProps) => {
  const [showMenu, setShowMenu] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Resetear estado
  const resetState = () => {
    setSelectedFile(null)
    setCaption('')
    setShowMenu(false)
    setShowPreview(false)
    setIsUploading(false)
  }

  const handleFileSelect = (type: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    
    switch (type) {
      case 'image':
        input.accept = 'image/*'
        break
      case 'document':
        input.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx'
        break
      case 'audio':
        input.accept = 'audio/*'
        break
      case 'video':
        input.accept = 'video/*'
        break
      default:
        input.accept = '*'
    }

    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        // Validar tamaño (16MB max)
        if (file.size > 16 * 1024 * 1024) {
          toast.error('El archivo es muy grande. Máximo 16MB.')
          document.body.removeChild(input)
          return
        }
        
        setSelectedFile(file)
        setShowMenu(false)
        
        // COMPORTAMIENTO WHATSAPP: Enviar directamente, SIN modal
        await sendFileDirectly(file)
      }
      document.body.removeChild(input)
    }

    document.body.appendChild(input)
    input.click()
  }

  const sendFileDirectly = async (file: File, captionText: string = '') => {
    if (isUploading) return

    setIsUploading(true)
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token')
      if (!token) {
        toast.error('Token de autenticación no encontrado')
        return
      }


      // Crear URL con query parameters
      const uploadUrl = `/api/v1/media/whatsapp/upload?conversation_id=${encodeURIComponent(conversationId)}&caption=${encodeURIComponent(captionText)}`

      // Subir archivo
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: (() => {
          const formData = new FormData()
          formData.append('file', file)
          return formData
        })(),
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('❌ Error en upload:', uploadResponse.status, errorText)
        toast.error(`Error al subir archivo: ${uploadResponse.status}`)
        return
      }

      const uploadResult = await uploadResponse.json()

      // Determinar tipo de media
      const getMediaType = (file: File): string => {
        if (file.type.startsWith('image/')) return 'image'
        if (file.type.startsWith('audio/')) return 'audio'
        if (file.type.startsWith('video/')) return 'video'
        return 'document'
      }

      // Enviar vía WhatsApp
      const sendResponse = await fetch(`/api/v1/chat/conversations/${conversationId}/send-media-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          media_url: uploadResult.file_url,
          caption: captionText,
          media_type: getMediaType(file)
        })
      })

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text()
        console.error('❌ Error enviando archivo:', sendResponse.status, errorText)
        toast.error(`Error enviando archivo: ${sendResponse.status}`)
        return
      }

      toast.success(`📎 ${file.name} enviado`)
      onSendSuccess?.()
      resetState()

    } catch (error) {
      console.error('❌ Error:', error)
      toast.error('Error enviando archivo')
    } finally {
      setIsUploading(false)
    }
  }

  const sendWithCaption = async () => {
    if (!selectedFile) return
    await sendFileDirectly(selectedFile, caption)
  }

  // Si hay archivo seleccionado y caption, mostrar mini preview
  if (selectedFile && !showPreview) {
    return (
      <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2 mb-2">
        <div className="flex items-center space-x-2 flex-1">
          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(true)}
          className="h-8 w-8 p-0"
        >
          <Eye className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost" 
          size="sm"
          onClick={() => sendFileDirectly(selectedFile)}
          disabled={isUploading}
          className="h-8 w-8 p-0 text-success hover:text-success"
        >
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm" 
          onClick={resetState}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Modal de preview completo (solo si usuario quiere validar)
  if (showPreview && selectedFile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-gray-800">Enviar archivo</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            <Input
              type="text"
              placeholder="Agregar un comentario..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="border-0 bg-gray-50 focus:bg-white"
            />
          </div>

          <div className="p-4 bg-gray-50 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Atrás
            </Button>
            <Button
              onClick={sendWithCaption}
              disabled={isUploading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isUploading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Botón principal y menu
  if (!showMenu) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setShowMenu(true)}
        className="h-10 w-10 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
        type="button"
      >
        <Paperclip className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowMenu(false)}
        className="h-10 w-10 p-0 text-gray-700 bg-gray-100 rounded-full"
        type="button"
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="absolute bottom-12 left-0 bg-white border shadow-lg rounded-xl p-2 z-50 w-64">
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: 'image', label: 'Foto', icon: Image, bgColor: 'bg-secondary hover:bg-secondary', iconColor: 'text-muted-foreground' },
            { type: 'document', label: 'Documento', icon: FileText, bgColor: 'bg-blue-100 hover:bg-blue-200', iconColor: 'text-blue-600' },
            { type: 'audio', label: 'Audio', icon: Music, bgColor: 'bg-warning-soft hover:bg-orange-200', iconColor: 'text-warning' },
            { type: 'video', label: 'Video', icon: Video, bgColor: 'bg-secondary hover:bg-secondary', iconColor: 'text-muted-foreground' }
          ].map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                onClick={() => handleFileSelect(option.type)}
                className={`flex flex-col items-center p-3 rounded-lg ${option.bgColor} transition-colors`}
                type="button"
              >
                <div className={`p-2 rounded-full ${option.bgColor} ${option.iconColor}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-gray-700 mt-1">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default WhatsAppAttachment