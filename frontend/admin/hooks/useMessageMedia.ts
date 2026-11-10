import { useMemo } from 'react'

interface MediaInfo {
  hasMedia: boolean
  mediaType?: string
  mediaUrl?: string
  filename?: string
  caption?: string
}

// Función utilitaria para detectar media (no es un hook)
export const detectMessageMedia = (message: any): MediaInfo => {
  if (!message?.metadata) {
    return { hasMedia: false }
  }

  const metadata = message.metadata

  const tipoOra = ['image', 'document', 'video'].includes(metadata.tipo) ? metadata.tipo : undefined

  // Verificar si tiene información de media
  if ((metadata.media_type || tipoOra) && metadata.media_url) {
    return {
      hasMedia: true,
      mediaType: metadata.media_type || tipoOra,
      mediaUrl: metadata.media_url,
      filename: metadata.filename || metadata.original_filename,
      caption: metadata.caption
    }
  }

  // Verificar URLs de imagen/video/audio en el mensaje
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|avi|mov|mp3|m4a|ogg|wav|pdf|doc|docx|txt))/gi
  const matches = message.message?.match(urlRegex)

  if (matches && matches.length > 0) {
    const url = matches[0]
    const extension = url.split('.').pop()?.toLowerCase()
    
    let mediaType = 'document'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      mediaType = 'image'
    } else if (['mp4', 'avi', 'mov'].includes(extension || '')) {
      mediaType = 'video'
    } else if (['mp3', 'm4a', 'ogg', 'wav'].includes(extension || '')) {
      mediaType = 'audio'
    }

    return {
      hasMedia: true,
      mediaType,
      mediaUrl: url,
      filename: url.split('/').pop()
    }
  }

  return { hasMedia: false }
}

// Hook que procesa TODOS los mensajes de una vez (cumple reglas de hooks)
export const useMessagesMedia = (messages: any[]): Map<string, MediaInfo> => {
  return useMemo(() => {
    const mediaMap = new Map<string, MediaInfo>()
    
    if (!Array.isArray(messages)) {
      return mediaMap
    }

    messages.forEach(message => {
      if (message?.id) {
        mediaMap.set(message.id, detectMessageMedia(message))
      }
    })

    return mediaMap
  }, [messages])
}

export default useMessagesMedia