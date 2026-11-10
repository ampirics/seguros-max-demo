"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Boxes, CalendarClock, ChevronDown, ChevronRight, Info, Mail, MessageCircle, PackageCheck, Phone, Plus, Sparkles, Trash2, Truck, User, Wallet } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { estadoInsumo, PROVEEDORES } from "@/lib/restaurante/inventario"
import { fechaLocal, hora12, horaLocal } from "@/lib/restaurante/local"
import type { Insumo, MetodoPago, OrdenCompra } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { useDetalle } from "@/components/restaurante/administracion/contexto"
import { Detalles } from "@/components/restaurante/administracion/Panel"

const cant = (n: number) => n.toLocaleString("es-DO", { maximumFractionDigits: 2 })
const UNIDAD: Record<Insumo["unidad"], [string, string]> = { kg: ["kg", "kg"], l: ["l", "l"], unidad: ["unidad", "unidades"], botella: ["botella", "botellas"] }
const conUnidad = (n: number, u: Insumo["unidad"]) => `${cant(n)} ${UNIDAD[u][n === 1 ? 0 : 1]}`
const nombreProveedor = (id: string) => PROVEEDORES.find((p) => p.id === id)?.nombre ?? id
const METODOS: { id: MetodoPago; nombre: string }[] = [
  { id: "efectivo", nombre: "Efectivo" },
  { id: "transferencia", nombre: "Transferencia" },
  { id: "tarjeta", nombre: "Tarjeta" },
]

function cuando(ts: number, ahora: number) {
  const f = fechaLocal(ts)
  const dia = f === fechaLocal(ahora) ? "hoy" : f === fechaLocal(ahora - 86_400_000) ? "ayer" : f.split("-").reverse().slice(0, 2).join("/")
  return `${dia}, ${hora12(horaLocal(ts))}`
}

async function hacer<T>(f: () => Promise<T>, ok?: string) {
  try {
    const r = await f()
    if (ok) toast.success(ok)
    return r
  } catch (e) {
    toast.error((e as Error).message)
  }
}

export default function ComprasPage() {
  return (
    <Detalles>
      <PantallaCompras />
    </Detalles>
  )
}

