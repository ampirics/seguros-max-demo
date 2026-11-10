import type { Mesa } from "@/lib/restaurante/tipos"

export const U = 16

export type Punto = { x: number; y: number }

export const px = (t: number) => t * U

export function tamMesa(c: number) {
  if (c <= 2) return { w: 20, h: 18 }
  if (c <= 4) return { w: 28, h: 22 }
  if (c <= 6) return { w: 40, h: 22 }
  if (c <= 8) return { w: 56, h: 22 }
  return { w: 80, h: 26 }
}

export function esCama(m: Pick<Mesa, "id" | "zona">) {
  return m.zona === "gazebo" && m.id !== "G4"
}

/** Puestos alrededor de la mesa: mitad arriba (miran hacia abajo) y mitad abajo (de espaldas). */
export function asientos(m: Pick<Mesa, "id" | "x" | "y" | "capacidad" | "zona">) {
  const { w, h } = tamMesa(m.capacidad)
  const cx = px(m.x)
  const cy = px(m.y)
  const porLado = Math.ceil(m.capacidad / 2)
  const res: { p: Punto; lado: "arriba" | "abajo" }[] = []
  for (let i = 0; i < porLado; i++) {
    const x = cx - w / 2 + ((i + 0.5) * w) / porLado
    if (esCama(m)) {
      res.push({ p: { x, y: cy - 2 }, lado: "arriba" })
      res.push({ p: { x, y: cy + 6 }, lado: "abajo" })
    } else {
      res.push({ p: { x, y: cy - h / 2 - 4 }, lado: "arriba" })
      res.push({ p: { x, y: cy + h / 2 + 5 }, lado: "abajo" })
    }
  }
  return res.slice(0, m.capacidad)
}

function pasillo(m: Pick<Mesa, "y" | "zona">): number {
  if (m.zona === "salon") return 10.2
  if (m.y <= 17) return 18.1
  if (m.y <= 21) return 22.7
  if (m.y <= 27) return 28.5
  if (m.y <= 32) return 33.7
  return 35.8
}

export function acceso(m: Mesa): Punto {
  return { x: px(m.x + (m.capacidad >= 6 ? 0 : 1.7)), y: px(pasillo(m)) }
}

function carril(p: Punto): number {
  const ty = p.y / U
  return ty < 12.5 ? 12.2 : ty
}

export function ruta(desde: Punto, hasta: Punto): Punto[] {
  const yA = px(carril(desde))
  const yB = px(carril(hasta))
  const enMuelle = (y: number) => y > px(12.6)
  const pts: Punto[] = [desde]
  if (Math.abs(yA - yB) < 3) {
    pts.push({ x: desde.x, y: yA }, { x: hasta.x, y: yB })
  } else if (enMuelle(yA) || enMuelle(yB)) {
    const espina = (desde.x + hasta.x) / 2 < px(32) ? px(14.6) : px(50.2)
    pts.push({ x: desde.x, y: yA }, { x: espina, y: yA }, { x: espina, y: yB }, { x: hasta.x, y: yB })
  } else {
    pts.push({ x: desde.x, y: yA }, { x: hasta.x, y: yB })
  }
  pts.push(hasta)
  return pts
}

export function largo(r: Punto[]) {
  let l = 0
  for (let i = 1; i < r.length; i++) l += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y)
  return l
}

export function enRuta(r: Punto[], d: number): Punto {
  for (let i = 1; i < r.length; i++) {
    const seg = Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y)
    if (d <= seg) {
      const t = seg ? d / seg : 1
      return { x: r[i - 1].x + (r[i].x - r[i - 1].x) * t, y: r[i - 1].y + (r[i].y - r[i - 1].y) * t }
    }
    d -= seg
  }
  return r[r.length - 1]
}

/** Hacia dónde mira quien camina el tramo actual: -1 izquierda, 1 derecha. */
export function direccion(r: Punto[], d: number): number {
  for (let i = 1; i < r.length; i++) {
    const seg = Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y)
    if (d <= seg) return r[i].x < r[i - 1].x ? -1 : 1
    d -= seg
  }
  return 1
}
