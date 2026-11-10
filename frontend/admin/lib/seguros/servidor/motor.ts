import { ASEGURADORA, CAMPO, DIA, EQUIPO, ESTADO_SINIESTRO, MAX, NOMBRE_AREA, NOMBRE_CANAL, NOMBRE_ETAPA, PERSONA, PROCEDIMIENTOS, RAMO, rd, fechaCorta, horaLocal, diaSemana } from "../catalogo"
import type {
  Area,
  Canal,
  Cliente,
  Conversacion,
  CotizacionAseguradora,
  Estado,
  EstadoRenovacion,
  EstadoSiniestro,
  Etapa,
  Evento,
  Mensaje,
  Oportunidad,
  PasoIA,
  Poliza,
  Ramo,
  Siniestro,
  TipoSiniestro,
} from "../tipos"
import { bienDe, crearHistoria, ejecutivoPara, prefijoPoliza } from "./historia"
import { sembrarConversaciones } from "./conversaciones"

export type Aviso =
  | { tipo: "estado"; estado: Estado }
  | { tipo: "mensaje"; mensaje: Mensaje; conversacion: Conversacion }
  | { tipo: "conversacion"; conversacion: Conversacion }
  | { tipo: "escribiendo"; conversacionId: string; activo: boolean }

type Suscriptor = (a: Aviso) => void

interface Motor {
  estado: Estado
  mensajes: Map<string, Mensaje[]>
  suscriptores: Set<Suscriptor>
  contadores: { op: number; sin: number; pol: number; id: number }
  sucio: boolean
  reloj?: ReturnType<typeof setInterval>
  respondedor?: (convId: string) => Promise<void>
  archivos: Map<string, { datos: Buffer; mime: string; nombre: string }>
}

const g = globalThis as unknown as { __maxSeguros?: Motor }

function motor(): Motor {
  if (!g.__maxSeguros) {
    g.__maxSeguros = { estado: undefined as unknown as Estado, mensajes: new Map(), suscriptores: new Set(), contadores: { op: 0, sin: 0, pol: 0, id: 1000 }, sucio: false, archivos: new Map() }
    iniciar()
  }
  const mt = g.__maxSeguros
  if (!mt.reloj) mt.reloj = setInterval(publicar, 1000)
  return mt
}

