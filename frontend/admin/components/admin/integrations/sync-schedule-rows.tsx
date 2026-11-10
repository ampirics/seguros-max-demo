"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Loader2 } from "lucide-react"
import { useApi } from "@/hooks/useApi"

// Horario de un proceso automático, tal como se guarda en integration.config.sync.
export interface SyncEntry {
  enabled: boolean
  frequency: "manual" | "minutes" | "hourly" | "daily" | "weekly"
  interval_minutes?: number | null
  run_at?: string | null
  weekday?: number | null
}

export interface SyncConfig {
  prices?: SyncEntry
  customers?: SyncEntry
}

interface ProcesoDef {
  key: "prices" | "customers"
  titulo: string
  descripcion: string
  minMinutos: number
}

// Debe coincidir con MANAGED_TASKS del backend (services/scheduler/reconcile.py).
const PROCESOS: ProcesoDef[] = [
  {
    key: "prices",
    titulo: "Productos y precios",
    descripcion: "Actualiza el precio de cada variante y la visibilidad de los productos.",
    minMinutos: 15,
  },
  {
    key: "customers",
    titulo: "Clientes y contactos",
    descripcion: "Trae los clientes de SAP con sus contactos. No toca el consentimiento de marketing.",
    minMinutos: 30,
  },
]

// "Cada N horas" se guarda como minutos; el motor solo entiende minutos, horas,
// días y semanas.
const OPCIONES: Array<{ valor: string; etiqueta: string; minutos?: number }> = [
  { valor: "manual", etiqueta: "Solo manual" },
  { valor: "minutes:15", etiqueta: "Cada 15 minutos", minutos: 15 },
  { valor: "minutes:30", etiqueta: "Cada 30 minutos", minutos: 30 },
  { valor: "minutes:60", etiqueta: "Cada 1 hora", minutos: 60 },
  { valor: "minutes:120", etiqueta: "Cada 2 horas", minutos: 120 },
  { valor: "minutes:360", etiqueta: "Cada 6 horas", minutos: 360 },
  { valor: "minutes:720", etiqueta: "Cada 12 horas", minutos: 720 },
  { valor: "daily", etiqueta: "Diaria" },
  { valor: "weekly", etiqueta: "Semanal" },
]

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const VACIO: SyncEntry = { enabled: false, frequency: "manual" }

function aValor(e: SyncEntry): string {
  if (e.frequency === "minutes") return `minutes:${e.interval_minutes ?? 60}`
  if (e.frequency === "hourly") return "minutes:60"   // formato viejo
  return e.frequency
}

function desdeValor(valor: string, actual: SyncEntry): SyncEntry {
  const opcion = OPCIONES.find((o) => o.valor === valor)
  if (opcion?.minutos) {
    return { ...actual, frequency: "minutes", interval_minutes: opcion.minutos, run_at: null, weekday: null }
  }
  if (valor === "daily") {
    return { ...actual, frequency: "daily", interval_minutes: null, run_at: actual.run_at || "03:00", weekday: null }
  }
  if (valor === "weekly") {
    return {
      ...actual, frequency: "weekly", interval_minutes: null,
      run_at: actual.run_at || "03:00", weekday: actual.weekday ?? 0,
    }
  }
  return { ...actual, frequency: "manual", interval_minutes: null, run_at: null, weekday: null }
}

interface TareaResumen {
  config_key: string | null
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  source: string
  active_run: unknown | null
}

function fecha(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })
}

function EstadoUltima({ tarea }: { tarea?: TareaResumen }) {
  if (!tarea) return null
  if (tarea.active_run) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> En ejecución
      </Badge>
    )
  }
  if (!tarea.last_status) return <span className="text-xs text-muted-foreground">Nunca ejecutada</span>
  const malo = tarea.last_status === "failed" || tarea.last_status === "interrupted"
  return (
    <Badge variant={malo ? "destructive" : "default"} className="gap-1">
      {malo ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {fecha(tarea.last_run_at)}
    </Badge>
  )
}

interface Props {
  value?: SyncConfig
  onChange: (sync: SyncConfig) => void
}

/**
 * Horarios de los procesos automáticos de SAP.
 *
 * Es el único lugar donde se configuran: la pantalla de Tareas programadas
 * escribe aquí cuando se edita una tarea que sigue a la integración, así que
 * las dos vistas no pueden contradecirse.
 */
export function SyncScheduleRows({ value, onChange }: Props) {
  const { request } = useApi()
  const [tareas, setTareas] = useState<Record<string, TareaResumen>>({})

  useEffect(() => {
    request("/admin/scheduler/tasks")
      .then((d) => {
        const porClave: Record<string, TareaResumen> = {}
        for (const t of d.tasks as TareaResumen[]) if (t.config_key) porClave[t.config_key] = t
        setTareas(porClave)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actualizar = (clave: "prices" | "customers", entrada: SyncEntry) =>
    onChange({ ...(value || {}), [clave]: entrada })

  return (
    <div className="space-y-4">
      {PROCESOS.map((proceso) => {
        const entrada = value?.[proceso.key] ?? VACIO
        const tarea = tareas[proceso.key]
        const programado = entrada.frequency !== "manual"
        const opciones = OPCIONES.filter((o) => !o.minutos || o.minutos >= proceso.minMinutos)

        return (
          <div key={proceso.key} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{proceso.titulo}</div>
                <p className="text-xs text-muted-foreground">{proceso.descripcion}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor={`sync-${proceso.key}`} className="text-xs text-muted-foreground">
                  {entrada.enabled && programado ? "Activo" : "Apagado"}
                </Label>
                <Switch
                  id={`sync-${proceso.key}`}
                  checked={!!entrada.enabled && programado}
                  disabled={!programado}
                  onCheckedChange={(v) => actualizar(proceso.key, { ...entrada, enabled: v })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Frecuencia</Label>
                <Select
                  value={aValor(entrada)}
                  onValueChange={(v) => {
                    const siguiente = desdeValor(v, entrada)
                    // Al elegir un horario se enciende solo: nadie configura una
                    // frecuencia para dejarla apagada.
                    actualizar(proceso.key, {
                      ...siguiente,
                      enabled: siguiente.frequency === "manual" ? false : true,
                    })
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {opciones.map((o) => (
                      <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {entrada.frequency === "weekly" && (
                <div className="space-y-1">
                  <Label className="text-xs">Día</Label>
                  <Select
                    value={String(entrada.weekday ?? 0)}
                    onValueChange={(v) => actualizar(proceso.key, { ...entrada, weekday: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIAS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(entrada.frequency === "daily" || entrada.frequency === "weekly") && (
                <div className="space-y-1">
                  <Label className="text-xs">Hora (Santo Domingo)</Label>
                  <Input
                    type="time"
                    value={entrada.run_at || "03:00"}
                    onChange={(e) => actualizar(proceso.key, { ...entrada, run_at: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Próxima: {entrada.enabled && programado ? fecha(tarea?.next_run_at ?? null) : "—"}
              </span>
              <span className="flex items-center gap-1">Última: <EstadoUltima tarea={tarea} /></span>
              {tarea?.source === "manual" && (
                <Badge variant="outline">Desacoplada: su horario se edita en Tareas programadas</Badge>
              )}
              <Link href="/admin/cron-jobs" className="flex items-center gap-1 underline">
                Ver historial <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        Los cambios se aplican al guardar la integración. El mínimo es cada {PROCESOS[0].minMinutos} minutos
        para productos y cada {PROCESOS[1].minMinutos} para clientes.
      </p>
    </div>
  )
}
