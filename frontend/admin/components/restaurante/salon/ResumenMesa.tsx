"use client"

import Link from "next/link"
import { toast } from "react-hot-toast"
import { ArrowUpRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ESTADO_MESA } from "@/components/restaurante/plano/estados"
import { rd, totales } from "@/lib/restaurante/carta"
import { conError, restauranteApi } from "@/lib/restaurante/cliente"
import { hace, hora12, NOMBRE_CANAL, NOMBRE_ZONA } from "@/lib/restaurante/local"
import type { Estado, EstadoItem } from "@/lib/restaurante/tipos"

export const ESTADO_ITEM: Record<EstadoItem, { nombre: string; clase: string }> = {
  pendiente: { nombre: "En cola", clase: "bg-secondary text-muted-foreground" },
  preparando: { nombre: "Preparando", clase: "bg-acento/20 text-foreground" },
  listo: { nombre: "Listo", clase: "bg-success-soft text-success" },
  servido: { nombre: "Servido", clase: "bg-info-soft text-info" },
}

const avisar = (m: string) => toast.error(m)

export function ResumenMesa({ estado, ahora, mesaId, onCerrar }: { estado: Estado; ahora: number; mesaId: string; onCerrar?: () => void }) {
  const m = estado.mesas.find((x) => x.id === mesaId)
  if (!m) return null
  const p = m.pedidoId ? estado.pedidos.find((x) => x.id === m.pedidoId) : undefined
  const c = m.clienteId ? estado.clientes.find((x) => x.id === m.clienteId) : undefined
  const r = m.reservaId ? estado.reservas.find((x) => x.id === m.reservaId) : undefined
  const mesero = estado.equipo.find((x) => x.id === m.meseroId)
  const t = totales(p ? p.items.reduce((s, i) => s + i.precio, 0) : 0)
  const listos = p?.items.filter((i) => i.estado === "listo").length ?? 0
  const e = ESTADO_MESA[m.estado]

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{NOMBRE_ZONA[m.zona]} · {m.capacidad} sillas</div>
          <h3 className="font-display text-3xl font-semibold leading-tight">Mesa {m.nombre}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: e.color, color: e.texto }}>{e.nombre}</span>
            <span className="text-muted-foreground">hace {hace(m.desde, ahora)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button asChild size="sm" variant="outline" className="h-8 gap-1">
            <Link href={`/admin/salon/mesas/${m.id}`}>Abrir <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </Button>
          {onCerrar && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCerrar} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 text-sm">
        {m.llamado && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-acento/15 px-3 py-2">
            <span>{m.llamado.tipo === "cuenta" ? "Pidió la cuenta" : "Llamó al mesero"} hace {hace(m.llamado.desde, ahora)}</span>
            {m.llamado.tipo === "mesero" && (
              <Button size="sm" className="h-7" onClick={() => conError(() => restauranteApi.accion({ tipo: "atender", mesaId: m.id }), avisar)}>Atendido</Button>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Dato t="Mesero" v={mesero?.nombre ?? "Sin asignar"} />
          <Dato t="Comensales" v={m.comensales ? String(m.comensales) : "-"} />
        </div>
        {c && (
          <Link href={`/admin/clientes/${c.id}`} className="rounded-lg border px-3 py-2 hover:bg-secondary">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{c.nombre}</span>
              {c.etiqueta && <span className="shrink-0 rounded-full bg-acento/15 px-2 text-[11px] text-foreground">{c.etiqueta}</span>}
            </div>
            <div className="text-xs text-muted-foreground">{c.visitas} visitas · {rd(c.gasto)} · llegó por {NOMBRE_CANAL[c.canalOrigen]}</div>
            {c.alergias?.length ? <div className="mt-0.5 text-xs font-medium text-destructive">Alergia: {c.alergias.join(", ")}</div> : null}
          </Link>
        )}
        {r && (
          <Link href={`/admin/reservaciones/${r.id}`} className="rounded-lg bg-secondary px-3 py-2 hover:bg-secondary/70">
            <div className="font-medium">Reserva {hora12(r.hora)} · {r.personas} personas</div>
            <div className="text-xs text-muted-foreground">{r.codigo} · {NOMBRE_CANAL[r.canal]}{r.ocasion ? ` · ${r.ocasion}` : ""}</div>
            {r.notas && <div className="mt-0.5 text-xs">{r.notas}</div>}
          </Link>
        )}
        {p && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Orden #{p.numero}</span>
              <span>{p.rondas} {p.rondas === 1 ? "ronda" : "rondas"}</span>
            </div>
            <ul className="divide-y">
              {p.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate">{i.cantidad !== 1 ? `${i.cantidad}${Number.isInteger(i.cantidad) ? "×" : " lb"} ` : ""}{i.nombre}</span>
                  <span className={`shrink-0 rounded-full px-2 text-[11px] font-medium ${ESTADO_ITEM[i.estado].clase}`}>{ESTADO_ITEM[i.estado].nombre}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t pt-2 font-medium">
              <span>Total con ITBIS y servicio</span>
              <span className="tabular-nums">{rd(t.total)}</span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(m.estado === "libre" || m.estado === "reservada") && (
            <Button size="sm" onClick={() => conError(() => restauranteApi.accion({ tipo: "sentar", mesaId: m.id, comensales: r?.personas ?? Math.min(2, m.capacidad), clienteId: r?.clienteId }), avisar)}>
              Sentar {r ? "la reserva" : "clientes"}
            </Button>
          )}
          {listos > 0 && <Button size="sm" variant="secondary" onClick={() => conError(() => restauranteApi.accion({ tipo: "servir", mesaId: m.id }), avisar)}>Servir {listos} listos</Button>}
          {p && <Button size="sm" variant="outline" asChild><Link href={`/admin/ordenes?mesa=${m.id}`}>Agregar platos</Link></Button>}
          {p && <Button size="sm" variant="outline" onClick={() => conError(() => restauranteApi.accion({ tipo: "cobrar", mesaId: m.id, metodo: "tarjeta", propinaPct: 10 }), avisar)}>Cobrar</Button>}
          {m.estado === "limpieza" && <Button size="sm" variant="outline" onClick={() => conError(() => restauranteApi.accion({ tipo: "liberar", mesaId: m.id }), avisar)}>Marcar limpia</Button>}
        </div>
      </div>
    </section>
  )
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{t}</div>
      <div className="truncate font-medium">{v}</div>
    </div>
  )
}
