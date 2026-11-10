"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle, Bell, CalendarDays, Car, CreditCard, Download, Eye, FileText, History, Image as ImageIcon, Loader2,
  ChevronDown, ChevronRight, MessageSquare, Mic, PackageCheck, Percent, RefreshCw, SearchX, ShoppingBag, Sparkles, Undo2, type LucideIcon,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EstadoCotizacion } from "@/components/admin/cotizaciones/EstadoCotizacion"
import { cotizacionesApi } from "@/lib/api/cotizaciones"
import {
  ESTADOS_VEHICULO, vehiculoTexto, type ArchivoCliente, type EstadoVehiculo, type EventoCliente, type Nivel,
  type PerfilDelCliente, type ResumenCliente, type TipoEvento, type VehiculoPerfil,
} from "@/lib/api/perfil"
import { cn, formatCurrency } from "@/lib/utils"
import { DatosDelVehiculo } from "@/components/chat/FichaVehiculo"
import { FichaVehiculoCliente } from "@/components/admin/customers/FichaVehiculoCliente"

export const fecha = (iso: string | null | undefined, conHora = false) =>
  iso ? new Date(iso).toLocaleString("es-DO", {
    day: "numeric", month: "short", year: "numeric", ...(conHora ? { hour: "numeric", minute: "2-digit" } : {}),
  }) : "—"

export const hace = (iso: string | null | undefined) => {
  if (!iso) return "—"
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return "hoy"
  if (dias === 1) return "ayer"
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : `hace ${Math.floor(meses / 12)} años`
}

export const NIVEL_CLASE: Record<Nivel, string> = {
  alto: "bg-success-soft text-success",
  medio: "bg-warning-soft text-warning",
  bajo: "bg-secondary text-muted-foreground",
}

export const RIESGO_CLASE: Record<Nivel, string> = {
  alto: "bg-destructive-soft text-destructive",
  medio: "bg-warning-soft text-warning",
  bajo: "bg-success-soft text-success",
}

export function Panel({ titulo, detalle, accion, children, className, id, plegable }: {
  titulo: string
  detalle?: string
  accion?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
  plegable?: "abierto" | "cerrado"
}) {
  const clave = `perfil-panel-${titulo}`
  const [abierto, setAbierto] = useState(plegable !== "cerrado")
  useEffect(() => { if (!plegable) return; try { const v = localStorage.getItem(clave); if (v) setAbierto(v === "1") } catch {} }, [clave, plegable])
  const alternar = () => setAbierto((v) => { try { localStorage.setItem(clave, v ? "0" : "1") } catch {} return !v })
  const tituloId = id ? `${id}-titulo` : undefined
  return (
    <section id={id} className={cn("rounded-lg border bg-card p-4 sm:p-5", className)} aria-labelledby={tituloId}>
      <div className="flex items-start justify-between gap-3">
        {plegable ? (
          <button type="button" onClick={alternar} aria-expanded={abierto}
            className="-m-1 flex min-w-0 flex-1 items-start gap-2 rounded-control p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", !abierto && "-rotate-90")} aria-hidden />
            <span className="min-w-0">
              <h2 id={tituloId} className="text-base font-semibold">{titulo}</h2>
              {detalle && <p className="mt-0.5 text-sm text-muted-foreground">{detalle}</p>}
            </span>
          </button>
        ) : (
          <div className="min-w-0">
            <h2 id={tituloId} className="text-base font-semibold">{titulo}</h2>
            {detalle && <p className="mt-0.5 text-sm text-muted-foreground">{detalle}</p>}
          </div>
        )}
        {abierto && accion}
      </div>
      {abierto && <div className="mt-4">{children}</div>}
    </section>
  )
}

