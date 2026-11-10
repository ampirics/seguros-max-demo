'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TIPOS_MOVIMIENTO, inventarioApi, unidades, type ExistenciaFila, type Movimiento, type Sucursal } from '@/lib/api/inventario'
import { cn } from '@/lib/utils'

type Tipo = 'entrada' | 'venta' | 'ajuste' | 'traslado'

const AYUDA: Record<Tipo, string> = {
  entrada: 'Unidades que llegan a la sucursal.',
  venta: 'Unidades vendidas en tienda.',
  ajuste: 'Cantidad contada: la existencia queda en este número.',
  traslado: 'Unidades que salen de esta sucursal hacia otra.',
}

export const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'

export function MovimientoDialog({ abierto, piezaId, sucursales, existencias, onClose, onHecho }: {
  abierto: boolean
  piezaId: string
  sucursales: Sucursal[]
  existencias: ExistenciaFila[]
  onClose: () => void
  onHecho: () => void
}) {
  const [tipo, setTipo] = useState<Tipo>('entrada')
  const [sucursal, setSucursal] = useState('')
  const [destino, setDestino] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setTipo('entrada'); setCantidad(''); setMotivo(''); setDestino('')
    setSucursal(sucursales[0]?.id ?? '')
  }, [abierto, sucursales])

  const actual = existencias.find((e) => e.sucursal_id === sucursal)
  useEffect(() => { setUbicacion(actual?.ubicacion ?? '') }, [actual?.ubicacion, sucursal])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await inventarioApi.registrarMovimiento({
        pieza_id: piezaId, sucursal_id: sucursal, tipo, cantidad: Number(cantidad), motivo: motivo.trim() || undefined,
        ubicacion: ubicacion.trim() || undefined, destino_id: tipo === 'traslado' ? destino : undefined,
      })
      toast.success('Movimiento registrado')
      onHecho()
    } catch (err: any) {
      toast.error(err?.message === 'existencia_insuficiente' ? 'No hay tantas unidades en esa sucursal.' : err?.message || 'No se pudo registrar el movimiento.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>{AYUDA[tipo]}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mov-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger id="mov-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['entrada', 'venta', 'ajuste', 'traslado'] as Tipo[]).map((t) => <SelectItem key={t} value={t}>{TIPOS_MOVIMIENTO[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-cantidad">{tipo === 'ajuste' ? 'Cantidad contada' : 'Cantidad'}</Label>
              <Input id="mov-cantidad" type="number" inputMode="numeric" min={tipo === 'ajuste' ? 0 : 1} step={1} required
                value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-sucursal">{tipo === 'traslado' ? 'Desde' : 'Sucursal'}</Label>
              <Select value={sucursal} onValueChange={setSucursal}>
                <SelectTrigger id="mov-sucursal"><SelectValue placeholder="Elige" /></SelectTrigger>
                <SelectContent>{sucursales.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Hay {unidades(actual?.cantidad ?? 0)}</p>
            </div>
            {tipo === 'traslado' ? (
              <div className="space-y-1.5">
                <Label htmlFor="mov-destino">Hacia</Label>
                <Select value={destino} onValueChange={setDestino}>
                  <SelectTrigger id="mov-destino"><SelectValue placeholder="Elige" /></SelectTrigger>
                  <SelectContent>{sucursales.filter((s) => s.id !== sucursal).map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="mov-ubicacion">Ubicación</Label>
                <Input id="mov-ubicacion" value={ubicacion} maxLength={120} placeholder="Ej.: A-32" onChange={(e) => setUbicacion(e.target.value)} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-motivo">Motivo (opcional)</Label>
            <Input id="mov-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando || !sucursal || cantidad === '' || (tipo === 'traslado' && !destino)}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MinimoDialog({ fila, onClose, onHecho }: { fila: ExistenciaFila | null; onClose: () => void; onHecho: () => void }) {
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (fila) setValor(fila.minimo == null ? '' : String(fila.minimo)) }, [fila])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fila) return
    setGuardando(true)
    try {
      await inventarioApi.definirMinimo({ pieza_id: fila.pieza_id, sucursal_id: fila.sucursal_id, minimo: valor === '' ? null : Number(valor) })
      toast.success(valor === '' ? 'Mínimo quitado' : 'Mínimo guardado')
      onHecho()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar el mínimo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!fila} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Mínimo en {fila?.sucursal}</DialogTitle>
            <DialogDescription>Cuando lo disponible baje de este número, el panel avisa una vez (existencia baja). Vacío: sin mínimo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="minimo">Mínimo</Label>
            <Input id="minimo" type="number" inputMode="numeric" min={0} step={1} value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando && <Loader2 className="animate-spin" aria-hidden />} Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ExistenciasPieza({ piezaId, disponibleCatalogo }: { piezaId: string; disponibleCatalogo: boolean }) {
  const [filas, setFilas] = useState<ExistenciaFila[] | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [mover, setMover] = useState(false)
  const [reservando, setReservando] = useState<string | null>(null)
  const [minimo, setMinimo] = useState<ExistenciaFila | null>(null)
  const [error, setError] = useState(false)

  const cargar = useCallback(() => {
    Promise.all([
      inventarioApi.existencias({ pieza_id: piezaId, limit: 50 }),
      inventarioApi.movimientos({ pieza_id: piezaId, limit: 20 }),
      inventarioApi.sucursales(),
    ])
      .then(([e, m, s]) => { setFilas(e.items.filter((f) => f.sucursal_activa)); setMovimientos(m); setSucursales(s); setError(false) })
      .catch(() => setError(true))
  }, [piezaId])

  useEffect(() => { cargar() }, [cargar])

  const apartar = async (sucursal_id: string) => {
    setReservando(sucursal_id)
    try {
      const r = await inventarioApi.reservar({ pieza_id: piezaId, sucursal_id })
      toast.success(`Apartada en ${r.sucursal} hasta ${fechaHora(r.vence)}`)
      cargar()
    } catch (err: any) {
      toast.error(err?.message === 'sin_disponible' ? 'No hay unidades disponibles en esa sucursal.' : err?.message || 'No se pudo apartar.')
    } finally {
      setReservando(null)
    }
  }

  if (error) return <p className="text-sm text-muted-foreground">No se pudo cargar la existencia.</p>
  if (!filas) return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>

  return (
    <div className="space-y-4">
      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {disponibleCatalogo ? 'Disponible en el catálogo.' : 'Sin existencia en el catálogo.'} Todavía no tiene cantidades por sucursal.
        </p>
      ) : (
        <ul className="divide-y text-sm">
          {filas.map((e) => (
            <li key={e.sucursal_id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-medium">{e.sucursal}</span>
                <span className="block text-xs text-muted-foreground">
                  {[e.ubicacion && `Ubicación ${e.ubicacion}`, e.reservado > 0 && `${e.reservado} apartada${e.reservado === 1 ? '' : 's'}`, `${unidades(e.cantidad)} en total`].filter(Boolean).join(' · ')}
                </span>
                <button type="button" onClick={() => setMinimo(e)}
                  className={cn('text-xs underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none', e.bajo_minimo ? 'font-medium text-warning' : 'text-muted-foreground')}>
                  {e.minimo == null ? 'Definir mínimo' : `Mínimo ${e.minimo}${e.bajo_minimo ? ' · bajo el mínimo' : ''}`}
                </button>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={cn('tabular-nums', e.disponible === 0 && 'text-destructive')}>
                  {e.disponible === 0 ? 'Sin disponible' : `${e.disponible} disponible${e.disponible === 1 ? '' : 's'}`}
                </span>
                {e.disponible > 0 && (
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={reservando === e.sucursal_id} onClick={() => apartar(e.sucursal_id)}>
                    Apartar
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {sucursales.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setMover(true)}>Registrar movimiento</Button>
      )}
      {movimientos.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">Historial</h3>
          <ul className="divide-y text-xs">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="font-medium">{TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo}</span>
                  <span className="text-muted-foreground"> · {m.sucursal}{m.motivo ? ` · ${m.motivo}` : ''}{m.usuario ? ` · ${m.usuario}` : ''}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {m.tipo === 'reserva' || m.tipo === 'liberacion' ? unidades(m.cantidad) : `${m.cantidad > 0 ? '+' : ''}${m.cantidad} → ${m.resultante ?? '—'}`} · {fechaHora(m.fecha)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <MinimoDialog fila={minimo} onClose={() => setMinimo(null)} onHecho={() => { setMinimo(null); cargar() }} />
      <MovimientoDialog abierto={mover} piezaId={piezaId} sucursales={sucursales} existencias={filas}
        onClose={() => setMover(false)} onHecho={() => { setMover(false); cargar() }} />
    </div>
  )
}
