import { ALTO, ANCHO, AREAS, CAJA, PASE, PUERTA, PUESTOS_COCINA } from "@/lib/restaurante/plano"
import type { Mesa } from "@/lib/restaurante/tipos"
import { asientos, esCama, px, tamMesa, U, type Punto } from "./rutas"

export const W = ANCHO * U
export const H = ALTO * U

export type Fase = "dia" | "dorada" | "noche"

export type Ropa = { piel: string; pelo: string; camisa: string; pantalon: string }

type C = CanvasRenderingContext2D

const P = {
  agua: "#1BB0A9",
  aguaHonda: "#159792",
  aguaOla: "#4FCDC4",
  aguaBrillo: "#C9F4EE",
  arena: "#EAD6A2",
  arenaOsc: "#D4BB82",
  madera: "#C99B66",
  maderaJunta: "#A97B4B",
  maderaLuz: "#DDB27D",
  punta: "#B7854F",
  puntaJunta: "#93673A",
  baldosa: "#EEE1C8",
  baldosaJunta: "#DCCAA8",
  grama: "#5AA43C",
  gramaRaya: "#6BB64A",
  muro: "#3A2920",
  techo: "#5A4434",
  contorno: "#1C1A1A",
}

export const PIELES = ["#F3CBA5", "#DCA27A", "#BC7B52", "#8E5627", "#6A3D22", "#E9B590"]
export const PELOS = ["#2A1A11", "#4B2E1C", "#101010", "#7A4A27", "#C99F61", "#3A291F"]
const CAMISAS = ["#FFFFFF", "#F2C14E", "#E86A9B", "#7FCFCB", "#9B8CE8", "#6BBF8A", "#E8866A", "#4A7BD0", "#F4ECDF", "#D94F4F", "#2E6F73"]
const PANTALONES = ["#2B3A55", "#3B3B3B", "#D9CFB8", "#5A4632", "#1F2F3A", "#6F7F8F"]

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

export function ropa(semilla: string): Ropa {
  const h = hash(semilla)
  return { piel: PIELES[h % 6], pelo: PELOS[(h >> 3) % 6], camisa: CAMISAS[(h >> 6) % CAMISAS.length], pantalon: PANTALONES[(h >> 10) % 6] }
}

