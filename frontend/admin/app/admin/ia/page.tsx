"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api-client"
import { guardarModoDemo, useModoDemo } from "@/lib/config"
import type { ConfigSeguridad } from "@/lib/api/seguridad"
import { cn } from "@/lib/utils"
import { Database, Loader2, X } from "lucide-react"
import { ConfiguracionRestaurante } from "@/components/admin/asistente/ConfiguracionRestaurante"
import { useVertical } from "@/lib/vertical"

type Estilo = "cercano" | "formal" | "dominicano"
type Largo = "corto" | "normal"

interface ConfigIA {
  nombre_asistente: string
  revelar_ia: boolean
  handoff: { frases: string[]; queja: boolean; descuento: boolean; devolucion: boolean; mensaje: string; despues_de_cotizar: "vendedor" | "ia" }
  tono: { estilo: Estilo; emojis: boolean; largo: Largo }
  demora_segundos: number
  sesion_horas: number
  confianza_minima: number
  privacidad: { activo: boolean; texto: string }
  seguimiento: {
    consulta_sin_compra: boolean
    horas: number
    volvio_a_haber: boolean
    dias_volvio: number
    mantenimiento: boolean
    reglas_mantenimiento: { pieza: string; dias: number }[]
    max_por_semana: number
    cotizacion_sin_respuesta: boolean
    horas_cotizacion: number
    posventa: boolean
    dias_posventa: number
  }
  venta: { compra_sin_vendedor: boolean; monto_maximo: number }
  voz: { respuesta_audio: "nunca" | "si_nota" | "siempre"; limite_mensual: number }
  seguridad: ConfigSeguridad
}

function Numero({ id, valor, min, max, sufijo, onChange, disabled }: {
  id: string
  valor: number
  min: number
  max: number
  sufijo?: string
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Input id={id} type="number" min={min} max={max} value={valor} disabled={disabled} className="w-24 tabular-nums"
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
      {sufijo && <span className="text-sm text-muted-foreground">{sufijo}</span>}
    </div>
  )
}

const SESIONES: { valor: string; texto: string }[] = [
  { valor: "12", texto: "12 h" },
  { valor: "24", texto: "24 h" },
  { valor: "72", texto: "3 días" },
  { valor: "168", texto: "7 días" },
  { valor: "0", texto: "Nunca" },
]

interface OrigenDatos {
  activo: string
  fuentes: { clave: string; nombre: string; estado: "activo" | "proximamente"; detalle?: string }[]
  productos: number
  marcas: string[]
  actualizado: string | null
}

const ESTILOS: { valor: Estilo; texto: string; ejemplo: string }[] = [
  { valor: "cercano", texto: "Cercano", ejemplo: "Claro, para tu Tucson 2012 tengo estas opciones." },
  { valor: "formal", texto: "Formal", ejemplo: "Con gusto. Para su Tucson 2012 tengo estas opciones." },
  { valor: "dominicano", texto: "Dominicano", ejemplo: "Claro que sí, a la orden. Para tu Tucson 2012 tengo esto." },
]

