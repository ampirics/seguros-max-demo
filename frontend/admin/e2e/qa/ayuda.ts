import { createHmac, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export const CASO = process.env.QA_CASO || 'manual'
export const TELEFONO = process.env.QA_TELEFONO || '+18095550199'
export const POR_EL_EJECUTOR = !!process.env.QA_EVIDENCIA
export const EVIDENCIA = process.env.QA_EVIDENCIA || path.resolve(__dirname, '../../test-results/qa', CASO)
const MG = (process.env.BANCO_MG || 'http://localhost:8010/api/v1').replace(/\/$/, '')
const WEBHOOK = process.env.BANCO_WEBHOOK || `${process.env.BANCO_ORA || 'http://localhost:8001'}/webhooks/whatsapp`
const CANAL = process.env.BANCO_CANAL_SIMULADO || 'colt-demo-pn'
const EMPRESA = /la casa del colt/i

export const ANCHOS = { escritorio: { width: 1366, height: 768 }, mediano: { width: 1280, height: 800 }, telefono: { width: 375, height: 812 } } as const
export type Ancho = keyof typeof ANCHOS

mkdirSync(EVIDENCIA, { recursive: true })

export const log = (...partes: unknown[]) => console.log(`[${CASO}] ${new Date().toISOString()}`, ...partes)

const digitos = (t: string) => {
  const d = t.replace(/\D/g, '')
  return d.length === 10 ? `1${d}` : d
}

let sesion: { token: string; empresa: string } | null = null

export async function entrarApi() {
  if (sesion) return sesion
  if (process.env.MG_PANEL_TOKEN) {
    sesion = { token: process.env.MG_PANEL_TOKEN, empresa: process.env.BANCO_EMPRESA || '' }
  } else {
    const usuario = process.env.MG_PANEL_USUARIO
    const clave = process.env.MG_PANEL_CLAVE
    if (!usuario || !clave) throw new Error('faltan MG_PANEL_USUARIO y MG_PANEL_CLAVE para entrar al panel')
    const r = await fetch(`${MG}/auth/login`, {
      method: 'POST',
      body: new URLSearchParams({ username: usuario, password: clave }),
    })
    if (!r.ok) throw new Error(`login en MG: HTTP ${r.status}`)
    sesion = { token: (await r.json()).access_token, empresa: process.env.BANCO_EMPRESA || '' }
  }
  if (!sesion.empresa) {
    const datos = JSON.parse(Buffer.from(sesion.token.split('.')[1], 'base64url').toString())
    const colt = (datos.user_companies || []).find((c: { name?: string }) => EMPRESA.test(c.name || ''))
    if (!colt) throw new Error('el usuario no tiene la empresa de La Casa del Colt')
    sesion.empresa = colt.id
  }
  const r = await fetch(`${MG}/auth/select-company`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: sesion.empresa }),
  })
  if (!r.ok) throw new Error(`select-company en MG: HTTP ${r.status}`)
  sesion.token = (await r.json()).access_token
  return sesion
}

export async function mg<T = any>(ruta: string, init: RequestInit = {}): Promise<T> {
  const { token, empresa } = await entrarApi()
  const r = await fetch(`${MG}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Company-ID': empresa,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`MG ${init.method || 'GET'} ${ruta}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`)
  return (r.status === 204 ? null : r.json()) as T
}

export async function mgEstado(ruta: string, init: RequestInit = {}): Promise<{ status: number; cuerpo: any }> {
  const { token, empresa } = await entrarApi()
  const r = await fetch(`${MG}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'X-Company-ID': empresa, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  })
  const texto = await r.text()
  let cuerpo: any = texto
  try { cuerpo = JSON.parse(texto) } catch { /* texto plano */ }
  return { status: r.status, cuerpo }
}

export async function reiniciarSiHaceFalta(telefono = TELEFONO) {
  if (POR_EL_EJECUTOR) return
  log('reinicio en nuevo de', telefono)
  await mg('/pruebas/reiniciar', { method: 'POST', body: JSON.stringify({ telefono, modo: 'nuevo' }) })
}

function secretoWebhook(): string {
  if (process.env.WEBHOOK_SECRET) return process.env.WEBHOOK_SECRET
  const env = path.resolve(__dirname, '../../../../backend/ora-core/.env')
  if (existsSync(env)) {
    const linea = readFileSync(env, 'utf-8').split('\n').find((l) => l.startsWith('WEBHOOK_SECRET='))
    if (linea) return linea.slice('WEBHOOK_SECRET='.length).trim()
  }
  throw new Error('falta WEBHOOK_SECRET (backend/ora-core/.env)')
}

