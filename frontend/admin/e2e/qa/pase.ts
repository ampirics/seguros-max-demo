import { expect, type Browser, type Page } from '@playwright/test'
import {
  POR_EL_EJECUTOR, abrirConversacion, abrirPanel, accionesDelEncabezado, avisoEnEspera, capturar, contarEnEspera, conversacionDe, esperar,
  ir, log, mandarYEsperarRespuesta, mensajesDe, reiniciarSiHaceFalta, revisarMedidas, sinErroresDeConsola, type Conversacion,
} from './ayuda'

type Opciones = {
  preparar?: string[]
  prepararSiempre?: boolean
  pase?: boolean
  brief?: (string | RegExp)[]
  cotizacion?: { total?: string }
  vehiculo?: (string | RegExp)[]
  sinPiezaElegida?: boolean
  cotizacionDelChat?: boolean
}

const brief = (page: Page) => page.getByRole('region', { name: 'Resumen del pase' }).filter({ visible: true }).first()

async function briefCompletoEnVista(page: Page, donde: string, datos: (string | RegExp)[]) {
  const tarjeta = brief(page)
  await expect(tarjeta, `${donde}: la tarjeta del brief no se ve`).toBeVisible()
  await expect(tarjeta.getByRole('button').first(), `${donde}: el brief está plegado`).toHaveAttribute('aria-expanded', 'true')
  for (const dato of datos) await expect(tarjeta, `${donde}: el brief no muestra ${dato}`).toContainText(dato)
  const medida = await tarjeta.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const fallas: string[] = []
    if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight + 0.5 || r.right > window.innerWidth + 0.5) {
      fallas.push(`fuera de la pantalla (${Math.round(r.top)} a ${Math.round(r.bottom)} de ${window.innerHeight} px)`)
    }
    if ((document.scrollingElement?.scrollTop ?? 0) > 0) fallas.push('la página está desplazada')
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const estilo = getComputedStyle(p)
      if (!/(auto|scroll|hidden|clip)/.test(estilo.overflowY + estilo.overflowX)) continue
      const c = p.getBoundingClientRect()
      if (p.scrollTop > 0) fallas.push(`un contenedor está desplazado ${p.scrollTop} px`)
      if (r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5) {
        fallas.push(`cortado por su contenedor (${Math.round(r.top)} a ${Math.round(r.bottom)}, visible ${Math.round(c.top)} a ${Math.round(c.bottom)})`)
      }
    }
    const cortados = Array.from(el.querySelectorAll<HTMLElement>('*'))
      .filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow === 'ellipsis')
      .map((n) => n.innerText.slice(0, 60))
    if (cortados.length) fallas.push(`texto truncado: ${cortados.join(' | ')}`)
    return { fallas, alto: Math.round(r.height), arriba: Math.round(r.top) }
  })
  log(`${donde}: brief de ${medida.alto} px desde y=${medida.arriba}`)
  expect(medida.fallas, `${donde}: el brief completo no se ve sin scroll`).toEqual([])
}

