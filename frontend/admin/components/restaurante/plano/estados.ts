import type { Estado, EstadoMesa, Mesa } from "@/lib/restaurante/tipos"

export const ESTADO_MESA: Record<EstadoMesa, { nombre: string; color: string; texto: string }> = {
  libre: { nombre: "Libre", color: "#7FCFCB", texto: "#0B2A2E" },
  reservada: { nombre: "Reservada", color: "#9B8CE8", texto: "#0B2A2E" },
  ocupada: { nombre: "Por ordenar", color: "#F2C14E", texto: "#0B2A2E" },
  en_cocina: { nombre: "En cocina", color: "#E8866A", texto: "#0B2A2E" },
  servida: { nombre: "Servida", color: "#6BBF8A", texto: "#0B2A2E" },
  cuenta: { nombre: "Pidió la cuenta", color: "#E86A9B", texto: "#0B2A2E" },
  limpieza: { nombre: "Limpieza", color: "#AEB5AA", texto: "#0B2A2E" },
}

export const ORDEN_ESTADOS: EstadoMesa[] = ["libre", "reservada", "ocupada", "en_cocina", "servida", "cuenta", "limpieza"]

function reloj(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function chipMesa(mesa: Mesa, estado: Estado, ahora: number): { texto: string; fondo: string; parpadea: boolean } | null {
  if (mesa.llamado?.tipo === "mesero") return { texto: "Llama", fondo: "#FFFFFF", parpadea: true }
  if (mesa.estado === "cuenta" || mesa.llamado?.tipo === "cuenta") return { texto: "Cuenta", fondo: ESTADO_MESA.cuenta.color, parpadea: true }
  if (mesa.estado === "reservada") {
    const r = estado.reservas.find((x) => x.id === mesa.reservaId)
    return { texto: r ? r.hora : "Reserva", fondo: ESTADO_MESA.reservada.color, parpadea: false }
  }
  const p = mesa.pedidoId ? estado.pedidos.find((x) => x.id === mesa.pedidoId) : undefined
  if (mesa.estado === "en_cocina" && p) {
    if (p.items.some((x) => x.estado === "listo")) return { texto: "Listo", fondo: ESTADO_MESA.servida.color, parpadea: true }
    const pendientes = p.items.filter((x) => x.estado !== "servido")
    if (pendientes.length) {
      const desde = Math.min(...pendientes.map((x) => x.enviado))
      const tarde = ahora - desde > 25 * 60 * 1000
      return { texto: reloj(ahora - desde), fondo: tarde ? "#F28B6E" : ESTADO_MESA.en_cocina.color, parpadea: tarde }
    }
  }
  if (mesa.estado === "ocupada") return { texto: "Ordenar", fondo: ESTADO_MESA.ocupada.color, parpadea: false }
  if (mesa.estado === "limpieza") return { texto: "Limpiar", fondo: ESTADO_MESA.limpieza.color, parpadea: false }
  return null
}
