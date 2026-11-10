"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRightLeft,
  BarChart3,
  Delete,
  Grid3x3,
  History,
  ListOrdered,
  Loader2,
  Mic,
  MicOff,
  Package,
  Pause,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { useSoftphone } from "@/hooks/use-softphone"
import type { AgentStatus, CallInfo, SoftphoneSnapshot } from "@/lib/pbx/types"
import { cn } from "@/lib/utils"

import { PanelSection, ServicePendingState } from "./panel-section"

export type Softphone = ReturnType<typeof useSoftphone>

const KEYS: Array<[string, string]> = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
]

/** Deja solo lo que la central entiende como número: dígitos, +, * y #. */
export const normalizeDialNumber = (value: string) => value.replace(/[^\d+*#]/g, "")

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return h > 0 ? `${h}:${mmss}` : mmss
}

function useElapsedSeconds(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
}

export function callStatusLabel(snapshot: SoftphoneSnapshot, elapsed: number) {
  if (snapshot.call === "dialing") return "Llamando…"
  if (snapshot.call === "ringing") return "Llamada entrante"
  if (snapshot.call === "active") return snapshot.onHold ? `En espera · ${formatDuration(elapsed)}` : formatDuration(elapsed)
  return ""
}

export const callerLabel = (info: CallInfo | null) => info?.name || info?.number || "Desconocido"

interface KeypadProps {
  onPress: (key: string) => void
  compact?: boolean
}

function Keypad({ onPress, compact }: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5 min-w-0">
      {KEYS.map(([key, letters]) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          className={cn(
            "flex flex-col items-center justify-center rounded-md border bg-card transition-colors hover:bg-secondary active:bg-accent",
            compact ? "h-9" : "h-11"
          )}
        >
          <span className="text-base font-semibold leading-none">{key}</span>
          {!compact && <span className="mt-0.5 h-2.5 text-[9px] tracking-widest text-muted-foreground">{letters}</span>}
        </button>
      ))}
    </div>
  )
}

export const AGENT_STATUSES: Array<{ value: AgentStatus; label: string; dot: string }> = [
  { value: "available", label: "Disponible", dot: "bg-green-500" },
  { value: "paused:Almuerzo", label: "Pausa: Almuerzo", dot: "bg-amber-400" },
  { value: "paused:Break", label: "Pausa: Break", dot: "bg-amber-400" },
  { value: "paused:Gestion", label: "Pausa: Gestión", dot: "bg-amber-400" },
  { value: "offline", label: "Desconectado", dot: "bg-muted-foreground/50" },
]

function AgentStatusBar({ softphone }: { softphone: Softphone }) {
  const paused = softphone.agentStatus.startsWith("paused:")
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={softphone.agentStatus}
          onValueChange={(value) => softphone.setAgentStatus(value as AgentStatus)}
          disabled={softphone.snapshot.call !== "idle"}
        >
          <SelectTrigger className="h-8 min-w-[9rem] flex-1 text-xs" aria-label="Estado del agente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value} className="text-xs">
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", status.dot)} aria-hidden />
                  {status.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span
          className="flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] text-muted-foreground"
          title="Llamadas esperando en la cola cola_whatsapp"
        >
          <ListOrdered className="h-3 w-3" />
          {softphone.queueWaitingCount === null ? "Cola — s/d" : `Cola — ${softphone.queueWaitingCount}`}
        </span>
      </div>
      {paused && (
        <p className="text-[11px] text-amber-700">
          En pausa en la cola. Las llamadas directas a tu extensión siguen entrando.
        </p>
      )}
    </div>
  )
}

/**
 * Resumen de "cola_whatsapp" a partir del evento QueueParams (unico
 * confirmado contra una respuesta real de AMI en esta version de Asterisk —
 * ver hooks/use-softphone.ts). No muestra lista de miembros ni de llamadas
 * en espera individuales: eso requeriría verificar QueueMember/QueueEntry
 * contra una cola con miembros/llamadas reales primero.
 */
