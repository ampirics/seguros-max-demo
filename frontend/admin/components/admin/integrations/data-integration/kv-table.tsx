"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Lock } from "lucide-react"
import type { KV } from "@/lib/data-integrations"
import { SECRET_MASK } from "@/lib/data-integrations"

// Tabla clave/valor al estilo Postman (parámetros y cabeceras). Con `allowSecret`
// una fila se puede marcar como secreta: se guarda cifrada y no vuelve a mostrarse.

interface Props {
  rows: KV[]
  onChange: (rows: KV[]) => void
  allowSecret?: boolean
  keyPlaceholder?: string
}

export function KvTable({ rows, onChange, allowSecret, keyPlaceholder = "Clave" }: Props) {
  const set = (i: number, patch: Partial<KV>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="grid grid-cols-[24px_1fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground">
          <span />
          <span>{keyPlaceholder}</span>
          <span>Valor</span>
          <span className="w-[76px]" />
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[24px_1fr_1fr_auto] gap-2 items-center">
          <Checkbox
            checked={row.enabled}
            onCheckedChange={(v) => set(i, { enabled: v === true })}
            aria-label="Incluir en la petición"
          />
          <Input value={row.key} placeholder={keyPlaceholder} className="font-mono text-xs h-8"
            onChange={(e) => set(i, { key: e.target.value })} />
          <Input
            value={row.value}
            placeholder="Valor"
            type={row.secret ? "password" : "text"}
            className="font-mono text-xs h-8"
            onFocus={() => row.secret && row.value === SECRET_MASK && set(i, { value: "" })}
            onChange={(e) => set(i, { value: e.target.value })}
          />
          <div className="flex gap-1 w-[76px] justify-end">
            {allowSecret && (
              <Button type="button" size="icon" variant={row.secret ? "secondary" : "ghost"} className="h-8 w-8"
                title={row.secret ? "Secreto: se guarda cifrado" : "Marcar como secreto"}
                onClick={() => set(i, { secret: !row.secret })}>
                <Lock className={`h-3.5 w-3.5 ${row.secret ? "text-amber-600" : "text-gray-400"}`} />
              </Button>
            )}
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Quitar"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...rows, { key: "", value: "", enabled: true }])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
      </Button>
    </div>
  )
}
