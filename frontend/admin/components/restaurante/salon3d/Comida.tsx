"use client"

import { useEffect, useMemo } from "react"
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { PLATOS } from "@/lib/restaurante/carta"
import type { ItemPedido } from "@/lib/restaurante/tipos"
import { capsulaEntre, colocar, geoGuardada, unir, type Parte } from "./geo"
import { useEstilo } from "./estilos"

type V3 = [number, number, number]
type Sitio = { x: number; z: number; rot: number }

export type Tipo =
  | "langosta" | "langostaGratin" | "cuencoLangosta" | "paella" | "paellaGrande" | "pescado" | "pescadoCoco" | "filete" | "pulpo"
  | "camarones" | "camaronesSalsa" | "langostinos" | "coctel" | "canoa" | "parrillada" | "picadera" | "bistec" | "medallon"
  | "pollo" | "cordon" | "pastaRoja" | "pastaBlanca" | "pastaVerde" | "sushi" | "ensalada" | "caprese" | "sopa" | "crema"
  | "tostones" | "papas" | "arroz" | "vegetales" | "pastel" | "selva" | "flan" | "brownie" | "calamares" | "croquetas"
  | "carpaccio" | "pan" | "portobello" | "risotto" | "muelas"

const POR_ID: Record<string, Tipo> = {
  "langosta-plancha": "langosta", "langosta-thermidor": "langostaGratin", "bisque-langosta": "cuencoLangosta", "lasagna-langosta": "cuencoLangosta",
  "asopao-langosta": "cuencoLangosta", "paella-2": "paella", "paella-4": "paellaGrande", "chillo-boca-chica": "pescado", "pescado-samana": "pescadoCoco",
  "filete-plancha": "filete", "filete-eduardo": "filete", "filete-gratinado": "filete", "pulpo-parrilla": "pulpo", "pulpo-vinagreta": "pulpo",
  "camarones-ajo-vino": "camaronesSalsa", "camarones-thermidor": "camaronesSalsa", "camarones-coco": "camaronesSalsa", "ollita-camarones": "camaronesSalsa",
  langostinos: "langostinos", "coctel-camarones": "coctel", salpicon: "coctel", ceviche: "coctel", canoa: "canoa", "parrillada-2": "parrillada",
  picadera: "picadera", churrasco: "bistec", "risotto-churrasco": "risotto", "filete-mignon": "medallon", "filete-pimienta": "medallon",
  "pollo-grill": "pollo", "cordon-bleu": "cordon", "pasta-frutti": "pastaRoja", "pasta-bolognesa": "pastaRoja", "pasta-carbonara-camarones": "pastaBlanca",
  "pasta-pesto-mero": "pastaVerde", caprese: "caprese", "crema-auyama": "crema", "lambi-criolla": "sopa", tostones: "tostones",
  "papas-fritas": "papas", yuquitas: "papas", "arroz-blanco": "arroz", "vegetales-grill": "vegetales", "selva-negra": "selva", brownie: "brownie",
  "flan-coco": "flan", "panacota-chinola": "flan", "dulce-coco": "flan", "calamares-empanizados": "calamares", croquetas: "croquetas",
  "chicharron-mero": "croquetas", "mozzarella-marinara": "croquetas", "carpaccio-res": "carpaccio", "carpaccio-salmon": "carpaccio",
  "carpaccio-portobello": "carpaccio", baguettines: "pan", "portobello-camarones": "portobello", "muelas-centollo": "muelas",
}

const POR_CATEGORIA: Record<string, Tipo> = {
  "Entradas frías": "coctel", "Entradas calientes": "croquetas", "Sopas y cremas": "sopa", Ensaladas: "ensalada", "Del mar": "filete",
  Especialidades: "parrillada", "Carnes y aves": "bistec", Pastas: "pastaRoja", Sushi: "sushi", Guarniciones: "arroz", Postres: "pastel",
}

export function tipoDe(platoId: string): Tipo {
  if (POR_ID[platoId]) return POR_ID[platoId]
  if (platoId.startsWith("sushi")) return "sushi"
  if (platoId.startsWith("langosta")) return "langosta"
  const p = PLATOS.get(platoId)
  if (p?.categoria === "Postres") return /negra|brownie|choco/i.test(p.nombre) ? "selva" : "pastel"
  return (p && POR_CATEGORIA[p.categoria]) || "filete"
}

const COMPARTIDO: Partial<Record<Tipo, number>> = { paella: 0.19, paellaGrande: 0.25, canoa: 0.2, parrillada: 0.2, picadera: 0.17 }
const ALARGADO = new Set<Tipo>(["langosta", "langostaGratin", "pescado", "pescadoCoco"])
const ACOMPANA = new Set<Tipo>(["tostones", "papas", "arroz", "vegetales", "pan"])

const C = {
  plato: "#ffffff", borde: "#eef1f1", langosta: "#e0461c", langosta2: "#f06a33", pinza: "#c6331a", carne: "#fbf3e4", limon: "#f5d33b",
  perejil: "#4f9a32", hoja: "#6dbb3c", hoja2: "#3f8a2c", sarten: "#26292c", arroz: "#f0b630", camaron: "#ff8a5c", camaron2: "#ffb48a",
  mejillon: "#1d2230", mejillon2: "#f2a25a", pimiento: "#d8352a", guisante: "#59a83a", frito: "#c9802f", frito2: "#a8601f", ojo: "#111111",
  pulpo: "#b44a5c", pulpo2: "#e7a0a8", papa: "#f1cf6a", res: "#7a3a22", res2: "#4a2414", marca: "#2b160c", pollo: "#e2ae67", pasta: "#f4d78c",
  tomate: "#cf3b22", crema: "#f7efd8", pesto: "#5f9a34", nori: "#1f3322", tabla: "#c08c55", salmon: "#ff8f5e", wasabi: "#9bc44a",
  jengibre: "#f5b5b5", madera: "#9a6a3e", sopa: "#e08a3c", auyama: "#f0a033", bizcocho: "#fbf1dc", choco: "#4a2617", cereza: "#b3122e",
  caramelo: "#c9852c", caramelo2: "#8f4c12", helado: "#fffaf0", queso: "#fffdf5", cebolla: "#c9668f", hongo: "#5b3b28",
}

