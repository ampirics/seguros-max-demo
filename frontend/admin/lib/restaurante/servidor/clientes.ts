import type { Canal, Cliente } from "../tipos"

type Semilla = Pick<Cliente, "id" | "nombre" | "telefono" | "canalOrigen" | "preferencias" | "ocasiones"> &
  Partial<Pick<Cliente, "correo" | "alergias" | "etiqueta" | "empresa" | "idioma" | "cumpleanos">> & {
    /** Cada cuánto viene, en visitas por mes (0 = cliente nuevo). */
    frecuencia: number
    zona?: "terraza" | "muelle" | "gazebo" | "salon"
    favoritos?: string[]
  }

// Clientes ficticios. Los teléfonos 809/829/849-555 no se asignan en RD.
export const SEMILLAS: Semilla[] = [
  { id: "c-laura", nombre: "Laura Peña", telefono: "809-555-0142", canalOrigen: "whatsapp", frecuencia: 0.6, zona: "gazebo", preferencias: ["Gazebo", "Vino blanco"], ocasiones: ["Aniversario"], favoritos: ["camarones-thermidor", "ceviche"], cumpleanos: "03-14" },
  { id: "c-exportadora", nombre: "Exportadora del Caribe", telefono: "809-555-0177", correo: "eventos@exportadoracaribe.do", canalOrigen: "telefono", frecuencia: 2, zona: "salon", preferencias: ["Salón privado", "Factura con RNC", "Paella para compartir"], ocasiones: ["Comida de negocios"], etiqueta: "Cuenta corporativa", empresa: "Exportadora del Caribe SRL", favoritos: ["paella-4", "parrillada-2", "churrasco"] },
  { id: "c-esther", nombre: "Esther Martínez", telefono: "809-555-0119", canalOrigen: "instagram", frecuencia: 0.5, zona: "terraza", preferencias: ["Terraza", "Sin mariscos"], ocasiones: ["Cumpleaños"], alergias: ["mariscos"], favoritos: ["cesar-pollo", "churrasco"], cumpleanos: "10-25" },
  { id: "c-hector", nombre: "Héctor Rosario", telefono: "829-555-0163", canalOrigen: "voz", frecuencia: 0.4, zona: "muelle", preferencias: ["Muelle", "Atardecer"], ocasiones: [], favoritos: ["chillo-boca-chica"] },
  { id: "c-guzman", nombre: "Familia Guzmán", telefono: "849-555-0108", canalOrigen: "web", frecuencia: 1, zona: "muelle", preferencias: ["Muelle", "Silla para bebé"], ocasiones: ["Almuerzo familiar"], alergias: ["maní"], favoritos: ["chillo-boca-chica", "tostones", "pasta-bolognesa"] },
  { id: "c-ana", nombre: "Ana Valdez", telefono: "809-555-0185", canalOrigen: "whatsapp", frecuencia: 0, preferencias: [], ocasiones: [] },
  { id: "c-jose", nombre: "José Almonte", telefono: "829-555-0131", canalOrigen: "whatsapp", frecuencia: 1.2, zona: "terraza", preferencias: ["Terraza", "Churrasco término medio"], ocasiones: [], favoritos: ["churrasco", "picadera"] },
  { id: "c-marisol", nombre: "Marisol Taveras", telefono: "809-555-0156", canalOrigen: "instagram", frecuencia: 0.4, zona: "gazebo", preferencias: ["Gazebo", "Sushi"], ocasiones: ["Aniversario"], alergias: ["mariscos"], favoritos: ["sushi-vegetariano", "pollo-grill"] },
  { id: "c-kevin", nombre: "Kevin Reyes", telefono: "829-555-0194", canalOrigen: "telefono", frecuencia: 0.3, zona: "salon", preferencias: ["Salón privado"], ocasiones: ["Cumpleaños"], favoritos: ["picadera", "paella-2"], cumpleanos: "11-01" },
  { id: "c-carmen", nombre: "Carmen Díaz", telefono: "809-555-0127", canalOrigen: "voz", frecuencia: 1.6, zona: "muelle", preferencias: ["Muelle", "Lambí a la criolla"], ocasiones: [], etiqueta: "Cliente frecuente", favoritos: ["lambi-criolla", "tres-leches"] },
  { id: "c-luis", nombre: "Luis Fernández", telefono: "849-555-0172", canalOrigen: "whatsapp", frecuencia: 0, preferencias: [], ocasiones: ["Montaje romántico"] },
  { id: "c-patricia", nombre: "Patricia Soto", telefono: "809-555-0113", canalOrigen: "web", frecuencia: 0.7, zona: "terraza", preferencias: ["Terraza"], ocasiones: [], favoritos: ["pasta-frutti", "flan-coco"] },
  { id: "c-ramon", nombre: "Ramón Batista", telefono: "829-555-0148", canalOrigen: "presencial", frecuencia: 2.5, zona: "muelle", preferencias: ["Muelle", "Pulpo a la parrilla"], ocasiones: [], etiqueta: "Cliente frecuente", favoritos: ["pulpo-parrilla", "ollita-camarones"] },
  { id: "c-gina", nombre: "Gina Castillo", telefono: "809-555-0161", canalOrigen: "instagram", frecuencia: 0.3, zona: "gazebo", preferencias: ["Gazebo"], ocasiones: [], favoritos: ["carpaccio-salmon"] },
  { id: "c-mark", nombre: "Mark Thompson", telefono: "+1 305-555-0190", correo: "mark.t@example.com", canalOrigen: "web", idioma: "en", frecuencia: 0.3, zona: "muelle", preferencias: ["Muelle", "Langosta", "Atención en inglés"], ocasiones: [], favoritos: ["langosta-plancha", "ceviche"] },
  { id: "c-sofia", nombre: "Sofía Brea", telefono: "809-555-0133", canalOrigen: "instagram", frecuencia: 0.8, zona: "gazebo", preferencias: ["Camas balinesas", "Cóctel al atardecer"], ocasiones: ["Cumpleaños"], favoritos: ["sushi-boca-marina", "carpaccio-salmon"], cumpleanos: "10-29" },
  { id: "c-andres", nombre: "Andrés Polanco", telefono: "829-555-0175", canalOrigen: "whatsapp", frecuencia: 1, zona: "terraza", preferencias: ["Terraza"], ocasiones: ["Comida de negocios"], favoritos: ["filete-eduardo", "risotto-churrasco"] },
  { id: "c-yolanda", nombre: "Yolanda Mejía", telefono: "809-555-0152", canalOrigen: "telefono", frecuencia: 0.9, zona: "muelle", preferencias: ["Muelle", "Pescado entero"], ocasiones: ["Almuerzo familiar"], favoritos: ["pescado-samana", "arroz-blanco"] },
  { id: "c-rafael", nombre: "Rafael Cruz", telefono: "849-555-0121", canalOrigen: "presencial", frecuencia: 1.4, zona: "terraza", preferencias: ["Terraza", "Mesa cerca del bar"], ocasiones: [], favoritos: ["picadera", "calamares-empanizados"] },
  { id: "c-daniela", nombre: "Daniela Ortiz", telefono: "809-555-0168", canalOrigen: "instagram", frecuencia: 0.5, zona: "gazebo", preferencias: ["Gazebo"], ocasiones: ["Propuesta de matrimonio"], favoritos: ["langostinos"] },
  { id: "c-pedro", nombre: "Pedro Jiménez", telefono: "829-555-0187", canalOrigen: "web", frecuencia: 0.6, zona: "muelle", preferencias: ["Muelle"], ocasiones: [], favoritos: ["canoa", "tostones"] },
  { id: "c-hotel", nombre: "Hotel Don Juan (conserjería)", telefono: "809-555-0101", correo: "concierge@hoteldonjuan.example", canalOrigen: "telefono", frecuencia: 3, zona: "muelle", preferencias: ["Huéspedes extranjeros", "Atención en inglés"], ocasiones: [], etiqueta: "Aliado", empresa: "Hotel Don Juan", favoritos: ["langosta-thermidor", "paella-2"] },
  { id: "c-lucia", nombre: "Lucía Herrera", telefono: "809-555-0145", canalOrigen: "whatsapp", frecuencia: 0.7, zona: "terraza", preferencias: ["Terraza"], ocasiones: ["Cumpleaños"], favoritos: ["cheesecake-chinola", "flavia"], cumpleanos: "10-27" },
  { id: "c-emilio", nombre: "Emilio Santana", telefono: "829-555-0114", canalOrigen: "voz", frecuencia: 0.5, zona: "muelle", preferencias: ["Muelle"], ocasiones: [], favoritos: ["churrasco"] },
  { id: "c-claudia", nombre: "Claudia Ventura", telefono: "849-555-0139", canalOrigen: "web", frecuencia: 0.4, zona: "salon", preferencias: ["Salón privado"], ocasiones: ["Baby shower"], favoritos: ["canoa", "selva-negra"] },
  { id: "c-bancaribe", nombre: "Banco del Caribe (Relaciones)", telefono: "809-555-0199", correo: "relaciones@bancaribe.example", canalOrigen: "telefono", frecuencia: 1, zona: "salon", preferencias: ["Salón privado", "Menú cerrado"], ocasiones: ["Comida de negocios"], etiqueta: "Cuenta corporativa", empresa: "Banco del Caribe", favoritos: ["filete-mignon", "lasagna-langosta"] },
]

export function nuevoCliente(id: string, nombre: string, telefono: string, canal: Canal, ts: number): Cliente {
  return {
    id,
    nombre,
    telefono,
    canalOrigen: canal,
    creado: ts,
    visitas: 0,
    gasto: 0,
    puntos: 0,
    preferencias: [],
    ocasiones: [],
    recorrido: [{ ts, tipo: "contacto", texto: `Primer contacto por ${nombreCanal(canal)}`, canal }],
  }
}

export function nombreCanal(c: Canal) {
  return { whatsapp: "WhatsApp", instagram: "Instagram", web: "el sitio web", telefono: "teléfono", voz: "el asistente de voz", presencial: "visita en persona" }[c]
}
