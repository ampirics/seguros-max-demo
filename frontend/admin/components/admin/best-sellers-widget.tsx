"use client"

import { urlImagen } from '@/lib/api/piezas'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getBestSellingProducts, type BestSellerProduct } from '@/lib/admin-products'
import { TrendingUp, Package, DollarSign, ShoppingCart } from 'lucide-react'
import Image from 'next/image'

// "unidades" -> "unidad", "cajas" -> "caja": el tipo de unidad viene en plural del catálogo.
const singular = (tipo: string) => tipo.replace(/des$/, "d").replace(/s$/, "")

export function BestSellersWidget() {
  const [bestSellers, setBestSellers] = useState<BestSellerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [limit, setLimit] = useState(5)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    getBestSellingProducts(limit, days)
      .then(data => { if (active) setBestSellers(data.best_sellers) })
      .catch(err => {
        console.error('Error loading best sellers:', err)
        if (active) { setBestSellers([]); setError(true) }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days, limit, reload])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
            Más vendidos
          </CardTitle>
          <CardDescription>
            Unidades en pedidos cobrados de los últimos {days} días
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={days.toString()} onValueChange={(value) => setDays(parseInt(value))}>
            <SelectTrigger className="w-24" aria-label="Periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
            </SelectContent>
          </Select>
          <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
            <SelectTrigger className="w-16" aria-label="Cantidad de productos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            No se pudieron cargar las ventas.
            <button type="button" onClick={() => setReload(n => n + 1)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
              Reintentar
            </button>
          </div>
        ) : bestSellers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay datos de ventas en este período</p>
          </div>
        ) : (
          <div className="-mx-6 divide-y border-y">
            {bestSellers.map((product, index) => (
              <div key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
                  {index + 1}
                </div>
                
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-foto">
                  {product.image ? (
                    <Image
                      src={urlImagen(product.image) ?? ""}
                      alt={product.name}
                      fill
                      className="object-contain p-1 dark:brightness-90"
                      sizes="40px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="min-w-[9rem] flex-1">
                  <h4 className="font-medium truncate text-sm">{product.name}</h4>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatCurrency(product.price)}</span>
                    {product.unit_quantity && product.unit_type && (
                      <Badge variant="outline" className="text-xs">
                        {product.unit_quantity} {product.unit_quantity === 1 ? singular(product.unit_type) : product.unit_type}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="ml-auto shrink-0 text-right">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <ShoppingCart className="h-3 w-3" />
                    {product.total_sold}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(product.total_revenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {product.order_count} {product.order_count === 1 ? "orden" : "órdenes"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
