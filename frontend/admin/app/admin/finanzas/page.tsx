"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Info, Loader2 } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Barras, CajaTooltip, COLORES, EJE, Kpi, Lectura, rdCorto, Seccion, Tarjeta } from "@/components/restaurante/metricas/piezas"
import { rd } from "@/lib/restaurante/carta"
import { cn } from "@/lib/utils"

type Finanzas = {
  dias: number
  ventas: number
  gastos: number
  utilidad: number
  costoVentas: number
  foodCost: number
  porDia: { fecha: string; ventas: number; gastos: number; costoVentas: number }[]
  categorias: { categoria: string; monto: number }[]
  platos: { platoId: string; nombre: string; categoria: string; precio: number; costo: number; margen: number; pct: number; vendidos: number; aporte: number }[]
  porPagar: { total: number; cantidad: number }
}

const CATEGORIA: Record<string, { nombre: string; color: string }> = {
  insumos: { nombre: "Insumos", color: COLORES.coral },
  nomina: { nombre: "Nómina", color: COLORES.lila },
  servicios: { nombre: "Servicios y alquiler", color: COLORES.mar },
  mantenimiento: { nombre: "Mantenimiento", color: COLORES.oro },
  otros: { nombre: "Otros", color: COLORES.gris },
}

const tono = (pct: number) => (pct <= 35 ? "text-emerald-700" : pct <= 45 ? "text-amber-700" : "text-red-700")

