'use client'

import { useState, useEffect, useRef } from 'react'
import { Tag, Plus, Check, X, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ChatTag } from '@/lib/api-types'
import apiClient from '@/lib/api-client'
import { TagBadge } from './TagBadge'

interface Props {
  conversationId: string
  companyTags: ChatTag[]
  selectedTags: ChatTag[]
  onTagsChange: (tags: ChatTag[]) => void
  onCompanyTagsChange: (tags: ChatTag[]) => void
}

const PRESET_COLORS = [
  '#ef4444', // rojo
  '#f97316', // naranja
  '#eab308', // amarillo
  '#22c55e', // verde
  '#3b82f6', // azul
  '#8b5cf6', // morado
  '#ec4899', // rosa
  '#6b7280', // gris
]

export function TagPicker({
  conversationId,
  companyTags,
  selectedTags,
  onTagsChange,
  onCompanyTagsChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[5])
  const [saving, setSaving] = useState(false)
  const [editingTag, setEditingTag] = useState<ChatTag | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Cerrar popover al hacer click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setEditingTag(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectedIds = new Set(selectedTags.map((t) => t.id))

  const handleToggle = async (tag: ChatTag) => {
    const newIds = selectedIds.has(tag.id)
      ? [...selectedIds].filter((id) => id !== tag.id)
      : [...selectedIds, tag.id]
    try {
      const updated = await apiClient.setConversationTags(conversationId, newIds)
      onTagsChange(updated)
    } catch {
      toast.error('Error al actualizar tags')
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const tag = await apiClient.createTag({ name: newName.trim(), color: newColor })
      onCompanyTagsChange([...companyTags, tag])
      // Asignar automáticamente a la conversación
      const newIds = [...selectedIds, tag.id]
      const updated = await apiClient.setConversationTags(conversationId, newIds)
      onTagsChange(updated)
      setNewName('')
      setCreating(false)
      toast.success('Tag creado')
    } catch {
      toast.error('Error al crear tag')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (tag: ChatTag) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const updated = await apiClient.updateTag(tag.id, { name: editName.trim(), color: editColor })
      onCompanyTagsChange(companyTags.map((t) => (t.id === updated.id ? updated : t)))
      onTagsChange(selectedTags.map((t) => (t.id === updated.id ? updated : t)))
      setEditingTag(null)
      toast.success('Tag actualizado')
    } catch {
      toast.error('Error al actualizar tag')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tag: ChatTag) => {
    if (!window.confirm(`¿Eliminar el tag "${tag.name}"?`)) return
    try {
      await apiClient.deleteTag(tag.id)
      onCompanyTagsChange(companyTags.filter((t) => t.id !== tag.id))
      onTagsChange(selectedTags.filter((t) => t.id !== tag.id))
      toast.success('Tag eliminado')
    } catch {
      toast.error('Error al eliminar tag')
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Botón disparador */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 rounded px-2 py-1 border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
      >
        <Tag className="w-3 h-3" />
        Etiquetas
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-7 z-50 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Etiquetas</span>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {companyTags.length === 0 && !creating && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">Sin etiquetas. Crea una abajo.</p>
            )}
            {companyTags.map((tag) =>
              editingTag?.id === tag.id ? (
                <div key={tag.id} className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    className="flex-1 text-xs border rounded px-1.5 py-0.5 min-w-0"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEdit(tag)}
                    autoFocus
                  />
                  <div className="flex gap-0.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                        style={{ backgroundColor: c, borderColor: editColor === c ? '#000' : 'transparent' }}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => handleEdit(tag)} disabled={saving} className="text-success hover:text-success">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setEditingTag(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer group"
                  onClick={() => handleToggle(tag)}
                >
                  <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    {selectedIds.has(tag.id) && <Check className="w-3.5 h-3.5 text-gray-700" />}
                  </div>
                  <TagBadge tag={tag} size="sm" />
                  <div className="ml-auto hidden group-hover:flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => { setEditingTag(tag); setEditName(tag.name); setEditColor(tag.color) }}
                      className="p-0.5 text-gray-400 hover:text-blue-500"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag)}
                      className="p-0.5 text-gray-400 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Crear nuevo tag */}
          <div className="border-t border-gray-100 p-2">
            {creating ? (
              <div className="space-y-2">
                <input
                  className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Nombre del tag…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
                <div className="flex items-center gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                      style={{ backgroundColor: c, borderColor: newColor === c ? '#000' : 'transparent' }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving || !newName.trim()}
                    className="flex-1 text-xs bg-primary text-primary-foreground rounded py-1 hover:bg-primary disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Guardando…' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName('') }}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 w-full"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva etiqueta
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
