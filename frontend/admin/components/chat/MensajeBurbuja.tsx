'use client'

import { Bot, Check, ClipboardList, Pencil, Reply, RotateCcw, SmilePlus, StickyNote, Trash2, User, X } from 'lucide-react'
import type { ChatMessage, PiezaSugerida } from '@/lib/api-types'
import { detectMessageMedia } from '@/hooks/useMessageMedia'
import { cn } from '@/lib/utils'
import MediaViewer from './MediaViewer'
import MessageStatus from './MessageStatus'
import FormattedMessageText from './FormattedMessageText'
import { LlamadaCard } from './LlamadaCard'
import { VoiceNote } from './VoiceNote'
import { PiezaCards } from './PiezaCards'
import { IaDetalle } from './IaDetalle'
import { ETIQUETA_SISTEMA, estadoEntrega, getMessageKind, motivoFalla, parseUTCTimestamp } from './bandeja'
import { usePalabras } from "@/lib/vertical"

const REACCIONES = ['👍', '❤️', '😂', '😱', '🔥', '👏', '🙏', '💯', '🎉']

export function MensajeBurbuja({
  message,
  nombreCliente,
  resaltado,
  recienEnviado,
  eliminadoLocal,
  editando,
  contenidoEdicion,
  onContenidoEdicion,
  guardandoEdicion,
  onEditar,
  onCancelarEdicion,
  onGuardarEdicion,
  menuEliminar,
  onMenuEliminar,
  onEliminar,
  pickerReaccion,
  onPickerReaccion,
  reaccionando,
  onReaccion,
  onResponder,
  piezaSeleccionada,
  onPieza,
  reintentado,
  onReintentar,
  onDescartar,
  refFila,
}: {
  message: ChatMessage
  nombreCliente: string
  resaltado: boolean
  recienEnviado: boolean
  eliminadoLocal: boolean
  editando: boolean
  contenidoEdicion: string
  onContenidoEdicion: (texto: string) => void
  guardandoEdicion: boolean
  onEditar: () => void
  onCancelarEdicion: () => void
  onGuardarEdicion: () => void
  menuEliminar: boolean
  onMenuEliminar: () => void
  onEliminar: (scope: 'for_me' | 'for_all') => void
  pickerReaccion: boolean
  onPickerReaccion: () => void
  reaccionando: boolean
  onReaccion: (emoji: string) => void
  onResponder: () => void
  piezaSeleccionada?: string | number
  onPieza: (pieza: PiezaSugerida) => void
  reintentado: boolean
  onReintentar: () => void
  onDescartar: () => void
  refFila: (el: HTMLDivElement | null) => void
}) {
  const palabras = usePalabras()
  const meta: Record<string, any> = message.metadata || {}
  const temporal = !!meta.temporary
  const kind = getMessageKind(message)
  const saliente = kind !== 'client'
  const estado = estadoEntrega(message)
  const fallido = estado === 'failed' && (kind === 'agent' || kind === 'note')
  const fallaLocal = fallido && temporal
  const media = detectMessageMedia(message)
  const deAdmin = message.sender === 'admin'
  const editable = deAdmin && !temporal && Date.now() - parseUTCTimestamp(message.timestamp).getTime() < 15 * 60 * 1000
  const eliminado = message.is_deleted || eliminadoLocal

  if (kind === 'event') {
    return (
      <div ref={refFila} className="flex justify-center">
        <span className="rounded-md bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
          {String(message.message).replace(/^🔄\s*Estado del admin:\s*/, 'Bot: ')}
        </span>
      </div>
    )
  }

  const botonReaccion = (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); onPickerReaccion() }}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        title="Agregar reacción"
        aria-label="Agregar reacción"
        disabled={reaccionando}
      >
        <SmilePlus className="h-3.5 w-3.5" aria-hidden />
      </button>
      {pickerReaccion && (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-lg border bg-popover p-1 shadow-md" onClick={(e) => e.stopPropagation()}>
          {REACCIONES.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReaccion(emoji)}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary"
              title={`Reaccionar con ${emoji}`}
              disabled={reaccionando}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const acciones = !editando && !eliminado && !temporal && (
    <div className="mr-1 flex gap-0.5 self-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <button onClick={onResponder} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-success" title="Responder" aria-label="Responder a este mensaje">
        <Reply className="h-3.5 w-3.5" aria-hidden />
      </button>
      {botonReaccion}
      {deAdmin && editable && (
        <button onClick={onEditar} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600" title="Editar mensaje" aria-label="Editar mensaje">
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); onMenuEliminar() }}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-destructive"
          title="Eliminar mensaje"
          aria-label="Eliminar mensaje"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
        {menuEliminar && (
          <div className={cn('absolute bottom-full z-10 mb-1 min-w-max rounded border border-gray-200 bg-white text-sm shadow-lg', deAdmin ? 'right-0' : 'left-0')}>
            <button onClick={() => onEliminar('for_me')} className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50">
              Eliminar para mí
            </button>
            {deAdmin && (
              <button onClick={() => onEliminar('for_all')} className="block w-full px-4 py-2 text-left text-destructive hover:bg-destructive-soft">
                Eliminar del backoffice (el cliente lo conserva en WhatsApp)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const textoAparte = message.message
    && !message.message.includes('📎') && !message.message.includes('🎵') && !message.message.includes('📄')
    && !/^\[(image|document|video)\]\s*$/.test(message.message)
    && message.message.replace(/^\[(image|document|video)\]\s*/, '') !== media.caption

  return (
    <div ref={refFila} className={cn('group flex', saliente ? 'justify-end' : 'justify-start', resaltado && 'rounded-lg bg-warning-soft')}>
      {acciones}
      <div className="flex min-w-0 max-w-[85%] flex-col items-end md:max-w-[75%]">
        <div
          className={cn(
            'min-w-0 max-w-full break-words rounded-lg px-3 py-1.5 text-sm shadow-sm',
            saliente ? 'rounded-tr-sm' : 'self-start rounded-tl-sm',
            kind === 'agent' ? 'bg-primary text-primary-foreground'
              : kind === 'bot' ? 'bg-accent text-foreground'
              : kind === 'note' ? 'border border-dashed border-warning/40 bg-warning-soft text-foreground'
              : kind === 'system' ? 'border border-primary/20 bg-card text-foreground'
              : 'bg-card text-foreground dark:bg-secondary',
            temporal && !fallido && 'animate-pulse opacity-75',
            fallido && 'ring-2 ring-destructive/50',
            recienEnviado && 'ring-2 ring-primary/40',
          )}
        >
          {kind === 'note' && (
            <p className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-warning">
              <StickyNote className="h-3 w-3" aria-hidden /> Nota interna · el cliente no la ve
            </p>
          )}
          {kind === 'bot' && (
            <p className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <Bot className="h-3 w-3" aria-hidden /> IA
            </p>
          )}
          {kind === 'agent' && !temporal && (
            <p className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary-foreground/80">
              <User className="h-3 w-3" aria-hidden /> {meta.autor ?? palabras.Persona}
            </p>
          )}
          {kind === 'system' && message.message_type !== 'llamada' && (
            <p className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <ClipboardList className="h-3 w-3" aria-hidden /> {ETIQUETA_SISTEMA[message.message_type ?? ''] ?? 'Mensaje del sistema'}
              {meta.validada ? ' · validada' : ''}
            </p>
          )}
          {message.replied_to_message && (
            <div className="mb-1 rounded-md border-l-4 border-primary/60 bg-foreground/5 px-2 py-1 text-xs">
              <span className="mb-0.5 block font-semibold">
                {message.replied_to_message.sender === 'admin' ? 'Tú' : message.replied_to_message.sender === 'user' ? nombreCliente || 'Cliente' : message.replied_to_message.sender}
              </span>
              <span className={message.replied_to_message.is_deleted ? 'italic opacity-60' : ''}>
                {message.replied_to_message.is_deleted
                  ? 'Este mensaje fue eliminado'
                  : message.replied_to_message.message.length > 80
                    ? message.replied_to_message.message.slice(0, 80) + '…'
                    : message.replied_to_message.message}
              </span>
            </div>
          )}
          {editando ? (
            <div className="flex flex-col gap-1">
              <textarea
                className="w-full resize-none rounded border border-blue-300 bg-white p-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={contenidoEdicion}
                rows={3}
                autoFocus
                onChange={(e) => onContenidoEdicion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancelarEdicion()
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onGuardarEdicion()
                }}
              />
              <div className="flex justify-end gap-1">
                <button onClick={onCancelarEdicion} className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-300" disabled={guardandoEdicion}>
                  Cancelar
                </button>
                <button
                  onClick={onGuardarEdicion}
                  className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/85 disabled:opacity-50"
                  disabled={guardandoEdicion || !contenidoEdicion.trim()}
                >
                  {guardandoEdicion ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : eliminado ? (
            <p className="text-xs italic opacity-60">Este mensaje fue eliminado</p>
          ) : (
            <>
              {message.message_type === 'llamada' ? (
                <LlamadaCard message={message} />
              ) : message.message_type === 'audio' || (media.hasMedia && media.mediaType === 'audio') ? (
                <VoiceNote src={message.media_url ?? (media.mediaType === 'audio' ? media.mediaUrl : null)} message={message} />
              ) : media.hasMedia ? (
                <div className="space-y-2">
                  <MediaViewer
                    mediaUrl={media.mediaUrl!}
                    mediaType={media.mediaType!}
                    filename={media.filename}
                    caption={media.caption}
                    messageId={message.id}
                    sender={message.sender}
                  />
                  {textoAparte && <FormattedMessageText text={message.message} isAdmin={deAdmin} className="mt-2" />}
                </div>
              ) : (
                <FormattedMessageText text={message.message} isAdmin={deAdmin} />
              )}
              {message.piezas?.length ? (
                <PiezaCards piezas={message.piezas} seleccionada={piezaSeleccionada} onSelect={onPieza} />
              ) : null}
              {kind === 'bot' && message.ia_pasos?.length ? (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground" title="Lo que hizo la IA para responder">
                  <Check className="h-3 w-3 shrink-0 text-success" aria-hidden /> {message.ia_pasos.join(' · ')}
                </p>
              ) : null}
              {kind === 'bot' && meta.ia_detalle && typeof meta.ia_detalle === 'object' ? <IaDetalle detalle={meta.ia_detalle} /> : null}
              {typeof meta.reserva_id === 'string' && (
                <a href={`/admin/reservaciones/${meta.reserva_id}`}
                  className={cn('mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline', kind === 'agent' ? 'text-primary-foreground' : 'text-primary')}>
                  <ClipboardList className="h-3 w-3" aria-hidden /> Ver la reserva
                </a>
              )}
              {typeof meta.cotizacion === 'string' && (
                <a href={`/admin/cotizaciones/${meta.cotizacion}`}
                  className={cn('mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline', kind === 'agent' ? 'text-primary-foreground' : 'text-primary')}>
                  <ClipboardList className="h-3 w-3" aria-hidden /> Ver cotización {meta.cotizacion}
                </a>
              )}
              {meta.plantilla && (
                <p className={cn('mt-1 text-[11px]', kind === 'agent' ? 'text-primary-foreground/80' : 'text-muted-foreground')}
                  title="Fuera de la ventana de 24 h el cliente recibe una plantilla aprobada en lugar de este texto">
                  Enviado como aviso de WhatsApp ({typeof meta.plantilla === 'string' ? meta.plantilla : meta.plantilla?.nombre ?? 'plantilla'}). El cliente verá el texto cuando responda.
                </p>
              )}
            </>
          )}

          {!editando && !eliminado && Array.isArray(message.reactions) && message.reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {message.reactions.map((reaction) => {
                const quienes = (reaction.users || []).map((u: any) => u.user_name || 'Usuario').join(', ')
                return (
                  <button
                    key={reaction.emoji}
                    onClick={(e) => { e.stopPropagation(); onReaccion(reaction.emoji) }}
                    className={cn('rounded-full border px-1.5 py-0.5 text-xs transition-colors',
                      reaction.reacted_by_me ? 'border-primary/40 bg-accent' : 'border-border bg-background/60 hover:bg-secondary')}
                    title={quienes ? `${reaction.emoji} ${reaction.count} · ${quienes}` : `${reaction.emoji} ${reaction.count}`}
                    disabled={reaccionando}
                  >
                    {reaction.emoji} {reaction.count}
                  </button>
                )
              })}
            </div>
          )}

          {!editando && (
            <div className={cn('mt-0.5 flex items-center justify-end gap-1.5 text-[11px]', kind === 'agent' ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
              {message.is_edited && <span className="italic">editado</span>}
              {fallaLocal ? (
                <span className={cn('font-medium', kind === 'agent' ? 'text-red-100' : 'text-destructive')}>
                  {kind === 'note' ? 'No se guardó' : 'No entregado'}{motivoFalla(message) ? `: ${motivoFalla(message)}` : ''}
                </span>
              ) : (
                <MessageStatus
                  status={saliente ? estado : 'sent'}
                  timestamp={typeof message.timestamp === 'string' ? message.timestamp : message.timestamp.toISOString()}
                  error={saliente ? motivoFalla(message) : undefined}
                  onPrimary={kind === 'agent'}
                  showDelivery={kind === 'agent' || (kind === 'system' && message.message_type !== 'llamada') || (kind === 'bot' && estado === 'failed')}
                />
              )}
            </div>
          )}
        </div>
        {fallido && !reintentado && !eliminado && (
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={onReintentar}
              className="inline-flex h-7 items-center gap-1 rounded-control border border-destructive/40 bg-card px-2.5 text-xs font-medium text-destructive hover:bg-destructive-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reintentar
            </button>
            {fallaLocal && (
              <button
                type="button"
                onClick={onDescartar}
                className="inline-flex h-7 items-center gap-1 rounded-control px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Descartar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
