"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Store } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { CitaFicha, ESTADO_CITA, TIPO_CITA, horaCita } from "@/components/admin/agenda/CitaFicha"
import { ConectarGoogle } from "@/components/admin/agenda/ConectarGoogle"
import { Horario } from "@/components/admin/agenda/Horario"
import { NuevaCita } from "@/components/admin/agenda/NuevaCita"
import { QuienVieneHoy } from "@/components/admin/agenda/QuienVieneHoy"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdmin } from "@/contexts/admin-context"
import { apiClient } from "@/lib/api-client"
import type { Cita, VendedorAgenda } from "@/lib/api-types"
import { aCita } from "@/lib/api/agenda"
import { cn } from "@/lib/utils"

const HORA_INI = 8
const HORA_FIN = 18
const FILA = 28 // px por bloque de 30 min
const ALTO = (HORA_FIN - HORA_INI) * 2 * FILA
const TODOS = "todos"

// Lunes de la semana a mostrar; el domingo (cerrado) salta a la semana que empieza mañana.
function lunesDe(d: Date) {
  const l = new Date(d)
  l.setHours(0, 0, 0, 0)
  l.setDate(l.getDate() + (l.getDay() === 0 ? 1 : 1 - l.getDay()))
  return l
}
const minDelDia = (d: Date) => d.getHours() * 60 + d.getMinutes()
const aMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const y = (min: number) => ((min - HORA_INI * 60) / 30) * FILA
// Carriles solo donde las citas se cruzan: cada grupo de citas encimadas reparte su ancho.
function carriles(citas: Cita[]) {
  const orden = [...citas].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const out = new Map<string, { carril: number; carriles: number }>()
  let grupo: Cita[] = []
  let finGrupo = ""
  let finCarril: string[] = []
  const cerrar = () => { for (const c of grupo) out.set(c.id, { carril: out.get(c.id)!.carril, carriles: finCarril.length }) }
  for (const c of orden) {
    if (grupo.length && c.inicio >= finGrupo) { cerrar(); grupo = []; finCarril = [] }
    let carril = finCarril.findIndex((fin) => fin <= c.inicio)
    if (carril === -1) carril = finCarril.push(c.fin) - 1
    else finCarril[carril] = c.fin
    out.set(c.id, { carril, carriles: 1 })
    grupo.push(c)
    finGrupo = c.fin > finGrupo ? c.fin : finGrupo
  }
  cerrar()
  return out
}
const iniciales = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()

function Bloque({ cita, carril, carriles, conVendedor, onAbrir }: { cita: Cita; carril: number; carriles: number; conVendedor: boolean; onAbrir: () => void }) {
  const ini = new Date(cita.inicio)
  const fin = new Date(cita.fin)
  const Icon = TIPO_CITA[cita.tipo].icon
  const top = Math.max(0, y(minDelDia(ini)))
  const alto = Math.max(FILA - 2, y(minDelDia(fin)) - y(minDelDia(ini)) - 2)
  return (
    <button
      type="button"
      onClick={onAbrir}
      title={[horaCita(cita.inicio), cita.cliente, cita.vendedor].filter(Boolean).join(" · ")}
      style={{ top, height: alto, left: `calc(${(carril / carriles) * 100}% + 2px)`, width: `calc(${100 / carriles}% - 4px)` }}
      className={cn(
        "absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring",
        cita.tipo === "visita" ? "border-primary bg-accent text-accent-foreground" : "border-warning bg-warning-soft text-foreground",
        cita.estado === "completada" && "opacity-60",
        (cita.estado === "no_asistio" || cita.estado === "cancelada") && "opacity-50 line-through"
      )}
    >
      <span className="flex items-center gap-1 font-medium">
        <Icon className="h-3 w-3 shrink-0" aria-hidden /> {horaCita(cita.inicio)}
        {conVendedor && cita.vendedor && <span className="ml-auto rounded bg-card/70 px-1 text-[10px] no-underline">{iniciales(cita.vendedor)}</span>}
      </span>
      <span className="block truncate">{cita.cliente ?? cita.telefono ?? "Cliente"}</span>
    </button>
  )
}

