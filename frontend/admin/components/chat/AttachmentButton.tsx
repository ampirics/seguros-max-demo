"use client"

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Paperclip, Image, FileText, Music, Video, X } from "lucide-react"
import { toast } from "react-hot-toast"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface AttachmentButtonProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

const AttachmentButton = ({ onFileSelect, disabled }: AttachmentButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (type: string) => {
    // Prevenir que el foco vuelva al textbox
    if (document.activeElement && 'blur' in document.activeElement) {
      (document.activeElement as HTMLElement).blur()
    }
    
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
        setIsOpen(false)
      }
      document.body.removeChild(input)
    }

    document.body.appendChild(input)
    input.click()
  }

  const attachmentOptions = [
    {
      type: 'document',
      label: 'Documento',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 hover:bg-blue-200'
    },
    {
      type: 'image',
      label: 'Foto',
      icon: Image,
      color: 'text-muted-foreground',
      bgColor: 'bg-secondary hover:bg-secondary'
    },
    {
      type: 'audio',
      label: 'Audio',
      icon: Music,
      color: 'text-warning',
      bgColor: 'bg-warning-soft hover:bg-orange-200'
    },
    {
      type: 'video',
      label: 'Video',
      icon: Video,
      color: 'text-muted-foreground',
      bgColor: 'bg-secondary hover:bg-secondary'
    }
  ]

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          data-attachment-button="true"
          className="h-10 w-10 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Forzar blur del elemento activo antes de abrir
            if (document.activeElement && 'blur' in document.activeElement) {
              (document.activeElement as HTMLElement).blur()
            }
            setTimeout(() => setIsOpen(!isOpen), 10)
          }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          type="button"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start"
        className="w-64 p-2 bg-white border shadow-lg rounded-xl"
      >
        <div className="grid grid-cols-2 gap-2">
          {attachmentOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleFileSelect(option.type)
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                type="button"
                className={`
                  flex flex-col items-center p-3 rounded-lg transition-colors
                  ${option.bgColor} hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                `}
              >
                <div className={`p-2 rounded-full ${option.bgColor} ${option.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-gray-700 mt-1">
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default AttachmentButton