const eli = (r: number, pos: V3, esc: V3, rot: V3 = [0, 0, 0], seg = 10) => colocar(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), pos, rot, esc)
const cilE = (rt: number, rb: number, h: number, pos: V3, esc: V3 = [1, 1, 1], seg = 20, rot: V3 = [0, 0, 0]) => colocar(new THREE.CylinderGeometry(rt, rb, h, seg), pos, rot, esc)
const caja = (w: number, h: number, d: number, pos: V3, rot: V3 = [0, 0, 0]) => colocar(new THREE.BoxGeometry(w, h, d), pos, rot)
const toro = (r: number, t: number, pos: V3, rot: V3, arco = Math.PI * 2, seg = 14) => colocar(new THREE.TorusGeometry(r, t, 6, seg, arco), pos, rot)

function plato(p: Parte[], r = 0.13, oval = 1) {
  p.push({ g: cilE(r, r * 0.86, 0.012, [0, 0.006, 0], [1, 1, oval], 32), c: C.plato })
  p.push({ g: cilE(r * 0.7, r * 0.7, 0.002, [0, 0.0125, 0], [1, 1, oval], 28), c: C.borde })
}

function cuenco(p: Parte[], r: number, h: number, relleno: string) {
  p.push({ g: cilE(r * 1.25, r * 1.1, 0.008, [0, 0.004, 0], [1, 1, 1], 24), c: C.plato })
  p.push({ g: cilE(r, r * 0.62, h, [0, h / 2 + 0.006, 0], [1, 1, 1], 24), c: C.plato })
  p.push({ g: cilE(r * 0.88, r * 0.88, 0.003, [0, h + 0.004, 0], [1, 1, 1], 24), c: relleno })
}

function limon(p: Parte[], x: number, z: number, y = 0.016, giro = 0) {
  p.push({ g: eli(0.018, [x, y, z], [1.5, 0.75, 0.75], [0, giro, 0], 8), c: C.limon })
}

function perejil(p: Parte[], pts: [number, number][], y = 0.018) {
  for (const [x, z] of pts) p.push({ g: eli(0.009, [x, y, z], [1.2, 0.6, 1], [0, x * 40, 0], 6), c: C.perejil })
}

function camaron(p: Parte[], x: number, y: number, z: number, giro: number, r = 0.022, plano = true) {
  const rot: V3 = plano ? [Math.PI / 2, 0, giro] : [0, giro, 0]
  p.push({ g: toro(r, r * 0.42, [x, y, z], rot, Math.PI * 1.35, 10), c: C.camaron })
  const cola: V3 = [x + Math.cos(giro) * r, y + 0.002, z - Math.sin(giro) * r * (plano ? -1 : 1)]
  p.push({ g: eli(r * 0.45, cola, [1.3, 0.4, 0.8], [0, giro, 0], 6), c: C.pimiento })
}

function mejillon(p: Parte[], x: number, y: number, z: number, giro: number) {
  p.push({ g: eli(0.017, [x, y, z], [1.6, 0.45, 0.85], [0, giro, 0], 8), c: C.mejillon })
  p.push({ g: eli(0.012, [x, y + 0.005, z], [1.5, 0.3, 0.7], [0, giro, 0], 8), c: C.mejillon2 })
}

function langostaEn(p: Parte[], gratin = false, k = 1, dy = 0.014) {
  const s = (v: V3): V3 => [v[0] * k, v[1] * k + dy, v[2] * k]
  const tubo = (a: V3, b: V3, r: number, c: string) => p.push({ g: capsulaEntre(s(a), s(b), r * k, 6), c })
  p.push({ g: eli(0.031 * k, s([0, 0.026, 0.045]), [1, 0.82, 1.9], [0, 0, 0], 14), c: C.langosta })
  p.push({ g: eli(0.012 * k, s([0, 0.046, 0.06]), [1, 0.5, 2.6], [0, 0, 0], 8), c: C.langosta2 })
  for (let i = 0; i < 5; i++) {
    const z = -0.018 - i * 0.024
    p.push({ g: eli((0.03 - i * 0.0026) * k, s([0, 0.021 - i * 0.002, z]), [1, 0.62, 0.72], [0, 0, 0], 12), c: i % 2 ? C.langosta : C.langosta2 })
  }
  for (const a of [-0.75, -0.38, 0, 0.38, 0.75]) p.push({ g: eli(0.019 * k, s([Math.sin(a) * 0.022, 0.012, -0.135 - Math.cos(a) * 0.022]), [0.55, 0.2, 1.35], [0, a, 0], 8), c: C.langosta })
  if (gratin) {
    p.push({ g: eli(0.026 * k, s([0, 0.034, -0.05]), [0.85, 0.42, 2.6], [0, 0, 0], 12), c: "#ecc35c" })
    for (const z of [-0.09, -0.05, -0.01]) p.push({ g: eli(0.007 * k, s([0.006, 0.044, z]), [1, 0.4, 1], [0, 0, 0], 6), c: "#b9772e" })
  } else p.push({ g: eli(0.017 * k, s([0, 0.031, -0.05]), [0.8, 0.42, 3.3], [0, 0, 0], 10), c: C.carne })
  for (const l of [-1, 1]) {
    for (let i = 0; i < 4; i++) tubo([l * 0.024, 0.018, 0.012 + i * 0.019], [l * 0.066, 0.004, -0.004 + i * 0.024], 0.0035, C.pinza)
    tubo([l * 0.02, 0.03, 0.088], [l * 0.05, 0.03, 0.118], 0.0085, C.pinza)
    tubo([l * 0.05, 0.03, 0.118], [l * 0.062, 0.032, 0.148], 0.0095, C.pinza)
    p.push({ g: eli(0.027 * k, s([l * 0.074, 0.034, 0.19]), [0.95, 0.68, 1.75], [0, l * 0.28, 0], 12), c: C.pinza })
    p.push({ g: eli(0.011 * k, s([l * 0.052, 0.032, 0.222]), [0.9, 0.75, 2.8], [0, l * -0.1, 0], 8), c: C.langosta })
    tubo([l * 0.012, 0.04, 0.1], [l * 0.04, 0.046, 0.17], 0.0035, C.langosta)
    tubo([l * 0.04, 0.046, 0.17], [l * 0.095, 0.036, 0.235], 0.003, C.langosta)
    tubo([l * 0.095, 0.036, 0.235], [l * 0.14, 0.024, 0.27], 0.0026, C.langosta)
    p.push({ g: eli(0.0055 * k, s([l * 0.013, 0.05, 0.096]), [1, 1, 1], [0, 0, 0], 6), c: C.ojo })
  }
}

