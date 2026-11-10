"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, Landmark, Lock, Receipt, Wallet } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { hora12, horaLocal, ZONA_HORARIA } from "@/lib/restaurante/local"
import type { Caja, CategoriaGasto } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { resumenCaja } from "@/components/restaurante/administracion/comun"
import { useDetalle } from "@/components/restaurante/administracion/contexto"
import { FilaMovimiento } from "@/components/restaurante/administracion/DetalleCaja"
import { Detalles } from "@/components/restaurante/administracion/Panel"

const fmtFecha = new Intl.DateTimeFormat("es-DO", {
  timeZone: ZONA_HORARIA,
  weekday: "short",
  day: "numeric",
  month: "short",
})

const CATEGORIAS_GASTO: { id: CategoriaGasto; nombre: string }[] = [
  { id: "insumos", nombre: "Insumos" },
  { id: "nomina", nombre: "Nómina" },
  { id: "servicios", nombre: "Servicios" },
  { id: "mantenimiento", nombre: "Mantenimiento" },
  { id: "otros", nombre: "Otros" },
]

const hora = (ts: number) => hora12(horaLocal(ts))
const monto = (v: string) => Number(v.replace(/[^\d.]/g, ""))

export default function CajaPage() {
  return (
    <Detalles>
      <PantallaCaja />
    </Detalles>
  )
}

function PantallaCaja() {
  const { estado } = useRestaurante()
  const [dialogo, setDialogo] = useState<"ingreso" | "retiro" | "gasto" | "cerrar" | null>(null)
  const [cierre, setCierre] = useState<Caja | null>(null)
  const caja = estado?.caja

  return (
    <AdminLayout title="Caja">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">Efectivo del turno</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Caja</h1>
            {caja ? (
              <p className="text-sm text-muted-foreground">
                Abierta por <span className="font-medium text-foreground">{caja.cajero}</span> a las {hora(caja.abierta)} con un fondo de {rd(caja.fondo)}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Abre la caja al empezar el turno y ciérrala contando el efectivo.</p>
            )}
          </div>
          {caja && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 gap-2" onClick={() => setDialogo("ingreso")}>
                <ArrowDownLeft className="h-4 w-4" /> Ingreso
              </Button>
              <Button variant="outline" className="h-11 gap-2" onClick={() => setDialogo("retiro")}>
                <ArrowUpRight className="h-4 w-4" /> Retiro
              </Button>
              <Button variant="outline" className="h-11 gap-2" onClick={() => setDialogo("gasto")}>
                <Receipt className="h-4 w-4" /> Gasto de caja
              </Button>
              <Button className="h-11 gap-2" onClick={() => setDialogo("cerrar")}>
                <Lock className="h-4 w-4" /> Cerrar caja
              </Button>
            </div>
          )}
        </header>

        {!estado ? (
          <Skeleton className="h-96 w-full" />
        ) : caja ? (
          <CajaAbierta caja={caja} />
        ) : (
          <>
            {cierre && <ResultadoCierre caja={cierre} />}
            <AbrirCaja />
          </>
        )}

        {estado && <Cierres cajas={estado.cajasCerradas ?? []} />}
      </div>

      {caja && (dialogo === "ingreso" || dialogo === "retiro") && <DialogoMovimiento tipo={dialogo} onCerrar={() => setDialogo(null)} />}
      {caja && dialogo === "gasto" && <DialogoGastoCaja onCerrar={() => setDialogo(null)} />}
      {caja && dialogo === "cerrar" && (
        <DialogoCerrar
          caja={caja}
          onCerrar={() => setDialogo(null)}
          onCerrada={(c) => {
            setCierre(c)
            setDialogo(null)
          }}
        />
      )}
    </AdminLayout>
  )
}

