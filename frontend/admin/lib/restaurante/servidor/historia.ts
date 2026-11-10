import { CARTA, PLATOS, totales } from "../carta"
import { fechaLocal, NOMBRE_ZONA, sumarDias, tsLocal } from "../local"
import { EQUIPO_BASE, MESAS_BASE } from "../plano"
import type { Canal, Cliente, MetodoPago, Plato, Reserva, Visita, Zona } from "../tipos"
import { crearAzar, type Azar } from "./azar"
import { nombreCanal, SEMILLAS } from "./clientes"

const MIN = 60 * 1000
export const DIAS_HISTORIA = 60

const LLEGADAS_POR_HORA: [number, number][] = [
  [11, 0.3], [12, 0.8], [13, 1.5], [14, 1.4], [15, 0.8], [16, 0.5], [17, 0.8],
  [18, 1.3], [19, 1.8], [20, 1.9], [21, 1.3], [22, 0.6], [23, 0.2],
]
const POR_DIA = [62, 34, 36, 38, 44, 58, 72] // domingo a sábado

const PESO_PLATO: Record<string, number> = {
  "muelas-centollo": 0.12, "goat-cheese": 0.2, "crema-auyama": 0.3, "asopao-langosta": 0.3, "risotto-churrasco": 0.35,
  "sushi-vegetariano": 0.4, "vegetales-grill": 0.3, "carpaccio-res": 0.35, "lasagna-langosta": 0.4, "cordon-bleu": 0.45,
  "paella-4": 0.6, "langosta-thermidor": 0.7, "filete-pimienta": 0.6, "selva-negra": 0.5, "panacota-chinola": 0.5,
}
const pesoPlato = (p: Plato) => PESO_PLATO[p.id] ?? (p.destacado ? 3 : 1)

const CATS_ENTRADA = ["Entradas frías", "Entradas calientes", "Sopas y cremas", "Ensaladas", "Sushi"]
const CATS_FUERTE = ["Del mar", "Especialidades", "Carnes y aves", "Pastas"]

export const VELOCIDAD_MESERO: Record<string, number> = { yanelis: 0.7, junior: 1, ramon: 1.6, wendy: 0.9, carolina: 1 }

export function meserosDeZona(zona: Zona) {
  return EQUIPO_BASE.filter((p) => p.rol === "mesero" && p.zonas.includes(zona)).map((p) => p.id)
}

export function elegirPlatos(az: Azar, personas: number, favoritos: string[] = []) {
  const de = (cats: string[]) => CARTA.filter((p) => cats.includes(p.categoria))
  const lista: { platoId: string; cantidad: number; mods: string[] }[] = []
  const tomar = (cats: string[]) => {
    const opciones = de(cats)
    const fav = favoritos.filter((f) => opciones.some((p) => p.id === f))
    const p = fav.length && az.sig() < 0.55 ? PLATOS.get(az.elegir(fav))! : az.pesado(opciones.map((p) => [p, pesoPlato(p)] as [Plato, number]))
    const ya = lista.find((x) => x.platoId === p.id)
    if (ya && !p.porLibra) return void ya.cantidad++
    const mods = (p.opciones ?? []).map((o) => `${o.nombre}: ${az.elegir(o.valores)}`)
    if (az.sig() < 0.1) mods.push(az.elegir(["Sin cebolla", "Sin picante", "Salsa aparte", "Sin ajo", "Bien dorado"]))
    lista.push({ platoId: p.id, cantidad: p.porLibra ? az.elegir([1.5, 2, 2.5]) : 1, mods })
  }
  const entradas = Math.max(1, Math.round((personas * az.entre(0.4, 0.8))))
  for (let i = 0; i < entradas; i++) tomar(CATS_ENTRADA)
  for (let i = 0; i < personas; i++) {
    if (personas >= 4 && i === 0 && az.sig() < 0.35) {
      const esp = de(["Especialidades"]).filter((p) => p.id.endsWith(personas >= 4 ? "-4" : "-2") || !/-\d$/.test(p.id))
      const p = az.pesado(esp.map((p) => [p, pesoPlato(p)] as [Plato, number]))
      lista.push({ platoId: p.id, cantidad: 1, mods: [] })
      i += p.id.endsWith("-4") ? 3 : 1
      continue
    }
    tomar(CATS_FUERTE)
  }
  if (az.sig() < 0.3) tomar(["Guarniciones"])
  return lista
}

