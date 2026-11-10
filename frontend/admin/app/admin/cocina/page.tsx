"use client"

import { useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { Check, CheckCheck, Loader2, RotateCcw } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Switch } from "@/components/ui/switch"
import { useAdmin } from "@/contexts/admin-context"
import { ESTACIONES, PLATOS } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import type { Estacion, Estado, ItemPedido, Pedido } from "@/lib/restaurante/tipos"
import { cantidadTexto, esAviso, reloj } from "@/components/restaurante/operacion/util"
import { cn } from "@/lib/utils"

type Pestana = Estacion | "pase"

interface Ticket {
  clave: string
  pedido: Pedido
  ronda: number
  items: ItemPedido[]
  enviado: number
  objetivo: number
}

const MIN = 60 * 1000

function semaforo(ms: number, objetivo: number) {
  const r = ms / (objetivo * MIN)
  if (r >= 1) return { borde: "border-[#E86A6A]", cabeza: "bg-[#E86A6A] text-[#1A0B0B]", texto: "Atrasado" }
  if (r >= 0.75) return { borde: "border-[#F2C14E]", cabeza: "bg-[#F2C14E] text-[#1F1606]", texto: "Cerca del tiempo" }
  return { borde: "border-[#6BBF8A]", cabeza: "bg-[#6BBF8A] text-[#06190E]", texto: "En tiempo" }
}

function tickets(estado: Estado, pestana: Pestana): Ticket[] {
  const lista: Ticket[] = []
  for (const p of estado.pedidos) {
    const rondas = Array.from(new Set(p.items.map((i) => i.ronda)))
    for (const r of rondas) {
      const items = p.items.filter((i) => i.ronda === r && (pestana === "pase" || i.estacion === pestana))
      const vivos = items.filter((i) => i.estado !== "servido")
      if (!vivos.length) continue
      if (pestana !== "pase" && vivos.every((i) => i.estado === "listo")) continue
      lista.push({
        clave: `${p.id}-${r}`,
        pedido: p,
        ronda: r,
        items: pestana === "pase" ? vivos : items.filter((i) => i.estado !== "servido"),
        enviado: Math.min(...vivos.map((i) => i.enviado)),
        objetivo: Math.max(...vivos.map((i) => i.minutos)),
      })
    }
  }
  return lista.sort((a, b) => a.enviado - b.enviado)
}

