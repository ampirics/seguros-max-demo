"use client"

// Conectar el número de WhatsApp de la empresa con el login de Meta
// (registro insertado / Embedded Signup), como lo hace ManyChat.
//
// El login devuelve dos cosas por caminos distintos: el código (callback de
// FB.login, vence a los 30 s) y los ids de la WABA y del número (evento
// `message` WA_EMBEDDED_SIGNUP). Pueden llegar en cualquier orden: cuando
// están las dos, se mandan al backend, que canjea el código con el secreto de
// la app, suscribe la app y registra el número con el PIN.
import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, AlertTriangle, Loader2, PlusCircle, RefreshCw, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import apiClient from "@/lib/api-client"

type Mode = "new" | "existing"

interface SignupConfig {
  enabled: boolean
  app_id: string | null
  config_id: string | null
  graph_version: string
}

export interface ConnectResult {
  integration_id: string
  name: string
  phone_number_id: string
  business_account_id: string
  display_phone_number?: string
  verified_name?: string
  mode?: Mode
  registered: boolean
  registration_error?: string | null
}

interface SessionInfo {
  phone_number_id: string
  waba_id: string
  business_id?: string
}

declare global {
  interface Window {
    FB?: any
    fbAsyncInit?: () => void
  }
}

const BASE = "/admin/whatsapp/embedded-signup"

let sdkPromise: Promise<void> | null = null
function loadSdk(cfg: SignupConfig): Promise<void> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    const init = () => {
      window.FB.init({ appId: cfg.app_id, autoLogAppEvents: true, xfbml: false, version: cfg.graph_version })
      resolve()
    }
    if (window.FB) return init()
    window.fbAsyncInit = init
    const s = document.createElement("script")
    s.src = "https://connect.facebook.net/es_LA/sdk.js"
    s.async = true
    s.defer = true
    s.crossOrigin = "anonymous"
    s.onerror = () => {
      sdkPromise = null
      reject(new Error("No se pudo cargar el login de Meta. Revisa tu conexión o el bloqueador de anuncios."))
    }
    document.body.appendChild(s)
  })
  return sdkPromise
}

const COPY: Record<Mode, { title: string; lead: string; pin: string }> = {
  new: {
    title: "Conectar número nuevo",
    lead: "Para un número que todavía no usa WhatsApp, o uno que liberaste borrando su cuenta de WhatsApp. Meta te pedirá verificarlo con un código por SMS o llamada.",
    pin: "Crea un PIN de 6 dígitos. Protege el número con verificación en dos pasos; guárdalo, Meta lo pide si el número se vuelve a registrar.",
  },
  existing: {
    title: "Conectar número existente",
    lead: "Para un número que ya usa la API de WhatsApp con otro proveedor. Antes de seguir, desactiva la verificación en dos pasos en ese proveedor o ten a mano su PIN.",
    pin: "Si el número ya tiene verificación en dos pasos, escribe ese PIN. Si no, crea uno de 6 dígitos.",
  },
}

