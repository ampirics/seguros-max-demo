"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { AlertTriangle, CalendarPlus, Check, Loader2, MessageSquareText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PLATOS, rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { fechaLocal, hora12, NEGOCIO, NOMBRE_CANAL, NOMBRE_ZONA, sumarDias, ZONAS } from "@/lib/restaurante/local"
import type { Mensaje, Reserva, Zona } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const ESTADO: Record<Reserva["estado"], { t: string; c: string }> = {
  solicitada: { t: "Por confirmar", c: "bg-warning-soft text-warning" },
  confirmada: { t: "Confirmada", c: "bg-info-soft text-info" },
  recordada: { t: "Recordatorio enviado", c: "bg-info-soft text-info" },
  asistencia_confirmada: { t: "Confirmó que viene", c: "bg-success-soft text-success" },
  sentada: { t: "En el salón", c: "bg-success-soft text-success" },
  completada: { t: "Completada", c: "bg-secondary text-muted-foreground" },
  no_show: { t: "No se presentó", c: "bg-destructive-soft text-destructive" },
  cancelada: { t: "Cancelada", c: "bg-secondary text-muted-foreground" },
  lista_espera: { t: "Lista de espera", c: "bg-warning-soft text-warning" },
}

const HORAS = Array.from({ length: 26 }, (_, i) => {
  const m = 10 * 60 + 30 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
})

const activa = (r: Reserva) => ["solicitada", "confirmada", "recordada", "asistencia_confirmada", "lista_espera", "sentada"].includes(r.estado)