export function r(c: C, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function marco(c: C, x: number, y: number, w: number, h: number, col: string, g = 1) {
  r(c, x, y, w, g, col)
  r(c, x, y + h - g, w, g, col)
  r(c, x, y, g, h, col)
  r(c, x + w - g, y, g, h, col)
}

export function fasePorMinuto(min: number): Fase {
  if (min >= 17 * 60 + 30 && min < 18 * 60 + 50) return "dorada"
  if (min >= 18 * 60 + 50 || min < 6 * 60 + 15) return "noche"
  return "dia"
}

// ---------- agua (se anima) ----------

export function dibujarAgua(c: C, t: number) {
  r(c, 0, px(12.5), W, H - px(12.5), P.agua)
  for (let y = px(13); y < H; y += 24) r(c, 0, y + 10, W, 6, P.aguaHonda)
  const f = t / 900
  for (let y = px(13) + 3; y < H; y += 9) {
    const desf = Math.floor((Math.sin(y * 0.37 + f) * 0.5 + 0.5) * 28 + y * 3) % 34
    for (let x = desf - 34; x < W; x += 34) r(c, x, y, 7, 1, P.aguaOla)
  }
  const n = 90
  for (let i = 0; i < n; i++) {
    const s = hash("b" + i)
    const vida = (t / 1400 + (s % 1000) / 1000) % 1
    if (vida > 0.35) continue
    const x = s % W
    const y = px(13) + ((s >> 8) % (H - px(13)))
    r(c, x, y, vida < 0.18 ? 2 : 1, 1, P.aguaBrillo)
  }
}

// ---------- escena fija (se dibuja una vez por fase) ----------

function palmera(c: C, x: number, y: number, tam = 1) {
  r(c, x - 9 * tam, y + 3, 18 * tam, 4, "rgba(0,0,0,0.18)")
  for (let i = 0; i < 26 * tam; i += 3) r(c, x - 2 + Math.round(Math.sin(i / 9) * 2), y - i, 5, 3, i % 6 ? "#8A6942" : "#6E5233")
  const cx = x + Math.round(Math.sin((26 * tam) / 9) * 2)
  const cy = y - 26 * tam
  const hojas: [number, number][] = [
    [-1, -0.35],
    [1, -0.35],
    [-0.8, 0.45],
    [0.85, 0.5],
    [0, -1],
    [-0.2, 0.9],
  ]
  for (const [dx, dy] of hojas) {
    for (let k = 0; k < 13 * tam; k++) {
      const caida = k * k * 0.035
      r(c, cx + dx * k * 1.15, cy + dy * k * 0.9 + caida, 4, 3, k % 3 ? "#2F8A4A" : "#45A85E")
    }
  }
  r(c, cx - 3, cy - 2, 6, 5, "#2B7A42")
  r(c, cx - 2, cy + 2, 3, 3, "#7A5A2E")
  r(c, cx + 1, cy + 3, 3, 3, "#6A4C25")
}

function calle(c: C) {
  r(c, 0, 0, W, px(1.6), "#3A4045")
  for (let x = 6; x < W; x += 30) r(c, x, 11, 16, 2, "#E6DFC4")
  r(c, 0, px(1.6), W, px(0.4), "#BDB6A6")
  for (let x = 0; x < W; x += 12) r(c, x, px(1.6), 1, px(0.4), "#A8A192")
  const autos: [number, string][] = [
    [80, "#D94F4F"],
    [150, "#F4ECDF"],
    [610, "#2E6F73"],
    [820, "#F2C14E"],
  ]
  for (const [x, col] of autos) {
    r(c, x + 2, 4, 30, 14, "rgba(0,0,0,0.25)")
    r(c, x, 2, 30, 14, col)
    r(c, x + 8, 4, 13, 10, "#9CC9D8")
    r(c, x + 9, 5, 11, 2, "#C7E6EF")
    marco(c, x, 2, 30, 14, "rgba(0,0,0,0.35)")
  }
}

function edificio(c: C) {
  const ed = AREAS.edificio
  r(c, px(ed.x), px(ed.y), px(ed.w), px(ed.h), P.muro)

  const co = AREAS.cocina
  for (let y = px(co.y); y < px(co.y + co.h); y += 8)
    for (let x = px(co.x); x < px(co.x + co.w); x += 8) r(c, x, y, 8, 8, (x / 8 + y / 8) % 2 ? "#E4E9E9" : "#CED6D6")
  r(c, px(co.x), px(co.y), px(co.w), 16, "#8E9BA1")
  r(c, px(co.x), px(co.y) + 16, px(co.w), 3, "#6E7B81")
  for (const k of Object.values(PUESTOS_COCINA)) {
    r(c, px(k.x) - 14, px(co.y), 28, 16, "#5E6A70")
    for (const dx of [-10, 2]) {
      r(c, px(k.x) + dx, px(co.y) + 3, 8, 8, "#2A2A2A")
      marco(c, px(k.x) + dx, px(co.y) + 3, 8, 8, "#474747")
    }
  }
  r(c, px(co.x) + 2, px(co.y) + 2, 10, 26, "#B9C4C8")
  r(c, px(co.x) + 3, px(co.y) + 4, 8, 1, "#8E9BA1")
  r(c, px(co.x) + 3, px(co.y) + 14, 8, 1, "#8E9BA1")
  r(c, px(5), px(8.4), px(13), 10, "#A7B3B8")
  r(c, px(5), px(8.4), px(13), 2, "#C5D0D4")
  for (let x = px(6); x < px(17); x += 22) {
    r(c, x, px(8.4) + 3, 9, 4, "#FFFFFF")
    r(c, x + 2, px(8.4) + 4, 5, 2, "#7FCFCB")
  }
  r(c, px(PASE.x) - 22, px(co.y + co.h) - 10, 44, 8, "#B8C3C7")
  r(c, px(PASE.x) - 22, px(co.y + co.h) - 10, 44, 2, "#D9E1E4")

  const sa = AREAS.salon
  r(c, px(sa.x), px(sa.y), px(sa.w), px(sa.h), "#8A5D3B")
  for (let y = px(sa.y) + 5; y < px(sa.y + sa.h); y += 7) r(c, px(sa.x), y, px(sa.w), 1, "#76502F")
  for (let y = px(sa.y); y < px(sa.y + sa.h); y += 7) for (let x = px(sa.x) + ((y / 7) % 2) * 20; x < px(sa.x + sa.w); x += 40) r(c, x, y, 1, 6, "#76502F")
  r(c, px(sa.x) + 22, px(sa.y) + 30, px(sa.w) - 44, 58, "#0B2A2E")
  marco(c, px(sa.x) + 22, px(sa.y) + 30, px(sa.w) - 44, 58, "#E8866A", 2)
  marco(c, px(sa.x) + 27, px(sa.y) + 35, px(sa.w) - 54, 48, "rgba(232,134,106,0.45)")
  for (const [x, y] of [
    [px(sa.x) + 5, px(sa.y) + 4],
    [px(sa.x + sa.w) - 15, px(sa.y) + 4],
  ]) {
    r(c, x + 1, y + 6, 10, 8, "#7A4B2A")
    r(c, x - 2, y - 2, 16, 10, "#3F8F4F")
    r(c, x + 2, y - 5, 8, 5, "#57AE63")
  }
  r(c, px(sa.x) + 8, px(sa.y), px(sa.w) - 16, 3, "#BFE3EA")

  const ba = AREAS.bar
  for (let y = px(ba.y); y < px(ba.y + ba.h); y += 10)
    for (let x = px(ba.x); x < px(ba.x + ba.w); x += 10) r(c, x, y, 10, 10, (x / 10 + y / 10) % 2 ? "#C4704E" : "#B5633F")
  r(c, px(ba.x) + 6, px(ba.y), px(ba.w) - 12, 10, "#4A3226")
  const botellas = ["#6BBF8A", "#E8866A", "#F2C14E", "#7FCFCB", "#D94F4F", "#9B8CE8", "#F4ECDF"]
  for (let x = px(ba.x) + 9, i = 0; x < px(ba.x + ba.w) - 10; x += 6, i++) {
    r(c, x, px(ba.y) + 1, 3, 7, botellas[i % botellas.length])
    r(c, x + 1, px(ba.y), 1, 2, "#2A1A11")
  }
  r(c, px(ba.x) + 10, px(ba.y) + 34, px(ba.w) - 70, 14, "#4A3226")
  r(c, px(ba.x) + 10, px(ba.y) + 34, px(ba.w) - 70, 4, "#6B4A36")
  for (let x = px(ba.x) + 16; x < px(ba.x + ba.w) - 64; x += 18) {
    r(c, x, px(ba.y) + 52, 8, 8, "#2A1A11")
    r(c, x + 1, px(ba.y) + 53, 6, 6, "#7A4B2A")
  }
  r(c, px(CAJA.x) - 8, px(CAJA.y) - 12, 22, 14, "#2E3A3F")
  r(c, px(CAJA.x) - 6, px(CAJA.y) - 10, 12, 6, "#7FCFCB")

  const muroGrosor = 4
  marco(c, px(ed.x), px(ed.y), px(ed.w), px(ed.h), P.muro, muroGrosor)
  r(c, px(co.x + co.w), px(ed.y), muroGrosor, px(ed.h), P.muro)
  r(c, px(sa.x + sa.w), px(ed.y), muroGrosor, px(ed.h), P.muro)
  for (const x of [px(PUERTA.x), px(PASE.x), px(31)]) r(c, x - 12, px(ed.y + ed.h) - muroGrosor, 24, muroGrosor, "#CDBA8E")
  r(c, px(PUERTA.x) - 14, px(ed.y + ed.h), 28, 6, "#6B4A36")
}

function arena(c: C) {
  r(c, 0, px(12), W, px(1), P.arena)
  for (let i = 0; i < 160; i++) {
    const s = hash("a" + i)
    r(c, s % W, px(12) + ((s >> 9) % 15), 1, 1, P.arenaOsc)
  }
  r(c, 0, px(12.9), W, 2, "rgba(255,255,255,0.55)")
  for (const [x, y] of [
    [30, 205],
    [190, 222],
    [880, 214],
    [990, 230],
  ])
    r(c, x, y, 7, 4, "#8A8F8C")
}

function muelle(c: C) {
  const mu = AREAS.muelle
  r(c, px(mu.x) + 5, px(mu.y) + 6, px(mu.w), px(mu.h), "rgba(4,60,64,0.35)")
  r(c, px(mu.x), px(mu.y), px(mu.w), px(mu.h), P.madera)
  for (let y = px(mu.y); y < px(mu.y + mu.h); y += 5) {
    r(c, px(mu.x), y, px(mu.w), 1, P.maderaJunta)
    for (let x = px(mu.x) + ((y / 5) % 4) * 17; x < px(mu.x + mu.w); x += 68) r(c, x, y + 1, 1, 4, P.maderaJunta)
  }
  for (let i = 0; i < 70; i++) {
    const s = hash("m" + i)
    r(c, px(mu.x) + (s % px(mu.w)), px(mu.y) + ((s >> 8) % px(mu.h)), 6, 1, P.maderaLuz)
  }

  const te = AREAS.terraza
  r(c, px(te.x), px(te.y), px(te.w), px(te.h), P.baldosa)
  for (let y = px(te.y); y < px(te.y + te.h); y += 12) r(c, px(te.x), y, px(te.w), 1, P.baldosaJunta)
  for (let x = px(te.x); x < px(te.x + te.w); x += 12) r(c, x, px(te.y), 1, px(te.h), P.baldosaJunta)

  const gr = AREAS.grama
  r(c, px(gr.x) - 3, px(gr.y) - 3, px(gr.w) + 6, px(gr.h) + 6, "#F2EBDD")
  r(c, px(gr.x), px(gr.y), px(gr.w), px(gr.h), P.grama)
  for (let x = px(gr.x); x < px(gr.x + gr.w); x += 16) r(c, x, px(gr.y), 8, px(gr.h), P.gramaRaya)
  for (let i = 0; i < 60; i++) {
    const s = hash("g" + i)
    r(c, px(gr.x) + (s % px(gr.w)), px(gr.y) + ((s >> 8) % px(gr.h)), 1, 2, "#86CC5F")
  }
  for (let k = 0; k < 4; k++) r(c, px(gr.x) + 10 + k * 28, px(gr.y + gr.h) + 6, 14, 8, "#F2EBDD")

  const pu = AREAS.punta
  r(c, px(pu.x), px(pu.y), px(pu.w), px(pu.h), P.punta)
  for (let y = px(pu.y); y < px(pu.y + pu.h); y += 5) {
    r(c, px(pu.x), y, px(pu.w), 1, P.puntaJunta)
    for (let x = px(pu.x) + ((y / 5) % 3) * 23; x < px(pu.x + pu.w); x += 69) r(c, x, y + 1, 1, 4, P.puntaJunta)
  }
  r(c, px(pu.x), px(pu.y) - 2, px(pu.w), 2, "#8C6136")

  for (let x = px(mu.x); x <= px(mu.x + mu.w); x += 32) {
    r(c, x - 2, px(mu.y + mu.h) - 2, 5, 8, "#5A3B22")
    r(c, x - 2, px(mu.y + mu.h) + 6, 5, 3, "rgba(4,60,64,0.4)")
  }
  for (let y = px(mu.y) + 8; y < px(mu.y + mu.h); y += 32) {
    r(c, px(mu.x) - 3, y, 4, 4, "#5A3B22")
    r(c, px(mu.x + mu.w) - 1, y, 4, 4, "#5A3B22")
  }
  r(c, px(mu.x), px(mu.y + mu.h) - 2, px(mu.w), 2, "#E9E1CF")
  r(c, px(mu.x), px(23), 2, px(mu.h) - px(10), "#E9E1CF")
  r(c, px(mu.x + mu.w) - 2, px(23), 2, px(mu.h) - px(10), "#E9E1CF")

  r(c, px(51) + 4, px(17), 26, 40, "#B07C4C")
  for (let y = px(17); y < px(17) + 40; y += 5) r(c, px(51) + 4, y, 26, 1, "#93673A")
  r(c, px(51) + 10, px(17) + 6, 14, 26, "#F4ECDF")
  r(c, px(51) + 10, px(17) + 6, 14, 3, "#7FCFCB")
}

function camas(c: C, mesas: Pick<Mesa, "id" | "zona" | "x" | "y" | "capacidad">[]) {
  for (const m of mesas) {
    if (!esCama(m)) continue
    const x = px(m.x) - 18
    const y = px(m.y) - 14
    r(c, x + 3, y + 4, 36, 30, "rgba(0,0,0,0.2)")
    r(c, x, y, 36, 30, "#7A4B2A")
    r(c, x + 2, y + 2, 32, 26, "#FBF6EC")
    r(c, x + 2, y + 24, 32, 4, "#E9DFCB")
    r(c, x + 4, y + 3, 10, 6, "#E8866A")
    r(c, x + 22, y + 3, 10, 6, "#7FCFCB")
    r(c, x + 15, y + 3, 6, 6, "#F2C14E")
  }
}

function gazebo(c: C, sobre: boolean) {
  const gx = px(32)
  const gy = px(38)
  if (!sobre) {
    r(c, gx - 34, gy - 26, 68, 50, "#C9A27A")
    for (let y = gy - 26; y < gy + 24; y += 6) r(c, gx - 34, y, 68, 1, "#B48C63")
    return
  }
  c.fillStyle = "rgba(255,255,255,0.16)"
  c.fillRect(gx - 34, gy - 30, 68, 54)
  for (const [dx, dy] of [
    [-34, -30],
    [31, -30],
    [-34, 20],
    [31, 20],
  ]) {
    r(c, gx + dx, gy + dy, 4, 6, "#FFFFFF")
    r(c, gx + dx + (dx < 0 ? 4 : -6), gy + dy + 2, 6, 14, "rgba(255,255,255,0.55)")
  }
  r(c, gx - 34, gy - 30, 68, 2, "#FFFFFF")
  r(c, gx - 34, gy - 30, 2, 54, "rgba(255,255,255,0.7)")
  r(c, gx + 32, gy - 30, 2, 54, "rgba(255,255,255,0.7)")
  for (let x = gx - 30; x < gx + 30; x += 10) r(c, x, gy - 28, 1, 50, "rgba(255,255,255,0.2)")
}

function techoTerraza(c: C) {
  const te = AREAS.terraza
  c.fillStyle = "rgba(60,48,40,0.13)"
  c.fillRect(px(te.x), px(te.y), px(te.w), px(te.h))
  for (let x = px(te.x); x <= px(te.x + te.w); x += px(3)) r(c, x, px(te.y), 2, px(te.h), "rgba(70,56,46,0.32)")
  r(c, px(te.x), px(te.y), px(te.w), 3, "#5C4A3C")
  r(c, px(te.x), px(te.y + te.h) - 2, px(te.w), 3, "#5C4A3C")
  r(c, px(te.x), px(te.y), 3, px(te.h), "#5C4A3C")
  r(c, px(te.x + te.w) - 3, px(te.y), 3, px(te.h), "#5C4A3C")
  const panelX = px(te.x + te.w) - px(11)
  const panelY = px(te.y) + 4
  c.fillStyle = "rgba(28,48,92,0.42)"
  c.fillRect(panelX, panelY, px(10.5), px(4.6))
  for (let x = panelX; x < panelX + px(10.5); x += 14) r(c, x, panelY, 1, px(4.6), "rgba(200,220,255,0.35)")
  for (let y = panelY; y < panelY + px(4.6); y += 10) r(c, panelX, y, px(10.5), 1, "rgba(200,220,255,0.35)")
  for (const x of [te.x, te.x + te.w / 3, te.x + (2 * te.w) / 3, te.x + te.w]) {
    for (const y of [te.y, te.y + te.h]) {
      r(c, px(x) - 3, px(y) - 3, 7, 7, "#4A3A2E")
      r(c, px(x) - 2, px(y) - 2, 5, 5, "#6A5444")
    }
  }
}

/** Fondo fijo: todo menos el agua, que va aparte para animarla. */
export function escenaFija(c: C, mesas: Pick<Mesa, "id" | "zona" | "x" | "y" | "capacidad">[]) {
  c.clearRect(0, 0, W, H)
  calle(c)
  edificio(c)
  arena(c)
  muelle(c)
  gazebo(c, false)
  camas(c, mesas)
  for (const [x, y, t] of [
    [38, 206, 1.1],
    [112, 204, 0.9],
    [176, 207, 0.8],
    [880, 206, 0.85],
    [948, 205, 1.15],
    [1008, 204, 0.9],
  ] as const)
    palmera(c, x, y, t)
}

/** Techos y estructuras que van por encima de la gente. */
export function escenaEncima(c: C) {
  c.clearRect(0, 0, W, H)
  techoTerraza(c)
  gazebo(c, true)
}

export function luces(c: C, fase: Fase, t: number) {
  const te = AREAS.terraza
  const pu = AREAS.punta
  const filas: Punto[][] = []
  const fila = (x0: number, x1: number, y: number) => {
    const pts: Punto[] = []
    for (let x = x0; x <= x1; x += 18) pts.push({ x, y: y + Math.sin((x - x0) / 30) * 3 })
    filas.push(pts)
  }
  fila(px(te.x) + 6, px(te.x + te.w) - 6, px(te.y + te.h) + 3)
  fila(px(pu.x) + 6, px(pu.x + pu.w) - 6, px(pu.y) + 2)
  fila(px(AREAS.muelle.x) + 6, px(AREAS.muelle.x + AREAS.muelle.w) - 6, px(AREAS.grama.y) - 6)
  const encendidas = fase !== "dia"
  for (const pts of filas) {
    for (let i = 1; i < pts.length; i++) r(c, pts[i - 1].x, pts[i - 1].y, pts[i].x - pts[i - 1].x, 1, "rgba(40,30,20,0.55)")
    pts.forEach((p, i) => {
      const titila = encendidas && (Math.sin(t / 500 + i * 1.7) > 0.96 ? 0.6 : 1)
      if (encendidas) {
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14)
        g.addColorStop(0, `rgba(255,214,130,${0.42 * (titila || 1)})`)
        g.addColorStop(1, "rgba(255,214,130,0)")
        c.fillStyle = g
        c.fillRect(p.x - 14, p.y - 14, 28, 28)
      }
      r(c, p.x - 1, p.y, 3, 3, encendidas ? "#FFE7A8" : "#F5F0E2")
    })
  }
  if (fase === "noche") {
    for (const x of [px(PUERTA.x), px(PASE.x)]) {
      const g = c.createRadialGradient(x, px(12), 0, x, px(12), 40)
      g.addColorStop(0, "rgba(255,200,120,0.28)")
      g.addColorStop(1, "rgba(255,200,120,0)")
      c.fillStyle = g
      c.fillRect(x - 40, px(12) - 40, 80, 80)
    }
  }
}

