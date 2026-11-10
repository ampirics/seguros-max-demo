'use client'

import { ArrowLeft, ArrowRightLeft, Hand, Loader2, Search, Undo2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChatTag } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { ConversationParty, telefonoVisible } from './ConversationParty'
import { TagBadge } from './TagBadge'
import { TagPicker } from './TagPicker'
import { ESTADO_ATENCION, etiquetaAtencion, estadoAtencion, iniciales, type BandejaConversacion } from './bandeja'
import { usePalabras, useVertical } from "@/lib/vertical"

type Agente = { id: string; name: string }

export function EncabezadoConversacion({
  conversacion,
  userId,
  agentes,
  onCargarAgentes,
  ocupado,
  onVolver,
  onTomar,
  onDevolver,
  onTransferir,
  onDesbloquear,
  buscando,
  onBuscar,
  etiquetasEmpresa,
  etiquetas,
  onEtiquetas,
  onEtiquetasEmpresa,
}: {
  conversacion: BandejaConversacion
  userId?: string
  agentes: Agente[]
  onCargarAgentes: () => void
  ocupado: boolean
  onVolver: () => void
  onTomar: () => void
  onDevolver: () => void
  onTransferir: (agente: Agente) => void
  onDesbloquear: () => void
  buscando: boolean
  onBuscar: () => void
  etiquetasEmpresa: ChatTag[]
  etiquetas: ChatTag[]
  onEtiquetas: (tags: ChatTag[]) => void
  onEtiquetasEmpresa: (tags: ChatTag[]) => void
}) {
  const palabras = usePalabras()
  const vertical = useVertical()
  const estado = estadoAtencion(conversacion)
  const otros = agentes.filter((a) => a.id !== conversacion.assigned_to_id)
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
      <Button variant="ghost" size="icon" onClick={onVolver} className="h-9 w-9 shrink-0 lg:hidden" aria-label="Volver a la lista">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground sm:flex" aria-hidden>
        {iniciales(conversacion.contact_name || conversacion.customer_name)}
      </span>
      <div className="min-w-[9rem] flex-1">
        <ConversationParty conversation={conversacion} size="header" />
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{telefonoVisible(conversacion)}</span>
          {etiquetas.map((tag) => <TagBadge key={tag.id} tag={tag} size="sm" />)}
          <TagPicker
            conversationId={conversacion.id}
            companyTags={etiquetasEmpresa}
            selectedTags={etiquetas}
            onTagsChange={onEtiquetas}
            onCompanyTagsChange={onEtiquetasEmpresa}
          />
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-control bg-secondary px-2.5 text-xs"
          title={estado === 'vendedor' ? `${palabras.Persona} atiende. La IA no responde.` : 'Quién atiende esta conversación'}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full', ESTADO_ATENCION[estado].punto)} aria-hidden />
          <span className="max-w-[9rem] truncate">
            {estado === 'vendedor' ? conversacion.assigned_to_name || palabras.Persona : etiquetaAtencion(estado, vertical)}
          </span>
        </span>
        {estado !== 'vendedor' && estado !== 'cerrada' && (
          <Button size="sm" className="h-8 gap-1.5" onClick={onTomar} disabled={ocupado} title="La IA deja de responder y la conversación queda a tu nombre">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Hand className="h-4 w-4" aria-hidden />} Tomar
          </Button>
        )}
        {estado === 'vendedor' && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onDevolver} disabled={ocupado} title="Devolver a la IA: vuelve a contestar sola">
            <Undo2 className="h-4 w-4" aria-hidden /> Devolver
          </Button>
        )}
        {estado === 'vendedor' && (
          <DropdownMenu onOpenChange={(open) => { if (open && agentes.length === 0) onCargarAgentes() }}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={ocupado}>
                <ArrowRightLeft className="h-4 w-4" aria-hidden /> Transferir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Transferir a</DropdownMenuLabel>
              {agentes.length === 0 ? (
                <DropdownMenuItem disabled>Cargando {palabras.personas}…</DropdownMenuItem>
              ) : otros.length === 0 ? (
                <DropdownMenuItem disabled>No hay más {palabras.personas}</DropdownMenuItem>
              ) : otros.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => onTransferir(a)}>{a.name}{a.id === userId ? ' (tú)' : ''}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {conversacion.status === 'blocked' && (
          <Button onClick={onDesbloquear} variant="outline" size="sm" className="h-8 gap-1.5" title="Desbloquear conversación">
            <Unlock className="h-4 w-4" /> Desbloquear
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onBuscar}
          className={cn('h-8 w-8', buscando && 'bg-secondary text-foreground')}
          title="Buscar un texto dentro de los mensajes de esta conversación"
          aria-label="Buscar en la conversación"
        >
          <Search className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
