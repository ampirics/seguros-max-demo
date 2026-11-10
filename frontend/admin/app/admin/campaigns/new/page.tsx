"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Send, Users, Eye, Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react"
import apiClient from "@/lib/api-client"

const ORDER_STATUSES = ["PAID", "DELIVERED", "SHIPPED", "CONFIRMED", "PROCESSING"]

interface VarRow { num: string; type: "name" | "literal"; literal: string }

export default function NewCampaignPage() {
  const router = useRouter()

  // Campaña
  const [name, setName] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [language, setLanguage] = useState("es")
  const [buttonPayload, setButtonPayload] = useState("")
  const [vars, setVars] = useState<VarRow[]>([{ num: "1", type: "name", literal: "" }])

  // Segmento
  const [recencyDays, setRecencyDays] = useState<string>("")
  const [minTotal, setMinTotal] = useState<string>("")
  const [orderStatus, setOrderStatus] = useState<string[]>([])
  const [hasOrdered, setHasOrdered] = useState(true)
  const [contactScope, setContactScope] = useState<"primary" | "all">("primary")

  // Catálogo de plantillas de la integración
  const [catalog, setCatalog] = useState<any[]>([])
  const [selectedTpl, setSelectedTpl] = useState<string>("")
  const [tplPreview, setTplPreview] = useState<string>("")

  useEffect(() => {
    // Plantillas reales desde Meta (con estado de aprobación)
    apiClient.get("/admin/campaigns/templates/meta")
      .then((res: any) => setCatalog(res?.templates || []))
      .catch(() => setCatalog([]))
  }, [])

  const selectedStatus = selectedTpl !== "" ? catalog[Number(selectedTpl)]?.status : null

  const pickTemplate = (idx: string) => {
    setSelectedTpl(idx)
    if (idx === "") { setTplPreview(""); return }
    const t = catalog[Number(idx)]
    if (!t) return
    setTemplateName(t.name || "")
    setLanguage(t.language || "es")
    setTplPreview(t.body || "")
    // Detectar {{n}} en el cuerpo y pre-armar las variables
    const nums: string[] = Array.from(new Set<string>(((t.body || "").match(/\{\{\s*(\d+)\s*\}\}/g) || [])
      .map((m: string) => m.replace(/[^\d]/g, ""))))
    if (nums.length) {
      setVars(nums.map((n: string) => ({ num: n, type: n === "1" ? "name" : "literal", literal: "" })))
    }
  }

  // Preview / estado
  const [preview, setPreview] = useState<any>(null)
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildSegment = () => ({
    recency_days: recencyDays ? Number(recencyDays) : null,
    min_total: minTotal ? Number(minTotal) : null,
    order_status: orderStatus.length ? orderStatus : null,
    has_ordered: hasOrdered,
    require_opt_in: true,
    contact_scope: contactScope,
  })

  const buildTemplateVars = () => {
    const out: Record<string, string> = {}
    for (const v of vars) {
      if (!v.num) continue
      out[v.num] = v.type === "name" ? "customer.name" : v.literal
    }
    return out
  }

  const toggleStatus = (s: string) =>
    setOrderStatus((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const doPreview = async () => {
    setPreviewing(true); setError(null); setPreview(null)
    try {
      const res: any = await apiClient.post("/admin/campaigns/preview-audience", {
        segment_definition: buildSegment(),
      })
      setPreview(res)
    } catch (e: any) {
      setError(e?.message || "Error al calcular la audiencia")
    } finally { setPreviewing(false) }
  }

  const createCampaign = async (): Promise<string | null> => {
    const res: any = await apiClient.post("/admin/campaigns", {
      name,
      template_name: templateName,
      language_code: language,
      template_variables: buildTemplateVars(),
      button_payload: buttonPayload || null,
      segment_definition: buildSegment(),
    })
    return res?.id || null
  }

  const saveDraft = async () => {
    if (!name || !templateName) { setError("Nombre y plantilla son obligatorios"); return }
    setSubmitting(true); setError(null)
    try {
      const id = await createCampaign()
      if (id) router.push(`/admin/campaigns/${id}`)
    } catch (e: any) { setError(e?.message || "No se pudo guardar") }
    finally { setSubmitting(false) }
  }

  const createAndSend = async () => {
    if (!name || !templateName) { setError("Nombre y plantilla son obligatorios"); return }
    // Una plantilla no aprobada por Meta falla para todos los destinatarios.
    if (selectedStatus && selectedStatus !== "APPROVED") {
      setError(`La plantilla está en estado ${selectedStatus}: solo se pueden enviar plantillas APPROVED.`)
      return
    }
    // Contar antes de confirmar: antes se enviaba sin saber a cuántos.
    let count: number | null = null
    try {
      const res: any = await apiClient.post("/admin/campaigns/preview-audience", { segment_definition: buildSegment() })
      count = typeof res?.count === "number" ? res.count : null
      setPreview(res)
    } catch (e: any) { setError(e?.message || "No se pudo calcular la audiencia"); return }
    if (!count) { setError("La audiencia está vacía: no hay contactos con opt-in que cumplan el segmento."); return }
    const typed = prompt(
      `Se enviará la plantilla «${templateName}» a ${count} contacto(s). Es un envío real y no se puede deshacer.\n\n` +
      `Escribe ${count} para confirmar:`
    )
    if (typed === null) return
    if (typed.trim() !== String(count)) { setError("El número no coincide: no se envió nada."); return }
    setSubmitting(true); setError(null)
    try {
      const id = await createCampaign()
      if (!id) throw new Error("No se creó la campaña")
      await apiClient.post(`/admin/campaigns/${id}/send`, {})
      router.push(`/admin/campaigns/${id}`)
    } catch (e: any) { setError(e?.message || "No se pudo enviar") }
    finally { setSubmitting(false) }
  }

  return (
    <AdminLayout title="Campañas">
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Send className="w-6 h-6 text-primary" /> Nueva campaña
        </h1>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Solo se envía a contactos con <b>opt-in de marketing</b>. Usa una plantilla
          categoría <b>Marketing</b> aprobada en Meta e incluye instrucción de baja (STOP).
        </div>

        {/* Plantilla */}
        <Card>
          <CardHeader><CardTitle className="text-base">1. Plantilla</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nombre de la campaña</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo septiembre" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Elegir plantilla de Meta</Label>
                <a href="/admin/campaigns/templates" className="text-xs text-primary hover:underline">Gestionar plantillas →</a>
              </div>
              {catalog.length === 0 ? (
                <p className="text-xs text-gray-500 mt-1">
                  No hay plantillas en Meta o no se pudieron cargar. Puedes escribir el nombre manualmente abajo o crear una en “Gestionar plantillas”.
                </p>
              ) : (
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={selectedTpl}
                        onChange={(e) => pickTemplate(e.target.value)}>
                  <option value="">— Escribir manualmente —</option>
                  {catalog.map((t, i) => (
                    <option key={i} value={String(i)}>
                      {t.name} · {t.language}{t.category ? ` · ${t.category}` : ""}{t.status ? ` · ${t.status}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {tplPreview && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-2 whitespace-pre-line">{tplPreview}</div>
              )}
              {selectedStatus && selectedStatus !== "APPROVED" && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ Esta plantilla está en estado {selectedStatus}. Solo las APPROVED se envían correctamente.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre exacto de la plantilla (Meta)</Label>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="promo_generica" />
              </div>
              <div>
                <Label>Idioma</Label>
                <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="es / es_DO" />
              </div>
            </div>
            <div>
              <Label>Payload de botón (opcional)</Label>
              <Input value={buttonPayload} onChange={(e) => setButtonPayload(e.target.value)} placeholder="quick-reply payload" />
            </div>
          </CardContent>
        </Card>

        {/* Variables */}
        <Card>
          <CardHeader><CardTitle className="text-base">2. Variables de la plantilla</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {vars.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-14">{`{{${v.num}}}`}</span>
                <select className="border rounded-md px-2 py-2 text-sm"
                        value={v.type}
                        onChange={(e) => setVars((p) => p.map((x, j) => j === i ? { ...x, type: e.target.value as any } : x))}>
                  <option value="name">Nombre del cliente</option>
                  <option value="literal">Texto fijo</option>
                </select>
                {v.type === "literal" && (
                  <Input className="flex-1" value={v.literal} placeholder="ej. 20% de descuento"
                         onChange={(e) => setVars((p) => p.map((x, j) => j === i ? { ...x, literal: e.target.value } : x))} />
                )}
                <Button variant="ghost" size="sm" onClick={() => setVars((p) => p.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm"
                    onClick={() => setVars((p) => [...p, { num: String(p.length + 1), type: "literal", literal: "" }])}>
              <Plus className="w-4 h-4 mr-1" /> Agregar variable
            </Button>
          </CardContent>
        </Card>

        {/* Segmento */}
        <Card>
          <CardHeader><CardTitle className="text-base">3. Segmento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Compraron en los últimos (días)</Label>
                <Input type="number" value={recencyDays} onChange={(e) => setRecencyDays(e.target.value)} placeholder="90" />
              </div>
              <div>
                <Label>Monto mínimo por orden</Label>
                <Input type="number" value={minTotal} onChange={(e) => setMinTotal(e.target.value)} placeholder="1000" />
              </div>
            </div>
            <div>
              <Label>Estados de orden</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ORDER_STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => toggleStatus(s)}
                          className={`px-3 py-1 rounded-full text-xs border ${orderStatus.includes(s) ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-300"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasOrdered} onChange={(e) => setHasOrdered(e.target.checked)} />
                Solo clientes que han comprado
              </label>
              <div className="flex items-center gap-2 text-sm">
                <span>Contactos:</span>
                <select className="border rounded-md px-2 py-1" value={contactScope}
                        onChange={(e) => setContactScope(e.target.value as any)}>
                  <option value="primary">Solo principal</option>
                  <option value="all">Todos los opted-in</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={doPreview} disabled={previewing}>
                {previewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                Vista previa de audiencia
              </Button>
              {preview && (
                <div className="text-sm text-gray-600">
                  <b className="text-gray-900 flex items-center gap-1 inline-flex"><Users className="w-4 h-4" /> {preview.count}</b> destinatarios
                  {" · "}<span className="text-amber-600">{preview.excluded_no_optin} sin opt-in</span>
                  {" · "}<span className="text-gray-400">{preview.excluded_no_phone} sin teléfono válido</span>
                </div>
              )}
            </div>
            {preview?.sample?.length > 0 && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-32 overflow-auto">
                {preview.sample.map((s: any, i: number) => (
                  <div key={i}>{s.name || "—"} · {s.phone_e164}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={saveDraft} disabled={submitting}>Guardar borrador</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={createAndSend} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Crear y enviar
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}
