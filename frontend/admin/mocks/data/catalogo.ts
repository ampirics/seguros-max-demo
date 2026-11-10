import type { Pieza } from "./piezas"

// Catálogo de vehículos sembrado desde las piezas, como scripts/seed_catalogo_colt.py en el backend.

export interface VehiculoCatalogoMock {
  id: string
  marca: string
  modelo: string
  generacion: string | null
  anio_desde: number | null
  anio_hasta: number | null
  motor: string | null
  motor_codigo: string | null
  cilindrada: string | null
  combustible: string | null
  version: string | null
  transmision: string | null
  mercado: string | null
  fuente: "catalogo" | "vpic" | "manual" | "externa"
  estado: "propuesto" | "aprobado"
  propuesto_por: string | null
  aprobado_por: string | null
  aprobado_en: string | null
}

export interface RelacionMock {
  id: string
  pieza_id: string
  relacionada_id: string | null
  numero: string | null
  tipo: "reemplaza" | "kit" | "lado_opuesto" | "equivalente"
  nota: string | null
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function parsearMotor(texto: string | null) {
  const motor = texto && !sinAcentos(texto).startsWith("motor y trans") ? texto.trim() : null
  if (!motor) return { motor: null, motor_codigo: null, cilindrada: null, combustible: null, version: null }
  const codigo = /\b(\d[A-Z]\d{2}[A-Z]?)\b/.exec(motor.toUpperCase())?.[1]
    ?? motor.toUpperCase().split(/\s+/).find((p) => ["ALPHA", "BETA", "DELTA", "THETA", "LAMBDA", "MU"].includes(p)) ?? null
  const litros = /(\d[.,]\d)\s*litros?/i.exec(motor)?.[1]?.replace(",", ".")
  const cc = /(\d{3,4})\s*cc/i.exec(motor)?.[1]
  const corchetes = [...motor.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter((c) => !sinAcentos(c).includes("diesel"))
  return {
    motor,
    motor_codigo: codigo,
    cilindrada: litros ?? (cc ? (Number(cc) / 1000).toFixed(1) : null),
    combustible: sinAcentos(motor).includes("diesel") ? "diesel" : "gasolina",
    version: corchetes.join(", ") || /\b([SD]OHC(?:\s+\d+V)?)\b/i.exec(motor)?.[1]?.toUpperCase() || null,
  }
}

export function vehiculosCatalogoSeed(piezas: Pieza[]): VehiculoCatalogoMock[] {
  const filas = new Map<string, VehiculoCatalogoMock>()
  const ahora = new Date().toISOString()
  for (const p of piezas) {
    if (!p.vehiculo) continue
    const [desde, hasta] = p.vehiculo.anios.split("-").map(Number)
    const datos = parsearMotor(p.vehiculo.motor)
    const clave = [p.vehiculo.marca, p.vehiculo.modelo, desde, hasta, datos.motor ?? ""].join("|")
    if (filas.has(clave)) continue
    filas.set(clave, {
      id: `vc-${filas.size + 1}`, marca: p.vehiculo.marca, modelo: p.vehiculo.modelo, generacion: `${p.vehiculo.modelo} ${desde}-${hasta}`,
      anio_desde: desde || null, anio_hasta: hasta || null, ...datos, transmision: null, mercado: null, fuente: "catalogo", estado: "aprobado",
      propuesto_por: "catálogo de la tienda", aprobado_por: "catálogo de la tienda", aprobado_en: ahora,
    })
  }
  return [...filas.values()]
}

export const clavePieza = (p: Pieza) => {
  if (!p.vehiculo) return null
  const [desde, hasta] = p.vehiculo.anios.split("-").map(Number)
  return [p.vehiculo.marca, p.vehiculo.modelo, desde, hasta, parsearMotor(p.vehiculo.motor).motor ?? ""].join("|")
}

export const claveVehiculo = (v: VehiculoCatalogoMock) => [v.marca, v.modelo, v.anio_desde ?? NaN, v.anio_hasta ?? NaN, v.motor ?? ""].join("|")

export const VPIC_DEMO: Record<string, string[]> = {
  hyundai: ["Accent", "Azera", "Elantra", "Equus", "Genesis", "Santa Fe", "Sonata", "Tucson", "Veloster", "Veracruz"],
  mitsubishi: ["Eclipse", "Endeavor", "Galant", "Lancer", "Outlander", "Outlander Sport"],
  kia: ["Forte", "Optima", "Rio", "Sorento", "Soul", "Sportage"],
}
