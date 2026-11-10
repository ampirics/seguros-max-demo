"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { useAdmin } from "@/contexts/admin-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api-client"
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react"

// Mismas reglas que el backend (password_utils.validate_password_strength + auth.password_policy_error)
const SPECIALS = "!@#$%^&*()_+-=[]{}|;:,.<>?"

function rulesFor(pwd: string, current: string, email: string) {
  const local = (email.split("@")[0] || "").toLowerCase()
  return [
    { ok: pwd.length >= 8, label: "Al menos 8 caracteres" },
    { ok: /[A-Z]/.test(pwd) && /[a-z]/.test(pwd), label: "Mayúsculas y minúsculas" },
    { ok: /\d/.test(pwd), label: "Al menos un número" },
    { ok: [...pwd].some((c) => SPECIALS.includes(c)), label: "Al menos un símbolo (!@#$%…)" },
    { ok: !!pwd && pwd !== current, label: "Distinta de la actual" },
    { ok: local.length < 4 || !pwd.toLowerCase().includes(local), label: "Sin tu usuario de correo" },
  ]
}

function PasswordInput(props: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={props.id}
        type={visible ? "text" : "password"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        autoFocus={props.autoFocus}
        className="pr-10"
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function ChangePasswordPage() {
  const { user } = useAdmin()
  const router = useRouter()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const forced = !!user?.must_change_password
  const rules = rulesFor(next, current, user?.email || "")
  const allOk = rules.every((r) => r.ok)
  const matches = !!next && next === confirm
  const canSubmit = !!current && allOk && matches && !saving

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError("")
    try {
      await apiClient.post("/auth/change-password", { current_password: current, new_password: next })
      // El servidor cerró todas las sesiones, también esta: volver a entrar con la nueva.
      await apiClient.logout()
      try { localStorage.setItem("passwordChanged", "true") } catch { /* sin storage */ }
      router.replace("/admin/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña")
      setSaving(false)
    }
  }

  return (
    <AdminLayout title="Cambiar contraseña">
      <div className="mx-auto max-w-lg space-y-4">
        {forced && (
          <div role="alert" className="flex items-start gap-2.5 rounded-md bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Estás usando una contraseña temporal. Cámbiala para seguir usando el panel.</span>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Cambiar contraseña
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="current">Contraseña actual</Label>
                <PasswordInput id="current" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">Contraseña nueva</Label>
                <PasswordInput id="new" value={next} onChange={setNext} autoComplete="new-password" />
                <ul className="grid gap-1 pt-1 text-xs sm:grid-cols-2">
                  {rules.map((r) => (
                    <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-green-700" : "text-muted-foreground"}`}>
                      {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Repite la contraseña nueva</Label>
                <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
                {confirm && !matches && <p className="text-xs text-destructive">No coincide con la contraseña nueva.</p>}
              </div>

              {error && (
                <p role="alert" className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Al guardar se cierran todas tus sesiones abiertas y vuelves a entrar con la contraseña nueva.
              </p>
              <div className="flex gap-3">
                <Button type="submit" disabled={!canSubmit}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar contraseña
                </Button>
                {!forced && (
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
