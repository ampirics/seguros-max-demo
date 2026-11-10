"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, RefreshCw, Send } from "lucide-react"
import { toast } from "sonner"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/lib/api-client"
import { fechaLocal } from "@/lib/api/agenda"
import {
  estadisticasApi, type Alertas, type Clientes, type FiltrosEstadisticas, type Fila, type Picos,
  type ResumenEstadisticas, type VistaEstadistica,
} from "@/lib/api/estadisticas"
import { inventarioApi, type Sucursal } from "@/lib/api/inventario"
import { cn, formatCurrency } from "@/lib/utils"

const PERIODOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
]
const TODAS = "todas"

const numero = (n: number | null | undefined, decimales = 0) =>
  n == null ? "—" : n.toLocaleString("es-DO", { maximumFractionDigits: decimales })
const usd = (n: number | null | undefined) =>
  n == null ? "—" : `US$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: n === 0 || n >= 1 ? 2 : 4 })}`
const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)} %`)
const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "short" }) : "—"

type Columna = {
  clave: string
  titulo: string
  num?: boolean
  barra?: boolean
  formato?: (v: any, fila: Fila) => React.ReactNode
}

function Tile({ label, valor, detalle }: { label: string; valor: string; detalle?: string }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </CardContent></Card>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>
}

// Tabla con una barra de una sola serie en la columna principal: el valor va escrito, la barra da la proporción.
function Tabla({ columnas, filas, vacio }: { columnas: Columna[]; filas: Fila[]; vacio: string }) {
  const conBarra = columnas.find((c) => c.barra)
  const max = conBarra ? Math.max(0, ...filas.map((f) => Number(f[conBarra.clave]) || 0)) : 0
  if (!filas.length) return <Vacio texto={vacio} />
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-sm sm:min-w-[26rem]">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className={cn("py-2 pr-3 font-medium last:pr-0", c.num && "text-right", columnas.indexOf(c) > 1 && "hidden sm:table-cell")}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f, i) => (
            <tr key={f.pieza_id ?? f.cliente_id ?? `${f.pieza ?? f.marca ?? ""}-${i}`} className="hover:bg-muted/40">
              {columnas.map((c, j) => {
                const valor = c.formato ? c.formato(f[c.clave], f) : f[c.clave] ?? "—"
                const Celda = j === 0 ? "th" : "td"
                const resto = j === 0 ? columnas.slice(2) : []
                return (
                  <Celda key={c.clave} {...(j === 0 ? { scope: "row" } : {})}
                    className={cn("py-2 pr-3 align-top last:pr-0", j === 0 && "break-words text-left font-medium", c.num && "text-right tabular-nums", j > 1 && "hidden sm:table-cell")}>
                    {resto.length > 0 && (
                      <>
                        {valor}
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground sm:hidden">
                          {resto.map((x, k) => (
                            <span key={x.clave}>{k > 0 && " · "}{x.titulo}: {x.formato ? x.formato(f[x.clave], f) : f[x.clave] ?? "—"}</span>
                          ))}
                        </span>
                      </>
                    )}
                    {resto.length > 0 ? null : c.barra ? (
                      <div className="flex items-center justify-end gap-2" title={`${c.titulo}: ${valor}`}>
                        <div className="hidden h-2 w-24 rounded-full bg-secondary sm:block">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.max(3, (Number(f[c.clave]) / max) * 100) : 0}%` }} />
                        </div>
                        <span className="min-w-[3ch]">{valor}</span>
                      </div>
                    ) : valor}
                  </Celda>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pieza({ fila }: { fila: Fila }) {
  return (
    <span className="block max-w-[22rem]">
      <span className="line-clamp-2">{fila.nombre}</span>
      {fila.sku && <span className="block text-xs font-normal text-muted-foreground">{fila.sku}</span>}
    </span>
  )
}

const piezaCol: Columna = { clave: "nombre", titulo: "Pieza", formato: (_, f) => <Pieza fila={f} /> }

