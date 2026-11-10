import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('310.4: pase con motivo (cotización por validar)', async ({ browser }) => {
  await recorrerPase(browser, { preparar: ['correa de tiempo L200 2003, el chasis es K74T-0012345', 'sí', 'la 1', 'Carlos'], cotizacion: {}, vehiculo: ['K74T-0012345', 'Verificado'] })
})
