"use client"

import { useEffect, useState } from "react"
import { Ban, Car } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"
import { cn, formatCurrency, nombrePieza } from "@/lib/utils"
import type { PerfilDelCliente } from "@/lib/api/perfil"
import { FichaVehiculoCliente } from "@/components/admin/customers/FichaVehiculoCliente"

export type { PerfilDelCliente }

export const NIVEL = {
  alto: "bg-success-soft text-success",
  medio: "bg-warning-soft text-warning",
  bajo: "bg-secondary text-muted-foreground",
} as const

export function usePerfil(ruta: string | null, recarga?: string) {
  const [perfil, setPerfil] = useState<PerfilDelCliente | null>(null)
  const [cargado, setCargado] = useState(false)
  useEffect(() => {
    if (!ruta) return
    let vigente = true
    setCargado(false)
    apiClient
      .get<PerfilDelCliente | null>(ruta)
      .then((p) => { if (vigente) setPerfil(p?.cliente ? p : null) })
      .catch(() => { if (vigente) setPerfil(null) })
      .finally(() => { if (vigente) setCargado(true) })
    return () => { vigente = false }
  }, [ruta, recarga])
  return { perfil, cargado }
}

export function PerfilCliente({ perfil, compacto = false }: { perfil: PerfilDelCliente; compacto?: boolean }) {
  const { interes, senales } = perfil
  const proxima = perfil.citas.find((c) => c.proxima)
  const activos = perfil.vehiculos.filter((v) => (v.estado ?? "activo") === "activo")
  const [ficha, setFicha] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium">{perfil.cliente.nombre}</p>
        <span className={cn("shrink-0 rounded-control px-2 py-0.5 text-xs font-medium", NIVEL[interes.nivel])}>
          Interés {interes.nivel}
        </span>
      </div>
      <p className="-mt-1.5 text-xs text-muted-foreground">{interes.motivo}</p>
      {perfil.cliente.bloqueado && (
        <p className="flex items-start gap-1.5 rounded-control bg-destructive-soft px-2 py-1.5 text-xs text-destructive">
          <Ban className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> Bloqueado{perfil.cliente.bloqueo_motivo ? `: ${perfil.cliente.bloqueo_motivo}` : ""}
        </p>
      )}
      {senales && (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-control bg-secondary/60 px-2 py-1.5">
            <dt className="text-muted-foreground">Total comprado</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(senales.total_comprado_dop)}{senales.compras ? ` · ${senales.compras}` : ""}</dd>
          </div>
          <div className="rounded-control bg-secondary/60 px-2 py-1.5" title={senales.riesgo.motivo}>
            <dt className="text-muted-foreground">Riesgo</dt>
            <dd className={cn("font-medium capitalize", senales.riesgo.nivel === "alto" ? "text-destructive" : senales.riesgo.nivel === "medio" ? "text-warning" : "text-success")}>
              {senales.riesgo.nivel}
            </dd>
          </div>
        </dl>
      )}

      {activos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {activos.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => setFicha(v.id)} aria-label={`Ver la ficha de ${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}`}
                className="inline-flex items-center gap-1 rounded-control bg-secondary px-2 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Car className="h-3 w-3 text-muted-foreground" aria-hidden />
                {v.marca} {v.modelo}{v.anio ? ` ${v.anio}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}

      {perfil.piezas_consultadas.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Piezas que vio</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {perfil.piezas_consultadas.slice(0, compacto ? 3 : 10).map((p) => (
              <li key={p.id} className="flex justify-between gap-2 text-xs">
                <span className="truncate">{nombrePieza(p.nombre)}</span>
                {p.precio_dop != null && <span className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(p.precio_dop)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-control bg-secondary/60 py-1.5">
          <dt className="text-muted-foreground">Cotizaciones</dt>
          <dd className="font-medium tabular-nums">{perfil.cotizaciones.length}</dd>
        </div>
        <div className="rounded-control bg-secondary/60 py-1.5">
          <dt className="text-muted-foreground">Citas</dt>
          <dd className="font-medium tabular-nums">{perfil.citas.length}</dd>
        </div>
        <div className="rounded-control bg-secondary/60 py-1.5">
          <dt className="text-muted-foreground">Mensajes</dt>
          <dd className="font-medium tabular-nums">{perfil.mensajes_del_cliente}</dd>
        </div>
      </dl>

      {proxima && (
        <div className="text-xs">
          <Badge variant="secondary" className="mr-1.5">Próxima {proxima.tipo}</Badge>
          {new Date(proxima.inicio).toLocaleString("es-DO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </div>
      )}
      {!compacto && perfil.ultimo_mensaje && (
        <p className="text-xs text-muted-foreground">Último mensaje: “{perfil.ultimo_mensaje}”</p>
      )}
      <FichaVehiculoCliente clienteId={perfil.cliente.id} vehiculo={activos.find((v) => v.id === ficha) ?? null} onCerrar={() => setFicha(null)} />
    </div>
  )
}
