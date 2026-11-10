"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { CalendarDays, Camera, CircleAlert, Clock, Info, Plus, Receipt, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { fechaLocal, hora12, horaLocal, ZONA_HORARIA } from "@/lib/restaurante/local"
import type { CategoriaGasto, Gasto } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { useDetalle } from "@/components/restaurante/administracion/contexto"
import { Detalles } from "@/components/restaurante/administracion/Panel"

const DIA = 24 * 3600 * 1000
const MAX_COMPROBANTE = 300 * 1024

const CATEGORIAS: { id: CategoriaGasto; nombre: string; color: string }[] = [
  { id: "insumos", nombre: "Insumos", color: "#0B2A2E" },
  { id: "nomina", nombre: "Nómina", color: "#E8866A" },
  { id: "servicios", nombre: "Servicios", color: "#7FCFCB" },
  { id: "mantenimiento", nombre: "Mantenimiento", color: "#C9A86A" },
  { id: "otros", nombre: "Otros", color: "#9CA3AF" },
]
const NOMBRE_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nombre])) as Record<CategoriaGasto, string>

const METODOS: { id: Gasto["metodo"]; nombre: string }[] = [
  { id: "efectivo", nombre: "Efectivo" },
  { id: "tarjeta", nombre: "Tarjeta" },
  { id: "transferencia", nombre: "Transferencia" },
  { id: "credito", nombre: "Crédito (por pagar)" },
]
const NOMBRE_METODO = Object.fromEntries(METODOS.map((m) => [m.id, m.nombre])) as Record<Gasto["metodo"], string>

const fmtFecha = new Intl.DateTimeFormat("es-DO", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "short",
})
const suma = (l: Gasto[]) => l.reduce((s, g) => s + g.monto, 0)

export default function GastosPage() {
  return (
    <Detalles>
      <PantallaGastos />
    </Detalles>
  )
}

