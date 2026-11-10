"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { badgeVariants } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send, Plus, Loader2, FileText, Search, ChevronLeft, ChevronRight } from "lucide-react"
import apiClient from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface Campaign {
  id: string
  name: string
  status: string
  template_name: string
  total_recipients: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  created_at: string
}

const PAGE_SIZE = 20

const MUTED = "border-transparent bg-secondary text-muted-foreground hover:bg-secondary"
const STATUS_STYLES: Record<string, string> = {
  DRAFT: MUTED,
  SCHEDULED: "border-transparent bg-warning-soft text-warning hover:bg-warning-soft",
  SENDING: "border-transparent bg-info-soft text-info hover:bg-info-soft",
  SENT: "border-transparent bg-success-soft text-success hover:bg-success-soft",
  FAILED: "border-transparent bg-destructive-soft text-destructive hover:bg-destructive-soft",
  CANCELLED: MUTED,
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador", SCHEDULED: "Programada", SENDING: "Enviando",
  SENT: "Enviada", FAILED: "Fallida", CANCELLED: "Cancelada",
}
const STATUS_OPTIONS = ["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED", "CANCELLED"]

function Cifra({ n, uno, varios, className }: { n: number; uno: string; varios: string; className?: string }) {
  return (
    <span className={className}>
      <span className={cn("font-medium tabular-nums", !className && "text-foreground")}>{n.toLocaleString("es-DO")}</span>{" "}
      {n === 1 ? uno : varios}
    </span>
  )
}

export default function CampaignsListPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(0)

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) })
      if (status) params.set("status", status)
      if (search) params.set("q", search)
      const res: any = await apiClient.get(`/admin/campaigns?${params.toString()}`)
      setCampaigns(res?.items || [])
      setTotal(res?.total || 0)
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar las campañas")
    } finally { setLoading(false) }
  }, [page, status, search])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)

  return (
    <AdminLayout title="Campañas">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Envía mensajes de marketing por WhatsApp a clientes con consentimiento (opt-in).
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/campaigns/templates")}>
              <FileText className="mr-2 h-4 w-4" aria-hidden /> Plantillas
            </Button>
            <Button onClick={() => router.push("/admin/campaigns/new")}>
              <Plus className="mr-2 h-4 w-4" aria-hidden /> Nueva campaña
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-10 bg-card pl-9"
              placeholder="Buscar por nombre o plantilla"
              aria-label="Buscar campañas"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(0) }}>
              <SelectTrigger className="h-10 w-auto min-w-36 bg-card" aria-label="Estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {loading ? "…" : `${total.toLocaleString("es-DO")} campaña${total === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="font-medium">{error}</p>
              <Button variant="outline" onClick={load}>Reintentar</Button>
            </CardContent>
          </Card>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Send className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {search || status ? "No hay campañas que coincidan con el filtro." : "Aún no tienes campañas. Crea la primera con «Nueva campaña»."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="divide-y overflow-hidden">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/admin/campaigns/${c.id}`)}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">Plantilla: {c.template_name}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <Cifra n={c.total_recipients} uno="destinatario" varios="destinatarios" />
                    <Cifra n={c.sent_count} uno="enviado" varios="enviados" />
                    <Cifra n={c.delivered_count} uno="entregado" varios="entregados" />
                    <Cifra n={c.read_count} uno="leído" varios="leídos" />
                    {c.failed_count > 0 && <Cifra n={c.failed_count} uno="fallido" varios="fallidos" className="text-destructive" />}
                  </span>
                  <span className={cn(badgeVariants(), "w-fit shrink-0", STATUS_STYLES[c.status] || MUTED)}>{STATUS_LABEL[c.status] || c.status}</span>
                </button>
              ))}
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Mostrando {from}–{to} de {total}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Anterior
                </Button>
                <span className="text-sm font-medium">Página {page + 1} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}>
                  Siguiente <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
