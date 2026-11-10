'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, BellRing, Bot, ChevronRight, Loader2, MessageCircle, Pin, Search, SlidersHorizontal, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChatTag } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { AssigneeBadge } from './AssigneeBadge'
import { ConversationParty, telefonoVisible } from './ConversationParty'
import { TagBadge } from './TagBadge'
import {
  ESTADO_ATENCION, etiquetaAtencion, RESULTADO, esperaDesde, esperaTexto, estadoAtencion, horaCorta, iniciales, motivoCorto, motivoDe,
  parseUTCTimestamp, vistaPrevia, type BandejaConversacion, type EstadoAtencion,
} from './bandeja'
import { usePalabras, useVertical } from "@/lib/vertical"

type Vista = 'all' | 'unread' | 'favorites' | 'ping' | 'agent_requested' | 'mine' | 'unassigned'
type Filtro = 'all' | EstadoAtencion | keyof typeof RESULTADO

interface Seccion {
  clave: string
  titulo: string
  items: BandejaConversacion[]
}

const ultimaActividad = (c: BandejaConversacion) => parseUTCTimestamp(c.last_message_timestamp || c.updated_at).getTime()
const masReciente = (a: BandejaConversacion, b: BandejaConversacion) => ultimaActividad(b) - ultimaActividad(a)
const masEspera = (a: BandejaConversacion, b: BandejaConversacion) =>
  parseUTCTimestamp(esperaDesde(a) || a.updated_at).getTime() - parseUTCTimestamp(esperaDesde(b) || b.updated_at).getTime()

