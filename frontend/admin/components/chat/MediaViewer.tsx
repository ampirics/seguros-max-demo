"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Download, Play, Pause, FileText, Image, Video, Music, File, ExternalLink } from "lucide-react"
import { toast } from "react-hot-toast"

interface MediaViewerProps {
  mediaUrl: string
  mediaType: string
  filename?: string
  caption?: string
  messageId?: string
  sender?: string
}

const MediaViewer = ({ 
  mediaUrl, 
  mediaType, 
  filename, 
  caption, 
  messageId,
  sender 
}: MediaViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4" />
      case 'video':
        return <Video className="h-4 w-4" />
      case 'audio':
        return <Music className="h-4 w-4" />
      case 'document':
        return <FileText className="h-4 w-4" />
      default:
        return <File className="h-4 w-4" />
    }
  }

  const getFileExtension = (url: string) => {
    try {
      const urlPath = new URL(url).pathname
      return urlPath.split('.').pop()?.toLowerCase() || ''
    } catch {
      return filename?.split('.').pop()?.toLowerCase() || ''
    }
  }

  const downloadMedia = async () => {
    if (!mediaUrl) return

    setIsDownloading(true)
    try {

      // Usar link directo en lugar de fetch para evitar problemas CORS con redirects
      const link = document.createElement('a')
      link.href = mediaUrl
      link.download = filename || `media_${messageId || Date.now()}.${getFileExtension(mediaUrl)}`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`📥 Descargando: ${link.download}`)
      
    } catch (error) {
      console.error('❌ Error descargando archivo:', error)
      toast.error('Error al descargar el archivo')
    } finally {
      setIsDownloading(false)
    }
  }

  const toggleAudioPlayback = async () => {
    const audioElement = document.getElementById(`audio-${messageId}`) as HTMLAudioElement
    if (audioElement) {
      try {
        if (isPlaying) {
          audioElement.pause()
          setIsPlaying(false)
        } else {
          await audioElement.play()
          setIsPlaying(true)
        }
      } catch (error) {
        console.error('Error reproduciendo audio:', error)
        setIsPlaying(false)
      }
    }
  }

  const openInNewTab = () => {
    window.open(mediaUrl, '_blank')
  }

  const renderMediaPreview = () => {
    switch (mediaType) {
      case 'image':
        return (
          <div className="relative group">
            <img 
              src={mediaUrl} 
              alt={filename || 'Imagen'}
              className="max-w-xs max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={openInNewTab}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
              <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )

      case 'video':
        return (
          <video 
            controls 
            className="max-w-xs max-h-48 rounded-lg"
            preload="metadata"
          >
            <source src={mediaUrl} type="video/mp4" />
            Tu navegador no soporta la reproducción de video.
          </video>
        )

      case 'audio':
        return (
          <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg max-w-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAudioPlayback}
              className="h-10 w-10 p-0 rounded-full bg-success-soft hover:bg-green-200"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <p className="text-sm font-medium">🎵 Audio</p>
              <p className="text-xs text-gray-500">{filename || 'mensaje_de_voz.m4a'}</p>
            </div>
            <audio 
              id={`audio-${messageId}`}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              preload="metadata"
            >
              <source src={mediaUrl} type="audio/ogg; codecs=opus" />
              <source src={mediaUrl} type="audio/mpeg" />
              <source src={mediaUrl} type="audio/mp4" />
              Tu navegador no soporta la reproducción de audio.
            </audio>
          </div>
        )

      case 'document':
        return (
          <div className="flex items-center space-x-3 bg-blue-50 p-3 rounded-lg max-w-xs border border-blue-200">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              {getMediaIcon(mediaType)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">📄 Documento</p>
              <p className="text-xs text-gray-600">{filename || 'documento'}</p>
            </div>
          </div>
        )

      default:
        return (
          <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg max-w-xs">
            <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
              {getMediaIcon(mediaType)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">📎 Archivo</p>
              <p className="text-xs text-gray-500">{filename || 'archivo'}</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="space-y-2">
      {/* Preview del archivo */}
      {renderMediaPreview()}
      
      {/* Caption si existe */}
      {caption && (
        <p className="text-sm text-gray-700 italic">{caption}</p>
      )}
      
      {/* Botones de acción */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadMedia}
          disabled={isDownloading}
          className="text-xs"
        >
          {isDownloading ? (
            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1" />
          ) : (
            <Download className="h-3 w-3 mr-1" />
          )}
          {isDownloading ? 'Descargando...' : 'Descargar'}
        </Button>
        
        {mediaType !== 'audio' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openInNewTab}
            className="text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir
          </Button>
        )}
      </div>
    </div>
  )
}

export default MediaViewer