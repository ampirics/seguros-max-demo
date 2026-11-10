import { COMPANY_ID } from "./common"

export interface ColtProduct {
  id: number
  sku: string
  nombre: string
  precio_dop: number
  disponible: number
  marca: string
  mpn: string
  ruta: string[]
  url: string
  imagenes: string[]
}

export const COLT_CATALOG_URL = "/colt/productos.json"

export function coltImage(path: string): string {
  return "/" + path.replace(/^\/?assets\//, "")
}

const ON_SALE: Record<string, number> = { "10": 10, "558": 15, "559": 15, "405": 10 }

export function mapColtProduct(p: ColtProduct, index: number): any {
  const images = (p.imagenes || []).map(coltImage)
  const ruta = p.ruta || []
  const vehiculo = ruta.slice(0, -1).join(" › ")
  const sistema = ruta[ruta.length - 1] || "General"
  const id = String(p.id)
  const discount = ON_SALE[id]
  const created = new Date(Date.UTC(2025, 0, 1) + index * 9 * 3600 * 1000).toISOString()
  return {
    id,
    name: p.nombre.trim(),
    description: [
      `${p.marca} · Referencia ${p.mpn}.`,
      vehiculo ? `Aplica a: ${vehiculo}.` : "",
      `Sistema: ${sistema}.`,
    ].filter(Boolean).join(" "),
    price: discount ? Math.round(p.precio_dop * (1 - discount / 100)) : p.precio_dop,
    original_price: discount ? p.precio_dop : null,
    discount_percentage: discount ?? null,
    is_on_sale: !!discount,
    image: images[0] || "",
    images,
    gallery: images,
    sku: p.sku,
    external_category_code: ruta[0] || "General",
    sku_mask: null,
    colors: [],
    sizes: [],
    details: [
      { label: "Marca", value: p.marca },
      { label: "Referencia (MPN)", value: p.mpn },
      ...(vehiculo ? [{ label: "Vehículo", value: vehiculo }] : []),
      { label: "Sistema", value: sistema },
    ],
    generated_skus: [],
    is_visible: p.disponible === 1,
    isVisible: p.disponible === 1,
    company_id: COMPANY_ID,
    unit_quantity: 1,
    unit_type: "unidades",
    stock: p.disponible === 1 ? 4 + (p.id % 17) : 0,
    source_url: p.url,
    created_at: created,
    updated_at: created,
  }
}

export interface ProductRef {
  id: string
  sku: string
  name: string
  mpn?: string
  price: number
  image: string
}

export const REF = {
  tucsonDelIzq: { id: "620", sku: "IM100889", name: "Amortiguador Delantero (LH) 54651-2S000 - PARTS MALL", mpn: "PJA-FL022", price: 3147, image: "/colt/productos/2tu_2011-13_54651-2s000_pmc_1.jpg" },
  tucsonDelDer: { id: "621", sku: "IM100879", name: "Amortiguador Delantero (RH) 54661-2S000 - PARTS MALL", mpn: "PJA-FR022", price: 2939, image: "/colt/productos/2tu_2011-13_54661-2s000_pmc_1.jpg" },
  bandasL200: { id: "114", sku: "LC101437", name: "Bandas de Freno Delanteras D6110 - KASHIYAMA", mpn: "D6110", price: 1521, image: "/colt/productos/1l2_1997-05_d6110_2.jpg" },
  bandasL200Orig: { id: "207", sku: "LC101172", name: "Bandas de Freno Delanteras MZ690016 - MITSUBISHI", mpn: "MZ690016", price: 2586, image: "/colt/productos/1l2_1997-05_mz690016_1.jpg" },
  filtroAceiteSonata: { id: "551", sku: "IM002960", name: "Filtro de Aceite 26320-3C250 - PARTS MALL", mpn: "26320-3C250", price: 195, image: "/colt/productos/2so_2006-10_26320-3c250_pmc_1.jpg" },
  filtroAceiteFram: { id: "553", sku: "LC211078", name: "Filtro de Aceite PH-3593A - FRAM", mpn: "PH-3593A", price: 114, image: "/colt/productos/1e_04_ph3593a_frm_1.jpg" },
  bateriaMtp24: { id: "10", sku: "LC101689", name: "Bateria Mega Tron Plus MTP-24 INTERSTATE", mpn: "MTP-24", price: 7200, image: "" },
  cadenaMontero: { id: "262", sku: "LC103287", name: "Cadena de Distribución ME190012 - MITSUBISHI", mpn: "ME190012", price: 3420, image: "/colt/productos/1mo_2001-12_me190012-me203085_mit_1.jpg" },
  tensorMontero: { id: "260", sku: "IM000061", name: "Tensor Hidráulico MD362861 - MITSUBISHI", mpn: "MD362861", price: 3080, image: "/colt/productos/1mo_2001-12_md362861_mit-tyt_1.jpg" },
  cablesSantaFe: { id: "405", sku: "IM000987", name: "Cables de Bujia 27501-37B00 - PARTS MALL", mpn: "PEA-E67", price: 1215, image: "/colt/productos/2sf_2002-05_27501-37b00_pmc_1.jpg" },
  tensorAccent: { id: "319", sku: "IM100209", name: "Tensor Hidráulico 24410-26800 - HSC", mpn: "24410-26800", price: 1922, image: "/colt/productos/2a_2006-12_24410-26800_hsc_1.jpg" },
  correaLancer: { id: "144", sku: "LC105131", name: "Correa de Distribución MD314456 - SUN", mpn: "MD314456", price: 1000, image: "/colt/productos/1l_1996-00_md314456_2.jpg" },
  amortMontero: { id: "585", sku: "LC100426", name: "Amortiguador Delantero (LH/RH) 344222 - KAYABA", mpn: "344222", price: 1500, image: "/colt/productos/1mo_1992-00_mb892585_kyb_1.jpg" },
  coilIo: { id: "287", sku: "LC103990", name: "Coil de Ignición MD362907 - MITSUBISHI", mpn: "MD362907", price: 5200, image: "/colt/productos/1moio_1997-07_md362907_mit_1.jpg" },
} satisfies Record<string, ProductRef>
