"use client"

import { useState, useEffect, useRef } from "react"
import { Pencil, Trash2, Plus, StickyNote, Check, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import toast from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import apiClient from "@/lib/api-client"
import type { ConversationNote } from "@/lib/api-types"

interface ConversationNotesProps {
  conversationId: string
  currentUserId: string
  /** Nota recibida vía WS (note.created). Cada vez que cambia se agrega a la lista. */
  incomingNote?: ConversationNote | null
}

export function ConversationNotes({
  conversationId,
  currentUserId,
  incomingNote,
}: ConversationNotesProps) {
  const [notes, setNotes] = useState<ConversationNote[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState("")
  const [savingNew, setSavingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const addTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Cargar notas cuando cambia la conversación
  useEffect(() => {
    if (!conversationId) return
    const load = async () => {
      setLoading(true)
      try {
        const data = await apiClient.getNotes(conversationId)
        setNotes(Array.isArray(data) ? data : [])
      } catch {
        // Silencioso — no impacta flujo principal del chat
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [conversationId])

  // Recibir nota de WS (deduplicada)
  useEffect(() => {
    if (!incomingNote) return
    setNotes((prev) => {
      if (prev.some((n) => n.id === incomingNote.id)) return prev
      return [...prev, incomingNote]
    })
  }, [incomingNote])

  // Enfocar textarea cuando se abre el formulario
  useEffect(() => {
    if (adding) {
      setTimeout(() => addTextareaRef.current?.focus(), 50)
    }
  }, [adding])

  const handleAdd = async () => {
    const content = newContent.trim()
    if (!content) return
    setSavingNew(true)
    try {
      const note = await apiClient.createNote(conversationId, content)
      // La nota llegará también por WS — usamos deduplicación para evitar duplicar
      setNotes((prev) => {
        if (prev.some((n) => n.id === note.id)) return prev
        return [...prev, note]
      })
      setNewContent("")
      setAdding(false)
    } catch {
      toast.error("Error al guardar la nota")
    } finally {
      setSavingNew(false)
    }
  }

  const handleEdit = async (noteId: string) => {
    const content = editContent.trim()
    if (!content) return
    setSavingEdit(true)
    try {
      const updated = await apiClient.updateNote(conversationId, noteId, content)
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      setEditingId(null)
    } catch {
      toast.error("Error al actualizar la nota")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm("¿Eliminar esta nota?")) return
    try {
      await apiClient.deleteNote(conversationId, noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch {
      toast.error("Error al eliminar la nota")
    }
  }

  const startEdit = (note: ConversationNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent("")
  }

  const cancelAdd = () => {
    setAdding(false)
    setNewContent("")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-warning flex items-center gap-1">
          <StickyNote className="w-3.5 h-3.5" />
          Notas internas ({notes.length})
        </span>
        {!adding && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-xs text-warning hover:bg-warning-soft"
            onClick={() => setAdding(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-0.5" />
            Agregar
          </Button>
        )}
      </div>

      {/* Formulario nueva nota */}
      {adding && (
        <div className="mb-2 border border-warning/30 rounded-md bg-warning-soft p-2">
          <Textarea
            ref={addTextareaRef}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Escribe una nota interna..."
            className="text-xs resize-none min-h-[60px] bg-white border-warning/30 focus:border-amber-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleAdd()
              }
              if (e.key === "Escape") cancelAdd()
            }}
            disabled={savingNew}
          />
          <div className="flex gap-1 mt-1.5 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={cancelAdd}
              disabled={savingNew}
            >
              <X className="w-3 h-3 mr-0.5" />
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-xs bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleAdd}
              disabled={savingNew || !newContent.trim()}
            >
              {savingNew ? (
                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin mr-0.5" />
              ) : (
                <Check className="w-3 h-3 mr-0.5" />
              )}
              Guardar
            </Button>
          </div>
          <p className="text-[10px] text-warning mt-1">Ctrl+Enter para guardar · Esc para cancelar</p>
        </div>
      )}

      {/* Lista de notas */}
      <ScrollArea className="flex-1">
        {loading ? (
          <p className="text-xs text-gray-400 py-2 text-center">Cargando notas...</p>
        ) : notes.length === 0 ? (
          <div className="text-center py-4">
            <StickyNote className="w-8 h-8 text-amber-200 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Sin notas internas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-warning-soft border border-warning/30 rounded-md p-2 group"
              >
                {editingId === note.id ? (
                  <>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="text-xs resize-none min-h-[50px] bg-white border-warning/30"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault()
                          handleEdit(note.id)
                        }
                        if (e.key === "Escape") cancelEdit()
                      }}
                      disabled={savingEdit}
                      autoFocus
                    />
                    <div className="flex gap-1 mt-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                      >
                        <X className="w-2.5 h-2.5" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-5 px-1.5 text-[10px] bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => handleEdit(note.id)}
                        disabled={savingEdit || !editContent.trim()}
                      >
                        {savingEdit ? (
                          <div className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Check className="w-2.5 h-2.5" />
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[10px] text-warning leading-tight">
                        <span className="font-medium">{note.author_name || "Agente"}</span>
                        <br />
                        <span className="text-amber-500">
                          {formatDistanceToNow(new Date(note.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      {/* Solo el autor puede editar/eliminar */}
                      {note.author_id === currentUserId && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-warning hover:bg-warning-soft"
                            onClick={() => startEdit(note)}
                            title="Editar nota"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-destructive hover:bg-destructive-soft"
                            onClick={() => handleDelete(note.id)}
                            title="Eliminar nota"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
