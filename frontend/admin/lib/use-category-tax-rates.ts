import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { computeTaxRate } from "@/lib/tax-utils"
import type { Product } from "@/lib/types"

// Obtiene, en un solo batch, la tasa de impuesto de cada categoría presente
// en la lista de productos, para poder mostrar precios con impuesto incluido
// en listados (home, grid) sin hacer una llamada por producto.
export function useCategoryTaxRates(products: Product[]): Record<string, number> {
  const [taxRates, setTaxRates] = useState<Record<string, number>>({})

  useEffect(() => {
    const categoryCodes = Array.from(
      new Set(
        products
          .map((p) => p.external_category_code)
          .filter((code): code is string => Boolean(code) && !(code as string in taxRates))
      )
    )

    if (categoryCodes.length === 0) return

    const loadRates = async () => {
      try {
        const response = await apiClient.taxes.getProductTaxes(
          categoryCodes.map((code) => ({ category_code: code }))
        )
        setTaxRates((prev) => {
          const next = { ...prev }
          categoryCodes.forEach((code) => {
            next[code] = computeTaxRate(response?.[code] || [])
          })
          return next
        })
      } catch (error) {
        // Sin impuesto como fallback si falla la llamada
        setTaxRates((prev) => {
          const next = { ...prev }
          categoryCodes.forEach((code) => {
            next[code] = 0
          })
          return next
        })
      }
    }

    loadRates()
  }, [products, taxRates])

  return taxRates
}