export function postres(az: Azar, personas: number) {
  const lista: { platoId: string; cantidad: number; mods: string[] }[] = []
  const n = Math.max(1, Math.ceil(personas / 2))
  for (let i = 0; i < n; i++) {
    const p = az.pesado(CARTA.filter((x) => x.categoria === "Postres").map((x) => [x, pesoPlato(x)] as [Plato, number]))
    const ya = lista.find((x) => x.platoId === p.id)
    if (ya) ya.cantidad++
    else lista.push({ platoId: p.id, cantidad: 1, mods: [] })
  }
  return lista
}

export const CANALES_RESERVA: [Canal, number][] = [["whatsapp", 42], ["telefono", 18], ["instagram", 14], ["web", 14], ["voz", 12]]
const METODOS: [MetodoPago, number][] = [["tarjeta", 62], ["efectivo", 24], ["transferencia", 14]]

let numeroCodigo = 4200
export function codigoReserva() {
  return `BM-${++numeroCodigo}`
}

interface Historia {
  visitas: Visita[]
  reservas: Reserva[]
  clientes: Cliente[]
}

export function crearHistoria(ahora: number): Historia {
  const az = crearAzar(26102026)
  const hoy = fechaLocal(ahora)
  const visitas: Visita[] = []
  const reservas: Reserva[] = []
  const clientes: Cliente[] = SEMILLAS.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    telefono: s.telefono,
    correo: s.correo,
    idioma: s.idioma,
    canalOrigen: s.canalOrigen,
    creado: ahora - (DIAS_HISTORIA + az.entero(5, 400)) * 24 * 60 * MIN,
    visitas: 0,
    gasto: 0,
    puntos: 0,
    preferencias: s.preferencias,
    ocasiones: s.ocasiones,
    alergias: s.alergias,
    etiqueta: s.etiqueta,
    empresa: s.empresa,
    cumpleanos: s.cumpleanos,
    recorrido: [],
  }))
  for (const c of clientes) {
    c.recorrido.push({ ts: c.creado, tipo: "contacto", texto: `Primer contacto por ${nombreCanal(c.canalOrigen)}`, canal: c.canalOrigen })
  }
  const agenda = new Map<string, { clienteId: string }[]>()
  for (const s of SEMILLAS) {
    const n = Math.round(s.frecuencia * 2 * az.entre(0.8, 1.2))
    for (let i = 0; i < n; i++) {
      const dia = sumarDias(hoy, -az.entero(1, DIAS_HISTORIA))
      agenda.set(dia, [...(agenda.get(dia) ?? []), { clienteId: s.id }])
    }
  }

  for (let d = DIAS_HISTORIA; d >= 0; d--) {
    const fecha = sumarDias(hoy, -d)
    const dow = new Date(`${fecha}T12:00:00-04:00`).getUTCDay()
    const total = Math.round(POR_DIA[dow] * az.entre(0.85, 1.15))
    const conocidos = agenda.get(fecha) ?? []
    for (let i = 0; i < total + conocidos.length; i++) {
      const clienteId = i < conocidos.length ? conocidos[i].clienteId : undefined
      const semilla = clienteId ? SEMILLAS.find((s) => s.id === clienteId) : undefined
      const hora = az.pesado(LLEGADAS_POR_HORA)
      const llegada = tsLocal(fecha, `${String(hora).padStart(2, "0")}:00`) + az.entero(0, 59) * MIN
      const v = crearVisita(az, llegada, { clienteId, zona: semilla?.zona, favoritos: semilla?.favoritos })
      if (v.salida > ahora - 10 * MIN) continue
      visitas.push(v)
      if (v.reservaId) reservas.push(reservaDeVisita(az, v, clientes))
    }
    const extras = Math.round(total * 0.45 * az.entre(0.12, 0.2))
    for (let i = 0; i < extras; i++) {
      const hora = az.pesado(LLEGADAS_POR_HORA)
      const t = tsLocal(fecha, `${String(hora).padStart(2, "0")}:${az.elegir(["00", "30"])}`)
      if (t > ahora - 60 * MIN) continue
      const noShow = az.sig() < 0.42
      const zona = az.pesado<Zona>([["terraza", 4], ["muelle", 3], ["gazebo", 2]])
      const r: Reserva = {
        id: `rh-${fecha}-${i}`,
        codigo: codigoReserva(),
        clienteId: `anon-${fecha}-${i}`,
        nombre: "Cliente sin ficha",
        telefono: "",
        fecha,
        hora: `${String(hora).padStart(2, "0")}:00`,
        personas: az.elegir([2, 2, 3, 4, 4, 6]),
        zona,
        canal: az.pesado(CANALES_RESERVA),
        estado: noShow ? "no_show" : "cancelada",
        creada: t - az.entero(4, 96) * 60 * MIN,
        avisos: [],
      }
      r.avisos.push({ ts: r.creada, tipo: "confirmacion", texto: "Reserva confirmada", canal: r.canal, quien: "Asistente" })
      if (noShow) r.avisos.push({ ts: t - 3 * 60 * MIN, tipo: "recordatorio", texto: "Recordatorio enviado, sin respuesta", canal: "whatsapp", quien: "Asistente" })
      else r.avisos.push({ ts: t - az.entero(2, 30) * 60 * MIN, tipo: "cancelacion", texto: "El cliente canceló por WhatsApp", canal: "whatsapp", quien: "Asistente" })
      reservas.push(r)
    }
  }

  for (const v of visitas) {
    if (!v.clienteId) continue
    const c = clientes.find((x) => x.id === v.clienteId)
    if (!c) continue
    c.visitas++
    c.gasto += v.total
    c.puntos += Math.floor(v.total / 100)
    c.ultimaVisita = v.salida
    const mesa = MESAS_BASE.find((m) => m.id === v.mesaId)
    c.recorrido.push(
      { ts: v.llegada, tipo: "llegada", texto: `Llegó con ${v.personas} a ${NOMBRE_ZONA[v.zona]}, mesa ${mesa?.nombre ?? v.mesaId}`, enlace: `/admin/visitas/${v.id}` },
      { ts: v.pago, tipo: "pago", texto: `Consumo de RD$ ${v.total.toLocaleString("es-DO")} en ${Math.round((v.salida - v.llegada) / MIN)} min`, enlace: `/admin/visitas/${v.id}` },
    )
    if (v.calificacion) c.recorrido.push({ ts: v.salida + 40 * MIN, tipo: "resena", texto: `Calificó la visita con ${v.calificacion} de 5` })
  }
  for (const c of clientes) c.recorrido.sort((a, b) => a.ts - b.ts)
  return { visitas, reservas, clientes }
}

