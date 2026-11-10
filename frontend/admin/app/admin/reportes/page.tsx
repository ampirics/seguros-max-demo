"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { MOTIVOS, ORIGEN } from "@/components/admin/leads/LeadFicha"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api-client"
import type { ResumenReportes } from "@/lib/api-types"
import { fechaLocal } from "@/lib/api/agenda"
import { cn, formatCurrency } from "@/lib/utils"

const PERIODOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
]
const TODOS = "todos"

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)} %`)
const duracion = (seg: number | null) => {
  if (seg == null) return "—"
  if (seg < 60) return `${seg} s`
  const m = Math.floor(seg / 60)
  return m < 60 ? `${m} min${seg % 60 ? ` ${seg % 60} s` : ""}` : `${Math.floor(m / 60)} h ${m % 60} min`
}

function Tile({ label, valor, detalle, alerta }: { label: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums", alerta && "text-destructive")}>{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </CardContent></Card>
  )
}

// Barra horizontal de una sola serie: el valor va escrito, la barra solo da la proporción.
function Barra({ label, valor, max, texto }: { label: string; valor: number; max: number; texto: string }) {
  return (
    <li className="space-y-1" title={`${label}: ${texto}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{texto}</span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%` }} />
      </div>
    </li>
  )
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4">
      <h2 className="font-display text-base font-semibold">{titulo}</h2>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
      <div className="mt-4">{children}</div>
    </CardContent></Card>
  )
}

export default function ReportesPage() {
  const [dias, setDias] = useState(30)
  const [vendedor, setVendedor] = useState(TODOS)
  const [vendedores, setVendedores] = useState<string[]>([])
  const [r, setR] = useState<ResumenReportes | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    setR(null)
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - dias * 86_400_000)
    apiClient
      .get<ResumenReportes>("/reportes/resumen", { desde: fechaLocal(desde), hasta: fechaLocal(hasta), vendedor: vendedor === TODOS ? undefined : vendedor })
      .then((res) => {
        setR(res)
        setError(false)
        if (vendedor === TODOS) setVendedores(res.por_vendedor.map((v) => v.vendedor))
      })
      .catch(() => setError(true))
  }, [dias, vendedor, intento])

  const maxMotivo = Math.max(0, ...(r?.por_motivo.map((m) => m.cantidad) ?? []))
  const maxCanal = Math.max(0, ...(r?.por_canal.map((c) => c.consultas) ?? []))

  return (
    <AdminLayout title="Reportes">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="radiogroup" aria-label="Periodo" className="inline-flex w-fit gap-0.5 rounded-control bg-secondary p-0.5">
            {PERIODOS.map((p) => (
              <button key={p.dias} type="button" role="radio" aria-checked={dias === p.dias} onClick={() => setDias(p.dias)}
                className={cn("h-8 rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  dias === p.dias ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                Últimos {p.label}
              </button>
            ))}
          </div>
          <Select value={vendedor} onValueChange={setVendedor}>
            <SelectTrigger className="h-9 w-full bg-card sm:w-[14rem]" aria-label="Vendedor"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todo el equipo</SelectItem>
              {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar los reportes</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !r ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : r.consultas === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">Sin leads en este periodo</p>
            <p className="mt-1 text-sm text-muted-foreground">Prueba con un periodo más largo u otro vendedor.</p>
          </CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Consultas" valor={String(r.consultas)} detalle={`${r.atendidas_ia} atendidas por la IA`} />
              <Tile label="Ganados" valor={String(r.ganadas)} detalle={formatCurrency(r.monto_ganado_dop)} />
              <Tile label="Conversión" valor={pct(r.conversion)} detalle={`${r.ganadas} de ${r.ganadas + r.perdidas} cerrados`} />
              <Tile label="Primera respuesta" valor={duracion(r.tiempo_respuesta_mediano_seg)} detalle={`mediana de ${r.respuestas_medidas} conversaciones`} />
              <Tile label="Cotizados" valor={String(r.cotizadas)} detalle={pct(r.consultas ? r.cotizadas / r.consultas : null) + " de las consultas"} />
              <Tile label="Perdidos" valor={String(r.perdidas)} detalle={`${formatCurrency(r.monto_perdido_dop)} cotizados`} />
              <Tile label="Abiertos" valor={String(r.abiertas)} detalle="sin cerrar todavía" />
              <Tile label="SLA vencido" valor={String(r.sla_vencido)} detalle="abiertos sin respuesta a tiempo" alerta={r.sla_vencido > 0} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Seccion titulo="Embudo" nota="Cotizado cuenta todo lead con cotización o ya ganado.">
                <ul className="space-y-3">
                  <Barra label="Consultas" valor={r.consultas} max={r.consultas} texto={String(r.consultas)} />
                  <Barra label="Cotizados" valor={r.cotizadas} max={r.consultas} texto={`${r.cotizadas} · ${pct(r.cotizadas / r.consultas)}`} />
                  <Barra label="Ganados" valor={r.ganadas} max={r.consultas} texto={`${r.ganadas} · ${pct(r.ganadas / r.consultas)}`} />
                </ul>
              </Seccion>

              <Seccion titulo="Por qué se pierden" nota="Motivo obligatorio al marcar un lead como perdido.">
                {r.por_motivo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ningún lead perdido en este periodo.</p>
                ) : (
                  <ul className="space-y-3">
                    {r.por_motivo.map((m) => (
                      <Barra key={m.motivo} label={MOTIVOS[m.motivo] ?? m.motivo} valor={m.cantidad} max={maxMotivo}
                        texto={`${m.cantidad}${m.monto_dop ? ` · ${formatCurrency(m.monto_dop)}` : ""}`} />
                    ))}
                  </ul>
                )}
              </Seccion>

              <Seccion titulo="Por canal" nota="De dónde entran las consultas y cuántas se ganan.">
                <ul className="space-y-3">
                  {r.por_canal.map((c) => (
                    <Barra key={c.origen} label={ORIGEN[c.origen] ?? c.origen} valor={c.consultas} max={maxCanal}
                      texto={`${c.consultas} ${c.consultas === 1 ? "consulta" : "consultas"} · ${c.ganadas} ${c.ganadas === 1 ? "ganado" : "ganados"}`} />
                  ))}
                </ul>
              </Seccion>

              <Seccion titulo="Por vendedor" nota="Atendidos: leads de los que es responsable. Ganados: los que cerró.">
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="w-full min-w-[30rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">Vendedor</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Atendidos</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Ganados</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Perdidos</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Monto ganado</th>
                        <th scope="col" className="py-2 text-right font-medium">1.ª respuesta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {r.por_vendedor.map((v) => (
                        <tr key={v.vendedor}>
                          <th scope="row" className="py-2 pr-3 text-left font-medium">{v.vendedor}</th>
                          <td className="py-2 pr-3 text-right tabular-nums">{v.consultas}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{v.ganadas}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{v.perdidas}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(v.monto_dop)}</td>
                          <td className="py-2 text-right tabular-nums">{duracion(v.tiempo_respuesta_mediano_seg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Seccion>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
