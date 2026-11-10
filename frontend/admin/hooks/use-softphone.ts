"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { apiClient } from "@/lib/api-client"
import { INITIAL_SNAPSHOT, SoftphoneClient } from "@/lib/pbx/softphone-client"
import type { AgentStatus, CallLogEntry, PBXConnectionConfig, SoftphoneSnapshot } from "@/lib/pbx/types"

interface PBXConnectionResponse {
  sip_server: string
  sip_domain: string
  sip_extension: string
  sip_password: string
}

export type SoftphoneAvailability = "loading" | "ready" | "not_configured" | "incomplete" | "error"

const MAX_CALL_LOG = 50

/** Traduce fallos de WebRTC a algo que el agente pueda resolver. */
const describeCallError = (error: unknown) => {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (name === "NotAllowedError" || /permission denied/i.test(message)) {
    return "El navegador bloqueó el micrófono. Permite el acceso al micrófono para este sitio y vuelve a intentar."
  }
  if (name === "NotFoundError" || /requested device not found/i.test(message)) {
    return "No se encontró un micrófono conectado."
  }
  return message || "No se pudo completar la llamada"
}

/**
 * Carga la conexión PBX de la empresa activa y mantiene un SoftphoneClient
 * registrado mientras el componente esté montado. Las credenciales solo viven
 * en memoria: nunca se guardan en localStorage.
 */
