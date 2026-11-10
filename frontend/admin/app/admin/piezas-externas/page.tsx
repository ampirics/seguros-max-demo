"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { CarFront, Download, ExternalLink, Loader2, Search, Trash2 } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { PiezasExternasTabs, SeccionTabs } from "@/components/admin/SeccionTabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdmin } from "@/contexts/admin-context"
import type { Calidad, CompatibilidadExterna } from "@/lib/api-types"
import { aniosTexto, catalogoApi, compatibilidadTexto, type FuenteExterna, type FuenteTraer, type PiezaExterna, type VehiculoDelCatalogo } from "@/lib/api/catalogo"
import { canAccessSection } from "@/lib/permissions"
import { cn } from "@/lib/utils"

const ESTADOS: { valor: PiezaExterna["estado"] | "todas"; texto: string }[] = [
  { valor: "propuesto", texto: "Por revisar" },
  { valor: "aprobado", texto: "Aprobadas" },
  { valor: "rechazado", texto: "Rechazadas" },
  { valor: "todas", texto: "Todas" },
]

const FUENTE_LOTE: Record<string, string> = { simulada: "Catálogo de la tienda", pdf: "Boletín PDF", proveedor: "Archivo de proveedor", simulado: "Proveedor" }

const sinNotasInternas = (t: string | null | undefined) =>
  (t ?? "").split(/(?<=\.)\s+/).filter((frase) => !/prueba|sin valor real|api[_ ]?key|servidor/i.test(frase)).join(" ")

