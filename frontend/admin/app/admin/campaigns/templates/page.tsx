"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { FileText, ArrowLeft, Loader2, RefreshCw, Plus, AlertTriangle, CheckCircle } from "lucide-react"
import apiClient from "@/lib/api-client"

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
  PAUSED: "bg-gray-100 text-gray-600",
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [name, setName] = useState("")
  const [language, setLanguage] = useState("es")
  const [category, setCategory] = useState("MARKETING")
  const [body, setBody] = useState("")
  const [footer, setFooter] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const detectedVars = Array.from(new Set((body.match(/\{\{\s*(\d+)\s*\}\}/g) || []).map((m) => m.replace(/[^\d]/g, ""))))
  const [examples, setExamples] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res: any = await apiClient.get("/admin/campaigns/templates/meta")
      if (res?.success === false) setError(res.error || "Error al listar plantillas")
      else setTemplates(res?.templates || [])
    } catch (e: any) { setError(e?.message || "Error al listar plantillas") }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name || !body) { setFormMsg({ ok: false, text: "Nombre y contenido son obligatorios" }); return }
    setSubmitting(true); setFormMsg(null)
    try {
      const example_values = detectedVars.map((n) => examples[n] || "")
      const res: any = await apiClient.post("/admin/campaigns/templates/meta", {
        name, language, category, body_text: body, footer: footer || null, example_values,
      })
      if (res?.success) {
        setFormMsg({ ok: true, text: `Plantilla "${res.name}" enviada a Meta (estado: ${res.status}). La aprobación puede tardar minutos.` })
        setName(""); setBody(""); setFooter(""); setExamples({})
        load()
      } else {
        setFormMsg({ ok: false, text: res?.error || "No se pudo crear la plantilla" })
      }
    } catch (e: any) { setFormMsg({ ok: false, text: e?.message || "Error al crear" }) }
    finally { setSubmitting(false) }
  }

  return (
    <AdminLayout title="Campañas">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/campaigns")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver a campañas
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Plantillas de WhatsApp
          </h1>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Las plantillas se crean directamente en Meta y quedan en <b>PENDING</b> hasta que
          Meta las apruebe (usualmente minutos). Solo las <b>APPROVED</b> se pueden usar en campañas.
        </div>

        {/* Crear */}
        <Card>
          <CardHeader><CardTitle className="text-base">Crear nueva plantilla</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Label>Nombre (minúsculas, sin espacios)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="reunion_padres" />
              </div>
              <div>
                <Label>Idioma</Label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="es">es</option>
                  <option value="es_DO">es_DO</option>
                  <option value="en">en</option>
                  <option value="en_US">en_US</option>
                </select>
              </div>
              <div>
                <Label>Categoría</Label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Contenido del mensaje</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder={"Estimada familia,\n\nLe recordamos la reunión del {{1}} a las {{2}}.\n\nResponda STOP para no recibir más mensajes."} />
              <p className="text-xs text-gray-500 mt-1">Usa {"{{1}}"}, {"{{2}}"} para variables. Incluye instrucción de baja (STOP) en marketing.</p>
            </div>
            {detectedVars.length > 0 && (
              <div>
                <Label>Ejemplos para las variables (requerido por Meta)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {detectedVars.map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-10">{`{{${n}}}`}</span>
                      <Input value={examples[n] || ""} placeholder={`ejemplo ${n}`}
                        onChange={(e) => setExamples((p) => ({ ...p, [n]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Pie de página (opcional, máx 60)</Label>
              <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Colegio X · Responde STOP para baja" />
            </div>
            {formMsg && (
              <div className={`text-sm flex items-start gap-2 ${formMsg.ok ? "text-green-700" : "text-red-600"}`}>
                {formMsg.ok ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
                <span>{formMsg.text}</span>
              </div>
            )}
            <div className="flex justify-end">
              <Button className="bg-primary hover:bg-primary/90" onClick={create} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Crear y enviar a Meta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Listado */}
        <Card>
          <CardHeader><CardTitle className="text-base">Plantillas en Meta ({templates.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : error ? (
              <div className="p-6 text-center text-red-600 text-sm">{error}</div>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                    <tr><th className="p-2">Nombre</th><th className="p-2">Estado</th><th className="p-2">Categoría</th><th className="p-2">Idioma</th></tr>
                  </thead>
                  <tbody>
                    {templates.map((t, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{t.name}</td>
                        <td className="p-2"><Badge className={STATUS_STYLE[t.status] || ""}>{t.status}</Badge></td>
                        <td className="p-2">{t.category}</td>
                        <td className="p-2">{t.language}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
