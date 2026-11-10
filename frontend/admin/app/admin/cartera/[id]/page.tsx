"use client"

import { useParams } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { FichaPoliza } from "@/components/seguros/cartera/ficha"

export default function PolizaPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <AdminLayout title="Póliza">
      <FichaPoliza id={id} />
    </AdminLayout>
  )
}
