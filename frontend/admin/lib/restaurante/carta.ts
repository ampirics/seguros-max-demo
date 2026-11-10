import type { Plato } from "./tipos";

// Precios en RD$ tomados del menú público de 2020 (docs/fuentes/menu-2020.pdf). No incluyen ITBIS ni servicio.
export const FUENTE_PRECIOS = "Carta pública de Boca Marina (marzo 2020)";
export const ITBIS = 0.18;
export const SERVICIO = 0.1;

const TERMINO = { nombre: "Término", valores: ["Rojo", "Medio", "Tres cuartos", "Bien cocido"] };
const PESCADO = { nombre: "Pescado", valores: ["Mero", "Chillo", "Corvina", "Atún fresco", "Salmón fresco"] };
const GUARNICION = {
  nombre: "Guarnición",
  valores: ["Tostones", "Papas fritas", "Puré de papas", "Arroz blanco", "Vegetales al grill", "Ensalada verde"],
};
const PASTA = { nombre: "Pasta", valores: ["Linguini", "Spaghetti", "Penne"] };

export const CATEGORIAS = [
  "Entradas frías",
  "Entradas calientes",
  "Sopas y cremas",
  "Ensaladas",
  "Del mar",
  "Especialidades",
  "Carnes y aves",
  "Pastas",
  "Sushi",
  "Guarniciones",
  "Postres",
];

