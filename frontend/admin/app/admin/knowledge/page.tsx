"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BookOpen, Edit, Link2, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"

type KnowledgeType = "policy" | "term" | "faq"

interface KnowledgeItem {
  id: string
  type: KnowledgeType
  title: string
  content: string
  question?: string | null
  answer?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const emptyForm = {
  type: "policy" as KnowledgeType,
  title: "",
  content: "",
  question: "",
  answer: "",
  is_active: true,
}

const TYPE_LABEL: Record<string, string> = {
  policy: "Política",
  term: "Término",
  faq: "Pregunta frecuente",
  info: "Información",
}
const typeLabel = (t: string) => TYPE_LABEL[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : "")

const TYPE_OPTIONS: KnowledgeType[] = ["policy", "term", "faq"]

function TypeSelect({ id, value, onChange }: { id: string; value: KnowledgeType; onChange: (v: KnowledgeType) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as KnowledgeType)}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        {TYPE_OPTIONS.map((t) => (
          <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function AdminKnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filterType, setFilterType] = useState<KnowledgeType | "all">("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState("")
  const [importTitle, setImportTitle] = useState("")
  const [importType, setImportType] = useState<KnowledgeType>("policy")
  const [form, setForm] = useState(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const loadKnowledge = async () => {
    try {
      setLoading(true)
      const data = await apiClient.listKnowledge(filterType === "all" ? undefined : { type: filterType })
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error loading knowledge:", error)
      toast.error("No se pudo cargar el conocimiento")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKnowledge()
  }, [filterType])

  const activeCount = useMemo(() => items.filter((i) => i.is_active).length, [items])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const openNew = () => {
    resetForm()
    setFormOpen(true)
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) resetForm()
  }

  const handleEdit = (item: KnowledgeItem) => {
    setEditingId(item.id)
    setForm({
      type: item.type,
      title: item.title || "",
      content: item.content || "",
      question: item.question || "",
      answer: item.answer || "",
      is_active: item.is_active,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Título y contenido son obligatorios")
      return
    }

    try {
      setSaving(true)
      const payload = {
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim(),
        question: form.question.trim() || undefined,
        answer: form.answer.trim() || undefined,
        is_active: form.is_active,
      }

      if (editingId) {
        await apiClient.updateKnowledge(editingId, payload)
        toast.success("Registro actualizado")
      } else {
        await apiClient.createKnowledge(payload)
        toast.success("Registro creado")
      }

      setFormOpen(false)
      resetForm()
      await loadKnowledge()
    } catch (error) {
      console.error("Error saving knowledge:", error)
      toast.error("No se pudo guardar el registro")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este registro?")) return

    try {
      await apiClient.deleteKnowledge(id)
      toast.success("Registro eliminado")
      if (editingId === id) {
        resetForm()
      }
      await loadKnowledge()
    } catch (error) {
      console.error("Error deleting knowledge:", error)
      toast.error("No se pudo eliminar")
    }
  }

  const handleImport = async () => {
    if (!importUrl.trim()) {
      toast.error("Debes indicar una URL")
      return
    }

    try {
      setImporting(true)
      await apiClient.importKnowledgeFromUrl({
        url: importUrl.trim(),
        title: importTitle.trim() || undefined,
        type: importType,
      })
      toast.success("Contenido importado")
      setImportUrl("")
      setImportTitle("")
      setImportOpen(false)
      await loadKnowledge()
    } catch (error) {
      console.error("Error importing knowledge:", error)
      toast.error("No se pudo importar la URL")
    } finally {
      setImporting(false)
    }
  }

  return (
    <AdminLayout title="Conocimiento">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Políticas, términos y preguntas frecuentes que el asistente usa para responder.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" aria-hidden /> Importar desde URL
            </Button>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" aria-hidden /> Nuevo registro
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterType} onValueChange={(value) => setFilterType(value as KnowledgeType | "all")}>
            <SelectTrigger className="h-10 w-auto min-w-36 bg-card" aria-label="Tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="policy">Políticas</SelectItem>
              <SelectItem value="term">Términos</SelectItem>
              <SelectItem value="faq">Preguntas frecuentes</SelectItem>
            </SelectContent>
          </Select>
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {loading ? "…" : `${items.length} registro${items.length === 1 ? "" : "s"} · ${activeCount} activo${activeCount === 1 ? "" : "s"}`}
          </span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando registros…
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">No hay registros para el filtro seleccionado.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="divide-y overflow-hidden">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/50">
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    {!item.is_active && (
                      <span className="rounded-control bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactivo</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {typeLabel(item.type)} · Actualizado {new Date(item.updated_at).toLocaleString("es-DO")}
                  </span>
                  <span className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</span>
                  {item.question ? <span className="mt-1.5 block text-xs text-muted-foreground">Pregunta: {item.question}</span> : null}
                  {item.answer ? <span className="block text-xs text-muted-foreground">Respuesta: {item.answer}</span> : null}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Acciones de ${item.title}`}>
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                      <Edit aria-hidden /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive focus:text-destructive">
                      <Trash2 aria-hidden /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar registro" : "Nuevo registro"}</DialogTitle>
            <DialogDescription>El asistente usa este contenido como base para responder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kn-tipo">Tipo</Label>
              <TypeSelect id="kn-tipo" value={form.type} onChange={(v) => setForm((prev) => ({ ...prev, type: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kn-titulo">Título</Label>
              <Input
                id="kn-titulo"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kn-contenido">Contenido</Label>
              <Textarea
                id="kn-contenido"
                className="min-h-[150px]"
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Contenido base para el asistente"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kn-pregunta">Pregunta (opcional)</Label>
              <Input
                id="kn-pregunta"
                value={form.question}
                onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="Solo si aplica"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kn-respuesta">Respuesta (opcional)</Label>
              <Input
                id="kn-respuesta"
                value={form.answer}
                onChange={(e) => setForm((prev) => ({ ...prev, answer: e.target.value }))}
                placeholder="Solo si aplica"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              Activo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleFormOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar desde URL</DialogTitle>
            <DialogDescription>Se lee el contenido de la página y se guarda como un registro nuevo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kn-url">URL</Label>
              <Input id="kn-url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kn-url-tipo">Tipo</Label>
              <TypeSelect id="kn-url-tipo" value={importType} onChange={setImportType} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kn-url-titulo">Título (opcional)</Label>
              <Input id="kn-url-titulo" value={importTitle} onChange={(e) => setImportTitle(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importando…" : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
