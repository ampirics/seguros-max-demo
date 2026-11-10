"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { ArrowLeft, Bell, ChefHat, ExternalLink, Hand, Loader2, Minus, Plus, Receipt, Send, Sparkles, Trash2, Users } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/contexts/admin-context"
import { PLATOS, rd, totales } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { NOMBRE_ZONA } from "@/lib/restaurante/local"
import type { Estado, Mesa, MetodoPago, Pedido, Plato } from "@/lib/restaurante/tipos"
import { ESTADO_MESA } from "@/components/restaurante/plano/estados"
import { CartaGrid } from "@/components/restaurante/operacion/CartaGrid"
import { platosAgotados } from "@/lib/restaurante/inventario"
import { Cobrar } from "@/components/restaurante/operacion/Cobrar"
import { Personalizar, type LineaCarrito } from "@/components/restaurante/operacion/Personalizar"
import { cantidadTexto, ESTADO_ITEM, esAviso, reloj } from "@/components/restaurante/operacion/util"
import { cn } from "@/lib/utils"
import { aplicarFiltro, FiltroMesas, useFiltroMesas } from "@/components/restaurante/FiltroMesas"

const TODOS = "todos"

function avisos(m: Mesa, p?: Pedido) {
  const lista: { texto: string; tono: "listo" | "llamado" | "cuenta" }[] = []
  const listos = p?.items.filter((i) => i.estado === "listo").length ?? 0
  if (listos) lista.push({ texto: `${listos} ${listos === 1 ? "plato listo" : "platos listos"}`, tono: "listo" })
  if (m.llamado?.tipo === "mesero") lista.push({ texto: "Llama al mesero", tono: "llamado" })
  if (m.estado === "cuenta") lista.push({ texto: "Pidió la cuenta", tono: "cuenta" })
  return lista
}

const TONO = { listo: "bg-success-soft text-success", llamado: "bg-warning-soft text-warning", cuenta: "bg-destructive-soft text-destructive" }

