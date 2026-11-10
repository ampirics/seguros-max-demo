import { CARTA, PLATOS } from "./carta"
import type { Insumo, Proveedor } from "./tipos"

// Costos, existencias, proveedores y recetas DE EJEMPLO: Boca Marina no ha compartido sus costos reales.
// Los precios de venta sí son los de la carta.

export const PROVEEDORES: Proveedor[] = [
  { id: "pescaderia", nombre: "Pescadería Don Pancho", contacto: "Francisco Mercedes", telefono: "809-555-6101", correo: "pedidos@donpancho.example", dias: "Lunes a sábado, 7:00 a. m.", categorias: ["Pescados y mariscos"] },
  { id: "carnes", nombre: "Carnes Selectas del Este", contacto: "Yudelka Batista", telefono: "809-555-6102", correo: "ventas@carnesdeleste.example", dias: "Martes, jueves y sábado", categorias: ["Carnes y aves"] },
  { id: "mercado", nombre: "Agro Frescos del Mercado", contacto: "Julio Peralta", telefono: "829-555-6103", dias: "Todos los días, 6:30 a. m.", categorias: ["Vegetales y frutas"] },
  { id: "distribuidora", nombre: "Distribuidora Caribe Gourmet", contacto: "Sandra Rosario", telefono: "809-555-6104", correo: "pedidos@caribegourmet.example", dias: "Lunes y jueves", categorias: ["Despensa", "Lácteos", "Bebidas"] },
]

type Base = [id: string, nombre: string, unidad: Insumo["unidad"], costo: number, existencia: number, minimo: number, proveedorId: string, categoria: string]

