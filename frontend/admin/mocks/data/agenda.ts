import { ADMIN_USER_ID } from "./common"

// Agenda: horario semanal por vendedor (bloques de 30 min) y citas de visita a la tienda o llamada.
// Fechas en hora de Santo Domingo (UTC-4, sin horario de verano).

export const SUCURSAL = "Villas Agrícolas"
export const BLOQUE_MIN = 30

export type Dia = 1 | 2 | 3 | 4 | 5 | 6 // lunes a sábado; domingo cerrado
export interface Turno { dia: Dia; desde: string; hasta: string }

export const YANELIS_ID = "u0170000-0000-4000-8000-000000000002"
export const LUIS_ID = "u0170000-0000-4000-8000-000000000003"

const semana = (desde: string, hasta: string, sabado?: [string, string]): Turno[] => [
  ...([1, 2, 3, 4, 5] as Dia[]).map((dia) => ({ dia, desde, hasta })),
  ...(sabado ? [{ dia: 6 as Dia, desde: sabado[0], hasta: sabado[1] }] : []),
]

export const vendedoresAgenda = [
  { id: YANELIS_ID, nombre: "Yanelis Guzmán", sucursal: SUCURSAL, horario: semana("08:00", "17:00", ["08:00", "13:00"]) },
  { id: LUIS_ID, nombre: "Luis Alberto Mercedes", sucursal: SUCURSAL, horario: semana("09:00", "18:00") },
  { id: ADMIN_USER_ID, nombre: "Cristian Sánchez", sucursal: SUCURSAL, horario: semana("08:00", "13:00", ["08:00", "13:00"]) },
]

// n-ésimo día de lunes a viernes desde hoy (0 = hoy, o el próximo si hoy es fin de semana), a la hora dada.
export function diaHabil(n: number, hora: string, base = new Date()) {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  const finDeSemana = () => d.getDay() === 0 || d.getDay() === 6
  while (finDeSemana()) d.setDate(d.getDate() + 1)
  const paso = n < 0 ? -1 : 1
  for (let i = 0; i < Math.abs(n); i++) {
    do d.setDate(d.getDate() + paso)
    while (finDeSemana())
  }
  const [h, m] = hora.split(":").map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

type Estado = "programada" | "completada" | "no_asistio" | "cancelada"

interface CitaSeed {
  id: string
  tipo: "visita" | "llamada"
  dia: number
  hora: string
  minutos?: number
  cliente: string
  cliente_id: string | null
  telefono: string
  vendedor_id: string
  motivo: string
  estado?: Estado
  origen: "whatsapp" | "llamada" | "mostrador" | "tienda_web" | "panel"
  conversacion_id?: string
  lead_id?: string
  recordatorio_enviado?: boolean
}

const SEED: CitaSeed[] = [
  { id: "cita_14", tipo: "llamada", dia: 0, hora: "11:30", cliente: "Taller Hnos. Peña", cliente_id: "cus-002", telefono: "809-555-0142", vendedor_id: ADMIN_USER_ID, motivo: "Acordar precio de taller por 4 juegos de bandas y despacho", origen: "whatsapp", conversacion_id: "conv-002", lead_id: "lead_30", recordatorio_enviado: true },
  { id: "cita_15", tipo: "visita", dia: 0, hora: "16:00", cliente: "Auto Servicio Bello", cliente_id: "cus-005", telefono: "809-555-0176", vendedor_id: LUIS_ID, motivo: "Retira 2 juegos de cables de bujía separados", origen: "whatsapp", conversacion_id: "conv-007", lead_id: "lead_25", recordatorio_enviado: true },
  { id: "cita_16", tipo: "llamada", dia: 0, hora: "17:00", cliente: "Ana Lucía Pimentel", cliente_id: null, telefono: "849-555-0172", vendedor_id: LUIS_ID, motivo: "Confirmar el año del Montero para el filtro de aire", origen: "tienda_web", lead_id: "lead_33" },
  { id: "cita_17", tipo: "llamada", dia: 1, hora: "10:00", cliente: "Carlos Encarnación", cliente_id: null, telefono: "809-555-0117", vendedor_id: YANELIS_ID, motivo: "Cotizar kit de embrague para H-1 2010", origen: "llamada", lead_id: "lead_32" },
  { id: "cita_18", tipo: "visita", dia: 1, hora: "09:30", cliente: "María Altagracia Fernández", cliente_id: "cus-004", telefono: "849-555-0121", vendedor_id: LUIS_ID, motivo: "Revisar el tensor de la correa de tiempo del Accent", origen: "whatsapp", conversacion_id: "conv-003", lead_id: "lead_29" },
  { id: "cita_19", tipo: "visita", dia: 2, hora: "11:00", cliente: "Mecánica Diesel Hnos. Mejía", cliente_id: "cus-008", telefono: "809-555-0198", vendedor_id: YANELIS_ID, motivo: "Ver alternativas de amortiguadores para el Montero 1998", origen: "llamada", minutos: 60, lead_id: "lead_22" },
  { id: "cita_12", tipo: "visita", dia: -2, hora: "10:00", cliente: "Ramón Antonio Tavárez", cliente_id: "cus-006", telefono: "829-555-0158", vendedor_id: YANELIS_ID, motivo: "Retirar cadena de tiempo y tensor separados", origen: "whatsapp", conversacion_id: "conv-005", lead_id: "lead_27", estado: "completada", recordatorio_enviado: true },
  { id: "cita_11", tipo: "visita", dia: -5, hora: "15:30", cliente: "Carolina Batista", cliente_id: "cus-010", telefono: "809-555-0109", vendedor_id: LUIS_ID, motivo: "Revisar el coil de ignición del Montero IO", origen: "llamada", lead_id: "lead_23", estado: "no_asistio", recordatorio_enviado: true },
]

export function buildCitas() {
  return SEED.map((c) => {
    const inicio = diaHabil(c.dia, c.hora)
    const fin = new Date(inicio.getTime() + (c.minutos ?? BLOQUE_MIN) * 60000)
    return {
      id: c.id,
      tipo: c.tipo,
      estado: c.estado ?? "programada",
      cliente: c.cliente,
      cliente_id: c.cliente_id,
      telefono: c.telefono,
      vendedor_id: c.vendedor_id,
      vendedor: vendedoresAgenda.find((v) => v.id === c.vendedor_id)!.nombre,
      sucursal: SUCURSAL,
      motivo: c.motivo,
      origen: c.origen,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      conversacion_id: c.conversacion_id ?? null,
      lead_id: c.lead_id ?? null,
      vehiculo_id: null as string | null,
      google_event_id: null as string | null,
      recordatorio_enviado: !!c.recordatorio_enviado,
    }
  })
}

export type CitaMock = ReturnType<typeof buildCitas>[number]
