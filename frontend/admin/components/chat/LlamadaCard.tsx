'use client'

import { useState } from 'react'
import { ChevronDown, PhoneCall } from 'lucide-react'
import type { ChatMessage } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const RESULTADO_LLAMADA: Record<string, { label: string; clase: string }> = {
  cotizado: { label: 'Cotizado', clase: 'bg-success-soft text-success' },
  quiere_comprar: { label: 'Quiere comprar', clase: 'bg-success-soft text-success' },
  sin_existencia: { label: 'Sin existencia', clase: 'bg-destructive-soft text-destructive' },
  pidio_vendedor: { label: 'Pidió vendedor', clase: 'bg-warning-soft text-warning' },
  informacion: { label: 'Información', clase: 'bg-secondary text-foreground' },
  sin_datos: { label: 'Sin datos', clase: 'bg-secondary text-muted-foreground' },
}

export function LlamadaCard({ message }: { message: ChatMessage }) {
  const meta = message.metadata || {}
  const resultado = RESULTADO_LLAMADA[meta.resultado as string]
  const turnos: { autor: string; texto: string; seg?: number }[] = Array.isArray(meta.transcripcion_llamada) ? meta.transcripcion_llamada : []
  const [abierta, setAbierta] = useState(false)
  return (
    <div className="w-80 max-w-full space-y-1.5">
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <PhoneCall className="h-3.5 w-3.5" aria-hidden /> Llamada atendida por la IA
        {resultado && <span className={cn('rounded px-1.5 leading-4', resultado.clase)}>{resultado.label}</span>}
        {meta.transferida && <span className="rounded bg-accent px-1.5 leading-4 text-accent-foreground">Transferida</span>}
      </p>
      <p className="whitespace-pre-line text-sm">{message.message}</p>
      {meta.seguimiento && <p className="text-xs text-muted-foreground">Seguimiento: {meta.seguimiento}</p>}
      {turnos.length > 0 && (
        <div>
          <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none">
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', abierta && 'rotate-180')} aria-hidden />
            {abierta ? 'Ocultar transcripción' : 'Ver transcripción'}
          </button>
          {abierta && (
            <ol className="mt-1.5 space-y-1 rounded-md bg-secondary/70 p-2 text-[13px]">
              {turnos.map((t, i) => (
                <li key={i}><span className="font-medium">{t.autor === 'cliente' ? 'Cliente' : 'IA'}:</span> {t.texto}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
