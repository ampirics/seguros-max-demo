import { expect, test, type Page } from '@playwright/test'
import { abrirPanel, capturar, ir, log, mandarYEsperarRespuesta, mg, revisarMedidas, sinErroresDeConsola } from './ayuda'

const PIEZA = /bomba de gasolina/i
const PREVIOS = [
  { caso: '143', telefono: '+18095550143', mensajes: ['bandas pa tucson 2022'], pieza: /banda/i, vehiculo: /Tucson/i },
  { caso: '171', telefono: '+18095550171', mensajes: ['bandas delanteras lancer 2010 2.0'], pieza: /banda/i, vehiculo: /Lancer/i },
  { caso: '175', telefono: '+18095550175', mensajes: ['bomba de gasolina montero 2004 3.8', 'sí, búscamela'], pieza: PIEZA, vehiculo: /Montero/i },
]

async function noHay(page: Page) {
  await page.getByRole('tab', { name: 'Lo que piden' }).click()
  await expect(page.getByRole('heading', { name: 'Lo que piden y no hay' })).toBeVisible()
  return page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Pieza pedida' }) })
}

test('266: piden y no hay, resueltas sin vendedor y costo por conversación', async ({ browser }) => {
  for (const previo of PREVIOS) {
    await mg('/pruebas/reiniciar', { method: 'POST', body: JSON.stringify({ telefono: previo.telefono, modo: 'nuevo' }) })
    log(`caso ${previo.caso} en ${previo.telefono}`)
    for (const texto of previo.mensajes) await mandarYEsperarRespuesta(texto, previo.telefono)
  }

  const { page, errores } = await abrirPanel(browser, 'escritorio')
  await ir(page, '/admin/estadisticas')
  await page.getByRole('radio', { name: 'Últimos 7 días' }).click()
  await expect(page.getByText('Resueltas sin vendedor')).toBeVisible({ timeout: 20_000 })
  const resueltas = page.locator('div', { has: page.getByText('Resueltas sin vendedor', { exact: true }) }).last()
  await expect(resueltas).toContainText(/\d+ de \d+/)
  await expect(page.getByText('Costo por conversación')).toBeVisible()
  await expect(page.locator('div', { has: page.getByText('Costo por conversación', { exact: true }) }).last()).toContainText(/US\$\d/)
  await capturar(page, 'estadisticas')

  const seccion = await noHay(page)
  const fila = seccion.getByRole('row').filter({ hasText: PIEZA }).first()
  await expect(fila).toBeVisible({ timeout: 20_000 })
  await expect(fila).toContainText(/Montero/i)
  await expect(fila.getByRole('cell').nth(0)).toHaveText(/^\d+$/)
  await expect(fila.getByRole('cell').nth(1)).toHaveText(/\d/)
  await fila.scrollIntoViewIfNeeded()
  await expect(fila.getByRole('cell').nth(1)).toBeInViewport()
  const veces7 = Number((await fila.getByRole('cell').nth(0).innerText()).replace(/\D/g, ''))
  log('piden y no hay a 7 días:', (await fila.innerText()).replace(/\s+/g, ' '))
  const filas = seccion.getByRole('row')
  const texto = (await filas.allInnerTexts()).join(' | ').replace(/\s+/g, ' ')
  log('lo que piden y no hay:', texto.slice(0, 600))
  for (const previo of PREVIOS) {
    const suya = filas.filter({ hasText: previo.pieza }).filter({ hasText: previo.vehiculo }).first()
    await expect(suya, `falta la pieza del caso ${previo.caso}`).toBeVisible()
    await expect(suya.getByRole('cell').nth(0), `caso ${previo.caso}: sin veces`).toHaveText(/^\d+$/)
    await expect(suya.getByRole('cell').nth(1), `caso ${previo.caso}: sin fecha`).toHaveText(/\d/)
  }
  await fila.scrollIntoViewIfNeeded()
  await capturar(page, 'no-hay')
  await revisarMedidas(page, 'Estadísticas a 1366')

  await page.getByRole('radio', { name: 'Últimos 90 días' }).click()
  await expect(page.getByRole('radio', { name: 'Últimos 90 días' })).toHaveAttribute('aria-checked', 'true')
  const fila90 = (await noHay(page)).getByRole('row').filter({ hasText: PIEZA }).first()
  await expect(fila90).toBeVisible({ timeout: 20_000 })
  const veces90 = Number((await fila90.getByRole('cell').nth(0).innerText()).replace(/\D/g, ''))
  log(`veces a 7 días ${veces7}, a 90 días ${veces90}`)
  expect(veces90).toBeGreaterThanOrEqual(veces7)
  sinErroresDeConsola(errores, 'escritorio')

  const movil = await abrirPanel(browser, 'telefono')
  await ir(movil.page, '/admin/estadisticas')
  await expect(movil.page.getByText('Resueltas sin vendedor')).toBeVisible({ timeout: 20_000 })
  await capturar(movil.page, 'estadisticas')
  await revisarMedidas(movil.page, 'Estadísticas a 375')
  const filaMovil = (await noHay(movil.page)).getByRole('row').filter({ hasText: PIEZA }).first()
  await expect(filaMovil).toBeVisible({ timeout: 20_000 })
  await filaMovil.scrollIntoViewIfNeeded()
  for (const previo of PREVIOS) {
    const suya = (await noHay(movil.page)).getByRole('row').filter({ hasText: previo.pieza }).filter({ hasText: previo.vehiculo }).first()
    await expect(suya, `a 375 falta la pieza del caso ${previo.caso}`).toBeVisible()
    await expect(suya, `a 375 la pieza del caso ${previo.caso} no muestra la fecha`).toContainText(/Última: .*\d/)
  }
  await capturar(movil.page, 'no-hay')
  await revisarMedidas(movil.page, 'Lo que piden a 375')
  sinErroresDeConsola(movil.errores, 'telefono')
})