export function tinte(c: C, fase: Fase) {
  if (fase === "dia") return
  c.fillStyle = fase === "dorada" ? "rgba(255,138,64,0.15)" : "rgba(8,18,56,0.44)"
  c.fillRect(0, 0, W, H)
}

// ---------- personajes ----------

export function persona(
  c: C,
  x: number,
  y: number,
  ro: Ropa,
  frame: number,
  o: { andando?: boolean; delantal?: string; gorro?: boolean; mira?: number; bandeja?: boolean } = {},
) {
  const X = Math.round(x) - 5
  const Y = Math.round(y) - 15
  r(c, X + 1, Y + 14, 9, 2, "rgba(0,0,0,0.22)")
  const paso = o.andando ? frame % 4 : 0
  const pieA = paso === 1 ? -1 : paso === 3 ? 1 : 0
  const brazo = o.andando ? (frame % 2 ? 1 : -1) : 0
  const partes: [number, number, number, number, string][] = [
    [2, 10 + Math.max(0, pieA), 2, 4 - Math.max(0, pieA), ro.pantalon],
    [6, 10 + Math.max(0, -pieA), 2, 4 - Math.max(0, -pieA), ro.pantalon],
    [1, 5, 8, 6, ro.camisa],
    [0, 5 + brazo, 1, 4, ro.piel],
    [9, 5 - brazo, 1, 4, ro.piel],
    [2, 0, 6, 5, ro.piel],
  ]
  for (const [dx, dy, w, h] of partes) r(c, X + dx - 1, Y + dy - 1, w + 2, h + 2, P.contorno)
  if (o.gorro) r(c, X + 1, Y - 4, 8, 5, P.contorno)
  for (const [dx, dy, w, h, col] of partes) r(c, X + dx, Y + dy, w, h, col)
  r(c, X + 2, Y + 13, 2, 1, "#1A1A1A")
  r(c, X + 6, Y + 13, 2, 1, "#1A1A1A")
  if (o.delantal) {
    r(c, X + 2, Y + 7, 6, 5, o.delantal)
    r(c, X + 2, Y + 7, 6, 1, "rgba(255,255,255,0.35)")
  }
  r(c, X + 2, Y, 6, 2, ro.pelo)
  r(c, X + (o.mira === -1 ? 7 : 2), Y + 1, 1, 2, ro.pelo)
  const ojo = o.mira === -1 ? -1 : o.mira === 1 ? 1 : 0
  r(c, X + 3 + ojo, Y + 3, 1, 1, "#1A1A1A")
  r(c, X + 6 + ojo, Y + 3, 1, 1, "#1A1A1A")
  r(c, X + 3, Y + 5, 4, 1, "rgba(0,0,0,0.12)")
  if (o.gorro) {
    r(c, X + 2, Y - 3, 6, 4, "#FFFFFF")
    r(c, X + 2, Y, 6, 1, "#DDE3E6")
  }
  if (o.bandeja) {
    r(c, X + 8, Y + 4, 6, 2, "#C9CED1")
    r(c, X + 9, Y + 2, 2, 2, "#FFFFFF")
    r(c, X + 12, Y + 2, 2, 2, "#F2C14E")
  }
}