export function useSoftphone() {
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const clientRef = useRef<SoftphoneClient | null>(null)
  const [availability, setAvailability] = useState<SoftphoneAvailability>("loading")
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)
  const [extension, setExtension] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<SoftphoneSnapshot>(INITIAL_SNAPSHOT)
  const [callLog, setCallLog] = useState<CallLogEntry[]>([])
  const [agentStatus, setAgentStatusState] = useState<AgentStatus>("available")
  const [callError, setCallError] = useState<string | null>(null)
  const [queueWaitingCount, setQueueWaitingCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        // Sin sesión (p. ej. en el login) no hay nada que pedir. Y antes de pedir la
        // conexión (que incluye la contraseña SIP) se consulta el estado: en
        // empresas sin central, /connection devolvía 404 en cada página.
        if (typeof window !== "undefined" && !localStorage.getItem("auth_token")) {
          setAvailability("not_configured")
          return
        }
        const estado = await apiClient.get<{ configured: boolean; extension_assigned: boolean }>("/pbx-config/status")
        if (cancelled) return
        if (!estado.configured) {
          setAvailability("not_configured")
          return
        }
        if (!estado.extension_assigned) {
          setAvailability("incomplete")
          setAvailabilityMessage("No tienes una extensión SIP asignada. Pídele al administrador que configure tu extensión en tu perfil de usuario.")
          return
        }
        const connection = await apiClient.get<PBXConnectionResponse>("/pbx-config/connection")
        if (cancelled) return
        const config: PBXConnectionConfig = {
          sipServer: connection.sip_server,
          sipDomain: connection.sip_domain,
          sipExtension: connection.sip_extension,
          sipPassword: connection.sip_password,
        }
        const client = new SoftphoneClient(config, () => remoteAudioRef.current, {
          onChange: (next) => {
            if (!cancelled) setSnapshot(next)
          },
          onCallEnded: (entry) => {
            if (!cancelled) setCallLog((log) => [entry, ...log].slice(0, MAX_CALL_LOG))
          },
        })
        clientRef.current = client
        setExtension(config.sipExtension)
        setAvailability("ready")
        client.connect()
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : ""
        // 404 sin integración PBX global → no configurado
        if (message.includes("integración PBX activa")) {
          setAvailability("not_configured")
        // 404 sin extensión asignada al usuario → incompleto con mensaje claro
        } else if (message.includes("extensión SIP asignada")) {
          setAvailability("incomplete")
          setAvailabilityMessage("No tienes una extensión SIP asignada. Pídele al administrador que configure tu extensión en tu perfil de usuario.")
        } else if (message.startsWith("Configuración PBX incompleta")) {
          setAvailability("incomplete")
          setAvailabilityMessage(message)
        } else {
          setAvailability("error")
          setAvailabilityMessage(message || "No se pudo cargar la configuración del teléfono")
        }
      }
    }

    load()
    return () => {
      cancelled = true
      clientRef.current?.disconnect()
      clientRef.current = null
    }
  }, [])

  // Estado de la cola. GET /pbx/queue/status devuelve el AMI QueueStatus
  // crudo (una lista de eventos); lo que se usa aqui es el evento
  // QueueParams, unico verificado contra una respuesta real de AMI (Calls,
  // Holdtime, Completed, Abandoned...). No se intenta parsear QueueMember/
  // QueueEntry por miembro/llamador porque no hay una respuesta real con
  // miembros o llamadas para confirmar esos nombres de campo en esta
  // version de Asterisk -- verificar antes de usarlos.
  //
  // Se refresca solo (cada 15s) mientras el softphone este listo -- todavia
  // no hay un evento pbx.queue.update real emitido por el backend (solo
  // pbx.agent.presence), asi que no hay nada mas fino a lo que suscribirse.
  const [queueParams, setQueueParams] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    if (availability !== "ready") return
    let cancelled = false

    const refreshQueueCount = async () => {
      try {
        const response = await apiClient.get<{ status: string; data: Array<Record<string, string>> }>(
          "/pbx/queue/status",
        )
        if (cancelled) return
        const params = response.data?.find((event) => event.Event === "QueueParams") ?? null
        setQueueParams(params)
        const calls = params ? Number.parseInt(params.Calls ?? "", 10) : NaN
        setQueueWaitingCount(Number.isFinite(calls) ? calls : null)
      } catch {
        if (!cancelled) {
          setQueueParams(null)
          setQueueWaitingCount(null)
        }
      }
    }

    refreshQueueCount()
    const interval = window.setInterval(refreshQueueCount, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [availability])

  const withClient = useCallback(
    <T,>(action: (client: SoftphoneClient) => T): T | undefined => {
      const client = clientRef.current
      return client ? action(client) : undefined
    },
    [],
  )

  /**
   * "Desconectado" quita el registro SIP de verdad (no entran llamadas).
   * Además de eso, se llama a POST /pbx/agent/presence para reflejar el
   * estado en la cola de Asterisk vía AMI (QueueAdd/QueuePause/QueueRemove
   * según el caso — ver app/api/v1/pbx.py). Si esa llamada falla (el
   * servicio de telefonía no está activo para esta empresa, o hay un error
   * de red), el estado local igual cambia: es mejor que el agente vea su
   * selección aunque la cola no se haya podido actualizar, a que la UI se
   * quede congelada esperando una respuesta que puede no llegar.
   */
  const setAgentStatus = useCallback((next: AgentStatus) => {
    setAgentStatusState(next)
    const client = clientRef.current
    if (!client) return
    if (next === "offline") {
      client.disconnect()
    } else if (client.getSnapshot().registration !== "registered") {
      client.connect()
    }

    const currentExtension = extension
    if (!currentExtension) return
    apiClient
      .post("/pbx/agent/presence", { extension: currentExtension, status: next })
      .catch((error) => {
        console.error("No se pudo actualizar la presencia en la cola:", error)
      })
  }, [extension])

  const call = useCallback(async (number: string) => {
    const client = clientRef.current
    if (!client) return
    setCallError(null)
    try {
      await client.call(number)
    } catch (error) {
      setCallError(describeCallError(error))
    }
  }, [])

  const answer = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    setCallError(null)
    try {
      await client.answer()
    } catch (error) {
      setCallError(describeCallError(error))
      client.decline()
    }
  }, [])

  const transfer = useCallback(async (target: string) => {
    const client = clientRef.current
    if (!client) return
    setCallError(null)
    try {
      await client.transfer(target)
    } catch (error) {
      setCallError(describeCallError(error))
      throw error
    }
  }, [])

  return {
    availability,
    callError,
    clearCallError: useCallback(() => setCallError(null), []),
    agentStatus,
    setAgentStatus,
    queueWaitingCount,
    queueParams,
    availabilityMessage,
    extension,
    snapshot,
    callLog,
    remoteAudioRef,
    connect: useCallback(() => withClient((c) => c.connect()), [withClient]),
    disconnect: useCallback(() => withClient((c) => c.disconnect()), [withClient]),
    call,
    answer,
    decline: useCallback(() => withClient((c) => c.decline()), [withClient]),
    hangup: useCallback(() => withClient((c) => c.hangup()), [withClient]),
    toggleMute: useCallback(() => withClient((c) => c.toggleMute()), [withClient]),
    toggleHold: useCallback(() => withClient((c) => c.toggleHold()), [withClient]),
    sendDTMF: useCallback((tone: string) => withClient((c) => c.sendDTMF(tone)), [withClient]),
    transfer,
  }
}