const fotoDe = (url: string | null | undefined) => (!url ? null : /^https?:|^\//.test(url) ? url : `/${url.replace(/^assets\//, "")}`)

interface DatosLote {
  compatibilidad?: CompatibilidadExterna[]
  ya_en_catalogo?: boolean
  fuente?: { nombre: string; version: string | null }
  original?: { url: string | null }
  lectura?: { documento: string; pagina: number } | null
}

function fuenteTexto(p: PiezaExterna) {
  const d = p.datos as DatosLote
  if (d.lectura) return `${d.lectura.documento}, pág. ${d.lectura.pagina}`
  if (d.fuente) {
    const [clave, ...resto] = d.fuente.nombre.split("-")
    if (clave === "simulado") return `Proveedor ${resto.join("-").toUpperCase()}`.trim()
    return FUENTE_LOTE[clave] ? [FUENTE_LOTE[clave], resto.join("-")].filter(Boolean).join(": ") : d.fuente.nombre
  }
  return `${p.fuente} ${p.version ?? ""}`.trim()
}

type VehiculoLote = CompatibilidadExterna & { anio: number | null }

const norm = (t: string | null | undefined) => (t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()

function vehiculoDelLote(items: PiezaExterna[], referencia: string): VehiculoLote | null {
  const c = items.filter((p) => p.referencia === referencia).map((p) => (p.datos as DatosLote).compatibilidad?.[0]).find(Boolean)
  if (!c) return null
  const anio = Number(referencia.match(/(?:^|-)((?:19|20)\d{2})(?=-|$)/)?.[1]) || null
  return { ...c, anio }
}

function cubre(v: VehiculoDelCatalogo, l: VehiculoLote) {
  if (norm(v.marca) !== norm(l.marca) || norm(v.modelo) !== norm(l.modelo)) return false
  if (!l.anio) return true
  return (!v.anio_desde || l.anio >= v.anio_desde) && (!v.anio_hasta || l.anio <= v.anio_hasta)
}

const nombreVehiculo = (v: Pick<VehiculoDelCatalogo, "marca" | "modelo" | "anio_desde" | "anio_hasta" | "motor">) =>
  `${v.marca} ${v.modelo} ${aniosTexto(v)}${v.motor ? ` · ${v.motor}` : ""}`

function AltaVehiculoDialog({ vehiculo, onClose, onHecho }: { vehiculo: VehiculoLote | null; onClose: () => void; onHecho: () => void }) {
  const [marca, setMarca] = useState("")
  const [modelo, setModelo] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [motor, setMotor] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!vehiculo) return
    setMarca(vehiculo.marca); setModelo(vehiculo.modelo); setMotor(vehiculo.motor ?? "")
    setDesde(String(vehiculo.anio_desde ?? vehiculo.anio ?? "")); setHasta(String(vehiculo.anio_hasta ?? vehiculo.anio ?? ""))
  }, [vehiculo])

  const d = Number(desde), h = Number(hasta)
  const valido = !!marca.trim() && !!modelo.trim() && d > 1900 && h >= d

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    try {
      const v = await catalogoApi.crearVehiculo({ marca: marca.trim(), modelo: modelo.trim(), anio_desde: d, anio_hasta: h, motor: motor.trim() || null })
      try {
        await catalogoApi.aprobarVehiculo(v.id)
        toast.success(`${v.marca} ${v.modelo} dado de alta en el maestro`)
      } catch (err: any) {
        toast.error(err?.message || "El vehículo quedó propuesto: falta aprobarlo en Vehículos.")
      }
      onHecho()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo dar de alta el vehículo.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!vehiculo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Dar de alta el vehículo</DialogTitle>
            <DialogDescription>Entra al maestro de vehículos ya aprobado, para poder incorporar las piezas del lote.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="alta-marca">Marca</Label>
              <Input id="alta-marca" required maxLength={60} value={marca} onChange={(e) => setMarca(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alta-modelo">Modelo</Label>
              <Input id="alta-modelo" required maxLength={80} value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alta-desde">Desde</Label>
              <Input id="alta-desde" type="number" inputMode="numeric" required value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alta-hasta">Hasta</Label>
              <Input id="alta-hasta" type="number" inputMode="numeric" required value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alta-motor">Motor (opcional)</Label>
            <Input id="alta-motor" maxLength={80} value={motor} onChange={(e) => setMotor(e.target.value)} />
          </div>
          {desde && hasta && !valido && <p className="text-xs text-destructive" role="alert">Revisa los años: el último no puede ser antes del primero.</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando || !valido}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Dar de alta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IncorporarDialog({ pieza, sugerido, onClose, onHecho }: { pieza: PiezaExterna | null; sugerido: string | null; onClose: () => void; onHecho: () => void }) {
  const [vehiculos, setVehiculos] = useState<VehiculoDelCatalogo[] | null>(null)
  const [vehiculo, setVehiculo] = useState("")
  const [sku, setSku] = useState("")
  const [nombre, setNombre] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!pieza) return
    const r = pieza.resumen
    setVehiculos(null); setVehiculo(sugerido ?? ""); setSku("")
    setNombre([r.nombre, r.numero, r.marca && `- ${r.marca}`].filter(Boolean).join(" "))
    catalogoApi.vehiculos({ estado: "aprobado", limit: 500 }).then((v) => setVehiculos(v.items))
      .catch(() => { setVehiculos([]); toast.error("No se pudieron cargar los vehículos.") })
  }, [pieza, sugerido])

  const incorporar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pieza || !vehiculo) return
    setGuardando(true)
    try {
      await catalogoApi.incorporarExterna(pieza.id, { vehiculo_id: vehiculo, sku: sku.trim() || undefined, nombre: nombre.trim() || undefined })
      toast.success("Pieza incorporada: pendiente por comprar")
      onHecho()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo incorporar la pieza.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!pieza} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={incorporar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Incorporar sin precio</DialogTitle>
            <DialogDescription>Queda en el catálogo como pendiente por comprar: precio 0 y oculta en la tienda hasta que se compre y se le ponga precio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inc-vehiculo">Vehículo</Label>
            <Select value={vehiculo} onValueChange={setVehiculo} disabled={!vehiculos?.length}>
              <SelectTrigger id="inc-vehiculo"><SelectValue placeholder={vehiculos ? (vehiculos.length ? "Elige el vehículo" : "No hay vehículos aprobados") : "Cargando…"} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {vehiculos?.map((v) => <SelectItem key={v.id} value={v.id}>{nombreVehiculo(v)}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Tiene que estar en el maestro y aprobado. Si no está, usa &quot;Dar de alta el vehículo&quot;.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-nombre">Nombre</Label>
            <Input id="inc-nombre" maxLength={300} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-sku">SKU (opcional)</Label>
            <Input id="inc-sku" maxLength={60} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Si lo dejas vacío: PEND- y el número" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando || !vehiculo}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Incorporar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TraerDialog({ abierto, onClose, onHecho }: { abierto: boolean; onClose: () => void; onHecho: (referencia: string) => void }) {
  const [fuentes, setFuentes] = useState<FuenteTraer[] | null>(null)
  const [clave, setClave] = useState("")
  const [documento, setDocumento] = useState("")
  const [vehiculo, setVehiculo] = useState("")
  const [anio, setAnio] = useState("")
  const [trayendo, setTrayendo] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setFuentes(null); setClave(""); setDocumento(""); setVehiculo(""); setAnio("")
    catalogoApi.fuentesTraer().then((r) => setFuentes(r.fuentes)).catch(() => { setFuentes([]); toast.error("No se pudieron cargar las fuentes.") })
  }, [abierto])

  const fuente = fuentes?.find((f) => f.clave === clave)
  const doc = fuente?.documentos.find((d) => d.id === documento)
  const vehiculos = (fuente?.necesita_documento ? doc?.vehiculos : fuente?.vehiculos) ?? []
  const v = vehiculo === "" ? undefined : vehiculos[Number(vehiculo)]
  const n = Number(anio)
  const anioValido = !!v && Number.isInteger(n) && n > 0 && (!v.anio_desde || n >= v.anio_desde) && (!v.anio_hasta || n <= v.anio_hasta)

  const traer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fuente || !v || !anioValido) return
    setTrayendo(true)
    try {
      const r = await catalogoApi.traer({ fuente: fuente.clave, documento: fuente.necesita_documento ? documento : undefined, marca: v.marca, modelo: v.modelo, anio: n })
      toast.success(`${r.nuevas} ${r.nuevas === 1 ? "nueva" : "nuevas"}, ${r.ya_estaban} ya estaban`)
      r.resumen.avisos.forEach((a) => toast(a))
      onHecho(r.referencia)
    } catch (err: any) {
      toast.error(err?.message || "No se pudieron traer las piezas.")
    } finally {
      setTrayendo(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={traer} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Traer piezas</DialogTitle>
            <DialogDescription>Lee la fuente para un vehículo y deja las piezas en &quot;Por revisar&quot;. Las que ya estaban no se repiten.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="traer-fuente">Fuente</Label>
            <Select value={clave} onValueChange={(c) => { setClave(c); setDocumento(""); setVehiculo("") }} disabled={!fuentes}>
              <SelectTrigger id="traer-fuente"><SelectValue placeholder={fuentes ? "Elige la fuente" : "Cargando…"} /></SelectTrigger>
              <SelectContent>
                {fuentes?.map((f) => (
                  <SelectItem key={f.clave} value={f.clave} disabled={!f.disponible}>
                    {f.nombre}{!f.disponible ? " (no disponible)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fuente && sinNotasInternas(fuente.descripcion) && <p className="text-xs text-muted-foreground">{sinNotasInternas(fuente.descripcion)}</p>}
          </div>
          {fuente?.necesita_documento && (
            <div className="space-y-1.5">
              <Label htmlFor="traer-documento">Documento</Label>
              <Select value={documento} onValueChange={(d) => { setDocumento(d); setVehiculo("") }} disabled={!fuente.documentos.length}>
                <SelectTrigger id="traer-documento"><SelectValue placeholder={fuente.documentos.length ? "Elige el documento" : "No hay documentos cargados"} /></SelectTrigger>
                <SelectContent>
                  {fuente.documentos.map((d) => (
                    <SelectItem key={d.id} value={d.id} disabled={!d.listo}>{d.titulo}{!d.listo ? " (no disponible)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="traer-vehiculo">Vehículo</Label>
              <Select value={vehiculo} onValueChange={setVehiculo} disabled={!vehiculos.length}>
                <SelectTrigger id="traer-vehiculo"><SelectValue placeholder="Marca y modelo" /></SelectTrigger>
                <SelectContent>
                  {vehiculos.map((x, i) => (
                    <SelectItem key={i} value={String(i)}>{compatibilidadTexto([x])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="traer-anio">Año</Label>
              <Input id="traer-anio" type="number" inputMode="numeric" required min={v?.anio_desde ?? undefined} max={v?.anio_hasta ?? undefined}
                value={anio} onChange={(e) => setAnio(e.target.value)} placeholder={v?.anio_desde ? String(v.anio_desde) : ""} />
            </div>
          </div>
          {v && anio && !anioValido && (
            <p className="text-xs text-destructive" role="alert">El año tiene que estar entre {v.anio_desde} y {v.anio_hasta ?? "hoy"}.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={trayendo || !anioValido || (!!fuente?.necesita_documento && !documento)}>
              {trayendo && <Loader2 className="animate-spin" aria-hidden />} Buscar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AprobarDialog({ pieza, onClose, onHecho }: { pieza: PiezaExterna | null; onClose: () => void; onHecho: () => void }) {
  const [sku, setSku] = useState("")
  const [precio, setPrecio] = useState("")
  const [nombre, setNombre] = useState("")
  const [vehiculo, setVehiculo] = useState("ninguno")
  const [calidad, setCalidad] = useState<Calidad | "auto">("auto")
  const [vehiculos, setVehiculos] = useState<VehiculoDelCatalogo[]>([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!pieza) return
    const r = pieza.resumen
    setSku(""); setPrecio(""); setVehiculo("ninguno"); setCalidad("auto")
    setNombre([r.nombre, r.numero, r.marca && `- ${r.marca}`].filter(Boolean).join(" "))
    catalogoApi.vehiculos({ estado: "aprobado", limit: 500 }).then((v) => setVehiculos(v.items)).catch(() => setVehiculos([]))
  }, [pieza])

  const aprobar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pieza) return
    setGuardando(true)
    try {
      await catalogoApi.aprobarExterna(pieza.id, {
        sku: sku.trim(), precio_dop: Number(precio), nombre: nombre.trim() || undefined,
        vehiculo_id: vehiculo === "ninguno" ? undefined : vehiculo, calidad: calidad === "auto" ? undefined : calidad,
      })
      toast.success("Pieza creada en el catálogo")
      onHecho()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo aprobar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!pieza} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={aprobar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Aprobar y crear la pieza</DialogTitle>
            <DialogDescription>El SKU y el precio los pones tú: el precio nunca sale de la fuente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ext-nombre">Nombre</Label>
            <Input id="ext-nombre" maxLength={300} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ext-sku">SKU</Label>
              <Input id="ext-sku" required maxLength={60} value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-precio">Precio (RD$)</Label>
              <Input id="ext-precio" type="number" inputMode="decimal" min={1} step="0.01" required value={precio} onChange={(e) => setPrecio(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-vehiculo">Vehículo (opcional)</Label>
            <Select value={vehiculo} onValueChange={setVehiculo}>
              <SelectTrigger id="ext-vehiculo"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="ninguno">Sin vehículo (uso general)</SelectItem>
                {vehiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.marca} {v.modelo} {aniosTexto(v)}{v.motor ? ` · ${v.motor}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-calidad">Calidad</Label>
            <Select value={calidad} onValueChange={(v) => setCalidad(v as Calidad | "auto")}>
              <SelectTrigger id="ext-calidad"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Según la marca de la pieza</SelectItem>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="alterna">Alterna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando || !sku.trim() || !(Number(precio) > 0)}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Aprobar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function PiezasExternasPage() {
  const { user } = useAdmin()
  const puedeEditar = canAccessSection(user?.role, "/admin/products")
  const [estado, setEstado] = useState<PiezaExterna["estado"] | "todas">("propuesto")
  const [datos, setDatos] = useState<{ fuente: FuenteExterna; items: PiezaExterna[] } | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [numero, setNumero] = useState("")
  const [consultando, setConsultando] = useState(false)
  const [aprobar, setAprobar] = useState<PiezaExterna | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [traerAbierto, setTraerAbierto] = useState(false)
  const [lote, setLote] = useState("todos")
  const [incorporar, setIncorporar] = useState<PiezaExterna | null>(null)
  const [alta, setAlta] = useState<VehiculoLote | null>(null)
  const [borrar, setBorrar] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [maestro, setMaestro] = useState<{ referencia: string; vehiculo: VehiculoDelCatalogo | null; error: boolean } | null>(null)
  const [revisarMaestro, setRevisarMaestro] = useState(0)

  useEffect(() => {
    let vigente = true
    setDatos(null)
    catalogoApi.externas(estado)
      .then((r) => { if (vigente) { setDatos(r); setError(false) } })
      .catch(() => { if (vigente) setError(true) })
    return () => { vigente = false }
  }, [estado, intento])

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault()
    setConsultando(true)
    try {
      const r = await catalogoApi.consultarExterna(numero.trim())
      toast.success(r.nuevas ? `${r.nuevas} ${r.nuevas === 1 ? "resultado" : "resultados"} para revisar` : "La fuente no trajo nada nuevo")
      setEstado("propuesto")
      setIntento((n) => n + 1)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo consultar la fuente.")
    } finally {
      setConsultando(false)
    }
  }

  const rechazar = async (p: PiezaExterna) => {
    setOcupado(p.id)
    try {
      await catalogoApi.rechazarExterna(p.id)
      setIntento((n) => n + 1)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo rechazar.")
    } finally {
      setOcupado(null)
    }
  }

  const fuente = datos?.fuente
  const lotes = [...new Set((datos?.items ?? []).map((p) => p.referencia).filter((r): r is string => !!r))]
  const items = datos?.items.filter((p) => lote === "todos" || !lotes.includes(lote) || p.referencia === lote) ?? []
  const loteElegido = lotes.includes(lote) ? lote : null
  const vehiculoLote = loteElegido && datos ? vehiculoDelLote(datos.items, loteElegido) : null
  const porRevisarLote = loteElegido ? items.filter((p) => p.estado === "propuesto").length : 0
  const claveVehiculo = vehiculoLote ? `${vehiculoLote.marca}|${vehiculoLote.modelo}|${vehiculoLote.anio ?? ""}` : ""

  useEffect(() => {
    if (!loteElegido || !vehiculoLote) { setMaestro(null); return }
    let vigente = true
    const referencia = loteElegido
    setMaestro(null)
    catalogoApi.vehiculos({ marca: vehiculoLote.marca, modelo: vehiculoLote.modelo, estado: "aprobado", limit: 100 })
      .then((r) => { if (vigente) setMaestro({ referencia, vehiculo: r.items.find((v) => cubre(v, vehiculoLote)) ?? null, error: false }) })
      .catch(() => { if (vigente) setMaestro({ referencia, vehiculo: null, error: true }) })
    return () => { vigente = false }
  }, [loteElegido, claveVehiculo, revisarMaestro])

  const borrarLote = async () => {
    if (!loteElegido) return
    setBorrando(true)
    try {
      const r = await catalogoApi.borrarLote(loteElegido)
      toast.success(`Lote borrado: ${r.borradas} ${r.borradas === 1 ? "pieza" : "piezas"} por revisar. Ya puedes volver a traerlo.`)
      setBorrar(false)
      setLote("todos")
      setIntento((n) => n + 1)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo borrar el lote.")
    } finally {
      setBorrando(false)
    }
  }

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-4">
        <SeccionTabs seccion="inventario" />
        <PiezasExternasTabs />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Piezas de una base externa con licencia. Lo que trae la fuente se guarda tal cual y no entra al catálogo hasta que el experto lo aprueba.
          </p>
          {puedeEditar && (
            <Button className="shrink-0 gap-1.5" onClick={() => setTraerAbierto(true)}>
              <Download className="h-4 w-4" aria-hidden /> Traer piezas
            </Button>
          )}
        </div>

        {puedeEditar && fuente?.configurada && (
          <form onSubmit={consultar} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número de pieza u OEM, p. ej. 54651-2S000"
                aria-label="Número de pieza" className="h-10 bg-card pl-9" disabled={!fuente?.configurada} />
            </div>
            <Button type="submit" disabled={!fuente?.configurada || consultando || numero.trim().length < 3}>
              {consultando && <Loader2 className="animate-spin" aria-hidden />} Consultar la fuente
            </Button>
          </form>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Estado">
            {ESTADOS.map((e) => (
              <button key={e.valor} type="button" aria-pressed={estado === e.valor} onClick={() => setEstado(e.valor)}
                className={cn("h-8 shrink-0 rounded-control px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  estado === e.valor ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {e.texto}
              </button>
            ))}
          </div>
          {lotes.length > 0 && (
            <Select value={lotes.includes(lote) ? lote : "todos"} onValueChange={setLote}>
              <SelectTrigger className="h-8 bg-card text-xs sm:w-64" aria-label="Lote"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los lotes</SelectItem>
                {lotes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {puedeEditar && loteElegido && datos && (
          <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between" aria-label="Lote elegido" role="region">
            <div className="min-w-0 text-sm">
              <p className="break-words font-medium">Lote {loteElegido}</p>
              <p className="text-xs text-muted-foreground" role="status">
                {vehiculoLote ? `${vehiculoLote.marca} ${vehiculoLote.modelo}${vehiculoLote.anio ? ` ${vehiculoLote.anio}` : ""}` : "Sin vehículo en la fuente"}
                {" · "}
                {!vehiculoLote ? "elige el vehículo al incorporar" : !maestro ? "revisando el maestro…" : maestro.error ? "no se pudo revisar el maestro"
                  : maestro.vehiculo ? "ya está en el maestro" : "no está en el maestro"}
                {" · "}{porRevisarLote} por revisar
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {maestro?.error && <Button size="sm" variant="outline" onClick={() => setRevisarMaestro((n) => n + 1)}>Reintentar</Button>}
              {vehiculoLote && maestro && !maestro.error && !maestro.vehiculo && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAlta(vehiculoLote)}>
                  <CarFront className="h-4 w-4" aria-hidden /> Dar de alta el vehículo
                </Button>
              )}
              {porRevisarLote > 0 && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setBorrar(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Borrar el lote
                </Button>
              )}
            </div>
          </div>
        )}

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar las piezas externas</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !datos ? (
          <Card className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">Nada {estado === "propuesto" ? "por revisar" : "en esta lista"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {puedeEditar ? "Usa \"Traer piezas\" para leer un catálogo, un boletín o el archivo de un proveedor." : "Aquí aparecen las piezas que trae la tienda para revisar."}
            </p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {items.map((p) => {
                const d = p.datos as DatosLote
                return (
                <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  {fotoDe(p.resumen.imagen) && (
                    <img src={fotoDe(p.resumen.imagen)!} alt={`Foto de referencia: ${p.resumen.nombre ?? "pieza"}`} loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-md border bg-white object-contain" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.resumen.nombre ?? "Sin nombre"} {p.resumen.numero && <span className="text-muted-foreground">· Referencia del proveedor {p.resumen.numero}</span>}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span>{compatibilidadTexto(d.compatibilidad)}</span>
                      {d.ya_en_catalogo && <span className="rounded-control bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">Ya está en el catálogo</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[p.resumen.marca, p.resumen.oem.length > 0 && `OEM ${p.resumen.oem.join(", ")}`, fuenteTexto(p),
                        p.referencia && `lote ${p.referencia}`, p.revisado_por && `revisó ${p.revisado_por}`].filter(Boolean).join(" · ")}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-xs">
                      {d.original?.url && (
                        <a href={d.original.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          Ver en la fuente <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                      {p.pieza_id && <Link href={`/admin/piezas/${p.pieza_id}`} className="underline-offset-2 hover:underline">Ver la pieza creada</Link>}
                    </div>
                  </div>
                  {puedeEditar && p.estado === "propuesto" && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="ghost" disabled={ocupado === p.id} onClick={() => rechazar(p)}>Rechazar</Button>
                      <Button size="sm" variant="outline" onClick={() => setIncorporar(p)}>Incorporar</Button>
                      <Button size="sm" onClick={() => setAprobar(p)}>Aprobar</Button>
                    </div>
                  )}
                </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>
      <TraerDialog abierto={traerAbierto} onClose={() => setTraerAbierto(false)}
        onHecho={(referencia) => { setTraerAbierto(false); setEstado("propuesto"); setLote(referencia); setIntento((n) => n + 1) }} />
      <AprobarDialog pieza={aprobar} onClose={() => setAprobar(null)} onHecho={() => { setAprobar(null); setIntento((n) => n + 1) }} />
      <IncorporarDialog pieza={incorporar} sugerido={incorporar && maestro?.referencia === incorporar.referencia ? maestro.vehiculo?.id ?? null : null}
        onClose={() => setIncorporar(null)} onHecho={() => { setIncorporar(null); setIntento((n) => n + 1) }} />
      <AltaVehiculoDialog vehiculo={alta} onClose={() => setAlta(null)} onHecho={() => { setAlta(null); setRevisarMaestro((n) => n + 1) }} />
      <AlertDialog open={borrar} onOpenChange={(o) => !o && !borrando && setBorrar(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar el lote</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran las {porRevisarLote} {porRevisarLote === 1 ? "pieza" : "piezas"} por revisar del lote {loteElegido}, para volver a traerlo. Lo aprobado o rechazado se queda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={borrando}
              onClick={(e) => { e.preventDefault(); borrarLote() }}>
              {borrando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />} Borrar el lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
