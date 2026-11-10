"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Car, Search } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { es } from "date-fns/locale"
import { AdminLayout } from "@/components/admin/admin-layout"
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api-client"
import type { VehiculoCliente } from "@/lib/api-types"
import { km } from "@/components/admin/vehiculos/Cronograma"
import { aVehiculo, nombreVehiculo } from "@/lib/api/vehiculos"

export default function VehiculosPage() {
  const [q, setQ] = useState("")
  const [items, setItems] = useState<VehiculoCliente[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    const t = setTimeout(() => {
      apiClient
        .get<{ items: VehiculoCliente[] }>("/vehiculos", { q: q.trim() || undefined })
        .then((r) => { if (vigente) { setItems(r.items.map(aVehiculo)); setError(false) } })
        .catch(() => { if (vigente) setError(true) })
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, intento])

  return (
    <AdminLayout title="Clientes">
      <div className="space-y-4">
        <SeccionTabs seccion="clientes" />
        <p className="text-sm text-muted-foreground">Vehículos de los clientes, con el historial de cada atención.</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por placa, VIN, modelo o cliente" aria-label="Buscar vehículos" className="h-10 bg-card pl-9" />
        </div>

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar los vehículos</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !items ? (
          <Card className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">No hay vehículos con esa búsqueda</p>
            <p className="mt-1 text-sm text-muted-foreground">Prueba con la placa, el modelo o el nombre del cliente.</p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {items.map((v) => (
                <li key={v.id}>
                  <Link href={`/admin/vehiculos/${v.id}`}
                    className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden>
                      <Car className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nombreVehiculo(v)}{v.motor && <span className="font-normal text-muted-foreground"> · {v.motor}</span>}</p>
                      <p className="truncate text-sm">{v.cliente ?? v.cliente_telefono ?? "Cliente sin nombre"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[v.placa && `Placa ${v.placa}`, v.vin && `VIN ${v.vin}`].filter(Boolean).join(" · ") || "Sin placa ni VIN"}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                      <p className="tabular-nums">{v.kilometraje != null ? km(v.kilometraje) : "Sin kilometraje"}</p>
                      <p>{v.atenciones} {v.atenciones === 1 ? "atención" : "atenciones"}</p>
                      {v.ultima_atencion && <p>{formatDistanceToNowStrict(new Date(v.ultima_atencion), { addSuffix: true, locale: es })}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
