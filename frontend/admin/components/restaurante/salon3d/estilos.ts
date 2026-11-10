import { createContext, useContext } from "react"
import type { Fase } from "./Entorno"

export type Estilo = "caribe" | "palapa" | "riviera" | "bali" | "coral" | "atardecer" | "noche" | "maqueta" | "actual"

export const ESTILOS: { id: Estilo; nombre: string; detalle: string }[] = [
  { id: "caribe", nombre: "Caribe", detalle: "Arena blanca, teca y lino" },
  { id: "palapa", nombre: "Palapa", detalle: "Techos de caña y mimbre" },
  { id: "riviera", nombre: "Riviera", detalle: "Club de yates, azul y blanco" },
  { id: "bali", nombre: "Bali", detalle: "Teca oscura y jardín tropical" },
  { id: "coral", nombre: "Coral", detalle: "Pastel caribeño moderno" },
  { id: "atardecer", nombre: "Atardecer", detalle: "Madera cálida" },
  { id: "noche", nombre: "Noche", detalle: "Lounge oscuro" },
  { id: "maqueta", nombre: "Maqueta", detalle: "Blanco de arquitecto" },
  { id: "actual", nombre: "Actual", detalle: "Modelos sencillos" },
]

export const ESTILO_INICIAL: Estilo = "caribe"

export const esEstilo = (v: unknown): v is Estilo => ESTILOS.some((e) => e.id === v)
export const esFase = (v: unknown): v is Fase => v === "dia" || v === "dorada" || v === "noche"

export type EstiloFino = Exclude<Estilo, "actual">
export const esTropical = (e: Estilo) => e === "caribe" || e === "palapa" || e === "riviera" || e === "bali" || e === "coral"

export const EstiloCtx = createContext<{ estilo: Estilo; fase: Fase }>({ estilo: "actual", fase: "dia" })
export const useEstilo = () => useContext(EstiloCtx)

export interface LuzFina {
  cieloArriba: string
  cieloHorizonte: string
  aguaProfunda: string
  aguaSomera: string
  aguaReflejo: string
  brillo: string
  brilloF: number
  hemiCielo: string
  hemiSuelo: string
  hemi: number
  sol: string
  solI: number
  solPos: [number, number, number]
  exposicion: number
  // Velas, bombillos y lámparas: 0 apagadas.
  calidas: number
  estrellas: boolean
  luna: boolean
  // Agua cristalina sobre arena junto a la orilla y el muelle.
  aguaClara?: string
}

export type Planta = "palmita" | "monstera" | "platano" | "ave" | "buganvilla" | "frangipani" | "agave" | "helecho"

/** Piezas propias de los estilos tropicales. */
export interface Deco {
  techo: "lienzos" | "enramada" | "enredadera" | "buganvilla" | "pergola"
  gazebo: "tela" | "palapa" | "joglo" | "cupula"
  sombrilla: { tipo: "lona" | "paja" | "rayas" | "flecos"; tela: string; franja: string; asta: string }
  playa: boolean
  plantas: Planta[]
  densidad: number
  maceta: string
  luces: { guirnalda: boolean; antorchas: boolean; farol: "piedra" | "mimbre" | "laton" | "esfera" | "linterna" }
  botes: "lancha" | "veleros"
  silla: "listones" | "ratan" | "director" | "teca" | "concha"
  cama: "dosel" | "palapa" | "teca" | "sofa"
  mesa: "mantel" | "madera"
  alfombra?: string
  camino?: string
  flor?: string
  toldos?: { a: string; b: string }
  pisoTerraza?: "baldosa" | "terrazo" | "tablas"
  tumbona: { marco: string; cojin: string }
  poste: string
  muelleAncho?: number
}

export interface Tema {
  piedra: string
  arena: string
  muro: string
  remate: string
  pisoSalon: [string, string]
  pisoCocina: [string, string]
  pisoBar: [string, string]
  muelle: [string, string, string]
  terraza: [string, string]
  punta: [string, string, string]
  canto: string
  grama: string
  borde: string
  baranda: string
  pergola: string
  pilote: string
  mantel: string
  silla: { marco: string; cojin: string }
  plato: string
  servilleta: string
  copa: string
  vela: string
  cama: { base: string; cojin: string; acento: string }
  gazebo: string
  tela: string
  palma: { tronco: string; hoja: string; hoja2: string }
  bote: { casco: string; cabina: string }
  barra: { base: string; tope: string; estante: string }
  cocina: { mueble: string; tope: string }
  figura: { piel: string[]; ropa: string[]; pelo: string[]; uniforme: string; pantalon: string; cocina: string }
  aro: number
  sombraBlob: number
  vetas: number
  luz: Record<Fase, LuzFina>
  deco?: Deco
}

