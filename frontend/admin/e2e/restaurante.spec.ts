import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

// Vertical restaurante (Boca Marina) en modo demo. Correr con el panel en modo mock:
//   QA_PANEL_URL=http://localhost:3200 npx playwright test e2e/restaurante.spec.ts
// Las pruebas de IA llaman al modelo de verdad: se activan con QA_IA=1.

const SRV = "/srv/restaurante"

async function accion(request: APIRequestContext, cuerpo: unknown) {
  const r = await request.post(`${SRV}/accion`, { data: cuerpo })
  const j = await r.json()
  expect(r.ok(), JSON.stringify(j)).toBeTruthy()
  return j
}

async function estado(request: APIRequestContext) {
  return (await (await request.get(`${SRV}/estado`)).json()) as any
}

async function entrarComo(page: Page, perfil: string) {
  await page.goto("/admin/login")
  await page.getByRole("button", { name: perfil, exact: true }).click()
  await page.waitForURL((u) => !u.pathname.endsWith("/login"))
}

const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date())
const manana = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date(Date.now() + 86400000))

test.describe("Restaurante: servidor", () => {
  test.beforeEach(async ({ request }) => {
    await accion(request, { tipo: "reiniciar" })
    await accion(request, { tipo: "config", config: { piloto: false, cocinaAuto: false } })
  })
  test.afterAll(async ({ request }) => {
    await accion(request, { tipo: "config", config: { piloto: true, cocinaAuto: true } })
  })

  test("arranca con el salón, las conversaciones y 60 días de historia", async ({ request }) => {
    const e = await estado(request)
    expect(e.mesas).toHaveLength(24)
    expect(e.conversaciones.length).toBeGreaterThanOrEqual(14)
    expect(e.clientes.length).toBeGreaterThanOrEqual(25)
    const m = await (await request.get(`${SRV}/metricas?dias=30`)).json()
    expect(m.resumen.visitas).toBeGreaterThan(500)
    expect(m.resumen.duracion).toBeGreaterThan(60)
    expect(m.platos[0].cantidad).toBeGreaterThan(m.platos.at(-1).cantidad)
  })

  test("una mesa de punta a punta deja una visita con sus tiempos", async ({ request }) => {
    const libre = (await estado(request)).mesas.find((m: any) => m.estado === "libre" && m.zona === "terraza")
    await accion(request, { tipo: "sentar", mesaId: libre.id, comensales: 2, manual: true })
    const orden = await accion(request, { tipo: "ordenar", mesaId: libre.id, items: [{ platoId: "ceviche", cantidad: 1 }, { platoId: "churrasco", cantidad: 1, mods: ["Término: Medio"] }] })
    let e = await estado(request)
    let mesa = e.mesas.find((m: any) => m.id === libre.id)
    expect(mesa.estado).toBe("en_cocina")
    for (const est of ["caliente", "fria"]) await accion(request, { tipo: "ticket", pedidoId: orden.pedidoId, estacion: est })
    await accion(request, { tipo: "servir", mesaId: libre.id })
    e = await estado(request)
    expect(e.mesas.find((m: any) => m.id === libre.id).estado).toBe("servida")
    await accion(request, { tipo: "llamar", mesaId: libre.id, llamado: "cuenta", origen: "qr" })
    const cobro = await accion(request, { tipo: "cobrar", mesaId: libre.id, metodo: "tarjeta", propinaPct: 10 })
    expect(cobro.visita.subtotal).toBe(550 + 1395)
    expect(cobro.visita.itbis).toBe(Math.round(1945 * 0.18))
    expect(cobro.visita.servicio).toBe(Math.round(1945 * 0.1))
    expect(cobro.visita.orden).toBeGreaterThanOrEqual(cobro.visita.llegada)
    e = await estado(request)
    expect(e.mesas.find((m: any) => m.id === libre.id).estado).toBe("limpieza")
    expect(e.visitasHoy.some((v: any) => v.id === cobro.visita.id)).toBeTruthy()
  })

  test("las reservas validan el grupo, bloquean la mesa y liberan al cancelar", async ({ request }) => {
    const grande = await request.post(`${SRV}/accion`, { data: { tipo: "reserva", reserva: { nombre: "Prueba", telefono: "809-555-9001", fecha: manana(), hora: "20:00", personas: 18, canal: "whatsapp" } } })
    expect(grande.status()).toBe(400)
    const r = await accion(request, { tipo: "reserva", reserva: { nombre: "Prueba Reserva", telefono: "809-555-9002", fecha: manana(), hora: "20:00", personas: 4, zona: "muelle", canal: "web" } })
    expect(r.reserva.estado).toBe("confirmada")
    expect(r.mesa.id).toMatch(/^M/)
    const doble = await accion(request, { tipo: "reserva", reserva: { nombre: "Otra", telefono: "809-555-9003", fecha: manana(), hora: "20:30", personas: 4, zona: "muelle", canal: "web" } })
    expect(doble.mesa?.id).not.toBe(r.mesa.id)
    await accion(request, { tipo: "reservaEstado", reservaId: r.reserva.id, estado: "cancelada" })
    const e = await estado(request)
    expect(e.reservas.find((x: any) => x.id === r.reserva.id).estado).toBe("cancelada")
    const cliente = await (await request.get(`${SRV}/clientes/${r.reserva.clienteId}`)).json()
    expect(cliente.cliente.recorrido.some((p: any) => p.tipo === "reserva")).toBeTruthy()
  })

  test("el recordatorio queda en la reserva y en la conversación del cliente", async ({ request }) => {
    const e = await estado(request)
    const r = e.reservas.find((x: any) => x.estado === "confirmada" && x.conversacionId && x.fecha === hoy())
    test.skip(!r, "No hay reservas confirmadas de hoy con conversación")
    await accion(request, { tipo: "recordatorio", reservaId: r.id })
    const despues = (await estado(request)).reservas.find((x: any) => x.id === r.id)
    expect(despues.estado).toBe("recordada")
    const mensajes = await (await request.get(`${SRV}/conversaciones/${r.conversacionId}/mensajes`)).json()
    expect(mensajes.at(-1).texto).toContain("Te recordamos")
  })
})

