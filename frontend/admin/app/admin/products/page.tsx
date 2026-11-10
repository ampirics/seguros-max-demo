"use client"

import { urlImagen } from '@/lib/api/piezas'
import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChevronLeft, ChevronRight, Edit, Eye, EyeOff, LayoutGrid, List, Loader2, MoreHorizontal, Package, Plus, Search, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, nombrePieza } from "@/lib/utils"
import { toast } from "react-toastify"
import { useAdmin } from "@/contexts/admin-context"
import { useCompany } from "@/contexts/company-context"
import { apiClient } from "@/lib/api-client"
import type { Product } from "@/lib/types"
import { formatPrice } from "@/utils/format"

const PAGE_SIZE = 24
// Mismo criterio que el backend (admin_products.CATALOG_WRITER_ROLES).
const WRITER_ROLES = new Set(["super_admin", "admin", "manager", "editor", "supervisor"])

/** Precio que paga el cliente: el de la variante más barata activa ("Desde"). */
function priceInfo(p: any): { min: number; max: number } {
  const variantPrices: number[] = Array.isArray(p.generated_skus)
    ? p.generated_skus
        .filter((s: any) => s && s.active !== false && Number(s.price) > 0)
        .map((s: any) => Number(s.price))
    : []
  if (variantPrices.length) return { min: Math.min(...variantPrices), max: Math.max(...variantPrices) }
  const base = Number(p.price) || 0
  return { min: base, max: base }
}

