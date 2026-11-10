"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { FilaNotificacion, TIPO_NOTIF, TIPO_NOTIF_RESTAURANTE, destino, useNotificaciones } from "@/components/admin/notificaciones/Notificaciones"
import { useVertical } from "@/lib/vertical"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { Notificacion, TipoNotificacion } from "@/lib/api-types"
import { cn } from "@/lib/utils"

export default function NotificacionesPage() {
  const router = useRouter()
  const restaurante = useVertical() === "restaurante"
  const tipos = restaurante ? TIPO_NOTIF_RESTAURANTE : TIPO_NOTIF
  const [tipo, setTipo] = useState<TipoNotificacion | null>(null)
  const [soloNoLeidas, setSoloNoLeidas] = useState(false)
  const { datos, error, cargar, marcar, marcarTodas } = useNotificaciones({
    tipo: tipo ?? undefined,
    solo_no_leidas: soloNoLeidas ? "true" : undefined,
    limit: "100",
  })

  const abrir = (n: Notificacion) => {
    marcar(n.id)
    router.push(destino(n))
  }

  return (
    <AdminLayout title="Notificaciones">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {restaurante
              ? "Reservas nuevas, clientes que esperan al equipo, reservas sin confirmar, lista de espera, platos pasados de tiempo y llamados de las mesas."
              : "Avisos de leads nuevos, mensajes sin responder, piezas sin existencia, SLA y citas próximas."}
          </p>
          <div className="flex shrink-0 items-center gap-4">
            <Label htmlFor="solo-no-leidas" className="flex cursor-pointer items-center gap-2 text-sm font-normal">
              <Switch id="solo-no-leidas" checked={soloNoLeidas} onCheckedChange={setSoloNoLeidas} /> Solo sin leer
            </Label>
            <Button variant="outline" size="sm" onClick={marcarTodas} disabled={!datos?.no_leidas}>Marcar todas como leídas</Button>
          </div>
        </div>

        <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Tipo de aviso">
          {([[null, "Todas"], ...Object.entries(tipos).map(([k, v]) => [k, v.label])] as [TipoNotificacion | null, string][]).map(([valor, label]) => (
            <button key={label} type="button" aria-pressed={tipo === valor} onClick={() => setTipo(valor)}
              className={cn("h-8 shrink-0 rounded-control px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tipo === valor ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-medium">No se pudieron cargar las notificaciones</p>
            <Button variant="outline" onClick={cargar}>Reintentar</Button>
          </CardContent></Card>
        ) : !datos ? (
          <Card className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</Card>
        ) : datos.items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <p className="font-medium">Nada pendiente</p>
            <p className="mt-1 text-sm text-muted-foreground">{restaurante ? "Cuando entre una reserva o algo del servicio necesite atención, aparece aquí." : "Cuando entre un lead o algo necesite atención, aparece aquí."}</p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">{datos.items.map((n) => <li key={n.id}><FilaNotificacion n={n} onAbrir={abrir} /></li>)}</ul>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