export default function FinanzasPage() {
  const [dias, setDias] = useState(30)
  const [f, setF] = useState<Finanzas | null>(null)
  const [orden, setOrden] = useState<"aporte" | "pct">("aporte")

  useEffect(() => {
    let vivo = true
    setF(null)
    fetch(`/srv/restaurante/finanzas?dias=${dias}`)
      .then((r) => r.json())
      .then((j) => vivo && setF(j))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [dias])

  const platos = useMemo(() => (f ? f.platos.slice().sort((a, b) => (orden === "aporte" ? b.aporte - a.aporte : b.pct - a.pct)) : []), [f, orden])
  const peor = f?.platos.filter((p) => p.vendidos > 0).sort((a, b) => b.pct - a.pct)[0]

  return (
    <AdminLayout title="Finanzas">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">Ventas, gastos y utilidad</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Finanzas</h1>
          </div>
          <div className="flex rounded-full border bg-card p-1 text-sm">
            {[7, 30, 60].map((d) => (
              <button key={d} onClick={() => setDias(d)} className={cn("rounded-full px-4 py-1.5", dias === d && "bg-primary text-primary-foreground")}>
                {d} días
              </button>
            ))}
          </div>
        </header>

        <p className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Las ventas salen de cada cuenta cobrada. Los gastos y los costos de las recetas son de ejemplo: Boca Marina todavía no ha compartido los suyos.
        </p>

        {!f ? (
          <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
              <Kpi titulo="Ventas" valor={rdCorto(f.ventas)} detalle={`${f.dias} días, sin ITBIS ni servicio`} />
              <Kpi titulo="Gastos" valor={rdCorto(f.gastos)} detalle="Insumos, nómina, servicios y más" />
              <Kpi titulo="Utilidad" valor={rdCorto(f.utilidad)} detalle={f.ventas ? `${Math.round((f.utilidad / f.ventas) * 100)} % de las ventas` : undefined} />
              <Kpi titulo="Food cost" valor={`${f.foodCost} %`} detalle={`Costo de lo vendido: ${rdCorto(f.costoVentas)}`} />
              <Kpi titulo="Por pagar a proveedores" valor={rdCorto(f.porPagar.total)} detalle={`${f.porPagar.cantidad} compras a crédito`} />
            </div>

            <Seccion titulo="Día a día" descripcion="Lo que entra contra lo que sale cada día.">
              <Tarjeta>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={f.porDia.map((d) => ({ ...d, etiqueta: d.fecha.slice(8) + "/" + d.fecha.slice(5, 7) }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={(n) => rdCorto(Number(n))} width={84} />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        content={({ payload, label }) =>
                          payload?.length ? (
                            <CajaTooltip
                              titulo={String(label)}
                              filas={[
                                { nombre: "Ventas", valor: rd(Number(payload[0].payload.ventas)), color: COLORES.mar },
                                { nombre: "Gastos", valor: rd(Number(payload[0].payload.gastos)), color: COLORES.coral },
                                { nombre: "Costo de lo vendido", valor: rd(Number(payload[0].payload.costoVentas)), color: COLORES.lila },
                              ]}
                            />
                          ) : null
                        }
                      />
                      <Bar dataKey="ventas" fill={COLORES.mar} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="gastos" fill={COLORES.coral} radius={[4, 4, 0, 0]} />
                      <Line dataKey="costoVentas" stroke={COLORES.lila} strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Tarjeta>
            </Seccion>

            <div className="grid gap-5 lg:grid-cols-2">
              <Seccion titulo="En qué se va el dinero">
                <Tarjeta>
                  <Barras filas={f.categorias.filter((c) => c.monto > 0).sort((a, b) => b.monto - a.monto).map((c) => ({ etiqueta: CATEGORIA[c.categoria]?.nombre ?? c.categoria, valor: c.monto, color: CATEGORIA[c.categoria]?.color, detalle: `${Math.round((c.monto / Math.max(1, f.gastos)) * 100)} % de los gastos` }))} formato={rd} />
                  <Link href="/admin/gastos" className="mt-4 inline-block text-sm underline">
                    Ver todos los gastos
                  </Link>
                </Tarjeta>
              </Seccion>
              <Seccion titulo="Lo que más deja">
                <Tarjeta>
                  <Barras filas={f.platos.slice(0, 7).map((p) => ({ etiqueta: p.nombre, valor: p.aporte, detalle: `${p.vendidos} vendidos · margen ${rd(p.margen)} por plato · food cost ${p.pct} %` }))} formato={rd} color={COLORES.verde} />
                </Tarjeta>
              </Seccion>
            </div>

            {peor && (
              <Lectura>
                {peor.nombre} es el plato vendido con el food cost más alto ({peor.pct} %): cada uno cuesta {rd(peor.costo)} y se vende a {rd(peor.precio)}. Revisar la porción o el precio sube la utilidad sin vender más.
              </Lectura>
            )}

            <Seccion titulo="Costo y margen por plato" descripcion="Costo de la receta con los costos de ejemplo del inventario.">
              <Tarjeta
                accion={
                  <div className="flex rounded-full border p-0.5 text-xs">
                    {(["aporte", "pct"] as const).map((o) => (
                      <button key={o} onClick={() => setOrden(o)} className={cn("rounded-full px-3 py-1", orden === o && "bg-primary text-primary-foreground")}>
                        {o === "aporte" ? "Lo que más deja" : "Food cost más alto"}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 font-medium">Plato</th>
                        <th className="py-2 text-right font-medium">Precio</th>
                        <th className="py-2 text-right font-medium">Costo</th>
                        <th className="py-2 text-right font-medium">Margen</th>
                        <th className="py-2 text-right font-medium">Food cost</th>
                        <th className="py-2 text-right font-medium">Vendidos</th>
                        <th className="py-2 text-right font-medium">Deja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platos.slice(0, 25).map((p) => (
                        <tr key={p.platoId} className="border-b last:border-0">
                          <td className="py-2">
                            <div className="font-medium">{p.nombre}</div>
                            <div className="text-xs text-muted-foreground">{p.categoria}</div>
                          </td>
                          <td className="py-2 text-right tabular-nums">{rd(p.precio)}</td>
                          <td className="py-2 text-right tabular-nums">{rd(p.costo)}</td>
                          <td className="py-2 text-right tabular-nums">{rd(p.margen)}</td>
                          <td className={cn("py-2 text-right font-semibold tabular-nums", tono(p.pct))}>{p.pct} %</td>
                          <td className="py-2 text-right tabular-nums">{p.vendidos}</td>
                          <td className="py-2 text-right tabular-nums">{rd(p.aporte)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tarjeta>
            </Seccion>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
