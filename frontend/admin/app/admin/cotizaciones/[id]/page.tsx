"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { ArrowLeft, Bot, Check, CheckCircle2, Copy, Download, Link2, Loader2, MessageSquare, Minus, Plus, Search, Send, ShoppingCart, Trash2, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EstadoCotizacion, fechaCorta } from "@/components/admin/cotizaciones/EstadoCotizacion"
import { apiClient } from "@/lib/api-client"
import { clienteTexto, cotizacionesApi, type Cotizacion } from "@/lib/api/cotizaciones"
import { cn, formatCurrency, nombrePieza } from "@/lib/utils"

const ITBIS = 0.18

type Linea = { pieza_id: string; descripcion: string; cantidad: number; precio_dop: number; precio_lista_dop: number }
type Accion = "guardar" | "enviar" | "validar" | "aceptada" | "rechazada" | "orden" | "pdf" | "link" | "link-enviar"
type PiezaBusqueda = { id: string; nombre: string; precio_dop: number; disponible: boolean; sku?: string }

const aLineas = (c: Cotizacion): Linea[] =>
  c.items.map((i) => ({ pieza_id: String(i.pieza_id), descripcion: i.descripcion, cantidad: i.cantidad, precio_dop: i.precio_dop, precio_lista_dop: i.precio_lista_dop ?? i.precio_dop }))

const mismaLista = (a: Linea[], b: Linea[]) =>
  a.length === b.length && a.every((l, i) => l.pieza_id === b[i].pieza_id && l.cantidad === b[i].cantidad && l.precio_dop === b[i].precio_dop)

