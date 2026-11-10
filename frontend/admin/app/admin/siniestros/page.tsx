"use client"

import { useMemo } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Cargando } from "@/components/seguros/cartera/util"
import { TableroSiniestros } from "@/components/seguros/siniestros/tablero"
import { useSeguros } from "@/lib/seguros/cliente"
import type { Cliente } from "@/lib/seguros/tipos"

export default function SiniestrosPage() {
  const { estado, ahora } = useSeguros()
  const clientes = useMemo(() => new Map<string, Cliente>((estado?.clientes ?? []).map((c) => [c.id, c])), [estado?.clientes])
  return (
    <AdminLayout title="Siniestros">
      {estado ? <TableroSiniestros siniestros={estado.siniestros} clientes={clientes} ahora={ahora} /> : <Cargando texto="Cargando los siniestros…" />}
    </AdminLayout>
  )
}
