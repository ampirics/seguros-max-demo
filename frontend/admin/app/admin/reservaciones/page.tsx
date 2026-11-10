"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock, ListOrdered, Plus, UserCheck, Users } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgendaDia } from "@/components/restaurante/reservas/Agenda"
import {
  CanalChip,
  DialogoNuevaReserva,
  ESTADO_RESERVA,
  EstadoReservaChip,
  recordatorioSinRespuesta,
  Seguimiento,
} from "@/components/restaurante/reservas/comun"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { diaLargo, fechaLocal, hora12, NOMBRE_CANAL, NOMBRE_ZONA, sumarDias, tsLocal } from "@/lib/restaurante/local"
import type { Canal, Cliente, EstadoReserva, Reserva } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const orden = (a: Reserva, b: Reserva) => {
  const m = (h: string) => (Number(h.slice(0, 2)) < 6 ? "2" : "1") + h
  return m(a.hora).localeCompare(m(b.hora))
}

export default function ReservacionesPage() {
  const { estado, ahora } = useRestaurante()
  const hoy = fechaLocal(ahora)
  const [fecha, setFecha] = useState<string | null>(null)
  const dia = fecha ?? hoy
  const [pasadas, setPasadas] = useState<Reserva[] | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string>("todas")
  const [filtroCanal, setFiltroCanal] = useState<string>("todos")
  const [nueva, setNueva] = useState(false)

  useEffect(() => {
    if (dia >= hoy) return setPasadas(null)
    let vivo = true
    setPasadas(null)
    restauranteApi.reservas(dia, dia).then((l) => vivo && setPasadas(l)).catch((e) => toast.error(e.message))
    return () => {
      vivo = false
    }
  }, [dia, hoy])

  const delDia = useMemo(() => {
    if (!estado) return []
    const base = dia < hoy ? pasadas ?? [] : estado.reservas.filter((r) => r.fecha === dia)
    return base.slice().sort(orden)
  }, [estado, pasadas, dia, hoy])

  const filtradas = delDia.filter(
    (r) =>
      (filtroEstado === "todas" ||
        (filtroEstado === "activas" ? ["solicitada", "confirmada", "recordada", "asistencia_confirmada", "sentada"].includes(r.estado) : r.estado === filtroEstado)) &&
      (filtroCanal === "todos" || r.canal === filtroCanal),
  )

  if (!estado) {
    return (
      <AdminLayout title="Reservas">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    )
  }

  const cuenta = (f: (r: Reserva) => boolean) => delDia.filter(f).length
  const vigentes = delDia.filter((r) => !["cancelada", "no_show", "lista_espera"].includes(r.estado))
  const indicadores = [
    { t: "Reservas", v: vigentes.length, s: `${delDia.length} en total`, icono: CalendarDays },
    { t: "Personas esperadas", v: vigentes.reduce((s, r) => s + r.personas, 0), s: "Sin contar canceladas", icono: Users },
    { t: "Confirmaron asistencia", v: cuenta((r) => r.estado === "asistencia_confirmada" || r.estado === "sentada" || r.estado === "completada"), s: "Respondieron o ya llegaron", icono: UserCheck },
    { t: "Por confirmar", v: cuenta((r) => r.estado === "solicitada"), s: "Esperan respuesta del equipo", icono: Clock, alerta: cuenta((r) => r.estado === "solicitada") > 0 },
    { t: "Recordatorio sin respuesta", v: cuenta(recordatorioSinRespuesta), s: "Riesgo de no presentarse", icono: Bell, alerta: cuenta(recordatorioSinRespuesta) > 0 },
    { t: "Lista de espera", v: cuenta((r) => r.estado === "lista_espera"), s: "Sin mesa todavía", icono: ListOrdered },
    { t: "No se presentaron", v: cuenta((r) => r.estado === "no_show"), s: `${cuenta((r) => r.estado === "cancelada")} canceladas`, icono: CalendarDays },
  ]

  const porConfirmar = delDia.filter((r) => r.estado === "solicitada")
  const sinRespuesta = delDia.filter(recordatorioSinRespuesta)
  const sinRecordatorio = delDia.filter((r) => r.estado === "confirmada" && !r.avisos.some((a) => a.tipo === "recordatorio") && tsLocal(r.fecha, r.hora) > ahora)
  const espera = delDia.filter((r) => r.estado === "lista_espera")

  const accion = async (f: () => Promise<unknown>, ok: string) => {
    try {
      await f()
      toast.success(ok)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <AdminLayout title="Reservas">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">Agenda por hora y por zona</p>
            <h1 className="font-display text-3xl font-semibold first-letter:uppercase sm:text-4xl">{dia === hoy ? "Hoy, " : ""}{diaLargo(dia)}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-control border bg-card">
              <Button variant="ghost" size="icon" aria-label="Día anterior" onClick={() => setFecha(sumarDias(dia, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input type="date" aria-label="Fecha" value={dia} onChange={(e) => e.target.value && setFecha(e.target.value)} className="h-9 w-[9.5rem] border-0 shadow-none focus-visible:ring-0" />
              <Button variant="ghost" size="icon" aria-label="Día siguiente" onClick={() => setFecha(sumarDias(dia, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {dia !== hoy && (
              <Button variant="outline" onClick={() => setFecha(null)}>
                Hoy
              </Button>
            )}
            <Button onClick={() => setNueva(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Nueva reserva
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {indicadores.map((x) => (
            <div key={x.t} className={cn("rounded-lg border bg-card px-4 py-3", x.alerta && "border-warning/40 bg-warning-soft")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{x.t}</span>
                <x.icono className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{x.v}</div>
              <div className="truncate text-[11px] text-muted-foreground">{x.s}</div>
            </div>
          ))}
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Tabs defaultValue="agenda" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="agenda">Agenda</TabsTrigger>
                <TabsTrigger value="lista">Lista</TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap gap-2">
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="h-9 w-[12rem]" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos los estados</SelectItem>
                    <SelectItem value="activas">Activas</SelectItem>
                    {(Object.keys(ESTADO_RESERVA) as EstadoReserva[]).map((e) => (
                      <SelectItem key={e} value={e}>{ESTADO_RESERVA[e].nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                  <SelectTrigger className="h-9 w-[11rem]" aria-label="Filtrar por canal"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los canales</SelectItem>
                    {(Object.keys(NOMBRE_CANAL) as Canal[]).map((c) => (
                      <SelectItem key={c} value={c}>{NOMBRE_CANAL[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {dia < hoy && !pasadas ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <>
                <TabsContent value="agenda" className="mt-0">
                  <AgendaDia reservas={filtradas} mesas={estado.mesas} clientes={estado.clientes} esHoy={dia === hoy} ahora={ahora} />
                  <Leyenda />
                </TabsContent>
                <TabsContent value="lista" className="mt-0">
                  <ListaReservas reservas={filtradas} clientes={estado.clientes} accion={accion} />
                </TabsContent>
              </>
            )}
          </Tabs>

          <aside className="flex min-w-0 flex-col gap-4">
            <Panel titulo="Confirmaciones y recordatorios" detalle={dia === hoy ? "Lo que falta para que nadie se quede sin mesa ni deje una vacía." : "Seguimiento de las reservas de este día."}>
              {porConfirmar.length + sinRespuesta.length + sinRecordatorio.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Todo al día: no hay reservas pendientes de confirmar ni recordatorios sin respuesta.</p>
              ) : (
                <ul className="divide-y">
                  {porConfirmar.map((r) => (
                    <FilaPendiente key={r.id} r={r} motivo="Falta confirmar al cliente">
                      <Button size="sm" onClick={() => accion(() => restauranteApi.accion({ tipo: "reservaEstado", reservaId: r.id, estado: "confirmada" }), `Reserva ${r.codigo} confirmada`)}>Confirmar</Button>
                    </FilaPendiente>
                  ))}
                  {sinRespuesta.map((r) => (
                    <FilaPendiente key={r.id} r={r} motivo="Recordatorio enviado, no ha respondido">
                      <Button size="sm" variant="outline" onClick={() => accion(() => restauranteApi.accion({ tipo: "recordatorio", reservaId: r.id }), "Recordatorio reenviado")}>Reenviar</Button>
                    </FilaPendiente>
                  ))}
                  {sinRecordatorio.map((r) => (
                    <FilaPendiente key={r.id} r={r} motivo="Confirmada, sin recordatorio todavía">
                      <Button size="sm" variant="outline" onClick={() => accion(() => restauranteApi.accion({ tipo: "recordatorio", reservaId: r.id }), "Recordatorio enviado")}>
                        <Bell className="h-3.5 w-3.5" aria-hidden /> Recordar
                      </Button>
                    </FilaPendiente>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel titulo="Lista de espera" detalle="Se asignan solas cuando se libera una mesa por cancelación o no-show.">
              {espera.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Nadie en espera para este día.</p>
              ) : (
                <ul className="divide-y">
                  {espera.map((r) => (
                    <FilaPendiente key={r.id} r={r} motivo={`${NOMBRE_ZONA[r.zona]} · esperando mesa`}>
                      <Button size="sm" variant="outline" onClick={() => accion(() => restauranteApi.accion({ tipo: "reservaEstado", reservaId: r.id, estado: "confirmada" }), "Mesa asignada y cliente avisado")}>Asignar mesa</Button>
                    </FilaPendiente>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel titulo="Por canal" detalle="De dónde vienen las reservas de este día.">
              <ul className="flex flex-col gap-2 py-1">
                {(Object.keys(NOMBRE_CANAL) as Canal[])
                  .map((c) => ({ c, n: delDia.filter((r) => r.canal === c).length }))
                  .filter((x) => x.n)
                  .sort((a, b) => b.n - a.n)
                  .map(({ c, n }) => (
                    <li key={c} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0"><CanalChip canal={c} /></span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / Math.max(1, delDia.length)) * 100}%` }} />
                      </span>
                      <span className="w-6 text-right tabular-nums">{n}</span>
                    </li>
                  ))}
                {delDia.length === 0 && <li className="text-sm text-muted-foreground">Sin reservas.</li>}
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
      <DialogoNuevaReserva abierto={nueva} onCerrar={() => setNueva(false)} fechaInicial={dia < hoy ? hoy : dia} onCreada={(r) => setFecha(r.fecha)} />
    </AdminLayout>
  )
}

function Panel({ titulo, detalle, children }: { titulo: string; detalle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card px-4 py-3">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mb-1 text-xs text-muted-foreground">{detalle}</p>
      {children}
    </section>
  )
}

function FilaPendiente({ r, motivo, children }: { r: Reserva; motivo: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <Link href={`/admin/reservaciones/${r.id}`} className="min-w-0 hover:underline">
        <span className="block truncate text-sm font-medium">{hora12(r.hora)} · {r.nombre}</span>
        <span className="block truncate text-xs text-muted-foreground">{r.personas} personas · {motivo}</span>
      </Link>
      <div className="shrink-0">{children}</div>
    </li>
  )
}

function Leyenda() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {(Object.keys(ESTADO_RESERVA) as EstadoReserva[]).map((e) => (
        <span key={e} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ESTADO_RESERVA[e].punto }} aria-hidden />
          {ESTADO_RESERVA[e].nombre}
        </span>
      ))}
    </div>
  )
}

function ListaReservas({ reservas, clientes, accion }: { reservas: Reserva[]; clientes: Cliente[]; accion: (f: () => Promise<unknown>, ok: string) => void }) {
  if (!reservas.length) return <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No hay reservas con estos filtros.</div>
  return (
    <ul className="flex flex-col gap-2">
      {reservas.map((r) => {
        const c = clientes.find((x) => x.id === r.clienteId)
        const activa = ["solicitada", "confirmada", "recordada", "asistencia_confirmada"].includes(r.estado)
        return (
          <li key={r.id} className="rounded-xl border bg-card px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link href={`/admin/reservaciones/${r.id}`} className="min-w-0 flex-1 hover:underline">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-base font-semibold tabular-nums">{hora12(r.hora)}</span>
                  <span className="font-medium">{r.nombre}</span>
                  <EstadoReservaChip estado={r.estado} />
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {r.personas} personas · {NOMBRE_ZONA[r.zona]}{r.mesaId ? `, mesa ${r.mesaId}` : ", sin mesa"} · {r.codigo}
                </div>
              </Link>
              <div className="flex flex-wrap gap-2">
                {r.estado === "solicitada" && (
                  <Button size="sm" onClick={() => accion(() => restauranteApi.accion({ tipo: "reservaEstado", reservaId: r.id, estado: "confirmada" }), "Confirmada")}>Confirmar</Button>
                )}
                {r.estado === "confirmada" && (
                  <Button size="sm" variant="outline" onClick={() => accion(() => restauranteApi.accion({ tipo: "recordatorio", reservaId: r.id }), "Recordatorio enviado")}>Recordar</Button>
                )}
                {activa && r.mesaId && (
                  <Button size="sm" variant="outline" onClick={() => accion(() => restauranteApi.accion({ tipo: "reservaEstado", reservaId: r.id, estado: "sentada" }), "Mesa abierta en el salón")}>Llegó</Button>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <CanalChip canal={r.canal} />
              <Seguimiento r={r} />
              {r.ocasion && <span className="rounded-full bg-[#E8866A]/15 px-2 py-0.5 text-[11px] font-medium text-[#B5532F] dark:text-[#F0A48A]">{r.ocasion}</span>}
              {c?.alergias?.length ? <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[11px] font-medium text-destructive">Alergia: {c.alergias.join(", ")}</span> : null}
            </div>
            {r.notas && <p className="mt-1.5 text-sm text-muted-foreground">{r.notas}</p>}
          </li>
        )
      })}
    </ul>
  )
}
