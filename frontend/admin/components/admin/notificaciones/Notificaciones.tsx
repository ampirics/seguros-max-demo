'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlarmClock, Bell, BellRing, CalendarClock, CalendarPlus, ChefHat, FileCheck, ListOrdered, MessageSquareWarning, PackageCheck, PackageMinus, PackageSearch, PackageX, Store, TimerOff, TrendingDown, UserPlus, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { apiClient } from '@/lib/api-client'
import type { Notificacion, TipoNotificacion } from '@/lib/api-types'
import { cn } from '@/lib/utils'

export const TIPO_NOTIF: Record<TipoNotificacion, { label: string; icon: LucideIcon; clase: string }> = {
  nuevo_lead: { label: 'Nuevos leads', icon: UserPlus, clase: 'bg-accent text-accent-foreground' },
  mensaje_sin_responder: { label: 'Sin responder', icon: MessageSquareWarning, clase: 'bg-warning-soft text-warning' },
  pieza_no_encontrada: { label: 'Sin existencia', icon: PackageX, clase: 'bg-destructive-soft text-destructive' },
  sla_por_vencer: { label: 'SLA', icon: AlarmClock, clase: 'bg-destructive-soft text-destructive' },
  cita_proxima: { label: 'Citas', icon: CalendarClock, clase: 'bg-secondary text-foreground' },
  cotizacion_por_validar: { label: 'Por validar', icon: FileCheck, clase: 'bg-accent text-accent-foreground' },
  reserva: { label: 'Reservas', icon: PackageCheck, clase: 'bg-accent text-accent-foreground' },
  reserva_vencida: { label: 'Reserva vencida', icon: TimerOff, clase: 'bg-warning-soft text-warning' },
  stock_bajo: { label: 'Existencia baja', icon: PackageMinus, clase: 'bg-warning-soft text-warning' },
  se_acaba: { label: 'Se acaba', icon: TrendingDown, clase: 'bg-warning-soft text-warning' },
  pedida_sin_existencia: { label: 'Piden y no hay', icon: PackageSearch, clase: 'bg-destructive-soft text-destructive' },
  visita_sucursal: { label: 'Visitas', icon: Store, clase: 'bg-accent text-accent-foreground' },
}

// Avisos de la vertical restaurante (vienen del servidor del restaurante en el modo demo).
export const TIPO_NOTIF_RESTAURANTE: Record<string, { label: string; icon: LucideIcon; clase: string }> = {
  reserva_nueva: { label: 'Reservas nuevas', icon: CalendarPlus, clase: 'bg-accent text-accent-foreground' },
  espera_equipo: { label: 'Esperan al equipo', icon: MessageSquareWarning, clase: 'bg-warning-soft text-warning' },
  sin_confirmar: { label: 'Sin confirmar', icon: CalendarClock, clase: 'bg-warning-soft text-warning' },
  lista_espera: { label: 'Lista de espera', icon: ListOrdered, clase: 'bg-secondary text-foreground' },
  plato_tarde: { label: 'Cocina', icon: ChefHat, clase: 'bg-destructive-soft text-destructive' },
  llamado_mesa: { label: 'Llamados', icon: BellRing, clase: 'bg-destructive-soft text-destructive' },
}

const tipoDe = (tipo: string) => TIPO_NOTIF[tipo as TipoNotificacion] ?? TIPO_NOTIF_RESTAURANTE[tipo] ?? TIPO_NOTIF.mensaje_sin_responder

// A dónde lleva cada aviso dentro del panel.
export function destino(n: Notificacion) {
  const r = n as Notificacion & { reserva_id?: string | null; mesa_id?: string | null }
  if (n.tipo in TIPO_NOTIF_RESTAURANTE) {
    if (r.reserva_id) return `/admin/reservaciones/${r.reserva_id}`
    if (r.mesa_id) return `/admin/salon/mesas/${r.mesa_id}`
    if ((n.tipo as string) === 'plato_tarde') return '/admin/cocina'
    return n.conversacion_id ? `/admin/chat?conversation=${n.conversacion_id}` : '/admin/reservaciones'
  }
  if (n.tipo === 'cita_proxima') return '/admin/calendario'
  if (n.tipo === 'stock_bajo') return '/admin/existencias?bajo_minimo=1'
  if (n.tipo === 'se_acaba' || n.tipo === 'pedida_sin_existencia') return '/admin/estadisticas'
  if (n.tipo === 'visita_sucursal') return '/admin/calendario?hoy=1'
  if ((n.tipo === 'reserva' || n.tipo === 'reserva_vencida') && !n.conversacion_id) return '/admin/reservas'
  if (n.tipo === 'pieza_no_encontrada') return n.busqueda_id ? `/admin/busqueda-externa?b=${n.busqueda_id}` : '/admin/busqueda-externa'
  if (n.tipo === 'nuevo_lead' || (n.tipo === 'sla_por_vencer' && !n.conversacion_id)) return '/admin/leads'
  return n.conversacion_id ? `/admin/chat?conversation=${n.conversacion_id}` : '/admin/leads'
}

