import { PLATOS, totales } from "../carta"
import { platosAgotados } from "../inventario"
import { fechaLocal, hora12, minutosDelDia, NOMBRE_ZONA, tsLocal } from "../local"
import { EQUIPO_BASE, MESAS_BASE } from "../plano"
import type {
  Canal,
  Cliente,
  Conversacion,
  Estado,
  EstadoReserva,
  Evento,
  SesionMesa,
  ItemPedido,
  Mensaje,
  Mesa,
  MetodoPago,
  PasoIA,
  Pedido,
  Persona,
  Reserva,
  TipoTarea,
  Visita,
  Zona,
} from "../tipos"
import { azarLibre as az } from "./azar"
import { nombreCanal, nuevoCliente } from "./clientes"
import { sembrarConversaciones } from "./conversaciones"
import { descontar, ejecutarNegocio, registrarVentaEnCaja, sembrarLibros, sembrarNegocio, TIPOS_NEGOCIO, type AccionNegocio, type Libros } from "./negocio"
import { crearHistoria, elegirPlatos, postres, VELOCIDAD_MESERO } from "./historia"

export type Aviso =
  | { tipo: "estado"; estado: Estado }
  | { tipo: "mensaje"; mensaje: Mensaje; conversacion: Conversacion }
  | { tipo: "conversacion"; conversacion: Conversacion }
  | { tipo: "escribiendo"; conversacionId: string; activo: boolean }

type Suscriptor = (a: Aviso) => void

interface Motor {
  estado: Estado
  visitas: Visita[]
  reservasHistoricas: Reserva[]
  mensajes: Map<string, Mensaje[]>
  suscriptores: Set<Suscriptor>
  reloj?: ReturnType<typeof setInterval>
  tickActual?: () => void
  ultimoIngreso: number
  contador: number
  numeroPedido: number
  sucio: boolean
  respondedor?: (convId: string) => Promise<void>
  avisos?: Avisos
  salida?: (conv: Conversacion, msg: Mensaje) => Promise<void>
  archivos: Map<string, { datos: Buffer; mime: string; nombre: string }>
  libros: Libros
  sesiones?: Map<string, SesionMesa>
}

export interface Avisos {
  confirmada: (r: Reserva) => Promise<void>
  recordatorio: (r: Reserva) => Promise<void>
  cambio: (r: Reserva) => Promise<void>
  cancelada: (r: Reserva) => Promise<void>
}

const g = globalThis as unknown as { __bocaMarina?: Motor }
const SEG = 1000
const MIN = 60 * SEG

function motor(): Motor {
  if (!g.__bocaMarina) {
    g.__bocaMarina = {
      estado: undefined as unknown as Estado,
      visitas: [],
      reservasHistoricas: [],
      mensajes: new Map(),
      suscriptores: new Set(),
      ultimoIngreso: Date.now(),
      contador: 1000,
      numeroPedido: 300,
      sucio: false,
      archivos: new Map(),
      libros: { gastos: [], movimientos: [], historicas: [] },
    }
    iniciar()
  }
  const mt = g.__bocaMarina
  // Un servidor que ya corría antes de la caja y el inventario los siembra al vuelo.
  if (mt.estado && (!mt.estado.insumos || !mt.libros)) {
    sembrarNegocio(mt.estado, Date.now(), id, mt.visitas)
    mt.libros = sembrarLibros(mt.visitas, Date.now(), id)
  }
  // En desarrollo el módulo se recarga sin reiniciar el servidor: el reloj siempre corre la versión nueva de tick.
  if (!mt.reloj || mt.tickActual !== tick) {
    if (mt.reloj) clearInterval(mt.reloj)
    mt.reloj = setInterval(tick, SEG)
    mt.tickActual = tick
  }
  return mt
}

function id_(prefijo: string) {
  return id(prefijo)
}

