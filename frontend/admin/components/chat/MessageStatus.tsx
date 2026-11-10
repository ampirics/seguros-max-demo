"use client"

import React from 'react'
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react'

interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  timestamp?: string
  whatsappMethod?: string
  sentViaWhatsApp?: boolean
  error?: string
  className?: string
  /** Sobre la burbuja azul del agente los grises no se leen: usar tonos claros. */
  onPrimary?: boolean
  /** Mostrar el check de entrega (solo tiene sentido en mensajes enviados por WhatsApp). */
  showDelivery?: boolean
}

// El backend guarda UTC sin zona ("2026-09-24T02:42:00"): sin la Z, el navegador
// lo interpretaba como hora local y la hora salía corrida 4 h.
export const parseMessageDate = (value?: string | Date | null): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  const d = new Date(hasZone ? value : `${value}Z`)
  return isNaN(d.getTime()) ? null : d
}

export const formatMessageTime = (value?: string | Date | null): string => {
  const d = parseMessageDate(value)
  if (!d) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Ayer ${time}`
  return `${d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} ${time}`
}

const MessageStatus = ({
  status,
  timestamp,
  error,
  className = '',
  onPrimary = false,
  showDelivery = true,
}: MessageStatusProps) => {
  const muted = onPrimary ? 'text-primary-foreground/75' : 'text-muted-foreground'

  const icon = () => {
    switch (status) {
      case 'sending':
        return <Clock className={`h-3 w-3 animate-pulse ${muted}`} aria-hidden />
      case 'sent':
        return <Check className={`h-3 w-3 ${muted}`} aria-hidden />
      case 'delivered':
        return <CheckCheck className={`h-3 w-3 ${muted}`} aria-hidden />
      case 'read':
        return <CheckCheck className={`h-3 w-3 ${onPrimary ? 'text-sky-200' : 'text-sky-600'}`} aria-hidden />
      case 'failed':
        return <AlertCircle className={`h-3 w-3 ${onPrimary ? 'text-red-200' : 'text-destructive'}`} aria-hidden />
      default:
        return null
    }
  }

  const label = {
    sending: 'Enviando…',
    sent: 'Enviado',
    delivered: 'Entregado',
    read: 'Leído',
    failed: 'No entregado',
  }[status]

  const full = parseMessageDate(timestamp)?.toLocaleString('es-DO') || ''

  return (
    <div className={`flex items-center justify-end gap-1 text-[11px] ${muted} ${className}`}>
      {status === 'failed' && showDelivery && (
        <span className={onPrimary ? 'text-red-100 font-medium' : 'text-destructive font-medium'}>
          No entregado{error ? `: ${error}` : ''}
        </span>
      )}
      {timestamp && <time dateTime={timestamp} title={full}>{formatMessageTime(timestamp)}</time>}
      {showDelivery && (
        <span className="inline-flex items-center" title={`${label}${error ? ` — ${error}` : ''}`} aria-label={label}>
          {icon()}
        </span>
      )}
    </div>
  )
}

export default MessageStatus
