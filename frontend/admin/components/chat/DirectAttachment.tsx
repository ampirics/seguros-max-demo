"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Paperclip, Image, FileText, Music, Video, X } from "lucide-react"
import { toast } from "react-hot-toast"

interface DirectAttachmentProps {
  conversationId: string
  onSendSuccess?: () => void
  disabled?: boolean
}

const DirectAttachment = ({ conversationId, onSendSuccess, disabled }: DirectAttachmentProps) => {
  const [showMenu, setShowMenu] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const sendFileDirectly = async (file: File) => {
    if (isUploading) return

    setIsUploading(true)
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token')
      if (!token) {
        toast.error('Token de autenticación no encontrado')
        return
      }

      // Mostrar toast de inicio
      toast.loading('Enviando archivo...', { id: 'uploading' })

      // Crear URL con query parameters
      const uploadUrl = `/api/v1/media/whatsapp/upload?conversation_id=${encodeURIComponent(conversationId)}&caption=`

      // Subir archivo
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('❌ Error en upload:', uploadResponse.status, errorText)
        toast.error(`Error al subir archivo`, { id: 'uploading' })
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
          caption: '',
          media_type: getMediaType(file)
        })
      })

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text()
        console.error('❌ Error enviando archivo:', sendResponse.status, errorText)
        toast.error(`Error enviando archivo`, { id: 'uploading' })
        return
      }

      // Éxito
      toast.success(`📎 ${file.name} enviado`, { id: 'uploading' })
      onSendSuccess?.()
      setShowMenu(false)

    } catch (error) {
      console.error('❌ Error:', error)
      toast.error('Error enviando archivo', { id: 'uploading' })
    } finally {
      setIsUploading(false)
    }
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
        
        // ENVIAR DIRECTAMENTE - SIN MODAL
        await sendFileDirectly(file)
      }
      
      document.body.removeChild(input)
    }

    document.body.appendChild(input)
    input.click()
  }

  // Botón principal
  if (!showMenu) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled || isUploading}
        onClick={() => {
          setShowMenu(true)
        }}
        className="h-10 w-10 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
        type="button"
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Paperclip className="h-5 w-5" />
        )}
      </Button>
    )
  }

  // Menu de selección
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setShowMenu(false)
        }}
        className="h-10 w-10 p-0 text-gray-700 bg-gray-100 rounded-full"
        type="button"
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="absolute bottom-12 left-0 bg-white border shadow-xl rounded-xl p-3 z-50 min-w-[280px]">
        <div className="text-xs font-medium text-gray-600 mb-2 px-1">Seleccionar tipo de archivo</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              handleFileSelect('image')
            }}
            className="flex flex-col items-center p-3 rounded-lg bg-secondary hover:bg-secondary transition-colors border border-border"
            type="button"
          >
            <div className="p-2 rounded-full bg-secondary text-muted-foreground">
              <Image className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1">Foto</span>
          </button>

          <button
            onClick={() => {
              handleFileSelect('document')
            }}
            className="flex flex-col items-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200"
            type="button"
          >
            <div className="p-2 rounded-full bg-blue-100 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1">Documento</span>
          </button>

          <button
            onClick={() => {
              handleFileSelect('audio')
            }}
            className="flex flex-col items-center p-3 rounded-lg bg-warning-soft hover:bg-warning-soft transition-colors border border-warning/30"
            type="button"
          >
            <div className="p-2 rounded-full bg-warning-soft text-warning">
              <Music className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1">Audio</span>
          </button>

          <button
            onClick={() => {
              handleFileSelect('video')
            }}
            className="flex flex-col items-center p-3 rounded-lg bg-secondary hover:bg-secondary transition-colors border border-border"
            type="button"
          >
            <div className="p-2 rounded-full bg-secondary text-muted-foreground">
              <Video className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1">Video</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default DirectAttachment