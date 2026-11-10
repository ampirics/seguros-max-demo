import type { BusquedaPiezas, Pieza, PiezaFicha } from '@/lib/api-types'

export const urlImagen = (src?: string | null): string | null => {
  if (!src) return null
  if (/^(https?:|data:|blob:|\/)/.test(src)) return src
  const i = src.indexOf('colt/')
  return i >= 0 ? `/${src.slice(i)}` : `/${src.replace(/^\.?\/*/, '')}`
}

export const aPieza = <T extends Pieza>(p: T): T => ({ ...p, id: String(p.id), imagen: urlImagen(p.imagen) })

export const aBusqueda = (r: BusquedaPiezas): BusquedaPiezas => ({ ...r, items: (r.items ?? []).map(aPieza) })

export const aFicha = (p: PiezaFicha): PiezaFicha => ({
  ...aPieza(p),
  compatibilidad: p.compatibilidad ?? [],
  existencia: p.existencia ?? [],
  imagenes: (p.imagenes?.length ? p.imagenes : p.imagen ? [p.imagen] : []).map((s) => urlImagen(s)).filter((s): s is string => !!s),
  equivalencias: (p.equivalencias ?? []).map((e) => ({ ...e, id: String(e.id), imagen: urlImagen(e.imagen) })),
})
