"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { useAdmin } from "@/contexts/admin-context"
import { DataIntegrationEditor } from "@/components/admin/integrations/data-integration/editor"

// Gestión de precios: constructor tipo Postman + mapeo + webhook.
// /admin/api-integrations/pricing/new crea; /pricing/<id> edita.
export default function PricingIntegrationPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  useEffect(() => {
    if (!isLoading && !user) router.push("/admin/login")
    else if (user && !["super_admin", "admin"].includes(user.role)) router.push("/admin")
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <AdminLayout title="Gestión de precios">
        <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Gestión de precios">
      <div className="container mx-auto py-6">
        <DataIntegrationEditor key={params?.id} id={String(params?.id ?? "new")} />
      </div>
    </AdminLayout>
  )
}
