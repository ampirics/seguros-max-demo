"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import { toast } from "react-hot-toast"
import { Loader2, UtensilsCrossed, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api-client"
import { CARTA, FUENTE_PRECIOS } from "@/lib/restaurante/carta"
import { hora12, NEGOCIO } from "@/lib/restaurante/local"
import { cn } from "@/lib/utils"

export interface ConfigIARestaurante {
  nombre_asistente: string
  revelar_ia: boolean
  handoff: { frases: string[]; queja: boolean; eventos: boolean; precio_sin_aprobar: boolean; mensaje: string }
  reservas: {
    primera: string
    ultima: string
    grupo_maximo: number
    anticipacion_dias: number
    recordatorio_horas: number
    pedir_confirmacion: boolean
    liberar_minutos: number
    lista_espera: boolean
  }
  tono: { estilo: "cercano" | "formal" | "dominicano"; trato: "tu" | "usted"; largo: "corto" | "normal" }
  voz: { respuesta_audio: "nunca" | "si_nota" | "siempre" }
  demora_segundos: number
  privacidad: { activo: boolean; texto: string }
}

const HORAS = Array.from({ length: 30 }, (_, i) => {
  const m = 9 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
})

function Seccion({ titulo, detalle, children }: { titulo: string; detalle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{titulo}</h2>
      {detalle && <p className="mt-0.5 text-sm text-muted-foreground">{detalle}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Fila({ id, titulo, detalle, checked, onChange }: { id: string; titulo: string; detalle?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">{titulo}</Label>
        {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function Opciones<T extends string>({ valor, opciones, onChange, etiqueta }: { valor: T; opciones: [T, string][]; onChange: (v: T) => void; etiqueta: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex flex-wrap gap-1 rounded-control bg-secondary p-1">
      {opciones.map(([v, t]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => onChange(v)}
          className={cn("h-8 rounded-control px-3 text-sm font-medium transition-colors", valor === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {t}
        </button>
      ))}
    </div>
  )
}

function Numero({ id, valor, min, max, sufijo, onChange }: { id: string; valor: number; min: number; max: number; sufijo: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input id={id} type="number" min={min} max={max} value={valor} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="h-9 w-24" />
      <span className="text-sm text-muted-foreground">{sufijo}</span>
    </div>
  )
}

function SelectorHora({ id, valor, onChange }: { id: string; valor: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-control border bg-background px-2 text-sm">
      {HORAS.map((h) => <option key={h} value={h}>{hora12(h)}</option>)}
    </select>
  )
}

export function ConfiguracionRestaurante() {
  const [cfg, setCfg] = useState<ConfigIARestaurante | null>(null)
  const [original, setOriginal] = useState("")
  const [frase, setFrase] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    apiClient.get<ConfigIARestaurante>("/ia/configuracion").then((c) => { setCfg(c); setOriginal(JSON.stringify(c)) }).catch(() => toast.error("No se pudo cargar la configuración"))
  }, [])

  if (!cfg) return <Skeleton className="h-96 w-full" />
  const cambiar = (f: (c: ConfigIARestaurante) => ConfigIARestaurante) => setCfg((c) => (c ? f(structuredClone(c)) : c))
  const sucio = JSON.stringify(cfg) !== original

  const guardar = async () => {
    setGuardando(true)
    try {
      const n = await apiClient.put<ConfigIARestaurante>("/ia/configuracion", cfg)
      setCfg(n)
      setOriginal(JSON.stringify(n))
      toast.success("Configuración guardada")
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  const agregarFrase = () => {
    const f = frase.trim().toLowerCase()
    if (!f) return
    cambiar((c) => ({ ...c, handoff: { ...c.handoff, frases: Array.from(new Set([...c.handoff.frases, f])) } }))
    setFrase("")
  }

  const platos = CARTA.length
  const categorias = new Set(CARTA.map((p) => p.categoria)).size
  const saludo = cfg.tono.trato === "usted" ? "¿Desea que se la reserve?" : "¿Quieres que te la reserve?"

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Seccion titulo="Origen de datos" detalle="De dónde saca la IA la carta, los precios y la disponibilidad de las mesas.">
          <div className="flex items-start gap-3 rounded-lg border bg-secondary/40 px-4 py-3">
            <UtensilsCrossed className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Carta y agenda de Boca Marina</span>
                <Badge>En uso</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {platos} platos en {categorias} categorías · precios: {FUENTE_PRECIOS} · mesas y reservas en vivo
              </p>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Identidad" detalle="Cómo se presenta el asistente ante el cliente.">
          <div className="grid gap-1.5">
            <Label htmlFor="ia-nombre">Nombre del asistente</Label>
            <Input id="ia-nombre" value={cfg.nombre_asistente} maxLength={60} onChange={(e) => cambiar((c) => ({ ...c, nombre_asistente: e.target.value }))} />
          </div>
          <Fila id="ia-revelar" titulo="Presentarse como asistente virtual" detalle="Si el cliente pregunta directo si es un bot, siempre responde con honestidad."
            checked={cfg.revelar_ia} onChange={(v) => cambiar((c) => ({ ...c, revelar_ia: v }))} />
        </Seccion>

        <Seccion titulo="Reservas" detalle="Las reglas que la IA valida antes de reservar, mover o cancelar.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ia-primera">Primera hora para reservar</Label>
              <SelectorHora id="ia-primera" valor={cfg.reservas.primera} onChange={(v) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, primera: v } }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ia-ultima">Última hora para reservar</Label>
              <SelectorHora id="ia-ultima" valor={cfg.reservas.ultima} onChange={(v) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, ultima: v } }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ia-grupo">Grupo máximo sin cotización de evento</Label>
              <Numero id="ia-grupo" valor={cfg.reservas.grupo_maximo} min={2} max={40} sufijo="personas" onChange={(n) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, grupo_maximo: n } }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ia-anticipacion">Se puede reservar con</Label>
              <Numero id="ia-anticipacion" valor={cfg.reservas.anticipacion_dias} min={1} max={365} sufijo="días de anticipación" onChange={(n) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, anticipacion_dias: n } }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ia-recordatorio">Recordatorio</Label>
              <Numero id="ia-recordatorio" valor={cfg.reservas.recordatorio_horas} min={1} max={48} sufijo="horas antes" onChange={(n) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, recordatorio_horas: n } }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ia-liberar">Liberar la mesa si no llegan</Label>
              <Numero id="ia-liberar" valor={cfg.reservas.liberar_minutos} min={5} max={120} sufijo="minutos después de la hora" onChange={(n) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, liberar_minutos: n } }))} />
            </div>
          </div>
          <Fila id="ia-confirmar" titulo="Pedir confirmación en el recordatorio" detalle="El cliente responde SÍ o NO; la reserva queda como confirmada o se libera la mesa."
            checked={cfg.reservas.pedir_confirmacion} onChange={(v) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, pedir_confirmacion: v } }))} />
          <Fila id="ia-espera" titulo="Lista de espera automática" detalle="Si no hay mesa, el cliente queda en espera y se le asigna la primera que se libere."
            checked={cfg.reservas.lista_espera} onChange={(v) => cambiar((c) => ({ ...c, reservas: { ...c.reservas, lista_espera: v } }))} />
        </Seccion>

        <Seccion titulo="Pasar al equipo" detalle="Cuándo la IA deja la conversación a una persona y qué le dice al cliente.">
          <div className="grid gap-2">
            <Label htmlFor="ia-frase">Frases que pasan a una persona</Label>
            <div className="flex flex-wrap gap-1.5">
              {cfg.handoff.frases.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                  {f}
                  <button type="button" aria-label={`Quitar ${f}`} onClick={() => cambiar((c) => ({ ...c, handoff: { ...c.handoff, frases: c.handoff.frases.filter((x) => x !== f) } }))}>
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input id="ia-frase" value={frase} placeholder="Ej.: hablar con el encargado" onChange={(e) => setFrase(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); agregarFrase() } }} />
              <Button type="button" variant="outline" onClick={agregarFrase}>Agregar</Button>
            </div>
          </div>
          <Fila id="ia-queja" titulo="Quejas y reclamos" checked={cfg.handoff.queja} onChange={(v) => cambiar((c) => ({ ...c, handoff: { ...c.handoff, queja: v } }))} />
          <Fila id="ia-eventos" titulo="Eventos y grupos grandes" detalle={`Más de ${cfg.reservas.grupo_maximo} personas, bodas y eventos privados van al equipo de eventos.`}
            checked={cfg.handoff.eventos} onChange={(v) => cambiar((c) => ({ ...c, handoff: { ...c.handoff, eventos: v } }))} />
          <Fila id="ia-precio" titulo="Precios que no están en la carta" detalle="Montajes, decoración, bebidas y paquetes: la IA no los inventa, los confirma el equipo."
            checked={cfg.handoff.precio_sin_aprobar} onChange={(v) => cambiar((c) => ({ ...c, handoff: { ...c.handoff, precio_sin_aprobar: v } }))} />
          <div className="grid gap-1.5">
            <Label htmlFor="ia-mensaje">Mensaje al pasar a una persona</Label>
            <Textarea id="ia-mensaje" rows={2} value={cfg.handoff.mensaje} onChange={(e) => cambiar((c) => ({ ...c, handoff: { ...c.handoff, mensaje: e.target.value } }))} />
          </div>
        </Seccion>

        <Seccion titulo="Tono y estilo">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 text-sm text-muted-foreground">Tono</span>
            <Opciones etiqueta="Tono" valor={cfg.tono.estilo} opciones={[["cercano", "Cercano"], ["formal", "Formal"], ["dominicano", "Dominicano"]]} onChange={(v) => cambiar((c) => ({ ...c, tono: { ...c.tono, estilo: v } }))} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 text-sm text-muted-foreground">Trato</span>
            <Opciones etiqueta="Trato" valor={cfg.tono.trato} opciones={[["tu", "Tú"], ["usted", "Usted"]]} onChange={(v) => cambiar((c) => ({ ...c, tono: { ...c.tono, trato: v } }))} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 text-sm text-muted-foreground">Largo</span>
            <Opciones etiqueta="Largo de las respuestas" valor={cfg.tono.largo} opciones={[["corto", "Cortas"], ["normal", "Normales"]]} onChange={(v) => cambiar((c) => ({ ...c, tono: { ...c.tono, largo: v } }))} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 text-sm text-muted-foreground">En audio</span>
            <Opciones etiqueta="Respuestas en audio" valor={cfg.voz.respuesta_audio} opciones={[["nunca", "Nunca"], ["si_nota", "Si mandó nota de voz"], ["siempre", "Siempre"]]} onChange={(v) => cambiar((c) => ({ ...c, voz: { respuesta_audio: v } }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ia-demora">Espera antes de responder</Label>
            <Numero id="ia-demora" valor={cfg.demora_segundos} min={0} max={20} sufijo="segundos" onChange={(n) => cambiar((c) => ({ ...c, demora_segundos: n }))} />
          </div>
        </Seccion>

        <Seccion titulo="Privacidad" detalle="Aviso que recibe el cliente una sola vez, en su primer mensaje.">
          <Fila id="ia-privacidad" titulo="Enviar aviso de privacidad" checked={cfg.privacidad.activo} onChange={(v) => cambiar((c) => ({ ...c, privacidad: { ...c.privacidad, activo: v } }))} />
          <Textarea aria-label="Texto del aviso" rows={3} value={cfg.privacidad.texto} disabled={!cfg.privacidad.activo}
            onChange={(e) => cambiar((c) => ({ ...c, privacidad: { ...c.privacidad, texto: e.target.value } }))} />
        </Seccion>

        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={guardar} disabled={!sucio || guardando} className="shadow-md">
            {guardando && <Loader2 className="animate-spin" aria-hidden />} Guardar cambios
          </Button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-xl border bg-chat p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Así responde</p>
          <div className="flex flex-col gap-2 text-sm">
            <p className="max-w-[85%] rounded-lg rounded-tl-sm bg-card px-3 py-2 shadow-sm">Hola, ¿tienen mesa para 4 este sábado a las 8 frente al mar?</p>
            <p className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-accent px-3 py-2 shadow-sm">
              {cfg.revelar_ia ? `Hola, soy ${cfg.nombre_asistente}. ` : "Hola. "}
              Sí, tengo mesa en el muelle frente al mar para 4 el sábado a las 8:00 p. m. {saludo}
            </p>
            <p className="max-w-[85%] rounded-lg rounded-tl-sm bg-card px-3 py-2 shadow-sm">Somos 20, es un cumpleaños</p>
            <p className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-accent px-3 py-2 shadow-sm">
              Para grupos de más de {cfg.reservas.grupo_maximo} personas preparamos una cotización de evento. {cfg.handoff.mensaje}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Reserva de {hora12(cfg.reservas.primera)} a {hora12(cfg.reservas.ultima)} · recordatorio {cfg.reservas.recordatorio_horas} h antes · {NEGOCIO.direccion}
          </p>
        </div>
      </aside>
    </div>
  )
}
