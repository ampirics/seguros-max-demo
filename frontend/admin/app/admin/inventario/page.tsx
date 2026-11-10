"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { AlertTriangle, Boxes, ChevronDown, ChevronRight, CircleSlash, Info, PackageX, Search, ShoppingCart, TrendingDown, Wallet } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CARTA, CATEGORIAS, rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { estadoInsumo, margen, platosAgotados, platosCon, PROVEEDORES, RECETAS } from "@/lib/restaurante/inventario"
import type { Insumo, OrdenCompra } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { useDetalle } from "@/components/restaurante/administracion/contexto"
import { Detalles } from "@/components/restaurante/administracion/Panel"

const NOTA_EJEMPLO = "Costos, existencias y proveedores de ejemplo: Boca Marina todavía no ha compartido los suyos."
const MOTIVOS = ["Conteo físico", "Merma", "Se dañó", "Consumo del personal", "Corrección"]

const cant = (n: number) => n.toLocaleString("es-DO", { maximumFractionDigits: 2 })
const UNIDAD: Record<Insumo["unidad"], [string, string]> = { kg: ["kg", "kg"], l: ["l", "l"], unidad: ["unidad", "unidades"], botella: ["botella", "botellas"] }
const conUnidad = (n: number, u: Insumo["unidad"]) => `${cant(n)} ${UNIDAD[u][n === 1 ? 0 : 1]}`
const nombreProveedor = (id: string) => PROVEEDORES.find((p) => p.id === id)?.nombre ?? id

function NotaEjemplo() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-dashed bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {NOTA_EJEMPLO}
    </p>
  )
}

function ChipEstado({ estado }: { estado: ReturnType<typeof estadoInsumo> }) {
  const e = { ok: ["OK", "bg-success-soft text-success"], bajo: ["Bajo", "bg-warning-soft text-warning"], agotado: ["Agotado", "bg-destructive-soft text-destructive"] }[estado]
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", e[1])}>{e[0]}</span>
}