test.describe("Restaurante: avisos, plano y archivos", () => {
  test.beforeEach(async ({ request }) => {
    await accion(request, { tipo: "reiniciar" })
    await accion(request, { tipo: "config", config: { piloto: false, cocinaAuto: false } })
  })
  test.afterAll(async ({ request }) => {
    await accion(request, { tipo: "config", config: { piloto: true, cocinaAuto: true } })
  })

  test("una reserva nueva manda WhatsApp con el PDF y deja el correo listo", async ({ request }) => {
    const r = await accion(request, { tipo: "reserva", reserva: { nombre: "Prueba Avisos", telefono: "809-555-9010", fecha: manana(), hora: "19:00", personas: 2, zona: "gazebo", canal: "web", correo: "prueba@example.com" } })
    let reserva: any
    await expect
      .poll(async () => {
        reserva = await (await request.get(`${SRV}/reservas/${r.reserva.id}`)).json()
        return reserva.avisos.map((a: any) => a.canal).sort().join(",")
      }, { timeout: 30_000 })
      .toContain("correo")
    expect(reserva.avisos.some((a: any) => a.canal === "whatsapp" && a.estado === "enviado")).toBeTruthy()
    const mensajes = await (await request.get(`${SRV}/conversaciones/${reserva.conversacionId}/mensajes`)).json()
    const pdfs = mensajes.filter((m: any) => m.adjunto?.tipo === "pdf")
    expect(pdfs.map((m: any) => m.adjunto.nombre)).toEqual(expect.arrayContaining([`Reserva ${reserva.codigo}.pdf`, "Bienvenido a Boca Marina.pdf"]))
    const pdf = await request.get(pdfs[0].adjunto.url)
    expect(pdf.headers()["content-type"]).toBe("application/pdf")
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF")
  })

  test("las mesas se mueven, se agregan y se quitan del plano", async ({ request }) => {
    await accion(request, { tipo: "moverMesa", mesaId: "T2", x: 26, y: 17, rot: 45 })
    let e = await estado(request)
    expect(e.mesas.find((m: any) => m.id === "T2")).toMatchObject({ x: 26, y: 17, rot: 45 })
    const nueva = await accion(request, { tipo: "agregarMesa", zona: "muelle", capacidad: 4, x: 44, y: 29 })
    e = await estado(request)
    expect(e.mesas.some((m: any) => m.id === nueva.mesa.id)).toBeTruthy()
    await accion(request, { tipo: "quitarMesa", mesaId: nueva.mesa.id })
    const ocupada = (await estado(request)).mesas.find((m: any) => m.estado === "en_cocina")
    const r = await request.post(`${SRV}/accion`, { data: { tipo: "quitarMesa", mesaId: ocupada.id } })
    expect(r.status()).toBe(400)
  })

  test("la anfitriona recibe: llegó, con cuántos, en qué mesa y con qué mesero", async ({ request }) => {
    const r = await accion(request, { tipo: "reserva", reserva: { nombre: "Prueba Llegada", telefono: "809-555-9012", fecha: manana(), hora: "20:00", personas: 2, canal: "telefono" } })
    await accion(request, { tipo: "reservaLlego", reservaId: r.reserva.id })
    let e = await estado(request)
    expect(e.reservas.find((x: any) => x.id === r.reserva.id).llegoEn).toBeTruthy()
    const libre = e.mesas.find((m: any) => m.estado === "libre" && m.capacidad >= 4 && m.id !== r.reserva.mesaId)
    const mesero = e.equipo.find((q: any) => q.rol === "mesero")
    const res = await accion(request, { tipo: "recibir", reservaId: r.reserva.id, personas: 4, mesaId: libre.id, meseroId: mesero.id })
    expect(res.mesero.nombre).toBe(mesero.nombre)
    e = await estado(request)
    expect(e.mesas.find((m: any) => m.id === libre.id)).toMatchObject({ estado: "ocupada", comensales: 4, meseroId: mesero.id, reservaId: r.reserva.id })
    expect(e.reservas.find((x: any) => x.id === r.reserva.id)).toMatchObject({ estado: "sentada", personas: 4, mesaId: libre.id })
    const sinReserva = e.mesas.find((m: any) => m.estado === "libre" && m.capacidad >= 2)
    await accion(request, { tipo: "recibir", nombre: "Sin reserva", personas: 2, mesaId: sinReserva.id })
    expect((await estado(request)).mesas.find((m: any) => m.id === sinReserva.id).estado).toBe("ocupada")
    const ocupada = await request.post(`${SRV}/accion`, { data: { tipo: "recibir", personas: 2, mesaId: libre.id } })
    expect(ocupada.status()).toBe(400)
  })

  test("el cliente avisa que llegó con el QR de la entrada, con y sin reserva", async ({ request }) => {
    const r = await accion(request, { tipo: "reserva", reserva: { nombre: "Prueba Entrada", telefono: "809-555-9013", fecha: hoy(), hora: "22:00", personas: 2, canal: "web" } })
    const ok = await accion(request, { tipo: "llegue", telefono: "8095559013" })
    expect(ok.nombre).toBe("Prueba Entrada")
    let e = await estado(request)
    expect(e.reservas.find((x: any) => x.id === r.reserva.id).llegoEn).toBeTruthy()
    const mal = await request.post(`${SRV}/accion`, { data: { tipo: "llegue", codigo: "BM-1" } })
    expect(mal.status()).toBe(400)
    const sin = await accion(request, { tipo: "entradaSinReserva", nombre: "Sin Reserva QR", personas: 3 })
    e = await estado(request)
    expect(e.entrada.some((x: any) => x.id === sin.entrada.id)).toBeTruthy()
    const libre = e.mesas.find((m: any) => m.estado === "libre" && m.capacidad >= 3)
    await accion(request, { tipo: "recibir", entradaId: sin.entrada.id, nombre: "Sin Reserva QR", personas: 3, mesaId: libre.id })
    e = await estado(request)
    expect(e.entrada.some((x: any) => x.id === sin.entrada.id)).toBeFalsy()
    expect(e.mesas.find((m: any) => m.id === libre.id).estado).toBe("ocupada")
  })

  test("el inventario descuenta lo que se ordena y agota los platos sin insumos", async ({ request }) => {
    let e = await estado(request)
    const antes = e.insumos.find((i: any) => i.id === "camaron").existencia
    const libre = e.mesas.find((m: any) => m.estado === "libre")
    await accion(request, { tipo: "sentar", mesaId: libre.id, comensales: 2, manual: true })
    await accion(request, { tipo: "ordenar", mesaId: libre.id, items: [{ platoId: "camarones-ajo-vino", cantidad: 2 }] })
    e = await estado(request)
    expect(e.insumos.find((i: any) => i.id === "camaron").existencia).toBeCloseTo(antes - 0.6, 2)
    await accion(request, { tipo: "ajustarInsumo", insumoId: "zanahoria", existencia: 0, motivo: "Conteo físico" })
    const agotado = await request.post(`${SRV}/accion`, { data: { tipo: "ordenar", mesaId: libre.id, items: [{ platoId: "vegetales-grill", cantidad: 1 }] } })
    expect(agotado.status()).toBe(400)
    expect((await agotado.json()).error).toContain("agotado")
  })

  test("compras: pedir lo que falta, recibir, pagar de caja y queda en gastos", async ({ request }) => {
    const sug = await accion(request, { tipo: "compraSugerida" })
    expect(sug.compras.length).toBeGreaterThan(0)
    const oc = sug.compras.find((c: any) => c.lineas.some((l: any) => l.insumoId === "zanahoria")) ?? sug.compras[0]
    const linea = oc.lineas[0]
    const antes = (await estado(request)).insumos.find((i: any) => i.id === linea.insumoId).existencia
    await accion(request, { tipo: "enviarCompra", compraId: oc.id })
    await accion(request, { tipo: "recibirCompra", compraId: oc.id })
    let e = await estado(request)
    expect(e.insumos.find((i: any) => i.id === linea.insumoId).existencia).toBeCloseTo(antes + linea.cantidad, 2)
    const movAntes = e.caja.movimientos.length
    await accion(request, { tipo: "pagarCompra", compraId: oc.id, metodo: "efectivo", deCaja: true })
    e = await estado(request)
    expect(e.caja.movimientos.length).toBe(movAntes + 1)
    const gastos = await (await request.get(`${SRV}/gastos?dias=1`)).json()
    expect(gastos.some((g: any) => g.compraId === oc.id && g.metodo === "efectivo")).toBeTruthy()
  })

  test("caja: ventas del día, retiro, gasto de caja y cierre con diferencia", async ({ request }) => {
    let e = await estado(request)
    const libre = e.mesas.find((m: any) => m.estado === "libre")
    await accion(request, { tipo: "sentar", mesaId: libre.id, comensales: 2, manual: true })
    await accion(request, { tipo: "ordenar", mesaId: libre.id, items: [{ platoId: "churrasco", cantidad: 1 }] })
    const ventasAntes = (await estado(request)).caja.movimientos.filter((m: any) => m.tipo === "venta").length
    await accion(request, { tipo: "cobrar", mesaId: libre.id, metodo: "efectivo", propinaPct: 10 })
    e = await estado(request)
    expect(e.caja.movimientos.filter((m: any) => m.tipo === "venta").length).toBe(ventasAntes + 1)
    await accion(request, { tipo: "movimientoCaja", movimiento: "retiro", monto: 2000, texto: "Depósito al banco" })
    await accion(request, { tipo: "gasto", categoria: "otros", descripcion: "Hielo", monto: 500, metodo: "efectivo", deCaja: true })
    const cierre = await accion(request, { tipo: "cerrarCaja", contado: 1000, nota: "Prueba" })
    expect(cierre.caja.diferencia).toBe(1000 - cierre.caja.esperado)
    e = await estado(request)
    expect(e.caja).toBeFalsy()
    expect(e.cajasCerradas[0].id).toBe(cierre.caja.id)
    const otra = await request.post(`${SRV}/accion`, { data: { tipo: "movimientoCaja", movimiento: "retiro", monto: 10, texto: "x" } })
    expect(otra.status()).toBe(400)
    await accion(request, { tipo: "abrirCaja", fondo: 5000, cajero: "Mariel Santana" })
    expect((await estado(request)).caja.fondo).toBe(5000)
  })

  test("lo que el cliente pide quitar no se descuenta y queda en el historial del insumo", async ({ request }) => {
    let e = await estado(request)
    const cebolla = e.insumos.find((i: any) => i.id === "cebolla").existencia
    const pulpo = e.insumos.find((i: any) => i.id === "pulpo").existencia
    const libre = e.mesas.find((m: any) => m.estado === "libre")
    await accion(request, { tipo: "sentar", mesaId: libre.id, comensales: 2, manual: true })
    await accion(request, { tipo: "ordenar", mesaId: libre.id, items: [{ platoId: "pulpo-vinagreta", cantidad: 1, mods: ["Sin cebolla"] }] })
    e = await estado(request)
    expect(e.insumos.find((i: any) => i.id === "cebolla").existencia).toBe(cebolla)
    expect(e.insumos.find((i: any) => i.id === "pulpo").existencia).toBeLessThan(pulpo)
    const d = await (await request.get(`${SRV}/insumos/pulpo`)).json()
    expect(d.movimientos[0]).toMatchObject({ tipo: "consumo", mesaId: libre.id })
    expect(d.platos.length).toBeGreaterThan(0)
  })

  test("cada cobro en caja lleva su visita y cada gasto de insumos su compra", async ({ request }) => {
    const e = await estado(request)
    const libre = e.mesas.find((m: any) => m.estado === "libre")
    await accion(request, { tipo: "sentar", mesaId: libre.id, comensales: 2, manual: true })
    await accion(request, { tipo: "ordenar", mesaId: libre.id, items: [{ platoId: "churrasco", cantidad: 1 }] })
    await accion(request, { tipo: "cobrar", mesaId: libre.id, metodo: "tarjeta", propinaPct: 10 })
    const venta = (await estado(request)).caja.movimientos.filter((m: any) => m.tipo === "venta").pop()
    expect(venta.visitaId).toBeTruthy()
    const v = await (await request.get(`${SRV}/visitas/${venta.visitaId}`)).json()
    expect(v).toMatchObject({ mesaId: libre.id, metodo: "tarjeta" })
    const gastos = await (await request.get(`${SRV}/gastos?dias=7`)).json()
    const g = gastos.find((x: any) => x.compraId)
    const d = await (await request.get(`${SRV}/gastos/${g.id}`)).json()
    expect(d.compra.lineas.length).toBeGreaterThan(0)
    expect(d.compra.total).toBe(g.monto)
    const historial = await (await request.get(`${SRV}/compras?proveedor=${d.compra.proveedorId}`)).json()
    expect(historial.some((c: any) => c.id === d.compra.id)).toBeTruthy()
  })

  test("el QR de la mesa abre una sesión: cuenta en vivo, se paga y la reseña queda en la visita", async ({ page, request }) => {
    const e = await estado(request)
    const libre = e.mesas.find((m: any) => m.estado === "libre" && m.capacidad >= 2)
    await accion(request, { tipo: "sentar", mesaId: libre.id, comensales: 2, manual: true })
    await accion(request, { tipo: "ordenar", mesaId: libre.id, items: [{ platoId: "langosta-plancha", cantidad: 1.5 }] })
    await page.goto(`/mesa/${libre.id}`)
    await expect(page.getByText("Total hasta ahora")).toBeVisible({ timeout: 15_000 })
    await page.getByText(/Te reconocemos/).click()
    await page.getByPlaceholder("Tu nombre").fill("Prueba Sesión")
    await page.getByPlaceholder("809-000-0000").fill("809-555-9020")
    await page.getByRole("button", { name: "Guardar" }).click()
    await expect(page.getByText("Hola, Prueba. Estamos para servirte.")).toBeVisible({ timeout: 10_000 })
    await accion(request, { tipo: "cobrar", mesaId: libre.id, metodo: "tarjeta", propinaPct: 10 })
    await expect(page.getByText(/Gracias por venir/)).toBeVisible({ timeout: 15_000 })
    await page.getByRole("radio", { name: "5 de 5" }).click()
    await page.getByPlaceholder(/Cuéntanos/).fill("La langosta estuvo perfecta")
    await page.getByRole("button", { name: "Enviar reseña" }).click()
    await expect(page.getByText("Recibimos tu reseña.", { exact: false })).toBeVisible({ timeout: 10_000 })
    const visitas = await (await request.get(`${SRV}/visitas?mesa=${libre.id}&dias=1`)).json()
    const v = visitas.find((x: any) => x.sesionId)
    expect(v).toMatchObject({ calificacion: 5, comentario: "La langosta estuvo perfecta" })
    const otra = await request.post(`${SRV}/accion`, { data: { tipo: "calificar", visitaId: v.id, estrellas: 1 } })
    expect(otra.status()).toBe(400)
    const cliente = (await estado(request)).clientes.find((c: any) => c.telefono.replace(/\D/g, "").endsWith("8095559020"))
    expect(cliente.recorrido.some((r: any) => r.tipo === "resena")).toBeTruthy()
  })

  test("finanzas: ventas, gastos, utilidad y costo por plato", async ({ request }) => {
    const f = await (await request.get(`${SRV}/finanzas?dias=30`)).json()
    expect(f.ventas).toBeGreaterThan(0)
    expect(f.gastos).toBeGreaterThan(0)
    expect(f.utilidad).toBe(f.ventas - f.gastos)
    expect(f.platos.every((p: any) => p.costo > 0)).toBeTruthy()
    expect(f.foodCost).toBeGreaterThan(20)
    expect(f.foodCost).toBeLessThan(45)
  })

  test("el QR de la reserva deja confirmar que viene", async ({ page, request }) => {
    const r = await accion(request, { tipo: "reserva", reserva: { nombre: "Prueba QR", telefono: "809-555-9011", fecha: manana(), hora: "20:00", personas: 3, canal: "web" } })
    await page.goto(`/reserva/${r.reserva.codigo}`)
    await page.getByRole("button", { name: "Confirmo que voy" }).click()
    await expect.poll(async () => (await (await request.get(`${SRV}/reservas/${r.reserva.id}`)).json()).estado).toBe("asistencia_confirmada")
  })
})