function PantallaGastos() {
  const { estado, ahora } = useRestaurante()
  const [gastos, setGastos] = useState<Gasto[] | null>(null)
  const [filtro, setFiltro] = useState<CategoriaGasto | "todas">("todas")
  const [nuevo, setNuevo] = useState(false)
  const { abrir } = useDetalle()
  const ver = (g: Gasto) => abrir({ tipo: "gasto", id: g.id, gasto: g })
  const [mostrar, setMostrar] = useState(40)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/srv/restaurante/gastos?dias=30")
      if (!r.ok) throw new Error("No se pudieron cargar los gastos")
      setGastos(await r.json())
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 20_000)
    return () => clearInterval(t)
  }, [cargar])

  const datos = useMemo(() => {
    if (!gastos) return null
    const hoy = fechaLocal(ahora)
    const credito = gastos.filter((g) => g.metodo === "credito")
    const porCategoria = CATEGORIAS.map((c) => ({
      ...c,
      total: suma(gastos.filter((g) => g.categoria === c.id)),
    }))
    return {
      hoy: suma(gastos.filter((g) => fechaLocal(g.ts) === hoy)),
      semana: suma(gastos.filter((g) => g.ts >= ahora - 7 * DIA)),
      mes: suma(gastos),
      credito: { cuantos: credito.length, total: suma(credito) },
      porCategoria,
      mayor: Math.max(1, ...porCategoria.map((c) => c.total)),
    }
  }, [gastos, Math.floor(ahora / 60_000)]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = gastos?.filter((g) => filtro === "todas" || g.categoria === filtro) ?? []
  const lista = filtrados.slice(0, mostrar)

  return (
    <AdminLayout title="Gastos">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">Lo que sale del negocio</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Gastos</h1>
            <p className="text-sm text-muted-foreground">Insumos, nómina, servicios y lo que se paga de la caja, en los últimos 30 días.</p>
          </div>
          <Button className="h-11 gap-2" onClick={() => setNuevo(true)}>
            <Plus className="h-4 w-4" /> Nuevo gasto
          </Button>
        </header>

        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> Montos de ejemplo: Boca Marina todavía no ha compartido sus gastos reales.
        </p>

        {!datos ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Cuadro titulo="Gastos de hoy" valor={rd(datos.hoy)} icono={Clock} />
              <Cuadro titulo="Últimos 7 días" valor={rd(datos.semana)} icono={CalendarDays} />
              <Cuadro titulo="Últimos 30 días" valor={rd(datos.mes)} icono={Receipt} />
              <Cuadro
                titulo="Cuentas por pagar"
                valor={rd(datos.credito.total)}
                sub={`${datos.credito.cuantos} ${datos.credito.cuantos === 1 ? "gasto a crédito" : "gastos a crédito"}`}
                icono={CircleAlert}
                resaltar={datos.credito.cuantos > 0}
              />
            </div>

            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por categoría, 30 días</h2>
              <div className="flex flex-col gap-2.5">
                {datos.porCategoria.map((c) => (
                  <div key={c.id} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_8rem]">
                    <span className="truncate">{c.nombre}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(c.total / datos.mayor) * 100}%`,
                          background: c.color,
                        }}
                      />
                    </div>
                    <span className="text-right font-medium tabular-nums">{rd(c.total)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {(["todas", ...CATEGORIAS.map((c) => c.id)] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setFiltro(c)
                      setMostrar(40)
                    }}
                    className={cn("min-h-[44px] rounded-full border px-4 text-sm", filtro === c ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}
                  >
                    {c === "todas" ? "Todas" : NOMBRE_CATEGORIA[c]}
                  </button>
                ))}
              </div>
              {lista.length ? (
                <>
                  <ul className="flex flex-col gap-2 sm:hidden">
                    {lista.map((g) => (
                      <li key={g.id}>
                        <button type="button" onClick={() => ver(g)} className="flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left text-sm transition-colors hover:bg-secondary/40">
                          {g.comprobante && (
                            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-md border">
                              <img src={g.comprobante} alt="" className="h-full w-full object-cover" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{g.descripcion}</div>
                            <div className="text-xs text-muted-foreground">
                              {fmtFecha.format(new Date(g.ts))}, {hora12(horaLocal(g.ts))} · {NOMBRE_CATEGORIA[g.categoria]}
                            </div>
                            <div className={cn("text-xs", g.metodo === "credito" ? "font-medium text-amber-700" : "text-muted-foreground")}>
                              {NOMBRE_METODO[g.metodo]}
                              {g.deCaja ? " · de caja" : ""}
                            </div>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">{rd(g.monto)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="border-b text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Fecha y hora</th>
                          <th className="px-4 py-2 font-medium">Descripción</th>
                          <th className="px-4 py-2 font-medium">Categoría</th>
                          <th className="px-4 py-2 font-medium">Método</th>
                          <th className="px-4 py-2 font-medium">De caja</th>
                          <th className="px-4 py-2 text-right font-medium">Monto</th>
                          <th className="px-4 py-2 font-medium">Comprobante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lista.map((g) => (
                          <tr
                            key={g.id}
                            tabIndex={0}
                            role="button"
                            onClick={() => ver(g)}
                            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), ver(g))}
                            className="cursor-pointer transition-colors hover:bg-secondary/60"
                          >
                            <td className="whitespace-nowrap px-4 py-3">
                              {fmtFecha.format(new Date(g.ts))}
                              <div className="text-xs text-muted-foreground">{hora12(horaLocal(g.ts))}</div>
                            </td>
                            <td className="px-4 py-3">
                              {g.descripcion}
                              <div className="text-xs text-muted-foreground">{g.quien}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    background: CATEGORIAS.find((c) => c.id === g.categoria)?.color,
                                  }}
                                />
                                {NOMBRE_CATEGORIA[g.categoria]}
                              </span>
                            </td>
                            <td className={cn("px-4 py-3", g.metodo === "credito" && "font-medium text-amber-700")}>{NOMBRE_METODO[g.metodo]}</td>
                            <td className="px-4 py-3">{g.deCaja ? "Sí" : "No"}</td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">{rd(g.monto)}</td>
                            <td className="px-4 py-3">
                              {g.comprobante ? (
                                <span className="block h-11 w-11 overflow-hidden rounded-md border">
                                  <img src={g.comprobante} alt="Comprobante" className="h-full w-full object-cover" />
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filtrados.length > mostrar && (
                    <Button variant="outline" className="h-11 self-center" onClick={() => setMostrar((n) => n + 40)}>
                      Ver más ({filtrados.length - mostrar} restantes)
                    </Button>
                  )}
                </>
              ) : (
                <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No hay gastos en esta categoría en los últimos 30 días.</p>
              )}
            </section>
          </>
        )}
      </div>

      {nuevo && (
        <DialogoGasto
          cajaAbierta={!!estado?.caja}
          onCerrar={() => setNuevo(false)}
          onGuardado={() => {
            setNuevo(false)
            cargar()
          }}
        />
      )}
    </AdminLayout>
  )
}

function Cuadro({ titulo, valor, sub, icono: Icono, resaltar }: { titulo: string; valor: string; sub?: string; icono: typeof Clock; resaltar?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", resaltar && "border-amber-300 bg-amber-50")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icono className="h-4 w-4" /> {titulo}
      </div>
      <div className="mt-1 font-display text-xl tabular-nums sm:text-3xl">{valor}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function DialogoGasto({ cajaAbierta, onCerrar, onGuardado }: { cajaAbierta: boolean; onCerrar: () => void; onGuardado: () => void }) {
  const [categoria, setCategoria] = useState<CategoriaGasto>("insumos")
  const [descripcion, setDescripcion] = useState("")
  const [valor, setValor] = useState("")
  const [metodo, setMetodo] = useState<Gasto["metodo"]>("efectivo")
  const [deCaja, setDeCaja] = useState(cajaAbierta)
  const [comprobante, setComprobante] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  const monto = Number(valor.replace(/[^\d.]/g, ""))

  // La foto del teléfono se achica a 1200 px en JPEG antes de guardarla.
  const leerFoto = async (f?: File) => {
    if (!f) return
    try {
      const img = await createImageBitmap(f)
      const escala = Math.min(1, 1200 / Math.max(img.width, img.height))
      const lienzo = document.createElement("canvas")
      lienzo.width = Math.round(img.width * escala)
      lienzo.height = Math.round(img.height * escala)
      lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      let datos = lienzo.toDataURL("image/jpeg", 0.75)
      if (datos.length * 0.75 > MAX_COMPROBANTE) datos = lienzo.toDataURL("image/jpeg", 0.5)
      if (datos.length * 0.75 > MAX_COMPROBANTE) return toast.error("No se pudo achicar la foto: guarda el gasto sin ella")
      setComprobante(datos)
    } catch {
      toast.error("No se pudo leer la foto")
    }
  }

  const guardar = async () => {
    setEnviando(true)
    try {
      await restauranteApi.accion({
        tipo: "gasto",
        categoria,
        descripcion: descripcion.trim(),
        monto,
        metodo,
        deCaja: metodo === "efectivo" && deCaja,
        comprobante,
      })
      toast.success(`Gasto de ${rd(monto)} guardado`)
      onGuardado()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nuevo gasto</DialogTitle>
          <DialogDescription>Anota lo que se pagó o lo que queda por pagar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Categoría</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaGasto)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gs-desc">Descripción</Label>
            <Input id="gs-desc" className="h-11" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Gas propano, factura de luz…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gs-monto">Monto (RD$)</Label>
            <Input id="gs-monto" className="h-11" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Método</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as Gasto["metodo"])}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODOS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {metodo === "efectivo" && (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3">
              <Checkbox checked={deCaja} onCheckedChange={(v) => setDeCaja(v === true)} disabled={!cajaAbierta} />
              <span className="text-sm">
                Pagado de la caja
                {!cajaAbierta && <span className="block text-xs text-muted-foreground">La caja está cerrada</span>}
              </span>
            </label>
          )}
          <div className="grid gap-1.5">
            <Label>Foto del comprobante</Label>
            {comprobante ? (
              <div className="flex items-center gap-3">
                <img src={comprobante} alt="Comprobante" className="h-16 w-16 rounded-md border object-cover" />
                <Button variant="outline" className="h-11 gap-2" onClick={() => setComprobante(undefined)}>
                  <X className="h-4 w-4" /> Quitar
                </Button>
              </div>
            ) : (
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted">
                <Camera className="h-4 w-4" /> Tomar o elegir una foto (opcional)
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => leerFoto(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="h-11" disabled={enviando || !(monto > 0) || !descripcion.trim()} onClick={guardar}>
            Guardar gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