export function Resumen({ resumen, cargando, onRefrescar }: { resumen: ResumenCliente | null; cargando: boolean; onRefrescar: () => void }) {
  const lineas = (resumen?.lineas ?? []).map((l) => l.replace(/^-\s*/, ""))
  const paso = lineas.find((l) => /^pr[oó]ximo paso/i.test(l))
  const resto = lineas.filter((l) => l !== paso)
  return (
    <Panel plegable="abierto" titulo="Resumen y próximos pasos" detalle={resumen ? `${resumen.fuente === "ia" ? "Redactado por el copiloto" : "Armado con los datos del cliente"}${resumen.fecha ? ` · ${hace(resumen.fecha)}` : ""}` : "Lo esencial del cliente antes de atenderlo."}
      accion={<Button size="sm" variant="outline" className="gap-1.5" onClick={onRefrescar} disabled={cargando}>
        {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />} Actualizar
      </Button>}>
      {!resumen ? (
        <div className="space-y-2" aria-busy="true"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1.5 text-sm">
            {resto.map((l) => {
              const [k, ...v] = l.split(":")
              return (
                <li key={l} className="flex gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <span>{v.length ? <><span className="font-medium">{k}:</span>{v.join(":")}</> : l}</span>
                </li>
              )
            })}
          </ul>
          {paso && (
            <p className="rounded-control border-l-2 border-primary bg-accent/50 px-3 py-2 text-sm">
              <span className="font-medium">Próximo paso:</span>{paso.replace(/^pr[oó]ximo paso:?/i, "")}
            </p>
          )}
        </div>
      )}
    </Panel>
  )
}

const TIPO_EVENTO: Record<TipoEvento, { icono: LucideIcon; clase: string }> = {
  mensajes: { icono: MessageSquare, clase: "bg-secondary text-foreground" },
  nota_de_voz: { icono: Mic, clase: "bg-secondary text-foreground" },
  archivo: { icono: ImageIcon, clase: "bg-secondary text-foreground" },
  pieza_vista: { icono: Eye, clase: "bg-accent text-accent-foreground" },
  descuento: { icono: Percent, clase: "bg-warning-soft text-warning" },
  queja: { icono: AlertTriangle, clase: "bg-destructive-soft text-destructive" },
  devolucion: { icono: Undo2, clase: "bg-destructive-soft text-destructive" },
  cotizacion: { icono: FileText, clase: "bg-accent text-accent-foreground" },
  cita: { icono: CalendarDays, clase: "bg-accent text-accent-foreground" },
  reserva: { icono: PackageCheck, clase: "bg-accent text-accent-foreground" },
  orden: { icono: ShoppingBag, clase: "bg-success-soft text-success" },
  pago: { icono: CreditCard, clase: "bg-success-soft text-success" },
  busqueda_externa: { icono: SearchX, clase: "bg-warning-soft text-warning" },
  notificacion: { icono: Bell, clase: "bg-secondary text-foreground" },
}

const FILTROS: { clave: string; texto: string; tipos: TipoEvento[] | null }[] = [
  { clave: "todo", texto: "Todo", tipos: null },
  { clave: "mensajes", texto: "Mensajes", tipos: ["mensajes", "nota_de_voz", "archivo"] },
  { clave: "piezas", texto: "Piezas vistas", tipos: ["pieza_vista", "busqueda_externa"] },
  { clave: "cotizaciones", texto: "Cotizaciones", tipos: ["cotizacion"] },
  { clave: "citas", texto: "Citas y reservas", tipos: ["cita", "reserva"] },
  { clave: "compras", texto: "Compras y pagos", tipos: ["orden", "pago"] },
  { clave: "alertas", texto: "Descuentos y quejas", tipos: ["descuento", "queja", "devolucion"] },
  { clave: "avisos", texto: "Avisos enviados", tipos: ["notificacion"] },
]

const TODOS = "todos"

