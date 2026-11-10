import { fechaLocal, sumarDias } from "@/lib/restaurante/local"
import type { Cliente, Reserva } from "@/lib/restaurante/tipos"

const DIA = 24 * 3600 * 1000

export type Segmento = "todos" | "frecuentes" | "corporativos" | "ocasion" | "cumpleanos" | "nuevos" | "inactivos"

export const SEGMENTOS: { id: Segmento; nombre: string; detalle: string }[] = [
  { id: "todos", nombre: "Todos", detalle: "Todos los clientes con ficha" },
  { id: "frecuentes", nombre: "Frecuentes", detalle: "4 visitas o más, o marcados como frecuentes" },
  { id: "corporativos", nombre: "Corporativos", detalle: "Empresas, hoteles y cuentas aliadas" },
  { id: "ocasion", nombre: "Ocasión próxima", detalle: "Reserva con ocasión especial en los próximos 7 días" },
  { id: "cumpleanos", nombre: "Cumplen este mes", detalle: "Para invitarlos a celebrar" },
  { id: "nuevos", nombre: "Nuevos", detalle: "Sin visitas todavía o llegaron hace menos de 30 días" },
  { id: "inactivos", nombre: "Sin venir hace 30 días", detalle: "Vinieron antes y no han vuelto" },
]

export function enSegmento(s: Segmento, c: Cliente, reservas: Reserva[], ahora: number) {
  const hoy = fechaLocal(ahora)
  switch (s) {
    case "todos":
      return true
    case "frecuentes":
      return c.visitas >= 4 || c.etiqueta === "Cliente frecuente"
    case "corporativos":
      return !!c.empresa
    case "ocasion":
      return reservas.some((r) => r.clienteId === c.id && !!r.ocasion && r.fecha >= hoy && r.fecha <= sumarDias(hoy, 7) && !["cancelada", "no_show"].includes(r.estado))
    case "cumpleanos":
      return !!c.cumpleanos && c.cumpleanos.slice(0, 2) === hoy.slice(5, 7)
    case "nuevos":
      return c.visitas === 0 || ahora - c.creado < 30 * DIA
    case "inactivos":
      return c.visitas > 0 && !!c.ultimaVisita && ahora - c.ultimaVisita > 30 * DIA
  }
}

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
}

export function haceDias(ts: number | undefined, ahora: number) {
  if (!ts) return "Nunca"
  const d = Math.floor((ahora - ts) / DIA)
  if (d <= 0) return "Hoy"
  if (d === 1) return "Ayer"
  if (d < 30) return `Hace ${d} días`
  const m = Math.floor(d / 30)
  return m === 1 ? "Hace un mes" : `Hace ${m} meses`
}