export function sentado(c: C, p: Punto, ro: Ropa, lado: "arriba" | "abajo", frame: number, i: number) {
  const X = Math.round(p.x) - 4
  const Y = Math.round(p.y) - 6
  const mov = (frame + i * 3) % 14 === 0 ? 1 : 0
  if (lado === "arriba") {
    r(c, X - 1, Y + 4, 10, 6, P.contorno)
    r(c, X, Y - 1 - mov, 8, 7, P.contorno)
    r(c, X, Y + 5, 8, 4, ro.camisa)
    r(c, X + 1, Y - mov, 6, 5, ro.piel)
    r(c, X + 1, Y - mov, 6, 2, ro.pelo)
    r(c, X + 2, Y + 2 - mov, 1, 1, "#1A1A1A")
    r(c, X + 5, Y + 2 - mov, 1, 1, "#1A1A1A")
  } else {
    r(c, X - 1, Y + 1, 10, 8, P.contorno)
    r(c, X, Y + 3, 8, 5, ro.camisa)
    r(c, X + 1, Y + 1 - mov, 6, 4, ro.pelo)
    r(c, X + 1, Y + 4 - mov, 6, 1, ro.piel)
  }
}

// ---------- mesas ----------

export function sillas(c: C, m: Mesa) {
  if (esCama(m)) return
  for (const a of asientos(m)) {
    const y = a.lado === "arriba" ? a.p.y - 2 : a.p.y - 3
    r(c, a.p.x - 4, y, 8, 5, "#6E4524")
    r(c, a.p.x - 4, a.lado === "arriba" ? y : y + 4, 8, 1, "#4E2F17")
  }
}