function Opciones<T extends string>({ id, valor, opciones, onChange }: {
  id: string
  valor: T
  opciones: { valor: T; texto: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex gap-1 rounded-control bg-secondary p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "h-9 flex-1 truncate rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            valor === o.valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

function Fila({ id, titulo, detalle, checked, onChange }: {
  id: string
  titulo: string
  detalle?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">{titulo}</Label>
        {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  )
}

function Seccion({ titulo, detalle, children }: { titulo: string; detalle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {detalle && <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function ConfiguracionIAPage() {
  if (useVertical() === "restaurante") {
    return (
      <AdminLayout title="Configuración IA">
        <ConfiguracionRestaurante />
      </AdminLayout>
    )
  }
  return <ConfiguracionIARepuestos />
}

function ConfiguracionIARepuestos() {
  const [guardada, setGuardada] = useState<ConfigIA | null>(null)
  const [cfg, setCfg] = useState<ConfigIA | null>(null)
  const [origen, setOrigen] = useState<OrigenDatos | null>(null)
  const [frase, setFrase] = useState("")
  const [estado, setEstado] = useState<"cargando" | "normal" | "guardando" | "guardado" | "error">("cargando")
  const modoDemo = useModoDemo()

  useEffect(() => {
    Promise.all([
      apiClient.get<ConfigIA>("/ia/configuracion"),
      apiClient.get<OrigenDatos>("/ia/origen-datos").catch(() => null),
    ])
      .then(([c, o]) => { setGuardada(c); setCfg(c); setOrigen(o); setEstado("normal") })
      .catch(() => setEstado("error"))
  }, [])

  if (!cfg) {
    return (
      <AdminLayout title="Configuración IA">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          {estado === "error" ? "No se pudo cargar la configuración." : <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando…</>}
        </div>
      </AdminLayout>
    )
  }

  const cambios = JSON.stringify(cfg) !== JSON.stringify(guardada)
  const handoff = (h: Partial<ConfigIA["handoff"]>) => setCfg({ ...cfg, handoff: { ...cfg.handoff, ...h } })
  const tono = (t: Partial<ConfigIA["tono"]>) => setCfg({ ...cfg, tono: { ...cfg.tono, ...t } })
  const seg = (c: Partial<ConfigIA["seguimiento"]>) => setCfg({ ...cfg, seguimiento: { ...cfg.seguimiento, ...c } })
  const venta = (c: Partial<ConfigIA["venta"]>) => setCfg({ ...cfg, venta: { ...cfg.venta, ...c } })
  const voz = (c: Partial<ConfigIA["voz"]>) => setCfg({ ...cfg, voz: { ...cfg.voz, ...c } })
  const seguridad = (c: Partial<ConfigSeguridad>) => setCfg({ ...cfg, seguridad: { ...cfg.seguridad, ...c } })
  const regla = (i: number, c: Partial<{ pieza: string; dias: number }>) =>
    seg({ reglas_mantenimiento: cfg.seguimiento.reglas_mantenimiento.map((r, j) => (j === i ? { ...r, ...c } : r)) })

  const agregarFrase = () => {
    const f = frase.trim()
    if (f && !cfg.handoff.frases.some((x) => x.toLowerCase() === f.toLowerCase())) handoff({ frases: [...cfg.handoff.frases, f] })
    setFrase("")
  }
  const onFraseKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); agregarFrase() }
  }

  const guardar = async () => {
    setEstado("guardando")
    try {
      const nueva = await apiClient.put<ConfigIA>("/ia/configuracion", cfg)
      setGuardada(nueva); setCfg(nueva); setEstado("guardado")
    } catch {
      setEstado("error")
    }
  }

  const ejemplo = ESTILOS.find((e) => e.valor === cfg.tono.estilo)?.ejemplo ?? ""

  return (
    <AdminLayout title="Configuración IA">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Seccion titulo="Panel" detalle="Se aplica al momento y solo en este navegador; no hace falta guardar.">
            <Fila id="panel-modo-demo" titulo="Modo demo del menú"
              detalle="Deja en el menú solo CRM, Bandeja, Clientes, Inventario, Búsqueda externa, Calendario y Estadísticas. Las demás pantallas siguen en su dirección, y el modo se quita también desde el menú de usuario."
              checked={modoDemo} onChange={guardarModoDemo} />
          </Seccion>

          <Seccion titulo="Origen de datos" detalle="De dónde saca la IA las piezas, los precios y la existencia.">
            <ul className="divide-y rounded-lg border">
              {(origen?.fuentes ?? [{ clave: "sistema", nombre: "Catálogo de este sistema", estado: "activo" as const }]).map((f) => (
                <li key={f.clave} className="flex items-center gap-3 px-4 py-3">
                  <Database className={cn("h-4 w-4 shrink-0", f.estado === "activo" ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", f.estado !== "activo" && "text-muted-foreground")}>{f.nombre}</p>
                    {f.estado === "activo" && origen && (
                      <p className="text-xs text-muted-foreground">
                        {origen.productos} productos · {origen.marcas.join(" y ")}
                        {origen.actualizado && ` · actualizado ${new Date(origen.actualizado).toLocaleDateString("es-DO")}`}
                      </p>
                    )}
                  </div>
                  <Badge variant={f.estado === "activo" ? "default" : "secondary"}>{f.estado === "activo" ? "En uso" : "Próximamente"}</Badge>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion titulo="Identidad" detalle="Cómo se presenta el asistente ante el cliente.">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ia-nombre">Nombre del asistente</Label>
              <Input id="ia-nombre" value={cfg.nombre_asistente} maxLength={80}
                onChange={(e) => setCfg({ ...cfg, nombre_asistente: e.target.value })} />
            </div>
            <Fila id="ia-revelar" titulo="Presentarse como asistente virtual"
              detalle="Apagado, el asistente no lo anuncia. Si el cliente pregunta directo si es un bot, siempre responde con honestidad."
              checked={cfg.revelar_ia} onChange={(revelar_ia) => setCfg({ ...cfg, revelar_ia })} />
          </Seccion>

          <Seccion titulo="Pasar a una persona" detalle="Cuándo la IA deja la conversación a un vendedor y qué le dice al cliente.">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ia-frase">Frases que pasan a una persona</Label>
              <div className="flex flex-wrap gap-1.5">
                {cfg.handoff.frases.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-control bg-secondary py-1 pl-2.5 pr-1 text-xs">
                    {f}
                    <button type="button" aria-label={`Quitar ${f}`} onClick={() => handoff({ frases: cfg.handoff.frases.filter((x) => x !== f) })}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input id="ia-frase" value={frase} placeholder="Ej.: quiero hablar con el gerente" onChange={(e) => setFrase(e.target.value)} onKeyDown={onFraseKey} />
                <Button type="button" variant="outline" onClick={agregarFrase} disabled={!frase.trim()}>Agregar</Button>
              </div>
            </div>
            <div className="mt-2 divide-y">
              <Fila id="ia-queja" titulo="Quejas o reclamos" checked={cfg.handoff.queja} onChange={(queja) => handoff({ queja })} />
              <Fila id="ia-devolucion" titulo="Devoluciones y garantías" checked={cfg.handoff.devolucion} onChange={(devolucion) => handoff({ devolucion })} />
              <Fila id="ia-descuento" titulo="Pide descuento o rebaja"
                detalle="Apagado, la IA responde que los precios son fijos."
                checked={cfg.handoff.descuento} onChange={(descuento) => handoff({ descuento })} />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Label htmlFor="ia-mensaje">Mensaje al pasar a una persona</Label>
              <Textarea id="ia-mensaje" rows={2} maxLength={500} value={cfg.handoff.mensaje}
                onChange={(e) => handoff({ mensaje: e.target.value })} />
            </div>
          </Seccion>

          <Seccion titulo="Después de cotizar" detalle="Qué pasa cuando la IA le manda una cotización al cliente.">
            <Opciones id="ia-despues" valor={cfg.handoff.despues_de_cotizar} onChange={(despues_de_cotizar) => handoff({ despues_de_cotizar })}
              opciones={[{ valor: "vendedor", texto: "Pasa a un vendedor" }, { valor: "ia", texto: "Sigue la IA y avisa al vendedor" }]} />
            <p className="mt-2 text-xs text-muted-foreground">
              {cfg.handoff.despues_de_cotizar === "vendedor"
                ? "La conversación queda esperando a un vendedor y la IA deja de responder."
                : "La IA sigue atendiendo; el vendedor recibe el aviso para validar la cotización."}
            </p>
          </Seccion>

          <Seccion titulo="Venta sin vendedor" detalle="Si la IA puede mandar el enlace de pago de una cotización sin que un vendedor la valide.">
            <Fila id="ia-compra" titulo="Permitir pagar desde el chat" detalle="Al pagarse, la orden queda lista y la pieza apartada hasta la entrega."
              checked={cfg.venta.compra_sin_vendedor} onChange={(compra_sin_vendedor) => venta({ compra_sin_vendedor })} />
            <div className="mt-2 flex flex-col gap-2">
              <Label htmlFor="ia-monto">Monto máximo (RD$, 0 = sin tope)</Label>
              <Numero id="ia-monto" valor={cfg.venta.monto_maximo} min={0} max={10000000} disabled={!cfg.venta.compra_sin_vendedor}
                onChange={(monto_maximo) => venta({ monto_maximo })} />
              <p className="text-xs text-muted-foreground">Por encima de este total, un vendedor tiene que validar la cotización antes del pago.</p>
            </div>
          </Seccion>

          <Seccion titulo="Seguimiento por WhatsApp" detalle="Mensajes automáticos a clientes que consultaron o compraron. Nunca salen si un vendedor atiende la conversación, si el cliente pidió no recibir mensajes o si ya compró.">
            <div className="divide-y">
              <div className="pb-3">
                <Fila id="ia-seg-consulta" titulo="Consulta sin compra" detalle="Una vez, si consultó una pieza y no cotizó ni compró."
                  checked={cfg.seguimiento.consulta_sin_compra} onChange={(consulta_sin_compra) => seg({ consulta_sin_compra })} />
                <Label htmlFor="ia-seg-horas" className="text-xs text-muted-foreground">Escribir a las</Label>
                <Numero id="ia-seg-horas" valor={cfg.seguimiento.horas} min={1} max={23} sufijo="horas de la consulta (dentro de las 24 h de WhatsApp)"
                  disabled={!cfg.seguimiento.consulta_sin_compra} onChange={(horas) => seg({ horas })} />
              </div>
              <div className="py-3">
                <Fila id="ia-seg-volvio" titulo="Volvió a haber" detalle="Cuando entra al inventario una pieza que estaba agotada, a quien la pidió."
                  checked={cfg.seguimiento.volvio_a_haber} onChange={(volvio_a_haber) => seg({ volvio_a_haber })} />
                <Label htmlFor="ia-seg-dias" className="text-xs text-muted-foreground">Avisar a quien la pidió en los últimos</Label>
                <Numero id="ia-seg-dias" valor={cfg.seguimiento.dias_volvio} min={1} max={90} sufijo="días"
                  disabled={!cfg.seguimiento.volvio_a_haber} onChange={(dias_volvio) => seg({ dias_volvio })} />
              </div>
              <div className="py-3">
                <Fila id="ia-seg-mant" titulo="Recordatorio de mantenimiento" detalle="Ofrece repetir la compra cuando toca el cambio."
                  checked={cfg.seguimiento.mantenimiento} onChange={(mantenimiento) => seg({ mantenimiento })} />
                <div className="flex flex-col gap-2">
                  {cfg.seguimiento.reglas_mantenimiento.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Input aria-label="Pieza" value={r.pieza} className="w-48" disabled={!cfg.seguimiento.mantenimiento}
                        onChange={(e) => regla(i, { pieza: e.target.value })} />
                      <span className="text-sm text-muted-foreground">cada</span>
                      <Numero id={`ia-regla-${i}`} valor={r.dias} min={1} max={1095} sufijo="días" disabled={!cfg.seguimiento.mantenimiento}
                        onChange={(dias) => regla(i, { dias })} />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${r.pieza}`} disabled={!cfg.seguimiento.mantenimiento}
                        onClick={() => seg({ reglas_mantenimiento: cfg.seguimiento.reglas_mantenimiento.filter((_, j) => j !== i) })}>
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-fit" disabled={!cfg.seguimiento.mantenimiento}
                    onClick={() => seg({ reglas_mantenimiento: [...cfg.seguimiento.reglas_mantenimiento, { pieza: "", dias: 90 }] })}>
                    Agregar regla
                  </Button>
                </div>
              </div>
              <div className="py-3">
                <Fila id="ia-seg-cot" titulo="Cotización sin respuesta" detalle="Una vez por cotización enviada y vigente, si el cliente no respondió ni compró."
                  checked={cfg.seguimiento.cotizacion_sin_respuesta} onChange={(cotizacion_sin_respuesta) => seg({ cotizacion_sin_respuesta })} />
                <Label htmlFor="ia-seg-horas-cot" className="text-xs text-muted-foreground">Escribir a las</Label>
                <Numero id="ia-seg-horas-cot" valor={cfg.seguimiento.horas_cotizacion} min={24} max={168} sufijo="horas de enviada la cotización"
                  disabled={!cfg.seguimiento.cotizacion_sin_respuesta} onChange={(horas_cotizacion) => seg({ horas_cotizacion })} />
              </div>
              <div className="py-3">
                <Fila id="ia-seg-posventa" titulo="Posventa" detalle="Una vez por orden pagada, enviada o entregada: pregunta cómo le quedó la pieza."
                  checked={cfg.seguimiento.posventa} onChange={(posventa) => seg({ posventa })} />
                <Label htmlFor="ia-seg-dias-posventa" className="text-xs text-muted-foreground">Escribir a los</Label>
                <Numero id="ia-seg-dias-posventa" valor={cfg.seguimiento.dias_posventa} min={1} max={30} sufijo="días de la compra"
                  disabled={!cfg.seguimiento.posventa} onChange={(dias_posventa) => seg({ dias_posventa })} />
              </div>
              <div className="pt-3">
                <Label htmlFor="ia-seg-max">Máximo por cliente</Label>
                <Numero id="ia-seg-max" valor={cfg.seguimiento.max_por_semana} min={0} max={14} sufijo="mensajes por semana (0 = ninguno)"
                  onChange={(max_por_semana) => seg({ max_por_semana })} />
              </div>
            </div>
          </Seccion>

          <Seccion titulo="Respuestas en audio" detalle="Cuándo la IA responde con una nota de voz.">
            <Opciones id="ia-voz" valor={cfg.voz.respuesta_audio} onChange={(respuesta_audio) => voz({ respuesta_audio })}
              opciones={[{ valor: "nunca", texto: "Nunca" }, { valor: "si_nota", texto: "Si el cliente mandó nota" }, { valor: "siempre", texto: "Siempre" }]} />
            <div className="mt-3 flex flex-col gap-2">
              <Label htmlFor="ia-voz-limite">Límite al mes (0 = sin límite)</Label>
              <Numero id="ia-voz-limite" valor={cfg.voz.limite_mensual} min={0} max={1000000} sufijo="respuestas en audio"
                disabled={cfg.voz.respuesta_audio === "nunca"} onChange={(limite_mensual) => voz({ limite_mensual })} />
            </div>
          </Seccion>

          <Seccion titulo="Tono y estilo">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span id="ia-estilo" className="text-sm font-medium">Tono</span>
                <Opciones id="ia-estilo" valor={cfg.tono.estilo} onChange={(estilo) => tono({ estilo })}
                  opciones={ESTILOS.map(({ valor, texto }) => ({ valor, texto }))} />
              </div>
              <div className="flex flex-col gap-2">
                <span id="ia-largo" className="text-sm font-medium">Largo de las respuestas</span>
                <Opciones id="ia-largo" valor={cfg.tono.largo} onChange={(largo) => tono({ largo })}
                  opciones={[{ valor: "corto", texto: "Cortas" }, { valor: "normal", texto: "Normales" }]} />
              </div>
            </div>
            <Fila id="ia-emojis" titulo="Usar emojis" detalle="Como máximo uno por mensaje." checked={cfg.tono.emojis} onChange={(emojis) => tono({ emojis })} />
          </Seccion>

          <Seccion titulo="Tiempo de respuesta" detalle="Espera mínima antes de responder, para que la conversación se sienta natural.">
            <div className="flex items-center gap-4">
              <input type="range" min={0} max={15} step={1} value={cfg.demora_segundos} aria-label="Segundos de espera"
                onChange={(e) => setCfg({ ...cfg, demora_segundos: Number(e.target.value) })}
                className="h-2 flex-1 cursor-pointer accent-[hsl(var(--primary))]" />
              <span className="w-20 text-right text-sm tabular-nums">{cfg.demora_segundos === 0 ? "Inmediato" : `${cfg.demora_segundos} s`}</span>
            </div>
          </Seccion>

          <Seccion titulo="Conversación nueva" detalle="El chat con el cliente es siempre el mismo. Si cierras la conversación, o pasa este tiempo sin mensajes, la IA empieza de cero con lo que escriba después, pero recuerda su perfil y sus vehículos. En la Bandeja, las conversaciones que pasan este tiempo sin mensajes se cierran solas si no tienen cotización enviada, cita futura ni pieza apartada.">
            <div className="flex flex-col gap-2">
              <span id="ia-sesion" className="text-sm font-medium">Tiempo sin mensajes</span>
              <Opciones id="ia-sesion" valor={String(cfg.sesion_horas)} opciones={SESIONES}
                onChange={(v) => setCfg({ ...cfg, sesion_horas: Number(v) })} />
            </div>
          </Seccion>

          <Seccion titulo="Compatibilidad mínima" detalle="Si la compatibilidad está por debajo, la IA pregunta o pasa a un vendedor en vez de ofertar.">
            <div className="flex items-center gap-4">
              <input type="range" min={0} max={100} step={5} value={cfg.confianza_minima} aria-label="Compatibilidad mínima para ofertar"
                onChange={(e) => setCfg({ ...cfg, confianza_minima: Number(e.target.value) })}
                className="h-2 flex-1 cursor-pointer accent-[hsl(var(--primary))]" />
              <span className="w-20 text-right text-sm tabular-nums">{cfg.confianza_minima} %</span>
            </div>
          </Seccion>

          <Seccion titulo="Privacidad" detalle="Aviso que recibe el cliente una sola vez, en su primer mensaje. Si escribe “borrar mis datos”, la IA lo pasa a un vendedor, que borra sus datos desde la pantalla del cliente.">
            <Fila id="ia-privacidad" titulo="Enviar aviso de privacidad" checked={cfg.privacidad.activo}
              onChange={(activo) => setCfg({ ...cfg, privacidad: { ...cfg.privacidad, activo } })} />
            <div className="mt-1 flex flex-col gap-2">
              <Label htmlFor="ia-privacidad-texto">Texto del aviso</Label>
              <Textarea id="ia-privacidad-texto" rows={3} maxLength={600} value={cfg.privacidad.texto} disabled={!cfg.privacidad.activo}
                onChange={(e) => setCfg({ ...cfg, privacidad: { ...cfg.privacidad, texto: e.target.value } })} />
              <p className="text-xs text-muted-foreground">Revísalo con el asesor legal de la tienda (Ley 172-13). Vacío, se usa el texto por defecto.</p>
            </div>
          </Seccion>

          {cfg.seguridad && (
            <Seccion titulo="Seguridad de precios" detalle="Límites para notar a quien solo saca precios y qué hace la IA al pasarlos. Los clientes que ya compraron y los talleres nunca se frenan solos.">
              <Fila id="ia-seg-activo" titulo="Vigilar consultas" checked={cfg.seguridad.activo} onChange={(activo) => seguridad({ activo })} />
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ia-seg-dia">Piezas distintas en 24 horas</Label>
                  <Numero id="ia-seg-dia" valor={cfg.seguridad.consultas_dia} min={1} max={500} disabled={!cfg.seguridad.activo}
                    onChange={(consultas_dia) => seguridad({ consultas_dia })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ia-seg-semana">Piezas distintas en 7 días</Label>
                  <Numero id="ia-seg-semana" valor={cfg.seguridad.consultas_semana} min={1} max={2000} disabled={!cfg.seguridad.activo}
                    onChange={(consultas_semana) => seguridad({ consultas_semana })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ia-seg-vehiculos">Vehículos distintos en 30 días</Label>
                  <Numero id="ia-seg-vehiculos" valor={cfg.seguridad.vehiculos_distintos} min={1} max={100} disabled={!cfg.seguridad.activo}
                    onChange={(vehiculos_distintos) => seguridad({ vehiculos_distintos })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ia-seg-cot">Cotizaciones sin compra</Label>
                  <Numero id="ia-seg-cot" valor={cfg.seguridad.cotizaciones_sin_compra} min={1} max={100} disabled={!cfg.seguridad.activo}
                    onChange={(cotizaciones_sin_compra) => seguridad({ cotizaciones_sin_compra })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ia-seg-puntaje">Puntaje que se considera sospechoso</Label>
                  <Numero id="ia-seg-puntaje" valor={cfg.seguridad.puntaje_sospechoso} min={1} max={100} sufijo="de 100" disabled={!cfg.seguridad.activo}
                    onChange={(puntaje_sospechoso) => seguridad({ puntaje_sospechoso })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ia-seg-dias">Los bloqueos vencen en (0 = nunca)</Label>
                  <Numero id="ia-seg-dias" valor={cfg.seguridad.duracion_dias} min={0} max={365} sufijo="días"
                    onChange={(duracion_dias) => seguridad({ duracion_dias })} />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <span id="ia-seg-accion" className="text-sm font-medium">Al pasar un límite</span>
                <Opciones id="ia-seg-accion" valor={cfg.seguridad.accion} onChange={(accion) => seguridad({ accion })}
                  opciones={[{ valor: "avisar", texto: "Solo avisar" }, { valor: "sin_precios", texto: "Dejar de dar precios" }, { valor: "bloquear", texto: "Bloquear" }]} />
                <p className="text-xs text-muted-foreground">
                  {cfg.seguridad.accion === "avisar" ? "La IA sigue normal y el panel avisa en Seguridad."
                    : cfg.seguridad.accion === "sin_precios" ? "La IA deja de dar precios, ofrece que lo llame un vendedor y avisa en el panel."
                    : "La IA responde con el mensaje fijo y solo atiende un vendedor hasta que venza o lo desbloqueen."}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Label htmlFor="ia-seg-mensaje">Mensaje al cliente bloqueado</Label>
                <Textarea id="ia-seg-mensaje" rows={2} maxLength={300} value={cfg.seguridad.mensaje_bloqueado}
                  onChange={(e) => seguridad({ mensaje_bloqueado: e.target.value })} />
              </div>
            </Seccion>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={guardar} disabled={!cambios || estado === "guardando"}>
              {estado === "guardando" && <Loader2 className="animate-spin" aria-hidden />}
              {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
            </Button>
            {cambios && <Button type="button" variant="ghost" onClick={() => setCfg(guardada)}>Descartar</Button>}
            <p aria-live="polite" className="text-sm">
              {estado === "guardado" && !cambios && <span className="text-success">Guardado. La IA lo aplica en menos de un minuto.</span>}
              {estado === "error" && <span className="text-destructive">No se pudo guardar. Intenta de nuevo.</span>}
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start" aria-label="Vista previa">
          <p className="text-sm font-medium">Así responde</p>
          <div className="flex flex-col gap-2 rounded-lg border bg-secondary/40 p-4 text-sm">
            <p className="max-w-[85%] self-end rounded-lg bg-card px-3 py-2">Hola, tienen amortiguadores para una Tucson 2012?</p>
            <p className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2">
              {cfg.revelar_ia ? `Hola, soy ${cfg.nombre_asistente || "el asistente"}. ` : "Hola! "}
              {ejemplo}{cfg.tono.emojis ? " 🚗" : ""}
            </p>
            <p className="max-w-[85%] self-end rounded-lg bg-card px-3 py-2">{cfg.handoff.frases[0] ? `Quiero ${cfg.handoff.frases[0].replace(/^quiero /i, "")}` : "Quiero hablar con alguien"}</p>
            <p className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2">{cfg.handoff.mensaje}</p>
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