export function CasoRestaurante({ conversacionId, onSugerencia }: { conversacionId: string; onSugerencia: (texto: string) => void }) {
  const { estado } = useRestaurante()
  const conv = estado?.conversaciones.find((c) => c.id === conversacionId)
  const cliente = conv ? estado?.clientes.find((c) => c.id === conv.clienteId) : undefined
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [favoritos, setFavoritos] = useState<string[]>([])
  const [nueva, setNueva] = useState(false)

  useEffect(() => {
    restauranteApi.mensajes(conversacionId).then(setMensajes).catch(() => setMensajes([]))
  }, [conversacionId, conv?.actualizada])
  useEffect(() => {
    if (cliente?.id) restauranteApi.cliente(cliente.id).then((r) => setFavoritos(r.favoritos)).catch(() => setFavoritos([]))
  }, [cliente?.id])

  if (!estado) return <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-muted-foreground" />
  if (!conv || !cliente) return <p className="text-sm text-muted-foreground">Esta conversación no tiene ficha en el restaurante.</p>

  const reservas = estado.reservas.filter((r) => r.clienteId === cliente.id).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
  const vigentes = reservas.filter(activa)
  const pasos = [...mensajes].reverse().find((m) => m.de === "ia" && m.pasos?.length)?.pasos ?? []
  const nombre = cliente.nombre.split(" ")[0]

  const accion = async (a: Parameters<typeof restauranteApi.accion>[0], ok: string) => {
    try {
      await restauranteApi.accion(a)
      toast.success(ok)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4 text-sm">
      <section>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/admin/clientes/${cliente.id}`} className="block truncate font-display text-xl font-semibold hover:underline">{cliente.nombre}</Link>
            <div className="text-xs text-muted-foreground">{cliente.telefono} · llegó por {NOMBRE_CANAL[cliente.canalOrigen]}</div>
          </div>
          {cliente.etiqueta && <span className="shrink-0 rounded-full bg-acento/15 px-2 py-0.5 text-[11px]">{cliente.etiqueta}</span>}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <Cifra v={String(cliente.visitas)} t="visitas" />
          <Cifra v={rd(cliente.gasto).replace("RD$ ", "")} t="RD$ gastados" />
          <Cifra v={String(cliente.puntos)} t="puntos" />
        </div>
        {cliente.alergias?.length ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-destructive-soft px-2.5 py-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden /> Alergia: {cliente.alergias.join(", ")}
          </div>
        ) : null}
        {(cliente.preferencias.length > 0 || cliente.ocasiones.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {[...cliente.preferencias, ...cliente.ocasiones].map((p) => <span key={p} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">{p}</span>)}
          </div>
        )}
        {favoritos.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Suele pedir: {favoritos.map((f) => PLATOS.get(f)?.nombre).filter(Boolean).join(", ")}</p>
        )}
      </section>

      {pasos.length > 0 && (
        <section className="rounded-lg border bg-card p-3">
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Lo que la IA revisó en su última respuesta</h4>
          <ul className="grid gap-1.5">
            {pasos.map((p, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded", p.ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                  {p.ok ? <Check className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
                </span>
                <span>{p.resumen}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted-foreground">Reservas</h4>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setNueva((v) => !v)}>
            {nueva ? <X className="h-3.5 w-3.5" aria-hidden /> : <CalendarPlus className="h-3.5 w-3.5" aria-hidden />}
            {nueva ? "Cerrar" : "Nueva"}
          </Button>
        </div>
        {nueva && (
          <NuevaReserva
            onCreada={(r, mesa) => {
              setNueva(false)
              onSugerencia(
                mesa
                  ? `Listo, ${nombre}. Tu reserva quedó confirmada: ${NOMBRE_ZONA[r.zona]}, ${r.fecha === fechaLocal(Date.now()) ? "hoy" : r.fecha} a las ${hora12(r.hora)}, ${r.personas} personas. Tu código es ${r.codigo}.`
                  : `${nombre}, a esa hora no tenemos mesa libre. Te dejé en lista de espera y te escribo en cuanto se libere una.`,
              )
            }}
            base={{ nombre: cliente.nombre, telefono: cliente.telefono, canal: conv.canal, conversacionId: conv.id }}
          />
        )}
        {vigentes.length === 0 && !nueva && <p className="text-xs text-muted-foreground">No tiene reservas activas.</p>}
        <ul className="grid gap-2">
          {vigentes.map((r) => (
            <li key={r.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/reservaciones/${r.id}`} className="min-w-0 hover:underline">
                  <div className="font-medium">{r.fecha === fechaLocal(Date.now()) ? "Hoy" : r.fecha} · {hora12(r.hora)}</div>
                  <div className="text-xs text-muted-foreground">{r.personas} personas · {NOMBRE_ZONA[r.zona]}{r.mesaId ? ` · ${r.mesaId}` : ""} · {r.codigo}</div>
                </Link>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", ESTADO[r.estado].c)}>{ESTADO[r.estado].t}</span>
              </div>
              {r.ocasion && <div className="mt-1 text-xs text-acento">{r.ocasion}</div>}
              {r.notas && <div className="mt-1 text-xs">{r.notas}</div>}
              {r.avisos.length > 0 && <div className="mt-1 text-[11px] text-muted-foreground">Último aviso: {r.avisos[r.avisos.length - 1].texto}</div>}
              <div className="mt-2 flex flex-wrap gap-1">
                {(r.estado === "solicitada" || r.estado === "lista_espera") && (
                  <Button size="sm" className="h-7" onClick={() => accion({ tipo: "reservaEstado", reservaId: r.id, estado: "confirmada" }, "Reserva confirmada")}>Confirmar</Button>
                )}
                {r.estado === "confirmada" && (
                  <Button size="sm" variant="outline" className="h-7" onClick={() => accion({ tipo: "recordatorio", reservaId: r.id }, "Recordatorio enviado")}>Enviar recordatorio</Button>
                )}
                {r.estado !== "sentada" && (
                  <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => accion({ tipo: "reservaEstado", reservaId: r.id, estado: "cancelada", nota: "Cancelada desde la bandeja" }, "Reserva cancelada")}>Cancelar</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" aria-hidden /> Respuestas aprobadas</h4>
        <div className="grid gap-1.5">
          {[
            `Estamos en ${NEGOCIO.direccion}. Abrimos ${NEGOCIO.horario.toLowerCase()}.`,
            `${nombre}, los precios de la carta no incluyen el 18 % de ITBIS ni el 10 % de servicio de ley.`,
            `Para grupos de más de ${NEGOCIO.grupoMaximo} personas te preparamos una cotización de evento. ¿Para qué fecha y cuántas personas serían?`,
            `Te paso con nuestra encargada de salón para atenderte personalmente.`,
          ].map((t) => (
            <button key={t} onClick={() => onSugerencia(t)} className="rounded-lg border bg-card px-3 py-2 text-left text-xs hover:bg-secondary">
              {t}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function NuevaReserva({ base, onCreada }: { base: { nombre: string; telefono: string; canal: Reserva["canal"]; conversacionId: string }; onCreada: (r: Reserva, mesa: unknown) => void }) {
  const hoy = fechaLocal(Date.now())
  const [fecha, setFecha] = useState(hoy)
  const [hora, setHora] = useState("20:00")
  const [personas, setPersonas] = useState(2)
  const [zona, setZona] = useState<Zona | "cualquiera">("cualquiera")
  const [ocasion, setOcasion] = useState("")
  const [notas, setNotas] = useState("")
  const [enviando, setEnviando] = useState(false)
  const crear = async () => {
    if (personas > NEGOCIO.grupoMaximo) return toast.error(`Más de ${NEGOCIO.grupoMaximo} personas van por cotización de eventos`)
    setEnviando(true)
    try {
      const r = await restauranteApi.accion<{ reserva: Reserva; mesa: unknown }>({
        tipo: "reserva",
        reserva: { ...base, creadaPor: "bandeja", fecha, hora, personas, zona: zona === "cualquiera" ? undefined : zona, ocasion: ocasion || undefined, notas: notas || undefined },
      })
      toast.success(r.mesa ? `Reserva ${r.reserva.codigo} confirmada` : "Sin mesa a esa hora: quedó en lista de espera")
      onCreada(r.reserva, r.mesa)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="mb-3 grid gap-2 rounded-lg border bg-card p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor="rr-fecha" className="text-xs">Fecha</Label>
          <Input id="rr-fecha" type="date" min={hoy} max={sumarDias(hoy, 90)} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Hora</Label>
          <Select value={hora} onValueChange={setHora}>
            <SelectTrigger className="h-8" aria-label="Hora"><SelectValue /></SelectTrigger>
            <SelectContent>{HORAS.map((h) => <SelectItem key={h} value={h}>{hora12(h)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="rr-personas" className="text-xs">Personas</Label>
          <Input id="rr-personas" type="number" min={1} max={30} value={personas} onChange={(e) => setPersonas(Number(e.target.value))} className="h-8" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Zona</Label>
          <Select value={zona} onValueChange={(v) => setZona(v as Zona | "cualquiera")}>
            <SelectTrigger className="h-8" aria-label="Zona"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cualquiera">La mejor disponible</SelectItem>
              {ZONAS.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Input placeholder="Ocasión (cumpleaños, aniversario...)" value={ocasion} onChange={(e) => setOcasion(e.target.value)} className="h-8" aria-label="Ocasión" />
      <Textarea placeholder="Notas: alergias, silla para bebé, montaje..." value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} aria-label="Notas" />
      {personas > NEGOCIO.grupoMaximo && <p className="text-xs text-warning">Más de {NEGOCIO.grupoMaximo} personas: se cotiza como evento.</p>}
      <Button size="sm" onClick={crear} disabled={enviando}>{enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reservar y bloquear la mesa"}</Button>
    </div>
  )
}

function Cifra({ v, t }: { v: string; t: string }) {
  return (
    <div className="rounded-lg bg-secondary px-1.5 py-1.5">
      <div className="truncate font-semibold tabular-nums">{v}</div>
      <div className="text-[10px] text-muted-foreground">{t}</div>
    </div>
  )
}