function id(prefijo: string) {
  const mt = g.__bocaMarina!
  return `${prefijo}${(++mt.contador).toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export const estado = () => motor().estado
export const todasLasVisitas = () => motor().visitas
export const sesionMesa = (sid: string) => motor().sesiones?.get(sid)
export const todosLosGastos = () => motor().libros.gastos
export const librosNegocio = () => motor().libros
export const todasLasReservas = () => [...motor().reservasHistoricas, ...motor().estado.reservas]
export const mensajesDe = (convId: string) => motor().mensajes.get(convId) ?? []
export function definirRespondedor(fn: (convId: string) => Promise<void>) {
  motor().respondedor = fn
}

export function definirSalida(fn: (conv: Conversacion, msg: Mensaje) => Promise<void>) {
  motor().salida = fn
}

export function definirAvisos(a: Avisos) {
  motor().avisos = a
}

/** Corre un aviso (correo, WhatsApp, PDF) sin frenar la acción; si falla, queda en la bitácora. */
function avisar_(r: Reserva, cual: keyof Avisos) {
  const a = motor().avisos
  if (!r.real || !a) return
  void a[cual](r)
    .catch((e) => log({ tipo: "sistema", reservaId: r.id, texto: `Falló el aviso de ${cual} de ${r.codigo}: ${(e as Error).message}` }))
    .finally(() => {
      marcar()
      publicar()
    })
}

export function guardarArchivo(datos: Buffer, mime: string, nombre: string) {
  const id = id_("a-")
  motor().archivos.set(id, { datos, mime, nombre })
  return { id, url: `/srv/restaurante/archivos/${id}`, nombre }
}

export const archivo = (archivoId: string) => motor().archivos.get(archivoId)

export function registrarEvento(e: Omit<Evento, "id" | "ts">) {
  log(e)
  marcar()
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

function marcar() {
  motor().sucio = true
}

function publicar() {
  const mt = motor()
  if (!mt.sucio) return
  mt.sucio = false
  mt.estado.version++
  mt.estado.ahora = Date.now()
  avisar({ tipo: "estado", estado: mt.estado })
}

function log(e: Omit<Evento, "id" | "ts">, ts = Date.now()) {
  const est = motor().estado
  est.eventos.unshift({ id: id("e"), ts, ...e })
  if (est.eventos.length > 200) est.eventos.length = 200
}

// ---------- arranque ----------

function iniciar() {
  const mt = g.__bocaMarina!
  const ahora = Date.now()
  const hoy = fechaLocal(ahora)
  const h = crearHistoria(ahora)
  const conv = sembrarConversaciones(ahora, h.clientes)
  mt.visitas = h.visitas
  mt.reservasHistoricas = h.reservas.filter((r) => r.fecha !== hoy || r.estado !== "completada").filter((r) => r.fecha < hoy || ["completada", "no_show", "cancelada"].includes(r.estado))
  mt.mensajes = conv.mensajes
  mt.numeroPedido = 300 + h.visitas.filter((v) => fechaLocal(v.llegada) === hoy).length
  mt.estado = {
    ahora,
    version: 1,
    mesas: MESAS_BASE.map((b) => ({ ...b, estado: "libre", desde: ahora })),
    pedidos: [],
    reservas: [...conv.reservas, ...h.reservas.filter((r) => r.fecha === hoy && r.estado === "completada")],
    clientes: h.clientes,
    equipo: EQUIPO_BASE.map((x) => ({ ...x, tarea: { tipo: "reposo", hasta: 0 } })),
    eventos: [],
    conversaciones: conv.conversaciones,
    config: { piloto: true, cocinaAuto: true, velocidad: 1, iaActiva: true, recordatorioMinutos: 120 },
    visitasHoy: h.visitas.filter((v) => fechaLocal(v.llegada) === hoy),
  }
  sembrarNegocio(mt.estado, ahora, id, mt.visitas)
  mt.libros = sembrarLibros(mt.visitas, ahora, id)
  sembrarSalon(mt.estado, ahora)
  actualizarBloqueos(mt.estado, ahora)
  log({ tipo: "sistema", texto: "Servicio abierto. Operación en vivo conectada." }, ahora - 1000)
}

export function reiniciar() {
  const mt = motor()
  const config = mt.estado.config
  iniciar()
  mt.estado.config = config
  marcar()
  publicar()
}

function sembrarSalon(est: Estado, ahora: number) {
  const libres = () => est.mesas.filter((m) => m.estado === "libre" && m.zona !== "salon" && !est.reservas.some((r) => r.mesaId === m.id && r.fecha === fechaLocal(ahora) && ["confirmada", "recordada", "asistencia_confirmada"].includes(r.estado) && Math.abs(tsLocal(r.fecha, r.hora) - ahora) < 2 * 3600 * SEG))
  const etapas: ["ocupada" | "en_cocina" | "servida" | "cuenta" | "limpieza", number][] = [["en_cocina", 5], ["servida", 4], ["ocupada", 1], ["cuenta", 1], ["limpieza", 1]]
  const conocidos = est.clientes.filter((c) => !est.reservas.some((r) => r.clienteId === c.id && r.fecha === fechaLocal(ahora)))
  for (const [etapa, n] of etapas) {
    for (let i = 0; i < n; i++) {
      const lista = libres()
      if (!lista.length) return
      const m = az.elegir(lista)
      const comensales = Math.min(m.capacidad, az.entero(2, m.capacidad))
      const mesero = meseroDeZona(est, m.zona)
      m.meseroId = mesero.id
      m.comensales = comensales
      if (az.sig() < 0.35 && conocidos.length) m.clienteId = conocidos.splice(az.entero(0, conocidos.length - 1), 1)[0].id
      const hace = etapa === "en_cocina" ? az.entero(14, 30) : etapa === "ocupada" ? 1 : az.entero(35, 70)
      m.tramos = { llegada: ahora - hace * MIN }
      if (etapa === "limpieza") {
        cambiar(m, "limpieza", ahora - az.entero(1, 4) * MIN)
        m.tramos = undefined
        continue
      }
      if (etapa === "ocupada") {
        cambiar(m, "ocupada", ahora - az.entero(2, 6) * SEG)
        continue
      }
      const enviado = m.tramos.llegada + az.entero(6, 11) * MIN
      m.tramos.orden = enviado
      const p = abrirPedido(est, m, mesero.id, comensales, m.tramos.llegada)
      p.items = crearItems(elegirPlatos(az, comensales), 1, Math.min(enviado, ahora - 2 * MIN))
      p.rondas = 1
      for (const it of p.items) {
        if (etapa === "en_cocina") {
          const r = az.sig()
          if (r < 0.3) it.estado = "pendiente"
          else if (r < 0.8) {
            it.estado = "preparando"
            it.inicio = ahora - az.entero(20, 240) * SEG
          } else {
            it.estado = "listo"
            it.inicio = it.enviado
            it.listo = ahora - az.entero(5, 40) * SEG
          }
        } else {
          it.estado = "servido"
          it.inicio = it.enviado
          it.listo = it.enviado + it.minutos * MIN
          it.servido = it.listo + MIN
        }
      }
      if (etapa !== "en_cocina") m.tramos.primerPlato = Math.min(...p.items.map((x) => x.servido!))
      cambiar(m, etapa === "en_cocina" ? "en_cocina" : etapa === "cuenta" ? "cuenta" : "servida", ahora - az.entero(1, 12) * MIN)
      if (etapa === "cuenta") {
        m.llamado = { tipo: "cuenta", desde: ahora - 40 * SEG, origen: "qr" }
        m.tramos.cuenta = ahora - 40 * SEG
      }
    }
  }
}

// ---------- utilidades ----------

function mesa(est: Estado, mesaId: string) {
  const m = est.mesas.find((x) => x.id === mesaId)
  if (!m) throw new Error(`No existe la mesa ${mesaId}`)
  return m
}

const pedidoDe = (est: Estado, m: Mesa) => (m.pedidoId ? est.pedidos.find((p) => p.id === m.pedidoId) : undefined)

function meseroDeZona(est: Estado, zona: Zona) {
  const candidatos = est.equipo.filter((x) => x.rol === "mesero" && x.zonas.includes(zona))
  const carga = (x: Persona) => est.mesas.filter((m) => m.meseroId === x.id && m.estado !== "libre").length
  return candidatos.sort((a, b) => carga(a) - carga(b))[0] ?? est.equipo.find((x) => x.rol === "mesero")!
}

function tarea(est: Estado, quienId: string | undefined, tipo: TipoTarea, mesaId?: string, segundos = 7) {
  const q = est.equipo.find((x) => x.id === quienId)
  if (q) q.tarea = { tipo, mesaId, hasta: Date.now() + segundos * SEG }
}

const nombreDe = (est: Estado, quienId?: string) => est.equipo.find((x) => x.id === quienId)?.nombre ?? "Equipo"
const cliente = (est: Estado, clienteId?: string) => (clienteId ? est.clientes.find((c) => c.id === clienteId) : undefined)

function paso(est: Estado, clienteId: string | undefined, p: Cliente["recorrido"][number]) {
  const c = cliente(est, clienteId)
  if (c) c.recorrido.push(p)
}

function cambiar(m: Mesa, nuevo: Mesa["estado"], ts = Date.now()) {
  m.estado = nuevo
  m.desde = ts
}

function crearItems(lista: { platoId: string; cantidad: number; mods?: string[]; notas?: string }[], ronda: number, enviado: number): ItemPedido[] {
  return lista.map((x) => {
    const p = PLATOS.get(x.platoId)
    if (!p) throw new Error(`No existe el plato ${x.platoId}`)
    return {
      id: id("i"),
      platoId: p.id,
      nombre: p.nombre,
      cantidad: x.cantidad,
      precio: Math.round(p.precio * x.cantidad),
      estacion: p.estacion,
      mods: x.mods ?? [],
      notas: x.notas,
      estado: "pendiente",
      ronda,
      enviado,
      minutos: p.minutos,
    }
  })
}

function abrirPedido(est: Estado, m: Mesa, meseroId: string, comensales: number, ts = Date.now()): Pedido {
  const mt = motor()
  const p: Pedido = {
    id: id("p"),
    numero: ++mt.numeroPedido,
    mesaId: m.id,
    meseroId,
    clienteId: m.clienteId,
    reservaId: m.reservaId,
    comensales,
    items: [],
    abierto: ts,
    rondas: 0,
    historial: [{ ts, texto: "Mesa abierta", quien: nombreDe(est, meseroId) }],
  }
  est.pedidos.push(p)
  m.pedidoId = p.id
  return p
}

const ACTIVAS: EstadoReserva[] = ["confirmada", "recordada", "asistencia_confirmada", "solicitada"]

function actualizarBloqueos(est: Estado, ahora: number) {
  const hoy = fechaLocal(ahora)
  for (const m of est.mesas) {
    if (m.estado !== "libre") continue
    const r = est.reservas.find(
      (x) => x.mesaId === m.id && x.fecha === hoy && ACTIVAS.includes(x.estado) && tsLocal(x.fecha, x.hora) - ahora < 45 * MIN && tsLocal(x.fecha, x.hora) - ahora > -30 * MIN,
    )
    if (r) {
      cambiar(m, "reservada")
      m.reservaId = r.id
      m.clienteId = r.clienteId
      log({ tipo: "reserva", mesaId: m.id, reservaId: r.id, texto: `Mesa ${m.nombre} bloqueada para ${r.nombre}: ${r.personas} personas a las ${hora12(r.hora)}` })
    }
  }
}

// ---------- acciones ----------

export interface NuevaReserva {
  nombre: string
  telefono: string
  fecha: string
  hora: string
  personas: number
  zona?: Zona
  mesaId?: string
  ocasion?: string
  canal: Canal
  notas?: string
  conversacionId?: string
  estado?: EstadoReserva
  correo?: string
  creadaPor?: Reserva["creadaPor"]
}

export type Accion =
  | { tipo: "sentar"; mesaId: string; comensales: number; meseroId?: string; clienteId?: string; manual?: boolean }
  | { tipo: "reservaLlego"; reservaId: string }
  | { tipo: "llegue"; codigo?: string; telefono?: string }
  | { tipo: "entradaSinReserva"; nombre: string; telefono?: string; personas: number }
  | { tipo: "quitarEntrada"; entradaId: string }
  | { tipo: "recibir"; reservaId?: string; entradaId?: string; nombre?: string; telefono?: string; personas: number; mesaId: string; meseroId?: string }
  | { tipo: "ordenar"; mesaId: string; items: { platoId: string; cantidad: number; mods?: string[]; notas?: string }[]; quien?: string; descontar?: boolean }
  | { tipo: "item"; pedidoId: string; itemId: string; estado: ItemPedido["estado"] }
  | { tipo: "ticket"; pedidoId: string; estacion: ItemPedido["estacion"] }
  | { tipo: "servir"; mesaId: string }
  | { tipo: "llamar"; mesaId: string; llamado: "mesero" | "cuenta"; origen?: "qr" | "mesero" }
  | { tipo: "atender"; mesaId: string }
  | { tipo: "cobrar"; mesaId: string; metodo: MetodoPago; propinaPct?: number }
  | { tipo: "liberar"; mesaId: string }
  | { tipo: "manual"; mesaId: string; manual: boolean }
  | { tipo: "reserva"; reserva: NuevaReserva }
  | { tipo: "reservaEstado"; reservaId: string; estado: EstadoReserva; nota?: string }
  | { tipo: "reservaCambiar"; reservaId: string; cambios: Partial<Pick<Reserva, "fecha" | "hora" | "personas" | "zona" | "mesaId" | "notas" | "ocasion">> }
  | { tipo: "recordatorio"; reservaId: string }
  | { tipo: "calificar"; mesaId?: string; clienteId?: string; visitaId?: string; estrellas: number; comentario?: string }
  | { tipo: "sesionMesa"; mesaId: string; sesionId?: string; nombre?: string; telefono?: string }
  | { tipo: "moverMesa"; mesaId: string; x: number; y: number; rot?: number }
  | { tipo: "agregarMesa"; zona: Zona; capacidad: number; x: number; y: number; nombre?: string }
  | { tipo: "quitarMesa"; mesaId: string }
  | { tipo: "editarMesa"; mesaId: string; nombre?: string; capacidad?: number }
  | { tipo: "config"; config: Partial<Estado["config"]> }
  | { tipo: "reiniciar" }
  | (AccionNegocio & { quien?: string })

export function ejecutar(a: Accion): unknown {
  const est = motor().estado
  const ahora = Date.now()
  let resultado: unknown = { ok: true }
  if (TIPOS_NEGOCIO.has(a.tipo)) {
    resultado = ejecutarNegocio(est, motor().libros, a as AccionNegocio, { id, log: (texto) => log({ tipo: "sistema", texto }), quien: (a as { quien?: string }).quien ?? "Equipo" })
    marcar()
    publicar()
    return resultado
  }
  switch (a.tipo) {
    case "sentar": {
      const m = mesa(est, a.mesaId)
      if (!["libre", "reservada"].includes(m.estado)) throw new Error(`La mesa ${m.nombre} no está disponible`)
      const r = m.reservaId ? est.reservas.find((x) => x.id === m.reservaId) : undefined
      const mesero = a.meseroId ? est.equipo.find((x) => x.id === a.meseroId)! : meseroDeZona(est, m.zona)
      m.meseroId = mesero.id
      m.comensales = a.comensales
      m.clienteId = a.clienteId ?? r?.clienteId
      m.manual = a.manual ?? false
      m.tramos = { llegada: ahora }
      if (r) {
        r.estado = "sentada"
        r.avisos.push({ ts: ahora, tipo: "nota", texto: `Llegaron y se sentaron en ${m.nombre}`, canal: "presencial", quien: "Carolina" })
      }
      cambiar(m, "ocupada")
      tarea(est, "carolina", "recibir", m.id, 6)
      log({ tipo: "mesa", mesaId: m.id, reservaId: r?.id, clienteId: m.clienteId, quien: "Carolina", texto: `Llegaron ${a.comensales} a ${m.nombre}${r ? `, reserva de ${r.nombre}` : ""}` })
      paso(est, m.clienteId, { ts: ahora, tipo: "llegada", texto: `Llegó con ${a.comensales} a ${NOMBRE_ZONA[m.zona]}, mesa ${m.nombre}`, quien: "Carolina", enlace: `/admin/salon/mesas/${m.id}` })
      break
    }
    case "ordenar": {
      const m = mesa(est, a.mesaId)
      if (["libre", "reservada", "limpieza"].includes(m.estado)) throw new Error(`Primero hay que sentar a alguien en ${m.nombre}`)
      if (!a.items.length) throw new Error("La orden está vacía")
      if (a.descontar !== false) descontar(est, motor().libros.movimientos, a.items, { mesaId: m.id, texto: `Mesa ${m.nombre}: ${a.items.map((x) => `${x.cantidad > 1 ? `${x.cantidad}× ` : ""}${PLATOS.get(x.platoId)?.nombre ?? x.platoId}`).join(", ")}`, quien: a.quien })
      let p = pedidoDe(est, m)
      if (!p) p = abrirPedido(est, m, m.meseroId ?? meseroDeZona(est, m.zona).id, m.comensales ?? 2, m.tramos?.llegada)
      p.rondas++
      const nuevos = crearItems(a.items, p.rondas, ahora)
      p.items.push(...nuevos)
      const quien = a.quien ?? nombreDe(est, p.meseroId)
      p.historial.push({ ts: ahora, texto: `Ronda ${p.rondas} a cocina: ${nuevos.length} platos`, quien })
      if (m.tramos && !m.tramos.orden) m.tramos.orden = ahora
      cambiar(m, "en_cocina")
      tarea(est, p.meseroId, "tomar", m.id, 8)
      log({ tipo: "cocina", mesaId: m.id, quien, texto: `Orden #${p.numero}, ${m.nombre}: ronda ${p.rondas} con ${nuevos.length} platos` })
      paso(est, m.clienteId, { ts: ahora, tipo: "pedido", texto: `Pidió ${nuevos.map((x) => x.nombre).slice(0, 3).join(", ")}${nuevos.length > 3 ? " y más" : ""}`, quien, enlace: `/admin/salon/mesas/${m.id}` })
      resultado = { ok: true, pedidoId: p.id, numero: p.numero }
      break
    }
    case "item": {
      const p = est.pedidos.find((x) => x.id === a.pedidoId)
      const it = p?.items.find((x) => x.id === a.itemId)
      if (!p || !it) throw new Error("No encontré ese plato")
      moverItem(est, p, it, a.estado)
      break
    }
    case "ticket": {
      const p = est.pedidos.find((x) => x.id === a.pedidoId)
      if (!p) throw new Error("No encontré esa orden")
      for (const it of p.items.filter((x) => x.estacion === a.estacion && (x.estado === "pendiente" || x.estado === "preparando"))) moverItem(est, p, it, "listo")
      break
    }
    case "servir":
      servir(est, mesa(est, a.mesaId))
      break
    case "llamar": {
      const m = mesa(est, a.mesaId)
      if (["libre", "reservada", "limpieza"].includes(m.estado)) throw new Error("La mesa no tiene clientes")
      m.llamado = { tipo: a.llamado, desde: ahora, origen: a.origen ?? "qr" }
      if (a.llamado === "cuenta") {
        cambiar(m, "cuenta")
        if (m.tramos) m.tramos.cuenta = ahora
      }
      log({ tipo: "llamado", mesaId: m.id, texto: a.llamado === "cuenta" ? `${m.nombre} pidió la cuenta${a.origen === "mesero" ? "" : " desde el QR"}` : `${m.nombre} llamó al mesero desde el QR` })
      break
    }
    case "atender": {
      const m = mesa(est, a.mesaId)
      if (m.llamado?.tipo === "mesero") {
        const s = Math.round((ahora - m.llamado.desde) / SEG)
        log({ tipo: "llamado", mesaId: m.id, quien: nombreDe(est, m.meseroId), texto: `${nombreDe(est, m.meseroId)} atendió a ${m.nombre} en ${s} s` })
        const p = pedidoDe(est, m)
        p?.historial.push({ ts: ahora, texto: `Llamado atendido en ${s} s`, quien: nombreDe(est, m.meseroId) })
        m.llamado = undefined
      }
      tarea(est, m.meseroId, "atender", m.id, 6)
      break
    }
    case "cobrar":
      resultado = cobrar(est, mesa(est, a.mesaId), a.metodo, a.propinaPct ?? 10)
      break
    case "liberar":
      liberar(est, mesa(est, a.mesaId))
      break
    case "manual":
      mesa(est, a.mesaId).manual = a.manual
      break
    case "reserva":
      resultado = crearReserva(est, a.reserva)
      break
    case "reservaEstado":
      resultado = estadoReserva(est, a.reservaId, a.estado, a.nota)
      break
    case "reservaLlego": {
      const r = reservaPorId(est, a.reservaId)
      if (!r.llegoEn) {
        r.llegoEn = ahora
        r.avisos.push({ ts: ahora, tipo: "nota", texto: "Llegó: espera en la entrada", canal: "presencial", quien: "Carolina" })
        log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, quien: "Carolina", texto: `${r.nombre} llegó: ${r.personas} personas en la entrada` })
      }
      break
    }
    case "recibir":
      resultado = recibir(est, a)
      if (a.entradaId) est.entrada = (est.entrada ?? []).filter((x) => x.id !== a.entradaId)
      break
    case "llegue": {
      const hoy = fechaLocal(ahora)
      const codigo = a.codigo?.trim().toUpperCase()
      const tel = a.telefono?.replace(/\D/g, "").slice(-10)
      const r = est.reservas
        .filter((x) => x.fecha === hoy && ACTIVAS.includes(x.estado))
        .find((x) => (codigo && x.codigo === codigo) || (!!tel && tel.length >= 7 && x.telefono.replace(/\D/g, "").slice(-10).endsWith(tel)))
      if (!r) throw new Error("No encontramos una reserva para hoy con ese dato")
      if (!r.llegoEn) {
        r.llegoEn = ahora
        r.avisos.push({ ts: ahora, tipo: "nota", texto: "Avisó que llegó escaneando el QR de la entrada", canal: "presencial", quien: r.nombre })
        log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, quien: r.nombre, texto: `${r.nombre} llegó (QR de la entrada): ${r.personas} personas` })
      }
      const m = r.mesaId ? est.mesas.find((x) => x.id === r.mesaId) : undefined
      resultado = { ok: true, nombre: r.nombre, codigo: r.codigo, hora: r.hora, personas: r.personas, zona: r.zona, mesa: m?.nombre ?? null }
      break
    }
    case "entradaSinReserva": {
      if (!a.nombre.trim()) throw new Error("¿A nombre de quién?")
      if (a.personas < 1 || a.personas > 30) throw new Error("¿Cuántas personas son?")
      const e = { id: id("e-"), nombre: a.nombre.trim(), telefono: a.telefono?.trim() || undefined, personas: a.personas, ts: ahora }
      est.entrada = [...(est.entrada ?? []), e]
      log({ tipo: "mesa", quien: e.nombre, texto: `${e.nombre} llegó sin reserva (${e.personas}) y espera en la entrada` })
      resultado = { ok: true, entrada: e, delante: est.entrada.length - 1 }
      break
    }
    case "quitarEntrada":
      est.entrada = (est.entrada ?? []).filter((x) => x.id !== a.entradaId)
      break
    case "reservaCambiar":
      resultado = cambiarReserva(est, a.reservaId, a.cambios)
      break
    case "recordatorio":
      enviarRecordatorio(est, reservaPorId(est, a.reservaId))
      break
    case "calificar": {
      const m = a.mesaId ? est.mesas.find((x) => x.id === a.mesaId) : undefined
      const porId = a.visitaId ? motor().visitas.find((x) => x.id === a.visitaId) : undefined
      const cid = a.clienteId ?? porId?.clienteId ?? m?.clienteId
      if (porId?.calificacion) throw new Error("Esta visita ya tiene su reseña")
      paso(est, cid, { ts: ahora, tipo: "resena", texto: `Calificó la visita con ${a.estrellas} de 5${a.comentario ? `: "${a.comentario}"` : ""}`, enlace: porId ? `/admin/visitas/${porId.id}` : undefined })
      const v = porId ?? [...est.visitasHoy].reverse().find((x) => x.mesaId === a.mesaId || (cid && x.clienteId === cid))
      if (v) {
        v.calificacion = a.estrellas
        v.comentario = a.comentario?.trim() || undefined
      }
      log({ tipo: "mesa", mesaId: m?.id, clienteId: cid, texto: `Calificación de ${a.estrellas} de 5${m ? ` desde ${m.nombre}` : ""}` })
      break
    }
    case "sesionMesa": {
      const m = mesa(est, a.mesaId)
      const p = pedidoDe(est, m)
      if (!p) throw new Error("La mesa todavía no está abierta: pídele a tu mesero que la abra")
      const sesiones = (motor().sesiones ??= new Map())
      let s = (a.sesionId && sesiones.get(a.sesionId)) || (p.sesionId ? sesiones.get(p.sesionId) : undefined)
      if (!s || s.pedidoId !== p.id) {
        s = { id: id("s-"), mesaId: m.id, pedidoId: p.id, clienteId: m.clienteId ?? p.clienteId, creada: ahora }
        sesiones.set(s.id, s)
        p.sesionId = s.id
        log({ tipo: "mesa", mesaId: m.id, clienteId: s.clienteId, texto: `Escanearon el QR de ${m.nombre}` })
      }
      if (a.telefono?.trim()) {
        const c = asegurarCliente(a.nombre?.trim() || "Cliente", a.telefono.trim(), "presencial")
        s.clienteId = c.id
        if (!m.clienteId) m.clienteId = c.id
        paso(est, c.id, { ts: ahora, tipo: "llegada", texto: `Se identificó con el QR de ${m.nombre}`, enlace: `/admin/salon/mesas/${m.id}` })
      }
      resultado = { ok: true, sesion: s }
      break
    }
    case "moverMesa": {
      const m = mesa(est, a.mesaId)
      m.x = Math.round(a.x * 10) / 10
      m.y = Math.round(a.y * 10) / 10
      if (a.rot != null) m.rot = Math.round(a.rot) % 360
      break
    }
    case "agregarMesa": {
      const prefijo = { terraza: "T", muelle: "M", gazebo: "G", salon: "S" }[a.zona]
      let n = est.mesas.filter((m) => m.id.startsWith(prefijo)).length + 1
      while (est.mesas.some((m) => m.id === `${prefijo}${n}`)) n++
      const nueva: Mesa = { id: `${prefijo}${n}`, nombre: a.nombre || `${prefijo}${n}`, zona: a.zona, capacidad: Math.max(1, Math.min(14, a.capacidad)), x: a.x, y: a.y, estado: "libre", desde: ahora }
      est.mesas.push(nueva)
      log({ tipo: "sistema", mesaId: nueva.id, texto: `Mesa ${nueva.nombre} agregada en ${NOMBRE_ZONA[a.zona]}` })
      resultado = { ok: true, mesa: nueva }
      break
    }
    case "quitarMesa": {
      const m = mesa(est, a.mesaId)
      if (m.estado !== "libre") throw new Error(`La mesa ${m.nombre} tiene clientes o una reserva: libérala antes de quitarla`)
      if (est.reservas.some((r) => r.mesaId === m.id && ACTIVAS.includes(r.estado))) throw new Error(`La mesa ${m.nombre} tiene reservas próximas`)
      est.mesas = est.mesas.filter((x) => x.id !== m.id)
      log({ tipo: "sistema", texto: `Mesa ${m.nombre} quitada del plano` })
      break
    }
    case "editarMesa": {
      const m = mesa(est, a.mesaId)
      if (a.nombre) m.nombre = a.nombre
      if (a.capacidad) m.capacidad = Math.max(1, Math.min(14, a.capacidad))
      break
    }
    case "config":
      Object.assign(est.config, a.config)
      break
    case "reiniciar":
      reiniciar()
      return { ok: true }
  }
  marcar()
  publicar()
  return resultado
}

