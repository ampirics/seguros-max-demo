"use client"

import { FileText, Receipt, Truck } from "lucide-react"
import { rd } from "@/lib/restaurante/carta"
import { PROVEEDORES } from "@/lib/restaurante/inventario"
import type { Gasto, Insumo, OrdenCompra, Proveedor } from "@/lib/restaurante/tipos"
import { Bloque, Cargando, cant, ChipMetodo, conUnidad, Dato, fechaHora, FilaBoton, Lista, NOMBRE_CATEGORIA_GASTO, Titulo, UNIDAD, useDatos } from "./comun"
import { useDetalle } from "./contexto"

type Respuesta = { gasto: Gasto; compra: OrdenCompra | null; proveedor: Proveedor | null; insumos: Insumo[] }

export function DetalleGasto({ id, gasto, buscar }: { id?: string; gasto?: Gasto; buscar?: { texto: string; monto: number; ts: number } }) {
  const { datos: recientes, error: errorLista } = useDatos<Gasto[]>(!id && buscar ? "/gastos?dias=3" : null)
  const hallado = recientes
    ?.filter((g) => g.descripcion === buscar?.texto && Math.round(g.monto) === Math.round(buscar?.monto ?? 0))
    .sort((a, b) => Math.abs(a.ts - buscar!.ts) - Math.abs(b.ts - buscar!.ts))[0]
  const elId = id ?? hallado?.id
  const { datos, error } = useDatos<Respuesta>(elId ? `/gastos/${encodeURIComponent(elId)}` : null)

  if (!datos) {
    if (recientes && !hallado) return <Cargando error="No encontré este gasto en Gastos." />
    if (gasto) return <Ficha r={{ gasto, compra: null, proveedor: null, insumos: [] }} cargando />
    return <Cargando error={error || errorLista} />
  }
  return <Ficha r={datos} />
}

function Ficha({ r, cargando }: { r: Respuesta; cargando?: boolean }) {
  const { abrir } = useDetalle()
  const g = r.gasto
  const proveedor = r.proveedor ?? PROVEEDORES.find((p) => p.id === g.proveedorId)
  const porId = new Map(r.insumos.map((i) => [i.id, i]))
  return (
    <div className="flex flex-col gap-5">
      <Titulo
        etiqueta={`Gasto · ${NOMBRE_CATEGORIA_GASTO[g.categoria]}`}
        titulo={g.descripcion}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground tabular-nums">{rd(g.monto)}</span> <ChipMetodo metodo={g.metodo} deCaja={g.deCaja} />
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <Dato titulo="Fecha y hora" valor={fechaHora(g.ts)} />
        <Dato titulo="Lo anotó" valor={g.quien} />
        <Dato titulo="Categoría" valor={NOMBRE_CATEGORIA_GASTO[g.categoria]} />
        <Dato titulo="Salió de la caja" valor={g.deCaja ? "Sí, efectivo de la caja" : "No"} />
      </div>

      {g.metodo === "credito" && (
        <p className="rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-sm">Está a crédito: queda en cuentas por pagar hasta que se pague la orden.</p>
      )}

      <Bloque titulo="Comprobante">
        {g.comprobante ? (
          <img src={g.comprobante} alt={`Comprobante de ${g.descripcion}`} className="max-h-[60dvh] w-full rounded-xl border bg-secondary/40 object-contain" />
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" aria-hidden /> No se subió foto del comprobante.
          </p>
        )}
      </Bloque>

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

      {cargando && g.compraId && <Cargando />}
      {r.compra && (
        <Bloque
          titulo={`Lo que se compró (${r.compra.lineas.length})`}
          accion={
            <button type="button" onClick={() => abrir({ tipo: "compra", id: r.compra!.id })} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <Receipt className="h-4 w-4" aria-hidden /> Ver la orden {r.compra.codigo}
            </button>
          }
        >
          <Lista>
            {r.compra.lineas.map((l) => {
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
            <span className="text-sm text-muted-foreground">Total de la orden</span>
            <span className="text-lg font-semibold tabular-nums">{rd(r.compra.total)}</span>
          </div>
        </Bloque>
      )}
    </div>
  )
}
