"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell, Box, ChefHat, Clock, Expand, LayoutGrid, Receipt, Sparkles, Users } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Salon3D } from "@/components/restaurante/salon3d/Salon3D"
import type { VistaZona } from "@/components/restaurante/salon3d/Escena"
import PlanoLimpio from "@/components/restaurante/plano/PlanoLimpio"
import { Leyenda } from "@/components/restaurante/plano/Leyenda"
import { ResumenMesa } from "@/components/restaurante/salon/ResumenMesa"
import { Bitacora } from "@/components/restaurante/salon/Bitacora"
import { ControlesDemo } from "@/components/restaurante/salon/ControlesDemo"
import { useAdmin } from "@/contexts/admin-context"
import { rd } from "@/lib/restaurante/carta"
import { useRestaurante } from "@/lib/restaurante/cliente"
import { fechaLocal, hace, hora12, horaLocal, NOMBRE_CANAL, NOMBRE_ZONA, tsLocal } from "@/lib/restaurante/local"
import type { Estado } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const TAREA: Record<string, string> = {
  reposo: "Disponible",
  recibir: "Recibiendo clientes",
  tomar: "Tomando la orden",
  servir: "Sirviendo",
  atender: "Atendiendo un llamado",
  cobrar: "Cobrando",
  limpiar: "Recogiendo la mesa",
}

