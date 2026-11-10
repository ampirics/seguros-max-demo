"use client"

import { useCartValidation } from "@/hooks/useCartValidation"
import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export function CartValidationDetails() {
  const [mounted, setMounted] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { validationData } = useCartValidation()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (!validationData) return null

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 border-l-4 border-blue-500">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between hover:opacity-75 transition-opacity"
      >
        <div className="text-left">
          <h3 className="font-semibold text-foreground">Detalles de validación SAP</h3>
          <p className="text-sm text-gray-600">
            {validationData.summary.items_available} / {validationData.summary.total_items} productos disponibles
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Items disponibles */}
          {validationData.items_ok.length > 0 && (
            <div>
              <h4 className="font-semibold text-green-700 text-sm mb-2">
                ✓ Disponibles ({validationData.items_ok.length})
              </h4>
              <div className="space-y-2">
                {validationData.items_ok.map((item) => (
                  <div key={item.item_code} className="text-sm bg-green-50 p-2 rounded">
                    <p className="font-mono text-xs text-gray-600">{item.item_code}</p>
                    <p className="text-gray-700">
                      Stock: <span className="font-semibold">{item.available_quantity}</span> unidades
                    </p>
                    {item.warehouse_details && item.warehouse_details.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Bodegas: {item.warehouse_details.map(w => `${w.warehouse_name} (${w.stock})`).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock bajo */}
          {validationData.items_low_stock.length > 0 && (
            <div>
              <h4 className="font-semibold text-amber-700 text-sm mb-2">
                ⚠ Stock Limitado ({validationData.items_low_stock.length})
              </h4>
              <div className="space-y-2">
                {validationData.items_low_stock.map((item) => (
                  <div key={item.item_code} className="text-sm bg-amber-50 p-2 rounded">
                    <p className="font-mono text-xs text-gray-600">{item.item_code}</p>
                    <p className="text-gray-700">
                      Disponible: <span className="font-semibold">{item.available}</span> de{" "}
                      <span className="font-semibold">{item.requested}</span>
                    </p>
                    <p className="text-red-600 font-semibold">
                      Falta: {item.shortage} unidades
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agotados */}
          {validationData.items_out_of_stock.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-700 text-sm mb-2">
                ✗ Agotados ({validationData.items_out_of_stock.length})
              </h4>
              <div className="space-y-2">
                {validationData.items_out_of_stock.map((item) => (
                  <div key={item.item_code} className="text-sm bg-red-50 p-2 rounded">
                    <p className="font-mono text-xs text-gray-600">{item.item_code}</p>
                    <p className="text-gray-700">
                      Solicitado: <span className="font-semibold">{item.quantity}</span>
                    </p>
                    {item.error && (
                      <p className="text-red-600 text-xs mt-1">{item.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumen de precios */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-foreground text-sm mb-2">Resumen de Precios</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal (BD):</span>
                <span className="font-semibold">{formatCurrency(validationData.pricing.total_price_db)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal (SAP):</span>
                <span className="font-semibold">{formatCurrency(validationData.pricing.total_price_sap)}</span>
              </div>
              {validationData.pricing.price_difference !== 0 && (
                <div className="flex justify-between bg-orange-50 px-2 py-1 rounded">
                  <span className="text-orange-700">Diferencia:</span>
                  <span className={`font-semibold ${validationData.pricing.price_difference > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                    {formatCurrency(validationData.pricing.price_difference)}
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">Moneda: {validationData.pricing.currency}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
