"use client"

import { asegurarEmpresaEnToken, urlTiempoReal, wsAuthProtocols, WS_CLOSE_EMPRESA } from "@/lib/ws-auth"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { apiClient } from "@/lib/api-client"
import { AUTH_TOKEN_EVENT } from "@/lib/auth"
import { textoAvisoPase } from "@/components/admin/notificaciones/motivos"

interface AgentRequestConversation {
  id: string
  customer_name: string
  customer_phone: string
  agent_requested_at?: string
  motivo?: string | null
  motivo_texto?: string | null
}

interface AgentNotificationsContextValue {
  agentRequestCount: number
  agentRequests: AgentRequestConversation[]
  refreshAgentRequests: () => Promise<void>
  markConversationHandled: (conversationId: string) => void
  /** true mientras /ws/conversations está abierto. */
  tiempoReal: boolean
  /**
   * Un solo socket para todo (/ws/conversations, siempre conectado desde el
   * layout de admin). Cualquier consumidor que necesite los mensajes crudos
   * (chat/page.tsx, el softphone para pbx.agent.presence/pbx.queue.update/
   * pbx.call.incoming, etc.) se suscribe aqui en vez de abrir su propia
   * conexion. Devuelve la funcion de desuscripcion.
   */
  subscribeToRawMessages: (callback: (data: any) => void) => () => void
}

const AgentNotificationsContext = createContext<AgentNotificationsContextValue | undefined>(undefined)

const AGENT_REQUEST_TAG = "agent-request"
const INTERVALO_MS = 3000

// El evento manda la hora con zona (+00:00) y /chat/agent-requests sin zona: se comparan como instante UTC.
const instantePase = (fecha?: string | null) => {
  if (!fecha) return ""
  const ms = Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(fecha) ? fecha : `${fecha}Z`)
  return Number.isNaN(ms) ? fecha : String(ms)
}

