'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { CheckCircle2, Loader2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { apiClient } from '@/lib/api-client'
import { cn, formatCurrency } from '@/lib/utils'

interface PiezaVisita {
  pieza_id: string
  nombre: string
  cantidad: number
  disponible_aqui: number | null
  alcanza: boolean
  otras_sucursales: { sucursal_id: string; sucursal: string; disponible: number }[]
}

export interface Visita {
  id: string
  hora: string
  cliente: string | null
  cliente_telefono: string | null
  cliente_id: string | null
  conversation_id: string | null
  estado: string
  llego_at: string | null
  vendedor: string | null
  vehiculo: string | null
  piezas: PiezaVisita[]
  cotizacion: { codigo: string; version: number; estado: string; total_dop: number } | null
  orden: { id: string; numero: string; estado: string } | null
}

interface Hoy {
  fecha: string
  total: number
  sucursales: { sucursal_id: string | null; sucursal: string; citas: Visita[] }[]
}

const METODOS = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
  { valor: 'transferencia', texto: 'Transferencia' },
]

function Pieza({ p }: { p: PiezaVisita }) {
  const otra = p.otras_sucursales[0]
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0">{p.cantidad > 1 && <span className="tabular-nums">{p.cantidad} × </span>}{p.nombre}</span>
      <span className={cn('shrink-0 text-xs', p.alcanza ? 'text-success' : 'text-warning')}>
        {p.alcanza ? `Hay ${p.disponible_aqui} aquí` : otra ? `Hay ${otra.disponible} en ${otra.sucursal}: traslado` : 'Sin existencia'}
      </span>
    </li>
  )
}

function Tarjeta({ v, onCambio }: { v: Visita; onCambio: () => void }) {
  const [metodo, setMetodo] = useState('efectivo')
  const [enviando, setEnviando] = useState<'llego' | 'venta' | null>(null)
  const llego = !!v.llego_at
  const vendida = v.orden?.estado === 'DELIVERED'

  const accion = async (tipo: 'llego' | 'venta') => {
    setEnviando(tipo)
    try {
      if (tipo === 'llego') await apiClient.post(`/agenda/citas/${v.id}/llego`)
      else await apiClient.post(`/agenda/citas/${v.id}/venta`, { metodo_pago: metodo, cotizacion_codigo: v.cotizacion?.codigo })
      toast.success(tipo === 'llego' ? 'Llegada registrada' : 'Venta registrada: la existencia ya se descontó')
      onCambio()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setEnviando(null)
    }
  }

  return (
    <li className={cn('rounded-lg border bg-card p-3', v.estado === 'cancelada' && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium"><span className="tabular-nums">{v.hora}</span> · {v.cliente ?? v.cliente_telefono ?? 'Cliente'}</p>
          <p className="text-xs text-muted-foreground">{[v.vehiculo, v.vendedor && `con ${v.vendedor}`].filter(Boolean).join(' · ') || 'Sin vehículo registrado'}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
          vendida ? 'bg-success-soft text-success' : llego ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground')}>
          {vendida ? 'Vendida' : llego ? 'Llegó' : 'Por llegar'}
        </span>
      </div>

      {v.piezas.length > 0 && <ul className="mt-2 space-y-1">{v.piezas.map((p) => <Pieza key={p.pieza_id} p={p} />)}</ul>}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {v.cotizacion ? (
          <span>{v.cotizacion.codigo} · <span className="tabular-nums">{formatCurrency(v.cotizacion.total_dop)}</span> · {v.cotizacion.estado}</span>
        ) : <span className="text-muted-foreground">Sin cotización</span>}
        {v.orden && <span className="text-muted-foreground">Orden {v.orden.numero}</span>}
        {v.conversation_id && <Link href={`/admin/chat?conversation=${v.conversation_id}`} className="font-medium text-primary hover:underline">Conversación</Link>}
        {v.cliente_id && <Link href={`/admin/customers/${v.cliente_id}`} className="font-medium text-primary hover:underline">Cliente</Link>}
      </div>

      {!vendida && v.estado !== 'cancelada' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {!llego && (
            <Button size="sm" variant="outline" onClick={() => accion('llego')} disabled={!!enviando} className="gap-1.5">
              {enviando === 'llego' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Llegó
            </Button>
          )}
          {v.cotizacion && (
            <>
              <Select value={metodo} onValueChange={setMetodo}>
                <SelectTrigger className="h-8 w-[9.5rem]" aria-label="Forma de pago"><SelectValue /></SelectTrigger>
                <SelectContent>{METODOS.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.texto}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={() => accion('venta')} disabled={!!enviando} className="gap-1.5">
                {enviando === 'venta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Registrar venta
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

export function QuienVieneHoy({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [datos, setDatos] = useState<Hoy | null>(null)
  const [error, setError] = useState(false)

  const cargar = useCallback(() => {
    apiClient.get<Hoy>('/agenda/hoy').then((d) => { setDatos(d); setError(false) }).catch(() => setError(true))
  }, [])
  useEffect(() => { if (abierta) { setDatos(null); cargar() } }, [abierta, cargar])

  return (
    <Sheet open={abierta} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>Quién viene hoy</SheetTitle>
          <SheetDescription>Visitas a la tienda por sucursal, con lo que buscan y si está en esa sucursal.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          {error ? (
            <p className="text-sm text-muted-foreground">No se pudieron cargar las visitas.</p>
          ) : !datos ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : datos.total === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie tiene visita agendada para hoy.</p>
          ) : (
            datos.sucursales.map((s) => (
              <section key={s.sucursal_id ?? s.sucursal}>
                <h3 className="mb-2 text-sm font-semibold">{s.sucursal} <span className="font-normal text-muted-foreground">· {s.citas.length}</span></h3>
                <ul className="space-y-2">{s.citas.map((v) => <Tarjeta key={v.id} v={v} onCambio={cargar} />)}</ul>
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
