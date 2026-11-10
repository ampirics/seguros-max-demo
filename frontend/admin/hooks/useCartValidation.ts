import { useState, useCallback } from 'react'
import { useCart } from '@/contexts/cart-context'

export interface ValidatedItem {
  item_code: string
  item_name: string
  quantity: number
  available_quantity: number
  unit_price_sap: number
  unit_price_db: number
  total_price: number
  warehouse_details: Array<{
    warehouse_code: string
    warehouse_name: string
    stock: number
  }>
}

export interface LowStockItem {
  item_code: string
  item_name: string
  requested: number
  available: number
  shortage: number
  unit_price_sap: number
  total_price_available: number
  warehouse_details: any[]
}

export interface OutOfStockItem {
  item_code: string
  item_name: string
  quantity: number
  available_quantity: number
  unit_price_sap: number
  error?: string
}

export interface CartValidationResponse {
  valid: boolean
  all_available: boolean
  items_ok: ValidatedItem[]
  items_low_stock: LowStockItem[]
  items_out_of_stock: OutOfStockItem[]
  summary: {
    total_items: number
    items_available: number
    items_low_stock: number
    items_out_of_stock: number
  }
  pricing: {
    total_price_db: number
    total_price_sap: number
    price_difference: number
    currency: string
  }
}

export const useCartValidation = (sapValidationDisabled: boolean = false) => {
  const { items } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationData, setValidationData] = useState<CartValidationResponse | null>(null)

  const validateCart = useCallback(async () => {
    if (items.length === 0) {
      setError('El carrito está vacío')
      return null
    }

    // Si SAP validation está desactivada, no validar
    if (sapValidationDisabled) {
      setValidationData({
        valid: true,
        all_available: true,
        items_ok: [],
        items_low_stock: [],
        items_out_of_stock: [],
        summary: {
          total_items: items.length,
          items_available: items.length,
          items_low_stock: 0,
          items_out_of_stock: 0
        },
        pricing: {
          total_price_db: 0,
          total_price_sap: 0,
          price_difference: 0,
          currency: 'RDP'
        }
      })
      setError(null)
      return null
    }

    setLoading(true)
    setError(null)

    try {
      // Convertir items del carrito al formato esperado por el API
      const cartItems = items.map(item => ({
        item_code: item.sku || item.id,
        quantity: item.quantity
      }))

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const apiKey = process.env.NEXT_PUBLIC_STORE_API_KEY || ''

      const response = await fetch(`${apiUrl}/api/v1/cart/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ items: cartItems })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Error al validar el carrito')
      }

      const data: CartValidationResponse = await response.json()
      setValidationData(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      console.error('Error validando carrito:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [items, sapValidationDisabled])

  const hasOutOfStock = useCallback(() => {
    return validationData ? validationData.items_out_of_stock.length > 0 : false
  }, [validationData])

  const hasLowStock = useCallback(() => {
    return validationData ? validationData.items_low_stock.length > 0 : false
  }, [validationData])

  const isValid = useCallback(() => {
    return validationData ? validationData.valid : false
  }, [validationData])

  return {
    validateCart,
    loading,
    error,
    validationData,
    hasOutOfStock,
    hasLowStock,
    isValid
  }
}