function Barra({ i }: { i: Insumo }) {
  const tope = Math.max(i.minimo * 2, i.existencia, 0.001)
  const e = estadoInsumo(i)
  return (
    <span className="relative block h-1.5 w-20 overflow-hidden rounded-full bg-secondary" aria-hidden>
      <span className={cn("block h-full rounded-full", e === "ok" ? "bg-success" : e === "bajo" ? "bg-warning" : "bg-destructive")} style={{ width: `${(i.existencia / tope) * 100}%` }} />
      <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${(i.minimo / tope) * 100}%` }} />
    </span>
  )
}

function toastCompras(compras: OrdenCompra[]) {
  toast.success(
    () => (
      <span className="text-sm">
        {compras.length === 1 ? "Orden creada" : "Órdenes creadas"}: {compras.map((c) => c.codigo).join(", ")}.{" "}
        <Link href="/admin/compras" className="font-medium underline">Ver compras</Link>
      </span>
    ),
    { duration: 6000 },
  )
}

async function pedirLoQueFalta(proveedorId?: string) {
  try {
    const r = await restauranteApi.accion<{ ok: true; compras: OrdenCompra[] }>({ tipo: "compraSugerida", proveedorId })
    toastCompras(r.compras)
  } catch (e) {
    toast.error((e as Error).message)
  }
}

export default function InventarioPage() {
  return (
    <Detalles>
      <PantallaInventario />
    </Detalles>
  )
}

function PantallaInventario() {
  const { estado } = useRestaurante()
  const [ajustar, setAjustar] = useState<Insumo | null>(null)
  const insumos = useMemo(() => estado?.insumos ?? [], [estado?.insumos])
  const agotadosHoy = useMemo(() => platosAgotados(insumos), [insumos])

  if (!estado) {
    return (
      <AdminLayout title="Inventario">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    )
  }

  const agotados = insumos.filter((i) => estadoInsumo(i) === "agotado")
  const bajos = insumos.filter((i) => estadoInsumo(i) === "bajo")
  const valor = insumos.reduce((s, i) => s + i.existencia * i.costo, 0)
  const pendientes = new Set((estado.compras ?? []).filter((c) => c.estado === "borrador" || c.estado === "enviada").flatMap((c) => c.lineas.map((l) => l.insumoId)))
  const sinPedir = [...agotados, ...bajos].filter((i) => !pendientes.has(i.id)).length

  const indicadores = [
    { t: "Insumos", v: insumos.length, s: `${new Set(insumos.map((i) => i.categoria)).size} categorías`, icono: Boxes },
    { t: "Bajo el mínimo", v: bajos.length, s: "Hay que pedir pronto", icono: TrendingDown, alerta: bajos.length > 0 },
    { t: "Agotados", v: agotados.length, s: "Sin existencia", icono: PackageX, alerta: agotados.length > 0 },
    { t: "Platos agotados hoy", v: agotadosHoy.size, s: `De ${CARTA.length} en la carta`, icono: CircleSlash, alerta: agotadosHoy.size > 0 },
    { t: "Valor del inventario", v: rd(valor), s: "Existencia por costo", icono: Wallet, ancho: true },
  ]

  return (
    <AdminLayout title="Inventario">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">Cocina y almacén</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Inventario</h1>
            <p className="text-sm text-muted-foreground">Lo que hay en almacén, lo que falta y cuánto cuesta cada plato. Baja solo con cada plato que sale a cocina.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/compras"><ShoppingCart className="h-4 w-4" aria-hidden /> Compras</Link>
          </Button>
        </header>

        <NotaEjemplo />

        {(agotados.length > 0 || bajos.length > 0) && (
          <section className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">
                    {agotados.length ? `${agotados.length} ${agotados.length === 1 ? "insumo agotado" : "insumos agotados"}` : ""}
                    {agotados.length && bajos.length ? " y " : ""}
                    {bajos.length ? `${bajos.length} bajo el mínimo` : ""}
                  </h2>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                    {[...agotados, ...bajos].map((i) => (
                      <li key={i.id}>
                        <AvisoInsumo i={i} />
                        {pendientes.has(i.id) && <span className="ml-1.5 text-xs text-muted-foreground">(ya está pedido)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button onClick={() => pedirLoQueFalta()} disabled={!sinPedir} className="shrink-0">
                <ShoppingCart className="h-4 w-4" aria-hidden /> Pedir lo que falta
              </Button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {indicadores.map((x) => (
            <div key={x.t} className={cn("rounded-lg border bg-card px-4 py-3", x.alerta && "border-warning/40 bg-warning-soft", x.ancho && "col-span-2 sm:col-span-1")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{x.t}</span>
                <x.icono className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </div>
              <div className="mt-1 truncate text-2xl font-semibold tabular-nums">{x.v}</div>
              <div className="truncate text-[11px] text-muted-foreground">{x.s}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="insumos" className="min-w-0">
          <TabsList className="mb-3">
            <TabsTrigger value="insumos">Insumos</TabsTrigger>
            <TabsTrigger value="recetas">Recetas y costo</TabsTrigger>
          </TabsList>
          <TabsContent value="insumos" className="mt-0">
            <Insumos insumos={insumos} onAjustar={setAjustar} />
          </TabsContent>
          <TabsContent value="recetas" className="mt-0">
            <Recetas insumos={insumos} agotados={agotadosHoy} />
          </TabsContent>
        </Tabs>
      </div>
      <DialogoAjuste insumo={ajustar} onCerrar={() => setAjustar(null)} />
    </AdminLayout>
  )
}

function AvisoInsumo({ i }: { i: Insumo }) {
  const { abrir } = useDetalle()
  const platos = platosCon(i.id)
  const agotado = estadoInsumo(i) === "agotado"
  const efecto = !platos.length
    ? "no lo usa ningún plato"
    : agotado
      ? platos.length <= 3
        ? `${platos.map((p) => p.nombre).join(", ")} no se ${platos.length === 1 ? "puede" : "pueden"} vender`
        : `${platos.length} platos no se pueden vender`
      : `afecta ${platos.length === 1 ? platos[0].nombre : `${platos.length} platos`}`
  return (
    <button type="button" onClick={() => abrir({ tipo: "insumo", id: i.id })} className="min-h-[32px] text-left underline-offset-4 hover:underline">
      <span className="font-medium">{i.nombre}</span> {agotado ? "agotado" : `bajo el mínimo (${conUnidad(i.existencia, i.unidad)} de ${cant(i.minimo)})`}: {efecto}
    </button>
  )
}

function Insumos({ insumos, onAjustar }: { insumos: Insumo[]; onAjustar: (i: Insumo) => void }) {
  const { abrir } = useDetalle()
  const ver = (i: Insumo) => abrir({ tipo: "insumo", id: i.id })
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("todas")
  const [filtro, setFiltro] = useState("todos")
  const categorias = Array.from(new Set(insumos.map((i) => i.categoria)))
  const lista = insumos.filter(
    (i) =>
      (!q || i.nombre.toLowerCase().includes(q.toLowerCase())) &&
      (cat === "todas" || i.categoria === cat) &&
      (filtro === "todos" || (filtro === "bajo" ? estadoInsumo(i) !== "ok" : estadoInsumo(i) === "agotado")),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo" className="h-9 pl-9" aria-label="Buscar insumo" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-9 w-[12rem]" aria-label="Filtrar por categoría"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="h-9 w-[11rem]" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="bajo">Bajo el mínimo</SelectItem>
            <SelectItem value="agotado">Agotados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!lista.length ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Ningún insumo cumple esos filtros.</div>
      ) : (
        <>
          <div className="hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Existencia</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => ver(i)}>
                    <TableCell>
                      <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={(e) => (e.stopPropagation(), ver(i))}>{i.nombre}</button>
                      <div className="text-xs text-muted-foreground">{i.categoria}</div>
                    </TableCell>
                    <TableCell>
                      <div className="tabular-nums">{conUnidad(i.existencia, i.unidad)}</div>
                      <Barra i={i} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{cant(i.minimo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rd(i.costo)}<span className="text-xs text-muted-foreground">/{UNIDAD[i.unidad][0]}</span></TableCell>
                    <TableCell className="text-sm">{nombreProveedor(i.proveedorId)}</TableCell>
                    <TableCell><ChipEstado estado={estadoInsumo(i)} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={(e) => (e.stopPropagation(), onAjustar(i))}>Ajustar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {lista.map((i) => (
              <li key={i.id} className="cursor-pointer rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-secondary/40" onClick={() => ver(i)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="min-h-[32px] text-left font-medium" onClick={(e) => (e.stopPropagation(), ver(i))}>{i.nombre}</button>
                      <ChipEstado estado={estadoInsumo(i)} />
                    </div>
                    <div className="text-xs text-muted-foreground">{i.categoria} · {nombreProveedor(i.proveedorId)}</div>
                  </div>
                  <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={(e) => (e.stopPropagation(), onAjustar(i))}>Ajustar</Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="tabular-nums">{conUnidad(i.existencia, i.unidad)}</span>
                  <Barra i={i} />
                  <span className="text-xs text-muted-foreground">Mínimo {cant(i.minimo)} · {rd(i.costo)}/{UNIDAD[i.unidad][0]}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function colorPct(pct: number) {
  return pct <= 35 ? "text-success" : pct <= 45 ? "text-warning" : "text-destructive"
}

function Recetas({ insumos, agotados }: { insumos: Insumo[]; agotados: Set<string> }) {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("todas")
  const [abierto, setAbierto] = useState<string | null>(null)
  const { abrir } = useDetalle()
  const porId = new Map(insumos.map((i) => [i.id, i]))
  const lista = CARTA.filter((p) => RECETAS[p.id] && (!q || p.nombre.toLowerCase().includes(q.toLowerCase())) && (cat === "todas" || p.categoria === cat))

  const detalle = (platoId: string) => (
    <ul className="flex flex-col gap-1 py-1 text-sm">
      {Object.entries(RECETAS[platoId] ?? {}).map(([id, c]) => {
        const i = porId.get(id)
        const falta = (i?.existencia ?? 0) < c
        return (
          <li key={id}>
            <button type="button" onClick={() => abrir({ tipo: "insumo", id })} className="flex min-h-[44px] w-full flex-wrap items-center justify-between gap-x-3 rounded-md px-2 text-left hover:bg-background/70">
              <span className={cn("min-w-0 underline-offset-4 hover:underline", falta && "text-destructive")}>
                {i?.nombre ?? id}
                {falta && <span className="ml-1.5 rounded-full bg-destructive-soft px-1.5 py-0.5 text-[10px] font-medium">No alcanza</span>}
              </span>
              <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                <span>{i ? conUnidad(c, i.unidad) : cant(c)}</span>
                <span className="w-20 text-right text-foreground">{rd(c * (i?.costo ?? 0))}</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plato" className="h-9 pl-9" aria-label="Buscar plato" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-9 w-[12rem]" aria-label="Filtrar por categoría"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">Food cost: hasta 35 % está bien, de 35 a 45 % hay que vigilarlo, más de 45 % se come la ganancia. Costos de ejemplo.</p>

      {!lista.length ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Ningún plato cumple esos filtros.</div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plato</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Precio</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Costo</TableHead>
                <TableHead className="hidden text-right md:table-cell">Margen</TableHead>
                <TableHead className="text-right">Food cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => {
                const m = margen(p.id, insumos)!
                const ab = abierto === p.id
                return (
                  <Fragment key={p.id}>
                    <TableRow className="cursor-pointer" onClick={() => setAbierto(ab ? null : p.id)} aria-expanded={ab}>
                      <TableCell>
                        <div className="flex items-start gap-1.5">
                          {ab ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                          <div className="min-w-0">
                            <span className="font-medium">{p.nombre}</span>
                            {agotados.has(p.id) && <span className="ml-2 inline-flex rounded-full bg-destructive-soft px-2 py-0.5 text-[11px] font-medium text-destructive">Agotado</span>}
                            <div className="text-xs text-muted-foreground">
                              {p.categoria}
                              <span className="sm:hidden"> · {rd(p.precio)}{p.porLibra ? "/lb" : ""} · costo {rd(m.costo)}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{rd(p.precio)}{p.porLibra ? "/lb" : ""}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{rd(m.costo)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{rd(m.precio - m.costo)}</TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", colorPct(m.pct))}>{m.pct} %</TableCell>
                    </TableRow>
                    {ab && (
                      <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                        <TableCell colSpan={5} className="pl-10">{detalle(p.id)}</TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function DialogoAjuste({ insumo, onCerrar }: { insumo: Insumo | null; onCerrar: () => void }) {
  const [valor, setValor] = useState("")
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [guardando, setGuardando] = useState(false)
  const [visto, setVisto] = useState<string | null>(null)
  if (insumo && visto !== insumo.id) {
    setVisto(insumo.id)
    setValor(String(insumo.existencia))
    setMotivo(MOTIVOS[0])
  }
  if (!insumo && visto) setVisto(null)

  const guardar = async () => {
    if (!insumo) return
    const n = Number(valor.replace(",", "."))
    if (!Number.isFinite(n) || n < 0) return toast.error("Escribe una existencia válida")
    setGuardando(true)
    try {
      await restauranteApi.accion({ tipo: "ajustarInsumo", insumoId: insumo.id, existencia: n, motivo })
      toast.success(`${insumo.nombre}: ${conUnidad(n, insumo.unidad)}`)
      onCerrar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!insumo} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar {insumo?.nombre.toLowerCase()}</DialogTitle>
          <DialogDescription>Hay {insumo ? conUnidad(insumo.existencia, insumo.unidad) : ""} en el sistema. Anota lo que contaste y por qué cambia.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="existencia">Nueva existencia ({insumo ? UNIDAD[insumo.unidad][1] : ""})</Label>
            <Input id="existencia" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardar()} />
          </div>
          <div className="grid gap-1.5">
            <Label>Motivo</Label>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  aria-pressed={motivo === m}
                  className={cn("h-8 rounded-full border px-3 text-xs font-medium transition-colors", motivo === m ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {insumo && (
            <p className="text-xs text-muted-foreground">
              Lo usan {platosCon(insumo.id).length} platos{platosCon(insumo.id).length ? `: ${platosCon(insumo.id).slice(0, 4).map((p) => p.nombre).join(", ")}${platosCon(insumo.id).length > 4 ? "…" : ""}` : ""}.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