const PIEL = ["#8d5a3b", "#a86b48", "#c48a62", "#6e4630", "#d9a77f", "#b97c55"]
const PELO = ["#1d1410", "#2e1f16", "#4a3022", "#151515"]


type Colores = Pick<LuzFina, "cieloArriba" | "cieloHorizonte" | "aguaProfunda" | "aguaSomera" | "aguaReflejo" | "hemiCielo" | "hemiSuelo"> & Partial<LuzFina>

function luzTropical(dia: Colores, dorada: Colores, noche: Colores): Record<Fase, LuzFina> {
  return {
    dia: { brillo: "#ffffff", brilloF: 0.75, hemi: 1.0, sol: "#fff4e0", solI: 2.9, solPos: [16, 28, 10], exposicion: 1.0, calidas: 0, estrellas: false, luna: false, ...dia },
    dorada: { brillo: "#ffcf8f", brilloF: 1.15, hemi: 0.8, sol: "#ffb978", solI: 2.3, solPos: [-26, 9, -4], exposicion: 1.03, calidas: 0.6, estrellas: false, luna: false, ...dorada },
    noche: { brillo: "#dce6ff", brilloF: 0.5, hemi: 0.42, sol: "#a9bfff", solI: 0.5, solPos: [14, 20, -14], exposicion: 1.08, calidas: 1.3, estrellas: true, luna: true, ...noche },
  }
}

const PIEL_SOL = ["#8d5a3b", "#a86b48", "#c48a62", "#6e4630", "#d9a77f", "#b97c55", "#e3b48e"]

