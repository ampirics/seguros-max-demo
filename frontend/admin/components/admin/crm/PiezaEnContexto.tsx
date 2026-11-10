'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { FilePlus2, Loader2, PackageCheck, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PiezaFoto } from '@/components/chat/PiezaCards'
import { Condicion } from '@/components/admin/piezas/PiezaFila'
import { apiClient } from '@/lib/api-client'
import type { BusquedaPiezas, Pieza } from '@/lib/api-types'
import { cotizacionesApi } from '@/lib/api/cotizaciones'
import { inventarioApi } from '@/lib/api/inventario'
import { aBusqueda } from '@/lib/api/piezas'
import { cn, formatCurrency, nombrePieza } from '@/lib/utils'

export interface ContextoPieza {
  leadId?: string | null
  clienteId: string | null
  conversacionId: string | null
  vehiculo: { id: string; marca: string | null; modelo: string | null; anio: number | null } | null
  cotizacionCodigo: string | null
}

const textoVehiculo = (v: ContextoPieza['vehiculo']) => (v ? [v.marca, v.modelo, v.anio].filter(Boolean).join(' ') : '')

export function PiezaEnContexto({ contexto, onCambio }: { contexto: ContextoPieza; onCambio: (codigo?: string) => void }) {
  const [q, setQ] = useState('')
  const [conVehiculo, setConVehiculo] = useState(!!contexto.vehiculo)
  const [piezas, setPiezas] = useState<Pieza[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const v = conVehiculo ? contexto.vehiculo : null

  useEffect(() => {
    const termino = q.trim()
    if (termino.length < 2) { setPiezas(null); return }
    let vigente = true
    setBuscando(true)
    const t = setTimeout(() => {
      apiClient.get<BusquedaPiezas>('/piezas/buscar', { q: termino, marca: v?.marca ?? undefined, modelo: v?.modelo ?? undefined, anio: v?.anio ?? undefined, limit: 6 })
        .then((r) => { if (vigente) setPiezas(aBusqueda(r).items) })
        .catch(() => { if (vigente) setPiezas([]) })
        .finally(() => { if (vigente) setBuscando(false) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, v?.marca, v?.modelo, v?.anio, recarga])

  const correr = async (clave: string, fn: () => Promise<void>) => {
    setOcupado(clave)
    try { await fn() } catch (e: any) { toast.error(e?.message || 'No se pudo completar. Intenta de nuevo.') } finally { setOcupado(null) }
  }

  const apartar = (p: Pieza) => correr(`apartar-${p.id}`, async () => {
    try {
      const r = await inventarioApi.reservar({ pieza_id: p.id, cantidad: 1, conversation_id: contexto.conversacionId, lead_id: contexto.leadId ?? null })
      toast.success(`Apartada 1 en ${r.sucursal} hasta ${new Date(r.vence).toLocaleString('es-DO', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`)
      setRecarga((n) => n + 1)
    } catch (e: any) {
      if (String(e?.message).includes('sin_disponible')) throw new Error('No hay unidades libres para apartar en ninguna sucursal.')
      throw e
    }
  })

  const cotizar = (p: Pieza) => correr(`cotizar-${p.id}`, async () => {
    const actual = contexto.cotizacionCodigo ? await cotizacionesApi.obtener(contexto.cotizacionCodigo).catch(() => null) : null
    if (actual?.estado === 'borrador') {
      const lineas = actual.items.map((i) => ({
        pieza_id: String(i.pieza_id), cantidad: i.cantidad + (String(i.pieza_id) === p.id ? 1 : 0),
        ...(i.precio_lista_dop != null && i.precio_dop !== i.precio_lista_dop ? { precio_dop: i.precio_dop } : {}),
      }))
      if (!lineas.some((l) => l.pieza_id === p.id)) lineas.push({ pieza_id: p.id, cantidad: 1 })
      await cotizacionesApi.nuevaVersion(actual.codigo, lineas, actual.vehiculo)
      toast.success(`Agregada a ${actual.codigo}`)
      onCambio(actual.codigo)
      return
    }
    const nueva = await cotizacionesApi.crear({
      items: [{ pieza_id: p.id, cantidad: 1 }], conversation_id: contexto.conversacionId, cliente_id: contexto.clienteId,
      vehiculo_id: contexto.vehiculo?.id ?? null, vehiculo: textoVehiculo(contexto.vehiculo) || null, lead_id: contexto.leadId ?? null,
    })
    toast.success(`Cotización ${nueva.codigo} creada en borrador`)
    onCambio(nueva.codigo)
  })

  return (
    <section className="space-y-2" aria-labelledby="pieza-contexto">
      <h3 id="pieza-contexto" className="text-sm font-semibold">Buscar pieza</h3>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: amortiguador delantero" aria-label="Buscar pieza" className="h-9 pl-9" />
        {buscando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {contexto.vehiculo && (
        conVehiculo ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Para
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">
              {textoVehiculo(contexto.vehiculo)}
              <button type="button" onClick={() => setConVehiculo(false)} aria-label="Buscar sin el vehículo" className="rounded hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          </p>
        ) : (
          <button type="button" onClick={() => setConVehiculo(true)} className="text-xs font-medium text-primary hover:underline">
            Filtrar por {textoVehiculo(contexto.vehiculo)}
          </button>
        )
      )}

      {piezas && piezas.length === 0 && (
        <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          No hay piezas con «{q.trim()}»{v ? ` para ${textoVehiculo(v)}` : ''}. <Link href={`/admin/busqueda-externa?q=${encodeURIComponent(q.trim())}`} className="font-medium text-primary hover:underline">Buscar fuera del catálogo</Link>
        </p>
      )}

      {piezas && piezas.length > 0 && (
        <ul className="space-y-2">
          {piezas.map((p) => {
            const libre = (p.existencias ?? []).reduce((n, e) => n + e.disponible, 0)
            return (
              <li key={p.id} className="space-y-2 rounded-md border p-2.5">
                <div className="flex gap-2.5">
                  <PiezaFoto pieza={p} className="h-14 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug">{nombrePieza(p.nombre)}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">{formatCurrency(p.precio_dop)}</span>
                      {(p.calidad ?? p.condicion) && <Condicion condicion={p.calidad ?? p.condicion} />}
                      {p.sku && <span>{p.sku}</span>}
                    </p>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-1.5 text-[11px]" aria-label="Existencia por sucursal">
                  {(p.existencias ?? []).length === 0 && <li className="font-medium text-destructive">Sin existencia</li>}
                  {(p.existencias ?? []).map((e) => (
                    <li key={e.sucursal_id} className={cn('rounded px-1.5 leading-5', e.disponible > 0 ? 'bg-success-soft text-success' : 'bg-secondary text-muted-foreground')}>
                      {e.sucursal}: <span className="font-semibold tabular-nums">{e.disponible}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => apartar(p)} disabled={!!ocupado || libre === 0}>
                    {ocupado === `apartar-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <PackageCheck className="h-3.5 w-3.5" aria-hidden />}
                    Apartar
                  </Button>
                  <Button size="sm" className="h-8 gap-1.5" onClick={() => cotizar(p)} disabled={!!ocupado}>
                    {ocupado === `cotizar-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FilePlus2 className="h-3.5 w-3.5" aria-hidden />}
                    A la cotización
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