export default function CotizacionPage() {
  const id = decodeURIComponent(useParams<{ id: string }>()?.id ?? "")
  const [version, setVersion] = useState<number | null>(null)
  const [cot, setCot] = useState<Cotizacion | null>(null)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [error, setError] = useState(false)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<PiezaBusqueda[] | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const cargar = (v: number | null) =>
    cotizacionesApi
      .obtener(id, v)
      .then((c) => { setCot(c); setLineas(aLineas(c)); setError(false) })
      .catch(() => setError(true))

  useEffect(() => { cargar(version) }, [id, version])

  useEffect(() => {
    const q = busqueda.trim()
    if (q.length < 3) { setResultados(null); return }
    let vigente = true
    const t = setTimeout(() => {
      apiClient.get<{ items: PiezaBusqueda[] }>("/piezas/buscar", { q, limit: 6 })
        .then((r) => { if (vigente) setResultados(r.items ?? []) })
        .catch(() => { if (vigente) setResultados([]) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda])

  const vigente = cot ? cot.version === Math.max(...cot.versiones) : false
  const cerrada = !!cot && (!!cot.orden || cot.estado === "rechazada" || cot.estado === "vencida")
  const editable = vigente && !cerrada
  const cambios = !!cot && !mismaLista(lineas, aLineas(cot))
  const totales = useMemo(() => {
    if (cot && !cambios) return { subtotal: cot.subtotal_dop, itbis: cot.itbis_dop, total: cot.total_dop }
    const suma = lineas.reduce((s, l) => s + l.cantidad * l.precio_dop, 0)
    if (cot?.precios_incluyen_itbis) {
      const subtotal = Math.round((suma / (1 + ITBIS)) * 100) / 100
      return { subtotal, itbis: Math.round((suma - subtotal) * 100) / 100, total: suma }
    }
    const itbis = Math.round(suma * ITBIS * 100) / 100
    return { subtotal: suma, itbis, total: suma + itbis }
  }, [cot, lineas, cambios])

  const cambiar = (piezaId: string, patch: Partial<Linea>) =>
    setLineas((prev) => prev.map((l) => (l.pieza_id === piezaId ? { ...l, ...patch } : l)))
  const quitar = (piezaId: string) => setLineas((prev) => prev.filter((l) => l.pieza_id !== piezaId))
  const agregar = (p: PiezaBusqueda) => {
    setLineas((prev) => prev.some((l) => l.pieza_id === p.id)
      ? prev.map((l) => (l.pieza_id === p.id ? { ...l, cantidad: Math.min(99, l.cantidad + 1) } : l))
      : [...prev, { pieza_id: p.id, descripcion: p.nombre, cantidad: 1, precio_dop: p.precio_dop, precio_lista_dop: p.precio_dop }])
    setBusqueda("")
    setResultados(null)
  }

  const ejecutar = async (tipo: Accion) => {
    if (!cot) return
    setAccion(tipo)
    try {
      if (tipo === "guardar") {
        const nueva = await cotizacionesApi.nuevaVersion(cot.codigo, lineas.map((l) => ({
          pieza_id: l.pieza_id, cantidad: l.cantidad, ...(l.precio_dop !== l.precio_lista_dop ? { precio_dop: l.precio_dop } : {}),
        })), cot.vehiculo)
        toast.success(`Versión ${nueva.version} guardada como borrador. Envíala al cliente cuando esté lista.`)
        setVersion(null)
        await cargar(null)
      } else if (tipo === "enviar") {
        const r = await cotizacionesApi.enviarWhatsApp(cot.codigo)
        if (r.enviada) toast.success(`${cot.codigo} enviada por WhatsApp`)
        else toast.error(r.error || "WhatsApp no entregó la cotización")
        await cargar(version)
      } else if (tipo === "validar") {
        const r = await cotizacionesApi.validar(cot.codigo)
        if (r.mensaje && !r.mensaje.enviada) toast.error(`Validada, pero el aviso no llegó: ${r.mensaje.error || "error de WhatsApp"}`)
        else toast.success(`${cot.codigo} validada. El cliente recibió el aviso.`)
        await cargar(version)
      } else if (tipo === "aceptada" || tipo === "rechazada") {
        await cotizacionesApi.cambiarEstado(cot.codigo, tipo)
        toast.success(tipo === "aceptada" ? "Cotización aceptada por el cliente" : "Cotización rechazada")
        await cargar(version)
      } else if (tipo === "orden") {
        const r = await cotizacionesApi.convertirEnOrden(cot.codigo)
        toast.success(`Orden ${r.numero} creada. Falta el cobro.`)
        await cargar(null)
      } else if (tipo === "pdf") {
        await cotizacionesApi.descargarPdf(cot.codigo, vigente ? null : cot.version)
      } else if (tipo === "link" && cot.orden) {
        const r = await apiClient.post<{ url: string }>(`/cotizaciones/${cot.codigo}/link-pago`)
        setLink(r.url || null)
        toast.success("Link de pago listo")
      } else if (tipo === "link-enviar" && link && cot.conversation_id) {
        const texto = `Aquí está tu link de pago de la orden ${cot.orden?.numero} por ${formatCurrency(cot.total_dop)}: ${link}`
        const r = await apiClient.sendWhatsAppWithIntegration(cot.conversation_id, { message: texto })
        if (r?.success === false) toast.error(r?.whatsapp_result?.error || r?.error || "WhatsApp no entregó el mensaje")
        else toast.success("Link de pago enviado por WhatsApp")
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo completar la acción. Intenta de nuevo.")
    } finally {
      setAccion(null)
    }
  }

  const ocupado = !!accion
  const spin = (t: Accion) => accion === t ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null

  return (
    <AdminLayout title="Cotización">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/cotizaciones" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Cotizaciones
        </Link>

        {error ? (
          <Card><CardContent className="p-10 text-center"><p className="font-medium">No encontramos la cotización {id}</p></CardContent></Card>
        ) : !cot ? (
          <Card className="space-y-3 p-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72" /><Skeleton className="h-32 w-full" /></Card>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold">{cot.codigo}</h1>
                  <span className="text-sm text-muted-foreground">v{cot.version}</span>
                  <EstadoCotizacion estado={cot.estado} cotizacion={cot} />
                  {cot.origen === "ia" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"><Bot className="h-3 w-3" aria-hidden /> Armada por la IA</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cot.creada ? `Creada ${fechaCorta(cot.creada)} · ` : ""}Vence {fechaCorta(cot.vence)}
                  {cot.enviada_at ? ` · Enviada ${fechaCorta(cot.enviada_at)}` : ""}
                </p>
                {cot.validada_por && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Validada por {cot.validada_por}{cot.validada_at ? ` el ${fechaCorta(cot.validada_at)}` : ""}
                  </p>
                )}
              </div>
              {cot.versiones.length > 1 && (
                <div role="radiogroup" aria-label="Versión" className="inline-flex shrink-0 gap-0.5 self-start rounded-control bg-secondary p-0.5">
                  {cot.versiones.map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={cot.version === v}
                      onClick={() => setVersion(v === Math.max(...cot.versiones) ? null : v)}
                      className={cn("h-7 rounded-control px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        cot.version === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      v{v}{v === Math.max(...cot.versiones) ? " vigente" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {cot.orden && (
              <div role="status" className="space-y-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Convertida en la orden <strong className="font-medium">{cot.orden.numero}</strong>, pendiente de pago.</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href="/admin/orders" className="font-medium text-success underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">Ver orden</Link>
                    {!link && (
                      <Button size="sm" className="h-8 gap-1.5" onClick={() => ejecutar("link")} disabled={ocupado}>
                        {spin("link") ?? <Link2 className="h-4 w-4" aria-hidden />} Crear link de pago
                      </Button>
                    )}
                  </div>
                </div>
                {link && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-card px-2 py-1.5">
                    <a href={link} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-xs text-primary underline-offset-2 hover:underline">{link}</a>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Link copiado") }}>
                      <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar
                    </Button>
                    {cot.conversation_id && (
                      <Button size="sm" className="h-7 gap-1.5" onClick={() => ejecutar("link-enviar")} disabled={ocupado}>
                        {spin("link-enviar") ?? <Send className="h-3.5 w-3.5" aria-hidden />} Enviar por WhatsApp
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {!vigente && (
              <p role="status" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
                Estás viendo la versión {cot.version}, que ya no es la vigente. Solo lectura.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Cliente</p>
                {cot.cliente.id ? (
                  <Link href={`/admin/customers/${cot.cliente.id}`} className="mt-0.5 block font-medium underline-offset-2 hover:text-primary hover:underline">{clienteTexto(cot)}</Link>
                ) : <p className="mt-0.5 font-medium">{clienteTexto(cot)}</p>}
                {cot.cliente.nombre && cot.cliente.telefono && <p className="text-sm text-muted-foreground">+{cot.cliente.telefono.replace(/^\+/, "")}</p>}
                {cot.conversation_id && (
                  <Link href={`/admin/chat?conversation=${cot.conversation_id}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Abrir conversación
                  </Link>
                )}
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Vehículo</p>
                {cot.vehiculo ? (
                  cot.vehiculo_id
                    ? <Link href={`/admin/vehiculos/${cot.vehiculo_id}`} className="mt-0.5 block font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">{cot.vehiculo}</Link>
                    : <p className="mt-0.5 font-medium">{cot.vehiculo}</p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">Sin vehículo</p>
                )}
              </CardContent></Card>
            </div>

            <Card className="overflow-hidden">
              <ul className="divide-y">
                {lineas.map((l) => (
                  <li key={l.pieza_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-sm font-medium leading-snug">{l.descripcion}</p>
                      {editable ? (
                        <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          Precio c/u RD$
                          <input type="number" min={1} step="0.01" value={l.precio_dop}
                            onChange={(e) => cambiar(l.pieza_id, { precio_dop: Math.max(0, Number(e.target.value) || 0) })}
                            aria-label={`Precio de ${l.descripcion}`}
                            className="h-7 w-24 rounded-md border bg-card px-1.5 text-right text-xs tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                          {l.precio_dop !== l.precio_lista_dop && <span className="text-warning">Precio especial (lista {formatCurrency(l.precio_lista_dop)})</span>}
                        </label>
                      ) : (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(l.precio_dop)} c/u{l.precio_dop !== l.precio_lista_dop ? ` · precio especial (lista ${formatCurrency(l.precio_lista_dop)})` : ""}
                        </p>
                      )}
                    </div>
                    {editable ? (
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cambiar(l.pieza_id, { cantidad: Math.max(1, l.cantidad - 1) })} disabled={l.cantidad <= 1} aria-label={`Quitar una unidad de ${l.descripcion}`}><Minus className="h-3.5 w-3.5" /></Button>
                        <input type="number" min={1} max={99} value={l.cantidad} onChange={(e) => cambiar(l.pieza_id, { cantidad: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
                          aria-label={`Cantidad de ${l.descripcion}`}
                          className="h-8 w-14 rounded-md border bg-card text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cambiar(l.pieza_id, { cantidad: Math.min(99, l.cantidad + 1) })} aria-label={`Agregar una unidad de ${l.descripcion}`}><Plus className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => quitar(l.pieza_id)} disabled={lineas.length <= 1} aria-label={`Quitar ${l.descripcion}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <span className="text-sm tabular-nums text-muted-foreground">× {l.cantidad}</span>
                    )}
                    <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums">{formatCurrency(l.cantidad * l.precio_dop)}</span>
                  </li>
                ))}
              </ul>
              {editable && (
                <div className="relative border-t px-4 py-3">
                  <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Agregar pieza: amortiguador tucson 2012"
                    aria-label="Buscar pieza para agregar" className="h-9 bg-card pl-9" />
                  {resultados && (
                    <ul className="absolute inset-x-4 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
                      {resultados.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
                      ) : resultados.map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => agregar(p)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                            <span className="min-w-0">
                              <span className="block truncate">{nombrePieza(p.nombre)}</span>
                              <span className={cn("text-[11px]", p.disponible ? "text-success" : "text-destructive")}>{p.disponible ? "Disponible" : "Sin existencia"}</span>
                            </span>
                            <span className="shrink-0 font-medium tabular-nums">{formatCurrency(p.precio_dop)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="space-y-1 border-t bg-secondary/40 px-4 py-3 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totales.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>ITBIS 18 %{cot.precios_incluyen_itbis ? " (incluido)" : ""}</span><span className="tabular-nums">{formatCurrency(totales.itbis)}</span></div>
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatCurrency(totales.total)}</span></div>
                <p className="text-xs text-muted-foreground">
                  {cambios ? "Totales con tus cambios. Al guardar se crea una versión nueva en borrador. " : ""}Vigente hasta el {fechaCorta(cot.vence)}.
                </p>
              </div>
            </Card>

            <div className="flex flex-wrap gap-2">
              {editable && cambios && (
                <>
                  <Button onClick={() => ejecutar("guardar")} disabled={ocupado || lineas.length === 0 || lineas.some((l) => l.precio_dop <= 0)} className="gap-2">
                    {spin("guardar") ?? <Check className="h-4 w-4" aria-hidden />} Guardar como versión {Math.max(...cot.versiones) + 1}
                  </Button>
                  <Button variant="ghost" onClick={() => setLineas(aLineas(cot))} disabled={ocupado} className="gap-2">
                    <X className="h-4 w-4" aria-hidden /> Descartar cambios
                  </Button>
                </>
              )}
              {vigente && !cambios && !cerrada && cot.estado !== "aceptada" && (
                <Button variant={cot.estado === "borrador" ? "default" : "outline"} onClick={() => ejecutar("enviar")} disabled={ocupado || !cot.conversation_id} className="gap-2"
                  title={cot.conversation_id ? "El cliente recibe el detalle con subtotal, ITBIS y total" : "La cotización no está ligada a una conversación"}>
                  {spin("enviar") ?? <Send className="h-4 w-4" aria-hidden />}
                  {cot.estado === "borrador" ? "Enviar por WhatsApp" : "Reenviar por WhatsApp"}
                </Button>
              )}
              {vigente && !cambios && !cerrada && !cot.validada_por && (
                <Button variant="outline" onClick={() => ejecutar("validar")} disabled={ocupado} className="gap-2"
                  title="Confirmas precios y existencia; el cliente recibe el aviso">
                  {spin("validar") ?? <CheckCircle2 className="h-4 w-4" aria-hidden />} Validar
                </Button>
              )}
              {vigente && !cambios && !cerrada && cot.estado !== "aceptada" && (
                <>
                  <Button variant="outline" onClick={() => ejecutar("aceptada")} disabled={ocupado} className="gap-2">
                    {spin("aceptada") ?? <Check className="h-4 w-4" aria-hidden />} Cliente aceptó
                  </Button>
                  <Button variant="ghost" onClick={() => ejecutar("rechazada")} disabled={ocupado} className="gap-2 text-destructive hover:text-destructive">
                    {spin("rechazada") ?? <X className="h-4 w-4" aria-hidden />} Rechazada
                  </Button>
                </>
              )}
              {vigente && !cambios && !cerrada && (
                <Button onClick={() => ejecutar("orden")} disabled={ocupado} className="gap-2" variant={cot.estado === "aceptada" ? "default" : "outline"}
                  title="Crea la orden con estas piezas y precios, pendiente de pago">
                  {spin("orden") ?? <ShoppingCart className="h-4 w-4" aria-hidden />} Convertir en orden
                </Button>
              )}
              <Button variant="ghost" onClick={() => ejecutar("pdf")} disabled={ocupado} className="gap-2">
                {spin("pdf") ?? <Download className="h-4 w-4" aria-hidden />} Descargar PDF
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
