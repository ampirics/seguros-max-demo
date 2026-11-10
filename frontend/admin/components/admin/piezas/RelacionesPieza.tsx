'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Condicion } from '@/components/admin/piezas/PiezaFila'
import { apiClient } from '@/lib/api-client'
import type { BusquedaPiezas, Pieza, PiezaRelacionada, TipoRelacion } from '@/lib/api-types'
import { TIPOS_RELACION, catalogoApi } from '@/lib/api/catalogo'
import { cn, formatCurrency, nombrePieza } from '@/lib/utils'

type TipoNuevo = Exclude<TipoRelacion, 'reemplazada_por'>

const AYUDA: Record<TipoNuevo, string> = {
  reemplaza: 'Esta pieza reemplaza a la otra (o a un número viejo que ya no está en el catálogo). Quien busque el número viejo verá esta.',
  kit: 'La otra pieza va junto con esta. El bot puede ofrecerla.',
  lado_opuesto: 'El otro lado (izquierdo o derecho) de esta misma pieza.',
  equivalente: 'La otra pieza sirve en lugar de esta. Solo en esta dirección.',
}

export function RelacionesPieza({ piezaId, relacionadas, puedeEditar, onCambio }: {
  piezaId: string
  relacionadas: PiezaRelacionada[]
  puedeEditar: boolean
  onCambio: (r: PiezaRelacionada[]) => void
}) {
  const [agregando, setAgregando] = useState(false)
  const [tipo, setTipo] = useState<TipoNuevo>('reemplaza')
  const [q, setQ] = useState('')
  const [nota, setNota] = useState('')
  const [resultados, setResultados] = useState<Pieza[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [quitando, setQuitando] = useState<string | null>(null)

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 3) { setResultados([]); return }
    let vigente = true
    setBuscando(true)
    const t = setTimeout(() => {
      apiClient.get<BusquedaPiezas>('/piezas/buscar', { q: texto, limit: 6 })
        .then((r) => { if (vigente) setResultados((r.items ?? []).filter((p) => String(p.id) !== piezaId)) })
        .catch(() => { if (vigente) setResultados([]) })
        .finally(() => { if (vigente) setBuscando(false) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, piezaId])

  const guardar = async (datos: { relacionada_id?: string; numero?: string }) => {
    setGuardando(true)
    try {
      const r = await catalogoApi.relacionar(piezaId, { tipo, nota: nota.trim() || undefined, ...datos })
      onCambio(r.relacionadas)
      toast.success('Relación guardada')
      setQ(''); setNota(''); setAgregando(false)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la relación.')
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async (r: PiezaRelacionada) => {
    if (!r.relacion_id) return
    setQuitando(r.relacion_id)
    try {
      await catalogoApi.quitarRelacion(piezaId, r.relacion_id)
      onCambio(relacionadas.filter((x) => x.relacion_id !== r.relacion_id))
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo quitar la relación.')
    } finally {
      setQuitando(null)
    }
  }

  return (
    <div className="space-y-3">
      {relacionadas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin reemplazos, kits ni equivalencias guardadas.</p>
      ) : (
        <ul className="divide-y">
          {relacionadas.map((r, i) => (
            <li key={r.relacion_id ?? `${r.tipo}-${r.id ?? i}`} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">
                  {TIPOS_RELACION[r.tipo] ?? r.tipo}{!r.relacion_id && ' (deducido del nombre)'}{r.nota && ` · ${r.nota}`}
                </span>
                {r.id ? (
                  <Link href={`/admin/piezas/${r.id}`} className="line-clamp-2 text-sm font-medium leading-snug hover:underline focus-visible:underline focus-visible:outline-none">{nombrePieza(r.nombre)}</Link>
                ) : (
                  <span className="text-sm font-medium">Número {r.numero} <span className="font-normal text-muted-foreground">(no está en el catálogo)</span></span>
                )}
              </span>
              {r.id && (
                <span className="shrink-0 text-right text-sm">
                  <Condicion condicion={r.calidad} />
                  {r.precio_dop != null && <span className="block font-semibold tabular-nums">{formatCurrency(r.precio_dop)}</span>}
                  <span className={cn('block text-[11px]', r.disponible ? 'text-success' : 'text-muted-foreground')}>{r.disponible ? 'Disponible' : 'Sin disponible'}</span>
                </span>
              )}
              {puedeEditar && r.relacion_id && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Quitar relación"
                  disabled={quitando === r.relacion_id} onClick={() => quitar(r)}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && !agregando && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setAgregando(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Agregar relación
        </Button>
      )}

      {puedeEditar && agregando && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rel-tipo">Relación</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoNuevo)}>
                <SelectTrigger id="rel-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['reemplaza', 'kit', 'lado_opuesto', 'equivalente'] as TipoNuevo[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPOS_RELACION[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-nota">Nota (opcional)</Label>
              <Input id="rel-nota" value={nota} maxLength={300} placeholder="Ej.: boletín del fabricante" onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{AYUDA[tipo]}</p>
          <div className="space-y-1.5">
            <Label htmlFor="rel-q">Pieza</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="rel-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número de pieza, SKU o nombre" className="pl-9" />
            </div>
          </div>
          {buscando && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Buscando…</p>}
          {resultados.length > 0 && (
            <ul className="max-h-56 divide-y overflow-auto rounded-md border">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button type="button" disabled={guardando} onClick={() => guardar({ relacionada_id: String(p.id) })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:outline-none">
                    <span className="min-w-0 flex-1 truncate">{nombrePieza(p.nombre)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAgregando(false); setQ('') }}>Cancelar</Button>
            {tipo === 'reemplaza' && q.trim().length >= 3 && (
              <Button type="button" size="sm" disabled={guardando} onClick={() => guardar({ numero: q.trim() })}>
                {guardando && <Loader2 className="animate-spin" aria-hidden />} Reemplaza al número {q.trim()}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
