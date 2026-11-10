"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { formatDistanceToNowStrict } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, MessageCircle, Search, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { AdminLayout } from "@/components/admin/admin-layout"
import { PiezasExternasTabs, SeccionTabs } from "@/components/admin/SeccionTabs"
import { VehiculoFiltro, filtroDeUrl, type FiltroVehiculo } from "@/components/admin/piezas/VehiculoFiltro"
import { EstadoBusqueda, OfertaDialog, ResultadoFila, vehiculoBusqueda } from "@/components/admin/busqueda-externa/BusquedaExterna"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api-client"
import type { BusquedaExterna, ResultadoExterno } from "@/lib/api-types"
import { aResultado, ordenarResultados } from "@/lib/api/busqueda-externa"
import { catalogoApi } from "@/lib/api/catalogo"
import { canAccessSection } from "@/lib/permissions"
import { useAdmin } from "@/contexts/admin-context"
import { cn, formatCurrency } from "@/lib/utils"

const SIN_VEHICULO: FiltroVehiculo = { marca: null, modelo: null, anio: null }
const hace = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: es })

export default function BusquedaExternaPage() {
  const { user } = useAdmin()
  const [busquedas, setBusquedas] = useState<BusquedaExterna[] | null>(null)
  const [selId, setSelId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [vehiculo, setVehiculo] = useState<FiltroVehiculo>(SIN_VEHICULO)
  const [resultados, setResultados] = useState<ResultadoExterno[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState(false)
  const [ofrecer, setOfrecer] = useState<ResultadoExterno | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [agregando, setAgregando] = useState<string | null>(null)
  const detalle = useRef<HTMLDivElement>(null)
  const sel = busquedas?.find((b) => b.id === selId) ?? null

  const buscar = async (texto: string, v: FiltroVehiculo) => {
    if (!texto.trim()) return
    setBuscando(true)
    try {
      const r = await apiClient.get<{ items: ResultadoExterno[]; fuentes_con_precio?: boolean; aviso?: string | null }>("/piezas/busqueda-externa", {
        q: texto.trim(), marca: v.marca ?? undefined, modelo: v.modelo ?? undefined, anio: v.anio ?? undefined,
      })
      setResultados(ordenarResultados(r.items.map(aResultado)))
      setAviso(r.aviso ?? null)
      setErrorBusqueda(false)
    } catch {
      setErrorBusqueda(true)
    } finally {
      setBuscando(false)
    }
  }

  const elegir = (b: BusquedaExterna) => {
    const v = b.vehiculo ? { marca: b.vehiculo.marca, modelo: b.vehiculo.modelo, anio: b.vehiculo.anio } : SIN_VEHICULO
    setSelId(b.id)
    setQ(b.pieza)
    setVehiculo(v)
    buscar(b.pieza, v)
    if (window.innerWidth < 1280) setTimeout(() => detalle.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0)
  }

  const agregar = async (r: ResultadoExterno) => {
    setAgregando(r.id)
    try {
      const { sku } = await catalogoApi.agregarDeProveedor(r)
      toast.success(`Agregada como ${sku}: precio 0, pendiente por comprar`)
      setResultados((list) => list?.map((x) => (x.pieza?.numero === r.pieza?.numero ? { ...x, ya_en_catalogo: { sku } } : x)) ?? null)
    } catch (e: any) {
      toast.error(e?.message || "No se pudo agregar al inventario.")
    } finally {
      setAgregando(null)
    }
  }

  const actualizar = (b: BusquedaExterna) => setBusquedas((list) => (list ?? []).map((x) => (x.id === b.id ? b : x)))

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    apiClient
      .get<{ items: BusquedaExterna[] }>("/busquedas-externas")
      .then((r) => {
        setBusquedas(r.items)
        const b = r.items.find((x) => x.id === p.get("b"))
        if (b) return elegir(b)
        if (p.get("q")) {
          const v = filtroDeUrl() ?? SIN_VEHICULO
          setQ(p.get("q")!)
          setVehiculo(v)
          buscar(p.get("q")!, v)
        }
      })
      .catch(() => setBusquedas([]))
  }, [])

  const registrar = async () => {
    setOcupado(true)
    try {
      const b = await apiClient.post<BusquedaExterna>("/busquedas-externas", {
        pieza: q.trim(), vehiculo: vehiculo.marca ? vehiculo : null,
      })
      setBusquedas((list) => [b, ...(list ?? []).filter((x) => x.id !== b.id)])
      setSelId(b.id)
      toast.success("Queda en piezas pedidas que no hay")
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la búsqueda.")
    } finally {
      setOcupado(false)
    }
  }

  const cerrar = async (estado: "aceptada" | "descartada") => {
    if (!sel) return
    setOcupado(true)
    try {
      actualizar(await apiClient.request<BusquedaExterna>(`/busquedas-externas/${sel.id}`, { method: "PATCH", body: JSON.stringify({ estado }) }))
      toast.success(estado === "aceptada" ? "Marcada como aceptada. El lead pasó a ganado." : "Búsqueda descartada")
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar la búsqueda.")
    } finally {
      setOcupado(false)
    }
  }

  const abierta = sel && (sel.estado === "pendiente" || sel.estado === "ofrecida")
  const puedeOfrecer = abierta && !!sel.conversacion_id
  const puedeAgregar = canAccessSection(user?.role, "/admin/products")

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-4">
        <SeccionTabs seccion="inventario" />
        <PiezasExternasTabs />
        <p className="text-sm text-muted-foreground">
          Para piezas que Colt no tiene: busca en catálogos OEM, marketplaces, desarmaderos y subastas, y envíale la oferta al cliente.
        </p>

        <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)] xl:items-start">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-display text-base font-semibold">Piezas pedidas que no hay</h2>
              <p className="text-xs text-muted-foreground">Las registra la IA cuando no encuentra la pieza, o tú desde aquí.</p>
            </div>
            {!busquedas ? (
              <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : busquedas.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No hay búsquedas registradas.</p>
            ) : (
              <ul className="max-h-[32rem] divide-y overflow-y-auto max-xl:max-h-64">
                {busquedas.map((b) => (
                  <li key={b.id}>
                    <button type="button" aria-pressed={b.id === selId} onClick={() => elegir(b)}
                      className={cn("flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary",
                        b.id === selId && "bg-secondary")}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium first-letter:uppercase">{b.pieza}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {vehiculoBusqueda(b.vehiculo)} · {b.cliente?.nombre ?? "sin cliente"}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <EstadoBusqueda estado={b.estado} />
                        <span className="text-[11px] text-muted-foreground">{hace(b.actualizada)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div ref={detalle} className="min-w-0 scroll-mt-20 space-y-4">
            {sel && (
              <Card><CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold">{sel.cliente?.nombre ?? "Búsqueda sin cliente"}</h2>
                      <EstadoBusqueda estado={sel.estado} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {sel.pieza.charAt(0).toUpperCase() + sel.pieza.slice(1)} · {vehiculoBusqueda(sel.vehiculo)} · registrada {sel.origen === "ia" ? "por la IA" : "por un vendedor"} {hace(sel.creada)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Quitar selección" onClick={() => setSelId(null)}>
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>

                {sel.oferta && (
                  <div className="rounded-md border px-3 py-2 text-sm">
                    <p>
                      Ofreciste <span className="font-medium first-letter:uppercase">{sel.oferta.resultado.titulo}</span> a{" "}
                      <strong className="font-semibold tabular-nums">{formatCurrency(sel.oferta.precio_dop)}</strong>
                      {sel.oferta.dias_estimados != null && `, llega en ${sel.oferta.dias_estimados} días`}.
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Enviada {hace(sel.oferta.enviada)} por {sel.oferta.por}</p>
                  </div>
                )}

                {!sel.conversacion_id && abierta && (
                  <p className="text-xs text-muted-foreground">Sin cliente: queda como pieza pedida que no hay, para compras.</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {sel.conversacion_id && (
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link href={`/admin/chat?conversation=${sel.conversacion_id}`}><MessageCircle className="h-4 w-4" aria-hidden /> Abrir conversación</Link>
                    </Button>
                  )}
                  {sel.estado === "ofrecida" && <Button size="sm" disabled={ocupado} onClick={() => cerrar("aceptada")}>El cliente aceptó</Button>}
                  {abierta && <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => cerrar("descartada")}>Descartar</Button>}
                </div>
              </CardContent></Card>
            )}

            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); buscar(q, vehiculo) }}>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: bomba de gasolina" aria-label="Pieza a buscar fuera"
                    className="h-11 bg-card pl-10 text-base" />
                </div>
                <Button type="submit" className="h-11 shrink-0" disabled={!q.trim() || buscando}>
                  {buscando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
                  Buscar fuera
                </Button>
              </div>
              <VehiculoFiltro value={vehiculo} onChange={setVehiculo} />
              {!vehiculo.anio && <p className="text-xs text-muted-foreground">Elige marca, modelo y año para ver los proveedores que tienen la pieza.</p>}
            </form>

            {errorBusqueda ? (
              <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <p className="font-medium">No se pudo consultar las fuentes externas</p>
                <Button variant="outline" onClick={() => buscar(q, vehiculo)}>Reintentar</Button>
              </CardContent></Card>
            ) : buscando && !resultados ? (
              <Card className="divide-y overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-14 w-14 rounded-md" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-full max-w-[320px]" /><Skeleton className="h-3 w-full max-w-[220px]" /></div>
                  </div>
                ))}
              </Card>
            ) : resultados ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
                  <p className="text-sm text-muted-foreground">
                    {resultados.some((r) => r.tipo === "proveedor")
                      ? `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"}, primero los proveedores`
                      : resultados.filter((r) => r.precio != null).length
                        ? `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"}, del más barato al más caro`
                        : "Sin precios en línea: abre la búsqueda en cada fuente"}
                  </p>
                  {!sel && resultados.length > 0 && (
                    <Button size="sm" variant="outline" disabled={ocupado} onClick={registrar}>Registrar como pieza que no hay</Button>
                  )}
                </div>
                {aviso && resultados.some((r) => r.tipo === "proveedor") && (
                  <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground" role="note">{aviso}</p>
                )}
                {process.env.NEXT_PUBLIC_MOCK === "1" && (
                  <p className="text-xs text-muted-foreground">Resultados de ejemplo: precio y plazo son de muestra hasta conectar las fuentes reales.</p>
                )}
                {resultados.length === 0 ? (
                  <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Ninguna fuente tiene esta pieza.</CardContent></Card>
                ) : (
                  <Card className={cn("overflow-hidden transition-opacity", buscando && "opacity-60")}>
                    <ul className="divide-y">
                      {resultados.map((r) => (
                        <ResultadoFila key={r.id} r={r} onOfrecer={puedeOfrecer ? () => setOfrecer(r) : undefined}
                          ofrecerTexto={sel?.estado === "ofrecida" ? "Ofrecer otra" : undefined}
                          onAgregar={r.tipo === "proveedor" && puedeAgregar ? () => agregar(r) : undefined} agregando={agregando === r.id} />
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            ) : (
              <Card><CardContent className="p-10 text-center">
                <p className="font-medium">Elige una pieza pedida o busca una</p>
                <p className="mt-1 text-sm text-muted-foreground">Los resultados traen foto, precio, origen, enlace y días estimados de llegada.</p>
              </CardContent></Card>
            )}
          </div>
        </div>
      </div>

      {sel && (
        <OfertaDialog busqueda={sel} resultado={ofrecer} onClose={() => setOfrecer(null)}
          onEnviada={(b) => { actualizar(b); setOfrecer(null) }} />
      )}
    </AdminLayout>
  )
}
