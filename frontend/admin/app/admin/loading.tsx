"use client"

import { Loader2 } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"

// Mientras carga una sección el menú sigue en su lugar; solo el contenido espera.
export default function Cargando() {
  return (
    <AdminLayout title="">
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando" />
      </div>
    </AdminLayout>
  )
}
