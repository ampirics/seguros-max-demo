"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { FILTRO_INICIAL, FiltroPeriodo, rangoDe } from "@/components/admin/FiltroPeriodo"
import { LeadFicha, sla } from "@/components/admin/leads/LeadFicha"
import { Tuberia, sumaMonto as suma } from "@/components/admin/crm/Tuberia"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdmin } from "@/contexts/admin-context"
import { apiClient } from "@/lib/api-client"
import type { Lead } from "@/lib/api-types"
import { aLead } from "@/lib/api/leads"
import { cn, formatCurrency } from "@/lib/utils"

function Metrica({ label, valor, detalle, alerta }: { label: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", alerta && "text-destructive")}>{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </CardContent></Card>
  )
}

export default function LeadsPage() {
  const { user } = useAdmin()
  const [q, setQ] = useState("")
  const [filtro, setFiltro] = useState(FILTRO_INICIAL)
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [abierta, setAbierta] = useState<Lead | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let vigente = true
    const t = setTimeout(() => {
      apiClient
        .get<{ items: Lead[] }>("/leads", { q: q.trim() || undefined, ...rangoDe(filtro), limit: 500 })
        .then((r) => { if (vigente) { setLeads(r.items.map(aLead)); setError(false) } })
        .catch(() => { if (vigente) setError(true) })
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, filtro, intento])

  const todas = leads ?? []
  const de = (etapa: Lead["etapa"]) => todas.filter((l) => l.etapa === etapa)
  const ganadas = de("ganada")
  const perdidas = de("perdida")
  const abiertas = todas.filter((l) => !["ganada", "perdida"].includes(l.etapa))
  const vencidas = todas.filter((l) => sla(l, ahora)?.vencido).length
  const cerradas = ganadas.length + perdidas.length

  const cambio = (l: Lead) => {
    setLeads((prev) => prev?.map((x) => (x.id === l.id ? l : x)) ?? prev)
    setAbierta(l)
  }

  return (
    <AdminLayout title="Ventas">
      <div className="space-y-4">
        <SeccionTabs seccion="ventas" />

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar los leads</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !leads ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metrica label="Abiertos" valor={String(abiertas.length)} detalle={`${formatCurrency(suma(abiertas))} en juego`} />
              <Metrica label="Ganados" valor={String(ganadas.length)} detalle={formatCurrency(suma(ganadas))} />
              <Metrica label="Conversión" valor={cerradas ? `${Math.round((ganadas.length / cerradas) * 100)} %` : "—"} detalle={`${ganadas.length} de ${cerradas} cerrados`} />
              <Metrica label="SLA vencido" valor={String(vencidas)} detalle="sin respuesta a tiempo" alerta={vencidas > 0} />
            </div>

            <FiltroPeriodo value={filtro} onChange={setFiltro} cerradasTexto="Ocultar ganados y perdidos" />

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente, pieza, teléfono o modelo" aria-label="Buscar leads" className="h-10 bg-card pl-9" />
            </div>

            <Tuberia leads={todas} ahora={ahora} ocultarCerradas={filtro.ocultarCerradas} onAbrir={setAbierta} />
          </>
        )}
      </div>

      <LeadFicha lead={abierta} usuario={user?.name ?? "Vendedor"} onCerrar={() => setAbierta(null)} onCambio={cambio} />
    </AdminLayout>
  )
}