function paellaEn(p: Parte[], R: number, langosta: boolean) {
  p.push({ g: cilE(R, R * 0.93, 0.03, [0, 0.015, 0], [1, 1, 1], 36), c: C.sarten })
  p.push({ g: cilE(R * 0.94, R * 0.94, 0.004, [0, 0.03, 0], [1, 1, 1], 36), c: C.arroz })
  for (const l of [-1, 1]) p.push({ g: toro(0.022, 0.006, [l * (R + 0.012), 0.028, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 10), c: C.sarten })
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996
    const r = R * 0.85 * Math.sqrt((i + 0.5) / 40)
    p.push({ g: eli(0.006, [Math.cos(a) * r, 0.033, Math.sin(a) * r], [1, 0.5, 1], [0, 0, 0], 5), c: i % 3 ? C.guisante : C.pimiento })
  }
  const n = R > 0.2 ? 7 : 5
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    camaron(p, Math.cos(a) * R * 0.62, 0.036, Math.sin(a) * R * 0.62, -a + Math.PI / 2, 0.026)
    const b = a + Math.PI / n
    mejillon(p, Math.cos(b) * R * 0.68, 0.035, Math.sin(b) * R * 0.68, -b)
  }
  for (const a of [0.6, 2.7, 4.6]) limon(p, Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3, 0.04, a)
  if (langosta) {
    const q: Parte[] = []
    langostaEn(q, false, 0.8, 0)
    for (const x of q) p.push({ g: colocar(x.g, [0, 0.03, 0], [0, 0.5, 0]), c: x.c })
  }
}

function pescadoEn(p: Parte[], coco: boolean) {
  plato(p, 0.135, 1.5)
  if (coco) p.push({ g: cilE(0.1, 0.1, 0.004, [0, 0.015, 0], [1, 1, 1.45], 24), c: "#f3e2b8" })
  const piel = coco ? "#d8913f" : C.frito
  p.push({ g: eli(0.04, [0, 0.026, 0.01], [0.85, 0.5, 2.6], [0, 0, 0], 14), c: piel })
  p.push({ g: eli(0.03, [0, 0.03, 0.085], [0.9, 0.6, 1.0], [0, 0, 0], 10), c: C.frito2 })
  p.push({ g: cilE(0.045, 0.045, 0.006, [0, 0.022, -0.115], [0.9, 1, 1], 3, [0, Math.PI, 0]), c: C.frito2 })
  p.push({ g: eli(0.012, [0, 0.042, 0.0], [0.4, 0.5, 4.5], [0, 0, 0], 6), c: C.frito2 })
  for (const z of [-0.04, -0.01, 0.02, 0.05]) p.push({ g: caja(0.06, 0.004, 0.004, [0, 0.046, z], [0, 0.5, 0]), c: C.frito2 })
  for (const l of [-1, 1]) {
    p.push({ g: eli(0.008, [l * 0.02, 0.04, 0.1], [1, 1, 1], [0, 0, 0], 8), c: "#ffffff" })
    p.push({ g: eli(0.0045, [l * 0.024, 0.042, 0.103], [1, 1, 1], [0, 0, 0], 6), c: C.ojo })
  }
  tostonesEn(p, 0.09, -0.05, 3)
  limon(p, -0.085, 0.09)
  if (coco) for (const [x, z] of [[-0.06, -0.06], [0.05, 0.12], [-0.07, 0.03]]) p.push({ g: caja(0.024, 0.005, 0.008, [x, 0.017, z], [0, x * 30, 0]), c: C.pimiento })
  perejil(p, [[-0.08, 0.06], [-0.06, 0.1], [0.07, 0.1]])
}

function tostonesEn(p: Parte[], x: number, z: number, n: number, y = 0.016) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.1
    const px = x + Math.cos(a) * 0.022 * (i ? 1 : 0)
    const pz = z + Math.sin(a) * 0.022 * (i ? 1 : 0) + i * 0.012
    p.push({ g: cilE(0.022, 0.024, 0.01, [px, y + i * 0.004, pz], [1, 1, 0.9], 10), c: "#e2b545" })
    p.push({ g: cilE(0.015, 0.015, 0.002, [px, y + 0.006 + i * 0.004, pz], [1, 1, 0.9], 8), c: "#f3d679" })
  }
}

function pulpoEn(p: Parte[]) {
  plato(p, 0.135)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2
    let prev: V3 | null = null
    for (let j = 0; j <= 11; j++) {
      const t = j / 11
      const r = 0.02 + t * 0.075
      const b = a + t * t * 2.2
      const pt: V3 = [Math.cos(b) * r, 0.02 - t * 0.006, Math.sin(b) * r]
      const grosor = 0.011 * (1 - t * 0.72)
      if (prev) p.push({ g: capsulaEntre(prev, pt, grosor, 6), c: j > 8 ? C.pulpo2 : C.pulpo })
      prev = pt
    }
  }
  p.push({ g: eli(0.032, [0, 0.042, -0.012], [1, 0.85, 1.25], [0.3, 0, 0], 12), c: C.pulpo })
  p.push({ g: eli(0.02, [0, 0.03, 0.022], [1.1, 0.7, 0.9], [0, 0, 0], 10), c: "#9a3a4c" })
  for (const [x, z] of [[0.07, 0.07], [-0.07, 0.075], [0.08, -0.06]]) p.push({ g: eli(0.016, [x, 0.022, z], [1, 0.75, 1], [0, 0, 0], 8), c: C.papa })
  perejil(p, [[0.03, 0.09], [-0.09, -0.02], [0.095, 0.01]])
}

