"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { Encabezado, Filtro, Indicador, Persona, Tarjeta } from "@/components/seguros/comun"
import { NOMBRE_ORIGEN, NOMBRE_SUCURSAL, RAMO, duracion, fechaLarga, numero, rdCorto } from "@/lib/seguros/catalogo"
import { segurosApi, useSeguros, type Metricas } from "@/lib/seguros/cliente"

const pct = (x: number) => `${Math.round(x * 100)} %`
const EJE = { fontSize: 11, fill: "var(--muted-foreground)" }
const TIP = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "var(--foreground)" } }

export default function IndicadoresPage() {
  const { estado } = useSeguros()
  const [dias, setDias] = useState(90)
  const [m, setM] = useState<Metricas | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    segurosApi.metricas(dias).then((x) => (setM(x), setError(null))).catch((e) => setError((e as Error).message))
  }, [dias, estado?.version])

  return (
    <AdminLayout title="Indicadores">
      <div className="flex flex-col gap-5">
        <Encabezado
          titulo="Indicadores"
          detalle="Los indicadores con los que se mide el piloto: rapidez, calidad de la captación, conversión y servicio. Cada número sale de las conversaciones, solicitudes, pólizas y siniestros registrados."
          acciones={[30, 90, 365].map((d) => (
            <Filtro key={d} activo={dias === d} onClick={() => setDias(d)}>{d === 365 ? "12 meses" : `${d} días`}</Filtro>
          ))}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!m ? (
          <Skeleton className="h-[40rem] w-full" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador etiqueta="Tiempo de primera respuesta" valor={m.resumen.primeraRespuestaSeg != null ? duracion(m.resumen.primeraRespuestaSeg) : "Sin dato"} detalle="Mediana, desde que entra la solicitud hasta la primera respuesta útil" tono="bien" />
              <Indicador etiqueta="Tasa de calificación" valor={pct(m.resumen.tasaCalificacion)} detalle={`${numero(m.resumen.calificadas)} de ${numero(m.resumen.oportunidades)} solicitudes llegaron al ejecutivo con su ficha`} />
              <Indicador etiqueta="Conversión a cotización" valor={pct(m.resumen.conversionCotizacion)} detalle={`${numero(m.resumen.conCotizacion)} solicitudes con comparativo`} />
              <Indicador etiqueta="Conversión a póliza" valor={pct(m.resumen.conversionPoliza)} detalle={`${numero(m.resumen.ganadas)} pólizas nuevas por ${rdCorto(m.resumen.primaNueva)} de prima`} />
              <Indicador etiqueta="Contención segura" valor={pct(m.resumen.contencion)} detalle="Conversaciones resueltas por la IA sin pasar al equipo" />
              <Indicador etiqueta="Fuera de horario" valor={numero(m.resumen.fueraDeHorario)} detalle="Solicitudes de noche, temprano o en domingo atendidas al momento" />
              <Indicador etiqueta="Siniestros reportados" valor={numero(m.resumen.siniestros)} detalle={`${numero(m.resumen.siniestrosAbiertos)} abiertos ahora`} />
              <Indicador etiqueta="Días hasta resolverse un siniestro" valor={m.resumen.diasCierreSiniestro != null ? m.resumen.diasCierreSiniestro.toFixed(1) : "Sin dato"} detalle="Mediana desde el reporte hasta la respuesta de la aseguradora" />
            </div>

            <Tarjeta titulo="Antes y con ORA">
              <p className="text-sm text-muted-foreground">
                El asistente atiende desde el {fechaLarga(Date.parse(`${m.comparacion.inicioOra}T12:00:00-04:00`))}. Se comparan los {numero(m.comparacion.antes.oportunidades)} casos del mismo número de días anteriores con los {numero(m.comparacion.conOra.oportunidades)} posteriores.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { t: "Primera respuesta", a: m.comparacion.antes.primeraRespuestaSeg != null ? duracion(m.comparacion.antes.primeraRespuestaSeg) : "Sin dato", c: m.comparacion.conOra.primeraRespuestaSeg != null ? duracion(m.comparacion.conOra.primeraRespuestaSeg) : "Sin dato" },
                  { t: "Cierre de oportunidades", a: pct(m.comparacion.antes.conversion), c: pct(m.comparacion.conOra.conversion) },
                ].map((x) => (
                  <div key={x.t} className="grid grid-cols-2 gap-3 rounded-lg bg-secondary p-4">
                    <span className="col-span-2 text-xs font-medium text-muted-foreground">{x.t}</span>
                    <span><span className="block text-[11px] text-muted-foreground">Antes</span><span className="font-display text-2xl font-bold">{x.a}</span></span>
                    <span><span className="block text-[11px] text-primary">Con ORA</span><span className="font-display text-2xl font-bold text-primary">{x.c}</span></span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Comparación de referencia con datos de ejemplo. En el piloto, los denominadores y el proceso de referencia se fijan con MAX antes de empezar.</p>
            </Tarjeta>

            <Tarjeta titulo="Solicitudes y primera respuesta por mes">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={m.mensual} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={EJE} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="a" tick={EJE} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="b" orientation="right" tick={EJE} tickLine={false} axisLine={false} unit=" min" />
                    <Tooltip {...TIP} formatter={(v: number, n: string) => (n === "primeraRespuestaMin" ? [`${v} min`, "Primera respuesta"] : [v, n === "oportunidades" ? "Solicitudes" : "Pólizas nuevas"])} />
                    <Bar yAxisId="a" dataKey="oportunidades" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="a" dataKey="ganadas" fill="var(--acento)" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="b" dataKey="primeraRespuestaMin" stroke="var(--destructive)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Solicitudes</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--acento)" }} />Pólizas nuevas</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-destructive" />Primera respuesta (minutos)</span>
              </div>
            </Tarjeta>

            <div className="grid gap-5 lg:grid-cols-2">
              <Tarjeta titulo="Embudo">
                <div className="flex flex-col gap-2">
                  {m.embudo.map((e) => (
                    <div key={e.etapa} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-xs text-muted-foreground">{e.nombre}</span>
                      <span className="h-7 flex-1 overflow-hidden rounded-md bg-secondary">
                        <span className="flex h-full items-center rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground" style={{ width: `${Math.max(8, (e.cantidad / Math.max(1, m.embudo[0].cantidad)) * 100)}%` }}>{numero(e.cantidad)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Tarjeta>
              <Tarjeta titulo="Por canal de entrada">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.porOrigen.map((o) => ({ ...o, nombre: NOMBRE_ORIGEN[o.origen] }))} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="nombre" tick={EJE} tickLine={false} axisLine={false} width={110} />
                      <Tooltip {...TIP} formatter={(v: number, n: string) => [v, n === "total" ? "Solicitudes" : "Pólizas"]} />
                      <Bar dataKey="total" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="ganadas" fill="var(--acento)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Tarjeta>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Tarjeta titulo="Por ramo">
                <ul className="flex flex-col divide-y">
                  {m.porRamo.map((r) => (
                    <li key={r.ramo} className="flex items-center gap-3 py-2 text-sm">
                      <span className="flex-1">{RAMO[r.ramo].nombre}</span>
                      <span className="w-20 text-right tabular-nums text-muted-foreground">{numero(r.total)}</span>
                      <span className="w-20 text-right tabular-nums text-muted-foreground">{r.total ? pct(r.ganadas / r.total) : "0 %"}</span>
                      <span className="w-24 text-right font-medium tabular-nums">{rdCorto(r.prima)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">Solicitudes, porcentaje que terminó en póliza y prima emitida.</p>
              </Tarjeta>
              <Tarjeta titulo="Por ejecutivo">
                <ul className="flex flex-col divide-y">
                  {m.ejecutivos.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <Persona id={e.id} />
                        <span className="ml-8 block text-[11px] text-muted-foreground">{NOMBRE_SUCURSAL[e.sucursal]} · {e.abiertas} abiertas</span>
                      </span>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">{numero(e.asignadas)}</span>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">{pct(e.cierre)}</span>
                      <span className="w-24 text-right font-medium tabular-nums">{rdCorto(e.prima)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">Asignadas, cierre y prima emitida.</p>
              </Tarjeta>
            </div>

            <Tarjeta titulo="Por qué se pierden">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {m.motivosPerdida.map((x) => (
                  <li key={x.motivo} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                    <span>{x.motivo}</span>
                    <span className="font-semibold tabular-nums">{x.cantidad}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
            <p className="text-xs text-muted-foreground">Asegurados, primas y montos de ejemplo para la demostración.</p>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
