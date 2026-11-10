"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarChart3, Clock, FileCheck2, Gauge, Loader2, Package, RefreshCw, Search } from "lucide-react"
import { useAdmin } from "@/contexts/admin-context"
import { useCompany } from "@/contexts/company-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { porValidar } from "@/components/admin/cotizaciones/EstadoCotizacion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/lib/api-client"
import { aCita, fechaLocal } from "@/lib/api/agenda"
import { cotizacionesApi } from "@/lib/api/cotizaciones"
import { estadisticasApi, type Clientes, type Fila, type ResumenEstadisticas } from "@/lib/api/estadisticas"
import { inventarioApi, type Reserva } from "@/lib/api/inventario"
import type { Cita, Cotizacion } from "@/lib/api-types"
import { cn, formatCurrency } from "@/lib/utils"
import { InicioRestaurante } from "@/components/restaurante/inicio/InicioRestaurante"
import { InicioSeguros } from "@/components/seguros/inicio/InicioSeguros"
import { useVertical } from "@/lib/vertical"

type Pedido = { id: string; total: number; status: string; payment_status?: string | null; created_at: string }
type ChatLite = { id: string; estado_atencion?: string | null; esperando_desde?: string | null }
type Busqueda = { id: string; pieza: string; vehiculo: { marca?: string; modelo?: string; anio?: number } | null; estado: string }

type Datos = {
  resumen: ResumenEstadisticas | null
  noHay: Fila[] | null
  seAcaba: Fila[] | null
  sinVenta: Fila[] | null
  clientes: Clientes | null
  productos: number | null
  abiertas: Cotizacion[] | null
  cotizadas: Cotizacion[] | null
  citasPeriodo: Cita[] | null
  citasHoy: Cita[] | null
  pedidos: Pedido[] | null
  chats: ChatLite[] | null
  reservas: Reserva[] | null
  busquedas: Busqueda[] | null
}

const DIAS = 30
const DIA_MS = 86_400_000
const PAGADO = ["PAID", "SHIPPED", "DELIVERED"]

