import { DIA, ETAPAS } from "@/lib/seguros/catalogo"
import type { CotizacionAseguradora, Etapa, Oportunidad, Ramo } from "@/lib/seguros/tipos"

export const ETAPAS_ABIERTAS = ETAPAS.filter((e) => e.abierta)
export const abierta = (e: Etapa) => ETAPAS_ABIERTAS.some((x) => x.id === e)

export const COBERTURAS_RAMO: Record<Ramo, string[]> = {
  vehiculo: ["Daños propios", "Responsabilidad civil", "Robo", "Rotura de cristales", "Asistencia vial", "Auto sustituto", "Fianza judicial"],
  salud: ["Hospitalización", "Consultas", "Emergencias", "Maternidad", "Medicamentos ambulatorios", "Cobertura internacional"],
  vida: ["Muerte por cualquier causa", "Invalidez total y permanente", "Enfermedades graves", "Gastos funerarios"],
  hogar: ["Incendio", "Terremoto", "Huracán", "Inundación", "Robo de contenido", "Responsabilidad civil familiar"],
  viaje: ["Gastos médicos", "Equipaje", "Cancelación de viaje", "Repatriación"],
  accidentes: ["Muerte accidental", "Incapacidad", "Gastos médicos por accidente"],
  incendio: ["Incendio", "Terremoto", "Huracán", "Interrupción de negocio", "Remoción de escombros"],
  responsabilidad_civil: ["Daños a terceros", "Gastos de defensa", "Responsabilidad de productos"],
  transporte: ["Pérdida total", "Avería particular", "Robo en tránsito", "Carga y descarga"],
  fianzas: ["Cumplimiento", "Anticipo", "Calidad de obra"],
  colectivo: ["Salud local", "Salud internacional", "Vida colectiva", "Maternidad"],
  maquinaria: ["Rotura de maquinaria", "Daño eléctrico", "Equipos móviles", "Montaje"],
}

export const PRIMA_REFERENCIA: Record<Ramo, number> = {
  vehiculo: 52000,
  salud: 165000,
  vida: 42000,
  hogar: 21000,
  viaje: 7800,
  accidentes: 11000,
  incendio: 520000,
  responsabilidad_civil: 190000,
  transporte: 310000,
  fianzas: 95000,
  colectivo: 1650000,
  maquinaria: 360000,
}

export const DEDUCIBLES: Record<"vehiculo" | "persona" | "empresa", string[]> = {
  vehiculo: ["1 % del valor, mínimo RD$ 10,000", "RD$ 15,000 por evento", "2 % del valor asegurado"],
  persona: ["RD$ 5,000 por evento", "Sin deducible en red", "10 % por reclamación"],
  empresa: ["2 % de la pérdida, mínimo RD$ 50,000", "RD$ 75,000 por evento"],
}

export const MOTIVOS_PERDIDA = ["Eligió otra opción por precio", "Renovó con su corredor anterior", "Dejó de responder", "Pospuso la compra", "No calificaba para el producto", "Lo resolvió con el banco del préstamo"]

export const recomendada = (cs: CotizacionAseguradora[]) => cs.find((c) => c.recomendada) ?? cs[0]
export const primaPotencial = (o: Oportunidad) => (o.cotizaciones.length ? recomendada(o.cotizaciones)?.prima ?? 0 : 0)
export const vencida = (o: Oportunidad, ahora: number) => !!o.siguiente && o.siguiente.vence < ahora

export function mediana(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 }
export function ordenTablero(ahora: number) {
  return (a: Oportunidad, b: Oportunidad) => Number(vencida(b, ahora)) - Number(vencida(a, ahora)) || PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad] || b.actualizada - a.actualizada
}

export const VENTANA_LISTA = 120 * DIA