const instante = (iso?: string | null) => (iso ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`) : NaN)

async function alertaYPersistencia(page: Page, conv: Conversacion & { esperando_desde?: string | null; agent_requested_at?: string | null }, abierto: number, llegada: Promise<number> | null) {
  const antesDelPase = !!llegada
  const visible = llegada ? await llegada : (await expect(avisoEnEspera(page)).toBeVisible({ timeout: 5_000 }), Date.now())
  await capturar(page, 'alerta')
  const pase = instante(conv.esperando_desde ?? conv.agent_requested_at)
  if (antesDelPase) {
    const segundos = (visible - pase) / 1000
    log(`alerta en ${segundos.toFixed(1)} s desde el pase (panel abierto antes del pase)`)
    expect(segundos, 'la alerta tardó más de 5 s').toBeLessThanOrEqual(5)
  } else {
    const segundos = (visible - abierto) / 1000
    log(`alerta en ${segundos.toFixed(1)} s desde que abrió el panel (el pase fue ${((abierto - pase) / 1000).toFixed(1)} s antes)`)
    expect(segundos, 'la alerta tardó más de 5 s').toBeLessThanOrEqual(5)
  }
  await page.waitForTimeout(Math.max(0, visible + 30_000 - Date.now()))
  await expect(avisoEnEspera(page), 'la alerta no sigue a los 30 s').toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Secciones del panel' }).getByLabel(/esperando vendedor$/).first()).toBeVisible()
  await capturar(page, 'alerta-30s')
  log('la alerta sigue visible a los 30 s')
}

async function revisarEncabezado(page: Page, donde: string) {
  const acciones = await accionesDelEncabezado(page)
  log(`${donde}: acciones en el encabezado`, acciones)
  expect(acciones.length, `${donde}: más de 3 acciones en el encabezado`).toBeLessThanOrEqual(3)
  return acciones
}

async function seccionCotizaciones(page: Page) {
  if (!(await page.getByRole('heading', { name: 'Cotizaciones' }).isVisible().catch(() => false))) {
    const boton = page.getByRole('button', { name: 'Caso', exact: true })
    if (await boton.isVisible().catch(() => false) && (await boton.getAttribute('aria-pressed')) !== 'true') await boton.click()
  }
  const seccion = page.locator('section', { has: page.getByRole('heading', { name: 'Cotizaciones', exact: true }) })
  const tarjeta = seccion.locator('li', { has: page.getByRole('link', { name: /COT-/ }) }).first()
  await expect(tarjeta).toBeVisible({ timeout: 20_000 })
  await tarjeta.scrollIntoViewIfNeeded()
  return tarjeta
}

async function revisarCaso(page: Page, op: Opciones) {
  const vehiculo = page.locator('section', { has: page.getByRole('heading', { name: 'Vehículo', exact: true }) }).first()
  const pieza = page.locator('section', { has: page.getByRole('heading', { name: 'Pieza seleccionada', exact: true }) }).first()
  await expect(vehiculo).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1500)
  log('vehículo en el Caso después de devolver:', (await vehiculo.innerText()).replace(/\s+/g, ' ').slice(0, 300))
  for (const dato of op.vehiculo ?? []) await expect(vehiculo, `la sección Vehículo no muestra ${dato}`).toContainText(dato)
  if (op.sinPiezaElegida) {
    await expect(pieza, 'el Caso muestra una pieza que el cliente no eligió').toContainText('Toca una pieza en la conversación')
  }
}

export async function recorrerPase(browser: Browser, op: Opciones = {}) {
  const conPase = op.pase !== false
  const prepara = !!op.preparar && (!!op.prepararSiempre || !POR_EL_EJECUTOR)
  const escritorio = await abrirPanel(browser, 'escritorio')
  let abierto = 0
  let llegada: Promise<number> | null = null
  if (prepara) {
    await reiniciarSiHaceFalta()
    if (conPase) {
      await ir(escritorio.page, '/admin/piezas')
      abierto = Date.now()
      const antes = await contarEnEspera(escritorio.page)
      llegada = expect.poll(() => contarEnEspera(escritorio.page), { timeout: 200_000, intervals: [200] }).toBeGreaterThan(antes).then(() => Date.now())
      llegada.catch(() => {})
    }
    for (const texto of op.preparar!) await mandarYEsperarRespuesta(texto)
  }
  const conv = await esperar<Conversacion>('la conversación del teléfono', async () => {
    const c = await conversacionDe()
    if (!c) return null
    return !conPase || c.estado_atencion === 'esperando_vendedor' ? c : null
  }, 30)
  log('conversación', conv.id, conv.estado_atencion, conv.motivo_pase)
  if (op.cotizacionDelChat) {
    const codigos = (await mensajesDe(conv.id)).flatMap((m) => m.message?.match(/COT-\d+/g) ?? [])
    expect(codigos.length, 'el bot no mandó ninguna cotización en el chat').toBeGreaterThan(0)
    const codigo = codigos[codigos.length - 1]
    log('cotización del chat', codigo)
    op = { ...op, brief: [...(op.brief ?? []), `Cotización: ${codigo}`] }
  }
  const movil = await abrirPanel(browser, 'telefono')

  if (conPase) {
    if (!prepara) {
      await ir(escritorio.page, '/admin/piezas')
      abierto = Date.now()
    }
    await alertaYPersistencia(escritorio.page, conv, abierto, llegada)
  }

  await abrirConversacion(escritorio.page, conv.id)
  await escritorio.page.waitForTimeout(1500)
  await capturar(escritorio.page, 'antes')
  await revisarEncabezado(escritorio.page, 'escritorio antes de tomar')
  await revisarMedidas(escritorio.page, 'conversación a 1366')
  if (conPase) {
    await expect(escritorio.page.getByText('Esperando vendedor').first()).toBeVisible()
    await briefCompletoEnVista(escritorio.page, '1366 antes de tomar', op.brief ?? [])
  }

  if (op.cotizacion) {
    const tarjeta = await seccionCotizaciones(escritorio.page)
    await expect(tarjeta).toContainText('Total')
    if (op.cotizacion.total) await expect(tarjeta).toContainText(op.cotizacion.total)
    await expect(tarjeta).toContainText(/Precios más ITBIS|Los precios ya incluyen ITBIS/)
    await capturar(escritorio.page, 'cotizacion')
    log('cotización en el panel:', (await tarjeta.innerText()).replace(/\s+/g, ' ').slice(0, 300))
  }

  await abrirConversacion(movil.page, conv.id)
  await movil.page.waitForTimeout(1500)
  await capturar(movil.page, 'antes')
  await revisarMedidas(movil.page, 'conversación a 375')
  const antesDeTomar = await revisarEncabezado(movil.page, '375 antes de tomar')
  if (conPase) expect(antesDeTomar, 'antes de tomar solo se ofrece Tomar').toEqual(['Tomar'])

  if (op.cotizacion) {
    await seccionCotizaciones(movil.page)
    await capturar(movil.page, 'cotizacion')
    await revisarMedidas(movil.page, 'cotización a 375')
    await movil.page.getByRole('button', { name: 'Cerrar panel' }).click().catch(() => {})
  }

  if (conPase) {
    let clics = 0
    await movil.page.getByRole('button', { name: 'Tomar', exact: true }).first().click()
    clics++
    await expect(movil.page.getByText('Tomaste la conversación', { exact: false }).first()).toBeVisible({ timeout: 10_000 })
    await expect(movil.page.getByRole('button', { name: 'Tomar', exact: true })).toHaveCount(0)
    await movil.page.waitForTimeout(1000)
    await briefCompletoEnVista(movil.page, '375 al tomar', op.brief ?? [])
    await capturar(movil.page, 'brief')
    await revisarMedidas(movil.page, 'brief a 375')
    await revisarEncabezado(movil.page, '375 después de tomar')

    await abrirConversacion(escritorio.page, conv.id)
    await escritorio.page.waitForTimeout(1000)
    await briefCompletoEnVista(escritorio.page, '1366 al tomar', op.brief ?? [])
    await capturar(escritorio.page, 'brief')

    const caja = movil.page.getByRole('textbox', { name: 'Mensaje para el cliente' })
    await caja.click()
    clics++
    await caja.fill('Buenas, le atiendo yo. Ya vi su caso.')
    await caja.press('Enter')
    await expect(movil.page.getByText('Buenas, le atiendo yo. Ya vi su caso.').first()).toBeVisible({ timeout: 15_000 })
    await movil.page.getByRole('button', { name: 'Devolver', exact: true }).first().click()
    clics++
    await expect(movil.page.getByText('IA atendiendo').first()).toBeVisible({ timeout: 15_000 })
    log(`tomar, responder y devolver en ${clics} clics`)
    expect(clics).toBeLessThanOrEqual(3)
    await capturar(movil.page, 'devuelto')
    await revisarMedidas(movil.page, '375 después de devolver')

    await abrirConversacion(escritorio.page, conv.id)
    await expect(escritorio.page.getByText('IA atendiendo').first()).toBeVisible()
    await revisarCaso(escritorio.page, op)
    await capturar(escritorio.page, 'devuelto')
    const despues = await conversacionDe()
    expect(despues?.estado_atencion).toBe('ia')
  }

  sinErroresDeConsola(escritorio.errores, 'escritorio')
  sinErroresDeConsola(movil.errores, 'telefono')
  await escritorio.contexto.close()
  await movil.contexto.close()
  return conv
}

