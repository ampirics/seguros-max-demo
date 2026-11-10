import Link from 'next/link'
import { CalendarClock, FileText, MessageSquare, ShoppingCart, StickyNote, type LucideIcon } from 'lucide-react'
import { EstadoCotizacion } from '@/components/admin/cotizaciones/EstadoCotizacion'
import { ESTADO_CITA } from '@/components/admin/agenda/CitaFicha'
import { Existencia, PiezaFoto } from '@/components/chat/PiezaCards'
import type { EventoCronograma, PlanMantenimientoItem } from '@/lib/api-types'
import { cn, formatCurrency, nombrePieza } from '@/lib/utils'

export const km = (n: number) => `${n.toLocaleString('en-US')} km`

const TIPO: Record<EventoCronograma['tipo'], { label: string; icon: LucideIcon; clase: string }> = {
  consulta: { label: 'Consulta', icon: MessageSquare, clase: 'bg-accent text-accent-foreground' },
  cotizacion: { label: 'Cotización', icon: FileText, clase: 'bg-secondary text-foreground' },
  venta: { label: 'Venta', icon: ShoppingCart, clase: 'bg-success-soft text-success' },
  nota: { label: 'Nota', icon: StickyNote, clase: 'bg-warning-soft text-warning' },
  cita: { label: 'Cita', icon: CalendarClock, clase: 'bg-secondary text-foreground' },
}

const CANAL: Record<EventoCronograma['canal'], string> = {
  whatsapp: 'WhatsApp',
  llamada: 'Llamada',
  mostrador: 'Mostrador',
  tienda_web: 'Tienda web',
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

const enlace = 'font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none'

export function Cronograma({ eventos }: { eventos: EventoCronograma[] }) {
  if (eventos.length === 0) return <p className="text-sm text-muted-foreground">Este vehículo todavía no tiene atenciones.</p>
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
      {eventos.map((e, i) => {
        const t = TIPO[e.tipo] ?? TIPO.consulta
        const Icon = t.icon
        return (
          <li key={`${e.fecha}-${i}`} className="relative flex gap-3">
            <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card', t.clase)} aria-hidden>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{t.label}</span>
                <span className="rounded bg-secondary px-1.5 text-[11px] leading-5 text-muted-foreground">{CANAL[e.canal] ?? e.canal}</span>
                {e.estado && <EstadoCotizacion estado={e.estado} />}
                {e.cita_estado && (
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ESTADO_CITA[e.cita_estado].clase)}>{ESTADO_CITA[e.cita_estado].label}</span>
                )}
                <time dateTime={e.fecha} className="ml-auto text-xs text-muted-foreground">{fecha(e.fecha)}</time>
              </div>
              {e.detalle && <p className="mt-1 break-words text-sm">{e.detalle}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{e.atendio}</span>
                {e.km != null && <span>· {km(e.km)}</span>}
                {e.monto_dop != null && <span className="font-medium tabular-nums text-foreground">· {formatCurrency(e.monto_dop)}</span>}
                {e.conversacion_id && <Link href={`/admin/chat?conversation=${e.conversacion_id}`} className={enlace}>Ver conversación</Link>}
                {e.cotizacion_id && <Link href={`/admin/cotizaciones/${e.cotizacion_id}`} className={enlace}>Ver {e.cotizacion_id}</Link>}
                {e.orden_id && <Link href={`/admin/orders?orden=${e.orden_id}`} className={enlace}>Ver orden {e.orden_numero}</Link>}
                {e.cita_estado && <Link href="/admin/calendario" className={enlace}>Ver en el calendario</Link>}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const PRIORIDAD: Record<PlanMantenimientoItem['prioridad'], { label: string; clase: string }> = {
  alta: { label: 'Urgente', clase: 'bg-destructive-soft text-destructive' },
  media: { label: 'Pronto', clase: 'bg-warning-soft text-warning' },
  baja: { label: 'Al día', clase: 'bg-success-soft text-success' },
}

export function PlanMantenimiento({ items }: { items: PlanMantenimientoItem[] }) {
  return (
    <ul className="divide-y">
      {items.map((it) => {
        const p = it.proximo_km == null && it.ultimo_km == null ? { label: 'Revisar', clase: 'bg-secondary text-foreground' } : PRIORIDAD[it.prioridad]
        return (
          <li key={it.clave} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{it.descripcion}</p>
                <p className="text-xs text-muted-foreground">
                  {it.cuando}{it.cada_km > 0 && !it.cuando.startsWith('cada') && <> · cada {km(it.cada_km)}</>}
                  {it.ultimo_km != null && <> · último a {km(it.ultimo_km)}</>}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', p.clase)}>{p.label}</span>
            </div>
            {it.pieza ? (
              <Link href={`/admin/piezas/${it.pieza.id}`}
                className="flex items-center gap-2.5 rounded-md border p-1.5 outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                <PiezaFoto pieza={it.pieza} className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs font-medium leading-snug">{nombrePieza(it.pieza.nombre)}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className="font-semibold tabular-nums">{formatCurrency(it.pieza.precio_dop)}</span>
                    <Existencia disponible={it.pieza.disponible} />
                  </span>
                </span>
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">Sin pieza en el catálogo para este vehículo.</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