function QueueStatsGrid({ softphone }: { softphone: Softphone }) {
  const params = softphone.queueParams
  if (!params) {
    return <ServicePendingState description="No se pudo consultar la cola cola_whatsapp en este momento." />
  }
  const stats: Array<[string, string]> = [
    ["En espera", params.Calls ?? "0"],
    ["Atendidas", params.Completed ?? "0"],
    ["Abandonadas", params.Abandoned ?? "0"],
    ["Espera prom.", `${params.Holdtime ?? "0"}s`],
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-md border px-2 py-1.5 text-center">
          <p className="text-sm font-semibold leading-none">{value}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}

function RegistrationBadge({ softphone }: { softphone: Softphone }) {
  const { registration } = softphone.snapshot
  const styles = {
    registered: { dot: "bg-green-500", label: "Conectado" },
    connecting: { dot: "bg-amber-400 animate-pulse", label: "Conectando…" },
    error: { dot: "bg-red-500", label: "Sin conexión" },
    disconnected: { dot: "bg-muted-foreground/40", label: "Desconectado" },
  }[registration]

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className={cn("h-2 w-2 rounded-full", styles.dot)} aria-hidden />
      <span className="font-medium">{styles.label}</span>
      {softphone.extension && <span className="text-muted-foreground">· Ext. {softphone.extension}</span>}
      {(registration === "error" || registration === "disconnected") && softphone.agentStatus !== "offline" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-xs"
          onClick={() => softphone.connect()}
        >
          <RefreshCw className="mr-1 h-3 w-3" /> Reconectar
        </Button>
      )}
    </div>
  )
}

interface ActiveCallCardProps {
  softphone: Softphone
}

