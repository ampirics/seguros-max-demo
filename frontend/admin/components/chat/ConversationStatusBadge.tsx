'use client'

import { ConversationMgmtStatus } from '@/lib/api-types'

const STATUS_CONFIG: Record<
  ConversationMgmtStatus,
  { label: string; classes: string; dot: string }
> = {
  open: {
    label: 'Abierta',
    classes: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: 'En proceso',
    classes: 'bg-warning-soft text-warning border border-warning/30',
    dot: 'bg-yellow-500',
  },
  resolved: {
    label: 'Resuelta',
    classes: 'bg-success-soft text-success border border-success/30',
    dot: 'bg-green-500',
  },
  closed: {
    label: 'Cerrada',
    classes: 'bg-gray-100 text-gray-500 border border-gray-200',
    dot: 'bg-gray-400',
  },
}

interface Props {
  status: ConversationMgmtStatus
  size?: 'sm' | 'md'
}

export default function ConversationStatusBadge({ status, size = 'sm' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${config.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

export { STATUS_CONFIG }
export type { Props as ConversationStatusBadgeProps }
