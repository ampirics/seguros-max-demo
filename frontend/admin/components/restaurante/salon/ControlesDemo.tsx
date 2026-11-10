"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { conError, restauranteApi } from "@/lib/restaurante/cliente"
import type { Estado } from "@/lib/restaurante/tipos"

const avisar = (m: string) => toast.error(m)

export function ControlesDemo({ estado }: { estado: Estado }) {
  const c = estado.config
  const [confirmar, setConfirmar] = useState(false)
  const config = (cambio: Partial<Estado["config"]>) => conError(() => restauranteApi.accion({ tipo: "config", config: cambio }), avisar)
  return (
    <section className="rounded-xl border bg-card px-4 py-3">
      <h3 className="text-sm font-semibold">Simulación del servicio</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Con el piloto encendido los clientes llegan, piden, comen y pagan solos. Lo que hagas desde Órdenes, Cocina, el QR o la bandeja se mezcla en vivo.
      </p>
      <div className="mt-3 grid gap-2.5">
        {(
          [
            ["piloto", "Piloto automático"],
            ["cocinaAuto", "La cocina avanza sola"],
            ["iaActiva", "La IA responde los chats"],
          ] as const
        ).map(([clave, texto]) => (
          <div key={clave} className="flex items-center justify-between gap-3">
            <Label htmlFor={`demo-${clave}`} className="text-sm font-normal">{texto}</Label>
            <Switch id={`demo-${clave}`} checked={c[clave]} onCheckedChange={(v) => config({ [clave]: v })} />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Velocidad</span>
          <div className="flex gap-1">
            {[1, 2, 4].map((v) => (
              <Button key={v} size="sm" variant={c.velocidad === v ? "default" : "outline"} className="h-7 px-2.5" onClick={() => config({ velocidad: v })}>
                {v}×
              </Button>
            ))}
          </div>
        </div>
        {confirmar ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
            <span>¿Reiniciar el servicio con los datos de demostración?</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmar(false)}>No</Button>
              <Button size="sm" className="h-7" onClick={() => { setConfirmar(false); conError(() => restauranteApi.accion({ tipo: "reiniciar" }), avisar).then(() => toast.success("Servicio reiniciado")) }}>Reiniciar</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirmar(true)}>Reiniciar la demostración</Button>
        )}
      </div>
    </section>
  )
}
