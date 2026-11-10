"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Bell, CheckCircle2, Globe, Instagram, MessageCircle, Mic, Phone, Send, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { restauranteApi } from "@/lib/restaurante/cliente"
import { fechaLocal, NEGOCIO, NOMBRE_CANAL, ZONAS } from "@/lib/restaurante/local"
import type { Canal, EstadoReserva, Reserva, Zona } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

export const ESTADO_RESERVA: Record<EstadoReserva, { nombre: string; clase: string; punto: string }> = {
  solicitada: { nombre: "Por confirmar", clase: "bg-warning-soft text-warning", punto: "#C9A227" },
  confirmada: { nombre: "Confirmada", clase: "bg-info-soft text-info", punto: "#4A7BD0" },
  recordada: { nombre: "Recordatorio enviado", clase: "bg-[#9B8CE8]/15 text-[#6B5BC8] dark:text-[#B9AEF2]", punto: "#9B8CE8" },
  asistencia_confirmada: { nombre: "Asistencia confirmada", clase: "bg-success-soft text-success", punto: "#2F9E5B" },
  sentada: { nombre: "En el salón", clase: "bg-[#7FCFCB]/20 text-[#1F6F6B] dark:text-[#7FCFCB]", punto: "#3FA9A4" },
  completada: { nombre: "Completada", clase: "bg-secondary text-muted-foreground", punto: "#8A9693" },
  no_show: { nombre: "No se presentó", clase: "bg-destructive-soft text-destructive", punto: "#D94F4F" },
  cancelada: { nombre: "Cancelada", clase: "bg-secondary text-muted-foreground line-through decoration-1", punto: "#B8B2A6" },
  lista_espera: { nombre: "Lista de espera", clase: "bg-[#E8866A]/15 text-[#B5532F] dark:text-[#F0A48A]", punto: "#E8866A" },
}

export const ESTADOS_ACTIVOS: EstadoReserva[] = ["solicitada", "confirmada", "recordada", "asistencia_confirmada", "lista_espera"]

export function EstadoReservaChip({ estado, className }: { estado: EstadoReserva; className?: string }) {
  const e = ESTADO_RESERVA[estado]
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", e.clase, className)}>{e.nombre}</span>
}

const ICONO_CANAL: Record<Canal, typeof MessageCircle> = { whatsapp: MessageCircle, instagram: Instagram, web: Globe, telefono: Phone, voz: Mic, presencial: User }

export function CanalChip({ canal, compacto = false }: { canal: Canal; compacto?: boolean }) {
  const Icono = ICONO_CANAL[canal]
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`Llegó por ${NOMBRE_CANAL[canal]}`}>
      <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {!compacto && NOMBRE_CANAL[canal]}
    </span>
  )
}

/** Confirmación, recordatorio y respuesta del cliente, en ese orden. */
export function Seguimiento({ r }: { r: Reserva }) {
  const conf = r.avisos.some((a) => a.tipo === "confirmacion")
  const rec = r.avisos.some((a) => a.tipo === "recordatorio")
  const resp = r.avisos.some((a) => a.tipo === "respuesta") || r.estado === "asistencia_confirmada"
  const paso = (ok: boolean, texto: string, Icono: typeof Send) => (
    <span className={cn("inline-flex items-center gap-1", ok ? "text-foreground" : "text-muted-foreground/50")} title={ok ? texto : `Sin ${texto.toLowerCase()}`}>
      <Icono className={cn("h-3.5 w-3.5", ok && "text-primary")} aria-hidden />
      <span className="hidden sm:inline">{texto}</span>
    </span>
  )
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
      {paso(conf, "Confirmación", Send)}
      {paso(rec, "Recordatorio", Bell)}
      {paso(resp, "Respondió", CheckCircle2)}
    </span>
  )
}

export function recordatorioSinRespuesta(r: Reserva) {
  return r.estado === "recordada" && !r.avisos.some((a) => a.tipo === "respuesta")
}

export function fechaHora(ts: number) {
  return new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(ts))
}

const OCASIONES = ["Cumpleaños", "Aniversario", "Propuesta de matrimonio", "Montaje romántico", "Comida de negocios", "Almuerzo familiar", "Despedida", "Baby shower"]
const CANALES: Canal[] = ["telefono", "presencial", "whatsapp", "instagram", "web", "voz"]

