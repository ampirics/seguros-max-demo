import { CARTA, PLATOS } from "../carta"
import { costoPlato, INSUMOS_BASE, PROVEEDORES, RECETAS } from "../inventario"
import { fechaLocal, tsLocal } from "../local"
import type { Caja, CategoriaGasto, Estado, Gasto, Insumo, MetodoPago, MovimientoInsumo, OrdenCompra, Visita } from "../tipos"

// Caja, inventario, compras y gastos. Los costos y montos son DE EJEMPLO.

const DIA = 24 * 3600 * 1000

export type AccionNegocio =
  | { tipo: "abrirCaja"; fondo: number; cajero: string }
  | { tipo: "movimientoCaja"; movimiento: "ingreso" | "retiro"; monto: number; texto: string }
  | { tipo: "cerrarCaja"; contado: number; nota?: string }
  | { tipo: "ajustarInsumo"; insumoId: string; existencia: number; motivo?: string }
  | { tipo: "compraSugerida"; proveedorId?: string }
  | { tipo: "crearCompra"; proveedorId: string; lineas: { insumoId: string; cantidad: number }[] }
  | { tipo: "enviarCompra"; compraId: string }
  | { tipo: "recibirCompra"; compraId: string }
  | { tipo: "pagarCompra"; compraId: string; metodo: MetodoPago; deCaja?: boolean }
  | { tipo: "cancelarCompra"; compraId: string }
  | { tipo: "gasto"; categoria: CategoriaGasto; descripcion: string; monto: number; metodo: MetodoPago | "credito"; deCaja?: boolean; comprobante?: string; proveedorId?: string }

export const TIPOS_NEGOCIO = new Set<string>(["abrirCaja", "movimientoCaja", "cerrarCaja", "ajustarInsumo", "compraSugerida", "crearCompra", "enviarCompra", "recibirCompra", "pagarCompra", "cancelarCompra", "gasto"])

export interface Libros {
  gastos: Gasto[]
  movimientos: MovimientoInsumo[]
  /** Compras viejas (ya recibidas) que no viajan en el estado. */
  historicas: OrdenCompra[]
}

export interface Ayudas {
  id: (prefijo: string) => string
  log: (texto: string) => void
  quien: string
}

const redondear = (n: number) => Math.round(n * 100) / 100

// ---------- semilla ----------

