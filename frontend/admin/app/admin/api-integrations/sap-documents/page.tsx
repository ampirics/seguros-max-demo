"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { useAdmin } from "@/contexts/admin-context"
import { SapDocumentsEditor } from "@/components/admin/integrations/sap-documents/editor"

// Documentos SAP: campos (incluidos U_) que la integración agrega, cambia u omite en cada documento.
export default function SapDocumentsPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) router.push("/admin/login")
    else if (user && !["super_admin", "admin"].includes(user.role)) router.push("/admin")
  }, [user, isLoading, router])

  return (
    <AdminLayout title="Documentos SAP">
      <div className="container mx-auto py-6">
        {isLoading || !user
          ? <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
          : <SapDocumentsEditor />}
      </div>
    </AdminLayout>
  )
}