function siguienteCodigo() {
  const max = Math.max(4200, ...todasLasReservas().map((r) => Number(r.codigo.replace(/\D/g, "")) || 0))
  return `BM-${max + 1}`
}

function recibir(est: Estado, a: Extract<Accion, { tipo: "recibir" }>) {
  const ahora = Date.now()
  const m = mesa(est, a.mesaId)
  const r = a.reservaId ? reservaPorId(est, a.reservaId) : undefined
  if (a.personas < 1) throw new Error("¿Cuántas personas llegaron?")
  if (a.personas > m.capacidad + 2) throw new Error(`${m.nombre} es para ${m.capacidad}: elige una mesa más grande`)
  if (m.estado === "reservada" && m.reservaId !== r?.id) throw new Error(`${m.nombre} está bloqueada para otra reserva`)
  if (!["libre", "reservada"].includes(m.estado)) throw new Error(`La mesa ${m.nombre} no está disponible`)
  let clienteId = r?.clienteId
  if (!r && a.telefono?.trim()) clienteId = asegurarCliente(a.nombre?.trim() || "Cliente", a.telefono.trim(), "presencial").id
  if (r) {
    if (r.mesaId && r.mesaId !== m.id) {
      const antes = est.mesas.find((x) => x.id === r.mesaId)
      if (antes && antes.estado === "reservada" && antes.reservaId === r.id) {
        antes.reservaId = undefined
        antes.clienteId = undefined
        cambiar(antes, "libre")
      }
    }
    if (a.personas !== r.personas) r.avisos.push({ ts: ahora, tipo: "nota", texto: `Reservaron para ${r.personas} y llegaron ${a.personas}`, canal: "presencial", quien: "Carolina" })
    r.mesaId = m.id
    r.personas = a.personas
    r.llegoEn = r.llegoEn ?? ahora
    m.reservaId = r.id
  }
  ejecutar({ tipo: "sentar", mesaId: m.id, comensales: a.personas, meseroId: a.meseroId, clienteId, manual: true })
  const mesero = est.equipo.find((x) => x.id === m.meseroId)
  tarea(est, m.meseroId, "atender", m.id, 8)
  const quien = r?.nombre ?? (a.nombre?.trim() || "Sin reserva")
  log({ tipo: "mesa", mesaId: m.id, reservaId: r?.id, clienteId, quien: "Carolina", texto: `${m.nombre} para ${quien} (${a.personas}): la atiende ${mesero?.nombre ?? "el equipo"}` })
  return { ok: true, mesa: { id: m.id, nombre: m.nombre }, mesero: mesero ? { id: mesero.id, nombre: mesero.nombre } : null }
}

