"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { ArrowLeft, Check, Clock, Copy, ExternalLink, Loader2, Minus, PhoneCall, Play, RotateCcw, Search, Send, SkipForward, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  normalizarTelefono, normalizarTexto, opcionesDe, pruebasApi, textoTelefonoLibre, urlSimulador,
  type CasoDetalle, type CasoResumen, type ConversacionPrueba, type EstadoPruebas, type Evaluacion,
  type MensajePrueba, type OpcionInteractiva, type PasoCaso, type PedidoMensaje, type ResultadoRegla,
} from "../api"

const TELEFONO_POR_DEFECTO = "+18095550101"
const TODOS = "todos"
const ESPERA_SIN_RESPUESTA_MS = 25_000

type Asignacion = number | "libre"

const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }) : ""

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" }) : "—"

function minutosHasta(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
}

const MODO_INICIO: Record<string, string> = {
  nuevo: "Cliente nuevo: borra todo lo del teléfono",
  "solo-conversacion": "Solo la conversación: conserva el cliente y su historial",
  conocido: "Cliente conocido: borra todo y siembra el perfil",
  no: "Sigue la conversación del caso anterior, sin reiniciar",
}

const ENTRADA: Record<string, string> = {
  boton: "Toca el botón", lista: "Elige de la lista", rafaga: "Ráfaga", audio: "Nota de voz", foto: "Foto",
  documento: "Documento", ubicacion: "Ubicación", sticker: "Sticker", web: "Chat web", accion: "Acción del vendedor",
}

function textoEntrada(paso: PasoCaso): string {
  const e = paso.entrada
  return e.tipo === "cliente" ? e.texto : `${ENTRADA[e.tipo] ?? e.tipo}: ${e.texto}`
}

function coincideOpcion(valor: string | number | undefined, opcion: OpcionInteractiva, indice: number): boolean {
  if (valor === undefined) return false
  if (typeof valor === "number") return valor === indice + 1
  const buscado = normalizarTexto(String(valor))
  const titulo = normalizarTexto(opcion.titulo)
  return titulo === buscado || titulo.includes(buscado)
}

function textosDelPaso(paso: PasoCaso, opciones: OpcionInteractiva[]): string[] {
  const e = paso.entrada
  if (e.tipo === "rafaga") return (e.partes ?? []).map(normalizarTexto)
  if (e.tipo === "boton" || e.tipo === "lista") {
    const valor = e.valor ?? e.texto
    const elegida = opciones.find((o, i) => coincideOpcion(valor, o, i))
    return [normalizarTexto(String(valor)), ...(elegida ? [normalizarTexto(elegida.titulo), normalizarTexto(elegida.id)] : [])]
  }
  return [normalizarTexto(e.texto)]
}

function alinear(mensajes: MensajePrueba[], detalle: CasoDetalle | null, ignorar: Set<string>): Record<string, Asignacion> {
  const salida: Record<string, Asignacion> = {}
  if (!detalle) return salida
  let ultimo = 0
  let opciones: OpcionInteractiva[] = []
  for (const m of mensajes) {
    if (m.bot && m.interactivo) opciones = opcionesDe(m.interactivo).opciones
    if (m.sender !== "user" || ignorar.has(m.id)) continue
    const texto = normalizarTexto(m.texto)
    const actual = detalle.pasos.find((p) => p.n === ultimo)
    if (actual?.entrada.tipo === "rafaga" && textosDelPaso(actual, opciones).includes(texto)) {
      salida[m.id] = ultimo
      continue
    }
    const paso = detalle.pasos.find((p) => p.n > ultimo && p.entrada.enviable && textosDelPaso(p, opciones).includes(texto))
    if (paso) {
      ultimo = paso.n
      salida[m.id] = paso.n
    } else {
      salida[m.id] = "libre"
    }
  }
  return salida
}

function IconoResultado({ resultado }: { resultado: ResultadoRegla }) {
  if (resultado === "pasa") return <Check className="h-4 w-4 shrink-0 text-success" aria-label="Cumple" />
  if (resultado === "falla") return <X className="h-4 w-4 shrink-0 text-destructive" aria-label="No cumple" />
  if (resultado === "esperando") return <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Esperando respuesta" />
  return <Minus className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Lo revisa el banco" />
}

function estadoPaso(ev: Evaluacion | undefined): "pasa" | "falla" | "pendiente" {
  if (!ev) return "pendiente"
  const evaluables = ev.reglas.filter((r) => r.resultado !== "solo_banco")
  if (evaluables.some((r) => r.resultado === "falla")) return "falla"
  if (evaluables.some((r) => r.resultado === "esperando")) return "pendiente"
  return "pasa"
}

