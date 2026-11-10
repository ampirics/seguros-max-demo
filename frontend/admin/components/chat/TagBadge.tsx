'use client'

import { ChatTag } from '@/lib/api-types'

interface Props {
  tag: ChatTag
  onRemove?: () => void
  size?: 'sm' | 'md'
}

export function TagBadge({ tag, onRemove, size = 'sm' }: Props) {
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding}`}
      style={{ backgroundColor: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}55` }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:opacity-70 focus:outline-none"
          aria-label={`Quitar tag ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
