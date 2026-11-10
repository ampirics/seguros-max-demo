"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import {
  ArrowLeft, Send, Save, Loader2, Play, Eye, Copy, KeyRound, Webhook, History, MousePointerClick, X, AlertTriangle,
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { buildApiUrl } from "@/lib/config"
import {
  ApplyResult, DataIntegration, DataIntegrationConfig, FieldMapping, SECRET_MASK, SendResult, SyncLog, TargetDef,
  TRANSFORM_PRESETS, buildTransform, emptyConfig, firstRecord, getPath, leafPaths, parseTransform,
  previewTransform, recordCount, relativeToRecord,
} from "@/lib/data-integrations"
import { JsonTree } from "./json-tree"
import { KvTable } from "./kv-table"

const API = "/admin/data-integrations"
const METHODS = ["GET", "POST", "PUT", "PATCH"] as const

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("es-DO") : "—")
const fmtVal = (v: unknown) =>
  v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "Sí" : "No")
    : typeof v === "number" ? v.toLocaleString("es-DO", { maximumFractionDigits: 2 }) : String(v)
const FIELD_LABEL: Record<string, string> = {
  price: "Precio", original_price: "Precio anterior", active: "Disponible", is_visible: "Visible",
}

function statusColor(code: number) {
  if (code < 300) return "bg-green-100 text-green-800"
  if (code < 400) return "bg-blue-100 text-blue-800"
  if (code < 500) return "bg-amber-100 text-amber-800"
  return "bg-red-100 text-red-800"
}

function copy(text: string, toast: ReturnType<typeof useToast>["toast"], what = "Copiado") {
  navigator.clipboard?.writeText(text).then(
    () => toast({ title: what }),
    () => toast({ title: "No se pudo copiar", variant: "destructive" }),
  )
}

