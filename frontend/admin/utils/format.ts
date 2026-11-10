/**
 * Utilidades para formatear números y monedas
 */

/**
 * Formatea un número con comas como separadores de miles
 * @param number - Número a formatear
 * @param decimals - Número de decimales (default: 2)
 * @returns Número formateado con comas
 */
export function formatNumber(number: number | string, decimals: number = 2): string {
  const num = typeof number === 'string' ? parseFloat(number) : number
  if (isNaN(num)) return '0.00'
  
  return num.toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Formatea un precio en pesos dominicanos con el prefijo RD$
 * @param price - Precio a formatear
 * @param decimals - Número de decimales (default: 2)
 * @returns Precio formateado con RD$ y comas
 */
export function formatPrice(price: number | string, decimals: number = 2): string {
  return `RD$ ${formatNumber(price, decimals)}`
}

/**
 * Formatea un precio solo con el símbolo $ (para usar en inputs o espacios pequeños)
 * @param price - Precio a formatear
 * @param decimals - Número de decimales (default: 2)
 * @returns Precio formateado con $ y comas
 */
export function formatPriceShort(price: number | string, decimals: number = 2): string {
  return `$${formatNumber(price, decimals)}`
}

/**
 * Parsea un string con formato de precio a número
 * @param priceString - String con formato "RD$ 1,234.56" o "$1,234.56"
 * @returns Número parseado
 */
export function parsePrice(priceString: string): number {
  if (!priceString) return 0
  // Remover RD$, $, espacios y comas
  const cleaned = priceString.replace(/[RD$\s,]/g, '')
  return parseFloat(cleaned) || 0
}