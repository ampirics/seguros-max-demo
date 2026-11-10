import type { Estacion, Mesa, Persona, Zona } from "./tipos"

// Plano en casillas de 8 px, copiado de la foto aérea: el edificio en tierra, la terraza techada sobre el muelle,
// el muelle abierto con la grama y la punta con el gazebo.
export const ANCHO = 64;
export const ALTO = 46;
export const CASILLA = 8;

export const AREAS = {
  calle: { x: 0, y: 0, w: 64, h: 2 },
  edificio: { x: 1, y: 2, w: 62, h: 10 },
  cocina: { x: 2, y: 3, w: 19, h: 8 },
  salon: { x: 22, y: 3, w: 18, h: 8 },
  bar: { x: 41, y: 3, w: 21, h: 8 },
  arena: { x: 0, y: 12, w: 64, h: 1 },
  muelle: { x: 13, y: 13, w: 38, h: 31 },
  terraza: { x: 14, y: 13, w: 36, h: 10 },
  grama: { x: 16, y: 25, w: 8, h: 6 },
  punta: { x: 13, y: 35, w: 38, h: 9 },
};

export const PUERTA = { x: 47, y: 11 };
export const PASE = { x: 12, y: 11 };
export const CAJA = { x: 52, y: 8 };

export const PUESTOS_COCINA: Record<Estacion, { x: number; y: number }> = {
  caliente: { x: 5, y: 6 },
  fria: { x: 11, y: 6 },
  postres: { x: 17, y: 6 },
};

type Base = Pick<Mesa, "id" | "nombre" | "zona" | "capacidad" | "x" | "y">;

const m = (id: string, zona: Zona, capacidad: number, x: number, y: number, nombre?: string): Base => ({
  id,
  nombre: nombre ?? id,
  zona,
  capacidad,
  x,
  y,
});

export const MESAS_BASE: Base[] = [
  m("T1", "terraza", 4, 19, 16),
  m("T2", "terraza", 4, 25, 16),
  m("T3", "terraza", 6, 31, 16),
  m("T4", "terraza", 4, 37, 16),
  m("T5", "terraza", 4, 43, 16),
  m("T6", "terraza", 2, 19, 20),
  m("T7", "terraza", 4, 25, 20),
  m("T8", "terraza", 6, 31, 20),
  m("T9", "terraza", 4, 37, 20),
  m("T10", "terraza", 2, 43, 20),
  m("M1", "muelle", 4, 29, 26),
  m("M2", "muelle", 4, 35, 26),
  m("M3", "muelle", 2, 41, 26),
  m("M4", "muelle", 2, 47, 26),
  m("M5", "muelle", 4, 29, 31),
  m("M6", "muelle", 6, 35, 31),
  m("M7", "muelle", 2, 41, 31),
  m("M8", "muelle", 2, 47, 31),
  m("G1", "gazebo", 2, 18, 39, "Cama 1"),
  m("G2", "gazebo", 2, 25, 39, "Cama 2"),
  m("G3", "gazebo", 4, 39, 39, "Cama 3"),
  m("G4", "gazebo", 2, 32, 38, "Gazebo"),
  m("S1", "salon", 12, 27, 7, "Salón A"),
  m("S2", "salon", 8, 35, 7, "Salón B"),
];

export const EQUIPO_BASE: Omit<Persona, "tarea">[] = [
  { id: "carolina", nombre: "Carolina", rol: "anfitriona", color: "#E8866A", zonas: ["terraza", "muelle", "gazebo", "salon"] },
  { id: "yanelis", nombre: "Yanelis", rol: "mesero", color: "#7FCFCB", zonas: ["terraza"] },
  { id: "junior", nombre: "Junior", rol: "mesero", color: "#F2C14E", zonas: ["terraza", "salon"] },
  { id: "ramon", nombre: "Ramón", rol: "mesero", color: "#9B8CE8", zonas: ["muelle"] },
  { id: "wendy", nombre: "Wendy", rol: "mesero", color: "#E86A9B", zonas: ["gazebo", "muelle"] },
  { id: "marino", nombre: "Chef Marino", rol: "cocina", estacion: "caliente", color: "#F4ECDF", zonas: [] },
  { id: "rosa", nombre: "Rosa", rol: "cocina", estacion: "fria", color: "#F4ECDF", zonas: [] },
  { id: "pedro", nombre: "Pedro", rol: "cocina", estacion: "postres", color: "#F4ECDF", zonas: [] },
];

export const REPOSO: Record<string, { x: number; y: number }> = {
  carolina: { x: 48, y: 12 },
  yanelis: { x: 16, y: 14 },
  junior: { x: 22, y: 12 },
  ramon: { x: 26, y: 24 },
  wendy: { x: 30, y: 35 },
};