export function useNotificaciones(params?: Record<string, string | undefined>, cadaMs = 30_000) {
  const [datos, setDatos] = useState<{ items: Notificacion[]; no_leidas: number } | null>(null)
  const [error, setError] = useState(false)
  const clave = JSON.stringify(params ?? {})
  const cargar = useCallback(() => {
    apiClient
      .get<{ items: Notificacion[]; no_leidas?: number }>('/notificaciones', params)
      .then((r) => { setDatos({ items: r.items, no_leidas: r.no_leidas ?? r.items.filter((n) => !n.leida).length }); setError(false) })
      .catch(() => setError(true))
  }, [clave])
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, cadaMs)
    return () => clearInterval(t)
  }, [cargar, cadaMs])
  const marcar = async (id: string) => {
    setDatos((d) => d && { no_leidas: Math.max(0, d.no_leidas - (d.items.find((n) => n.id === id && !n.leida) ? 1 : 0)), items: d.items.map((n) => (n.id === id ? { ...n, leida: true } : n)) })
    await apiClient.post(`/notificaciones/${id}/leida`).catch(() => cargar())
  }
  const marcarTodas = async () => {
    setDatos((d) => d && { no_leidas: 0, items: d.items.map((n) => ({ ...n, leida: true })) })
    await apiClient.post('/notificaciones/leer-todas').catch(() => cargar())
  }
  return { datos, error, cargar, marcar, marcarTodas }
}

export function FilaNotificacion({ n, onAbrir, compacta }: { n: Notificacion; onAbrir: (n: Notificacion) => void; compacta?: boolean }) {
  const t = tipoDe(n.tipo)
  const Icon = t.icon
  return (
    <button
      type="button"
      onClick={() => onAbrir(n)}
      className={cn('flex w-full items-start gap-3 text-left outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary', compacta ? 'px-3 py-2.5' : 'px-4 py-3', n.leida && 'opacity-70')}
    >
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', t.clase)} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug', !n.leida && 'font-medium')}>{n.titulo}</span>
        {n.detalle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.detalle}</span>}
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatDistanceToNowStrict(new Date(n.creada), { addSuffix: true, locale: es })}</span>
      </span>
      {!n.leida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />}
    </button>
  )
}

export function CampanaNotificaciones() {
  const router = useRouter()
  const [abierta, setAbierta] = useState(false)
  const { datos, cargar, marcar, marcarTodas } = useNotificaciones({ limit: '6' })
  const pendientes = datos?.no_leidas ?? 0

  const abrir = (n: Notificacion) => {
    marcar(n.id)
    setAbierta(false)
    router.push(destino(n))
  }

  return (
    <Popover open={abierta} onOpenChange={(o) => { setAbierta(o); if (o) cargar() }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={pendientes ? `Notificaciones: ${pendientes} sin leer` : 'Notificaciones'}>
          <Bell aria-hidden />
          {pendientes > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {pendientes > 9 ? '9+' : pendientes}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notificaciones</p>
          {pendientes > 0 && (
            <button type="button" onClick={marcarTodas} className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
              Marcar todas como leídas
            </button>
          )}
        </div>
        {!datos ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : datos.items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No hay avisos pendientes.</p>
        ) : (
          <ul className="max-h-[60dvh] divide-y overflow-y-auto">
            {datos.items.map((n) => <li key={n.id}><FilaNotificacion n={n} onAbrir={abrir} compacta /></li>)}
          </ul>
        )}
        <Link href="/admin/notificaciones" onClick={() => setAbierta(false)}
          className="block border-t px-3 py-2 text-center text-sm font-medium text-primary hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:outline-none">
          Ver todas
        </Link>
      </PopoverContent>
    </Popover>
  )
}