function Seccion({ titulo, nota, onExcel, children, extra }: {
  titulo: string; nota?: string; onExcel?: () => void; children: React.ReactNode; extra?: React.ReactNode
}) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">{titulo}</h2>
          {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
        </div>
        <div className="flex items-center gap-2">
          {extra}
          {onExcel && (
            <Button variant="outline" size="sm" onClick={onExcel}><Download className="mr-1.5 h-4 w-4" />Excel</Button>
          )}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </CardContent></Card>
  )
}

function useVista<T>(vista: VistaEstadistica, f: FiltrosEstadisticas | null, extra?: Record<string, unknown>, activa = true) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const clave = JSON.stringify([vista, f, extra])
  useEffect(() => {
    if (!f || !activa) return
    setDatos(null)
    setError(false)
    estadisticasApi.vista<T>(vista, f, extra).then(setDatos).catch(() => setError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activa])
  return { datos, error }
}

function Carga<T>({ estado, children }: { estado: { datos: T | null; error: boolean }; children: (d: T) => React.ReactNode }) {
  if (estado.error) return <Vacio texto="No se pudo cargar esta vista." />
  if (!estado.datos) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
  return <>{children(estado.datos)}</>
}

// Mapa de calor de una sola magnitud (mensajes): un solo tono, de claro a oscuro.
function MapaCalor({ p }: { p: Picos }) {
  const max = Math.max(1, ...p.matriz.flat())
  const horas = Array.from({ length: 24 }, (_, h) => h)
  if (!p.total) return <Vacio texto="Sin mensajes de clientes en este periodo." />
  return (
    <div className="space-y-3">
      {p.pico && (
        <p className="text-sm">
          Hora pico: <span className="font-medium">{p.pico.dia} a las {String(p.pico.hora).padStart(2, "0")}:00</span>{" "}
          <span className="text-muted-foreground">({numero(p.pico.mensajes)} mensajes de {numero(p.total)})</span>
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[40rem] border-separate border-spacing-0.5 text-[11px]" aria-label="Mensajes de clientes por día y hora">
          <thead>
            <tr>
              <th scope="col" className="w-16" />
              {horas.map((h) => (
                <th key={h} scope="col" className="font-normal text-muted-foreground">{h % 3 === 0 ? h : ""}</th>
              ))}
              <th scope="col" className="pl-2 text-right font-normal text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {p.matriz.map((fila, d) => (
              <tr key={p.dias[d]}>
                <th scope="row" className="pr-2 text-left font-normal capitalize text-muted-foreground">{p.dias[d].slice(0, 3)}</th>
                {fila.map((n, h) => (
                  <td key={h} title={`${p.dias[d]} ${String(h).padStart(2, "0")}:00 · ${n} ${n === 1 ? "mensaje" : "mensajes"}`}
                    className="h-6 rounded-[3px] bg-secondary">
                    {n > 0 && <div className="h-full w-full rounded-[3px] bg-primary" style={{ opacity: 0.15 + 0.85 * (n / max) }} />}
                    <span className="sr-only">{n}</span>
                  </td>
                ))}
                <td className="pl-2 text-right tabular-nums text-muted-foreground">{p.por_dia[d]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Menos</span>
        {[0.15, 0.4, 0.65, 1].map((o) => <span key={o} className="h-3 w-5 rounded-[3px] bg-primary" style={{ opacity: o }} />)}
        <span>Más</span>
      </div>
    </div>
  )
}

function CrearCampana({ clientes, dias, onClose }: { clientes: string[]; dias: number; onClose: () => void }) {
  const router = useRouter()
  const [nombre, setNombre] = useState(`Clientes sin comprar hace ${dias} días`)
  const [plantilla, setPlantilla] = useState("")
  const [plantillas, setPlantillas] = useState<{ name: string; body: string }[]>([])
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { estadisticasApi.plantillas().then(setPlantillas).catch(() => setPlantillas([])) }, [])
  const crear = async () => {
    setGuardando(true)
    try {
      const c = await estadisticasApi.crearCampana(nombre.trim(), plantilla.trim(), clientes)
      toast.success("Campaña creada en borrador. Revísala antes de enviarla.")
      router.push(`/admin/campaigns/${c.id}`)
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear la campaña.")
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear campaña con los inactivos</DialogTitle>
          <DialogDescription>
            Queda en borrador con {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}. Al enviarla solo
            les llega a los que aceptaron recibir mensajes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="camp-nombre">Nombre</Label>
            <Input id="camp-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-plantilla">Plantilla de WhatsApp aprobada</Label>
            <Input id="camp-plantilla" list="camp-plantillas" value={plantilla} onChange={(e) => setPlantilla(e.target.value)}
              placeholder="nombre_de_la_plantilla" />
            <datalist id="camp-plantillas">{plantillas.map((p) => <option key={p.name} value={p.name}>{p.body}</option>)}</datalist>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={crear} disabled={guardando || !nombre.trim() || !plantilla.trim()}>Crear borrador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AlertasPanel() {
  const [a, setA] = useState<Alertas | null>(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { estadisticasApi.alertas().then(setA).catch(() => toast.error("No se pudieron cargar las alertas.")) }, [])
  if (!a) return <Skeleton className="h-40" />
  const guardar = async () => {
    setGuardando(true)
    try {
      setA(await estadisticasApi.guardarAlertas(a))
      toast.success("Alertas guardadas.")
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron guardar.")
    } finally {
      setGuardando(false)
    }
  }
  const revisar = async () => {
    try {
      const r = await estadisticasApi.revisarAlertas()
      const total = r.se_acaba + r.pedida_sin_existencia
      toast.success(total ? `${total} ${total === 1 ? "aviso nuevo" : "avisos nuevos"} en Notificaciones.` : "No hay avisos nuevos.")
    } catch {
      toast.error("No se pudo revisar.")
    }
  }
  const campo = (clave: keyof Alertas, label: string, ayuda: string, max: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={`al-${clave}`}>{label}</Label>
      <Input id={`al-${clave}`} type="number" min={1} max={max} className="w-28" value={Number(a[clave])}
        onChange={(e) => setA({ ...a, [clave]: Math.max(1, Math.min(max, Number(e.target.value) || 1)) })} />
      <p className="text-xs text-muted-foreground">{ayuda}</p>
    </div>
  )
  return (
    <Seccion titulo="Alertas" nota="Llegan a Notificaciones del panel. Se revisan solas cada 10 minutos; una por pieza a la semana.">
      <div className="space-y-5">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={a.activo} onCheckedChange={(v) => setA({ ...a, activo: v })} />
          Avisar automáticamente
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          {campo("dias_se_acaba", "Se acaba en", "Días que le quedan a la pieza o menos.", 90)}
          {campo("veces_no_hay", "Pidieron y no hay", "Veces que la pidieron, o más.", 1000)}
          {campo("ventana_dias", "Mirando los últimos", "Días de ventas y consultas.", 365)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={guardar} disabled={guardando}>Guardar</Button>
          <Button variant="outline" onClick={revisar}><RefreshCw className="mr-1.5 h-4 w-4" />Revisar ahora</Button>
        </div>
      </div>
    </Seccion>
  )
}

export default function EstadisticasPage() {
  const [dias, setDias] = useState(30)
  const [sucursal, setSucursal] = useState(TODAS)
  const [marca, setMarca] = useState(TODAS)
  const [modelo, setModelo] = useState("")
  const [modeloAplicado, setModeloAplicado] = useState("")
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [marcas, setMarcas] = useState<string[]>([])
  const [tab, setTab] = useState("ventas")
  const [resumen, setResumen] = useState<ResumenEstadisticas | null>(null)
  const [parado, setParado] = useState(60)
  const [inactivo, setInactivo] = useState(90)
  const [campana, setCampana] = useState<string[] | null>(null)

  useEffect(() => {
    inventarioApi.sucursales().then(setSucursales).catch(() => setSucursales([]))
    apiClient.get<{ marcas: string[] }>("/ia/origen-datos").then((r) => setMarcas(r.marcas ?? [])).catch(() => setMarcas([]))
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setModeloAplicado(modelo.trim()), 400)
    return () => clearTimeout(t)
  }, [modelo])

  const filtros = useMemo<FiltrosEstadisticas>(() => {
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - (dias - 1) * 86_400_000)
    return {
      desde: fechaLocal(desde), hasta: fechaLocal(hasta),
      sucursal_id: sucursal === TODAS ? undefined : sucursal,
      marca: marca === TODAS ? undefined : marca,
      modelo: modeloAplicado || undefined,
    }
  }, [dias, sucursal, marca, modeloAplicado])

  useEffect(() => {
    setResumen(null)
    estadisticasApi.resumen(filtros).then(setResumen).catch(() => setResumen(null))
  }, [filtros])

  const ventas = tab === "ventas", demanda = tab === "demanda"
  const vendidos = useVista<{ items: Fila[] }>("mas_vendidos", filtros, undefined, ventas)
  const seAcaba = useVista<{ items: Fila[] }>("se_acaba", filtros, undefined, ventas)
  const sugerencia = useVista<{ items: Fila[] }>("sugerencia_compra", filtros, undefined, ventas)
  const paradoV = useVista<{ items: Fila[]; valor_total_dop: number }>("inventario_parado", filtros, { dias: parado }, ventas)
  const consultados = useVista<{ items: Fila[] }>("mas_consultados", filtros, undefined, demanda)
  const noHay = useVista<{ items: Fila[] }>("no_hay", filtros, undefined, demanda)
  const cotizado = useVista<{ items: Fila[] }>("cotizado_sin_venta", filtros, undefined, demanda)
  const vehiculos = useVista<{ items: Fila[] }>("vehiculos", filtros, undefined, demanda)
  const descuentos = useVista<{ items: Fila[] }>("descuentos", filtros, undefined, demanda)
  const picos = useVista<Picos>("picos", filtros, undefined, tab === "horarios")
  const clientes = useVista<Clientes>("clientes", filtros, { dias_inactivo: inactivo }, tab === "clientes")

  const excel = (vista: VistaEstadistica, extra?: Record<string, unknown>) => () =>
    estadisticasApi.excel(vista, filtros, extra).catch((e) => toast.error(e?.message || "No se pudo exportar."))

  const clienteCols: Columna[] = [
    { clave: "nombre", titulo: "Cliente", formato: (v, f) => <span>{v}<span className="block text-xs font-normal text-muted-foreground">{f.telefono ?? ""}</span></span> },
    { clave: "compras", titulo: "Compras", num: true },
    { clave: "total_dop", titulo: "Total", num: true, barra: true, formato: (v) => formatCurrency(v) },
    { clave: "ticket_promedio_dop", titulo: "Ticket promedio", num: true, formato: (v) => formatCurrency(v) },
    { clave: "ultima_compra", titulo: "Última compra", num: true, formato: fecha },
  ]

  return (
    <AdminLayout title="Estadísticas">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="radiogroup" aria-label="Periodo" className="inline-flex w-fit gap-0.5 rounded-control bg-secondary p-0.5">
            {PERIODOS.map((p) => (
              <button key={p.dias} type="button" role="radio" aria-checked={dias === p.dias} aria-label={`Últimos ${p.label}`} onClick={() => setDias(p.dias)}
                className={cn("h-8 rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  dias === p.dias ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <span className="hidden sm:inline">Últimos </span>{p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={sucursal} onValueChange={setSucursal}>
              <SelectTrigger className="h-9 bg-card sm:w-[12rem]" aria-label="Sucursal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las sucursales</SelectItem>
                {sucursales.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={marca} onValueChange={setMarca}>
              <SelectTrigger className="h-9 bg-card sm:w-[11rem]" aria-label="Marca"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las marcas</SelectItem>
                {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-9 bg-card sm:w-[11rem]" placeholder="Modelo (Tucson, L200…)" aria-label="Modelo"
              value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {resumen ? (
            <>
              <Tile label="Consultas del bot" valor={numero(resumen.consultas)} detalle={`${numero(resumen.sin_resultado)} sin resultado`} />
              <Tile label="Resueltas sin vendedor" valor={`${numero(resumen.resueltas_sin_vendedor ?? 0)} de ${numero(resumen.conversaciones ?? 0)}`}
                detalle={`${numero(resumen.con_vendedor ?? resumen.con_pase ?? 0)} con vendedor · ${numero(resumen.sin_cerrar ?? 0)} sin cotizar ni apartar`} />
              <Tile label="Unidades vendidas" valor={numero(resumen.unidades_vendidas)} detalle={formatCurrency(resumen.monto_vendido_dop)} />
              <Tile label="Pidieron descuento" valor={numero(resumen.pidieron_descuento)} detalle="consultas" />
              <Tile label="Costo de la IA" valor={usd(resumen.costo_ia_usd)}
                detalle={resumen.latencia_mediana_ms != null ? `responde en ${numero(resumen.latencia_mediana_ms / 1000, 1)} s (mediana)` : "sin datos de tiempo"} />
              <Tile label="Costo por conversación" valor={usd(resumen.costo_por_conversacion_usd)}
                detalle={`estimado: ${numero(resumen.conversaciones_con_costo ?? 0)} de ${numero(resumen.conversaciones ?? 0)} conversaciones con costo`} />
            </>
          ) : Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[5.5rem]" />)}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="ventas">Ventas e inventario</TabsTrigger>
            <TabsTrigger value="demanda">Lo que piden</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="horarios">Días y horas</TabsTrigger>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="ventas" className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Seccion titulo="Más vendidos" nota="Unidades vendidas en el periodo elegido: órdenes pagadas o entregadas y ventas registradas a mano." onExcel={excel("mas_vendidos")}>
              <Carga estado={vendidos}>{(d) => (
                <Tabla filas={d.items.slice(0, 15)} vacio="Sin ventas en este periodo."
                  columnas={[piezaCol, { clave: "unidades", titulo: "Unidades", num: true, barra: true }, { clave: "monto_dop", titulo: "Monto", num: true, formato: (v) => formatCurrency(v) }]} />
              )}</Carga>
            </Seccion>
            <Seccion titulo="Lo que se acaba más rápido" nota="Con las mismas ventas de Más vendidos en el periodo elegido: cuántas por semana y cuántos días quedan." onExcel={excel("se_acaba")}>
              <Carga estado={seAcaba}>{(d) => (
                <Tabla filas={d.items.slice(0, 15)} vacio="Ninguna pieza con ventas en este periodo."
                  columnas={[piezaCol, { clave: "por_semana", titulo: "Por semana", num: true, formato: (v) => numero(v, 1) },
                    { clave: "disponible", titulo: "Quedan", num: true },
                    { clave: "dias_quedan", titulo: "Días", num: true, formato: (v) => <span className={cn(v <= 7 && "font-semibold text-destructive")}>{numero(v, 1)}</span> }]} />
              )}</Carga>
            </Seccion>
            <Seccion titulo="Sugerencia de compra" nota="Para cubrir 30 días de ventas más el mínimo, y lo que piden sin existencia. Ajústala antes de pedir." onExcel={excel("sugerencia_compra")}>
              <Carga estado={sugerencia}>{(d) => (
                <Tabla filas={d.items.slice(0, 20)} vacio="Nada que pedir por ahora."
                  columnas={[piezaCol, { clave: "disponible", titulo: "Hay", num: true }, { clave: "sugerido", titulo: "Pedir", num: true, barra: true },
                    { clave: "motivo", titulo: "Por qué", formato: (v) => <span className="text-xs text-muted-foreground">{v}</span> }]} />
              )}</Carga>
            </Seccion>
            <Seccion titulo="Inventario parado" nota="Piezas con existencia y sin vender. Valor a precio de venta." onExcel={excel("inventario_parado", { dias: parado })}
              extra={(
                <Select value={String(parado)} onValueChange={(v) => setParado(Number(v))}>
                  <SelectTrigger className="h-8 w-[9.5rem]" aria-label="Días sin venta"><SelectValue /></SelectTrigger>
                  <SelectContent>{[30, 60, 90, 180].map((n) => <SelectItem key={n} value={String(n)}>{n} días sin venta</SelectItem>)}</SelectContent>
                </Select>
              )}>
              <Carga estado={paradoV}>{(d) => (
                <>
                  {d.items.length > 0 && <p className="mb-2 text-sm">Dinero parado: <span className="font-semibold tabular-nums">{formatCurrency(d.valor_total_dop)}</span></p>}
                  <Tabla filas={d.items.slice(0, 20)} vacio={`Ninguna pieza lleva ${parado} días sin venderse.`}
                    columnas={[piezaCol, { clave: "unidades", titulo: "Unidades", num: true }, { clave: "dias_sin_venta", titulo: "Días", num: true },
                      { clave: "valor_dop", titulo: "Valor", num: true, barra: true, formato: (v) => formatCurrency(v) }]} />
                </>
              )}</Carga>
            </Seccion>
          </TabsContent>

          <TabsContent value="demanda" className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Seccion titulo="Lo que piden y no hay" nota="Consultas sin resultado, búsquedas externas y avisos de pieza no encontrada, agrupados." onExcel={excel("no_hay")}>
              <Carga estado={noHay}>{(d) => (
                <Tabla filas={d.items.slice(0, 20)} vacio="Nada pedido sin existencia en este periodo."
                  columnas={[{ clave: "pieza", titulo: "Pieza pedida", formato: (v, f) => (
                    <span className="block max-w-[20rem]">{v}<span className="block text-xs font-normal text-muted-foreground">{(f.vehiculos ?? []).map((x: any) => `${x.vehiculo} (${x.veces})`).join(", ")}</span></span>
                  ) }, { clave: "veces", titulo: "Veces", num: true, barra: true }, { clave: "ultima", titulo: "Última", num: true, formato: fecha }]} />
              )}</Carga>
            </Seccion>
            <Seccion titulo="Más consultados por WhatsApp" nota="Piezas que mostró el bot, aunque no se compren." onExcel={excel("mas_consultados")}>
              <Carga estado={consultados}>{(d) => (
                <Tabla filas={d.items.slice(0, 15)} vacio="Sin consultas registradas en este periodo."
                  columnas={[piezaCol, { clave: "consultas", titulo: "Consultas", num: true, barra: true }, { clave: "cotizadas", titulo: "Cotizadas", num: true }, { clave: "vendidas", titulo: "Vendidas", num: true }]} />
              )}</Carga>
            </Seccion>
            <Seccion titulo="Cotizado sin venta" nota="Piezas que se cotizan y no se venden: puede ser señal de precio." onExcel={excel("cotizado_sin_venta")}>
              <Carga estado={cotizado}>{(d) => (
                <Tabla filas={d.items.slice(0, 15)} vacio="Sin cotizaciones en este periodo."
                  columnas={[piezaCol, { clave: "cotizaciones", titulo: "Cotizada", num: true, barra: true }, { clave: "ventas", titulo: "Vendida", num: true },
                    { clave: "conversion", titulo: "Conversión", num: true, formato: pct }, { clave: "precio_dop", titulo: "Precio", num: true, formato: (v) => (v == null ? "—" : formatCurrency(v)) }]} />
              )}</Carga>
            </Seccion>
            <Seccion titulo="Vehículos más consultados" nota="El vehículo que dijo el cliente en cada consulta." onExcel={excel("vehiculos")}>
              <Carga estado={vehiculos}>{(d) => (
                <Tabla filas={d.items.slice(0, 15)} vacio="Sin vehículos en las consultas de este periodo."
                  columnas={[{ clave: "marca", titulo: "Vehículo", formato: (_, f) => [f.marca, f.modelo, f.anio].filter(Boolean).join(" ") },
                    { clave: "consultas", titulo: "Consultas", num: true, barra: true }, { clave: "clientes", titulo: "Clientes", num: true },
                    { clave: "cotizadas", titulo: "Cotizadas", num: true }, { clave: "vendidas", titulo: "Vendidas", num: true }]} />
              )}</Carga>
            </Seccion>
            <Seccion titulo="Descuentos pedidos" nota="En qué piezas piden rebaja." onExcel={excel("descuentos")}>
              <Carga estado={descuentos}>{(d) => (
                <Tabla filas={d.items.slice(0, 15)} vacio="Nadie pidió descuento en este periodo."
                  columnas={[piezaCol, { clave: "veces", titulo: "Veces", num: true, barra: true }, { clave: "precio_dop", titulo: "Precio", num: true, formato: (v) => (v == null ? "—" : formatCurrency(v)) }]} />
              )}</Carga>
            </Seccion>
          </TabsContent>

          <TabsContent value="clientes" className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Seccion titulo="Mejores clientes" nota="Los que más compraron en el periodo." onExcel={excel("clientes", { dias_inactivo: inactivo })}>
              <Carga estado={clientes}>{(d) => (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">{d.clientes_con_compras} clientes con compras, {d.recurrentes} recurrentes.</p>
                  <Tabla filas={d.mejores.slice(0, 20)} vacio="Sin compras en este periodo." columnas={clienteCols} />
                </>
              )}</Carga>
            </Seccion>
            <Seccion titulo="Clientes inactivos" nota="Compraron antes y dejaron de comprar."
              extra={(
                <>
                  <Select value={String(inactivo)} onValueChange={(v) => setInactivo(Number(v))}>
                    <SelectTrigger className="h-8 w-[9rem]" aria-label="Días sin comprar"><SelectValue /></SelectTrigger>
                    <SelectContent>{[30, 60, 90, 180, 365].map((n) => <SelectItem key={n} value={String(n)}>{n} días sin comprar</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" disabled={!clientes.datos?.inactivos.length}
                    onClick={() => setCampana(clientes.datos?.inactivos.map((c) => c.cliente_id) ?? [])}>
                    <Send className="mr-1.5 h-4 w-4" />Crear campaña
                  </Button>
                </>
              )}>
              <Carga estado={clientes}>{(d) => (
                <Tabla filas={d.inactivos.slice(0, 20)} vacio={`Ningún cliente lleva ${inactivo} días sin comprar.`}
                  columnas={[...clienteCols.slice(0, 3), { clave: "dias_sin_comprar", titulo: "Días sin comprar", num: true }]} />
              )}</Carga>
            </Seccion>
          </TabsContent>

          <TabsContent value="horarios" className="mt-4">
            <Seccion titulo="Días y horas pico" nota="Mensajes de clientes por día y hora, para organizar los turnos." onExcel={excel("picos")}>
              <Carga estado={picos}>{(d) => <MapaCalor p={d} />}</Carga>
            </Seccion>
          </TabsContent>

          <TabsContent value="alertas" className="mt-4">
            <AlertasPanel />
          </TabsContent>
        </Tabs>
      </div>
      {campana && <CrearCampana clientes={campana} dias={inactivo} onClose={() => setCampana(null)} />}
    </AdminLayout>
  )
}
