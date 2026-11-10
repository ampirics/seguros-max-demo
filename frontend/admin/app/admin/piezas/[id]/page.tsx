"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { ArrowLeft, ExternalLink, Package } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Condicion, vehiculoTexto } from "@/components/admin/piezas/PiezaFila"
import { Existencia, PiezaFoto } from "@/components/chat/PiezaCards"
import { ExistenciasPieza } from "@/components/admin/inventario/ExistenciasPieza"
import { RelacionesPieza } from "@/components/admin/piezas/RelacionesPieza"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdmin } from "@/contexts/admin-context"
import { apiClient } from "@/lib/api-client"
import { canAccessSection } from "@/lib/permissions"
import type { Calidad, PiezaFicha } from "@/lib/api-types"
import { catalogoApi } from "@/lib/api/catalogo"
import { aFicha } from "@/lib/api/piezas"
import { enlaceCatalogo, useNegocio } from "@/lib/api/negocio"
import { cn, formatCurrency, nombrePieza } from "@/lib/utils"

const RELACION: Record<string, string> = {
  oem_equivalente: "Original, mismo OEM",
  alterna: "Alterna, mismo OEM",
  lado_opuesto: "Lado opuesto",
  kit: "Kit",
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 font-display text-base font-semibold">{titulo}</h2>
        {children}
      </CardContent>
    </Card>
  )
}

