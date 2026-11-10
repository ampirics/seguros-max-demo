'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Phone, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { apiClient } from '@/lib/api-client'
import type { Cita } from '@/lib/api-types'
import { aCita, estadoApi } from '@/lib/api/agenda'
import { cn } from '@/lib/utils'

export const ESTADO_CITA: Record<Cita['estado'], { label: string; clase: string }> = {
  programada: { label: 'Programada', clase: 'bg-accent text-accent-foreground' },
  completada: { label: 'Completada', clase: 'bg-success-soft text-success' },
  no_asistio: { label: 'No asistió', clase: 'bg-warning-soft text-warning' },
  cancelada: { label: 'Cancelada', clase: 'bg-secondary text-muted-foreground' },
}

export const TIPO_CITA = {
  visita: { label: 'Visita a la tienda', icon: Store },
  llamada: { label: 'Llamada', icon: Phone },
}

const ORIGEN: Record<Cita['origen'], string> = {
  whatsapp: 'WhatsApp',
  llamada: 'Llamada',
  mostrador: 'Mostrador',
  tienda_web: 'Tienda web',
  panel: 'Panel',
  ia: 'IA (WhatsApp o llamada)',
  tienda: 'Tienda en línea',
}

export const horaCita = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })
const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  )
}

export function CitaFicha({ cita, onCerrar, onCambio }: { cita: Cita | null; onCerrar: () => void; onCambio: (c: Cita) => void }) {
  const [guardando, setGuardando] = useState(false)

  const cambiar = async (estado: Cita['estado'], aviso: string) => {
    if (!cita) return
    setGuardando(true)
    try {
      onCambio(aCita(await apiClient.request<Cita>(`/agenda/citas/${cita.id}`, { method: 'PATCH', body: JSON.stringify({ estado: estadoApi(estado) }) })))
      toast.success(aviso)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const Icon = cita ? TIPO_CITA[cita.tipo].icon : Store
  const estado = cita ? ESTADO_CITA[cita.estado] ?? ESTADO_CITA.programada : null

  return (
    <Sheet open={!!cita} onOpenChange={(abierta) => { if (!abierta) onCerrar() }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {cita && estado && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-muted-foreground" aria-hidden /> {cita.cliente ?? cita.telefono ?? 'Cliente'}</SheetTitle>
              <SheetDescription>{cita.motivo || TIPO_CITA[cita.tipo].label}</SheetDescription>
            </SheetHeader>
            <span className={cn('mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', estado.clase)}>{estado.label}</span>

            <dl className="mt-4 divide-y">
              <Fila label="Tipo">{TIPO_CITA[cita.tipo].label}</Fila>
              <Fila label="Cuándo"><span className="inline-block first-letter:uppercase">{fechaLarga(cita.inicio)}</span>, {horaCita(cita.inicio)} a {horaCita(cita.fin)}</Fila>
              <Fila label="Vendedor">{cita.vendedor ?? '—'}</Fila>
              <Fila label="Sucursal">{cita.sucursal ?? '—'}</Fila>
              {cita.llego_at && <Fila label="Llegó">{horaCita(cita.llego_at)}</Fila>}
              {cita.cotizacion_codigo && <Fila label="Cotización">{cita.cotizacion_codigo}</Fila>}
              <Fila label="Teléfono">{cita.telefono || '—'}</Fila>
              <Fila label="Agendada por">{ORIGEN[cita.origen] ?? cita.origen}</Fila>
              <Fila label="Recordatorio por WhatsApp">{cita.recordatorio_enviado ? (cita.recordatorio_error ? 'No llegó: se avisó al vendedor' : 'Enviado') : 'Pendiente'}</Fila>
              <Fila label="Google Calendar">{cita.google_event_id ? 'Sincronizada' : cita.google_error ? 'Pendiente: se reintenta sola' : 'Sin conectar'}</Fila>
            </dl>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {cita.cliente_id && (
                <Link href={`/admin/customers/${cita.cliente_id}`} className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">Ver cliente</Link>
              )}
              {cita.conversacion_id && (
                <Link href={`/admin/chat?conversation=${cita.conversacion_id}`} className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">Ver conversación</Link>
              )}
              {cita.lead_id && (
                <Link href="/admin/leads" className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">Ver leads</Link>
              )}
            </div>

            {cita.estado === 'programada' && (
              <div className="mt-6 grid grid-cols-2 gap-2 border-t pt-4">
                <Button onClick={() => cambiar('completada', 'Cita completada')} disabled={guardando}>Completada</Button>
                <Button variant="outline" onClick={() => cambiar('no_asistio', 'Marcada como no asistió')} disabled={guardando}>No asistió</Button>
                <Button variant="ghost" className="col-span-2 text-destructive hover:bg-destructive-soft hover:text-destructive"
                  onClick={() => cambiar('cancelada', 'Cita cancelada')} disabled={guardando}>
                  Cancelar cita
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
