"use client"

import { urlTiempoReal, wsAuthProtocols } from "@/lib/ws-auth"
import { useEffect, useState, useRef, useMemo } from "react"
import { toast } from "react-hot-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { useAgentNotifications } from "@/contexts/agent-notifications-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { apiClient } from "@/lib/api-client"
import { ArrowDown, ArrowRightLeft, ChevronDown, ChevronUp, ClipboardList, Loader2, MessageCircle, Phone, User, X } from "lucide-react"
import { useGlobalSoftphone } from "@/contexts/softphone-context"
import { SoftphonePanel } from "@/components/admin/pbx/softphone-panel"
import { IncomingCallCard } from "@/components/admin/pbx/incoming-call-card"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import type { ChatMessage, ChatMessagesResponse, ChatTag, PiezaSugerida } from "@/lib/api-types"
import CustomerPanel from '@/components/admin/customer-panel'
import { conversacionesApi } from '@/lib/api/conversaciones'
import { IaPensando } from '@/components/chat/IaPensando'
import { CasoPanel } from '@/components/chat/CasoPanel'
import { CasoRestaurante } from '@/components/restaurante/chat/CasoRestaurante'
import { CasoSeguros } from '@/components/seguros/chat/CasoSeguros'
import { useVertical } from '@/lib/vertical'
import { ListaConversaciones } from '@/components/chat/ListaConversaciones'
import { MensajeBurbuja } from '@/components/chat/MensajeBurbuja'
import { Compositor, type ModoCompositor } from '@/components/chat/Compositor'
import { EncabezadoConversacion } from '@/components/chat/EncabezadoConversacion'
import { TarjetaBrief, briefDe } from '@/components/chat/TarjetaBrief'
import {
  estadoAtencion, getMessageKind, normalizarMensaje, parseUTCTimestamp, type BandejaConversacion, type EstadoAtencion,
} from '@/components/chat/bandeja'

type ChatConversation = BandejaConversacion

const CONV_PAGE = 100
const PAGE_SIZE = 30

type RightPanelId = 'caso' | 'info' | 'phone'

const RIGHT_PANELS: Array<{ id: RightPanelId; label: string; icon: typeof User }> = [
  { id: 'caso', label: 'Caso', icon: ClipboardList },
  { id: 'info', label: 'Cliente', icon: User },
  { id: 'phone', label: 'Teléfono', icon: Phone },
]

interface Borrador {
  texto: string
  modo: ModoCompositor
}
const SIN_BORRADOR: Borrador = { texto: '', modo: 'whatsapp' }

const nuevoTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