export function crearVisita(az: Azar, llegada: number, o: { clienteId?: string; zona?: Zona; favoritos?: string[]; reserva?: boolean } = {}): Visita {
  const zona: Zona = o.zona ?? az.pesado<Zona>([["terraza", 38], ["muelle", 32], ["gazebo", 14], ["salon", 6]])
  const personas =
    zona === "salon" ? az.entero(6, 12) : zona === "gazebo" ? az.pesado([[2, 8], [3, 1], [4, 1]]) : az.pesado([[2, 42], [3, 12], [4, 25], [5, 6], [6, 8]])
  const mesas = MESAS_BASE.filter((m) => m.zona === zona && m.capacidad >= personas)
  const mesa = mesas.length ? az.elegir(mesas) : az.elegir(MESAS_BASE.filter((m) => m.zona === zona))
  const meseroId = az.elegir(meserosDeZona(zona))
  const hora = new Date(llegada).getUTCHours() - 4
  const pico = [13, 14, 19, 20].includes((hora + 24) % 24) ? 1.25 : 1
  const lista = elegirPlatos(az, personas, o.favoritos)
  if (az.sig() < 0.38) lista.push(...postres(az, personas))
  const platos = lista.map((x) => {
    const p = PLATOS.get(x.platoId)!
    return { platoId: p.id, cantidad: x.cantidad, importe: Math.round(p.precio * x.cantidad), minutosCocina: Math.round(p.minutos * az.entre(0.85, 1.5) * pico * 10) / 10 }
  })
  const orden = llegada + az.entre(5, 13) * pico * MIN
  const entradas = platos.filter((p) => CATS_ENTRADA.includes(PLATOS.get(p.platoId)!.categoria))
  const primerPlato = orden + Math.max(...(entradas.length ? entradas : platos).map((p) => p.minutosCocina)) * MIN
  const base = { terraza: 72, muelle: 82, gazebo: 108, salon: 128 }[zona]
  const cuenta = Math.max(primerPlato + 25 * MIN, llegada + (base + personas * 4 + az.entre(-15, 25)) * MIN)
  const pago = cuenta + az.entre(3, 10) * MIN
  const salida = pago + az.entre(2, 8) * MIN
  const subtotal = platos.reduce((s, p) => s + p.importe, 0)
  const propina = az.sig() < 0.6 ? Math.round(subtotal * az.elegir([0.05, 0.1])) : 0
  const t = totales(subtotal, propina)
  const conReserva = o.reserva ?? (zona === "gazebo" || zona === "salon" ? az.sig() < 0.8 : az.sig() < 0.4)
  const llamados = az.pesado([[0, 5], [1, 4], [2, 2], [3, 1]])
  return {
    id: `v-${llegada.toString(36)}-${az.entero(100, 999)}`,
    mesaId: mesa.id,
    zona,
    personas,
    meseroId,
    clienteId: o.clienteId,
    reservaId: conReserva ? `r-${llegada.toString(36)}` : undefined,
    canal: conReserva ? az.pesado(CANALES_RESERVA) : "presencial",
    llegada,
    orden,
    primerPlato,
    cuenta,
    pago,
    salida,
    platos,
    ...t,
    metodo: az.pesado(METODOS),
    llamados,
    esperaLlamado: llamados ? Math.round(az.entre(35, 150) * (VELOCIDAD_MESERO[meseroId] ?? 1)) : 0,
    calificacion: az.sig() < 0.35 ? az.pesado([[5, 6], [4, 3], [3, 1]]) : undefined,
  }
}

