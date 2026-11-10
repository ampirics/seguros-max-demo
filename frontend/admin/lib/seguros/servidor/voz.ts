import crypto from "node:crypto"
import { MAX, diaSemana, fechaLocal, horaLocal } from "../catalogo"
import { CAMPOS_FICHA, ejecutarHerramienta, herramientas } from "./ia"
import { agregarMensaje, asegurarCliente, asegurarConversacion, clientePorTelefono, horario } from "./motor"

export const HERRAMIENTAS_VOZ = [
  "info_max",
  "procedimiento_siniestro",
  "abrir_solicitud",
  "actualizar_ficha",
  "registrar_consentimiento",
  "calificar_solicitud",
  "verificar_identidad",
  "polizas_del_cliente",
  "reportar_siniestro",
  "estado_siniestro",
  "responder_renovacion",
  "pasar_a_ejecutivo",
]

const PRIMER_MENSAJE = "MAX Corredores de Seguros, buenas. Le atiende el asistente digital de MAX. ¿En qué le puedo ayudar?"

const PROMPT = `# Quién eres
Eres el asistente digital de MAX Corredores de Seguros y atiendes llamadas. MAX es un corredor de seguros de República Dominicana con más de 47 años de experiencia, no una aseguradora: asesora a personas y empresas, compara opciones entre aseguradoras, gestiona la póliza y acompaña al asegurado en renovaciones y siniestros.

# Cómo hablas
- Español dominicano, cálido y profesional, de usted. Si la persona tutea, pasas a tú.
- Es una llamada: frases cortas, una pregunta a la vez, sin listas, sin símbolos, sin leer enlaces. Los números dílos como se dicen.
- Si preguntan si eres una persona, di con honestidad que eres el asistente digital de MAX y que un ejecutivo humano sigue el caso.
- Nunca pidas un dato que ya te dieron. Las herramientas te dicen qué falta en siguiente_pregunta: pregunta eso.

# Reglas que no se rompen
- Nunca des primas, precios, descuentos, deducibles ni montos: no los tienes. Las primas las da cada aseguradora y un ejecutivo las compara. Si piden precio, explícalo en una frase y sigue con lo que falta para cotizar.
- No garantices cobertura ni interpretes una póliza: si preguntan si algo está cubierto, pasa el caso a un ejecutivo con motivo cobertura.
- No confirmes la aceptación ni el pago de un siniestro: lo decide la aseguradora.
- No emitas, cambies ni canceles pólizas: cancelaciones y cambios pasan a servicio.
- Antes de dar datos de una póliza o un siniestro, verifica: pide los últimos cuatro dígitos de la cédula o RNC y usa verificar_identidad. Si la persona llama desde un número que no está registrado y dice que es asegurada, pregúntale con qué número está registrada y pásalo en telefono_cliente en todas las herramientas; igual tiene que verificar.
- No prometas tiempos. Para la espera usa la frase que te da la herramienta.
- Lo que digas de MAX sale de info_max. Lo que no esté ahí, dilo como algo que confirma el equipo.
- Lo que no hiciste con una herramienta no lo digas como hecho.

# Solicitudes nuevas
En cuanto sepas qué quieren asegurar, usa abrir_solicitud con el ramo. Cada vez que te den un dato, guárdalo de inmediato con actualizar_ficha y pregunta solo lo que diga siguiente_pregunta: no pidas otros datos (ni cédula, ni valor, ni financiamiento, ni seguro anterior) si la herramienta no los pide. Antes de pasar la solicitud, pide su autorización para guardar sus datos y contactarle para cotizar (registrar_consentimiento), explicando para qué en una frase. Con todo completo, usa calificar_solicitud y dile el nombre del ejecutivo que le prepara el comparativo y que lo recibe por WhatsApp a este número. A empresas no les recomiendes una póliza: un ejecutivo de empresas evalúa los riesgos.

# Siniestros
Lo primero siempre: pregunta si hay heridos o peligro; si los hay, que llame al 911 y se ponga a salvo. Para reportar un siniestro no hace falta verificar ni tener el número de póliza: toma el reporte siempre, aunque la persona no aparezca como asegurada (un analista ubica la póliza). Luego toma el reporte con reportar_siniestro (qué pasó, cuándo, dónde, si hay heridos o terceros). Di el código del caso despacio y los primeros pasos; los documentos díselos resumidos y avisa que se los mandamos por WhatsApp.

# Renovaciones
Si llama por un aviso de renovación, usa responder_renovacion con su decisión. La prima la confirma su ejecutivo.

# Pasar a una persona
Usa pasar_a_ejecutivo si pide una persona o que lo llamen, si es una queja, un pago, una pregunta de cobertura, una cancelación o un cambio de póliza, una empresa con necesidad técnica o si pide borrar sus datos. Dile a quién pasa y la frase de espera que te devuelve la herramienta.

# Al terminar
Antes de despedirte, usa resumen_llamada con una o dos frases de lo que pidió y lo que se hizo. Luego despídete y termina la llamada.`

