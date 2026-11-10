"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Loader2, MapPin, Plus } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { inventarioApi, type Sucursal } from "@/lib/api/inventario"

const VACIA: Sucursal = { id: "", nombre: "", direccion: "", telefono: "", horario: "", activa: true }

function SucursalDialog({ sucursal, onClose, onGuardada }: { sucursal: Sucursal | null; onClose: () => void; onGuardada: () => void }) {
  const [datos, setDatos] = useState<Sucursal>(VACIA)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (sucursal) setDatos({ ...VACIA, ...sucursal }) }, [sucursal])

  const campo = (k: keyof Sucursal) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDatos({ ...datos, [k]: e.target.value })

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    const cuerpo = { nombre: datos.nombre.trim(), direccion: datos.direccion?.trim() || null, telefono: datos.telefono?.trim() || null,
      horario: datos.horario?.trim() || null, activa: datos.activa, almacen_sap: datos.almacen_sap?.trim() || null }
    try {
      if (sucursal?.id) await inventarioApi.actualizarSucursal(sucursal.id, cuerpo)
      else await inventarioApi.crearSucursal(cuerpo)
      toast.success("Sucursal guardada")
      onGuardada()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar la sucursal.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!sucursal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{sucursal?.id ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
            <DialogDescription>El bot usa estos datos para decir dónde queda la tienda y a qué hora abre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="suc-nombre">Nombre</Label>
            <Input id="suc-nombre" required maxLength={120} value={datos.nombre} onChange={campo("nombre")} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suc-direccion">Dirección</Label>
            <Input id="suc-direccion" maxLength={300} value={datos.direccion ?? ""} onChange={campo("direccion")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suc-telefono">Teléfono</Label>
            <Input id="suc-telefono" type="tel" maxLength={40} value={datos.telefono ?? ""} onChange={campo("telefono")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suc-horario">Horario</Label>
            <Textarea id="suc-horario" rows={2} maxLength={300} placeholder="Ej.: lunes a viernes de 8:00 a. m. a 5:00 p. m.; sábados hasta las 12:00 m."
              value={datos.horario ?? ""} onChange={campo("horario")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suc-almacen">Almacén en SAP (opcional)</Label>
            <Input id="suc-almacen" maxLength={40} placeholder="Ej.: 01" value={datos.almacen_sap ?? ""} onChange={campo("almacen_sap")} />
            <p className="text-xs text-muted-foreground">Para leer las existencias de esta sucursal desde SAP.</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="suc-activa" className="text-sm">Activa</Label>
            <Switch id="suc-activa" checked={datos.activa !== false} onCheckedChange={(activa) => setDatos({ ...datos, activa })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando || !datos.nombre.trim()}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function SucursalesPage() {
  const [items, setItems] = useState<Sucursal[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [editar, setEditar] = useState<Sucursal | null>(null)

  useEffect(() => {
    inventarioApi.sucursales(true).then((r) => { setItems(r); setError(false) }).catch(() => setError(true))
  }, [intento])

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-4">
        <SeccionTabs seccion="inventario" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Locales de la tienda. Las existencias, las reservas y las visitas apuntan a una sucursal.</p>
          <Button className="shrink-0 gap-2" onClick={() => setEditar(VACIA)}><Plus className="h-4 w-4" aria-hidden /> Nueva sucursal</Button>
        </div>
        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar las sucursales</p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          </CardContent></Card>
        ) : !items ? (
          <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">Todavía no hay sucursales</p>
            <p className="mt-1 text-sm text-muted-foreground">Agrega la primera para cargar existencias por sucursal.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((s) => (
              <Card key={s.id} className={s.activa === false ? "opacity-70" : undefined}>
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />{s.nombre}</h2>
                    {s.activa === false && <Badge variant="secondary">Inactiva</Badge>}
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div><dt className="sr-only">Dirección</dt><dd className={s.direccion ? undefined : "text-muted-foreground"}>{s.direccion || "Dirección por confirmar"}</dd></div>
                    <div><dt className="sr-only">Teléfono</dt><dd className={s.telefono ? undefined : "text-muted-foreground"}>{s.telefono || "Teléfono por confirmar"}</dd></div>
                    <div><dt className="sr-only">Horario</dt><dd className={s.horario ? undefined : "text-muted-foreground"}>{s.horario || "Horario por confirmar"}</dd></div>
                    {s.almacen_sap && <div><dt className="sr-only">Almacén SAP</dt><dd className="text-muted-foreground">Almacén SAP {s.almacen_sap}</dd></div>}
                  </dl>
                  <div className="mt-auto pt-2">
                    <Button variant="outline" size="sm" onClick={() => setEditar(s)}>Editar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <SucursalDialog sucursal={editar} onClose={() => setEditar(null)} onGuardada={() => { setEditar(null); setIntento((n) => n + 1) }} />
    </AdminLayout>
  )
}
