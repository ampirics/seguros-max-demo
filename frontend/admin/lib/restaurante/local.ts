import type { Canal, Zona } from "./tipos";

export const ZONA_HORARIA = "America/Santo_Domingo";

export const NEGOCIO = {
  nombre: "Boca Marina",
  subtitulo: "Restaurant & Lounge",
  direccion: "Calle Prolongación Duarte 12-A, Boca Chica",
  whatsapp: "829-642-9442",
  horario: "Todos los días de 9:00 a. m. a 12:30 a. m.",
  primeraReserva: "10:30",
  ultimaReserva: "23:00",
  grupoMaximo: 12,
};

export const ZONAS: { id: Zona; nombre: string; descripcion: string }[] = [
  { id: "terraza", nombre: "Terraza techada", descripcion: "Bajo techo sobre el muelle, protegida del sol y la lluvia" },
  { id: "muelle", nombre: "Muelle frente al mar", descripcion: "Al aire libre sobre el agua, la vista del atardecer" },
  { id: "gazebo", nombre: "Gazebo y camas balinesas", descripcion: "En la punta del muelle, para parejas y ocasiones especiales" },
  { id: "salon", nombre: "Salón privado", descripcion: "Para comidas de negocios y grupos de hasta 12" },
];

export const NOMBRE_ZONA: Record<Zona, string> = Object.fromEntries(ZONAS.map((z) => [z.id, z.nombre])) as Record<
  Zona,
  string
>;

export const NOMBRE_CANAL: Record<Canal | "correo", string> = {
  correo: "Correo",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Sitio web",
  telefono: "Teléfono",
  voz: "Asistente de voz",
  presencial: "En persona",
};

const fmtFecha = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit", hour12: false });

export function fechaLocal(ts: number) {
  return fmtFecha.format(new Date(ts));
}

export function horaLocal(ts: number) {
  return fmtHora.format(new Date(ts));
}

export function minutosDelDia(ts: number) {
  const [h, m] = horaLocal(ts).split(":").map(Number);
  return h * 60 + m;
}

// Santo Domingo no cambia de horario: siempre UTC-4.
export function tsLocal(fecha: string, hora: string) {
  return Date.parse(`${fecha}T${hora}:00-04:00`);
}

export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00-04:00`);
  d.setUTCDate(d.getUTCDate() + dias);
  return fechaLocal(d.getTime());
}

export function hora12(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const sufijo = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

const fmtDia = new Intl.DateTimeFormat("es-DO", { timeZone: ZONA_HORARIA, weekday: "long", day: "numeric", month: "long" });

export function diaLargo(fecha: string) {
  return fmtDia.format(new Date(`${fecha}T12:00:00-04:00`));
}

export function hace(ts: number, ahora: number) {
  const s = Math.max(0, Math.round((ahora - ts) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function cronometro(ts: number, ahora: number) {
  const s = Math.max(0, Math.round((ahora - ts) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
