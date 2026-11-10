"use client"

import { Mail, Phone, Truck, User } from "lucide-react"
import { rd } from "@/lib/restaurante/carta"
import { useRestaurante } from "@/lib/restaurante/cliente"
import { estadoInsumo, PROVEEDORES } from "@/lib/restaurante/inventario"
import type { OrdenCompra } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { Bloque, Cargando, conUnidad, Dato, fechaHora, FilaBoton, Lista, Titulo, useDatos, Vacio } from "./comun"
import { useDetalle } from "./contexto"
import { ChipCompra } from "./DetalleCompra"

const DIA = 24 * 3600 * 1000

export function DetalleProveedor({ id }: { id: string }) {
  const { estado, ahora } = useRestaurante()
  const { abrir } = useDetalle()
  const p = PROVEEDORES.find((x) => x.id === id)
  const { datos: historial, error } = useDatos<OrdenCompra[]>(`/compras?proveedor=${encodeURIComponent(id)}&limite=60`)
  if (!p) return <Cargando error="No existe este proveedor" />

  const vivas = new Map((estado?.compras ?? []).map((c) => [c.id, c]))
  const ordenes = (historial ?? []).map((c) => vivas.get(c.id) ?? c)
  const insumos = (estado?.insumos ?? []).filter((i) => i.proveedorId === id)
  const comprado30 = ordenes.filter((c) => c.estado === "recibida" && (c.recibida ?? c.creada) >= ahora - 30 * DIA).reduce((s, c) => s + c.total, 0)
  const porPagar = ordenes.filter((c) => c.estado === "recibida" && !c.pagada)
  const abiertas = ordenes.filter((c) => c.estado === "borrador" || c.estado === "enviada").length

  return (
    <div className="flex flex-col gap-5">
      <Titulo
        etiqueta="Proveedor"
        titulo={p.nombre}
        sub={
          <span className="flex flex-wrap gap-1">
            {p.categorias.map((c) => (
              <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-foreground">{c}</span>
            ))}
          </span>
        }
      />

      <ul className="grid gap-1 rounded-xl border bg-card p-2 text-sm">
        <li className="flex min-h-[44px] items-center gap-3 px-2"><User className="h-4 w-4 text-muted-foreground" aria-hidden /> {p.contacto}</li>
        <li>
          <a href={`tel:${p.telefono.replace(/\D/g, "")}`} className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 hover:bg-secondary/60">
            <Phone className="h-4 w-4 text-muted-foreground" aria-hidden /> {p.telefono}
          </a>
        </li>
        {p.correo && (
          <li>
            <a href={`mailto:${p.correo}`} className="flex min-h-[44px] min-w-0 items-center gap-3 rounded-lg px-2 hover:bg-secondary/60">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> <span className="truncate">{p.correo}</span>
            </a>
          </li>
        )}
        <li className="flex min-h-[44px] items-center gap-3 px-2"><Truck className="h-4 w-4 text-muted-foreground" aria-hidden /> Entrega: {p.dias}</li>
      </ul>

      <div className="grid grid-cols-3 gap-2">
        <Dato titulo="Comprado en 30 días" valor={historial ? rd(comprado30) : "…"} />
        <Dato titulo="Por pagar" valor={historial ? rd(porPagar.reduce((s, c) => s + c.total, 0)) : "…"} className={cn(porPagar.length > 0 && "border-warning/40 bg-warning-soft")} />
        <Dato titulo="Órdenes abiertas" valor={historial ? abiertas : "…"} />
      </div>

      <Bloque titulo={`Lo que nos vende (${insumos.length})`}>
        <Lista>
          {insumos.map((i) => {
            const e = estadoInsumo(i)
            return (
              <FilaBoton key={i.id} onClick={() => abrir({ tipo: "insumo", id: i.id })}>
                <span className="min-w-0 flex-1 truncate font-medium">{i.nombre}</span>
                <span className={cn("shrink-0 text-xs tabular-nums", e === "agotado" ? "font-medium text-destructive" : e === "bajo" ? "font-medium text-warning" : "text-muted-foreground")}>
                  {e === "agotado" ? "Agotado" : `Hay ${conUnidad(i.existencia, i.unidad)}`}
                </span>
              </FilaBoton>
            )
          })}
        </Lista>
      </Bloque>

      <Bloque titulo={`Órdenes (${ordenes.length})`}>
        {!historial ? (
          <Cargando error={error} />
        ) : ordenes.length ? (
          <Lista>
            {ordenes.map((c) => (
              <FilaBoton key={c.id} onClick={() => abrir({ tipo: "compra", id: c.id })}>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">{c.codigo}</span>
                    <ChipCompra c={c} />
                  </span>
                  <span className="block text-xs text-muted-foreground">{fechaHora(c.creada)} · {c.lineas.length} {c.lineas.length === 1 ? "insumo" : "insumos"}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{rd(c.total)}</span>
              </FilaBoton>
            ))}
          </Lista>
        ) : (
          <Vacio texto="Todavía no le hemos comprado." />
        )}
      </Bloque>
    </div>
  )
}
