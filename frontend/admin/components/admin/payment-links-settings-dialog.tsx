"use client"

import { type ChangeEvent, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Settings } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { useAdmin } from "@/contexts/admin-context"

interface PaymentLinkSettings {
  expiration_minutes: number
  reminder_minutes: number
  auto_cancel_expired: boolean
  bank_validation_minutes: number
}

const DEFAULTS: PaymentLinkSettings = {
  expiration_minutes: 60,
  reminder_minutes: 30,
  auto_cancel_expired: true,
  bank_validation_minutes: 30,
}

type NumericField = "expiration_minutes" | "reminder_minutes" | "bank_validation_minutes"

// Los campos numéricos se editan como texto: si se convirtieran a número en
// cada tecla, borrar el valor para escribir otro lo devolvía al default al
// instante y lo tecleado se pegaba detrás ("30" -> "3045"), fuera de rango.
type Draft = Record<NumericField, string> & { auto_cancel_expired: boolean }

const toDraft = (s: PaymentLinkSettings): Draft => ({
  expiration_minutes: String(s.expiration_minutes),
  reminder_minutes: String(s.reminder_minutes),
  bank_validation_minutes: String(s.bank_validation_minutes ?? DEFAULTS.bank_validation_minutes),
  auto_cancel_expired: s.auto_cancel_expired,
})

// Mismas reglas que el backend (PaymentLinkSettingsSchema), para avisar antes
// de enviar y con un mensaje entendible.
function validate(d: Draft): { values?: PaymentLinkSettings; error?: string } {
  const entero = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
  const expiration = entero(d.expiration_minutes)
  const reminder = entero(d.reminder_minutes)
  const bank = entero(d.bank_validation_minutes)
  if (!Number.isFinite(expiration) || expiration < 1 || expiration > 43200)
    return { error: "Minutos hasta que vence: escribe un número entre 1 y 43200." }
  if (!Number.isFinite(reminder) || reminder < 0 || reminder > 43200)
    return { error: "Minutos hasta el aviso: escribe un número entre 0 y 43200." }
  if (reminder >= expiration)
    return { error: "El aviso de pago debe enviarse antes de que el enlace venza." }
  if (!Number.isFinite(bank) || bank < 4 || bank > 1440)
    return { error: "Minutos de espera de aprobación bancaria: escribe un número entre 4 y 1440." }
  return {
    values: {
      expiration_minutes: expiration,
      reminder_minutes: reminder,
      bank_validation_minutes: bank,
      auto_cancel_expired: d.auto_cancel_expired,
    },
  }
}

// FastAPI devuelve los 422 como lista de objetos; sin esto el aviso mostraba
// "[object Object]".
function errorMessage(error: any): string {
  const msg = error?.message
  if (typeof msg === "string" && msg && msg !== "[object Object]") return msg
  return "Revisa los valores e inténtalo de nuevo."
}

/**
 * Configuración de expiración/recordatorios de payment links.
 *
 * Antes vivía dentro del wizard de integración SAP (sin relación real con
 * SAP) y cualquier admin con acceso a integraciones podía tocarla. Ahora es
 * su propio privilegio en el backend (payment_links:view/edit,
 * GET/PUT /api/v1/admin/payment-links/settings) — la UI solo se muestra
 * para admin/super_admin, y el backend es quien realmente lo hace cumplir.
 */
export function PaymentLinksSettingsDialog() {
  const { user } = useAdmin()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULTS))
  const [formError, setFormError] = useState<string | null>(null)

  const canManage = user?.role === "admin" || user?.role === "super_admin"

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setFormError(null)
    apiClient
      .get<PaymentLinkSettings>("/admin/payment-links/settings")
      .then((data) => {
        if (!cancelled) setDraft(toDraft({ ...DEFAULTS, ...data }))
      })
      .catch((error: any) => {
        toast({ title: "Error cargando configuración", description: error?.message, variant: "destructive" })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!canManage) return null

  const setField = (field: NumericField) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDraft((d) => ({ ...d, [field]: value }))
    setFormError(null)
  }

  const handleSave = async () => {
    const { values, error } = validate(draft)
    if (!values) {
      setFormError(error || null)
      return
    }
    setSaving(true)
    try {
      const result = await apiClient.put<PaymentLinkSettings>("/admin/payment-links/settings", values)
      setDraft(toDraft({ ...DEFAULTS, ...result }))
      toast({ title: "Configuración guardada" })
      setOpen(false)
    } catch (error: any) {
      const message = errorMessage(error)
      setFormError(message)
      toast({ title: "Error guardando configuración", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="bg-card"
        onClick={() => setOpen(true)}
        title="Configuración de links de pago"
        aria-label="Configuración de links de pago"
      >
        <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuración de links de pago</DialogTitle>
            <DialogDescription>
              Expiración y recordatorios automáticos. Se aplica cada 5 minutos vía el proceso de sincronización.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="expiration_minutes">Minutos hasta que vence</Label>
                <Input
                  id="expiration_minutes"
                  type="number"
                  min={1}
                  value={draft.expiration_minutes}
                  onChange={setField("expiration_minutes")}
                />
                <p className="text-xs text-muted-foreground mt-1">Minutos desde que se crea el enlace hasta que vence.</p>
              </div>

              <div>
                <Label htmlFor="reminder_minutes">Minutos hasta el aviso de pago</Label>
                <Input
                  id="reminder_minutes"
                  type="number"
                  min={0}
                  value={draft.reminder_minutes}
                  onChange={setField("reminder_minutes")}
                />
                <p className="text-xs text-muted-foreground mt-1">Minutos desde que se crea el enlace para enviar el aviso de pago por WhatsApp (0 = sin aviso). Debe ser menor que el vencimiento.</p>
              </div>

              <div>
                <Label htmlFor="bank_validation_minutes">Minutos de espera de aprobación bancaria</Label>
                <Input
                  id="bank_validation_minutes"
                  type="number"
                  min={4}
                  max={1440}
                  value={draft.bank_validation_minutes}
                  onChange={setField("bank_validation_minutes")}
                />
                <p className="text-xs text-muted-foreground mt-1">Cuando un pago queda sometido a aprobación del banco (BHD empresarial), se consulta cada 2 minutos durante este tiempo, contado desde que el cliente pagó. Mientras tanto el enlace no se puede volver a pagar. Entre 4 y 1440.</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <Label htmlFor="auto_cancel_expired" className="text-sm font-medium">Cancelación automática</Label>
                  <p className="text-xs text-muted-foreground">Cancelar la orden cuando el enlace vence sin pago.</p>
                </div>
                <Switch
                  id="auto_cancel_expired"
                  checked={draft.auto_cancel_expired}
                  onCheckedChange={(checked) => setDraft((d) => ({ ...d, auto_cancel_expired: checked }))}
                />
              </div>

              {formError && (
                <p role="alert" className="text-sm text-destructive">{formError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
