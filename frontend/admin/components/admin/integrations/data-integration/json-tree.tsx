"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, ListTree } from "lucide-react"
import { joinPath } from "@/lib/data-integrations"

// Visor de la respuesta. Cada campo se puede elegir con un clic (lo usa el
// mapeo) y cada lista se puede marcar como "los registros" a recorrer.

interface Props {
  data: unknown
  recordsPath: string
  picking: boolean
  onPickLeaf: (path: string) => void
  onPickArray: (path: string) => void
}

const MAX_ITEMS = 25

function Leaf({ value }: { value: unknown }) {
  if (value === null) return <span className="text-gray-400">null</span>
  if (typeof value === "string")
    return <span className="text-emerald-700 break-all">"{value.length > 120 ? `${value.slice(0, 120)}…` : value}"</span>
  if (typeof value === "number") return <span className="text-blue-700">{value}</span>
  if (typeof value === "boolean") return <span className="text-purple-700">{String(value)}</span>
  return <span>{String(value)}</span>
}

function Node({
  name, value, path, depth, props,
}: { name: string | number | null; value: unknown; path: string; depth: number; props: Props }) {
  const isArray = Array.isArray(value)
  const isObject = !!value && typeof value === "object"
  const [open, setOpen] = useState(depth < 2 || (isArray && props.recordsPath === path))
  const isRecords = isArray && (props.recordsPath || "") === path

  const label = name === null ? null : (
    <span className={`font-mono ${typeof name === "number" ? "text-gray-500" : "text-gray-800"}`}>
      {typeof name === "number" ? `[${name}]` : name}
      <span className="text-gray-400">: </span>
    </span>
  )

  if (!isObject) {
    return (
      <div className="pl-4 leading-6">
        <button
          type="button"
          title={props.picking ? `Usar ${path || "$"}` : path || "$"}
          onClick={() => props.onPickLeaf(path)}
          className={`text-left rounded px-1 -mx-1 ${props.picking ? "hover:bg-amber-100 ring-1 ring-amber-200" : "hover:bg-gray-100"}`}
        >
          {label}
          <Leaf value={value} />
        </button>
      </div>
    )
  }

  const entries: [string | number, unknown][] = isArray
    ? (value as unknown[]).slice(0, MAX_ITEMS).map((v, i) => [i, v])
    : Object.entries(value as Record<string, unknown>)
  const total = isArray ? (value as unknown[]).length : entries.length

  return (
    <div className={depth ? "pl-4" : ""}>
      <div className="flex items-center gap-1 leading-6">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center hover:bg-gray-100 rounded px-1 -mx-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {label}
          <span className="text-gray-500 text-xs">{isArray ? `[${total} elementos]` : `{${total} campos}`}</span>
        </button>
        {isArray && (
          <button
            type="button"
            onClick={() => props.onPickArray(path)}
            className={`ml-2 inline-flex items-center gap-1 rounded border px-1.5 text-[11px] ${
              isRecords ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
            title="Cada elemento de esta lista es un registro a procesar"
          >
            <ListTree className="h-3 w-3" />
            {isRecords ? "Registros" : "Usar como registros"}
          </button>
        )}
      </div>
      {open && (
        <div className="border-l border-gray-100 ml-1">
          {entries.map(([k, v]) => (
            <Node key={String(k)} name={k} value={v} path={joinPath(path, k)} depth={depth + 1} props={props} />
          ))}
          {isArray && total > MAX_ITEMS && (
            <div className="pl-4 text-xs text-gray-400">… {total - MAX_ITEMS} elementos más</div>
          )}
        </div>
      )}
    </div>
  )
}

export function JsonTree(props: Props) {
  return (
    <div className="font-mono text-xs overflow-auto max-h-[480px] rounded-md border bg-white p-2">
      <Node name={null} value={props.data} path="" depth={0} props={props} />
    </div>
  )
}
