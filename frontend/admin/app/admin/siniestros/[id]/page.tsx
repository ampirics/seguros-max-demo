"use client"

import { useParams } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { FichaSiniestro } from "@/components/seguros/siniestros/ficha"

export default function SiniestroPage() {
  const id = useParams<{ id: string }>()?.id ?? ""
  return (
    <AdminLayout title="Siniestro">
      <FichaSiniestro id={id} />
    </AdminLayout>
  )
}