function reservaPorId(est: Estado, reservaId: string) {
  const r = est.reservas.find((x) => x.id === reservaId)
  if (!r) throw new Error("No encontré la reserva")
  return r
}

function moverItem(est: Estado, p: Pedido, it: ItemPedido, nuevo: ItemPedido["estado"]) {
  const ahora = Date.now()
  const m = est.mesas.find((x) => x.id === p.mesaId)
  if (nuevo === "preparando") it.inicio = it.inicio ?? ahora
  if (nuevo === "listo") {
    it.inicio = it.inicio ?? ahora
    it.listo = ahora
  }
  if (nuevo === "pendiente" || nuevo === "preparando") it.listo = undefined
  it.estado = nuevo
  const cocinero = est.equipo.find((x) => x.rol === "cocina" && x.estacion === it.estacion)
  if (nuevo === "preparando" && cocinero) cocinero.tarea = { tipo: "tomar", hasta: ahora + 4 * SEG }
  if (nuevo === "listo") {
    log({ tipo: "cocina", mesaId: p.mesaId, quien: cocinero?.nombre, texto: `${it.nombre} listo para ${m?.nombre ?? p.mesaId}` })
    if (!p.items.some((x) => x.estado === "pendiente" || x.estado === "preparando"))
      p.historial.push({ ts: ahora, texto: `Ronda ${it.ronda} lista en cocina`, quien: cocinero?.nombre ?? "Cocina" })
  }
}