export default function ConsolaDeCasosPage() {
  const [estado, setEstado] = useState<EstadoPruebas | null>(null)
  const [errorEstado, setErrorEstado] = useState<string | null>(null)
  const [casos, setCasos] = useState<CasoResumen[] | null>(null)
  const [buscar, setBuscar] = useState("")
  const [soloP0, setSoloP0] = useState(false)
  const [soloDemo, setSoloDemo] = useState(false)
  const [grupo, setGrupo] = useState(TODOS)

  const [elegido, setElegido] = useState<string | null>(null)
  const [variante, setVariante] = useState<number | null>(null)
  const [telefono, setTelefono] = useState(TELEFONO_POR_DEFECTO)
  const [detalle, setDetalle] = useState<CasoDetalle | null>(null)

  const [conversacion, setConversacion] = useState<ConversacionPrueba | null>(null)
  const [saltados, setSaltados] = useState<number[]>([])
  const [iniciado, setIniciado] = useState<string | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<Record<number, Evaluacion>>({})
  const conocidos = useRef<Set<string>>(new Set())
  const firmas = useRef<Record<number, string>>({})
  const pendientes = useRef<Record<number, { firma: string; t: ReturnType<typeof setTimeout> }>>({})
  const firmaConversacion = useRef("")
  const [tic, setTic] = useState(0)

  const [libre, setLibre] = useState("")
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [confirmarReal, setConfirmarReal] = useState(false)
  const [confirmarTodo, setConfirmarTodo] = useState(false)
  const [confirmarNumeroReal, setConfirmarNumeroReal] = useState(false)
  const [fechaReloj, setFechaReloj] = useState("")
  const [horaReloj, setHoraReloj] = useState("")
  const chatRef = useRef<HTMLDivElement>(null)

  const cargarEstado = useCallback(() => {
    pruebasApi.estado()
      .then((e) => { setEstado(e); setErrorEstado(null) })
      .catch((e: any) => setErrorEstado(e?.message || "No se pudo leer el estado"))
  }, [])

  useEffect(() => {
    cargarEstado()
    const t = setInterval(cargarEstado, 30_000)
    return () => clearInterval(t)
  }, [cargarEstado])

  useEffect(() => {
    pruebasApi.casos().then((r) => setCasos(r.casos)).catch((e: any) => {
      setCasos([])
      toast.error(e?.message || "No se pudieron leer los casos")
    })
  }, [])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("caso")
    if (id) setElegido(id)
  }, [])

  useEffect(() => {
    const fila = casos && elegido ? document.querySelector<HTMLElement>(`[data-caso="${CSS.escape(elegido)}"]`) : null
    const lista = fila?.closest("ul")
    if (fila && lista) lista.scrollTop = fila.offsetTop - lista.offsetTop - 8
  }, [casos, elegido])

  const real = estado?.canal_activo === "real"
  const numerosReales = estado?.telefonos ?? []
  const telefonoReal = numerosReales.includes(telefono)

  const limpiarCorrida = useCallback(() => {
    setSaltados([])
    setEvaluaciones({})
    setIniciado(null)
    firmas.current = {}
    Object.values(pendientes.current).forEach((p) => clearTimeout(p.t))
    pendientes.current = {}
  }, [])

  useEffect(() => {
    if (!elegido) return
    setDetalle(null)
    pruebasApi.caso(elegido, variante, null)
      .then((d) => {
        setDetalle(d)
        setTelefono((actual) => (real && numerosReales.includes(actual) ? actual : d.telefono || TELEFONO_POR_DEFECTO))
      })
      .catch((e: any) => toast.error(e?.message || "No se pudo leer el caso"))
    limpiarCorrida()
  }, [elegido, variante])

  const leerConversacion = useCallback(async () => {
    try {
      const c = await pruebasApi.conversacion(telefono)
      const firma = `${c.telefono}|${c.costo_usd}|${c.mensajes.map((m) => `${m.id}:${m.texto.length}`).join(",")}`
      if (firma !== firmaConversacion.current) {
        firmaConversacion.current = firma
        setConversacion(c)
      }
    } catch {
      /* el siguiente sondeo lo vuelve a intentar */
    }
  }, [telefono])

  useEffect(() => {
    setConversacion(null)
    firmaConversacion.current = ""
    leerConversacion()
    const t = setInterval(leerConversacion, 2000)
    return () => clearInterval(t)
  }, [leerConversacion])

  const mensajes = useMemo(() => conversacion?.mensajes ?? [], [conversacion])

  const asignados = useMemo(() => alinear(mensajes, detalle, conocidos.current), [mensajes, detalle, iniciado])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight })
  }, [mensajes.length])

  const pasoActual = Math.max(0, ...Object.values(asignados).filter((v): v is number => typeof v === "number"))
  const siguiente = useMemo(() => {
    if (!detalle) return null
    const hecho = Math.max(pasoActual, ...saltados, 0)
    return detalle.pasos.find((p) => p.n > hecho) ?? null
  }, [detalle, pasoActual, saltados])

  const respuestasDe = useCallback((n: number): { ids: string[]; desde: string | null } => {
    const inicio = mensajes.findIndex((m) => asignados[m.id] === n)
    if (inicio < 0) return { ids: [], desde: null }
    const ids: string[] = []
    for (let i = inicio + 1; i < mensajes.length; i++) {
      const m = mensajes[i]
      if (m.sender === "user" && asignados[m.id] !== n) break
      if (m.bot) ids.push(m.id)
    }
    return { ids, desde: mensajes[inicio].id }
  }, [mensajes, asignados])

  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!detalle) return
    const pasos = new Set(Object.values(asignados).filter((v): v is number => typeof v === "number"))
    for (const n of pasos) {
      const { ids, desde } = respuestasDe(n)
      const ancla = mensajes.find((m) => m.id === desde)
      const vencido = !ids.length && !!ancla?.fecha && Date.now() - Date.parse(ancla.fecha) > ESPERA_SIN_RESPUESTA_MS
      if (!ids.length && !vencido) continue
      const firma = `${ids.join(",")}|${vencido ? "vencido" : ""}`
      if (firmas.current[n] === firma || pendientes.current[n]?.firma === firma) continue
      if (pendientes.current[n]) clearTimeout(pendientes.current[n].t)
      const caso = detalle.id
      const varianteCaso = detalle.variante
      pendientes.current[n] = {
        firma,
        t: setTimeout(() => {
          delete pendientes.current[n]
          firmas.current[n] = firma
          pruebasApi.evaluar(caso, { telefono, paso: n, variante: varianteCaso, mensajes: ids, desde })
            .then((ev) => { if (firmas.current[n] === firma) setEvaluaciones((prev) => ({ ...prev, [n]: ev })) })
            .catch(() => { if (firmas.current[n] === firma) delete firmas.current[n] })
        }, ids.length ? 2500 : 0),
      }
    }
  }, [detalle, asignados, respuestasDe, telefono, mensajes, tic])

  useEffect(() => () => Object.values(pendientes.current).forEach((p) => clearTimeout(p.t)), [])

  const filtrados = useMemo(() => {
    const q = normalizarTexto(buscar)
    return (casos ?? []).filter((c) => {
      if (soloP0 && c.prioridad !== "P0") return false
      if (soloDemo && !c.demo) return false
      if (grupo !== TODOS && c.grupo !== grupo) return false
      if (!q) return true
      return normalizarTexto(`${c.id} ${c.nombre} ${c.area} ${c.primer_mensaje}`).includes(q)
    })
  }, [casos, buscar, soloP0, soloDemo, grupo])

  const grupos = useMemo(() => Array.from(new Set((casos ?? []).map((c) => c.grupo))), [casos])

  const opcionesTelefono = useMemo(() => {
    const lista = new Set<string>([detalle?.telefono ?? TELEFONO_POR_DEFECTO, TELEFONO_POR_DEFECTO])
    for (let i = 102; i <= 110; i++) lista.add(`+18095550${i}`)
    if (real) numerosReales.forEach((t) => lista.add(t))
    lista.add(telefono)
    return Array.from(lista)
  }, [detalle, real, numerosReales, telefono])

  const cambiarCanal = async (canal: "simulado" | "real") => {
    setOcupado("canal")
    try {
      setEstado(await pruebasApi.canal(canal))
      toast.success(canal === "real" ? "WhatsApp real encendido por 2 horas" : "Canal simulado: nada sale por WhatsApp real")
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar el canal")
    } finally {
      setOcupado(null)
      setConfirmarReal(false)
    }
  }

  const reiniciarTodo = async () => {
    setOcupado("todo")
    try {
      const r = await pruebasApi.reiniciarTodo()
      toast.success(`Listo: teléfonos de prueba en cero y ${Math.max(0, r.clientes.length - (r.clientes[0]?.startsWith("Borrados") ? 1 : 0))} clientes de muestra sembrados`)
      limpiarCorrida()
      cargarEstado()
      leerConversacion()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo reiniciar todo")
    } finally {
      setOcupado(null)
      setConfirmarTodo(false)
    }
  }

  const fijarReloj = async (soltar: boolean) => {
    setOcupado("reloj")
    try {
      const r = await pruebasApi.reloj(soltar ? null : fechaReloj, soltar ? null : horaReloj)
      if (r.ora_error) toast.error(`ORA no respondió: ${r.ora_error}`)
      else toast.success(soltar ? "Reloj de vuelta a la hora real" : "Reloj de prueba fijado")
      cargarEstado()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar el reloj")
    } finally {
      setOcupado(null)
    }
  }

  const reiniciarTelefono = async (modo: "caso" | "conversacion") => {
    if (!detalle) return
    setOcupado(modo)
    try {
      if (modo === "caso" && detalle.reiniciar === "no") {
        toast("Este caso sigue al anterior: no se reinicia el teléfono")
      } else {
        await pruebasApi.reiniciar({
          telefono,
          modo: modo === "conversacion" || detalle.reiniciar === "solo-conversacion" ? "solo_conversacion"
            : detalle.reiniciar === "conocido" ? "conocido" : "nuevo",
          ...(modo === "caso" && detalle.reiniciar === "conocido" && detalle.perfil ? { perfil: detalle.perfil } : {}),
          ...(detalle.reloj ? { reloj: detalle.reloj } : {}),
          ...(telefonoReal ? { confirmar_reales: true } : {}),
        })
      }
      const actual = await pruebasApi.conversacion(telefono)
      setConversacion(actual)
      limpiarCorrida()
      conocidos.current = new Set(actual.mensajes.map((m) => m.id))
      setIniciado(new Date().toISOString())
      cargarEstado()
      toast.success(modo === "caso" ? `Caso ${detalle.clave} listo en ${telefono}` : "Conversación reiniciada")
    } catch (e: any) {
      toast.error(e?.message || "No se pudo reiniciar el teléfono")
    } finally {
      setOcupado(null)
      setConfirmarNumeroReal(false)
    }
  }

  const numeroNuevo = async () => {
    setOcupado("numero")
    try {
      const t = await pruebasApi.telefonoLibre()
      setTelefono(t.telefono)
      limpiarCorrida()
      toast.success(textoTelefonoLibre(t))
    } catch (e: any) {
      toast.error(e?.message || "No se pudo buscar un número libre")
    } finally {
      setOcupado(null)
    }
  }

  const mandar = async (pedido: Omit<PedidoMensaje, "telefono">, etiqueta: string) => {
    setOcupado(etiqueta)
    try {
      await pruebasApi.mensaje({ telefono, ...pedido })
      leerConversacion()
      return true
    } catch (e: any) {
      toast.error(e?.message || "No se pudo mandar el mensaje")
      return false
    } finally {
      setOcupado(null)
    }
  }


  const enviarSiguiente = async () => {
    if (!siguiente) return
    const e = siguiente.entrada
    if (e.tipo === "cliente") await mandar({ texto: e.texto }, "paso")
    else if (e.tipo === "boton") await mandar({ boton: e.valor ?? e.texto }, "paso")
    else if (e.tipo === "lista") await mandar({ lista: e.valor ?? e.texto }, "paso")
    else if (e.tipo === "rafaga") {
      for (const parte of e.partes ?? []) {
        if (!(await mandar({ texto: parte }, "paso"))) break
        await new Promise((r) => setTimeout(r, 800))
      }
    }
  }

  const tocarOpcion = (tipo: "botones" | "lista", opcion: OpcionInteractiva) => {
    mandar(tipo === "botones" ? { boton: opcion } : { lista: opcion }, "opcion")
  }


  const enviarLibre = async () => {
    const texto = libre.trim()
    if (!texto) return
    if (await mandar({ texto }, "libre")) setLibre("")
  }

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success("Copiado")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  const resumen = useMemo(() => {
    if (!detalle) return null
    const estados = detalle.pasos.map((p) => estadoPaso(evaluaciones[p.n]))
    let turnos: number | null = null
    if (detalle.max_turnos_hasta_precio) {
      const desde = Math.max(0, detalle.pasos.findIndex((p) => p.nombra_pieza))
      let n = 0
      for (const p of detalle.pasos.slice(desde)) {
        const ev = evaluaciones[p.n]
        if (!ev || !ev.respuestas || p.entrada.tipo === "accion") continue
        n += 1
        if (ev.con_monto) { turnos = n; break }
      }
    }
    return {
      pasan: estados.filter((s) => s === "pasa").length,
      fallan: estados.filter((s) => s === "falla").length,
      pendientes: estados.filter((s) => s === "pendiente").length,
      turnos,
    }
  }, [detalle, evaluaciones])

  const ultimoInteractivo = useMemo(() => {
    for (let i = mensajes.length - 1; i >= 0; i--) {
      if (mensajes[i].sender === "user") return null
      if (mensajes[i].bot && mensajes[i].interactivo) return mensajes[i].id
    }
    return null
  }, [mensajes])

  const restan = minutosHasta(estado?.canal_real_vence ?? null)
  const puedeEnviar = !!detalle && !real && !ocupado

  return (
    <AdminLayout title="Consola de casos">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin/pruebas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Pruebas
          </Link>
          <p className="text-sm text-muted-foreground">Corre los casos del banco a mano y mira cada regla en vivo.</p>
        </div>

        {errorEstado ? (
          <div className="rounded-lg border bg-card p-4 text-sm">
            <p className="font-medium">Las pruebas están apagadas en este servidor</p>
            <p className="mt-1 text-muted-foreground">Respuesta del servidor: {errorEstado}</p>
          </div>
        ) : (
          <section aria-label="Canal, reinicio y reloj" className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="consola-canal" className="text-sm font-medium">Usar WhatsApp real</Label>
                <Switch id="consola-canal" checked={real} disabled={!estado || ocupado === "canal" || estado.canal_activo === null}
                  onCheckedChange={(v) => (v ? setConfirmarReal(true) : cambiarCanal("simulado"))} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground" data-testid="estado-canal">
                {!estado ? "Leyendo el canal…" : estado.canal_activo === null ? "ORA no responde"
                  : real ? `WhatsApp real: se apaga solo en ${restan ?? 0} min. Solo a ${numerosReales.join(", ") || "los números de la lista"}.`
                    : "Simulador: nada sale por WhatsApp real."}
              </p>
            </div>
            <div className="min-w-0">
              <Button type="button" variant="destructive" size="sm" className="w-full gap-1.5 sm:w-auto" disabled={!estado || !!ocupado}
                onClick={() => setConfirmarTodo(true)}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Reiniciar todo
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">Todos los teléfonos de prueba en cero y los clientes de muestra como en la demo.</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Reloj</p>
              <p className="text-xs text-muted-foreground">
                {estado?.reloj ? `Fijado: ${estado.reloj.fecha_local} ${estado.reloj.hora_local} (ahora ${fecha(estado.reloj.ahora)})` : "Hora real de Santo Domingo"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Input aria-label="Fecha del reloj" type="date" className="h-8 min-w-[9.5rem] flex-1" value={fechaReloj} onChange={(e) => setFechaReloj(e.target.value)} />
                <Input aria-label="Hora del reloj" type="time" className="h-8 min-w-[8rem] flex-1" value={horaReloj} onChange={(e) => setHoraReloj(e.target.value)} />
                <Button type="button" size="sm" variant="outline" disabled={!fechaReloj || !horaReloj || !!ocupado} onClick={() => fijarReloj(false)}>Fijar</Button>
                {estado?.reloj && <Button type="button" size="sm" variant="ghost" disabled={!!ocupado} onClick={() => fijarReloj(true)}>Hora real</Button>}
              </div>
            </div>
          </section>
        )}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,21rem)]">
          <section aria-label="Casos" className="flex min-w-0 flex-col rounded-lg border bg-card">
            <div className="flex flex-col gap-2 border-b p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar caso" placeholder="Buscar por número, nombre o mensaje" className="pl-8" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant={soloP0 ? "default" : "outline"} aria-pressed={soloP0} onClick={() => setSoloP0(!soloP0)}>P0</Button>
                <Button type="button" size="sm" variant={soloDemo ? "default" : "outline"} aria-pressed={soloDemo} onClick={() => setSoloDemo(!soloDemo)}>Ruta de la demo</Button>
                <Select value={grupo} onValueChange={setGrupo}>
                  <SelectTrigger aria-label="Grupo" className="h-8 min-w-0 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos los grupos</SelectItem>
                    {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{casos ? `${filtrados.length} de ${casos.length} casos` : "Leyendo casos…"}</p>
            </div>
            <ul className="max-h-[22rem] overflow-y-auto lg:max-h-[calc(100vh-15rem)]" aria-label="Lista de casos">
              {!casos && <li className="p-3"><Skeleton className="h-40 w-full" /></li>}
              {filtrados.map((c) => (
                <li key={c.id}>
                  <button type="button" data-caso={c.id} onClick={() => { setElegido(c.id); setVariante(c.variantes.length ? 1 : null) }}
                    className={cn("flex w-full min-w-0 flex-col gap-1 border-b px-3 py-2 text-left hover:bg-muted/60",
                      elegido === c.id && "bg-muted")}>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs">
                      <span className="font-mono font-semibold">{c.id}</span>
                      {c.prioridad && <span className={cn("rounded px-1.5 py-0.5", c.prioridad === "P0" ? "bg-warning-soft text-warning" : "bg-secondary text-muted-foreground")}>{c.prioridad}</span>}
                      {c.demo && <span className="rounded bg-success-soft px-1.5 py-0.5 text-success">Ruta de la demo</span>}
                      <span className="ml-auto shrink-0 text-muted-foreground">{c.con_historial ? "Con historial" : "Cliente nuevo"}</span>
                    </span>
                    <span className="line-clamp-2 text-sm">{c.nombre}</span>
                    {c.primer_mensaje && <span className="truncate text-xs text-muted-foreground">«{c.primer_mensaje}»</span>}
                    {!c.consola && <span className="text-xs text-muted-foreground">Se corre en el panel o con personas, no en la consola</span>}
                  </button>
                </li>
              ))}
              {casos && !filtrados.length && <li className="p-3 text-sm text-muted-foreground">Ningún caso con esos filtros.</li>}
            </ul>
          </section>

          <section aria-label="Conversación" className="flex min-w-0 flex-col gap-3">
            {!elegido ? (
              <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Elige un caso de la lista para empezar.</div>
            ) : !detalle ? <Skeleton className="h-96 w-full" /> : (
              <>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Caso {detalle.clave} · {detalle.grupo}</p>
                  <h2 className="text-sm font-semibold">{detalle.nombre}</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {detalle.variantes.length > 0 && (
                      <div className="flex min-w-0 flex-col gap-1">
                        <Label htmlFor="consola-variante" className="text-xs">Variante</Label>
                        <Select value={String(variante ?? 1)} onValueChange={(v) => setVariante(Number(v))}>
                          <SelectTrigger id="consola-variante" className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {detalle.variantes.map((v, i) => <SelectItem key={v + i} value={String(i + 1)}>{i + 1}. {v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <Label htmlFor="consola-telefono" className="text-xs">Teléfono</Label>
                      <div className="flex min-w-0 gap-2">
                        <Select value={telefono} onValueChange={(v) => { setTelefono(v); limpiarCorrida() }}>
                          <SelectTrigger id="consola-telefono" className="h-8 min-w-0 flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {opcionesTelefono.map((t) => (
                              <SelectItem key={t} value={t}>{t}{numerosReales.includes(t) ? " (número real)" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" disabled={!!ocupado} onClick={numeroNuevo}>
                          {ocupado === "numero" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PhoneCall className="h-4 w-4" aria-hidden />} Número nuevo
                        </Button>
                      </div>
                      {!numerosReales.includes(telefono) && (
                        <a href={urlSimulador(telefono)} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir en el simulador
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="gap-1.5" disabled={!!ocupado}
                      onClick={() => (telefonoReal ? setConfirmarNumeroReal(true) : reiniciarTelefono("caso"))}>
                      {ocupado === "caso" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />} Iniciar caso
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={!!ocupado} onClick={() => reiniciarTelefono("conversacion")}>
                      <RotateCcw className="h-4 w-4" aria-hidden /> Reiniciar conversación
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {iniciado ? `Caso en curso desde las ${hora(iniciado)}.` : `Iniciar caso: ${MODO_INICIO[detalle.reiniciar] ?? detalle.reiniciar}${detalle.reloj ? `, reloj ${detalle.reloj.fecha_local} ${detalle.reloj.hora_local}` : ", hora real"}.`}
                  </p>
                </div>

                <div className="mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] border-4 border-foreground/80 bg-background shadow-sm">
                  <div className="flex items-center justify-between gap-2 bg-[#075e54] px-4 py-2 text-white">
                    <span className="truncate text-sm font-medium">La Casa del Colt</span>
                    <span className="shrink-0 text-xs opacity-80">{telefono}</span>
                  </div>
                  <div ref={chatRef} className="flex h-[26rem] flex-col gap-2 overflow-y-auto bg-[#ece5dd] p-3 dark:bg-muted" aria-live="polite" aria-label="Mensajes">
                    {!conversacion ? <p className="m-auto text-xs text-muted-foreground">Leyendo la conversación…</p> : !mensajes.length ? (
                      <p className="m-auto text-center text-xs text-muted-foreground">Sin mensajes en este teléfono.</p>
                    ) : mensajes.map((m) => <Burbuja key={m.id} m={m} asignacion={asignados[m.id]} tocable={m.id === ultimoInteractivo && puedeEnviar}
                      onTocar={tocarOpcion} />)}
                  </div>
                  <div className="flex flex-col gap-2 border-t bg-card p-3">
                    {siguiente ? (
                      <div className="rounded-md border bg-muted/40 p-2" data-testid="siguiente-paso">
                        <p className="text-xs text-muted-foreground">Paso {siguiente.n} de {detalle.pasos.length}{siguiente.pausa_seg ? ` (pausa ${siguiente.pausa_seg} s antes del siguiente)` : ""}</p>
                        <p className="break-words text-sm">«{textoEntrada(siguiente)}»</p>
                        {!siguiente.entrada.enviable && <p className="mt-1 text-xs text-muted-foreground">Este paso no se manda desde la consola: hazlo en el panel o en el simulador y luego sáltalo.</p>}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {real ? (
                            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => copiar(siguiente.entrada.texto)}>
                              <Copy className="h-4 w-4" aria-hidden /> Copiar para escribirlo desde tu teléfono
                            </Button>
                          ) : (
                            <Button type="button" size="sm" className="gap-1.5" disabled={!puedeEnviar || !siguiente.entrada.enviable} onClick={enviarSiguiente}>
                              {ocupado === "paso" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} Enviar siguiente paso
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => setSaltados((s) => [...s, siguiente.n])}>
                            <SkipForward className="h-4 w-4" aria-hidden /> Saltar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Se mandaron todos los pasos del caso. Puedes seguir escribiendo lo que quieras.</p>
                    )}
                    {real ? (
                      <p className="text-xs text-muted-foreground">Con WhatsApp real escribe desde tu teléfono; aquí ves la conversación y cada regla.</p>
                    ) : (
                      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); enviarLibre() }}>
                        <Input aria-label="Mensaje libre" placeholder="Escribe otra cosa como cliente" value={libre} onChange={(e) => setLibre(e.target.value)} maxLength={1000} />
                        <Button type="submit" size="sm" variant="outline" disabled={!puedeEnviar || !libre.trim()} aria-label="Mandar mensaje libre">
                          <Send className="h-4 w-4" aria-hidden />
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <section aria-label="Reglas del caso" className="flex min-w-0 flex-col gap-3 lg:col-span-2 xl:col-span-1">
            {detalle && (
              <>
                <div className="rounded-lg border bg-card p-3" data-testid="resumen-caso">
                  <h3 className="text-sm font-semibold">Resumen</h3>
                  {resumen && (
                    <p className="mt-1 text-sm">
                      {resumen.pasan} de {detalle.pasos.length} pasos cumplen{resumen.fallan ? `, ${resumen.fallan} con fallas` : ""}{resumen.pendientes ? `, ${resumen.pendientes} sin evaluar` : ""}.
                    </p>
                  )}
                  {detalle.max_turnos_hasta_precio && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Precio en {detalle.max_turnos_hasta_precio} respuestas como máximo: {resumen?.turnos == null ? "todavía no dio precio"
                        : resumen.turnos <= detalle.max_turnos_hasta_precio ? `lo dio en ${resumen.turnos}` : `lo dio en ${resumen.turnos}, se pasó`}.
                    </p>
                  )}
                  {conversacion?.costo_usd != null && (
                    <p className="mt-1 text-xs text-muted-foreground">Costo de esta conversación: US$ {conversacion.costo_usd.toFixed(4)} ({conversacion.consultas_con_costo} {conversacion.consultas_con_costo === 1 ? "consulta" : "consultas"})</p>
                  )}
                </div>

                <ol className="flex flex-col gap-2" aria-label="Pasos">
                  {detalle.pasos.map((p) => {
                    const ev = evaluaciones[p.n]
                    const reglas = ev?.reglas ?? p.reglas.map((r) => ({ ...r, resultado: (r.evaluable ? "esperando" : "solo_banco") as ResultadoRegla, detalle: [] as string[] }))
                    const actual = siguiente?.n === p.n || pasoActual === p.n
                    const s = estadoPaso(ev)
                    return (
                      <li key={p.n} data-paso={p.n} data-estado={s}
                        className={cn("rounded-lg border bg-card p-3", actual && "border-primary", saltados.includes(p.n) && "opacity-60")}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 break-words text-sm"><span className="font-medium">Paso {p.n}.</span> {textoEntrada(p)}</p>
                          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs",
                            s === "pasa" ? "bg-success-soft text-success" : s === "falla" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground")}>
                            {s === "pasa" ? "Cumple" : s === "falla" ? "Falla" : saltados.includes(p.n) ? "Saltado" : "Pendiente"}
                          </span>
                        </div>
                        {p.nota && <p className="mt-1 text-xs text-muted-foreground">{p.nota}</p>}
                        {reglas.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1">
                            {reglas.map((r) => (
                              <li key={r.id} data-regla={r.id} data-resultado={r.resultado} className="flex items-start gap-1.5 text-xs">
                                <IconoResultado resultado={r.resultado} />
                                <span className="min-w-0 break-words">
                                  <span className="font-medium">{r.etiqueta}</span>{r.texto ? `: ${r.texto}` : ""}
                                  {r.resultado === "solo_banco" && <span className="text-muted-foreground"> (lo revisa el banco)</span>}
                                  {r.detalle.length > 0 && <span className="block text-destructive">{r.detalle.join("; ")}</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ol>

                <div className="rounded-lg border bg-card p-3">
                  <h3 className="text-sm font-semibold">Del caso</h3>
                  <dl className="mt-2 grid gap-1.5 text-xs">
                    <Dato titulo="Cómo arranca" valor={MODO_INICIO[detalle.reiniciar] ?? detalle.reiniciar} />
                    {detalle.continua_de != null && <Dato titulo="Sigue al caso" valor={String(detalle.continua_de)} />}
                    {detalle.reiniciar === "conocido" && <Dato titulo="Perfil" valor={detalle.perfil_nombre ?? String(detalle.perfil?.nombre ?? "en el caso")} />}
                    {detalle.vehiculo && <Dato titulo="Vehículo" valor={detalle.vehiculo} />}
                    <Dato titulo="Reloj" valor={detalle.reloj ? `${detalle.reloj.fecha_local} ${detalle.reloj.hora_local}` : "Hora real"} />
                    <Dato titulo="Teléfono del caso" valor={detalle.telefono_del_caso === "auto" ? `Cualquiera de prueba (${TELEFONO_POR_DEFECTO})` : detalle.telefono_del_caso} />
                    {detalle.max_turnos_hasta_precio && <Dato titulo="Respuestas hasta el precio" valor={`${detalle.max_turnos_hasta_precio} como máximo`} />}
                    {detalle.config && <Dato titulo="Configuración de la IA" valor={`${Object.keys(detalle.config).join(", ")} (la aplica el banco; aquí ponla a mano en Configuración IA)`} />}
                    {detalle.acciones.length > 0 && <Dato titulo="Acciones antes del caso" valor={`${detalle.acciones.join("; ")} (las hace el banco)`} />}
                    {detalle.area && <Dato titulo="Área" valor={detalle.area} />}
                  </dl>
                  {detalle.juicio.length > 0 && (
                    <>
                      <p className="mt-3 text-xs font-medium">Juicio (lo revisa una persona)</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                        {detalle.juicio.map((j) => <li key={j}>{j}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <Dialog open={confirmarReal} onOpenChange={setConfirmarReal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Pasar a WhatsApp real?</DialogTitle>
            <DialogDescription>
              Las respuestas saldrán por el número real de Meta, solo a {numerosReales.join(", ") || "los números de la lista"}.
              Se apaga solo a las 2 horas. Desde la consola no se manda nada: escribes desde tu teléfono.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarReal(false)}>Seguir en simulado</Button>
            <Button type="button" disabled={ocupado === "canal"} onClick={() => cambiarCanal("real")}>Pasar a real</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarTodo} onOpenChange={setConfirmarTodo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reiniciar todo?</DialogTitle>
            <DialogDescription>
              Borra conversaciones, clientes, cotizaciones, apartados y citas de todos los teléfonos de prueba
              ({numerosReales.length} números reales de la lista y el rango {estado?.rango_ficticio.desde} a {estado?.rango_ficticio.hasta.slice(-4)}),
              suelta el reloj y vuelve a sembrar los clientes de muestra. No toca el catálogo, los precios ni las existencias.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarTodo(false)}>No, dejarlo así</Button>
            <Button type="button" variant="destructive" disabled={ocupado === "todo"} onClick={reiniciarTodo}>
              {ocupado === "todo" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Sí, reiniciar todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarNumeroReal} onOpenChange={setConfirmarNumeroReal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reiniciar el número real {telefono}?</DialogTitle>
            <DialogDescription>Se borra lo de ese número en el panel y en el asistente para empezar el caso desde cero.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarNumeroReal(false)}>No</Button>
            <Button type="button" disabled={ocupado === "caso"} onClick={() => reiniciarTelefono("caso")}>Sí, iniciar el caso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{titulo}</dt>
      <dd className="break-words">{valor}</dd>
    </div>
  )
}

function Burbuja({ m, asignacion, tocable, onTocar }: {
  m: MensajePrueba
  asignacion: Asignacion | undefined
  tocable: boolean
  onTocar: (tipo: "botones" | "lista", opcion: OpcionInteractiva) => void
}) {
  const cliente = m.sender === "user"
  const { tipo, opciones } = opcionesDe(m.interactivo)
  const quien = cliente ? null : m.bot ? null : m.autor === "sistema" ? "Aviso automático" : "Vendedor"
  return (
    <div className={cn("flex max-w-[85%] flex-col", cliente ? "self-end items-end" : "self-start items-start")} data-mensaje={m.id}
      data-de={cliente ? "cliente" : m.bot ? "bot" : "otro"}>
      <div className={cn("rounded-lg px-2.5 py-1.5 text-sm shadow-sm", cliente ? "bg-[#dcf8c6] text-black" : "bg-white text-black")}>
        {quien && <p className="text-[11px] font-medium text-[#075e54]">{quien}</p>}
        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
        <p className="mt-0.5 text-right text-[10px] text-black/50">
          {typeof asignacion === "number" ? `Paso ${asignacion} · ` : asignacion === "libre" ? "Libre · " : ""}{hora(m.fecha)}
        </p>
      </div>
      {tipo && opciones.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {opciones.map((o, i) => (
            <button key={o.id + i} type="button" disabled={!tocable} onClick={() => onTocar(tipo, o)}
              className="max-w-full rounded-full border border-[#075e54]/40 bg-white px-2.5 py-1 text-left text-xs text-[#075e54] enabled:hover:bg-[#075e54]/10 disabled:opacity-60"
              title={o.descripcion || undefined}>
              {o.titulo}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