export default function AdminProductsPage() {
  const { user, isLoading } = useAdmin()
  const { activeCompany } = useCompany()
  const router = useRouter()
  const canWrite = WRITER_ROLES.has(String((user as any)?.role || "").toLowerCase())

  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all")
  const [priceFilter, setPriceFilter] = useState<"all" | "zero" | "priced">("all")
  const [page, setPage] = useState(0)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Cuadrícula para ver fotos; lista para recorrer cientos de piezas. Se recuerda por navegador.
  const [vista, setVista] = useState<"cuadricula" | "lista">("cuadricula")

  useEffect(() => {
    try {
      if (localStorage.getItem("productos-vista") === "lista") setVista("lista")
    } catch {}
  }, [])

  const cambiarVista = (v: "cuadricula" | "lista") => {
    setVista(v)
    try { localStorage.setItem("productos-vista", v) } catch {}
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = !!search || visibility !== "all" || priceFilter !== "all"

  // La búsqueda va al servidor, con pausa para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setLoadError(false)
    try {
      const res = await apiClient.listAdminProducts(
        { search: search || undefined, visibility, price: priceFilter, skip: page * PAGE_SIZE, limit: PAGE_SIZE },
        ctrl.signal,
      )
      if (ctrl.signal.aborted) return
      setProducts(res.items || [])
      setTotal(res.total || 0)
    } catch (error: any) {
      if (ctrl.signal.aborted || error?.name === "AbortError") return
      console.error("Error cargando productos:", error)
      setLoadError(true)
      setProducts([])
      setTotal(0)
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [search, visibility, priceFilter, page])

  useEffect(() => {
    if (user && activeCompany?.id) load()
  }, [user, activeCompany?.id, load])

  const clearFilters = () => {
    setSearchInput("")
    setSearch("")
    setVisibility("all")
    setPriceFilter("all")
    setPage(0)
  }

  const toggleVisibility = async (p: Product) => {
    const next = !(p.isVisible ?? (p as any).is_visible)
    setBusyId(p.id)
    try {
      // Solo el campo que cambia: reenviar el producto entero pisaba cambios
      // hechos mientras tanto (otro usuario o la sincronización con SAP).
      await apiClient.request(`/admin/products/${p.id}`, { method: "PUT", body: JSON.stringify({ is_visible: next }) })
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, isVisible: next, is_visible: next } as any : x)))
      toast.success(next ? "Producto visible en la tienda" : "Producto oculto en la tienda")
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cambiar la visibilidad")
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    const p = toDelete
    if (!p) return
    setToDelete(null)
    setBusyId(p.id)
    try {
      await apiClient.request(`/admin/products/${p.id}`, { method: "DELETE" })
      toast.success("Producto eliminado")
      load()
    } catch (error: any) {
      // Con pedidos el backend no deja borrarlo: lo que corresponde es ocultarlo.
      toast.error(error?.message || "No se pudo eliminar. Si tiene pedidos, ocúltalo en su lugar.")
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading || !user) {
    return (
      <AdminLayout title="Inventario">
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando…
        </div>
      </AdminLayout>
    )
  }

  // Menú de acciones de cada producto: editar, mostrar u ocultar, eliminar.
  const acciones = (product: Product, visible: boolean, busy: boolean, className?: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          aria-label={`Acciones de ${product.name}`}
          disabled={!canWrite || busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push(`/admin/products/${product.id}/edit`)}>
          <Edit aria-hidden /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleVisibility(product)}>
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {visible ? "Ocultar en la tienda" : "Mostrar en la tienda"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setToDelete(product)} className="text-destructive focus:text-destructive">
          <Trash2 aria-hidden /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const precio = (product: Product) => {
    const { min, max } = priceInfo(product)
    if (max <= 0) return <span className="text-muted-foreground">—</span>
    return min !== max ? <><span className="text-xs font-normal text-muted-foreground">Desde </span>{formatPrice(min)}</> : formatPrice(min)
  }

  const variantes = (product: Product) =>
    Array.isArray(product.generated_skus) && product.generated_skus.length > 0 ? ` · ${product.generated_skus.length} variantes` : ""

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-5">
        <SeccionTabs seccion="inventario" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Catálogo de {activeCompany?.name ?? "la empresa"}. Precio, visibilidad y variantes pueden venir de SAP.
          </p>
          {canWrite && (
            <Button asChild className="w-fit shrink-0">
              <Link href="/admin/products/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" aria-hidden /> Nuevo producto
              </Link>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Buscar por nombre, SKU o categoría"
              title="Busca también en los SKU de las variantes y en el código de categoría"
              aria-label="Buscar productos"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 bg-card pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={visibility} onValueChange={(v) => { setVisibility(v as any); setPage(0) }}>
              <SelectTrigger className="h-10 w-auto min-w-36 bg-card" aria-label="Visibilidad"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="visible">Visibles en tienda</SelectItem>
                <SelectItem value="hidden">Ocultos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priceFilter} onValueChange={(v) => { setPriceFilter(v as any); setPage(0) }}>
              <SelectTrigger className="h-10 w-auto min-w-36 bg-card" aria-label="Precio"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier precio</SelectItem>
                <SelectItem value="priced">Con precio</SelectItem>
                <SelectItem value="zero">Sin precio (RD$0)</SelectItem>
              </SelectContent>
            </Select>
            <div role="radiogroup" aria-label="Vista" className="inline-flex gap-0.5 rounded-control border bg-card p-0.5">
              {([["cuadricula", "Cuadrícula", LayoutGrid], ["lista", "Lista", List]] as const).map(([v, texto, Icono]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={vista === v}
                  aria-label={texto}
                  title={texto}
                  onClick={() => cambiarVista(v)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    vista === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icono className="h-4 w-4" aria-hidden />
                </button>
              ))}
            </div>
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {loading ? "…" : `${total.toLocaleString("es-DO")} producto${total !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>

        {loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="font-medium">No se pudieron cargar los productos.</p>
              <Button variant="outline" onClick={load}>Reintentar</Button>
            </CardContent>
          </Card>
        ) : loading && products.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-60 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" aria-hidden />
              <h3 className="mb-1 font-medium">{hasFilters ? "Ningún producto coincide" : "No hay productos"}</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {hasFilters ? "Prueba con otros filtros." : "Agrega el primero o sincroniza desde SAP."}
              </p>
              {hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
              ) : canWrite ? (
                <Button asChild><Link href="/admin/products/new"><Plus className="mr-2 h-4 w-4" aria-hidden />Crear producto</Link></Button>
              ) : null}
            </CardContent>
          </Card>
        ) : vista === "lista" ? (
          <Card className={cn("divide-y overflow-hidden", loading && "opacity-60")} aria-busy={loading}>
            {products.map((product) => {
              const visible = !!(product.isVisible ?? (product as any).is_visible)
              const sinPrecio = priceInfo(product).max <= 0
              return (
                <div key={product.id} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-secondary/50">
                  <Link href={`/admin/products/${product.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn("relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-foto", !visible && "opacity-50")}>
                      {product.image ? (
                        <Image src={urlImagen(product.image) ?? ""} alt="" fill sizes="48px" className="object-contain p-1 dark:brightness-90" />
                      ) : (
                        <Package className="m-3 h-6 w-6 text-muted-foreground" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={nombrePieza(product.name)}>{nombrePieza(product.name)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.sku ? `SKU ${product.sku}` : "Sin SKU"}{variantes(product)}
                      </span>
                    </span>
                  </Link>
                  <span className="hidden gap-1 sm:flex">
                    {!visible && <Badge variant="secondary">Oculto</Badge>}
                    {sinPrecio && <Badge className="border-transparent bg-destructive-soft text-destructive hover:bg-destructive-soft">Sin precio</Badge>}
                  </span>
                  <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums">{precio(product)}</span>
                  {acciones(product, visible, busyId === product.id)}
                </div>
              )
            })}
          </Card>
        ) : (
          <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6", loading && "opacity-60")} aria-busy={loading}>
            {products.map((product) => {
              const visible = !!(product.isVisible ?? (product as any).is_visible)
              const sinPrecio = priceInfo(product).max <= 0
              return (
                <Card key={product.id} className="group relative overflow-hidden transition-colors hover:border-primary/30">
                  <Link href={`/admin/products/${product.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    {/* Las fotos del catálogo vienen con fondo blanco: el marco (bg-foto) las integra en los dos modos */}
                    <div className={cn("relative aspect-[4/3] bg-foto", !visible && "opacity-50")}>
                      {product.image ? (
                        <Image
                          src={urlImagen(product.image) ?? ""}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
                          className="object-contain p-3 dark:brightness-90"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5 p-3">
                      <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5" title={nombrePieza(product.name)}>{nombrePieza(product.name)}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.sku ? `SKU ${product.sku}` : "Sin SKU"}{variantes(product)}
                      </p>
                      <p className="pt-1 text-base font-semibold tabular-nums">{precio(product)}</p>
                    </div>
                  </Link>
                  {/* Solo lo que es excepción lleva marca: lo visible es lo normal */}
                  {(!visible || sinPrecio) && (
                    <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
                      {!visible && <Badge variant="secondary" className="shadow-sm">Oculto</Badge>}
                      {sinPrecio && <Badge className="border-transparent bg-destructive-soft text-destructive shadow-sm">Sin precio</Badge>}
                    </div>
                  )}
                  {acciones(
                    product,
                    visible,
                    busyId === product.id,
                    "absolute right-2 top-2 bg-card/90 shadow-sm backdrop-blur md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString("es-DO")}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Anterior
              </Button>
              <span className="text-sm font-medium">Página {page + 1} de {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages || loading}>
                Siguiente <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar «{toDelete?.name}»? No se puede deshacer. Si el producto tiene pedidos no se podrá eliminar:
              en ese caso ocúltalo. Si viene de SAP, la próxima sincronización podría volver a crearlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