function camaronesEn(p: Parte[], salsa: string | null, grandes = false) {
  plato(p)
  if (salsa) p.push({ g: cilE(0.085, 0.085, 0.004, [0, 0.015, 0], [1, 1, 1], 24), c: salsa })
  const n = grandes ? 5 : 7
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    camaron(p, Math.cos(a) * 0.055, 0.022, Math.sin(a) * 0.055, -a + Math.PI / 2, grandes ? 0.032 : 0.024)
  }
  if (grandes) for (const a of [0.3, 1.6, 2.9]) p.push({ g: capsulaEntre([Math.cos(a) * 0.04, 0.03, Math.sin(a) * 0.04], [Math.cos(a) * 0.13, 0.026, Math.sin(a) * 0.13], 0.002, 4), c: C.pimiento })
  perejil(p, [[0, 0], [0.012, 0.014], [-0.01, 0.01]], 0.024)
  limon(p, 0.08, -0.07)
}

function coctelEn(p: Parte[], relleno: string) {
  p.push({ g: cilE(0.04, 0.045, 0.006, [0, 0.003, 0], [1, 1, 1], 16), c: "#e8f3f3" })
  p.push({ g: cilE(0.007, 0.007, 0.06, [0, 0.035, 0], [1, 1, 1], 8), c: "#e8f3f3" })
  p.push({ g: cilE(0.065, 0.02, 0.04, [0, 0.085, 0], [1, 1, 1], 20), c: "#eef7f7" })
  p.push({ g: cilE(0.06, 0.06, 0.004, [0, 0.102, 0], [1, 1, 1], 20), c: relleno })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    camaron(p, Math.cos(a) * 0.058, 0.1, Math.sin(a) * 0.058, -a, 0.017, false)
  }
  p.push({ g: eli(0.018, [0, 0.11, 0], [1.4, 0.6, 1.2], [0, 0, 0], 8), c: C.hoja })
  limon(p, 0.03, 0.03, 0.112)
}

function bandejaMar(p: Parte[], canoa: boolean) {
  if (canoa) {
    p.push({ g: colocar(new THREE.SphereGeometry(0.1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0, 0.045, 0], [0, 0, 0], [0.8, 0.45, 1.9]), c: C.madera })
    p.push({ g: cilE(0.075, 0.075, 0.004, [0, 0.043, 0], [1, 1, 2.3], 24), c: C.arroz })
  } else {
    p.push({ g: caja(0.3, 0.02, 0.2, [0, 0.01, 0]), c: C.sarten })
    for (let i = -3; i <= 3; i++) p.push({ g: caja(0.004, 0.003, 0.18, [i * 0.04, 0.021, 0]), c: "#3d4246" })
  }
  const y = canoa ? 0.05 : 0.026
  const q: Parte[] = []
  langostaEn(q, false, canoa ? 0.62 : 0.7, 0)
  for (const x of q) p.push({ g: colocar(x.g, canoa ? [0, y, 0.01] : [-0.07, y, 0], [0, canoa ? 0 : Math.PI / 2, 0]), c: x.c })
  const pts: [number, number][] = canoa ? [[0.04, 0.12], [-0.04, 0.12], [0.045, -0.12], [-0.04, -0.13]] : [[0.06, 0.06], [0.1, 0.05], [0.06, -0.07], [0.11, -0.06]]
  pts.forEach(([x, z], i) => camaron(p, x, y + 0.004, z, i * 1.3, 0.024))
  for (const [x, z] of canoa ? [[0.05, 0.03], [-0.05, -0.04], [0.04, -0.06]] : [[0.13, 0.0], [0.03, 0.0]]) mejillon(p, x, y + 0.004, z, x * 20)
  if (!canoa) {
    p.push({ g: eli(0.02, [0.08, y + 0.008, 0.005], [1.9, 0.5, 1.2], [0, 0.3, 0], 10), c: C.carne })
    for (const a of [0, 1.2, 2.4]) p.push({ g: toro(0.012, 0.004, [0.0 + Math.cos(a) * 0.02, y + 0.004, 0.07 + Math.sin(a) * 0.02], [Math.PI / 2, 0, 0], Math.PI * 2, 10), c: "#e6c27a" })
    limon(p, -0.12, 0.07, y + 0.004)
  } else limon(p, 0, 0.17, y)
}

function picaderaEn(p: Parte[]) {
  p.push({ g: cilE(0.16, 0.14, 0.014, [0, 0.007, 0], [1, 1, 1], 32), c: C.plato })
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05
    p.push({ g: toro(0.014, 0.005, [Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08], [Math.PI / 2, 0, a], Math.PI * 2, 10), c: "#e6c27a" })
  }
  for (let i = 0; i < 4; i++) camaron(p, Math.cos(i * 1.6 + 0.5) * 0.04, 0.02, Math.sin(i * 1.6 + 0.5) * 0.04, i, 0.02)
  for (let i = 0; i < 10; i++) p.push({ g: caja(0.008, 0.008, 0.05, [-0.06 + (i % 5) * 0.012, 0.022 + Math.floor(i / 5) * 0.008, 0.11 - (i % 3) * 0.01], [0, i * 0.5, 0]), c: C.papa })
  for (const [x, z] of [[0.1, -0.05], [0.12, 0.02], [0.08, -0.1]]) p.push({ g: capsulaEntre([x - 0.02, 0.02, z], [x + 0.02, 0.02, z + 0.01], 0.01, 6), c: C.frito })
}