function reservaDeVisita(az: Azar, v: Visita, clientes: Cliente[]): Reserva {
  const c = v.clienteId ? clientes.find((x) => x.id === v.clienteId) : undefined
  const fecha = fechaLocal(v.llegada)
  const d = new Date(v.llegada - 4 * 3600 * 1000)
  const hora = `${String(d.getUTCHours()).padStart(2, "0")}:${d.getUTCMinutes() < 30 ? "00" : "30"}`
  const creada = v.llegada - az.entero(3, 120) * 60 * MIN
  const r: Reserva = {
    id: v.reservaId!,
    codigo: codigoReserva(),
    clienteId: c?.id ?? `anon-${v.id}`,
    nombre: c?.nombre ?? "Cliente sin ficha",
    telefono: c?.telefono ?? "",
    fecha,
    hora,
    personas: v.personas,
    zona: v.zona,
    mesaId: v.mesaId,
    canal: v.canal,
    estado: "completada",
    creada,
    visitaId: v.id,
    avisos: [{ ts: creada + MIN, tipo: "confirmacion", texto: "Reserva confirmada", canal: v.canal === "voz" || v.canal === "telefono" ? "whatsapp" : v.canal, quien: "Asistente" }],
  }
  if (v.llegada - creada > 4 * 60 * MIN) {
    r.avisos.push({ ts: v.llegada - 3 * 60 * MIN, tipo: "recordatorio", texto: "Recordatorio de la reserva", canal: "whatsapp", quien: "Asistente" })
    if (az.sig() < 0.72) r.avisos.push({ ts: v.llegada - az.entero(60, 170) * MIN, tipo: "respuesta", texto: "Confirmó que asiste", canal: "whatsapp", quien: r.nombre })
  }
  if (c) c.recorrido.push({ ts: creada, tipo: "reserva", texto: `Reservó para ${v.personas} en ${NOMBRE_ZONA[v.zona]} por ${nombreCanal(v.canal)}`, canal: v.canal, enlace: `/admin/reservaciones/${r.id}` })
  return r
}