export function DataIntegrationEditor({ id }: { id: string }) {
  const isNew = id === "new"
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(!isNew)
  const [name, setName] = useState("Gestión de precios")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [cfg, setCfg] = useState<DataIntegrationConfig>(emptyConfig())
  const [targets, setTargets] = useState<Record<string, TargetDef>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<SendResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pickingFor, setPickingFor] = useState<string | null>(null)

  const [previewing, setPreviewing] = useState(false)
  const [result, setResult] = useState<ApplyResult | null>(null)
  const [confirmRun, setConfirmRun] = useState(false)
  const [running, setRunning] = useState(false)

  const [sample, setSample] = useState("")
  const [newKeys, setNewKeys] = useState<{ key: string; hmac_secret: string } | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [logs, setLogs] = useState<SyncLog[]>([])

  const target = targets[cfg.target]
  const update = (patch: Partial<DataIntegrationConfig>) => {
    setCfg((c) => ({ ...c, ...patch }))
    setDirty(true)
  }
  const updateRequest = (patch: Partial<DataIntegrationConfig["request"]>) =>
    update({ request: { ...cfg.request, ...patch } })
  const updateAuth = (patch: Partial<DataIntegrationConfig["request"]["auth"]>) =>
    updateRequest({ auth: { ...cfg.request.auth, ...patch } })

  const loadLogs = useCallback(async () => {
    if (isNew) return
    try {
      const r = await apiClient.get<{ logs: SyncLog[] }>(`${API}/${id}/logs`)
      setLogs(r.logs || [])
    } catch {
      /* historial opcional */
    }
  }, [id, isNew])

  useEffect(() => {
    apiClient.get<{ targets: Record<string, TargetDef> }>(`${API}/targets`)
      .then((r) => setTargets(r.targets || {}))
      .catch((e) => toast({ title: "No se cargaron los objetivos", description: String(e?.message || e), variant: "destructive" }))
    if (isNew) return
    apiClient.get<DataIntegration>(`${API}/${id}`)
      .then((d) => {
        setName(d.name)
        setDescription(d.description || "")
        setIsActive(d.is_active)
        setCfg({ ...emptyConfig(), ...d.config, request: { ...emptyConfig().request, ...d.config.request } })
      })
      .catch((e) => toast({ title: "No se pudo cargar la integración", description: String(e?.message || e), variant: "destructive" }))
      .finally(() => setLoading(false))
    loadLogs()
  }, [id, isNew, loadLogs, toast])

  // ───── mapeo derivado de la respuesta ─────
  const doc = response?.is_json ? response.json : null
  const count = doc !== null ? recordCount(doc, cfg.records_path) : null
  const record = doc !== null ? firstRecord(doc, cfg.records_path) : undefined
  const suggestions = useMemo(() => (record !== undefined ? leafPaths(record) : []), [record])
  const mappingFor = (key: string): FieldMapping =>
    cfg.mappings.find((m) => m.target === key) || { source: "", target: key, transform: "none", default: null }
  const setMapping = (key: string, patch: Partial<FieldMapping>) => {
    const current = mappingFor(key)
    const next = { ...current, ...patch }
    update({ mappings: [...cfg.mappings.filter((m) => m.target !== key), next] })
  }

  const onPickLeaf = (absolute: string) => {
    if (!pickingFor) {
      copy(absolute || "$", toast, `Ruta copiada: ${absolute || "$"}`)
      return
    }
    const rel = relativeToRecord(absolute, cfg.records_path)
    if (rel === null) {
      toast({
        title: "Ese campo está fuera de los registros",
        description: `Elige un campo dentro de ${cfg.records_path || "la lista marcada como registros"}.`,
        variant: "destructive",
      })
      return
    }
    setMapping(pickingFor, { source: rel })
    setPickingFor(null)
  }

  // ───── acciones ─────
  const send = async () => {
    setSending(true)
    setSendError(null)
    try {
      const r = await apiClient.post<SendResult>(`${API}/send`, {
        integration_id: isNew ? undefined : id,
        request: cfg.request,
      })
      setResponse(r)
    } catch (e: any) {
      setResponse(null)
      setSendError(String(e?.message || e))
    } finally {
      setSending(false)
    }
  }

  const save = async (): Promise<string | null> => {
    if (!name.trim()) {
      toast({ title: "Ponle un nombre a la integración", variant: "destructive" })
      return null
    }
    setSaving(true)
    try {
      const payload = { name, description, is_active: isActive, config: cfg }
      const saved = isNew
        ? await apiClient.post<DataIntegration>(API, payload)
        : await apiClient.put<DataIntegration>(`${API}/${id}`, payload)
      setCfg({ ...emptyConfig(), ...saved.config, request: { ...emptyConfig().request, ...saved.config.request } })
      setDirty(false)
      toast({ title: "Integración guardada" })
      if (isNew) router.replace(`/admin/api-integrations/pricing/${saved.id}`)
      return saved.id
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: String(e?.message || e), variant: "destructive" })
      return null
    } finally {
      setSaving(false)
    }
  }

  const preview = async (source: "request" | "sample") => {
    setPreviewing(true)
    try {
      const r = await apiClient.post<ApplyResult>(`${API}/preview`, {
        integration_id: isNew ? undefined : id,
        config: cfg,
        source,
        sample: source === "sample" ? sample : undefined,
        records_path: source === "sample" ? (cfg.webhook?.records_path ?? cfg.records_path) : undefined,
      })
      setResult(r)
    } catch (e: any) {
      toast({ title: "No se pudo simular", description: String(e?.message || e), variant: "destructive" })
    } finally {
      setPreviewing(false)
    }
  }

  const run = async () => {
    setConfirmRun(false)
    setRunning(true)
    try {
      const r = await apiClient.post<ApplyResult>(`${API}/${id}/run`)
      setResult(r)
      toast({ title: "Cambios aplicados", description: `${r.summary.products_changed} productos actualizados` })
    } catch (e: any) {
      toast({ title: "La ejecución falló", description: String(e?.message || e), variant: "destructive" })
    } finally {
      setRunning(false)
      loadLogs()
    }
  }

  const rotateKeys = async () => {
    setConfirmRotate(false)
    try {
      const r = await apiClient.post<{ key: string; hmac_secret: string; key_prefix: string }>(`${API}/${id}/webhook/keys`)
      setNewKeys(r)
      setCfg((c) => ({
        ...c,
        webhook: { ...(c.webhook || { enabled: false, records_path: null, rotated_at: null }), has_keys: true,
          key_prefix: r.key_prefix, rotated_at: new Date().toISOString() },
      }))
    } catch (e: any) {
      toast({ title: "No se generaron las llaves", description: String(e?.message || e), variant: "destructive" })
    }
  }

  const setWebhook = async (patch: { enabled?: boolean; records_path?: string | null }) => {
    try {
      const r = await apiClient.put<{ webhook: DataIntegrationConfig["webhook"] }>(`${API}/${id}/webhook`, patch)
      setCfg((c) => ({ ...c, webhook: r.webhook }))
      toast({ title: "Webhook actualizado" })
    } catch (e: any) {
      toast({ title: "No se actualizó el webhook", description: String(e?.message || e), variant: "destructive" })
    }
  }

  const webhookUrl = isNew ? "" : buildApiUrl(`/hooks/integrations/${id}`)
  const skuMapped = !!mappingFor("sku").source

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6 pb-16">
      {/* ───── encabezado ───── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/api-integrations")} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 space-y-1">
            <Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }}
              className="text-xl font-semibold h-10 w-[min(420px,80vw)]" aria-label="Nombre de la integración" />
            <p className="text-sm text-muted-foreground">
              💰 Gestión de precios · {target?.description || "Actualiza precios desde una API externa o un webhook."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="active" checked={isActive} onCheckedChange={(v) => { setIsActive(v); setDirty(true) }} />
            <Label htmlFor="active" className="text-sm">{isActive ? "Activa" : "Inactiva"}</Label>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar{dirty ? " *" : ""}
          </Button>
        </div>
      </div>

      {/* ───── 1. solicitud ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1 · Solicitud</CardTitle>
          <CardDescription>Arma la petición a la API externa y pruébala con Enviar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={cfg.request.method} onValueChange={(v) => updateRequest({ method: v as any })}>
              <SelectTrigger className="w-[110px] font-mono font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={cfg.request.url} onChange={(e) => updateRequest({ url: e.target.value })}
              placeholder="https://api.proveedor.com/v1/precios" className="font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && send()} />
            <Button onClick={send} disabled={sending || !cfg.request.url}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </div>

          <Tabs defaultValue="params">
            <TabsList>
              <TabsTrigger value="params">Parámetros ({cfg.request.query.filter((q) => q.key).length})</TabsTrigger>
              <TabsTrigger value="auth">Autorización</TabsTrigger>
              <TabsTrigger value="headers">Cabeceras ({cfg.request.headers.filter((h) => h.key).length})</TabsTrigger>
              <TabsTrigger value="body">Cuerpo</TabsTrigger>
            </TabsList>
            <TabsContent value="params" className="pt-3">
              <KvTable rows={cfg.request.query} onChange={(query) => updateRequest({ query })} keyPlaceholder="Parámetro" />
            </TabsContent>
            <TabsContent value="auth" className="pt-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={cfg.request.auth.type} onValueChange={(v) => updateAuth({ type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin autorización</SelectItem>
                      <SelectItem value="bearer_token">Bearer token</SelectItem>
                      <SelectItem value="api_key">API key</SelectItem>
                      <SelectItem value="basic_auth">Usuario y clave (Basic)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Los secretos se guardan cifrados y no se vuelven a mostrar.</p>
                </div>
                <div className="space-y-3">
                  {cfg.request.auth.type === "bearer_token" && (
                    <SecretInput label="Token" value={cfg.request.auth.token} onChange={(token) => updateAuth({ token })} />
                  )}
                  {cfg.request.auth.type === "api_key" && (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Nombre</Label>
                        <Input value={cfg.request.auth.key_name} className="font-mono text-sm"
                          onChange={(e) => updateAuth({ key_name: e.target.value })} />
                      </div>
                      <SecretInput label="Valor" value={cfg.request.auth.api_key} onChange={(api_key) => updateAuth({ api_key })} />
                      <div className="space-y-1">
                        <Label>Enviar en</Label>
                        <Select value={cfg.request.auth.add_to} onValueChange={(v) => updateAuth({ add_to: v as any })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="header">Cabecera</SelectItem>
                            <SelectItem value="query">Parámetro de URL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {cfg.request.auth.type === "basic_auth" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Usuario</Label>
                        <Input value={cfg.request.auth.username} onChange={(e) => updateAuth({ username: e.target.value })} />
                      </div>
                      <SecretInput label="Clave" value={cfg.request.auth.password} onChange={(password) => updateAuth({ password })} />
                    </div>
                  )}
                  {cfg.request.auth.type === "none" && (
                    <p className="text-sm text-muted-foreground pt-6">La petición se envía sin credenciales.</p>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="headers" className="pt-3">
              <KvTable rows={cfg.request.headers} onChange={(headers) => updateRequest({ headers })} allowSecret keyPlaceholder="Cabecera" />
            </TabsContent>
            <TabsContent value="body" className="pt-3 space-y-2">
              <Select value={cfg.request.body.mode}
                onValueChange={(v) => updateRequest({ body: { ...cfg.request.body, mode: v as any } })}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cuerpo</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="raw">Texto</SelectItem>
                </SelectContent>
              </Select>
              {cfg.request.body.mode !== "none" && (
                <Textarea rows={8} className="font-mono text-xs" value={cfg.request.body.content}
                  placeholder={cfg.request.body.mode === "json" ? '{\n  "lista": 2\n}' : ""}
                  onChange={(e) => updateRequest({ body: { ...cfg.request.body, content: e.target.value } })} />
              )}
              {cfg.request.method === "GET" && cfg.request.body.mode !== "none" && (
                <p className="text-xs text-amber-700">Las peticiones GET se envían sin cuerpo.</p>
              )}
            </TabsContent>
          </Tabs>

          {/* respuesta */}
          {sendError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sendError}</div>
          )}
          {response && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">Respuesta</span>
                <Badge className={statusColor(response.status)}>{response.status}</Badge>
                <span className="text-muted-foreground">{response.elapsed_ms} ms · {fmtBytes(response.size_bytes)}</span>
                {response.truncated && <Badge variant="destructive">Recortada a 5 MB</Badge>}
                {pickingFor && (
                  <Badge className="bg-amber-100 text-amber-900 gap-1">
                    <MousePointerClick className="h-3 w-3" /> Haz clic en el campo para «{target?.fields.find((f) => f.key === pickingFor)?.label}»
                    <button type="button" onClick={() => setPickingFor(null)} aria-label="Cancelar"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
              </div>
              <Tabs defaultValue="body">
                <TabsList>
                  <TabsTrigger value="body">Cuerpo</TabsTrigger>
                  <TabsTrigger value="headers">Cabeceras ({Object.keys(response.headers).length})</TabsTrigger>
                </TabsList>
                <TabsContent value="body" className="pt-2">
                  {response.is_json ? (
                    <JsonTree data={response.json} recordsPath={cfg.records_path} picking={!!pickingFor}
                      onPickLeaf={onPickLeaf} onPickArray={(p) => update({ records_path: p })} />
                  ) : (
                    <pre className="text-xs font-mono max-h-[480px] overflow-auto rounded-md border bg-white p-2 whitespace-pre-wrap break-all">
                      {response.text || "(vacía)"}
                    </pre>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Clic en un campo: copia su ruta (o lo asigna si estás eligiendo). «Usar como registros» marca la lista que se recorre.
                  </p>
                </TabsContent>
                <TabsContent value="headers" className="pt-2">
                  <div className="rounded-md border bg-white p-2 font-mono text-xs max-h-[320px] overflow-auto">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k}><span className="text-gray-500">{k}:</span> {v}</div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ───── 2. mapeo ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">2 · Mapeo de campos</CardTitle>
          <CardDescription>
            Qué dato de la respuesta alimenta cada campo del objetivo. El SKU es obligatorio: con él se ubica el producto o la variante.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Objetivo</Label>
              <Select value={cfg.target} onValueChange={(v) => update({ target: v, mappings: [] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(targets).map(([k, t]) => <SelectItem key={k} value={k}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ruta de los registros</Label>
              <Input value={cfg.records_path} placeholder="$ (raíz) · data.items" className="font-mono text-sm"
                onChange={(e) => update({ records_path: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                {doc === null ? "Envía la petición para verificarla."
                  : count === null ? "⚠ Esa ruta no existe en la respuesta."
                  : `${count} registro${count === 1 ? "" : "s"} encontrados.`}
              </p>
            </div>
            <div className="space-y-1">
              <Label>{target?.options.max_change_pct?.label || "Cambio máximo permitido (%)"}</Label>
              <Input type="number" min={0} value={cfg.options.max_change_pct}
                onChange={(e) => update({ options: { ...cfg.options, max_change_pct: Number(e.target.value) } })} />
              <p className="text-xs text-muted-foreground">{target?.options.max_change_pct?.help}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Campo destino</th>
                  <th className="py-2 pr-3 font-medium">Campo origen (ruta en el registro)</th>
                  <th className="py-2 pr-3 font-medium">Transformación</th>
                  <th className="py-2 pr-3 font-medium">Si viene vacío</th>
                  <th className="py-2 font-medium">1er registro →</th>
                </tr>
              </thead>
              <tbody>
                {(target?.fields || []).map((f) => {
                  const m = mappingFor(f.key)
                  const { preset, arg } = parseTransform(m.transform)
                  const presetDef = TRANSFORM_PRESETS.find((p) => p.value === preset)
                  const raw = record !== undefined && m.source ? (m.source === "$" ? record : getPath(record, m.source)) : undefined
                  const shown = record === undefined || !m.source ? ""
                    : raw === undefined && !m.default ? "⚠ no encontrado"
                    : previewTransform(raw === undefined ? m.default : raw, m.transform)
                  return (
                    <tr key={f.key} className="border-b align-top">
                      <td className="py-2 pr-3 w-[180px]">
                        <div className="font-medium">{f.label}{f.required && <span className="text-red-600"> *</span>}</div>
                        <div className="text-xs text-muted-foreground">{f.help}</div>
                      </td>
                      <td className="py-2 pr-3 min-w-[220px]">
                        <div className="flex gap-1">
                          <Input value={m.source} list={`paths-${f.key}`} placeholder="ej. ItemCode"
                            className="font-mono text-xs h-8" onChange={(e) => setMapping(f.key, { source: e.target.value })} />
                          <datalist id={`paths-${f.key}`}>{suggestions.map((p) => <option key={p} value={p} />)}</datalist>
                          <Button type="button" size="icon" variant={pickingFor === f.key ? "secondary" : "outline"}
                            className="h-8 w-8 shrink-0" disabled={!response?.is_json}
                            title={response?.is_json ? "Elegir en la respuesta" : "Envía la petición primero"}
                            onClick={() => setPickingFor(pickingFor === f.key ? null : f.key)}>
                            <MousePointerClick className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 pr-3 min-w-[200px]">
                        <div className="flex gap-1">
                          <Select value={preset}
                            onValueChange={(v) => setMapping(f.key, {
                              transform: buildTransform(v, v === "custom" ? m.transform : TRANSFORM_PRESETS.find((p) => p.value === v)?.arg || ""),
                            })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{TRANSFORM_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                          </Select>
                          {(presetDef?.arg !== undefined || preset === "custom") && (
                            <Input value={arg} className="h-8 text-xs font-mono w-[110px]"
                              placeholder={preset === "custom" ? "number|multiply:1.18" : "factor"}
                              onChange={(e) => setMapping(f.key, { transform: buildTransform(preset, e.target.value) })} />
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3 w-[120px]">
                        <Input value={m.default ?? ""} className="h-8 text-xs" placeholder="—"
                          onChange={(e) => setMapping(f.key, { default: e.target.value || null })} />
                      </td>
                      <td className="py-2 font-mono text-xs w-[140px] break-all">
                        <span className={shown.startsWith("⚠") ? "text-amber-700" : ""}>{shown}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => preview("request")} disabled={previewing || !cfg.request.url || !skuMapped}>
              {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Vista previa (no guarda)
            </Button>
            <Button onClick={() => setConfirmRun(true)} disabled={isNew || dirty || running || !isActive || !skuMapped}
              title={isNew || dirty ? "Guarda los cambios primero" : !isActive ? "La integración está inactiva" : ""}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Ejecutar y aplicar
            </Button>
            {!skuMapped && <span className="text-xs text-amber-700 self-center">Mapea el SKU para continuar.</span>}
            {(isNew || dirty) && skuMapped && <span className="text-xs text-muted-foreground self-center">Para aplicar, guarda primero.</span>}
          </div>

          {result && <ResultView result={result} onClose={() => setResult(null)} />}
        </CardContent>
      </Card>

      {/* ───── 3. webhook ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> 3 · Webhook (el sistema externo empuja los datos)</CardTitle>
          <CardDescription>
            En vez de consultar la API, el otro sistema puede enviar los precios a esta URL. Se aplica el mismo mapeo.
            Cada envío se autentica con la llave y una firma HMAC-SHA256 del cuerpo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNew ? (
            <p className="text-sm text-muted-foreground">Guarda la integración para habilitar el webhook.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="wh" checked={!!cfg.webhook?.enabled} disabled={!cfg.webhook?.has_keys}
                    onCheckedChange={(v) => setWebhook({ enabled: v })} />
                  <Label htmlFor="wh">{cfg.webhook?.enabled ? "Recibiendo" : "Desactivado"}</Label>
                </div>
                <Button variant="outline" size="sm" onClick={() => (cfg.webhook?.has_keys ? setConfirmRotate(true) : rotateKeys())}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  {cfg.webhook?.has_keys ? "Regenerar llave y secreto" : "Generar llave y secreto"}
                </Button>
                {cfg.webhook?.has_keys && (
                  <span className="text-xs text-muted-foreground">
                    Llave <span className="font-mono">{cfg.webhook.key_prefix}…</span> · generada {fmtDate(cfg.webhook.rotated_at)}
                  </span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                <div className="space-y-1">
                  <Label>URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(webhookUrl, toast, "URL copiada")} aria-label="Copiar URL">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Ruta de registros del webhook</Label>
                  <Input defaultValue={cfg.webhook?.records_path ?? ""} placeholder={`igual que arriba (${cfg.records_path || "$"})`}
                    className="font-mono text-xs"
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (cfg.webhook?.records_path ?? "")) setWebhook({ records_path: v || null })
                    }} />
                </div>
              </div>

              <WebhookDocs url={webhookUrl} />

              <div className="space-y-2">
                <Label>Probar el mapeo con un cuerpo de ejemplo (simulación, no guarda)</Label>
                <Textarea rows={6} className="font-mono text-xs" value={sample} onChange={(e) => setSample(e.target.value)}
                  placeholder={'{\n  "items": [ { "sku": "POLO-S", "precio": 1250 } ]\n}'} />
                <Button variant="outline" size="sm" onClick={() => preview("sample")} disabled={!sample.trim() || previewing || !skuMapped}>
                  <Eye className="h-4 w-4 mr-2" /> Simular con este cuerpo
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ───── 4. historial ───── */}
      {!isNew && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Historial</CardTitle>
              <CardDescription>Ejecuciones manuales y envíos al webhook que aplicaron cambios.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadLogs}>Actualizar</Button>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Todavía no hay ejecuciones.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3 font-medium">Fecha</th>
                      <th className="py-2 pr-3 font-medium">Origen</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 pr-3 font-medium text-right">Registros</th>
                      <th className="py-2 pr-3 font-medium text-right">Productos cambiados</th>
                      <th className="py-2 pr-3 font-medium text-right">Rechazados</th>
                      <th className="py-2 font-medium">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b">
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.started_at)}</td>
                        <td className="py-2 pr-3">{l.detail?.source === "webhook" ? "Webhook" : "Manual"}</td>
                        <td className="py-2 pr-3">
                          <Badge className={l.status === "success" ? "bg-green-100 text-green-800"
                            : l.status === "partial" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                            {l.status === "success" ? "Correcto" : l.status === "partial" ? "Con rechazos" : "Error"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-right">{l.records}</td>
                        <td className="py-2 pr-3 text-right">{l.products_updated}</td>
                        <td className="py-2 pr-3 text-right">{l.rejected}</td>
                        <td className="py-2 text-xs text-muted-foreground max-w-[320px] truncate" title={l.error || ""}>{l.error || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ───── diálogos ───── */}
      <AlertDialog open={confirmRun} onOpenChange={setConfirmRun}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aplicar los precios ahora?</AlertDialogTitle>
            <AlertDialogDescription>
              Se consulta la API con la configuración guardada y se actualizan los productos de la empresa activa.
              Los cambios mayores al {cfg.options.max_change_pct}% se rechazan. Te recomendamos revisar la vista previa antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Aplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar la llave y el secreto?</AlertDialogTitle>
            <AlertDialogDescription>
              Los actuales dejan de funcionar de inmediato: el sistema externo recibirá 401 hasta que configure los nuevos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={rotateKeys}>Regenerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!newKeys} onOpenChange={(o) => !o && setNewKeys(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Llave y secreto del webhook</DialogTitle>
            <DialogDescription className="flex items-start gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              Cópialos ahora y entrégalos al sistema externo por un canal seguro. No se vuelven a mostrar.
            </DialogDescription>
          </DialogHeader>
          {newKeys && (
            <div className="space-y-3">
              {([["Llave (X-Wacommerce-Key)", newKeys.key], ["Secreto HMAC", newKeys.hmac_secret]] as const).map(([label, v]) => (
                <div key={label} className="space-y-1">
                  <Label>{label}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={v} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(v, toast, `${label} copiada`)} aria-label={`Copiar ${label}`}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setNewKeys(null)}>Ya los guardé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SecretInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const stored = value === SECRET_MASK
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="password" value={value} className="font-mono text-sm"
        placeholder={stored ? "Guardado (escribe para reemplazar)" : ""}
        onFocus={() => stored && onChange("")}
        onBlur={(e) => stored && !e.target.value && onChange(SECRET_MASK)}
        onChange={(e) => onChange(e.target.value)} />
      {stored && <p className="text-xs text-muted-foreground">Guardado. Déjalo así para conservarlo.</p>}
    </div>
  )
}

function ResultView({ result, onClose }: { result: ApplyResult; onClose: () => void }) {
  const s = result.summary
  const stats: [string, number, string?][] = [
    ["Registros", s.records],
    ["Con coincidencia", s.matched],
    ["Productos que cambian", s.products_changed, "text-green-700"],
    ["Sin cambios", s.unchanged],
    ["Sin coincidencia", s.unmatched, s.unmatched ? "text-amber-700" : undefined],
    ["Rechazados", s.rejected, s.rejected ? "text-red-700" : undefined],
  ]
  return (
    <div className="rounded-lg border bg-gray-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          {result.dry_run ? "Vista previa — nada se ha guardado" : "Cambios aplicados"}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(([label, n, cls]) => (
          <div key={label} className="rounded-md bg-white border p-3">
            <div className={`text-xl font-semibold ${cls || ""}`}>{n}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {result.changes.length > 0 && (
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 px-3 font-medium">SKU</th>
                <th className="py-2 px-3 font-medium">Producto</th>
                <th className="py-2 px-3 font-medium">Campo</th>
                <th className="py-2 px-3 font-medium text-right">Antes</th>
                <th className="py-2 px-3 font-medium text-right">Después</th>
              </tr>
            </thead>
            <tbody>
              {result.changes.map((c, i) => (
                <tr key={i} className={`border-b ${c.derived ? "text-muted-foreground" : ""}`}>
                  <td className="py-1.5 px-3 font-mono text-xs">{c.sku || "—"}</td>
                  <td className="py-1.5 px-3 truncate max-w-[260px]" title={c.product_name}>
                    {c.product_name} <span className="text-xs text-muted-foreground">({c.level})</span>
                  </td>
                  <td className="py-1.5 px-3">{FIELD_LABEL[c.field] || c.field}{c.derived ? " (recalculado)" : ""}</td>
                  <td className="py-1.5 px-3 text-right">{fmtVal(c.old)}</td>
                  <td className="py-1.5 px-3 text-right font-medium">{fmtVal(c.new)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(result.rejected.length > 0 || (result.mapping_errors || []).length > 0) && (
        <details className="rounded-md border bg-white p-3" open>
          <summary className="cursor-pointer text-sm font-medium text-red-700">
            Rechazados ({result.rejected.length + (result.mapping_errors || []).length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs max-h-[200px] overflow-auto">
            {(result.mapping_errors || []).map((e, i) => (
              <li key={`m${i}`}>Registro #{e.record + 1}: {e.error}</li>
            ))}
            {result.rejected.map((r, i) => (
              <li key={i}><span className="font-mono">{r.sku || `registro #${(r.record ?? 0) + 1}`}</span>: {r.reason}</li>
            ))}
          </ul>
        </details>
      )}
      {result.unmatched.length > 0 && (
        <details className="rounded-md border bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-amber-700">
            SKU sin producto en la tienda ({s.unmatched})
          </summary>
          <p className="mt-2 font-mono text-xs break-all">{result.unmatched.join(", ")}</p>
        </details>
      )}
      {result.warnings.length > 0 && (
        <ul className="text-xs text-amber-800 list-disc pl-5">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
    </div>
  )
}

function WebhookDocs({ url }: { url: string }) {
  const [tab, setTab] = useState("curl")
  const curl = `LLAVE='whk_…'; SECRETO='whs_…'
TS=$(date +%s)
BODY='{"items":[{"sku":"POLO-S","precio":1250}]}'
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRETO" | sed 's/^.* //')
curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -H "X-Wacommerce-Key: $LLAVE" \\
  -H "X-Wacommerce-Timestamp: $TS" \\
  -H "X-Wacommerce-Signature: sha256=$SIG" \\
  -H 'X-Wacommerce-Dry-Run: true' \\
  -d "$BODY"`
  const node = `import crypto from "node:crypto"

const body = JSON.stringify({ items: [{ sku: "POLO-S", precio: 1250 }] })
const ts = Math.floor(Date.now() / 1000).toString()
const sig = crypto.createHmac("sha256", process.env.WACOMMERCE_SECRET)
  .update(\`\${ts}.\${body}\`).digest("hex")

await fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Wacommerce-Key": process.env.WACOMMERCE_KEY,
    "X-Wacommerce-Timestamp": ts,
    "X-Wacommerce-Signature": \`sha256=\${sig}\`,
  },
  body, // exactamente el mismo texto que se firmó
})`
  const python = `import hashlib, hmac, json, os, time, requests

body = json.dumps({"items": [{"sku": "POLO-S", "precio": 1250}]})
ts = str(int(time.time()))
sig = hmac.new(os.environ["WACOMMERCE_SECRET"].encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()

requests.post("${url}", data=body, headers={
    "Content-Type": "application/json",
    "X-Wacommerce-Key": os.environ["WACOMMERCE_KEY"],
    "X-Wacommerce-Timestamp": ts,
    "X-Wacommerce-Signature": f"sha256={sig}",
})`
  const code = tab === "curl" ? curl : tab === "node" ? node : python
  return (
    <div className="rounded-md border bg-gray-50 p-3 space-y-2 text-sm">
      <div className="font-medium">Cómo firmar cada envío</div>
      <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
        <li><span className="font-mono">X-Wacommerce-Key</span>: la llave.</li>
        <li><span className="font-mono">X-Wacommerce-Timestamp</span>: hora actual en segundos Unix (se aceptan ±5 minutos).</li>
        <li><span className="font-mono">X-Wacommerce-Signature</span>: <span className="font-mono">sha256=</span> + HMAC-SHA256 en hexadecimal, con el secreto, de <span className="font-mono">{"<timestamp>.<cuerpo exacto>"}</span>.</li>
        <li><span className="font-mono">X-Wacommerce-Dry-Run: true</span> (opcional): responde el resumen sin guardar.</li>
        <li>Respuestas: 200 con el resumen · 401 llave/firma/hora inválida · 409 envío repetido · 413 más de 5 MB · 422 mapeo inválido.</li>
      </ul>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="curl" className="text-xs">curl</TabsTrigger>
          <TabsTrigger value="node" className="text-xs">Node.js</TabsTrigger>
          <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
        </TabsList>
      </Tabs>
      <pre className="text-[11px] font-mono bg-white border rounded p-2 overflow-auto max-h-[260px] whitespace-pre">{code}</pre>
    </div>
  )
}
