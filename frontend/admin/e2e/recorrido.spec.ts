import { expect, test } from '@playwright/test'
import { ANCHOS, abrirPanel, capturar, conversacionDe, ir, log, mg, type Ancho } from './qa/ayuda'

const INGLES = /\b(loading|submit|cancel|save|delete|search|settings|failed|success|select|close|next|previous|send|edit|dashboard|handoff|undefined|null|NaN|webhook|MCP|agent|agente|inbox|pending|resolved|unread|no data|not found|true|false|error:|invalid)\b/i
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u

for (const ancho of ['mediano', 'telefono'] as Ancho[]) {
  test(`recorrido del panel a ${ANCHOS[ancho].width} px`, async ({ browser }) => {
    const conv = await conversacionDe()
    const cotizaciones = await mg<{ items?: { codigo: string }[] } | { codigo: string }[]>('/cotizaciones?limit=1').catch(() => null)
    const cot = Array.isArray(cotizaciones) ? cotizaciones[0] : cotizaciones?.items?.[0]
    const rutas = [
      '/admin/chat',
      ...(conv ? [`/admin/chat?conversation=${conv.id}`] : []),
      '/admin/cotizaciones',
      ...(cot ? [`/admin/cotizaciones/${cot.codigo}`] : []),
      '/admin/ia',
      '/admin/piezas',
      '/admin/existencias',
      '/admin/estadisticas',
      '/admin/busqueda-externa',
    ]
    const { page, errores } = await abrirPanel(browser, ancho)
    const problemas: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 500) problemas.push(`HTTP ${r.status()} ${r.url()}`)
      else if (r.status() >= 400 && r.status() !== 401) log(`HTTP ${r.status()} ${r.url()}`)
    })
    for (const ruta of rutas) {
      errores.length = 0
      await ir(page, ruta)
      await page.waitForTimeout(2000)
      const nombre = ruta.replace(/^\/admin\/?/, '').replace(/\?conversation=.*/, '-conversacion').replace(/\//g, '-') || 'inicio'
      await capturar(page, `recorrido-${nombre}`)
      const { scroll, vista } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vista: window.innerWidth }))
      if (scroll > vista + 1) problemas.push(`${ruta}: scroll horizontal ${scroll} > ${vista}`)
      const previa = await page.locator('aside[aria-label="Vista previa"]').innerText({ timeout: 1000 }).catch(() => '')
      if (EMOJI.test(previa)) log(`${ruta}: la vista previa de la IA usa emojis (Configuración IA, "Usar emojis" activado)`)
      const texto = (await page.locator('body').innerText()).replace(previa, '')
      const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
      for (const l of lineas) {
        if (INGLES.test(l)) problemas.push(`${ruta}: inglés "${l.slice(0, 80)}"`)
        if (EMOJI.test(l)) problemas.push(`${ruta}: emoji "${l.slice(0, 80)}"`)
        if (/\bdemo\b/i.test(l)) log(`${ruta}: "demo" en "${l.slice(0, 80)}"`)
      }
      for (const e of errores.filter((x) => !/Failed to load resource|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(x))) problemas.push(`${ruta}: consola ${e.slice(0, 160)}`)
    }
    log('problemas:', problemas)
    expect(problemas).toEqual([])
  })
}
