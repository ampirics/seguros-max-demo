"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import {
  ArrowLeft, Ban, CalendarPlus, ClipboardList, IdCard, Loader2, Lock, Mail, MessageSquare, MoreHorizontal, Pencil, Phone, Search,
  ShieldCheck, Trash2, UserX,
} from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { NuevaCita } from "@/components/admin/agenda/NuevaCita"
import { PiezaEnContexto } from "@/components/admin/crm/PiezaEnContexto"
import {
  Archivos, CotizacionesYCompras, LineaDeTiempo, NIVEL_CLASE, Panel, RIESGO_CLASE, Resumen, Senales, fecha, hace,
} from "@/components/admin/customers/perfil-secciones"
import { GarajeDestacado } from "@/components/admin/customers/GarajeDestacado"
import { PipelineCliente, usePipeline } from "@/components/admin/customers/PipelineCliente"
import { SeguridadCliente } from "@/components/admin/customers/SeguridadCliente"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api-client"
import type { VendedorAgenda } from "@/lib/api-types"
import { cotizacionesApi } from "@/lib/api/cotizaciones"
import {
  TIPOS_CLIENTE, TIPOS_DOCUMENTO, perfilApi, vehiculoTexto, type ArchivoCliente, type DatosEditables, type EventoCliente,
  type PerfilDelCliente, type ResumenCliente, type TipoCliente, type TipoDocumento,
} from "@/lib/api/perfil"
import { cn, formatCurrency } from "@/lib/utils"

type Sucursal = { id: string; nombre: string }
type PiezaBusqueda = { id: string; nombre: string; precio_dop: number; disponible: boolean }
const NINGUNO = "ninguno"

const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"
const telefonoVisible = (t: string) => (/^\d{11}$/.test(t) ? `+${t}` : t)

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-secondary/50 px-3 py-2.5">
      <dt className="truncate text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 truncate text-base font-semibold tabular-nums">{valor}</dd>
      {detalle && <dd className="truncate text-[11px] text-muted-foreground">{detalle}</dd>}
    </div>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      {children}
    </div>
  )
}

