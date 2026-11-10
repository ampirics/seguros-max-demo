import { DAY } from "./common"

// Vehículos de clientes. Los ids coinciden con conversaciones (vehiculo.id) y cotizaciones (vehiculo_id).
// `historial` son atenciones que no salen de otro módulo (mostrador, llamadas, notas, citas); las de WhatsApp,
// cotizaciones y órdenes se arman en el handler. `piezas` son [id del catálogo, cantidad]: nombre y precio salen de ahí.
// `servicios` es el kilometraje del último servicio registrado, para el plan de mantenimiento.

export type Canal = "whatsapp" | "llamada" | "mostrador" | "tienda_web"
export type TipoEvento = "consulta" | "cotizacion" | "venta" | "nota" | "cita"
export type Servicio = "aceite" | "aire" | "frenos" | "distribucion"

interface EventoSeed {
  hace: number
  canal: Canal
  atendio: string
  tipo: TipoEvento
  detalle?: string
  piezas?: [number, number][]
  km?: number
}

export interface VehiculoSeed {
  id: string
  cliente_id: string
  marca: string
  modelo: string
  anio: number
  motor: string
  vin: string
  placa: string
  kilometraje: number
  servicios: Partial<Record<Servicio, number>>
  historial: EventoSeed[]
}

const YANELIS = "Yanelis Guzmán"
const LUIS = "Luis Alberto Mercedes"
const CRISTIAN = "Cristian Sánchez"

export const vehiculos: VehiculoSeed[] = [
  {
    id: "veh_1", cliente_id: "cus-001", marca: "Hyundai", modelo: "Tucson", anio: 2012, motor: "2.0 Litros",
    vin: "KM8JU3AC5CU438127", placa: "G418273", kilometraje: 148000,
    servicios: { aceite: 142000 },
    historial: [
      { hace: 40 * DAY, canal: "llamada", atendio: YANELIS, tipo: "consulta", detalle: "Preguntó precio de amortiguadores delanteros; dijo que escribía por WhatsApp" },
      { hace: 120 * DAY, canal: "mostrador", atendio: CRISTIAN, tipo: "nota", detalle: "Cambio de aceite hecho en otro taller a 142,000 km", km: 142000 },
    ],
  },
  {
    id: "veh_2", cliente_id: "cus-002", marca: "Mitsubishi", modelo: "L200", anio: 2003, motor: "2.0 Litros - 4G63",
    vin: "MMBJNK7403D021954", placa: "L307711", kilometraje: 196000,
    servicios: { aire: 180000, distribucion: 150000 },
    historial: [
      { hace: 60 * DAY, canal: "mostrador", atendio: LUIS, tipo: "venta", piezas: [[129, 1]], km: 180000 },
      { hace: 200 * DAY, canal: "mostrador", atendio: CRISTIAN, tipo: "venta", piezas: [[98, 1]], km: 150000 },
    ],
  },
  {
    id: "veh_11", cliente_id: "cus-002", marca: "Mitsubishi", modelo: "Montero Sport-Nativa", anio: 2005, motor: "3.0 Litros - 6G72",
    vin: "JA4MT31R85J004618", placa: "G209548", kilometraje: 241000,
    servicios: {},
    historial: [
      { hace: 15 * DAY, canal: "llamada", atendio: YANELIS, tipo: "venta", detalle: "Pidió cables de bujía para un cliente del taller", piezas: [[280, 1]] },
    ],
  },
  {
    id: "veh_3", cliente_id: "cus-004", marca: "Hyundai", modelo: "Accent", anio: 2008, motor: "1.6 Litros",
    vin: "KMHCN46C88U251873", placa: "A512390", kilometraje: 131000,
    servicios: { aire: 118000 },
    historial: [
      { hace: 90 * DAY, canal: "mostrador", atendio: LUIS, tipo: "venta", piezas: [[316, 1]], km: 118000 },
    ],
  },
  {
    id: "veh_5", cliente_id: "cus-006", marca: "Mitsubishi", modelo: "Montero", anio: 2005, motor: "2.8 Litros Diesel",
    vin: "JMYLRV7305J000731", placa: "G118842", kilometraje: 210500,
    servicios: { distribucion: 210000 },
    historial: [],
  },
  {
    id: "veh_6", cliente_id: "cus-007", marca: "Kia", modelo: "Sportage", anio: 2014, motor: "2.4 Litros",
    vin: "KNDPB3AC9E7562214", placa: "G455016", kilometraje: 98000,
    servicios: {},
    historial: [],
  },
  {
    id: "veh_7", cliente_id: "cus-005", marca: "Hyundai", modelo: "Santa Fe", anio: 2004, motor: "2.7 Litros V6",
    vin: "KM8SC73E24U659328", placa: "G093361", kilometraje: 228000,
    servicios: { distribucion: 165000 },
    historial: [
      { hace: 300 * DAY, canal: "mostrador", atendio: CRISTIAN, tipo: "venta", piezas: [[662, 1]], km: 165000 },
    ],
  },
  {
    id: "veh_8", cliente_id: "cus-009", marca: "Mitsubishi", modelo: "Lancer", anio: 1998, motor: "1.8 Litros",
    vin: "JA3AY26C1WU017452", placa: "A201117", kilometraje: 349000,
    servicios: { distribucion: 252000 },
    historial: [
      { hace: 400 * DAY, canal: "mostrador", atendio: LUIS, tipo: "venta", piezas: [[144, 1]], km: 252000 },
    ],
  },
  {
    id: "veh_9", cliente_id: "cus-008", marca: "Mitsubishi", modelo: "Montero", anio: 1998, motor: "2.8 Litros Diesel",
    vin: "JMYORV43WWJ000389", placa: "G070214", kilometraje: 306500,
    servicios: { aceite: 302000 },
    historial: [
      { hace: 30 * DAY, canal: "tienda_web", atendio: "Tienda en línea", tipo: "venta", piezas: [[552, 2]], km: 302000 },
    ],
  },
  {
    id: "veh_10", cliente_id: "cus-010", marca: "Mitsubishi", modelo: "Montero IO", anio: 2001, motor: "1.8 Litros",
    vin: "JMYHPH77W1J000925", placa: "G166054", kilometraje: 187000,
    servicios: {},
    historial: [
      { hace: 10 * DAY, canal: "llamada", atendio: LUIS, tipo: "consulta", detalle: "Llamó para agendar una visita y revisar el coil de ignición" },
    ],
  },
]

// Intervalos generales; el panel aclara que se confirman con el manual del vehículo.
export const REGLAS_MANTENIMIENTO: { clave: Servicio; descripcion: string; cada_km: number; buscar: string[] }[] = [
  { clave: "aceite", descripcion: "Cambio de aceite y filtro", cada_km: 5000, buscar: ["filtro de aceite"] },
  { clave: "aire", descripcion: "Cambio de filtro de aire", cada_km: 15000, buscar: ["filtro de aire"] },
  { clave: "frenos", descripcion: "Revisión de bandas de freno delanteras", cada_km: 20000, buscar: ["bandas delanteras"] },
  { clave: "distribucion", descripcion: "Cambio de correa o cadena de distribución", cada_km: 90000, buscar: ["correa distribución", "cadena distribución"] },
]