const BASE: Base[] = [
  ["langosta", "Langosta entera", "unidad", 600, 34, 12, "pescaderia", "Pescados y mariscos"],
  ["camaron", "Camarón Black Tiger", "kg", 780, 22, 8, "pescaderia", "Pescados y mariscos"],
  ["langostino", "Langostino", "kg", 1100, 7, 3, "pescaderia", "Pescados y mariscos"],
  ["pulpo", "Pulpo", "kg", 890, 11, 4, "pescaderia", "Pescados y mariscos"],
  ["lambi", "Lambí", "kg", 720, 6, 3, "pescaderia", "Pescados y mariscos"],
  ["calamar", "Calamar", "kg", 420, 9, 3, "pescaderia", "Pescados y mariscos"],
  ["mejillon", "Mejillón", "kg", 380, 5, 2, "pescaderia", "Pescados y mariscos"],
  ["almeja", "Almeja", "kg", 450, 4, 2, "pescaderia", "Pescados y mariscos"],
  ["centollo", "Muela de centollo", "kg", 1400, 0, 1.5, "pescaderia", "Pescados y mariscos"],
  ["chillo", "Chillo entero", "unidad", 480, 26, 10, "pescaderia", "Pescados y mariscos"],
  ["mero", "Filete de mero", "kg", 690, 14, 5, "pescaderia", "Pescados y mariscos"],
  ["salmon", "Salmón fresco", "kg", 1250, 7, 3, "pescaderia", "Pescados y mariscos"],
  ["dorado", "Filete de dorado", "kg", 520, 12, 4, "pescaderia", "Pescados y mariscos"],
  ["res-angus", "Churrasco Angus", "kg", 1650, 9, 3, "carnes", "Carnes y aves"],
  ["filete-res", "Filete de res", "kg", 1350, 8, 3, "carnes", "Carnes y aves"],
  ["pollo", "Pechuga de pollo", "kg", 260, 16, 5, "carnes", "Carnes y aves"],
  ["carne-molida", "Carne molida de res", "kg", 380, 5, 2, "carnes", "Carnes y aves"],
  ["jamon", "Jamón de pavo", "kg", 480, 3, 1, "carnes", "Carnes y aves"],
  ["zanahoria", "Zanahoria", "kg", 60, 1.6, 3, "mercado", "Vegetales y frutas"],
  ["cebolla", "Cebolla", "kg", 55, 18, 5, "mercado", "Vegetales y frutas"],
  ["ajo", "Ajo", "kg", 180, 4, 1, "mercado", "Vegetales y frutas"],
  ["tomate", "Tomate", "kg", 70, 15, 5, "mercado", "Vegetales y frutas"],
  ["lechuga", "Lechuga romana", "unidad", 45, 24, 10, "mercado", "Vegetales y frutas"],
  ["platano", "Plátano verde", "unidad", 18, 110, 40, "mercado", "Vegetales y frutas"],
  ["papa", "Papa", "kg", 50, 32, 10, "mercado", "Vegetales y frutas"],
  ["yuca", "Yuca", "kg", 40, 20, 8, "mercado", "Vegetales y frutas"],
  ["auyama", "Auyama", "kg", 45, 9, 3, "mercado", "Vegetales y frutas"],
  ["portobello", "Hongo portobello", "kg", 420, 5, 2, "mercado", "Vegetales y frutas"],
  ["limon", "Limón", "unidad", 6, 260, 80, "mercado", "Vegetales y frutas"],
  ["aguacate", "Aguacate", "unidad", 45, 18, 10, "mercado", "Vegetales y frutas"],
  ["chinola", "Chinola", "kg", 90, 2.5, 2, "mercado", "Vegetales y frutas"],
  ["vegetales", "Vegetales mixtos", "kg", 120, 11, 4, "mercado", "Vegetales y frutas"],
  ["leche-coco", "Leche de coco", "l", 180, 9, 4, "distribuidora", "Despensa"],
  ["arroz", "Arroz", "kg", 55, 48, 15, "distribuidora", "Despensa"],
  ["arroz-sushi", "Arroz para sushi", "kg", 160, 8, 3, "distribuidora", "Despensa"],
  ["nori", "Alga nori", "unidad", 12, 160, 60, "distribuidora", "Despensa"],
  ["pasta", "Pasta", "kg", 140, 20, 6, "distribuidora", "Despensa"],
  ["harina", "Harina", "kg", 45, 24, 8, "distribuidora", "Despensa"],
  ["aceite-oliva", "Aceite de oliva extravirgen", "l", 620, 9, 3, "distribuidora", "Despensa"],
  ["aceite", "Aceite para freír", "l", 140, 32, 10, "distribuidora", "Despensa"],
  ["pan", "Pan baguette", "unidad", 25, 90, 40, "distribuidora", "Despensa"],
  ["azucar", "Azúcar", "kg", 60, 20, 6, "distribuidora", "Despensa"],
  ["chocolate", "Chocolate oscuro", "kg", 520, 4, 1.5, "distribuidora", "Despensa"],
  ["vino-blanco", "Vino blanco de cocina", "botella", 450, 14, 6, "distribuidora", "Bebidas"],
  ["mantequilla", "Mantequilla", "kg", 520, 8, 3, "distribuidora", "Lácteos"],
  ["crema", "Crema de leche", "l", 260, 11, 4, "distribuidora", "Lácteos"],
  ["leche", "Leche", "l", 70, 24, 8, "distribuidora", "Lácteos"],
  ["huevos", "Huevos", "unidad", 9, 300, 90, "distribuidora", "Lácteos"],
  ["parmesano", "Queso parmesano", "kg", 1100, 4, 2, "distribuidora", "Lácteos"],
  ["mozzarella", "Queso mozzarella", "kg", 520, 7, 3, "distribuidora", "Lácteos"],
  ["queso-cabra", "Queso de cabra", "kg", 980, 2, 1, "distribuidora", "Lácteos"],
  ["queso-crema", "Queso crema", "kg", 420, 4, 2, "distribuidora", "Lácteos"],
]

export const INSUMOS_BASE: Insumo[] = BASE.map(([id, nombre, unidad, costo, existencia, minimo, proveedorId, categoria]) => ({ id, nombre, unidad, costo, existencia, minimo, proveedorId, categoria }))