export function AgentNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const [agentRequestsByConversation, setAgentRequestsByConversation] = useState<Record<string, AgentRequestConversation>>({})
  const [tiempoReal, setTiempoReal] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const wsReconnectTimerRef = useRef<number | null>(null)
  const hadDisconnectRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const refreshDebounceRef = useRef<number | null>(null)
  const rawSubscribersRef = useRef<Set<(data: any) => void>>(new Set())
  // Solicitudes ya avisadas (id -> agent_requested_at) y token que el servidor rechazó con 1008.
  const avisadasRef = useRef<Map<string, string>>(new Map())
  const cargadoRef = useRef(false)
  const tokenRechazadoRef = useRef<string | null>(null)

  const subscribeToRawMessages = useCallback((callback: (data: any) => void) => {
    rawSubscribersRef.current.add(callback)
    return () => {
      rawSubscribersRef.current.delete(callback)
    }
  }, [])

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current

      // Si el contexto quedó suspendido (política de autoplay), intentar reanudarlo.
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {})
      }

      // Beep de dos tonos tipo "ding-dong" para la solicitud de agente.
      const now = ctx.currentTime
      const tones = [
        { freq: 880, start: 0, duration: 0.16 },
        { freq: 1175, start: 0.18, duration: 0.22 },
      ]

      tones.forEach(({ freq, start, duration }) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(freq, now + start)

        // Envolvente para evitar clicks y dar un volumen agradable.
        gain.gain.setValueAtTime(0.0001, now + start)
        gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)

        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start(now + start)
        oscillator.stop(now + start + duration)
      })
    } catch (error) {
      // Los navegadores pueden bloquear el audio si no hubo interacción del usuario.
      console.warn("No se pudo reproducir el sonido de notificación:", error)
    }
  }, [])

  const createWsUrl = (path: string) => {
    if (typeof window === "undefined") return ""
    const token = localStorage.getItem("auth_token")
    if (!token) return ""

    // La empresa que ve el panel: el servidor la acepta si está en user_companies del token.
    const empresa = localStorage.getItem("active_company_id")
    // El token va en el subprotocolo (ver lib/ws-auth), no en la URL.
    return urlTiempoReal(path) + (empresa ? `?company_id=${encodeURIComponent(empresa)}` : "")
  }

  // Avisa una vez por solicitud (otra hora de la misma conversación cuenta como nueva).
  const avisar = useCallback((conversation: AgentRequestConversation) => {
    const clave = instantePase(conversation.agent_requested_at)
    const anterior = avisadasRef.current.get(conversation.id)
    avisadasRef.current.set(conversation.id, clave)
    if (anterior !== undefined && (!clave || clave === anterior)) return
    const texto = textoAvisoPase(conversation.customer_name, conversation.customer_phone, conversation.motivo_texto)
    toast(
      (t) => (
        <button
          type="button"
          className="text-left text-sm"
          onClick={() => {
            toast.dismiss(t.id)
            routerRef.current.push(`/admin/chat?conversation=${conversation.id}`)
          }}
        >
          {texto}
        </button>
      ),
      { id: `${AGENT_REQUEST_TAG}-${conversation.id}-${clave}`, duration: 10000 },
    )
    playNotificationSound()
  }, [playNotificationSound])

  const upsertRequest = useCallback((conversation: AgentRequestConversation, showToast = false) => {
    setAgentRequestsByConversation((prev) => ({
      ...prev,
      [conversation.id]: {
        ...conversation,
        motivo: conversation.motivo ?? prev[conversation.id]?.motivo ?? null,
        motivo_texto: conversation.motivo_texto ?? prev[conversation.id]?.motivo_texto ?? null,
      },
    }))
    if (showToast) avisar(conversation)
  }, [avisar])

  const removeRequest = useCallback((conversationId: string) => {
    avisadasRef.current.delete(conversationId)
    setAgentRequestsByConversation((prev) => {
      if (!prev[conversationId]) return prev
      const next = { ...prev }
      delete next[conversationId]
      return next
    })
  }, [])

  const refreshAgentRequests = useCallback(async () => {
    if (typeof window === "undefined") return
    const token = localStorage.getItem("auth_token")
    if (!token) {
      setAgentRequestsByConversation({})
      return
    }

    try {
      // Endpoint liviano: solo conversaciones con agent_requested=true para la
      // company actual. Mantiene el indicador en sincronía sin descargar la
      // lista completa de conversaciones con mensajes inline.
      const requested = await apiClient.getAgentRequests()
      const nextMap: Record<string, AgentRequestConversation> = {}
      for (const conv of requested as Array<(typeof requested)[number] & { motivo?: string | null; motivo_texto?: string | null }>) {
        nextMap[conv.id] = {
          id: conv.id,
          customer_name: conv.customer_name || "",
          customer_phone: conv.customer_phone || "",
          agent_requested_at: conv.agent_requested_at || undefined,
          motivo: conv.motivo ?? null,
          motivo_texto: conv.motivo_texto ?? null,
        }
      }
      for (const id of Array.from(avisadasRef.current.keys())) {
        if (!nextMap[id]) avisadasRef.current.delete(id)
      }
      // Sin tiempo real esta es la única vía: lo nuevo también se avisa. La primera carga solo se cuenta.
      for (const conv of Object.values(nextMap)) {
        if (cargadoRef.current) avisar(conv)
        else avisadasRef.current.set(conv.id, instantePase(conv.agent_requested_at))
      }
      cargadoRef.current = true
      setAgentRequestsByConversation(nextMap)
    } catch (error) {
      if (error instanceof TypeError) return
      console.error("Error loading global agent requests:", error)
    }
  }, [avisar])

  // Si llegan varios eventos WS en ráfaga (típico cuando el usuario abre,
  // asigna y cierra una conversación en segundos), agrupamos los refreshes en
  // uno solo. El badge ya se actualizó instantáneamente con upsert/remove; el
  // refresh debounced sincroniza el estado contra la BD por si nos perdimos un
  // evento.
  const scheduleRefresh = useCallback(() => {
    if (typeof window === "undefined") return
    if (refreshDebounceRef.current !== null) {
      window.clearTimeout(refreshDebounceRef.current)
    }
    refreshDebounceRef.current = window.setTimeout(() => {
      refreshDebounceRef.current = null
      refreshAgentRequests()
    }, 300)
  }, [refreshAgentRequests])

  const connectConversationsWebSocket = useCallback(() => {
    if (typeof window === "undefined") return
    if (wsRef.current) return

    const token = localStorage.getItem("auth_token")
    // Con el token que ya dio 1008 no se reintenta: se espera el de /auth/select-company.
    if (!token || token === tokenRechazadoRef.current) return

    const wsUrl = createWsUrl("/api/v1/ws/conversations")
    if (!wsUrl) return

    // Warm-up: un GET normal al host del WS fuerza a Chrome a (re)negociar
    // HTTP/1.1. Sin esto, tras un fallo por HTTP/2 el navegador queda atascado en
    // una conexión h2 muerta y el WebSocket nunca abre (no llega el toast/beep de
    // "solicita agente"). Como este connect se reintenta cada 5s, el warm-up sana
    // el host y el próximo intento conecta.
    try {
      fetch(urlTiempoReal("/api/v1/ws/ping").replace(/^ws/, "http"), { mode: "no-cors", cache: "no-store" }).catch(() => {})
    } catch (_) {}

    const socket = new WebSocket(wsUrl, wsAuthProtocols())
    wsRef.current = socket

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const type = data.type || data.event

        // Reenvio a quien se haya suscrito con subscribeToRawMessages (ej.
        // chat/page.tsx para conversation.*, el softphone para pbx.*).
        // Sucede ANTES del manejo interno de abajo: un suscriptor no debe
        // depender de que este handler no le haga "return" temprano.
        rawSubscribersRef.current.forEach((cb) => {
          try {
            cb(data)
          } catch (subscriberError) {
            console.error("Error en subscriber de subscribeToRawMessages:", subscriberError)
          }
        })

        if (type === "agent_requested" && data.conversation_id) {
          upsertRequest(
            {
              id: data.conversation_id,
              customer_name: data.customer_name || "",
              customer_phone: data.customer_phone || "",
              agent_requested_at: data.timestamp,
              motivo: data.motivo ?? null,
              motivo_texto: data.motivo_texto ?? null,
            },
            true,
          )
          scheduleRefresh()
          return
        }

        // Limpieza del badge/toast: emitido por clear-agent-request y por
        // end-agent-session cuando el agente atiende/cierra la solicitud.
        // Sin esto, esta conversación queda marcada como "ya notificada" y un
        // nuevo request-agent del mismo cliente no vuelve a sonar/mostrar toast.
        if (type === "conversation.status_changed" && data.conversation_id && data.agent_requested === false) {
          removeRequest(data.conversation_id)
          scheduleRefresh()
          return
        }

        if ((type === "conversation.updated" || type === "conversation.patch") && data.conversation) {
          const conversation = data.conversation
          if (!conversation.id) return

          if (conversation.agent_requested) {
            upsertRequest(
              {
                id: conversation.id,
                customer_name: conversation.customer_name || "",
                customer_phone: conversation.customer_phone || "",
                agent_requested_at: conversation.agent_requested_at,
                motivo: conversation.motivo_pase ?? null,
                motivo_texto: conversation.motivo_pase_texto ?? null,
              },
              false,
            )
          } else if (conversation.agent_requested === false) {
            removeRequest(conversation.id)
          }
          scheduleRefresh()
        }
      } catch (error) {
        console.error("Error parsing conversations websocket event:", error)
      }
    }

    socket.onopen = () => {
      setTiempoReal(true)
      // Tras un corte, la pantalla de chat recarga lo que se perdió mientras tanto.
      if (hadDisconnectRef.current) {
        hadDisconnectRef.current = false
        window.dispatchEvent(new Event("realtime:reconnected"))
        refreshAgentRequests()
      }
    }

    socket.onclose = (event) => {
      if (wsRef.current === socket) {
        wsRef.current = null
      }
      setTiempoReal(false)
      hadDisconnectRef.current = true
      // 4401 = token caducado/inválido: renovar la sesión; el próximo intento
      // (cada 5 s) conecta con el token nuevo.
      if (event.code === 4401) {
        apiClient.refreshSession().catch(() => {})
      }
      // 1008 = el token no trae la empresa: se pide a /auth/select-company y se
      // reconecta cuando llegue el token nuevo (sin bucle con el mismo token).
      if (event.code === WS_CLOSE_EMPRESA) {
        tokenRechazadoRef.current = token
        asegurarEmpresaEnToken()
      }
    }

    socket.onerror = () => {
      socket.close()
    }
  }, [refreshAgentRequests, removeRequest, scheduleRefresh, upsertRequest])

  useEffect(() => {
    refreshAgentRequests()

    connectConversationsWebSocket()

    wsReconnectTimerRef.current = window.setInterval(() => {
      connectConversationsWebSocket()
      // Sin socket abierto, el contador se mantiene con el endpoint liviano.
      if (wsRef.current?.readyState !== WebSocket.OPEN && document.visibilityState === "visible") {
        refreshAgentRequests()
      }
    }, INTERVALO_MS)

    // Token nuevo (login, select-company, refresh): reconectar enseguida.
    const onToken = () => connectConversationsWebSocket()
    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth_token") onToken()
    }
    window.addEventListener(AUTH_TOKEN_EVENT, onToken)
    window.addEventListener("storage", onStorage)

    return () => {
      if (wsReconnectTimerRef.current) {
        window.clearInterval(wsReconnectTimerRef.current)
        wsReconnectTimerRef.current = null
      }
      if (refreshDebounceRef.current !== null) {
        window.clearTimeout(refreshDebounceRef.current)
        refreshDebounceRef.current = null
      }
      window.removeEventListener(AUTH_TOKEN_EVENT, onToken)
      window.removeEventListener("storage", onStorage)
      const sock = wsRef.current
      wsRef.current = null
      if (sock) {
        sock.onclose = null
        sock.close()
      }
    }
  }, [connectConversationsWebSocket, refreshAgentRequests])

  useEffect(() => {
    // Antes había un setInterval(30s) que pedía /chat/conversations completo
    // (~2.78 MB cada vez) sólo para detectar cambios en agent_requested.
    // Ahora el estado vive en el WebSocket (/api/v1/ws/conversations) con
    // reconnect automático, y este visibilitychange actúa como red de
    // seguridad pidiendo el endpoint liviano /chat/agent-requests cuando la
    // tab vuelve a estar visible (cubre el caso de eventos perdidos durante
    // un sleep prolongado del navegador).
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAgentRequests()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [refreshAgentRequests])

  const value = useMemo<AgentNotificationsContextValue>(() => {
    const agentRequests = Object.values(agentRequestsByConversation)
      .sort((a, b) => {
        const aTime = a.agent_requested_at ? new Date(a.agent_requested_at).getTime() : 0
        const bTime = b.agent_requested_at ? new Date(b.agent_requested_at).getTime() : 0
        return bTime - aTime
      })

    return {
      agentRequestCount: agentRequests.length,
      agentRequests,
      refreshAgentRequests,
      markConversationHandled: removeRequest,
      tiempoReal,
      subscribeToRawMessages,
    }
  }, [agentRequestsByConversation, refreshAgentRequests, removeRequest, subscribeToRawMessages, tiempoReal])

  return <AgentNotificationsContext.Provider value={value}>{children}</AgentNotificationsContext.Provider>
}

export function useAgentNotifications() {
  const context = useContext(AgentNotificationsContext)
  if (!context) {
    throw new Error("useAgentNotifications must be used inside AgentNotificationsProvider")
  }
  return context
}