export default function OrdenesPage() {
  const { estado, ahora } = useRestaurante()
  const agotados = useMemo(() => platosAgotados(estado?.insumos), [estado?.insumos])
  const { user } = useAdmin()
  const meseros = estado?.equipo.filter((p) => p.rol === "mesero") ?? []
  const [mesero, setMesero] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [personalizar, setPersonalizar] = useState<Plato | null>(null)
  const [cobrando, setCobrando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [filtro, cambiarFiltro] = useFiltroMesas()

  useEffect(() => {
    if (mesero !== null || !estado) return
    setMesero(estado.equipo.some((p) => p.rol === "mesero" && p.id === user?.id) ? user!.id : TODOS)
  }, [estado, user, mesero])

  useEffect(() => {
    if (typeof window === "undefined") return
    const m = new URLSearchParams(location.search).get("mesa")
    if (m) setSel(m)
  }, [])

  const mesas = useMemo(() => {
    if (!estado) return []
    const persona = estado.equipo.find((p) => p.id === mesero)
    const lista = estado.mesas.filter((m) => !persona || m.meseroId === persona.id || (!m.meseroId && persona.zonas.includes(m.zona)))
    const peso = (m: Mesa) => {
      const p = estado.pedidos.find((x) => x.id === m.pedidoId)
      if (avisos(m, p).length) return 0
      if (m.estado === "ocupada") return 1
      if (["en_cocina", "servida"].includes(m.estado)) return 2
      if (m.estado === "reservada") return 3
      if (m.estado === "limpieza") return 4
      return 5
    }
    return aplicarFiltro(lista, estado, filtro, peso)
  }, [estado, mesero, filtro])
  const totalMesas = estado ? estado.mesas.filter((m) => { const p = estado.equipo.find((x) => x.id === mesero); return !p || m.meseroId === p.id || (!m.meseroId && p.zonas.includes(m.zona)) }).length : 0

  const mesa = estado?.mesas.find((m) => m.id === sel)
  const pedido = mesa?.pedidoId ? estado?.pedidos.find((p) => p.id === mesa.pedidoId) : undefined

  useEffect(() => {
    setAgregando(false)
    setCarrito([])
  }, [sel])

  const correr = async (f: () => Promise<unknown>, ok?: string) => {
    setOcupado(true)
    try {
      await f()
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const enviar = () =>
    mesa &&
    correr(async () => {
      if (!mesa.manual) await restauranteApi.accion({ tipo: "manual", mesaId: mesa.id, manual: true })
      await restauranteApi.accion({ tipo: "ordenar", mesaId: mesa.id, items: carrito.map(({ platoId, cantidad, mods, notas }) => ({ platoId, cantidad, mods, notas })) })
      setCarrito([])
      setAgregando(false)
    }, `Ronda enviada a cocina: ${carrito.length} ${carrito.length === 1 ? "plato" : "platos"}`)

  if (!estado) {
    return (
      <AdminLayout title="Órdenes">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando con el salón…
        </div>
      </AdminLayout>
    )
  }

  const cliente = mesa?.clienteId ? estado.clientes.find((c) => c.id === mesa.clienteId) : undefined
  const reserva = mesa?.reservaId ? estado.reservas.find((r) => r.id === mesa.reservaId) : undefined
  const subtotal = pedido?.items.reduce((s, i) => s + i.precio, 0) ?? 0
  const totalCarrito = carrito.reduce((s, l) => s + l.importe, 0)

  return (
    <AdminLayout title="Órdenes">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="etiqueta mr-1">Mesas de</span>
          {[{ id: TODOS, nombre: "Todo el salón", color: "" }, ...meseros].map((p) => (
            <button
              key={p.id}
              onClick={() => setMesero(p.id)}
              aria-pressed={mesero === p.id}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                mesero === p.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {p.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />}
              {p.nombre}
            </button>
          ))}
        </div>

        <FiltroMesas filtro={filtro} onCambio={cambiarFiltro} total={totalMesas} visibles={mesas.length} />

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
          <section className={cn("min-w-0", sel && "hidden lg:block")} aria-label="Mesas">
            {agregando && mesa ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-2xl">Carta para {mesa.nombre}</h2>
                  <Button variant="ghost" onClick={() => setAgregando(false)}>Cerrar carta</Button>
                </div>
                <CartaGrid onElegir={setPersonalizar} agotados={agotados} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {mesas.map((m) => (
                  <TarjetaMesa key={m.id} mesa={m} estado={estado} ahora={ahora} activa={m.id === sel} onClick={() => setSel(m.id)} />
                ))}
                {!mesas.length && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Sin mesas asignadas ahora.</p>}
              </div>
            )}
          </section>

          <aside className={cn("min-w-0", !sel && "hidden lg:block")} aria-label="Mesa seleccionada">
            {!mesa ? (
              <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
                <Hand className="h-6 w-6" aria-hidden />
                Toca una mesa para tomar la orden, servir o cobrar.
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 lg:sticky lg:top-20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button onClick={() => setSel(null)} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground lg:hidden">
                      <ArrowLeft className="h-3.5 w-3.5" /> Mesas
                    </button>
                    <p className="etiqueta">{NOMBRE_ZONA[mesa.zona]} · {mesa.capacidad} sillas</p>
                    <h2 className="font-display text-3xl leading-tight">Mesa {mesa.nombre}</h2>
                  </div>
                  <span className="mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: ESTADO_MESA[mesa.estado].color, color: ESTADO_MESA[mesa.estado].texto }}>
                    {ESTADO_MESA[mesa.estado].nombre}
                  </span>
                </div>

                {(cliente || reserva) && (
                  <div className="rounded-lg bg-secondary px-3 py-2.5 text-sm">
                    {cliente && (
                      <p className="font-medium">
                        {cliente.nombre}
                        {cliente.visitas ? <span className="font-normal text-muted-foreground"> · {cliente.visitas} visitas</span> : null}
                      </p>
                    )}
                    {cliente?.alergias?.length ? <p className="mt-0.5 font-medium text-destructive">Alergia: {cliente.alergias.join(", ")}</p> : null}
                    {reserva && <p className="mt-0.5 text-muted-foreground">Reserva {reserva.codigo}{reserva.ocasion ? ` · ${reserva.ocasion}` : ""}</p>}
                    {reserva?.notas && <p className="mt-0.5 text-foreground">{reserva.notas}</p>}
                  </div>
                )}

                {(mesa.estado === "libre" || mesa.estado === "reservada") && (
                  <Sentar mesa={mesa} personas={reserva?.personas} ocupado={ocupado} onSentar={(n) => correr(() => restauranteApi.accion({ tipo: "sentar", mesaId: mesa.id, comensales: n, clienteId: reserva?.clienteId, manual: true }), `Mesa ${mesa.nombre} abierta`)} />
                )}

                {mesa.estado === "limpieza" && (
                  <Button size="lg" className="h-12" disabled={ocupado} onClick={() => correr(() => restauranteApi.accion({ tipo: "liberar", mesaId: mesa.id }), `Mesa ${mesa.nombre} lista`)}>
                    <Sparkles className="h-4 w-4" /> Marcar limpia
                  </Button>
                )}

                {!["libre", "reservada", "limpieza"].includes(mesa.estado) && (
                  <>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {mesa.comensales ?? "-"} personas</span>
                      {mesa.tramos && <span>En la mesa {reloj(ahora - mesa.tramos.llegada)}</span>}
                      {pedido && <span>Orden #{pedido.numero}</span>}
                    </div>

                    {mesa.llamado?.tipo === "mesero" && (
                      <Button variant="outline" size="lg" className="h-12 border-warning/50 bg-warning-soft" disabled={ocupado} onClick={() => correr(() => restauranteApi.accion({ tipo: "atender", mesaId: mesa.id }), "Llamado atendido")}>
                        <Bell className="h-4 w-4" /> Atender llamado ({reloj(ahora - mesa.llamado.desde)})
                      </Button>
                    )}

                    {pedido ? <Rondas pedido={pedido} ahora={ahora} /> : <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Todavía no hay orden. Agrega los platos de la primera ronda.</p>}

                    {carrito.length > 0 && (
                      <div className="rounded-lg border border-primary/30 bg-accent/40 p-3">
                        <p className="etiqueta mb-2">Ronda nueva, sin enviar</p>
                        <ul className="flex flex-col gap-2">
                          {carrito.map((l) => (
                            <li key={l.clave} className="flex items-start justify-between gap-2 text-sm">
                              <div className="min-w-0">
                                <p className="font-medium">{cantidadTexto(l.cantidad, PLATOS.get(l.platoId)?.porLibra)} {l.nombre}</p>
                                {(l.mods.length > 0 || l.notas) && <p className="text-xs text-muted-foreground">{[...l.mods, l.notas].filter(Boolean).join(" · ")}</p>}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="tabular-nums text-muted-foreground">{rd(l.importe)}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quitar ${l.nombre}`} onClick={() => setCarrito((c) => c.filter((x) => x.clave !== l.clave))}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <Button size="lg" className="mt-3 h-12 w-full text-base" disabled={ocupado} onClick={enviar}>
                          <Send className="h-4 w-4" /> Enviar a cocina · {rd(totalCarrito)}
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={agregando ? "secondary" : "outline"} size="lg" className="h-12" onClick={() => setAgregando((v) => !v)}>
                        <Plus className="h-4 w-4" /> {agregando ? "Ocultar carta" : "Agregar platos"}
                      </Button>
                      {pedido?.items.some((i) => i.estado === "listo") ? (
                        <Button size="lg" className="h-12 bg-success text-white hover:bg-success/90" disabled={ocupado} onClick={() => correr(() => restauranteApi.accion({ tipo: "servir", mesaId: mesa.id }), "Platos servidos")}>
                          <ChefHat className="h-4 w-4" /> Servir lo listo
                        </Button>
                      ) : (
                        <Button variant="outline" size="lg" className="h-12" disabled={!pedido || ocupado || mesa.estado === "cuenta"} onClick={() => correr(() => restauranteApi.accion({ tipo: "llamar", mesaId: mesa.id, llamado: "cuenta", origen: "mesero" }), "Cuenta pedida")}>
                          <Receipt className="h-4 w-4" /> Pedir cuenta
                        </Button>
                      )}
                    </div>
                    {pedido && (
                      <Button size="lg" className="h-12 text-base" disabled={ocupado} onClick={() => setCobrando(true)}>
                        Cobrar {rd(totales(subtotal).total)}
                      </Button>
                    )}
                  </>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
                  <Link href={`/admin/salon/mesas/${mesa.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">Página de la mesa</Link>
                  <a href={`/mesa/${mesa.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">QR del cliente <ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
                {agregando && (
                  <div className="lg:hidden">
                    <CartaGrid onElegir={setPersonalizar} compacta agotados={agotados} />
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      <Personalizar
        plato={personalizar}
        alergiasCliente={cliente?.alergias}
        onCerrar={() => setPersonalizar(null)}
        onAgregar={(l) => {
          setCarrito((c) => [...c, l])
          setPersonalizar(null)
          toast.success(`${l.nombre} en la ronda`)
        }}
      />
      {mesa && (
        <Cobrar
          abierto={cobrando}
          mesa={mesa.nombre}
          subtotal={subtotal}
          ocupado={ocupado}
          onCerrar={() => setCobrando(false)}
          onCobrar={(metodo: MetodoPago, propinaPct: number) =>
            correr(async () => {
              await restauranteApi.accion({ tipo: "cobrar", mesaId: mesa.id, metodo, propinaPct })
              setCobrando(false)
            }, `Mesa ${mesa.nombre} cobrada`)
          }
        />
      )}
    </AdminLayout>
  )
}

function TarjetaMesa({ mesa, estado, ahora, activa, onClick }: { mesa: Mesa; estado: Estado; ahora: number; activa: boolean; onClick: () => void }) {
  const p = mesa.pedidoId ? estado.pedidos.find((x) => x.id === mesa.pedidoId) : undefined
  const lista = avisos(mesa, p)
  const reserva = mesa.reservaId ? estado.reservas.find((r) => r.id === mesa.reservaId) : undefined
  const e = ESTADO_MESA[mesa.estado]
  const nueva = mesa.estado === "ocupada" && mesa.tramos && !mesa.tramos.orden && ahora - mesa.tramos.llegada < 3 * 60_000
  const mesero = nueva ? estado.equipo.find((x) => x.id === mesa.meseroId) : undefined
  return (
    <button
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        "relative flex min-h-32 min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-3 pl-4 text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
        activa && "ring-2 ring-primary",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: e.color }} aria-hidden />
      <span className="flex items-start justify-between gap-2">
        <span className="font-display text-2xl leading-none">{mesa.nombre}</span>
        <span className="text-xs text-muted-foreground">{mesa.comensales ? `${mesa.comensales}/${mesa.capacidad}` : mesa.capacidad} <Users className="inline h-3 w-3" aria-hidden /></span>
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{NOMBRE_ZONA[mesa.zona]}</span>
      <span className="mt-2 text-sm font-medium" style={{ color: "inherit" }}>
        {e.nombre}
        {mesa.estado === "reservada" && reserva ? ` · ${reserva.hora}` : ""}
        {["ocupada", "en_cocina", "servida", "cuenta"].includes(mesa.estado) && mesa.tramos ? <span className="font-normal text-muted-foreground"> · {reloj(ahora - mesa.tramos.llegada)}</span> : null}
      </span>
      <span className="mt-auto flex flex-wrap gap-1 pt-2">
        {nueva && (
          <span className="animate-pulse rounded-full bg-[#E8866A] px-2 py-0.5 text-[11px] font-semibold text-white">
            Nueva{mesero ? ` · ${mesero.nombre}` : ""}
          </span>
        )}
        {lista.map((a) => (
          <span key={a.texto} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TONO[a.tono])}>{a.texto}</span>
        ))}
      </span>
    </button>
  )
}

function Sentar({ mesa, personas, ocupado, onSentar }: { mesa: Mesa; personas?: number; ocupado: boolean; onSentar: (n: number) => void }) {
  const [n, setN] = useState(personas ?? Math.min(2, mesa.capacidad))
  useEffect(() => setN(personas ?? Math.min(2, mesa.capacidad)), [mesa.id, personas, mesa.capacidad])
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{personas ? "Llegó la reserva. ¿Cuántos son?" : "¿Cuántas personas se sientan?"}</p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setN((x) => Math.max(1, x - 1))} aria-label="Menos personas"><Minus className="h-4 w-4" /></Button>
        <span className="w-12 text-center text-3xl font-semibold tabular-nums">{n}</span>
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setN((x) => Math.min(mesa.capacidad + 2, x + 1))} aria-label="Más personas"><Plus className="h-4 w-4" /></Button>
      </div>
      <Button size="lg" className="h-12 text-base" disabled={ocupado} onClick={() => onSentar(n)}>Abrir mesa</Button>
    </div>
  )
}

function Rondas({ pedido, ahora }: { pedido: Pedido; ahora: number }) {
  const rondas = Array.from(new Set(pedido.items.map((i) => i.ronda))).sort((a, b) => a - b)
  return (
    <div className="flex flex-col gap-3">
      {rondas.map((r) => {
        const items = pedido.items.filter((i) => i.ronda === r)
        return (
          <div key={r}>
            <p className="etiqueta mb-1.5">Ronda {r} · enviada hace {reloj(ahora - items[0].enviado)}</p>
            <ul className="divide-y rounded-lg border">
              {items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{cantidadTexto(i.cantidad, PLATOS.get(i.platoId)?.porLibra)} {i.nombre}</p>
                    {(i.mods.length > 0 || i.notas) && (
                      <p className="text-xs text-muted-foreground">
                        {[...i.mods, i.notas].filter(Boolean).map((m, k) => (
                          <span key={k} className={cn(esAviso(String(m)) && "font-semibold text-acento")}>{k ? " · " : ""}{m}</span>
                        ))}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold text-[#0B2A2E]" style={{ background: ESTADO_ITEM[i.estado].color }}>
                    {ESTADO_ITEM[i.estado].nombre}{i.estado === "preparando" && i.inicio ? ` ${reloj(ahora - i.inicio)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