export function id(prefijo: string) {
  const mt = g.__maxSeguros!
  return `${prefijo}${(++mt.contadores.id).toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export const estado = () => motor().estado
export const mensajesDe = (convId: string) => motor().mensajes.get(convId) ?? []
export const archivo = (archivoId: string) => motor().archivos.get(archivoId)

export function definirRespondedor(fn: (convId: string) => Promise<void>) {
  motor().respondedor = fn
}

export function suscribir(fn: Suscriptor) {
  const mt = motor()
  mt.suscriptores.add(fn)
  return () => void mt.suscriptores.delete(fn)
}

function avisar(a: Aviso) {
  for (const fn of motor().suscriptores) {
    try {
      fn(a)
    } catch {
      motor().suscriptores.delete(fn)
    }
  }
}

export function marcar() {
  motor().sucio = true
}

function publicar() {
  const mt = g.__maxSeguros
  if (!mt?.sucio) return
  mt.sucio = false
  mt.estado.version++
  mt.estado.ahora = Date.now()
  avisar({ tipo: "estado", estado: mt.estado })
}

export function log(e: Omit<Evento, "id" | "ts">, ts = Date.now()) {
  const est = motor().estado
  est.eventos.unshift({ id: id("e"), ts, ...e })
  if (est.eventos.length > 250) est.eventos.length = 250
  marcar()
}

export function guardarArchivo(datos: Buffer, mime: string, nombre: string) {
  const a = id("a-")
  motor().archivos.set(a, { datos, mime, nombre })
  return { id: a, url: `/srv/seguros/archivos/${a}`, nombre }
}

// ---------- arranque ----------

function iniciar() {
  const mt = g.__maxSeguros!
  const ahora = Date.now()
  const h = crearHistoria(ahora)
  mt.contadores = { op: h.contadores.op, sin: h.contadores.sin, pol: h.contadores.pol, id: 1000 }
  mt.estado = {
    ahora,
    version: 1,
    clientes: h.clientes,
    polizas: h.polizas,
    oportunidades: h.oportunidades,
    siniestros: h.siniestros,
    conversaciones: [],
    equipo: EQUIPO,
    eventos: [],
    config: { iaActiva: true, horario: { abre: "08:30", cierra: "17:30", sabado: "09:00-13:00" } },
  }
  const s = sembrarConversaciones(ahora, mt.estado, { nuevoCodigoOp: () => ++mt.contadores.op, nuevoCodigoSin: () => ++mt.contadores.sin })
  mt.estado.conversaciones = s.conversaciones
  mt.mensajes = s.mensajes
  for (const o of mt.estado.oportunidades) o.faltantes = faltantesDe(o)
  const recientes = mt.estado.oportunidades.filter((o) => o.creada > ahora - 2 * DIA).sort((a, b) => b.creada - a.creada).slice(0, 8)
  for (const o of recientes) mt.estado.eventos.push({ id: id("e"), ts: o.creada, tipo: "oportunidad", texto: `${o.codigo}: ${o.resumen}`, enlace: `/admin/oportunidades/${o.id}` })
  mt.estado.eventos.sort((a, b) => b.ts - a.ts)
}

export function reiniciar() {
  const mt = motor()
  const config = mt.estado.config
  iniciar()
  mt.estado.config = config
  marcar()
}

// ---------- ficha, faltantes y pase ----------

export const vacio = (v: unknown) => v === undefined || v === null || v === ""

/** Lo que falta para que un ejecutivo pueda cotizar, en el orden en que se pregunta. Sale de la ficha, no del texto del bot. */
export function faltantesDe(o: Oportunidad): string[] {
  const est = motor().estado
  const c = est.clientes.find((x) => x.id === o.clienteId)
  const falta = RAMO[o.ramo].requeridos.filter((k) => vacio(o.ficha[k]))
  if (c && (c.nombre === "Cliente nuevo" || c.nombre.startsWith("+"))) falta.push("nombre")
  if (c && !c.consentimiento && o.creadaPor === "ia" && ["nueva", "calificada"].includes(o.etapa)) falta.push("consentimiento")
  return falta
}

export function horario(ahora = Date.now()) {
  const { abre, cierra, sabado } = motor().estado.config.horario
  const dia = diaSemana(ahora)
  const h = horaLocal(ahora)
  const [sa, sc] = sabado.split("-")
  if (dia === "domingo") return { abierto: false, vuelve: `el lunes desde las ${abre}` }
  if (dia === "sábado") return h >= sa && h < sc ? { abierto: true, vuelve: "" } : { abierto: false, vuelve: h < sa ? `hoy desde las ${sa}` : `el lunes desde las ${abre}` }
  if (h >= abre && h < cierra) return { abierto: true, vuelve: "" }
  return { abierto: false, vuelve: h < abre ? `hoy desde las ${abre}` : dia === "viernes" ? `el sábado desde las ${sa}` : `mañana desde las ${abre}` }
}

/** Línea de espera honesta: sin minutos prometidos. */
export function lineaEspera(area: Area, nombre?: string, ahora = Date.now()) {
  const h = horario(ahora)
  const quien = nombre ? nombre.split(" ")[0] : area === "siniestros" ? "el analista de siniestros" : area === "servicio" ? "servicio al cliente" : "su ejecutivo"
  return h.abierto ? `En cuanto ${quien} se desocupe le escribe por aquí.` : `Ahora la oficina está cerrada; ${quien} le escribe ${h.vuelve}. Para una emergencia: ${MAX.emergencias[0].telefono}.`
}

/** Resumen para la persona que toma la conversación, armado con reglas desde el estado. */
export function briefDe(convId: string, motivo: string): string[] {
  const est = motor().estado
  const conv = est.conversaciones.find((c) => c.id === convId)!
  const c = est.clientes.find((x) => x.id === conv.clienteId)!
  const o = conv.oportunidadId ? est.oportunidades.find((x) => x.id === conv.oportunidadId) : undefined
  const s = conv.siniestroId ? est.siniestros.find((x) => x.id === conv.siniestroId) : undefined
  const pols = est.polizas.filter((p) => p.clienteId === c.id && ["vigente", "por_renovar"].includes(p.estado))
  const lineas = [`${c.nombre}${c.segmento === "empresa" ? ` (${c.sector ?? "empresa"})` : ""}, ${c.telefono}, ${NOMBRE_CANAL[conv.canal]}.`]
  lineas.push(pols.length ? `Asegurado de MAX: ${pols.length} ${pols.length === 1 ? "póliza vigente" : "pólizas vigentes"} (${pols.map((p) => RAMO[p.ramo].nombre.toLowerCase()).join(", ")}).` : "Prospecto nuevo, sin pólizas con MAX.")
  if (o) {
    const datos = Object.entries(o.ficha).filter(([, v]) => !vacio(v)).map(([k, v]) => `${CAMPO[k] ?? k}: ${typeof v === "boolean" ? (v ? "sí" : "no") : v}`)
    lineas.push(`${o.codigo}, ${RAMO[o.ramo].nombre}. ${datos.join("; ")}.`)
    if (o.faltantes.length) lineas.push(`Falta: ${o.faltantes.map((k) => (CAMPO[k] ?? k).toLowerCase()).join(", ")}.`)
  }
  if (s) lineas.push(`${s.codigo}, ${PROCEDIMIENTOS[s.tipo].nombre.toLowerCase()} del ${fechaCorta(s.ocurrido)} en ${s.lugar}. ${s.lesionados ? "Con lesionados. " : ""}${s.documentos.filter((d) => !d.recibido).length} documentos pendientes.`)
  lineas.push(`Motivo: ${motivo}. ${c.consentimiento ? "Autorizó el uso de sus datos." : "No ha autorizado el uso de sus datos."}`)
  return lineas
}

export function pasarA(convId: string, area: Area, motivo: string) {
  const est = motor().estado
  const conv = est.conversaciones.find((c) => c.id === convId)!
  const c = est.clientes.find((x) => x.id === conv.clienteId)!
  const o = conv.oportunidadId ? est.oportunidades.find((x) => x.id === conv.oportunidadId) : undefined
  const asignado = area === "siniestros" ? (c.sucursal === "santiago" ? "ana" : "julio") : area === "servicio" ? "yesenia" : o?.ejecutivoId ?? c.ejecutivoId
  conv.pase = { motivo, area, brief: briefDe(convId, motivo), desde: Date.now() }
  actualizarConversacion(convId, { estado: "esperando_equipo", asignadoA: asignado, etiquetas: Array.from(new Set([...conv.etiquetas, NOMBRE_AREA[area]])) })
  log({ tipo: "conversacion", texto: `${c.nombre} pasa a ${NOMBRE_AREA[area].toLowerCase()}: ${motivo}`, enlace: `/admin/chat?conversacion=${conv.id}` })
  return { asignado: PERSONA[asignado], conv }
}

// ---------- conversaciones ----------

export function clientePorTelefono(telefono: string) {
  const t = telefono.replace(/\D/g, "").slice(-10)
  return motor().estado.clientes.find((c) => c.telefono.replace(/\D/g, "").slice(-10) === t)
}

export function asegurarCliente(nombre: string, telefono: string, canal: Canal) {
  const est = motor().estado
  let c = clientePorTelefono(telefono)
  if (!c) {
    const ahora = Date.now()
    c = { id: id("cl-"), segmento: "persona", nombre: nombre || "Cliente nuevo", documento: "", telefono, ciudad: "", sucursal: "santo_domingo", ejecutivoId: "patricia", desde: ahora, etiquetas: ["Prospecto"], recorrido: [{ ts: ahora, tipo: "contacto", texto: `Primer contacto por ${NOMBRE_CANAL[canal]}` }] }
    est.clientes.unshift(c)
    marcar()
  }
  return c
}

export function asegurarConversacion(clienteId: string, canal: Canal, tema: string) {
  const est = motor().estado
  const c = est.clientes.find((x) => x.id === clienteId)
  let conv = c?.conversacionId ? est.conversaciones.find((x) => x.id === c.conversacionId) : undefined
  if (!conv) {
    const ahora = Date.now()
    conv = { id: id("conv-"), clienteId, canal, tema, estado: "ia", noLeidos: 0, etiquetas: [], creada: ahora, actualizada: ahora }
    est.conversaciones.unshift(conv)
    motor().mensajes.set(conv.id, [])
    if (c) {
      c.conversacionId = conv.id
      c.recorrido.push({ ts: ahora, tipo: "conversacion", texto: `Conversación por ${NOMBRE_CANAL[canal]}`, enlace: `/admin/chat?conversacion=${conv.id}` })
    }
    avisar({ tipo: "conversacion", conversacion: conv })
  }
  return conv
}

export function agregarMensaje(convId: string, m: { de: Mensaje["de"]; texto: string; autor?: string; pasos?: PasoIA[]; voz?: { segundos: number }; adjunto?: Mensaje["adjunto"] }) {
  const mt = motor()
  const conv = mt.estado.conversaciones.find((x) => x.id === convId)
  if (!conv) throw new Error("No existe la conversación")
  const msg: Mensaje = { id: id("m-"), conversacionId: convId, ts: Date.now(), de: m.de, texto: m.texto, autor: m.autor ?? (m.de === "ia" ? "Asistente de MAX" : undefined), pasos: m.pasos, voz: m.voz, adjunto: m.adjunto }
  const lista = mt.mensajes.get(convId) ?? []
  if (m.de === "ia" && conv.primeraRespuestaSeg === undefined) {
    const primero = lista.find((x) => x.de === "cliente")
    if (primero) conv.primeraRespuestaSeg = Math.round((msg.ts - primero.ts) / 1000)
  }
  lista.push(msg)
  mt.mensajes.set(convId, lista)
  conv.actualizada = msg.ts
  if (m.de === "cliente") conv.noLeidos++
  avisar({ tipo: "mensaje", mensaje: msg, conversacion: conv })
  marcar()
  return msg
}

export function actualizarConversacion(convId: string, cambios: Partial<Pick<Conversacion, "estado" | "asignadoA" | "noLeidos" | "etiquetas" | "tema" | "oportunidadId" | "siniestroId" | "trato">>) {
  const conv = motor().estado.conversaciones.find((x) => x.id === convId)
  if (!conv) throw new Error("No existe la conversación")
  Object.assign(conv, cambios)
  if (cambios.estado === "ia" || cambios.estado === "cerrada") conv.pase = cambios.estado === "ia" ? undefined : conv.pase
  avisar({ tipo: "conversacion", conversacion: conv })
  marcar()
  return conv
}

export function escribiendo(convId: string, activo: boolean) {
  avisar({ tipo: "escribiendo", conversacionId: convId, activo })
}

export function recibirDeCliente(o: { telefono: string; nombre?: string; texto: string; canal?: Canal; adjunto?: Mensaje["adjunto"]; voz?: { segundos: number } }) {
  const canal = o.canal ?? "whatsapp"
  const c = asegurarCliente(o.nombre ?? "", o.telefono, canal)
  const conv = asegurarConversacion(c.id, canal, "Conversación nueva")
  if (conv.estado === "cerrada") actualizarConversacion(conv.id, { estado: "ia" })
  const msg = agregarMensaje(conv.id, { de: "cliente", texto: o.texto, adjunto: o.adjunto, voz: o.voz })
  const mt = motor()
  if (conv.estado === "ia" && mt.estado.config.iaActiva && mt.respondedor) {
    void mt.respondedor(conv.id).catch((e) => {
      agregarMensaje(conv.id, { de: "sistema", texto: `La IA no pudo responder (${(e as Error).message}). La conversación pasa al equipo.` })
      pasarA(conv.id, "servicio", "la IA no pudo responder")
    })
  }
  return { conversacion: conv, mensaje: msg, cliente: c }
}

// ---------- oportunidades ----------

export function crearOportunidad(o: { clienteId: string; ramo: Ramo; origen: Oportunidad["origen"]; ficha?: Oportunidad["ficha"]; conversacionId?: string; creadaPor: Oportunidad["creadaPor"] }) {
  const mt = motor()
  const est = mt.estado
  const c = est.clientes.find((x) => x.id === o.clienteId)!
  const ahora = Date.now()
  const n = ++mt.contadores.op
  const seg = c.segmento === "empresa" || RAMO[o.ramo].segmento === "empresa" ? "empresa" : "persona"
  const op: Oportunidad = {
    id: id("op-"),
    codigo: `OP-${String(n).padStart(4, "0")}`,
    clienteId: c.id,
    segmento: seg,
    ramo: o.ramo,
    origen: o.origen,
    etapa: "nueva",
    prioridad: seg === "empresa" ? "alta" : "media",
    puntuacion: 40,
    sucursal: c.sucursal,
    creada: ahora,
    actualizada: ahora,
    primerContacto: o.creadaPor === "ia" ? ahora : undefined,
    ficha: { ...(o.ficha ?? {}) },
    faltantes: [],
    resumen: RAMO[o.ramo].nombre,
    cotizaciones: [],
    conversacionId: o.conversacionId,
    historial: [{ ts: ahora, texto: o.creadaPor === "ia" ? "La IA abrió la solicitud desde la conversación" : "Solicitud registrada", quien: o.creadaPor === "ia" ? "IA" : undefined }],
    creadaPor: o.creadaPor,
  }
  op.faltantes = faltantesDe(op)
  est.oportunidades.unshift(op)
  c.recorrido.push({ ts: ahora, tipo: "oportunidad", texto: `Solicitud de ${RAMO[o.ramo].nombre.toLowerCase()} (${op.codigo})`, enlace: `/admin/oportunidades/${op.id}` })
  log({ tipo: "oportunidad", texto: `Nueva solicitud ${op.codigo}: ${RAMO[o.ramo].nombre} de ${c.nombre}`, enlace: `/admin/oportunidades/${op.id}` })
  return op
}

export function puntuar(o: Oportunidad) {
  const req = RAMO[o.ramo].requeridos.length
  const tiene = RAMO[o.ramo].requeridos.filter((k) => !vacio(o.ficha[k])).length
  const extra = RAMO[o.ramo].opcionales.filter((k) => !vacio(o.ficha[k])).length
  const c = motor().estado.clientes.find((x) => x.id === o.clienteId)
  const cliente = c && motor().estado.polizas.some((p) => p.clienteId === c.id && p.estado !== "cancelada") ? 12 : 0
  return Math.min(98, Math.round(30 + (tiene / req) * 45 + extra * 4 + cliente + (o.segmento === "empresa" ? 8 : 0)))
}

export function actualizarFicha(op: Oportunidad, datos: Record<string, unknown>) {
  for (const [k, v] of Object.entries(datos)) if (!vacio(v)) op.ficha[k] = v as string | number | boolean
  op.faltantes = faltantesDe(op)
  op.puntuacion = puntuar(op)
  op.resumen = `${RAMO[op.ramo].nombre}: ${bienDe(op.ramo, op.ficha)}`
  op.actualizada = Date.now()
  marcar()
}

export function calificar(op: Oportunidad) {
  const est = motor().estado
  const carga = new Map<string, number>()
  for (const x of est.oportunidades) if (x.ejecutivoId && ["calificada", "en_cotizacion", "propuesta_enviada", "en_decision"].includes(x.etapa)) carga.set(x.ejecutivoId, (carga.get(x.ejecutivoId) ?? 0) + 1)
  const c = est.clientes.find((x) => x.id === op.clienteId)!
  const yaTiene = est.polizas.some((p) => p.clienteId === c.id && ["vigente", "por_renovar"].includes(p.estado))
  op.ejecutivoId = yaTiene ? c.ejecutivoId : ejecutivoPara(op.ramo, op.sucursal, null, carga, op.segmento)
  if (!yaTiene) c.ejecutivoId = op.ejecutivoId
  op.etapa = "calificada"
  op.siguiente = { texto: "Validar datos y pedir primas a las aseguradoras", vence: Date.now() + (horario().abierto ? 4 * 3600000 : DIA) }
  op.historial.push({ ts: Date.now(), texto: `Calificada y asignada a ${PERSONA[op.ejecutivoId].nombre}`, quien: "IA" })
  log({ tipo: "oportunidad", texto: `${op.codigo} calificada: ${PERSONA[op.ejecutivoId].nombre} la recibe`, enlace: `/admin/oportunidades/${op.id}` })
  return PERSONA[op.ejecutivoId]
}

// ---------- siniestros ----------

export function crearSiniestro(o: { clienteId: string; polizaId?: string; tipo: TipoSiniestro; ocurrido: number; lugar: string; descripcion: string; lesionados: boolean; terceros: boolean; conversacionId?: string; creadoPor: "ia" | "equipo" }) {
  const mt = motor()
  const est = mt.estado
  const c = est.clientes.find((x) => x.id === o.clienteId)!
  const n = ++mt.contadores.sin
  const s: Siniestro = {
    id: id("sin-"),
    codigo: `SIN-${n}`,
    clienteId: c.id,
    polizaId: o.polizaId,
    tipo: o.tipo,
    ocurrido: o.ocurrido,
    reportado: Date.now(),
    lugar: o.lugar,
    descripcion: o.descripcion,
    lesionados: o.lesionados,
    terceros: o.terceros,
    estado: "reportado",
    documentos: PROCEDIMIENTOS[o.tipo].documentos.map((nombre) => ({ nombre })),
    responsableId: c.sucursal === "santiago" ? "ana" : "julio",
    conversacionId: o.conversacionId,
    creadoPor: o.creadoPor,
    historial: [{ ts: Date.now(), texto: o.creadoPor === "ia" ? "Reporte preliminar tomado por la IA en la conversación" : "Siniestro registrado", quien: o.creadoPor === "ia" ? "IA" : undefined }],
  }
  est.siniestros.unshift(s)
  c.recorrido.push({ ts: Date.now(), tipo: "siniestro", texto: `${PROCEDIMIENTOS[o.tipo].nombre} (${s.codigo})`, enlace: `/admin/siniestros/${s.id}` })
  log({ tipo: "siniestro", texto: `${s.codigo}: ${PROCEDIMIENTOS[o.tipo].nombre.toLowerCase()} de ${c.nombre}${o.lesionados ? ", con lesionados" : ""}`, enlace: `/admin/siniestros/${s.id}` })
  return s
}

// ---------- acciones del panel ----------

export type Accion =
  | { tipo: "etapa"; oportunidadId: string; etapa: Etapa; motivo?: string; quien?: string }
  | { tipo: "asignar"; oportunidadId: string; ejecutivoId: string; quien?: string }
  | { tipo: "cotizaciones"; oportunidadId: string; cotizaciones: CotizacionAseguradora[]; quien?: string }
  | { tipo: "enviarPropuesta"; oportunidadId: string; quien?: string }
  | { tipo: "ganar"; oportunidadId: string; aseguradoraId: string; prima: number; quien?: string }
  | { tipo: "nota"; oportunidadId?: string; siniestroId?: string; polizaId?: string; texto: string; quien?: string }
  | { tipo: "ficha"; oportunidadId: string; datos: Record<string, unknown>; quien?: string }
  | { tipo: "siniestroEstado"; siniestroId: string; estado: EstadoSiniestro; resultado?: string; numeroAseguradora?: string; montoResuelto?: number; quien?: string }
  | { tipo: "siniestroDocumento"; siniestroId: string; indice: number; recibido: boolean; quien?: string }
  | { tipo: "renovacion"; polizaId: string; renovacion: EstadoRenovacion; quien?: string }
  | { tipo: "avisoRenovacion"; polizaIds: string[]; quien?: string }
  | { tipo: "iaActiva"; activa: boolean }
  | { tipo: "reiniciar" }

const op = (oportunidadId: string) => {
  const o = motor().estado.oportunidades.find((x) => x.id === oportunidadId)
  if (!o) throw new Error("No existe la oportunidad")
  return o
}
const sin = (siniestroId: string) => {
  const s = motor().estado.siniestros.find((x) => x.id === siniestroId)
  if (!s) throw new Error("No existe el siniestro")
  return s
}
const pol = (polizaId: string) => {
  const p = motor().estado.polizas.find((x) => x.id === polizaId)
  if (!p) throw new Error("No existe la póliza")
  return p
}

function mensajeAlCliente(clienteId: string, texto: string, autor: string, canal: Canal = "whatsapp") {
  const conv = asegurarConversacion(clienteId, canal, "Seguimiento")
  return agregarMensaje(conv.id, { de: "equipo", texto, autor })
}

export function emitirPoliza(o: Oportunidad, aseguradoraId: string, prima: number, quien?: string): Poliza {
  const mt = motor()
  const est = mt.estado
  const c = est.clientes.find((x) => x.id === o.clienteId)!
  const n = ++mt.contadores.pol
  const ahora = Date.now()
  const p: Poliza = {
    id: id("pol-"),
    numero: `${prefijoPoliza[o.ramo]}-${new Date(ahora).getFullYear()}-${String(n * 7 + 13).padStart(6, "0")}`,
    clienteId: c.id,
    ramo: o.ramo,
    aseguradoraId,
    plan: o.ficha.cobertura ? String(o.ficha.cobertura) : RAMO[o.ramo].nombre,
    bien: bienDe(o.ramo, o.ficha),
    sumaAsegurada: Number(o.ficha.valor_aproximado ?? 0) || prima * 30,
    primaAnual: prima,
    formaPago: "mensual",
    inicio: ahora,
    vence: ahora + 365 * DIA,
    estado: "vigente",
    renovacion: "sin_iniciar",
    ejecutivoId: o.ejecutivoId ?? c.ejecutivoId,
    pagoAlDia: true,
    historial: [{ ts: ahora, texto: `Póliza emitida por ${ASEGURADORA[aseguradoraId]?.nombre}`, quien }],
  }
  est.polizas.unshift(p)
  c.etiquetas = c.etiquetas.filter((e) => e !== "Prospecto")
  c.recorrido.push({ ts: ahora, tipo: "poliza", texto: `Póliza ${p.numero} de ${RAMO[o.ramo].nombre.toLowerCase()}`, enlace: `/admin/cartera/${p.id}` })
  return p
}

export function ejecutar(a: Accion): unknown {
  const est = motor().estado
  const ahora = Date.now()
  switch (a.tipo) {
    case "etapa": {
      const o = op(a.oportunidadId)
      o.etapa = a.etapa
      o.actualizada = ahora
      if (a.etapa === "perdida") o.motivoPerdida = a.motivo ?? "Sin motivo"
      if (["ganada", "perdida"].includes(a.etapa)) o.siguiente = undefined
      o.historial.push({ ts: ahora, texto: `Pasó a ${NOMBRE_ETAPA[a.etapa].toLowerCase()}${a.motivo ? `: ${a.motivo}` : ""}`, quien: a.quien })
      log({ tipo: "oportunidad", texto: `${o.codigo} en ${NOMBRE_ETAPA[a.etapa].toLowerCase()}`, enlace: `/admin/oportunidades/${o.id}` })
      return { oportunidad: o }
    }
    case "asignar": {
      const o = op(a.oportunidadId)
      o.ejecutivoId = a.ejecutivoId
      if (o.etapa === "nueva") {
        o.etapa = "calificada"
        o.siguiente = { texto: "Validar datos y pedir primas a las aseguradoras", vence: ahora + (horario().abierto ? 4 * 3600000 : DIA) }
      }
      o.historial.push({ ts: ahora, texto: `Asignada a ${PERSONA[a.ejecutivoId]?.nombre}`, quien: a.quien })
      marcar()
      return { oportunidad: o }
    }
    case "ficha": {
      const o = op(a.oportunidadId)
      actualizarFicha(o, a.datos)
      o.historial.push({ ts: ahora, texto: "Ficha actualizada", quien: a.quien })
      return { oportunidad: o }
    }
    case "cotizaciones": {
      const o = op(a.oportunidadId)
      o.cotizaciones = a.cotizaciones
      const precio = (x: CotizacionAseguradora) => x.prima - x.coberturas.length * 9000
      o.cotizaciones.forEach((x) => (x.recomendada = false))
      const mejor = o.cotizaciones.slice().sort((x, y) => precio(x) - precio(y))[0]
      if (mejor) mejor.recomendada = true
      if (["nueva", "calificada"].includes(o.etapa)) o.etapa = "en_cotizacion"
      o.actualizada = ahora
      o.historial.push({ ts: ahora, texto: `Primas cargadas de ${o.cotizaciones.length} aseguradoras`, quien: a.quien })
      marcar()
      return { oportunidad: o }
    }
    case "enviarPropuesta": {
      const o = op(a.oportunidadId)
      if (!o.cotizaciones.length) throw new Error("Primero carga las primas de las aseguradoras")
      const c = est.clientes.find((x) => x.id === o.clienteId)!
      const lineas = o.cotizaciones
        .slice()
        .sort((x, y) => x.prima - y.prima)
        .map((x, i) => `${i + 1}. ${ASEGURADORA[x.aseguradoraId]?.nombre}: ${rd(x.prima)} al año, deducible ${x.deducible}${x.recomendada ? " (la que le recomendamos)" : ""}`)
      const quien = PERSONA[o.ejecutivoId ?? c.ejecutivoId]?.nombre ?? "MAX"
      const texto = `${c.nombre.split(" ")[0]}, le comparto el comparativo de su seguro de ${RAMO[o.ramo].nombre.toLowerCase()} (${bienDe(o.ramo, o.ficha)}):\n${lineas.join("\n")}\nLas condiciones finales las confirma la aseguradora al emitir. ¿Con cuál le gustaría seguir?`
      mensajeAlCliente(c.id, texto, quien)
      o.etapa = "propuesta_enviada"
      o.propuestaEnviada = ahora
      o.actualizada = ahora
      o.siguiente = { texto: "Seguimiento a la propuesta", vence: ahora + 2 * DIA }
      o.historial.push({ ts: ahora, texto: "Comparativo enviado al cliente por WhatsApp", quien: a.quien })
      c.recorrido.push({ ts: ahora, tipo: "cotizacion", texto: `Comparativo de ${o.cotizaciones.length} aseguradoras (${o.codigo})`, enlace: `/admin/oportunidades/${o.id}` })
      log({ tipo: "oportunidad", texto: `${o.codigo}: comparativo enviado a ${c.nombre}`, enlace: `/admin/oportunidades/${o.id}` })
      return { oportunidad: o }
    }
    case "ganar": {
      const o = op(a.oportunidadId)
      const p = emitirPoliza(o, a.aseguradoraId, a.prima, a.quien)
      o.etapa = "ganada"
      o.elegida = a.aseguradoraId
      o.primaGanada = a.prima
      o.polizaId = p.id
      o.siguiente = undefined
      o.actualizada = ahora
      o.historial.push({ ts: ahora, texto: `Póliza ${p.numero} emitida con ${ASEGURADORA[a.aseguradoraId]?.nombre}`, quien: a.quien })
      log({ tipo: "poliza", texto: `Póliza ${p.numero} emitida (${rd(a.prima)} al año)`, enlace: `/admin/cartera/${p.id}` })
      return { oportunidad: o, poliza: p }
    }
    case "nota": {
      const destino = a.oportunidadId ? op(a.oportunidadId) : a.siniestroId ? sin(a.siniestroId) : a.polizaId ? pol(a.polizaId) : null
      if (!destino) throw new Error("Falta a qué va la nota")
      destino.historial.push({ ts: ahora, texto: a.texto, quien: a.quien })
      marcar()
      return { ok: true }
    }
    case "siniestroEstado": {
      const s = sin(a.siniestroId)
      s.estado = a.estado
      if (a.resultado) s.resultado = a.resultado
      if (a.numeroAseguradora) s.numeroAseguradora = a.numeroAseguradora
      if (a.montoResuelto) s.montoResuelto = a.montoResuelto
      s.historial.push({ ts: ahora, texto: `${ESTADO_SINIESTRO[a.estado]}${a.resultado ? `: ${a.resultado}` : ""}`, quien: a.quien })
      const c = est.clientes.find((x) => x.id === s.clienteId)!
      if (["inspeccion", "en_aseguradora", "resuelto"].includes(a.estado)) {
        const texto =
          a.estado === "inspeccion"
            ? `${c.nombre.split(" ")[0]}, su caso ${s.codigo} pasó a inspección. La aseguradora coordina la visita con usted.`
            : a.estado === "en_aseguradora"
              ? `${c.nombre.split(" ")[0]}, ya entregamos su caso ${s.codigo} a la aseguradora${s.numeroAseguradora ? ` con el número ${s.numeroAseguradora}` : ""}. Le avisamos por aquí cada cambio.`
              : `${c.nombre.split(" ")[0]}, la aseguradora resolvió su caso ${s.codigo}: ${s.resultado ?? "ya tiene respuesta"}. Si tiene dudas, escríbanos por aquí.`
        mensajeAlCliente(c.id, texto, PERSONA[s.responsableId]?.nombre ?? "MAX")
      }
      log({ tipo: "siniestro", texto: `${s.codigo}: ${ESTADO_SINIESTRO[a.estado].toLowerCase()}`, enlace: `/admin/siniestros/${s.id}` })
      return { siniestro: s }
    }
    case "siniestroDocumento": {
      const s = sin(a.siniestroId)
      const d = s.documentos[a.indice]
      if (!d) throw new Error("No existe el documento")
      d.recibido = a.recibido ? ahora : undefined
      if (s.estado === "reportado" && a.recibido) s.estado = "documentos"
      s.historial.push({ ts: ahora, texto: `${a.recibido ? "Recibido" : "Pendiente de nuevo"}: ${d.nombre}`, quien: a.quien })
      marcar()
      return { siniestro: s }
    }
    case "renovacion": {
      const p = pol(a.polizaId)
      p.renovacion = a.renovacion
      if (a.renovacion === "confirmada") p.historial.push({ ts: ahora, texto: "Renovación confirmada", quien: a.quien })
      else p.historial.push({ ts: ahora, texto: `Renovación: ${a.renovacion.replace("_", " ")}`, quien: a.quien })
      log({ tipo: "renovacion", texto: `${p.numero}: renovación ${a.renovacion === "confirmada" ? "confirmada" : a.renovacion.replace("_", " ")}`, enlace: `/admin/cartera/${p.id}` })
      return { poliza: p }
    }
    case "avisoRenovacion": {
      let enviados = 0
      for (const pid of a.polizaIds) {
        const p = pol(pid)
        const c = est.clientes.find((x) => x.id === p.clienteId)!
        const nombre = c.segmento === "empresa" ? (c.contacto ?? c.nombre).split(" ")[0] : c.nombre.split(" ")[0]
        mensajeAlCliente(
          c.id,
          `Hola, ${nombre}. Le escribe MAX Corredores de Seguros: su póliza de ${RAMO[p.ramo].nombre.toLowerCase()} ${p.numero} (${p.bien}) vence el ${fechaCorta(p.vence)}. ¿Desea que la renovemos en las mismas condiciones o prefiere que le comparemos opciones con otras aseguradoras?`,
          PERSONA[p.ejecutivoId]?.nombre ?? "MAX",
        )
        p.renovacion = "aviso_enviado"
        p.historial.push({ ts: ahora, texto: "Aviso de renovación enviado por WhatsApp", quien: a.quien })
        enviados++
      }
      log({ tipo: "renovacion", texto: `${enviados} ${enviados === 1 ? "aviso de renovación enviado" : "avisos de renovación enviados"}` })
      return { enviados }
    }
    case "iaActiva":
      est.config.iaActiva = a.activa
      marcar()
      return { ok: true }
    case "reiniciar":
      reiniciar()
      return { ok: true }
  }
}
