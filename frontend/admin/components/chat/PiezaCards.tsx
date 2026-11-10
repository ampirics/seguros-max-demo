'use client'

import { useEffect, useState } from 'react'
import type { PiezaSugerida } from '@/lib/api-types'
import { fotoDelCatalogo, fotoPieza } from '@/lib/api/conversaciones'
import { cn, formatCurrency, nombrePieza } from '@/lib/utils'
import { calidadTexto, esPiezaDemo } from './caso'

export function Existencia({ disponible, existencias }: {
  disponible: boolean
  existencias?: { sucursal: string; disponible: number }[] | null
}) {
  const conCantidad = (existencias ?? []).filter((e) => e.sucursal)
  if (conCantidad.length) {
    return (
      <span className="text-[11px]">
        {conCantidad.map((e, i) => (
          <span key={e.sucursal} className={cn('font-medium', e.disponible > 0 ? 'text-success' : 'text-muted-foreground')}>
            {i > 0 && <span className="text-muted-foreground"> · </span>}
            {e.sucursal}: {e.disponible}
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className={cn('text-[11px] font-medium', disponible ? 'text-success' : 'text-destructive')}>
      {disponible ? 'Disponible' : 'Sin existencia'}
    </span>
  )
}

// Una pieza DEMO- no busca foto por nombre: podría traer la de la pieza real que se llama igual.
export function PiezaFoto({ pieza, className }: { pieza: { imagen?: string | null; nombre: string; sku?: string | null; demo?: boolean }; className?: string }) {
  const directa = fotoPieza(pieza.imagen)
  const demo = esPiezaDemo(pieza)
  const [catalogo, setCatalogo] = useState<string | null>(null)
  useEffect(() => {
    setCatalogo(null)
    if (directa || demo) return
    let vigente = true
    fotoDelCatalogo(pieza.nombre).then((f) => { if (vigente) setCatalogo(f) })
    return () => { vigente = false }
  }, [directa, demo, pieza.nombre])
  const src = directa ?? catalogo
  return src ? (
    <img src={src} alt={pieza.nombre} loading="lazy" className={cn('shrink-0 rounded-md border bg-white object-contain', className)} />
  ) : (
    <span className={cn('flex shrink-0 items-center justify-center rounded-md border bg-secondary text-center text-[10px] text-muted-foreground', className)}>
      Sin foto
    </span>
  )
}

export function PiezaCards({
  piezas,
  seleccionada,
  onSelect,
}: {
  piezas: PiezaSugerida[]
  seleccionada?: string | number
  onSelect: (pieza: PiezaSugerida) => void
}) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-1.5">
      {piezas.map((pieza) => (
        <button
          key={String(pieza.product_id)}
          type="button"
          onClick={() => onSelect(pieza)}
          aria-pressed={seleccionada === pieza.product_id}
          title="Ver en el panel del caso"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md border bg-card p-1.5 text-left outline-none transition-colors',
            'hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring active:bg-secondary',
            seleccionada === pieza.product_id && 'border-primary ring-1 ring-primary/30'
          )}
        >
          <PiezaFoto pieza={pieza} className="h-12 w-12" />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words text-[13px] font-medium leading-tight">{nombrePieza(pieza.nombre)}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <span className="text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(pieza.precio_dop)}</span>
              {pieza.calidad && <span className="font-medium text-foreground">{calidadTexto(pieza.calidad)}</span>}
              {pieza.mpn && <span>Ref. {pieza.mpn}</span>}
              <Existencia disponible={pieza.disponible} existencias={pieza.existencias} />
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
