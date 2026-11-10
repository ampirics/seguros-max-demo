"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { CheckCircle2, Globe, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdmin } from "@/contexts/admin-context"
import { FUENTES, aniosTexto, catalogoApi, type DatosVehiculo, type EstadoCatalogo, type VehiculoDelCatalogo } from "@/lib/api/catalogo"
import { canAccessSection } from "@/lib/permissions"
import { cn } from "@/lib/utils"

const PAGINA = 100

const CAMPOS: { clave: keyof DatosVehiculo; label: string; placeholder?: string; tipo?: "number"; ancho?: string }[] = [
  { clave: "marca", label: "Marca", placeholder: "Hyundai" },
  { clave: "modelo", label: "Modelo", placeholder: "Tucson" },
  { clave: "generacion", label: "Generación", placeholder: "Tucson 10 (2009-2013)", ancho: "sm:col-span-2" },
  { clave: "anio_desde", label: "Desde", tipo: "number" },
  { clave: "anio_hasta", label: "Hasta", tipo: "number" },
  { clave: "motor", label: "Motor (como en el catálogo)", placeholder: "2.0 Litros - 4G63", ancho: "sm:col-span-2" },
  { clave: "motor_codigo", label: "Código de motor", placeholder: "4G63" },
  { clave: "cilindrada", label: "Cilindrada (L)", placeholder: "2.0" },
  { clave: "combustible", label: "Combustible", placeholder: "gasolina" },
  { clave: "version", label: "Versión", placeholder: "GLS" },
  { clave: "transmision", label: "Transmisión", placeholder: "automática" },
  { clave: "mercado", label: "Mercado", placeholder: "EE. UU." },
]

