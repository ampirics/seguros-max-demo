/**
 * Helper para correr jobs asíncronos de sincronización SAP.
 *
 * Flujo:
 * 1. POST al endpoint async → recibe { job_id, ws_channel, status_url }.
 * 2. Conecta WebSocket al canal del job y traduce los mensajes a callbacks.
 * 3. Si el WS falla, cae a polling del status_url.
 * 4. Devuelve una Promise que se resuelve con el `result` del evento
 *    `completed` o rechaza con el payload del evento `failed`.
 */
import { wsAuthProtocols } from "@/lib/ws-auth"
import { apiClient } from "./api-client"
import { config } from "./config"

export interface SapSyncProgress {
  current: number
  total: number
  message?: string | null
}

export interface SapSyncStartResponse {
  job_id: string
  status: string
  status_url: string
  ws_channel: string
}

export interface SapSyncRunOptions {
  onStarted?: (data: any) => void
  onProgress?: (progress: SapSyncProgress) => void
  onCompleted?: (result: any) => void
  onFailed?: (errorPayload: any) => void
  /** Polling fallback period in ms (default 3000). */
  pollIntervalMs?: number
}

function buildWsUrl(path: string): string | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(config.auth.tokenKey)
  if (!token) return null

  const apiBase = config.api.baseUrl
  let host: string
  let protocol: string
  try {
    const u = new URL(apiBase)
    host = u.host
    protocol = u.protocol === "https:" ? "wss" : "ws"
  } catch {
    host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host
    protocol = window.location.protocol === "https:" ? "wss" : "ws"
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  // El token va en el subprotocolo (ver lib/ws-auth), no en la URL.
  return `${protocol}://${host}${normalizedPath}`
}

/**
 * Dispara un job de sync SAP y espera a que termine.
 */
export async function runSapSyncJob(
  endpoint: string,
  payload: Record<string, any>,
  opts: SapSyncRunOptions = {},
): Promise<any> {
  const start = (await apiClient.post(endpoint, payload)) as SapSyncStartResponse
  if (!start || !start.job_id) {
    throw new Error("Backend no devolvió job_id para sync SAP")
  }

  return await waitForSapSyncJob(start, opts)
}

export async function waitForSapSyncJob(
  start: SapSyncStartResponse,
  opts: SapSyncRunOptions = {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false
    const wsUrl = buildWsUrl(start.ws_channel)
    let socket: WebSocket | null = null
    let pollTimer: any = null

    const cleanup = () => {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
      if (socket && socket.readyState <= 1) {
        try { socket.close() } catch {}
      }
      socket = null
    }

    const succeed = (result: any) => {
      if (settled) return
      settled = true
      cleanup()
      opts.onCompleted?.(result)
      resolve(result)
    }
    const fail = (err: any) => {
      if (settled) return
      settled = true
      cleanup()
      opts.onFailed?.(err)
      reject(err)
    }

    const handleEvent = (data: any) => {
      const t = data?.type
      if (t === "started") {
        opts.onStarted?.(data)
      } else if (t === "progress") {
        opts.onProgress?.({
          current: Number(data.current ?? 0),
          total: Number(data.total ?? 0),
          message: data.message ?? null,
        })
      } else if (t === "completed") {
        succeed(data.result ?? null)
      } else if (t === "failed") {
        fail(data)
      }
    }

    const startPolling = () => {
      if (pollTimer) return
      const interval = opts.pollIntervalMs ?? 3000
      pollTimer = setInterval(async () => {
        try {
          const status = await apiClient.get(start.status_url.replace("/api/v1", ""))
          if (!status) return
          if (status.progress_total || status.progress_current) {
            opts.onProgress?.({
              current: Number(status.progress_current ?? 0),
              total: Number(status.progress_total ?? 0),
              message: status.progress_message ?? null,
            })
          }
          if (status.status === "completed") {
            succeed(status.result ?? null)
          } else if (status.status === "failed") {
            fail({ type: "failed", error: "job_failed", errors: status.errors })
          }
        } catch (e) {
          console.warn("[sap-sync] polling error:", e)
        }
      }, interval)
    }

    if (wsUrl) {
      try {
        socket = new WebSocket(wsUrl, wsAuthProtocols(config.auth.tokenKey))
        socket.onmessage = (ev) => {
          try { handleEvent(JSON.parse(ev.data)) } catch (e) {
            console.warn("[sap-sync] ws bad message:", e)
          }
        }
        socket.onerror = () => {
          console.warn("[sap-sync] ws error, falling back to polling")
          startPolling()
        }
        socket.onclose = () => {
          if (!settled) startPolling()
        }
      } catch (e) {
        console.warn("[sap-sync] ws init failed, polling instead:", e)
        startPolling()
      }
    } else {
      startPolling()
    }
  })
}
