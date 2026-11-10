'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const ETIQUETAS: Record<string, string> = {
  entendio: 'Qué entendió',
  filtros: 'Qué buscó',
  resultados: 'Resultados',
  regla: 'Regla',
  compatibilidad: 'Compatibilidad',
  modelo: 'Modelo',
  latencia_ms: 'Tardó',
  costo_usd: 'Costo',
}

const SUBCLAVES: Record<string, string> = {
  tipo: 'tipo', pieza: 'pieza', marca: 'marca', modelo: 'modelo', anio: 'año', motor: 'motor', version: 'versión',
  q: 'texto', modo: 'modo',
}

function valor(clave: string, v: unknown): string {
  if (v == null || v === '') return '—'
  if (clave === 'latencia_ms' && typeof v === 'number') return v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(1)} s`
  if (clave === 'costo_usd' && typeof v === 'number') return `US$${v < 0.01 ? v.toFixed(5) : v.toFixed(3)}`
  if (clave === 'compatibilidad' && typeof v === 'number') return `${Math.round(v)} %`
  if (Array.isArray(v)) return v.map((x) => valor('', x)).join(', ')
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x != null && x !== '')
      .map(([k, x]) => `${SUBCLAVES[k] ?? k}: ${valor(k, x)}`)
      .join(' · ') || '—'
  }
  return String(v)
}

export function IaDetalle({ detalle }: { detalle: Record<string, unknown> }) {
  const [abierto, setAbierto] = useState(false)
  const claves = [...Object.keys(ETIQUETAS).filter((k) => k in detalle), ...Object.keys(detalle).filter((k) => !(k in ETIQUETAS))]
  if (!claves.length) return null
  return (
    <div className="mt-1.5 text-[11px]">
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
        <ChevronDown className={cn('h-3 w-3 transition-transform', abierto && 'rotate-180')} aria-hidden />
        Por qué respondió esto
      </button>
      {abierto && (
        <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md bg-secondary/60 p-2">
          {claves.map((k) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{ETIQUETAS[k] ?? k}</dt>
              <dd className="break-words text-foreground">{valor(k, detalle[k])}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
