"use client"

import { useMarca } from "@/contexts/marca-context"
import { cn } from "@/lib/utils"

// Logo y nombre del cliente (frontend/marca o pantalla Marca). Sin nombre, el logo lleva el texto alternativo.
export function Logo({ className, conNombre = true }: { className?: string; conNombre?: boolean }) {
  const { marca } = useMarca()
  const nombre = conNombre && !marca.logoConNombre
  const clase = cn(marca.logoConNombre ? "h-10" : "h-7", "w-auto shrink-0", className)
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img src={marca.logo} alt={nombre ? "" : marca.nombre} className={cn(clase, marca.logoOscuro && "dark:hidden")} />
      {marca.logoOscuro && <img src={marca.logoOscuro} alt={nombre ? "" : marca.nombre} className={cn(clase, "hidden dark:block")} />}
      {nombre && <span className="truncate font-display text-lg font-semibold">{marca.nombre}</span>}
    </span>
  )
}
