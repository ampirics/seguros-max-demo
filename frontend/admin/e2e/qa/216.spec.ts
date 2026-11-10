import { expect, test } from '@playwright/test'
import {
  abrirPanel, avisoEnEspera, capturar, contarEnEspera, esperarPase, ir, log, mandarCliente,
  reiniciarSiHaceFalta, revisarMedidas, sinErroresDeConsola,
} from './ayuda'

test('216: alerta persistente fuera de la Bandeja', async ({ browser }) => {
  await reiniciarSiHaceFalta()
  const { page, errores } = await abrirPanel(browser, 'escritorio')
  await ir(page, '/admin/piezas')
  const antes = await contarEnEspera(page)
  log('en espera antes del pase:', antes)
  await capturar(page, 'antes')

  await mandarCliente('quiero hablar con una persona')
  const pase = await esperarPase()
  const desde = Date.now()
  log('pase en MG:', pase.id, pase.motivo_pase)

  await expect.poll(() => contarEnEspera(page), { timeout: 5_000, intervals: [250] }).toBe(antes + 1)
  const segundos = (Date.now() - desde) / 1000
  log(`alerta en ${segundos.toFixed(1)} s`)
  expect(segundos).toBeLessThanOrEqual(5)
  await expect(avisoEnEspera(page)).toBeVisible()
  const menu = page.getByRole('navigation', { name: 'Secciones del panel' }).getByLabel(/esperando vendedor$/)
  await expect(menu.first()).toBeVisible()
  await page.waitForTimeout(1500)
  await capturar(page, 'alerta')
  await revisarMedidas(page, 'Inventario con la alerta')

  await page.waitForTimeout(30_000)
  expect(await contarEnEspera(page)).toBeGreaterThanOrEqual(antes + 1)
  await expect(avisoEnEspera(page)).toBeVisible()
  await expect(menu.first()).toBeVisible()
  await capturar(page, 'alerta-30s')
  log('la alerta sigue visible a los 30 s')

  await avisoEnEspera(page).click()
  await expect(page).toHaveURL(/\/admin\/chat/)
  const fila = page.getByLabel('Estado: Esperando vendedor').first()
  await expect(fila).toBeVisible({ timeout: 15_000 })
  await capturar(page, 'bandeja')
  await revisarMedidas(page, 'Bandeja en espera')
  sinErroresDeConsola(errores, 'escritorio')

  const movil = await abrirPanel(browser, 'telefono')
  await ir(movil.page, '/admin/piezas')
  await expect(movil.page.getByRole('button', { name: /Abrir menú \(\d+ conversaci(ón|ones) esperando vendedor\)/ })).toBeVisible()
  await expect(avisoEnEspera(movil.page)).toBeVisible()
  await capturar(movil.page, 'alerta')
  await revisarMedidas(movil.page, 'Inventario a 375 con la alerta')
  await avisoEnEspera(movil.page).click()
  await expect(movil.page.getByLabel('Estado: Esperando vendedor').first()).toBeVisible({ timeout: 15_000 })
  await capturar(movil.page, 'bandeja')
  await revisarMedidas(movil.page, 'Bandeja a 375')
  sinErroresDeConsola(movil.errores, 'telefono')
})
