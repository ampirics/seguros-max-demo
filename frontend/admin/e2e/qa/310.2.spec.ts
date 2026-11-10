import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('310.2: pase con motivo (queja)', async ({ browser }) => {
  await recorrerPase(browser, { preparar: ['la pieza que me vendieron no me sirvió'] })
})