export function DialogoNuevaReserva({ abierto, onCerrar, fechaInicial, onCreada }: { abierto: boolean; onCerrar: () => void; fechaInicial: string; onCreada?: (r: Reserva) => void }) {
  const vacio = { nombre: "", telefono: "", fecha: fechaInicial, hora: "20:00", personas: "2", zona: "cualquiera", ocasion: "ninguna", canal: "telefono" as Canal, notas: "" }
  const [f, setF] = useState(vacio)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => {
    if (abierto) setF({ ...vacio, fecha: fechaInicial })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, fechaInicial])
  const personas = Number(f.personas)
  const grupoGrande = personas > NEGOCIO.grupoMaximo
  const fueraHorario = f.hora < NEGOCIO.primeraReserva || f.hora > NEGOCIO.ultimaReserva
  const valido = f.nombre.trim() && f.telefono.trim() && f.fecha && f.hora && personas >= 1 && !grupoGrande && !fueraHorario

  const enviar = async () => {
    if (!valido) return
    setEnviando(true)
    try {
      const res = await restauranteApi.accion<{ ok: true; reserva: Reserva; mesa: { nombre: string; zona: string } | null }>({
        tipo: "reserva",
        reserva: {
          nombre: f.nombre.trim(),
          telefono: f.telefono.trim(),
          fecha: f.fecha,
          hora: f.hora,
          personas,
          zona: f.zona === "cualquiera" ? undefined : (f.zona as Zona),
          ocasion: f.ocasion === "ninguna" ? undefined : f.ocasion,
          canal: f.canal,
          notas: f.notas.trim() || undefined,
        },
      })
      toast.success(res.mesa ? `Reserva ${res.reserva.codigo} confirmada: ${res.mesa.nombre}, ${res.mesa.zona}` : `Sin mesa a esa hora: ${res.reserva.codigo} quedó en lista de espera`)
      onCreada?.(res.reserva)
      onCerrar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nueva reserva</DialogTitle>
          <DialogDescription>El sistema asigna la mejor mesa libre de la zona y envía la confirmación al cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="nr-nombre" etiqueta="Nombre">
            <Input id="nr-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Nombre del cliente" />
          </Campo>
          <Campo id="nr-tel" etiqueta="Teléfono">
            <Input id="nr-tel" inputMode="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="809-000-0000" />
          </Campo>
          <Campo id="nr-fecha" etiqueta="Fecha">
            <Input id="nr-fecha" type="date" min={fechaLocal(Date.now())} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </Campo>
          <Campo id="nr-hora" etiqueta="Hora">
            <Input id="nr-hora" type="time" step={900} value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
          </Campo>
          <Campo id="nr-personas" etiqueta="Personas">
            <Input id="nr-personas" type="number" min={1} max={40} value={f.personas} onChange={(e) => setF({ ...f, personas: e.target.value })} />
          </Campo>
          <Campo id="nr-zona" etiqueta="Zona">
            <Select value={f.zona} onValueChange={(zona) => setF({ ...f, zona })}>
              <SelectTrigger id="nr-zona"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cualquiera">La que esté libre</SelectItem>
                {ZONAS.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo id="nr-ocasion" etiqueta="Ocasión">
            <Select value={f.ocasion} onValueChange={(ocasion) => setF({ ...f, ocasion })}>
              <SelectTrigger id="nr-ocasion"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin ocasión especial</SelectItem>
                {OCASIONES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo id="nr-canal" etiqueta="Llegó por">
            <Select value={f.canal} onValueChange={(canal) => setF({ ...f, canal: canal as Canal })}>
              <SelectTrigger id="nr-canal"><SelectValue /></SelectTrigger>
              <SelectContent>{CANALES.map((c) => <SelectItem key={c} value={c}>{NOMBRE_CANAL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <div className="sm:col-span-2">
            <Campo id="nr-notas" etiqueta="Notas para el equipo">
              <Textarea id="nr-notas" rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Alergias, silla para bebé, montaje, pedido especial" />
            </Campo>
          </div>
        </div>
        {grupoGrande && (
          <p role="alert" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
            Más de {NEGOCIO.grupoMaximo} personas no se reservan como mesa: es un evento y se cotiza aparte con el equipo de eventos.
          </p>
        )}
        {fueraHorario && !grupoGrande && (
          <p role="alert" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
            Las reservas se toman de 10:30 a. m. a 11:00 p. m.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={enviar} disabled={!valido || enviando}>{enviando ? "Reservando…" : "Reservar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DialogoMover({ r, abierto, onCerrar }: { r: Reserva; abierto: boolean; onCerrar: () => void }) {
  const [f, setF] = useState({ fecha: r.fecha, hora: r.hora, personas: String(r.personas) })
  const [enviando, setEnviando] = useState(false)
  useEffect(() => {
    if (abierto) setF({ fecha: r.fecha, hora: r.hora, personas: String(r.personas) })
  }, [abierto, r.fecha, r.hora, r.personas])
  const personas = Number(f.personas)
  const valido = f.fecha && f.hora && personas >= 1 && personas <= NEGOCIO.grupoMaximo && f.hora >= NEGOCIO.primeraReserva && f.hora <= NEGOCIO.ultimaReserva
  const guardar = async () => {
    setEnviando(true)
    try {
      const res = await restauranteApi.accion<{ ok: true; reserva: Reserva }>({ tipo: "reservaCambiar", reservaId: r.id, cambios: { fecha: f.fecha, hora: f.hora, personas } })
      toast.success(res.reserva.mesaId ? `Reserva movida: mesa ${res.reserva.mesaId}` : "Movida, pero sin mesa libre: quedó en lista de espera")
      onCerrar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Mover reserva {r.codigo}</DialogTitle>
          <DialogDescription>Se busca otra mesa libre si cambia la hora o el tamaño del grupo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo id="mv-fecha" etiqueta="Fecha">
            <Input id="mv-fecha" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </Campo>
          <Campo id="mv-hora" etiqueta="Hora">
            <Input id="mv-hora" type="time" step={900} value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
          </Campo>
          <Campo id="mv-personas" etiqueta="Personas">
            <Input id="mv-personas" type="number" min={1} max={NEGOCIO.grupoMaximo} value={f.personas} onChange={(e) => setF({ ...f, personas: e.target.value })} />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido || enviando}>{enviando ? "Moviendo…" : "Mover"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Campo({ id, etiqueta, children }: { id: string; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
    </div>
  )
}
