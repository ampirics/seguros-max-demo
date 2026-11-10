"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Percent, Ticket, Package, Tag, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api-client"

// Antes esta página mostraba datos de ejemplo escritos en el código (cupones,
// "Electrónicos", "Ahorro Total RD$ 12,450") y un widget de Conversaciones
// dentro de las tarjetas. Ahora lee la API real de descuentos de la empresa
// activa (/admin/discounts). Solo lectura: el alta/edición desde la interfaz
// aún no existe, así que no se muestran botones que no hacen nada.

type DiscountType = "percentage" | "fixed_amount" | "buy_x_get_y" | "volume_discount" | string

interface Coupon {
  id: string
  code: string
  name: string
  discount_type: DiscountType
  discount_value: number
  status: string
  times_used: number
  usage_limit?: number | null
  start_date?: string | null
  end_date?: string | null
  is_valid?: boolean
}

interface ProductDiscount {
  id: string
  product_id: string
  name: string
  discount_type: DiscountType
  discount_value: number
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  is_valid?: boolean
}

interface CategoryDiscount {
  id: string
  category_code: string
  category_name: string
  name: string
  discount_type: DiscountType
  discount_value: number
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  is_valid?: boolean
}

interface Statistics {
  coupons: { total: number; active: number; usage_rate: number }
  product_discounts: { total: number; active: number }
  category_discounts: { total: number; active: number }
}

const fecha = (v?: string | null) => (v ? new Date(v).toLocaleDateString("es-DO") : "—")

const vigencia = (inicio?: string | null, fin?: string | null) =>
  !inicio && !fin ? "Sin límite" : `${fecha(inicio)} – ${fecha(fin)}`

