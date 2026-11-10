'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { AlertTriangle, Ban, CheckCircle2, Loader2, Minus, PenLine, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Cotizacion, PiezaSugerida } from '@/lib/api-types'
import { cotizacionesApi } from '@/lib/api/cotizaciones'
import { EstadoCotizacion, fechaCorta } from '@/components/admin/cotizaciones/EstadoCotizacion'
import { cn, formatCurrency, nombrePieza } from '@/lib/utils'
import {
  MOTIVOS_CORRECCION, casoApi, plantillaCorreccion, plantillaRechazo, vehiculoCorto, type VehiculoCaso,
} from './caso'

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// La cotización se hizo para otro vehículo que el que tiene ahora la conversación.
const paraOtroVehiculo = (c: Cotizacion, v: VehiculoCaso | null) => {
  if (!v) return false
  if (c.vehiculo_id) return c.vehiculo_id !== v.id
  if (!c.vehiculo) return false
  const texto = normal(c.vehiculo)
  if (!texto.includes(normal(vehiculoCorto({ marca: v.marca, modelo: v.modelo })))) return true
  const anios = (texto.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number)
  if (!v.anio || !anios.length) return false
  return anios.length > 1 ? v.anio < Math.min(...anios) || v.anio > Math.max(...anios) : !anios.includes(v.anio)
}

