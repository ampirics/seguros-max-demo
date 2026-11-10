"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Car, MessageSquare, Search } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Cronograma, PlanMantenimiento, km } from "@/components/admin/vehiculos/Cronograma"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api-client"
import type { EventoCronograma, PlanMantenimientoItem, VehiculoCliente } from "@/lib/api-types"
import { formatCurrency } from "@/lib/utils"
import { aEvento, aPlan, aVehiculo, nombreVehiculo } from "@/lib/api/vehiculos"

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  )
}

export default function VehiculoPage() {
  const id = useParams<{ id: string }>()?.id ?? ""
  const [vehiculo, setVehiculo] = useState<VehiculoCliente | null>(null)
  const [eventos, setEventos] = useState<EventoCronograma[] | null>(null)
  const [plan, setPlan] = useState<PlanMantenimientoItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setVehiculo(null)
    setEventos(null)
    setPlan(null)
    setError(false)
    Promise.all([
      apiClient.get<VehiculoCliente>(`/vehiculos/${id}`),
      apiClient.get<{ eventos: EventoCronograma[] }>(`/vehiculos/${id}/cronograma`),
      apiClient.get<{ items: PlanMantenimientoItem[] }>(`/vehiculos/${id}/plan`),
    ])
      .then(([v, c, p]) => { setVehiculo(aVehiculo(v)); setEventos(c.eventos.map(aEvento)); setPlan(p.items.map(aPlan)) })
      .catch(() => setError(true))
  }, [id])

  const suma = (tipo: EventoCronograma["tipo"]) => (eventos ?? []).filter((e) => e.tipo === tipo).reduce((s, e) => s + (e.monto_dop ?? 0), 0)
  const filtro = vehiculo
    ? new URLSearchParams(Object.entries({ marca: vehiculo.marca, modelo: vehiculo.modelo, anio: vehiculo.anio }).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()
    : ""

  return (
    <AdminLayout title="Vehículo">
      <div className="space-y-4">
        <Link href="/admin/vehiculos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Vehículos
        </Link>

        {error ? (
          <Card><CardContent className="p-10 text-center"><p className="font-medium">No encontramos este vehículo</p></CardContent></Card>
        ) : !vehiculo || !eventos || !plan ? (
          <Card className="space-y-3 p-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80" /><Skeleton className="h-40 w-full" /></Card>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden>
                  <Car className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-semibold leading-tight sm:text-2xl">{nombreVehiculo(vehiculo)}</h1>
                  <p className="text-sm text-muted-foreground">{[vehiculo.cliente, vehiculo.cliente_telefono].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {vehiculo.conversacion_id && (
                  <Button asChild variant="outline" className="gap-2">
                    <Link href={`/admin/chat?conversation=${vehiculo.conversacion_id}`}><MessageSquare className="h-4 w-4" aria-hidden /> Conversación</Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="gap-2">
                  <Link href={`/admin/piezas?${filtro}`}><Search className="h-4 w-4" aria-hidden /> Piezas para este vehículo</Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link href={`/admin/piezas/diagrama?${filtro}`}><Car className="h-4 w-4" aria-hidden /> Diagrama</Link>
                </Button>
              </div>
            </div>

            <Card><CardContent className="p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                <Dato label="Motor">{vehiculo.motor ?? "—"}</Dato>
                <Dato label="Placa">{vehiculo.placa ?? "—"}</Dato>
                <Dato label="VIN"><span className="font-mono text-xs">{vehiculo.vin ?? "—"}</span></Dato>
                <Dato label="Kilometraje">{vehiculo.kilometraje != null ? km(vehiculo.kilometraje) : "—"}</Dato>
                <Dato label="Cotizado">{formatCurrency(suma("cotizacion"))}</Dato>
                <Dato label="Vendido">{formatCurrency(suma("venta"))}</Dato>
              </dl>
            </CardContent></Card>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card><CardContent className="p-4">
                <div className="mb-4 flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-base font-semibold">Cronograma</h2>
                  <span className="text-sm text-muted-foreground">{eventos.length} {eventos.length === 1 ? "atención" : "atenciones"}</span>
                </div>
                <Cronograma eventos={eventos} />
              </CardContent></Card>

              <Card className="self-start"><CardContent className="p-4">
                <h2 className="font-display text-base font-semibold">Plan de mantenimiento</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  {vehiculo.kilometraje != null ? `A ${km(vehiculo.kilometraje)}. ` : "Falta el kilometraje: agrégalo desde la conversación. "}
                  Intervalos generales: confírmalos con el manual del vehículo.
                </p>
                <PlanMantenimiento items={plan} />
              </CardContent></Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
