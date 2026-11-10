import { test } from '@playwright/test'
import { recorrerPase } from './pase'

test('229: al tomar, la tarjeta del brief está arriba sin scroll', async ({ browser }) => {
  await recorrerPase(browser, {
    preparar: ['bandas delanteras lancer 2005 1.3', 'quiero hablar con una persona'],
    prepararSiempre: true,
    brief: ['Pide hablar con una persona', /Pieza: bandas? delanteras? · 2 opciones de esa pieza/i, '2 opciones de esa pieza', /1\.\s*Bandas de Freno Delanteras/, /2\.\s*Bandas de Freno Delanteras/, 'LC101452', 'IM000325', 'RD$3,200.00', 'RD$609.00',
      /^(?![\s\S]*Pieza:[\s\S]*Pieza:)[\s\S]*Pieza:/],
    sinPiezaElegida: true,
  })
})
