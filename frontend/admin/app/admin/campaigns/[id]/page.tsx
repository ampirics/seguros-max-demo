"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Send, ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react"
import apiClient from "@/lib/api-client"

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador", SCHEDULED: "Programada", SENDING: "Enviando",
  SENT: "Enviada", FAILED: "Fallida", CANCELLED: "Cancelada",
}
const REC_LABEL: Record<string, string> = {
  PENDING: "Pendiente", QUEUED: "En cola", SENT: "Enviado", DELIVERED: "Entregado",
  READ: "Leído", FAILED: "Fallido", OPTED_OUT: "Baja", SKIPPED: "Omitido",
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card><CardContent className="py-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </CardContent></Card>
  )
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [campaign, setCampaign] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [recipients, setRecipients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const [c, s, r]: any = await Promise.all([
        apiClient.get(`/admin/campaigns/${id}`),
        apiClient.get(`/admin/campaigns/${id}/stats`),
        apiClient.get(`/admin/campaigns/${id}/recipients`),
      ])
      setCampaign(c); setStats(s); setRecipients(r?.items || [])
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la campaña")
    } finally { setLoading(false) }
  }

  useEffect(() => { if (id) load() }, [id])

  // Auto-refresh mientras envía y tras enviar (los estados delivered/read de Meta
  // llegan de forma asíncrona segundos/minutos después del envío).
  useEffect(() => {
    if (campaign?.status !== "SENDING" && campaign?.status !== "SENT") return
    const interval = campaign?.status === "SENDING" ? 4000 : 8000
    const t = setInterval(load, interval)
    return () => clearInterval(t)
  }, [campaign?.status])

  const send = async () => {
    let count: number | null = null
    try {
      const res: any = await apiClient.post("/admin/campaigns/preview-audience", { segment_definition: campaign?.segment_definition || {} })
      count = typeof res?.count === "number" ? res.count : null
    } catch { /* si falla, se confirma sin número */ }
    const typed = prompt(
      `Se enviará «${campaign?.template_name}» a ${count ?? "los"} contacto(s) con opt-in. Es un envío real.\n\n` +
      (count != null ? `Escribe ${count} para confirmar:` : `Escribe ENVIAR para confirmar:`)
    )
    if (typed === null) return
    if (typed.trim() !== (count != null ? String(count) : "ENVIAR")) { setError("La confirmación no coincide: no se envió nada."); return }
    setBusy(true); setError(null)
    try { await apiClient.post(`/admin/campaigns/${id}/send`, {}); await load() }
    catch (e: any) { setError(e?.message || "No se pudo enviar") }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!confirm("¿Eliminar esta campaña?")) return
    setBusy(true)
    try { await apiClient.delete(`/admin/campaigns/${id}`); router.push("/admin/campaigns") }
    catch (e: any) { setError(e?.message || "No se pudo eliminar"); setBusy(false) }
  }

  if (loading) return <AdminLayout title="Campañas"><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div></AdminLayout>
  if (error && !campaign) return <AdminLayout title="Campañas"><div className="max-w-4xl mx-auto p-4 text-red-600">{error}</div></AdminLayout>

  const canSend = campaign?.status === "DRAFT" || campaign?.status === "SCHEDULED"
  const canDelete = campaign?.status === "DRAFT" || campaign?.status === "SCHEDULED"

  return (
    <AdminLayout title="Campañas">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/campaigns")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{campaign?.name}</h1>
            <p className="text-sm text-gray-400">Plantilla: {campaign?.template_name} · {campaign?.language_code}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{STATUS_LABEL[campaign?.status] || campaign?.status}</Badge>
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
            {canSend && (
              <Button className="bg-primary hover:bg-primary/90" onClick={send} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Enviar
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" onClick={remove} disabled={busy}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <Stat label="Total" value={stats?.total_recipients ?? 0} color="text-gray-900" />
          <Stat label="Enviados" value={stats?.sent_count ?? 0} color="text-green-600" />
          <Stat label="Entregados" value={stats?.delivered_count ?? 0} color="text-blue-600" />
          <Stat label="Leídos" value={stats?.read_count ?? 0} color="text-indigo-600" />
          <Stat label="Fallidos" value={stats?.failed_count ?? 0} color="text-red-600" />
          <Stat label="Bajas" value={stats?.opted_out_count ?? 0} color="text-amber-600" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Destinatarios ({recipients.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                  <tr><th className="p-2">Teléfono</th><th className="p-2">Estado</th><th className="p-2">Intentos</th><th className="p-2">Error</th></tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 font-mono">{r.phone_e164}</td>
                      <td className="p-2">{REC_LABEL[r.status] || r.status}</td>
                      <td className="p-2">{r.attempts}</td>
                      <td className="p-2 text-red-500 text-xs">{r.error_message || ""}</td>
                    </tr>
                  ))}
                  {recipients.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-400">Aún no hay destinatarios materializados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