function bistecEn(p: Parte[], medallon: boolean) {
  plato(p)
  if (medallon) {
    p.push({ g: cilE(0.045, 0.047, 0.04, [-0.01, 0.034, 0.0], [1, 1, 1], 16), c: C.res })
    p.push({ g: cilE(0.04, 0.04, 0.002, [-0.01, 0.055, 0], [1, 1, 1], 16), c: C.res2 })
    p.push({ g: cilE(0.05, 0.05, 0.003, [-0.01, 0.015, 0], [1, 1, 1], 16), c: "#5e2414" })
  } else {
    p.push({ g: eli(0.06, [-0.015, 0.03, 0], [1.5, 0.3, 0.95], [0, 0.3, 0], 14), c: C.res })
    for (const d of [-0.04, -0.015, 0.01, 0.035]) p.push({ g: caja(0.005, 0.004, 0.08, [-0.015 + d, 0.047, 0], [0, 0.9, 0]), c: C.marca })
  }
  papasEn(p, 0.075, 0.03, 0.016, 7)
  vegetalesMini(p, 0.06, -0.07)
  perejil(p, [[-0.02, 0.08]])
}

function polloEn(p: Parte[], cordon: boolean) {
  plato(p)
  if (cordon) {
    p.push({ g: capsulaEntre([-0.07, 0.032, -0.01], [0.02, 0.032, 0.01], 0.024, 12), c: "#d79a3a" })
    p.push({ g: cilE(0.022, 0.022, 0.004, [0.045, 0.032, 0.015], [1, 1, 1], 14, [0, 0, Math.PI / 2]), c: "#f6e7c4" })
    p.push({ g: cilE(0.012, 0.012, 0.005, [0.047, 0.032, 0.015], [1, 1, 1], 10, [0, 0, Math.PI / 2]), c: "#e9a3a0" })
  } else {
    p.push({ g: eli(0.052, [-0.015, 0.026, 0], [1.45, 0.38, 0.85], [0, -0.2, 0], 14), c: C.pollo })
    for (const d of [-0.035, -0.01, 0.015, 0.04]) p.push({ g: caja(0.004, 0.004, 0.07, [-0.015 + d, 0.045, 0], [0, 0.8, 0]), c: "#7a4a1e" })
  }
  arrozMini(p, 0.07, 0.04)
  vegetalesMini(p, 0.06, -0.07)
}

function pastaEn(p: Parte[], salsa: string, mar: boolean) {
  p.push({ g: cilE(0.13, 0.08, 0.026, [0, 0.013, 0], [1, 1, 1], 28), c: C.plato })
  p.push({ g: cilE(0.1, 0.1, 0.002, [0, 0.02, 0], [1, 1, 1], 24), c: C.borde })
  for (let i = 0; i < 6; i++) p.push({ g: toro(0.06 - i * 0.008, 0.0065, [Math.sin(i) * 0.006, 0.026 + i * 0.006, Math.cos(i) * 0.006], [Math.PI / 2, 0, i], Math.PI * 2, 18), c: C.pasta })
  p.push({ g: eli(0.034, [0, 0.055, 0], [1, 0.45, 1], [0, 0, 0], 12), c: salsa })
  if (mar) for (let i = 0; i < 3; i++) camaron(p, Math.cos(i * 2.1) * 0.05, 0.05, Math.sin(i * 2.1) * 0.05, i * 2.1, 0.02)
  if (mar && salsa === C.tomate) for (const a of [1, 3.1, 5.2]) mejillon(p, Math.cos(a) * 0.06, 0.046, Math.sin(a) * 0.06, a)
  perejil(p, [[0, 0], [0.012, -0.01]], 0.07)
}

function sushiEn(p: Parte[]) {
  p.push({ g: caja(0.26, 0.016, 0.12, [0, 0.008, 0]), c: C.tabla })
  for (const l of [-1, 1]) p.push({ g: caja(0.02, 0.012, 0.11, [l * 0.11, -0.002, 0]), c: "#8f6238" })
  for (let i = 0; i < 6; i++) {
    const x = -0.085 + (i % 3) * 0.042
    const z = i < 3 ? -0.025 : 0.025
    p.push({ g: cilE(0.019, 0.019, 0.022, [x, 0.027, z], [1, 1, 1], 14), c: C.nori })
    p.push({ g: cilE(0.016, 0.016, 0.002, [x, 0.0385, z], [1, 1, 1], 14), c: "#fbfaf4" })
    p.push({ g: cilE(0.007, 0.007, 0.003, [x, 0.039, z], [1, 1, 1], 10), c: i % 2 ? C.salmon : "#7bbf6a" })
  }
  p.push({ g: eli(0.012, [0.055, 0.022, -0.03], [1, 0.6, 1], [0, 0, 0], 8), c: C.wasabi })
  p.push({ g: eli(0.016, [0.075, 0.022, 0.025], [1.3, 0.4, 1], [0, 0, 0], 8), c: C.jengibre })
  for (const z of [0.07, 0.08]) p.push({ g: caja(0.22, 0.005, 0.005, [0, 0.003, z], [0, 0.04, 0]), c: "#d8b07a" })
}

function ensaladaEn(p: Parte[]) {
  cuenco(p, 0.08, 0.035, C.hoja2)
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996
    const r = 0.065 * Math.sqrt((i + 0.5) / 18)
    p.push({ g: eli(0.02, [Math.cos(a) * r, 0.044 + (i % 3) * 0.005, Math.sin(a) * r], [1.3, 0.35, 0.8], [0.3, a, 0.2], 8), c: i % 3 ? C.hoja : C.hoja2 })
  }
  for (let i = 0; i < 5; i++) p.push({ g: eli(0.011, [Math.cos(i * 1.3) * 0.04, 0.055, Math.sin(i * 1.3) * 0.04], [1, 0.9, 1], [0, 0, 0], 8), c: C.tomate })
  for (let i = 0; i < 4; i++) p.push({ g: caja(0.012, 0.01, 0.012, [Math.cos(i * 1.7 + 0.6) * 0.03, 0.056, Math.sin(i * 1.7 + 0.6) * 0.03], [0, i, 0]), c: "#f3e7c6" })
}

