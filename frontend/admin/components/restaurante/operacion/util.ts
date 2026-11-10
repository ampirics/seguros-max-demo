import type { EstadoItem, Plato } from "@/lib/restaurante/tipos"

export function reloj(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export const fotoDe = (p: Pick<Plato, "foto">) => (p.foto ? `/boca-marina/${p.foto}` : null)

export const ESTADO_ITEM: Record<EstadoItem, { nombre: string; color: string; paraCliente: string }> = {
  pendiente: { nombre: "En cola", color: "#AEB5AA", paraCliente: "En cola" },
  preparando: { nombre: "Preparando", color: "#F2C14E", paraCliente: "Preparándose" },
  listo: { nombre: "Listo", color: "#6BBF8A", paraCliente: "Saliendo" },
  servido: { nombre: "Servido", color: "#7FCFCB", paraCliente: "Servido" },
}

export const QUITAR = ["Sin cebolla", "Sin ajo", "Sin picante", "Sin sal", "Sin mantequilla", "Salsa aparte", "Bien dorado"]

export const esAviso = (mod: string) => /^sin |salsa aparte|alerg/i.test(mod)

export function cantidadTexto(cantidad: number, porLibra?: boolean) {
  if (porLibra) return `${cantidad} lb`
  return cantidad === 1 ? "" : `${cantidad}x`
}