function servir(est: Estado, m: Mesa) {
  const p = pedidoDe(est, m)
  if (!p) return
  const listos = p.items.filter((x) => x.estado === "listo")
  if (!listos.length) return
  const ahora = Date.now()
  for (const it of listos) {
    it.estado = "servido"
    it.servido = ahora
  }
  if (m.tramos && !m.tramos.primerPlato) m.tramos.primerPlato = ahora
  p.historial.push({ ts: ahora, texto: `Servidos ${listos.length} platos`, quien: nombreDe(est, p.meseroId) })
  tarea(est, p.meseroId, "servir", m.id, 8)
  if (!p.items.some((x) => x.estado === "pendiente" || x.estado === "preparando")) cambiar(m, "servida")
  log({ tipo: "mesa", mesaId: m.id, quien: nombreDe(est, p.meseroId), texto: `${nombreDe(est, p.meseroId)} sirvió ${listos.length} platos en ${m.nombre}` })
}

function cobrar(est: Estado, m: Mesa, metodo: MetodoPago, propinaPct: number) {
  const p = pedidoDe(est, m)
  if (!p) throw new Error(`${m.nombre} no tiene orden abierta`)
  const ahora = Date.now()
  const sub = p.items.reduce((s, i) => s + i.precio, 0)
  const t = totales(sub, Math.round((sub * propinaPct) / 100))
  const r = m.reservaId ? est.reservas.find((x) => x.id === m.reservaId) : undefined
  const c = cliente(est, m.clienteId)
  const tramos = escalarTramos(m, m.tramos ?? { llegada: p.abierto }, ahora)
  const llamados = p.historial.filter((h) => h.texto.startsWith("Llamado atendido"))
  const v: Visita = {
    id: id("v-"),
    mesaId: m.id,
    zona: m.zona,
    personas: m.comensales ?? p.comensales,
    meseroId: p.meseroId,
    clienteId: m.clienteId,
    reservaId: r?.id,
    canal: r?.canal ?? "presencial",
    llegada: tramos.llegada,
    orden: tramos.orden ?? p.items[0]?.enviado ?? tramos.llegada,
    primerPlato: tramos.primerPlato ?? ahora,
    cuenta: tramos.cuenta ?? ahora,
    pago: ahora,
    salida: ahora + 3 * MIN,
    platos: p.items.map((i) => ({
      platoId: i.platoId,
      cantidad: i.cantidad,
      importe: i.precio,
      minutosCocina: m.manual && i.listo && i.enviado ? Math.round(((i.listo - i.enviado) / MIN) * 10) / 10 : Math.round(i.minutos * az.entre(0.85, 1.4) * 10) / 10,
    })),
    ...t,
    metodo,
    llamados: llamados.length,
    esperaLlamado: llamados.length ? Math.round(llamados.reduce((s, h) => s + Number(h.texto.match(/(\d+) s/)?.[1] ?? 0), 0) / llamados.length) : 0,
  }
  // Una mesa del piloto dura minutos y no una hora: solo cuenta en la historia en la misma proporción,
  // así el día suma lo que sumaría un servicio real. Las mesas a mano, con reserva o con cliente siempre cuentan.
  const actual = ahora - (m.tramos?.llegada ?? p.abierto)
  const cuenta = m.manual || !!r || !!c || az.sig() < actual / Math.max(actual, ahora - tramos.llegada)
  if (p.sesionId) {
    v.sesionId = p.sesionId
    const s = motor().sesiones?.get(p.sesionId)
    if (s) {
      s.visitaId = v.id
      v.clienteId = v.clienteId ?? s.clienteId
    }
  }
  if (cuenta || p.sesionId) {
    est.visitasHoy.push(v)
    motor().visitas.push(v)
    registrarVentaEnCaja(est, v)
  }
  if (r) {
    r.estado = "completada"
    r.visitaId = v.id
  }
  if (c) {
    c.visitas++
    c.gasto += t.total
    const puntos = Math.floor(t.total / 100)
    c.puntos += puntos
    c.ultimaVisita = ahora
    c.recorrido.push({ ts: ahora, tipo: "pago", texto: `Pagó RD$ ${t.total.toLocaleString("es-DO")} con ${metodo}. Sumó ${puntos} puntos`, quien: nombreDe(est, p.meseroId), enlace: `/admin/visitas/${v.id}` })
  }
  est.pedidos = est.pedidos.filter((x) => x.id !== p.id)
  m.pedidoId = undefined
  m.llamado = undefined
  m.tramos = undefined
  tarea(est, p.meseroId, "cobrar", m.id, 7)
  cambiar(m, "limpieza")
  log({ tipo: "pago", mesaId: m.id, clienteId: v.clienteId, quien: nombreDe(est, p.meseroId), texto: `${m.nombre} pagó RD$ ${t.total.toLocaleString("es-DO")} con ${metodo}. Estuvo ${Math.round((ahora - v.llegada) / MIN)} min` })
  return { ok: true, visita: v }
}

