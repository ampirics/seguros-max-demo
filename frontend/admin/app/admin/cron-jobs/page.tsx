"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  Loader2, Play, Pause, Square, RotateCcw, History, Pencil, Plus, Trash2, Clock,
  CheckCircle2, XCircle, AlertCircle, PauseCircle, Activity, Link2, Unlink,
} from "lucide-react"
import { useAdmin } from "@/contexts/admin-context"
import { useApi } from "@/hooks/useApi"
import { toast } from "@/components/ui/use-toast"
import { AdminLayout } from "@/components/admin/admin-layout"

// ───────────── tipos (espejo de /admin/scheduler) ─────────────

interface Run {
  id: string
  task_id: string
  status: "running" | "completed" | "failed" | "cancelled" | "interrupted" | "skipped"
  trigger: string
  triggered_by: string | null
  params: Record<string, any> | null
  progress_current: number | null
  progress_total: number | null
  progress_message: string | null
  result: Record<string, any> | null
  error: string | null
  cancel_requested: boolean
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
}

interface Task {
  id: string
  key: string
  task_type: string
  type_label: string
  handler_registered: boolean
  name: string
  description: string | null
  params: Record<string, any>
  frequency: string
  interval_minutes: number | null
  timeout_minutes: number | null
  effective_timeout_minutes?: number
  run_at: string | null
  weekday: number | null
  timezone: string
  enabled: boolean
  source: "integration" | "manual"
  config_key: string | null
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
  last_duration_seconds: number | null
  active_run: Run | null
}

interface Summary {
  total: number
  scheduled: number
  active: number
  paused: number
  running: number
  failed_last: number
}

interface TaskParam {
  name: string
  type: "int" | "bool" | "string" | "choice"
  label: string
  description: string
  default: any
  choices: string[] | null
}

interface TaskType {
  task_type: string
  label: string
  description: string
  params: TaskParam[]
}

interface Draft {
  task_type: string
  name: string
  frequency: string
  interval_minutes: string
  run_at: string
  weekday: string
  timeout_minutes: string
  params: Record<string, any>
}

const FREQUENCIES: Record<string, string> = {
  manual: "Solo manual",
  minutes: "Cada N minutos",
  hourly: "Cada hora",
  daily: "Diaria",
  weekly: "Semanal",
}
const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const STATUS_LABEL: Record<string, string> = {
  running: "En ejecución",
  completed: "Completada",
  failed: "Falló",
  cancelled: "Detenida",
  interrupted: "Interrumpida",
  skipped: "Omitida",
}

function statusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default"
  if (status === "failed" || status === "interrupted") return "destructive"
  if (status === "running") return "secondary"
  return "outline"
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5" />
  if (status === "failed" || status === "interrupted") return <XCircle className="h-3.5 w-3.5" />
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin" />
  return <AlertCircle className="h-3.5 w-3.5" />
}

// Siempre en hora de RD (el formulario programa en America/Santo_Domingo; con
// la zona del navegador un admin de viaje veía otras horas).
function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santo_Domingo" })
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—"
  if (seconds < 60) return `${Math.round(seconds)} s`
  const m = Math.floor(seconds / 60)
  return `${m} min ${Math.round(seconds % 60)} s`
}

function describeSchedule(t: Task): string {
  switch (t.frequency) {
    case "manual": return "Solo manual"
    case "minutes": return `Cada ${t.interval_minutes} min`
    case "hourly": return "Cada hora"
    case "daily": return `Diaria a las ${t.run_at ?? "—"}`
    case "weekly": return `${WEEKDAYS[t.weekday ?? 0]} a las ${t.run_at ?? "—"}`
    default: return t.frequency
  }
}

const EMPTY_DRAFT: Draft = {
  task_type: "", name: "", frequency: "manual", interval_minutes: "15", run_at: "03:00", weekday: "0", timeout_minutes: "", params: {},
}