export function ActiveCallCard({ softphone }: ActiveCallCardProps) {
  const { snapshot } = softphone
  const elapsed = useElapsedSeconds(snapshot.callInfo?.startedAt ?? null)
  const [showKeypad, setShowKeypad] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTarget, setTransferTarget] = useState("")
  const [transferring, setTransferring] = useState(false)
  const [dtmfSent, setDtmfSent] = useState("")

  useEffect(() => {
    if (snapshot.call === "idle") {
      setShowKeypad(false)
      setShowTransfer(false)
      setTransferTarget("")
      setTransferring(false)
      setDtmfSent("")
    }
  }, [snapshot.call])

  if (snapshot.call === "idle" || !snapshot.callInfo) return null
  const info = snapshot.callInfo
  const ringing = snapshot.call === "ringing"
  const active = snapshot.call === "active"

  return (
    <div className="rounded-lg border border-primary/30 bg-accent/40 p-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
            ringing && "animate-pulse"
          )}
        >
          {info.direction === "inbound" ? <PhoneIncoming className="h-5 w-5" /> : <PhoneOutgoing className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{callerLabel(info)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {info.name ? `${info.number} · ` : ""}
            <span className="tabular-nums">{callStatusLabel(snapshot, elapsed)}</span>
          </p>
        </div>
      </div>

      {ringing ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" variant="destructive" size="sm" onClick={() => softphone.decline()}>
            <PhoneOff className="mr-1.5 h-4 w-4" /> Rechazar
          </Button>
          <Button type="button" size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => softphone.answer()}>
            <Phone className="mr-1.5 h-4 w-4" /> Contestar
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            <CallControl
              label={snapshot.muted ? "Activar micrófono" : "Silenciar"}
              active={snapshot.muted}
              disabled={!active}
              onClick={() => softphone.toggleMute()}
            >
              {snapshot.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </CallControl>
            <CallControl
              label={snapshot.onHold ? "Reanudar" : "Espera"}
              active={snapshot.onHold}
              disabled={!active}
              onClick={() => softphone.toggleHold()}
            >
              {snapshot.onHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </CallControl>
            <CallControl
              label="Teclado"
              active={showKeypad}
              disabled={!active}
              onClick={() => setShowKeypad((v) => !v)}
            >
              <Grid3x3 className="h-4 w-4" />
            </CallControl>
            <CallControl
              label="Transferir"
              active={showTransfer}
              disabled={!active || transferring}
              onClick={() => setShowTransfer((value) => !value)}
            >
              <ArrowRightLeft className="h-4 w-4" />
            </CallControl>
            <button
              type="button"
              onClick={() => softphone.hangup()}
              className="flex h-10 items-center justify-center rounded-md bg-red-600 text-white transition-colors hover:bg-red-700"
              aria-label="Colgar"
              title="Colgar"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>

          {showKeypad && active && (
            <div className="mt-3 space-y-2">
              <p className="h-5 truncate text-center font-mono text-sm tracking-widest">{dtmfSent}</p>
              <Keypad
                compact
                onPress={(key) => {
                  setDtmfSent((v) => (v + key).slice(-16))
                  softphone.sendDTMF(key)
                }}
              />
            </div>
          )}

          {showTransfer && active && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={async (event) => {
                event.preventDefault()
                const target = normalizeDialNumber(transferTarget)
                if (!target) return
                setTransferring(true)
                try {
                  await softphone.transfer(target)
                  setShowTransfer(false)
                  setTransferTarget("")
                } catch {
                  // El hook muestra el error en el aviso común del teléfono.
                } finally {
                  setTransferring(false)
                }
              }}
            >
              <Input
                value={transferTarget}
                onChange={(event) => setTransferTarget(normalizeDialNumber(event.target.value))}
                placeholder="Extensión o número"
                inputMode="tel"
                autoFocus
                aria-label="Destino de transferencia"
              />
              <Button type="submit" size="sm" disabled={!transferTarget || transferring}>
                {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transferir"}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

function CallControl({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-10 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
      )}
    >
      {children}
    </button>
  )
}

interface SoftphonePanelProps {
  softphone: Softphone
  /** Cliente de la conversación abierta, para llamarlo con un clic. */
  customer?: { name: string; phone: string } | null
  /** Clientes de las conversaciones cargadas, para buscarlos y llamarlos. */
  contacts?: Array<{ name: string; phone: string }>
}

export function SoftphonePanel({ softphone, customer, contacts = [] }: SoftphonePanelProps) {
  const [number, setNumber] = useState("")
  const [contactQuery, setContactQuery] = useState("")
  const { snapshot, availability } = softphone

  if (availability === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando teléfono…
      </div>
    )
  }

  if (availability !== "ready") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Phone className="h-6 w-6 text-muted-foreground" />
        </div>
        {availability === "not_configured" ? (
          <>
            <h3 className="text-sm font-semibold">Teléfono sin configurar</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Esta empresa aún no tiene una central telefónica conectada.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link href="/admin/api-integrations/new">Integrar PBX</Link>
            </Button>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold">No se pudo cargar el teléfono</h3>
            <p className="mt-1 text-xs text-muted-foreground">{softphone.availabilityMessage}</p>
          </>
        )}
      </div>
    )
  }

  const canDial = snapshot.registration === "registered" && snapshot.call === "idle"

  const dial = async (target: string) => {
    const clean = normalizeDialNumber(target)
    if (!clean) return
    await softphone.call(clean)
  }

  const customerNumber = customer ? normalizeDialNumber(customer.phone) : ""
  const missedCount = softphone.callLog.filter((entry) => entry.missed).length

  const query = contactQuery.trim().toLowerCase()
  const queryDigits = normalizeDialNumber(contactQuery)
  const seenPhones = new Set<string>()
  const filteredContacts = contacts
    .map((contact) => ({ name: contact.name, phone: normalizeDialNumber(contact.phone || "") }))
    .filter((contact) => {
      if (!contact.phone || seenPhones.has(contact.phone)) return false
      seenPhones.add(contact.phone)
      if (!query) return true
      return contact.name?.toLowerCase().includes(query) || (!!queryDigits && contact.phone.includes(queryDigits))
    })
    .slice(0, 30)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b pb-2">
        <RegistrationBadge softphone={softphone} />
        {snapshot.registration === "error" && snapshot.error && (
          <p className="mt-1 text-[11px] text-red-600">{snapshot.error}</p>
        )}
        <AgentStatusBar softphone={softphone} />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="space-y-3 py-3 pr-1">
          <ActiveCallCard softphone={softphone} />

          {softphone.callError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
              <PhoneOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="flex-1">{softphone.callError}</p>
              <button type="button" onClick={softphone.clearCallError} className="font-semibold" aria-label="Cerrar aviso">
                ×
              </button>
            </div>
          )}

          {customer && customerNumber && snapshot.call === "idle" && (
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start py-2"
              disabled={!canDial}
              onClick={() => dial(customerNumber)}
            >
              <Phone className="mr-2 h-4 w-4 text-primary" />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium">Llamar a {customer.name || "cliente"}</span>
                <span className="block truncate text-xs text-muted-foreground">{customerNumber}</span>
              </span>
            </Button>
          )}

          <div>
            <PanelSection title="Marcador" icon={<Grid3x3 className="h-3.5 w-3.5" />} defaultOpen>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  dial(number)
                }}
              >
                <div className="relative">
                  <Input
                    value={number}
                    onChange={(e) => setNumber(normalizeDialNumber(e.target.value))}
                    placeholder="Número o extensión"
                    inputMode="tel"
                    className="pr-9 text-center font-mono text-base tracking-wider"
                    aria-label="Número a marcar"
                  />
                  {number && (
                    <button
                      type="button"
                      onClick={() => setNumber((v) => v.slice(0, -1))}
                      className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label="Borrar último dígito"
                    >
                      <Delete className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Keypad onPress={(key) => setNumber((v) => v + key)} />
                <Button
                  type="submit"
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                  disabled={!canDial || !number}
                >
                  <Phone className="mr-2 h-4 w-4" /> Llamar
                </Button>
              </form>
            </PanelSection>

            <PanelSection
              title="Contactos"
              icon={<Users className="h-3.5 w-3.5" />}
              badge={contacts.length > 0 ? <span className="text-[10px] font-normal normal-case">{seenPhones.size}</span> : undefined}
            >
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                  placeholder="Buscar nombre o número"
                  className="h-8 pl-8 text-xs"
                  aria-label="Buscar contacto"
                />
              </div>
              {filteredContacts.length === 0 ? (
                <p className="px-1 text-[11px] text-muted-foreground">
                  {contacts.length === 0 ? "Aún no hay conversaciones cargadas." : "Sin coincidencias."}
                </p>
              ) : (
                <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                  {filteredContacts.map((contact) => (
                    <li key={contact.phone}>
                      <button
                        type="button"
                        disabled={!canDial}
                        onClick={() => dial(contact.phone)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary disabled:opacity-60 disabled:hover:bg-transparent"
                        title={`Llamar a ${contact.phone}`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold uppercase">
                          {(contact.name || "?").trim().charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{contact.name || contact.phone}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">{contact.phone}</span>
                        </span>
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>

            <PanelSection
              title="Historial"
              icon={<History className="h-3.5 w-3.5" />}
              badge={
                missedCount > 0 ? (
                  <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">{missedCount}</span>
                ) : undefined
              }
            >
              {softphone.callLog.length === 0 ? (
                <ServicePendingState description="El historial completo de llamadas de la empresa llegará con el servicio. Aquí verás las llamadas de esta sesión." />
              ) : (
                <ul className="space-y-1">
                  {softphone.callLog.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!canDial}
                        onClick={() => dial(entry.number)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary disabled:hover:bg-transparent"
                        title={`Llamar a ${entry.number}`}
                      >
                        {entry.missed ? (
                          <PhoneMissed className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        ) : entry.direction === "inbound" ? (
                          <PhoneIncoming className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <PhoneOutgoing className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-xs font-medium", entry.missed && "text-red-600")}>
                            {entry.name || entry.number}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {new Date(entry.endedAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                            {entry.durationSec > 0 ? ` · ${formatDuration(entry.durationSec)}` : ""}
                          </span>
                        </span>
                      </button>
                      {!entry.missed && (
                        <button
                          type="button"
                          disabled
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-50"
                          title="Resumen de la llamada con IA · requiere el servicio de telefonía"
                          aria-label="Resumen de la llamada (requiere el servicio de telefonía)"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>

            <PanelSection title="Cola de espera" icon={<ListOrdered className="h-3.5 w-3.5" />}>
              <QueueStatsGrid softphone={softphone} />
            </PanelSection>

            <PanelSection title="Pedidos del cliente" icon={<Package className="h-3.5 w-3.5" />}>
              <ServicePendingState description="Pedidos recientes de quien llama, identificado por su número." />
            </PanelSection>

            <PanelSection title="Métricas" icon={<BarChart3 className="h-3.5 w-3.5" />}>
              <ServicePendingState description="Llamadas atendidas, perdidas y tiempos promedio del día." />
            </PanelSection>
          </div>
        </div>
      </div>
    </div>
  )
}
