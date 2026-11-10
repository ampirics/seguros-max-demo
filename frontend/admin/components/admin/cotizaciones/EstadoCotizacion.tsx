import type { EstadoCotizacion as Estado } from '@/lib/api-types'
import { cn } from '@/lib/utils'

export const ESTADOS_COTIZACION: Record<Estado, { label: string; clase: string }> = {
  borrador: { label: 'Borrador', clase: 'bg-secondary text-foreground' },
  enviada: { label: 'Enviada', clase: 'bg-accent text-accent-foreground' },
  aceptada: { label: 'Aceptada', clase: 'bg-success-soft text-success' },
  vencida: { label: 'Vencida', clase: 'bg-warning-soft text-warning' },
  rechazada: { label: 'Rechazada', clase: 'bg-destructive-soft text-destructive' },
}

const POR_VALIDAR = { label: 'Enviada, por revisar', clase: 'bg-warning-soft text-warning' }
const POR_REVISAR = { label: 'Por revisar', clase: 'bg-warning-soft text-warning' }

export const porValidar = (c: { estado: string; origen?: string | null; validada_at?: string | null }) =>
  c.estado === 'enviada' && c.origen === 'ia' && !c.validada_at

const porRevisar = (c: { estado: string; origen?: string | null; validada_at?: string | null }) =>
  c.estado === 'borrador' && c.origen === 'ia' && !c.validada_at

export function EstadoCotizacion({ estado, cotizacion, className }: {
  estado: string
  cotizacion?: { estado: string; origen?: string | null; validada_at?: string | null }
  className?: string
}) {
  const e = cotizacion && porValidar(cotizacion) ? POR_VALIDAR
    : cotizacion && porRevisar(cotizacion) ? POR_REVISAR
    : ESTADOS_COTIZACION[estado as Estado]
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium', e?.clase ?? 'bg-secondary', className)}>
      {e?.label ?? estado}
    </span>
  )
}

export const fechaCorta = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
