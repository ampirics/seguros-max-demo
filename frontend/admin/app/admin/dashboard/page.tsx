"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Actividad } from "@/components/admin/asistente/Actividad"
import { Copiloto } from "@/components/admin/asistente/Copiloto"
import { cn } from "@/lib/utils"

const PESTANAS = [
  { clave: "actividad", label: "Actividad" },
  { clave: "preguntar", label: "Preguntar" },
] as const

export default function AsistentePage() {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]["clave"]>("actividad")
  return (
    <AdminLayout title="Asistente IA">
      <div className="space-y-4">
        <div role="tablist" aria-label="Asistente IA" className="flex gap-1 border-b">
          {PESTANAS.map((p) => (
            <button key={p.clave} type="button" role="tab" aria-selected={pestana === p.clave} onClick={() => setPestana(p.clave)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pestana === p.clave ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {p.label}
            </button>
          ))}
        </div>
        {pestana === "actividad" ? <Actividad /> : <Copiloto />}
      </div>
    </AdminLayout>
  )
}
