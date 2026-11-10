"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "react-hot-toast"
import { AlertTriangle, ArrowUpRight, Bell, Minus, Plus, RotateCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ESTADO_MESA } from "@/components/restaurante/plano/estados"
import { ESTADO_ITEM } from "@/components/restaurante/salon/ResumenMesa"
import { rd, totales } from "@/lib/restaurante/carta"
import { restauranteApi } from "@/lib/restaurante/cliente"
import { cronometro, hace, hora12, NOMBRE_CANAL, NOMBRE_ZONA } from "@/lib/restaurante/local"
import type { Estado, MetodoPago } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import { tipoDe } from "./Comida"

async function ejecutar(a: Parameters<typeof restauranteApi.accion>[0], ok?: string) {
  try {
    await restauranteApi.accion(a)
    if (ok) toast.success(ok)
    return true
  } catch (e) {
    toast.error((e as Error).message)
    return false
  }
}

export function VentanaMesa({ estado, ahora, mesaId, organizar, onCerrar }: { estado: Estado; ahora: number; mesaId?: string; organizar: boolean; onCerrar: () => void }) {
  const m = mesaId ? estado.mesas.find((x) => x.id === mesaId) : undefined
  const [cobrando, setCobrando] = useState(false)
  const [comensales, setComensales] = useState(2)
  if (!m) return <Dialog open={false} />
  const p = m.pedidoId ? estado.pedidos.find((x) => x.id === m.pedidoId) : undefined
  const c = m.clienteId ? estado.clientes.find((x) => x.id === m.clienteId) : undefined
  const r = m.reservaId ? estado.reservas.find((x) => x.id === m.reservaId) : undefined
  const mesero = estado.equipo.find((x) => x.id === m.meseroId)
  const t = totales(p ? p.items.reduce((s, i) => s + i.precio, 0) : 0)
  const listos = p?.items.filter((i) => i.estado === "listo").length ?? 0
  const e = ESTADO_MESA[m.estado]
  const libre = m.estado === "libre" || m.estado === "reservada"

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto p-0 sm:rounded-2xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <div className="text-xs text-muted-foreground">{NOMBRE_ZONA[m.zona]} · {m.capacidad} puestos</div>
          <DialogTitle className="font-display text-3xl font-semibold">Mesa {m.nombre}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: e.color, color: e.texto }}>{e.nombre}</span>
              <span className="text-muted-foreground">desde hace {hace(m.desde, ahora)}</span>
              {m.llamado && (
                <span className="inline-flex items-center gap-1 rounded-full bg-acento/20 px-2.5 py-0.5 text-xs font-medium text-foreground">
                  <Bell className="h-3 w-3" aria-hidden /> {m.llamado.tipo === "cuenta" ? "Pidió la cuenta" : "Llama al mesero"} · {hace(m.llamado.desde, ahora)}
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4 text-sm">
          {organizar ? (
            <div className="grid gap-3">
              <p className="text-muted-foreground">Arrastra la mesa en el plano para moverla dentro de su zona.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="h-11 gap-1.5" onClick={() => ejecutar({ tipo: "moverMesa", mesaId: m.id, x: m.x, y: m.y, rot: ((m.rot ?? 0) + 45) % 360 })}>
                  <RotateCw className="h-4 w-4" aria-hidden /> Girar 45°
                </Button>
                <div className="flex items-center rounded-lg border">
                  <Button variant="ghost" className="h-11 w-11 px-0" aria-label="Menos puestos" onClick={() => ejecutar({ tipo: "editarMesa", mesaId: m.id, capacidad: m.capacidad - 1 })}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-24 text-center tabular-nums">{m.capacidad} puestos</span>
                  <Button variant="ghost" className="h-11 w-11 px-0" aria-label="Más puestos" onClick={() => ejecutar({ tipo: "editarMesa", mesaId: m.id, capacidad: m.capacidad + 1 })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="h-11 gap-1.5 text-destructive"
                  onClick={async () => {
                    if (await ejecutar({ tipo: "quitarMesa", mesaId: m.id }, `Mesa ${m.nombre} quitada`)) onCerrar()
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Quitar
                </Button>
              </div>
              {!libre && <p className="text-xs text-muted-foreground">Esta mesa tiene clientes: se puede mover y girar, pero no quitar.</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Dato t="Mesero" v={mesero?.nombre ?? "Sin asignar"} />
                <Dato t="Personas" v={m.comensales ? String(m.comensales) : "-"} />
                <Dato t="En la mesa" v={m.tramos ? cronometro(m.tramos.llegada, ahora) : "-"} />
              </div>
              {c && (
                <Link href={`/admin/clientes/${c.id}`} className="rounded-xl border px-4 py-3 hover:bg-secondary">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{c.nombre}</span>
                    {c.etiqueta && <span className="shrink-0 rounded-full bg-acento/15 px-2 text-[11px]">{c.etiqueta}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.visitas} visitas · {rd(c.gasto)} · llegó por {NOMBRE_CANAL[c.canalOrigen]}</div>
                </Link>
              )}
              {c?.alergias?.length ? (
                <div className="flex items-center gap-2 rounded-xl bg-destructive-soft px-4 py-2.5 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> Alergia: {c.alergias.join(", ")}
                </div>
              ) : null}
              {r && (
                <Link href={`/admin/reservaciones/${r.id}`} className="rounded-xl bg-secondary px-4 py-3 hover:bg-secondary/70">
                  <div className="font-medium">Reserva {r.codigo} · {hora12(r.hora)} · {r.personas} personas</div>
                  <div className="text-xs text-muted-foreground">{NOMBRE_CANAL[r.canal]}{r.ocasion ? ` · ${r.ocasion}` : ""}</div>
                  {r.notas && <div className="mt-1 text-xs">{r.notas}</div>}
                </Link>
              )}
              {p && (
                <div className="rounded-xl border">
                  <div className="flex justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                    <span>Orden #{p.numero}</span>
                    <span>{p.rondas} {p.rondas === 1 ? "ronda" : "rondas"}</span>
                  </div>
                  <ul className="divide-y px-4">
                    {p.items.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                        <img
                          src={`/boca-marina/comida/${tipoDe(i.platoId)}.png`}
                          alt=""
                          className={cn("h-12 w-12 shrink-0 rounded-xl bg-[#F4ECDF] object-contain p-0.5", i.estado !== "servido" && "opacity-45 grayscale-[40%]")}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{i.cantidad !== 1 ? `${i.cantidad}${Number.isInteger(i.cantidad) ? "×" : " lb"} ` : ""}{i.nombre}</div>
                          {i.mods.length > 0 && <div className="truncate text-xs text-muted-foreground">{i.mods.join(" · ")}</div>}
                        </div>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", ESTADO_ITEM[i.estado].clase)}>{ESTADO_ITEM[i.estado].nombre}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-0.5 border-t px-4 py-2 text-xs text-muted-foreground">
                    <Fila t="Subtotal" v={rd(t.subtotal)} />
                    <Fila t="ITBIS 18 %" v={rd(t.itbis)} />
                    <Fila t="Servicio 10 %" v={rd(t.servicio)} />
                    <div className="flex justify-between pt-1 font-display text-lg font-semibold text-foreground">
                      <span>Total</span>
                      <span className="tabular-nums">{rd(t.total)}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {libre && (
                  <>
                    <div className="flex items-center rounded-lg border">
                      <Button variant="ghost" className="h-11 w-11 px-0" aria-label="Menos personas" onClick={() => setComensales((n) => Math.max(1, n - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-16 text-center tabular-nums">{r?.personas ?? comensales} pers.</span>
                      <Button variant="ghost" className="h-11 w-11 px-0" aria-label="Más personas" onClick={() => setComensales((n) => Math.min(m.capacidad + 2, n + 1))}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button className="h-11" onClick={() => ejecutar({ tipo: "sentar", mesaId: m.id, comensales: r?.personas ?? comensales, clienteId: r?.clienteId, manual: true }, `Mesa ${m.nombre} abierta`)}>
                      {r ? "Llegó la reserva" : "Sentar clientes"}
                    </Button>
                  </>
                )}
                {m.llamado?.tipo === "mesero" && (
                  <Button variant="secondary" className="h-11" onClick={() => ejecutar({ tipo: "atender", mesaId: m.id }, "Llamado atendido")}>Atender llamado</Button>
                )}
                {listos > 0 && <Button variant="secondary" className="h-11" onClick={() => ejecutar({ tipo: "servir", mesaId: m.id }, `${listos} platos servidos`)}>Servir {listos} listos</Button>}
                {p && !cobrando && <Button variant="outline" className="h-11" onClick={() => setCobrando(true)}>Cobrar {rd(t.total)}</Button>}
                {p && cobrando && (
                  <div className="flex flex-wrap gap-1 rounded-lg border p-1">
                    {(["tarjeta", "efectivo", "transferencia"] as MetodoPago[]).map((mp) => (
                      <Button
                        key={mp}
                        variant="ghost"
                        className="h-10 capitalize"
                        onClick={() => {
                          setCobrando(false)
                          ejecutar({ tipo: "cobrar", mesaId: m.id, metodo: mp, propinaPct: 10 }, "Cuenta cobrada")
                        }}
                      >
                        {mp}
                      </Button>
                    ))}
                  </div>
                )}
                {m.estado === "limpieza" && <Button className="h-11" onClick={() => ejecutar({ tipo: "liberar", mesaId: m.id }, "Mesa lista")}>Marcar limpia</Button>}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-4">
          <a href={`/mesa/${m.id}`} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground">QR del cliente</a>
          <Button asChild className="h-11 gap-1.5">
            <Link href={`/admin/salon/mesas/${m.id}`}>
              Ver la mesa completa <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{t}</div>
      <div className="truncate font-medium tabular-nums">{v}</div>
    </div>
  )
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{t}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  )
}
