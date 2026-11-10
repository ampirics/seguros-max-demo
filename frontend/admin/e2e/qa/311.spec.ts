import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('311: el brief trae vehículo, VIN, pieza con lado y opciones', async ({ browser }) => {
  await recorrerPase(browser, {
    preparar: ['amortiguador delantero, el chasis es KM8JU3AB5CU000000', 'sí', 'los dos', 'Carlos', 'quiero hablar con alguien'],
    brief: ['KM8JU3AB5CU000000', /Tucson/i, 'Verificado', /Pieza: amortiguador delantero · delantera · los dos lados/i, '2 opciones de esa pieza',
      /Amortiguador Delantero \(LH\)/, /Amortiguador Delantero \(RH\)/, 'IM100889', 'IM100879',
      'RD$3,147.00', 'RD$2,939.00', /^(?![\s\S]*Pieza:[\s\S]*Pieza:)[\s\S]*Pieza:/],
    vehiculo: ['KM8JU3AB5CU000000', 'Verificado'],
    cotizacionDelChat: true,
  })
})