const seleccionMotivo = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function CotizacionCaso({
  cotizacion: c,
  vehiculo,
  vehiculoAnterior,
  nombreCliente,
  pieza,
  ocupado,
  onEnviar,
  onValidar,
  onCambio,
}: {
  cotizacion: Cotizacion
  vehiculo: VehiculoCaso | null
  vehiculoAnterior: string | null
  nombreCliente: string | null
  pieza: PiezaSugerida | null
  ocupado: string | null
  onEnviar: () => void
  onValidar: () => void
  onCambio: () => void
}) {
  const [dialogo, setDialogo] = useState<'rechazar' | 'corregir' | null>(null)
  const abierta = !c.orden && c.estado !== 'rechazada' && c.estado !== 'vencida'
  const revisar = abierta && c.estado !== 'aceptada' && (paraOtroVehiculo(c, vehiculo) || !!vehiculoAnterior)
  const incluye = c.precios_incluyen_itbis

  return (
    <li className="space-y-1.5 rounded-md border p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/admin/cotizaciones/${c.codigo}`} className="font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
          {c.codigo} <span className="text-xs font-normal text-muted-foreground">v{c.version}</span>
        </Link>
        <EstadoCotizacion estado={c.estado} cotizacion={c} />
      </div>
      <p className="text-xs text-muted-foreground">Para: <span className="text-foreground">{c.vehiculo || 'sin vehículo'}</span></p>
      {revisar && (
        <p className="flex items-start gap-1.5 rounded-control bg-warning-soft px-2 py-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            {vehiculoAnterior ? `Se hizo para ${vehiculoAnterior}, antes de corregir el vehículo.` : 'Se hizo para otro vehículo.'}
            {' '}Revísala antes de validarla.
          </span>
        </p>
      )}
      <ul className="space-y-0.5">
        {c.items.map((item) => (
          <li key={String(item.pieza_id)} className="flex justify-between gap-2 text-xs">
            <span className="min-w-0 break-words">{item.cantidad} × {item.descripcion}</span>
            <span className="shrink-0 tabular-nums">{formatCurrency(item.cantidad * item.precio_dop)}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-0.5 border-t pt-1.5 text-xs">
        <div className="flex justify-between text-muted-foreground"><span>{incluye ? 'Subtotal sin ITBIS' : 'Subtotal'}</span><span className="tabular-nums">{formatCurrency(c.subtotal_dop)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>{incluye ? 'ITBIS incluido' : 'ITBIS'}</span><span className="tabular-nums">{formatCurrency(c.itbis_dop)}</span></div>
        <div className="flex justify-between text-[13px] font-semibold"><span>Total</span><span className="tabular-nums">{formatCurrency(c.total_dop)}</span></div>
        <p className="text-[11px] text-muted-foreground">{incluye ? 'Los precios ya incluyen ITBIS.' : 'Precios más ITBIS.'}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {c.origen === 'ia' ? 'Armada por la IA' : 'Armada en el panel'} · Vence {fechaCorta(c.vence)}
        {c.validada_por ? ` · validada${/^[0-9a-f-]{36}$/i.test(c.validada_por) ? '' : ` por ${c.validada_por}`}` : ''}{c.orden ? ` · orden ${c.orden.numero}` : ''}
      </p>
      {abierta && c.estado !== 'aceptada' && (
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant={c.estado === 'borrador' ? 'default' : 'outline'} className="h-7 gap-1 text-xs" onClick={onEnviar} disabled={!!ocupado}>
            {ocupado === `enviar-${c.codigo}` ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Send className="h-3 w-3" aria-hidden />}
            {c.estado === 'borrador' ? 'Enviar' : 'Reenviar'}
          </Button>
          {!c.validada_por ? (
            <Button size="sm" variant={c.estado === 'enviada' ? 'default' : 'outline'} className="h-7 gap-1 text-xs" onClick={onValidar} disabled={!!ocupado}>
              {ocupado === `validar-${c.codigo}` ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
              Validar
            </Button>
          ) : <span />}
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setDialogo('corregir')} disabled={!!ocupado}
            title={c.estado === 'borrador' ? 'Cambia las piezas o cantidades del borrador' : 'Cambia las piezas o cantidades y le manda al cliente la versión corregida'}>
            <PenLine className="h-3 w-3" aria-hidden /> Corregir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={() => setDialogo('rechazar')} disabled={!!ocupado}
            title="La cotización no sale; el cliente recibe un aviso si lo marcas">
            <Ban className="h-3 w-3" aria-hidden /> Rechazar
          </Button>
        </div>
      )}
      <DialogoRechazar abierto={dialogo === 'rechazar'} onCerrar={() => setDialogo(null)} cotizacion={c} nombreCliente={nombreCliente} onListo={onCambio} />
      <DialogoCorregir abierto={dialogo === 'corregir'} onCerrar={() => setDialogo(null)} cotizacion={c} nombreCliente={nombreCliente} pieza={pieza} onListo={onCambio} />
    </li>
  )
}

function DialogoRechazar({ abierto, onCerrar, cotizacion: c, nombreCliente, onListo }: {
  abierto: boolean
  onCerrar: () => void
  cotizacion: Cotizacion
  nombreCliente: string | null
  onListo: () => void
}) {
  const [motivo, setMotivo] = useState(MOTIVOS_CORRECCION[0].valor)
  const [nota, setNota] = useState('')
  const [avisar, setAvisar] = useState(true)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { if (abierto) { setMotivo(MOTIVOS_CORRECCION[0].valor); setNota(''); setAvisar(c.estado !== 'borrador') } }, [abierto, c.estado])

  const rechazar = async () => {
    setGuardando(true)
    try {
      const r = await casoApi.rechazar(c.codigo, { motivo, nota: nota.trim() || undefined, avisar_cliente: avisar })
      if (avisar && r?.mensaje && !r.mensaje.enviada) toast.error(`Rechazada, pero el aviso no llegó: ${r.mensaje.error || 'error de WhatsApp'}`)
      else toast.success(`${c.codigo} rechazada${avisar ? '. El cliente recibió el aviso.' : '.'}`)
      onCerrar()
      onListo()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo rechazar la cotización')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rechazar {c.codigo}</DialogTitle>
          <DialogDescription>La cotización queda rechazada y no se manda el PDF. Si necesitas otra, usa Corregir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="rechazo-motivo">Motivo</Label>
            <select id="rechazo-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={seleccionMotivo}>
              {MOTIVOS_CORRECCION.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </select>
          </div>
          <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={500} aria-label="Nota interna del rechazo"
            placeholder="Nota para el equipo (opcional): el cliente necesita el derecho, no el izquierdo" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>Avisar al cliente por WhatsApp</span>
          </label>
          {avisar && (
            <p className="rounded-md bg-secondary px-3 py-2 text-xs leading-snug" aria-label="Aviso que recibe el cliente">
              {plantillaRechazo(c.codigo, nombreCliente)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button variant="destructive" onClick={rechazar} disabled={guardando} className="gap-1.5">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />} Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface LineaEditable {
  pieza_id: string
  descripcion: string
  cantidad: number
  precio_dop: number
  precio_lista_dop?: number
}

function DialogoCorregir({ abierto, onCerrar, cotizacion: c, nombreCliente, pieza, onListo }: {
  abierto: boolean
  onCerrar: () => void
  cotizacion: Cotizacion
  nombreCliente: string | null
  pieza: PiezaSugerida | null
  onListo: () => void
}) {
  const [lineas, setLineas] = useState<LineaEditable[]>([])
  const [motivo, setMotivo] = useState(MOTIVOS_CORRECCION[0].valor)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const borrador = c.estado === 'borrador'
  useEffect(() => {
    if (!abierto) return
    setLineas(c.items.map((i) => ({ pieza_id: String(i.pieza_id), descripcion: i.descripcion, cantidad: i.cantidad, precio_dop: i.precio_dop, precio_lista_dop: i.precio_lista_dop })))
    setMotivo(MOTIVOS_CORRECCION[0].valor)
    setNota('')
  }, [abierto, c])

  const cambiar = (id: string, cantidad: number) =>
    setLineas((ls) => ls.map((l) => (l.pieza_id === id ? { ...l, cantidad: Math.max(0, Math.min(999, cantidad)) } : l)))
  const quitar = (id: string) => setLineas((ls) => ls.filter((l) => l.pieza_id !== id))
  const yaEsta = pieza && lineas.some((l) => l.pieza_id === String(pieza.product_id))
  const agregar = () => pieza && !yaEsta && setLineas((ls) => [...ls, { pieza_id: String(pieza.product_id), descripcion: pieza.nombre, cantidad: 1, precio_dop: pieza.precio_dop }])
  const validas = lineas.filter((l) => l.cantidad > 0)
  const total = validas.reduce((s, l) => s + l.cantidad * l.precio_dop, 0)

  const corregir = async () => {
    if (!validas.length) { toast.error('La cotización necesita al menos una pieza'); return }
    setGuardando(true)
    try {
      if (borrador) {
        const r = await cotizacionesApi.nuevaVersion(c.codigo, validas.map((l) => ({
          pieza_id: l.pieza_id,
          cantidad: l.cantidad,
          ...(l.precio_lista_dop != null && l.precio_lista_dop !== l.precio_dop ? { precio_dop: l.precio_dop } : {}),
        })), c.vehiculo)
        toast.success(`${c.codigo} v${r?.version ?? c.version + 1} guardada en borrador`)
        onCerrar()
        onListo()
        return
      }
      const r = await casoApi.corregir(c.codigo, {
        items: validas.map((l) => ({
          pieza_id: l.pieza_id,
          cantidad: l.cantidad,
          ...(l.precio_lista_dop != null && l.precio_lista_dop !== l.precio_dop ? { precio_dop: l.precio_dop } : {}),
        })),
        motivo,
        nota: nota.trim() || undefined,
      })
      if (r?.mensaje && !r.mensaje.enviada) toast.error(`Versión ${r.version ?? c.version + 1} creada, pero el aviso no llegó: ${r.mensaje.error || 'error de WhatsApp'}`)
      else toast.success(`${c.codigo} v${r?.version ?? c.version + 1} enviada al cliente con el aviso de corrección`)
      onCerrar()
      onListo()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo corregir la cotización')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corregir {c.codigo}</DialogTitle>
          <DialogDescription>
            {borrador
              ? `Se guarda como versión ${c.version + 1} en borrador. El cliente no recibe nada hasta que la envíes.`
              : `Se crea la versión ${c.version + 1}, reemplaza a la v${c.version} y le llega al cliente con el aviso.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ul className="space-y-1.5">
            {lineas.map((l) => (
              <li key={l.pieza_id} className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs', l.cantidad === 0 && 'opacity-50')}>
                <span className="min-w-0 flex-1 break-words">{l.descripcion}</span>
                <span className="inline-flex shrink-0 items-center rounded-control border">
                  <button type="button" className="p-1 hover:bg-secondary" onClick={() => cambiar(l.pieza_id, l.cantidad - 1)} aria-label={`Una menos de ${l.descripcion}`}>
                    <Minus className="h-3 w-3" aria-hidden />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={l.cantidad}
                    onChange={(e) => cambiar(l.pieza_id, Number(e.target.value) || 0)}
                    className="w-10 bg-transparent text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label={`Cantidad de ${l.descripcion}`}
                  />
                  <button type="button" className="p-1 hover:bg-secondary" onClick={() => cambiar(l.pieza_id, l.cantidad + 1)} aria-label={`Una más de ${l.descripcion}`}>
                    <Plus className="h-3 w-3" aria-hidden />
                  </button>
                </span>
                <span className="w-20 shrink-0 text-right tabular-nums">{formatCurrency(l.cantidad * l.precio_dop)}</span>
                <button type="button" className="rounded p-1 text-muted-foreground hover:text-destructive" onClick={() => quitar(l.pieza_id)} aria-label={`Quitar ${l.descripcion}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {pieza && !yaEsta && (
            <Button type="button" size="sm" variant="outline" className="h-8 w-full gap-1.5 text-xs" onClick={agregar}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar {nombrePieza(pieza.nombre)}
            </Button>
          )}
          <p className="text-right text-xs text-muted-foreground">
            {c.precios_incluyen_itbis ? 'Total con ITBIS' : 'Subtotal, más ITBIS'}: <span className="font-semibold text-foreground tabular-nums">{formatCurrency(total)}</span>
          </p>
          {!borrador && <div className="space-y-1">
            <Label htmlFor="correccion-motivo">Motivo</Label>
            <select id="correccion-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={seleccionMotivo}>
              {MOTIVOS_CORRECCION.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </select>
          </div>}
          {!borrador && <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={500} aria-label="Nota interna de la corrección"
            placeholder="Nota para el equipo (opcional)" />}
          {!borrador && <p className="rounded-md bg-secondary px-3 py-2 text-xs leading-snug" aria-label="Aviso que recibe el cliente">
            {plantillaCorreccion(c.codigo, c.version + 1, motivo, nombreCliente)}
          </p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={corregir} disabled={guardando || !validas.length} className="gap-1.5">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PenLine className="h-4 w-4" aria-hidden />} {borrador ? `Guardar versión ${c.version + 1}` : `Enviar versión ${c.version + 1}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