export default function PiezaPage() {
  const id = useParams<{ id: string }>()?.id ?? ""
  const [pieza, setPieza] = useState<PiezaFicha | null>(null)
  const [error, setError] = useState(false)
  const [foto, setFoto] = useState(0)
  const { user } = useAdmin()
  const negocio = useNegocio()
  const puedeEditar = canAccessSection(user?.role, "/admin/products")

  const cambiarCalidad = async (calidad: Calidad) => {
    try {
      const p = await catalogoApi.cambiarCalidad(id, calidad)
      setPieza(aFicha(p))
      toast.success(calidad === "original" ? "Marcada como original" : "Marcada como alterna")
    } catch (err: any) {
      toast.error(err?.message || "No se pudo cambiar la calidad.")
    }
  }

  useEffect(() => {
    setPieza(null)
    setError(false)
    setFoto(0)
    apiClient.get<PiezaFicha>(`/piezas/${id}`).then((p) => setPieza(aFicha(p))).catch(() => setError(true))
  }, [id])

  return (
    <AdminLayout title="Ficha de pieza">
      <div className="space-y-4">
        <Link href="/admin/piezas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Inventario
        </Link>

        {error ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">No encontramos esta pieza</p>
            <p className="mt-1 text-sm text-muted-foreground">Puede que ya no esté en el catálogo.</p>
          </CardContent></Card>
        ) : !pieza ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-3"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /></div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="space-y-2">
                {pieza.imagenes.length ? (
                  <img src={pieza.imagenes[foto]} alt={pieza.nombre} className="aspect-square w-full rounded-lg border bg-white object-contain" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-secondary text-sm text-muted-foreground">Sin foto en el catálogo</div>
                )}
                {pieza.imagenes.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {pieza.imagenes.map((src, i) => (
                      <button key={src} type="button" onClick={() => setFoto(i)} aria-label={`Foto ${i + 1}`} aria-pressed={foto === i}
                        className={cn("shrink-0 rounded-md border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", foto === i ? "border-primary" : "border-transparent")}>
                        <img src={src} alt="" className="h-16 w-16 rounded bg-white object-contain" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {puedeEditar && pieza.calidad ? (
                      <Select value={pieza.calidad} onValueChange={(v) => cambiarCalidad(v as Calidad)}>
                        <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs" aria-label="Calidad"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="original">Original</SelectItem>
                          <SelectItem value="alterna">Alterna</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Condicion condicion={pieza.calidad ?? pieza.condicion} />
                    )}
                    <Existencia disponible={pieza.disponible} />
                  </div>
                  <h1 className="mt-2 font-display text-xl font-semibold leading-tight sm:text-2xl">{nombrePieza(pieza.nombre)}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{vehiculoTexto(pieza.vehiculo)}</p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(pieza.precio_dop)}</p>
                  {pieza.precio_mayoreo_dop != null && (
                    <p className="text-sm text-muted-foreground">Mayoreo {formatCurrency(pieza.precio_mayoreo_dop)}</p>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Dato label="OEM">{pieza.oem ?? "—"}</Dato>
                  <Dato label="Referencia del fabricante">{pieza.mpn ?? "—"}</Dato>
                  <Dato label="SKU">{pieza.sku ?? "—"}</Dato>
                  <Dato label="Fabricante">{pieza.fabricante ?? "—"}</Dato>
                  <Dato label="Sistema">{pieza.sistema ?? "—"}</Dato>
                  <Dato label="Posición">{pieza.posicion ?? "No aplica"}</Dato>
                  {pieza.garantia && <Dato label="Garantía">{pieza.garantia}</Dato>}
                </dl>
                <div className="flex flex-wrap gap-2">
                  {canAccessSection(user?.role, "/admin/products") && (
                    <Button asChild variant="outline" className="gap-2">
                      <Link href={`/admin/products/${pieza.id}`}><Package className="h-4 w-4" aria-hidden /> Editar en inventario</Link>
                    </Button>
                  )}
                  {enlaceCatalogo(negocio, pieza.vehiculo?.marca ?? pieza.fabricante, pieza.oem) && (
                    <Button asChild variant="outline" className="gap-2">
                      <a href={enlaceCatalogo(negocio, pieza.vehiculo?.marca ?? pieza.fabricante, pieza.oem)!} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" aria-hidden /> Ver en el catálogo oficial
                      </a>
                    </Button>
                  )}
                  {pieza.url && (
                    <Button asChild variant="ghost" className="gap-2">
                      <a href={pieza.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden /> Ver en la tienda web</a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Seccion titulo="Existencia por sucursal">
                <ExistenciasPieza piezaId={pieza.id} disponibleCatalogo={pieza.disponible} />
              </Seccion>

              <Seccion titulo="Compatibilidad">
                {pieza.compatibilidad.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Pieza de uso general, sin vehículo específico.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {pieza.compatibilidad.map((v) => (
                      <li key={`${v.modelo}-${v.anios}`} className="py-2">
                        <span className="font-medium">{v.marca} {v.modelo}</span> {v.anios}
                        {v.motor && <span className="block text-xs text-muted-foreground">Motor {v.motor}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Seccion>
            </div>

            <Seccion titulo="Reemplazos y piezas relacionadas">
              <RelacionesPieza piezaId={pieza.id} relacionadas={pieza.relacionadas ?? []} puedeEditar={puedeEditar}
                onCambio={(relacionadas) => setPieza({ ...pieza, relacionadas })} />
            </Seccion>

            <Seccion titulo="Equivalencias">
              {pieza.equivalencias.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay otra pieza con el mismo OEM ni lado opuesto en el catálogo.</p>
              ) : (
                <ul className="divide-y">
                  {pieza.equivalencias.map((e) => {
                    const diferencia = e.precio_dop - pieza.precio_dop
                    return (
                      <li key={e.id}>
                        <Link href={`/admin/piezas/${e.id}`} className="flex items-center gap-3 py-2.5 outline-none hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                          <PiezaFoto pieza={e} className="h-12 w-12" />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-medium leading-snug">{nombrePieza(e.nombre)}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{[RELACION[e.relacion] ?? e.relacion, e.fabricante].filter(Boolean).join(" · ")}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums">{formatCurrency(e.precio_dop)}</span>
                            {diferencia !== 0 && (
                              <span className={cn("block text-[11px] tabular-nums", diferencia < 0 ? "text-success" : "text-muted-foreground")}>
                                {diferencia < 0 ? "−" : "+"}{formatCurrency(Math.abs(diferencia))}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Seccion>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
