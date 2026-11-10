import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('315: el panel muestra el mismo total y la misma regla de ITBIS', async ({ browser }) => {
  await recorrerPase(browser, {
    preparar: ['bandas delanteras lancer 2005 1.3', 'la original', 'Luis'],
    pase: false,
    cotizacion: { total: '3,776' },
  })
})