export default function CocinaPage() {
  const { estado, ahora } = useRestaurante()
  const { user } = useAdmin()
  const [pestana, setPestana] = useState<Pestana>("caliente")
  const lista = useMemo(() => (estado ? tickets(estado, pestana) : []), [estado, pestana])

  const accion = (f: () => Promise<unknown>) => f().catch((e) => toast.error((e as Error).message))

  if (!estado) {
    return (
      <AdminLayout title="Cocina">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando con la cocina…
        </div>
      </AdminLayout>
    )
  }

  const conteo = (e: Pestana) => tickets(estado, e).length
  const esperando = estado.mesas
    .map((m) => {
      const p = estado.pedidos.find((x) => x.id === m.pedidoId)
      const listos = p?.items.filter((i) => i.estado === "listo") ?? []
      return { mesa: m, listos: listos.length, desde: listos.length ? Math.min(...listos.map((i) => i.listo ?? ahora)) : 0 }
    })
    .filter((x) => x.listos)
    .sort((a, b) => a.desde - b.desde)
  const mesero = (id: string) => estado.equipo.find((p) => p.id === id)

  return (
    <AdminLayout title="Cocina">
      <div className="-mx-4 -my-6 flex min-h-[calc(100dvh-4rem)] flex-col bg-[#071A1C] text-[#F4ECDF] sm:-mx-6 lg:-mx-8 lg:-my-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Estaciones">
            {[...ESTACIONES.map((e) => ({ id: e.id as Pestana, nombre: e.nombre })), { id: "pase" as Pestana, nombre: "Pase" }].map((e) => (
              <button
                key={e.id}
                role="tab"
                aria-selected={pestana === e.id}
                onClick={() => setPestana(e.id)}
                className={cn(
                  "flex h-12 shrink-0 items-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors",
                  pestana === e.id ? "bg-[#F4ECDF] text-[#0B2A2E]" : "text-[#F4ECDF]/70 hover:bg-white/5 hover:text-[#F4ECDF]",
                )}
              >
                {e.nombre}
                <span className={cn("min-w-7 rounded-full px-2 py-0.5 text-center text-sm", pestana === e.id ? "bg-[#0B2A2E] text-[#F4ECDF]" : "bg-white/10")}>{conteo(e.id)}</span>
              </button>
            ))}
          </div>
          {(user?.role as string | undefined) !== "cocina" && (
            <label className="flex items-center gap-2 text-sm text-[#F4ECDF]/75">
              <Switch checked={estado.config.cocinaAuto} onCheckedChange={(v) => accion(() => restauranteApi.accion({ tipo: "config", config: { cocinaAuto: v } }))} />
              Cocina automática (demo)
            </label>
          )}
        </div>

        <div className="flex-1 overflow-x-hidden p-4 sm:p-6">
          {!lista.length ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 text-center text-[#F4ECDF]/60">
              <CheckCheck className="h-10 w-10" aria-hidden />
              <p className="text-xl font-semibold text-[#F4ECDF]/80">Todo al día</p>
              <p className="text-sm">No hay platos pendientes en esta estación.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {lista.map((t) => {
                const mesa = estado.mesas.find((m) => m.id === t.pedido.mesaId)
                const s = semaforo(ahora - t.enviado, t.objetivo)
                const cliente = t.pedido.clienteId ? estado.clientes.find((c) => c.id === t.pedido.clienteId) : undefined
                const pendientes = t.items.some((i) => i.estado === "pendiente" || i.estado === "preparando")
                return (
                  <article key={t.clave} className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border-2 bg-[#0D2A2E]", s.borde)}>
                    <header className={cn("flex items-center justify-between gap-2 px-4 py-2.5", s.cabeza)}>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold leading-none">{mesa?.nombre ?? t.pedido.mesaId}</p>
                        <p className="mt-1 text-xs font-semibold opacity-80">
                          #{t.pedido.numero} · ronda {t.ronda} · {t.pedido.comensales} pax · {mesero(t.pedido.meseroId)?.nombre ?? ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums leading-none">{reloj(ahora - t.enviado)}</p>
                        <p className="mt-1 text-[11px] font-semibold opacity-80">{s.texto} · {t.objetivo} min</p>
                      </div>
                    </header>
                    {cliente?.alergias?.length ? (
                      <p className="bg-[#E86A9B]/20 px-4 py-1.5 text-sm font-bold text-[#FFB3CF]">Alergia: {cliente.alergias.join(", ")}</p>
                    ) : null}
                    <ul className="flex flex-1 flex-col divide-y divide-white/10">
                      {t.items.map((i) => {
                        const listo = i.estado === "listo"
                        const enPase = pestana === "pase"
                        return (
                          <li key={i.id} className="flex items-stretch">
                            <button
                              disabled={listo || enPase}
                              onClick={() => accion(() => restauranteApi.accion({ tipo: "item", pedidoId: t.pedido.id, itemId: i.id, estado: i.estado === "pendiente" ? "preparando" : "listo" }))}
                              className={cn(
                                "flex min-h-16 min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors",
                                !listo && !enPase && "hover:bg-white/5 active:bg-white/10",
                                listo && "opacity-55",
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                                  i.estado === "pendiente" && "border-white/40",
                                  i.estado === "preparando" && "border-[#F2C14E] bg-[#F2C14E]/20",
                                  listo && "border-[#6BBF8A] bg-[#6BBF8A] text-[#06190E]",
                                )}
                                aria-hidden
                              >
                                {listo && <Check className="h-4 w-4" />}
                              </span>
                              <span className="min-w-0">
                                <span className={cn("block text-lg font-semibold leading-snug", listo && "line-through")}>
                                  {cantidadTexto(i.cantidad, PLATOS.get(i.platoId)?.porLibra) || "1x"} {i.nombre}
                                </span>
                                {(i.mods.length > 0 || i.notas) && (
                                  <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-sm">
                                    {i.mods.map((m) => (
                                      <span key={m} className={cn(esAviso(m) ? "rounded bg-[#E8866A] px-1.5 font-bold uppercase text-[#1A0B05]" : "text-[#F4ECDF]/70")}>{m}</span>
                                    ))}
                                    {i.notas && <span className="rounded bg-[#F2C14E] px-1.5 font-bold text-[#1F1606]">{i.notas}</span>}
                                  </span>
                                )}
                                <span className="mt-0.5 block text-xs text-[#F4ECDF]/50">
                                  {i.estado === "pendiente" ? "Tocar para empezar" : i.estado === "preparando" ? `Preparando ${i.inicio ? reloj(ahora - i.inicio) : ""} · tocar al terminar` : "Listo para el pase"}
                                  {enPase ? ` · ${ESTACIONES.find((e) => e.id === i.estacion)?.nombre}` : ""}
                                </span>
                              </span>
                            </button>
                            {listo && !enPase && (
                              <button
                                onClick={() => accion(() => restauranteApi.accion({ tipo: "item", pedidoId: t.pedido.id, itemId: i.id, estado: "preparando" }))}
                                className="flex w-14 shrink-0 items-center justify-center text-[#F4ECDF]/60 hover:bg-white/5 hover:text-[#F4ECDF]"
                                aria-label={`Deshacer ${i.nombre}`}
                                title="Deshacer"
                              >
                                <RotateCcw className="h-5 w-5" />
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {pestana !== "pase" && pendientes && (
                      <button
                        onClick={() => accion(() => restauranteApi.accion({ tipo: "ticket", pedidoId: t.pedido.id, estacion: pestana }))}
                        className="m-3 flex h-14 items-center justify-center gap-2 rounded-lg bg-[#6BBF8A] text-lg font-bold text-[#06190E] transition hover:brightness-110 active:scale-[0.99]"
                      >
                        <CheckCheck className="h-5 w-5" /> Todo listo
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex items-center gap-3 overflow-x-auto border-t border-white/10 bg-[#04120F] px-4 py-3 scrollbar-hide sm:px-6">
          <span className="shrink-0 text-sm font-semibold text-[#F4ECDF]/70">Esperando al mesero</span>
          {esperando.length ? (
            esperando.map((x) => (
              <span key={x.mesa.id} className="flex shrink-0 items-center gap-2 rounded-full bg-[#6BBF8A]/15 px-3 py-1.5 text-sm font-semibold text-[#9FE3B8]">
                {x.mesa.nombre} · {x.listos} {x.listos === 1 ? "plato" : "platos"} · {reloj(ahora - x.desde)}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#F4ECDF]/50">Nada en el pase.</span>
          )}
        </footer>
      </div>
    </AdminLayout>
  )
}
