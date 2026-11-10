import type { ResultadoExterno } from '@/lib/api-types'

type ResultadoApi = Omit<ResultadoExterno, 'id'> & { id?: string }

export const aResultado = (r: ResultadoApi, i: number): ResultadoExterno => ({ ...r, id: r.id ?? `${r.fuente}-${i}-${r.url}` })

export const ordenarResultados = (items: ResultadoExterno[]) => [
  ...items.filter((r) => r.tipo === 'proveedor'),
  ...items.filter((r) => r.tipo !== 'proveedor')
    .sort((a, b) => (a.precio == null ? 1 : 0) - (b.precio == null ? 1 : 0) || (a.precio ?? 0) - (b.precio ?? 0)),
]
