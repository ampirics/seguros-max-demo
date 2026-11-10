'use client'

import React from 'react'
import { User } from 'lucide-react'

interface AssigneeBadgeProps {
  assignedToId?: string | null
  assignedToName?: string | null
  size?: 'sm' | 'md'
}

export function AssigneeBadge({ assignedToId, assignedToName, size = 'sm' }: AssigneeBadgeProps) {
  if (!assignedToId) {
    return (
      <span className={`inline-flex items-center gap-1 text-gray-400 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        <User className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        <span>Sin asignar</span>
      </span>
    )
  }

  const initials = (assignedToName || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <span
        className={`inline-flex items-center justify-center rounded-full bg-indigo-500 text-white font-semibold flex-shrink-0 ${
          size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs'
        }`}
      >
        {initials}
      </span>
      <span className="text-gray-700 truncate max-w-[120px]">{assignedToName}</span>
    </span>
  )
}