function capreseEn(p: Parte[]) {
  plato(p)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    p.push({ g: cilE(0.024, 0.024, 0.006, [Math.cos(a) * 0.065, 0.018 + (i % 2) * 0.002, Math.sin(a) * 0.065], [1, 1, 1], 14), c: i % 2 ? C.queso : C.tomate })
  }
  for (let i = 0; i < 4; i++) p.push({ g: eli(0.011, [Math.cos(i * 1.57 + 0.4) * 0.065, 0.025, Math.sin(i * 1.57 + 0.4) * 0.065], [1.4, 0.3, 0.8], [0, i, 0], 6), c: C.hoja2 })
  p.push({ g: cilE(0.03, 0.03, 0.002, [0, 0.014, 0], [1, 1, 1], 12), c: "#5a2f22" })
}

function sopaEn(p: Parte[], color: string, extra: "camaron" | "crema" | "pinza") {
  p.push({ g: cilE(0.11, 0.095, 0.01, [0, 0.005, 0], [1, 1, 1], 24), c: C.plato })
  cuenco(p, 0.07, 0.04, color)
  if (extra === "crema") p.push({ g: toro(0.025, 0.004, [0, 0.046, 0], [Math.PI / 2, 0, 0], Math.PI * 1.6, 14), c: C.crema })
  if (extra === "camaron") for (let i = 0; i < 3; i++) camaron(p, Math.cos(i * 2.1) * 0.03, 0.048, Math.sin(i * 2.1) * 0.03, i * 2.1, 0.018)
  if (extra === "pinza") {
    p.push({ g: eli(0.022, [0.01, 0.052, 0.0], [0.9, 0.6, 1.8], [0, 0.6, 0], 12), c: C.pinza })
    p.push({ g: eli(0.009, [-0.008, 0.05, 0.028], [0.9, 0.7, 2.6], [0, 0.4, 0], 8), c: C.langosta })
    p.push({ g: capsulaEntre([0.03, 0.05, -0.03], [0.05, 0.048, -0.05], 0.008, 6), c: C.pinza })
  }
  perejil(p, [[-0.03, 0.02], [-0.02, -0.03]], 0.047)
}

function papasEn(p: Parte[], x: number, z: number, y: number, n: number) {
  for (let i = 0; i < n; i++) p.push({ g: caja(0.008, 0.008, 0.05, [x + ((i % 3) - 1) * 0.011, y + 0.004 + Math.floor(i / 3) * 0.007, z + ((i * 7) % 5 - 2) * 0.006], [0, 0.2 + i * 0.45, 0]), c: C.papa })
}

function arrozMini(p: Parte[], x: number, z: number) {
  p.push({ g: eli(0.034, [x, 0.015, z], [1, 0.6, 1], [0, 0, 0], 12), c: "#fbf8f0" })
  perejil(p, [[x, z]], 0.036)
}

function vegetalesMini(p: Parte[], x: number, z: number) {
  const cs = [C.pimiento, C.guisante, "#f2b53a", C.hoja2]
  for (let i = 0; i < 5; i++) p.push({ g: caja(0.022, 0.008, 0.012, [x + Math.cos(i * 1.3) * 0.018, 0.018, z + Math.sin(i * 1.3) * 0.018], [0, i * 0.8, 0]), c: cs[i % 4] })
}

function guarnicionEn(p: Parte[], tipo: Tipo) {
  p.push({ g: cilE(0.07, 0.06, 0.01, [0, 0.005, 0], [1, 1, 1], 20), c: C.plato })
  if (tipo === "tostones") tostonesEn(p, -0.005, -0.02, 4, 0.014)
  else if (tipo === "papas") {
    cuenco(p, 0.045, 0.03, C.papa)
    papasEn(p, 0, 0, 0.034, 12)
  } else if (tipo === "arroz") arrozMini(p, 0, 0)
  else if (tipo === "vegetales") vegetalesMini(p, 0, 0)
  else for (let i = 0; i < 3; i++) p.push({ g: capsulaEntre([-0.04, 0.02, -0.02 + i * 0.02], [0.04, 0.02, -0.025 + i * 0.022], 0.009, 8), c: "#d9a557" })
}

function postreEn(p: Parte[], tipo: Tipo) {
  p.push({ g: cilE(0.085, 0.075, 0.01, [0, 0.005, 0], [1, 1, 1], 24), c: C.plato })
  if (tipo === "pastel" || tipo === "selva") {
    const forma = new THREE.Shape([new THREE.Vector2(0, 0.045), new THREE.Vector2(-0.032, -0.035), new THREE.Vector2(0.032, -0.035)])
    const selva = tipo === "selva"
    const capas = selva ? [C.choco, "#fff6ea", C.choco, "#fff6ea"] : [C.bizcocho, "#f5e3b8", C.bizcocho, "#fffaf2"]
    capas.forEach((c, i) => {
      const g = new THREE.ExtrudeGeometry(forma, { depth: 0.011, bevelEnabled: false })
      g.rotateX(-Math.PI / 2)
      g.translate(0, 0.011 + i * 0.011, 0)
      p.push({ g, c })
    })
    p.push({ g: eli(0.008, [0, 0.06, -0.012], [1, 1, 1], [0, 0, 0], 8), c: selva ? C.cereza : "#f2c14e" })
    p.push({ g: eli(0.009, [0, 0.058, -0.012], [1.6, 0.4, 1.6], [0, 0, 0], 8), c: "#ffffff" })
    for (let i = 0; i < 5; i++) p.push({ g: eli(0.004, [0.045 - i * 0.006, 0.011, 0.04 - i * 0.012], [1.5, 0.3, 1], [0, 0, 0], 5), c: selva ? C.cereza : "#c27a3a" })
  } else if (tipo === "flan") {
    p.push({ g: cilE(0.05, 0.05, 0.003, [0, 0.011, 0], [1, 1, 1], 18), c: C.caramelo2 })
    p.push({ g: cilE(0.03, 0.038, 0.032, [0, 0.028, 0], [1, 1, 1], 18), c: "#f0c46a" })
    p.push({ g: cilE(0.03, 0.03, 0.002, [0, 0.045, 0], [1, 1, 1], 18), c: C.caramelo })
    p.push({ g: eli(0.007, [0.01, 0.048, 0.005], [1.2, 0.8, 1.2], [0, 0, 0], 6), c: C.hoja })
  } else {
    p.push({ g: caja(0.06, 0.028, 0.055, [-0.012, 0.024, 0], [0, 0.3, 0]), c: C.choco })
    p.push({ g: eli(0.026, [0.01, 0.056, 0.004], [1, 0.85, 1], [0, 0, 0], 12), c: C.helado })
    p.push({ g: toro(0.02, 0.003, [0.004, 0.068, 0.004], [Math.PI / 2, 0, 0], Math.PI * 1.6, 12), c: "#3a1c0f" })
    p.push({ g: eli(0.006, [0.01, 0.082, 0.004], [1, 1, 1], [0, 0, 0], 6), c: C.cereza })
  }
}

