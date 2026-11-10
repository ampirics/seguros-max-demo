"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { Check, MessageCircle, PackageCheck, Receipt, Truck, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { PROVEEDORES } from "@/lib/restaurante/inventario"
import type { Gasto, Insumo, MetodoPago, OrdenCompra, Proveedor } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { Bloque, Cargando, cant, ChipMetodo, conUnidad, fechaHora, FilaBoton, Lista, NOMBRE_METODO, Titulo, UNIDAD, useDatos } from "./comun"
import { useDetalle } from "./contexto"

const ESTADO: Record<OrdenCompra["estado"], [string, string]> = {
  borrador: ["Borrador", "bg-secondary text-foreground"],
  enviada: ["Enviada", "bg-[#7FCFCB]/25 text-foreground"],
  recibida: ["Recibida", "bg-success-soft text-success"],
  cancelada: ["Cancelada", "bg-destructive-soft text-destructive"],
}

export function ChipCompra({ c }: { c: OrdenCompra }) {
  const [t, clase] = ESTADO[c.estado]
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", clase)}>
      {c.estado === "recibida" ? (c.pagada ? "Recibida y pagada" : "Recibida, a crédito") : t}
    </span>
  )
}

export function DetalleCompra({ id }: { id: string }) {
  const { estado } = useRestaurante()
  const { abrir } = useDetalle()
  const [clave, setClave] = useState(0)
  const { datos, error } = useDatos<{ compra: OrdenCompra; proveedor: Proveedor | null; gasto: Gasto | null; insumos: Insumo[] }>(`/compras/${encodeURIComponent(id)}`, clave)
  if (!datos) return <Cargando error={error} />

  const viva = estado?.compras?.find((c) => c.id === datos.compra.id)
  const c = viva ?? datos.compra
  const proveedor = datos.proveedor ?? PROVEEDORES.find((p) => p.id === c.proveedorId)
  const porId = new Map([...(estado?.insumos ?? []), ...datos.insumos].map((i) => [i.id, i]))
  const recargar = () => setClave((k) => k + 1)

  const pasos: { t: string; ts?: number; texto?: string; icono: typeof Check }[] = [
    { t: "Creada", ts: c.creada, texto: `por ${c.quien}`, icono: Receipt },
    { t: "Enviada al suplidor", ts: c.enviada, texto: "por WhatsApp", icono: Truck },
    { t: "Mercancía recibida", ts: c.recibida, texto: "subió el inventario", icono: PackageCheck },
    { t: "Pagada", ts: c.pagada?.ts, texto: c.pagada ? `${NOMBRE_METODO[c.pagada.metodo].toLowerCase()}${c.pagada.deCaja ? ", de la caja" : ""}` : undefined, icono: Wallet },
  ]

  return (
    <div className="flex flex-col gap-5">
      <Titulo
        etiqueta="Orden de compra"
        titulo={<span className="tabular-nums">{c.codigo}</span>}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <ChipCompra c={c} /> {rd(c.total)}
          </span>
        }
      />

      {proveedor && (
        <Bloque titulo="Suplidor">
          <Lista>
            <FilaBoton onClick={() => abrir({ tipo: "proveedor", id: proveedor.id })}>
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{proveedor.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{proveedor.contacto} · {proveedor.telefono}</span>
              </span>
            </FilaBoton>
          </Lista>
        </Bloque>
      )}

      <Bloque titulo="Recorrido">
        <ol className="flex flex-col">
          {pasos.map((p, k) => {
            const hecho = !!p.ts
            return (
              <li key={p.t} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border", hecho ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
                    <p.icono className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {k < pasos.length - 1 && <span className={cn("w-px flex-1", hecho ? "bg-primary" : "bg-border")} />}
                </div>
                <div className="min-w-0 pb-3 text-sm">
                  <div className={cn("font-medium", !hecho && "text-muted-foreground")}>{p.t}</div>
                  <div className="text-xs text-muted-foreground">{hecho ? `${fechaHora(p.ts!)}${p.texto ? ` · ${p.texto}` : ""}` : c.estado === "cancelada" ? "No pasó: la orden se canceló" : "Pendiente"}</div>
                </div>
              </li>
            )
          })}
        </ol>
      </Bloque>

      <Bloque titulo={`Lo que se pidió (${c.lineas.length})`}>
        <Lista>
          {c.lineas.map((l) => {
            const i = porId.get(l.insumoId)
            return (
              <FilaBoton key={l.insumoId} onClick={() => abrir({ tipo: "insumo", id: l.insumoId })}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i?.nombre ?? l.insumoId}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {i ? conUnidad(l.cantidad, i.unidad) : cant(l.cantidad)} × {rd(l.costo)}
                    {i ? `/${UNIDAD[i.unidad][0]}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{rd(l.cantidad * l.costo)}</span>
              </FilaBoton>
            )
          })}
        </Lista>
        <div className="flex items-baseline justify-between px-3 pt-1">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{rd(c.total)}</span>
        </div>
      </Bloque>

      {datos.gasto && (
        <Bloque titulo="Gasto que generó">
          <Lista>
            <FilaBoton onClick={() => abrir({ tipo: "gasto", id: datos.gasto!.id, gasto: datos.gasto! })}>
              <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{datos.gasto.descripcion}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {fechaHora(datos.gasto.ts)} <ChipMetodo metodo={datos.gasto.metodo} deCaja={datos.gasto.deCaja} />
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{rd(datos.gasto.monto)}</span>
            </FilaBoton>
          </Lista>
        </Bloque>
      )}

      {viva && <Acciones c={c} proveedor={proveedor?.nombre ?? c.proveedorId} cajaAbierta={!!estado?.caja} onListo={recargar} />}
    </div>
  )
}

function Acciones({ c, proveedor, cajaAbierta, onListo }: { c: OrdenCompra; proveedor: string; cajaAbierta: boolean; onListo: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPago>("transferencia")
  const [deCaja, setDeCaja] = useState(false)

  const hacer = async (a: Parameters<typeof restauranteApi.accion>[0], ok: string) => {
    setEnviando(true)
    try {
      await restauranteApi.accion(a)
      toast.success(ok)
      onListo()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  const cancelar = (
    <Button variant="ghost" className="h-11" disabled={enviando} onClick={() => hacer({ tipo: "cancelarCompra", compraId: c.id }, `${c.codigo} cancelada`)}>
      Cancelar orden
    </Button>
  )

  if (c.estado === "borrador")
    return (
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button className="h-11" disabled={enviando} onClick={() => hacer({ tipo: "enviarCompra", compraId: c.id }, `${c.codigo} enviada a ${proveedor} por WhatsApp`)}>
          <MessageCircle className="h-4 w-4" aria-hidden /> Enviar por WhatsApp
        </Button>
        {cancelar}
      </div>
    )
  if (c.estado === "enviada")
    return (
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button className="h-11" disabled={enviando} onClick={() => hacer({ tipo: "recibirCompra", compraId: c.id }, `${c.codigo} recibida: subió el inventario`)}>
          <PackageCheck className="h-4 w-4" aria-hidden /> Recibir mercancía
        </Button>
        {cancelar}
      </div>
    )
  if (c.estado === "recibida" && !c.pagada)
    return (
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Registrar el pago</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["transferencia", "efectivo", "tarjeta"] as MetodoPago[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodo(m)}
              aria-pressed={metodo === m}
              className={cn("h-11 rounded-control border text-sm font-medium transition-colors", metodo === m ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}
            >
              {NOMBRE_METODO[m]}
            </button>
          ))}
        </div>
        {metodo === "efectivo" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div>
              <Label htmlFor="dc-de-caja">Pagado de la caja</Label>
              <p className="text-xs text-muted-foreground">{cajaAbierta ? "Sale como gasto en el cuadre de hoy." : "La caja está cerrada."}</p>
            </div>
            <Switch id="dc-de-caja" checked={deCaja} onCheckedChange={setDeCaja} disabled={!cajaAbierta} />
          </div>
        )}
        <Button
          className="h-11 self-start"
          disabled={enviando}
          onClick={() => hacer({ tipo: "pagarCompra", compraId: c.id, metodo, deCaja: metodo === "efectivo" && deCaja }, `${c.codigo} pagada${metodo === "efectivo" && deCaja ? " de la caja" : ""}`)}
        >
          <Wallet className="h-4 w-4" aria-hidden /> Registrar pago de {rd(c.total)}
        </Button>
      </section>
    )
  return null
}