function PantallaCompras() {
  const { estado, ahora } = useRestaurante()
  const [nueva, setNueva] = useState(false)
  const [pagar, setPagar] = useState<OrdenCompra | null>(null)
  const [verCanceladas, setVerCanceladas] = useState(false)
  const { abrir } = useDetalle()
  const insumos = useMemo(() => estado?.insumos ?? [], [estado?.insumos])

  if (!estado) {
    return (
      <AdminLayout title="Compras">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    )
  }

  const compras = (estado.compras ?? []).slice().sort((a, b) => b.creada - a.creada)
  const de = (e: OrdenCompra["estado"]) => compras.filter((c) => c.estado === e)
  const porInsumo = new Map(insumos.map((i) => [i.id, i]))

  const sugerir = async () => {
    const r = await hacer(() => restauranteApi.accion<{ ok: true; compras: OrdenCompra[] }>({ tipo: "compraSugerida" }))
    if (r) toast.success(`${r.compras.length === 1 ? "Orden creada" : "Órdenes creadas"} en borrador: ${r.compras.map((c) => c.codigo).join(", ")}`, { duration: 5000 })
  }

  const columnas: { e: OrdenCompra["estado"]; titulo: string; detalle: string }[] = [
    { e: "borrador", titulo: "Borrador", detalle: "Revisa y envía al suplidor" },
    { e: "enviada", titulo: "Enviadas", detalle: "Esperando la mercancía" },
    { e: "recibida", titulo: "Recibidas", detalle: "Subieron el inventario; falta pagar algunas" },
  ]

  const acciones = (c: OrdenCompra) => {
    if (c.estado === "borrador")
      return (
        <>
          <Button size="sm" onClick={() => hacer(() => restauranteApi.accion({ tipo: "enviarCompra", compraId: c.id }), `${c.codigo} enviada a ${nombreProveedor(c.proveedorId)} por WhatsApp`)}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Enviar por WhatsApp
          </Button>
          <Button size="sm" variant="ghost" onClick={() => hacer(() => restauranteApi.accion({ tipo: "cancelarCompra", compraId: c.id }), `${c.codigo} cancelada`)}>
            Cancelar
          </Button>
        </>
      )
    if (c.estado === "enviada")
      return (
        <>
          <Button size="sm" onClick={() => hacer(() => restauranteApi.accion({ tipo: "recibirCompra", compraId: c.id }), `${c.codigo} recibida: subió el inventario`)}>
            <PackageCheck className="h-3.5 w-3.5" aria-hidden /> Recibir mercancía
          </Button>
          <Button size="sm" variant="ghost" onClick={() => hacer(() => restauranteApi.accion({ tipo: "cancelarCompra", compraId: c.id }), `${c.codigo} cancelada`)}>
            Cancelar
          </Button>
        </>
      )
    if (c.estado === "recibida" && !c.pagada)
      return (
        <Button size="sm" onClick={() => setPagar(c)}>
          <Wallet className="h-3.5 w-3.5" aria-hidden /> Pagar
        </Button>
      )
    return null
  }

  const porPagar = de("recibida").filter((c) => !c.pagada)

  return (
    <AdminLayout title="Compras">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">Suplidores y pedidos</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Compras</h1>
            <p className="text-sm text-muted-foreground">Pide lo que falta, recibe la mercancía y el inventario sube solo. Cada compra recibida queda como gasto a crédito hasta que se paga.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/inventario"><Boxes className="h-4 w-4" aria-hidden /> Inventario</Link>
          </Button>
        </header>

        <p className="flex items-start gap-2 rounded-lg border border-dashed bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Costos, existencias y proveedores de ejemplo: Boca Marina todavía no ha compartido los suyos.
        </p>

        <Tabs defaultValue="ordenes" className="min-w-0">
          <TabsList className="mb-3">
            <TabsTrigger value="ordenes">Órdenes</TabsTrigger>
            <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          </TabsList>

          <TabsContent value="ordenes" className="mt-0 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {de("borrador").length + de("enviada").length} abiertas · {porPagar.length} por pagar{porPagar.length ? ` (${rd(porPagar.reduce((s, c) => s + c.total, 0))})` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={sugerir}>
                  <Sparkles className="h-4 w-4" aria-hidden /> Sugerir pedido
                </Button>
                <Button onClick={() => setNueva(true)}>
                  <Plus className="h-4 w-4" aria-hidden /> Nueva orden
                </Button>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
              {columnas.map((col) => {
                const lista = de(col.e)
                return (
                  <section key={col.e} className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2 px-1">
                      <h2 className="text-sm font-semibold">{col.titulo} <span className="font-normal text-muted-foreground">{lista.length}</span></h2>
                      <span className="truncate text-xs text-muted-foreground">{col.detalle}</span>
                    </div>
                    {lista.length ? (
                      lista.map((c) => <Tarjeta key={c.id} c={c} ahora={ahora} porInsumo={porInsumo} acciones={acciones(c)} />)
                    ) : (
                      <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nada aquí.</div>
                    )}
                  </section>
                )
              })}
            </div>

            {de("cancelada").length > 0 && (
              <section className="flex flex-col gap-2">
                <button type="button" onClick={() => setVerCanceladas(!verCanceladas)} aria-expanded={verCanceladas} className="flex items-center gap-1.5 self-start px-1 text-sm font-semibold">
                  {verCanceladas ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                  Canceladas <span className="font-normal text-muted-foreground">{de("cancelada").length}</span>
                </button>
                {verCanceladas && (
                  <div className="grid gap-2 opacity-70 lg:grid-cols-3">
                    {de("cancelada").map((c) => <Tarjeta key={c.id} c={c} ahora={ahora} porInsumo={porInsumo} />)}
                  </div>
                )}
              </section>
            )}
          </TabsContent>

          <TabsContent value="proveedores" className="mt-0">
            <div className="grid gap-3 md:grid-cols-2">
              {PROVEEDORES.map((p) => {
                const suyas = compras.filter((c) => c.proveedorId === p.id)
                const abiertas = suyas.filter((c) => c.estado === "borrador" || c.estado === "enviada").length
                const comprado = suyas.filter((c) => c.estado === "recibida").reduce((s, c) => s + c.total, 0)
                const deEl = insumos.filter((i) => i.proveedorId === p.id)
                const faltan = deEl.filter((i) => estadoInsumo(i) !== "ok").length
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => abrir({ tipo: "proveedor", id: p.id })}
                    className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/30 hover:bg-secondary/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{p.nombre}</h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.categorias.map((c) => <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">{c}</span>)}
                        </div>
                      </div>
                      {faltan > 0 && <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">{faltan} por pedir</span>}
                    </div>
                    <ul className="grid gap-1 text-sm">
                      <li className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> {p.contacto}</li>
                      <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> {p.telefono}</li>
                      {p.correo && <li className="flex min-w-0 items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> <span className="truncate">{p.correo}</span></li>}
                      <li className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> {p.dias}</li>
                    </ul>
                    <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
                      <div>
                        <div className="text-lg font-semibold tabular-nums">{deEl.length}</div>
                        <div className="text-[11px] text-muted-foreground">Insumos</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold tabular-nums">{abiertas}</div>
                        <div className="text-[11px] text-muted-foreground">Órdenes abiertas</div>
                      </div>
                      <div>
                        <div className="truncate text-lg font-semibold tabular-nums">{rd(comprado)}</div>
                        <div className="text-[11px] text-muted-foreground">Comprado</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <DialogoNueva abierto={nueva} onCerrar={() => setNueva(false)} insumos={insumos} />
      <DialogoPagar compra={pagar} onCerrar={() => setPagar(null)} cajaAbierta={!!estado.caja} />
    </AdminLayout>
  )
}

function Tarjeta({ c, ahora, porInsumo, acciones }: { c: OrdenCompra; ahora: number; porInsumo: Map<string, Insumo>; acciones?: React.ReactNode }) {
  const { abrir } = useDetalle()
  const tiempos = [
    ["Creada", c.creada],
    ["Enviada", c.enviada],
    ["Recibida", c.recibida],
  ].filter((x): x is [string, number] => !!x[1])
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-foreground/30">
      <button type="button" onClick={() => abrir({ tipo: "compra", id: c.id })} className="flex min-w-0 flex-col gap-2 text-left">
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tabular-nums">{c.codigo}</span>
              {c.pagada && (
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                  Pagada · {METODOS.find((m) => m.id === c.pagada!.metodo)?.nombre.toLowerCase()}{c.pagada.deCaja ? ", de caja" : ""}
                </span>
              )}
              {c.estado === "recibida" && !c.pagada && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">A crédito</span>}
            </div>
            <div className="truncate text-sm">{nombreProveedor(c.proveedorId)}</div>
          </div>
          <span className="shrink-0 text-base font-semibold tabular-nums">{rd(c.total)}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {tiempos.map(([t, ts]) => (
            <span key={t} className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" aria-hidden /> {t} {cuando(ts, ahora)}</span>
          ))}
        </div>
        <ul className="w-full divide-y rounded-lg bg-secondary/40 px-3 text-sm">
          {c.lineas.map((l) => {
            const i = porInsumo.get(l.insumoId)
            return (
              <li key={l.insumoId} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">{i?.nombre ?? l.insumoId}</span>
                <span className="flex shrink-0 gap-3 tabular-nums">
                  <span className="text-muted-foreground">{i ? conUnidad(l.cantidad, i.unidad) : cant(l.cantidad)}</span>
                  <span className="w-24 text-right">{rd(l.cantidad * l.costo)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </button>
      {acciones && <div className="flex flex-wrap gap-2 pt-1">{acciones}</div>}
    </article>
  )
}

function DialogoNueva({ abierto, onCerrar, insumos }: { abierto: boolean; onCerrar: () => void; insumos: Insumo[] }) {
  const [proveedorId, setProveedorId] = useState<string>("")
  const [lineas, setLineas] = useState<{ insumoId: string; cantidad: string }[]>([])
  const [agregar, setAgregar] = useState<string>("")
  const [guardando, setGuardando] = useState(false)

  const deEl = insumos.filter((i) => i.proveedorId === proveedorId)
  const porId = new Map(insumos.map((i) => [i.id, i]))
  const disponibles = deEl.filter((i) => !lineas.some((l) => l.insumoId === i.id))
  const num = (s: string) => Number(s.replace(",", ".")) || 0
  const total = lineas.reduce((s, l) => s + num(l.cantidad) * (porId.get(l.insumoId)?.costo ?? 0), 0)

  const cerrar = () => {
    setProveedorId("")
    setLineas([])
    setAgregar("")
    onCerrar()
  }

  const elegirProveedor = (id: string) => {
    setProveedorId(id)
    setAgregar("")
    setLineas(
      insumos
        .filter((i) => i.proveedorId === id && estadoInsumo(i) !== "ok")
        .map((i) => ({ insumoId: i.id, cantidad: String(Math.ceil(i.minimo * 2 - i.existencia)) })),
    )
  }

  const sumar = (id: string) => {
    const i = porId.get(id)
    if (!i) return
    setLineas([...lineas, { insumoId: id, cantidad: String(Math.max(1, Math.ceil(i.minimo))) }])
    setAgregar("")
  }

  const crear = async () => {
    setGuardando(true)
    const r = await hacer(() =>
      restauranteApi.accion<{ ok: true; compra: OrdenCompra }>({ tipo: "crearCompra", proveedorId, lineas: lineas.map((l) => ({ insumoId: l.insumoId, cantidad: num(l.cantidad) })) }),
    )
    setGuardando(false)
    if (r) {
      toast.success(`Orden ${r.compra.codigo} creada en borrador`)
      cerrar()
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>Elige el suplidor y lo que le vas a pedir. Queda en borrador hasta que la envíes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Suplidor</Label>
            <Select value={proveedorId} onValueChange={elegirProveedor}>
              <SelectTrigger aria-label="Suplidor"><SelectValue placeholder="Elige un suplidor" /></SelectTrigger>
              <SelectContent>
                {PROVEEDORES.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {proveedorId && <p className="text-xs text-muted-foreground">{PROVEEDORES.find((p) => p.id === proveedorId)?.dias}. Ya puse lo que está bajo el mínimo.</p>}
          </div>

          {proveedorId && (
            <div className="grid gap-2">
              <Label>Lo que se pide</Label>
              {lineas.length ? (
                <ul className="divide-y rounded-lg border">
                  {lineas.map((l, k) => {
                    const i = porId.get(l.insumoId)!
                    return (
                      <li key={l.insumoId} className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{i.nombre}</div>
                          <div className="text-[11px] text-muted-foreground">Hay {conUnidad(i.existencia, i.unidad)} · {rd(i.costo)}/{UNIDAD[i.unidad][0]}</div>
                        </div>
                        <Input
                          aria-label={`Cantidad de ${i.nombre}`}
                          inputMode="decimal"
                          value={l.cantidad}
                          onChange={(e) => setLineas(lineas.map((x, j) => (j === k ? { ...x, cantidad: e.target.value } : x)))}
                          className="h-8 w-16 text-right tabular-nums"
                        />
                        <span className="w-12 text-xs text-muted-foreground">{UNIDAD[i.unidad][1]}</span>
                        <span className="hidden w-24 text-right text-sm tabular-nums sm:block">{rd(num(l.cantidad) * i.costo)}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Quitar ${i.nombre}`} onClick={() => setLineas(lineas.filter((_, j) => j !== k))}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Agrega insumos de este suplidor.</p>
              )}
              {disponibles.length > 0 && (
                <Select value={agregar} onValueChange={sumar}>
                  <SelectTrigger aria-label="Agregar insumo"><SelectValue placeholder="Agregar insumo" /></SelectTrigger>
                  <SelectContent>
                    {disponibles.map((i) => <SelectItem key={i.id} value={i.id}>{i.nombre} · hay {conUnidad(i.existencia, i.unidad)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-semibold tabular-nums">{rd(total)}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button onClick={crear} disabled={guardando || !proveedorId || !lineas.some((l) => num(l.cantidad) > 0)}>Crear borrador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogoPagar({ compra, onCerrar, cajaAbierta }: { compra: OrdenCompra | null; onCerrar: () => void; cajaAbierta: boolean }) {
  const [metodo, setMetodo] = useState<MetodoPago>("transferencia")
  const [deCaja, setDeCaja] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cerrar = () => {
    setMetodo("transferencia")
    setDeCaja(false)
    onCerrar()
  }

  const pagar = async () => {
    if (!compra) return
    setGuardando(true)
    const r = await hacer(
      () => restauranteApi.accion({ tipo: "pagarCompra", compraId: compra.id, metodo, deCaja: metodo === "efectivo" && deCaja }),
      `${compra.codigo} pagada${metodo === "efectivo" && deCaja ? " de la caja" : ""}`,
    )
    setGuardando(false)
    if (r) cerrar()
  }

  return (
    <Dialog open={!!compra} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar {compra?.codigo}</DialogTitle>
          <DialogDescription>{compra ? `${nombreProveedor(compra.proveedorId)} · ${rd(compra.total)}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Cómo se pagó</Label>
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodo(m.id)}
                  aria-pressed={metodo === m.id}
                  className={cn("h-10 rounded-control border text-sm font-medium transition-colors", metodo === m.id ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          </div>
          {metodo === "efectivo" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div>
                <Label htmlFor="de-caja">Pagado de la caja</Label>
                <p className="text-xs text-muted-foreground">{cajaAbierta ? "Sale como gasto en el cuadre de hoy." : "La caja está cerrada."}</p>
              </div>
              <Switch id="de-caja" checked={deCaja} onCheckedChange={setDeCaja} disabled={!cajaAbierta} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button onClick={pagar} disabled={guardando}>Registrar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
