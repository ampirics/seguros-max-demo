import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('310.1: pase con motivo (regateo que insiste)', async ({ browser }) => {
  await recorrerPase(browser, { preparar: ['bandas delanteras lancer 2005 1.3', 'déjamelo en 400', 'déjamelo en 400'] })
})
