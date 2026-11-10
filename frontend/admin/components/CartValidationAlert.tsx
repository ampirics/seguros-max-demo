"use client"

import { useCartValidation } from "@/hooks/useCartValidation"
import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface CartValidationAlertProps {
  sapValidationDisabled?: boolean
}

export function CartValidationAlert({ sapValidationDisabled = false }: CartValidationAlertProps) {
  const [mounted, setMounted] = useState(false)
  const { validateCart, validationData, loading, error, hasOutOfStock, hasLowStock, isValid } = useCartValidation(sapValidationDisabled)

  useEffect(() => {
    setMounted(true)
    // Validar el carrito automáticamente cuando el componente se monta
    validateCart()
  }, [validateCart])

  if (!mounted) return null

  // Si SAP está desactivado, no mostrar nada
  if (sapValidationDisabled) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">Validando disponibilidad...</h3>
            <p className="text-sm text-blue-700">Consultando stock con SAP</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error en validación</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => validateCart()}
              className="text-sm text-red-600 hover:text-red-700 underline mt-2"
            >
              Intentar nuevamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!validationData) return null

  // Items agotados - CRÍTICO
  if (hasOutOfStock()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Productos agotados</h3>
            <p className="text-sm text-red-700 mt-1">
              Los siguientes productos no están disponibles:
            </p>
            <ul className="mt-2 space-y-1">
              {validationData.items_out_of_stock.map((item) => (
                <li key={item.item_code} className="text-sm text-red-700">
                  • {item.item_name} (solicitado: {item.quantity})
                </li>
              ))}
            </ul>
            <p className="text-xs text-red-600 mt-3">
              Por favor, remove estos productos antes de continuar
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Stock bajo - ADVERTENCIA
  if (hasLowStock()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">Stock limitado</h3>
            <p className="text-sm text-amber-700 mt-1">
              Algunos productos tienen stock limitado:
            </p>
            <ul className="mt-2 space-y-1">
              {validationData.items_low_stock.map((item) => (
                <li key={item.item_code} className="text-sm text-amber-700">
                  • {item.item_name}: {item.available} de {item.requested} disponibles
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-600 mt-3">
              Procede con cuidado, podría haber cambios en tu pedido
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Todo bien
  if (isValid()) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Carrito validado ✓</h3>
            <p className="text-sm text-green-700 mt-1">
              Todos los productos están disponibles
            </p>
            {validationData.pricing && (
              <div className="text-xs text-green-600 mt-2 space-y-1">
                <p>Subtotal: {formatCurrency(validationData.pricing.total_price_sap)}</p>
                {validationData.pricing.price_difference !== 0 && (
                  <p className="text-orange-600">
                    Diferencia de precio: {formatCurrency(validationData.pricing.price_difference)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
