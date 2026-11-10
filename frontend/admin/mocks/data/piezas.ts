import type { ColtProduct } from "./products"
import { coltImage } from "./products"

// Convierte el catálogo real de Colt en piezas con compatibilidad (fitment).
// La ruta del catálogo es irregular ("Tucson 10 (2009-2013)", "Endeavor 2003 - Adelante",
// "Montero 1992-2000 DIESEL"); aquí se normaliza a marca, modelo, años, motor y sistema.

const ANIO_ACTUAL = new Date().getFullYear()
const ORIGINALES = ["MITSUBISHI", "HYUNDAI", "MOBIS", "KIA", "GENUINE PARTS"]

export const SISTEMAS = [
  { clave: "motor", nombre: "Motor y transmisión" },
  { clave: "correas", nombre: "Correas, filtros y cables" },
  { clave: "tren_delantero", nombre: "Tren delantero" },
  { clave: "tren_trasero", nombre: "Tren trasero" },
] as const

// Dibujo de referencia por modelo; las zonas van en fracciones del dibujo lateral (20:9, frente a la izquierda).
type Carroceria = "sedan" | "yipeta" | "camioneta" | "van"
const CARROCERIA: Record<string, Carroceria> = {
  Lancer: "sedan", Galant: "sedan", Accent: "sedan", Elantra: "sedan", Sonata: "sedan",
  L200: "camioneta", "H-1": "van", H100: "van", L300: "van",
}
// Zonas medidas sobre public/vehiculos/<carroceria>.svg (vista lateral, frente a la izquierda).
type Zona = { x: number; y: number; w: number; h: number }
const ZONAS: Record<Carroceria, Record<string, Zona>> = {
  sedan: {
    motor: { x: 0.052, y: 0.55, w: 0.15, h: 0.13 },
    correas: { x: 0.238, y: 0.55, w: 0.082, h: 0.13 },
    tren_delantero: { x: 0.121, y: 0.642, w: 0.165, h: 0.358 },
    tren_trasero: { x: 0.701, y: 0.642, w: 0.165, h: 0.358 },
  },
  yipeta: {
    motor: { x: 0.052, y: 0.446, w: 0.149, h: 0.174 },
    correas: { x: 0.238, y: 0.446, w: 0.086, h: 0.174 },
    tren_delantero: { x: 0.117, y: 0.62, w: 0.171, h: 0.38 },
    tren_trasero: { x: 0.673, y: 0.62, w: 0.171, h: 0.38 },
  },
  camioneta: {
    motor: { x: 0.05, y: 0.542, w: 0.128, h: 0.143 },
    correas: { x: 0.209, y: 0.542, w: 0.07, h: 0.143 },
    tren_delantero: { x: 0.109, y: 0.685, w: 0.141, h: 0.312 },
    tren_trasero: { x: 0.664, y: 0.685, w: 0.141, h: 0.312 },
  },
  van: {
    motor: { x: 0.051, y: 0.501, w: 0.141, h: 0.157 },
    correas: { x: 0.225, y: 0.501, w: 0.077, h: 0.157 },
    tren_delantero: { x: 0.116, y: 0.657, w: 0.154, h: 0.342 },
    tren_trasero: { x: 0.698, y: 0.657, w: 0.154, h: 0.342 },
  },
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

export interface Vehiculo {
  marca: string
  modelo: string
  desde: number
  hasta: number
  motor: string | null
}

function vehiculoDe(ruta: string[]): Vehiculo | null {
  const [marca, ...resto] = ruta
  if (!marca || norm(marca).startsWith("productos genericos")) return null
  let modelo = ""
  let desde = 0
  let hasta = 0
  let diesel = false
  for (const seg of resto) {
    const m = /^(.+?)(?:\s+\d{2}(?=\s+\())?\s+\(?\s*(\d{4})\s*(?:-\s*(\d{4}|adelante))?\s*\)?\s*(diesel)?$/i.exec(seg)
    if (m && m[1]) {
      modelo = m[1].trim()
      desde = Number(m[2])
      hasta = !m[3] ? desde : /adelante/i.test(m[3]) ? ANIO_ACTUAL : Number(m[3])
      diesel = !!m[4]
      break
    }
  }
  if (!modelo) return null
  const motorSeg = resto.find((s) => s.startsWith("Motor:"))
  const motor = motorSeg ? motorSeg.replace(/^Motor:\s*/, "").trim() : diesel ? "Diesel" : null
  return { marca, modelo, desde, hasta, motor }
}

function sistemaDe(ruta: string[]): string {
  for (const seg of [...ruta].reverse()) {
    const s = norm(seg)
    if (s.includes("delanter")) return "Tren delantero"
    if (s.includes("traser")) return "Tren trasero"
    if (s.includes("motor y trans")) return "Motor y transmisión"
    if (s.includes("correa") || s.includes("filtro")) return "Correas, filtros y cables"
  }
  return ruta[0] && norm(ruta[0]).startsWith("productos genericos") && ruta[1] ? ruta[1] : "Otros"
}

function posicionDe(nombre: string): string | null {
  const n = norm(nombre)
  const eje = /delanter/.test(n) ? "delantera" : /traser/.test(n) ? "trasera" : ""
  const lado = /\(lh\/rh\)/.test(n) ? "ambos lados" : /\(lh\)/.test(n) ? "izquierda" : /\(rh\)/.test(n) ? "derecha" : ""
  return [eje, lado].filter(Boolean).join(" ") || null
}

const oemDe = (nombre: string, mpn: string) => /\s([A-Z0-9][A-Z0-9-]{3,})\s*-\s*[^-]+$/i.exec(nombre)?.[1] ?? mpn

export function toPieza(p: ColtProduct) {
  const v = vehiculoDe(p.ruta || [])
  const fabricante = (p.marca || "").trim() || "Sin marca"
  return {
    id: p.id,
    sku: p.sku,
    nombre: p.nombre.trim(),
    oem: oemDe(p.nombre.trim(), p.mpn),
    mpn: p.mpn,
    fabricante,
    condicion: ORIGINALES.includes(fabricante.toUpperCase()) ? "original" : "alterna",
    sistema: sistemaDe(p.ruta || []),
    posicion: posicionDe(p.nombre),
    precio_dop: p.precio_dop,
    disponible: p.disponible === 1,
    imagen: p.imagenes?.[0] ? coltImage(p.imagenes[0]) : null,
    vehiculo: v ? { marca: v.marca, modelo: v.modelo, anios: `${v.desde}-${v.hasta}`, motor: v.motor } : null,
  }
}

export type Pieza = ReturnType<typeof toPieza>

const sistemaClave = (nombre: string) => SISTEMAS.find((s) => s.nombre === nombre)?.clave ?? null

function aplica(p: Pieza, f: { marca?: string | null; modelo?: string | null; anio?: number | null }) {
  if (!f.marca && !f.modelo && !f.anio) return true
  if (!p.vehiculo) return false
  if (f.marca && norm(p.vehiculo.marca) !== norm(f.marca)) return false
  if (f.modelo && !norm(p.vehiculo.modelo).startsWith(norm(f.modelo))) return false
  if (f.anio) {
    const [desde, hasta] = p.vehiculo.anios.split("-").map(Number)
    if (f.anio < desde || f.anio > hasta) return false
  }
  return true
}

export function vehiculosDelCatalogo(piezas: Pieza[]) {
  const map = new Map<string, { marca: string; modelo: string; desde: number; hasta: number }>()
  for (const p of piezas) {
    if (!p.vehiculo) continue
    const key = `${p.vehiculo.marca}|${p.vehiculo.modelo}`
    const [desde, hasta] = p.vehiculo.anios.split("-").map(Number)
    const prev = map.get(key)
    map.set(key, prev ? { ...prev, desde: Math.min(prev.desde, desde), hasta: Math.max(prev.hasta, hasta) } : { marca: p.vehiculo.marca, modelo: p.vehiculo.modelo, desde, hasta })
  }
  return [...map.values()].sort((a, b) => a.marca.localeCompare(b.marca) || a.modelo.localeCompare(b.modelo))
}

// VIN: fabricante por WMI y año por el carácter 10. El modelo no se puede deducir sin un decodificador real.
const WMI: Record<string, string> = { KMH: "Hyundai", KM8: "Hyundai", KMF: "Hyundai", JA3: "Mitsubishi", JA4: "Mitsubishi", JMY: "Mitsubishi", MMB: "Mitsubishi", ML3: "Mitsubishi", KNA: "Kia", KND: "Kia" }
const ANIO_VIN = "ABCDEFGHJKLMNPRSTVWXY123456789"
function decodificarVin(vin: string) {
  const marca = WMI[vin.slice(0, 3)]
  const i = ANIO_VIN.indexOf(vin[9])
  if (!marca || i < 0) return null
  let anio = 2010 + i
  if (anio > ANIO_ACTUAL + 1) anio -= 30
  return { marca, anio }
}

const STOP = new Set(["de", "del", "la", "el", "los", "las", "para", "un", "una", "mi", "me", "y", "con", "tienen", "tiene", "necesito", "busco", "quiero", "precio", "hay"])
const SINONIMOS: Record<string, string> = { pastilla: "banda", tiempo: "distribuci" }
const raiz = (t: string) => {
  const r = t.length > 5 && t.endsWith("es") ? t.slice(0, -2) : t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t
  return SINONIMOS[r] ?? r
}

export interface FiltroBusqueda {
  q?: string | null
  marca?: string | null
  modelo?: string | null
  anio?: number | null
  sistema?: string | null
  vin?: string | null
  sort?: string | null
}

export function buscarPiezas(piezas: Pieza[], f: FiltroBusqueda) {
  const vehiculos = vehiculosDelCatalogo(piezas)
  let { marca = null, modelo = null, anio = null } = f
  let texto = norm(f.q)
  const vin = (f.vin || (/^[A-HJ-NPR-Z0-9]{17}$/i.test(f.q?.trim() ?? "") ? f.q!.trim() : "")).toUpperCase()
  if (vin) {
    const d = decodificarVin(vin)
    if (d) ({ marca, anio } = { marca: marca ?? d.marca, anio: anio ?? d.anio })
    texto = ""
  }
  if (!modelo) {
    const hit = [...vehiculos].sort((a, b) => b.modelo.length - a.modelo.length).find((v) => texto.includes(norm(v.modelo)))
    if (hit) {
      modelo = hit.modelo
      marca = marca ?? hit.marca
      texto = texto.replace(norm(hit.modelo), " ")
    }
  }
  const tokens: string[] = []
  for (const t of texto.split(/[\s,]+/).filter(Boolean)) {
    if (["mitsubishi", "hyundai", "kia"].includes(t)) marca = marca ?? t[0].toUpperCase() + t.slice(1)
    else if (/^(19|20)\d{2}$/.test(t)) anio = anio ?? Number(t)
    else if (/^\d{2}$/.test(t) && modelo) anio = anio ?? (Number(t) > 30 ? 1900 : 2000) + Number(t)
    else if (!STOP.has(t)) tokens.push(raiz(t))
  }
  const sistema = f.sistema ? SISTEMAS.find((s) => s.clave === f.sistema)?.nombre ?? f.sistema : null
  let items = piezas.filter((p) => {
    if (sistema && p.sistema !== sistema) return false
    if (!aplica(p, { marca, modelo, anio })) return false
    const campo = norm(`${p.nombre} ${p.sku} ${p.oem} ${p.mpn} ${p.fabricante} ${p.sistema}`)
    return tokens.every((t) => campo.includes(t))
  })
  if (f.sort === "precio") items = items.slice().sort((a, b) => a.precio_dop - b.precio_dop)
  else if (f.sort === "-precio") items = items.slice().sort((a, b) => b.precio_dop - a.precio_dop)
  else if (f.sort === "nombre") items = items.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  else items = items.slice().sort((a, b) => Number(!a.disponible) - Number(!b.disponible) || Number(!a.imagen) - Number(!b.imagen))
  const detectado = marca || modelo || anio
    ? { marca, modelo, anio, ...(vin ? { vin } : {}) }
    : null
  return { items, vehiculo_detectado: detectado }
}

function ubicacion(id: number) {
  return `${"ABCDEF"[id % 6]}-${String((id % 20) + 1).padStart(2, "0")}-${(id % 5) + 1}`
}

const ladoOpuesto = (nombre: string) =>
  /\(LH\)/.test(nombre) ? nombre.replace("(LH)", "(RH)") : /\(RH\)/.test(nombre) ? nombre.replace("(RH)", "(LH)") : null

export function fichaPieza(piezas: Pieza[], catalogo: ColtProduct[], id: number) {
  const pieza = piezas.find((p) => p.id === id)
  const raw = catalogo.find((p) => p.id === id)
  if (!pieza || !raw) return null
  const opuesto = ladoOpuesto(pieza.nombre)
  const prefijoOpuesto = opuesto?.split(/\s[A-Z0-9-]{4,}\s*-/)[0]
  const equivalencias = piezas
    .filter((p) => p.id !== id)
    .flatMap((p) => {
      if (p.oem === pieza.oem) return [{ ...p, relacion: p.condicion === "original" ? "oem_equivalente" : "alterna" }]
      if (prefijoOpuesto && p.nombre.startsWith(prefijoOpuesto) && p.vehiculo?.modelo === pieza.vehiculo?.modelo && p.vehiculo?.anios === pieza.vehiculo?.anios)
        return [{ ...p, relacion: "lado_opuesto" }]
      return []
    })
    .map((p) => ({ id: p.id, nombre: p.nombre, relacion: p.relacion, fabricante: p.fabricante, precio_dop: p.precio_dop, disponible: p.disponible, imagen: p.imagen }))
  return {
    ...pieza,
    compatibilidad: pieza.vehiculo ? [pieza.vehiculo] : [],
    equivalencias,
    existencia: [{ sucursal: "Villas Agrícolas", cantidad: pieza.disponible ? 1 + (id % 12) : 0, ubicacion: ubicacion(id) }],
    precio_mayoreo_dop: null,
    garantia: null,
    imagenes: (raw.imagenes || []).map(coltImage),
    url: raw.url,
  }
}

export function diagrama(piezas: Pieza[], v: { marca?: string | null; modelo?: string | null; anio?: number | null }) {
  const delVehiculo = piezas.filter((p) => aplica(p, v))
  const carroceria = (v.modelo && CARROCERIA[v.modelo]) || "yipeta"
  const zonas = ZONAS[carroceria]
  return {
    carroceria,
    sistemas: SISTEMAS.map((s) => ({ ...s, zona: zonas[s.clave], total_piezas: delVehiculo.filter((p) => sistemaClave(p.sistema) === s.clave).length })),
  }
}