const PROPIOS = ["telefono_llamada", "telefono_cliente", "llamada_id", "nombre_cliente"]
const atendidas = new Set<string>()

export function claveVozValida(recibida: string | null) {
  const esperada = process.env.VOZ_SECRETO ?? ""
  if (!esperada || !recibida) return false
  const a = Buffer.from(recibida)
  const b = Buffer.from(esperada)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

type Prop = { type: string; description?: string; enum?: string[] }

function propiedades(nombre: string, schema: { properties?: Record<string, any>; required?: string[] }) {
  if (nombre === "actualizar_ficha") {
    const props: Record<string, Prop> = Object.fromEntries(CAMPOS_FICHA.map((k) => [k, { type: "string", description: k === "anio" ? "Año en cuatro dígitos, por ejemplo 2023" : `Dato '${k}' tal como lo dijo la persona` }]))
    props.nombre = { type: "string", description: "Nombre de la persona" }
    props.ciudad = { type: "string", description: "Ciudad" }
    props.correo = { type: "string", description: "Correo, si lo dio" }
    return { properties: props, required: [] }
  }
  const props: Record<string, Prop> = {}
  for (const [k, v] of Object.entries(schema.properties ?? {})) {
    props[k] = { type: Array.isArray(v.type) ? "string" : v.type, description: v.description ?? k.replace(/_/g, " "), ...(v.enum && { enum: v.enum }) }
  }
  return { properties: props, required: schema.required ?? [] }
}

export function esquemaVoz() {
  const lista = herramientas
    .filter((h) => HERRAMIENTAS_VOZ.includes(h.name))
    .map((h) => ({ nombre: h.name, descripcion: (h as { description?: string }).description ?? h.name, ...propiedades(h.name, (h as { input_schema: any }).input_schema) }))
  lista.push({
    nombre: "resumen_llamada",
    descripcion: "Deja en la bandeja de MAX el resumen de la llamada. Úsala una vez, antes de despedirte.",
    properties: { resumen: { type: "string", description: "Una o dos frases con lo que pidió y lo que se hizo" } },
    required: ["resumen"],
  })
  return { primer_mensaje: PRIMER_MENSAJE, prompt: PROMPT, herramientas: lista }
}

const paraLlamada = (v: unknown): unknown =>
  typeof v === "string" ? v.replace("le escribe por aquí", "le contacta a este número") : Array.isArray(v) ? v.map(paraLlamada) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, paraLlamada(x)])) : v

export function herramientaVoz(nombre: string, cuerpo: Record<string, any>) {
  const llamada = String(cuerpo.telefono_llamada ?? "").trim()
  const dicho = String(cuerpo.telefono_cliente ?? "").trim()
  const valido = (t: string) => t.replace(/\D/g, "").length >= 7
  const tel = [dicho, llamada].find((t) => valido(t) && clientePorTelefono(t)) ?? (valido(llamada) ? llamada : dicho)
  if (!valido(tel)) return { ok: false, motivo: "Falta el teléfono de la persona. Pídeselo y vuelve a usar la herramienta con telefono_cliente." }

  const c = asegurarCliente(String(cuerpo.nombre_cliente ?? "").trim() || "Cliente nuevo", tel, "telefono")
  const conv = asegurarConversacion(c.id, "telefono", "Llamada")
  const llamadaId = String(cuerpo.llamada_id ?? "") || conv.id
  if (!atendidas.has(llamadaId)) {
    atendidas.add(llamadaId)
    agregarMensaje(conv.id, { de: "sistema", texto: `Llamada de ${llamada || tel} atendida por el asistente de voz${tel !== llamada && llamada ? ` (registrado con ${tel})` : ""}` })
  }

  if (nombre === "resumen_llamada") {
    agregarMensaje(conv.id, { de: "ia", texto: String(cuerpo.resumen ?? "").trim() || "Llamada terminada", autor: "Asistente de voz" })
    return { ok: true }
  }

  const params = Object.fromEntries(Object.entries(cuerpo).filter(([k, v]) => !PROPIOS.includes(k) && v !== "" && v != null))
  let e: Record<string, unknown> = params
  if (nombre === "actualizar_ficha") {
    const { nombre: n, ciudad, correo, ...resto } = params
    const datos = Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, /^\d+$/.test(String(v)) ? Number(v) : v]))
    e = { datos, nombre: n, ciudad, correo }
  }
  try {
    const r = ejecutarHerramienta(nombre, e, conv.id)
    agregarMensaje(conv.id, { de: "ia", texto: `En la llamada: ${r.paso.resumen}`, autor: "Asistente de voz", pasos: [r.paso] })
    const ahora = Date.now()
    return { ...(paraLlamada(r.datos) as object), ahora: `${diaSemana(ahora)} ${fechaLocal(ahora)}, ${horaLocal(ahora)}`, oficina_abierta: horario().abierto, emergencias: MAX.emergencias }
  } catch (err) {
    return { ok: false, motivo: (err as Error).message }
  }
}
