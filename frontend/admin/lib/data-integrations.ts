// Integraciones de datos (Gestión de precios): tipos y utilidades de rutas.
// Las rutas siguen las mismas reglas que el backend
// (app/services/data_integrations/mapping.py): `data.items[0].price`,
// `$` = documento completo y `lista[?campo==valor]` = primer elemento que coincide.

export const SECRET_MASK = "••••••••"

export interface KV {
  key: string
  value: string
  enabled: boolean
  secret?: boolean
}

export type AuthType = "none" | "bearer_token" | "api_key" | "basic_auth"

export interface RequestAuth {
  type: AuthType
  token: string
  api_key: string
  key_name: string
  add_to: "header" | "query"
  username: string
  password: string
}

export interface RequestSpec {
  method: "GET" | "POST" | "PUT" | "PATCH"
  url: string
  query: KV[]
  headers: KV[]
  body: { mode: "none" | "json" | "raw"; content: string }
  auth: RequestAuth
}

export interface FieldMapping {
  source: string
  target: string
  transform: string
  default?: string | null
}

export interface WebhookState {
  enabled: boolean
  records_path: string | null
  key_prefix: string | null
  has_keys: boolean
  rotated_at: string | null
}

export interface DataIntegrationConfig {
  target: string
  request: RequestSpec
  records_path: string
  mappings: FieldMapping[]
  options: { max_change_pct: number }
  webhook?: WebhookState
}

export interface DataIntegration {
  id: string
  name: string
  description: string | null
  is_active: boolean
  config: DataIntegrationConfig
  last_sync_at: string | null
  last_success_sync_at: string | null
}

export interface TargetField {
  key: string
  label: string
  type: "string" | "number" | "boolean"
  required: boolean
  help?: string
}

export interface TargetDef {
  label: string
  description: string
  identifier: string
  fields: TargetField[]
  options: Record<string, { label: string; default: number; help?: string }>
}

export interface SendResult {
  status: number
  ok: boolean
  elapsed_ms: number
  size_bytes: number
  truncated: boolean
  headers: Record<string, string>
  is_json: boolean
  json: unknown
  text: string | null
  final_url: string
}

export interface ChangeRow {
  sku: string | null
  product_id: string
  product_name: string
  level: "variante" | "producto"
  field: string
  old: unknown
  new: unknown
  derived?: boolean
}

export interface ApplyResult {
  dry_run: boolean
  summary: {
    records: number
    matched: number
    unmatched: number
    rejected: number
    unchanged: number
    products_changed: number
    changes: number
  }
  changes: ChangeRow[]
  rejected: { sku?: string | null; record?: number; reason: string; old?: number; new?: number }[]
  unmatched: string[]
  warnings: string[]
  mapping_errors?: { record: number; error: string }[]
  sample_records?: Record<string, string | null>[]
}

export interface SyncLog {
  id: string
  status: string
  started_at: string | null
  completed_at: string | null
  records: number
  products_updated: number
  rejected: number
  error: string | null
  detail: { source?: string; summary?: ApplyResult["summary"] } | null
}

export const emptyRequest = (): RequestSpec => ({
  method: "GET",
  url: "",
  query: [],
  headers: [{ key: "Accept", value: "application/json", enabled: true }],
  body: { mode: "none", content: "" },
  auth: { type: "none", token: "", api_key: "", key_name: "X-API-Key", add_to: "header", username: "", password: "" },
})

export const emptyConfig = (): DataIntegrationConfig => ({
  target: "product_prices",
  request: emptyRequest(),
  records_path: "",
  mappings: [],
  options: { max_change_pct: 50 },
})

// ───────── rutas ─────────

const TOKEN = /([^.[\]]+)|\[(-?\d+)\]|\[\?([^=\]]+)==([^\]]*)\]/y

function tokens(path: string) {
  let p = (path || "").trim()
  if (p === "" || p === "$") return []
  if (p.startsWith("$.")) p = p.slice(2)
  else if (p.startsWith("$[")) p = p.slice(1)
  const out: RegExpExecArray[] = []
  let pos = 0
  while (pos < p.length) {
    if (p[pos] === ".") {
      pos++
      continue
    }
    TOKEN.lastIndex = pos
    const m = TOKEN.exec(p)
    if (!m) throw new Error(`Ruta inválida: ${path}`)
    out.push(m)
    pos = TOKEN.lastIndex
  }
  return out
}

