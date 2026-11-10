'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface Proveedor {
  clave: string
  nombre: string
  estado: 'sin_configurar' | 'incompleto' | 'inactivo' | 'listo'
  modo_prueba: boolean
  faltan: { clave: string; nombre: string; da: string }[]
}

const ESTADO = {
  listo: { texto: 'Listo', icono: CheckCircle2, clase: 'text-success' },
  incompleto: { texto: 'Faltan datos', icono: AlertTriangle, clase: 'text-warning' },
  inactivo: { texto: 'Desactivado', icono: CircleDashed, clase: 'text-muted-foreground' },
  sin_configurar: { texto: 'Sin configurar', icono: CircleDashed, clase: 'text-muted-foreground' },
}

export function EstadoProveedores() {
  const [datos, setDatos] = useState<{ proveedores: Proveedor[]; cobro_real: boolean } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    apiClient.get<{ proveedores: Proveedor[]; cobro_real: boolean }>('/payments/providers/estado').then(setDatos).catch(() => setError(true))
  }, [])
  if (error) return null
  if (!datos) return <Skeleton className="h-40" />
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="font-display text-base font-semibold">Estado de los bancos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {datos.cobro_real
              ? 'Hay al menos un banco listo para cobrar de verdad.'
              : 'Todavía no se cobra de verdad: los enlaces de pago y la tienda usan el modo de prueba hasta que la tienda firme con un banco y cargue sus credenciales.'}
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {datos.proveedores.map((p) => {
            const e = ESTADO[p.estado]
            const Icono = e.icono
            return (
              <li key={p.clave} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.nombre}</span>
                  <Badge variant="outline">{p.modo_prueba ? 'Modo prueba' : 'Producción'}</Badge>
                </div>
                <p className={cn('mt-1 flex items-center gap-1.5 text-sm', e.clase)}><Icono className="h-4 w-4" aria-hidden /> {e.texto}</p>
                {p.faltan.length > 0 && (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">Falta:</p>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {p.faltan.map((f) => <li key={f.clave}>{f.nombre} <span className="text-muted-foreground">(lo da {f.da})</span></li>)}
                    </ul>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
