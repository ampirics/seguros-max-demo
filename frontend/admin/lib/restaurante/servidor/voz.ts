import crypto from "node:crypto"
import { ejecutarHerramienta } from "./ia"
import { fechaLocal, horaLocal, sumarDias, ZONA_HORARIA } from "../local"
import { agregarMensaje, asegurarCliente, asegurarConversacion, estado } from "./motor"

// Herramientas del agente de voz de ElevenLabs: las mismas de la IA de WhatsApp, con el cliente identificado por el
// número que llama. Cada llamada queda en la conversación del cliente en la bandeja.
export const HERRAMIENTAS_VOZ = new Set([
  "info_restaurante",
  "consultar_disponibilidad",
  "crear_reserva",
  "reservas_del_cliente",
  "modificar_reserva",
  "cancelar_reserva",
  "confirmar_asistencia",
  "consultar_carta",
  "actualizar_ficha",
  "pasar_a_equipo",
  "resumen_llamada",
])

const CON_CALENDARIO = new Set(["info_restaurante", "consultar_disponibilidad", "reservas_del_cliente"])

function calendario() {
  const ahora = Date.now()
  const hoy = fechaLocal(ahora)
  const dia = (f: string) =>
    new Intl.DateTimeFormat("es-DO", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA_HORARIA }).format(new Date(`${f}T12:00:00-04:00`))
  return {
    hoy: `${dia(hoy)} (${hoy}), son las ${horaLocal(ahora)}`,
    proximos_dias: Array.from({ length: 14 }, (_, i) => `${dia(sumarDias(hoy, i + 1))} = ${sumarDias(hoy, i + 1)}`),
  }
}

const PROPIOS = ["telefono_llamada", "telefono_cliente", "nombre_cliente", "llamada_id"]
const atendidas = new Set<string>()

export function claveVozValida(recibida: string | null) {
  const esperada = process.env.VOZ_SECRETO ?? ""
  if (!esperada || !recibida) return false
  const a = Buffer.from(recibida)
  const b = Buffer.from(esperada)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function herramientaVoz(nombre: string, cuerpo: Record<string, any>) {
  const llamada = String(cuerpo.telefono_llamada ?? "").trim()
  const tel = /\d{7,}/.test(llamada.replace(/\D/g, "")) ? llamada : String(cuerpo.telefono_cliente ?? "").trim()
  if (tel.replace(/\D/g, "").length < 7) {
    return { ok: false, motivo: "Falta el teléfono del cliente. Pídeselo y vuelve a llamar la herramienta con telefono_cliente." }
  }
  const nombreCliente = String(cuerpo.nombre_cliente ?? "").trim()
  const c = asegurarCliente(nombreCliente || "Cliente por teléfono", tel, "voz")
  if (nombreCliente && c.nombre === "Cliente por teléfono") c.nombre = nombreCliente
  const conv = asegurarConversacion(c.id, "voz", "Llamada")
  const llamadaId = String(cuerpo.llamada_id ?? "")
  if (!atendidas.has(llamadaId || conv.id)) {
    atendidas.add(llamadaId || conv.id)
    agregarMensaje(conv.id, { de: "sistema", texto: `Llamada de ${tel} atendida por el agente de voz` })
  }
  if (nombre === "resumen_llamada") {
    agregarMensaje(conv.id, { de: "ia", texto: String(cuerpo.resumen ?? "").trim() || "Llamada terminada", autor: "Agente de voz" })
    return { ok: true }
  }
  const params = Object.fromEntries(Object.entries(cuerpo).filter(([k, v]) => !PROPIOS.includes(k) && v !== "" && v != null))
  const r = ejecutarHerramienta(nombre, params, conv.id)
  agregarMensaje(conv.id, { de: "ia", texto: `En la llamada: ${r.paso.resumen}`, autor: "Agente de voz", pasos: [r.paso] })
  return CON_CALENDARIO.has(nombre) ? { ...(r.datos as object), ...calendario() } : r.datos
}

export const clienteDeLlamada = (tel: string) => estado().clientes.find((c) => c.telefono.replace(/\D/g, "").slice(-10) === tel.replace(/\D/g, "").slice(-10))
