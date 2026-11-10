// Tipos del softphone del backoffice (SIP sobre WebSocket con SIP.js)

export interface PBXConnectionConfig {
  sipServer: string // wss://...
  sipDomain: string
  sipExtension: string
  sipPassword: string
}

export type RegistrationState = "disconnected" | "connecting" | "registered" | "error"

export type CallState = "idle" | "dialing" | "ringing" | "active"

export type CallDirection = "outbound" | "inbound"

export interface CallInfo {
  direction: CallDirection
  number: string
  name: string | null
  startedAt: number | null // ms desde que se estableció la llamada
}

export interface SoftphoneSnapshot {
  registration: RegistrationState
  error: string | null
  call: CallState
  callInfo: CallInfo | null
  muted: boolean
  onHold: boolean
}

/** Estado del agente frente a la cola (igual que el softphone de referencia). */
export type AgentStatus = "available" | "paused:Almuerzo" | "paused:Break" | "paused:Gestion" | "offline"

export interface CallLogEntry {
  id: string
  direction: CallDirection
  number: string
  name: string | null
  missed: boolean
  endedAt: number
  durationSec: number
}