// Cantidad de cada insumo por porción del plato (en la unidad del insumo). Los platos por libra van por libra.
type R = Record<string, number>
const aromas: R = { cebolla: 0.03, ajo: 0.01, "aceite-oliva": 0.01 }
const frito: R = { aceite: 0.08 }

export const RECETAS: Record<string, R> = {
  salpicon: { camaron: 0.08, calamar: 0.06, pulpo: 0.05, zanahoria: 0.03, cebolla: 0.03, limon: 2, "aceite-oliva": 0.02 },
  ceviche: { dorado: 0.15, limon: 4, cebolla: 0.04, tomate: 0.04 },
  "carpaccio-portobello": { portobello: 0.15, parmesano: 0.02, "aceite-oliva": 0.02, limon: 1 },
  "carpaccio-res": { "filete-res": 0.12, parmesano: 0.02, "aceite-oliva": 0.02, limon: 1 },
  "carpaccio-salmon": { salmon: 0.12, limon: 1, "aceite-oliva": 0.02 },
  "pulpo-vinagreta": { pulpo: 0.18, cebolla: 0.03, tomate: 0.04, "aceite-oliva": 0.02 },
  "coctel-camarones": { camaron: 0.16, tomate: 0.03, limon: 1, aguacate: 0.5 },
  baguettines: { pan: 1, "aceite-oliva": 0.02, parmesano: 0.02, ajo: 0.005 },
  "calamares-empanizados": { calamar: 0.22, harina: 0.05, huevos: 1, limon: 1, ...frito },
  croquetas: { dorado: 0.15, papa: 0.1, harina: 0.04, huevos: 1, ...frito },
  "ollita-camarones": { camaron: 0.2, ajo: 0.02, "aceite-oliva": 0.04, pan: 1 },
  "mozzarella-marinara": { mozzarella: 0.18, harina: 0.04, huevos: 1, tomate: 0.08, ...frito },
  "muelas-centollo": { centollo: 0.3, mantequilla: 0.03, limon: 1 },
  picadera: { calamar: 0.12, camaron: 0.1, dorado: 0.1, platano: 2, yuca: 0.15, ...frito },
  "sopa-pescado": { dorado: 0.15, zanahoria: 0.05, papa: 0.08, cebolla: 0.04, "vino-blanco": 0.05 },
  "sopa-mariscos": { camaron: 0.08, calamar: 0.06, mejillon: 0.06, almeja: 0.05, zanahoria: 0.05, cebolla: 0.04 },
  "crema-auyama": { auyama: 0.3, crema: 0.06, cebolla: 0.03, mantequilla: 0.01 },
  "bisque-langosta": { langosta: 0.15, crema: 0.08, "vino-blanco": 0.06, cebolla: 0.03, mantequilla: 0.02 },
  "cazuela-mariscos": { camaron: 0.1, pulpo: 0.08, calamar: 0.08, mejillon: 0.08, zanahoria: 0.04, tomate: 0.08, ...aromas },
  "portobello-camarones": { portobello: 0.18, camaron: 0.12, mozzarella: 0.05, ajo: 0.01 },
  "cesar-pollo": { lechuga: 1, pollo: 0.18, parmesano: 0.03, pan: 0.5, huevos: 1 },
  helen: { lechuga: 1, camaron: 0.1, aguacate: 0.5, zanahoria: 0.04, tomate: 0.05 },
  flavia: { lechuga: 1, salmon: 0.1, zanahoria: 0.04, aguacate: 0.5 },
  caprese: { tomate: 0.2, mozzarella: 0.15, "aceite-oliva": 0.02 },
  "goat-cheese": { lechuga: 1, "queso-cabra": 0.08, tomate: 0.05 },
  "chillo-boca-chica": { chillo: 0.6, platano: 2, limon: 2, ...frito, ...aromas },
  "pescado-samana": { chillo: 0.6, "leche-coco": 0.25, cebolla: 0.04, ajo: 0.01, arroz: 0.12 },
  "filete-plancha": { dorado: 0.25, mantequilla: 0.02, limon: 1, vegetales: 0.12 },
  "filete-eduardo": { mero: 0.25, camaron: 0.06, crema: 0.05, "vino-blanco": 0.05, ...aromas },
  "filete-gratinado": { mero: 0.25, camaron: 0.08, mozzarella: 0.06, crema: 0.04 },
  "pulpo-parrilla": { pulpo: 0.45, papa: 0.2, "aceite-oliva": 0.04, ajo: 0.01 },
  "lambi-criolla": { lambi: 0.3, tomate: 0.08, zanahoria: 0.03, arroz: 0.12, ...aromas },
  "camarones-ajo-vino": { camaron: 0.3, "vino-blanco": 0.08, ajo: 0.02, mantequilla: 0.03, arroz: 0.12 },
  "camarones-thermidor": { camaron: 0.3, crema: 0.08, parmesano: 0.03, mantequilla: 0.02 },
  "camarones-coco": { camaron: 0.3, "leche-coco": 0.2, arroz: 0.12, cebolla: 0.03 },
  "langosta-plancha": { langosta: 0.45, mantequilla: 0.04, ajo: 0.01, limon: 1 },
  "langosta-thermidor": { langosta: 0.45, crema: 0.1, parmesano: 0.03, mantequilla: 0.03 },
  langostinos: { langostino: 0.45, mantequilla: 0.03, ajo: 0.01, limon: 1 },
  "paella-2": { arroz: 0.35, camaron: 0.2, calamar: 0.12, mejillon: 0.15, almeja: 0.12, langosta: 0.5, ...aromas },
  "paella-4": { arroz: 0.7, camaron: 0.4, calamar: 0.24, mejillon: 0.3, almeja: 0.24, langosta: 1, cebolla: 0.06, ajo: 0.02, "aceite-oliva": 0.04 },
  canoa: { langosta: 0.15, camaron: 0.1, pulpo: 0.06, calamar: 0.08, mejillon: 0.08, mantequilla: 0.03 },
  "parrillada-2": { langosta: 0.5, camaron: 0.2, pulpo: 0.15, dorado: 0.2, calamar: 0.15, vegetales: 0.2 },
  "asopao-langosta": { langosta: 0.6, arroz: 0.18, zanahoria: 0.05, tomate: 0.06, ...aromas },
  "chicharron-mero": { mero: 0.3, harina: 0.06, limon: 2, ...frito },
  "risotto-churrasco": { "res-angus": 0.2, arroz: 0.12, parmesano: 0.03, mantequilla: 0.03, "vino-blanco": 0.05 },
  churrasco: { "res-angus": 0.34, mantequilla: 0.02, ajo: 0.01 },
  "filete-mignon": { "filete-res": 0.25, mantequilla: 0.02, "vino-blanco": 0.04 },
  "filete-pimienta": { "filete-res": 0.25, crema: 0.06, mantequilla: 0.02 },
  "pollo-grill": { pollo: 0.28, vegetales: 0.12, zanahoria: 0.05 },
  "cordon-bleu": { pollo: 0.25, jamon: 0.05, mozzarella: 0.05, harina: 0.04, huevos: 1, ...frito },
  "pasta-frutti": { pasta: 0.15, camaron: 0.08, calamar: 0.06, mejillon: 0.08, tomate: 0.1, ...aromas },
  "pasta-carbonara-camarones": { pasta: 0.15, camaron: 0.12, crema: 0.08, huevos: 1, parmesano: 0.03 },
  "pasta-pesto-mero": { pasta: 0.15, mero: 0.15, "aceite-oliva": 0.03, parmesano: 0.03, ajo: 0.01 },
  "pasta-bolognesa": { pasta: 0.15, "carne-molida": 0.15, tomate: 0.12, zanahoria: 0.03, cebolla: 0.04 },
  "lasagna-langosta": { pasta: 0.12, langosta: 0.5, crema: 0.08, mozzarella: 0.08, parmesano: 0.03 },
  "sushi-boca-marina": { "arroz-sushi": 0.12, nori: 1, camaron: 0.06, salmon: 0.05, "queso-crema": 0.03, aguacate: 0.25 },
  "sushi-dominicano": { "arroz-sushi": 0.12, nori: 1, camaron: 0.06, platano: 1, "queso-crema": 0.03 },
  "sushi-california": { "arroz-sushi": 0.12, nori: 1, camaron: 0.05, aguacate: 0.3 },
  "sushi-philadelphia": { "arroz-sushi": 0.12, nori: 1, salmon: 0.07, "queso-crema": 0.04 },
  "sushi-vegetariano": { "arroz-sushi": 0.12, nori: 1, aguacate: 0.3, zanahoria: 0.04, vegetales: 0.05 },
  tostones: { platano: 2, ...frito },
  "papas-fritas": { papa: 0.25, ...frito },
  yuquitas: { yuca: 0.25, ...frito },
  "arroz-blanco": { arroz: 0.12 },
  "vegetales-grill": { vegetales: 0.2, zanahoria: 0.08, "aceite-oliva": 0.01 },
  "tres-leches": { harina: 0.04, huevos: 1, leche: 0.12, azucar: 0.05, crema: 0.03 },
  "dulce-coco": { "leche-coco": 0.12, azucar: 0.06, huevos: 1 },
  "flan-coco": { "leche-coco": 0.1, leche: 0.08, huevos: 2, azucar: 0.05 },
  brownie: { chocolate: 0.06, harina: 0.03, huevos: 1, mantequilla: 0.03, azucar: 0.04 },
  "cheesecake-chinola": { "queso-crema": 0.1, chinola: 0.08, azucar: 0.04, huevos: 1 },
  "panacota-chinola": { crema: 0.12, chinola: 0.06, azucar: 0.03 },
  "selva-negra": { chocolate: 0.05, harina: 0.04, crema: 0.06, huevos: 1, azucar: 0.04 },
}

