"use client"

import { Phone, PhoneIncoming, PhoneOff } from "lucide-react"

import { Button } from "@/components/ui/button"

import { callerLabel, type Softphone } from "./softphone-panel"

interface IncomingCallCardProps {
  softphone: Softphone
  onOpenPhone: () => void
}

/**
 * Aviso flotante de llamada entrante para cuando el panel del teléfono está
 * cerrado: el agente puede contestar sin perder la conversación que atiende.
 */
export function IncomingCallCard({ softphone, onOpenPhone }: IncomingCallCardProps) {
  const { snapshot } = softphone
  if (snapshot.call !== "ringing" || !snapshot.callInfo) return null
  const info = snapshot.callInfo

  return (
    <div
      role="alertdialog"
      aria-label="Llamada entrante"
      className="fixed bottom-6 right-20 z-40 w-72 rounded-xl border bg-card p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-green-100 text-green-700">
          <PhoneIncoming className="h-5 w-5" />
        </div>
        <button type="button" onClick={onOpenPhone} className="min-w-0 flex-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Llamada entrante</p>
          <p className="truncate text-sm font-semibold">{callerLabel(info)}</p>
          {info.name && <p className="truncate text-xs text-muted-foreground">{info.number}</p>}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="destructive" size="sm" onClick={() => softphone.decline()}>
          <PhoneOff className="mr-1.5 h-4 w-4" /> Rechazar
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-green-600 text-white hover:bg-green-700"
          onClick={() => {
            softphone.answer()
            onOpenPhone()
          }}
        >
          <Phone className="mr-1.5 h-4 w-4" /> Contestar
        </Button>
      </div>
    </div>
  )
}
