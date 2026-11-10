import { expect, test } from '@playwright/test'
import { abrirPanel, capturar, ir, log } from './qa/ayuda'

const TELEFONO = '+18095550101'

test('consola de casos: corre el 340 (variante 1) paso a paso y las reglas cumplen', async ({ browser }) => {
  test.setTimeout(240_000)
  const { contexto, page } = await abrirPanel(browser, 'escritorio')
  await ir(page, '/admin/pruebas/casos?caso=340')
  await expect(page.getByTestId('estado-canal')).toContainText('Simulador', { timeout: 20_000 })

  await expect(page.getByRole('heading', { name: /\(con buenas\)/ })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByLabel('Teléfono')).toContainText(TELEFONO)

  await page.getByRole('button', { name: 'Iniciar caso' }).click()
  await expect(page.getByText(/Caso en curso desde/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Sin mensajes en este teléfono.')).toBeVisible({ timeout: 15_000 })

  const siguiente = page.getByTestId('siguiente-paso')
  await expect(siguiente).toContainText('buenas, quiero unas bandas pa un lancer 2005')
  await siguiente.getByRole('button', { name: 'Enviar siguiente paso' }).click()
  const paso1 = page.locator('[data-paso="1"]')
  await expect(paso1).toHaveAttribute('data-estado', /pasa|falla/, { timeout: 90_000 })
  log('paso 1:', await paso1.innerText())
  await expect(paso1).toHaveAttribute('data-estado', 'pasa')
  await expect(paso1.locator('[data-resultado="pasa"]')).toHaveCount(6)

  await expect(siguiente).toContainText('las de alante, el 1.3')
  await siguiente.getByRole('button', { name: 'Enviar siguiente paso' }).click()
  const paso2 = page.locator('[data-paso="2"]')
  await expect(paso2).toHaveAttribute('data-estado', /pasa|falla/, { timeout: 90_000 })
  log('paso 2:', await paso2.innerText())
  await expect(paso2).toHaveAttribute('data-estado', 'pasa')
  await expect(paso2.locator('[data-resultado="falla"]')).toHaveCount(0)
  await expect(paso2.locator('[data-regla="con_precios"]')).toHaveAttribute('data-resultado', 'pasa')
  await expect(page.getByTestId('resumen-caso')).toContainText('2 de 2 pasos cumplen')
  await capturar(page, 'consola-casos')

  await page.reload()
  await expect(page.getByRole('heading', { name: /\(con buenas\)/ })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('resumen-caso')).toContainText('2 de 2 pasos cumplen', { timeout: 30_000 })
  await expect(page.locator('[data-paso="1"]')).toHaveAttribute('data-estado', 'pasa')
  await expect(page.locator('[data-paso="2"]')).toHaveAttribute('data-estado', 'pasa')
  await contexto.close()
})

test('consola de casos: sin scroll horizontal a 375 px', async ({ browser }) => {
  const { contexto, page } = await abrirPanel(browser, 'telefono')
  await ir(page, '/admin/pruebas/casos?caso=340')
  await expect(page.getByRole('button', { name: 'Iniciar caso' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-paso="2"]')).toBeVisible()
  const anchos = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vista: window.innerWidth }))
  expect(anchos.scroll, `scroll horizontal (${anchos.scroll} > ${anchos.vista} px)`).toBeLessThanOrEqual(anchos.vista + 1)
  await capturar(page, 'consola-casos')
  await contexto.close()
})

test('consola de casos: «Número nuevo» cambia el teléfono y apunta el simulador a ese número', async ({ browser }) => {
  const { contexto, page } = await abrirPanel(browser, 'escritorio')
  await ir(page, '/admin/pruebas/casos?caso=340')
  const selector = page.getByLabel('Teléfono')
  await expect(selector).toContainText(TELEFONO, { timeout: 30_000 })

  await page.getByRole('button', { name: 'Número nuevo' }).click()
  await expect(page.getByText(/Usa el \+1 809 555 01\d\d/)).toBeVisible({ timeout: 15_000 })
  await expect(selector).not.toContainText(TELEFONO)
  const nuevo = (await selector.innerText()).replace(/\D/g, '')
  log('número nuevo:', nuevo)
  expect(nuevo).toMatch(/^180955501\d\d$/)
  expect(['18095550100', '18095550101', '18095550181', '18095550189']).not.toContain(nuevo)
  await expect(page.getByRole('link', { name: 'Abrir en el simulador' }))
    .toHaveAttribute('href', `http://localhost:3002/?canal=colt-demo-pn&tel=${nuevo}`)
  await contexto.close()
})
