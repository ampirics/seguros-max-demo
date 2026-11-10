"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Lock, Eye, EyeOff, Pencil, Ban, RefreshCw, Braces, ArrowRight,
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { PickupPinRangeCard } from "./pickup-pin-range"

// Documentos SAP: por cada documento que la integración envía a SAP, el admin
// agrega campos (incluidos U_), cambia valores fijos o condicionales (p. ej.
// según la pasarela: BHD → 1, Azul → 2) o deja de enviar un campo. Backend:
// /sap-config/document-rules. El Lambda aplica las reglas encima de lo que ya
// envía; sin reglas, todo sale igual que antes.

const API = "/sap-config/document-rules"

type Mode = "value" | "conditional" | "omit"
type Kind = "string" | "number" | "integer"

interface Case { equals: string | string[]; value: string }
interface Rule {
  field: string
  scope: "header" | "lines"
  mode: Mode
  type: Kind
  value?: string
  variable?: string
  cases?: Case[]
  default?: string | null
  enabled: boolean
  note?: string
}
interface Variable { key: string; label: string; sample?: string; options?: { value: string; label: string }[] }
interface DocDef {
  label: string
  when: string
  endpoint: string
  tables: Record<string, string>
  variables: Variable[]
  notes: string
  has_lines: boolean
  protected: { header: string[]; lines: string[] }
  system_payload: Record<string, any>
}
interface SapField { name: string; description?: string; type?: string; valid_values: { value: string; description?: string }[] }
interface Preview { system: Record<string, any>; final: Record<string, any>; log: { field: string; scope: string; status: string; reason?: string }[] }

const DOC_ORDER = ["orders", "orders_on_payment", "incoming_payments", "down_payments", "pick_lists"]
const LINES_KEY: Record<string, string> = { orders: "DocumentLines", down_payments: "DocumentLines", pick_lists: "PickListsLines" }

const newRule = (field = "", patch: Partial<Rule> = {}): Rule => ({
  field, scope: "header", mode: "value", type: "string", value: "", enabled: true, ...patch,
})

const show = (v: unknown) =>
  v === undefined ? "—" : v === null ? "null" : typeof v === "object" ? JSON.stringify(v) : String(v)