function VehiculoDialog({ vehiculo, onClose, onGuardado }: { vehiculo: VehiculoDelCatalogo | "nuevo" | null; onClose: () => void; onGuardado: () => void }) {
  const [datos, setDatos] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!vehiculo) return
    setDatos(Object.fromEntries(CAMPOS.map((c) => [c.clave, vehiculo === "nuevo" ? "" : String(vehiculo[c.clave] ?? "")])))
  }, [vehiculo])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const cuerpo: DatosVehiculo = {}
    for (const c of CAMPOS) {
      const v = (datos[c.clave] ?? "").trim()
      ;(cuerpo as Record<string, unknown>)[c.clave] = c.tipo === "number" ? (v ? Number(v) : null) : v || null
    }
    setGuardando(true)
    try {
      if (vehiculo === "nuevo") await catalogoApi.crearVehiculo(cuerpo)
      else if (vehiculo) await catalogoApi.actualizarVehiculo(vehiculo.id, cuerpo)
      toast.success("Guardado: queda propuesto hasta que el experto lo apruebe")
      onGuardado()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar el vehículo.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!vehiculo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{vehiculo === "nuevo" ? "Nuevo vehículo" : "Editar vehículo"}</DialogTitle>
            <DialogDescription>Cualquier cambio queda propuesto hasta que el experto de piezas lo apruebe.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
            {CAMPOS.map((c) => (
              <div key={c.clave} className={cn("space-y-1.5", c.ancho ?? "col-span-2 sm:col-span-1")}>
                <Label htmlFor={`veh-${c.clave}`}>{c.label}</Label>
                <Input id={`veh-${c.clave}`} type={c.tipo ?? "text"} inputMode={c.tipo === "number" ? "numeric" : undefined}
                  placeholder={c.placeholder} required={c.clave === "marca" || c.clave === "modelo"}
                  value={datos[c.clave] ?? ""} onChange={(e) => setDatos({ ...datos, [c.clave]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando || !datos.marca?.trim() || !datos.modelo?.trim()}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VpicDialog({ abierto, marcas, onClose, onHecho }: { abierto: boolean; marcas: string[]; onClose: () => void; onHecho: () => void }) {
  const [marca, setMarca] = useState("")
  const [anio, setAnio] = useState(String(new Date().getFullYear() - 10))
  const [consultando, setConsultando] = useState(false)

  useEffect(() => { if (abierto && !marca) setMarca(marcas[0] ?? "Hyundai") }, [abierto, marcas, marca])

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault()
    setConsultando(true)
    try {
      const r = await catalogoApi.completarVpic(marca, Number(anio))
      toast.success(r.propuestos.length ? `${r.propuestos.length} modelos propuestos: ${r.propuestos.slice(0, 4).join(", ")}${r.propuestos.length > 4 ? "…" : ""}` : "vPIC no trajo modelos nuevos")
      onHecho()
    } catch (err: any) {
      toast.error(err?.message || "vPIC no respondió.")
    } finally {
      setConsultando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={consultar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Completar con NHTSA vPIC</DialogTitle>
            <DialogDescription>Trae los modelos de la marca para ese año (mercado de EE. UU.). Los que falten entran como propuestos.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vpic-marca">Marca</Label>
              <Input id="vpic-marca" required value={marca} onChange={(e) => setMarca(e.target.value)} list="vpic-marcas" />
              <datalist id="vpic-marcas">{["Hyundai", "Mitsubishi", "Kia", ...marcas].filter((m, i, a) => a.indexOf(m) === i).map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vpic-anio">Año</Label>
              <Input id="vpic-anio" type="number" inputMode="numeric" min={1980} max={new Date().getFullYear() + 1} required value={anio} onChange={(e) => setAnio(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={consultando || !marca.trim()}>{consultando && <Loader2 className="animate-spin" aria-hidden />} Consultar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CatalogoVehiculosPage() {
  const { user } = useAdmin()
  const puedeEditar = canAccessSection(user?.role, "/admin/products")
  const [q, setQ] = useState("")
  const [marca, setMarca] = useState("todas")
  const [estado, setEstado] = useState<EstadoCatalogo | "todos">("todos")
  const [res, setRes] = useState<{ total: number; marcas: string[]; items: VehiculoDelCatalogo[] } | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [editar, setEditar] = useState<VehiculoDelCatalogo | "nuevo" | null>(null)
  const [vpic, setVpic] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const t = setTimeout(() => {
      catalogoApi.vehiculos({ q: q.trim() || undefined, marca: marca === "todas" ? undefined : marca,
        estado: estado === "todos" ? undefined : estado, limit: PAGINA })
        .then((r) => { if (vigente) { setRes(r); setError(false) } })
        .catch(() => { if (vigente) setError(true) })
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, marca, estado, intento])

  const aprobar = async (v: VehiculoDelCatalogo) => {
    setOcupado(v.id)
    try {
      await catalogoApi.aprobarVehiculo(v.id)
      toast.success(`${v.marca} ${v.modelo} aprobado`)
      setIntento((n) => n + 1)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo aprobar.")
    } finally {
      setOcupado(null)
    }
  }

  const eliminar = async (v: VehiculoDelCatalogo) => {
    if (!window.confirm(`¿Quitar ${v.marca} ${v.modelo} ${aniosTexto(v)} del catálogo?`)) return
    setOcupado(v.id)
    try {
      await catalogoApi.eliminarVehiculo(v.id)
      setIntento((n) => n + 1)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo quitar.")
    } finally {
      setOcupado(null)
    }
  }

  const propuestos = res?.items.filter((v) => v.estado === "propuesto").length ?? 0

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-4">
        <SeccionTabs seccion="inventario" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Vehículos con su generación, motor y versión. Las piezas apuntan a esta lista y el bot la usa para preguntar el motor.
            Lo nuevo o editado queda propuesto hasta que el experto lo aprueba.
          </p>
          {puedeEditar && (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setVpic(true)}><Globe className="h-4 w-4" aria-hidden /> vPIC</Button>
              <Button className="gap-2" onClick={() => setEditar("nuevo")}><Plus className="h-4 w-4" aria-hidden /> Nuevo</Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Modelo, motor o código (4G63)" aria-label="Buscar vehículos" className="h-10 bg-card pl-9" />
          </div>
          <Select value={marca} onValueChange={setMarca}>
            <SelectTrigger className="h-10 bg-card sm:w-44" aria-label="Marca"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las marcas</SelectItem>
              {(res?.marcas ?? []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={(v) => setEstado(v as EstadoCatalogo | "todos")}>
            <SelectTrigger className="h-10 bg-card sm:w-44" aria-label="Estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="propuesto">Por aprobar</SelectItem>
              <SelectItem value="aprobado">Aprobados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudo cargar el catálogo de vehículos</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !res ? (
          <Card className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</Card>
        ) : res.items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">No hay vehículos con esos filtros</p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {res.items.map((v) => (
                <li key={v.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{v.marca} {v.modelo}</span>
                      <span className="text-sm text-muted-foreground">{v.generacion ?? aniosTexto(v)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
                        v.estado === "aprobado" ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                        {v.estado === "aprobado" ? "Aprobado" : "Por aprobar"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm">
                      {v.motor ? (
                        <>
                          {v.motor}
                          <span className="text-muted-foreground">{[v.motor_codigo && ` · código ${v.motor_codigo}`, v.cilindrada && ` · ${v.cilindrada} L`, v.combustible && ` · ${v.combustible}`].filter(Boolean).join("")}</span>
                        </>
                      ) : <span className="text-muted-foreground">Motor sin especificar</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[aniosTexto(v), v.version, v.transmision, v.mercado, FUENTES[v.fuente] ?? v.fuente,
                        `${v.piezas ?? 0} ${(v.piezas ?? 0) === 1 ? "pieza" : "piezas"}`,
                        v.estado === "aprobado" ? v.aprobado_por && `aprobó ${v.aprobado_por}` : v.propuesto_por && `propuso ${v.propuesto_por}`]
                        .filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {puedeEditar && (
                    <div className="flex shrink-0 gap-1">
                      {v.estado === "propuesto" && (
                        <Button size="sm" variant="outline" className="gap-1.5" disabled={ocupado === v.id} onClick={() => aprobar(v)}>
                          <CheckCircle2 className="h-4 w-4" aria-hidden /> Aprobar
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Editar ${v.marca} ${v.modelo}`} onClick={() => setEditar(v)}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      {!v.piezas && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Quitar ${v.marca} ${v.modelo}`} disabled={ocupado === v.id} onClick={() => eliminar(v)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              {res.items.length} de {res.total}{propuestos > 0 && ` · ${propuestos} por aprobar en esta lista`}
            </div>
          </Card>
        )}
      </div>
      <VehiculoDialog vehiculo={editar} onClose={() => setEditar(null)} onGuardado={() => { setEditar(null); setIntento((n) => n + 1) }} />
      <VpicDialog abierto={vpic} marcas={res?.marcas ?? []} onClose={() => setVpic(false)} onHecho={() => { setVpic(false); setEstado("propuesto"); setIntento((n) => n + 1) }} />
    </AdminLayout>
  )
}
