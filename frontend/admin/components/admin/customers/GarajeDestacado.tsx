"use client"

import { useEffect, useMemo, useState } from "react"
import { BadgeCheck, ChevronDown, CircleAlert, History, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { FotoVehiculo, fotoDelCliente } from "@/components/admin/vehiculos/FotoVehiculo"
import { LoQuePidio, TIPOS_PEDIDO } from "@/components/admin/customers/FichaVehiculoCliente"
import {
  ESTADOS_VEHICULO, perfilApi, vehiculoTexto, type ArchivoCliente, type EstadoVehiculo, type EventoCliente, type PiezaDelVehiculo, type PiezasDelVehiculo,
  type VehiculoPerfil,
} from "@/lib/api/perfil"
import { cn, formatCurrency, nombrePieza } from "@/lib/utils"
import { fuenteTexto } from "@/components/chat/caso"

const TODOS = "todos"
const fotoPieza = (p: PiezaDelVehiculo) => (p.imagen ? `/colt/${p.imagen.replace(/^\/?(assets\/colt\/)?/, "")}` : null)

function TarjetaPieza({ p }: { p: PiezaDelVehiculo }) {
  const foto = fotoPieza(p)
  const original = p.calidad === "original" || p.calidad === "oem" || /original/i.test(p.etiqueta_calidad ?? "")
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3", p.pedida && "ring-1 ring-primary/40")} data-pieza={p.id}>
      <div className="flex gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary text-[10px] text-muted-foreground">
          {foto ? <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" /> : "Sin foto"}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-medium leading-snug">{nombrePieza(p.nombre)}</span>
          <span className="block truncate text-xs text-muted-foreground">{[p.oem, p.sku].filter(Boolean).join(" · ")}</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", original ? "bg-success-soft text-success" : "bg-secondary")}>
          {p.etiqueta_calidad ?? (original ? "Original" : "Alterna")}
        </span>
        <span className="text-base font-semibold tabular-nums">{formatCurrency(p.precio_dop)}</span>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        {p.existencias.length ? p.existencias.map((x) => (
          <span key={x.sucursal_id} className={cn("inline-flex items-center gap-1", x.disponible > 0 ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", x.disponible > 0 ? "bg-success" : "bg-border")} aria-hidden />{x.sucursal} {x.disponible}
          </span>
        )) : <span className="text-muted-foreground">{p.disponible ? "Disponible" : "Sin existencia"}</span>}
      </p>
      {(p.pedida || p.depende_del_motor) && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {p.pedida && <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">{p.pedida === "vista" ? "La vio" : p.pedida.charAt(0).toUpperCase() + p.pedida.slice(1)}</span>}
          {p.depende_del_motor && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">Depende del motor</span>}
        </div>
      )}
    </li>
  )
}

export function GarajeDestacado({ clienteId, vehiculos, archivos, editable, onEstado, onHistorial }: {
  clienteId: string
  vehiculos: VehiculoPerfil[]
  archivos?: ArchivoCliente[] | null
  editable: boolean
  onEstado: (v: VehiculoPerfil, estado: EstadoVehiculo) => void
  onHistorial: (v: VehiculoPerfil) => void
}) {
  const ordenados = useMemo(() => [...vehiculos].sort((a, b) => Number((b.estado ?? "activo") === "activo") - Number((a.estado ?? "activo") === "activo")), [vehiculos])
  const [elegido, setElegido] = useState<string | null>(ordenados[0]?.id ?? null)
  const [vista, setVista] = useState<"piezas" | "pidio">("piezas")
  const [sistema, setSistema] = useState(TODOS)
  const [piezas, setPiezas] = useState<PiezasDelVehiculo | null>(null)
  const [eventos, setEventos] = useState<EventoCliente[] | null>(null)
  const [error, setError] = useState(false)
  const [abierto, setAbierto] = useState(false)
  useEffect(() => { try { setAbierto(localStorage.getItem("garaje-piezas") === "1") } catch {} }, [])
  const alternar = () => setAbierto((x) => { try { localStorage.setItem("garaje-piezas", x ? "0" : "1") } catch {} return !x })
  const v = ordenados.find((x) => x.id === elegido) ?? ordenados[0]

  useEffect(() => {
    if (!v?.id) return
    let vigente = true
    setPiezas(null); setEventos(null); setError(false); setSistema(TODOS)
    perfilApi.piezasDelVehiculo(clienteId, v.id).then((p) => { if (vigente) setPiezas(p) }).catch(() => { if (vigente) setError(true) })
    perfilApi.eventos(clienteId, { vehiculo_id: v.id, tipo: TIPOS_PEDIDO.join(","), limite: 200 })
      .then((e) => { if (vigente) setEventos(e) }).catch(() => { if (vigente) setEventos([]) })
    return () => { vigente = false }
  }, [clienteId, v?.id])

  if (!v) {
    return (
      <section className="rounded-xl border border-dashed bg-card p-6 text-center">
        <p className="font-medium">Sin vehículos todavía</p>
        <p className="mt-1 text-sm text-muted-foreground">Se agregan solos cuando el cliente dice marca, modelo y año, o manda el chasis.</p>
      </section>
    )
  }

  const activo = (v.estado ?? "activo") === "activo"
  const lista = piezas?.sistemas.flatMap((s) => (sistema === TODOS || s.clave === sistema ? s.piezas : [])) ?? []
  const identificacion = v.vin || v.chasis

  return (
    <section className="space-y-4" aria-label="Garaje del cliente" data-testid="ficha-carro">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-base font-semibold">Garaje</h2>
        {ordenados.map((x) => (
          <button key={x.id} type="button" onClick={() => { setElegido(x.id); setVista("piezas") }} aria-pressed={x.id === v.id}
            aria-label={`Ver la ficha de ${vehiculoTexto(x)}`}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              x.id === v.id ? "bg-foreground text-background" : "bg-secondary hover:bg-secondary/70",
              (x.estado ?? "activo") !== "activo" && "opacity-60")}>
            {x.modelo} {x.anio ?? ""}
          </button>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground" title="La IA los agrega cuando el cliente los menciona">
          <Plus className="h-3 w-3" aria-hidden /> Se agregan desde la conversación
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(120deg,#151a22_0%,#2a3442_55%,#3b4859_100%)] text-white shadow-sm">
        <span className="pointer-events-none absolute -bottom-6 right-4 select-none font-display text-[110px] font-bold leading-none text-white/[0.07]" aria-hidden>{v.anio}</span>
        <div className="grid items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:p-6">
          <div className="min-w-0 space-y-2">
            <h3 className="font-display text-3xl font-bold leading-none sm:text-4xl">
              <span className="mb-2 block font-sans text-sm font-normal text-white/70">{v.marca}{" "}</span>{v.modelo}{v.anio ? ` ${v.anio}` : ""}
            </h3>
            <p className="text-sm text-white/85">{[v.motor, v.version].filter(Boolean).join(" · ") || "Motor sin confirmar"}</p>
            <p className="font-mono text-sm text-white/80">{identificacion || "Chasis pendiente"}</p>
            <p className={cn("inline-flex items-center gap-1.5 text-xs", v.verificado ? "text-emerald-300" : "text-amber-300")}>
              {v.verificado ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> : <CircleAlert className="h-3.5 w-3.5" aria-hidden />}
              {v.verificado ? `Verificado${fuenteTexto(v.fuente_identificacion) ? ` · ${fuenteTexto(v.fuente_identificacion)}` : ""}` : `Sin verificar${fuenteTexto(v.fuente_identificacion) ? ` · ${fuenteTexto(v.fuente_identificacion)}` : ""}`}
              {v.kilometraje != null && <span className="text-white/70"> · {v.kilometraje.toLocaleString("es-DO")} km</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Select value={v.estado ?? "activo"} onValueChange={(e) => onEstado(v, e as EstadoVehiculo)} disabled={!editable}>
                <SelectTrigger className="h-8 w-40 border-white/20 bg-white/10 text-xs text-white" aria-label={`Estado de ${v.modelo}`}><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS_VEHICULO.map((e) => <SelectItem key={e.valor} value={e.valor}>{e.texto}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-white hover:bg-white/10 hover:text-white" onClick={() => onHistorial(v)}>
                <History className="h-3.5 w-3.5" aria-hidden /> Historial
              </Button>
              {!activo && <span className="text-xs text-amber-300">La IA no usa este vehículo</span>}
            </div>
          </div>
          <FotoVehiculo vehiculo={v} propia={fotoDelCliente(archivos, v.id)} credito className="aspect-[16/10] w-full rounded-lg ring-1 ring-white/10" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <button type="button" onClick={alternar} aria-expanded={abierto}
          className="-m-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-control p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !abierto && "-rotate-90")} aria-hidden />
          <span className="font-semibold">Piezas y pedidos de la {v.modelo}</span>
          <span className="truncate text-sm text-muted-foreground">
            {piezas ? `${piezas.total} le sirven${piezas.pedidas ? ` · ${piezas.pedidas} ya las pidió` : ""}` : "Cargando"}{eventos ? ` · ${eventos.length} pedidos` : ""}
          </span>
        </button>
        {abierto && (<>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-control bg-secondary p-1" role="tablist" aria-label="Del vehículo">
            {([["piezas", `Piezas que le sirven${piezas ? ` (${piezas.total})` : ""}`], ["pidio", `Lo que pidió${eventos ? ` (${eventos.length})` : ""}`]] as const).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={vista === k} type="button" onClick={() => setVista(k)}
                className={cn("rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-sm font-medium", vista === k ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {t}
              </button>
            ))}
          </div>
          {vista === "piezas" && piezas && piezas.sistemas.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {[{ clave: TODOS, nombre: "Todos" }, ...piezas.sistemas].map((s) => (
                <button key={s.clave} type="button" onClick={() => setSistema(s.clave)}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium", sistema === s.clave ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70")}>
                  {s.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4">
          {vista === "pidio" ? <LoQuePidio eventos={eventos} /> : error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No se pudieron cargar las piezas de este vehículo.</p>
          ) : !piezas ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
          ) : piezas.total === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">El catálogo no tiene piezas para este vehículo.</p>
          ) : (
            <>
              {piezas.aviso && <p role="note" className="mb-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">{piezas.aviso}</p>}
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lista.map((p) => <TarjetaPieza key={p.id} p={p} />)}</ul>
            </>
          )}
        </div>
        </>)}
      </div>
    </section>
  )
}
