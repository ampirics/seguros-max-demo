"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Loader2, Lock, ShieldCheck, ShieldPlus } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { fecha, hace } from "@/components/admin/customers/perfil-secciones"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { perfilApi } from "@/lib/api/perfil"
import {
  EVENTOS, NIVELES, seguridadApi, type ClienteEnRiesgo, type EventoSeguridad, type NivelSeguridad,
} from "@/lib/api/seguridad"
import { cn } from "@/lib/utils"

type Resumen = { sospechosos: number; bloqueados: number; alertas_7d: number; lista_blanca: number }
type Accion = { tipo: "bloquear" | "desbloquear"; cliente: ClienteEnRiesgo }

const FILTROS: { valor: NivelSeguridad | "todos"; texto: string }[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "sospechoso", texto: "Sospechosos" },
  { valor: "bloqueado", texto: "Bloqueados" },
  { valor: "normal", texto: "Normales" },
]

const ALERTAS = "alerta,sospechoso,bloqueo"
const HISTORIAL = "bloqueo,desbloqueo,vencido,lista_blanca"

function Tarjeta({ etiqueta, valor, clase }: { etiqueta: string; valor: number; clase?: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className={cn("mt-1 text-2xl font-semibold tabular-nums", clase)}>{valor}</dd>
    </div>
  )
}

function ListaEventos({ eventos, vacio }: { eventos: EventoSeguridad[] | null; vacio: string }) {
  if (!eventos) return <Skeleton className="h-32 w-full" />
  if (!eventos.length) return <p className="py-6 text-center text-sm text-muted-foreground">{vacio}</p>
  return (
    <ul className="divide-y">
      {eventos.map((e) => (
        <li key={e.id} className="py-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <Link href={`/admin/customers/${e.cliente_id}`} className="truncate font-medium hover:underline">{e.cliente}</Link>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.fecha ?? undefined} title={fecha(e.fecha)}>{hace(e.fecha)}</time>
          </div>
          <p className="text-xs text-muted-foreground">
            {EVENTOS[e.tipo]}{e.puntaje != null && ` · ${e.puntaje} puntos`}
            {e.automatico ? " · automático" : e.usuario ? ` · ${e.usuario}` : ""}
          </p>
          {(e.motivo || e.senales.length > 0) && <p className="mt-0.5 line-clamp-2 text-xs">{e.motivo ?? e.senales.join("; ")}</p>}
        </li>
      ))}
    </ul>
  )
}