export function mesa(c: C, m: Mesa, colorEstado: string, sel: boolean, parpadeo: boolean) {
  const { w, h } = tamMesa(m.capacidad)
  const x = px(m.x) - w / 2
  const y = px(m.y) - h / 2
  if (esCama(m)) {
    marco(c, px(m.x) - 20, px(m.y) - 16, 40, 34, colorEstado, 2)
  } else {
    r(c, x + 2, y + 3, w, h, "rgba(0,0,0,0.22)")
    r(c, x - 2, y - 2, w + 4, h + 4, colorEstado)
    r(c, x, y, w, h, m.zona === "salon" ? "#FFFDF8" : "#FBF8F2")
    r(c, x, y + h - 2, w, 2, "#E6DDCC")
    r(c, x + 2, y + 2, w - 4, 1, "#FFFFFF")
  }
  if (sel) {
    const pad = esCama(m) ? 24 : 6
    const ww = esCama(m) ? 48 : w + 12
    const hh = esCama(m) ? 42 : h + 12
    marco(c, px(m.x) - (esCama(m) ? 24 : w / 2 + pad), px(m.y) - (esCama(m) ? 20 : h / 2 + pad), ww, hh, "#FFFFFF", 2)
  }
  if (parpadeo) marco(c, px(m.x) - w / 2 - 4, px(m.y) - h / 2 - 4, w + 8, h + 8, "#FFFFFF", 1)
}

