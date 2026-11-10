"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { AREAS } from "@/lib/restaurante/plano"
import { aX, aZ, M, PISO_MUELLE, PISO_TIERRA } from "./coords"
import { TEMAS, type Deco, type EstiloFino, type Planta, type Tema } from "./estilos"
import { caja, capsulaEntre, cil, colocar, esfera, unir, type Parte } from "./geo"
import { texturaArena, texturaBrillo } from "./texturas"

type V3 = [number, number, number]
export type Brillo = { p: V3; s: number }

const r0 = (a: { x: number; y: number; w: number; h: number }) => ({ w: a.w * M, d: a.h * M, x: aX(a.x + a.w / 2), z: aZ(a.y + a.h / 2) })
const MU = r0(AREAS.muelle)
const TE = r0(AREAS.terraza)

export const matDoble = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide })
const matTela = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthWrite: false })
const matTecho = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false })
const matLuzApagada = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, side: THREE.DoubleSide })
const matLuzEncendida = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color("#ffd9a0").multiplyScalar(1.25), toneMapped: false, side: THREE.DoubleSide })

/* ---------- Utilidades de geometría ---------- */

function azar(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const tono = (c: string, k: number) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`
const mezcla = (a: string, b: string, k: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

function malla(pos: number[], idx?: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  if (idx) g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function mover(partes: Parte[], pos: V3, rotY = 0, esc: number | V3 = 1, rotX = 0) {
  const e: V3 = typeof esc === "number" ? [esc, esc, esc] : esc
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0, "YXZ")), new THREE.Vector3(...e))
  partes.forEach((p) => p.g.applyMatrix4(m))
  return partes
}

/** Follaje suelto: muchas hojitas o brácteas orientadas al azar dentro de un elipsoide. */
function nube(c: V3, radio: V3, n: number, colores: string[], semilla: number, tam = 0.07): Parte[] {
  const r = azar(semilla)
  const porColor: number[][] = colores.map(() => [])
  for (let i = 0; i < n; i++) {
    let x = 0
    let y = 0
    let z = 0
    do {
      x = r() * 2 - 1
      y = r() * 2 - 1
      z = r() * 2 - 1
    } while (x * x + y * y + z * z > 1)
    const k = Math.pow(x * x + y * y + z * z, 0.15)
    const cx = c[0] + x * radio[0] * k
    const cy = c[1] + y * radio[1] * k
    const cz = c[2] + z * radio[2] * k
    const s = tam * (0.7 + r() * 0.6)
    const a = r() * Math.PI * 2
    const b = (r() - 0.5) * 1.2
    const u: V3 = [Math.cos(a) * s, Math.sin(b) * s * 0.6, Math.sin(a) * s]
    const v: V3 = [-Math.sin(a) * s * 0.6, s * 0.35, Math.cos(a) * s * 0.6]
    porColor[Math.floor(r() * colores.length)].push(cx - u[0], cy - u[1], cz - u[2], cx + u[0], cy + u[1], cz + u[2], cx + v[0], cy + v[1], cz + v[2], cx - u[0], cy - u[1], cz - u[2], cx - v[0], cy - v[1], cz - v[2], cx + u[0], cy + u[1], cz + u[2])
  }
  return porColor.flatMap((pos, i) => (pos.length ? [{ g: malla(pos), c: colores[i] }] : []))
}

const VERDES = ["#2f6a32", "#3f7d3a", "#4f8d42", "#2a5a2e", "#5a9a48"]
const FUCSIAS = ["#d43a83", "#e5609c", "#c22e70", "#f08fb8", "#d9468e"]

/** Hoja de cocotero: raquis arqueado sobre +x con folíolos colgando a ambos lados. */
function fronda(L: number, alza: number, caida: number, folio: number, n: number, ca: string, cb: string, colgar = 0.5): Parte[] {
  const P = (k: number): V3 => [L * k, L * (alza * k - caida * k * k), 0]
  const a: number[] = []
  const b: number[] = []
  const raquis: number[] = []
  for (let i = 0; i < n; i++) {
    const k = 0.08 + (0.9 * (i + 0.5)) / n
    const p0 = P(k - 0.022)
    const p1 = P(k + 0.022)
    const lf = folio * Math.pow(Math.sin(Math.PI * Math.min(0.97, k * 0.92 + 0.06)), 0.55) + 0.03
    for (const s of [-1, 1]) {
      const tip: V3 = [p0[0] + lf * 0.32, p0[1] - lf * colgar, s * lf * 0.9]
      ;((i + (s > 0 ? 1 : 0)) % 2 ? a : b).push(...p0, ...p1, ...tip)
    }
  }
  for (let i = 0; i < 10; i++) {
    const q0 = P(i / 10)
    const q1 = P((i + 1) / 10)
    const w = 0.03 * (1 - i / 10) + 0.006
    raquis.push(q0[0], q0[1], -w, q1[0], q1[1], -w, q0[0], q0[1] + 0.012, w, q1[0], q1[1], -w, q1[0], q1[1] + 0.012, w, q0[0], q0[1] + 0.012, w)
  }
  return [
    { g: malla(a), c: ca },
    { g: malla(b), c: cb },
    { g: malla(raquis), c: tono(ca, 0.75) },
  ]
}

/** Hoja alargada (plátano, ave del paraíso, helecho): cinta con nervio central sobre +x. */
function pala(L: number, W: number, alza: number, caida: number, c: string, punta = false, N = 10): Parte {
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const k = i / N
    const cx = L * k
    const cy = L * (alza * k - caida * k * k)
    const w = punta ? W * Math.pow(1 - k, 0.7) * Math.min(1, k * 5 + 0.15) : W * Math.max(0.04, Math.pow(Math.sin(Math.PI * Math.min(k, 0.999)), 0.5))
    pos.push(cx, cy - w * 0.18, -w / 2, cx, cy + 0.01, 0, cx, cy - w * 0.18, w / 2)
    if (i < N) {
      const o = i * 3
      idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5)
    }
  }
  return { g: malla(pos, idx), c }
}

/** Techo de cana: capas de hebras con el borde inferior deshilachado. Con cuadrado, la planta es un cuadrado. */
function paja(o: { rTop: number; rBot: number; yTop: number; yBot: number; n: number; colores: string[]; semilla: number; capas: number; cuadrado?: boolean }): Parte[] {
  const r = azar(o.semilla)
  const porColor: number[][] = o.colores.map(() => [])
  const f = (a: number) => (o.cuadrado ? 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) : 1)
  for (let c = 0; c < o.capas; c++) {
    const k0 = c / o.capas
    const k1 = Math.min(1.06, (c + 1.4) / o.capas)
    const rt = lerp(o.rTop, o.rBot, k0)
    const rb = lerp(o.rTop, o.rBot, k1)
    const yt = lerp(o.yTop, o.yBot, k0)
    const yb = lerp(o.yTop, o.yBot, k1)
    const giro = c * 0.07
    for (let i = 0; i < o.n; i++) {
      const a0 = (i / o.n) * Math.PI * 2 + giro
      const a1 = ((i + 1) / o.n) * Math.PI * 2 + giro
      const am = (a0 + a1) / 2
      const pt = (a: number, rr: number, y: number): V3 => [Math.cos(a) * rr * f(a), y, Math.sin(a) * rr * f(a)]
      const t0 = pt(a0, rt, yt)
      const t1 = pt(a1, rt, yt)
      const b0 = pt(a0, rb * (1 + (r() - 0.5) * 0.04), yb - r() * 0.06)
      const b1 = pt(a1, rb * (1 + (r() - 0.5) * 0.04), yb - r() * 0.06)
      const bm = pt(am, rb * 1.02, yb - 0.06 - r() * 0.1)
      const dest = porColor[Math.floor(r() * o.colores.length)]
      dest.push(...t0, ...t1, ...bm, ...t0, ...bm, ...b0, ...t1, ...b1, ...bm)
    }
  }
  return porColor.flatMap((pos, i) => (pos.length ? [{ g: malla(pos), c: o.colores[i] }] : []))
}

/* ---------- Palmas ---------- */

export function palmaCoco(t: Tema, alto: number, curva: number, semilla: number, hojas = 15): Parte[] {
  const r = azar(semilla)
  const p: Parte[] = []
  const C = (k: number): V3 => [Math.sin(k * 1.25) * curva, k * alto, 0]
  const nT = 14
  for (let i = 0; i < nT; i++) {
    p.push({ g: capsulaEntre(C(i / nT), C((i + 1) / nT), 0.16 - i * 0.0055, 7), c: i % 2 ? t.palma.tronco : tono(t.palma.tronco, 0.86) })
  }
  const top = C(1)
  p.push({ g: esfera(0.17, top, [1, 0.8, 1], 8), c: tono(t.palma.tronco, 0.7) })
  for (let h = 0; h < hojas; h++) {
    const capa = h % 3
    const L = 2.3 + r() * 0.8
    const alza = capa === 0 ? 0.8 : capa === 1 ? 0.38 : 0.06
    const vieja = capa === 2 ? mezcla(t.palma.hoja, "#b5a64a", 0.25) : t.palma.hoja
    const f = fronda(L, alza, capa === 0 ? 0.75 : 0.62, 0.62, 20, vieja, t.palma.hoja2, 0.55)
    mover(f, top, (h / hojas) * Math.PI * 2 + r() * 0.35)
    p.push(...f)
  }
  for (let i = 0; i < 5; i++) {
    p.push({ g: esfera(0.1, [top[0] + Math.cos(i * 1.3) * 0.16, top[1] - 0.2 - (i % 2) * 0.08, Math.sin(i * 1.3) * 0.16], [1, 1.1, 1], 8), c: i % 2 ? "#6b5a2c" : "#7d8a3a" })
  }
  return p
}

/* ---------- Macetas y plantas ---------- */

function maceta(estilo: EstiloFino, color: string): { p: Parte[]; alto: number } {
  const tierra = "#4a3626"
  if (estilo === "palapa") {
    return { alto: 0.5, p: [{ g: cil(0.3, 0.2, 0.46, [0, 0.23, 0], 16), c: color }, { g: cil(0.34, 0.33, 0.08, [0, 0.47, 0], 16), c: tono(color, 1.08) }, { g: cil(0.29, 0.29, 0.02, [0, 0.5, 0], 12), c: tierra }] }
  }
  if (estilo === "riviera") {
    return { alto: 0.55, p: [{ g: caja(0.6, 0.55, 0.6, [0, 0.275, 0]), c: color }, { g: caja(0.63, 0.05, 0.63, [0, 0.49, 0]), c: "#1d3557" }, { g: caja(0.52, 0.02, 0.52, [0, 0.55, 0]), c: tierra }] }
  }
  if (estilo === "bali") {
    return { alto: 0.34, p: [{ g: cil(0.44, 0.3, 0.34, [0, 0.17, 0], 14), c: color }, { g: cil(0.4, 0.4, 0.02, [0, 0.33, 0], 12), c: tierra }] }
  }
  if (estilo === "coral") {
    return { alto: 0.5, p: [{ g: esfera(0.33, [0, 0.26, 0], [1, 0.82, 1], 16), c: color }, { g: cil(0.24, 0.24, 0.04, [0, 0.5, 0], 14), c: tierra }] }
  }
  return { alto: 0.62, p: [{ g: cil(0.25, 0.21, 0.62, [0, 0.31, 0], 18), c: color }, { g: cil(0.23, 0.23, 0.02, [0, 0.62, 0], 12), c: tierra }] }
}

function planta(tipo: Planta, t: Tema, semilla: number): Parte[] {
  const r = azar(semilla)
  const p: Parte[] = []
  if (tipo === "palmita") {
    for (let i = 0; i < 8; i++) {
      const f = fronda(0.9 + r() * 0.35, 1.5, 1.0, 0.28, 14, t.palma.hoja, t.palma.hoja2, 0.35)
      p.push(...mover(f, [0, 0, 0], (i / 8) * Math.PI * 2 + r() * 0.3))
    }
  } else if (tipo === "monstera") {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + r() * 0.4
      const alto = 0.35 + r() * 0.45
      const sal = 0.25 + r() * 0.25
      const fin: V3 = [Math.cos(ang) * sal, alto, -Math.sin(ang) * sal]
      p.push({ g: capsulaEntre([0, 0, 0], fin, 0.012, 5), c: "#4a7a34" })
      const R = 0.3 + r() * 0.12
      const pos: number[] = []
      const n = 22
      const cen = R * 0.45
      for (let k = 0; k < n; k++) {
        const t0 = -2.7 + (5.4 * k) / n
        const t1 = -2.7 + (5.4 * (k + 1)) / n
        const corte = k % 3 === 1 && Math.abs(t0) > 0.5 ? 0.45 : 1
        const P = (tt: number, rr: number): V3 => {
          const x = cen + Math.cos(tt) * rr
          const z = Math.sin(tt) * rr
          return [x, x * 0.25 - (x * x + z * z) * 0.35, z]
        }
        const rr0 = R * (0.92 + 0.08 * Math.cos(t0))
        const rr1 = R * (0.92 + 0.08 * Math.cos(t1))
        pos.push(cen, cen * 0.25 - cen * cen * 0.35, 0, ...P(t0, rr0 * corte), ...P(t1, rr1 * corte))
      }
      const g = malla(pos)
      p.push(...mover([{ g, c: i % 2 ? "#2f6b35" : "#3d8040" }], fin, ang))
    }
  } else if (tipo === "platano") {
    p.push({ g: capsulaEntre([0, 0, 0], [0, 0.75, 0], 0.07, 8), c: "#7a8a4a" })
    for (let i = 0; i < 7; i++) {
      const hoja = pala(1.2 + r() * 0.4, 0.36, 1.1, 1.05, i % 2 ? "#5fa548" : "#7dbb5a", false, 12)
      p.push(...mover([hoja], [0, 0.72, 0], (i / 7) * Math.PI * 2 + r() * 0.4))
    }
  } else if (tipo === "ave") {
    for (let i = 0; i < 9; i++) {
      const hoja = pala(0.7 + r() * 0.25, 0.17, 2.2, 1.7, i % 2 ? "#3f7d5a" : "#4f8d62", false, 8)
      p.push(...mover([hoja], [0, 0, 0], (i / 9) * Math.PI * 2 + r() * 0.5))
    }
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4
      const base: V3 = [Math.cos(a) * 0.12, 0.85 + i * 0.07, -Math.sin(a) * 0.12]
      const flor: Parte[] = [
        { g: capsulaEntre([0, 0, 0], [0.22, 0.02, 0], 0.025, 5), c: "#4f7d4a" },
        { g: malla([0.04, 0.02, 0, 0.16, 0.03, 0.03, 0.08, 0.2, 0, 0.08, 0.03, 0, 0.2, 0.03, -0.03, 0.14, 0.17, -0.02, 0.12, 0.03, 0, 0.22, 0.03, 0.01, 0.2, 0.13, 0.02]), c: "#f28a2e" },
        { g: malla([0.1, 0.03, 0, 0.18, 0.03, 0, 0.16, 0.1, 0.03]), c: "#3a5bd0" },
      ]
      p.push(...mover(flor, base, a))
    }
  } else if (tipo === "buganvilla") {
    p.push(...nube([0, 0.45, 0], [0.38, 0.4, 0.38], 260, VERDES, semilla, 0.07))
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2
      p.push(...nube([Math.cos(a) * 0.3, 0.45 + r() * 0.45, Math.sin(a) * 0.3], [0.24, 0.18, 0.24], 120, FUCSIAS, semilla + i * 7, 0.055))
    }
  } else if (tipo === "frangipani") {
    p.push({ g: capsulaEntre([0, 0, 0], [0, 0.7, 0], 0.06, 7), c: "#8a8478" })
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + r()
      const fin: V3 = [Math.cos(a) * 0.45, 1.25 + r() * 0.2, Math.sin(a) * 0.45]
      p.push({ g: capsulaEntre([0, 0.68, 0], fin, 0.04, 6), c: "#8a8478" })
      for (let j = 0; j < 6; j++) p.push(...mover([pala(0.38, 0.12, 0.5, 0.9, j % 2 ? "#3f7a3a" : "#4f8a44", true, 6)], fin, (j / 6) * Math.PI * 2))
      for (let j = 0; j < 5; j++) {
        const fp: V3 = [fin[0] + (r() - 0.5) * 0.18, fin[1] + 0.06 + r() * 0.05, fin[2] + (r() - 0.5) * 0.18]
        p.push({ g: esfera(0.045, fp, [1, 0.35, 1], 8), c: "#fff8e8" }, { g: esfera(0.016, [fp[0], fp[1] + 0.012, fp[2]], [1, 0.6, 1], 6), c: "#f2c14e" })
      }
    }
  } else if (tipo === "agave") {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + (i % 2) * 0.17
      const interior = i % 2 === 0
      const L = interior ? 0.55 : 0.7
      const sube = interior ? 0.62 : 0.38
      const tip: V3 = [Math.cos(a) * L * (1 - sube * 0.5), L * sube + 0.05, Math.sin(a) * L * (1 - sube * 0.5)]
      const lx = -Math.sin(a) * 0.05
      const lz = Math.cos(a) * 0.05
      p.push({ g: malla([lx, 0.05, lz, ...tip, -lx, 0.05, -lz, 0, 0.09, 0, ...tip, lx, 0.05, lz]), c: interior ? "#86a894" : "#6f9a86" })
    }
  } else {
    for (let i = 0; i < 14; i++) p.push(...mover([pala(0.7 + r() * 0.2, 0.1, 1.3, 1.7, i % 2 ? "#4f9a3e" : "#69ad4c", true, 8)], [0, 0, 0], (i / 14) * Math.PI * 2 + r() * 0.3))
  }
  return p
}

function plantaEnMaceta(estilo: EstiloFino, tipo: Planta, semilla: number): Parte[] {
  const t = TEMAS[estilo]
  const m = maceta(estilo, t.deco!.maceta)
  return [...m.p, ...mover(planta(tipo, t, semilla), [0, m.alto, 0], 0, tipo === "buganvilla" ? 1.15 : 1)]
}

/* ---------- Sombrillas, tumbonas y faroles ---------- */

function sombrilla(s: Deco["sombrilla"], semilla: number): Parte[] {
  const p: Parte[] = [
    { g: cil(0.022, 0.028, 2.6, [0, 1.3, 0], 8), c: s.asta },
    { g: cil(0.2, 0.24, 0.06, [0, 0.03, 0], 14), c: s.asta },
  ]
  if (s.tipo === "paja") {
    p.push(...paja({ rTop: 0.05, rBot: 1.4, yTop: 2.95, yBot: 2.15, n: 44, colores: [s.tela, s.franja, tono(s.tela, 1.12), tono(s.franja, 0.9)], semilla, capas: 3 }))
    return p
  }
  const n = s.tipo === "rayas" ? 16 : 10
  const R = s.tipo === "flecos" ? 1.2 : 1.3
  const yA = 2.66
  const yR = 2.2
  const telas: number[][] = [[], []]
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    const pt = (a: number, k: number): V3 => [Math.cos(a) * R * k, lerp(yA, yR, k) + Math.sin(Math.PI * k) * 0.06, Math.sin(a) * R * k]
    const dest = telas[s.tipo === "rayas" && i % 2 ? 1 : 0]
    dest.push(0, yA, 0, ...pt(a0, 0.55), ...pt(a1, 0.55), ...pt(a0, 0.55), ...pt(a0, 1), ...pt(a1, 1), ...pt(a0, 0.55), ...pt(a1, 1), ...pt(a1, 0.55))
    const fald = s.tipo === "lona" ? 0 : s.tipo === "rayas" ? i % 2 : 1
    const b0 = pt(a0, 1)
    const b1 = pt(a1, 1)
    const caida = s.tipo === "lona" ? 0.13 : 0.18
    const bm: V3 = [(b0[0] + b1[0]) / 2, b0[1] - caida - (s.tipo === "lona" ? 0 : 0.06), (b0[2] + b1[2]) / 2]
    const fal = s.tipo === "lona" ? telas[1] : telas[fald]
    if (s.tipo === "lona") fal.push(...b0, ...b1, b1[0], b1[1] - caida, b1[2], ...b0, b1[0], b1[1] - caida, b1[2], b0[0], b0[1] - caida, b0[2])
    else fal.push(...b0, ...b1, ...bm, ...b0, ...bm, b0[0], b0[1] - caida, b0[2], ...b1, b1[0], b1[1] - caida, b1[2], ...bm)
    if (s.tipo === "flecos") p.push({ g: cil(0.012, 0.004, 0.14, [bm[0], bm[1] - 0.07, bm[2]], 4), c: s.franja })
  }
  p.push({ g: malla(telas[0]), c: s.tela }, { g: malla(telas[1]), c: s.franja })
  p.push({ g: esfera(0.05, [0, yA + 0.04, 0], [1, 1.3, 1], 8), c: s.asta })
  return p
}

function tumbona(d: Deco, toalla: string): Parte[] {
  const { marco, cojin } = d.tumbona
  const p: Parte[] = [{ g: caja(0.68, 0.06, 1.4, [0, 0.28, 0.25]), c: marco }]
  for (const [x, z] of [[-0.3, 0.88], [0.3, 0.88], [-0.3, -0.4], [0.3, -0.4]]) p.push({ g: caja(0.05, 0.27, 0.05, [x, 0.135, z]), c: marco })
  p.push({ g: caja(0.62, 0.08, 1.32, [0, 0.35, 0.27]), c: cojin })
  p.push({ g: caja(0.68, 0.06, 0.7, [0, 0.44, -0.66], [0.62, 0, 0]), c: marco })
  p.push({ g: caja(0.62, 0.08, 0.66, [0, 0.5, -0.62], [0.62, 0, 0]), c: cojin })
  p.push({ g: caja(0.5, 0.025, 0.36, [0, 0.4, 0.62]), c: toalla })
  return p
}

type Farol = { p: Parte[]; luz: Parte[]; brillos: Brillo[] }

function farol(tipo: Deco["luces"]["farol"], indice: number): Farol {
  const vacio: Farol = { p: [], luz: [], brillos: [] }
  if (tipo === "linterna") {
    const madera = "#b88d5f"
    vacio.p.push({ g: caja(0.3, 0.04, 0.3, [0, 0.02, 0]), c: madera }, { g: cil(0.02, 0.17, 0.1, [0, 0.5, 0], 4, [0, Math.PI / 4, 0]), c: madera }, { g: caja(0.3, 0.03, 0.3, [0, 0.44, 0]), c: madera })
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) vacio.p.push({ g: caja(0.025, 0.42, 0.025, [x * 0.135, 0.23, z * 0.135]), c: madera })
    vacio.luz.push({ g: cil(0.08, 0.08, 0.3, [0, 0.21, 0], 12), c: "#f6efe2" })
    vacio.brillos.push({ p: [0, 0.25, 0], s: 0.9 })
  } else if (tipo === "piedra") {
    const piedra = "#8a857a"
    vacio.p.push(
      { g: cil(0.22, 0.27, 0.12, [0, 0.06, 0], 8), c: tono(piedra, 0.9) },
      { g: cil(0.09, 0.11, 0.42, [0, 0.33, 0], 8), c: piedra },
      { g: caja(0.34, 0.06, 0.34, [0, 0.57, 0]), c: piedra },
      { g: caja(0.3, 0.24, 0.3, [0, 0.72, 0]), c: piedra },
      { g: cil(0.03, 0.34, 0.18, [0, 0.93, 0], 4, [0, Math.PI / 4, 0]), c: tono(piedra, 0.85) },
      { g: esfera(0.05, [0, 1.04, 0], [1, 1, 1], 8), c: piedra },
    )
    vacio.luz.push({ g: caja(0.18, 0.14, 0.31, [0, 0.72, 0]), c: "#f2dfb8" }, { g: caja(0.31, 0.14, 0.18, [0, 0.72, 0]), c: "#f2dfb8" })
    vacio.brillos.push({ p: [0, 0.74, 0], s: 1.2 })
  } else if (tipo === "laton") {
    const laton = "#c9a35c"
    vacio.p.push({ g: cil(0.11, 0.14, 0.1, [0, 0.05, 0], 12), c: "#1d3557" }, { g: cil(0.03, 0.04, 1.85, [0, 0.98, 0], 10), c: "#1d3557" }, { g: cil(0.11, 0.07, 0.05, [0, 1.92, 0], 6), c: laton }, { g: cil(0.02, 0.14, 0.12, [0, 2.24, 0], 6), c: laton }, { g: esfera(0.03, [0, 2.32, 0]), c: laton })
    vacio.luz.push({ g: cil(0.09, 0.08, 0.24, [0, 2.06, 0], 6), c: "#f6efe2" })
    vacio.brillos.push({ p: [0, 2.06, 0], s: 1.3 })
  } else if (tipo === "mimbre") {
    vacio.p.push({ g: cil(0.12, 0.14, 0.05, [0, 0.025, 0], 12), c: "#7a5a3c" })
    vacio.luz.push({ g: esfera(0.15, [0, 0.36, 0], [1, 1.7, 1], 14), c: "#efd9b4" })
    for (const y of [0.24, 0.36, 0.48]) vacio.p.push({ g: cil(0.152 * Math.sqrt(1 - ((y - 0.36) / 0.255) ** 2) + 0.004, 0.152 * Math.sqrt(1 - ((y - 0.36) / 0.255) ** 2) + 0.004, 0.018, [0, y, 0], 14), c: "#8a6440" })
    vacio.p.push({ g: cil(0.015, 0.015, 0.12, [0, 0.8, 0], 6), c: "#7a5a3c" })
    vacio.brillos.push({ p: [0, 0.45, 0], s: 1.3 })
  } else {
    if (indice % 2 === 0) {
      for (const [x, z, rr] of [[0, 0, 0.3], [0.42, 0.18, 0.19], [0.12, 0.45, 0.13]] as const) {
        vacio.luz.push({ g: esfera(rr, [x, rr, z], [1, 1, 1], 16), c: "#eccfb2" })
        vacio.brillos.push({ p: [x, rr, z], s: rr * 3.2 })
      }
    } else {
      const arco = new THREE.TorusGeometry(0.55, 0.018, 6, 24, Math.PI * 0.75)
      vacio.p.push({ g: cil(0.16, 0.18, 0.04, [0, 0.02, 0], 16), c: "#f08f74" }, { g: cil(0.015, 0.015, 1.5, [0, 0.75, 0], 6), c: "#f2e6da" }, { g: colocar(arco, [0.55, 1.5, 0], [0, 0, 0]), c: "#f2e6da" })
      vacio.luz.push({ g: esfera(0.16, [1.02, 1.62, 0], [1, 1, 1], 14), c: "#eccfb2" })
      vacio.brillos.push({ p: [1.02, 1.6, 0], s: 1.2 })
    }
  }
  return vacio
}

function antorcha(): { p: Parte[]; llama: V3 } {
  const bambu = "#b8945a"
  const p: Parte[] = [{ g: cil(0.03, 0.036, 1.75, [0, 0.875, 0], 7), c: bambu }]
  for (const y of [0.45, 0.95, 1.4]) p.push({ g: cil(0.04, 0.04, 0.03, [0, y, 0], 7), c: tono(bambu, 0.75) })
  p.push({ g: cil(0.075, 0.045, 0.16, [0, 1.8, 0], 8), c: "#3a2a1a" })
  return { p, llama: [0, 1.95, 0] }
}

function salvavidas(): Parte[] {
  const a = new THREE.TorusGeometry(0.22, 0.055, 8, 12, Math.PI / 2)
  const p: Parte[] = []
  for (let i = 0; i < 4; i++) {
    const g = a.clone()
    g.rotateZ((i * Math.PI) / 2)
    p.push({ g, c: i % 2 ? "#ffffff" : "#c8423a" })
  }
  return p
}

/* ---------- Barcos amarrados ---------- */

function casco(largo: number, manga: number, alto: number) {
  const s = new THREE.Shape()
  s.moveTo(-largo / 2, -manga / 2)
  s.lineTo(largo * 0.15, -manga / 2)
  s.quadraticCurveTo(largo * 0.42, -manga * 0.38, largo / 2, 0)
  s.quadraticCurveTo(largo * 0.42, manga * 0.38, largo * 0.15, manga / 2)
  s.lineTo(-largo / 2, manga / 2)
  s.lineTo(-largo / 2, -manga / 2)
  const g = new THREE.ExtrudeGeometry(s, { depth: alto, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 10 })
  g.rotateX(-Math.PI / 2)
  g.deleteAttribute("uv")
  return g
}

function velero(arriba: boolean, franja: string): Parte[] {
  const L = 7
  const W = 2.2
  const p: Parte[] = [{ g: casco(L, W, 0.75), c: "#ffffff" }]
  const f = casco(L * 1.01, W * 1.01, 0.08)
  f.translate(0, 0.5, 0)
  p.push({ g: f, c: franja })
  const cub = casco(L * 0.94, W * 0.9, 0.02)
  cub.translate(0, 0.8, 0)
  p.push({ g: cub, c: "#b08452" })
  p.push({ g: caja(L * 0.3, 0.32, W * 0.55, [-L * 0.05, 0.98, 0]), c: "#ffffff" }, { g: caja(L * 0.31, 0.07, W * 0.56, [-L * 0.05, 1.0, 0]), c: "#1d2a3a" })
  const mx = L * 0.08
  const H = 8.5
  p.push({ g: cil(0.04, 0.05, H, [mx, 0.8 + H / 2, 0], 8), c: "#dcdcdc" })
  p.push({ g: capsulaEntre([mx, 1.9, 0], [mx - L * 0.42, 1.95, 0], 0.035, 6), c: "#dcdcdc" })
  if (arriba) {
    p.push({ g: malla([mx, 2.0, 0, mx, 0.8 + H - 0.2, 0, mx - L * 0.4, 2.0, 0]), c: "#fbfaf6" })
    p.push({ g: malla([mx + 0.05, 0.8 + H * 0.82, 0, L / 2 - 0.15, 1.0, 0, mx + 0.1, 1.2, 0]), c: "#f3f1ea" })
  } else {
    p.push({ g: capsulaEntre([mx - 0.1, 2.02, 0], [mx - L * 0.38, 2.04, 0], 0.11, 8), c: franja })
  }
  return p
}

function yate(): Parte[] {
  const L = 10
  const W = 2.8
  const p: Parte[] = [{ g: casco(L, W, 0.95), c: "#ffffff" }]
  const f = casco(L * 1.01, W * 1.01, 0.06)
  f.translate(0, 0.62, 0)
  p.push({ g: f, c: "#1d3557" })
  const cub = casco(L * 0.95, W * 0.9, 0.02)
  cub.translate(0, 1.0, 0)
  p.push({ g: cub, c: "#b08452" })
  p.push(
    { g: caja(L * 0.48, 0.7, W * 0.8, [-L * 0.05, 1.38, 0]), c: "#ffffff" },
    { g: caja(L * 0.49, 0.22, W * 0.81, [-L * 0.05, 1.45, 0]), c: "#1d2a3a" },
    { g: caja(L * 0.3, 0.5, W * 0.7, [-L * 0.1, 1.98, 0]), c: "#ffffff" },
    { g: caja(L * 0.31, 0.16, W * 0.71, [-L * 0.1, 2.02, 0]), c: "#1d2a3a" },
    { g: caja(L * 0.32, 0.04, W * 0.78, [-L * 0.14, 2.6, 0]), c: "#f2f2f0" },
    { g: cil(0.03, 0.03, 1.0, [-L * 0.08, 2.9, 0], 6), c: "#dcdcdc" },
  )
  return p
}

/* ---------- Lugares ---------- */

export const yPlaya = (z: number) => (z <= -3.6 ? PISO_TIERRA - 0.01 : PISO_TIERRA - 0.01 - (z + 3.6) * 0.154)
export const ORILLA_PLAYA = -0.78

const MACETAS: [number, number][] = [
  [-8.55, -4.35], [8.55, -4.35], [-8.55, -0.55], [8.55, -0.55], [7.75, -2.5],
  [-8.95, 0.75], [8.95, 0.75], [-8.95, 5.25], [8.95, 5.25], [-3.3, 2.6],
  [-5.25, 9.95], [8.85, 10.0], [-8.85, 10.0], [6.3, 6.7], [8.85, 6.7],
]
const MACETAS_EXTRA: [number, number][] = [
  [-8.95, 2.1], [-8.95, 3.7], [8.95, 2.1], [-8.95, 6.9], [-1.95, 10.0], [1.95, 10.0], [6.1, 10.05], [-8.55, -2.5], [8.95, 8.4], [-8.95, 8.4],
]
const FAROLES: [number, number][] = [
  [-8.95, 1.55], [8.95, 1.55], [-8.95, 4.45], [8.95, 4.45], [-8.95, 7.6], [8.95, 7.6], [-3.6, 10.05], [3.6, 10.05], [-8.45, -1.55], [8.45, -1.55],
]
const ANTORCHAS: [number, number][] = [
  [-9.08, 0.2], [9.08, 0.2], [-9.08, 3.0], [9.08, 3.0], [-9.08, 6.1], [9.08, 6.1], [-9.08, 9.4], [9.08, 9.4], [-5.9, 10.12], [5.9, 10.12], [-1.2, 10.12], [1.2, 10.12],
]
const PALMAS_PLAYA: [number, number, number, number][] = [
  [-10.7, -3.3, 1.0, 0.0], [-13.4, -4.6, 1.12, 0.5], [-15.9, -3.1, 0.95, -0.3], [-18.4, -4.3, 1.08, 0.2], [-12.2, -6.3, 0.9, 0.7],
  [10.9, -3.5, 1.05, 0.2], [13.6, -4.4, 0.92, -0.4], [16.2, -3.0, 1.12, 0.1], [18.7, -4.6, 0.98, -0.2], [12.4, -6.4, 0.9, -0.6],
]
const PALMAS_TIERRA: [number, number, number, number][] = [
  [-11, -4.6, 1.0, 0.2], [-13.5, -5.2, 1.1, -0.3], [11, -4.7, 1.0, 0.4], [13.5, -5.1, 0.95, -0.2], [-15.8, -6.2, 1.05, 0.1], [15.8, -6.0, 1.05, -0.5], [-17.8, -4.5, 0.9, 0.3], [17.8, -4.8, 0.95, 0],
]

/** Todo lo fijo de un estilo tropical en dos geometrías: lo sólido y lo que se enciende de noche. */
function geoDecor(estilo: EstiloFino) {
  const ya = DECOR_INFO.get(estilo)
  if (ya) return ya
  const t = TEMAS[estilo]
  const d = t.deco!
  const r = azar(41)
  const p: Parte[] = []
  const luz: Parte[] = []
  const brillos: Brillo[] = []
  const llamas: V3[] = []
  const reflejos: THREE.Vector3[] = []

  const palmas = d.playa ? PALMAS_PLAYA : PALMAS_TIERRA
  palmas.forEach(([x, z, s, giro], i) => {
    const y = d.playa ? yPlaya(z) : PISO_TIERRA
    p.push(...mover(palmaCoco(t, 6.2 + (i % 3) * 0.5, 1.1 + (i % 2) * 0.5, 100 + i), [x, y, z], -Math.PI / 2 + giro + (x < 0 ? 0.35 : -0.35), s))
  })
  p.push(...mover(palmaCoco(t, 4.6, 0.6, 77, 13), [-6, PISO_MUELLE + 0.1, 2.5], -Math.PI / 2 - 0.6, 0.82))
  if (estilo === "bali") {
    p.push(...mover(planta("platano", t, 3), [-7.4, PISO_MUELLE + 0.1, 3.5], 0, 1.1))
    p.push(...mover(planta("monstera", t, 5), [-4.6, PISO_MUELLE + 0.1, 1.5], 0, 1.3))
    p.push(...mover(planta("ave", t, 7), [-4.6, PISO_MUELLE + 0.1, 3.6], 0, 1.2))
    p.push(...mover(planta("frangipani", t, 9), [-7.4, PISO_MUELLE + 0.1, 1.4], 0, 1.4))
  } else if (estilo === "coral") {
    p.push(...mover(planta("buganvilla", t, 3), [-7.5, PISO_MUELLE + 0.1, 1.5], 0, 1.3))
    p.push(...mover(planta("buganvilla", t, 4), [-4.5, PISO_MUELLE + 0.1, 3.5], 0, 1.1))
    p.push(...mover(planta("agave", t, 5), [-4.6, PISO_MUELLE + 0.1, 1.5], 0, 1.2))
  } else if (estilo === "palapa") {
    p.push(...mover(planta("agave", t, 3), [-7.4, PISO_MUELLE + 0.1, 1.5], 0, 1.3))
    p.push(...mover(planta("ave", t, 4), [-4.6, PISO_MUELLE + 0.1, 3.5], 0, 1.1))
  } else {
    p.push(...mover(planta("helecho", t, 3), [-7.4, PISO_MUELLE + 0.1, 1.5], 0, 1.4))
    p.push(...mover(planta("helecho", t, 4), [-4.6, PISO_MUELLE + 0.1, 3.5], 0, 1.3))
  }

  const lugares = d.densidad > 1 ? [...MACETAS, ...MACETAS_EXTRA] : MACETAS.filter((_, i) => i < Math.round(MACETAS.length * Math.min(1, d.densidad + 0.3)))
  lugares.forEach(([x, z], i) => {
    const tipo = d.plantas[i % d.plantas.length]
    p.push(...mover(plantaEnMaceta(estilo, tipo, 300 + i), [x, PISO_MUELLE, z], r() * 6))
  })

  FAROLES.forEach(([x, z], i) => {
    const f = farol(d.luces.farol, i)
    const giro = d.luces.farol === "esfera" ? (x < 0 ? 0 : Math.PI) + (z > 9.9 ? -Math.PI / 2 * Math.sign(x) : 0) : 0
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, PISO_MUELLE, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, giro, 0)), new THREE.Vector3(1, 1, 1))
    f.p.forEach((q) => q.g.applyMatrix4(m))
    f.luz.forEach((q) => q.g.applyMatrix4(m))
    p.push(...f.p)
    luz.push(...f.luz)
    for (const b of f.brillos) {
      const v = new THREE.Vector3(...b.p).applyMatrix4(m)
      brillos.push({ p: v.toArray() as V3, s: b.s })
      if (Math.abs(x) > 8.5 || z > 9.9) reflejos.push(new THREE.Vector3(v.x + Math.sign(x) * (Math.abs(x) > 8.5 ? 0.6 : 0), 0.7, z > 9.9 ? z + 0.6 : z))
    }
  })

  if (d.luces.antorchas) {
    const lista: [number, number, number][] = ANTORCHAS.map(([x, z]) => [x, PISO_MUELLE, z])
    if (d.playa) for (const s of [-1, 1]) for (const x of [10.4, 15.0, 19.4]) lista.push([s * x, yPlaya(-1.6), -1.6])
    lista.forEach(([x, y, z]) => {
      const a = antorcha()
      p.push(...mover(a.p, [x, y, z]))
      const l: V3 = [x, y + a.llama[1], z]
      llamas.push(l)
      brillos.push({ p: l, s: 1.5 })
      if (y === PISO_MUELLE) reflejos.push(new THREE.Vector3(x + Math.sign(x) * (Math.abs(x) > 8.5 ? 0.7 : 0), 1.3, z > 9.9 ? z + 0.7 : z))
    })
  }

  const somb = d.sombrilla
  if (d.playa) {
    const toallas = [d.sombrilla.franja === "#ffffff" ? "#a8e0cf" : "#7fcfcb", "#f4ecdf", t.cama.acento]
    for (const s of [-1, 1]) {
      for (let g = 0; g < 3; g++) {
        const xg = s * (12.1 + g * 3.2)
        const z = -2.25
        for (const k of [-1, 1]) p.push(...mover(tumbona(d, toallas[(g + (k > 0 ? 1 : 0)) % toallas.length]), [xg + k * 0.48, yPlaya(z) + 0.01, z], 0, 1, 0.153))
        p.push(...mover(sombrilla(somb, 500 + g), [xg, yPlaya(-2.95), -2.95]))
        p.push({ g: cil(0.2, 0.2, 0.42, [xg + s * 1.15, yPlaya(-2.3) + 0.21, -2.3], 12), c: d.tumbona.marco })
      }
    }
  } else {
    for (const s of [-1, 1]) {
      for (let g = 0; g < 2; g++) {
        const xg = s * (11.5 + g * 3.4)
        p.push(...mover(sombrilla(somb, 520 + g), [xg, PISO_TIERRA, -4.2]))
        for (const k of [-1, 1]) p.push(...mover(tumbona(d, t.cama.acento), [xg + k * 0.48, PISO_TIERRA, -3.85], Math.PI))
      }
    }
  }
  for (const [x, z] of [[7.6, 8.7], [-7.9, 5.6]] as [number, number][]) p.push(...mover(sombrilla(somb, 600), [x, PISO_MUELLE, z], 0, 0.78))

  if (estilo === "riviera") {
    for (const [x, z] of [[-9.47, 2.2], [9.47, 2.2], [-9.47, 7.8], [9.47, 7.8]] as [number, number][]) p.push(...mover(salvavidas(), [x, PISO_MUELLE + 0.72, z], Math.PI / 2))
    for (const [x, z] of [[-9.2, 10.2], [9.2, 10.2], [-9.2, -0.2], [9.2, -0.2]] as [number, number][]) {
      p.push({ g: cil(0.09, 0.11, 0.32, [x, PISO_MUELLE + 0.16, z], 12), c: "#1d2a3a" }, { g: cil(0.13, 0.13, 0.05, [x, PISO_MUELLE + 0.34, z], 12), c: "#1d2a3a" })
    }
    const z0 = TE.z + TE.d / 2
    const z1 = MU.z + MU.d / 2 - 0.08
    const n = Math.round((z1 - z0) / 1.2)
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) p.push({ g: esfera(0.045, [s * (MU.w / 2 - 0.08), PISO_MUELLE + 1.04, z0 + ((z1 - z0) * i) / n], [1, 0.7, 1], 8), c: "#c9a35c" })
  }

  const info = { solida: unir(p), luz: luz.length ? unir(luz) : null, brillos, llamas, reflejos }
  DECOR_INFO.set(estilo, info)
  return info
}
const DECOR_INFO = new Map<EstiloFino, { solida: THREE.BufferGeometry; luz: THREE.BufferGeometry | null; brillos: Brillo[]; llamas: V3[]; reflejos: THREE.Vector3[] }>()

export function reflejosDecor(estilo: EstiloFino) {
  return geoDecor(estilo).reflejos
}

/* ---------- Componentes ---------- */

const geoLlamaT = new THREE.ConeGeometry(0.06, 0.24, 8).translate(0, 0.1, 0)
const matLlamaT = new THREE.MeshBasicMaterial({ color: "#ffc46b", toneMapped: false })

function Brillos({ lista, calidas, color = "#ffb35c" }: { lista: Brillo[]; calidas: number; color?: string }) {
  const grupos = useMemo(() => {
    const porTam = new Map<number, number[]>()
    for (const b of lista) {
      const k = Math.round(b.s * 4) / 4
      porTam.set(k, [...(porTam.get(k) ?? []), ...b.p])
    }
    return [...porTam.entries()].map(([s, pos]) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      return { s, g }
    })
  }, [lista])
  const mats = useRef<(THREE.PointsMaterial | null)[]>([])
  useFrame(({ clock }) => {
    const v = 0.93 + Math.sin(clock.getElapsedTime() * 7.3) * 0.04 + Math.sin(clock.getElapsedTime() * 13.1) * 0.03
    mats.current.forEach((m) => m && (m.opacity = Math.min(1, 0.75 * calidas) * v))
  })
  return (
    <>
      {grupos.map(({ s, g }, i) => (
        <points key={s} geometry={g}>
          <pointsMaterial ref={(m) => void (mats.current[i] = m)} map={texturaBrillo()} color={color} size={s} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
      ))}
    </>
  )
}

function Llamas({ lista }: { lista: V3[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Vector3(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const tt = clock.getElapsedTime()
    lista.forEach((p, i) => {
      const k = 1 + Math.sin(tt * 11 + i * 1.7) * 0.12 + Math.sin(tt * 23 + i) * 0.08
      ref.current!.setMatrixAt(i, m.compose(v.set(...p), q, e.set(1, k, 1)))
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geoLlamaT, matLlamaT, lista.length]} frustumCulled={false} />
}

export function DecorTropical({ estilo, calidas, sombras }: { estilo: EstiloFino; calidas: number; sombras: boolean }) {
  const info = useMemo(() => geoDecor(estilo), [estilo])
  const encendido = calidas > 0
  return (
    <group>
      <mesh geometry={info.solida} material={matDoble} castShadow={sombras} receiveShadow />
      {info.luz && <mesh geometry={info.luz} material={encendido ? matLuzEncendida : matLuzApagada} />}
      {encendido && <Brillos lista={info.brillos} calidas={calidas} />}
      {encendido && info.llamas.length > 0 && <Llamas lista={info.llamas} />}
    </group>
  )
}

/* ---------- Playa ---------- */

export function Playa({ t }: { t: Tema }) {
  const tex = useMemo(() => {
    const x = texturaArena(t.arena, mezcla(t.arena, "#a89070", 0.45)).clone()
    x.repeat.set(6, 1)
    x.needsUpdate = true
    return x
  }, [t])
  const largo = Math.hypot(4.8, 0.74)
  return (
    <mesh position={[0, (yPlaya(-3.6) + yPlaya(1.2)) / 2, -1.2]} rotation-x={-Math.PI / 2 + Math.atan2(0.74, 4.8)} receiveShadow>
      <planeGeometry args={[39, largo]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  )
}

/* ---------- Barcos ---------- */

export function Veleros({ sombras }: { sombras: boolean }) {
  const barcos = useMemo(
    () => [
      { g: unir(yate()), pos: [15.4, 0, 0.4] as V3, rot: Math.PI + 0.04 },
      { g: unir(velero(true, "#1d3557")), pos: [-14.8, 0, 0.8] as V3, rot: 0.06 },
      { g: unir(velero(false, "#1d3557")), pos: [-13.4, 0, 6.6] as V3, rot: -Math.PI / 2 - 0.1 },
    ],
    [],
  )
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const tt = clock.getElapsedTime()
    refs.current.forEach((g, i) => {
      if (!g) return
      g.position.y = -0.32 + Math.sin(tt * 0.9 + i * 2) * 0.04
      g.rotation.z = Math.sin(tt * 0.7 + i) * 0.015
      g.rotation.x = Math.sin(tt * 0.6 + i * 1.3) * 0.01
    })
  })
  return (
    <>
      {barcos.map((b, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={b.pos} rotation-y={b.rot}>
          <mesh geometry={b.g} material={matDoble} castShadow={sombras} scale={0.82} />
        </group>
      ))}
    </>
  )
}

/* ---------- Techo de la terraza ---------- */

export const POSTES_TERRAZA_T: [number, number][] = (() => {
  const p: [number, number][] = []
  for (let i = 0; i <= 6; i++) {
    const x = TE.x - TE.w / 2 + 0.2 + (i * (TE.w - 0.4)) / 6
    p.push([x, TE.z - TE.d / 2 + 0.2], [x, TE.z + TE.d / 2 - 0.2])
  }
  return p
})()

const HUECOS = [-8.05, -5, -2, 1, 4, 7.05]

function geoTecho(estilo: EstiloFino) {
  const t = TEMAS[estilo]
  const d = t.deco!
  const clave = `techo-${estilo}`
  const ya = TECHOS.get(clave)
  if (ya) return ya
  const r = azar(9)
  const alto = 3
  const y = PISO_MUELLE
  const zA = TE.z - TE.d / 2 + 0.2
  const zB = TE.z + TE.d / 2 - 0.2
  const postes: Parte[] = []
  const cubierta: Parte[] = []
  const tela: Parte[] = []
  const luz: Parte[] = []
  const brillos: Brillo[] = []
  const madera = t.pergola
  for (const [x, z] of POSTES_TERRAZA_T) {
    if (d.techo === "enramada") postes.push({ g: cil(0.085, 0.1, alto, [x, y + alto / 2, z], 8), c: madera })
    else postes.push({ g: caja(estilo === "bali" ? 0.17 : 0.14, alto, estilo === "bali" ? 0.17 : 0.14, [x, y + alto / 2, z]), c: madera })
  }
  for (const z of [zA, zB]) cubierta.push(d.techo === "enramada" ? { g: capsulaEntre([TE.x - TE.w / 2, y + alto + 0.05, z], [TE.x + TE.w / 2, y + alto + 0.05, z], 0.08, 7), c: madera } : { g: caja(TE.w, 0.16, 0.12, [TE.x, y + alto + 0.05, z]), c: madera })
  for (const [x] of POSTES_TERRAZA_T.filter((_, i) => i % 2 === 0)) cubierta.push({ g: caja(0.1, 0.12, TE.d - 0.1, [x, y + alto + 0.16, TE.z]), c: madera })

  if (d.techo === "pergola" || d.techo === "buganvilla" || d.techo === "enredadera" || d.techo === "lienzos") {
    const n = d.techo === "lienzos" ? 18 : 34
    for (let i = 0; i < n; i++) cubierta.push({ g: caja(0.05, 0.11, TE.d, [TE.x - TE.w / 2 + 0.3 + (i * (TE.w - 0.6)) / (n - 1), y + alto + 0.27, TE.z]), c: madera })
  }
  if (d.techo === "lienzos") {
    for (const [x, z] of POSTES_TERRAZA_T) {
      const pos: number[] = []
      const N = 10
      const s = z > TE.z ? 1 : -1
      for (const lado of [-1, 1]) {
        for (let i = 0; i < N; i++) {
          const k0 = i / N
          const k1 = (i + 1) / N
          const ancho = (k: number) => 0.34 * (1 - 0.65 * Math.sin(Math.PI * Math.min(1, k * 1.35)) ** 2)
          const P = (k: number, u: number): V3 => [x + lado * (0.09 + u * ancho(k)), y + alto + 0.05 - k * (alto - 0.1), z + s * (0.03 + Math.sin(u * 9 + k * 3) * 0.035)]
          for (let j = 0; j < 4; j++) {
            const u0 = j / 4
            const u1 = (j + 1) / 4
            pos.push(...P(k0, u0), ...P(k0, u1), ...P(k1, u1), ...P(k0, u0), ...P(k1, u1), ...P(k1, u0))
          }
        }
      }
      tela.push({ g: malla(pos), c: "#ffffff" })
    }
  }
  if (d.techo === "pergola" && d.toldos) {
    for (const z of [zA - 0.07, zB + 0.07]) {
      const n = 36
      for (let i = 0; i < n; i++) {
        const x0 = TE.x - TE.w / 2 + (i * TE.w) / n
        const x1 = x0 + TE.w / n
        const yt = y + alto + 0.12
        const yb = yt - 0.32
        tela.push({ g: malla([x0, yt, z, x1, yt, z, (x0 + x1) / 2, yb - 0.08, z, x0, yt, z, (x0 + x1) / 2, yb - 0.08, z, x0, yb, z, x1, yt, z, x1, yb, z, (x0 + x1) / 2, yb - 0.08, z]), c: i % 2 ? d.toldos.b : d.toldos.a })
      }
    }
  }
  if (d.techo === "enramada") {
    const colores = ["#c9a46a", "#b8914f", "#d9b97a", "#a98650"]
    const porColor: number[][] = colores.map(() => [])
    for (const x of HUECOS) {
      const w = 1.25
      const n = 30
      for (let i = 0; i < n; i++) {
        const xi = x - w / 2 + (i * w) / n
        const yy = y + alto + 0.3 + r() * 0.05 + Math.sin((Math.PI * i) / n) * 0.12
        const dest = porColor[Math.floor(r() * colores.length)]
        const ww = (w / n) * 1.6
        const zz0 = zA - 0.35 - r() * 0.1
        const zz1 = zB + 0.35 + r() * 0.1
        dest.push(xi, yy, zz0, xi + ww, yy, zz0, xi + ww, yy, zz1, xi, yy, zz0, xi + ww, yy, zz1, xi, yy, zz1)
        for (const [z, s] of [[zz0, -1], [zz1, 1]] as [number, number][]) dest.push(xi, yy, z, xi + ww, yy, z, xi + ww / 2, yy - 0.25 - r() * 0.15, z + s * 0.05)
      }
    }
    porColor.forEach((pos, i) => cubierta.push({ g: malla(pos), c: colores[i] }))
    for (const x of [-5, -2, 1, 4]) {
      for (const z of [-3.6, -1.4]) {
        cubierta.push({ g: cil(0.008, 0.008, 0.5, [x, y + alto + 0.05, z], 4), c: "#3a2a1a" })
        luz.push({ g: esfera(0.22, [x, y + alto - 0.42, z], [1, 0.75, 1], 12), c: "#efd9b4" })
        brillos.push({ p: [x, y + alto - 0.45, z], s: 1.4 })
      }
    }
  }
  if (d.techo === "enredadera" || d.techo === "buganvilla") {
    const buga = d.techo === "buganvilla"
    let semilla = 900
    for (const z of [zA, zB]) {
      for (let i = 0; i < 9; i++) {
        const x = TE.x - TE.w / 2 + ((i + 0.3 + r() * 0.4) * TE.w) / 9
        const largo = 0.9 + r() * 0.8
        cubierta.push(...nube([x, y + alto + 0.28, z], [largo, 0.2, 0.32], 220, VERDES, semilla++, 0.075))
        if (buga && r() < 0.8) cubierta.push(...nube([x + (r() - 0.5) * 0.6, y + alto + 0.3, z], [largo * 0.6, 0.18, 0.3], 160, FUCSIAS, semilla++, 0.06))
        if (!buga) {
          for (let k = 0; k < 4; k++) {
            const xx = x + (r() - 0.5) * largo * 1.4
            const cae = 0.5 + r() * 0.9
            cubierta.push(...nube([xx, y + alto + 0.1 - cae / 2, z + (r() - 0.5) * 0.15], [0.07, cae / 2, 0.07], 40, VERDES, semilla++, 0.06))
          }
        }
      }
    }
    for (const [x, z] of POSTES_TERRAZA_T) {
      if (r() < (buga ? 0.6 : 0.5)) {
        cubierta.push(...nube([x, y + alto * 0.55, z], [0.22, alto * 0.48, 0.22], 220, VERDES, semilla++, 0.07))
        if (buga) cubierta.push(...nube([x, y + alto * 0.7, z], [0.24, alto * 0.3, 0.24], 120, FUCSIAS, semilla++, 0.06))
      }
    }
  }
  const res = { postes: unir(postes), cubierta: unir(cubierta), tela: tela.length ? unir(tela) : null, luz: luz.length ? unir(luz) : null, brillos }
  TECHOS.set(clave, res)
  return res
}
const TECHOS = new Map<string, { postes: THREE.BufferGeometry; cubierta: THREE.BufferGeometry; tela: THREE.BufferGeometry | null; luz: THREE.BufferGeometry | null; brillos: Brillo[] }>()

export function TechoTropical({ estilo, oculto, sombras, calidas }: { estilo: EstiloFino; oculto: boolean; sombras: boolean; calidas: number }) {
  const g = useMemo(() => geoTecho(estilo), [estilo])
  const encendido = calidas > 0
  return (
    <group>
      <mesh geometry={g.postes} material={matDoble} castShadow={sombras} />
      {!oculto && (
        <>
          <mesh geometry={g.cubierta} material={matDoble} castShadow={sombras} />
          {g.tela && <mesh geometry={g.tela} material={matTela} castShadow={sombras} renderOrder={3} />}
          {g.luz && <mesh geometry={g.luz} material={encendido ? matLuzEncendida : matLuzApagada} />}
          {encendido && g.brillos.length > 0 && <Brillos lista={g.brillos} calidas={calidas} />}
        </>
      )}
    </group>
  )
}

/* ---------- Gazebo ---------- */

function geoGazebo(estilo: EstiloFino) {
  const ya = GAZEBOS.get(estilo)
  if (ya) return ya
  const t = TEMAS[estilo]
  const d = t.deco!
  const lado = 3.2
  const alto = 2.6
  const solida: Parte[] = []
  const techo: Parte[] = []
  const luz: Parte[] = []
  const esquinas = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  if (d.gazebo === "palapa") {
    for (const [a, b] of esquinas) solida.push({ g: cil(0.1, 0.12, alto, [(a * lado) / 2, alto / 2, (b * lado) / 2], 8), c: t.gazebo })
    for (let i = 0; i < 4; i++) solida.push({ g: colocar(new THREE.BoxGeometry(lado + 0.2, 0.12, 0.12), [Math.sin((i * Math.PI) / 2) * (lado / 2), alto, Math.cos((i * Math.PI) / 2) * (lado / 2)], [0, (i * Math.PI) / 2, 0]), c: t.gazebo })
    techo.push(...paja({ rTop: 0.06, rBot: 2.2, yTop: alto + 1.45, yBot: alto - 0.15, n: 64, colores: ["#c9a46a", "#b8914f", "#d9b97a", "#a98650", "#bfa060"], semilla: 12, capas: 4 }))
    solida.push({ g: esfera(0.12, [0, alto + 1.47, 0], [1, 1.3, 1], 10), c: "#c0704a" })
    solida.push({ g: cil(0.008, 0.008, 1.0, [0, alto + 0.5, 0], 4), c: "#3a2a1a" })
    luz.push({ g: esfera(0.28, [0, alto - 0.2, 0], [1, 0.8, 1], 14), c: "#efd9b4" })
  } else if (d.gazebo === "joglo") {
    for (const [a, b] of esquinas) solida.push({ g: caja(0.18, alto, 0.18, [(a * lado) / 2, alto / 2, (b * lado) / 2]), c: t.gazebo })
    for (let i = 0; i < 4; i++) solida.push({ g: colocar(new THREE.BoxGeometry(lado + 0.3, 0.18, 0.18), [Math.sin((i * Math.PI) / 2) * (lado / 2), alto, Math.cos((i * Math.PI) / 2) * (lado / 2)], [0, (i * Math.PI) / 2, 0]), c: t.gazebo })
    const cana = ["#5a4a36", "#4a3c2c", "#6b5840", "#55452f"]
    techo.push(...paja({ rTop: 1.15, rBot: 2.0, yTop: alto + 0.5, yBot: alto - 0.12, n: 64, colores: cana, semilla: 4, capas: 2, cuadrado: true }))
    techo.push(...paja({ rTop: 0.05, rBot: 1.25, yTop: alto + 1.75, yBot: alto + 0.44, n: 64, colores: cana, semilla: 5, capas: 3, cuadrado: true }))
    solida.push({ g: cil(0.03, 0.09, 0.4, [0, alto + 1.9, 0], 8), c: "#c9a35c" })
    solida.push({ g: cil(0.008, 0.008, 0.6, [0, alto + 0.2, 0], 4), c: "#2a1c12" })
    luz.push({ g: cil(0.16, 0.16, 0.36, [0, alto - 0.3, 0], 8), c: "#f2dfb8" })
  } else {
    for (const [a, b] of esquinas) solida.push({ g: cil(0.06, 0.07, alto, [(a * lado) / 2, alto / 2, (b * lado) / 2], 16), c: t.gazebo })
    const R = (lado / 2) * Math.SQRT2
    const anillo = new THREE.TorusGeometry(R, 0.05, 6, 64)
    anillo.rotateX(Math.PI / 2)
    anillo.translate(0, alto, 0)
    solida.push({ g: anillo, c: t.gazebo })
    for (const giro of [Math.PI / 4, -Math.PI / 4]) {
      const arco = new THREE.TorusGeometry(R, 0.045, 6, 40, Math.PI)
      arco.scale(1, 0.55, 1)
      arco.rotateY(giro)
      arco.translate(0, alto, 0)
      solida.push({ g: arco, c: t.gazebo })
    }
    solida.push({ g: esfera(0.1, [0, alto + R * 0.55 + 0.08, 0], [1, 1, 1], 12), c: "#f08f74" })
    solida.push({ g: cil(0.006, 0.006, R * 0.55, [0, alto + R * 0.27, 0], 4), c: "#d9c9b5" })
    luz.push({ g: esfera(0.24, [0, alto - 0.05, 0], [1, 1, 1], 16), c: "#eccfb2" })
  }
  const res = { solida: unir(solida), techo: techo.length ? unir(techo) : null, luz: unir(luz) }
  GAZEBOS.set(estilo, res)
  return res
}
const GAZEBOS = new Map<EstiloFino, { solida: THREE.BufferGeometry; techo: THREE.BufferGeometry | null; luz: THREE.BufferGeometry }>()

const geoCortinaG = (() => {
  const g = new THREE.PlaneGeometry(0.7, 2.45, 10, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 18) * 0.04)
  g.computeVertexNormals()
  return g
})()

export function GazeboTropical({ estilo, calidas, sombras }: { estilo: EstiloFino; calidas: number; sombras: boolean }) {
  const t = TEMAS[estilo]
  const g = useMemo(() => geoGazebo(estilo), [estilo])
  const lado = 3.2
  const alto = 2.6
  const encendido = calidas > 0
  const y = estilo === "coral" ? alto - 0.05 : estilo === "bali" ? alto - 0.3 : alto - 0.2
  const matT = useMemo(() => matTecho.clone(), [])
  const centro = useMemo(() => new THREE.Vector3(aX(32), PISO_MUELLE + alto + 0.8, aZ(38)), [])
  useFrame(({ camera }) => {
    matT.opacity = THREE.MathUtils.clamp((camera.position.distanceTo(centro) - 9) / 7, 0.2, 0.94)
  })
  return (
    <group position={[aX(32), PISO_MUELLE, aZ(38)]}>
      <mesh geometry={g.solida} material={matDoble} castShadow={sombras} />
      {g.techo && <mesh geometry={g.techo} material={matT} castShadow={sombras} renderOrder={4} />}
      <mesh geometry={g.luz} material={encendido ? matLuzEncendida : matLuzApagada} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
        <mesh key={i} geometry={geoCortinaG} position={[(a * lado) / 2 - a * 0.3, alto / 2 + 0.02, (b * lado) / 2]} rotation-y={Math.PI / 2}>
          <meshStandardMaterial color={t.tela} transparent opacity={0.62} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {encendido && <Brillos lista={[{ p: [0, y, 0], s: 2.4 }]} calidas={calidas} />}
    </group>
  )
}
