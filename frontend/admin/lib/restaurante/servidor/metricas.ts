import { PLATOS } from "../carta"
import { fechaLocal, minutosDelDia, NOMBRE_CANAL, NOMBRE_ZONA, sumarDias } from "../local"
import { EQUIPO_BASE } from "../plano"
import type { Canal, Reserva, Visita, Zona } from "../tipos"
import { todasLasReservas, todasLasVisitas } from "./motor"

const MIN = 60 * 1000
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const r1 = (n: number) => Math.round(n * 10) / 10
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

function agrupar<T, K>(xs: T[], clave: (x: T) => K) {
  const m = new Map<K, T[]>()
  for (const x of xs) {
    const k = clave(x)
    m.set(k, [...(m.get(k) ?? []), x])
  }
  return m
}

const duracion = (v: Visita) => (v.salida - v.llegada) / MIN
const diaSemana = (ts: number) => new Date(ts - 4 * 3600 * 1000).getUTCDay()

export interface FiltroMetricas {
  dias: number
  zona?: Zona
}

export function metricas({ dias, zona }: FiltroMetricas) {
  const ahora = Date.now()
  const hoy = fechaLocal(ahora)
  const desde = sumarDias(hoy, -(dias - 1))
  const enRango = (ts: number) => fechaLocal(ts) >= desde
  const visitas = todasLasVisitas().filter((v) => enRango(v.llegada) && (!zona || v.zona === zona))
  const previas = todasLasVisitas().filter((v) => {
    const f = fechaLocal(v.llegada)
    return f < desde && f >= sumarDias(desde, -dias) && (!zona || v.zona === zona)
  })
  const reservas = todasLasReservas().filter((r) => r.fecha >= desde && r.fecha <= hoy && (!zona || r.zona === zona))

  const ventas = suma(visitas.map((v) => v.total))
  const ventasPrev = suma(previas.map((v) => v.total))
  const comensales = suma(visitas.map((v) => v.personas))
  const subtotal = suma(visitas.map((v) => v.subtotal))

  const resumen = {
    ventas,
    variacionVentas: ventasPrev ? r1(((ventas - ventasPrev) / ventasPrev) * 100) : null,
    visitas: visitas.length,
    comensales,
    ticketPersona: comensales ? Math.round(subtotal / comensales) : 0,
    ticketMesa: visitas.length ? Math.round(ventas / visitas.length) : 0,
    duracion: r1(prom(visitas.map(duracion))),
    propinas: suma(visitas.map((v) => v.propina)),
    calificacion: r1(prom(visitas.filter((v) => v.calificacion).map((v) => v.calificacion!))),
    calificaciones: visitas.filter((v) => v.calificacion).length,
  }

  const tramos = {
    aOrdenar: r1(prom(visitas.map((v) => (v.orden - v.llegada) / MIN))),
    primerPlato: r1(prom(visitas.map((v) => (v.primerPlato - v.orden) / MIN))),
    comiendo: r1(prom(visitas.map((v) => (v.cuenta - v.primerPlato) / MIN))),
    cuentaAPago: r1(prom(visitas.map((v) => (v.pago - v.cuenta) / MIN))),
    salida: r1(prom(visitas.map((v) => (v.salida - v.pago) / MIN))),
  }

  const porZona = [...agrupar(visitas, (v) => v.zona)].map(([z, vs]) => ({
    zona: z,
    nombre: NOMBRE_ZONA[z],
    visitas: vs.length,
    duracion: r1(prom(vs.map(duracion))),
    ventas: suma(vs.map((v) => v.total)),
    ticketPersona: Math.round(suma(vs.map((v) => v.subtotal)) / Math.max(1, suma(vs.map((v) => v.personas)))),
    aOrdenar: r1(prom(vs.map((v) => (v.orden - v.llegada) / MIN))),
  }))

  const porPersonas = [...agrupar(visitas, (v) => (v.personas >= 8 ? 8 : v.personas))]
    .map(([p, vs]) => ({ personas: p, etiqueta: p >= 8 ? "8 o más" : `${p}`, visitas: vs.length, duracion: r1(prom(vs.map(duracion))), ticket: Math.round(prom(vs.map((v) => v.total))) }))
    .sort((a, b) => a.personas - b.personas)

  const diasEnRango = Math.max(1, dias)
  const porHora = Array.from({ length: 14 }, (_, i) => i + 11).map((h) => {
    const vs = visitas.filter((v) => Math.floor(minutosDelDia(v.llegada) / 60) === h)
    return {
      hora: h,
      etiqueta: `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "p. m." : "a. m."}`,
      llegadas: r1(vs.length / diasEnRango),
      comensales: r1(suma(vs.map((v) => v.personas)) / diasEnRango),
      ventas: Math.round(suma(vs.map((v) => v.total)) / diasEnRango),
      duracion: r1(prom(vs.map(duracion))),
      cocina: r1(prom(vs.flatMap((v) => v.platos.map((p) => p.minutosCocina)))),
    }
  })

  const porDiaSemana = DIAS.map((nombre, d) => {
    const vs = visitas.filter((v) => diaSemana(v.llegada) === d)
    const n = new Set(vs.map((v) => fechaLocal(v.llegada))).size || 1
    return { dia: nombre.slice(0, 3), nombre, ventas: Math.round(suma(vs.map((v) => v.total)) / n), visitas: r1(vs.length / n), duracion: r1(prom(vs.map(duracion))) }
  })

  const serie = Array.from({ length: dias }, (_, i) => {
    const f = sumarDias(desde, i)
    const vs = visitas.filter((v) => fechaLocal(v.llegada) === f)
    return { fecha: f, ventas: suma(vs.map((v) => v.total)), visitas: vs.length, comensales: suma(vs.map((v) => v.personas)) }
  })

  const conteo = new Map<string, { cantidad: number; importe: number; mesas: number; cocina: number[] }>()
  const pares = new Map<string, number>()
  for (const v of visitas) {
    const ids = new Set<string>()
    for (const p of v.platos) {
      const x = conteo.get(p.platoId) ?? { cantidad: 0, importe: 0, mesas: 0, cocina: [] }
      x.cantidad += PLATOS.get(p.platoId)?.porLibra ? 1 : p.cantidad
      x.importe += p.importe
      x.cocina.push(p.minutosCocina)
      conteo.set(p.platoId, x)
      ids.add(p.platoId)
    }
    for (const id of ids) conteo.get(id)!.mesas++
    const lista = [...ids].filter((id) => !["Guarniciones"].includes(PLATOS.get(id)?.categoria ?? "")).sort()
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) pares.set(`${lista[i]}|${lista[j]}`, (pares.get(`${lista[i]}|${lista[j]}`) ?? 0) + 1)
  }
  const platos = [...PLATOS.values()]
    .map((p) => {
      const x = conteo.get(p.id)
      return {
        platoId: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        estacion: p.estacion,
        foto: p.foto,
        precio: p.precio,
        cantidad: x?.cantidad ?? 0,
        importe: x?.importe ?? 0,
        mesasPct: visitas.length ? r1(((x?.mesas ?? 0) / visitas.length) * 100) : 0,
        cocina: r1(prom(x?.cocina ?? [])),
        objetivo: p.minutos,
      }
    })
    .sort((a, b) => b.cantidad - a.cantidad)
  const combos = [...pares.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, veces]) => {
      const [a, b] = k.split("|")
      return { a: PLATOS.get(a)!.nombre, b: PLATOS.get(b)!.nombre, veces, pct: r1((veces / Math.max(1, visitas.length)) * 100) }
    })
  const categorias = [...agrupar(platos, (p) => p.categoria)].map(([categoria, ps]) => ({ categoria, importe: suma(ps.map((p) => p.importe)), cantidad: suma(ps.map((p) => p.cantidad)) })).sort((a, b) => b.importe - a.importe)
  const estaciones = (["caliente", "fria", "postres"] as const).map((e) => {
    const ps = platos.filter((p) => p.estacion === e && p.cantidad)
    const tiempos = visitas.flatMap((v) => v.platos.filter((p) => PLATOS.get(p.platoId)?.estacion === e))
    return {
      estacion: e,
      nombre: { caliente: "Cocina caliente", fria: "Fría y sushi", postres: "Postres" }[e],
      platos: suma(ps.map((p) => p.cantidad)),
      minutos: r1(prom(tiempos.map((t) => t.minutosCocina))),
      fueraDeTiempo: r1((tiempos.filter((t) => t.minutosCocina > (PLATOS.get(t.platoId)?.minutos ?? 99) * 1.3).length / Math.max(1, tiempos.length)) * 100),
    }
  })

  const equipo = EQUIPO_BASE.filter((p) => p.rol === "mesero").map((p) => {
    const vs = visitas.filter((v) => v.meseroId === p.id)
    const llam = vs.filter((v) => v.llamados)
    return {
      id: p.id,
      nombre: p.nombre,
      color: p.color,
      mesas: vs.length,
      comensales: suma(vs.map((v) => v.personas)),
      ventas: suma(vs.map((v) => v.total)),
      propinas: suma(vs.map((v) => v.propina)),
      ticket: Math.round(prom(vs.map((v) => v.total))),
      aOrdenar: r1(prom(vs.map((v) => (v.orden - v.llegada) / MIN))),
      esperaLlamado: Math.round(prom(llam.map((v) => v.esperaLlamado))),
      calificacion: r1(prom(vs.filter((v) => v.calificacion).map((v) => v.calificacion!))),
    }
  })

  const canales = [...agrupar(visitas, (v) => v.canal)]
    .map(([c, vs]) => ({ canal: c, nombre: NOMBRE_CANAL[c as Canal], visitas: vs.length, ventas: suma(vs.map((v) => v.total)) }))
    .sort((a, b) => b.visitas - a.visitas)

  const reservasCerradas = reservas.filter((r) => ["completada", "no_show", "cancelada"].includes(r.estado))
  const conRecordatorio = reservasCerradas.filter((r) => r.avisos.some((a) => a.tipo === "recordatorio"))
  const pct = (n: number, d: number) => (d ? r1((n / d) * 100) : 0)
  const reservasM = {
    total: reservas.length,
    completadas: reservasCerradas.filter((r) => r.estado === "completada").length,
    noShow: pct(reservasCerradas.filter((r) => r.estado === "no_show").length, reservasCerradas.length),
    cancelacion: pct(reservasCerradas.filter((r) => r.estado === "cancelada").length, reservasCerradas.length),
    respondenRecordatorio: pct(conRecordatorio.filter((r) => r.avisos.some((a) => a.tipo === "respuesta")).length, conRecordatorio.length),
    noShowSinRespuesta: pct(
      conRecordatorio.filter((r) => r.estado === "no_show" && !r.avisos.some((a) => a.tipo === "respuesta")).length,
      conRecordatorio.filter((r) => !r.avisos.some((a) => a.tipo === "respuesta")).length,
    ),
    anticipacionHoras: r1(prom(reservas.map((r: Reserva) => (Date.parse(`${r.fecha}T${r.hora}:00-04:00`) - r.creada) / (60 * MIN)))),
    porCanal: [...agrupar(reservas, (r) => r.canal)].map(([c, rs]) => ({ canal: c, nombre: NOMBRE_CANAL[c], reservas: rs.length, noShow: pct(rs.filter((r) => r.estado === "no_show").length, rs.length) })).sort((a, b) => b.reservas - a.reservas),
    conReserva: pct(visitas.filter((v) => v.reservaId).length, visitas.length),
  }

  return { dias, desde, hasta: hoy, zona: zona ?? null, resumen, tramos, porZona, porPersonas, porHora, porDiaSemana, serie, platos, combos, categorias, estaciones, equipo, canales, reservas: reservasM }
}

export type Metricas = ReturnType<typeof metricas>

export function visitaPorId(id: string) {
  return todasLasVisitas().find((v) => v.id === id)
}
