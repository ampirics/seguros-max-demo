'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Gavel, Globe, Loader2, Recycle, Store, Truck } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import type { BusquedaExterna, EstadoBusquedaExterna, ResultadoExterno } from '@/lib/api-types'
import { cn, formatCurrency } from '@/lib/utils'

export const ESTADO_BUSQUEDA: Record<EstadoBusquedaExterna, { label: string; clase: string }> = {
  pendiente: { label: 'Por resolver', clase: 'bg-warning-soft text-warning' },
  ofrecida: { label: 'Oferta enviada', clase: 'bg-accent text-accent-foreground' },
  aceptada: { label: 'Aceptada', clase: 'bg-success-soft text-success' },
  descartada: { label: 'Descartada', clase: 'bg-secondary text-muted-foreground' },
}

const FUENTE: Record<string, typeof Globe> = {
  catalogo_oem: Globe,
  marketplace: Store,
  desarmadero: Recycle,
  subasta: Gavel,
  proveedor: Truck,
}

export const vehiculoBusqueda = (v: BusquedaExterna['vehiculo']) =>
  (v && [v.marca, v.modelo, v.anio, v.motor].filter(Boolean).join(' ')) || 'Sin vehículo'
const usd = (n: number, moneda?: string | null) => formatCurrency(n, moneda || 'USD')
const detalleResultado = (r: ResultadoExterno) => [
  r.fuente,
  r.condicion ? (r.condicion === 'nueva' ? 'Nueva' : 'Usada') : null,
  r.origen ? `desde ${r.origen}` : null,
  r.dias_estimados != null ? `llega en ${r.dias_estimados} ${r.dias_estimados === 1 ? 'día' : 'días'}` : null,
  r.tipo === 'proveedor' ? (r.agotado ? 'Agotado' : `${r.disponibles ?? 0} disponibles`) : null,
].filter(Boolean).join(' · ')

export function EstadoBusqueda({ estado }: { estado: EstadoBusquedaExterna }) {
  const e = ESTADO_BUSQUEDA[estado]
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium', e.clase)}>{e.label}</span>
}

export function ResultadoFila({ r, onOfrecer, ofrecerTexto, onAgregar, agregando }: {
  r: ResultadoExterno
  onOfrecer?: () => void
  ofrecerTexto?: string
  onAgregar?: () => void
  agregando?: boolean
}) {
  const Icon = FUENTE[r.tipo] ?? Globe
  if (r.tipo === 'enlace') {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-secondary text-muted-foreground">
          <Globe className="h-4 w-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm">{r.titulo}</p>
        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
          <a href={r.url} target="_blank" rel="noopener noreferrer">Abrir <ExternalLink className="h-3 w-3" aria-hidden /></a>
        </Button>
        {onOfrecer && <Button size="sm" variant="ghost" className="shrink-0" onClick={onOfrecer}>{ofrecerTexto ?? 'Ofrecer'}</Button>}
      </li>
    )
  }
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {r.imagen ? (
          <img src={r.imagen} alt={r.titulo} loading="lazy" className="h-14 w-14 shrink-0 rounded-md border bg-white object-contain" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-secondary text-muted-foreground">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium first-letter:uppercase">{r.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{detalleResultado(r)}</p>
          {r.ya_en_catalogo && <p className="mt-1 text-xs font-medium">Ya está en la tienda: SKU {r.ya_en_catalogo.sku}</p>}
          {r.url && (
            <a href={r.url} target="_blank" rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Ver en la fuente <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-center">
        {r.precio != null && (
          <div className="sm:text-right">
            {r.tipo === 'proveedor' && <p className="text-[11px] text-muted-foreground">Costo del proveedor</p>}
            <p className="text-base font-semibold tabular-nums">{usd(r.precio, r.moneda)}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {onAgregar && (
            <Button size="sm" variant="ghost" disabled={!!r.ya_en_catalogo || agregando} onClick={onAgregar}>
              {agregando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Agregar al inventario
            </Button>
          )}
          {onOfrecer && <Button size="sm" variant="outline" onClick={onOfrecer}>{ofrecerTexto ?? 'Ofrecer al cliente'}</Button>}
        </div>
      </div>
    </li>
  )
}

const mensajeOferta = (b: BusquedaExterna, r: ResultadoExterno, precio: string, dias: string) => {
  const nombre = b.cliente?.nombre && !b.cliente.nombre.startsWith('WhatsApp') ? b.cliente.nombre.split(' ')[0] : ''
  const monto = Number(precio) > 0 ? formatCurrency(Number(precio)) : 'RD$ —'
  const detalle = [r.condicion, r.origen && `viene de ${r.origen}`].filter(Boolean).join(', ')
  const para = b.vehiculo ? ` para tu ${vehiculoBusqueda(b.vehiculo)}` : ''
  return `Hola${nombre ? ` ${nombre}` : ''}, conseguimos ${b.pieza}${para}${detalle ? ` (${detalle})` : ''}. `
    + `Precio: ${monto}. Llega en unos ${dias || '—'} días. ¿Te la pedimos?`
}

export function OfertaDialog({ busqueda, resultado, onClose, onEnviada }: {
  busqueda: BusquedaExterna
  resultado: ResultadoExterno | null
  onClose: () => void
  onEnviada: (b: BusquedaExterna) => void
}) {
  const [precio, setPrecio] = useState('')
  const [dias, setDias] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [editado, setEditado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!resultado) return
    setPrecio('')
    setDias(resultado.dias_estimados != null ? String(resultado.dias_estimados) : '')
    setEditado(false)
  }, [resultado])

  useEffect(() => {
    if (resultado && !editado) setMensaje(mensajeOferta(busqueda, resultado, precio, dias))
  }, [busqueda, resultado, precio, dias, editado])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resultado) return
    setEnviando(true)
    try {
      const b = await apiClient.post<BusquedaExterna>(`/busquedas-externas/${busqueda.id}/oferta`, {
        resultado, precio_dop: Number(precio), dias_estimados: Number(dias), mensaje,
      })
      toast.success(`Oferta enviada a ${busqueda.cliente?.nombre ?? 'el cliente'} por WhatsApp`)
      onEnviada(b)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo enviar la oferta. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={!!resultado} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={enviar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Ofrecer a {busqueda.cliente?.nombre}</DialogTitle>
            <DialogDescription className="first-letter:uppercase">{resultado?.titulo}</DialogDescription>
          </DialogHeader>
          {resultado && (
            <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              {resultado.precio != null
                ? `Cuesta ${usd(resultado.precio, resultado.moneda)} en ${resultado.fuente}${resultado.origen ? ` (${resultado.origen})` : ''}, sin envío ni impuestos. `
                : `Fuente: ${resultado.fuente}. `}
              El precio al cliente lo pones tú; la IA no lo calcula.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="oferta-precio">Precio al cliente (RD$)</Label>
              <Input id="oferta-precio" type="number" inputMode="decimal" min="1" step="0.01" required autoFocus
                value={precio} onChange={(e) => setPrecio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oferta-dias">Llega en (días)</Label>
              <Input id="oferta-dias" type="number" inputMode="numeric" min="1" step="1" required
                value={dias} onChange={(e) => setDias(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oferta-mensaje">Mensaje por WhatsApp</Label>
            <Textarea id="oferta-mensaje" rows={4} required value={mensaje}
              onChange={(e) => { setMensaje(e.target.value); setEditado(true) }} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !(Number(precio) > 0)}>
              {enviando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Enviar oferta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
