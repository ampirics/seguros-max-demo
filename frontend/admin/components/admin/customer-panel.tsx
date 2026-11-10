"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  phone?: string
  name?: string
}

interface CustomerStats {
  customer_id: string
  customer_name: string
  customer_phone: string
  order_stats: {
    pending: number
    paid: number
    cancelled: number
    total: number
  }
  pending_orders: Array<{
    order_number: string
    order_id: string
    date: string
    amount: number
    status: string
  }>
  total_pending_amount: number
}

export default function CustomerPanel({ phone, name }: Props) {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [loadError, setLoadError] = useState(false)
  const customer = matches.find(c => c.id === selectedId) || null

  // Clientes con este número. Antes: `/customers?phone=` — sin teléfono eso
  // devolvía el listado general y se mostraba un cliente cualquiera, y si el
  // número era de varios clientes (sucursales) solo se veía uno.
  useEffect(() => {
    let mounted = true
    setMatches([])
    setSelectedId(null)
    setStats(null)
    setLoadError(false)
    const digits = (phone || '').replace(/\D/g, '')
    if (digits.length < 7) return
    setLoading(true)
    apiClient.request<any>(`/customer-contacts/by-phone/${encodeURIComponent(digits)}`)
      .then((res: any) => {
        if (!mounted) return
        const list = Array.isArray(res?.customers) ? res.customers : []
        setMatches(list)
        setSelectedId(list[0]?.id ?? null)
      })
      .catch((e: any) => {
        console.error('[CustomerPanel] Error buscando cliente:', e)
        if (mounted) setLoadError(true)
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [phone])

  useEffect(() => {
    let mounted = true
    setStats(null)
    if (!selectedId) return
    apiClient.request<CustomerStats>(`/customers/${selectedId}/stats`)
      .then(r => { if (mounted) setStats(r) })
      .catch(e => console.error('[CustomerPanel] Error obteniendo estadísticas:', e))
    return () => { mounted = false }
  }, [selectedId])

  if (loading) {
    return (
      <div className="p-4 space-y-2" aria-busy="true">
        <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        <div className="h-16 w-full rounded bg-muted animate-pulse" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-4 text-sm text-center text-muted-foreground">
        No se pudo cargar el cliente.
      </div>
    )
  }

  return (
    <div>
      <div className="p-4">
        {customer ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{customer.name}</h3>
                <p className="text-sm text-gray-600">{customer.phone}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {customer.external_reference && (
                    <Badge variant="outline" className="font-mono text-xs">{customer.external_reference}</Badge>
                  )}
                  {customer.document_id && (
                    <span className="text-xs text-gray-500">Doc. {customer.document_id}</span>
                  )}
                </div>
                {matches.length > 1 && (
                  <div className="mt-3">
                    <label htmlFor="customer-panel-select" className="text-xs text-gray-500">
                      Este número es de {matches.length} clientes
                    </label>
                    <select
                      id="customer-panel-select"
                      className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                      value={selectedId ?? ''}
                      onChange={e => setSelectedId(e.target.value)}
                    >
                      {matches.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}{m.external_reference ? ` · ${m.external_reference}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Estadísticas de órdenes */}
            {stats && (
              <>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm [&_p:first-child]:truncate">
                  <div>
                    <p className="text-xs text-gray-500">Pendientes</p>
                    <p className="font-semibold">{stats.order_stats.pending}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Pagadas</p>
                    <p className="font-semibold">{stats.order_stats.paid}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Canceladas</p>
                    <p className="font-semibold">{stats.order_stats.cancelled}</p>
                  </div>
                </div>

                {/* Monto total pendiente */}
                {stats.total_pending_amount > 0 && (
                  <div className="mt-4 rounded-lg bg-warning-soft p-3">
                    <p className="text-xs font-medium text-muted-foreground">Monto total pendiente</p>
                    <p className="font-display text-lg font-semibold text-foreground">
                      RD$ {stats.total_pending_amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {/* Lista de órdenes pendientes */}
                {stats.pending_orders.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700">Órdenes pendientes de pago</h4>
                    <ul className="mt-2 space-y-2 text-sm">
                      {stats.pending_orders.map(order => (
                        <li key={order.order_id} className="flex items-start justify-between rounded-lg bg-secondary p-2.5">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">#{order.order_number}</div>
                            <div className="text-xs text-gray-500">
                              {order.date ? format(new Date(order.date), "d 'de' MMMM, yyyy", { locale: es }) : 'Fecha no disponible'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              RD$ {order.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <Badge variant="outline" className="mt-1 border-transparent bg-warning-soft text-xs text-warning">
                              Pendiente
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resumen si no hay pendientes */}
                {stats.pending_orders.length === 0 && stats.order_stats.total > 0 && (
                  <div className="mt-4 rounded-lg bg-success-soft p-3">
                    <p className="text-sm text-success">
                      No hay órdenes pendientes de pago
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-700">{name || 'Cliente nuevo'}</h3>
            <p className="text-sm text-gray-500">{phone || 'Sin teléfono'}</p>
            <p className="text-xs text-gray-400 mt-2">
              Este cliente no está registrado en el sistema
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
