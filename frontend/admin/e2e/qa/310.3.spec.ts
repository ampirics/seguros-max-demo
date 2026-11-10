import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('310.3: pase con motivo (no se identifica el vehículo)', async ({ browser }) => {
  await recorrerPase(browser, { preparar: ['filtro de aire', 'no sé nada del carro', 'tampoco'] })
})