test.describe("Restaurante: pantallas y perfiles", () => {
  test("el dueño ve la vertical de restaurante y no la de repuestos", async ({ page }) => {
    await entrarComo(page, "Dueño")
    await expect(page.getByText("Así va Boca Marina hoy")).toBeVisible()
    const menu = page.getByRole("navigation", { name: "Secciones del panel" })
    for (const s of ["Bandeja", "Salón en vivo", "Reservas", "Órdenes", "Cocina", "Carta", "Clientes", "Métricas", "Caja", "Inventario", "Compras", "Gastos", "Finanzas"]) await expect(menu.getByRole("link", { name: s })).toBeVisible()
    await expect(menu.getByRole("link", { name: "Inventario" })).toHaveAttribute("href", /\/admin\/inventario/)
    for (const s of ["Ventas", "Búsqueda externa"]) await expect(menu.getByRole("link", { name: s })).toHaveCount(0)
  })

  test("la mesera entra directo a sus órdenes y no ve métricas", async ({ page }) => {
    await entrarComo(page, "Mesera")
    await page.waitForURL(/\/admin\/ordenes/)
    const menu = page.getByRole("navigation", { name: "Secciones del panel" })
    await expect(menu.getByRole("link", { name: "Métricas" })).toHaveCount(0)
    await expect(menu.getByRole("link", { name: "Bandeja" })).toHaveCount(0)
  })

  test("cocina solo ve su pantalla, la carta y el inventario", async ({ page }) => {
    await entrarComo(page, "Cocina")
    await page.waitForURL(/\/admin\/cocina/)
    const menu = page.getByRole("navigation", { name: "Secciones del panel" })
    await expect(menu.getByRole("link")).toHaveCount(3)
  })

  test("la cajera ve la caja y compras ve inventario y compras", async ({ page }) => {
    await entrarComo(page, "Cajera")
    await page.waitForURL(/\/admin\/caja/)
    let menu = page.getByRole("navigation", { name: "Secciones del panel" })
    await expect(menu.getByRole("link", { name: "Caja" })).toBeVisible()
    await expect(menu.getByRole("link", { name: "Finanzas" })).toHaveCount(0)
    await expect(page.getByText(/efectivo esperado/i).first()).toBeVisible()
    await entrarComo(page, "Compras")
    await page.waitForURL(/\/admin\/inventario/)
    menu = page.getByRole("navigation", { name: "Secciones del panel" })
    await expect(menu.getByRole("link", { name: "Compras" })).toBeVisible()
    await expect(menu.getByRole("link", { name: "Caja" })).toHaveCount(0)
  })

  test("el supervisor ve solo las secciones que le abrieron", async ({ page }) => {
    await entrarComo(page, "Supervisor")
    const menu = page.getByRole("navigation", { name: "Secciones del panel" })
    for (const s of ["Caja", "Inventario", "Compras", "Llegadas"]) await expect(menu.getByRole("link", { name: s })).toBeVisible()
    for (const s of ["Finanzas", "Métricas", "Bandeja"]) await expect(menu.getByRole("link", { name: s })).toHaveCount(0)
  })

  test("caja, inventario, compras, gastos y finanzas cargan", async ({ page }) => {
    await entrarComo(page, "Dueño")
    for (const [ruta, texto] of [
      ["/admin/caja", /efectivo esperado/i],
      ["/admin/inventario", /de ejemplo/i],
      ["/admin/compras", /de ejemplo/i],
      ["/admin/gastos", /de ejemplo/i],
      ["/admin/finanzas", /Food cost/],
    ] as const) {
      await page.goto(ruta)
      await expect(page.getByText(texto).first()).toBeVisible({ timeout: 15_000 })
    }
    await page.goto("/admin/carta")
    await expect(page.getByText("Agotado").first()).toBeVisible()
  })

  test("salón, mesa, reservas, cliente y métricas cargan enlazados", async ({ page }) => {
    await entrarComo(page, "Dueño")
    await page.goto("/admin/salon")
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 })
    await page.goto("/admin/salon/mesas/G4")
    await expect(page.getByRole("heading", { name: "Mesa Gazebo", level: 2 })).toBeVisible()
    await page.goto("/admin/reservaciones")
    await expect(page.getByText("Confirmaciones y recordatorios")).toBeVisible()
    await page.goto("/admin/clientes/c-laura")
    await expect(page.getByText("Recorrido de punta a punta")).toBeVisible()
    await page.goto("/admin/metricas")
    await expect(page.getByText("Cuánto dura una mesa")).toBeVisible()
  })

  test("el salón en vivo 3D abre en su enlace y la mesa en una ventana", async ({ page }) => {
    await entrarComo(page, "Dueño")
    await page.goto("/admin/salon/vivo")
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("button", { name: "Organizar mesas" })).toBeVisible()
  })

  test("órdenes filtra por estado y ordena por tiempo", async ({ page }) => {
    await entrarComo(page, "Dueño")
    await page.goto("/admin/ordenes")
    await page.getByRole("combobox", { name: "Filtrar por estado" }).click()
    await page.getByRole("option", { name: "Libres" }).click()
    await expect(page.getByText(/de \d+ mesas/)).toBeVisible()
  })

  test("la bandeja abre la conversación con su reserva y lo que validó la IA", async ({ page }) => {
    await entrarComo(page, "Dueño")
    await page.goto("/admin/chat?conversacion=conv-1")
    await expect(page.getByText("Lo que la IA revisó en su última respuesta")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("link", { name: "Ver la reserva" }).first()).toBeVisible()
  })

  test("el QR de la mesa llama al mesero sin iniciar sesión", async ({ page, request }) => {
    await accion(request, { tipo: "reiniciar" })
    const ocupada = (await estado(request)).mesas.find((m: any) => ["en_cocina", "servida"].includes(m.estado))
    await page.goto(`/mesa/${ocupada.id}`)
    await page.getByRole("button", { name: "Llamar al mesero" }).click()
    await expect.poll(async () => (await estado(request)).mesas.find((m: any) => m.id === ocupada.id).llamado?.tipo).toBe("mesero")
  })
})