const nada = <T,>(p: Promise<T>) => p.catch(() => null)
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const numero = (n: number) => n.toLocaleString("es-DO")
const usd = (n: number) => `US$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: n >= 1 || n === 0 ? 2 : 4 })}`
const corta = (d: Date) => d.toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit" })
const dur = (min: number) => {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  if (m < 1440) return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`
  const d = Math.floor(m / 1440)
  return d === 1 ? "1 día" : `${d} días`
}
const nombreCorto = (n: string) => {
  const p = n.trim().split(/\s+/)
  return /^\d/.test(n) || p.length < 3 ? n : `${p[0]} ${p[p.length > 3 ? 2 : 1]}`
}
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`
const pagado = (o: Pedido) => o.payment_status === "paid" || PAGADO.includes(o.status)
const clave = (c: { id?: string | null; telefono?: string | null } | null | undefined) => c?.id || c?.telefono || null

const Skeleton = ({ className }: { className?: string }) => (
  <span className={cn("block animate-pulse rounded-md bg-muted", className)} aria-hidden />
)

function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

function Bloque({ titulo, icono: Icono, derecha, children }: { titulo: string; icono: typeof Gauge; derecha?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <Icono className="h-4 w-4 text-muted-foreground" aria-hidden />{titulo}
        </h3>
        {derecha}
      </div>
      <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">{children}</div>
    </Card>
  )
}

function Barra({ valor, tono = "bg-primary", alto = "h-2" }: { valor: number; tono?: string; alto?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-full bg-secondary", alto)}>
      <span className={cn("block h-full rounded-full", tono)} style={{ width: `${Math.min(100, Math.max(0, valor))}%` }} />
    </div>
  )
}

function Kpi({ label, valor, detalle }: { label: string; valor: ReactNode; detalle: string }) {
  return (
    <Card className="flex min-w-0 flex-col gap-0.5 px-4 py-3.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="truncate font-display text-2xl font-semibold tabular-nums">{valor}</span>
      <span className="truncate text-xs text-muted-foreground">{detalle}</span>
    </Card>
  )
}

export default function Inicio() {
  const vertical = useVertical()
  return vertical === "seguros" ? <InicioSeguros /> : vertical === "restaurante" ? <InicioRestaurante /> : <CrmInicio />
}

function CrmInicio() {
  const { user, isLoading: isUserLoading } = useAdmin()
  const { activeCompany, isLoading: isCompanyLoading } = useCompany()
  const router = useRouter()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [reload, setReload] = useState(0)
  const [ahora, setAhora] = useState(() => Date.now())
  const companyRef = useRef<string | null>(null)

  useEffect(() => {
    if (isUserLoading || isCompanyLoading) return
    if (!user) {
      router.push("/admin/login")
      return
    }
    const companyId = activeCompany?.id ?? null
    companyRef.current = companyId
    if (!companyId) return
    setDatos(null)

    const t = Date.now()
    setAhora(t)
    const hoy = new Date(t)
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    const desde = new Date(t - (DIAS - 1) * DIA_MS)
    const f = { desde: fechaLocal(desde), hasta: fechaLocal(hoy) }

    Promise.all([
      nada(estadisticasApi.resumen(f)),
      nada(estadisticasApi.vista("no_hay", f).then((r) => r.items ?? [])),
      nada(estadisticasApi.vista("se_acaba", f).then((r) => r.items ?? [])),
      nada(estadisticasApi.vista("cotizado_sin_venta", f).then((r) => r.items ?? [])),
      nada(estadisticasApi.vista<Clientes>("clientes", f)),
      nada(apiClient.get<{ total: number }>("/products/count").then((r) => r.total)),
      nada(cotizacionesApi.listar({ ocultar_cerradas: true, limit: 200 })),
      nada(cotizacionesApi.listar({ desde: f.desde, hasta: f.hasta, limit: 200 })),
      nada(apiClient.get<{ items: Parameters<typeof aCita>[0][] }>("/agenda/citas", { desde: new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).toISOString(), hasta: new Date(inicioHoy.getTime() + DIA_MS).toISOString() }).then((r) => r.items.map(aCita))),
      nada(apiClient.get<{ items: Parameters<typeof aCita>[0][] }>("/agenda/citas", { desde: inicioHoy.toISOString(), hasta: new Date(inicioHoy.getTime() + DIA_MS).toISOString() }).then((r) => r.items.map(aCita))),
      nada(apiClient.searchOrders({ created_after: new Date(t - DIAS * DIA_MS).toISOString(), limit: 200 }).then((r) => (r.orders ?? []) as Pedido[])),
      nada(apiClient.get<ChatLite[]>("/chat/conversations/lite", { limit: 200 }).then((r) => (Array.isArray(r) ? r : []))),
      nada(inventarioApi.reservas({ estado: "vigente", limit: 200 })),
      nada(apiClient.get<{ items: Busqueda[] }>("/busquedas-externas", { estado: "pendiente", limit: 300 }).then((r) => r.items ?? [])),
    ]).then(([resumen, noHay, seAcaba, sinVenta, clientes, productos, abiertas, cotizadas, citasPeriodo, citasHoy, pedidos, chats, reservas, busquedas]) => {
      if (companyRef.current !== companyId) return
      setDatos({ resumen, noHay, seAcaba, sinVenta, clientes, productos, abiertas, cotizadas, citasPeriodo, citasHoy, pedidos, chats, reservas, busquedas })
    })
  }, [user, activeCompany?.id, isUserLoading, isCompanyLoading, router, reload])

  if (isUserLoading || isCompanyLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-sm text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
        Cargando...
      </div>
    )
  }
  if (!user) return null

  const d = datos
  const r = d?.resumen ?? null
  const conversaciones = r?.conversaciones ?? 0
  const resueltas = r?.resueltas_sin_vendedor ?? 0
  const tasa = pct(resueltas, conversaciones)
  const desdeFecha = new Date(ahora - (DIAS - 1) * DIA_MS)

  const pagados = (d?.pedidos ?? []).filter(pagado)
  const ventas = (dias: number | "hoy") => {
    const corte = dias === "hoy" ? new Date(new Date(ahora).toDateString()).getTime() : ahora - dias * DIA_MS
    return pagados.filter((o) => new Date(o.created_at).getTime() >= corte).reduce((s, o) => s + (o.total || 0), 0)
  }
  const enviadas = (d?.abiertas ?? []).filter((q) => q.estado === "enviada")
  const enJuego = enviadas.reduce((s, q) => s + (q.total_dop || 0), 0)

  const cotizados = new Set((d?.cotizadas ?? []).filter((q) => q.estado !== "borrador").map((q) => clave(q.cliente)).filter(Boolean)).size
  const conVisita = new Set((d?.citasPeriodo ?? []).filter((c) => c.estado !== "cancelada").map((c) => c.cliente_id || c.telefono || c.cliente).filter(Boolean)).size
  const embudo: [string, number | null][] = [
    ["Conversaciones", r ? conversaciones : null],
    ["Resueltas por la IA", r ? resueltas : null],
    ["Clientes cotizados", d?.cotizadas ? cotizados : null],
    ["Clientes con visita", d?.citasPeriodo ? conVisita : null],
    ["Pedidos pagados", d?.pedidos ? pagados.length : null],
  ]
  const tope = Math.max(1, ...embudo.map(([, n]) => n ?? 0))

  const sinVenta = d?.sinVenta ?? []
  const totalCot = sinVenta.reduce((s, x) => s + (Number(x.cotizaciones) || 0), 0)
  const totalVen = sinVenta.reduce((s, x) => s + (Number(x.ventas) || 0), 0)
  const noHay = (d?.noHay ?? []).slice(0, 8)
  const maxNoHay = Math.max(1, ...noHay.map((x) => Number(x.veces) || 0))
  const seAcaba = d?.seAcaba ?? []

  const pases = (d?.chats ?? []).filter((c) => c.estado_atencion === "esperando_vendedor")
  const masViejo = pases.reduce<number | null>((m, c) => {
    if (!c.esperando_desde) return m
    const min = (ahora - new Date(c.esperando_desde).getTime()) / 60_000
    return m == null || min > m ? min : m
  }, null)
  const citasHoy = (d?.citasHoy ?? []).filter((c) => c.estado !== "cancelada")
  const noLlego = citasHoy.filter((c) => c.estado === "programada" && !c.llego_at && new Date(c.inicio).getTime() < ahora - 15 * 60_000).length
  const validar = (d?.abiertas ?? []).filter(porValidar).length
  const resVencidas = (d?.reservas ?? []).filter((x) => new Date(x.vence).getTime() < ahora).length
  const porConseguir = new Set((d?.busquedas ?? []).map((b) => `${b.pieza}|${[b.vehiculo?.marca, b.vehiculo?.modelo, b.vehiculo?.anio].filter(Boolean).join(" ")}`.toLowerCase())).size

  const dia: { href: string; texto: string }[] = []
  if (d?.chats) dia.push({ href: "/admin/chat?attention=esperando_vendedor", texto: `${plural(pases.length, "chat espera", "chats esperan")} vendedor${masViejo != null && pases.length ? ` (el más viejo, ${dur(masViejo)})` : ""}` })
  if (d?.citasHoy) dia.push({ href: "/admin/calendario", texto: `${plural(citasHoy.length, "visita", "visitas")} hoy, ${noLlego === 1 ? "1 no ha llegado" : `${numero(noLlego)} no han llegado`}` })
  if (d?.abiertas) dia.push({ href: "/admin/cotizaciones", texto: `${plural(validar, "cotización", "cotizaciones")} por validar` })
  if (d?.reservas) dia.push({ href: "/admin/reservas", texto: plural(resVencidas, "reserva vencida", "reservas vencidas") })
  if (d?.busquedas) dia.push({ href: "/admin/busqueda-externa", texto: `${plural(porConseguir, "pieza", "piezas")} por conseguir` })

  const mejor = d?.clientes?.mejores?.[0]
  const tiles: [string, number | null][] = [
    ["Cotizado abierto", d?.abiertas ? enJuego : null],
    ["Vendido 30 días", d?.pedidos ? ventas(30) : null],
    ["Vendido 7 días", d?.pedidos ? ventas(7) : null],
    ["Vendido hoy", d?.pedidos ? ventas("hoy") : null],
  ]
  const cargando = !d && !!activeCompany

  return (
    <AdminLayout title="CRM">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Hola, {user.name?.split(" ")[0] || user.email}.</span>{" "}
            Así van la IA, las ventas y la demanda de los últimos {DIAS} días.
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <Link href="/admin/dashboard"><Gauge className="h-4 w-4" aria-hidden />Asistente IA</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setReload((n) => n + 1)} disabled={cargando} className="gap-2 text-muted-foreground">
              <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} aria-hidden />
              Actualizar
            </Button>
          </div>
        </div>

        {!activeCompany && (
          <p className="rounded-md bg-secondary px-4 py-3 text-sm">Selecciona una empresa para ver su CRM.</p>
        )}

        <Tabs defaultValue="ventas" className="flex flex-col gap-4">
          <section aria-labelledby="resumen-titulo" className="dark relative overflow-hidden rounded-lg border bg-card text-foreground shadow-sm">
            {r && conversaciones > 0 && (
              <span aria-hidden className="pointer-events-none absolute -bottom-5 right-4 select-none font-display text-[84px] font-bold leading-none text-foreground/[0.06] sm:text-[120px]">{tasa}%</span>
            )}
            <div className="relative grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Últimos {DIAS} días · {corta(desdeFecha)} al {corta(new Date(ahora))}</p>
                <h2 id="resumen-titulo" className="mt-2 font-display text-2xl font-semibold leading-tight sm:text-3xl">
                  {!d ? <Skeleton className="h-8 w-4/5" /> : r ? `La IA resolvió ${numero(resueltas)} de ${numero(conversaciones)} conversaciones sin vendedor` : "No se pudo cargar el resumen de la IA"}
                </h2>
                {r && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Costó {usd(r.costo_ia_usd ?? 0)} en total{r.costo_por_conversacion_usd != null ? `, ${usd(r.costo_por_conversacion_usd)} por conversación` : ""}.
                    {r.latencia_mediana_ms != null ? ` Responde en ${(r.latencia_mediana_ms / 1000).toLocaleString("es-DO", { maximumFractionDigits: 1 })} s (mediana).` : ""}
                  </p>
                )}
                <TabsList className="mt-4 h-auto flex-wrap">
                  <TabsTrigger value="ventas">Ventas</TabsTrigger>
                  <TabsTrigger value="demanda">Demanda</TabsTrigger>
                  <TabsTrigger value="hoy">Hoy</TabsTrigger>
                </TabsList>
              </div>
              <div className="grid grid-cols-2 content-center gap-2.5">
                {tiles.map(([l, v]) => (
                  <div key={l} className="min-w-0 rounded-md bg-secondary px-3 py-3">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="truncate font-display text-base font-semibold tabular-nums sm:text-xl">
                      {!d ? <Skeleton className="mt-1 h-6 w-20" /> : v == null ? "—" : formatCurrency(v)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <TabsContent value="ventas" className="mt-0 grid grid-cols-1 gap-4 data-[state=inactive]:hidden lg:grid-cols-2">
            <Bloque titulo="De conversación a venta" icono={BarChart3}>
              {!d ? <Skeleton className="h-40 w-full" /> : (
                <>
                  <div className="flex flex-col gap-2.5">
                    {embudo.map(([l, n]) => (
                      <div key={l} className="grid grid-cols-[100px_minmax(0,1fr)_44px] items-center gap-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)_56px]">
                        <span className="text-xs sm:text-sm">{l}</span>
                        <Barra valor={n == null ? 0 : Math.max(3, pct(n, tope))} alto="h-5" />
                        <b className="text-right font-semibold tabular-nums">{n == null ? "—" : numero(n)}</b>
                      </div>
                    ))}
                  </div>
                  {r && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {numero(r.consultas)} consultas de piezas, {numero(r.sin_resultado)} sin resultado.{r.sin_cerrar != null ? ` ${plural(r.sin_cerrar, "conversación sigue abierta", "conversaciones siguen abiertas")}.` : ""}
                    </p>
                  )}
                </>
              )}
            </Bloque>
            <Bloque titulo="Cotizado sin venta" icono={FileCheck2}
              derecha={totalCot > 0 && <span className="text-sm text-muted-foreground">{pct(totalVen, totalCot)} % convertido</span>}>
              {!d ? <Skeleton className="h-40 w-full" /> : !d.sinVenta ? <Vacio>No se pudo cargar lo cotizado.</Vacio> : !sinVenta.length ? <Vacio>No hay piezas cotizadas sin venta en el período.</Vacio> : (
                <ul className="-my-2 divide-y">
                  {sinVenta.slice(0, 6).map((x, i) => (
                    <li key={x.pieza_id ?? i} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{x.nombre}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {[x.sku, plural(Number(x.cotizaciones) || 0, "vez", "veces"), x.precio_dop != null ? `${formatCurrency(x.precio_dop)} c/u` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <b className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(x.monto_cotizado_dop ?? 0)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>
          </TabsContent>

          <TabsContent value="demanda" className="mt-0 grid grid-cols-1 gap-4 data-[state=inactive]:hidden lg:grid-cols-2">
            <Bloque titulo="Piden y no hay" icono={Search}>
              {!d ? <Skeleton className="h-40 w-full" /> : !d.noHay ? <Vacio>No se pudo cargar la demanda.</Vacio> : !noHay.length ? <Vacio>Nadie pidió piezas que no hay en el período.</Vacio> : (
                <div className="flex flex-col">
                  {noHay.map((x, i) => (
                    <div key={`${x.pieza}-${i}`} className="grid grid-cols-[minmax(0,1fr)_minmax(60px,40%)_40px] items-center gap-2.5 py-1.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{x.pieza}</span>
                        <span className="block truncate text-xs text-muted-foreground">{x.vehiculos?.[0]?.vehiculo ?? ""}</span>
                      </span>
                      <Barra valor={pct(Number(x.veces) || 0, maxNoHay)} tono="bg-warning" />
                      <b className="text-right text-sm font-semibold tabular-nums">{numero(Number(x.veces) || 0)}</b>
                    </div>
                  ))}
                </div>
              )}
            </Bloque>
            <Bloque titulo="Se acaba" icono={Package}>
              {!d ? <Skeleton className="h-40 w-full" /> : !d.seAcaba ? <Vacio>No se pudo cargar el inventario.</Vacio> : !seAcaba.length ? <Vacio>Nada se está acabando al ritmo de ventas del período.</Vacio> : (
                <>
                  <ul className="-my-2 divide-y">
                    {seAcaba.slice(0, 6).map((x, i) => {
                      const dias = Math.round(Number(x.dias_quedan) || 0)
                      return (
                        <li key={x.pieza_id ?? i} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{x.nombre}</span>
                            <span className="block truncate font-mono text-xs text-muted-foreground">{[x.sku, `quedan ${numero(x.disponible ?? 0)}`, `${x.por_semana} por semana`].filter(Boolean).join(" · ")}</span>
                          </span>
                          <span className={cn("shrink-0 rounded px-1.5 text-xs font-medium leading-5", dias < 30 ? "bg-destructive-soft text-destructive" : "bg-secondary")}>{numero(dias)} días</span>
                        </li>
                      )
                    })}
                  </ul>
                  {seAcaba.every((x) => Number(x.dias_quedan) >= 30) && (
                    <p className="mt-3 text-sm text-muted-foreground">Nada se agota en los próximos 30 días al ritmo actual.</p>
                  )}
                </>
              )}
            </Bloque>
          </TabsContent>

          <TabsContent value="hoy" className="mt-0">
            <Bloque titulo="El día en una línea" icono={Clock}>
              {!d ? <Skeleton className="h-6 w-full" /> : !dia.length ? <Vacio>No se pudo cargar el día.</Vacio> : (
                <p className="text-sm leading-relaxed">
                  {dia.map((x, i) => (
                    <span key={x.href}>
                      {i > 0 && " · "}
                      <Link href={x.href} className="underline-offset-2 hover:underline">{x.texto}</Link>
                    </span>
                  ))}.
                </p>
              )}
            </Bloque>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="Clientes con compras"
            valor={!d ? <Skeleton className="h-7 w-12" /> : d.clientes ? numero(d.clientes.clientes_con_compras) : "—"}
            detalle={d?.clientes ? plural(d.clientes.recurrentes, "recurrente", "recurrentes") : "En el período"} />
          <Kpi label="Productos activos"
            valor={!d ? <Skeleton className="h-7 w-12" /> : d.productos != null ? numero(d.productos) : "—"}
            detalle="En el catálogo" />
          <Kpi label="Mejor cliente"
            valor={!d ? <Skeleton className="h-7 w-32" /> : mejor ? nombreCorto(mejor.nombre) : "—"}
            detalle={mejor ? `${formatCurrency(mejor.total_dop)} en compras` : d ? "Sin compras en el período" : ""} />
        </div>
      </div>
    </AdminLayout>
  )
}