const porId = (insumos: Insumo[]) => new Map(insumos.map((i) => [i.id, i]))

/** Costo de los insumos de una porción con los costos de ejemplo. */
export function costoPlato(platoId: string, insumos: Insumo[] = INSUMOS_BASE) {
  const m = porId(insumos)
  return Math.round(Object.entries(RECETAS[platoId] ?? {}).reduce((s, [id, c]) => s + c * (m.get(id)?.costo ?? 0), 0))
}

/** Insumos que no alcanzan para preparar `cantidad` del plato. */
export function faltantes(platoId: string, insumos: Insumo[], cantidad = 1) {
  const m = porId(insumos)
  return Object.entries(RECETAS[platoId] ?? {})
    .filter(([id, c]) => (m.get(id)?.existencia ?? 0) < c * cantidad)
    .map(([id]) => m.get(id)?.nombre ?? id)
}

export function platosAgotados(insumos: Insumo[] | undefined) {
  if (!insumos?.length) return new Set<string>()
  return new Set(CARTA.filter((p) => faltantes(p.id, insumos).length > 0).map((p) => p.id))
}

/** Platos de la carta que llevan ese insumo. */
export function platosCon(insumoId: string) {
  return CARTA.filter((p) => (RECETAS[p.id]?.[insumoId] ?? 0) > 0)
}

export function estadoInsumo(i: Insumo) {
  return i.existencia <= 0 ? "agotado" : i.existencia < i.minimo ? "bajo" : "ok"
}

export const margen = (platoId: string, insumos?: Insumo[]) => {
  const p = PLATOS.get(platoId)
  if (!p) return null
  const costo = costoPlato(platoId, insumos)
  return { costo, precio: p.precio, pct: p.precio ? Math.round((costo / p.precio) * 100) : 0 }
}
