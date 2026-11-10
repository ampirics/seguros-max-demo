"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save } from "lucide-react"
import apiClient from "@/lib/api-client"

// Rango del PIN de retiro, que llega a SAP como TrackingNumber en «Orden al
// pagar». Se guarda aparte de las reglas (tiene su propio botón): el PIN lo
// genera el backend al confirmar el pago, no el Lambda.
const API = "/sap-config/document-rules/pickup-pin"

interface PinRange { pickup_pin_min: number; pickup_pin_max: number }

function validate(minText: string, maxText: string): { values?: PinRange; error?: string } {
  const entero = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
  const min = entero(minText)
  const max = entero(maxText)
  if (!Number.isFinite(min) || min < 1 || min > 99999999) return { error: "«Desde» debe ser un número entre 1 y 99999999." }
  if (!Number.isFinite(max) || max < 1 || max > 99999999) return { error: "«Hasta» debe ser un número entre 1 y 99999999." }
  if (max - min < 999)
    return { error: "El rango debe permitir al menos 1000 valores (Hasta − Desde ≥ 999), para que el PIN no sea fácil de adivinar." }
  return { values: { pickup_pin_min: min, pickup_pin_max: max } }
}

export function PickupPinRangeCard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<PinRange | null>(null)
  const [minText, setMinText] = useState("1000")
  const [maxText, setMaxText] = useState("9999")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<PinRange>(API)
      .then((r) => {
        if (cancelled) return
        setSaved(r)
        setMinText(String(r.pickup_pin_min))
        setMaxText(String(r.pickup_pin_max))
      })
      .catch((e: any) => !cancelled && setError(e?.message || "No se pudo cargar el rango del PIN"))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const dirty = saved != null && (minText !== String(saved.pickup_pin_min) || maxText !== String(saved.pickup_pin_max))

  const save = async () => {
    const { values, error: err } = validate(minText, maxText)
    if (!values) { setError(err || null); return }
    setSaving(true)
    try {
      const r = await apiClient.put<PinRange>(API, values)
      setSaved(r)
      setMinText(String(r.pickup_pin_min))
      setMaxText(String(r.pickup_pin_max))
      toast({ title: "Rango del PIN guardado" })
    } catch (e: any) {
      const msg = typeof e?.message === "string" && e.message !== "[object Object]" ? e.message : "Revisa los valores e inténtalo de nuevo."
      setError(msg)
      toast({ title: "No se pudo guardar el rango del PIN", description: msg, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">PIN de retiro (TrackingNumber)</CardTitle>
        <CardDescription>
          Código que recibe el cliente para retirar su pedido y que se envía a SAP como TrackingNumber.
          Sale al azar dentro de este rango —no es consecutivo, para que nadie pueda deducir el de otro cliente—.
          Aplica a los pedidos nuevos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="pin_min" className="text-xs text-muted-foreground">Desde</Label>
              <Input id="pin_min" type="number" min={1} className="w-32" value={minText}
                onChange={(e) => { setMinText(e.target.value); setError(null) }} />
            </div>
            <div>
              <Label htmlFor="pin_max" className="text-xs text-muted-foreground">Hasta</Label>
              <Input id="pin_max" type="number" min={1} className="w-32" value={maxText}
                onChange={(e) => { setMaxText(e.target.value); setError(null) }} />
            </div>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar rango
            </Button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive mt-2">{error}</p>}
      </CardContent>
    </Card>
  )
}
