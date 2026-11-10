import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('210: pide una persona, alerta, brief, tomar y devolver', async ({ browser }) => {
  await recorrerPase(browser, { preparar: ['quiero hablar con una persona'], brief: ['Pide hablar con una persona'] })
})