export const TEMAS: Record<EstiloFino, Tema> = {
  maqueta: {
    piedra: "#e4dfd5",
    arena: "#ece6da",
    muro: "#fbfaf7",
    remate: "#ffffff",
    pisoSalon: ["#efeae1", "#ebe5db"],
    pisoCocina: ["#eeebe5", "#e7e3dc"],
    pisoBar: ["#efe9df", "#e9e2d6"],
    muelle: ["#ece6da", "#e7e0d3", "#d9d1c2"],
    terraza: ["#f4f1eb", "#ece7de"],
    punta: ["#e9e2d5", "#e4dccf", "#d6cdbd"],
    canto: "#ddd5c7",
    grama: "#cdd6c3",
    borde: "#f2eee7",
    baranda: "#ffffff",
    pergola: "#fbfaf7",
    pilote: "#d8d0c2",
    mantel: "#ffffff",
    silla: { marco: "#efeae2", cojin: "#ffffff" },
    plato: "#ffffff",
    servilleta: "#e8e2d8",
    copa: "#e6eeee",
    vela: "#ffffff",
    cama: { base: "#fbfaf7", cojin: "#f0ebe2", acento: "#e3dccf" },
    gazebo: "#ffffff",
    tela: "#ffffff",
    palma: { tronco: "#e6e0d5", hoja: "#d9dfd0", hoja2: "#cfd7c6" },
    bote: { casco: "#fbfaf7", cabina: "#e6e0d5" },
    barra: { base: "#f1ece3", tope: "#ffffff", estante: "#e8e2d7" },
    cocina: { mueble: "#f1ede6", tope: "#ffffff" },
    figura: { piel: ["#f1ede6"], ropa: ["#ebe6dc", "#e3ddd2", "#f6f3ee", "#ddd6ca"], pelo: ["#d6cfc2"], uniforme: "#ffffff", pantalon: "#d3ccbf", cocina: "#ffffff" },
    aro: 0.06,
    sombraBlob: 0.32,
    vetas: 0.25,
    luz: {
      dia: {
        cieloArriba: "#e3e7e5", cieloHorizonte: "#f1efea", aguaProfunda: "#b4cfcc", aguaSomera: "#cfe2de", aguaReflejo: "#eef3f1",
        brillo: "#ffffff", brilloF: 0.12, hemiCielo: "#ffffff", hemiSuelo: "#d9d2c4", hemi: 1.0, sol: "#ffffff", solI: 1.9,
        solPos: [10, 24, 14], exposicion: 1.0, calidas: 0, estrellas: false, luna: false,
      },
      dorada: {
        cieloArriba: "#e4d8cb", cieloHorizonte: "#f3e3cf", aguaProfunda: "#c3cbc4", aguaSomera: "#d8d8cd", aguaReflejo: "#f5e6d4",
        brillo: "#ffe2bf", brilloF: 0.35, hemiCielo: "#fff1e0", hemiSuelo: "#cdbfa8", hemi: 0.85, sol: "#ffd8ad", solI: 1.8,
        solPos: [-20, 11, 12], exposicion: 1.0, calidas: 0.45, estrellas: false, luna: false,
      },
      noche: {
        cieloArriba: "#141d23", cieloHorizonte: "#22313a", aguaProfunda: "#1b2b31", aguaSomera: "#24363c", aguaReflejo: "#2e3f48",
        brillo: "#c9d6ff", brilloF: 0.35, hemiCielo: "#9fb2c4", hemiSuelo: "#2c2822", hemi: 0.5, sol: "#c3d0ff", solI: 0.45,
        solPos: [12, 22, -10], exposicion: 1.05, calidas: 1, estrellas: false, luna: false,
      },
    },
  },
  atardecer: {
    piedra: "#d8c5a4",
    arena: "#ead7b4",
    muro: "#f4ecdf",
    remate: "#fffaf0",
    pisoSalon: ["#9c6b45", "#8e603d"],
    pisoCocina: ["#e9e6df", "#dcd8cf"],
    pisoBar: ["#e7dcc8", "#ddd0b9"],
    muelle: ["#ab8763", "#9d7a58", "#5f4430"],
    terraza: ["#efe4cf", "#e5d7bd"],
    punta: ["#a07a55", "#93704c", "#56402c"],
    canto: "#7b5a3c",
    grama: "#6f8f50",
    borde: "#e8dcc6",
    baranda: "#f6f1e7",
    pergola: "#8a6440",
    pilote: "#5a3f2a",
    mantel: "#fbf8f2",
    silla: { marco: "#a8784c", cojin: "#efe6d6" },
    plato: "#ffffff",
    servilleta: "#e8866a",
    copa: "#dff0f0",
    vela: "#fff6e6",
    cama: { base: "#f7f2e8", cojin: "#efe5d3", acento: "#e8866a" },
    gazebo: "#fbf8f2",
    tela: "#ffffff",
    palma: { tronco: "#8b6c4f", hoja: "#3f7a3e", hoja2: "#55924b" },
    bote: { casco: "#f8f6f0", cabina: "#0b2a2e" },
    barra: { base: "#6e4a30", tope: "#efe7da", estante: "#4e3423" },
    cocina: { mueble: "#d7dbdc", tope: "#b9c2c5" },
    figura: { piel: PIEL, ropa: ["#f4ecdf", "#7fcfcb", "#e8866a", "#2f4f6b", "#d9c3a0", "#ffffff", "#8a9a6a", "#c96f5a"], pelo: PELO, uniforme: "#ffffff", pantalon: "#0b2a2e", cocina: "#ffffff" },
    aro: 0.07,
    sombraBlob: 0.22,
    vetas: 1,
    luz: {
      dia: {
        cieloArriba: "#8cc0da", cieloHorizonte: "#e4f0ee", aguaProfunda: "#0f7680", aguaSomera: "#33b3ab", aguaReflejo: "#bfe3ea",
        brillo: "#ffffff", brilloF: 0.55, hemiCielo: "#e8f6ff", hemiSuelo: "#c8a57c", hemi: 0.85, sol: "#fff1d8", solI: 2.5,
        solPos: [14, 26, 12], exposicion: 1.0, calidas: 0, estrellas: false, luna: false,
      },
      dorada: {
        cieloArriba: "#7d9cbc", cieloHorizonte: "#f2c9a2", aguaProfunda: "#1b5f6c", aguaSomera: "#3d9693", aguaReflejo: "#d9b9a0",
        brillo: "#ffd59a", brilloF: 1.0, hemiCielo: "#e9e4dc", hemiSuelo: "#8a6a4e", hemi: 0.8, sol: "#ffc48a", solI: 2.0,
        solPos: [-24, 9, -6], exposicion: 1.02, calidas: 0.55, estrellas: false, luna: false,
      },
      noche: {
        cieloArriba: "#0b1a2a", cieloHorizonte: "#283a50", aguaProfunda: "#08222b", aguaSomera: "#0f3640", aguaReflejo: "#30465a",
        brillo: "#cfd9ff", brilloF: 0.45, hemiCielo: "#3b5578", hemiSuelo: "#1d1610", hemi: 0.38, sol: "#a9bfff", solI: 0.5,
        solPos: [14, 20, -14], exposicion: 1.05, calidas: 1, estrellas: true, luna: true,
      },
    },
  },
  noche: {
    piedra: "#b9a68a",
    arena: "#cdb894",
    muro: "#ece0cc",
    remate: "#f8f0e2",
    pisoSalon: ["#5a3c28", "#4e3322"],
    pisoCocina: ["#d9d6cf", "#cfcbc2"],
    pisoBar: ["#3a322c", "#332c26"],
    muelle: ["#55402f", "#4b382a", "#1c140e"],
    terraza: ["#6f6152", "#655848"],
    punta: ["#4f3a2a", "#463325", "#1a120c"],
    canto: "#3b2a1d",
    grama: "#3f5a3a",
    borde: "#8a7660",
    baranda: "#1d2a2c",
    pergola: "#2e2620",
    pilote: "#2a1f17",
    mantel: "#f5efe4",
    silla: { marco: "#2b211b", cojin: "#d9cbb4" },
    plato: "#ffffff",
    servilleta: "#0b2a2e",
    copa: "#d5e8e9",
    vela: "#fff4e0",
    cama: { base: "#efe7d9", cojin: "#e5dccb", acento: "#c9a35c" },
    gazebo: "#efe7d9",
    tela: "#fff6e6",
    palma: { tronco: "#4a3a2c", hoja: "#244630", hoja2: "#2f5638" },
    bote: { casco: "#e9e4da", cabina: "#0b2a2e" },
    barra: { base: "#1b1714", tope: "#d8c7a8", estante: "#2a1f18" },
    cocina: { mueble: "#c9cdcf", tope: "#9aa4a8" },
    figura: { piel: PIEL, ropa: ["#1f2a33", "#0b2a2e", "#5a2b33", "#efe6d6", "#2b2b2b", "#7a5c3e", "#c9a35c", "#e8866a"], pelo: PELO, uniforme: "#16191b", pantalon: "#16191b", cocina: "#ffffff" },
    aro: 0.07,
    sombraBlob: 0.3,
    vetas: 1,
    luz: {
      dia: {
        cieloArriba: "#a3c3cc", cieloHorizonte: "#e6ece8", aguaProfunda: "#0c5a62", aguaSomera: "#1f8b89", aguaReflejo: "#b9d6da",
        brillo: "#ffffff", brilloF: 0.45, hemiCielo: "#eaf4f6", hemiSuelo: "#a8916f", hemi: 0.8, sol: "#fff3df", solI: 2.3,
        solPos: [14, 26, 12], exposicion: 1.0, calidas: 0, estrellas: false, luna: false,
      },
      dorada: {
        cieloArriba: "#34476a", cieloHorizonte: "#e29a6c", aguaProfunda: "#123b48", aguaSomera: "#20575f", aguaReflejo: "#e0a07a",
        brillo: "#ffb97a", brilloF: 1.0, hemiCielo: "#f3b98f", hemiSuelo: "#4a3626", hemi: 0.55, sol: "#ff9a55", solI: 2.1,
        solPos: [-24, 8, -6], exposicion: 1.02, calidas: 0.85, estrellas: false, luna: false,
      },
      noche: {
        cieloArriba: "#02080d", cieloHorizonte: "#0b2630", aguaProfunda: "#02121a", aguaSomera: "#05252d", aguaReflejo: "#0c2c36",
        brillo: "#dfe7ff", brilloF: 0.55, hemiCielo: "#2a4a6e", hemiSuelo: "#1a110a", hemi: 0.4, sol: "#9fb6ff", solI: 0.45,
        solPos: [14, 20, -14], exposicion: 1.1, calidas: 1.6, estrellas: true, luna: true,
      },
    },
  },
  caribe: {
    piedra: "#efe4cf",
    arena: "#f6eedd",
    muro: "#fdfbf6",
    remate: "#ffffff",
    pisoSalon: ["#d9c19c", "#cdb38c"],
    pisoCocina: ["#eceae4", "#e2ded6"],
    pisoBar: ["#f1ebe0", "#e8dfd0"],
    muelle: ["#d8bf98", "#c9ae86", "#9c8262"],
    terraza: ["#f5f0e6", "#ece4d6"],
    punta: ["#d3b993", "#c6aa82", "#957b5b"],
    canto: "#b59a75",
    grama: "#7eae5a",
    borde: "#f3ecdf",
    baranda: "#fbf8f1",
    pergola: "#f7f3ea",
    pilote: "#8a7358",
    mantel: "#ffffff",
    silla: { marco: "#b88d5f", cojin: "#fbf7ef" },
    plato: "#ffffff",
    servilleta: "#7fcfcb",
    copa: "#e2f4f4",
    vela: "#fffaf0",
    cama: { base: "#fbf8f1", cojin: "#f4ede0", acento: "#7fcfcb" },
    gazebo: "#fbf8f1",
    tela: "#ffffff",
    palma: { tronco: "#9c8165", hoja: "#3f8f3a", hoja2: "#5aa845" },
    bote: { casco: "#ffffff", cabina: "#0b2a2e" },
    barra: { base: "#b88d5f", tope: "#fbf8f1", estante: "#9c7a54" },
    cocina: { mueble: "#e3e6e6", tope: "#c9d0d2" },
    figura: { piel: PIEL_SOL, ropa: ["#ffffff", "#7fcfcb", "#f4ecdf", "#e8866a", "#2f6f9b", "#f2d5a0", "#b9dfe8", "#ffffff"], pelo: PELO, uniforme: "#ffffff", pantalon: "#e9dfcc", cocina: "#ffffff" },
    aro: 0.07,
    sombraBlob: 0.2,
    vetas: 0.8,
    deco: {
      techo: "lienzos",
      gazebo: "tela",
      sombrilla: { tipo: "lona", tela: "#fbf8f1", franja: "#efe7d8", asta: "#b88d5f" },
      playa: true,
      plantas: ["palmita", "palmita", "helecho"],
      densidad: 0.6,
      maceta: "#f7f3ea",
      luces: { guirnalda: true, antorchas: false, farol: "linterna" },
      botes: "lancha",
      silla: "listones",
      cama: "dosel",
      mesa: "mantel",
      tumbona: { marco: "#b88d5f", cojin: "#fbf8f1" },
      poste: "#b88d5f",
    },
    luz: luzTropical(
      { cieloArriba: "#2d8de0", cieloHorizonte: "#c9eef6", aguaProfunda: "#067f9c", aguaSomera: "#1fc6c4", aguaReflejo: "#d4f4fa", aguaClara: "#8eeedd", hemiCielo: "#e6f6ff", hemiSuelo: "#e9d7b4" },
      { cieloArriba: "#5d86b8", cieloHorizonte: "#f7c99a", aguaProfunda: "#14627a", aguaSomera: "#2f9ea0", aguaReflejo: "#f1c9a4", aguaClara: "#6fc8bd", hemiCielo: "#fbe6cf", hemiSuelo: "#a07a58" },
      { cieloArriba: "#081a30", cieloHorizonte: "#1f3a58", aguaProfunda: "#04202c", aguaSomera: "#0a3a46", aguaReflejo: "#2c4a62", aguaClara: "#0f5058", hemiCielo: "#3c5a82", hemiSuelo: "#21180f" },
    ),
  },
  palapa: {
    piedra: "#e3cfa9",
    arena: "#efdcb8",
    muro: "#efe2cb",
    remate: "#d9c39c",
    pisoSalon: ["#b9875a", "#a87a50"],
    pisoCocina: ["#d9cdb9", "#cdbfa8"],
    pisoBar: ["#c98b62", "#bb7f57"],
    muelle: ["#a47f58", "#97734f", "#5f4630"],
    terraza: ["#c98b62", "#bd7f58"],
    punta: ["#9f7a53", "#92704b", "#5a422d"],
    canto: "#7b5b3d",
    grama: "#6f9a4a",
    borde: "#c9a77a",
    baranda: "#8a6a48",
    pergola: "#7a5a3c",
    pilote: "#5e4430",
    mantel: "#b08452",
    silla: { marco: "#c9a26c", cojin: "#efe3cc" },
    plato: "#f6efe3",
    servilleta: "#e8866a",
    copa: "#e6f0e8",
    vela: "#fff4dc",
    cama: { base: "#efe3cc", cojin: "#e6d6b8", acento: "#e8866a" },
    gazebo: "#7a5a3c",
    tela: "#f6ecd8",
    palma: { tronco: "#8c7258", hoja: "#4a8a36", hoja2: "#69a546" },
    bote: { casco: "#f3ece0", cabina: "#c96f5a" },
    barra: { base: "#8a6440", tope: "#c9a26c", estante: "#6e4d30" },
    cocina: { mueble: "#d7cfc2", tope: "#b9ae9c" },
    figura: { piel: PIEL_SOL, ropa: ["#f4ecdf", "#e8866a", "#d9a65a", "#ffffff", "#7a9a5a", "#c96f5a", "#efe3cc", "#2f6b6b"], pelo: PELO, uniforme: "#f4ecdf", pantalon: "#8a6a48", cocina: "#ffffff" },
    aro: 0.07,
    sombraBlob: 0.24,
    vetas: 1,
    deco: {
      techo: "enramada",
      gazebo: "palapa",
      sombrilla: { tipo: "paja", tela: "#c9a46a", franja: "#a98650", asta: "#7a5a3c" },
      playa: true,
      plantas: ["agave", "palmita", "ave", "helecho"],
      densidad: 0.8,
      maceta: "#c0704a",
      luces: { guirnalda: true, antorchas: true, farol: "mimbre" },
      botes: "lancha",
      silla: "ratan",
      cama: "palapa",
      mesa: "madera",
      alfombra: "#cdb48a",
      camino: "#efe3cc",
      tumbona: { marco: "#c9a26c", cojin: "#efe3cc" },
      poste: "#7a5a3c",
    },
    luz: luzTropical(
      { cieloArriba: "#3a95dc", cieloHorizonte: "#d6efef", aguaProfunda: "#0b8193", aguaSomera: "#27bfae", aguaReflejo: "#d8f2ef", aguaClara: "#9be6cf", hemiCielo: "#f1f7ef", hemiSuelo: "#d9b98a" },
      { cieloArriba: "#6a7fa8", cieloHorizonte: "#f6b884", aguaProfunda: "#165a66", aguaSomera: "#3a8f86", aguaReflejo: "#f0b98e", aguaClara: "#7cbfa8", hemiCielo: "#fbdcbc", hemiSuelo: "#8a6440" },
      { cieloArriba: "#0a1726", cieloHorizonte: "#2c3548", aguaProfunda: "#061c24", aguaSomera: "#0d3338", aguaReflejo: "#3a3e4a", aguaClara: "#14484a", hemiCielo: "#3e4f6c", hemiSuelo: "#2a1a0e", calidas: 1.45 },
    ),
  },
  riviera: {
    piedra: "#e9e4da",
    arena: "#f3eee3",
    muro: "#ffffff",
    remate: "#1d3557",
    pisoSalon: ["#8a5a3a", "#7c5033"],
    pisoCocina: ["#ececea", "#e0e0dc"],
    pisoBar: ["#f3f1ec", "#e6e9ef"],
    muelle: ["#a5764c", "#986c44", "#2a1d14"],
    terraza: ["#f6f4ef", "#ebe8e0"],
    punta: ["#9d6f46", "#916640", "#2a1d14"],
    canto: "#f4f2ec",
    grama: "#6f9f55",
    borde: "#ffffff",
    baranda: "#ffffff",
    pergola: "#ffffff",
    pilote: "#f1efe9",
    mantel: "#ffffff",
    silla: { marco: "#1d3557", cojin: "#ffffff" },
    plato: "#ffffff",
    servilleta: "#1d3557",
    copa: "#e4eef4",
    vela: "#ffffff",
    cama: { base: "#ffffff", cojin: "#f1f3f6", acento: "#1d3557" },
    gazebo: "#ffffff",
    tela: "#ffffff",
    palma: { tronco: "#9a8670", hoja: "#3c8a40", hoja2: "#57a24c" },
    bote: { casco: "#ffffff", cabina: "#1d3557" },
    barra: { base: "#1d3557", tope: "#ffffff", estante: "#c9a35c" },
    cocina: { mueble: "#e2e5e8", tope: "#c7ccd1" },
    figura: { piel: PIEL_SOL, ropa: ["#ffffff", "#1d3557", "#f4ecdf", "#c9d9ea", "#e8866a", "#ffffff", "#2f5f8f", "#d9c3a0"], pelo: PELO, uniforme: "#ffffff", pantalon: "#1d3557", cocina: "#ffffff" },
    aro: 0.07,
    sombraBlob: 0.2,
    vetas: 1.1,
    deco: {
      techo: "pergola",
      gazebo: "tela",
      sombrilla: { tipo: "rayas", tela: "#ffffff", franja: "#1d3557", asta: "#c9a35c" },
      playa: false,
      plantas: ["palmita", "helecho"],
      densidad: 0.45,
      maceta: "#ffffff",
      luces: { guirnalda: false, antorchas: false, farol: "laton" },
      botes: "veleros",
      silla: "director",
      cama: "dosel",
      mesa: "mantel",
      toldos: { a: "#ffffff", b: "#1d3557" },
      pisoTerraza: "tablas",
      tumbona: { marco: "#ffffff", cojin: "#1d3557" },
      poste: "#ffffff",
    },
    luz: luzTropical(
      { cieloArriba: "#2378cf", cieloHorizonte: "#cfe9f6", aguaProfunda: "#055a92", aguaSomera: "#1597bb", aguaReflejo: "#d6eef8", aguaClara: "#5fcbdc", hemiCielo: "#eaf4ff", hemiSuelo: "#cdbfa8", solI: 3.0 },
      { cieloArriba: "#3f5f90", cieloHorizonte: "#f3c6a0", aguaProfunda: "#0f4766", aguaSomera: "#22708a", aguaReflejo: "#efc2a2", aguaClara: "#4f9fae", hemiCielo: "#f6e3d2", hemiSuelo: "#7e6650" },
      { cieloArriba: "#050f22", cieloHorizonte: "#17294a", aguaProfunda: "#031426", aguaSomera: "#082a40", aguaReflejo: "#22385a", aguaClara: "#0b3a50", hemiCielo: "#344e7c", hemiSuelo: "#1a1510" },
    ),
  },
  bali: {
    piedra: "#b9ad97",
    arena: "#e6d6b6",
    muro: "#e9dfcd",
    remate: "#5a4030",
    pisoSalon: ["#5b3e2a", "#4f3523"],
    pisoCocina: ["#cfc9bd", "#c2bcb0"],
    pisoBar: ["#6b6a63", "#5f5e58"],
    muelle: ["#6b4a33", "#5f412c", "#2a1c12"],
    terraza: ["#7a776e", "#6c6a62"],
    punta: ["#664631", "#5a3e2a", "#26190f"],
    canto: "#3e2b1d",
    grama: "#4f8a3a",
    borde: "#6b6a63",
    baranda: "#4a3324",
    pergola: "#4a3324",
    pilote: "#3a281b",
    mantel: "#5a3d2a",
    silla: { marco: "#4f3523", cojin: "#efe6d4" },
    plato: "#f6f1e7",
    servilleta: "#efe6d4",
    copa: "#e2eee6",
    vela: "#fff4dc",
    cama: { base: "#efe6d4", cojin: "#e5d9c0", acento: "#c9a35c" },
    gazebo: "#4a3324",
    tela: "#fbf6ea",
    palma: { tronco: "#7a6a58", hoja: "#2f7a32", hoja2: "#4a9a3e" },
    bote: { casco: "#e9e1d0", cabina: "#4a3324" },
    barra: { base: "#4a3324", tope: "#8a6a48", estante: "#3a281b" },
    cocina: { mueble: "#cfcac0", tope: "#a8a296" },
    figura: { piel: PIEL_SOL, ropa: ["#efe6d4", "#2f5a3a", "#c9a35c", "#ffffff", "#8a4a3a", "#d9c3a0", "#5a3d2a", "#e8866a"], pelo: PELO, uniforme: "#efe6d4", pantalon: "#3a281b", cocina: "#ffffff" },
    aro: 0.07,
    sombraBlob: 0.3,
    vetas: 1,
    deco: {
      techo: "enredadera",
      gazebo: "joglo",
      sombrilla: { tipo: "paja", tela: "#7a5a3c", franja: "#5e4430", asta: "#3a281b" },
      playa: false,
      plantas: ["monstera", "platano", "ave", "frangipani", "helecho", "monstera"],
      densidad: 1.3,
      maceta: "#6b6a63",
      luces: { guirnalda: false, antorchas: true, farol: "piedra" },
      botes: "lancha",
      silla: "teca",
      cama: "teca",
      mesa: "madera",
      camino: "#2f6a36",
      flor: "#fff8e8",
      pisoTerraza: "baldosa",
      tumbona: { marco: "#4f3523", cojin: "#efe6d4" },
      poste: "#3a281b",
    },
    luz: luzTropical(
      { cieloArriba: "#3b90d6", cieloHorizonte: "#d3ecea", aguaProfunda: "#07707a", aguaSomera: "#1aa898", aguaReflejo: "#cdeee6", aguaClara: "#7fd8bf", hemiCielo: "#eef7ea", hemiSuelo: "#9a8466", solI: 3.0 },
      { cieloArriba: "#4d5f8a", cieloHorizonte: "#f0a873", aguaProfunda: "#0f4a52", aguaSomera: "#2a7a72", aguaReflejo: "#e6a982", aguaClara: "#5ea896", hemiCielo: "#f6d6b8", hemiSuelo: "#5a4030", calidas: 0.8 },
      { cieloArriba: "#040c14", cieloHorizonte: "#132530", aguaProfunda: "#02141a", aguaSomera: "#062a2e", aguaReflejo: "#1a3038", aguaClara: "#0a3a3a", hemiCielo: "#2a4250", hemiSuelo: "#1a120a", calidas: 1.6 },
    ),
  },
  coral: {
    piedra: "#f1e3d3",
    arena: "#f7ecdf",
    muro: "#fbf3ea",
    remate: "#f2b8a2",
    pisoSalon: ["#efe6da", "#e7dccd"],
    pisoCocina: ["#eeebe6", "#e4e0da"],
    pisoBar: ["#f6efe6", "#eadfd1"],
    muelle: ["#ece2d4", "#e2d6c5", "#c9b9a4"],
    terraza: ["#f7f1ea", "#efe6dc"],
    punta: ["#e8ddcd", "#ddd0be", "#c4b39d"],
    canto: "#e6d8c6",
    grama: "#8fbf78",
    borde: "#f6d9cc",
    baranda: "#ffffff",
    pergola: "#fbf6f0",
    pilote: "#d9c9b5",
    mantel: "#fffaf5",
    silla: { marco: "#f2a58c", cojin: "#fdf6ee" },
    plato: "#ffffff",
    servilleta: "#a8e0cf",
    copa: "#f2f8f6",
    vela: "#ffffff",
    cama: { base: "#fdf6ee", cojin: "#a8e0cf", acento: "#f08f74" },
    gazebo: "#ffffff",
    tela: "#ffffff",
    palma: { tronco: "#b8a089", hoja: "#4f9a4a", hoja2: "#72b35a" },
    bote: { casco: "#ffffff", cabina: "#f08f74" },
    barra: { base: "#f2b8a2", tope: "#ffffff", estante: "#a8e0cf" },
    cocina: { mueble: "#ece6e0", tope: "#d6cec6" },
    figura: { piel: PIEL_SOL, ropa: ["#f6c3b2", "#a8e0cf", "#ffffff", "#f08f74", "#f4ecdf", "#9fd3e6", "#f7dca8", "#ffffff"], pelo: PELO, uniforme: "#ffffff", pantalon: "#a8e0cf", cocina: "#ffffff" },
    aro: 0.07,
    sombraBlob: 0.18,
    vetas: 0.4,
    deco: {
      techo: "buganvilla",
      gazebo: "cupula",
      sombrilla: { tipo: "flecos", tela: "#f6c3b2", franja: "#ffffff", asta: "#ffffff" },
      playa: true,
      plantas: ["buganvilla", "palmita", "agave", "buganvilla"],
      densidad: 0.7,
      maceta: "#f8efe6",
      luces: { guirnalda: true, antorchas: false, farol: "esfera" },
      botes: "lancha",
      silla: "concha",
      cama: "sofa",
      mesa: "mantel",
      pisoTerraza: "terrazo",
      tumbona: { marco: "#ffffff", cojin: "#a8e0cf" },
      poste: "#ffffff",
    },
    luz: luzTropical(
      { cieloArriba: "#4aa2e6", cieloHorizonte: "#f3ebe4", aguaProfunda: "#1294aa", aguaSomera: "#3ed2c8", aguaReflejo: "#e2f6f6", aguaClara: "#aef0e0", hemiCielo: "#fff4ee", hemiSuelo: "#f0d2c0" },
      { cieloArriba: "#7a86b6", cieloHorizonte: "#ffc3a6", aguaProfunda: "#256c80", aguaSomera: "#4aa6a6", aguaReflejo: "#ffcab4", aguaClara: "#86d0c4", hemiCielo: "#ffe4d8", hemiSuelo: "#b98a78" },
      { cieloArriba: "#0d1430", cieloHorizonte: "#33305a", aguaProfunda: "#071a2c", aguaSomera: "#0e3444", aguaReflejo: "#3a3a62", aguaClara: "#16505a", hemiCielo: "#4a4a80", hemiSuelo: "#2a1c18" },
    ),
  },
}