const textoDescuento = (type: DiscountType, value: number) => {
  switch (type) {
    case "percentage":
      return `${value}%`
    case "fixed_amount":
      return `RD$ ${value.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
    case "buy_x_get_y":
      return "Compra X lleva Y"
    case "volume_discount":
      return `${value}% por volumen`
    default:
      return String(value)
  }
}

const badgeEstado = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800">Activo</Badge>
    case "inactive":
      return <Badge variant="secondary">Inactivo</Badge>
    case "expired":
      return <Badge variant="destructive">Expirado</Badge>
    case "used_up":
      return <Badge variant="outline">Agotado</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

const badgeActivo = (activo: boolean, valido?: boolean) =>
  activo && valido !== false ? (
    <Badge className="bg-green-100 text-green-800">Activo</Badge>
  ) : activo ? (
    <Badge variant="outline">Fuera de vigencia</Badge>
  ) : (
    <Badge variant="secondary">Inactivo</Badge>
  )

function Vacio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{texto}</p>
}

export default function DiscountsPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("coupons")
  const [stats, setStats] = useState<Statistics | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscount[]>([])
  const [categoryDiscounts, setCategoryDiscounts] = useState<CategoryDiscount[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [s, c, p, k] = await Promise.all([
        apiClient.request<Statistics>("/admin/discounts/statistics"),
        apiClient.request<Coupon[]>("/admin/discounts/coupons"),
        apiClient.request<ProductDiscount[]>("/admin/discounts/products/discounts"),
        apiClient.request<CategoryDiscount[]>("/admin/discounts/categories/discounts"),
      ])
      setStats(s)
      setCoupons(Array.isArray(c) ? c : [])
      setProductDiscounts(Array.isArray(p) ? p : [])
      setCategoryDiscounts(Array.isArray(k) ? k : [])
    } catch (e) {
      console.error("Error cargando descuentos:", e)
      setError("No se pudieron cargar los descuentos. Intenta de nuevo.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (user) cargar()
  }, [user, cargar])

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return null
  }

  const tarjetas = [
    {
      titulo: "Cupones activos",
      icono: Ticket,
      valor: stats?.coupons.active ?? 0,
      detalle: `${stats?.coupons.total ?? 0} en total · ${stats?.coupons.usage_rate ?? 0} usos`,
    },
    {
      titulo: "Descuentos por producto",
      icono: Package,
      valor: stats?.product_discounts.active ?? 0,
      detalle: `${stats?.product_discounts.total ?? 0} en total`,
    },
    {
      titulo: "Descuentos por categoría",
      icono: Tag,
      valor: stats?.category_discounts.active ?? 0,
      detalle: `${stats?.category_discounts.total ?? 0} en total`,
    },
  ]

  return (
    <AdminLayout title="Gestión de Descuentos">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Percent className="h-6 w-6" /> Descuentos
            </h1>
            <p className="text-sm text-muted-foreground">
              Cupones y descuentos vigentes de la empresa activa.
            </p>
          </div>
          <Button variant="outline" onClick={cargar} disabled={cargando}>
            <RefreshCw className={`h-4 w-4 mr-2 ${cargando ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tarjetas.map(({ titulo, icono: Icono, valor, detalle }) => (
            <Card key={titulo}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
                <Icono className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cargando && !stats ? "…" : valor}</div>
                <p className="text-xs text-muted-foreground">{detalle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Estos descuentos (cupones, por producto, por categoría) no los usa
            todavía ningún flujo de cobro: tienda, bot y órdenes solo aplican la
            oferta configurada en cada producto. Decirlo evita prometer rebajas
            que el cliente no recibe. */}
        <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Estos descuentos todavía no se aplican al cobrar.</p>
          <p className="mt-1">
            Hoy la tienda, el bot y las órdenes solo aplican la <strong>oferta de cada producto</strong>
            (Productos → editar → «En oferta»). Los cupones y reglas de esta pantalla quedan registrados
            pero no rebajan el precio.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="coupons">Cupones ({coupons.length})</TabsTrigger>
            <TabsTrigger value="products">Productos ({productDiscounts.length})</TabsTrigger>
            <TabsTrigger value="categories">Categorías ({categoryDiscounts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="coupons">
            <Card>
              <CardHeader>
                <CardTitle>Cupones de descuento</CardTitle>
                <CardDescription>Códigos de cupón (aún no se pueden canjear al comprar).</CardDescription>
              </CardHeader>
              <CardContent>
                {coupons.length === 0 ? (
                  <Vacio texto={cargando ? "Cargando…" : "No hay cupones para esta empresa."} />
                ) : (
                  <div className="divide-y">
                    {coupons.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{c.code}</span>
                            {badgeEstado(c.status)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{c.name}</p>
                        </div>
                        <div className="text-sm text-right">
                          <div className="font-semibold">{textoDescuento(c.discount_type, c.discount_value)}</div>
                          <div className="text-muted-foreground">
                            {c.times_used}
                            {c.usage_limit ? ` / ${c.usage_limit}` : ""} usos · {vigencia(c.start_date, c.end_date)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Descuentos por producto</CardTitle>
                <CardDescription>Reglas por producto (aún no se aplican al cobrar).</CardDescription>
              </CardHeader>
              <CardContent>
                {productDiscounts.length === 0 ? (
                  <Vacio texto={cargando ? "Cargando…" : "No hay descuentos por producto."} />
                ) : (
                  <div className="divide-y">
                    {productDiscounts.map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{d.name}</span>
                            {badgeActivo(d.is_active, d.is_valid)}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate">Producto {d.product_id}</p>
                        </div>
                        <div className="text-sm text-right">
                          <div className="font-semibold">{textoDescuento(d.discount_type, d.discount_value)}</div>
                          <div className="text-muted-foreground">{vigencia(d.start_date, d.end_date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Descuentos por categoría</CardTitle>
                <CardDescription>Reglas por categoría (aún no se aplican al cobrar).</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryDiscounts.length === 0 ? (
                  <Vacio texto={cargando ? "Cargando…" : "No hay descuentos por categoría."} />
                ) : (
                  <div className="divide-y">
                    {categoryDiscounts.map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{d.name}</span>
                            {badgeActivo(d.is_active, d.is_valid)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {d.category_name} ({d.category_code})
                          </p>
                        </div>
                        <div className="text-sm text-right">
                          <div className="font-semibold">{textoDescuento(d.discount_type, d.discount_value)}</div>
                          <div className="text-muted-foreground">{vigencia(d.start_date, d.end_date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
