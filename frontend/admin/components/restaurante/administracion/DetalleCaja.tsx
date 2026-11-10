"use client"

import { ChevronRight } from "lucide-react"
import { rd } from "@/lib/restaurante/carta"
import type { Caja, MovimientoCaja } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { Bloque, Dato, fecha, fechaHora, hora, NOMBRE_METODO, resumenCaja, Titulo, Vacio } from "./comun"
import { detalleDeMovimiento, useDetalle } from "./contexto"

export const TIPO_MOVIMIENTO: Record<MovimientoCaja["tipo"], { nombre: string; clase: string; sale: boolean }> = {
  venta: { nombre: "Venta", clase: "bg-[#7FCFCB]/25", sale: false },
  ingreso: { nombre: "Ingreso", clase: "bg-emerald-100 text-emerald-800", sale: false },
  retiro: { nombre: "Retiro", clase: "bg-red-100 text-red-800", sale: true },
  gasto: { nombre: "Gasto", clase: "bg-[#E8866A]/15", sale: true },
}

export function FilaMovimiento({ m }: { m: MovimientoCaja }) {
  const { abrir } = useDetalle()
  const t = TIPO_MOVIMIENTO[m.tipo]
  return (
    <button type="button" onClick={() => abrir(detalleDeMovimiento(m))} className="group flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60">
      <span className="w-16 shrink-0 tabular-nums text-muted-foreground sm:w-20">{hora(m.ts)}</span>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", t.clase)}>{t.nombre}</span>
      <span className="min-w-0 flex-1 truncate">{m.texto}</span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{NOMBRE_METODO[m.metodo]}</span>
      <span className={cn("shrink-0 text-right font-semibold tabular-nums sm:w-28", t.sale && "text-red-600")}>
        {t.sale ? "− " : ""}
        {rd(m.monto)}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  )
}

export function DetalleCierre({ caja }: { caja: Caja }) {
  const r = resumenCaja(caja)
  const d = caja.diferencia ?? 0
  const movimientos = caja.movimientos.slice().sort((a, b) => b.ts - a.ts)
  return (
    <div className="flex flex-col gap-5">
      <Titulo
        etiqueta="Cierre de caja"
        titulo={<span className="first-letter:uppercase">{fecha(caja.abierta)}</span>}
        sub={`${caja.cajero} · de ${hora(caja.abierta)} a ${caja.cerrada ? hora(caja.cerrada) : "…"}`}
      />
      <div className={cn("rounded-xl border p-4", !d ? "border-emerald-300 bg-emerald-50" : d > 0 ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50")}>
        <div className={cn("font-display text-2xl font-semibold", !d ? "text-emerald-700" : d > 0 ? "text-amber-700" : "text-red-600")}>
          {!d ? "Cuadrada" : `${d > 0 ? "Sobrante" : "Faltante"} ${rd(Math.abs(d))}`}
        </div>
        <p className="text-sm text-muted-foreground">
          Esperado {rd(caja.esperado ?? r.esperado)} · contado {rd(caja.contado ?? 0)}
          {caja.nota ? ` · ${caja.nota}` : ""}
        </p>
      </div>
      {movimientos.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Dato titulo="Fondo inicial" valor={rd(caja.fondo)} />
          <Dato titulo="Ventas en efectivo" valor={rd(r.ventas.efectivo)} />
          <Dato titulo="Tarjeta" valor={rd(r.ventas.tarjeta)} />
          <Dato titulo="Transferencia" valor={rd(r.ventas.transferencia)} />
          <Dato titulo="Ingresos" valor={rd(r.ingresos)} />
          <Dato titulo="Retiros y gastos" valor={rd(r.salidas)} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Dato titulo="Fondo inicial" valor={rd(caja.fondo)} />
          <Dato titulo="Esperado" valor={rd(caja.esperado ?? 0)} />
          <Dato titulo="Contado" valor={rd(caja.contado ?? 0)} />
        </div>
      )}
      <Bloque titulo={`Movimientos del turno (${movimientos.length})`}>
        {movimientos.length ? (
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {movimientos.map((m, i) => (
              <FilaMovimiento key={`${m.ts}-${i}`} m={m} />
            ))}
          </div>
        ) : (
          <Vacio texto="Este cierre solo guardó el arqueo: los movimientos del turno no quedaron anotados uno por uno." />
        )}
      </Bloque>
    </div>
  )
}

export function DetalleMovimiento({ m }: { m: MovimientoCaja }) {
  const t = TIPO_MOVIMIENTO[m.tipo]
  return (
    <div className="flex flex-col gap-5">
      <Titulo etiqueta={`${t.nombre} de efectivo`} titulo={<span className={cn("tabular-nums", t.sale && "text-red-600")}>{t.sale ? "− " : "+ "}{rd(m.monto)}</span>} sub={fechaHora(m.ts)} />
      <div className="grid grid-cols-2 gap-2">
        <Dato titulo="Motivo" valor={m.texto} className="col-span-2" />
        <Dato titulo="Método" valor={NOMBRE_METODO[m.metodo]} />
        <Dato titulo="Efecto en la caja" valor={t.sale ? "Sale efectivo" : "Entra efectivo"} />
      </div>
    </div>
  )
}