export function sobreMesa(c: C, m: Mesa, servidos: number, comensales: number, estado: Mesa["estado"]) {
  const { w } = tamMesa(m.capacidad)
  const cx = px(m.x)
  const cy = px(m.y)
  if (estado === "reservada") {
    r(c, cx - 7, cy - 4, 14, 8, "#9B8CE8")
    r(c, cx - 6, cy - 3, 12, 6, "#F4F1FF")
    r(c, cx - 4, cy - 1, 8, 1, "#9B8CE8")
    r(c, cx - 4, cy + 1, 5, 1, "#9B8CE8")
    return
  }
  if (estado === "libre") {
    r(c, cx - 1, cy - 3, 3, 5, "#7FCFCB")
    r(c, cx - 2, cy - 4, 5, 2, "#5DA53F")
    return
  }
  if (estado === "limpieza") {
    for (let i = 0; i < Math.min(3, Math.floor(w / 9)); i++) {
      r(c, cx - w / 2 + 3 + i * 9, cy - 3, 6, 6, "#E2DCD0")
      r(c, cx - w / 2 + 4 + i * 9, cy - 2, 2, 2, "#B8A88E")
    }
    return
  }
  const vasos = Math.min(comensales, Math.floor(w / 6))
  for (let i = 0; i < vasos; i++) {
    const vx = cx - w / 2 + 3 + i * ((w - 6) / Math.max(1, vasos))
    r(c, vx, cy - (i % 2 ? -4 : 6), 3, 4, i % 2 ? "#BFE6F2" : "#F2C14E")
  }
  const n = Math.min(servidos, Math.max(1, Math.floor(w / 9)))
  const colores = ["#E8866A", "#F2C14E", "#6BBF8A", "#D94F4F", "#C98C4E"]
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + 4 + i * 9
    r(c, x, cy - 3, 7, 7, "#FFFFFF")
    r(c, x, cy - 3, 7, 1, "#E4E4E4")
    r(c, x + 2, cy - 1, 3, 3, colores[(i + m.x) % colores.length])
  }
  if (estado === "cuenta") {
    r(c, cx + w / 2 - 9, cy, 7, 9, "#0B2A2E")
    r(c, cx + w / 2 - 8, cy + 1, 5, 2, "#F2C14E")
  }
}

