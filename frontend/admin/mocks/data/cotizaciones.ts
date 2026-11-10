import { ADMIN_USER_ID, DAY, HOUR, MINUTE } from "./common"
import { ITBIS_RATE, round2 } from "./orders"
import { REF, type ProductRef } from "./products"

const item = (r: ProductRef, cantidad: number) => ({
  pieza_id: Number(r.id),
  descripcion: r.name,
  cantidad,
  precio_dop: r.price,
})

type Item = ReturnType<typeof item>

const IA = { id: null, nombre: "Asistente IA" }
const CRISTIAN = { id: ADMIN_USER_ID, nombre: "Cristian Sánchez" }
const YANELIS = { id: "u0170000-0000-4000-8000-000000000002", nombre: "Yanelis Guzmán" }
const LUIS = { id: "u0170000-0000-4000-8000-000000000003", nombre: "Luis Alberto Mercedes" }

// Pendiente con Colt: si el catálogo ya incluye ITBIS. Por ahora igual que órdenes y links de pago: se suma encima.
export const PRECIOS_INCLUYEN_ITBIS = false

export const precioSinItbis = (precio: number) => (PRECIOS_INCLUYEN_ITBIS ? round2(precio / (1 + ITBIS_RATE)) : precio)

export function totales(items: Item[]) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.cantidad * i.precio_dop, 0))
  const itbis = PRECIOS_INCLUYEN_ITBIS ? 0 : round2(subtotal * ITBIS_RATE)
  return { subtotal_dop: subtotal, itbis_dop: itbis, total_dop: round2(subtotal + itbis), precios_incluyen_itbis: PRECIOS_INCLUYEN_ITBIS }
}

function cotizacion(o: {
  codigo: string
  version?: number
  estado: string
  hace: number
  cliente: { id: string; nombre: string }
  vehiculo?: { id: string; marca: string; modelo: string; anio: number; motor: string } | null
  vendedor: { id: string | null; nombre: string }
  conversacion_id?: string | null
  items: Item[]
}) {
  const creada = Date.now() - o.hace
  return {
    codigo: o.codigo,
    version: o.version ?? 1,
    estado: o.estado,
    creada: new Date(creada).toISOString(),
    vence: new Date(creada + 7 * DAY).toISOString().slice(0, 10),
    cliente: o.cliente,
    vehiculo_id: o.vehiculo?.id ?? null,
    vehiculo: o.vehiculo ?? null,
    vendedor: o.vendedor,
    conversacion_id: o.conversacion_id ?? null,
    items: o.items,
    ...totales(o.items),
    pdf_url: `/api/v1/cotizaciones/${o.codigo}/pdf`,
  }
}

export type CotizacionMock = ReturnType<typeof cotizacion>

// Una fila por versión; la vigente es la de número mayor.
export function buildCotizaciones(): CotizacionMock[] {
  const cibao = { id: "cus-003", nombre: "Repuestos El Cibao" }
  return [
    cotizacion({
      codigo: "COT-0412", estado: "borrador", hace: 13 * MINUTE, vendedor: IA, conversacion_id: "conv-001",
      cliente: { id: "cus-001", nombre: "José Miguel Rosario" },
      vehiculo: { id: "veh_1", marca: "Hyundai", modelo: "Tucson", anio: 2012, motor: "2.0 Litros" },
      items: [item(REF.tucsonDelIzq, 1), item(REF.tucsonDelDer, 1)],
    }),
    cotizacion({
      codigo: "COT-0409", version: 1, estado: "enviada", hace: 3 * HOUR, vendedor: CRISTIAN, conversacion_id: "conv-004", cliente: cibao,
      items: [item(REF.filtroAceiteSonata, 50), item(REF.filtroAceiteFram, 40)],
    }),
    cotizacion({
      codigo: "COT-0409", version: 2, estado: "aceptada", hace: 2.5 * HOUR, vendedor: CRISTIAN, conversacion_id: "conv-004", cliente: cibao,
      items: [item(REF.filtroAceiteSonata, 50), item(REF.filtroAceiteFram, 30)],
    }),
    cotizacion({
      codigo: "COT-0405", estado: "enviada", hace: 5 * DAY, vendedor: YANELIS, conversacion_id: "conv-002",
      cliente: { id: "cus-002", nombre: "Taller Hnos. Peña" },
      vehiculo: { id: "veh_2", marca: "Mitsubishi", modelo: "L200", anio: 2003, motor: "2.0 Litros 4G63" },
      items: [item(REF.bandasL200, 4)],
    }),
    cotizacion({
      codigo: "COT-0398", estado: "aceptada", hace: 2 * DAY + 2 * HOUR, vendedor: YANELIS, conversacion_id: "conv-005",
      cliente: { id: "cus-006", nombre: "Ramón Antonio Tavárez" },
      vehiculo: { id: "veh_5", marca: "Mitsubishi", modelo: "Montero", anio: 2005, motor: "2.8 Litros Diesel" },
      items: [item(REF.cadenaMontero, 1), item(REF.tensorMontero, 1)],
    }),
    cotizacion({
      codigo: "COT-0391", estado: "vencida", hace: 12 * DAY, vendedor: LUIS,
      cliente: { id: "cus-010", nombre: "Carolina Batista" },
      vehiculo: { id: "veh_10", marca: "Mitsubishi", modelo: "Montero IO", anio: 2001, motor: "1.8 Litros" },
      items: [item(REF.coilIo, 1)],
    }),
    cotizacion({
      codigo: "COT-0388", estado: "rechazada", hace: 9 * DAY, vendedor: LUIS,
      cliente: { id: "cus-008", nombre: "Mecánica Diesel Hnos. Mejía" },
      vehiculo: { id: "veh_9", marca: "Mitsubishi", modelo: "Montero", anio: 1998, motor: "2.8 Litros Diesel" },
      items: [item(REF.amortMontero, 2)],
    }),
  ]
}
