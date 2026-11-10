import Link from 'next/link'
import type { Pieza } from '@/lib/api-types'
import { formatCurrency, nombrePieza } from '@/lib/utils'
import { Existencia, PiezaFoto } from '@/components/chat/PiezaCards'

export const SISTEMAS = [
  { clave: 'tren_delantero', nombre: 'Tren delantero' },
  { clave: 'tren_trasero', nombre: 'Tren trasero' },
  { clave: 'motor', nombre: 'Motor y transmisión' },
  { clave: 'electricidad', nombre: 'Electricidad' },
  { clave: 'carroceria', nombre: 'Carrocería y limpieza' },
]

export const vehiculoTexto = (v: Pieza['vehiculo']) =>
  v ? `${[v.marca, v.modelo, v.anios].filter(Boolean).join(' ')}${v.motor ? ` · ${v.motor}` : ''}` : 'Uso general'

export function Condicion({ condicion }: { condicion: string | null }) {
  if (!condicion) return null
  return (
    <span className={condicion === 'original'
      ? 'rounded bg-accent px-1.5 text-[11px] font-medium leading-5 text-accent-foreground'
      : 'rounded bg-secondary px-1.5 text-[11px] font-medium leading-5 text-muted-foreground'}>
      {condicion === 'original' ? 'Original' : condicion === 'alterna' ? 'Alterna' : condicion}
    </span>
  )
}

export function PiezaFila({ pieza }: { pieza: Pieza }) {
  return (
    <li>
      <Link
        href={`/admin/piezas/${pieza.id}`}
        className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <PiezaFoto pieza={pieza} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{nombrePieza(pieza.nombre)}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{[vehiculoTexto(pieza.vehiculo), pieza.sistema].filter(Boolean).join(' · ')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {pieza.oem && <span>OEM {pieza.oem}</span>}
            {pieza.fabricante && <span>{pieza.fabricante}</span>}
            {pieza.sku && <span>SKU {pieza.sku}</span>}
            <Condicion condicion={pieza.calidad ?? pieza.condicion} />
          </div>
          {pieza.reemplaza_a && (
            <p className="mt-1 text-xs font-medium text-primary">Reemplaza a {pieza.reemplaza_a.numero ?? pieza.reemplaza_a.nombre}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{formatCurrency(pieza.precio_dop)}</p>
          <Existencia disponible={pieza.disponible} />
          {pieza.existencias?.map((e) => (
            <p key={e.sucursal_id} className="max-w-[160px] truncate text-[11px] tabular-nums text-muted-foreground">{e.sucursal}: {e.disponible}</p>
          ))}
        </div>
      </Link>
    </li>
  )
}