export default function ScheduledTasksPage() {
  const { user, isLoading: authLoading } = useAdmin()
  const { request } = useApi()

  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [globalPaused, setGlobalPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [historyTask, setHistoryTask] = useState<Task | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  const typeByName = useMemo(
    () => Object.fromEntries(taskTypes.map((t) => [t.task_type, t])),
    [taskTypes],
  )

  const fail = (title: string, error: unknown) =>
    toast({
      title,
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    })

  const load = useCallback(async () => {
    try {
      const data = await request("/admin/scheduler/tasks")
      setTasks(data.tasks)
      setSummary(data.summary)
      setGlobalPaused(!!data.settings?.paused)
      setLoadError(null)
    } catch (error) {
      // Sin esto el fallo se veía como «No hay tareas todavía».
      setLoadError(error instanceof Error ? error.message : String(error))
      fail("No se pudieron cargar las tareas", error)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRuns = useCallback(async (task: Task) => {
    try {
      const data = await request(`/admin/scheduler/tasks/${task.id}/runs?limit=20`)
      setRuns(data.runs)
    } catch (error) {
      fail("No se pudo cargar el historial", error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    request("/admin/scheduler/task-types").then((d) => setTaskTypes(d.task_types)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  // Mientras algo corre, refresca cada 3 s; si no, cada 60 s y al volver a la
  // pestaña (antes una corrida lanzada por el tick nunca aparecía).
  const anyRunning = tasks.some((t) => t.active_run)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return
      load()
      if (historyTask) loadRuns(historyTask)
    }, anyRunning ? 3000 : 60000)
    const onVisible = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [anyRunning, historyTask, load, loadRuns])

  // ───────────── acciones ─────────────

  const act = async (
    task: Task, action: string, path: string, method: "POST" | "DELETE" = "POST", okMessage?: string,
  ) => {
    setBusy(`${task.id}:${action}`)
    try {
      await request(path, { method })
      if (okMessage) toast({ title: okMessage })
      await load()
    } catch (error) {
      fail("No se pudo completar la acción", error)
    } finally {
      setBusy(null)
    }
  }

  const runNow = (t: Task) =>
    act(t, "run", `/admin/scheduler/tasks/${t.id}/run`, "POST", `"${t.name}" iniciada`)
  const pauseTask = (t: Task) =>
    act(t, "pause", `/admin/scheduler/tasks/${t.id}/pause`, "POST", "Tarea pausada")
  const resumeTask = (t: Task) =>
    act(t, "resume", `/admin/scheduler/tasks/${t.id}/resume`, "POST", "Tarea reanudada")

  const stopRun = (t: Task) => {
    if (!t.active_run) return
    if (!confirm(`¿Detener la ejecución en curso de "${t.name}"?`)) return
    act(t, "stop", `/admin/scheduler/runs/${t.active_run.id}/cancel`, "POST", "Se pidió detener la ejecución")
  }

  const restartTask = (t: Task) => {
    if (!confirm(`¿Reiniciar "${t.name}"? Se detiene la ejecución actual (si hay) y se lanza una nueva.`)) return
    act(t, "restart", `/admin/scheduler/tasks/${t.id}/restart`, "POST", "Reiniciada")
  }

  const detachTask = (t: Task) => {
    if (!confirm(`"${t.name}" dejará de seguir a la integración: su horario pasará a editarse aquí.`)) return
    act(t, "detach", `/admin/scheduler/tasks/${t.id}/detach`, "POST", "Desacoplada de la integración")
  }

  const attachTask = (t: Task) => {
    if (!confirm(`"${t.name}" volverá a seguir a la integración y tomará el horario configurado allí.`)) return
    act(t, "attach", `/admin/scheduler/tasks/${t.id}/attach`, "POST", "Vuelve a seguir a la integración")
  }

  const deleteTask = (t: Task) => {
    if (!confirm(`¿Eliminar la tarea "${t.name}" y su historial?`)) return
    act(t, "delete", `/admin/scheduler/tasks/${t.id}`, "DELETE", "Tarea eliminada")
  }

  const toggleGlobal = async () => {
    const next = !globalPaused
    if (next && !confirm("¿Pausar TODAS las tareas programadas de esta empresa? Las ejecuciones manuales siguen disponibles.")) return
    try {
      await request("/admin/scheduler/settings", { method: "PUT", data: { paused: next } })
      setGlobalPaused(next)
      toast({ title: next ? "Scheduler pausado" : "Scheduler reanudado" })
    } catch (error) {
      fail("No se pudo cambiar la pausa global", error)
    }
  }

  const openHistory = (t: Task) => {
    setHistoryTask(t)
    setRuns([])
    setExpandedRun(null)
    loadRuns(t)
  }

  // ───────────── crear / editar ─────────────

  const draftFromTask = (t: Task): Draft => ({
    task_type: t.task_type,
    name: t.name,
    frequency: t.frequency,
    interval_minutes: String(t.interval_minutes ?? 15),
    run_at: t.run_at ?? "03:00",
    weekday: String(t.weekday ?? 0),
    timeout_minutes: t.timeout_minutes ? String(t.timeout_minutes) : "",
    params: { ...t.params },
  })

  const openCreate = () => {
    setDraft({ ...EMPTY_DRAFT, task_type: taskTypes[0]?.task_type ?? "" })
    setCreating(true)
  }

  const openEdit = (t: Task) => {
    setDraft(draftFromTask(t))
    setEditing(t)
  }

  const schedulePayload = () => ({
    frequency: draft.frequency,
    interval_minutes: draft.frequency === "minutes" ? Number(draft.interval_minutes) : null,
    run_at: draft.frequency === "daily" || draft.frequency === "weekly" ? draft.run_at : null,
    weekday: draft.frequency === "weekly" ? Number(draft.weekday) : null,
    // Vacío = valor por defecto del servidor (120 min)
    timeout_minutes: draft.timeout_minutes.trim() ? Number(draft.timeout_minutes) : null,
  })

  // Solo se envían los parámetros que el usuario fijó; el resto sigue heredando defaults.
  const cleanParams = () =>
    Object.fromEntries(Object.entries(draft.params).filter(([, v]) => v !== "" && v !== undefined && v !== null))

  const save = async () => {
    setSaving(true)
    try {
      if (creating) {
        await request("/admin/scheduler/tasks", {
          method: "POST",
          data: { task_type: draft.task_type, name: draft.name, params: cleanParams(), ...schedulePayload() },
        })
        toast({ title: "Tarea creada" })
        setCreating(false)
      } else if (editing) {
        await request(`/admin/scheduler/tasks/${editing.id}`, {
          method: "PATCH",
          data: { name: draft.name, params: cleanParams(), ...schedulePayload() },
        })
        toast({ title: "Tarea actualizada" })
        setEditing(null)
      }
      await load()
    } catch (error) {
      fail("No se pudo guardar", error)
    } finally {
      setSaving(false)
    }
  }

  const setParam = (name: string, value: any) =>
    setDraft((d) => ({ ...d, params: { ...d.params, [name]: value } }))

  const formHandler = typeByName[draft.task_type]
  const dialogOpen = creating || !!editing

  // ───────────── render ─────────────

  if (authLoading || loading) {
    return (
      <AdminLayout title="Tareas programadas">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Tareas programadas">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Tareas programadas</h1>
            <p className="text-muted-foreground">
              Procesos recurrentes del sistema: cuándo corren, qué pasó la última vez y control para detenerlos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={globalPaused ? "default" : "outline"} onClick={toggleGlobal}>
              {globalPaused ? <Play className="h-4 w-4 mr-2" /> : <PauseCircle className="h-4 w-4 mr-2" />}
              {globalPaused ? "Reanudar todo" : "Pausar todo"}
            </Button>
            <Button onClick={openCreate} disabled={taskTypes.length === 0}>
              <Plus className="h-4 w-4 mr-2" /> Nueva tarea
            </Button>
          </div>
        </div>

        {globalPaused && (
          <Alert variant="destructive">
            <PauseCircle className="h-4 w-4" />
            <AlertDescription>
              El scheduler está pausado: no se lanzará ninguna ejecución programada. Las ejecuciones manuales siguen funcionando.
            </AlertDescription>
          </Alert>
        )}

        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardDescription>Tareas</CardDescription></CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.total}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Programadas activas</CardDescription></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.active}</div>
                <p className="text-xs text-muted-foreground">{summary.paused} pausadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>En ejecución</CardDescription></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {summary.running}
                  {summary.running > 0 && <Activity className="h-4 w-4 animate-pulse" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Con error en la última corrida</CardDescription></CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.failed_last}</div></CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tareas</CardTitle>
            <CardDescription>
              Los horarios de la sincronización SAP se configuran en la integración. Si los cambias
              desde aquí, se guardan allí mismo: no hay dos verdades. Para que una tarea deje de
              seguir a su integración, usa “Desacoplar”.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadError && tasks.length === 0 ? (
              <div role="alert" className="py-6 text-center text-sm text-destructive">
                No se pudieron cargar las tareas: {loadError}
                <div><Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>Reintentar</Button></div>
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No hay tareas todavía. Se crean solas al activar una integración compatible, o con “Nueva tarea”.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Próxima (hora RD)</TableHead>
                    <TableHead>Última ejecución</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((t) => {
                    const running = t.active_run
                    const isBusy = (a: string) => busy === `${t.id}:${a}`
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="align-top">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.type_label}</div>
                          <div className="flex gap-1 mt-1">
                            {t.source === "integration" && <Badge variant="outline">Sigue a la integración</Badge>}
                            {!t.handler_registered && <Badge variant="destructive">Tipo no disponible</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5" /> {describeSchedule(t)}
                          </div>
                          {t.frequency !== "manual" && (
                            <Badge variant={t.enabled ? "default" : "secondary"} className="mt-1">
                              {t.enabled ? "Activa" : "Pausada"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          {t.frequency === "manual" || !t.enabled ? "—" : fmtDate(t.next_run_at)}
                        </TableCell>
                        <TableCell className="align-top">
                          {running ? (
                            <div className="space-y-1 min-w-[180px]">
                              <Badge variant="secondary" className="gap-1">
                                <StatusIcon status="running" />
                                {running.cancel_requested ? "Deteniendo…" : "En ejecución"}
                              </Badge>
                              {running.progress_total ? (
                                <Progress value={((running.progress_current ?? 0) / running.progress_total) * 100} />
                              ) : null}
                              <div className="text-xs text-muted-foreground">{running.progress_message ?? "Trabajando…"}</div>
                            </div>
                          ) : t.last_status ? (
                            <div className="space-y-1">
                              <Badge variant={statusVariant(t.last_status)} className="gap-1">
                                <StatusIcon status={t.last_status} />
                                {STATUS_LABEL[t.last_status] ?? t.last_status}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {fmtDate(t.last_run_at)} · {fmtDuration(t.last_duration_seconds)}
                              </div>
                              {t.last_error && (
                                <div className="text-xs text-destructive max-w-[260px] truncate" title={t.last_error}>
                                  {t.last_error}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Nunca ejecutada</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap justify-end gap-1">
                            {running ? (
                              <Button size="sm" variant="destructive" disabled={!!busy || running.cancel_requested} onClick={() => stopRun(t)}>
                                {isBusy("stop") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                                <span className="ml-1">Detener</span>
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled={!!busy || !t.handler_registered} onClick={() => runNow(t)}>
                                {isBusy("run") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                <span className="ml-1">Ejecutar ahora</span>
                              </Button>
                            )}
                            <Button size="sm" variant="outline" disabled={!!busy || !t.handler_registered} onClick={() => restartTask(t)} title="Detiene y vuelve a lanzar" aria-label={`Reiniciar ${t.name}`}>
                              {isBusy("restart") ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            </Button>
                            {t.frequency !== "manual" && (
                              t.enabled ? (
                                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => pauseTask(t)} title="Pausar programación">
                                  <Pause className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => resumeTask(t)} title="Reanudar programación">
                                  <Play className="h-4 w-4" />
                                </Button>
                              )
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openHistory(t)} title="Historial">
                              <History className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {t.source === "integration" ? (
                              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => detachTask(t)}
                                      title="Dejar de seguir a la integración">
                                <Unlink className="h-4 w-4" />
                              </Button>
                            ) : t.config_key ? (
                              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => attachTask(t)}
                                      title="Volver a seguir a la integración">
                                <Link2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" disabled={!!busy || !!running} onClick={() => deleteTask(t)} title="Eliminar">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial */}
      <Dialog open={!!historyTask} onOpenChange={(o) => !o && setHistoryTask(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial · {historyTask?.name}</DialogTitle>
            <DialogDescription>Últimas 20 ejecuciones.</DialogDescription>
          </DialogHeader>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin ejecuciones registradas.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div key={r.id} className="border rounded-md p-3 text-sm">
                  <button
                    className="w-full flex flex-wrap items-center justify-between gap-2 text-left"
                    onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant={statusVariant(r.status)} className="gap-1">
                        <StatusIcon status={r.status} /> {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {r.trigger === "schedule" ? "Programada" : r.trigger === "restart" ? "Reinicio" : "Manual"}
                        {r.triggered_by ? ` · ${r.triggered_by}` : ""}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {fmtDate(r.started_at)} · {fmtDuration(r.duration_seconds)}
                    </span>
                  </button>
                  {expandedRun === r.id && (
                    <div className="mt-3 space-y-2">
                      {r.error && <pre className="text-xs whitespace-pre-wrap text-destructive bg-muted p-2 rounded">{r.error}</pre>}
                      {r.params && Object.keys(r.params).length > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-1">Parámetros usados</div>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(r.params, null, 2)}</pre>
                        </div>
                      )}
                      {r.result && (
                        <div>
                          <div className="text-xs font-medium mb-1">Resultado</div>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-72">{JSON.stringify(r.result, null, 2)}</pre>
                        </div>
                      )}
                      {!r.error && !r.result && <p className="text-xs text-muted-foreground">Sin detalle.</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null) } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creating ? "Nueva tarea" : "Editar tarea"}</DialogTitle>
            <DialogDescription>
              {editing?.source === "integration"
                ? "Esta tarea sigue a la integración: el horario que guardes aquí se escribe en su configuración."
                : formHandler?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {creating && (
              <div className="space-y-2">
                <Label>Tipo de tarea</Label>
                <Select value={draft.task_type} onValueChange={(v) => setDraft({ ...draft, task_type: v, params: {} })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((t) => <SelectItem key={t.task_type} value={t.task_type}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCIES).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {draft.frequency === "minutes" && (
              <div className="space-y-2">
                <Label>Cada cuántos minutos (mínimo 5)</Label>
                <Input type="number" min={5} value={draft.interval_minutes}
                  onChange={(e) => setDraft({ ...draft, interval_minutes: e.target.value })} />
              </div>
            )}
            {draft.frequency === "weekly" && (
              <div className="space-y-2">
                <Label>Día de la semana</Label>
                <Select value={draft.weekday} onValueChange={(v) => setDraft({ ...draft, weekday: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(draft.frequency === "daily" || draft.frequency === "weekly") && (
              <div className="space-y-2">
                <Label>Hora (America/Santo_Domingo)</Label>
                <Input type="time" value={draft.run_at} onChange={(e) => setDraft({ ...draft, run_at: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Tiempo máximo por ejecución (minutos)</Label>
              <Input type="number" min={1} max={1440} placeholder="120 (por defecto)" value={draft.timeout_minutes}
                onChange={(e) => setDraft({ ...draft, timeout_minutes: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Si una ejecución tarda más, se detiene y queda como fallida para que la siguiente pueda correr.
              </p>
            </div>

            {formHandler && formHandler.params.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <div className="text-sm font-medium">Parámetros</div>
                <p className="text-xs text-muted-foreground">
                  Vacío = usa el valor por defecto (el de la integración cuando aplica).
                </p>
                {formHandler.params.map((p) => (
                  <div key={p.name} className="space-y-1">
                    <Label>{p.label}</Label>
                    {p.type === "bool" ? (
                      <div className="flex items-center gap-2">
                        <Switch checked={!!draft.params[p.name]} onCheckedChange={(v) => setParam(p.name, v)} />
                        <span className="text-xs text-muted-foreground">{p.description}</span>
                      </div>
                    ) : p.type === "choice" ? (
                      <Select value={draft.params[p.name] ?? "__default"}
                        onValueChange={(v) => setParam(p.name, v === "__default" ? "" : v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default">Por defecto</SelectItem>
                          {(p.choices ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type={p.type === "int" ? "number" : "text"} value={draft.params[p.name] ?? ""}
                        placeholder={p.default != null ? String(p.default) : ""}
                        onChange={(e) => setParam(p.name, e.target.value)} />
                    )}
                    {p.type !== "bool" && p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null) }}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !draft.name.trim() || !draft.task_type}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