function AbrirCaja() {
  const [cajero, setCajero] = useState("Mariel Santana")
  const [fondo, setFondo] = useState("5000")
  const [enviando, setEnviando] = useState(false)

  const abrir = async () => {
    setEnviando(true)
    try {
      await restauranteApi.accion({
        tipo: "abrirCaja",
        cajero: cajero.trim(),
        fondo: monto(fondo),
      })
      toast.success("Caja abierta")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">La caja está cerrada</h2>
          <p className="text-sm text-muted-foreground">Anota quién la maneja y con cuánto efectivo empieza.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="cj-cajero">Cajero</Label>
          <Input id="cj-cajero" className="h-11" value={cajero} onChange={(e) => setCajero(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cj-fondo">Fondo inicial (RD$)</Label>
          <Input id="cj-fondo" className="h-11" inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} />
        </div>
      </div>
      <Button className="h-11 gap-2 self-start" disabled={enviando || !cajero.trim() || fondo.trim() === ""} onClick={abrir}>
        <Wallet className="h-4 w-4" /> Abrir caja
      </Button>
    </section>
  )
}

function CajaAbierta({ caja }: { caja: Caja }) {
  const r = resumenCaja(caja)
  const movimientos = caja.movimientos.slice().sort((a, b) => b.ts - a.ts)
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 rounded-xl border border-[#0B2A2E] bg-[#0B2A2E] p-4 text-[#F4ECDF] lg:col-span-1">
          <div className="flex items-center gap-2 text-xs opacity-80">
            <Wallet className="h-4 w-4" /> Efectivo esperado en caja
          </div>
          <div className="mt-1 font-display text-3xl tabular-nums">{rd(r.esperado)}</div>
          <div className="text-[11px] opacity-70">Fondo + ventas en efectivo + ingresos − salidas</div>
        </div>
        <Cuadro titulo="Ventas en efectivo" valor={rd(r.ventas.efectivo)} icono={Banknote} />
        <Cuadro titulo="Tarjeta" valor={rd(r.ventas.tarjeta)} icono={CreditCard} />
        <Cuadro titulo="Transferencia" valor={rd(r.ventas.transferencia)} icono={Landmark} />
        <Cuadro
          titulo="Ingresos / retiros"
          valor={
            <span className="flex flex-col text-xl leading-tight">
              <span>+ {rd(r.ingresos)}</span>
              <span className={cn(r.retiros > 0 && "text-red-600")}>− {rd(r.retiros)}</span>
            </span>
          }
          sub={r.gastos ? `Gastos pagados de caja: ${rd(r.gastos)}` : undefined}
          icono={ArrowDownLeft}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Movimientos del turno <span className="font-normal">({movimientos.length})</span>
        </h2>
        {movimientos.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y">
              {movimientos.map((m, i) => (
                <li key={`${m.ts}-${i}`}>
                  <FilaMovimiento m={m} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Todavía no hay movimientos. Las cuentas que se cobren aparecen aquí solas.</p>
        )}
      </section>
    </>
  )
}

function Cuadro({ titulo, valor, sub, icono: Icono }: { titulo: string; valor: React.ReactNode; sub?: string; icono: typeof Wallet }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icono className="h-4 w-4" /> {titulo}
      </div>
      <div className="mt-1 font-display text-xl tabular-nums sm:text-2xl">{valor}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function Diferencia({ valor, className }: { valor: number; className?: string }) {
  if (!valor) return <span className={cn("font-semibold text-emerald-700", className)}>Cuadrada</span>
  return (
    <span className={cn("font-semibold", valor > 0 ? "text-amber-700" : "text-red-600", className)}>
      {valor > 0 ? "Sobrante" : "Faltante"} {rd(Math.abs(valor))}
    </span>
  )
}

function ResultadoCierre({ caja }: { caja: Caja }) {
  const d = caja.diferencia ?? 0
  return (
    <section className={cn("flex max-w-xl flex-col gap-2 rounded-xl border p-5", !d ? "border-emerald-300 bg-emerald-50" : d > 0 ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50")}>
      <p className="etiqueta">Cierre de {caja.cajero}</p>
      <Diferencia valor={d} className="font-display text-3xl" />
      <p className="text-sm text-muted-foreground">
        Esperado {rd(caja.esperado ?? 0)} · contado {rd(caja.contado ?? 0)}
        {caja.nota ? ` · ${caja.nota}` : ""}
      </p>
    </section>
  )
}

function Cierres({ cajas }: { cajas: Caja[] }) {
  const { abrir } = useDetalle()
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cierres anteriores</h2>
      {cajas.length ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Cajero</th>
                <th className="px-4 py-2 text-right font-medium">Esperado</th>
                <th className="px-4 py-2 text-right font-medium">Contado</th>
                <th className="px-4 py-2 text-right font-medium">Diferencia</th>
                <th className="px-4 py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cajas.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver el cierre de ${fmtFecha.format(new Date(c.abierta))}`}
                  onClick={() => abrir({ tipo: "cierre", caja: c })}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), abrir({ tipo: "cierre", caja: c }))}
                  className="cursor-pointer transition-colors hover:bg-secondary/60"
                >
                  <td className="whitespace-nowrap px-4 py-3 first-letter:uppercase">
                    {fmtFecha.format(new Date(c.abierta))}
                    <div className="text-xs text-muted-foreground">
                      {hora(c.abierta)} a {c.cerrada ? hora(c.cerrada) : "…"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{c.cajero}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{rd(c.esperado ?? 0)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{rd(c.contado ?? 0)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    <Diferencia valor={c.diferencia ?? 0} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.nota ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Todavía no hay cierres.</p>
      )}
    </section>
  )
}

function DialogoMovimiento({ tipo, onCerrar }: { tipo: "ingreso" | "retiro"; onCerrar: () => void }) {
  const [valor, setValor] = useState("")
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)

  const guardar = async () => {
    setEnviando(true)
    try {
      await restauranteApi.accion({
        tipo: "movimientoCaja",
        movimiento: tipo,
        monto: monto(valor),
        texto: texto.trim(),
      })
      toast.success(`${tipo === "ingreso" ? "Ingreso" : "Retiro"} de ${rd(monto(valor))} anotado`)
      onCerrar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{tipo === "ingreso" ? "Ingreso de efectivo" : "Retiro de efectivo"}</DialogTitle>
          <DialogDescription>
            {tipo === "ingreso" ? "Efectivo que entra a la caja sin ser una venta, como cambio o un préstamo." : "Efectivo que sale de la caja, como un depósito al banco."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="mv-monto">Monto (RD$)</Label>
            <Input id="mv-monto" className="h-11" inputMode="decimal" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mv-texto">Motivo</Label>
            <Input id="mv-texto" className="h-11" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={tipo === "ingreso" ? "Cambio en monedas" : "Depósito al banco"} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="h-11" disabled={enviando || !(monto(valor) > 0) || !texto.trim()} onClick={guardar}>
            Anotar {tipo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogoGastoCaja({ onCerrar }: { onCerrar: () => void }) {
  const [categoria, setCategoria] = useState<CategoriaGasto>("insumos")
  const [descripcion, setDescripcion] = useState("")
  const [valor, setValor] = useState("")
  const [enviando, setEnviando] = useState(false)

  const guardar = async () => {
    setEnviando(true)
    try {
      await restauranteApi.accion({
        tipo: "gasto",
        categoria,
        descripcion: descripcion.trim(),
        monto: monto(valor),
        metodo: "efectivo",
        deCaja: true,
      })
      toast.success(`Gasto de ${rd(monto(valor))} pagado de la caja`)
      onCerrar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Gasto de caja</DialogTitle>
          <DialogDescription>Se paga en efectivo de la caja y queda también en Gastos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Categoría</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaGasto)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_GASTO.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gc-desc">Descripción</Label>
            <Input id="gc-desc" className="h-11" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Hielo para la barra" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gc-monto">Monto (RD$)</Label>
            <Input id="gc-monto" className="h-11" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="h-11" disabled={enviando || !(monto(valor) > 0) || !descripcion.trim()} onClick={guardar}>
            Pagar de la caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogoCerrar({ caja, onCerrar, onCerrada }: { caja: Caja; onCerrar: () => void; onCerrada: (c: Caja) => void }) {
  const esperado = Math.round(resumenCaja(caja).esperado)
  const [contado, setContado] = useState("")
  const [nota, setNota] = useState("")
  const [enviando, setEnviando] = useState(false)
  const diferencia = contado.trim() === "" ? null : Math.round(monto(contado)) - esperado

  const cerrar = async () => {
    setEnviando(true)
    try {
      const res = await restauranteApi.accion<{ caja: Caja }>({
        tipo: "cerrarCaja",
        contado: monto(contado),
        nota: nota.trim() || undefined,
      })
      toast.success("Caja cerrada")
      onCerrada(res.caja)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Cerrar caja</DialogTitle>
          <DialogDescription>Cuenta el efectivo que hay en la gaveta, fondo incluido.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <span className="text-sm text-muted-foreground">Efectivo esperado</span>
          <span className="font-display text-2xl tabular-nums">{rd(esperado)}</span>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cc-contado">Efectivo contado (RD$)</Label>
            <Input id="cc-contado" className="h-11" inputMode="decimal" autoFocus value={contado} onChange={(e) => setContado(e.target.value)} />
            {diferencia !== null && <Diferencia valor={diferencia} className="text-sm" />}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cc-nota">Nota</Label>
            <Input id="cc-nota" className="h-11" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="h-11 gap-2" disabled={enviando || diferencia === null} onClick={cerrar}>
            <Lock className="h-4 w-4" /> Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