export function SapDocumentsEditor() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<Record<string, DocDef>>({})
  const [rules, setRules] = useState<Record<string, Rule[]>>({})
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [doc, setDoc] = useState("incoming_payments")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sapFields, setSapFields] = useState<Record<string, { fields: Record<string, SapField[]>; error?: string }>>({})
  const [scenario, setScenario] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  const def = catalog[doc]
  const docRules = rules[doc] || []

  useEffect(() => {
    apiClient.get<{ rules: Record<string, Rule[]>; catalog: Record<string, DocDef>; updated_at: string | null }>(API)
      .then((r) => {
        setCatalog(r.catalog)
        setRules(r.rules)
        setUpdatedAt(r.updated_at)
      })
      .catch((e) => setLoadError(String(e?.message || e)))
      .finally(() => setLoading(false))
  }, [])

  // Campos U_ reales de SAP para el documento (una vez por documento).
  useEffect(() => {
    if (!def || sapFields[doc]) return
    apiClient.get<{ fields: Record<string, SapField[]>; error?: string }>(`${API}/sap-fields`, { document: doc })
      .then((r) => setSapFields((s) => ({ ...s, [doc]: r })))
      .catch((e) => setSapFields((s) => ({ ...s, [doc]: { fields: {}, error: String(e?.message || e) } })))
  }, [doc, def, sapFields])

  // Escenario por defecto: primera opción de cada variable con opciones (p. ej. la pasarela).
  useEffect(() => {
    if (!def) return
    const initial: Record<string, string> = {}
    def.variables.forEach((v) => { if (v.options?.length) initial[v.key] = v.options[0].value })
    setScenario(initial)
  }, [doc, def])

  const runPreview = useCallback(async () => {
    if (!def) return
    try {
      const r = await apiClient.post<Preview>(`${API}/preview`, { document: doc, rules: docRules.filter((r) => r.field), context: scenario })
      setPreview(r)
      setPreviewError(null)
    } catch (e: any) {
      setPreviewError(String(e?.message || e))
    }
  }, [def, doc, docRules, scenario])

  useEffect(() => {
    const t = setTimeout(runPreview, 400)
    return () => clearTimeout(t)
  }, [runPreview])

  const setDocRules = (next: Rule[]) => {
    setRules((r) => ({ ...r, [doc]: next }))
    setDirty(true)
  }
  const updateRule = (i: number, patch: Partial<Rule>) => setDocRules(docRules.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const save = async () => {
    setSaving(true)
    try {
      const r = await apiClient.put<{ rules: Record<string, Rule[]>; updated_at: string }>(API, { rules })
      setRules(r.rules)
      setUpdatedAt(r.updated_at)
      setDirty(false)
      toast({ title: "Documentos SAP guardados", description: "La integración los usa en máximo 5 minutos." })
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: String(e?.message || e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const fieldsFor = (scope: "header" | "lines") => sapFields[doc]?.fields?.[scope] || []
  const sapFieldByName = (scope: "header" | "lines", name: string) => fieldsFor(scope).find((f) => f.name === name)

  const systemRows = useMemo(() => {
    if (!def) return [] as { field: string; value: unknown; scope: "header" | "lines" }[]
    const sys = def.system_payload
    const lk = LINES_KEY[doc]
    const rows: { field: string; value: unknown; scope: "header" | "lines" }[] = Object.entries(sys)
      .filter(([k]) => k !== lk)
      .map(([field, value]) => ({ field, value, scope: "header" as const }))
    const firstLine = lk && Array.isArray(sys[lk]) ? sys[lk][0] : null
    if (firstLine) Object.entries(firstLine).forEach(([field, value]) => rows.push({ field, value, scope: "lines" }))
    return rows
  }, [def, doc])

  const ruleFor = (field: string, scope: string) => docRules.findIndex((r) => r.field === field && r.scope === scope)

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (loadError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/admin/api-integrations")}><ArrowLeft className="h-4 w-4 mr-2" /> Integraciones</Button>
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/api-integrations")} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Documentos SAP</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Lo que la integración envía a SAP en cada paso. Agrega campos (incluidos los U_), cambia un valor —fijo o según
              una condición, como la pasarela de pago— o deja de enviarlo. Los montos, el cliente y las líneas los calcula el sistema.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-muted-foreground">Guardado {new Date(updatedAt).toLocaleString("es-DO")}</span>}
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar{dirty ? " *" : ""}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        {/* documentos */}
        <nav className="flex lg:flex-col gap-2 overflow-x-auto" aria-label="Documentos">
          {DOC_ORDER.filter((k) => catalog[k]).map((k) => (
            <button key={k} type="button" onClick={() => setDoc(k)}
              className={`text-left rounded-lg border px-3 py-2 min-w-[170px] transition-colors ${
                doc === k ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{catalog[k].label}</span>
                {(rules[k] || []).length > 0 && <Badge variant="secondary">{(rules[k] || []).length}</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">{catalog[k].endpoint}</div>
            </button>
          ))}
        </nav>

        {def && (
          <div className="space-y-6 min-w-0">
            <p className="text-sm text-muted-foreground">{def.when} {def.notes}</p>

            {/* lo que envía hoy el sistema */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lo que envía el sistema</CardTitle>
                <CardDescription>Valores que arma la integración hoy (ejemplo). Puedes cambiarlos o dejar de enviarlos.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {systemRows.map(({ field, value, scope }) => {
                      const locked = def.protected[scope].includes(field)
                      const idx = ruleFor(field, scope)
                      return (
                        <tr key={`${scope}.${field}`} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">
                            {scope === "lines" && <span className="text-muted-foreground">línea · </span>}{field}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground break-all">{show(value)}</td>
                          <td className="py-1.5 text-right whitespace-nowrap">
                            {locked && doc === "orders_on_payment" && field === "TrackingNumber" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> al azar · rango abajo</span>
                            ) : locked ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> calculado</span>
                            ) : idx >= 0 ? (
                              <Badge className="bg-amber-100 text-amber-900">con regla</Badge>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs"
                                  onClick={() => setDocRules([...docRules, newRule(field, { scope, value: value == null ? "" : String(value),
                                    type: typeof value === "number" ? (Number.isInteger(value) ? "integer" : "number") : "string" })])}>
                                  <Pencil className="h-3 w-3 mr-1" /> Cambiar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs"
                                  onClick={() => setDocRules([...docRules, newRule(field, { scope, mode: "omit" })])}>
                                  <Ban className="h-3 w-3 mr-1" /> No enviar
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {doc === "orders_on_payment" && <PickupPinRangeCard />}

            {/* reglas */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Reglas de la empresa</CardTitle>
                  <CardDescription>
                    Se aplican en orden, encima de lo del sistema.
                    {sapFields[doc]?.error ? ` ${sapFields[doc]?.error}`
                      : sapFields[doc] ? ` ${fieldsFor("header").length + fieldsFor("lines").length} campos U_ encontrados en SAP (${Object.values(def.tables).join(", ")}).`
                      : " Buscando campos U_ en SAP…"}
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setDocRules([...docRules, newRule()])}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar campo
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {docRules.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Sin reglas: este documento se envía exactamente como lo arma el sistema.
                  </p>
                )}
                {docRules.map((rule, i) => (
                  <RuleEditor key={i} rule={rule} def={def}
                    sapFields={fieldsFor(rule.scope)} sapField={sapFieldByName(rule.scope, rule.field)}
                    onChange={(p) => updateRule(i, p)}
                    onRemove={() => setDocRules(docRules.filter((_, j) => j !== i))}
                    onMove={(d) => {
                      const j = i + d
                      if (j < 0 || j >= docRules.length) return
                      const next = [...docRules];
                      [next[i], next[j]] = [next[j], next[i]]
                      setDocRules(next)
                    }} />
                ))}
              </CardContent>
            </Card>

            {/* vista previa */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Vista previa</CardTitle>
                  <CardDescription>Cómo saldría el documento con las reglas actuales (sin guardar y sin tocar SAP).</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowJson(!showJson)}>
                    <Braces className="h-4 w-4 mr-1" /> {showJson ? "Tabla" : "JSON"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={runPreview} aria-label="Actualizar vista previa"><RefreshCw className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {def.variables.some((v) => v.options?.length) && (
                  <div className="flex flex-wrap gap-4">
                    {def.variables.filter((v) => v.options?.length).map((v) => (
                      <div key={v.key} className="flex items-center gap-2">
                        <Label className="text-sm">{v.label}</Label>
                        <div className="flex rounded-md border overflow-hidden">
                          {v.options!.map((o) => (
                            <button key={o.value} type="button"
                              onClick={() => setScenario((s) => ({ ...s, [v.key]: o.value }))}
                              className={`px-3 py-1 text-sm ${scenario[v.key] === o.value ? "bg-primary text-primary-foreground" : "hover:bg-gray-50"}`}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {previewError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{previewError}</div>}
                {preview && (showJson ? (
                  <pre className="text-xs font-mono bg-gray-50 border rounded p-3 overflow-auto max-h-[420px]">{JSON.stringify(preview.final, null, 2)}</pre>
                ) : (
                  <PreviewTable preview={preview} linesKey={LINES_KEY[doc]} />
                ))}
                {preview?.log.some((l) => l.status === "error" || l.status === "skipped") && (
                  <ul className="text-xs text-red-700 list-disc pl-5">
                    {preview.log.filter((l) => l.status === "error" || l.status === "skipped").map((l, i) => (
                      <li key={i}>{l.field}: {l.reason}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function RuleEditor({ rule, def, sapFields, sapField, onChange, onRemove, onMove }: {
  rule: Rule
  def: DocDef
  sapFields: SapField[]
  sapField?: SapField
  onChange: (p: Partial<Rule>) => void
  onRemove: () => void
  onMove: (d: number) => void
}) {
  const listId = `sapf-${rule.scope}-${def.label}`
  const vars = def.variables.filter((v) => rule.scope === "lines" || !v.key.startsWith("line."))
  const condVar = def.variables.find((v) => v.key === rule.variable)
  const valid = sapField?.valid_values || []

  return (
    <div className={`rounded-lg border p-3 space-y-3 ${rule.enabled ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[190px] flex-1">
          <Label className="text-xs">Campo SAP</Label>
          <Input value={rule.field} list={listId} placeholder="U_MiCampo" className="h-8 font-mono text-sm"
            onChange={(e) => onChange({ field: e.target.value.trim() })} />
          <datalist id={listId}>{sapFields.map((f) => <option key={f.name} value={f.name}>{f.description}</option>)}</datalist>
          {sapField?.description && <p className="text-[11px] text-muted-foreground">{sapField.description}</p>}
        </div>
        {def.has_lines && (
          <div className="space-y-1 w-[130px]">
            <Label className="text-xs">Nivel</Label>
            <Select value={rule.scope} onValueChange={(v) => onChange({ scope: v as any })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Encabezado</SelectItem>
                <SelectItem value="lines">Cada línea</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1 w-[170px]">
          <Label className="text-xs">Valor</Label>
          <Select value={rule.mode} onValueChange={(v) => onChange({
            mode: v as Mode,
            ...(v === "conditional" && !rule.cases?.length
              ? { variable: vars.find((x) => x.options)?.key || vars[0]?.key, cases: [{ equals: "", value: "" }], default: null }
              : {}),
          })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="value">Fijo o con variables</SelectItem>
              <SelectItem value="conditional">Según una condición</SelectItem>
              <SelectItem value="omit">No enviar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rule.mode !== "omit" && (
          <div className="space-y-1 w-[110px]">
            <Label className="text-xs">Tipo</Label>
            <Select value={rule.type} onValueChange={(v) => onChange({ type: v as Kind })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="string">Texto</SelectItem>
                <SelectItem value="integer">Entero</SelectItem>
                <SelectItem value="number">Decimal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Switch checked={rule.enabled} onCheckedChange={(v) => onChange({ enabled: v })} aria-label="Activa" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMove(-1)} aria-label="Subir">↑</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMove(1)} aria-label="Bajar">↓</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRemove} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {rule.mode === "value" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <ValueInput valid={valid} value={rule.value || ""} onValue={(v) => onChange({ value: v })} placeholder="Valor, p. ej. 01 o Pago {{payment.provider}}" />
          </div>
          <Select value="" onValueChange={(k) => onChange({ value: `${rule.value || ""}{{${k}}}` })}>
            <SelectTrigger className="h-8 text-xs w-[170px]"><SelectValue placeholder="+ Insertar variable" /></SelectTrigger>
            <SelectContent>{vars.map((v) => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {rule.mode === "conditional" && (
        <div className="space-y-2 rounded-md bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <span>Según</span>
            <Select value={rule.variable} onValueChange={(v) => onChange({ variable: v })}>
              <SelectTrigger className="h-8 text-xs w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>{vars.map((v) => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {(rule.cases || []).map((c, ci) => (
            <div key={ci} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-10 text-muted-foreground">si es</span>
              {condVar?.options ? (
                <Select value={String(c.equals || "") || undefined}
                  onValueChange={(v) => onChange({ cases: rule.cases!.map((x, j) => (j === ci ? { ...x, equals: v } : x)) })}>
                  <SelectTrigger className="h-8 text-xs w-[170px]"><SelectValue placeholder="Elegir" /></SelectTrigger>
                  <SelectContent>{condVar.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={Array.isArray(c.equals) ? c.equals.join(",") : c.equals} className="h-8 text-xs w-[170px] font-mono"
                  onChange={(e) => onChange({ cases: rule.cases!.map((x, j) => (j === ci ? { ...x, equals: e.target.value } : x)) })} />
              )}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">enviar</span>
              <div className="w-[200px]">
                <ValueInput valid={valid} value={c.value} onValue={(v) => onChange({ cases: rule.cases!.map((x, j) => (j === ci ? { ...x, value: v } : x)) })} />
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Quitar condición"
                onClick={() => onChange({ cases: rule.cases!.filter((_, j) => j !== ci) })}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => onChange({ cases: [...(rule.cases || []), { equals: "", value: "" }] })}>
            <Plus className="h-3 w-3 mr-1" /> Condición
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-sm pt-1">
            <span className="text-muted-foreground">si no coincide, enviar</span>
            <div className="w-[200px]">
              <ValueInput valid={valid} value={rule.default || ""} onValue={(v) => onChange({ default: v || null })} placeholder="(lo del sistema)" />
            </div>
            {rule.default && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange({ default: null })}>Dejar lo del sistema</Button>
            )}
          </div>
        </div>
      )}

      {rule.mode === "omit" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1"><EyeOff className="h-3 w-3" /> Este campo no se enviará a SAP.</p>
      )}
    </div>
  )
}

// Fuera de RuleEditor a propósito: definido dentro, React lo recrearía en cada
// render y el campo perdería el foco con cada tecla.
function ValueInput({ valid, value, onValue, placeholder }: {
  valid: { value: string; description?: string }[]
  value: string
  onValue: (v: string) => void
  placeholder?: string
}) {
  if (valid.length > 0) {
    return (
      <Select value={value || undefined} onValueChange={onValue}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={placeholder || "Elegir valor"} /></SelectTrigger>
        <SelectContent>
          {valid.map((v) => <SelectItem key={v.value} value={v.value}>{v.value}{v.description ? ` — ${v.description}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>
    )
  }
  return <Input value={value} placeholder={placeholder} className="h-8 text-xs font-mono" onChange={(e) => onValue(e.target.value)} />
}

function PreviewTable({ preview, linesKey }: { preview: Preview; linesKey?: string }) {
  const rows: { scope: string; field: string; before: unknown; after: unknown }[] = []
  const keys = new Set([...Object.keys(preview.system), ...Object.keys(preview.final)])
  keys.forEach((k) => {
    if (k === linesKey) return
    rows.push({ scope: "", field: k, before: preview.system[k], after: preview.final[k] })
  })
  if (linesKey) {
    const a = preview.system[linesKey]?.[0] || {}
    const b = preview.final[linesKey]?.[0] || {}
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => rows.push({ scope: "línea · ", field: k, before: a[k], after: b[k] }))
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b bg-gray-50">
            <th className="py-2 px-3 font-medium">Campo</th>
            <th className="py-2 px-3 font-medium">Sistema</th>
            <th className="py-2 px-3 font-medium">Se envía</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const added = r.before === undefined && r.after !== undefined
            const removed = r.before !== undefined && r.after === undefined
            const changed = !added && !removed && show(r.before) !== show(r.after)
            const cls = added ? "bg-green-50" : removed ? "bg-red-50" : changed ? "bg-amber-50" : ""
            return (
              <tr key={r.scope + r.field} className={`border-b last:border-0 ${cls}`}>
                <td className="py-1.5 px-3 font-mono text-xs whitespace-nowrap">{r.scope}{r.field}</td>
                <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground break-all">{show(r.before)}</td>
                <td className={`py-1.5 px-3 font-mono text-xs break-all ${removed ? "line-through text-red-700" : added || changed ? "font-semibold" : ""}`}>
                  {removed ? "no se envía" : show(r.after)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