export function LineaDeTiempo({ eventos, vehiculos, vehiculo, onVehiculo }: {
  eventos: EventoCliente[] | null
  vehiculos: VehiculoPerfil[]
  vehiculo: string
  onVehiculo: (v: string) => void
}) {
  const [filtro, setFiltro] = useState("todo")
  const [todos, setTodos] = useState(false)
  const tipos = FILTROS.find((f) => f.clave === filtro)?.tipos
  const visibles = useMemo(() => (eventos ?? []).filter((e) =>
    (!tipos || tipos.includes(e.tipo)) && (vehiculo === TODOS || e.vehiculo_id === vehiculo)), [eventos, tipos, vehiculo])
  const cuenta = (t: TipoEvento[] | null) => (eventos ?? []).filter((e) => (!t || t.includes(e.tipo)) && (vehiculo === TODOS || e.vehiculo_id === vehiculo)).length
  const lista = todos ? visibles : visibles.slice(0, 25)

  return (
    <Panel id="linea-de-tiempo" plegable="abierto" titulo="Línea de tiempo" detalle="Todo lo que pasó con el cliente, del más reciente al más antiguo."
      accion={vehiculos.length > 0 ? (
        <Select value={vehiculo} onValueChange={onVehiculo}>
          <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filtrar por vehículo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los vehículos</SelectItem>
            {vehiculos.map((v) => <SelectItem key={v.id} value={v.id}>{vehiculoTexto(v)}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : undefined}>
      <div role="tablist" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const n = cuenta(f.tipos)
          return (
            <button key={f.clave} type="button" role="tab" aria-selected={filtro === f.clave} onClick={() => setFiltro(f.clave)}
              className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filtro === f.clave ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              {f.texto}<span className="tabular-nums opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {eventos === null ? (
        <div className="mt-4 space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : visibles.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">Sin eventos {vehiculo !== TODOS ? "para este vehículo" : "de este tipo"}.</p>
      ) : (
        <ol className="relative mt-4 space-y-1 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
          {lista.map((e) => {
            const def = TIPO_EVENTO[e.tipo] ?? TIPO_EVENTO.mensajes
            const Icono = def.icono
            const v = e.vehiculo_id ? vehiculos.find((x) => x.id === e.vehiculo_id) : null
            const cuerpo = (
              <>
                <span className={cn("relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", def.clase)}>
                  <Icono className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{e.titulo}</span>
                    <time dateTime={e.fecha ?? undefined} className="shrink-0 text-xs tabular-nums text-muted-foreground">{fecha(e.fecha, true)}</time>
                  </span>
                  {e.detalle && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{e.detalle}</span>}
                  <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span className="capitalize">{e.canal}</span>
                    {e.atendio && <span>Atendió: {e.atendio}</span>}
                    {v && <span className="inline-flex items-center gap-1"><Car className="h-3 w-3" aria-hidden />{vehiculoTexto(v)}</span>}
                  </span>
                </span>
              </>
            )
            return (
              <li key={`${e.tipo}-${e.id}`}>
                {e.enlace ? (
                  <Link href={e.enlace} className="flex gap-3 rounded-lg p-1.5 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{cuerpo}</Link>
                ) : <div className="flex gap-3 p-1.5">{cuerpo}</div>}
              </li>
            )
          })}
        </ol>
      )}
      {visibles.length > lista.length && (
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setTodos(true)}>Ver los {visibles.length} eventos</Button>
      )}
    </Panel>
  )
}

export function Garaje({ clienteId, vehiculos, editable, onEstado, onHistorial }: {
  clienteId: string
  vehiculos: VehiculoPerfil[]
  editable: boolean
  onEstado: (v: VehiculoPerfil, estado: EstadoVehiculo) => void
  onHistorial: (v: VehiculoPerfil) => void
}) {
  const [ficha, setFicha] = useState<string | null>(null)
  return (
    <Panel titulo="Garaje" detalle={vehiculos.length ? "Toca un vehículo para ver lo que pidió y las piezas que le sirven. La IA solo usa los activos." : undefined}>
      {vehiculos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin vehículos. Se agregan solos cuando el cliente dice marca, modelo y año.</p>
      ) : (
        <ul className="space-y-3">
          {vehiculos.map((v) => {
            const activo = (v.estado ?? "activo") === "activo"
            return (
              <li key={v.id} className={cn("rounded-lg border p-3", !activo && "bg-secondary/40")}>
                <button type="button" onClick={() => setFicha(v.id)} aria-label={`Ver la ficha de ${vehiculoTexto(v)}`}
                  className="-m-1.5 flex w-[calc(100%+0.75rem)] items-start gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", activo ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground")}>
                    <Car className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium", !activo && "text-muted-foreground")}>
                      {vehiculoTexto(v)}
                      {v.kilometraje != null && <span className="font-normal text-muted-foreground"> · {v.kilometraje.toLocaleString("es-DO")} km</span>}
                    </p>
                    <DatosDelVehiculo vehiculo={v} className="mt-1" />
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select value={v.estado ?? "activo"} onValueChange={(e) => onEstado(v, e as EstadoVehiculo)} disabled={!editable}>
                    <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Estado de ${vehiculoTexto(v)}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{ESTADOS_VEHICULO.map((e) => <SelectItem key={e.valor} value={e.valor}>{e.texto}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => onHistorial(v)}>
                    <History className="h-3.5 w-3.5" aria-hidden /> Historial
                  </Button>
                  {!!v.fotos && <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-3 w-3" aria-hidden />{v.fotos}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <FichaVehiculoCliente clienteId={clienteId} vehiculo={vehiculos.find((v) => v.id === ficha) ?? null} onCerrar={() => setFicha(null)} />
    </Panel>
  )
}

export function Archivos({ archivos, vehiculos, editable, onLigar }: {
  archivos: ArchivoCliente[] | null
  vehiculos: VehiculoPerfil[]
  editable: boolean
  onLigar: (a: ArchivoCliente, vehiculoId: string | null, fotoDelVehiculo?: boolean) => void
}) {
  return (
    <Panel plegable="cerrado" titulo="Fotos y archivos" detalle="Lo que mandó el cliente por WhatsApp. Las fotos se conservan.">
      {archivos === null ? (
        <div className="grid grid-cols-3 gap-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : archivos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no ha mandado fotos ni documentos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {archivos.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-lg border">
              {a.eliminado || !a.url ? (
                <div className="flex aspect-square items-center justify-center bg-secondary p-2 text-center text-xs text-muted-foreground">Archivo borrado</div>
              ) : a.tipo === "image" ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.nombre || "Foto del cliente"} loading="lazy" className="aspect-square w-full bg-secondary object-cover" />
                </a>
              ) : (
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="flex aspect-square flex-col items-center justify-center gap-2 bg-secondary p-2 text-center text-xs hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
                  <span className="line-clamp-2 break-all">{a.nombre || (a.tipo === "video" ? "Video" : "Documento")}</span>
                </a>
              )}
              <div className="space-y-1.5 p-2">
                <p className="text-[11px] text-muted-foreground">{fecha(a.fecha)}{a.de_cliente ? "" : " · enviado"}</p>
                {vehiculos.length > 0 && (
                  <Select value={a.vehiculo_id ?? "ninguno"} disabled={!editable || a.eliminado}
                    onValueChange={(v) => onLigar(a, v === "ninguno" ? null : v)}>
                    <SelectTrigger className="h-7 text-[11px]" aria-label="Vehículo de la foto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">Sin vehículo</SelectItem>
                      {vehiculos.map((v) => <SelectItem key={v.id} value={v.id}>{vehiculoTexto(v)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {a.tipo === "image" && a.vehiculo_id && !a.eliminado && (
                  <button type="button" disabled={!editable} onClick={() => onLigar(a, a.vehiculo_id, !a.foto_del_vehiculo)}
                    aria-pressed={!!a.foto_del_vehiculo}
                    className={cn("w-full rounded-control px-2 py-1 text-[11px] font-medium", a.foto_del_vehiculo ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70")}>
                    {a.foto_del_vehiculo ? "Es la foto del carro" : "Usar como foto del carro"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const ESTADO_ORDEN: Record<string, string> = {
  PENDING: "Pendiente", CONFIRMED: "Confirmada", AWAITING_CONFIRMATION: "Por confirmar", PROCESSING: "En proceso",
  PAID: "Pagada", PAYMENT_FAILED: "Pago fallido", SHIPPED: "Enviada", DELIVERED: "Entregada", CANCELLED: "Cancelada",
}

export function CotizacionesYCompras({ perfil }: { perfil: PerfilDelCliente }) {
  const [bajando, setBajando] = useState<string | null>(null)
  const pdf = async (codigo: string) => {
    setBajando(codigo)
    try { await cotizacionesApi.descargarPdf(codigo) } catch (e: any) { toast.error(e?.message || "No se pudo descargar el PDF") }
    finally { setBajando(null) }
  }
  const ordenes = perfil.ordenes ?? []
  return (
    <Panel plegable="cerrado" titulo="Cotizaciones y compras">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cotizaciones</h3>
          {perfil.cotizaciones.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Sin cotizaciones.</p> : (
            <ul className="mt-2 divide-y">
              {perfil.cotizaciones.map((c) => (
                <li key={c.codigo} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/cotizaciones/${c.codigo}`} className="text-sm font-medium hover:text-primary hover:underline">{c.codigo}</Link>
                    <p className="truncate text-xs text-muted-foreground">{[c.vehiculo, c.fecha && fecha(c.fecha)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <EstadoCotizacion estado={c.estado} cotizacion={c} />
                  <span className="w-24 text-right text-sm tabular-nums">{formatCurrency(c.total_dop)}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Descargar PDF de ${c.codigo}`} onClick={() => pdf(c.codigo)} disabled={bajando === c.codigo}>
                    {bajando === c.codigo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Órdenes</h3>
          {ordenes.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Sin órdenes.</p> : (
            <ul className="mt-2 divide-y">
              {ordenes.map((o) => (
                <li key={o.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/orders?orden=${o.id}`} className="text-sm font-medium hover:text-primary hover:underline">{o.numero ?? o.id.slice(0, 8)}</Link>
                    <p className="text-xs text-muted-foreground">{fecha(o.fecha)}</p>
                  </div>
                  <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    o.compra ? "bg-success-soft text-success" : o.estado === "CANCELLED" ? "bg-destructive-soft text-destructive" : "bg-secondary")}>
                    {ESTADO_ORDEN[o.estado ?? ""] ?? o.estado}
                  </span>
                  <span className="w-24 text-right text-sm tabular-nums">{formatCurrency(o.total_dop)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  )
}

export function Senales({ perfil }: { perfil: PerfilDelCliente }) {
  const s = perfil.senales
  const c = perfil.cliente
  return (
    <Panel plegable="cerrado" titulo="Señales y riesgo">
      <dl className="space-y-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Interés</dt>
          <dd className="text-right">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", NIVEL_CLASE[perfil.interes.nivel])}>{perfil.interes.nivel}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{perfil.interes.motivo}</span>
          </dd>
        </div>
        {s && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Riesgo</dt>
            <dd className="text-right">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", RIESGO_CLASE[s.riesgo.nivel])}>{s.riesgo.nivel}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{s.riesgo.motivo}</span>
            </dd>
          </div>
        )}
        {s && <Dato k="Días con consultas (30 días)" v={String(s.consultas_30d)} />}
        <Dato k="Mensajes del cliente" v={String(perfil.mensajes_del_cliente)} />
        <Dato k="Conversaciones" v={String(perfil.conversaciones)} />
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Bloqueo</dt>
          <dd className="text-right">
            {c.bloqueado ? (
              <>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", RIESGO_CLASE.alto)}>Bloqueado</span>
                <span className="mt-1 block text-xs text-muted-foreground">{c.bloqueo_motivo} · {fecha(c.bloqueado_at)}</span>
              </>
            ) : <span className="text-xs text-muted-foreground">No bloqueado</span>}
          </dd>
        </div>
      </dl>
    </Panel>
  )
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium tabular-nums">{v}</dd>
    </div>
  )
}
