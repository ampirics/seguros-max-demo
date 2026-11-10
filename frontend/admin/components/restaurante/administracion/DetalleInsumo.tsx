"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { ArrowDownRight, ArrowUpRight, Beef, Camera, Carrot, ChefHat, Fish, Milk, Package, Pencil, SlidersHorizontal, Trash2, Truck, Wheat, Wine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { estadoInsumo } from "@/lib/restaurante/inventario"
import type { Insumo, MovimientoInsumo, OrdenCompra, Proveedor } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { Bloque, Cargando, cant, conUnidad, Dato, fechaHora, FilaBoton, Lista, Titulo, UNIDAD, useDatos, Vacio } from "./comun"
import { useDetalle } from "./contexto"
import { ChipCompra } from "./DetalleCompra"

type Respuesta = {
  insumo: Insumo
  proveedor: Proveedor | null
  movimientos: MovimientoInsumo[]
  consumoDiario: number
  platos: { platoId: string; nombre: string; cantidad: number }[]
  compras: OrdenCompra[]
}

const MOTIVOS = ["Conteo físico", "Merma", "Se dañó", "Consumo del personal", "Corrección"]

const ASPECTO: Record<string, { icono: typeof Fish; fondo: string; tinta: string }> = {
  "Pescados y mariscos": { icono: Fish, fondo: "linear-gradient(135deg,#0B2A2E 0%,#1F5C63 55%,#7FCFCB 100%)", tinta: "#F4ECDF" },
  "Carnes y aves": { icono: Beef, fondo: "linear-gradient(135deg,#5A1F1A 0%,#A4442F 60%,#E8866A 100%)", tinta: "#FBEDE6" },
  "Vegetales y frutas": { icono: Carrot, fondo: "linear-gradient(135deg,#1F4A2A 0%,#4F8A4A 60%,#B9D98A 100%)", tinta: "#F2F7E8" },
  Despensa: { icono: Wheat, fondo: "linear-gradient(135deg,#5C4520 0%,#9C7A3C 60%,#C9A86A 100%)", tinta: "#FBF4E6" },
  Lácteos: { icono: Milk, fondo: "linear-gradient(135deg,#3D5A73 0%,#7FA3C2 60%,#DCE8F2 100%)", tinta: "#FFFFFF" },
  Bebidas: { icono: Wine, fondo: "linear-gradient(135deg,#3B1531 0%,#7A2E5E 60%,#C77DA8 100%)", tinta: "#FAEDF5" },
}
const aspecto = (categoria: string) => ASPECTO[categoria] ?? { icono: Package, fondo: "linear-gradient(135deg,#3A3A3A 0%,#8A8A8A 100%)", tinta: "#FFFFFF" }

const claveFoto = (id: string) => `ora:foto-insumo:${id}`

function useFoto(id: string) {
  const [foto, setFoto] = useState<string | null>(null)
  useEffect(() => {
    try {
      setFoto(localStorage.getItem(claveFoto(id)))
    } catch {
      setFoto(null)
    }
  }, [id])
  const guardar = async (f?: File) => {
    if (!f) return
    try {
      const img = await createImageBitmap(f)
      const escala = Math.min(1, 800 / Math.max(img.width, img.height))
      const lienzo = document.createElement("canvas")
      lienzo.width = Math.round(img.width * escala)
      lienzo.height = Math.round(img.height * escala)
      lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      const datos = lienzo.toDataURL("image/jpeg", 0.8)
      localStorage.setItem(claveFoto(id), datos)
      setFoto(datos)
      toast.success("Foto guardada en este equipo")
    } catch {
      toast.error("No se pudo guardar la foto")
    }
  }
  const quitar = () => {
    try {
      localStorage.removeItem(claveFoto(id))
    } catch {}
    setFoto(null)
  }
  return { foto, guardar, quitar }
}