export default function SalonPage() {
  const { estado, ahora } = useRestaurante()
  const { user } = useAdmin()
  const [sel, setSel] = useState<string>()
  const [vista, setVista] = useState<"viva" | "plano">("viva")
  const [zona, setZona] = useState<VistaZona>("todo")
  const puedeControlar = ["admin", "super_admin", "gerente"].includes(user?.role ?? "")

  return (
    <AdminLayout title="Salón en vivo">
      {!estado ? (
        <div className="grid gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="aspect-[64/46] w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Indicadores estado={estado} ahora={ahora} />
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                  </span>
                  En vivo · {horaLocal(ahora)} en Boca Chica
                </div>
                <div className="flex flex-wrap items-center gap-2">
                {vista === "viva" && (
                  <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Zona">
                    {(["todo", "terraza", "muelle", "gazebo", "salon"] as VistaZona[]).map((z) => (
                      <Button key={z} size="sm" variant={zona === z ? "default" : "ghost"} className="h-8 px-2.5" onClick={() => setZona(z)} aria-pressed={zona === z}>
                        {{ todo: "Todo", terraza: "Terraza", muelle: "Muelle", gazebo: "Gazebo", salon: "Salón" }[z]}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Vista del salón">
                  <Button size="sm" variant={vista === "viva" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => setVista("viva")} aria-pressed={vista === "viva"}>
                    <Box className="h-4 w-4" aria-hidden /> 3D
                  </Button>
                  <Button size="sm" variant={vista === "plano" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => setVista("plano")} aria-pressed={vista === "plano"}>
                    <LayoutGrid className="h-4 w-4" aria-hidden /> Plano
                  </Button>
                </div>
                <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                  <a href="/admin/salon/vivo" target="_blank" rel="noreferrer">
                    <Expand className="h-4 w-4" aria-hidden /> Abrir en pantalla completa
                  </a>
                </Button>
                </div>
              </div>
              {vista === "viva" ? (
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border bg-[#cfeef0]">
                  <Salon3D estado={estado} ahora={ahora} zona={zona} compacto />
                </div>
              ) : (
                <PlanoLimpio estado={estado} ahora={ahora} seleccion={sel} onMesa={setSel} />
              )}
              <Leyenda estado={estado} />
              <Equipo estado={estado} />
            </div>
            <aside className="flex min-w-0 flex-col gap-4">
              {sel ? <ResumenMesa estado={estado} ahora={ahora} mesaId={sel} onCerrar={() => setSel(undefined)} /> : <Llegadas estado={estado} ahora={ahora} onMesa={setSel} />}
              <Llamados estado={estado} ahora={ahora} onMesa={setSel} />
              <Cocina estado={estado} ahora={ahora} />
              {puedeControlar && <ControlesDemo estado={estado} />}
              <Bitacora estado={estado} ahora={ahora} onMesa={setSel} />
            </aside>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function Indicadores({ estado, ahora }: { estado: Estado; ahora: number }) {
  const hoy = fechaLocal(ahora)
  const ocupadas = estado.mesas.filter((m) => !["libre", "reservada", "limpieza"].includes(m.estado))
  const comensales = ocupadas.reduce((s, m) => s + (m.comensales ?? 0), 0)
  const enCocina = estado.pedidos.flatMap((p) => p.items).filter((i) => i.estado === "pendiente" || i.estado === "preparando")
  const ventas = estado.visitasHoy.reduce((s, v) => s + v.total, 0)
  const abiertas = estado.pedidos.reduce((s, p) => s + p.items.reduce((x, i) => x + i.precio, 0), 0)
  const duraciones = estado.visitasHoy.map((v) => (v.salida - v.llegada) / 60000)
  const duracion = duraciones.length ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : null
  const llamados = estado.mesas.filter((m) => m.llamado).length
  const llegan = estado.reservas.filter((r) => r.fecha === hoy && ["confirmada", "recordada", "asistencia_confirmada"].includes(r.estado) && tsLocal(r.fecha, r.hora) > ahora - 30 * 60000)
  const items = [
    { icono: Users, t: "Mesas ocupadas", v: `${ocupadas.length}/${estado.mesas.length}`, s: `${comensales} comensales en el salón` },
    { icono: ChefHat, t: "Platos en cocina", v: String(enCocina.length), s: `${estado.pedidos.length} órdenes abiertas` },
    { icono: Bell, t: "Llamados abiertos", v: String(llamados), s: llamados ? "Mesas esperando" : "Todo atendido", alerta: llamados > 0 },
    { icono: Clock, t: "Por llegar hoy", v: String(llegan.length), s: `${llegan.reduce((s, r) => s + r.personas, 0)} personas con reserva` },
    { icono: Receipt, t: "Ventas de hoy", v: rd(ventas), s: `${estado.visitasHoy.length} cuentas · ${rd(abiertas)} abiertas` },
    { icono: Sparkles, t: "Una mesa dura", v: duracion ? `${duracion} min` : "-", s: "Promedio de hoy" },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(({ icono: Icono, ...x }) => (
        <div key={x.t} className={cn("rounded-xl border bg-card px-4 py-3", x.alerta && "border-acento/60 bg-acento/10")}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icono className="h-3.5 w-3.5" aria-hidden /> {x.t}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{x.v}</div>
          <div className="truncate text-xs text-muted-foreground">{x.s}</div>
        </div>
      ))}
    </div>
  )
}

function Equipo({ estado }: { estado: Estado }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {estado.equipo.map((q) => {
        const mesas = estado.mesas.filter((m) => m.meseroId === q.id && m.estado !== "libre").length
        const preparando = q.rol === "cocina" ? estado.pedidos.flatMap((p) => p.items).filter((i) => i.estacion === q.estacion && i.estado === "preparando").length : 0
        const mesa = q.tarea.mesaId ? estado.mesas.find((m) => m.id === q.tarea.mesaId)?.nombre : undefined
        return (
          <div key={q.id} className="rounded-lg border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border" style={{ background: q.rol === "cocina" ? "#ffffff" : q.color }} />
              <span className="truncate text-sm font-medium">{q.nombre}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {q.rol === "cocina" ? (preparando ? `Preparando ${preparando} platos` : "Estación libre") : `${TAREA[q.tarea.tipo]}${mesa ? ` · ${mesa}` : ""}`}
            </div>
            {q.rol === "mesero" && <div className="text-[11px] text-muted-foreground/80">{mesas} mesas a cargo</div>}
          </div>
        )
      })}
    </div>
  )
}

function Llegadas({ estado, ahora, onMesa }: { estado: Estado; ahora: number; onMesa: (id: string) => void }) {
  const hoy = fechaLocal(ahora)
  const lista = estado.reservas
    .filter((r) => r.fecha === hoy && ["confirmada", "recordada", "asistencia_confirmada", "solicitada"].includes(r.estado) && tsLocal(r.fecha, r.hora) > ahora - 30 * 60000)
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .slice(0, 6)
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Por llegar</h3>
        <Link href="/admin/reservaciones" className="text-xs font-medium text-primary hover:underline">Ver la agenda</Link>
      </div>
      {lista.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No hay más reservas para hoy.</p>
      ) : (
        <ul className="divide-y">
          {lista.map((r) => {
            const falta = Math.round((tsLocal(r.fecha, r.hora) - ahora) / 60000)
            return (
              <li key={r.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="w-14 shrink-0 text-center">
                  <div className="font-display text-lg font-semibold leading-tight">{hora12(r.hora).replace(" p. m.", "").replace(" a. m.", "")}</div>
                  <div className="text-[10px] text-muted-foreground">{falta > 0 ? `en ${falta} min` : "ahora"}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/reservaciones/${r.id}`} className="block truncate text-sm font-medium hover:underline">{r.nombre}</Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.personas} personas · {NOMBRE_ZONA[r.zona]} · {NOMBRE_CANAL[r.canal]}
                  </div>
                  {r.ocasion && <div className="mt-0.5 truncate text-xs text-acento">{r.ocasion}</div>}
                </div>
                {r.mesaId && (
                  <button onClick={() => onMesa(r.mesaId!)} className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium hover:bg-secondary">
                    {estado.mesas.find((m) => m.id === r.mesaId)?.nombre ?? r.mesaId}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Llamados({ estado, ahora, onMesa }: { estado: Estado; ahora: number; onMesa: (id: string) => void }) {
  const lista = estado.mesas.filter((m) => m.llamado).sort((a, b) => a.llamado!.desde - b.llamado!.desde)
  if (!lista.length) return null
  return (
    <section className="rounded-xl border border-acento/50 bg-acento/5">
      <h3 className="border-b border-acento/30 px-4 py-3 text-sm font-semibold">Llamados de las mesas</h3>
      <ul className="divide-y divide-acento/20">
        {lista.map((m) => (
          <li key={m.id}>
            <button onClick={() => onMesa(m.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-acento/10">
              <span className="text-sm">
                <strong>{m.nombre}</strong> {m.llamado!.tipo === "cuenta" ? "pidió la cuenta" : "llama al mesero"}
                <span className="text-muted-foreground"> · {estado.equipo.find((q) => q.id === m.meseroId)?.nombre ?? "sin mesero"}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">hace {hace(m.llamado!.desde, ahora)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Cocina({ estado, ahora }: { estado: Estado; ahora: number }) {
  const items = estado.pedidos.flatMap((p) => p.items.map((i) => ({ ...i, mesaId: p.mesaId })))
  const estaciones = [
    { id: "caliente", nombre: "Cocina caliente" },
    { id: "fria", nombre: "Fría y sushi" },
    { id: "postres", nombre: "Postres" },
  ] as const
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Cocina ahora</h3>
        <Link href="/admin/cocina" className="text-xs font-medium text-primary hover:underline">Abrir pantalla</Link>
      </div>
      <div className="grid grid-cols-3 divide-x">
        {estaciones.map((e) => {
          const cola = items.filter((i) => i.estacion === e.id && (i.estado === "pendiente" || i.estado === "preparando"))
          const listos = items.filter((i) => i.estacion === e.id && i.estado === "listo").length
          const masViejo = cola.length ? Math.max(...cola.map((i) => (ahora - i.enviado) / 60000)) : 0
          const tarde = cola.some((i) => (ahora - i.enviado) / 60000 > i.minutos * 1.3)
          return (
            <div key={e.id} className="px-3 py-3">
              <div className="truncate text-[11px] text-muted-foreground">{e.nombre}</div>
              <div className="font-display text-2xl font-semibold tabular-nums">{cola.length}</div>
              <div className={cn("text-[11px]", tarde ? "font-medium text-destructive" : "text-muted-foreground")}>
                {cola.length ? `${Math.round(masViejo)} min el más viejo` : "Sin cola"}
              </div>
              {listos > 0 && <div className="text-[11px] font-medium text-success">{listos} listos para servir</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