export default function CalendarioPage() {
  const { user } = useAdmin()
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [vendedores, setVendedores] = useState<VendedorAgenda[]>([])
  const [filtroVendedor, setFiltroVendedor] = useState(TODOS)
  const [sucursal, setSucursal] = useState(TODOS)
  const [citas, setCitas] = useState<Cita[] | null>(null)
  const [error, setError] = useState(false)
  const [abierta, setAbierta] = useState<Cita | null>(null)
  const [nueva, setNueva] = useState(false)
  const [horario, setHorario] = useState(false)
  const [hoy, setHoy] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    apiClient.get<VendedorAgenda[]>("/agenda/vendedores").then(setVendedores).catch(() => setError(true))
    if (new URLSearchParams(window.location.search).get("hoy")) setHoy(true)
    const t = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const domingo = useMemo(() => new Date(lunes.getTime() + 6 * 86_400_000), [lunes])
  useEffect(() => {
    setCitas(null)
    apiClient
      .get<{ items: Cita[] }>("/agenda/citas", {
        desde: lunes.toISOString(),
        hasta: domingo.toISOString(),
        vendedor_id: filtroVendedor === TODOS ? undefined : filtroVendedor,
        incluir_canceladas: true,
      })
      .then((r) => {
        const todas = r.items.map(aCita)
        setCitas(sucursal === TODOS ? todas : todas.filter((c) => !c.sucursal || c.sucursal === sucursal))
        setError(false)
      })
      .catch(() => setError(true))
  }, [lunes, domingo, filtroVendedor, sucursal])

  const visibles = vendedores.filter((v) => (sucursal === TODOS || v.sucursal === sucursal) && (filtroVendedor === TODOS || v.id === filtroVendedor))
  const dias = Array.from({ length: 6 }, (_, i) => new Date(lunes.getTime() + i * 86_400_000))
  const sucursales = [...new Set(vendedores.map((v) => v.sucursal).filter((s): s is string => !!s))]
  const miId = vendedores.find((v) => v.id === user?.id)?.id ?? null
  const proxima = (citas ?? []).find((c) => c.estado === "programada" && new Date(c.inicio) > ahora)
  const titulo = `${lunes.toLocaleDateString("es-DO", { day: "numeric", month: "short" })} – ${dias[5].toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" })}`

  const moverSemana = (n: number) => setLunes((l) => new Date(l.getTime() + n * 7 * 86_400_000))
  const actualizar = (c: Cita) => {
    setCitas((prev) => prev?.map((x) => (x.id === c.id ? c : x)) ?? prev)
    setAbierta(c)
  }

  return (
    <AdminLayout title="Calendario">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => moverSemana(-1)} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" className="h-9" onClick={() => setLunes(lunesDe(new Date()))}>Hoy</Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => moverSemana(1)} aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></Button>
            <h2 className="ml-2 font-display text-base font-semibold">{titulo}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger className="h-9 w-[12rem] bg-card" aria-label="Vendedor"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los vendedores</SelectItem>
                {vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sucursal} onValueChange={setSucursal}>
              <SelectTrigger className="h-9 w-[11rem] bg-card" aria-label="Sucursal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas las sucursales</SelectItem>
                {sucursales.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-9 gap-2" onClick={() => setHoy(true)}><Store className="h-4 w-4" aria-hidden /> Quién viene hoy</Button>
            <Button variant="outline" className="h-9 gap-2" onClick={() => setHorario(true)}><Clock className="h-4 w-4" aria-hidden /> Disponibilidad</Button>
            <ConectarGoogle />
            <Button className="h-9 gap-2" onClick={() => setNueva(true)}><CalendarPlus className="h-4 w-4" aria-hidden /> Nueva cita</Button>
          </div>
        </div>

        {proxima && (
          <p className="text-sm text-muted-foreground">
            Próxima cita: <button type="button" onClick={() => setAbierta(proxima)} className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
              {new Date(proxima.inicio).toLocaleDateString("es-DO", { weekday: "long" })} {horaCita(proxima.inicio)} · {proxima.cliente ?? proxima.telefono ?? "Cliente"}{proxima.vendedor ? ` con ${proxima.vendedor}` : ""}
            </button>
          </p>
        )}

        {error ? (
          <Card><CardContent className="p-10 text-center"><p className="font-medium">No se pudo cargar el calendario</p></CardContent></Card>
        ) : !citas ? (
          <Skeleton className="h-[30rem] w-full" />
        ) : (
          <>
            {/* Escritorio: semana con horario de los vendedores visibles; fuera de horario queda en gris. */}
            <Card className="hidden overflow-hidden md:block">
              <div className="grid" style={{ gridTemplateColumns: "3.5rem repeat(6, minmax(0, 1fr))" }}>
                <div className="border-b" />
                {dias.map((d) => {
                  const hoy = d.toDateString() === ahora.toDateString()
                  return (
                    <div key={d.toISOString()} className={cn("border-b border-l px-2 py-2 text-center text-xs", hoy && "bg-accent/60")}>
                      <span className="capitalize text-muted-foreground">{d.toLocaleDateString("es-DO", { weekday: "short" })}</span>{" "}
                      <span className={cn("font-semibold", hoy && "text-primary")}>{d.getDate()}</span>
                    </div>
                  )
                })}

                <div className="relative" style={{ height: ALTO }}>
                  {Array.from({ length: HORA_FIN - HORA_INI }, (_, i) => (
                    <span key={i} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: i * 2 * FILA }}>
                      {i === 0 ? "" : new Date(2000, 0, 1, HORA_INI + i).toLocaleTimeString("es-DO", { hour: "numeric" })}
                    </span>
                  ))}
                </div>
                {dias.map((d) => {
                  const turnos = visibles.flatMap((v) => v.horario.filter((t) => t.dia === d.getDay()))
                  const delDia = citas.filter((c) => new Date(c.inicio).toDateString() === d.toDateString())
                  const hoy = d.toDateString() === ahora.toDateString()
                  return (
                    <div key={d.toISOString()} className="relative border-l bg-secondary/60" style={{ height: ALTO }}>
                      {turnos.map((t, i) => (
                        <div key={i} className="absolute inset-x-0 bg-card" style={{ top: y(aMin(t.desde)), height: y(aMin(t.hasta)) - y(aMin(t.desde)) }} />
                      ))}
                      {Array.from({ length: (HORA_FIN - HORA_INI) * 2 }, (_, i) => (
                        <div key={i} className={cn("pointer-events-none absolute inset-x-0 border-t", i % 2 ? "border-dashed border-border/50" : "border-border")} style={{ top: i * FILA }} />
                      ))}
                      {hoy && minDelDia(ahora) >= HORA_INI * 60 && minDelDia(ahora) <= HORA_FIN * 60 && (
                        <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive" style={{ top: y(minDelDia(ahora)) }} aria-hidden />
                      )}
                      {(() => {
                        const pos = carriles(delDia)
                        return delDia.map((c) => (
                          <Bloque key={c.id} cita={c} carril={pos.get(c.id)!.carril} carriles={pos.get(c.id)!.carriles}
                            conVendedor={filtroVendedor === TODOS} onAbrir={() => setAbierta(c)} />
                        ))
                      })()}
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Móvil: lista por día */}
            <div className="space-y-3 md:hidden">
              {dias.map((d) => {
                const delDia = citas.filter((c) => new Date(c.inicio).toDateString() === d.toDateString())
                return (
                  <section key={d.toISOString()}>
                    <h3 className="mb-1.5 text-sm font-semibold first-letter:uppercase">{d.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "short" })}</h3>
                    {delDia.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin citas</p>
                    ) : (
                      <Card className="divide-y overflow-hidden">
                        {delDia.map((c) => {
                          const Icon = TIPO_CITA[c.tipo].icon
                          const e = ESTADO_CITA[c.estado]
                          return (
                            <button key={c.id} type="button" onClick={() => setAbierta(c)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-secondary/60 focus-visible:bg-secondary">
                              <span className="w-14 shrink-0 text-sm font-medium tabular-nums">{horaCita(c.inicio)}</span>
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{c.cliente ?? c.telefono ?? "Cliente"}</span>
                                <span className="block truncate text-xs text-muted-foreground">{c.vendedor}</span>
                              </span>
                              {c.estado !== "programada" && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", e.clase)}>{e.label}</span>}
                            </button>
                          )
                        })}
                      </Card>
                    )}
                  </section>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-l-4 border-primary bg-accent" aria-hidden /> Visita a la tienda</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-l-4 border-warning bg-warning-soft" aria-hidden /> Llamada</span>
              <span className="hidden items-center gap-1.5 md:inline-flex"><span className="h-3 w-3 rounded-sm bg-secondary" aria-hidden /> Fuera de horario</span>
            </div>
          </>
        )}
      </div>

      <CitaFicha cita={abierta} onCerrar={() => setAbierta(null)} onCambio={actualizar} />
      <QuienVieneHoy abierta={hoy} onCerrar={() => setHoy(false)} />
      <NuevaCita
        abierta={nueva}
        vendedores={vendedores}
        vendedorInicial={filtroVendedor === TODOS ? miId : filtroVendedor}
        onCerrar={() => setNueva(false)}
        onCreada={(c) => {
          setNueva(false)
          setCitas((prev) => (prev ? [...prev, c].sort((a, b) => a.inicio.localeCompare(b.inicio)) : prev))
          setLunes(lunesDe(new Date(c.inicio)))
        }}
      />
      <Horario
        abierta={horario}
        vendedores={vendedores}
        vendedorInicial={filtroVendedor === TODOS ? miId : filtroVendedor}
        onCerrar={() => setHorario(false)}
        onGuardado={(v) => { setVendedores((prev) => prev.map((x) => (x.id === v.id ? v : x))); setHorario(false) }}
      />
    </AdminLayout>
  )
}