// El piloto comprime el servicio en minutos; la visita que queda en la historia lleva la duración de un servicio real
// para que las métricas de hoy no se deformen. Las mesas manejadas a mano guardan sus tiempos tal cual.
function escalarTramos(m: Mesa, t: NonNullable<Mesa["tramos"]>, pago: number): NonNullable<Mesa["tramos"]> {
  if (m.manual) return t
  const real = ({ terraza: 72, muelle: 82, gazebo: 108, salon: 128 }[m.zona] + (m.comensales ?? 2) * 4 + az.entre(-12, 20)) * MIN
  const actual = Math.max(MIN, pago - t.llegada)
  const f = real / actual
  const mover = (x?: number) => (x ? pago - (pago - x) * f : undefined)
  return { llegada: pago - real, orden: mover(t.orden), primerPlato: mover(t.primerPlato), cuenta: mover(t.cuenta), pago }
}

function liberar(est: Estado, m: Mesa) {
  const meseroId = m.meseroId
  Object.assign(m, { pedidoId: undefined, reservaId: undefined, clienteId: undefined, comensales: undefined, llamado: undefined, manual: false, meseroId: undefined, tramos: undefined })
  cambiar(m, "libre")
  tarea(est, meseroId, "limpiar", m.id, 5)
  actualizarBloqueos(est, Date.now())
}

export function mesasDisponibles(est: Estado, fecha: string, hora: string, personas: number, zona?: Zona, ignorar?: string) {
  const t = tsLocal(fecha, hora)
  const ahora = Date.now()
  const choca = (mesaId: string) =>
    est.reservas.some((r) => r.id !== ignorar && r.mesaId === mesaId && ACTIVAS.concat("sentada").includes(r.estado) && Math.abs(tsLocal(r.fecha, r.hora) - t) < 2 * 3600 * SEG)
  const ocupadaAhora = (m: Mesa) => Math.abs(t - ahora) < 90 * MIN && !["libre", "limpieza", "reservada"].includes(m.estado)
  return est.mesas
    .filter((m) => m.capacidad >= personas && (!zona || m.zona === zona) && !choca(m.id) && !ocupadaAhora(m))
    .sort((a, b) => a.capacidad - b.capacidad)
}

function clientePorTelefono(est: Estado, telefono: string) {
  const d = telefono.replace(/\D/g, "").slice(-10)
  return d ? est.clientes.find((x) => x.telefono.replace(/\D/g, "").slice(-10) === d) : undefined
}

export function asegurarCliente(nombre: string, telefono: string, canal: Canal) {
  const est = motor().estado
  let c = clientePorTelefono(est, telefono)
  if (!c) {
    c = nuevoCliente(id("c-"), nombre, telefono, canal, Date.now())
    est.clientes.push(c)
    marcar()
  } else if (c.nombre.startsWith("+") || c.nombre === "Cliente nuevo") c.nombre = nombre
  return c
}

function crearReserva(est: Estado, n: NuevaReserva) {
  if (n.personas > 12) throw new Error("Los grupos de más de 12 personas van por cotización de eventos")
  const ahora = Date.now()
  const elegida = n.mesaId ? est.mesas.find((m) => m.id === n.mesaId) : mesasDisponibles(est, n.fecha, n.hora, n.personas, n.zona)[0]
  const c = asegurarCliente(n.nombre, n.telefono, n.canal)
  if (n.ocasion && !c.ocasiones.includes(n.ocasion)) c.ocasiones.push(n.ocasion)
  if (n.correo) c.correo = n.correo
  const estadoInicial: EstadoReserva = n.estado ?? (elegida ? "confirmada" : "lista_espera")
  const r: Reserva = {
    id: id("r-"),
    codigo: siguienteCodigo(),
    clienteId: c.id,
    nombre: n.nombre,
    telefono: n.telefono,
    fecha: n.fecha,
    hora: n.hora,
    personas: n.personas,
    zona: elegida?.zona ?? n.zona ?? "terraza",
    mesaId: elegida?.id,
    ocasion: n.ocasion,
    canal: n.canal,
    estado: estadoInicial,
    notas: n.notas,
    creada: ahora,
    conversacionId: n.conversacionId ?? c.conversacionId,
    avisos: [],
    correo: n.correo ?? c.correo,
    real: true,
    creadaPor: n.creadaPor ?? "panel",
  }
  if (estadoInicial === "confirmada" && !motor().avisos)
    r.avisos.push({ ts: ahora, tipo: "confirmacion", texto: `Confirmación enviada por ${nombreCanal(n.canal === "voz" || n.canal === "telefono" || n.canal === "presencial" ? "whatsapp" : n.canal)}`, canal: n.canal, quien: "Asistente" })
  est.reservas.push(r)
  const conv = r.conversacionId ? est.conversaciones.find((x) => x.id === r.conversacionId) : undefined
  if (conv && !conv.reservaIds.includes(r.id)) conv.reservaIds.push(r.id)
  c.recorrido.push({ ts: ahora, tipo: "reserva", canal: n.canal, texto: `Reservó para ${n.personas} el ${n.fecha} a las ${n.hora} en ${NOMBRE_ZONA[r.zona]}${elegida ? `, mesa ${elegida.nombre}` : " (lista de espera)"}`, enlace: `/admin/reservaciones/${r.id}` })
  log({ tipo: "reserva", mesaId: elegida?.id, reservaId: r.id, clienteId: c.id, quien: ["whatsapp", "voz", "instagram", "web"].includes(n.canal) ? "Asistente" : "Carolina", texto: `Nueva reserva por ${nombreCanal(n.canal)}: ${n.nombre}, ${n.personas} personas, ${n.fecha} ${hora12(n.hora)}${elegida ? `, ${elegida.nombre}` : ", en lista de espera"}` })
  actualizarBloqueos(est, ahora)
  if (estadoInicial === "confirmada") avisar_(r, "confirmada")
  return { ok: true, reserva: r, mesa: elegida ? { id: elegida.id, nombre: elegida.nombre, zona: NOMBRE_ZONA[elegida.zona] } : null }
}

function estadoReserva(est: Estado, reservaId: string, nuevo: EstadoReserva, nota?: string) {
  const r = reservaPorId(est, reservaId)
  const ahora = Date.now()
  r.estado = nuevo
  if (nuevo === "cancelada" || nuevo === "no_show") {
    const m = est.mesas.find((x) => x.reservaId === r.id && x.estado === "reservada")
    if (m) {
      cambiar(m, "libre")
      m.reservaId = undefined
      m.clienteId = undefined
    }
    r.avisos.push({ ts: ahora, tipo: nuevo === "cancelada" ? "cancelacion" : "nota", texto: nota ?? (nuevo === "cancelada" ? "Reserva cancelada" : "No se presentó"), canal: "presencial", quien: "Carolina" })
    promoverEspera(est, r)
    if (nuevo === "cancelada") avisar_(r, "cancelada")
  }
  if (nuevo === "confirmada" && !r.avisos.some((x) => x.tipo === "confirmacion")) {
    if (!r.mesaId) r.mesaId = mesasDisponibles(est, r.fecha, r.hora, r.personas, r.zona, r.id)[0]?.id
    if (r.real && motor().avisos) avisar_(r, "confirmada")
    else r.avisos.push({ ts: ahora, tipo: "confirmacion", texto: "Confirmación enviada por WhatsApp", canal: "whatsapp", quien: "Carolina" })
  }
  if (nuevo === "asistencia_confirmada") r.avisos.push({ ts: ahora, tipo: "respuesta", texto: nota ?? "El cliente confirmó que asiste", canal: "whatsapp", quien: r.nombre })
  if (nuevo === "sentada" && r.mesaId) {
    const m = mesa(est, r.mesaId)
    if (["libre", "reservada"].includes(m.estado)) {
      m.reservaId = r.id
      ejecutar({ tipo: "sentar", mesaId: m.id, comensales: r.personas, clienteId: r.clienteId })
    }
  }
  log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, texto: `Reserva ${r.codigo} de ${r.nombre}: ${ESTADO_TEXTO[nuevo]}` })
  actualizarBloqueos(est, ahora)
  return { ok: true, reserva: r }
}