export function ListaConversaciones({
  conversaciones,
  seleccionadaId,
  onSelect,
  userId,
  favoritos,
  destacados,
  onFavorito,
  onDestacado,
  etiquetas,
  error,
  onReintentar,
  hayMas,
  cargandoMas,
  onCargarMas,
}: {
  conversaciones: BandejaConversacion[]
  seleccionadaId: string | null
  onSelect: (c: BandejaConversacion) => void
  userId?: string
  favoritos: Record<string, boolean>
  destacados: Record<string, boolean>
  onFavorito: (id: string) => void
  onDestacado: (id: string) => void
  etiquetas: Record<string, ChatTag[]>
  error: string | null
  onReintentar: () => void
  hayMas: boolean
  cargandoMas: boolean
  onCargarMas: () => void
}) {
  const palabras = usePalabras()
  const vertical = useVertical()
  const searchParams = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<Vista>('all')
  const [filtro, setFiltro] = useState<Filtro>('all')
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // Enlaces del Dashboard: ?tag=unread|agent_requested|unassigned|mine y ?attention=<estado o resultado>.
    const tag = searchParams?.get('tag')
    if (tag && ['unread', 'agent_requested', 'unassigned', 'mine', 'favorites'].includes(tag)) setVista(tag as Vista)
    const legacy: Record<string, EstadoAtencion> = { pending: 'esperando_vendedor', active: 'vendedor', closed: 'cerrada' }
    const attention = searchParams?.get('attention') ?? ''
    const valor = legacy[attention] ?? attention
    if (valor in ESTADO_ATENCION || valor in RESULTADO) setFiltro(valor as Filtro)
  }, [searchParams])

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase()
    return conversaciones.filter((c) => {
      const estado = estadoAtencion(c)
      if (vista === 'unread' && !(c.unread_count > 0)) return false
      if (vista === 'favorites' && !favoritos[c.id]) return false
      if (vista === 'ping' && !destacados[c.id]) return false
      if (vista === 'agent_requested' && estado !== 'esperando_vendedor') return false
      if (vista === 'mine' && !(userId && c.assigned_to_id === userId)) return false
      if (vista === 'unassigned' && c.assigned_to_id) return false
      if (filtro !== 'all' && estado !== filtro && c.resultado !== filtro) return false
      if (!q) return true
      return [c.customer_name, c.customer_phone, c.last_message_text, c.lastMessage, c.last_inbound_text]
        .some((campo) => String(campo || '').toLowerCase().includes(q))
    })
  }, [conversaciones, busqueda, vista, filtro, favoritos, destacados, userId])

  const secciones = useMemo<Seccion[]>(() => {
    if (vista !== 'all') {
      const orden = vista === 'agent_requested' ? masEspera
        : (a: BandejaConversacion, b: BandejaConversacion) => (destacados[b.id] ? 1 : 0) - (destacados[a.id] ? 1 : 0) || masReciente(a, b)
      return [{ clave: 'f', titulo: '', items: [...filtradas].sort(orden) }]
    }
    const espera = filtradas.filter((c) => estadoAtencion(c) === 'esperando_vendedor').sort(masEspera)
    const resto = filtradas.filter((c) => estadoAtencion(c) !== 'esperando_vendedor')
    return [
      { clave: 'espera', titulo: 'En espera', items: espera },
      { clave: 'pin', titulo: 'Destacados', items: resto.filter((c) => destacados[c.id]).sort(masReciente) },
      { clave: 'unread', titulo: 'No leídos', items: resto.filter((c) => !destacados[c.id] && c.unread_count > 0).sort(masReciente) },
      { clave: 'read', titulo: 'Leídos', items: resto.filter((c) => !destacados[c.id] && !(c.unread_count > 0)).sort(masReciente) },
    ].filter((s) => s.items.length > 0)
  }, [filtradas, vista, destacados])

  // Con el cursor sobre la lista el orden se congela: una fila no se mueve bajo el mouse.
  const [congelado, setCongelado] = useState<{ clave: string; titulo: string; ids: string[] }[] | null>(null)
  const seccionesRef = useRef(secciones)
  seccionesRef.current = secciones
  const visibles = useMemo<Seccion[]>(() => {
    if (!congelado) return secciones
    const porId = new Map(filtradas.map((c) => [c.id, c]))
    const vistos = new Set<string>()
    const fijas = congelado.map((s) => ({
      clave: s.clave,
      titulo: s.titulo,
      items: s.ids.flatMap((id) => {
        const c = porId.get(id)
        if (!c) return []
        vistos.add(id)
        return [c]
      }),
    }))
    const nuevas = filtradas.filter((c) => !vistos.has(c.id))
    if (nuevas.length) {
      if (fijas.length) fijas[fijas.length - 1].items.push(...nuevas)
      else fijas.push({ clave: 'nuevas', titulo: '', items: nuevas })
    }
    return fijas.filter((s) => s.items.length > 0)
  }, [congelado, secciones, filtradas])

  const enEspera = conversaciones.filter((c) => estadoAtencion(c) === 'esperando_vendedor')
  const siguiente = [...enEspera].sort(masEspera)[0]
  const total = filtradas.length
  const hayFiltros = vista !== 'all' || filtro !== 'all' || !!busqueda

  const fila = (c: BandejaConversacion, prefijo: string) => {
    const seleccionada = seleccionadaId === c.id
    const noLeida = c.unread_count > 0
    const ultima = parseUTCTimestamp(c.last_message_timestamp || c.updated_at)
    const previa = vistaPrevia(c)
    const tags = etiquetas[c.id] ?? []
    const ambigua = c.contact_match === 'ambiguous'
    const fav = !!favoritos[c.id]
    const pin = !!destacados[c.id]
    const estado = estadoAtencion(c)
    const espera = estado === 'esperando_vendedor' ? esperaTexto(esperaDesde(c), ahora) : ''
    const conMeta = estado === 'ia' || estado === 'esperando_vendedor' || !!c.resultado || ambigua || tags.length > 0 || !!c.assigned_to_id
    return (
      <div
        key={`${prefijo}-${c.id}`}
        role="button"
        tabIndex={0}
        aria-current={seleccionada ? 'true' : undefined}
        onClick={() => onSelect(c)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c) }
        }}
        className={cn(
          'group mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          seleccionada ? 'bg-secondary' : 'hover:bg-secondary/60'
        )}
      >
        <span className="relative shrink-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground" aria-hidden>
            {iniciales(c.contact_name || c.customer_name)}
          </span>
          <span
            className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card', ESTADO_ATENCION[estado].punto)}
            title={etiquetaAtencion(estado, vertical)}
            aria-label={`Estado: ${etiquetaAtencion(estado, vertical)}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn('min-w-0 flex-1', noLeida && 'font-semibold')}>
              <ConversationParty conversation={c} showAmbiguous={false} />
            </div>
            <time className={cn('shrink-0 text-[11px]', noLeida ? 'font-medium text-primary' : 'text-muted-foreground')}
              dateTime={ultima.toISOString()} title={ultima.toLocaleString('es-DO')}>
              {horaCorta(ultima)}
            </time>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <p className={cn('flex-1 truncate text-[13px]', noLeida ? 'text-foreground' : 'text-muted-foreground')} title={previa}>
              {previa || telefonoVisible(c)}
            </p>
            {noLeida && (
              <span className="h-5 min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground"
                aria-label={`${c.unread_count} sin leer`}>
                {c.unread_count}
              </span>
            )}
          </div>
          {conMeta && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              {estado === 'esperando_vendedor' && (
                <span className="flex w-full min-w-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-4 text-warning" title={motivoDe(c)}>
                  <BellRing className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{motivoCorto(c)}</span>
                  {espera && <span className="shrink-0 font-normal">· espera {espera}</span>}
                </span>
              )}
              {estado === 'ia' && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <Bot className="h-3 w-3" aria-hidden /> IA atendiendo
                </span>
              )}
              {c.resultado && RESULTADO[c.resultado] && (
                <span className={cn('shrink-0 rounded px-1.5 text-[11px] font-medium leading-4',
                  c.resultado === 'sin_existencia' ? 'bg-destructive-soft text-destructive' : 'bg-success-soft text-success')}>
                  {RESULTADO[c.resultado]}
                </span>
              )}
              {ambigua && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-warning"
                  title="Este número aparece en más de un cliente: confirma con quién hablas antes de responder sobre pedidos o pagos">
                  <AlertTriangle className="h-3 w-3" aria-hidden /> Varios clientes
                </span>
              )}
              {tags.slice(0, 2).map((tag) => <TagBadge key={tag.id} tag={tag} size="sm" />)}
              {tags.length > 2 && <span className="text-[11px] text-muted-foreground">+{tags.length - 2}</span>}
              {c.assigned_to_id && <AssigneeBadge assignedToId={c.assigned_to_id} assignedToName={c.assigned_to_name} size="sm" />}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            aria-label={fav ? 'Quitar de favoritos' : 'Marcar como favorito'}
            title={fav ? 'Quitar de favoritos' : 'Marcar como favorito (solo para ti)'}
            className={cn('rounded p-1 outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
              !fav && 'md:opacity-0 md:group-hover:opacity-100')}
            onClick={(e) => { e.stopPropagation(); onFavorito(c.id) }}
          >
            <Star className={cn('h-4 w-4', fav ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
          </button>
          <button
            type="button"
            aria-label={pin ? 'Quitar destacado' : 'Destacar arriba de la lista'}
            title={pin ? 'Quitar destacado' : 'Destacar: fija la conversación arriba (solo para ti)'}
            className={cn('rounded p-1 outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
              !pin && 'md:opacity-0 md:group-hover:opacity-100')}
            onClick={(e) => { e.stopPropagation(); onDestacado(c.id) }}
          >
            <Pin className={cn('h-4 w-4', pin ? 'fill-primary text-primary' : 'text-muted-foreground')} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="space-y-3 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            Conversaciones <span className="text-sm font-normal text-muted-foreground">{total}</span>
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Más filtros" title="Más filtros">
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                {(['unassigned', 'favorites', 'ping'].includes(vista) || filtro !== 'all') && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Mostrar</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={vista} onValueChange={(v) => setVista(v as Vista)}>
                <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unassigned">Sin asignar</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="favorites">Favoritos (solo tú)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ping">Destacados (solo tú)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Estado</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                <DropdownMenuRadioItem value="all">Cualquier estado</DropdownMenuRadioItem>
                {Object.entries(ESTADO_ATENCION).map(([valor, { label }]) => (
                  <DropdownMenuRadioItem key={valor} value={valor}>{label}</DropdownMenuRadioItem>
                ))}
                {Object.entries(RESULTADO).map(([valor, label]) => (
                  <DropdownMenuRadioItem key={valor} value={valor}>{label}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar por nombre, número o mensaje"
            aria-label="Buscar conversaciones"
            title="Filtra la lista por nombre del cliente, número de teléfono o texto de los mensajes"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-9 w-full rounded-control border-transparent bg-secondary pl-9"
          />
        </div>
        <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Vistas de conversaciones">
          {([
            ['all', 'Todos', null, 'Todas las conversaciones de la empresa'],
            ['unread', 'No leídos', conversaciones.filter((c) => c.unread_count > 0).length, 'Con mensajes que aún no has leído'],
            ['agent_requested', 'En espera', enEspera.length, `Clientes que esperan a ${palabras.unaPersona}, el que más lleva primero`],
            ['mine', 'Mías', null, 'Asignadas a ti'],
            ...(vista === 'unassigned' ? [['unassigned', 'Sin asignar', null, 'Nadie las ha tomado']] : []),
            ...(vista === 'favorites' ? [['favorites', 'Favoritos', null, 'Marcadas con estrella (solo las ves tú)']] : []),
            ...(vista === 'ping' ? [['ping', 'Destacados', null, 'Fijadas con el pin (solo las ves tú)']] : []),
          ] as [Vista, string, number | null, string][]).map(([valor, label, cuenta, hint]) => {
            const activa = vista === valor
            const urgente = valor === 'agent_requested' && (cuenta ?? 0) > 0
            return (
              <button
                key={valor}
                role="tab"
                aria-selected={activa}
                onClick={() => setVista(valor)}
                title={hint}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control px-3 text-xs font-medium transition-colors',
                  activa ? 'bg-accent text-accent-foreground'
                    : urgente ? 'bg-warning-soft text-warning hover:bg-warning-soft/70'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
                {typeof cuenta === 'number' && cuenta > 0 && (
                  <span className={cn('h-4 min-w-4 rounded-full px-1 text-[10px] leading-4', urgente && !activa ? 'bg-warning text-white' : 'bg-card/70')}>{cuenta}</span>
                )}
              </button>
            )
          })}
        </div>
        {hayFiltros && (
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => { setVista('all'); setFiltro('all'); setBusqueda('') }}>
            Limpiar filtros
          </button>
        )}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto pb-2 [scrollbar-width:thin]"
        onMouseEnter={() => setCongelado(seccionesRef.current.map((s) => ({ clave: s.clave, titulo: s.titulo, ids: s.items.map((c) => c.id) })))}
        onMouseLeave={() => setCongelado(null)}
      >
        {error ? (
          <div className="space-y-3 px-4 py-8 text-center" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={onReintentar}>Reintentar</Button>
          </div>
        ) : total === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {conversaciones.length === 0 ? 'No hay conversaciones todavía' : 'Ninguna conversación coincide con los filtros'}
            </p>
          </div>
        ) : (
          <div className={cn(vista === 'all' ? 'space-y-3' : 'pt-1')}>
            {visibles.map((s) => (
              <div key={s.clave}>
                {s.titulo && (
                  <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-1">
                    <p className={cn('text-xs font-medium', s.clave === 'espera' ? 'text-warning' : 'text-muted-foreground')}>
                      {s.titulo} · {s.items.length}
                    </p>
                    {s.clave === 'espera' && siguiente && (
                      <button
                        type="button"
                        onClick={() => onSelect(siguiente)}
                        className="inline-flex items-center gap-0.5 rounded-control px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Abre la conversación que más lleva esperando"
                      >
                        Siguiente en espera <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-0.5">{s.items.map((c) => fila(c, s.clave))}</div>
              </div>
            ))}
          </div>
        )}
        {hayMas && !error && (
          <div className="flex justify-center py-3">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCargarMas} disabled={cargandoMas}>
              {cargandoMas ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {cargandoMas ? 'Cargando…' : 'Cargar conversaciones anteriores'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