export function campana(c: C, m: Mesa) {
  const { h } = tamMesa(m.capacidad)
  const x = px(m.x) - 4
  const y = px(m.y) - h / 2 - 20
  r(c, x - 1, y - 1, 10, 10, P.contorno)
  r(c, x, y, 8, 8, "#FFFFFF")
  r(c, x + 2, y + 1, 4, 4, "#F2C14E")
  r(c, x + 1, y + 5, 6, 1, "#F2C14E")
  r(c, x + 3, y + 6, 2, 1, "#E8866A")
}

export function cocinaActiva(c: C, k: Punto, frame: number) {
  const y = px(AREAS.cocina.y)
  for (const dx of [-10, 2]) {
    const f = (frame + dx) % 3
    r(c, k.x + dx + 1, y + 6 - f, 2, 3 + f, "#FF8A2B")
    r(c, k.x + dx + 4, y + 5 + f % 2, 2, 3, "#FFC23D")
    r(c, k.x + dx + 2, y + 7, 4, 2, "#FFE07A")
  }
  r(c, k.x - 9, y + 2, 8, 3, "#3E3E3E")
  r(c, k.x - 7, y + 1, 4, 1, "rgba(255,255,255,0.6)")
  if (frame % 6 < 3) r(c, k.x - 5, y - 2, 2, 2, "rgba(255,255,255,0.5)")
}

export function bote(c: C, t: number) {
  const x = ((t / 70) % (W + 120)) - 60
  const y = H - 22
  r(c, x - 4, y + 9, 44, 2, "rgba(255,255,255,0.45)")
  r(c, x, y + 4, 36, 7, "#F4ECDF")
  r(c, x + 2, y + 9, 32, 2, "#2E6F73")
  r(c, x + 10, y - 2, 12, 7, "#FFFFFF")
  r(c, x + 12, y - 1, 8, 3, "#7FCFCB")
  r(c, x - 8, y + 7, 6, 1, "#C9F4EE")
}

export { P as PALETA, PASE, PUERTA }
