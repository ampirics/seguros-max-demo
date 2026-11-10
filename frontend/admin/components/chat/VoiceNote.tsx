'use client'

import { Mic } from 'lucide-react'
import type { ChatMessage } from '@/lib/api-types'

const duracion = (seg?: number | null) => (seg ? `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}` : '')

export function VoiceNote({ src, message }: { src?: string | null; message: ChatMessage }) {
  const estado = message.transcripcion_estado
  const texto = message.transcripcion || (estado === 'lista' && message.message !== '[audio]' ? message.message : null)
  return (
    <div className="w-64 max-w-full space-y-1.5">
      {src ? (
        <div className="flex items-center gap-2">
          <audio controls preload="metadata" src={src} className="h-9 min-w-0 flex-1" aria-label="Nota de voz del cliente" />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{duracion(message.duracion_seg)}</span>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1.5 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden /> Nota de voz{message.duracion_seg ? ` de ${duracion(message.duracion_seg)}` : ''} · audio no disponible
        </p>
      )}
      {estado === 'pendiente' ? (
        <p className="text-xs text-muted-foreground">Transcribiendo…</p>
      ) : estado === 'error' ? (
        <p className="text-xs text-destructive">No se pudo transcribir la nota de voz.</p>
      ) : texto ? (
        <p className="rounded-md bg-secondary px-2 py-1.5 text-[13px] leading-snug">
          <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Transcripción</span>
          {texto}
        </p>
      ) : null}
    </div>
  )
}