export default function SeguridadPage() {
  const [filtro, setFiltro] = useState<NivelSeguridad | "todos">("todos")
  const [datos, setDatos] = useState<{ resumen: Resumen; items: ClienteEnRiesgo[] } | null>(null)
  const [alertas, setAlertas] = useState<EventoSeguridad[] | null>(null)
  const [historial, setHistorial] = useState<EventoSeguridad[] | null>(null)
  const [error, setError] = useState(false)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [motivo, setMotivo] = useState("")
  const [ocupado, setOcupado] = useState<string | null>(null)

  const cargar = useCallback(() => {
    seguridadApi.clientes({ nivel: filtro === "todos" ? undefined : filtro, limite: 100 })
      .then((d) => { setDatos(d); setError(false) }).catch(() => setError(true))
    seguridadApi.eventos({ tipo: ALERTAS, limite: 20 }).then(setAlertas).catch(() => setAlertas([]))
    seguridadApi.eventos({ tipo: HISTORIAL, limite: 30 }).then(setHistorial).catch(() => setHistorial([]))
  }, [filtro])

  useEffect(() => { setDatos(null); cargar() }, [cargar])

  const correr = async (clave: string, fn: () => Promise<void>) => {
    setOcupado(clave)
    try { await fn(); cargar() } catch (e: any) { toast.error(e?.message || "No se pudo completar") } finally { setOcupado(null) }
  }

  const confirmar = () => accion && correr(accion.cliente.id, async () => {
    await perfilApi.bloquear(accion.cliente.id, accion.tipo === "bloquear", motivo.trim())
    toast.success(accion.tipo === "bloquear" ? "Cliente bloqueado" : "Cliente desbloqueado")
    setAccion(null); setMotivo("")
  })

  const listaBlanca = (c: ClienteEnRiesgo) => correr(c.id, async () => {
    await perfilApi.listaBlanca(c.id, true, "agregado desde Seguridad")
    toast.success(`${c.nombre} en la lista blanca`)
  })

  return (
    <AdminLayout title="Seguridad de precios">
      <div className="space-y-5">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Quién parece estar sacando precios. El puntaje sube con muchas piezas o vehículos distintos, precios sin vehículo,
          listas y consultas que nunca terminan en compra. Los límites y qué pasa al pasarlos están en{" "}
          <Link href="/admin/ia" className="underline">Configuración IA</Link>.
        </p>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tarjeta etiqueta="Sospechosos" valor={datos?.resumen.sospechosos ?? 0} clase="text-warning" />
          <Tarjeta etiqueta="Bloqueados" valor={datos?.resumen.bloqueados ?? 0} clase="text-destructive" />
          <Tarjeta etiqueta="Alertas en 7 días" valor={datos?.resumen.alertas_7d ?? 0} />
          <Tarjeta etiqueta="En lista blanca" valor={datos?.resumen.lista_blanca ?? 0} />
        </dl>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-lg border bg-card" aria-labelledby="titulo-ranking">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <h2 id="titulo-ranking" className="font-display text-base font-semibold">Clientes por puntaje</h2>
              <div role="radiogroup" aria-label="Nivel" className="flex gap-1 rounded-control bg-secondary p-1">
                {FILTROS.map((f) => (
                  <button key={f.valor} type="button" role="radio" aria-checked={filtro === f.valor} onClick={() => setFiltro(f.valor)}
                    className={cn("h-8 rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      filtro === f.valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {f.texto}
                  </button>
                ))}
              </div>
            </div>
            {error ? (
              <div className="p-8 text-center text-sm">
                <p>No se pudo cargar la lista.</p>
                <Button variant="link" onClick={cargar}>Reintentar</Button>
              </div>
            ) : !datos ? (
              <div className="space-y-2 p-4" aria-busy="true"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : datos.items.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Nadie con señales en los últimos 30 días.</p>
            ) : (
              <ul className="divide-y">
                {datos.items.map((c) => {
                  const nivel = NIVELES[c.nivel]
                  return (
                    <li key={c.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                      <div className="w-14 shrink-0 text-center">
                        <span className={cn("text-xl font-semibold tabular-nums", c.puntaje >= 60 ? "text-destructive" : c.puntaje >= 30 ? "text-warning" : "")}>{c.puntaje}</span>
                        <span className="block text-[11px] text-muted-foreground">puntos</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/customers/${c.id}`} className="truncate font-medium hover:underline">{c.nombre}</Link>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", nivel.clase)}>{nivel.texto}</span>
                          {c.lista_blanca && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success" title={c.lista_blanca_motivo ?? undefined}>Lista blanca</span>}
                          {c.tipo !== "particular" && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{c.tipo}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.telefono ?? "Sin teléfono"}{c.ultima_consulta && ` · última consulta ${hace(c.ultima_consulta)}`}
                          {c.bloqueo_vence && ` · vence el ${fecha(c.bloqueo_vence)}`}
                        </p>
                        {c.senales.length > 0 && (
                          <ul className="mt-1 flex flex-wrap gap-1">
                            {c.senales.map((s) => <li key={s} className="rounded-control bg-secondary px-2 py-0.5 text-xs">{s}</li>)}
                          </ul>
                        )}
                        {c.bloqueo_motivo && <p className="mt-1 text-xs text-destructive">{c.bloqueo_motivo}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {c.nivel === "bloqueado" ? (
                          <Button size="sm" variant="outline" className="gap-1.5" disabled={ocupado === c.id}
                            onClick={() => setAccion({ tipo: "desbloquear", cliente: c })}>
                            <ShieldCheck className="h-4 w-4" aria-hidden /> Desbloquear
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" disabled={ocupado === c.id}
                            onClick={() => setAccion({ tipo: "bloquear", cliente: c })}>
                            <Lock className="h-4 w-4" aria-hidden /> Bloquear
                          </Button>
                        )}
                        {!c.lista_blanca && (
                          <Button size="sm" variant="ghost" className="gap-1.5" disabled={ocupado === c.id} onClick={() => listaBlanca(c)}>
                            {ocupado === c.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldPlus className="h-4 w-4" aria-hidden />} Lista blanca
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <aside className="flex min-w-0 flex-col gap-5">
            <section className="rounded-lg border bg-card px-4 py-3" aria-labelledby="titulo-alertas">
              <h2 id="titulo-alertas" className="font-display text-base font-semibold">Alertas recientes</h2>
              <ListaEventos eventos={alertas} vacio="Sin alertas." />
            </section>
            <section className="rounded-lg border bg-card px-4 py-3" aria-labelledby="titulo-historial">
              <h2 id="titulo-historial" className="font-display text-base font-semibold">Bloqueos y desbloqueos</h2>
              <ListaEventos eventos={historial} vacio="Todavía no hay bloqueos." />
            </section>
          </aside>
        </div>
      </div>

      <AlertDialog open={!!accion} onOpenChange={(o) => { if (!o) { setAccion(null); setMotivo("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{accion?.tipo === "bloquear" ? "Bloquear" : "Desbloquear"} a {accion?.cliente.nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              {accion?.tipo === "bloquear"
                ? "La IA le responde con el mensaje fijo y solo lo atiende un vendedor. Vence según la configuración de la IA."
                : "Vuelve a ser atendido normal y su puntaje empieza de cero."} Queda registrado con tu usuario y el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-seguridad">Motivo</Label>
            <Textarea id="motivo-seguridad" rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!motivo.trim() || !!ocupado} onClick={(e) => { e.preventDefault(); confirmar() }}
              className={accion?.tipo === "bloquear" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}>
              {ocupado && <Loader2 className="animate-spin" aria-hidden />} {accion?.tipo === "bloquear" ? "Bloquear" : "Desbloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
