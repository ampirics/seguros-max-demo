import { expect, test, type Page } from '@playwright/test'
import { abrirPanel, capturar, ir, log, mg, mgEstado, revisarMedidas, sinErroresDeConsola } from './ayuda'

const VEHICULO = /Ford Focus/i
const BANDAS = 'Bandas de Freno Delanteras'
const TECNICO = /AUTOPARTS|API_KEY|\bAPI\b|servidor|\bprueba\b|sin valor real/i

type Externa = { id: string; estado: string; referencia: string | null; pieza_id: string | null; resumen: { nombre: string | null; numero: string | null; oem: string[]; imagen: string | null } }

const externas = async () => (await mg<{ items: Externa[] }>('/piezas-externas?estado=todas')).items
const delLote = (lista: Externa[], ref: string) => lista.filter((p) => p.referencia === ref)

async function sinTextoTecnico(page: Page, donde: string) {
  const textos = await page.locator('main, [role="dialog"], [role="alertdialog"], [role="status"], [role="listbox"]').allInnerTexts()
  const lineas = textos.join('\n').split('\n').map((l) => l.trim()).filter(Boolean)
  expect(lineas.filter((l) => TECNICO.test(l)), `${donde}: texto técnico o de prueba a la vista`).toEqual([])
}

async function traer(page: Page, fuente: RegExp, captura?: string) {
  await page.getByRole('button', { name: 'Traer piezas' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Traer piezas' })
  await expect(dialogo).toBeVisible()
  await dialogo.getByLabel('Fuente').click()
  await page.getByRole('option', { name: fuente }).click()
  await dialogo.getByLabel('Vehículo').click()
  await page.getByRole('option', { name: VEHICULO }).first().click()
  await dialogo.getByLabel('Año').fill('2015')
  await sinTextoTecnico(page, `diálogo de ${fuente}`)
  if (captura) await capturar(page, captura)
  const respuesta = page.waitForResponse((r) => r.url().includes('/piezas-externas/traer') && r.request().method() === 'POST')
  await dialogo.getByRole('button', { name: 'Buscar' }).click()
  const r = await (await respuesta).json()
  expect(r.nuevas + r.ya_estaban, `${fuente}: la fuente no trajo piezas`).toBeGreaterThan(0)
  await expect(page.getByText(`${r.nuevas} ${r.nuevas === 1 ? 'nueva' : 'nuevas'}, ${r.ya_estaban} ya estaban`).first()).toBeVisible({ timeout: 20_000 })
  await expect(dialogo).toBeHidden()
  await page.waitForTimeout(500)
  log(`traer de ${fuente}: lote ${r.referencia}, ${r.nuevas} nuevas, ${r.ya_estaban} ya estaban`)
  return r.referencia as string
}

async function elegirLote(page: Page, referencia: string) {
  await page.getByRole('combobox', { name: 'Lote' }).click()
  await page.getByRole('option', { name: referencia, exact: true }).click()
  await expect(page.getByRole('region', { name: 'Lote elegido' })).toContainText(`Lote ${referencia}`)
}

test('260: traer piezas de Ford Focus 2015, borrar el lote, dar de alta el vehículo e incorporar solo las bandas', async ({ browser }) => {
  for (const p of (await externas()).filter((x) => x.pieza_id && /^focus-2015-/.test(x.referencia ?? ''))) {
    const r = await mgEstado(`/admin/products/${p.pieza_id}`, { method: 'DELETE' })
    log(`pieza ${p.resumen.nombre} incorporada en una corrida anterior: borrarla da ${r.status}`)
  }
  const maestro = await mg<{ items: { id: string; marca: string; modelo: string; estado: string }[] }>('/vehiculos-catalogo?marca=Ford&modelo=Focus&limit=20')
  for (const v of maestro.items) {
    const r = await mgEstado(`/vehiculos-catalogo/${v.id}`, { method: 'DELETE' })
    log(`Ford Focus que ya estaba en el maestro (${v.estado}): borrar da ${r.status}`)
    expect(r.status, 'el Ford Focus de una corrida anterior tiene piezas ligadas: hay que reiniciar el caso 260 en MG').toBeLessThan(300)
  }
  for (const ref of new Set((await externas()).filter((p) => p.estado === 'propuesto' && /^focus-2015-/.test(p.referencia ?? '')).map((p) => p.referencia!))) {
    await mgEstado(`/piezas-externas/lotes/${encodeURIComponent(ref)}`, { method: 'DELETE' })
  }

  const { page, errores } = await abrirPanel(browser, 'escritorio')
  await ir(page, '/admin/piezas-externas')
  await capturar(page, 'antes')
  await revisarMedidas(page, 'Piezas externas a 1366')
  await sinTextoTecnico(page, 'Piezas externas a 1366')

  const loteA = await traer(page, /Importadora Costanorte/, 'traer')
  const loteB = await traer(page, /Distribuidora Autoriente/)
  expect(loteA).not.toBe(loteB)
  let lista = await externas()
  for (const ref of [loteA, loteB]) {
    const piezas = delLote(lista, ref)
    log(`lote ${ref}:`, piezas.map((p) => `${p.resumen.nombre} ${p.resumen.numero} (${p.estado})`).join('; '))
    expect(piezas.length, `el lote ${ref} no quedó en la base temporal`).toBeGreaterThan(0)
    for (const p of piezas) {
      expect(p.resumen.numero, `${p.resumen.nombre} sin referencia del proveedor`).toBeTruthy()
      expect(p.resumen.oem.filter((n) => /^FO-/.test(n)), `${p.resumen.nombre} con números que imitan a Ford`).toEqual([])
      expect(p.resumen.imagen, `${p.resumen.nombre} sin foto`).toBeTruthy()
    }
  }
  const conBandas = [loteA, loteB].find((ref) => delLote(lista, ref).some((p) => p.resumen.nombre === BANDAS && p.estado === 'propuesto'))
  expect(conBandas, `no quedan ${BANDAS} por revisar en ningún lote: hay que reiniciar el caso 260 en MG`).toBeTruthy()
  const elegido = conBandas!
  const otro = elegido === loteA ? loteB : loteA
  const proveedor = elegido === loteA ? 'Importadora Costanorte' : 'Distribuidora Autoriente'
  const bandas = delLote(lista, elegido).find((p) => p.resumen.nombre === BANDAS && p.estado === 'propuesto')!

  await elegirLote(page, elegido)
  const filaBandas = page.getByRole('listitem').filter({ hasText: BANDAS }).first()
  await expect(filaBandas).toContainText('Referencia del proveedor')
  await expect(filaBandas).not.toContainText('OEM')
  await expect(filaBandas).toContainText(proveedor)
  await expect(filaBandas.getByRole('img', { name: /Foto de referencia/ })).toBeVisible()
  await capturar(page, 'lote')

  await elegirLote(page, otro)
  const enOtro = delLote(lista, otro).filter((p) => p.estado === 'propuesto').length
  await page.getByRole('button', { name: 'Borrar el lote' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar el lote' }).click()
  await expect(page.getByText(/Lote borrado: \d+ piezas? por revisar/).first()).toBeVisible({ timeout: 15_000 })
  lista = await externas()
  expect(delLote(lista, otro).filter((p) => p.estado === 'propuesto').length, 'el lote no se borró').toBe(0)
  log(`lote ${otro} borrado (${enOtro} por revisar)`)
  const otraVez = await traer(page, otro === loteA ? /Importadora Costanorte/ : /Distribuidora Autoriente/)
  expect(otraVez).toBe(otro)
  lista = await externas()
  expect(delLote(lista, otro).filter((p) => p.estado === 'propuesto').length, 'volver a traer no repuso el lote').toBe(enOtro)
  await capturar(page, 'retraido')

  const fuera = await mgEstado(`/piezas-externas/${bandas!.id}/incorporar`, { method: 'POST', body: JSON.stringify({}) })
  log(`incorporar sin vehículo en el maestro: HTTP ${fuera.status}`, JSON.stringify(fuera.cuerpo).slice(0, 160))
  expect([409, 422], 'incorporar una pieza fuera del maestro debe dar 422 o 409').toContain(fuera.status)

  await elegirLote(page, elegido)
  const region = page.getByRole('region', { name: 'Lote elegido' })
  await expect(region).toContainText('no está en el maestro', { timeout: 15_000 })
  await region.getByRole('button', { name: 'Dar de alta el vehículo' }).click()
  const alta = page.getByRole('dialog', { name: 'Dar de alta el vehículo' })
  await expect(alta.getByLabel('Marca')).toHaveValue('Ford')
  await expect(alta.getByLabel('Modelo')).toHaveValue('Focus')
  await alta.getByRole('button', { name: 'Dar de alta', exact: true }).click()
  await expect(page.getByText('Ford Focus dado de alta en el maestro').first()).toBeVisible({ timeout: 15_000 })
  await expect(region).toContainText('ya está en el maestro', { timeout: 15_000 })
  await expect(alta).toBeHidden()
  await page.waitForTimeout(800)
  await capturar(page, 'alta')
  const focus = (await mg<{ items: { id: string; estado: string }[] }>('/vehiculos-catalogo?marca=Ford&modelo=Focus&limit=20')).items
  expect(focus.map((v) => v.estado), 'el Ford Focus no quedó aprobado en el maestro').toContain('aprobado')

  await filaBandas.getByRole('button', { name: 'Incorporar' }).click()
  const incorporar = page.getByRole('dialog', { name: 'Incorporar sin precio' })
  await expect(incorporar.getByLabel('Vehículo')).toContainText(VEHICULO)
  await capturar(page, 'incorporar')
  await incorporar.getByRole('button', { name: 'Incorporar', exact: true }).click()
  await expect(page.getByText('Pieza incorporada: pendiente por comprar').first()).toBeVisible({ timeout: 15_000 })
  await expect(incorporar).toBeHidden()
  await page.waitForTimeout(800)
  await capturar(page, 'incorporada')

  lista = await externas()
  const hecha = lista.find((p) => p.id === bandas!.id)!
  expect(hecha.estado).toBe('aprobado')
  expect(hecha.pieza_id, 'la pieza incorporada no quedó ligada').toBeTruthy()
  const otras = delLote(lista, elegido).filter((p) => p.id !== bandas!.id)
  expect(otras.filter((p) => p.estado !== 'propuesto').map((p) => p.resumen.nombre), 'se incorporó algo más que las bandas').toEqual([])
  const producto = await mg<{ price: number; is_visible: boolean; details?: { label: string; value: string | null }[] }>(`/admin/products/${hecha.pieza_id}`)
  const ficha = await mg<{ vehiculos?: unknown[]; compatibilidad?: unknown; vehiculo?: unknown }>(`/piezas/${hecha.pieza_id}`)
  log('pieza incorporada:', JSON.stringify({ precio: producto.price, visible: producto.is_visible, detalles: producto.details, vehiculos: ficha.vehiculos }).slice(0, 400))
  expect(Number(producto.price), 'la pieza incorporada debe tener precio 0').toBe(0)
  expect(producto.is_visible, 'la pieza incorporada debe quedar oculta').toBe(false)
  expect(JSON.stringify(producto.details ?? []), 'falta "Pendiente por comprar"').toContain('Pendiente por comprar')
  const idsFocus = focus.map((v) => v.id)
  expect((ficha.vehiculos as { id?: string }[] | undefined)?.some((v) => idsFocus.includes(v.id ?? '')), 'la pieza no quedó ligada al Ford Focus del maestro').toBe(true)

  await revisarMedidas(page, 'Piezas externas al final')
  await sinTextoTecnico(page, 'Piezas externas al final')
  sinErroresDeConsola(errores, 'escritorio')

  const movil = await abrirPanel(browser, 'telefono')
  await ir(movil.page, '/admin/piezas-externas')
  await expect(movil.page.getByRole('button', { name: 'Traer piezas' })).toBeVisible()
  await capturar(movil.page, 'antes')
  await revisarMedidas(movil.page, 'Piezas externas a 375')
  await sinTextoTecnico(movil.page, 'Piezas externas a 375')
  sinErroresDeConsola(movil.errores, 'telefono')
})