export function WhatsAppConnect({
  integrationId,
  config,
  onConnected,
}: {
  integrationId?: string
  config?: Record<string, any>
  onConnected: (r: ConnectResult) => void
}) {
  const { toast } = useToast()
  const [cfg, setCfg] = useState<SignupConfig | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryPin, setRetryPin] = useState("")
  const [retrying, setRetrying] = useState(false)

  const code = useRef<string | null>(null)
  const session = useRef<SessionInfo | null>(null)
  const pending = useRef<{ mode: Mode; pin: string } | null>(null)

  useEffect(() => {
    apiClient.get<SignupConfig>(`${BASE}/config`).then(setCfg).catch(() => setCfg(null))
  }, [])

  const reset = () => {
    code.current = null
    session.current = null
    pending.current = null
  }

  const finish = useCallback(async () => {
    if (!code.current || !session.current || !pending.current) return
    const body = {
      code: code.current,
      waba_id: session.current.waba_id,
      phone_number_id: session.current.phone_number_id,
      business_id: session.current.business_id,
      mode: pending.current.mode,
      pin: pending.current.pin,
      integration_id: integrationId,
    }
    reset()
    try {
      const r = await apiClient.post<ConnectResult>(`${BASE}/connect`, body)
      setMode(null)
      setPin("")
      toast({
        title: r.registered ? "WhatsApp conectado" : "Número conectado, falta registrarlo",
        description: r.registered
          ? `${r.display_phone_number || r.phone_number_id}${r.verified_name ? ` · ${r.verified_name}` : ""}`
          : r.registration_error || "Reintenta el registro con el PIN correcto.",
      })
      onConnected(r)
    } catch (e: any) {
      setError(e?.message || "No se pudo conectar el número.")
    } finally {
      setBusy(false)
    }
  }, [integrationId, onConnected, toast])

  // Datos del número y la WABA que elige el usuario en la ventana de Meta.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      let host = ""
      try {
        host = new URL(event.origin).hostname
      } catch {
        return
      }
      if (!/(^|\.)facebook\.com$/.test(host)) return
      let data: any
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP" || !pending.current) return
      if (data.event === "FINISH" || data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        session.current = data.data
        finish()
      } else if (data.event === "FINISH_ONLY_WABA") {
        setError("Se creó la cuenta de WhatsApp Business pero no se agregó ningún número. Vuelve a intentarlo y agrega el número.")
        setBusy(false)
        reset()
      } else if (data.event === "CANCEL") {
        const step = data.data?.current_step
        setError(data.data?.error_message || (step ? `Se cerró la ventana de Meta en el paso «${step}».` : "Se cerró la ventana de Meta."))
        setBusy(false)
        reset()
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [finish])

  const launch = async () => {
    if (!mode || !cfg?.enabled) return
    if (!/^\d{6}$/.test(pin)) {
      setError("El PIN debe tener exactamente 6 dígitos.")
      return
    }
    setError(null)
    setBusy(true)
    reset()
    pending.current = { mode, pin }
    try {
      await loadSdk(cfg)
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
      return
    }
    window.FB.login(
      (response: any) => {
        const c = response?.authResponse?.code
        if (!c) {
          // Cerró la ventana: si llegó un CANCEL ya se mostró el motivo.
          if (pending.current) {
            setError("No se completó el login de Meta.")
            setBusy(false)
            reset()
          }
          return
        }
        code.current = c
        finish()
      },
      {
        config_id: cfg.config_id,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: "3" },
      },
    )
  }

  const retryRegister = async () => {
    if (!integrationId) return
    if (!/^\d{6}$/.test(retryPin)) {
      toast({ title: "PIN inválido", description: "Debe tener exactamente 6 dígitos.", variant: "destructive" })
      return
    }
    setRetrying(true)
    try {
      const r = await apiClient.post<ConnectResult>(`${BASE}/${integrationId}/register`, { pin: retryPin })
      setRetryPin("")
      toast({ title: "Número registrado", description: r.display_phone_number || r.phone_number_id })
      onConnected(r)
    } catch (e: any) {
      toast({ title: "No se pudo registrar", description: e?.message, variant: "destructive" })
    } finally {
      setRetrying(false)
    }
  }

  const signup = config?.embedded_signup
  const registration = signup?.registration
  const connected = !!(config?.phone_number_id && signup)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-green-600" />
          Conectar con Meta
        </CardTitle>
        <CardDescription>
          Inicia sesión con la cuenta de Facebook de tu negocio y elige el número. No necesitas copiar tokens ni ids.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && (
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              {registration?.status === "registered" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              {config?.display_phone_number || config?.phone_number_id}
              {config?.verified_name && <span className="font-normal text-slate-500">· {config.verified_name}</span>}
            </div>
            {registration?.status === "registered" ? (
              <p className="mt-1 text-xs text-slate-500">Conectado y registrado en la API de WhatsApp.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-amber-700">
                  Conectado, pero falta registrar el número: {registration?.error || "reintenta con el PIN de verificación en dos pasos."}
                </p>
                {integrationId && (
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-32"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="PIN (6 dígitos)"
                      value={retryPin}
                      onChange={(e) => setRetryPin(e.target.value.replace(/\D/g, ""))}
                    />
                    <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={retryRegister}>
                      {retrying ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                      Reintentar registro
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {cfg && !cfg.enabled && (
          <p className="text-xs text-amber-700">
            La conexión con Meta no está configurada en el servidor. Mientras tanto usa la configuración manual de abajo.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {(["new", "existing"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={!cfg?.enabled}
              onClick={() => {
                setMode(m)
                setPin("")
                setError(null)
              }}
              className="rounded-lg border p-4 text-left transition hover:border-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-green-950"
            >
              <div className="flex items-center gap-2 font-medium">
                {m === "new" ? <PlusCircle className="h-4 w-4 text-green-600" /> : <RefreshCw className="h-4 w-4 text-green-600" />}
                {connected ? (m === "new" ? "Cambiar a un número nuevo" : "Cambiar a un número existente") : COPY[m].title}
              </div>
              <p className="mt-1 text-xs text-slate-500">{COPY[m].lead}</p>
            </button>
          ))}
        </div>
      </CardContent>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && !busy && setMode(null)}>
        <DialogContent>
          {mode && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[mode].title}</DialogTitle>
                <DialogDescription>{COPY[mode].lead}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="wa-pin">PIN de verificación en dos pasos</Label>
                <Input
                  id="wa-pin"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="6 dígitos"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                />
                <p className="text-xs text-slate-500">{COPY[mode].pin}</p>
                {connected && (
                  <p className="text-xs text-amber-700">
                    El número conectado ahora ({config?.display_phone_number || config?.phone_number_id}) se reemplaza por el que elijas.
                  </p>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setMode(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={busy || pin.length !== 6} onClick={launch} className="bg-[#1877F2] hover:bg-[#166fe0]">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {busy ? "Esperando a Meta…" : "Continuar con Facebook"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
