'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { ConversationMgmtStatus } from '@/lib/api-types'
import ConversationStatusBadge, { STATUS_CONFIG } from './ConversationStatusBadge'
import apiClient from '@/lib/api-client'
import toast from 'react-hot-toast'

const STATUS_ORDER: ConversationMgmtStatus[] = ['open', 'in_progress', 'resolved', 'closed']

interface Props {
  conversationId: string
  currentStatus: ConversationMgmtStatus
  onStatusChange: (newStatus: ConversationMgmtStatus) => void
}

export default function StatusPicker({ conversationId, currentStatus, onStatusChange }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = async (status: ConversationMgmtStatus) => {
    if (status === currentStatus) {
      setOpen(false)
      return
    }
    setOpen(false)
    setLoading(true)
    try {
      await apiClient.updateConversationStatus(conversationId, status)
      onStatusChange(status)
      toast.success(`Estado cambiado a "${STATUS_CONFIG[status].label}"`)
    } catch {
      toast.error('No se pudo actualizar el estado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex items-center gap-1 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
        title="Estado de gestión: Abierta, En proceso, Resuelta o Cerrada. Clic para cambiarlo"
      >
        <ConversationStatusBadge status={currentStatus} size="md" />
        <ChevronDown className="w-3 h-3 text-gray-400 -ml-0.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s]
            const isActive = s === currentStatus
            return (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left ${
                  isActive ? 'font-semibold' : ''
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={isActive ? 'text-gray-900' : 'text-gray-600'}>{cfg.label}</span>
                {isActive && <span className="ml-auto text-gray-400">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