export async function mandarCliente(texto: string, telefono = TELEFONO) {
  const wa = digitos(telefono)
  const cuerpo = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'mock_waba_colt', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: telefono, phone_number_id: CANAL },
      contacts: [{ profile: { name: 'wa-sim' }, wa_id: wa }],
      messages: [{ id: `wamid.panel.${randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), from: wa, type: 'text', text: { body: texto } }],
    } }] }],
  })
  const firma = 'sha256=' + createHmac('sha256', secretoWebhook()).update(cuerpo).digest('hex')
  const r = await fetch(WEBHOOK, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': firma } })
  if (!r.ok) throw new Error(`webhook de ORA: HTTP ${r.status}`)
  log('cliente:', texto)
}

export type Conversacion = {
  id: string
  customer_phone?: string
  cliente_telefono?: string
  estado_atencion?: string
  agent_requested?: boolean
  motivo_pase?: string | null
  brief_pase?: unknown
}

export async function conversacionDe(telefono = TELEFONO): Promise<Conversacion | null> {
  const d = digitos(telefono)
  const lista = await mg<Conversacion[]>('/chat/conversations/lite?limit=100')
  return lista.find((c) => digitos(c.customer_phone || c.cliente_telefono || '') === d) ?? null
}

export async function esperar<T>(que: string, fn: () => Promise<T | null | undefined | false>, segundos = 60): Promise<T> {
  const fin = Date.now() + segundos * 1000
  while (Date.now() < fin) {
    const v = await fn().catch(() => null)
    if (v) return v
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`no llegó a tiempo: ${que} (${segundos} s)`)
}

export const esperarPase = (telefono = TELEFONO, segundos = 60) =>
  esperar('el pase al vendedor', async () => {
    const c = await conversacionDe(telefono)
    return c && c.estado_atencion === 'esperando_vendedor' ? c : null
  }, segundos)

export async function mensajesDe(id: string): Promise<{ sender: string; message: string }[]> {
  return mg(`/chat/conversations/${id}/messages?limit=200`)
}

export async function mandarYEsperarRespuesta(texto: string, telefono = TELEFONO) {
  const antes = await conversacionDe(telefono)
  const previos = antes ? (await mensajesDe(antes.id)).filter((m) => m.sender !== 'user' && m.sender !== 'customer').length : 0
  await mandarCliente(texto, telefono)
  await esperar(`la respuesta a "${texto}"`, async () => {
    const c = await conversacionDe(telefono)
    if (!c) return null
    const salientes = (await mensajesDe(c.id)).filter((m) => m.sender !== 'user' && m.sender !== 'customer').length
    return salientes > previos ? c : null
  }, 60)
  await new Promise((r) => setTimeout(r, 3000))
}

export async function abrirPanel(browser: Browser, ancho: Ancho): Promise<{ contexto: BrowserContext; page: Page; errores: string[] }> {
  const { token, empresa } = await entrarApi()
  const contexto = await browser.newContext({ viewport: ANCHOS[ancho], locale: 'es-DO', timezoneId: 'America/Santo_Domingo' })
  await contexto.addInitScript(([t, e]) => {
    try {
      localStorage.setItem('auth_token', t)
      localStorage.setItem('active_company_id', e)
    } catch { /* sin almacenamiento */ }
  }, [token, empresa])
  const page = await contexto.newPage()
  const errores: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)) })
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message.slice(0, 300)}`))
  return { contexto, page, errores }
}

export async function ir(page: Page, ruta: string) {
  await page.goto(ruta)
  await expect(page.getByRole('button', { name: 'Menú de usuario' }).first()).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
}

export async function capturar(page: Page, momento: string) {
  const ancho = page.viewportSize()?.width ?? 0
  const archivo = path.join(EVIDENCIA, `panel-${momento}-${ancho}.png`)
  await page.screenshot({ path: archivo })
  log('captura', path.basename(archivo))
  return archivo
}

const INGLES = /\b(loading|submit|cancel|save|delete|search|settings|failed|success|select|close|next|previous|send|edit|dashboard|handoff|undefined|null|NaN|webhook|MCP|agent|agente|inbox|pending|resolved|unread|no data|not found)\b/i
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u

export async function revisarMedidas(page: Page, donde: string) {
  const anchos = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vista: window.innerWidth }))
  expect(anchos.scroll, `${donde}: scroll horizontal (${anchos.scroll} > ${anchos.vista} px)`).toBeLessThanOrEqual(anchos.vista + 1)
  const texto = await page.locator('body').innerText()
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  const ingles = lineas.filter((l) => INGLES.test(l))
  const emojis = lineas.filter((l) => EMOJI.test(l))
  const demo = lineas.filter((l) => /\bdemo\b/i.test(l))
  if (demo.length) log(`${donde}: etiquetas con "demo":`, demo.slice(0, 5))
  expect(ingles, `${donde}: textos en inglés o jerga técnica`).toEqual([])
  expect(emojis, `${donde}: emojis`).toEqual([])
}

export async function contarEnEspera(page: Page): Promise<number> {
  const aviso = page.getByRole('link', { name: /esperando vendedor\. Abrir la Bandeja/ })
  if (!(await aviso.count())) return 0
  const etiqueta = (await aviso.first().getAttribute('aria-label')) || ''
  return Number(etiqueta.match(/^(\d+)/)?.[1] ?? 0)
}

export const avisoEnEspera = (page: Page) => page.getByRole('link', { name: /esperando vendedor\. Abrir la Bandeja/ })

export async function abrirConversacion(page: Page, id: string) {
  await ir(page, `/admin/chat?conversation=${id}`)
  await expect(page.getByRole('button', { name: /^(Tomar|Transferir)$/ }).first()).toBeVisible({ timeout: 30_000 })
}

export async function accionesDelEncabezado(page: Page): Promise<string[]> {
  const nombres: string[] = []
  for (const n of ['Tomar', 'Devolver', 'Transferir', 'Finalizar', 'Cerrar conversación', 'Diagnóstico']) {
    if (await page.getByRole('button', { name: n, exact: true }).first().isVisible().catch(() => false)) nombres.push(n)
  }
  return nombres
}

export function sinErroresDeConsola(errores: string[], donde: string) {
  const reales = errores.filter((e) => !/Failed to load resource|favicon|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/i.test(e))
  if (reales.length) log(`${donde}: errores de consola`, reales.slice(0, 5))
  expect(reales, `${donde}: errores de consola`).toEqual([])
}
