"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Loader2, Plus, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { MODULOS, negocioApi, recargarNegocio, type Modulo, type Negocio } from "@/lib/api/negocio"

const MODULOS_RESTAURANTE: Modulo[] = ["salon", "reservaciones", "carta", "comensales", "metricas"]

export default function NegocioPage() {
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [catalogos, setCatalogos] = useState<{ marca: string; url: string }[]>([])
  const [error, setError] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    negocioApi.ver().then((n) => { setNegocio(n); setCatalogos(n.catalogos_oficiales) }).catch(() => setError(true))
  }, [])

  const guardar = async (datos: Parameters<typeof negocioApi.guardar>[0], ok: string) => {
    setOcupado(true)
    try {
      const n = await negocioApi.guardar(datos)
      setNegocio(n); setCatalogos(n.catalogos_oficiales); recargarNegocio(n)
      toast.success(ok)
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar")
    } finally {
      setOcupado(false)
    }
  }

  const validos = catalogos.every((c) => c.marca.trim() && /^https:\/\/.+\{oem\}/.test(c.url.trim()))
  const cambiaron = JSON.stringify(catalogos) !== JSON.stringify(negocio?.catalogos_oficiales ?? [])

  return (
    <AdminLayout title="Tipo de negocio">
      {error ? <p className="text-sm text-muted-foreground">No se pudo cargar la configuración.</p> : !negocio ? <Skeleton className="h-64 w-full" /> : (
        <div className="flex max-w-3xl flex-col gap-6">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-base font-semibold">Tipo de negocio</h2>
            <p className="mt-1 text-sm text-muted-foreground">Define qué pantallas del panel se ven. Cambiarlo vuelve a los módulos del tipo.</p>
            <div className="mt-4 max-w-xs">
              <Select value={negocio.tipo} disabled={ocupado} onValueChange={(tipo) => guardar({ tipo }, "Tipo de negocio actualizado")}>
                <SelectTrigger aria-label="Tipo de negocio"><SelectValue /></SelectTrigger>
                <SelectContent>{negocio.tipos.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="mt-4 divide-y border-t">
              {MODULOS.filter((m) => (negocio.tipo === "restaurante") === MODULOS_RESTAURANTE.includes(m.valor)).map((m) => (
                <div key={m.valor} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Label htmlFor={`modulo-${m.valor}`} className="text-sm font-medium">{m.texto}</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.detalle}</p>
                  </div>
                  <Switch id={`modulo-${m.valor}`} checked={!!negocio.modulos[m.valor]} disabled={ocupado}
                    onCheckedChange={(v) => guardar({ modulos: { [m.valor]: v } as Partial<Record<Modulo, boolean>> }, v ? `${m.texto} visible` : `${m.texto} oculto`)} />
                </div>
              ))}
            </div>
          </section>

          {negocio.modulos.piezas && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="text-base font-semibold">Catálogo oficial por marca</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                El botón “Ver en el catálogo oficial” de la ficha de la pieza abre este enlace con el número OEM en lugar de <code>{"{oem}"}</code>.
                Si la marca no está en la lista, se usa la primera.
              </p>
              <ul className="mt-4 space-y-2">
                {catalogos.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <Input aria-label="Marca" className="w-36 shrink-0" maxLength={40} value={c.marca}
                      onChange={(e) => setCatalogos(catalogos.map((x, j) => (j === i ? { ...x, marca: e.target.value } : x)))} />
                    <Input aria-label={`Enlace de ${c.marca || "la marca"}`} maxLength={300} value={c.url} placeholder="https://…{oem}"
                      onChange={(e) => setCatalogos(catalogos.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    <Button type="button" size="icon" variant="ghost" aria-label={`Quitar ${c.marca}`} onClick={() => setCatalogos(catalogos.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setCatalogos([...catalogos, { marca: "", url: "https://partsouq.com/en/search/all?q={oem}" }])}>
                  <Plus className="h-4 w-4" aria-hidden /> Agregar marca
                </Button>
                <Button type="button" size="sm" disabled={!cambiaron || !validos || ocupado}
                  onClick={() => guardar({ catalogos_oficiales: catalogos.map((c) => ({ marca: c.marca.trim(), url: c.url.trim() })) }, "Enlaces guardados")}>
                  {ocupado && <Loader2 className="animate-spin" aria-hidden />} Guardar enlaces
                </Button>
                {!validos && <p className="text-xs text-destructive">Cada enlace empieza con https:// y lleva {"{oem}"}.</p>}
              </div>
            </section>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
