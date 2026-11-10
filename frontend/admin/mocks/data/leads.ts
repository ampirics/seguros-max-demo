import { DAY, HOUR, MINUTE } from "./common"

// Oportunidades: solo lo que tiene intención comercial (docs/05). Origen, responsable y vendedor de cierre van aparte.
// El monto no se guarda: sale de la cotización o la orden enlazada.

export type Etapa = "nueva" | "en_atencion" | "pendiente_datos" | "cotizada" | "ganada" | "perdida"
export type MotivoPerdida = "precio" | "sin_existencia" | "tiempo_entrega" | "compro_en_otro_lado" | "no_responde" | "otro"

export const ETAPAS_ABIERTAS: Etapa[] = ["nueva", "en_atencion", "pendiente_datos"]
export const MOTIVOS: MotivoPerdida[] = ["precio", "sin_existencia", "tiempo_entrega", "compro_en_otro_lado", "no_responde", "otro"]
export const SLA_MIN = 30

interface LeadSeed {
  id: string
  hace: number
  cliente: string
  cliente_id: string | null
  telefono: string
  interes: string
  etapa: Etapa
  origen: "whatsapp" | "llamada" | "mostrador" | "tienda_web"
  responsable: string
  vendedor_cierre?: string | null
  motivo_perdida?: MotivoPerdida | null
  nota_perdida?: string | null
  conversacion_id?: string | null
  cotizacion_codigo?: string | null
  orden_id?: string | null
  vehiculo_id?: string | null
}

const IA = "Asistente IA"

const SEED: LeadSeed[] = [
  { id: "lead_33", hace: 50 * MINUTE, cliente: "Ana Lucía Pimentel", cliente_id: null, telefono: "849-555-0172", interes: "Filtro de aire para Montero; no dijo el año", etapa: "pendiente_datos", origen: "tienda_web", responsable: "Luis Alberto Mercedes" },
  { id: "lead_32", hace: 6 * MINUTE, cliente: "Carlos Encarnación", cliente_id: null, telefono: "809-555-0117", interes: "Kit de embrague para H-1 2010", etapa: "nueva", origen: "llamada", responsable: "Sin asignar" },
  { id: "lead_31", hace: 14 * MINUTE, cliente: "José Miguel Rosario", cliente_id: "cus-001", telefono: "829-555-0193", interes: "Amortiguadores delanteros", etapa: "en_atencion", origen: "whatsapp", responsable: IA, conversacion_id: "conv-001", cotizacion_codigo: "COT-0412", vehiculo_id: "veh_1" },
  { id: "lead_30", hace: 5 * DAY, cliente: "Taller Hnos. Peña", cliente_id: "cus-002", telefono: "809-555-0142", interes: "4 juegos de bandas delanteras, precio de taller", etapa: "cotizada", origen: "whatsapp", responsable: "Yanelis Guzmán", conversacion_id: "conv-002", cotizacion_codigo: "COT-0405", vehiculo_id: "veh_2" },
  { id: "lead_29", hace: 9 * MINUTE, cliente: "María Altagracia Fernández", cliente_id: "cus-004", telefono: "849-555-0121", interes: "Tensor de la correa de tiempo", etapa: "en_atencion", origen: "whatsapp", responsable: IA, conversacion_id: "conv-003", vehiculo_id: "veh_3" },
  { id: "lead_28", hace: 3 * HOUR, cliente: "Repuestos El Cibao", cliente_id: "cus-003", telefono: "809-555-0187", interes: "Filtros de aceite al por mayor", etapa: "ganada", origen: "whatsapp", responsable: "Cristian Sánchez", vendedor_cierre: "Cristian Sánchez", conversacion_id: "conv-004", cotizacion_codigo: "COT-0409" },
  { id: "lead_27", hace: 2 * DAY + 3 * HOUR, cliente: "Ramón Antonio Tavárez", cliente_id: "cus-006", telefono: "829-555-0158", interes: "Cadena de tiempo y tensor", etapa: "ganada", origen: "whatsapp", responsable: IA, vendedor_cierre: "Yanelis Guzmán", conversacion_id: "conv-005", cotizacion_codigo: "COT-0398", vehiculo_id: "veh_5" },
  { id: "lead_26", hace: 5 * DAY, cliente: "Yokasta Peralta", cliente_id: "cus-007", telefono: "849-555-0134", interes: "Batería con delivery", etapa: "ganada", origen: "whatsapp", responsable: IA, vendedor_cierre: "Yanelis Guzmán", conversacion_id: "conv-006", orden_id: "ord-1045", vehiculo_id: "veh_6" },
  { id: "lead_25", hace: 70 * MINUTE, cliente: "Auto Servicio Bello", cliente_id: "cus-005", telefono: "809-555-0176", interes: "2 juegos de cables de bujía, retira en la tarde", etapa: "en_atencion", origen: "whatsapp", responsable: IA, conversacion_id: "conv-007", vehiculo_id: "veh_7" },
  { id: "lead_24", hace: 4 * HOUR, cliente: "Franklin De los Santos", cliente_id: "cus-009", telefono: "829-555-0165", interes: "Bomba de gasolina", etapa: "perdida", origen: "whatsapp", responsable: IA, motivo_perdida: "sin_existencia", conversacion_id: "conv-008", vehiculo_id: "veh_8" },
  { id: "lead_23", hace: 12 * DAY, cliente: "Carolina Batista", cliente_id: "cus-010", telefono: "809-555-0109", interes: "Coil de ignición", etapa: "perdida", origen: "llamada", responsable: "Luis Alberto Mercedes", motivo_perdida: "no_responde", nota_perdida: "La cotización venció sin respuesta.", cotizacion_codigo: "COT-0391", vehiculo_id: "veh_10" },
  { id: "lead_22", hace: 9 * DAY, cliente: "Mecánica Diesel Hnos. Mejía", cliente_id: "cus-008", telefono: "809-555-0198", interes: "2 amortiguadores delanteros Kayaba", etapa: "perdida", origen: "mostrador", responsable: "Luis Alberto Mercedes", motivo_perdida: "precio", nota_perdida: "Consiguió unos alternos más baratos.", cotizacion_codigo: "COT-0388", vehiculo_id: "veh_9" },
]

export function buildLeads() {
  return SEED.map(({ hace, ...l }) => {
    const creado = Date.now() - hace
    return {
      vendedor_cierre: null,
      motivo_perdida: null,
      nota_perdida: null,
      conversacion_id: null,
      cotizacion_codigo: null,
      orden_id: null,
      vehiculo_id: null,
      ...l,
      creado: new Date(creado).toISOString(),
      sla_vence: new Date(creado + SLA_MIN * MINUTE).toISOString(),
      actualizado: new Date(creado).toISOString(),
    }
  })
}

export type LeadMock = ReturnType<typeof buildLeads>[number]