export const CARTA: Plato[] = [
  { id: "salpicon", nombre: "Salpicón de mariscos a la vinagreta", categoria: "Entradas frías", estacion: "fria", precio: 495, minutos: 8, alergenos: ["mariscos"] },
  { id: "ceviche", nombre: "Ceviche de pescado", categoria: "Entradas frías", estacion: "fria", precio: 550, minutos: 8, foto: "ceviche-coctel-sm.webp", alergenos: ["pescado"], destacado: true },
  { id: "carpaccio-portobello", nombre: "Carpaccio de hongos Portobello", categoria: "Entradas frías", estacion: "fria", precio: 550, minutos: 7 },
  { id: "carpaccio-res", nombre: "Carpaccio de filete de res", categoria: "Entradas frías", estacion: "fria", precio: 550, minutos: 7 },
  { id: "carpaccio-salmon", nombre: "Carpaccio de salmón", categoria: "Entradas frías", estacion: "fria", precio: 550, minutos: 7, foto: "carpaccio-salmon-sm.webp", alergenos: ["pescado"] },
  { id: "pulpo-vinagreta", nombre: "Pulpo a la vinagreta", categoria: "Entradas frías", estacion: "fria", precio: 650, minutos: 8, descripcion: "Pulpo criollo", alergenos: ["moluscos"] },
  { id: "coctel-camarones", nombre: "Cóctel de camarones", categoria: "Entradas frías", estacion: "fria", precio: 560, minutos: 7, alergenos: ["mariscos"] },

  { id: "baguettines", nombre: "Baguettines con extravirgen y parmesano (2)", categoria: "Entradas calientes", estacion: "caliente", precio: 175, minutos: 6, alergenos: ["gluten", "lácteos"] },
  { id: "calamares-empanizados", nombre: "Calamares empanizados", categoria: "Entradas calientes", estacion: "caliente", precio: 350, minutos: 10, descripcion: "Con salsa tártara", alergenos: ["moluscos", "gluten"] },
  { id: "croquetas", nombre: "Croquetas de pescado con salsa tártara (6)", categoria: "Entradas calientes", estacion: "caliente", precio: 400, minutos: 10, alergenos: ["pescado", "gluten"] },
  { id: "ollita-camarones", nombre: "Ollita de camarones al ajillo", categoria: "Entradas calientes", estacion: "caliente", precio: 560, minutos: 10, foto: "camarones-ajillo-sm.webp", descripcion: "Camarones Black Tiger 21/25", alergenos: ["mariscos"], destacado: true },
  { id: "mozzarella-marinara", nombre: "Mozzarella a la marinara", categoria: "Entradas calientes", estacion: "caliente", precio: 410, minutos: 9, alergenos: ["lácteos", "gluten"] },
  { id: "muelas-centollo", nombre: "Muelas de centollo", categoria: "Entradas calientes", estacion: "caliente", precio: 1350, minutos: 14, descripcion: "En temporada", alergenos: ["mariscos"] },
  { id: "picadera", nombre: "Picadera Boca Marina", categoria: "Entradas calientes", estacion: "caliente", precio: 875, minutos: 14, descripcion: "Calamares y camarones al ajo y vino, bastoncitos de pescado, chicharroncitos de pollo y papas fritas", alergenos: ["mariscos", "moluscos", "gluten"], destacado: true },

  { id: "sopa-pescado", nombre: "Sopa de pescado al Jerez", categoria: "Sopas y cremas", estacion: "caliente", precio: 525, minutos: 8, alergenos: ["pescado"] },
  { id: "sopa-mariscos", nombre: "Sopa de mariscos", categoria: "Sopas y cremas", estacion: "caliente", precio: 495, minutos: 8, alergenos: ["mariscos"] },
  { id: "crema-auyama", nombre: "Crema de auyama", categoria: "Sopas y cremas", estacion: "caliente", precio: 250, minutos: 6, alergenos: ["lácteos"] },
  { id: "bisque-langosta", nombre: "Bisque de langosta", categoria: "Sopas y cremas", estacion: "caliente", precio: 525, minutos: 8, alergenos: ["mariscos", "lácteos"] },
  { id: "cazuela-mariscos", nombre: "Cazuela de mariscos", categoria: "Sopas y cremas", estacion: "caliente", precio: 750, minutos: 12, alergenos: ["mariscos"] },

  { id: "portobello-camarones", nombre: "Hongos Portobello gratinados con camarones", categoria: "Ensaladas", estacion: "fria", precio: 785, minutos: 10, descripcion: "Plato ganador del Festival Gastronómico 2004", alergenos: ["mariscos", "lácteos"] },
  { id: "cesar-pollo", nombre: "César con pollo", categoria: "Ensaladas", estacion: "fria", precio: 440, minutos: 8, alergenos: ["lácteos", "gluten"] },
  { id: "helen", nombre: "Ensalada Helen", categoria: "Ensaladas", estacion: "fria", precio: 650, minutos: 9, descripcion: "Berenjena al pesto, Portobello, mozzarella, manchego y pollo", alergenos: ["lácteos", "frutos secos"] },
  { id: "flavia", nombre: "Ensalada Flavia", categoria: "Ensaladas", estacion: "fria", precio: 740, minutos: 9, descripcion: "Romana, rúcula, calamares y camarones a la plancha, mozzarella y parmesano", alergenos: ["mariscos", "moluscos", "lácteos"] },
  { id: "caprese", nombre: "Ensalada Caprese", categoria: "Ensaladas", estacion: "fria", precio: 380, minutos: 6, alergenos: ["lácteos"] },
  { id: "goat-cheese", nombre: "Ensalada de queso de cabra", categoria: "Ensaladas", estacion: "fria", precio: 600, minutos: 7, alergenos: ["lácteos", "frutos secos"] },

  { id: "chillo-boca-chica", nombre: "Pescado entero frito al estilo Boca Chica", categoria: "Del mar", estacion: "caliente", precio: 970, porLibra: true, minutos: 22, foto: "chillo-sm.webp", descripcion: "Precio por libra", alergenos: ["pescado"], opciones: [GUARNICION], destacado: true },
  { id: "pescado-samana", nombre: "Pescado entero al estilo Samaná", categoria: "Del mar", estacion: "caliente", precio: 970, porLibra: true, minutos: 24, descripcion: "Con coco. Precio por libra", alergenos: ["pescado"], opciones: [GUARNICION] },
  { id: "filete-plancha", nombre: "Filete de pescado a la plancha", categoria: "Del mar", estacion: "caliente", precio: 975, minutos: 16, alergenos: ["pescado"], opciones: [PESCADO, GUARNICION] },
  { id: "filete-eduardo", nombre: "Filete de pescado a lo Eduardo", categoria: "Del mar", estacion: "caliente", precio: 950, minutos: 18, descripcion: "Pimientos, cebolla, jengibre, ajo, perejil y vino blanco", alergenos: ["pescado"], opciones: [PESCADO, GUARNICION] },
  { id: "filete-gratinado", nombre: "Filete gratinado con camarones", categoria: "Del mar", estacion: "caliente", precio: 1250, minutos: 20, alergenos: ["pescado", "mariscos", "lácteos"], opciones: [PESCADO, GUARNICION] },
  { id: "pulpo-parrilla", nombre: "Pulpo entero a la parrilla", categoria: "Del mar", estacion: "caliente", precio: 1300, minutos: 18, foto: "pulpo-parrilla-sm.webp", descripcion: "Pulpo criollo", alergenos: ["moluscos"], opciones: [GUARNICION], destacado: true },
  { id: "lambi-criolla", nombre: "Lambí a la criolla", categoria: "Del mar", estacion: "caliente", precio: 700, minutos: 15, foto: "lambi-sm.webp", alergenos: ["moluscos"], opciones: [GUARNICION] },
  { id: "camarones-ajo-vino", nombre: "Camarones al ajo y vino", categoria: "Del mar", estacion: "caliente", precio: 890, minutos: 14, alergenos: ["mariscos"], opciones: [GUARNICION] },
  { id: "camarones-thermidor", nombre: "Camarones a la thermidor", categoria: "Del mar", estacion: "caliente", precio: 890, minutos: 16, foto: "thermidor-sm.webp", alergenos: ["mariscos", "lácteos"], opciones: [GUARNICION], destacado: true },
  { id: "camarones-coco", nombre: "Camarones al coco", categoria: "Del mar", estacion: "caliente", precio: 890, minutos: 15, alergenos: ["mariscos"], opciones: [GUARNICION] },
  { id: "langosta-plancha", nombre: "Langosta entera a la plancha", categoria: "Del mar", estacion: "caliente", precio: 1130, porLibra: true, minutos: 20, descripcion: "Precio por libra", alergenos: ["mariscos"], opciones: [GUARNICION] },
  { id: "langosta-thermidor", nombre: "Langosta a la thermidor", categoria: "Del mar", estacion: "caliente", precio: 1230, porLibra: true, minutos: 22, descripcion: "Precio por libra", alergenos: ["mariscos", "lácteos"], opciones: [GUARNICION] },
  { id: "langostinos", nombre: "Langostinos enteros a la plancha", categoria: "Del mar", estacion: "caliente", precio: 1485, minutos: 18, descripcion: "Servicio de 1.5 libras", alergenos: ["mariscos"], opciones: [GUARNICION] },

  { id: "paella-2", nombre: "Paella marinera (2 personas)", categoria: "Especialidades", estacion: "caliente", precio: 2075, minutos: 28, foto: "paella-langosta-sm.webp", alergenos: ["mariscos", "moluscos"], destacado: true },
  { id: "paella-4", nombre: "Paella marinera (4 personas)", categoria: "Especialidades", estacion: "caliente", precio: 4075, minutos: 30, foto: "paella-langosta-sm.webp", alergenos: ["mariscos", "moluscos"] },
  { id: "canoa", nombre: "Canoa de mariscos", categoria: "Especialidades", estacion: "caliente", precio: 840, minutos: 18, foto: "canoa-mariscos-sm.webp", alergenos: ["mariscos", "moluscos"], destacado: true },
  { id: "parrillada-2", nombre: "Parrillada mixta del mar (2 personas)", categoria: "Especialidades", estacion: "caliente", precio: 2250, minutos: 25, alergenos: ["mariscos", "moluscos", "pescado"] },
  { id: "asopao-langosta", nombre: "Asopao con una langosta", categoria: "Especialidades", estacion: "caliente", precio: 1300, minutos: 20, alergenos: ["mariscos"] },
  { id: "chicharron-mero", nombre: "Chicharrones de filete de mero (6)", categoria: "Especialidades", estacion: "caliente", precio: 975, minutos: 14, alergenos: ["pescado", "gluten"] },
  { id: "risotto-churrasco", nombre: "Risotto de churrasco", categoria: "Especialidades", estacion: "caliente", precio: 1025, minutos: 20, alergenos: ["lácteos"] },

  { id: "churrasco", nombre: "Churrasco Angus USDA Choice 12 oz", categoria: "Carnes y aves", estacion: "caliente", precio: 1395, minutos: 18, opciones: [TERMINO, GUARNICION] },
  { id: "filete-mignon", nombre: "Filete mignon", categoria: "Carnes y aves", estacion: "caliente", precio: 1390, minutos: 18, opciones: [TERMINO, GUARNICION] },
  { id: "filete-pimienta", nombre: "Filete de res a la pimienta", categoria: "Carnes y aves", estacion: "caliente", precio: 1390, minutos: 18, opciones: [TERMINO, GUARNICION] },
  { id: "pollo-grill", nombre: "Pechuga de pollo al grill", categoria: "Carnes y aves", estacion: "caliente", precio: 510, minutos: 14, opciones: [GUARNICION] },
  { id: "cordon-bleu", nombre: "Pollo Cordon Bleu", categoria: "Carnes y aves", estacion: "caliente", precio: 550, minutos: 16, alergenos: ["lácteos", "gluten"], opciones: [GUARNICION] },

  { id: "pasta-frutti", nombre: "Pasta frutti di mare", categoria: "Pastas", estacion: "caliente", precio: 785, minutos: 14, foto: "frutti-di-mare-sm.webp", alergenos: ["mariscos", "gluten"], opciones: [PASTA, { nombre: "Salsa", valores: ["Pomodoro fresco", "A la crema"] }], destacado: true },
  { id: "pasta-carbonara-camarones", nombre: "Pasta carbonara con camarones", categoria: "Pastas", estacion: "caliente", precio: 860, minutos: 14, alergenos: ["mariscos", "gluten", "lácteos", "huevo"], opciones: [PASTA] },
  { id: "pasta-pesto-mero", nombre: "Pasta al pesto con mero", categoria: "Pastas", estacion: "caliente", precio: 860, minutos: 14, alergenos: ["pescado", "gluten", "frutos secos"], opciones: [PASTA] },
  { id: "pasta-bolognesa", nombre: "Pasta bolognesa de res", categoria: "Pastas", estacion: "caliente", precio: 410, minutos: 12, alergenos: ["gluten"], opciones: [PASTA] },
  { id: "lasagna-langosta", nombre: "Lasagna de langosta", categoria: "Pastas", estacion: "caliente", precio: 1300, minutos: 20, alergenos: ["mariscos", "gluten", "lácteos"] },

  { id: "sushi-boca-marina", nombre: "Sushi roll Boca Marina", categoria: "Sushi", estacion: "fria", precio: 610, minutos: 10, alergenos: ["pescado", "soya"] },
  { id: "sushi-dominicano", nombre: "Sushi roll Dominicano", categoria: "Sushi", estacion: "fria", precio: 530, minutos: 10, alergenos: ["pescado", "soya"] },
  { id: "sushi-california", nombre: "Sushi roll California", categoria: "Sushi", estacion: "fria", precio: 450, minutos: 9, alergenos: ["mariscos", "soya"] },
  { id: "sushi-philadelphia", nombre: "Sushi roll Philadelphia", categoria: "Sushi", estacion: "fria", precio: 450, minutos: 9, alergenos: ["pescado", "lácteos", "soya"] },
  { id: "sushi-vegetariano", nombre: "Sushi roll vegetariano", categoria: "Sushi", estacion: "fria", precio: 390, minutos: 8, alergenos: ["soya"] },

  { id: "tostones", nombre: "Tostones", categoria: "Guarniciones", estacion: "caliente", precio: 110, minutos: 6 },
  { id: "papas-fritas", nombre: "Papas fritas", categoria: "Guarniciones", estacion: "caliente", precio: 110, minutos: 6 },
  { id: "yuquitas", nombre: "Yuquitas fritas", categoria: "Guarniciones", estacion: "caliente", precio: 130, minutos: 7 },
  { id: "arroz-blanco", nombre: "Arroz blanco", categoria: "Guarniciones", estacion: "caliente", precio: 110, minutos: 3 },
  { id: "vegetales-grill", nombre: "Vegetales al grill", categoria: "Guarniciones", estacion: "caliente", precio: 130, minutos: 7 },

  { id: "tres-leches", nombre: "Tres leches Boca Marina", categoria: "Postres", estacion: "postres", precio: 320, minutos: 4, alergenos: ["lácteos", "gluten", "huevo"] },
  { id: "dulce-coco", nombre: "Dulce de coco al horno", categoria: "Postres", estacion: "postres", precio: 320, minutos: 4, alergenos: ["lácteos"] },
  { id: "flan-coco", nombre: "Flan de coco", categoria: "Postres", estacion: "postres", precio: 350, minutos: 3, alergenos: ["lácteos", "huevo"] },
  { id: "brownie", nombre: "Brownie a la moda", categoria: "Postres", estacion: "postres", precio: 350, minutos: 5, alergenos: ["lácteos", "gluten", "huevo"] },
  { id: "cheesecake-chinola", nombre: "Cheesecake de chinola", categoria: "Postres", estacion: "postres", precio: 350, minutos: 3, alergenos: ["lácteos", "gluten"] },
  { id: "panacota-chinola", nombre: "Panacota de chinola", categoria: "Postres", estacion: "postres", precio: 380, minutos: 3, alergenos: ["lácteos"] },
  { id: "selva-negra", nombre: "Selva negra", categoria: "Postres", estacion: "postres", precio: 380, minutos: 3, alergenos: ["lácteos", "gluten", "huevo"] },
];

export const PLATOS = new Map(CARTA.map((p) => [p.id, p]));

export const ESTACIONES: { id: "caliente" | "fria" | "postres"; nombre: string }[] = [
  { id: "caliente", nombre: "Cocina caliente" },
  { id: "fria", nombre: "Fría y sushi" },
  { id: "postres", nombre: "Postres" },
];

export function precioItem(platoId: string, cantidad: number) {
  const p = PLATOS.get(platoId);
  return p ? Math.round(p.precio * cantidad) : 0;
}

export function totales(subtotal: number, propina = 0) {
  const itbis = Math.round(subtotal * ITBIS);
  const servicio = Math.round(subtotal * SERVICIO);
  return { subtotal, itbis, servicio, propina, total: subtotal + itbis + servicio + propina };
}

export function rd(n: number) {
  return "RD$ " + Math.round(n).toLocaleString("es-DO");
}