export const ESTADO_TEXTO: Record<EstadoReserva, string> = {
  solicitada: "solicitada",
  confirmada: "confirmada",
  recordada: "recordatorio enviado",
  asistencia_confirmada: "asistencia confirmada",
  sentada: "llegó y se sentó",
  completada: "completada",
  no_show: "no se presentó",
  cancelada: "cancelada",
  lista_espera: "en lista de espera",
}

function cambiarReserva(est: Estado, reservaId: string, cambios: Partial<Reserva>) {
  const r = reservaPorId(est, reservaId)
  const antes = `${r.fecha} ${r.hora}, ${r.personas} personas`
  Object.assign(r, cambios)
  if ((cambios.fecha || cambios.hora || cambios.personas || cambios.zona) && !cambios.mesaId) {
    const m = mesasDisponibles(est, r.fecha, r.hora, r.personas, r.zona, r.id)[0]
    const bloqueada = est.mesas.find((x) => x.reservaId === r.id && x.estado === "reservada")
    if (bloqueada) {
      cambiar(bloqueada, "libre")
      bloqueada.reservaId = undefined
      bloqueada.clienteId = undefined
    }
    r.mesaId = m?.id
    if (!m) r.estado = "lista_espera"
  }
  r.avisos.push({ ts: Date.now(), tipo: "cambio", texto: `Cambió de ${antes} a ${r.fecha} ${r.hora}, ${r.personas} personas`, canal: r.canal, quien: "Asistente" })
  log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, texto: `Reserva ${r.codigo} de ${r.nombre} movida a ${r.fecha} ${hora12(r.hora)}` })
  actualizarBloqueos(est, Date.now())
  avisar_(r, "cambio")
  return { ok: true, reserva: r }
}

function promoverEspera(est: Estado, liberada: Reserva) {
  const e = est.reservas.find((x) => x.estado === "lista_espera" && x.fecha === liberada.fecha && x.personas <= (est.mesas.find((m) => m.id === liberada.mesaId)?.capacidad ?? 0))
  if (!e || !liberada.mesaId) return
  e.mesaId = liberada.mesaId
  e.zona = liberada.zona
  e.estado = "confirmada"
  e.avisos.push({ ts: Date.now(), tipo: "confirmacion", texto: `Se liberó la mesa ${liberada.mesaId}: confirmada desde la lista de espera`, canal: "whatsapp", quien: "Asistente" })
  log({ tipo: "reserva", reservaId: e.id, clienteId: e.clienteId, texto: `${e.nombre} salió de la lista de espera: mesa ${liberada.mesaId}` })
  if (e.conversacionId) agregarMensaje(e.conversacionId, { de: "ia", texto: `¡Buenas noticias, ${e.nombre.split(" ")[0]}! Se liberó una mesa: tu reserva para ${e.personas} a las ${hora12(e.hora)} quedó confirmada. Código ${e.codigo}.`, pasos: [{ herramienta: "lista_espera", resumen: `Mesa ${liberada.mesaId} asignada`, ok: true }], reservaId: e.id })
}

function enviarRecordatorio(est: Estado, r: Reserva) {
  const ahora = Date.now()
  r.estado = "recordada"
  if (r.real && motor().avisos) {
    log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, quien: "Asistente", texto: `Recordatorio enviado a ${r.nombre} para las ${hora12(r.hora)}` })
    avisar_(r, "recordatorio")
    return
  }
  r.avisos.push({ ts: ahora, tipo: "recordatorio", texto: "Recordatorio enviado por WhatsApp", canal: "whatsapp", quien: "Asistente" })
  log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, quien: "Asistente", texto: `Recordatorio enviado a ${r.nombre} para las ${hora12(r.hora)}` })
  const convId = r.conversacionId ?? asegurarConversacion(r.clienteId, "whatsapp", "Reserva").id
  r.conversacionId = convId
  agregarMensaje(convId, { de: "ia", texto: `Hola, ${r.nombre.split(" ")[0]}. Te recordamos tu reserva de hoy a las ${hora12(r.hora)} para ${r.personas} en ${NOMBRE_ZONA[r.zona]}. ¿Nos confirmas que vienen? Responde SÍ o NO.`, pasos: [{ herramienta: "recordatorio", resumen: `Reserva ${r.codigo}`, ok: true }], reservaId: r.id })
}

// ---------- conversaciones ----------

export function asegurarConversacion(clienteId: string, canal: Canal, tema: string) {
  const est = motor().estado
  const c = cliente(est, clienteId)
  let conv = c?.conversacionId ? est.conversaciones.find((x) => x.id === c.conversacionId) : undefined
  if (!conv) {
    const ahora = Date.now()
    conv = { id: id("conv-"), clienteId, canal, tema, estado: "ia", noLeidos: 0, etiquetas: [], reservaIds: [], creada: ahora, actualizada: ahora }
    est.conversaciones.unshift(conv)
    motor().mensajes.set(conv.id, [])
    if (c) {
      c.conversacionId = conv.id
      c.recorrido.push({ ts: ahora, tipo: "conversacion", canal, texto: `Conversación por ${nombreCanal(canal)}`, enlace: `/admin/chat?conversacion=${conv.id}` })
    }
    avisar({ tipo: "conversacion", conversacion: conv })
  }
  return conv
}

export function agregarMensaje(convId: string, m: { de: Mensaje["de"]; texto: string; autor?: string; pasos?: PasoIA[]; reservaId?: string; voz?: { segundos: number }; adjunto?: Mensaje["adjunto"] }) {
  const mt = motor()
  const conv = mt.estado.conversaciones.find((x) => x.id === convId)
  if (!conv) throw new Error("No existe la conversación")
  const msg: Mensaje = {
    id: id("m-"),
    conversacionId: convId,
    ts: Date.now(),
    de: m.de,
    texto: m.texto,
    autor: m.autor ?? (m.de === "ia" ? "Asistente de Boca Marina" : undefined),
    pasos: m.pasos,
    reservaId: m.reservaId,
    voz: m.voz,
    adjunto: m.adjunto,
  }
  const lista = mt.mensajes.get(convId) ?? []
  lista.push(msg)
  mt.mensajes.set(convId, lista)
  conv.actualizada = msg.ts
  if (m.de === "cliente") conv.noLeidos++
  if (m.reservaId && !conv.reservaIds.includes(m.reservaId)) conv.reservaIds.push(m.reservaId)
  avisar({ tipo: "mensaje", mensaje: msg, conversacion: conv })
  marcar()
  if (conv.externo && m.de !== "cliente" && m.de !== "sistema" && mt.salida) {
    void mt.salida(conv, msg).catch((e) => log({ tipo: "sistema", texto: `No salió por WhatsApp: ${(e as Error).message.slice(0, 140)}` }))
  }
  return msg
}

export function actualizarConversacion(convId: string, cambios: Partial<Pick<Conversacion, "estado" | "asignadoA" | "noLeidos" | "etiquetas" | "resultado" | "tema">>) {
  const conv = motor().estado.conversaciones.find((x) => x.id === convId)
  if (!conv) throw new Error("No existe la conversación")
  Object.assign(conv, cambios)
  avisar({ tipo: "conversacion", conversacion: conv })
  marcar()
  return conv
}

export function escribiendo(convId: string, activo: boolean) {
  avisar({ tipo: "escribiendo", conversacionId: convId, activo })
}

/** Mensaje entrante de un cliente (simulador o canal real). La IA responde si la conversación está en sus manos. */
export function recibirDeCliente(o: { telefono: string; nombre?: string; texto: string; canal?: Canal; adjunto?: Mensaje["adjunto"]; voz?: { segundos: number }; externo?: "meta" }) {
  const canal = o.canal ?? "whatsapp"
  const c = asegurarCliente(o.nombre ?? "Cliente nuevo", o.telefono, canal)
  const conv = asegurarConversacion(c.id, canal, "Conversación nueva")
  if (o.externo) conv.externo = o.externo
  if (conv.estado === "cerrada") actualizarConversacion(conv.id, { estado: "ia" })
  const msg = agregarMensaje(conv.id, { de: "cliente", texto: o.texto, adjunto: o.adjunto, voz: o.voz })
  const mt = motor()
  if (conv.estado === "ia" && mt.estado.config.iaActiva && mt.respondedor) {
    void mt.respondedor(conv.id).catch((e) => {
      agregarMensaje(conv.id, { de: "sistema", texto: `La IA no pudo responder (${(e as Error).message}). La conversación pasa al equipo.` })
      actualizarConversacion(conv.id, { estado: "esperando_equipo" })
    })
  }
  publicar()
  return { conversacion: conv, mensaje: msg, cliente: c }
}

