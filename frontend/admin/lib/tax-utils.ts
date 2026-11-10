interface TaxRate {
  percentage: number
  is_compound?: boolean
}

// Replica la lógica de TaxCalculator.calculate_order_taxes del backend (impuestos
// simples primero, luego compuestos sobre esa base) pero como una tasa única,
// independiente del subtotal, para poder aplicarla directamente a un precio.
export function computeTaxRate(taxes: TaxRate[]): number {
  if (!taxes || taxes.length === 0) return 0

  const nonCompoundRate = taxes
    .filter((t) => !t.is_compound)
    .reduce((sum, t) => sum + t.percentage, 0) / 100

  const compoundRate = taxes
    .filter((t) => t.is_compound)
    .reduce((sum, t) => sum + t.percentage, 0) / 100

  return nonCompoundRate + (1 + nonCompoundRate) * compoundRate
}
