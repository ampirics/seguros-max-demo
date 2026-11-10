"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Paperclip, Image, FileText, Video, Mic } from "lucide-react"
import { toast } from "react-hot-toast"

interface SimpleDirectAttachmentProps {
  conversationId: string
  onSendSuccess?: () => void
  disabled?: boolean
}

const SimpleDirectAttachment = ({ conversationId, onSendSuccess, disabled }: SimpleDirectAttachmentProps) => {
  const [showMenu, setShowMenu] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const uploadAndSendFile = async (file: File) => {
    if (isUploading) {
      return
    }
    
    setIsUploading(true)
    
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token') || sessionStorage.getItem('token')
      
      if (!token) {
        console.error('❌ No hay token de autenticación')
        toast.error('No hay token de autenticación')
        return
      }

      // Validar tamaño de archivo
      if (file.size > 16 * 1024 * 1024) {
        console.error('❌ Archivo muy grande:', file.size)
        toast.error('Archivo muy grande. Máximo 16MB')
        return
      }

      // Mostrar progreso
      toast.loading('Subiendo archivo...', { id: 'upload-progress' })

      // 1. Subir archivo al backend
      const formData = new FormData()
      formData.append('file', file)

      const uploadUrl = `/api/v1/media/whatsapp/upload?conversation_id=${encodeURIComponent(conversationId)}&caption=`
      

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })


      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('❌ Error upload:', errorText)
        toast.error('Error subiendo archivo', { id: 'upload-progress' })
        return
      }

      const uploadResult = await uploadResponse.json()

      // 2. Enviar por WhatsApp
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('audio/') ? 'audio' :
                       file.type.startsWith('video/') ? 'video' : 'document'

      // Usar media_url de la respuesta del backend
      const sendData = {
        media_url: uploadResult.media_url,
        caption: '',
        media_type: mediaType,
        filename: file.name  // Agregar filename
      }


      const sendResponse = await fetch(`/api/v1/chat/conversations/${conversationId}/send-media-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sendData)
      })


      if (!sendResponse.ok) {
        const errorText = await sendResponse.text()
        console.error('❌ Error envío:', errorText)
        toast.error('Error enviando por WhatsApp', { id: 'upload-progress' })
        return
      }

      const sendResult = await sendResponse.json()

      toast.success(`✅ ${file.name} enviado`, { id: 'upload-progress' })
      
      // Notificar éxito al componente padre
      if (onSendSuccess) {
        onSendSuccess()
      }

    } catch (error) {
      console.error('❌ Error completo:', error)
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available')
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error))
      toast.error('Error procesando archivo', { id: 'upload-progress' })
    } finally {
      setIsUploading(false)
    }
  }

  const selectFile = (accept: string, type: string) => {
    
    // Cerrar menú inmediatamente para mejor UX
    setShowMenu(false)
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Feedback inmediato
        toast.success(`📎 Preparando ${file.name}...`, { duration: 1000 })
        uploadAndSendFile(file)
      }
      document.body.removeChild(input)
    })
    
    input.addEventListener('cancel', () => {
      document.body.removeChild(input)
    })
    
    document.body.appendChild(input)
    input.click()
  }

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
      >
        {isUploading ? (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Paperclip className="h-5 w-5" />
        )}
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
        disabled={isUploading}
      >
        ❌
      </Button>

      <div className="absolute bottom-12 left-0 bg-white border shadow-xl rounded-xl p-3 z-50 min-w-[200px]">
        <div className="space-y-2">
          <button
            onClick={() => selectFile('image/*', 'imagen')}
            disabled={isUploading}
            className="w-full flex items-center p-2 rounded-lg bg-secondary hover:bg-secondary text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Image className="h-5 w-5 text-muted-foreground mr-3" />
            <div>
              <span className="text-sm font-medium">Foto</span>
              <p className="text-xs text-gray-500">JPG, PNG, GIF</p>
            </div>
          </button>

          <button
            onClick={() => selectFile('video/*', 'video')}
            disabled={isUploading}
            className="w-full flex items-center p-2 rounded-lg bg-secondary hover:bg-secondary text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Video className="h-5 w-5 text-muted-foreground mr-3" />
            <div>
              <span className="text-sm font-medium">Video</span>
              <p className="text-xs text-gray-500">MP4, MOV, AVI</p>
            </div>
          </button>

          <button
            onClick={() => selectFile('audio/*', 'audio')}
            disabled={isUploading}
            className="w-full flex items-center p-2 rounded-lg bg-success-soft hover:bg-success-soft text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic className="h-5 w-5 text-success mr-3" />
            <div>
              <span className="text-sm font-medium">Audio</span>
              <p className="text-xs text-gray-500">MP3, WAV, M4A</p>
            </div>
          </button>

          <button
            onClick={() => selectFile('.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx', 'documento')}
            disabled={isUploading}
            className="w-full flex items-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <span className="text-sm font-medium">Documento</span>
              <p className="text-xs text-gray-500">PDF, Word, Excel</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default SimpleDirectAttachment