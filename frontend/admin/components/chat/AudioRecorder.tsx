"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Mic, Square, Play, Pause, Send, Trash2 } from "lucide-react"
import { toast } from "react-hot-toast"

interface AudioRecorderProps {
  conversationId: string
  onSendSuccess?: () => void
  disabled?: boolean
}

const AudioRecorder = ({ conversationId, onSendSuccess, disabled }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [recordingFormat, setRecordingFormat] = useState<{mimeType: string, extension: string}>({
    mimeType: 'audio/webm;codecs=opus',
    extension: '.webm'
  })
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      // Intentar diferentes formatos en orden de preferencia para WhatsApp
      let mimeType = 'audio/mp4' // Cambiar default a AAC (M4A)
      let fileExtension = '.m4a'  // Priorizar M4A/AAC para mejor reproducción
      
      // Probar formatos más compatibles con WhatsApp (priorizar AAC/M4A)
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
        fileExtension = '.m4a'
      } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        mimeType = 'audio/mpeg'
        fileExtension = '.mp3'
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
        fileExtension = '.m4a'  // Convertir a M4A para compatibilidad
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
        fileExtension = '.m4a'  // Convertir a M4A para compatibilidad
      } else {
        mimeType = 'audio/webm;codecs=opus'
        fileExtension = '.m4a'
      }
      
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setRecordingFormat({ mimeType, extension: fileExtension })
        
        // Detener todas las pistas de audio
        stream.getTracks().forEach(track => track.stop())
        
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      // Iniciar timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
      toast.success('🎙️ Grabando audio...', { duration: 1000 })
      
    } catch (error) {
      console.error('❌ Error accediendo al micrófono:', error)
      toast.error('Error: No se pudo acceder al micrófono')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      toast.success('✅ Grabación finalizada')
    }
  }

  const playAudio = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      
      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
      }
      
      audio.play()
      setIsPlaying(true)
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  const deleteRecording = () => {
    setAudioBlob(null)
    setRecordingTime(0)
    setRecordingFormat({
      mimeType: 'audio/webm;codecs=opus',
      extension: '.webm'
    })
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlaying(false)
    toast.success('🗑️ Grabación eliminada')
  }

  const sendAudio = async () => {
    if (!audioBlob) return
    
    setIsSending(true)
    
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || 
                   localStorage.getItem('token') || sessionStorage.getItem('token')
      
      if (!token) {
        toast.error('No hay token de autenticación')
        return
      }

      // 1. Subir audio
      const formData = new FormData()
      
      // Generar nombre descriptivo para el archivo de audio
      const timestamp = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/[/\s:]/g, '_')
      
      const audioFile = new File([audioBlob], `Mensaje_de_voz_${timestamp}${recordingFormat.extension}`, { 
        type: recordingFormat.mimeType 
      })
      formData.append('file', audioFile)

      const uploadResponse = await fetch(`/api/v1/media/whatsapp/upload?conversation_id=${conversationId}&caption=`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Error subiendo audio')
      }

      const uploadResult = await uploadResponse.json()

            // 2. Enviar por WhatsApp COMO AUDIO (formato nativo)
      const sendData = {
        media_url: uploadResult.media_url,
        caption: '', // WhatsApp audio no soporta caption
        media_type: 'audio', // ✅ CAMBIO: Enviar como audio nativo
        filename: `Mensaje_de_voz_${new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(/[/\s:]/g, '_')}${recordingFormat.extension}`
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
        throw new Error('Error enviando audio por WhatsApp')
      }

      const sendResult = await sendResponse.json()

      toast.success('🎙️ Audio enviado exitosamente')
      
      // Limpiar grabación
      deleteRecording()
      
      if (onSendSuccess) {
        onSendSuccess()
      }

    } catch (error) {
      console.error('❌ Error enviando audio:', error)
      toast.error('Error enviando audio')
    } finally {
      setIsSending(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (disabled) return null

  return (
    <div className="flex items-center space-x-2">
      {/* Estado: No hay grabación */}
      {!audioBlob && !isRecording && (
        <Button
          variant="ghost"
          size="sm"
          onClick={startRecording}
          className="h-10 w-10 p-0 text-success hover:text-success hover:bg-success-soft rounded-full"
          title="Grabar y enviar una nota de voz al cliente por WhatsApp"
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}

      {/* Estado: Grabando */}
      {isRecording && (
        <div className="flex items-center space-x-2 bg-destructive-soft px-3 py-2 rounded-full border">
          <Button
            variant="ghost"
            size="sm"
            onClick={stopRecording}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive rounded-full"
          >
            <Square className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-destructive">
              {formatTime(recordingTime)}
            </span>
          </div>
        </div>
      )}

      {/* Estado: Grabación lista */}
      {audioBlob && !isRecording && (
        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full border">
          <Button
            variant="ghost"
            size="sm"
            onClick={isPlaying ? stopAudio : playAudio}
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 rounded-full"
            disabled={isSending}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <span className="text-sm text-gray-700">
            {formatTime(recordingTime)}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteRecording}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive rounded-full"
            disabled={isSending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={sendAudio}
            className="h-8 w-8 p-0 text-success hover:text-success rounded-full"
            disabled={isSending}
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default AudioRecorder