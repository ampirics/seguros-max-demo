"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/contexts/admin-context"
import { DIA } from "@/lib/seguros/catalogo"
import { segurosApi, type Accion } from "@/lib/seguros/cliente"
import type { Poliza } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"

export function useQuien() {
  const { user } = useAdmin()
  return user?.name || user?.email || "Equipo MAX"
}

export function useAccion() {
  const quien = useQuien()
  const [ocupado, setOcupado] = useState<string | null>(null)
  async function correr(clave: string, a: Accion, exito?: string) {
    setOcupado(clave)
    try {
      const r = await segurosApi.accion({ ...a, quien } as Accion)
      if (exito) toast.success(exito)
      return r
    } catch (e) {
      toast.error((e as Error).message)
      return null
    } finally {
      setOcupado(null)
    }
  }
  return { correr, ocupado }
}

export const activa = (p: Poliza) => p.estado === "vigente" || p.estado === "por_renovar"
export const diasPara = (ts: number, ahora: number) => Math.ceil((ts - ahora) / DIA)

export function Dato({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  )
}

export function Barra({ valor, className, tono = "primary" }: { valor: number; className?: string; tono?: "primary" | "success" | "warning" }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className={cn("h-full rounded-full transition-all", tono === "success" ? "bg-success" : tono === "warning" ? "bg-warning" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, valor * 100))}%` }}
      />
    </div>
  )
}

export function NotaForm({ destino }: { destino: { polizaId?: string; siniestroId?: string } }) {
  const [texto, setTexto] = useState("")
  const { correr, ocupado } = useAccion()
  async function guardar() {
    if (!texto.trim()) return
    const r = await correr("nota", { tipo: "nota", ...destino, texto: texto.trim() }, "Nota guardada")
    if (r) setTexto("")
  }
  return (
    <div className="flex flex-col gap-2">
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escriba una nota para el equipo" rows={3} aria-label="Nota" />
      <Button size="sm" className="self-end" onClick={guardar} disabled={!texto.trim() || !!ocupado}>
        Guardar nota
      </Button>
    </div>
  )
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-secondary" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  )
}
