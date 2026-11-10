"use client"

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Paperclip, Image, FileText, Music, Video } from "lucide-react"
import { toast } from "react-hot-toast"

interface SimpleAttachmentButtonProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

const SimpleAttachmentButton = ({ onFileSelect, disabled }: SimpleAttachmentButtonProps) => {
  const [showMenu, setShowMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        // Validar tamaño (16MB max)
        if (file.size > 16 * 1024 * 1024) {
          toast.error('El archivo es muy grande. Máximo 16MB.')
          return
        }
        onFileSelect(file)
        setShowMenu(false)
      }
      document.body.removeChild(input)
    }

    document.body.appendChild(input)
    input.click()
  }

  if (!showMenu) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setShowMenu(true)
        }}
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
        className="h-10 w-10 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
        type="button"
      >
        <Paperclip className="h-5 w-5" />
      </Button>

      {/* Menu flotante */}
      <div className="absolute bottom-12 left-0 bg-white border shadow-lg rounded-xl p-2 z-50 w-64">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleFileSelect('image')}
            className="flex flex-col items-center p-3 rounded-lg hover:bg-secondary transition-colors"
            type="button"
          >
            <div className="p-2 rounded-full bg-secondary text-muted-foreground">
              <Image className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1">Foto</span>
          </button>

          <button
            onClick={() => handleFileSelect('document')}
            className="flex flex-col items-center p-3 rounded-lg hover:bg-blue-100 transition-colors"
            type="button"
          >
            <div className="p-2 rounded-full bg-blue-100 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1">Documento</span>
          </button>

          <button
            onClick={() => handleFileSelect('audio')}
            className="flex flex-col items-center p-3 rounded-lg hover:bg-warning-soft transition-colors"
            type="button"
          >
            <div className="p-2 rounded-full bg-warning-soft text-warning">
              <Music className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1">Audio</span>
          </button>

          <button
            onClick={() => handleFileSelect('video')}
            className="flex flex-col items-center p-3 rounded-lg hover:bg-secondary transition-colors"
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

export default SimpleAttachmentButton