function entradaEn(p: Parte[], tipo: Tipo) {
  plato(p, 0.11)
  if (tipo === "calamares") {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996
      const r = 0.06 * Math.sqrt((i + 0.5) / 9)
      p.push({ g: toro(0.016, 0.006, [Math.cos(a) * r, 0.02 + (i % 2) * 0.006, Math.sin(a) * r], [Math.PI / 2 + (i % 3) * 0.2, 0, a], Math.PI * 2, 12), c: "#e3b860" })
    }
    p.push({ g: cuencoMini(), c: C.crema })
  } else if (tipo === "croquetas") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      p.push({ g: capsulaEntre([Math.cos(a) * 0.04, 0.025, Math.sin(a) * 0.04], [Math.cos(a) * 0.075, 0.025, Math.sin(a) * 0.075], 0.013, 8), c: C.frito })
    }
    p.push({ g: eli(0.018, [0, 0.02, 0], [1, 0.6, 1], [0, 0, 0], 10), c: C.crema })
  } else if (tipo === "carpaccio") {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      p.push({ g: cilE(0.03, 0.03, 0.002, [Math.cos(a) * 0.05, 0.015 + i * 0.0003, Math.sin(a) * 0.05], [1, 1, 1], 14), c: "#e45a4c" })
    }
    for (let i = 0; i < 7; i++) p.push({ g: eli(0.012, [Math.cos(i) * 0.02, 0.022, Math.sin(i) * 0.02], [1.4, 0.3, 0.7], [0, i, 0], 6), c: C.hoja })
    for (let i = 0; i < 5; i++) p.push({ g: caja(0.014, 0.003, 0.008, [Math.cos(i * 1.4) * 0.045, 0.02, Math.sin(i * 1.4) * 0.045], [0, i, 0]), c: "#f6edc9" })
  } else if (tipo === "portobello") {
    p.push({ g: eli(0.05, [0, 0.02, 0], [1, 0.45, 1], [0, 0, 0], 16), c: C.hongo })
    p.push({ g: eli(0.04, [0, 0.032, 0], [1, 0.3, 1], [0, 0, 0], 12), c: "#f0d98c" })
    for (let i = 0; i < 4; i++) camaron(p, Math.cos(i * 1.57) * 0.03, 0.04, Math.sin(i * 1.57) * 0.03, i * 1.57, 0.016)
  } else if (tipo === "muelas") {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      p.push({ g: eli(0.022, [Math.cos(a) * 0.045, 0.026, Math.sin(a) * 0.045], [0.9, 0.65, 1.8], [0, -a, 0], 10), c: C.pinza })
      p.push({ g: eli(0.009, [Math.cos(a + 0.4) * 0.06, 0.024, Math.sin(a + 0.4) * 0.06], [0.9, 0.7, 2.6], [0, -a, 0], 8), c: C.langosta })
    }
    limon(p, 0, 0, 0.022)
  } else if (tipo === "risotto") {
    p.push({ g: eli(0.07, [0, 0.016, 0], [1, 0.28, 1], [0, 0, 0], 16), c: "#f1e2b8" })
    for (let i = 0; i < 5; i++) p.push({ g: caja(0.02, 0.01, 0.014, [Math.cos(i * 1.25) * 0.035, 0.034, Math.sin(i * 1.25) * 0.035], [0, i, 0]), c: C.res })
    perejil(p, [[0, 0], [0.02, 0.01]], 0.036)
  }
}

const cuencoMini = () => cilE(0.018, 0.014, 0.014, [0.06, 0.02, 0.06], [1, 1, 1], 12)

function geoTipo(tipo: Tipo) {
  return geoGuardada(`comida-${tipo}`, () => {
    const p: Parte[] = []
    switch (tipo) {
      case "langosta":
      case "langostaGratin":
        plato(p, 0.135, 1.42)
        langostaEn(p, tipo === "langostaGratin")
        limon(p, 0.095, -0.07)
        perejil(p, [[0.09, -0.11], [-0.09, -0.1], [-0.085, 0.07]])
        break
      case "cuencoLangosta":
        sopaEn(p, "#d4612f", "pinza")
        break
      case "paella":
      case "paellaGrande":
        paellaEn(p, tipo === "paella" ? 0.17 : 0.22, tipo === "paellaGrande")
        break
      case "pescado":
      case "pescadoCoco":
        pescadoEn(p, tipo === "pescadoCoco")
        break
      case "filete":
        plato(p)
        p.push({ g: eli(0.05, [-0.01, 0.022, 0], [1.6, 0.32, 0.8], [0, 0.2, 0], 14), c: "#f6ead2" })
        for (const d of [-0.04, -0.015, 0.01, 0.035]) p.push({ g: caja(0.004, 0.003, 0.06, [-0.01 + d, 0.038, 0], [0, 0.9, 0]), c: "#a8743a" })
        limon(p, 0.06, 0.06)
        arrozMini(p, 0.07, -0.04)
        perejil(p, [[-0.05, 0.06], [-0.07, -0.05]])
        break
      case "pulpo":
        pulpoEn(p)
        break
      case "camarones":
        camaronesEn(p, null)
        break
      case "camaronesSalsa":
        camaronesEn(p, "#f4d9a0")
        break
      case "langostinos":
        camaronesEn(p, null, true)
        break
      case "coctel":
        coctelEn(p, "#e0563c")
        break
      case "canoa":
      case "parrillada":
        bandejaMar(p, tipo === "canoa")
        break
      case "picadera":
        picaderaEn(p)
        break
      case "bistec":
      case "medallon":
        bistecEn(p, tipo === "medallon")
        break
      case "pollo":
      case "cordon":
        polloEn(p, tipo === "cordon")
        break
      case "pastaRoja":
        pastaEn(p, C.tomate, true)
        break
      case "pastaBlanca":
        pastaEn(p, C.crema, true)
        break
      case "pastaVerde":
        pastaEn(p, C.pesto, false)
        break
      case "sushi":
        sushiEn(p)
        break
      case "ensalada":
        ensaladaEn(p)
        break
      case "caprese":
        capreseEn(p)
        break
      case "sopa":
        sopaEn(p, C.sopa, "camaron")
        break
      case "crema":
        sopaEn(p, C.auyama, "crema")
        break
      case "tostones":
      case "papas":
      case "arroz":
      case "vegetales":
      case "pan":
        guarnicionEn(p, tipo)
        break
      case "pastel":
      case "selva":
      case "flan":
      case "brownie":
        postreEn(p, tipo)
        break
      default:
        entradaEn(p, tipo)
    }
    return unir(p)
  })
}