export default function AdminChatPage() {
  const { user, isLoading } = useAdmin()
  const { markConversationHandled, agentRequests, subscribeToRawMessages } = useAgentNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()
  const vertical = useVertical()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [convHasMore, setConvHasMore] = useState(false)
  const [loadingMoreConvs, setLoadingMoreConvs] = useState(false)
  // Los manejadores del WebSocket se registran una sola vez: leen la conversación abierta desde esta ref.
  const selectedConvRef = useRef<ChatConversation | null>(null)
  useEffect(() => { selectedConvRef.current = selectedConversation }, [selectedConversation])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  // Borrador y modo (responder o nota) por conversación: lo escrito en una no aparece en otra.
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({})
  const borradoresRef = useRef(borradores)
  borradoresRef.current = borradores
  const setBorrador = (convId: string, cambio: Partial<Borrador>) =>
    setBorradores((b) => ({ ...b, [convId]: { ...(b[convId] ?? SIN_BORRADOR), ...cambio } }))
  const borrador = (selectedConversation && borradores[selectedConversation.id]) || SIN_BORRADOR
  const [loading, setLoading] = useState(true)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [lastSentMessageId, setLastSentMessageId] = useState<string | null>(null)
  const [reintentados, setReintentados] = useState<Set<string>>(new Set())
  const [favState, setFavState] = useState<{[id:string]: boolean}>({});
  const [pingState, setPingState] = useState<{[id:string]: boolean}>({});
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  // Panel lateral derecho abierto desde la franja de íconos; null = cerrado (más ancho para la conversación)
  const [rightPanel, setRightPanel] = useState<RightPanelId | null>('caso')
  // Pieza que el vendedor tocó en el chat; sin selección se muestra la última que sugirió la IA.
  const [piezaSel, setPiezaSel] = useState<PiezaSugerida | null>(null)
  const [atencionBusy, setAtencionBusy] = useState(false)
  const [agentes, setAgentes] = useState<{ id: string; name: string }[]>([])
  const agentesRef = useRef<{ id: string; name: string }[]>([])
  useEffect(() => { agentesRef.current = agentes }, [agentes])
  const [transferirA, setTransferirA] = useState<{ id: string; name: string } | null>(null)
  const [notaTransferencia, setNotaTransferencia] = useState('')
  const aplicarAtencion = (convId: string, estado: EstadoAtencion, asignado: string | null, nombre?: string | null) => {
    const resolver = (c: ChatConversation) => !asignado ? null
      : nombre ?? agentesRef.current.find((a) => a.id === asignado)?.name ?? (c.assigned_to_id === asignado ? c.assigned_to_name : null) ?? 'Vendedor'
    const patch = (c: ChatConversation): ChatConversation => ({
      ...c, estado_atencion: estado, assigned_to_id: asignado, assigned_to_name: resolver(c),
      agent_requested: estado === 'esperando_vendedor', ia_pasos: [],
    })
    setConversations((prev) => prev.map((c) => (c.id === convId ? patch(c) : c)))
    setSelectedConversation((prev) => (prev?.id === convId ? patch(prev) : prev))
  }
  useEffect(() => { setPiezaSel(null) }, [selectedConversation?.id])
  // Por debajo de 1024 px: un panel a la vez (lista o conversación) y el panel lateral como hoja superpuesta.
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)')
    const apply = () => setIsNarrow(mql.matches)
    apply()
    if (mql.matches) setRightPanel(null)
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])
  const softphone = useGlobalSoftphone()
  // Tras enviar, el foco vuelve a la caja para seguir escribiendo sin hacer clic.
  const wasSendingRef = useRef(false)
  useEffect(() => {
    const sending = sendingMessage || sendingWhatsApp
    if (wasSendingRef.current && !sending) messageInputRef.current?.focus()
    wasSendingRef.current = sending
  }, [sendingMessage, sendingWhatsApp])
  const [companyTags, setCompanyTags] = useState<ChatTag[]>([])
  const [conversationTagsMap, setConversationTagsMap] = useState<Record<string, ChatTag[]>>({})
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; scope: 'for_me' | 'for_all' } | null>(null)
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set())
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null)
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null)
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<{ name: string; conversationId: string }[]>([])
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [msgSearchQuery, setMsgSearchQuery] = useState('')
  const [msgSearchOpen, setMsgSearchOpen] = useState(false)
  const [msgSearchIdx, setMsgSearchIdx] = useState(0)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const ws = useRef<WebSocket | null>(null);
  // Tiempo real de la conversación abierta: si el socket cae se reintenta con espera creciente y,
  // mientras tanto, se consulta cada 15 s (ver efecto de respaldo).
  const [rtOnline, setRtOnline] = useState(true);
  const [wsRetry, setWsRetry] = useState(0);
  const wsFailuresRef = useRef(0);
  // Evita el envío doble (dos Enter seguidos): el estado de React llega tarde.
  const sendingRef = useRef(false);
  // Si el vendedor está leyendo más arriba, un mensaje nuevo no lo baja: se avisa con un botón.
  const pegadoRef = useRef(true)
  const [pegado, setPegado] = useState(true)
  const [nuevos, setNuevos] = useState(0)

  const createWsUrl = (path: string) => {
    if (typeof window === 'undefined') return '';
    const token = localStorage.getItem('auth_token');
    if (!token) return '';
    // El token va en el subprotocolo (ver lib/ws-auth), no en la URL.
    return urlTiempoReal(path);
  }

  const upsertConversation = (conversation: ChatConversation) => {
    const convNorm: ChatConversation = {
      id: conversation.id,
      customer_name: (conversation as any).customer_name || (conversation as any).customerName || '',
      channel: (conversation as any).channel ?? null,
      contact_name: (conversation as any).contact_name ?? null,
      customer_display_name: (conversation as any).customer_display_name ?? null,
      contact_match: (conversation as any).contact_match ?? null,
      customer_phone: (conversation as any).customer_phone || (conversation as any).customerPhone || '',
      status: conversation.status || (conversation as any).state || 'pending',
      conversation_status: (conversation as any).conversation_status || 'open',
      resolved_at: (conversation as any).resolved_at ?? null,
      assigned_to_id: (conversation as any).assigned_to_id ?? null,
      assigned_to_name: (conversation as any).assigned_to_name ?? null,
      assigned_at: (conversation as any).assigned_at ?? null,
      unread_count: (conversation as any).unread_count ?? (conversation as any).unreadCount ?? 0,
      created_at: (conversation as any).created_at || (conversation as any).createdAt || new Date().toISOString(),
      updated_at: (conversation as any).updated_at || (conversation as any).updatedAt || new Date().toISOString(),
    }
    for (const campo of ['estado_atencion', 'etapa', 'codigo_solicitud', 'vehiculo_id', 'last_inbound_at', 'last_inbound_text', 'resultado', 'vehiculo', 'ia_pasos', 'cotizacion_codigo', 'cliente_id', 'cliente_telefono', 'sin_telefono', 'motivo_pase', 'motivo_pase_texto', 'esperando_desde', 'pase_vencido_at', 'brief_pase'] as const) {
      const valor = (conversation as any)[campo]
      if (valor !== undefined) (convNorm as any)[campo] = valor
      else delete (convNorm as any)[campo]
    }

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === convNorm.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...convNorm };
        return copy;
      }
      return [convNorm, ...prev];
    });
    if (selectedConvRef.current?.id === conversation.id) {
      setSelectedConversation(prev => prev ? { ...prev, ...conversation } : prev)
    }
  }

  const appendMessageIfNotExists = (entrante: ChatMessage) => {
    const message = normalizarMensaje(entrante)
    // El backend emite `conversation_id` por WebSocket y otras partes `conversationId`: se aceptan los dos.
    const msgConversationId = (message as any).conversationId ?? (message as any).conversation_id
    if (msgConversationId !== selectedConvRef.current?.id) return
    setMessages(prev => {
      // El temporal se reemplaza por tempId o, si no viene, por el mismo texto del mismo remitente.
      const tempMsgIndex = prev.findIndex(m =>
        (message.metadata?.tempId && (m as any).tempId === message.metadata.tempId)
        || (m.metadata?.temporary && m.message === message.message && m.sender === message.sender))
      if (tempMsgIndex >= 0) {
        const newMessages = [...prev];
        newMessages[tempMsgIndex] = message;
        return newMessages;
      }
      if (prev.find(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }

  useEffect(() => {
    if (!isLoading && !user) router.push("/admin/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) {
      loadConversations()
      apiClient.getConversationAgents().then(setAgentes).catch(() => {})
    }
  }, [user])

  // /admin/chat?conversation=<id> (p. ej. desde el detalle de una orden): abrirla en cuanto la lista esté cargada.
  const openedFromUrlRef = useRef(false)
  useEffect(() => {
    const wanted = searchParams?.get('conversation') ?? searchParams?.get('conversacion')
    if (!wanted || openedFromUrlRef.current || conversations.length === 0) return
    const conv = conversations.find(c => c.id === wanted)
    if (conv) {
      openedFromUrlRef.current = true
      selectConversation(conv)
    }
  }, [searchParams, conversations])

  const loadConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      // Endpoint liviano: metadata + último mensaje; los mensajes se traen a demanda.
      const data = await apiClient.getConversationsLite({ skip: 0, limit: CONV_PAGE })
      setConvHasMore(data.length === CONV_PAGE)
      const requestedConversationIds = new Set(agentRequests.map((req) => req.id))
      const merged = data.map((conv: any) => {
        const mapped: any = {
          ...conv,
          lastMessage: conv.last_message_text || "",
          last_message_timestamp: conv.last_message_timestamp || null,
        }
        if (requestedConversationIds.has(conv.id)) mapped.agent_requested = true
        return mapped as ChatConversation
      })
      // En las recargas silenciosas se conservan las páginas extra ya cargadas.
      setConversations(prev => {
        if (!silent || prev.length <= merged.length) return merged
        const ids = new Set(merged.map((c: any) => c.id))
        return [...merged, ...prev.filter(c => !ids.has(c.id))]
      })
      const favMap: {[id:string]: boolean} = {}
      const pinMap: {[id:string]: boolean} = {}
      for (const conv of merged) {
        if (conv.is_favorite) favMap[conv.id] = true
        if (conv.is_pinned) pinMap[conv.id] = true
      }
      setFavState(favMap)
      setPingState(pinMap)
      apiClient.listTags().then((tags) => setCompanyTags(tags)).catch(() => setCompanyTags([]))
      setLoadError(null)
    } catch (error) {
      console.error('Error cargando conversaciones:', error)
      if (!silent) setLoadError('No se pudieron cargar las conversaciones.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadMoreConversations = async () => {
    if (loadingMoreConvs) return
    setLoadingMoreConvs(true)
    try {
      const data = await apiClient.getConversationsLite({ skip: conversations.length, limit: CONV_PAGE })
      setConvHasMore(data.length === CONV_PAGE)
      setConversations(prev => {
        const ids = new Set(prev.map(c => c.id))
        const extra = data
          .filter((c: any) => !ids.has(c.id))
          .map((c: any) => ({ ...c, lastMessage: c.last_message_text || '', last_message_timestamp: c.last_message_timestamp || null }))
        return [...prev, ...extra]
      })
    } catch (error) {
      console.error('Error cargando más conversaciones:', error)
    } finally {
      setLoadingMoreConvs(false)
    }
  }

  // Trae la última página y la fusiona sin perder el historial ya cargado arriba.
  const mergeLatestMessages = async (conversationId: string) => {
    try {
      const res: ChatMessagesResponse = await apiClient.getMessages(conversationId, { skip: 0, limit: PAGE_SIZE })
      const latest: any[] = (Array.isArray(res) ? res : (res && Array.isArray((res as any).data) ? (res as any).data : [])).map(normalizarMensaje)
      if (selectedConvRef.current?.id !== conversationId) return
      setMessages(prev => {
        const byId = new Map(prev.map(m => [m.id, m]))
        let changed = false
        for (const m of latest) {
          const old = byId.get(m.id)
          if (!old || JSON.stringify(old) !== JSON.stringify(m)) { byId.set(m.id, m); changed = true }
        }
        if (!changed) return prev
        const merged = [...byId.values()].filter(m => !(m.metadata?.temporary && !m.metadata?.envio_fallido && latest.some(l => l.message === m.message && l.sender === m.sender)))
        return merged.sort((a, b) => parseUTCTimestamp(a.timestamp).getTime() - parseUTCTimestamp(b.timestamp).getTime())
      })
    } catch (error) {
      console.error('Error actualizando mensajes:', error)
    }
  }

  useEffect(() => {
    if (!agentRequests.length) return
    const requestMap = new Map(agentRequests.map((req) => [req.id, req]))
    setConversations((prev) => prev.map((conv) => {
      const req = requestMap.get(conv.id)
      if (!req) return conv
      return { ...conv, agent_requested: true, agent_requested_at: conv.agent_requested_at || req.agent_requested_at }
    }))
    setSelectedConversation((prev) => {
      if (!prev) return prev
      const req = requestMap.get(prev.id)
      if (!req) return prev
      return { ...prev, agent_requested: true, agent_requested_at: prev.agent_requested_at || req.agent_requested_at }
    })
  }, [agentRequests])

  const loadMessages = async (conversationId: string, pageNum = 1, append = false) => {
    try {
      const res: ChatMessagesResponse = await apiClient.getMessages(conversationId, { skip: (pageNum-1)*PAGE_SIZE, limit: PAGE_SIZE })
      let mensajes: any[] = [];
      if (Array.isArray(res)) {
        mensajes = res;
      } else if (res && Array.isArray(res.data)) {
        mensajes = res.data;
      } else {
        console.error('La respuesta de la API no tiene el formato esperado:', res)
        setMessages([])
        setHasMore(false)
        return;
      }
      // El backend devuelve los más recientes primero; se muestran de más viejo a más nuevo.
      // Si el vendedor cambió de conversación mientras cargaba, se descarta.
      if (selectedConvRef.current && selectedConvRef.current.id !== conversationId) return;
      const mensajesOrdenados = mensajes.map(normalizarMensaje).reverse();
      if (append) setMessages(prev => [...mensajesOrdenados, ...prev])
      else setMessages(mensajesOrdenados)
      setHasMore(mensajes.length === PAGE_SIZE)
      setPage(pageNum)
      await apiClient.markConversationAsRead(conversationId)
      setConversations(prev => prev.map(conv => conv.id === conversationId ? { ...conv, unread_count: 0 } : conv))
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    }
  }

  const refreshMessages = async (conversationId: string) => {
    try {
      const res: ChatMessagesResponse = await apiClient.getMessages(conversationId, { skip: 0, limit: PAGE_SIZE })
      let mensajes: any[] = [];
      if (Array.isArray(res)) mensajes = res;
      else if (res && Array.isArray(res.data)) mensajes = res.data;
      const mensajesOrdenados = mensajes.map(normalizarMensaje).reverse();
      setMessages(prev => JSON.stringify(prev) === JSON.stringify(mensajesOrdenados) ? prev : mensajesOrdenados)
    } catch (error) {
      console.error('Error refrescando mensajes:', error)
    }
  }

  const bajar = (suave = true) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' })
    setNuevos(0)
  }

  const alScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (cerca !== pegadoRef.current) {
      pegadoRef.current = cerca
      setPegado(cerca)
    }
    if (cerca) setNuevos(0)
  }

  // Un envío que no salió se queda en el hilo como fallido, con Reintentar.
  // Si el vendedor ya cambió de conversación, el texto vuelve al borrador de la conversación de origen.
  const marcarFallido = (tempId: string, convId: string, texto: string, motivo: string) => {
    if (selectedConvRef.current?.id === convId) {
      setMessages(prev => prev.map(m => m.id === tempId
        ? { ...m, metadata: { ...(m.metadata || {}), sending: false, envio_fallido: true, error: motivo } }
        : m))
    } else if (!borradoresRef.current[convId]?.texto) {
      setBorrador(convId, { texto })
    }
  }

  const enviarNota = async (texto: string, conv: ChatConversation, replyTo: string | null, reemplaza?: string) => {
    if (sendingRef.current) return
    sendingRef.current = true
    setSendingMessage(true)
    const tempId = nuevoTempId()
    const temp: ChatMessage & { tempId?: string } = {
      id: tempId, tempId, conversationId: conv.id, sender: 'admin', message: texto, timestamp: new Date(), read: false,
      metadata: { temporary: true, sending: true, nota_interna: true, tempId, reply_to_id: replyTo } as any,
    }
    setMessages(prev => [...prev.filter(m => m.id !== reemplaza), temp])
    try {
      // Una nota interna no atiende al cliente: la alerta de pase se mantiene hasta que se le responda por WhatsApp.
      const sent = await apiClient.sendMessage(conv.id, { sender: 'admin', message: texto, is_read: false, ...(replyTo ? { reply_to_id: replyTo } : {}) })
      if (sent?.id) {
        appendMessageIfNotExists({ ...sent, conversationId: conv.id, metadata: { ...(sent.metadata || {}), tempId } } as ChatMessage)
        setLastSentMessageId(sent.id)
        setTimeout(() => setLastSentMessageId(null), 2000)
      }
    } catch (error) {
      console.error('Error guardando la nota:', error)
      marcarFallido(tempId, conv.id, texto, 'sin conexión con el servidor')
      toast.error('No se pudo guardar la nota. Toca Reintentar.')
    } finally {
      sendingRef.current = false
      setSendingMessage(false)
    }
  }

  const enviarWhatsApp = async (texto: string, conv: ChatConversation, replyTo: string | null, reemplaza?: string) => {
    if (sendingRef.current) return
    sendingRef.current = true
    setSendingWhatsApp(true)
    const tempId = nuevoTempId()
    const temp: ChatMessage & { tempId?: string } = {
      id: tempId, tempId, conversationId: conv.id, sender: 'admin', message: texto, timestamp: new Date(), read: false,
      metadata: { sent_via_whatsapp: true, sending: true, temporary: true, tempId, reply_to_id: replyTo } as any,
    }
    setMessages(prev => [...prev.filter(m => m.id !== reemplaza), temp])
    try {
      const r = await apiClient.request<any>(`/chat/conversations/${conv.id}/send-whatsapp-integration`, {
        method: 'POST',
        body: JSON.stringify({ message: texto, tempId, ...(replyTo ? { reply_to_id: replyTo } : {}) }),
        signal: AbortSignal.timeout(45000),
      })
      const motivo = r?.whatsapp_result?.error || 'WhatsApp no lo entregó'
      if (r?.message?.id) {
        // El mensaje real reemplaza al temporal; si ORA no lo entregó llega con sent_via_whatsapp en false.
        appendMessageIfNotExists({ ...r.message, conversationId: conv.id, metadata: { ...(r.message.metadata || {}), tempId } } as ChatMessage)
      } else if (r?.success === false) {
        marcarFallido(tempId, conv.id, texto, motivo)
      }
      if (r?.success === false) {
        toast.error(`WhatsApp no entregó el mensaje: ${motivo}`)
        return
      }
      if (r?.message?.metadata?.plantilla) {
        toast('Fuera de la ventana de 24 h: el cliente recibió un aviso y verá tu mensaje cuando responda.')
      }
      if (r?.message?.id) {
        setLastSentMessageId(r.message.id)
        setTimeout(() => setLastSentMessageId(null), 2000)
      }
      if (conv.agent_requested) {
        try {
          await apiClient.clearAgentRequest(conv.id)
          markConversationHandled(conv.id)
          setSelectedConversation(prev => prev?.id === conv.id ? { ...prev, agent_requested: false, agent_notified: true } : prev)
          setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, agent_requested: false, agent_notified: true } : c))
        } catch (error) {
          console.error('Error limpiando la solicitud de vendedor:', error)
        }
      }
    } catch (error: any) {
      console.error('Error enviando por WhatsApp:', error)
      const motivo = error?.name === 'TimeoutError' ? 'el servidor no respondió'
        : error instanceof TypeError || !error?.message ? 'sin conexión con el servidor' : error.message
      marcarFallido(tempId, conv.id, texto, motivo)
      toast.error('No se pudo enviar por WhatsApp. Toca Reintentar.')
    } finally {
      sendingRef.current = false
      setSendingWhatsApp(false)
    }
  }

  const enviar = () => {
    const conv = selectedConversation
    const texto = borrador.texto.trim()
    if (!conv || !texto || sendingRef.current) return
    const replyTo = replyingToMessage?.id ?? null
    setBorrador(conv.id, { texto: '' })
    setReplyingToMessage(null)
    pegadoRef.current = true
    if (borrador.modo === 'note' || !conv.customer_phone) enviarNota(texto, conv, replyTo)
    else enviarWhatsApp(texto, conv, replyTo)
  }

  const reintentar = (m: ChatMessage) => {
    const conv = selectedConversation
    if (!conv || sendingRef.current) return
    const local = !!m.metadata?.temporary
    if (!local) setReintentados(prev => new Set(prev).add(m.id))
    const replyTo = (m.metadata as any)?.reply_to_id ?? m.reply_to_id ?? null
    pegadoRef.current = true
    if (getMessageKind(m) === 'note') enviarNota(m.message, conv, replyTo, local ? m.id : undefined)
    else enviarWhatsApp(m.message, conv, replyTo, local ? m.id : undefined)
  }

  const descartar = (m: ChatMessage) => setMessages(prev => prev.filter(x => x.id !== m.id))

  const cambiarTexto = (texto: string) => {
    if (!selectedConversation) return
    setBorrador(selectedConversation.id, { texto })
    if (ws.current?.readyState === WebSocket.OPEN) {
      const quien = { sender_id: user?.id || '', sender_name: user?.name || user?.email || 'Admin' }
      ws.current.send(JSON.stringify({ type: 'typing_start', ...quien }))
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'typing_stop', ...quien }))
      }, 2000)
    }
  }

  const selectConversation = (conversation: ChatConversation) => {
    setSelectedConversation(conversation)
    setMessages([])
    setHasMore(true)
    setPage(1)
    // La cita, la edición y los menús abiertos son de la conversación anterior.
    setReplyingToMessage(null)
    setEditingMessageId(null)
    setEditingContent('')
    setDeletingMessageId(null)
    setReactionPickerMessageId(null)
    pegadoRef.current = true
    setPegado(true)
    setNuevos(0)
    loadMessages(conversation.id, 1)
    // El aviso de pase no se limpia al entrar: se limpia cuando el vendedor le escribe al cliente por WhatsApp.
    if (!conversationTagsMap[conversation.id]) {
      apiClient.getConversationTags(conversation.id)
        .then((tags) => setConversationTagsMap((prev) => ({ ...prev, [conversation.id]: tags })))
        .catch(() => {})
    }
    setTimeout(() => messageInputRef.current?.focus(), 100)
  }

  // Bajar al final solo cuando cambia el ÚLTIMO mensaje y el vendedor está abajo o acaba de enviar.
  const lastMsgIdRef = useRef<string | null>(null)
  useEffect(() => {
    const list = Array.isArray(messages) ? messages : []
    const last = list[list.length - 1]
    const clave = last ? String((last.metadata as any)?.tempId || last.id) : null
    if (clave && clave !== lastMsgIdRef.current) {
      const primero = lastMsgIdRef.current === null
      const propio = last.sender === 'admin' && !!last.metadata?.temporary
      if (primero || pegadoRef.current || propio) requestAnimationFrame(() => bajar(!primero))
      else setNuevos((n) => n + 1)
    }
    lastMsgIdRef.current = clave
  }, [messages])

  // Ventana de 24 h de WhatsApp desde el último mensaje del cliente. Se recalcula cada minuto.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  const waWindow = useMemo(() => {
    const list = Array.isArray(messages) ? messages : []
    let last: Date | null = null
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].sender === 'user') { last = parseUTCTimestamp(list[i].timestamp); break }
    }
    const fromList = selectedConversation?.last_inbound_at
    if (fromList) {
      const d = parseUTCTimestamp(fromList)
      if (!last || d > last) last = d
    }
    if (!last) return { state: 'unknown' as const, label: '', hoursLeft: 0 }
    const msLeft = last.getTime() + 24 * 3600 * 1000 - nowTick
    if (msLeft <= 0) {
      return { state: 'closed' as const, label: formatDistanceToNow(last, { addSuffix: true, locale: es }), hoursLeft: 0 }
    }
    const h = Math.floor(msLeft / 3600000), m = Math.floor((msLeft % 3600000) / 60000)
    return { state: 'open' as const, label: h > 0 ? `${h} h ${m} min` : `${m} min`, hoursLeft: msLeft / 3600000 }
  }, [messages, selectedConversation, nowTick])

  // Historial: botón explícito que conserva la posición de lectura al insertar los mensajes viejos arriba.
  const loadOlderMessages = async () => {
    const conv = selectedConvRef.current
    if (!conv || loadingMore || !hasMore) return
    const viewport = scrollRef.current
    const prevHeight = viewport?.scrollHeight ?? 0
    setLoadingMore(true)
    try {
      await loadMessages(conv.id, page + 1, true)
    } finally {
      setLoadingMore(false)
    }
    requestAnimationFrame(() => {
      if (viewport) viewport.scrollTop = viewport.scrollHeight - prevHeight
    })
  }

  const msgSearchMatches = useMemo(() => {
    if (!msgSearchQuery.trim()) return []
    const q = msgSearchQuery.toLowerCase()
    return (Array.isArray(messages) ? messages : [])
      .filter(m => !m.is_deleted && m.message?.toLowerCase().includes(q))
      .map(m => m.id)
  }, [msgSearchQuery, messages])

  useEffect(() => {
    setMsgSearchIdx(0)
    if (msgSearchMatches.length > 0) {
      messageRefs.current[msgSearchMatches[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [msgSearchMatches])

  const handleMsgSearchNext = () => {
    if (!msgSearchMatches.length) return
    const ni = (msgSearchIdx + 1) % msgSearchMatches.length
    setMsgSearchIdx(ni)
    messageRefs.current[msgSearchMatches[ni]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleMsgSearchPrev = () => {
    if (!msgSearchMatches.length) return
    const ni = (msgSearchIdx - 1 + msgSearchMatches.length) % msgSearchMatches.length
    setMsgSearchIdx(ni)
    messageRefs.current[msgSearchMatches[ni]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleCloseMsgSearch = () => {
    setMsgSearchOpen(false)
    setMsgSearchQuery('')
  }

  const toggleFavorite = async (conversationId: string) => {
    const next = !favState[conversationId]
    setFavState(prev => ({ ...prev, [conversationId]: next }))
    try {
      await apiClient.setConversationFavorite(conversationId, next)
    } catch (error) {
      console.error('Error cambiando el favorito:', error)
      setFavState(prev => ({ ...prev, [conversationId]: !next }))
      toast.error('No se pudo actualizar el favorito')
    }
  }

  const togglePin = async (conversationId: string) => {
    const next = !pingState[conversationId]
    setPingState(prev => ({ ...prev, [conversationId]: next }))
    try {
      await apiClient.setConversationPin(conversationId, next)
    } catch (error) {
      console.error('Error cambiando el destacado:', error)
      setPingState(prev => ({ ...prev, [conversationId]: !next }))
      toast.error('No se pudo actualizar el destacado')
    }
  }

  const cambiarAtencion = async (accion: 'tomar' | 'devolver-a-ia' | 'transferir', agente?: { id: string; name: string }, nota?: string) => {
    if (!selectedConversation) return
    const id = selectedConversation.id
    setAtencionBusy(true)
    try {
      const r = accion === 'tomar' ? await conversacionesApi.tomar(id)
        : accion === 'devolver-a-ia' ? await conversacionesApi.devolverAIa(id)
        : await conversacionesApi.transferir(id, agente!.id, nota)
      aplicarAtencion(id, r.estado_atencion, r.asignado_a, accion === 'tomar' ? user?.name ?? null : agente?.name ?? null)
      setTransferirA(null)
      setNotaTransferencia('')
      toast.success(
        accion === 'tomar' ? 'Tomaste la conversación. La IA no responde.'
          : accion === 'devolver-a-ia' ? 'La IA vuelve a atender esta conversación.'
          : `Transferida a ${agente?.name}`,
        { id: `atencion-${id}`, position: 'top-center', duration: 3000 },
      )
      if (accion === 'tomar') setTimeout(() => messageInputRef.current?.focus(), 50)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cambiar quién atiende. Intenta de nuevo.')
    } finally {
      setAtencionBusy(false)
    }
  }

  const handleUnblockConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/v1/chat/conversations/${conversationId}/unblock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const result = await response.json()
      if (result.success) {
        setConversations(prev => prev.map(conv => conv.id === conversationId ? { ...conv, status: 'active', unread_count: 0 } : conv))
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(prev => prev ? { ...prev, status: 'active', unread_count: 0 } : null)
        }
        toast.success('Conversación desbloqueada')
      } else {
        toast.error(result.message || 'No se pudo desbloquear la conversación')
      }
    } catch (error) {
      console.error('Error desbloqueando la conversación:', error)
      toast.error('Error al desbloquear la conversación')
    }
  }

  useEffect(() => {
    if (!selectedConversation) return;
    const wsUrl = createWsUrl(`/api/v1/ws/chat?conversation_id=${selectedConversation.id}`);
    if (!wsUrl) {
      console.error('No se pudo crear la URL del WebSocket: no hay token');
      return;
    }

    // Un GET normal al host del WS fuerza HTTP/1.1 y evita quedar atascado en una conexión h2 muerta.
    try {
      fetch(urlTiempoReal('/api/v1/ws/ping').replace(/^ws/, 'http'), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    } catch (_) {}

    ws.current = new WebSocket(wsUrl, wsAuthProtocols());

    ws.current.onopen = () => {
      wsFailuresRef.current = 0;
      setRtOnline(true);
    }

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type || data.event;

        if ((type === 'new_message' || type === 'message.created') && (data.message || data.data)) {
          const msg: ChatMessage = data.message || data.data;
          appendMessageIfNotExists(msg);
          const convId = (msg as any).conversationId || (msg as any).conversation_id || selectedConversation.id;
          const updatedAtIso = msg.timestamp ? parseUTCTimestamp(msg.timestamp).toISOString() : new Date().toISOString();
          const delCliente = msg.sender === 'user'
          setConversations(prev => prev.map(conv => conv.id === convId ? {
            ...conv, updated_at: updatedAtIso, last_message_timestamp: updatedAtIso, last_message_text: msg.message, lastMessage: msg.message,
            ...(delCliente ? { last_inbound_text: msg.message } : {}),
            unread_count: (selectedConversation?.id === convId ? 0 : ((conv.unread_count || 0) + 1)),
          } : conv));
          if (selectedConversation?.id === convId) apiClient.markConversationAsRead(convId).catch(() => {});
        }

        if ((type === 'conversation.created' || type === 'conversation.new') && data.conversation) {
          upsertConversation(data.conversation as ChatConversation);
        }

        if ((type === 'conversation.updated' || type === 'conversation.patch') && data.conversation) {
          upsertConversation(data.conversation as ChatConversation);
        }

        if (type === 'conversation.status_changed' && data.conversation_id && data.estado_atencion) {
          aplicarAtencion(data.conversation_id, data.estado_atencion, data.asignado_a ?? null)
        } else if (type === 'conversation.status_changed' && data.conversation_id && data.conversation_status) {
          const newStatus = data.conversation_status
          setConversations((prev) => prev.map((c) => c.id === data.conversation_id ? { ...c, conversation_status: newStatus, resolved_at: data.resolved_at ?? null } : c))
          setSelectedConversation((prev) => prev && prev.id === data.conversation_id ? { ...prev, conversation_status: newStatus, resolved_at: data.resolved_at ?? null } : prev)
        }

        if (type === 'conversation.assigned' && data.conversation_id) {
          const asignacion = {
            assigned_to_id: data.assigned_to_id ?? null,
            assigned_to_name: data.assigned_to_name ?? null,
            assigned_at: data.assigned_at ?? null,
          }
          setConversations((prev) => prev.map((c) => c.id === data.conversation_id ? { ...c, ...asignacion } : c))
          setSelectedConversation((prev) => prev && prev.id === data.conversation_id ? { ...prev, ...asignacion } : prev)
        }

        if (type === 'message.status' && data.message) {
          const estado = data.message
          setMessages((prev) => prev.map((m) => m.id === estado.id
            ? { ...m, metadata: { ...(m.metadata || {}), delivery_status: estado.delivery_status, entrega_error: estado.entrega_error } }
            : m))
        }

        if (type === 'message.edited' && data.message) {
          const edited = data.message
          setMessages((prev) => prev.map((m) => m.id === edited.id ? { ...m, message: edited.message, is_edited: true, edited_at: edited.edited_at } : m))
        }

        if (type === 'message.deleted' && data.message) {
          const deleted = data.message
          setMessages((prev) => prev.map((m) => m.id === deleted.id ? { ...m, is_deleted: true, deleted_at: deleted.deleted_at } : m))
        }

        if (type === 'message.reaction.updated' && data.message) {
          const updated = data.message
          const updatedId = String(updated.id)
          const nextReactions = Array.isArray(updated.reactions) ? updated.reactions : []
          setMessages((prev) => prev.map((m) => String(m.id) === updatedId ? { ...m, reactions: nextReactions } : m))
        }

        if (type === 'typing_start' && data.sender_id !== (user?.id || '')) {
          const name = data.sender_name || 'Admin'
          const convId = selectedConversation?.id || ''
          setTypingUsers((prev) => [...prev.filter((u) => u.name !== name), { name, conversationId: convId }])
          if (typingAutoStopRef.current) clearTimeout(typingAutoStopRef.current)
          typingAutoStopRef.current = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.name !== name))
          }, 3000)
        }
        if (type === 'typing_stop') {
          const name = data.sender_name || 'Admin'
          setTypingUsers((prev) => prev.filter((u) => u.name !== name))
        }
      } catch (e) {
        console.error('Error leyendo el mensaje del WebSocket:', e, 'Datos:', event.data);
      }
    };

    ws.current.onclose = (event) => {
      // Cierre no pedido: reconectar con espera creciente, máximo 30 s. Con 4401 primero se renueva la sesión.
      setRtOnline(false);
      const n = ++wsFailuresRef.current;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(n, 5)) + Math.random() * 500;
      const retry = () => setTimeout(() => setWsRetry((r) => r + 1), delay);
      if (event.code === 4401) apiClient.refreshSession().finally(retry);
      else retry();
    };
    ws.current.onerror = (err) => {
      // Un error mientras conecta (al cambiar de conversación) es transitorio.
      if (ws.current && ws.current.readyState === WebSocket.CONNECTING) return;
      console.error('Error en el WebSocket:', err);
    }

    return () => {
      const sock = ws.current;
      if (sock) {
        // Quitar los manejadores y cerrar solo si ya abrió; si aún conecta, cerrar en onopen.
        sock.onmessage = null;
        sock.onerror = null;
        sock.onclose = null;
        if (sock.readyState === WebSocket.CONNECTING) sock.onopen = () => sock.close();
        else sock.close();
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (typingAutoStopRef.current) clearTimeout(typingAutoStopRef.current)
      setTypingUsers([])
      setMsgSearchOpen(false)
      setMsgSearchQuery('')
    };
  }, [selectedConversation?.id, wsRetry]);

  // Al volver el tiempo real de la lista, recuperar lo que llegó durante el corte.
  useEffect(() => {
    const onReconnected = () => {
      loadConversations(true)
      const conv = selectedConvRef.current
      if (conv) mergeLatestMessages(conv.id)
    }
    window.addEventListener('realtime:reconnected', onReconnected)
    return () => window.removeEventListener('realtime:reconnected', onReconnected)
  }, [])

  // Respaldo sin tiempo real: cada 15 s trae lo nuevo, solo si el socket no está abierto y la pestaña se ve.
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (ws.current?.readyState === WebSocket.OPEN) return
      const conv = selectedConvRef.current
      if (conv) mergeLatestMessages(conv.id)
      loadConversations(true)
    }, 15000)
    return () => clearInterval(id)
  }, [user])

  // Lista de conversaciones en tiempo real: se suscribe al socket de /ws/conversations que ya mantiene
  // agent-notifications-context, así hay un solo socket para todo el panel.
  useEffect(() => {
    try {
      // @ts-ignore
      window.upsertConversation = upsertConversation;
    } catch (e) {}

    const handleConversationsMessage = (data: any) => {
      try {
        const type = data.type || data.event;

        if (type === 'conversation.status_changed' && data.conversation_id && data.estado_atencion) {
          aplicarAtencion(data.conversation_id, data.estado_atencion, data.asignado_a ?? null)
        }

        // El aviso de pase trae el motivo y, si el backend lo manda, el brief (contrato/conversaciones.md).
        if (type === 'agent_requested' && data.conversation_id) {
          const pase = {
            agent_requested: true,
            agent_requested_at: data.timestamp,
            ...(data.motivo_pase ?? data.motivo ? { motivo_pase: data.motivo_pase ?? data.motivo } : {}),
            ...(data.motivo_texto ? { motivo_pase_texto: data.motivo_texto } : {}),
            ...(data.brief_pase ? { brief_pase: data.brief_pase, esperando_desde: data.brief_pase.esperando_desde ?? data.timestamp } : {}),
          }
          setConversations(prev => prev.map(conv => conv.id === data.conversation_id
            ? {
                ...conv, ...pase,
                ...(conv.estado_atencion !== 'vendedor' ? { estado_atencion: 'esperando_vendedor' as EstadoAtencion } : {}),
                unread_count: (conv.unread_count || 0) + 1,
              }
            : conv));
          if (selectedConvRef.current?.id === data.conversation_id) {
            setSelectedConversation(prev => prev ? {
              ...prev, ...pase,
              ...(prev.estado_atencion !== 'vendedor' ? { estado_atencion: 'esperando_vendedor' as EstadoAtencion } : {}),
            } : prev);
          }
        }

        if ((type === 'conversation.created' || type === 'conversation.new') && data.conversation) {
          upsertConversation(data.conversation as ChatConversation);
        }
        // conversation.updated: vista previa, no leídos y al tope de la lista, sin duplicar.
        if ((type === 'conversation.updated' || type === 'conversation.patch') && data.conversation) {
          const convData: any = data.conversation;
          const lastMsg: any = data.last_message || data.lastMessage;
          const convId = convData.id;

          // Si está abierta, el socket de la conversación agrega el mensaje; aquí solo se marca leída.
          if (selectedConvRef.current?.id === convId && lastMsg) {
            apiClient.markConversationAsRead(convId).catch(() => {});
          }

          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === convId);
            if (idx === -1) {
              const newConv: any = {
                id: convData.id,
                customer_name: convData.customer_name || convData.customerName || '',
                customer_phone: convData.customer_phone || convData.customerPhone || '',
                status: convData.status || 'pending',
                unread_count: selectedConvRef.current?.id === convId ? 0 : 1,
                created_at: convData.created_at || new Date().toISOString(),
                updated_at: lastMsg?.timestamp || convData.updated_at || new Date().toISOString(),
                last_message_timestamp: lastMsg?.timestamp || null,
                last_message_text: lastMsg?.message || '',
                lastMessage: lastMsg?.message || convData.lastMessage || '' ,
                lastMessageId: lastMsg?.id || null,
                ...(lastMsg?.sender === 'user' ? { last_inbound_text: lastMsg.message } : {}),
              };
              return [newConv, ...prev];
            }

            const existing = prev[idx] as any;
            const existingLastId = existing.lastMessageId || existing.last_message_id || null;
            const incomingLastId = lastMsg?.id || null;
            if (incomingLastId && existingLastId === incomingLastId) return prev;

            const updated: any = { ...existing };
            for (const campo of ['motivo_pase', 'motivo_pase_texto', 'esperando_desde', 'brief_pase', 'ia_pasos', 'estado_atencion', 'last_inbound_text']) {
              if (convData[campo] !== undefined) updated[campo] = convData[campo]
            }
            if (lastMsg) {
              updated.lastMessage = lastMsg.message || updated.lastMessage;
              updated.last_message_text = lastMsg.message || updated.last_message_text;
              updated.last_message_timestamp = lastMsg.timestamp || updated.last_message_timestamp;
              updated.lastMessageId = incomingLastId;
              updated.updated_at = lastMsg.timestamp || updated.updated_at;
              if (lastMsg.sender === 'user') updated.last_inbound_text = lastMsg.message || updated.last_inbound_text;
            } else {
              updated.customer_name = convData.customer_name || updated.customer_name;
              updated.customer_phone = convData.customer_phone || updated.customer_phone;
              updated.status = convData.status || updated.status;
              updated.updated_at = convData.updated_at || updated.updated_at;
            }

            if (selectedConvRef.current?.id === convId) updated.unread_count = 0;
            else updated.unread_count = (updated.unread_count || 0) + (incomingLastId ? 1 : 0);

            return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
          });

          if (selectedConvRef.current?.id === convId) {
            setSelectedConversation(prev => prev ? { ...prev, ...convData } : prev);
          }
        }
      } catch (e) {
        console.error('Error leyendo el mensaje de conversaciones:', e);
      }
    }

    const unsubscribe = subscribeToRawMessages(handleConversationsMessage);
    return unsubscribe;
  }, [subscribeToRawMessages]);

  // Cerrar el selector de reacciones al hacer clic fuera.
  useEffect(() => {
    if (!reactionPickerMessageId) return
    const onDocClick = () => setReactionPickerMessageId(null)
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [reactionPickerMessageId])

  if (isLoading || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return null
  }

  const handleSaveEdit = async (msg: ChatMessage) => {
    if (!selectedConversation || !editingContent.trim()) return
    setSavingEdit(true)
    try {
      const updated = await apiClient.editMessage(selectedConversation.id, msg.id, editingContent.trim())
      setMessages((prev) => prev.map((m) => m.id === msg.id
        ? { ...m, message: updated.message ?? editingContent.trim(), is_edited: true, edited_at: updated.edited_at }
        : m))
      setEditingMessageId(null)
      setEditingContent("")
      toast.success("Mensaje editado")
    } catch (err: any) {
      toast.error(err?.message || "Error al editar el mensaje")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget || !selectedConversation) return
    const { id, scope } = confirmDeleteTarget
    setConfirmDeleteTarget(null)
    if (scope === 'for_me') {
      setLocallyDeletedIds((prev) => new Set(prev).add(id))
      return
    }
    setDeletingMessageId(id)
    try {
      await apiClient.deleteMessageForAll(selectedConversation.id, id)
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_deleted: true } : m)))
      toast.success("Mensaje eliminado")
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar el mensaje")
    } finally {
      setDeletingMessageId(null)
    }
  }

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!selectedConversation) return
    setReactingMessageId(messageId)
    try {
      const updated = await apiClient.toggleMessageReaction(selectedConversation.id, messageId, emoji)
      const nextReactions = Array.isArray(updated?.reactions)
        ? updated.reactions
        : Array.isArray(updated?.message?.reactions) ? updated.message.reactions : null
      setMessages((prev) => prev.map((m) => String(m.id) === String(messageId)
        ? { ...m, reactions: nextReactions ?? (Array.isArray(m.reactions) ? m.reactions : []) }
        : m))
      // Si la respuesta no trajo las reacciones, se recargan los mensajes para quedar como el backend.
      if (!nextReactions) await refreshMessages(selectedConversation.id)
      setReactionPickerMessageId(null)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo reaccionar al mensaje')
    } finally {
      setReactingMessageId(null)
    }
  }

  const ultimasPiezas = [...messages].reverse().find((m) => m.piezas?.length)?.piezas ?? []
  const piezaCaso = piezaSel ?? (ultimasPiezas.length === 1 ? ultimasPiezas[0] : null)
  const briefAbierta = selectedConversation ? briefDe(selectedConversation) : null
  const escribiendo = typingUsers.filter((u) => u.conversationId === selectedConversation?.id)

  const renderDetailsCard = () => (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{RIGHT_PANELS.find((panel) => panel.id === rightPanel)?.label}</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanel(null)} aria-label="Cerrar panel">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {rightPanel === 'phone' ? (
        <CardContent className="pt-3 flex-1 overflow-hidden flex flex-col min-h-0">
          <SoftphonePanel
            softphone={softphone}
            customer={selectedConversation ? { name: selectedConversation.customer_name, phone: selectedConversation.customer_phone } : null}
            contacts={conversations.map((c) => ({ name: c.customer_name, phone: c.customer_phone }))}
          />
        </CardContent>
      ) : selectedConversation ? (
        <CardContent className="pt-3 flex-1 overflow-hidden flex flex-col">
          {vertical === 'seguros' ? (
            <CasoSeguros
              conversacionId={selectedConversation.id}
              onSugerencia={(texto) => {
                const id = selectedConvRef.current?.id
                if (!id) return
                setBorrador(id, { texto, modo: 'whatsapp' })
                setTimeout(() => messageInputRef.current?.focus(), 50)
              }}
            />
          ) : vertical === 'restaurante' ? (
            <CasoRestaurante
              conversacionId={selectedConversation.id}
              onSugerencia={(texto) => {
                const id = selectedConvRef.current?.id
                if (!id) return
                setBorrador(id, { texto, modo: 'whatsapp' })
                setTimeout(() => messageInputRef.current?.focus(), 50)
              }}
            />
          ) : rightPanel === 'caso' ? (
            <CasoPanel
              conversation={selectedConversation}
              pieza={piezaCaso}
              recarga={`${messages.length}:${messages[messages.length - 1]?.id ?? ''}:${selectedConversation.estado_atencion ?? ''}`}
              onSugerencia={(texto) => {
                const id = selectedConvRef.current?.id
                if (!id) return
                setBorrador(id, { texto, modo: 'whatsapp' })
                setTimeout(() => messageInputRef.current?.focus(), 50)
              }}
              onCambio={() => mergeLatestMessages(selectedConversation.id)}
            />
          ) : (
            <CustomerPanel phone={selectedConversation.customer_phone} name={selectedConversation.customer_name} />
          )}
        </CardContent>
      ) : (
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-medium mb-1">{RIGHT_PANELS.find((panel) => panel.id === rightPanel)?.label}</h3>
            <p className="text-xs">Selecciona una conversación</p>
          </div>
        </CardContent>
      )}
    </div>
  )

  return (
    <AdminLayout title="Bandeja">
      <div className="flex h-[calc(100dvh-7rem)] overflow-hidden rounded-xl border bg-card shadow-sm lg:h-[calc(100dvh-8rem)]">
      <ResizablePanelGroup direction="horizontal" autoSaveId="chat-layout-panels" className="min-w-0 flex-1">
        {(!isNarrow || !selectedConversation) && (<>
        <ResizablePanel id="chat-conversations" order={1} defaultSize={26} minSize={20} maxSize={42} className="min-w-0 min-h-0">
          <ListaConversaciones
            conversaciones={conversations}
            seleccionadaId={selectedConversation?.id ?? null}
            onSelect={selectConversation}
            userId={user?.id}
            favoritos={favState}
            destacados={pingState}
            onFavorito={toggleFavorite}
            onDestacado={togglePin}
            etiquetas={conversationTagsMap}
            error={loadError}
            onReintentar={() => loadConversations()}
            hayMas={convHasMore}
            cargandoMas={loadingMoreConvs}
            onCargarMas={loadMoreConversations}
          />
        </ResizablePanel>
        </>)}

        {!isNarrow && <ResizableHandle />}

        {(!isNarrow || selectedConversation) && (<>
        <ResizablePanel id="chat-messages" order={2} defaultSize={46} minSize={30} className="min-h-0">
        <div className="flex h-full min-h-0 flex-col">
          {selectedConversation ? (
            <>
              <EncabezadoConversacion
                conversacion={selectedConversation}
                userId={user?.id}
                agentes={agentes}
                onCargarAgentes={() => apiClient.getConversationAgents().then(setAgentes).catch(() => toast.error('No se pudo cargar la lista de vendedores'))}
                ocupado={atencionBusy}
                onVolver={() => setSelectedConversation(null)}
                onTomar={() => cambiarAtencion('tomar')}
                onDevolver={() => cambiarAtencion('devolver-a-ia')}
                onTransferir={setTransferirA}
                onDesbloquear={() => handleUnblockConversation(selectedConversation.id)}
                buscando={msgSearchOpen}
                onBuscar={() => { setMsgSearchOpen(v => !v); if (msgSearchOpen) setMsgSearchQuery('') }}
                etiquetasEmpresa={companyTags}
                etiquetas={conversationTagsMap[selectedConversation.id] ?? []}
                onEtiquetas={(tags) => setConversationTagsMap((prev) => ({ ...prev, [selectedConversation.id]: tags }))}
                onEtiquetasEmpresa={setCompanyTags}
              />

              {briefAbierta && (isNarrow || rightPanel !== 'caso') && (
                <div className="flex-shrink-0 border-b px-3 py-2">
                  <TarjetaBrief brief={briefAbierta} compacta={estadoAtencion(selectedConversation) !== 'vendedor'} />
                </div>
              )}

              {msgSearchOpen && (
                <div className="flex items-center gap-2 border-b bg-secondary/60 px-4 py-2">
                  <input
                    type="text"
                    value={msgSearchQuery}
                    onChange={e => setMsgSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleMsgSearchNext()
                      if (e.key === 'Escape') handleCloseMsgSearch()
                    }}
                    placeholder="Buscar en la conversación..."
                    aria-label="Buscar en la conversación"
                    className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {msgSearchMatches.length > 0 ? `${msgSearchIdx + 1}/${msgSearchMatches.length}` : '0/0'}
                  </span>
                  <button onClick={handleMsgSearchPrev} disabled={msgSearchMatches.length === 0}
                    className="p-1 rounded hover:bg-warning-soft disabled:opacity-40 text-gray-600" title="Anterior" aria-label="Coincidencia anterior">
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button onClick={handleMsgSearchNext} disabled={msgSearchMatches.length === 0}
                    className="p-1 rounded hover:bg-warning-soft disabled:opacity-40 text-gray-600" title="Siguiente" aria-label="Coincidencia siguiente">
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button onClick={handleCloseMsgSearch} className="p-1 rounded hover:bg-destructive-soft text-gray-500" title="Cerrar búsqueda" aria-label="Cerrar búsqueda">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}

              {!rtOnline && (
                <div role="status" className="mx-2 mt-1 rounded-md border border-warning/30 bg-warning-soft px-3 py-1.5 text-xs text-warning">
                  Sin conexión en tiempo real. Reconectando… mientras tanto se actualiza cada 15 s.
                </div>
              )}

              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div ref={scrollRef} onScroll={alScroll} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-chat [scrollbar-width:thin]">
                  <div className="space-y-1.5 px-3 py-4 md:px-[5%]">
                    {hasMore && (
                      <div className="flex justify-center pt-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadOlderMessages} disabled={loadingMore}>
                          {loadingMore ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          {loadingMore ? 'Cargando…' : 'Cargar mensajes anteriores'}
                        </Button>
                      </div>
                    )}
                    {(Array.isArray(messages) ? messages : []).map((message) => (
                      <MensajeBurbuja
                        key={message.id}
                        message={message}
                        nombreCliente={selectedConversation.customer_name}
                        resaltado={msgSearchMatches[msgSearchIdx] === message.id}
                        recienEnviado={lastSentMessageId === message.id}
                        eliminadoLocal={locallyDeletedIds.has(message.id)}
                        editando={editingMessageId === message.id}
                        contenidoEdicion={editingContent}
                        onContenidoEdicion={setEditingContent}
                        guardandoEdicion={savingEdit}
                        onEditar={() => { setEditingMessageId(message.id); setEditingContent(message.message) }}
                        onCancelarEdicion={() => { setEditingMessageId(null); setEditingContent('') }}
                        onGuardarEdicion={() => handleSaveEdit(message)}
                        menuEliminar={deletingMessageId === message.id}
                        onMenuEliminar={() => setDeletingMessageId(prev => prev === message.id ? null : message.id)}
                        onEliminar={(scope) => { setDeletingMessageId(null); setConfirmDeleteTarget({ id: message.id, scope }) }}
                        pickerReaccion={reactionPickerMessageId === message.id}
                        onPickerReaccion={() => setReactionPickerMessageId(prev => prev === message.id ? null : message.id)}
                        reaccionando={reactingMessageId === message.id}
                        onReaccion={(emoji) => handleToggleReaction(message.id, emoji)}
                        onResponder={() => { setReplyingToMessage(message); setTimeout(() => messageInputRef.current?.focus(), 50) }}
                        piezaSeleccionada={piezaCaso?.product_id}
                        onPieza={(pieza) => { setPiezaSel(pieza); setRightPanel('caso') }}
                        reintentado={reintentados.has(message.id)}
                        onReintentar={() => reintentar(message)}
                        onDescartar={() => descartar(message)}
                        refFila={(el) => { messageRefs.current[message.id] = el }}
                      />
                    ))}
                    {estadoAtencion(selectedConversation) === 'ia' && !!selectedConversation.ia_pasos?.length && (
                      <IaPensando pasos={selectedConversation.ia_pasos} seguir={pegado} />
                    )}
                  </div>
                </div>
                {nuevos > 0 && !pegado && (
                  <button
                    type="button"
                    onClick={() => bajar()}
                    className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden /> {nuevos === 1 ? '1 mensaje nuevo' : `${nuevos} mensajes nuevos`}
                  </button>
                )}
              </div>

              {escribiendo.length > 0 && (
                <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-gray-400 italic">
                  <span className="flex gap-0.5 items-end">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span>{escribiendo.map((u) => u.name).join(', ')} está escribiendo...</span>
                </div>
              )}

              <Compositor
                conversationId={selectedConversation.id}
                tieneTelefono={!!selectedConversation.customer_phone}
                estado={estadoAtencion(selectedConversation)}
                texto={borrador.texto}
                onTexto={cambiarTexto}
                modo={borrador.modo}
                onModo={(modo) => setBorrador(selectedConversation.id, { modo })}
                ocupado={sendingWhatsApp || sendingMessage}
                respondiendoA={replyingToMessage}
                nombreCliente={selectedConversation.customer_name}
                onCancelarRespuesta={() => setReplyingToMessage(null)}
                ventana={waWindow}
                onEnviar={enviar}
                onTomar={() => cambiarAtencion('tomar')}
                tomando={atencionBusy}
                inputRef={messageInputRef}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-chat p-6">
              <div className="max-w-xs text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <MessageCircle className="h-7 w-7" aria-hidden />
                </span>
                <h3 className="font-display text-lg font-semibold">Selecciona una conversación</h3>
                <p className="mt-1 text-sm text-muted-foreground">Elige un chat de la lista para leerlo y responder.</p>
              </div>
            </div>
          )}
        </div>
        </ResizablePanel>
        </>)}

        {rightPanel && !isNarrow && (
          <>
            <ResizableHandle />
            <ResizablePanel id="chat-details" order={3} defaultSize={28} minSize={15} maxSize={40} className="min-w-0 min-h-0">
              {renderDetailsCard()}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Móvil y tablet: el panel lateral como hoja superpuesta */}
      {isNarrow && rightPanel && (
        <div className="fixed inset-0 z-40 bg-black/40 flex justify-end" onClick={() => setRightPanel(null)}>
          <div className="h-full w-[min(420px,92vw)] bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            {renderDetailsCard()}
          </div>
        </div>
      )}

      {/* Franja de íconos: abre un panel; clic en el activo lo cierra */}
      <nav
        aria-label="Paneles de la conversación"
        className={cn("w-12 shrink-0 flex-col items-center gap-1 border-l py-2", isNarrow && !selectedConversation ? "hidden" : "flex")}
      >
        {RIGHT_PANELS.map(({ id, label, icon: Icon }) => {
          const active = rightPanel === id
          const phoneRinging = id === 'phone' && softphone.snapshot.call === 'ringing'
          const phoneInCall = id === 'phone' && (softphone.snapshot.call === 'active' || softphone.snapshot.call === 'dialing')
          const phoneDot =
            id !== 'phone' || softphone.availability !== 'ready'
              ? null
              : softphone.agentStatus === 'offline'
              ? 'bg-muted-foreground/50'
              : softphone.snapshot.registration === 'registered'
              ? softphone.agentStatus.startsWith('paused:') ? 'bg-amber-400' : 'bg-green-500'
              : softphone.snapshot.registration === 'connecting'
              ? 'bg-amber-400'
              : 'bg-red-500'
          return (
            <button
              key={id}
              type="button"
              onClick={() => setRightPanel(active ? null : id)}
              aria-label={label}
              aria-pressed={active}
              title={label}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                phoneRinging && 'animate-pulse bg-success-soft text-success',
                phoneInCall && !active && 'text-success'
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
              {phoneDot && <span className={cn('absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-card', phoneDot)} aria-hidden />}
              {id === 'caso' && !active && briefAbierta && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning ring-2 ring-card" aria-hidden />
              )}
            </button>
          )
        })}
      </nav>
      </div>

      {rightPanel !== 'phone' && (
        <IncomingCallCard softphone={softphone} onOpenPhone={() => setRightPanel('phone')} />
      )}

      <Dialog open={!!transferirA} onOpenChange={(open) => { if (!open) { setTransferirA(null); setNotaTransferencia('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir a {transferirA?.name}</DialogTitle>
            <DialogDescription>La conversación queda a su nombre y la IA no responde. La nota queda como nota interna.</DialogDescription>
          </DialogHeader>
          <Textarea value={notaTransferencia} onChange={(e) => setNotaTransferencia(e.target.value)} rows={3} maxLength={500}
            placeholder="Nota para el vendedor (opcional): cliente mayorista, ofrecer precio de taller" aria-label="Nota de la transferencia" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferirA(null); setNotaTransferencia('') }} disabled={atencionBusy}>Cancelar</Button>
            <Button onClick={() => transferirA && cambiarAtencion('transferir', transferirA, notaTransferencia)} disabled={atencionBusy} className="gap-1.5">
              {atencionBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRightLeft className="h-4 w-4" aria-hidden />} Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDeleteTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {confirmDeleteTarget.scope === 'for_all' ? 'Eliminar del backoffice' : 'Eliminar para mí'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {confirmDeleteTarget.scope === 'for_all'
                ? 'Todo el equipo verá "Este mensaje fue eliminado". El cliente lo sigue viendo en su WhatsApp: WhatsApp no permite borrarlo de su teléfono. No se puede deshacer.'
                : 'El mensaje se ocultará solo en tu vista actual.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteTarget(null)} className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleConfirmDelete} className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
