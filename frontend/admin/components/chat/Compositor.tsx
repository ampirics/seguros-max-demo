'use client'

import { useEffect, useLayoutEffect, type RefObject } from 'react'
import { Bot, Hand, Loader2, Send, StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import QuickReplies from './QuickReplies'
import SimpleDirectAttachment from './SimpleDirectAttachment'
import AudioRecorder from './AudioRecorder'
import type { EstadoAtencion } from './bandeja'
import { usePalabras } from "@/lib/vertical"

export type ModoCompositor = 'whatsapp' | 'note'

export interface VentanaWhatsApp {
  state: 'unknown' | 'open' | 'closed'
  label: string
  hoursLeft: number
}

const ALTO_MAXIMO = 160
const useAjuste = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function Compositor({
  conversationId,
  tieneTelefono,
  estado,
  texto,
  onTexto,
  modo,
  onModo,
  ocupado,
  respondiendoA,
  nombreCliente,
  onCancelarRespuesta,
  ventana,
  onEnviar,
  onTomar,
  tomando,
  inputRef,
}: {
  conversationId: string
  tieneTelefono: boolean
  estado: EstadoAtencion
  texto: string
  onTexto: (texto: string) => void
  modo: ModoCompositor
  onModo: (modo: ModoCompositor) => void
  ocupado: boolean
  respondiendoA: ChatMessage | null
  nombreCliente: string
  onCancelarRespuesta: () => void
  ventana: VentanaWhatsApp
  onEnviar: () => void
  onTomar: () => void
  tomando: boolean
  inputRef: RefObject<HTMLTextAreaElement>
}) {
  const palabras = usePalabras()
  const modoEfectivo: ModoCompositor = tieneTelefono ? modo : 'note'
  const sinTomar = modoEfectivo === 'whatsapp' && (estado === 'ia' || estado === 'esperando_vendedor')

  useAjuste(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, ALTO_MAXIMO)}px`
  }, [texto, sinTomar, inputRef])

  return (
    <div className="flex-shrink-0 border-t bg-card">
      {respondiendoA && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border-l-4 border-primary bg-secondary px-3 py-1.5 text-sm">
          <div className="min-w-0 flex-1 truncate">
            <span className="mr-1 font-medium text-primary">{respondiendoA.sender === 'admin' ? 'Tú' : nombreCliente || 'Cliente'}</span>
            <span className="text-muted-foreground">
              {respondiendoA.message.length > 60 ? respondiendoA.message.slice(0, 60) + '…' : respondiendoA.message}
            </span>
          </div>
          <button onClick={onCancelarRespuesta} className="rounded p-0.5 text-muted-foreground hover:text-foreground" title="Cancelar respuesta" aria-label="Cancelar respuesta">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <div title="Respuestas guardadas: elige una para ponerla en la caja de mensaje">
        <QuickReplies
          onSelectReply={(t) => {
            onTexto(t)
            setTimeout(() => inputRef.current?.focus(), 100)
          }}
          disabled={ocupado}
        />
      </div>

      <div className="px-3 pb-3 pt-1">
        <div className="mb-2 flex items-center gap-3">
          <div role="radiogroup" aria-label="Tipo de mensaje" className="inline-flex shrink-0 gap-0.5 rounded-control bg-secondary p-0.5">
            {([
              ['whatsapp', 'Responder', 'Se envía al WhatsApp del cliente'],
              ['note', 'Nota interna', 'Queda solo para el equipo; el cliente no la recibe'],
            ] as const).map(([valor, label, hint]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={modoEfectivo === valor}
                disabled={valor === 'whatsapp' && !tieneTelefono}
                onClick={() => { onModo(valor); setTimeout(() => inputRef.current?.focus(), 50) }}
                title={hint}
                className={cn(
                  'h-7 rounded-control px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  modoEfectivo === valor
                    ? valor === 'note' ? 'bg-warning-soft text-warning shadow-sm' : 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={cn('ml-auto truncate text-[11px]', tieneTelefono && ventana.state === 'open' && ventana.hoursLeft < 2 ? 'font-medium text-warning' : 'text-muted-foreground')}>
            {!tieneTelefono
              ? 'Sin número de WhatsApp: solo notas internas'
              : ventana.state === 'open' ? `Ventana de WhatsApp abierta · cierra en ${ventana.label}` : ''}
          </span>
        </div>
        {sinTomar ? (
          <div className="flex items-center gap-2 rounded-control bg-secondary px-3 py-2">
            <Bot className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              <p>
                {estado === 'ia'
                  ? 'La IA está respondiendo. Toma la conversación para escribirle al cliente.'
                  : `El cliente espera a ${palabras.unaPersona}. Toma la conversación para responderle.`}
              </p>
              {texto.trim() && <p className="mt-1 line-clamp-2 text-foreground" title={texto}>Borrador listo: {texto}</p>}
            </div>
            <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={onTomar} disabled={tomando}>
              <Hand className="h-4 w-4" aria-hidden /> Tomar
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            {tieneTelefono && (
              <span className="inline-flex" title="Enviar una imagen, documento o archivo al cliente por WhatsApp">
                <SimpleDirectAttachment conversationId={conversationId} disabled={ocupado} onSendSuccess={() => {}} />
              </span>
            )}
            {tieneTelefono && <AudioRecorder conversationId={conversationId} disabled={ocupado} onSendSuccess={() => {}} />}
            <textarea
              ref={inputRef}
              rows={1}
              value={texto}
              onChange={(e) => onTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                e.preventDefault()
                onEnviar()
              }}
              aria-label={modoEfectivo === 'note' ? 'Nota interna' : 'Mensaje para el cliente'}
              placeholder={modoEfectivo === 'note' ? 'Escribe una nota para el equipo' : 'Escribe un mensaje'}
              aria-busy={ocupado}
              className={cn(
                'min-h-10 flex-1 resize-none rounded-control border border-transparent px-3 py-2 text-base leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm md:leading-6',
                modoEfectivo === 'note' ? 'bg-warning-soft' : 'bg-secondary'
              )}
            />
            <Button
              size="icon"
              onClick={onEnviar}
              disabled={ocupado || !texto.trim()}
              className="h-10 w-10 shrink-0"
              aria-label={modoEfectivo === 'note' ? 'Guardar nota interna' : 'Enviar por WhatsApp'}
              title={modoEfectivo === 'note' ? 'Guardar nota interna (Enter)' : 'Enviar por WhatsApp (Enter)'}
            >
              {ocupado ? <Loader2 className="animate-spin" aria-hidden /> : modoEfectivo === 'note' ? <StickyNote aria-hidden /> : <Send aria-hidden />}
            </Button>
          </div>
        )}
        {tieneTelefono && ventana.state === 'closed' && (
          <div role="alert" className="mt-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-foreground">
            <strong>Ventana de 24 h cerrada.</strong> El cliente escribió por última vez {ventana.label}. El cliente recibirá un
            aviso de que {palabras.unaPersona} tiene novedades; cuando responda, verá tu mensaje.
          </div>
        )}
      </div>
    </div>
  )
}