export default function PerfilClientePage() {
  const id = decodeURIComponent(useParams<{ id: string }>()?.id ?? "")
  const router = useRouter()
  const [perfil, setPerfil] = useState<PerfilDelCliente | null>(null)
  const [error, setError] = useState(false)
  const [eventos, setEventos] = useState<EventoCliente[] | null>(null)
  const [archivos, setArchivos] = useState<ArchivoCliente[] | null>(null)
  const [resumen, setResumen] = useState<ResumenCliente | null>(null)
  const [resumiendo, setResumiendo] = useState(false)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [vendedores, setVendedores] = useState<VendedorAgenda[]>([])
  const [vehiculoFiltro, setVehiculoFiltro] = useState("todos")
  const [dialogo, setDialogo] = useState<"bloquear" | "desbloquear" | "borrar" | "cotizar" | "agendar" | "documento" | "correo" | null>(null)
  const [documento, setDocumento] = useState<{ tipo: TipoDocumento; numero: string }>({ tipo: "cedula", numero: "" })
  const [motivo, setMotivo] = useState("")
  const [vence, setVence] = useState("config")
  const [confirmacion, setConfirmacion] = useState("")
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [piezas, setPiezas] = useState<PiezaBusqueda[] | null>(null)
  const [vehiculoCot, setVehiculoCot] = useState(NINGUNO)
  const [correo, setCorreo] = useState("")
  const [recargas, setRecargas] = useState(0)
  const pipeline = usePipeline(id, null, recargas)

  const cargar = useCallback(() => {
    perfilApi.ver(id).then((p) => { setPerfil(p); setError(false); if (p.resumen) setResumen(p.resumen) }).catch(() => setError(true))
    perfilApi.eventos(id, { limite: 300 }).then(setEventos).catch(() => setEventos([]))
    perfilApi.archivos(id).then(setArchivos).catch(() => setArchivos([]))
    setRecargas((n) => n + 1)
  }, [id])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    apiClient.get<Sucursal[]>("/sucursales").then((s) => setSucursales(Array.isArray(s) ? s : [])).catch(() => {})
    apiClient.get<VendedorAgenda[]>("/agenda/vendedores").then((v) => setVendedores(Array.isArray(v) ? v : [])).catch(() => {})
  }, [])

  const refrescarResumen = useCallback((forzar: boolean) => {
    setResumiendo(true)
    perfilApi.resumen(id, forzar).then(setResumen).catch(() => toast.error("No se pudo armar el resumen")).finally(() => setResumiendo(false))
  }, [id])
  useEffect(() => { if (perfil && !perfil.resumen && !resumen && !resumiendo && !perfil.cliente.anonimizado) refrescarResumen(false) }, [perfil, resumen, resumiendo, refrescarResumen])

  useEffect(() => {
    const q = busqueda.trim()
    if (dialogo !== "cotizar" || q.length < 3) { setPiezas(null); return }
    let vigente = true
    const t = setTimeout(() => {
      apiClient.get<{ items: PiezaBusqueda[] }>("/piezas/buscar", { q, limit: 6 })
        .then((r) => { if (vigente) setPiezas(r.items ?? []) }).catch(() => { if (vigente) setPiezas([]) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda, dialogo])

  const correr = async (clave: string, fn: () => Promise<void>) => {
    setOcupado(clave)
    try { await fn() } catch (e: any) { toast.error(e?.message || "No se pudo completar") } finally { setOcupado(null) }
  }

  if (error) {
    return (
      <AdminLayout title="Cliente">
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="font-medium">No se encontró el cliente.</p>
          <Button asChild variant="link"><Link href="/admin/customers">Volver a Clientes</Link></Button>
        </div>
      </AdminLayout>
    )
  }

  if (!perfil) {
    return (
      <AdminLayout title="Cliente">
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div>
        </div>
      </AdminLayout>
    )
  }

  const c = perfil.cliente
  const s = perfil.senales
  const borrado = !!c.anonimizado
  const activos = perfil.vehiculos.filter((v) => (v.estado ?? "activo") === "activo")
  const telefonos = c.telefonos ?? (c.telefono ? [c.telefono] : [])

  const editar = (datos: DatosEditables, alTerminar?: () => void) =>
    correr("editar", async () => { setPerfil(await perfilApi.editar(id, datos)); alTerminar?.(); toast.success("Cliente actualizado") })

  const tipoDocumento = TIPOS_DOCUMENTO.find((t) => t.valor === c.documento_tipo)?.texto ?? "Documento"
  const abrirDocumento = () => { setDocumento({ tipo: c.documento_tipo ?? "cedula", numero: c.documento ?? "" }); setDialogo("documento") }

  const bloquear = () => correr("bloquear", async () => {
    const r = await perfilApi.bloquear(id, !c.bloqueado, motivo.trim() || undefined, vence === "config" || c.bloqueado ? undefined : Number(vence))
    setDialogo(null); setMotivo(""); setVence("config")
    toast.success(r.bloqueado ? "Cliente bloqueado" : "Cliente desbloqueado")
    setPerfil(await perfilApi.ver(id))
  })

  const marcarListaBlanca = (activo: boolean) => correr("seguridad", async () => {
    await perfilApi.listaBlanca(id, activo)
    toast.success(activo ? "Cliente en la lista blanca" : "Cliente fuera de la lista blanca")
    setPerfil(await perfilApi.ver(id))
  })

  const marcarNoMolestar = (activo: boolean) => correr("seguridad", async () => {
    const r = await perfilApi.noMolestar(id, activo)
    setPerfil({ ...perfil, cliente: { ...c, no_molestar: r.no_molestar } })
    toast.success(activo ? "No recibirá mensajes automáticos" : "Vuelve a recibir mensajes automáticos")
  })

  const borrar = () => correr("borrar", async () => {
    const r = await perfilApi.borrarDatos(id)
    setDialogo(null); setConfirmacion(""); setResumen(null)
    toast.success(`Datos borrados: ${r.mensajes} mensajes y ${r.archivos} archivos`)
    cargar()
  })

  const cotizar = (pieza: { id: string; nombre: string }) => correr(`cotizar-${pieza.id}`, async () => {
    const v = activos.find((x) => x.id === vehiculoCot)
    const cot = await cotizacionesApi.crear({
      items: [{ pieza_id: pieza.id, cantidad: 1 }], conversation_id: perfil.conversacion_id ?? null, cliente_id: c.id,
      vehiculo_id: v?.id ?? null, vehiculo: v ? vehiculoTexto(v) : null,
    })
    toast.success(`Cotización ${cot.codigo} creada en borrador`)
    router.push(`/admin/cotizaciones/${cot.codigo}`)
  })

  const abrirCotizar = () => { setVehiculoCot(activos.length === 1 ? activos[0].id : NINGUNO); setBusqueda(""); setDialogo("cotizar") }

  const verHistorial = (vehiculoId: string) => {
    setVehiculoFiltro(vehiculoId)
    document.getElementById("linea-de-tiempo")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <AdminLayout title={c.nombre}>
      <div className="space-y-5">
        <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Clientes
        </Link>

        {borrado && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            <UserX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Los datos personales de este cliente se borraron el {fecha(c.anonimizado_at)}. Se conservan los montos de sus órdenes y cotizaciones.
          </div>
        )}

        <section className="rounded-lg border bg-card p-4 sm:p-5" aria-label="Encabezado del cliente">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold",
                c.bloqueado ? "bg-destructive-soft text-destructive" : "bg-accent text-accent-foreground")} aria-hidden>
                {iniciales(c.nombre)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-xl font-semibold">{c.nombre}</h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize">{c.tipo ?? "particular"}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", NIVEL_CLASE[perfil.interes.nivel])} title={perfil.interes.motivo}>
                    Interés {perfil.interes.nivel}
                  </span>
                  {s && s.riesgo.nivel !== "bajo" && (
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", RIESGO_CLASE[s.riesgo.nivel])} title={s.riesgo.motivo}>
                      Riesgo {s.riesgo.nivel}
                    </span>
                  )}
                  {c.bloqueado && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive" title={c.bloqueo_motivo ?? undefined}>
                      <Ban className="h-3 w-3" aria-hidden /> Bloqueado
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {telefonos.length && !c.sin_telefono ? telefonos.map((t) => (
                    <a key={t} href={`tel:${t}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" aria-hidden />{telefonoVisible(t)}</a>
                  )) : !borrado && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2 text-xs" title="Escribe con nombre de usuario de WhatsApp; la IA le pide el número al cotizar o agendar">
                      <Phone className="h-3 w-3" aria-hidden /> Sin teléfono
                    </span>
                  )}
                  {!borrado && (
                    <button type="button" onClick={() => { setCorreo(c.correo ?? ""); setDialogo("correo") }}
                      className="inline-flex items-center gap-1.5 rounded-control hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={c.correo ? `Correo ${c.correo}, editar` : "Agregar correo"}>
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      {c.correo ? <span>{c.correo}</span> : <span className="text-xs">Agregar correo</span>}
                      <Pencil className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                  {!borrado && (
                    <button type="button" onClick={abrirDocumento} data-testid="documento-cliente"
                      className="inline-flex items-center gap-1.5 rounded-control hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={c.documento ? `${tipoDocumento} ${c.documento}, editar` : "Agregar cédula o pasaporte"}>
                      <IdCard className="h-3.5 w-3.5" aria-hidden />
                      {c.documento ? <span>{tipoDocumento} <span className="font-mono text-xs">{c.documento}</span></span> : <span className="text-xs">Agregar cédula o pasaporte</span>}
                      <Pencil className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                  {c.origen && <span className="capitalize">Origen: {c.origen}</span>}
                </div>
                {c.bloqueado && c.bloqueo_motivo && <p className="mt-1.5 text-sm text-destructive">Motivo del bloqueo: {c.bloqueo_motivo}</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {perfil.conversacion_id && !borrado ? (
                <Button asChild size="sm" className="gap-1.5"><Link href={`/admin/chat?conversation=${perfil.conversacion_id}`}><MessageSquare className="h-4 w-4" aria-hidden /> Escribir</Link></Button>
              ) : (
                <Button size="sm" className="gap-1.5" disabled title="El cliente todavía no tiene conversación de WhatsApp"><MessageSquare className="h-4 w-4" aria-hidden /> Escribir</Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={abrirCotizar} disabled={borrado}><ClipboardList className="h-4 w-4" aria-hidden /> Cotizar</Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogo("agendar")} disabled={borrado}><CalendarPlus className="h-4 w-4" aria-hidden /> Agendar</Button>
              <Button size="sm" variant="outline" className={cn("gap-1.5", !c.bloqueado && "text-destructive hover:text-destructive")}
                onClick={() => setDialogo(c.bloqueado ? "desbloquear" : "bloquear")} disabled={borrado || ocupado === "bloquear"}>
                {c.bloqueado ? <><ShieldCheck className="h-4 w-4" aria-hidden /> Desbloquear</> : <><Lock className="h-4 w-4" aria-hidden /> Bloquear</>}
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Más acciones" disabled={borrado}><MoreHorizontal className="h-4 w-4" aria-hidden /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDialogo("borrar")}>
                    <Trash2 aria-hidden /> Borrar datos del cliente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Kpi etiqueta="Total comprado" valor={formatCurrency(s?.total_comprado_dop ?? 0)}
              detalle={`${s?.compras ?? 0} compra${s?.compras === 1 ? "" : "s"}${s?.frecuencia_dias ? ` · cada ${s.frecuencia_dias} días` : ""}`} />
            <Kpi etiqueta="Última compra" valor={s?.ultima_compra ? hace(s.ultima_compra) : "—"} detalle={s?.ultima_compra ? fecha(s.ultima_compra) : undefined} />
            <Kpi etiqueta="Última interacción" valor={hace(perfil.ultima_interaccion)} detalle={perfil.ultima_interaccion ? fecha(perfil.ultima_interaccion) : undefined} />
            <Kpi etiqueta="Cotizaciones" valor={String(perfil.cotizaciones.length)} detalle={`${activos.length} vehículo${activos.length === 1 ? "" : "s"} activo${activos.length === 1 ? "" : "s"}`} />
          </dl>

        </section>

        <Panel plegable="abierto" titulo="Recorrido del cliente" detalle="Dónde va: de la primera conversación a la compra, con la cita y los avisos que se le enviaron.">
          <PipelineCliente datos={pipeline.datos} error={pipeline.error} />
        </Panel>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-5">
            <GarajeDestacado clienteId={c.id} vehiculos={perfil.vehiculos} archivos={archivos} editable={!borrado} onHistorial={(v) => verHistorial(v.id)}
              onEstado={(v, estado) => correr(`vehiculo-${v.id}`, async () => {
                const nuevo = await perfilApi.estadoVehiculo(id, v.id, estado)
                setPerfil((p) => p && { ...p, vehiculos: p.vehiculos.map((x) => (x.id === v.id ? { ...x, ...nuevo, fotos: x.fotos } : x)) })
                toast.success(`${vehiculoTexto(v)}: ${estado === "activo" ? "activo" : estado === "ya_no_lo_tiene" ? "ya no lo tiene" : "de un tercero"}`)
              })} />
            <LineaDeTiempo eventos={eventos} vehiculos={perfil.vehiculos} vehiculo={vehiculoFiltro} onVehiculo={setVehiculoFiltro} />
            <CotizacionesYCompras perfil={perfil} />
            {!borrado && (
              <Panel plegable="cerrado" titulo="Cotizar una pieza">
                <PiezaEnContexto
                  contexto={{ clienteId: c.id, conversacionId: perfil.conversacion_id ?? null, vehiculo: activos[0] ?? null,
                    cotizacionCodigo: perfil.cotizaciones.find((q) => q.estado === "borrador")?.codigo ?? null }}
                  onCambio={() => cargar()}
                />
              </Panel>
            )}
          </div>
          <aside className="flex min-w-0 flex-col gap-5">
            {!borrado && <Resumen resumen={resumen} cargando={resumiendo} onRefrescar={() => refrescarResumen(true)} />}
            <SeguridadCliente seguridad={c.seguridad} listaBlanca={!!c.lista_blanca} noMolestar={!!c.no_molestar} editable={!borrado}
              ocupado={ocupado === "seguridad"} onListaBlanca={marcarListaBlanca} onNoMolestar={marcarNoMolestar} />
            <Senales perfil={perfil} />
            <Archivos archivos={archivos} vehiculos={perfil.vehiculos} editable={!borrado}
              onLigar={(a, vehiculoId, fotoDelVehiculo = false) => correr(`archivo-${a.id}`, async () => {
                const r = await perfilApi.ligarArchivo(a.id, vehiculoId, fotoDelVehiculo)
                setArchivos((l) => l && l.map((x) => (x.id === a.id ? { ...x, vehiculo_id: r.vehiculo_id, foto_del_vehiculo: r.foto_del_vehiculo } : x)))
                toast.success(r.foto_del_vehiculo ? "Ahora es la foto del carro" : vehiculoId ? "Foto ligada al vehículo" : "Foto sin vehículo")
              })} />
            <Panel plegable="cerrado" titulo="Datos del cliente">
              <div className="grid gap-4">
              <Dato etiqueta="Tipo de cliente">
                <Select value={c.tipo ?? "particular"} onValueChange={(v) => editar({ tipo: v as TipoCliente })} disabled={borrado || ocupado === "editar"}>
                  <SelectTrigger className="h-9" aria-label="Tipo de cliente"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_CLIENTE.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.texto}</SelectItem>)}</SelectContent>
                </Select>
              </Dato>
              <Dato etiqueta="Sucursal preferida">
                <Select value={c.sucursal_preferida?.id ?? NINGUNO} onValueChange={(v) => editar({ sucursal_preferida_id: v === NINGUNO ? null : v })} disabled={borrado || ocupado === "editar"}>
                  <SelectTrigger className="h-9" aria-label="Sucursal preferida"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>Sin sucursal</SelectItem>
                    {sucursales.map((x) => <SelectItem key={x.id} value={x.id}>{x.nombre}</SelectItem>)}
                    {c.sucursal_preferida && !sucursales.some((x) => x.id === c.sucursal_preferida!.id) && (
                      <SelectItem value={c.sucursal_preferida.id}>{c.sucursal_preferida.nombre}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </Dato>
              <Dato etiqueta="Vendedor asignado">
                <Select value={c.vendedor?.id ?? NINGUNO} onValueChange={(v) => editar({ vendedor_id: v === NINGUNO ? null : v })} disabled={borrado || ocupado === "editar"}>
                  <SelectTrigger className="h-9" aria-label="Vendedor asignado"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>Sin vendedor</SelectItem>
                    {vendedores.map((x) => <SelectItem key={x.id} value={x.id}>{x.nombre}</SelectItem>)}
                    {c.vendedor && !vendedores.some((x) => x.id === c.vendedor!.id) && <SelectItem value={c.vendedor.id}>{c.vendedor.nombre}</SelectItem>}
                  </SelectContent>
                </Select>
              </Dato>
              </div>
            </Panel>
          </aside>
        </div>
      </div>

      <AlertDialog open={dialogo === "bloquear"} onOpenChange={(o) => { if (!o) { setDialogo(null); setMotivo("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear a {c.nombre}</AlertDialogTitle>
            <AlertDialogDescription>El bloqueo queda en la auditoría con su motivo y se ve en la Bandeja. Puedes desbloquearlo cuando quieras.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-bloqueo">Motivo</Label>
            <Textarea id="motivo-bloqueo" rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: pide precios de muchos vehículos sin comprar" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vence-bloqueo">Vence</Label>
            <Select value={vence} onValueChange={setVence}>
              <SelectTrigger id="vence-bloqueo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="config">Según la configuración de la IA</SelectItem>
                <SelectItem value="7">En 7 días</SelectItem>
                <SelectItem value="30">En 30 días</SelectItem>
                <SelectItem value="90">En 90 días</SelectItem>
                <SelectItem value="0">Nunca</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={!motivo.trim() || ocupado === "bloquear"}
              onClick={(e) => { e.preventDefault(); bloquear() }}>
              {ocupado === "bloquear" && <Loader2 className="animate-spin" aria-hidden />} Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogo === "desbloquear"} onOpenChange={(o) => { if (!o) { setDialogo(null); setMotivo("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear a {c.nombre}</AlertDialogTitle>
            <AlertDialogDescription>Vuelve a ser atendido normal por la IA y su puntaje empieza de cero. Queda en la auditoría con tu usuario y el motivo.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-desbloqueo">Motivo</Label>
            <Textarea id="motivo-desbloqueo" rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: es cliente de mostrador conocido" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!motivo.trim() || ocupado === "bloquear"} onClick={(e) => { e.preventDefault(); bloquear() }}>
              {ocupado === "bloquear" && <Loader2 className="animate-spin" aria-hidden />} Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogo === "borrar"} onOpenChange={(o) => { if (!o) { setDialogo(null); setConfirmacion("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar datos de {c.nombre}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Se borran su nombre, teléfonos, correo, documento y dirección, sus fotos y notas de voz, y lo que escribió. Se conservan los montos de órdenes y cotizaciones para contabilidad.</p>
                <p>No se puede deshacer y queda en la auditoría. Si vuelve a escribir, empieza como cliente nuevo.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirmar-borrado">Escribe BORRAR para confirmar</Label>
            <Input id="confirmar-borrado" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={confirmacion !== "BORRAR" || ocupado === "borrar"}
              onClick={(e) => { e.preventDefault(); borrar() }}>
              {ocupado === "borrar" && <Loader2 className="animate-spin" aria-hidden />} Borrar datos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogo === "cotizar"} onOpenChange={(o) => { if (!o) setDialogo(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cotizar a {c.nombre}</DialogTitle>
            <DialogDescription>Elige la pieza; la cotización queda en borrador para que agregues más líneas y la envíes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activos.length > 0 && (
              <div className="space-y-2">
                <Label>Vehículo</Label>
                <Select value={vehiculoCot} onValueChange={setVehiculoCot}>
                  <SelectTrigger aria-label="Vehículo de la cotización"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>Sin vehículo</SelectItem>
                    {activos.map((v) => <SelectItem key={v.id} value={v.id}>{vehiculoTexto(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {perfil.piezas_consultadas.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Piezas que vio</p>
                <ul className="divide-y rounded-lg border">
                  {perfil.piezas_consultadas.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                      {p.precio_dop != null && <span className="tabular-nums text-muted-foreground">{formatCurrency(p.precio_dop)}</span>}
                      <Button size="sm" variant="outline" className="h-7" onClick={() => cotizar(p)} disabled={!!ocupado}>
                        {ocupado === `cotizar-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Cotizar"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="buscar-pieza">Buscar otra pieza</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="buscar-pieza" className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej.: amortiguador tucson 2012" />
              </div>
              {piezas && (piezas.length === 0 ? <p className="text-sm text-muted-foreground">Sin resultados.</p> : (
                <ul className="divide-y rounded-lg border">
                  {piezas.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.nombre}{!p.disponible && <span className="ml-1 text-xs text-warning">(agotada)</span>}</span>
                      <span className="tabular-nums text-muted-foreground">{formatCurrency(p.precio_dop)}</span>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => cotizar(p)} disabled={!!ocupado}>
                        {ocupado === `cotizar-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Cotizar"}
                      </Button>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === "documento"} onOpenChange={(o) => { if (!o) setDialogo(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Documento de {c.nombre}</DialogTitle>
            <DialogDescription>{c.origen === "sap" ? "Este cliente viene de SAP: su documento se cambia en SAP." : "Cédula de 11 dígitos, RNC de 9 o pasaporte."}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); editar({ documento_tipo: documento.tipo, documento: documento.numero.trim() || null }, () => setDialogo(null)) }}>
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="documento-tipo">Tipo</Label>
                <Select value={documento.tipo} onValueChange={(v) => setDocumento((d) => ({ ...d, tipo: v as TipoDocumento }))} disabled={c.origen === "sap"}>
                  <SelectTrigger id="documento-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.texto}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documento-numero">Número</Label>
                <Input id="documento-numero" value={documento.numero} onChange={(e) => setDocumento((d) => ({ ...d, numero: e.target.value }))}
                  placeholder={documento.tipo === "pasaporte" ? "RD1234567" : documento.tipo === "rnc" ? "101234567" : "00112345678"}
                  autoComplete="off" className="font-mono" disabled={c.origen === "sap"} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogo(null)}>Cancelar</Button>
              <Button type="submit" disabled={ocupado === "editar" || c.origen === "sap"} className="gap-1.5">
                {ocupado === "editar" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === "correo"} onOpenChange={(o) => { if (!o) setDialogo(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Correo de {c.nombre}</DialogTitle>
            <DialogDescription>Le llega aquí la confirmación de su visita con la invitación para su calendario.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); editar({ correo: correo.trim() || null }, () => setDialogo(null)) }}>
            <div className="space-y-2">
              <Label htmlFor="correo-cliente">Correo</Label>
              <Input id="correo-cliente" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@correo.com" autoComplete="off" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogo(null)}>Cancelar</Button>
              <Button type="submit" disabled={ocupado === "editar"} className="gap-1.5">
                {ocupado === "editar" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <NuevaCita abierta={dialogo === "agendar"} vendedores={vendedores} vendedorInicial={c.vendedor?.id ?? null}
        clienteInicial={{ id: c.id, name: c.nombre, phone: c.telefono ?? "" }}
        onCerrar={() => setDialogo(null)} onCreada={() => { setDialogo(null); cargar() }} />
    </AdminLayout>
  )
}