// ---------- piloto automático ----------

function tick() {
  const mt = g.__bocaMarina
  if (!mt?.estado) return
  const est = mt.estado
  const ahora = Date.now()
  const v = Math.max(0.25, est.config.velocidad)
  const s = (seg: number) => (seg * SEG) / v

  for (const q of est.equipo) {
    if (q.tarea.tipo !== "reposo" && ahora > q.tarea.hasta) {
      q.tarea = { tipo: "reposo", hasta: 0 }
      marcar()
    }
  }

  if (est.config.cocinaAuto) {
    for (const p of est.pedidos) {
      for (const it of p.items) {
        if (it.estado === "pendiente" && ahora - it.enviado > s(6)) {
          moverItem(est, p, it, "preparando")
          marcar()
        } else if (it.estado === "preparando" && it.inicio && ahora - it.inicio > s(it.minutos * 2.4)) {
          moverItem(est, p, it, "listo")
          marcar()
        }
      }
    }
  }

  if (est.config.piloto) {
    for (const m of est.mesas) {
      const en = ahora - m.desde
      const p = pedidoDe(est, m)
      if (m.llamado?.tipo === "mesero" && !m.manual && ahora - m.llamado.desde > s(20 * (VELOCIDAD_MESERO[m.meseroId ?? ""] ?? 1))) {
        silencio(() => ejecutar({ tipo: "atender", mesaId: m.id }))
      }
      if (m.manual) continue
      switch (m.estado) {
        case "reservada": {
          const r = est.reservas.find((x) => x.id === m.reservaId)
          if (!r) break
          const falta = tsLocal(r.fecha, r.hora) - ahora
          if (!r.llegoEn && falta < 3 * MIN) {
            r.llegoEn = ahora
            log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, quien: "Carolina", texto: `${r.nombre} llegó: ${r.personas} personas en la entrada` })
            marcar()
          } else if (!r.real && r.llegoEn && ahora - r.llegoEn > s(240)) {
            silencio(() => ejecutar({ tipo: "sentar", mesaId: m.id, comensales: r.personas, clienteId: r.clienteId }))
          }
          break
        }
        case "ocupada":
          if (en > s(16)) {
            const agotados = platosAgotados(est.insumos)
            const items = elegirPlatos(az, m.comensales ?? 2, favoritosDe(est, m.clienteId)).filter((x) => !agotados.has(x.platoId))
            if (items.length) silencio(() => ejecutar({ tipo: "ordenar", mesaId: m.id, items, descontar: false }))
          }
          break
        case "en_cocina":
          if (p && p.items.some((x) => x.estado === "listo") && p.items.filter((x) => x.estado === "listo").every((x) => x.listo && ahora - x.listo > s(8))) {
            servir(est, m)
            marcar()
          }
          break
        case "servida":
          if (p && en > s(az.entre(55, 85))) {
            if (p.rondas < 2 && az.sig() < 0.4) silencio(() => ejecutar({ tipo: "ordenar", mesaId: m.id, items: postres(az, m.comensales ?? 2) }))
            else silencio(() => ejecutar({ tipo: "llamar", mesaId: m.id, llamado: "cuenta", origen: az.sig() < 0.5 ? "qr" : "mesero" }))
          } else if (p && !m.llamado && az.sig() < 0.004) {
            m.llamado = { tipo: "mesero", desde: ahora, origen: "qr" }
            log({ tipo: "llamado", mesaId: m.id, texto: `${m.nombre} llamó al mesero desde el QR` })
            marcar()
          }
          break
        case "cuenta":
          if (en > s(18)) silencio(() => ejecutar({ tipo: "cobrar", mesaId: m.id, metodo: az.pesado<MetodoPago>([["tarjeta", 6], ["efectivo", 3], ["transferencia", 1]]), propinaPct: az.elegir([0, 5, 10, 10]) }))
          break
        case "limpieza":
          if (en > s(14)) {
            liberar(est, m)
            marcar()
          }
          break
      }
    }

    const libres = est.mesas.filter((m) => m.estado === "libre" && m.zona !== "salon")
    const ocupacion = 1 - libres.length / est.mesas.filter((m) => m.zona !== "salon").length
    if (libres.length > 3 && ocupacion < 0.78 && ahora - mt.ultimoIngreso > s(az.entre(18, 30))) {
      mt.ultimoIngreso = ahora
      const m = az.elegir(libres)
      const comensales = Math.min(m.capacidad, az.entero(2, m.capacidad))
      const sinMesa = est.clientes.filter((x) => !est.mesas.some((y) => y.clienteId === x.id) && !est.reservas.some((r) => r.clienteId === x.id && r.fecha === fechaLocal(ahora)))
      const c = az.sig() < 0.05 && sinMesa.length ? az.elegir(sinMesa) : undefined
      silencio(() => ejecutar({ tipo: "sentar", mesaId: m.id, comensales, clienteId: c?.id }))
    }

    // El piloto solo mueve las reservas de muestra; las reales cambian por lo que haga el cliente o el equipo.
    for (const r of est.reservas) {
      if (r.real || r.fecha !== fechaLocal(ahora)) continue
      const falta = tsLocal(r.fecha, r.hora) - ahora
      if (r.estado === "confirmada" && falta < 3 * 3600 * SEG && falta > 20 * MIN && !r.avisos.some((x) => x.tipo === "recordatorio")) {
        silencio(() => enviarRecordatorio(est, r))
        marcar()
      } else if (r.estado === "recordada" && az.sig() < 0.003) {
        r.estado = "asistencia_confirmada"
        r.avisos.push({ ts: ahora, tipo: "respuesta", texto: "Respondió SÍ al recordatorio", canal: "whatsapp", quien: r.nombre })
        if (r.conversacionId) agregarMensaje(r.conversacionId, { de: "cliente", texto: "Sí, ahí estaremos" })
        log({ tipo: "reserva", reservaId: r.id, clienteId: r.clienteId, texto: `${r.nombre} confirmó que asiste a las ${hora12(r.hora)}` })
        marcar()
      } else if (["confirmada", "recordada", "asistencia_confirmada"].includes(r.estado) && falta < -25 * MIN) {
        silencio(() => estadoReserva(est, r.id, "no_show", "No llegó 25 minutos después de la hora"))
        marcar()
      }
    }
  }

  // Recordatorio de las reservas reales: sale solo, esté o no el piloto, a la hora configurada antes de la reserva.
  for (const r of est.reservas) {
    if (!r.real || r.estado !== "confirmada" || r.avisos.some((x) => x.tipo === "recordatorio")) continue
    const falta = tsLocal(r.fecha, r.hora) - ahora
    if (falta > 0 && falta <= est.config.recordatorioMinutos * MIN && ahora - r.creada > 2 * MIN) {
      silencio(() => enviarRecordatorio(est, r))
      marcar()
    }
  }

  if (minutosDelDia(ahora) !== minutosDelDia(ahora - SEG)) {
    actualizarBloqueos(est, ahora)
    marcar()
  }
  publicar()
}

function favoritosDe(est: Estado, clienteId?: string) {
  const c = cliente(est, clienteId)
  if (!c) return []
  const cuenta = new Map<string, number>()
  for (const v of motor().visitas) if (v.clienteId === c.id) for (const p of v.platos) cuenta.set(p.platoId, (cuenta.get(p.platoId) ?? 0) + p.cantidad)
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k)
}

export function platosFavoritos(clienteId: string) {
  return favoritosDe(motor().estado, clienteId)
}

function silencio(fn: () => void) {
  try {
    fn()
  } catch {
    // el piloto ignora transiciones que ya no aplican
  }
}
