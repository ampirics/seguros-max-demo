// Resultados de ejemplo para piezas que Colt no tiene. Los precios y plazos son de muestra hasta conectar las fuentes
// reales (docs/17); los enlaces abren la búsqueda de esa pieza en la fuente.

export type TipoFuente = "catalogo_oem" | "marketplace" | "subasta" | "desarmadero"

const FUENTES: { tipo: TipoFuente; fuente: string; origen: string; condicion: "nueva" | "usada"; factor: number; dias: number; url: (q: string) => string }[] = [
  { tipo: "catalogo_oem", fuente: "Catálogo OEM", origen: "Japón", condicion: "nueva", factor: 1.6, dias: 15, url: (q) => `https://www.amayama.com/en/search?q=${q}` },
  { tipo: "marketplace", fuente: "Marketplace", origen: "EE. UU.", condicion: "nueva", factor: 1, dias: 8, url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}` },
  { tipo: "marketplace", fuente: "Marketplace", origen: "EE. UU.", condicion: "nueva", factor: 0.8, dias: 10, url: (q) => `https://www.rockauto.com/en/partsearch/?partnum=${q}` },
  { tipo: "desarmadero", fuente: "Desarmadero", origen: "EE. UU.", condicion: "usada", factor: 0.5, dias: 12, url: () => "https://www.car-part.com/" },
  { tipo: "subasta", fuente: "Subasta", origen: "EE. UU.", condicion: "usada", factor: 0.35, dias: 20, url: (q) => `https://www.copart.com/lotSearchResults?query=${q}` },
]

// Rango en USD por tipo de pieza; el resto cae en el genérico.
const RANGOS: [RegExp, number][] = [
  [/motor de arranque|arranque/, 140],
  [/alternador/, 160],
  [/compresor/, 240],
  [/radiador/, 120],
  [/bomba de (gasolina|combustible)/, 85],
  [/bomba de agua/, 55],
  [/amortiguador/, 75],
  [/faro|farol|foco/, 95],
  [/espejo|retrovisor/, 60],
  [/transmisi|caja/, 900],
  [/motor/, 1800],
]

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

export interface VehiculoExterno { marca?: string | null; modelo?: string | null; anio?: number | null }

export function resultadosExternos(q: string, v: VehiculoExterno) {
  const pieza = q.trim()
  if (!pieza) return []
  const base = RANGOS.find(([re]) => re.test(norm(pieza)))?.[1] ?? 50
  const vehiculo = [v.marca, v.modelo, v.anio].filter(Boolean).join(" ")
  const texto = [pieza, vehiculo].filter(Boolean).join(" ")
  const termino = encodeURIComponent(texto)
  const titulo = pieza.charAt(0).toUpperCase() + pieza.slice(1)
  return FUENTES.map((f, i) => {
    const h = hash(`${norm(texto)}-${i}`)
    return {
      id: `ext-${h.toString(36)}`,
      titulo: vehiculo ? `${titulo} para ${vehiculo}` : titulo,
      tipo: f.tipo,
      fuente: f.fuente,
      condicion: f.condicion,
      precio: Math.round(base * f.factor * (0.85 + (h % 30) / 100)) + 0.99,
      moneda: "USD",
      origen: f.origen,
      dias_estimados: f.dias + (h % 4),
      url: f.url(termino),
      imagen: null as string | null,
    }
  }).sort((a, b) => a.precio - b.precio)
}

export type ResultadoExterno = ReturnType<typeof resultadosExternos>[number]

export type EstadoBusqueda = "pendiente" | "ofrecida" | "aceptada" | "descartada"

export interface BusquedaExternaMock {
  id: string
  pieza: string
  vehiculo: { marca: string; modelo: string; anio: number } | null
  cliente: { id: string | null; nombre: string } | null
  conversacion_id: string | null
  lead_id: string | null
  origen: "ia" | "vendedor"
  estado: EstadoBusqueda
  oferta: { resultado: ResultadoExterno; precio_dop: number; dias_estimados: number; mensaje: string; enviada: string; por: string } | null
  creada: string
  actualizada: string
}

// Una búsqueda pendiente por cada conversación donde la IA no encontró la pieza.
export function buildBusquedasExternas(conversations: any[], leads: { id: string; conversacion_id: string | null; interes: string; cliente_id: string | null }[]): BusquedaExternaMock[] {
  return conversations
    .filter((c) => c.resultado === "sin_existencia")
    .map((c) => {
      const lead = leads.find((l) => l.conversacion_id === c.id)
      return {
        id: `be-${c.id}`,
        pieza: (lead?.interes ?? "pieza pedida").toLowerCase(),
        vehiculo: c.vehiculo ? { marca: c.vehiculo.marca, modelo: c.vehiculo.modelo, anio: c.vehiculo.anio } : null,
        cliente: { id: lead?.cliente_id ?? null, nombre: c.customer_name },
        conversacion_id: c.id,
        lead_id: lead?.id ?? null,
        origen: "ia",
        estado: "pendiente",
        oferta: null,
        creada: c.last_message_timestamp,
        actualizada: c.last_message_timestamp,
      }
    })
}