const same = (a: unknown, b: string) => {
  const v = b.trim().replace(/^['"]|['"]$/g, "")
  if (typeof a === "number") return Number(v) === a
  if (typeof a === "boolean") return String(a) === v.toLowerCase()
  return String(a) === v
}

export function getPath(doc: unknown, path: string): unknown {
  let cur: any = doc
  let toks: RegExpExecArray[]
  try {
    toks = tokens(path)
  } catch {
    return undefined
  }
  for (const m of toks) {
    if (cur === null || cur === undefined) return undefined
    if (m[1] !== undefined) {
      cur = typeof cur === "object" && !Array.isArray(cur) ? cur[m[1]] : undefined
    } else if (m[2] !== undefined) {
      const i = Number(m[2])
      cur = Array.isArray(cur) ? cur[i < 0 ? cur.length + i : i] : undefined
    } else {
      if (!Array.isArray(cur)) return undefined
      const k = m[3].trim()
      cur = cur.find((x) => x && typeof x === "object" && same((x as any)[k], m[4]))
    }
  }
  return cur
}

export const joinPath = (base: string, key: string | number) =>
  typeof key === "number" ? `${base}[${key}]` : base ? `${base}.${key}` : key

/** Primer registro según la ruta de registros (lista → primer elemento; objeto → él mismo). */
export function firstRecord(doc: unknown, recordsPath: string): unknown {
  const found = getPath(doc, recordsPath)
  return Array.isArray(found) ? found[0] : found
}

export function recordCount(doc: unknown, recordsPath: string): number | null {
  const found = getPath(doc, recordsPath)
  if (found === undefined || found === null) return null
  return Array.isArray(found) ? found.length : 1
}

/** Rutas de hojas dentro de un registro, para sugerir orígenes. */
export function leafPaths(rec: unknown, base = "", depth = 0, out: string[] = []): string[] {
  if (depth > 5 || out.length > 300) return out
  if (Array.isArray(rec)) {
    if (rec.length) leafPaths(rec[0], joinPath(base, 0), depth + 1, out)
  } else if (rec && typeof rec === "object") {
    for (const [k, v] of Object.entries(rec as Record<string, unknown>)) leafPaths(v, joinPath(base, k), depth + 1, out)
  } else if (base) {
    out.push(base)
  }
  return out
}

/**
 * Ruta absoluta (clic en el visor) → ruta relativa al registro.
 * `data.items[3].ItemPrices[0].Price` con registros `data.items` → `ItemPrices[0].Price`.
 */
export function relativeToRecord(absolute: string, recordsPath: string): string | null {
  const base = (recordsPath || "").replace(/^\$\.?/, "")
  const abs = absolute.replace(/^\$\.?/, "")
  const prefix = base ? `${base}[` : "["
  if (abs.startsWith(prefix)) {
    const rest = abs.slice(prefix.length).replace(/^-?\d+\]/, "")
    return rest.replace(/^\./, "") || "$"
  }
  if (base && abs.startsWith(`${base}.`)) return abs.slice(base.length + 1) // registros = objeto único
  return null
}

// ───────── transformaciones (presets de la UI) ─────────

export const TRANSFORM_PRESETS: { value: string; label: string; arg?: string }[] = [
  { value: "none", label: "Sin cambio" },
  { value: "trim", label: "Texto sin espacios" },
  { value: "upper", label: "Texto en mayúsculas" },
  { value: "number", label: "Número" },
  { value: "number|round:2", label: "Número (2 decimales)" },
  { value: "number|multiply", label: "Número × factor", arg: "1.18" },
  { value: "number|divide", label: "Número ÷ factor", arg: "100" },
  { value: "boolean", label: "Sí / No" },
  { value: "custom", label: "Personalizada…" },
]

export function parseTransform(t: string): { preset: string; arg: string } {
  const s = (t || "none").trim()
  const m = /^number\|(multiply|divide):([^|]+)(\|round:2)?$/.exec(s)
  if (m) return { preset: `number|${m[1]}`, arg: m[2] }
  if (TRANSFORM_PRESETS.some((p) => p.value === s && !p.arg)) return { preset: s, arg: "" }
  return { preset: "custom", arg: s }
}

export function buildTransform(preset: string, arg: string): string {
  if (preset === "number|multiply" || preset === "number|divide") return `${preset}:${arg || "1"}|round:2`
  if (preset === "custom") return arg || "none"
  return preset
}

// Vista previa local (aproximada) de la transformación; la autoritativa es la del backend.
export function previewTransform(value: unknown, chain: string): string {
  try {
    let v: any = value
    for (const step of (chain || "none").split("|")) {
      const [name, arg] = step.trim().split(":")
      if (!name || name === "none" || v === undefined || v === null) continue
      if (name === "trim") v = String(v).trim()
      else if (name === "upper") v = String(v).toUpperCase()
      else if (name === "lower") v = String(v).toLowerCase()
      else if (name === "number" || name === "integer") {
        let s = String(v).replace(/\s/g, "")
        if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(".") > s.lastIndexOf(",") ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".")
        else if (s.includes(",")) s = s.replace(",", ".")
        const n = Number(s.replace(/[^0-9.-]/g, ""))
        if (Number.isNaN(n)) return `⚠ "${value}" no es número`
        v = name === "integer" ? Math.trunc(n) : n
      } else if (name === "multiply") v = Number(v) * Number(arg || 1)
      else if (name === "divide") v = Number(v) / Number(arg || 1)
      else if (name === "round") v = Number(Number(v).toFixed(Number(arg || 2)))
      else if (name === "boolean")
        v = typeof v === "boolean" ? v : ["1", "true", "si", "sí", "y", "yes", "activo", "active", "t"].includes(String(v).trim().toLowerCase())
    }
    if (v === undefined) return "—"
    if (typeof v === "boolean") return v ? "Sí" : "No"
    return typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v)
  } catch {
    return "⚠"
  }
}