export type Unidad = { tipo: Tipo; x: number; y: number; z: number; rot: number; esc: number }
export type Hueco = { x: number; z: number; r: number }

const TAM = 1.25
const ALTO_PLATO = 0.79
const ALTO_MESA = 0.776

/** Reparte lo servido: cada plato frente a un comensal, lo de compartir al centro de la mesa. */
export function planComida(items: ItemPedido[], sitios: Sitio[], comensales: number, w: number, d: number) {
  const unidades: Unidad[] = []
  const huecos: Hueco[] = []
  const tipos = items.filter((i) => i.estado === "servido").flatMap((i) => Array.from({ length: Math.max(1, Math.round(i.cantidad)) }, () => tipoDe(i.platoId)))
  if (!tipos.length || !sitios.length) return { unidades, huecos }
  const n = Math.max(1, Math.min(sitios.length, comensales || sitios.length))
  const mesa = sitios.slice(0, n)
  const columnas = [...new Set(sitios.filter((s) => Math.abs(s.z) > 0.01).map((s) => +s.x.toFixed(3)))].sort((a, b) => a - b)
  const pz = d / 2 - 0.17
  const centros =
    columnas.length < 2
      ? [{ x: 0.24, r: 0.13 }, { x: -0.25, r: 0.11 }]
      : columnas.slice(1).map((c, i) => {
          const x = (c + columnas[i]) / 2
          return { x, r: Math.min(Math.hypot(x - columnas[i], pz) - 0.2, d / 2 - 0.04) }
        }).sort((a, b) => Math.abs(a.x) - Math.abs(b.x))
  const compartidos = tipos.filter((t) => COMPARTIDO[t])
  compartidos.slice(0, centros.length).forEach((t, i) => {
    const c = centros[i]
    const esc = Math.min(TAM, c.r / COMPARTIDO[t]!)
    unidades.push({ tipo: t, x: c.x, y: ALTO_MESA, z: 0, rot: 0.4 + i, esc })
    huecos.push({ x: c.x, z: 0, r: COMPARTIDO[t]! * esc })
  })
  const propios = tipos.filter((t) => !COMPARTIDO[t])
  const orden = [...propios.filter((t) => !ACOMPANA.has(t)), ...propios.filter((t) => ACOMPANA.has(t))]
  const SLOTS: [number, number, number][] = [[0, 0, TAM], [0.22, 0.1, TAM * 0.78], [-0.22, 0.1, TAM * 0.78], [0, 0.27, TAM * 0.7]]
  orden.slice(0, n * SLOTS.length).forEach((t, k) => {
    const s = mesa[k % n]
    const [lat, adelante, esc] = SLOTS[Math.floor(k / n)]
    const fx = Math.sin(s.rot)
    const fz = Math.cos(s.rot)
    const x = s.x + fx * (0.52 + adelante) + fz * lat
    const z = s.z + fz * (0.52 + adelante) - fx * lat
    unidades.push({ tipo: t, x, y: ALTO_PLATO, z, rot: s.rot + (t === "sushi" ? Math.PI / 2 : ALARGADO.has(t) ? Math.PI / 2 + 0.3 : 0.35), esc: ALARGADO.has(t) ? esc * 0.9 : esc })
  })
  return { unidades, huecos }
}

let matComida: THREE.MeshStandardMaterial | null = null
const brillo = { value: 0 }
function material() {
  if (matComida) return matComida
  matComida = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })
  matComida.onBeforeCompile = (s) => {
    s.uniforms.uBrillo = brillo
    s.fragmentShader = `uniform float uBrillo;\n${s.fragmentShader}`.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uBrillo;")
  }
  return matComida
}

const BRILLO = { dia: 0, dorada: 0.06, noche: 0.16 }

export function ComidaMesa({ unidades }: { unidades: Unidad[] }) {
  const { fase } = useEstilo()
  brillo.value = BRILLO[fase] ?? 0
  const clave = unidades.map((u) => `${u.tipo}:${u.x.toFixed(3)}:${u.z.toFixed(3)}:${u.esc.toFixed(2)}`).join("|")
  const g = useMemo(() => {
    if (!unidades.length) return null
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const eje = new THREE.Vector3(0, 1, 0)
    const gs = unidades.map((u) => {
      m.compose(new THREE.Vector3(u.x, u.y, u.z), q.setFromAxisAngle(eje, u.rot), new THREE.Vector3(u.esc, u.esc, u.esc))
      return geoTipo(u.tipo).clone().applyMatrix4(m)
    })
    const r = mergeGeometries(gs)
    gs.forEach((x) => x.dispose())
    r?.computeBoundingSphere()
    return r
  }, [clave])
  useEffect(() => () => g?.dispose(), [g])
  if (!g) return null
  return <mesh geometry={g} material={material()} castShadow />
}