test.describe("Restaurante: asistente de IA", () => {
  test.skip(process.env.QA_IA !== "1", "Llama al modelo: activar con QA_IA=1")

  async function conversar(request: APIRequestContext, telefono: string, texto: string) {
    const r = await (await request.post(`${SRV}/simulador`, { data: { telefono, nombre: "Prueba IA", texto } })).json()
    const conv = r.conversacion.id
    let ultimo: any
    await expect
      .poll(async () => {
        const ms = await (await request.get(`${SRV}/conversaciones/${conv}/mensajes`)).json()
        ultimo = ms.at(-1)
        return ultimo.de
      }, { timeout: 90_000 })
      .not.toBe("cliente")
    return { conv, ultimo }
  }

  test("reserva de punta a punta por WhatsApp", async ({ request }) => {
    const tel = `809-555-${Math.floor(1000 + Math.random() * 8000)}`
    const { conv } = await conversar(request, tel, `Hola, quiero reservar para 2 el ${manana()} a las 8 de la noche en el muelle`)
    const ms = await (await request.get(`${SRV}/conversaciones/${conv}/mensajes`)).json()
    if (!ms.some((m: any) => m.pasos?.some((p: any) => p.herramienta === "crear_reserva" && p.ok))) await conversar(request, tel, "Sí, confírmala por favor. No celebramos nada.")
    const todos = await (await request.get(`${SRV}/conversaciones/${conv}/mensajes`)).json()
    expect(todos.some((m: any) => m.pasos?.some((p: any) => p.herramienta === "crear_reserva" && p.ok))).toBeTruthy()
    expect(todos.filter((m: any) => m.de === "ia").map((m: any) => m.texto).join(" ")).toMatch(/BM-\d+/)
    const reserva = (await estado(request)).reservas.find((r: any) => r.telefono === tel)
    expect(reserva.estado).toBe("confirmada")
    expect(reserva.zona).toBe("muelle")
  })

  test("un grupo de 20 pasa al equipo de eventos", async ({ request }) => {
    const { conv } = await conversar(request, `809-555-${Math.floor(1000 + Math.random() * 8000)}`, "Somos 20 para un cumpleaños el sábado, ¿pueden?")
    const c = (await estado(request)).conversaciones.find((x: any) => x.id === conv)
    expect(c.estado).toBe("esperando_equipo")
  })

  test("da el precio exacto de la carta y aclara los impuestos", async ({ request }) => {
    const { ultimo } = await conversar(request, `809-555-${Math.floor(1000 + Math.random() * 8000)}`, "¿Cuánto cuesta la paella marinera para 2?")
    expect(ultimo.texto).toMatch(/2[,.]?075/)
    expect(ultimo.texto).toMatch(/ITBIS|impuesto/i)
  })

  test("lee una foto y responde con el precio de la carta", async ({ request }) => {
    const fs = await import("node:fs")
    const path = await import("node:path")
    const foto = fs.readFileSync(path.resolve(__dirname, "../public/boca-marina/pdf/paella-langosta-sm.jpg")).toString("base64")
    const r = await (await request.post(`${SRV}/simulador`, { data: { telefono: `809-555-${Math.floor(1000 + Math.random() * 8000)}`, nombre: "Prueba foto", texto: "¿Qué plato es este y cuánto cuesta?", adjunto: { tipo: "imagen", nombre: "plato.jpg", mime: "image/jpeg", datos: foto } } })).json()
    let ultimo: any
    await expect.poll(async () => {
      const ms = await (await request.get(`${SRV}/conversaciones/${r.conversacion.id}/mensajes`)).json()
      ultimo = ms.at(-1)
      return ultimo.de
    }, { timeout: 90_000 }).toBe("ia")
    expect(ultimo.texto).toMatch(/paella/i)
    expect(ultimo.texto).toMatch(/2[,.]?075/)
  })

  test("no inventa lo que no está aprobado", async ({ request }) => {
    const { ultimo } = await conversar(request, `809-555-${Math.floor(1000 + Math.random() * 8000)}`, "¿Cuánto cuesta el montaje romántico con pétalos?")
    expect(ultimo.texto).not.toMatch(/RD\$\s?\d/)
  })
})
