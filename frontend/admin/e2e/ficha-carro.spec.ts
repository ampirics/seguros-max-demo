import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { ANCHOS, abrirPanel, capturar, ir, log, mg, type Ancho } from './qa/ayuda'

const CAPTURAS = path.resolve(__dirname, '../../../pruebas/capturas')
const INGLES = /\b(loading|submit|cancel|save|delete|search|settings|failed|success|select|close|next|previous|send|edit|undefined|null|NaN|not found|true|false)\b/i
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u

type Vehiculo = { id: string; cliente_id: string | null; marca: string; modelo: string; anio: number | null; estado?: string }

for (const ancho of ['escritorio', 'telefono'] as Ancho[]) {
  test(`ficha del carro desde el perfil a ${ANCHOS[ancho].width} px`, async ({ browser }) => {
    const { items } = await mg<{ items: Vehiculo[] }>('/vehiculos?limit=100')
    const vehiculo = items.find((v) => v.cliente_id && (v.estado ?? 'activo') === 'activo')
    test.skip(!vehiculo, 'no hay un cliente con vehículo')
    const v = vehiculo!
    const nombre = `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ''}`
    const esperado = await mg<{ total: number; sistemas: { nombre: string }[] }>(`/perfil/cliente/${v.cliente_id}/vehiculos/${v.id}/piezas`)

    const { page, errores } = await abrirPanel(browser, ancho)
    await ir(page, `/admin/customers/${v.cliente_id}`)
    await expect(page.getByTestId('documento-cliente')).toBeVisible()

    let clics = 0
    await page.getByRole('button', { name: `Ver la ficha de ${nombre}` }).first().click(); clics++
    const ficha = page.getByTestId('ficha-carro')
    await expect(ficha).toBeVisible()
    await expect(ficha.getByRole('heading', { name: nombre })).toBeVisible()
    await expect(ficha.getByText(/Verificado|Sin verificar/).first()).toBeVisible()

    const desplegar = ficha.getByRole('button', { name: /Piezas y pedidos de la/ })
    if ((await desplegar.getAttribute('aria-expanded')) !== 'true') { await desplegar.click(); clics++ }
    const piezas = ficha.getByRole('tab', { name: /Piezas que le sirven/ })
    await expect(piezas).toHaveAttribute('aria-selected', 'true')
    await expect(ficha.getByRole('tab', { name: `Piezas que le sirven (${esperado.total})` })).toBeVisible()
    if (esperado.total) await expect(ficha.getByText(/RD\$/).first()).toBeVisible()
    await capturar(page, 'ficha-carro-piezas')

    await ficha.getByRole('tab', { name: /Lo que pidió/ }).click(); clics++
    await expect(ficha.getByRole('tab', { name: /Lo que pidió \(\d+\)/ })).toBeVisible()
    await expect(ficha.getByRole('list', { name: 'Lo que pidió para este vehículo' }).or(ficha.getByText(/Todavía no ha pedido/))).toBeVisible()
    await page.waitForTimeout(500)
    mkdirSync(CAPTURAS, { recursive: true })
    await page.screenshot({ path: path.join(CAPTURAS, `ficha-carro-${ANCHOS[ancho].width}.png`) })
    await capturar(page, 'ficha-carro-lo-que-pidio')

    const anchos = await page.evaluate(() => {
      const f = document.querySelector('[data-testid="ficha-carro"]') as HTMLElement
      return { pagina: document.documentElement.scrollWidth, vista: window.innerWidth, ficha: f.scrollWidth, fichaVisible: f.clientWidth }
    })
    log('anchos', anchos, 'clics', clics)
    expect(anchos.pagina).toBeLessThanOrEqual(anchos.vista + 1)
    expect(anchos.ficha).toBeLessThanOrEqual(anchos.fichaVisible + 1)
    expect(clics).toBeLessThanOrEqual(3)

    const lineas = (await ficha.innerText()).split('\n').map((l) => l.trim()).filter(Boolean)
    expect(lineas.filter((l) => INGLES.test(l) || EMOJI.test(l) || /\bdemo\b/i.test(l))).toEqual([])
    expect(errores.filter((x) => !/Failed to load resource|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(x))).toEqual([])
  })
}