function Foto({ i }: { i: Insumo }) {
  const { foto, guardar, quitar } = useFoto(i.id)
  const a = aspecto(i.categoria)
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border" style={foto ? undefined : { background: a.fondo }}>
        {foto ? (
          <img src={foto} alt={`Foto de ${i.nombre}`} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-between gap-4 px-6" style={{ color: a.tinta }}>
            <span className="font-display text-[6.5rem] font-semibold leading-none opacity-90 sm:text-[8rem]">{i.nombre.charAt(0)}</span>
            <a.icono className="h-24 w-24 opacity-60 sm:h-28 sm:w-28" strokeWidth={1.25} aria-hidden />
          </div>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Foto del insumo{foto ? "" : ": todavía no hay una, sube la tuya"}</span>
        <span className="flex gap-1">
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-secondary">
            <Camera className="h-4 w-4" aria-hidden /> {foto ? "Cambiar" : "Subir foto"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => guardar(e.target.files?.[0])} />
          </label>
          {foto && (
            <Button variant="ghost" className="h-11 w-11 p-0" onClick={quitar} aria-label="Quitar foto">
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </span>
      </figcaption>
    </figure>
  )
}

export function DetalleInsumo({ id }: { id: string }) {
  const { estado } = useRestaurante()
  const { abrir, cerrar } = useDetalle()
  const [clave, setClave] = useState(0)
  const [ajustando, setAjustando] = useState(false)
  const [mostrar, setMostrar] = useState(15)
  const { datos, error } = useDatos<Respuesta>(`/insumos/${encodeURIComponent(id)}`, clave)
  if (!datos) return <Cargando error={error} />

  const i = estado?.insumos?.find((x) => x.id === id) ?? datos.insumo
  const e = estadoInsumo(i)
  const u = UNIDAD[i.unidad]
  const dias = datos.consumoDiario > 0 ? i.existencia / datos.consumoDiario : null
  const tope = Math.max(i.minimo * 2, i.existencia, 0.001)
  const vivas = new Map((estado?.compras ?? []).map((c) => [c.id, c]))
  const pedido = (estado?.compras ?? []).find((c) => (c.estado === "borrador" || c.estado === "enviada") && c.lineas.some((l) => l.insumoId === id))

  return (
    <div className="flex flex-col gap-5">
      <Foto i={i} />
      <Titulo
        etiqueta={i.categoria}
        titulo={i.nombre}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", e === "ok" ? "bg-success-soft text-success" : e === "bajo" ? "bg-warning-soft text-warning" : "bg-destructive-soft text-destructive")}>
              {e === "ok" ? "Bien de existencia" : e === "bajo" ? "Bajo el mínimo" : "Agotado"}
            </span>
            {pedido && (
              <button type="button" onClick={() => abrir({ tipo: "compra", id: pedido.id })} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                Ya está pedido en {pedido.codigo}
              </button>
            )}
          </span>
        }
      />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">En almacén</div>
            <div className="font-display text-3xl font-semibold tabular-nums">{conUnidad(i.existencia, i.unidad)}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-xs text-muted-foreground">Alcanza para</div>
            <div className={cn("font-semibold tabular-nums", (i.existencia <= 0 || (dias !== null && dias < 2)) && "text-destructive")}>
              {i.existencia <= 0 ? "Ya se acabó" : dias === null ? "Sin consumo reciente" : dias < 1 ? "Menos de un día" : `${cant(Math.floor(dias * 10) / 10)} días`}
            </div>
          </div>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <span className={cn("block h-full rounded-full", e === "ok" ? "bg-success" : e === "bajo" ? "bg-warning" : "bg-destructive")} style={{ width: `${(i.existencia / tope) * 100}%` }} />
          <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${(i.minimo / tope) * 100}%` }} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>Mínimo {conUnidad(i.minimo, i.unidad)}</span>
          <span>Se usan {datos.consumoDiario > 0 ? `${cant(datos.consumoDiario)} ${u[1]}` : "0"} al día (promedio de 14 días)</span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Dato titulo={`Costo por ${u[0]}`} valor={rd(i.costo)} />
        <Dato titulo="Valor en almacén" valor={rd(i.existencia * i.costo)} />
      </div>

      <section className="rounded-xl border bg-card">
        <button type="button" onClick={() => setAjustando(!ajustando)} aria-expanded={ajustando} className="flex min-h-[48px] w-full items-center gap-2 px-4 text-left text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Ajustar existencia
          <span className="ml-auto text-xs font-normal text-muted-foreground">{ajustando ? "Cerrar" : "Conteo, merma o corrección"}</span>
        </button>
        {ajustando && (
          <FormAjuste
            i={i}
            onListo={() => {
              setAjustando(false)
              setClave((k) => k + 1)
            }}
          />
        )}
      </section>

      {datos.proveedor && (
        <Bloque titulo="Proveedor">
          <Lista>
            <FilaBoton onClick={() => abrir({ tipo: "proveedor", id: datos.proveedor!.id })}>
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{datos.proveedor.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{datos.proveedor.contacto} · {datos.proveedor.telefono} · {datos.proveedor.dias}</span>
              </span>
            </FilaBoton>
          </Lista>
        </Bloque>
      )}

      <Bloque
        titulo={`Platos que lo usan (${datos.platos.length})`}
        accion={
          <Link href="/admin/carta" onClick={cerrar} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
            <ChefHat className="h-4 w-4" aria-hidden /> Ver la carta
          </Link>
        }
      >
        {datos.platos.length ? (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {datos.platos.map((p) => (
              <li key={p.platoId} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">{p.nombre}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{conUnidad(p.cantidad, i.unidad)} por porción</span>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio texto="Ningún plato de la carta lo usa." />
        )}
      </Bloque>

      <Bloque titulo="Compras recientes">
        {datos.compras.length ? (
          <Lista>
            {datos.compras.map((c0) => {
              const c = vivas.get(c0.id) ?? c0
              const l = c.lineas.find((x) => x.insumoId === id)
              return (
                <FilaBoton key={c.id} onClick={() => abrir({ tipo: "compra", id: c.id })}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums">{c.codigo}</span>
                      <ChipCompra c={c} />
                    </span>
                    <span className="block text-xs text-muted-foreground">{fechaHora(c.creada)}</span>
                  </span>
                  {l && <span className="shrink-0 text-right text-xs tabular-nums">{conUnidad(l.cantidad, i.unidad)}<span className="block font-semibold text-foreground text-sm">{rd(l.cantidad * l.costo)}</span></span>}
                </FilaBoton>
              )
            })}
          </Lista>
        ) : (
          <Vacio texto="No hay compras de este insumo." />
        )}
      </Bloque>

      <Bloque titulo={`Movimientos (${datos.movimientos.length})`}>
        {datos.movimientos.length ? (
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {datos.movimientos.slice(0, mostrar).map((m, k) => (
              <Movimiento key={`${m.ts}-${k}`} m={m} i={i} />
            ))}
            {datos.movimientos.length > mostrar && (
              <button type="button" onClick={() => setMostrar((n) => n + 30)} className="flex min-h-[44px] w-full items-center justify-center text-sm font-medium text-primary hover:bg-secondary/60">
                Ver más ({datos.movimientos.length - mostrar} restantes)
              </button>
            )}
          </div>
        ) : (
          <Vacio texto="Todavía no hay movimientos." />
        )}
      </Bloque>
    </div>
  )
}

function Movimiento({ m, i }: { m: MovimientoInsumo; i: Insumo }) {
  const { abrir, cerrar } = useDetalle()
  const entra = m.cantidad > 0
  const Icono = m.tipo === "ajuste" ? Pencil : entra ? ArrowUpRight : ArrowDownRight
  const tipo = { consumo: "Consumo", compra: "Compra", ajuste: "Ajuste" }[m.tipo]
  const cuerpo = (
    <>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.tipo === "compra" ? "bg-success-soft text-success" : m.tipo === "ajuste" ? "bg-secondary" : "bg-[#E8866A]/15 text-[#A4442F]")}>
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{m.texto}</span>
        <span className="block text-xs text-muted-foreground">
          {tipo} · {fechaHora(m.ts)}
          {m.quien ? ` · ${m.quien}` : ""}
        </span>
      </span>
      <span className={cn("shrink-0 font-semibold tabular-nums", entra ? "text-success" : "text-foreground")}>
        {entra ? "+" : "−"}
        {conUnidad(Math.abs(m.cantidad), i.unidad)}
      </span>
    </>
  )
  const clase = "flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left text-sm"
  if (m.compraId)
    return (
      <button type="button" onClick={() => abrir({ tipo: "compra", id: m.compraId! })} className={cn(clase, "hover:bg-secondary/60")}>
        {cuerpo}
      </button>
    )
  if (m.mesaId)
    return (
      <Link href={`/admin/salon/mesas/${m.mesaId}`} onClick={cerrar} className={cn(clase, "hover:bg-secondary/60")}>
        {cuerpo}
      </Link>
    )
  return <div className={clase}>{cuerpo}</div>
}

function FormAjuste({ i, onListo }: { i: Insumo; onListo: () => void }) {
  const [valor, setValor] = useState(String(i.existencia))
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const n = Number(valor.replace(",", "."))
    if (!Number.isFinite(n) || n < 0) return toast.error("Escribe una existencia válida")
    setGuardando(true)
    try {
      await restauranteApi.accion({ tipo: "ajustarInsumo", insumoId: i.id, existencia: n, motivo })
      toast.success(`${i.nombre}: ${conUnidad(n, i.unidad)}`)
      onListo()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="grid gap-4 border-t px-4 py-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`aj-${i.id}`}>Nueva existencia ({UNIDAD[i.unidad][1]})</Label>
        <Input id={`aj-${i.id}`} className="h-11" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardar()} />
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
              className={cn("h-11 rounded-full border px-3 text-xs font-medium transition-colors", motivo === m ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <Button className="h-11 self-start" onClick={guardar} disabled={guardando}>
        Guardar ajuste
      </Button>
    </div>
  )
}
