import { AREAS } from "@/lib/restaurante/plano"
import type { Mesa, Zona } from "@/lib/restaurante/tipos"

// El plano del motor está en casillas (64 x 46). En la escena, una casilla mide medio metro y el centro del plano es el origen.
export const M = 0.5
export const CX = 32
export const CY = 23

export const PISO_MUELLE = 0.35
export const PISO_TIERRA = 0.45

export const aX = (x: number) => (x - CX) * M
export const aZ = (y: number) => (y - CY) * M
export const deX = (x: number) => x / M + CX
export const deZ = (z: number) => z / M + CY

export function pisoDe(zona: Zona) {
  return zona === "salon" ? PISO_TIERRA : PISO_MUELLE
}

/** Medidas de la mesa en metros según los puestos. */
export function medidaMesa(capacidad: number) {
  if (capacidad <= 2) return { w: 0.8, d: 0.8 }
  if (capacidad <= 4) return { w: 1.25, d: 0.9 }
  if (capacidad <= 6) return { w: 1.85, d: 0.95 }
  if (capacidad <= 8) return { w: 2.5, d: 1 }
  return { w: 3.7, d: 1.15 }
}

export function esCama(m: Pick<Mesa, "id" | "zona">) {
  return m.zona === "gazebo" && m.id !== "G4" && /^G\d+$/.test(m.id) && Number(m.id.slice(1)) <= 3
}

/** Rectángulo (en casillas) donde puede ir una mesa de cada zona al organizar. */
export const LIMITES: Record<Zona, { x0: number; x1: number; y0: number; y1: number }> = {
  terraza: { x0: AREAS.terraza.x + 1.5, x1: AREAS.terraza.x + AREAS.terraza.w - 1.5, y0: AREAS.terraza.y + 1.5, y1: AREAS.terraza.y + AREAS.terraza.h - 1.2 },
  muelle: { x0: AREAS.muelle.x + 1.5, x1: AREAS.muelle.x + AREAS.muelle.w - 1.5, y0: 24, y1: 34 },
  gazebo: { x0: AREAS.punta.x + 1.5, x1: AREAS.punta.x + AREAS.punta.w - 1.5, y0: AREAS.punta.y + 1.5, y1: AREAS.punta.y + AREAS.punta.h - 1.5 },
  salon: { x0: AREAS.salon.x + 2, x1: AREAS.salon.x + AREAS.salon.w - 2, y0: AREAS.salon.y + 2, y1: AREAS.salon.y + AREAS.salon.h - 1.5 },
}

export function centroZona(z: Zona) {
  const l = LIMITES[z]
  return { x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2 }
}

export function limitar(z: Zona, x: number, y: number) {
  const l = LIMITES[z]
  return { x: Math.min(l.x1, Math.max(l.x0, x)), y: Math.min(l.y1, Math.max(l.y0, y)) }
}

/** Puestos alrededor de la mesa, en metros relativos a su centro, con hacia dónde miran (radianes). */
export function puestos(capacidad: number, cama: boolean) {
  if (cama) return [{ x: -0.4, z: 0.15, rot: 0 }, { x: 0.4, z: 0.15, rot: 0 }, { x: -0.4, z: -0.45, rot: 0 }, { x: 0.4, z: -0.45, rot: 0 }].slice(0, capacidad)
  const { w, d } = medidaMesa(capacidad)
  if (capacidad <= 2) return [{ x: 0, z: -d / 2 - 0.35, rot: 0 }, { x: 0, z: d / 2 + 0.35, rot: Math.PI }].slice(0, capacidad)
  const porLado = Math.floor(capacidad / 2)
  const res: { x: number; z: number; rot: number }[] = []
  for (let i = 0; i < porLado; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / porLado
    res.push({ x, z: -d / 2 - 0.35, rot: 0 }, { x, z: d / 2 + 0.35, rot: Math.PI })
  }
  if (capacidad % 2) res.push({ x: w / 2 + 0.35, z: 0, rot: -Math.PI / 2 })
  return res.slice(0, capacidad)
}

export const VISTAS: Record<"todo" | Zona, { pos: [number, number, number]; mira: [number, number, number]; nombre: string }> = {
  todo: { pos: [0, 19, 17], mira: [0, 0, 0.5], nombre: "Todo" },
  terraza: { pos: [0, 13.5, 6.5], mira: [0, 0, -2.6], nombre: "Terraza" },
  muelle: { pos: [2, 12, 11.5], mira: [1.5, 0, 2.6], nombre: "Muelle" },
  gazebo: { pos: [0, 10, 15.5], mira: [0, 0, 8], nombre: "Gazebo" },
  salon: { pos: [0, 11, -0.5], mira: [0, 0, -8], nombre: "Salón" },
}
