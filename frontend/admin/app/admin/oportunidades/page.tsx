"use client"

import { useEffect, useMemo, useState } from "react"
import { Columns3, List, Search, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdmin } from "@/contexts/admin-context"
import { DIA, duracion, EQUIPO, NOMBRE_ORIGEN, NOMBRE_SUCURSAL, RAMOS, rdCorto, SUCURSALES } from "@/lib/seguros/catalogo"
import { useSeguros } from "@/lib/seguros/cliente"
import type { Cliente, Origen, Ramo, Segmento, Sucursal } from "@/lib/seguros/tipos"
import { Encabezado, Filtro, Indicador } from "@/components/seguros/comun"
import { ListaOportunidades } from "@/components/seguros/oportunidades/lista"
import { Tablero } from "@/components/seguros/oportunidades/tablero"
import { abierta, mediana, primaPotencial, VENTANA_LISTA } from "@/components/seguros/oportunidades/util"
import { cn } from "@/lib/utils"

const TODOS = "todos"
const EJECUTIVOS = EQUIPO.filter((p) => p.area === "comercial_personas" || p.area === "comercial_empresas")

function Selector({ valor, onChange, etiqueta, opciones }: { valor: string; onChange: (v: string) => void; etiqueta: string; opciones: { id: string; nombre: string }[] }) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger aria-label={etiqueta} className={cn("h-9 w-full text-xs sm:w-auto sm:min-w-[9.5rem]", valor !== TODOS && "border-primary/60 text-primary")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{etiqueta}: todos</SelectItem>
        {opciones.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function OportunidadesPage() {
  const { estado, ahora } = useSeguros()
  const { user } = useAdmin()
  const yo = user as { id?: string | number; role?: string } | null
  const [vista, setVista] = useState<"tablero" | "lista">("tablero")
  const [q, setQ] = useState("")
  const [ramo, setRamo] = useState(TODOS)
  const [segmento, setSegmento] = useState<Segmento | typeof TODOS>(TODOS)
  const [ejecutivo, setEjecutivo] = useState(TODOS)
  const [sucursal, setSucursal] = useState(TODOS)
  const [origen, setOrigen] = useState(TODOS)

  useEffect(() => {
    if (yo?.role === "ejecutivo" && yo.id && EJECUTIVOS.some((p) => p.id === String(yo.id))) setEjecutivo(String(yo.id))
  }, [yo?.role, yo?.id])

  const clientes = useMemo(() => new Map<string, Cliente>((estado?.clientes ?? []).map((c) => [c.id, c])), [estado?.clientes])

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (estado?.oportunidades ?? []).filter(
      (o) =>
        (ramo === TODOS || o.ramo === (ramo as Ramo)) &&
        (segmento === TODOS || o.segmento === segmento) &&
        (ejecutivo === TODOS || (ejecutivo === "sin" ? !o.ejecutivoId : o.ejecutivoId === ejecutivo)) &&
        (sucursal === TODOS || o.sucursal === (sucursal as Sucursal)) &&
        (origen === TODOS || o.origen === (origen as Origen)) &&
        (!t || o.codigo.toLowerCase().includes(t) || (clientes.get(o.clienteId)?.nombre ?? "").toLowerCase().includes(t)),
    )
  }, [estado?.oportunidades, clientes, q, ramo, segmento, ejecutivo, sucursal, origen])

  const kpi = useMemo(() => {
    const abiertas = filtradas.filter((o) => abierta(o.etapa))
    const sinAsignar = abiertas.filter((o) => !o.ejecutivoId).length
    const conPrima = abiertas.filter((o) => o.cotizaciones.length)
    const potencial = conPrima.reduce((s, o) => s + primaPotencial(o), 0)
    const recientes = filtradas.filter((o) => o.creada >= ahora - 30 * DIA && o.primerContacto)
    const resp = mediana(recientes.map((o) => (o.primerContacto! - o.creada) / 1000))
    const ganadas = filtradas.filter((o) => o.etapa === "ganada").length
    const perdidas = filtradas.filter((o) => o.etapa === "perdida").length
    const tasa = ganadas + perdidas ? Math.round((ganadas / (ganadas + perdidas)) * 100) : null
    return { abiertas: abiertas.length, sinAsignar, potencial, conPrima: conPrima.length, resp, recientes: recientes.length, tasa, ganadas, perdidas }
  }, [filtradas, ahora])

  const filtros = [ramo, segmento, ejecutivo, sucursal, origen].filter((v) => v !== TODOS).length + (q ? 1 : 0)
  const limpiar = () => {
    setQ("")
    setRamo(TODOS)
    setSegmento(TODOS)
    setEjecutivo(TODOS)
    setSucursal(TODOS)
    setOrigen(TODOS)
  }

  const enTablero = filtradas.filter((o) => abierta(o.etapa))
  const enLista = filtradas.filter((o) => abierta(o.etapa) || o.creada >= ahora - VENTANA_LISTA)

  return (
    <AdminLayout title="Oportunidades">
      <div className="flex min-w-0 flex-col gap-6">
        <Encabezado
          titulo="Oportunidades"
          detalle="Cada solicitud que entra por WhatsApp, el sitio, Instagram o el equipo, desde que llega hasta que se emite la póliza."
          acciones={
            <div className="inline-flex rounded-lg border bg-card p-1" role="tablist" aria-label="Vista">
              {(
                [
                  ["tablero", "Tablero", Columns3],
                  ["lista", "Lista", List],
                ] as const
              ).map(([id, nombre, I]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={vista === id}
                  onClick={() => setVista(id)}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors", vista === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <I className="h-3.5 w-3.5" aria-hidden />
                  {nombre}
                </button>
              ))}
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {estado ? (
            <>
              <Indicador etiqueta="Abiertas" valor={kpi.abiertas} detalle="En el embudo ahora" />
              <Indicador etiqueta="Nuevas sin asignar" valor={kpi.sinAsignar} tono={kpi.sinAsignar ? "alerta" : "bien"} detalle={kpi.sinAsignar ? "Esperan ejecutivo" : "Todas tienen dueño"} />
              <Indicador etiqueta="Prima potencial" valor={rdCorto(kpi.potencial)} detalle={`${kpi.conPrima} con primas cargadas`} />
              <Indicador etiqueta="Primera respuesta" valor={kpi.resp === null ? "—" : duracion(kpi.resp)} tono={kpi.resp !== null && kpi.resp < 120 ? "bien" : undefined} detalle={`Mediana de ${kpi.recientes} en 30 días`} />
              <div className="col-span-2 lg:col-span-1">
                <Indicador etiqueta="Tasa de cierre" valor={kpi.tasa === null ? "—" : `${kpi.tasa} %`} detalle={`${kpi.ganadas} emitidas y ${kpi.perdidas} perdidas en 120 días`} />
              </div>
            </>
          ) : (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className={cn("h-[104px] rounded-xl", i === 4 && "col-span-2 lg:col-span-1")} />)
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente o código" className="h-9 pl-9 text-sm" aria-label="Buscar por cliente o código" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Filtro activo={segmento === TODOS} onClick={() => setSegmento(TODOS)}>
                Todos
              </Filtro>
              <Filtro activo={segmento === "persona"} onClick={() => setSegmento("persona")}>
                Personas
              </Filtro>
              <Filtro activo={segmento === "empresa"} onClick={() => setSegmento("empresa")}>
                Empresas
              </Filtro>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Selector valor={ramo} onChange={setRamo} etiqueta="Ramo" opciones={RAMOS.filter((r) => segmento === TODOS || r.segmento === segmento).map((r) => ({ id: r.id, nombre: r.nombre }))} />
            <Selector valor={ejecutivo} onChange={setEjecutivo} etiqueta="Ejecutivo" opciones={[{ id: "sin", nombre: "Sin asignar" }, ...EJECUTIVOS.map((p) => ({ id: p.id, nombre: p.nombre }))]} />
            <Selector valor={sucursal} onChange={setSucursal} etiqueta="Sucursal" opciones={SUCURSALES} />
            <Selector valor={origen} onChange={setOrigen} etiqueta="Origen" opciones={Object.entries(NOMBRE_ORIGEN).map(([id, nombre]) => ({ id, nombre }))} />
            {filtros > 0 && (
              <button onClick={limpiar} className="col-span-2 inline-flex h-9 items-center justify-center gap-1 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground sm:col-span-1">
                <X className="h-3.5 w-3.5" aria-hidden />
                Limpiar {filtros === 1 ? "filtro" : `${filtros} filtros`}
              </button>
            )}
          </div>
        </div>

        {!estado ? (
          <div className="grid gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : vista === "tablero" ? (
          <Tablero lista={enTablero} clientes={clientes} ahora={ahora} />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {enLista.length} oportunidades: las abiertas y las cerradas de los últimos 120 días{sucursal !== TODOS ? ` en ${NOMBRE_SUCURSAL[sucursal as Sucursal]}` : ""}.
            </p>
            <ListaOportunidades lista={enLista} clientes={clientes} ahora={ahora} />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