function azar(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/** 60 días de gastos de ejemplo que acompañan a las ventas de la historia. */
export function sembrarLibros(visitas: Visita[], ahora: number, id: (p: string) => string): Libros {
  const r = azar(20261024)
  const gastos: Gasto[] = []
  const historicas: OrdenCompra[] = []
  const movimientos: MovimientoInsumo[] = []
  let n = 600
  // Consumo promedio por día de cada insumo según lo vendido: de ahí salen las cantidades de cada compra.
  const diasConVentas = new Set(visitas.map((v) => fechaLocal(v.pago))).size || 1
  const promedio = new Map<string, number>()
  for (const v of visitas)
    for (const p of v.platos)
      for (const [insumoId, c] of Object.entries(RECETAS[p.platoId] ?? {})) promedio.set(insumoId, (promedio.get(insumoId) ?? 0) + (c * p.cantidad) / diasConVentas)
  const CADA: Record<string, number> = { pescaderia: 1, mercado: 1, carnes: 2.3, distribuidora: 3.5 }
  const ventasDia = new Map<string, number>()
  for (const v of visitas) ventasDia.set(fechaLocal(v.pago), (ventasDia.get(fechaLocal(v.pago)) ?? 0) + v.subtotal)
  const hoy = fechaLocal(ahora)
  for (let d = 60; d >= 0; d--) {
    const t = ahora - d * DIA
    const f = fechaLocal(t)
    const base = tsLocal(f, "09:00")
    const ventas = ventasDia.get(f) ?? 60000
    const g = (categoria: CategoriaGasto, descripcion: string, monto: number, metodo: Gasto["metodo"], hora: string, proveedorId?: string, deCaja = false) => {
      const ts = tsLocal(f, hora)
      if (f === hoy && ts > ahora) return
      const gasto: Gasto = { id: id("g-"), ts, categoria, descripcion, monto: Math.round(monto), metodo, proveedorId, deCaja, quien: "Lorena Paulino" }
      if (categoria === "insumos" && proveedorId) {
        // La compra detrás del gasto: insumos de ese proveedor que suman el monto.
        const paso = (i: (typeof INSUMOS_BASE)[number]) => (i.unidad === "kg" || i.unidad === "l" ? 0.5 : 1)
        const lineas = INSUMOS_BASE.filter((i) => i.proveedorId === proveedorId && (promedio.get(i.id) ?? 0) > 0)
          .map((i) => {
            const c = (promedio.get(i.id) ?? 0) * (CADA[proveedorId] ?? 1) * (0.9 + r() * 0.3)
            return { insumoId: i.id, cantidad: Math.max(paso(i), Math.round(c / paso(i)) * paso(i)), costo: i.costo }
          })
        const total = Math.round(lineas.reduce((x, l) => x + l.cantidad * l.costo, 0))
        const oc: OrdenCompra = { id: id("oc-"), codigo: `OC-0${++n}`, proveedorId, estado: "recibida", lineas, total, creada: ts - 12 * 3600000, enviada: ts - 11 * 3600000, recibida: ts, pagada: metodo === "credito" ? undefined : { ts, metodo, deCaja }, quien: "Héctor Valdez" }
        historicas.push(oc)
        gasto.monto = total
        gasto.compraId = oc.id
        gasto.descripcion = `${descripcion} · ${oc.codigo}`
        for (const l of lineas) movimientos.push({ ts, insumoId: l.insumoId, cantidad: l.cantidad, tipo: "compra", texto: `Compra ${oc.codigo}`, compraId: oc.id, quien: "Héctor Valdez" })
      }
      gastos.push(gasto)
    }
    const dia = new Date(base).getUTCDay()
    g("insumos", "Pescados y mariscos del día", ventas * (0.16 + r() * 0.04), "transferencia", "07:30", "pescaderia")
    g("insumos", "Vegetales y frutas", ventas * (0.03 + r() * 0.01), "efectivo", "07:00", "mercado", true)
    if (dia === 2 || dia === 4 || dia === 6) g("insumos", "Carnes y aves", ventas * (0.08 + r() * 0.03), "transferencia", "08:30", "carnes")
    if (dia === 1 || dia === 4) g("insumos", "Despensa, lácteos y bebidas", ventas * (0.12 + r() * 0.04), "credito", "10:00", "distribuidora")
    if (r() < 0.25) g("mantenimiento", ["Gas propano de cocina", "Reparación de la nevera de pescado", "Limpieza del muelle", "Mantenimiento del aire acondicionado"][Math.floor(r() * 4)], 2500 + r() * 9000, "efectivo", "11:00", undefined, true)
    if (r() < 0.3) g("otros", ["Hielo", "Flores para las mesas", "Velas y decoración", "Artículos de limpieza"][Math.floor(r() * 4)], 800 + r() * 2500, "efectivo", "12:00", undefined, true)
    const diaMes = Number(f.slice(8))
    if (diaMes === 15 || diaMes === 30) g("nomina", "Nómina quincenal del equipo", 385000, "transferencia", "15:00")
    if (diaMes === 5) g("servicios", "Energía eléctrica (Edeeste)", 96000, "transferencia", "11:00")
    if (diaMes === 7) g("servicios", "Agua, internet y teléfono", 18500, "transferencia", "11:00")
    if (diaMes === 10) g("servicios", "Alquiler del local", 210000, "transferencia", "11:00")
  }
  // Consumo de los últimos 14 días según lo vendido: un movimiento por insumo y por día.
  const desde = fechaLocal(ahora - 14 * DIA)
  const consumo = new Map<string, number>()
  for (const v of visitas) {
    const f = fechaLocal(v.pago)
    if (f < desde || f === hoy) continue
    for (const p of v.platos)
      for (const [insumoId, c] of Object.entries(RECETAS[p.platoId] ?? {})) consumo.set(`${f}|${insumoId}`, (consumo.get(`${f}|${insumoId}`) ?? 0) + c * p.cantidad)
  }
  for (const [k, c] of consumo) {
    const [f, insumoId] = k.split("|")
    movimientos.push({ ts: tsLocal(f, "23:30"), insumoId, cantidad: -redondear(c), tipo: "consumo", texto: "Consumo del día (cierre de cocina)" })
  }
  movimientos.sort((a, b) => a.ts - b.ts)
  return { gastos: gastos.sort((a, b) => a.ts - b.ts), historicas, movimientos }
}

export function sembrarNegocio(est: Estado, ahora: number, id: (p: string) => string, visitas: Visita[] = []) {
  est.insumos = INSUMOS_BASE.map((i) => ({ ...i }))
  const hoy = fechaLocal(ahora)
  const ayer = ahora - DIA
  const lineas = (proveedorId: string, n: number) =>
    INSUMOS_BASE.filter((i) => i.proveedorId === proveedorId)
      .slice(0, n)
      .map((i) => ({ insumoId: i.id, cantidad: Math.max(1, Math.round(i.minimo * 1.5)), costo: i.costo }))
  const oc = (codigo: string, proveedorId: string, estado: OrdenCompra["estado"], creada: number, n: number): OrdenCompra => {
    const l = lineas(proveedorId, n)
    return { id: id("oc-"), codigo, proveedorId, estado, lineas: l, total: Math.round(l.reduce((s, x) => s + x.cantidad * x.costo, 0)), creada, enviada: creada + 600000, recibida: estado === "recibida" ? creada + 4 * 3600000 : undefined, pagada: estado === "recibida" ? { ts: creada + 5 * 3600000, metodo: "transferencia", deCaja: false } : undefined, quien: "Héctor Valdez" }
  }
  est.compras = [oc("OC-1041", "pescaderia", "recibida", ayer - 2 * 3600000, 6), oc("OC-1042", "distribuidora", "enviada", tsLocal(hoy, "08:15"), 5)]
  const apertura = Math.min(ahora, tsLocal(hoy, "10:30"))
  const caja: Caja = { id: id("cj-"), abierta: apertura, cajero: "Mariel Santana", fondo: 5000, movimientos: [] }
  for (const v of est.visitasHoy.filter((x) => x.pago >= apertura)) caja.movimientos.push({ ts: v.pago, tipo: "venta", metodo: v.metodo, monto: v.total, texto: `Mesa ${v.mesaId}`, mesaId: v.mesaId, visitaId: v.id })
  est.caja = caja
  const deAyer = visitas.filter((v) => fechaLocal(v.pago) === fechaLocal(ayer))
  const cerrada: Caja = { id: id("cj-"), abierta: tsLocal(fechaLocal(ayer), "10:30"), cerrada: tsLocal(fechaLocal(ayer), "23:40"), cajero: "Mariel Santana", fondo: 5000, movimientos: deAyer.map((v) => ({ ts: v.pago, tipo: "venta" as const, metodo: v.metodo, monto: v.total, texto: `Mesa ${v.mesaId}`, mesaId: v.mesaId, visitaId: v.id })) }
  cerrada.movimientos.push({ ts: tsLocal(fechaLocal(ayer), "16:00"), tipo: "retiro", metodo: "efectivo", monto: 20000, texto: "Depósito al banco" })
  cerrada.esperado = Math.round(resumenCaja(cerrada).efectivoEsperado)
  cerrada.contado = cerrada.esperado - 200
  cerrada.diferencia = -200
  cerrada.nota = "Faltaron RD$ 200 en monedas"
  est.cajasCerradas = [cerrada]
}

// ---------- inventario ----------

/** Lo que el cliente pidió quitar ("Sin cebolla") no se descuenta. */
export function recetaEfectiva(platoId: string, mods: string[] | undefined, insumos: Insumo[]) {
  const quitar = (mods ?? []).map((m) => m.match(/^sin\s+(.+)$/i)?.[1]?.trim().toLowerCase()).filter((x): x is string => !!x)
  return Object.entries(RECETAS[platoId] ?? {}).filter(([insumoId]) => {
    const nombre = (insumos.find((i) => i.id === insumoId)?.nombre ?? insumoId).toLowerCase()
    return !quitar.some((q) => nombre.includes(q) || insumoId.includes(q) || q.includes(nombre.split(" ")[0]))
  })
}

/** Descuenta los insumos de lo que se manda a cocina. Si algo no alcanza, no deja mandar el plato. */
export function descontar(est: Estado, movimientos: MovimientoInsumo[], items: { platoId: string; cantidad: number; mods?: string[] }[], ctx: { mesaId?: string; texto: string; quien?: string }) {
  const insumos = est.insumos
  if (!insumos) return
  const total = new Map<string, number>()
  for (const it of items) for (const [insumoId, c] of recetaEfectiva(it.platoId, it.mods, insumos)) total.set(insumoId, (total.get(insumoId) ?? 0) + c * it.cantidad)
  for (const it of items) {
    const falta = recetaEfectiva(it.platoId, it.mods, insumos)
      .filter(([insumoId]) => (insumos.find((i) => i.id === insumoId)?.existencia ?? 0) < (total.get(insumoId) ?? 0))
      .map(([insumoId]) => insumos.find((i) => i.id === insumoId)?.nombre ?? insumoId)
    if (falta.length) throw new Error(`${PLATOS.get(it.platoId)?.nombre ?? "El plato"} está agotado: no alcanza ${falta.join(", ").toLowerCase()}`)
  }
  const ahora = Date.now()
  for (const [insumoId, c] of total) {
    const i = insumos.find((x) => x.id === insumoId)
    if (!i) continue
    i.existencia = redondear(Math.max(0, i.existencia - c))
    movimientos.push({ ts: ahora, insumoId, cantidad: -redondear(c), tipo: "consumo", texto: ctx.texto, mesaId: ctx.mesaId, quien: ctx.quien })
  }
}

// ---------- caja ----------

export function resumenCaja(c: Caja) {
  const suma = (f: (m: Caja["movimientos"][number]) => boolean) => c.movimientos.filter(f).reduce((s, m) => s + m.monto, 0)
  const porMetodo = (metodo: MetodoPago) => suma((m) => m.tipo === "venta" && m.metodo === metodo)
  const ventas = { efectivo: porMetodo("efectivo"), tarjeta: porMetodo("tarjeta"), transferencia: porMetodo("transferencia") }
  const ingresos = suma((m) => m.tipo === "ingreso")
  const salidas = suma((m) => (m.tipo === "retiro" || m.tipo === "gasto") && m.metodo === "efectivo")
  return { ventas, totalVentas: ventas.efectivo + ventas.tarjeta + ventas.transferencia, ingresos, salidas, efectivoEsperado: c.fondo + ventas.efectivo + ingresos - salidas }
}

export function registrarVentaEnCaja(est: Estado, v: Visita) {
  est.caja?.movimientos.push({ ts: v.pago, tipo: "venta", metodo: v.metodo, monto: v.total, texto: `Mesa ${v.mesaId}`, mesaId: v.mesaId, visitaId: v.id })
}

// ---------- acciones ----------

function compra(est: Estado, compraId: string) {
  const c = est.compras?.find((x) => x.id === compraId)
  if (!c) throw new Error("No existe la orden de compra")
  return c
}

const proveedor = (id: string) => PROVEEDORES.find((p) => p.id === id)?.nombre ?? id

function siguienteCodigo(est: Estado) {
  const n = Math.max(1040, ...(est.compras ?? []).map((c) => Number(c.codigo.slice(3)) || 0))
  return `OC-${n + 1}`
}

function nuevaCompra(est: Estado, proveedorId: string, lineas: { insumoId: string; cantidad: number }[], a: Ayudas) {
  const insumos = est.insumos ?? []
  const l = lineas
    .filter((x) => x.cantidad > 0)
    .map((x) => {
      const i = insumos.find((y) => y.id === x.insumoId)
      if (!i) throw new Error(`No existe el insumo ${x.insumoId}`)
      return { insumoId: i.id, cantidad: redondear(x.cantidad), costo: i.costo }
    })
  if (!l.length) throw new Error("La orden no tiene nada")
  const oc: OrdenCompra = { id: a.id("oc-"), codigo: siguienteCodigo(est), proveedorId, estado: "borrador", lineas: l, total: Math.round(l.reduce((s, x) => s + x.cantidad * x.costo, 0)), creada: Date.now(), quien: a.quien }
  est.compras = [...(est.compras ?? []), oc]
  a.log(`Orden de compra ${oc.codigo} a ${proveedor(proveedorId)}: RD$ ${oc.total.toLocaleString("es-DO")}`)
  return oc
}

export function ejecutarNegocio(est: Estado, libros: Libros, accion: AccionNegocio, a: Ayudas): unknown {
  const ahora = Date.now()
  const { gastos, movimientos } = libros
  switch (accion.tipo) {
    case "abrirCaja": {
      if (est.caja) throw new Error("La caja ya está abierta")
      if (!(accion.fondo >= 0)) throw new Error("¿Con cuánto abre la caja?")
      est.caja = { id: a.id("cj-"), abierta: ahora, cajero: accion.cajero || a.quien, fondo: Math.round(accion.fondo), movimientos: [] }
      a.log(`Caja abierta por ${est.caja.cajero} con RD$ ${est.caja.fondo.toLocaleString("es-DO")}`)
      return { ok: true, caja: est.caja }
    }
    case "movimientoCaja": {
      if (!est.caja) throw new Error("La caja está cerrada")
      if (!(accion.monto > 0)) throw new Error("El monto tiene que ser mayor que cero")
      if (!accion.texto.trim()) throw new Error("Anota el motivo")
      est.caja.movimientos.push({ ts: ahora, tipo: accion.movimiento, metodo: "efectivo", monto: Math.round(accion.monto), texto: accion.texto.trim() })
      a.log(`${accion.movimiento === "retiro" ? "Retiro" : "Ingreso"} de caja: RD$ ${Math.round(accion.monto).toLocaleString("es-DO")} (${accion.texto.trim()})`)
      return { ok: true }
    }
    case "cerrarCaja": {
      const c = est.caja
      if (!c) throw new Error("La caja ya está cerrada")
      const r = resumenCaja(c)
      c.cerrada = ahora
      c.esperado = Math.round(r.efectivoEsperado)
      c.contado = Math.round(accion.contado)
      c.diferencia = c.contado - c.esperado
      c.nota = accion.nota?.trim() || undefined
      est.cajasCerradas = [c, ...(est.cajasCerradas ?? [])]
      est.caja = undefined
      a.log(`Cierre de caja de ${c.cajero}: esperado RD$ ${c.esperado.toLocaleString("es-DO")}, contado RD$ ${c.contado.toLocaleString("es-DO")}${c.diferencia ? `, diferencia RD$ ${c.diferencia.toLocaleString("es-DO")}` : ", cuadrada"}`)
      return { ok: true, caja: c, resumen: r }
    }
    case "ajustarInsumo": {
      const i = est.insumos?.find((x) => x.id === accion.insumoId)
      if (!i) throw new Error("No existe el insumo")
      if (!(accion.existencia >= 0)) throw new Error("La existencia no puede ser negativa")
      const antes = i.existencia
      i.existencia = redondear(accion.existencia)
      movimientos.push({ ts: ahora, insumoId: i.id, cantidad: redondear(i.existencia - antes), tipo: "ajuste", texto: accion.motivo?.trim() || "Ajuste de inventario", quien: a.quien })
      a.log(`Inventario de ${i.nombre}: ${antes} → ${i.existencia} ${i.unidad}${accion.motivo ? ` (${accion.motivo})` : ""}`)
      return { ok: true, insumo: i }
    }
    case "compraSugerida": {
      const pendientes = new Set((est.compras ?? []).filter((c) => c.estado === "borrador" || c.estado === "enviada").flatMap((c) => c.lineas.map((l) => l.insumoId)))
      const bajos = (est.insumos ?? []).filter((i) => i.existencia < i.minimo && !pendientes.has(i.id) && (!accion.proveedorId || i.proveedorId === accion.proveedorId))
      if (!bajos.length) throw new Error("No hay nada por debajo del mínimo sin pedir")
      const creadas = [...new Set(bajos.map((i) => i.proveedorId))].map((p) =>
        nuevaCompra(est, p, bajos.filter((i) => i.proveedorId === p).map((i) => ({ insumoId: i.id, cantidad: Math.ceil(i.minimo * 2 - i.existencia) })), a),
      )
      return { ok: true, compras: creadas }
    }
    case "crearCompra":
      return { ok: true, compra: nuevaCompra(est, accion.proveedorId, accion.lineas, a) }
    case "enviarCompra": {
      const c = compra(est, accion.compraId)
      if (c.estado !== "borrador") throw new Error(`La orden ${c.codigo} ya fue ${c.estado}`)
      c.estado = "enviada"
      c.enviada = ahora
      a.log(`Orden ${c.codigo} enviada a ${proveedor(c.proveedorId)} por WhatsApp`)
      return { ok: true, compra: c }
    }
    case "recibirCompra": {
      const c = compra(est, accion.compraId)
      if (c.estado !== "enviada" && c.estado !== "borrador") throw new Error(`La orden ${c.codigo} está ${c.estado}`)
      for (const l of c.lineas) {
        const i = est.insumos?.find((x) => x.id === l.insumoId)
        if (i) i.existencia = redondear(i.existencia + l.cantidad)
        movimientos.push({ ts: ahora, insumoId: l.insumoId, cantidad: l.cantidad, tipo: "compra", texto: `Compra ${c.codigo}`, compraId: c.id, quien: a.quien })
      }
      c.estado = "recibida"
      c.recibida = ahora
      gastos.push({ id: a.id("g-"), ts: ahora, categoria: "insumos", descripcion: `Compra ${c.codigo} · ${proveedor(c.proveedorId)}`, monto: c.total, metodo: "credito", proveedorId: c.proveedorId, compraId: c.id, deCaja: false, quien: a.quien })
      a.log(`Mercancía recibida de ${proveedor(c.proveedorId)} (${c.codigo}): sube el inventario`)
      return { ok: true, compra: c }
    }
    case "pagarCompra": {
      const c = compra(est, accion.compraId)
      if (c.estado !== "recibida") throw new Error("Primero hay que recibir la mercancía")
      if (c.pagada) throw new Error(`La orden ${c.codigo} ya está pagada`)
      const deCaja = !!accion.deCaja && accion.metodo === "efectivo"
      if (deCaja && !est.caja) throw new Error("La caja está cerrada: no se puede pagar de caja")
      c.pagada = { ts: ahora, metodo: accion.metodo, deCaja }
      const g = gastos.find((x) => x.compraId === c.id)
      if (g) {
        g.metodo = accion.metodo
        g.deCaja = deCaja
      }
      if (deCaja) est.caja!.movimientos.push({ ts: ahora, tipo: "gasto", metodo: "efectivo", monto: c.total, texto: `Pago ${c.codigo} · ${proveedor(c.proveedorId)}`, compraId: c.id, gastoId: g?.id })
      a.log(`Orden ${c.codigo} pagada (${accion.metodo}${deCaja ? ", de caja" : ""})`)
      return { ok: true, compra: c }
    }
    case "cancelarCompra": {
      const c = compra(est, accion.compraId)
      if (c.estado === "recibida") throw new Error("Ya se recibió: no se puede cancelar")
      c.estado = "cancelada"
      a.log(`Orden ${c.codigo} cancelada`)
      return { ok: true }
    }
    case "gasto": {
      if (!(accion.monto > 0)) throw new Error("El monto tiene que ser mayor que cero")
      if (!accion.descripcion.trim()) throw new Error("Describe el gasto")
      const deCaja = !!accion.deCaja && accion.metodo === "efectivo"
      if (deCaja && !est.caja) throw new Error("La caja está cerrada: no se puede pagar de caja")
      const g: Gasto = { id: a.id("g-"), ts: ahora, categoria: accion.categoria, descripcion: accion.descripcion.trim(), monto: Math.round(accion.monto), metodo: accion.metodo, deCaja, comprobante: accion.comprobante, proveedorId: accion.proveedorId, quien: a.quien }
      gastos.push(g)
      if (deCaja) est.caja!.movimientos.push({ ts: ahora, tipo: "gasto", metodo: "efectivo", monto: g.monto, texto: g.descripcion, gastoId: g.id })
      a.log(`Gasto: ${g.descripcion}, RD$ ${g.monto.toLocaleString("es-DO")}${deCaja ? " (de caja)" : ""}`)
      return { ok: true, gasto: g }
    }
  }
}

// ---------- finanzas ----------

export function finanzas(visitas: Visita[], gastos: Gasto[], insumos: Insumo[], dias: number, ahora = Date.now()) {
  const desde = fechaLocal(ahora - (dias - 1) * DIA)
  const enRango = (ts: number) => fechaLocal(ts) >= desde
  const vs = visitas.filter((v) => enRango(v.pago))
  const gs = gastos.filter((g) => enRango(g.ts))
  const porDia = new Map<string, { fecha: string; ventas: number; gastos: number; costoVentas: number }>()
  for (let d = dias - 1; d >= 0; d--) {
    const f = fechaLocal(ahora - d * DIA)
    porDia.set(f, { fecha: f, ventas: 0, gastos: 0, costoVentas: 0 })
  }
  const vendidos = new Map<string, number>()
  for (const v of vs) {
    const d = porDia.get(fechaLocal(v.pago))
    if (d) d.ventas += v.subtotal
    for (const p of v.platos) {
      vendidos.set(p.platoId, (vendidos.get(p.platoId) ?? 0) + p.cantidad)
      if (d) d.costoVentas += costoPlato(p.platoId, insumos) * p.cantidad
    }
  }
  for (const g of gs) {
    const d = porDia.get(fechaLocal(g.ts))
    if (d) d.gastos += g.monto
  }
  const ventas = vs.reduce((s, v) => s + v.subtotal, 0)
  const totalGastos = gs.reduce((s, g) => s + g.monto, 0)
  const costoVentas = [...porDia.values()].reduce((s, d) => s + d.costoVentas, 0)
  const categorias = (["insumos", "nomina", "servicios", "mantenimiento", "otros"] as CategoriaGasto[]).map((c) => ({ categoria: c, monto: gs.filter((g) => g.categoria === c).reduce((s, g) => s + g.monto, 0) }))
  const platos = CARTA.map((p) => {
    const costo = costoPlato(p.id, insumos)
    const n = vendidos.get(p.id) ?? 0
    return { platoId: p.id, nombre: p.nombre, categoria: p.categoria, precio: p.precio, costo, margen: p.precio - costo, pct: p.precio ? Math.round((costo / p.precio) * 100) : 0, vendidos: Math.round(n * 10) / 10, aporte: Math.round((p.precio - costo) * n) }
  }).sort((a, b) => b.aporte - a.aporte)
  const porPagar = gastos.filter((g) => g.metodo === "credito")
  return {
    dias,
    ventas: Math.round(ventas),
    gastos: Math.round(totalGastos),
    utilidad: Math.round(ventas - totalGastos),
    costoVentas: Math.round(costoVentas),
    foodCost: ventas ? Math.round((costoVentas / ventas) * 1000) / 10 : 0,
    porDia: [...porDia.values()].map((d) => ({ ...d, ventas: Math.round(d.ventas), gastos: Math.round(d.gastos), costoVentas: Math.round(d.costoVentas) })),
    categorias,
    platos,
    porPagar: { total: porPagar.reduce((s, g) => s + g.monto, 0), cantidad: porPagar.length },
  }
}
