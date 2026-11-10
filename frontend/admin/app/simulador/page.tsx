"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Check, CheckCheck, FileText, Loader2, Mic, Paperclip, RotateCcw, SendHorizontal, Square } from "lucide-react"
import type { Adjunto, Conversacion, Mensaje } from "@/lib/restaurante/tipos"
import { SimuladorSeguros } from "@/components/seguros/simulador/SimuladorSeguros"
import { useVertical } from "@/lib/vertical"

const SRV = "/srv/restaurante"

const PRUEBAS = [
  "Hola, ¿tienen mesa para 2 esta noche a las 8 frente al mar?",
  "Quiero reservar el sábado a la 1 para 6, somos una familia con un bebé",
  "Mañana es mi aniversario, ¿tienen cama balinesa a las 7:30?",
  "¿Cuánto cuesta la paella para 2?",
  "Soy alérgica a los mariscos, ¿qué me recomiendan?",
  "Somos 20 para un cumpleaños el sábado",
  "¿Tienen parqueo?",
  "Necesito mover mi reserva para las 9",
  "Cancela mi reserva por favor",
  "Do you have a table for 4 tonight by the water?",
  "La última vez la comida tardó muchísimo, quiero hablar con el encargado",
  "Mándame la carta en PDF por favor",
  "¿Me enseñas una foto de la paella?",
]

type Archivo = { tipo: Adjunto["tipo"]; nombre: string; mime: string; datos: string; segundos?: number }

function aBase64(b: Blob) {
  return new Promise<string>((ok, mal) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(",")[1] ?? "")
    r.onerror = () => mal(r.error)
    r.readAsDataURL(b)
  })
}

function hora(ts: number) {
  return new Intl.DateTimeFormat("es-DO", { hour: "numeric", minute: "2-digit", timeZone: "America/Santo_Domingo" }).format(new Date(ts))
}

function telefonoNuevo() {
  return `809-555-${String(2000 + Math.floor(Math.random() * 7000)).padStart(4, "0")}`
}

function SimuladorRestaurante() {
  const [telefono, setTelefono] = useState("")
  const [nombre, setNombre] = useState("Cliente de prueba")
  const [texto, setTexto] = useState("")
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [conv, setConv] = useState<Conversacion | null>(null)
  const [escribiendo, setEscribiendo] = useState(false)
  const [error, setError] = useState("")
  const abajo = useRef<HTMLDivElement>(null)
  const elegir = useRef<HTMLInputElement>(null)
  const grabador = useRef<{ rec: MediaRecorder; partes: Blob[]; inicio: number } | null>(null)
  const [grabando, setGrabando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    let t: string | null = null
    try {
      t = localStorage.getItem("simulador-telefono")
    } catch {}
    setTelefono(t ?? telefonoNuevo())
  }, [])

  useEffect(() => {
    if (telefono) try { localStorage.setItem("simulador-telefono", telefono) } catch {}
  }, [telefono])

  useEffect(() => {
    if (!conv) return
    fetch(`${SRV}/conversaciones/${conv.id}/mensajes`).then((r) => r.json()).then(setMensajes).catch(() => {})
    const es = new EventSource(`${SRV}/stream`)
    es.addEventListener("mensaje", (e) => {
      const { mensaje } = JSON.parse((e as MessageEvent).data) as { mensaje: Mensaje }
      if (mensaje.conversacionId === conv.id) setMensajes((l) => (l.some((m) => m.id === mensaje.id) ? l : [...l, mensaje]))
    })
    es.addEventListener("escribiendo", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { conversacionId: string; activo: boolean }
      if (d.conversacionId === conv.id) setEscribiendo(d.activo)
    })
    return () => es.close()
  }, [conv?.id])

  useEffect(() => {
    abajo.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes.length, escribiendo])

  const enviar = async (t: string, adjunto?: Archivo) => {
    const limpio = t.trim()
    if ((!limpio && !adjunto) || !telefono) return
    setTexto("")
    setError("")
    if (adjunto) setSubiendo(true)
    try {
      const r = await fetch(`${SRV}/simulador`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono, nombre, texto: limpio, canal: "whatsapp", adjunto }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? "No se pudo enviar")
      setConv(j.conversacion)
      setMensajes((l) => (l.some((m) => m.id === j.mensaje.id) ? l : [...l, j.mensaje]))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubiendo(false)
    }
  }

  const adjuntar = async (f: File | undefined) => {
    if (!f) return
    const tipo: Adjunto["tipo"] = f.type === "application/pdf" ? "pdf" : f.type.startsWith("image/") ? "imagen" : f.type.startsWith("audio/") ? "audio" : "pdf"
    if (tipo === "imagen" && !/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return setError("Usa una foto JPG, PNG o WebP")
    await enviar(texto, { tipo, nombre: f.name, mime: f.type || "application/octet-stream", datos: await aBase64(f) })
  }

  const grabar = async () => {
    if (grabando && grabador.current) {
      grabador.current.rec.stop()
      return
    }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      const rec = new MediaRecorder(flujo, { mimeType: mime })
      const g = { rec, partes: [] as Blob[], inicio: Date.now() }
      rec.ondataavailable = (e) => e.data.size && g.partes.push(e.data)
      rec.onstop = async () => {
        flujo.getTracks().forEach((t) => t.stop())
        setGrabando(false)
        grabador.current = null
        const blob = new Blob(g.partes, { type: mime })
        const segundos = Math.max(1, Math.round((Date.now() - g.inicio) / 1000))
        await enviar("", { tipo: "audio", nombre: `nota-de-voz.${mime.includes("webm") ? "webm" : "m4a"}`, mime, datos: await aBase64(blob), segundos })
      }
      grabador.current = g
      rec.start()
      setGrabando(true)
    } catch {
      setError("No se pudo usar el micrófono. También puedes adjuntar un audio con el clip.")
    }
  }

  const reiniciar = () => {
    setConv(null)
    setMensajes([])
    setTelefono(telefonoNuevo())
  }

  return (
    <div className="min-h-dvh bg-[#0B2A2E] text-[#F4ECDF]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1fr_400px] lg:py-10">
        <div className="flex flex-col gap-5">
          <Link href="/admin/chat" className="inline-flex items-center gap-1 text-sm text-[#F4ECDF]/70 hover:text-[#F4ECDF]">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Ir a la bandeja del equipo
          </Link>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[#7FCFCB]">Prueba del asistente</div>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">Escríbele a Boca Marina como si fueras un cliente.</h1>
            <p className="mt-3 max-w-xl text-[#F4ECDF]/75">
              El asistente responde con la disponibilidad real de las mesas, la carta oficial y las reglas del restaurante. Lo que reserve aparece en el salón, en la agenda y en la bandeja al instante.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[#F4ECDF]/70">Tu nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 outline-none focus:border-[#7FCFCB]" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[#F4ECDF]/70">Tu teléfono</span>
              <div className="flex gap-2">
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 outline-none focus:border-[#7FCFCB]" />
                <button onClick={reiniciar} className="inline-flex h-10 items-center gap-1 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/10" title="Empezar con otro número">
                  <RotateCcw className="h-4 w-4" aria-hidden /> Nuevo
                </button>
              </div>
            </label>
          </div>
          <div>
            <div className="mb-2 text-sm text-[#F4ECDF]/70">Mensajes de prueba</div>
            <div className="flex flex-wrap gap-2">
              {PRUEBAS.map((p) => (
                <button key={p} onClick={() => enviar(p)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-left text-sm hover:border-[#E8866A] hover:bg-white/10">
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[400px]">
          <div className="overflow-hidden rounded-[2.2rem] border-[10px] border-[#06171A] bg-[#EFE6D6] shadow-2xl">
            <div className="flex items-center gap-3 bg-[#0B2A2E] px-4 py-3">
              <img src="/marca/logo-boca-marina.png" alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Boca Marina</div>
                <div className="text-[11px] text-[#7FCFCB]">{escribiendo ? "escribiendo…" : "Restaurant & Lounge"}</div>
              </div>
            </div>
            <div className="flex h-[560px] flex-col gap-2 overflow-y-auto px-3 py-4 text-[14px] text-[#0B2A2E]">
              {mensajes.length === 0 && (
                <p className="mx-auto mt-6 max-w-[80%] rounded-lg bg-white/70 px-3 py-2 text-center text-xs text-[#0B2A2E]/70">
                  Escribe abajo o toca un mensaje de prueba para empezar.
                </p>
              )}
              {mensajes.map((m) =>
                m.de === "sistema" ? (
                  <p key={m.id} className="mx-auto max-w-[85%] rounded-lg bg-[#F4ECDF] px-3 py-1.5 text-center text-[11px] text-[#0B2A2E]/70">{m.texto}</p>
                ) : (
                  <div key={m.id} className={m.de === "cliente" ? "self-end" : "self-start"}>
                    <div className={`max-w-[290px] whitespace-pre-wrap rounded-xl px-3 py-2 shadow-sm ${m.de === "cliente" ? "rounded-tr-sm bg-[#D7F2DA]" : "rounded-tl-sm bg-white"}`}>
                      {m.de === "equipo" && <div className="mb-0.5 text-[11px] font-semibold text-[#C8593B]">{m.autor}</div>}
                      {m.adjunto?.tipo === "imagen" && <img src={m.adjunto.url} alt={m.adjunto.nombre} className="mb-1.5 max-h-56 w-full rounded-lg object-cover" />}
                      {m.adjunto?.tipo === "pdf" && (
                        <a href={m.adjunto.url} target="_blank" rel="noreferrer" className="mb-1.5 flex items-center gap-2 rounded-lg bg-[#F4ECDF] px-3 py-2 text-[13px] font-medium text-[#0B2A2E]">
                          <FileText className="h-8 w-8 shrink-0 text-[#C8593B]" aria-hidden />
                          <span className="min-w-0"><span className="block truncate">{m.adjunto.nombre}</span><span className="text-[11px] font-normal text-[#0B2A2E]/60">PDF · tocar para abrir</span></span>
                        </a>
                      )}
                      {m.adjunto?.tipo === "audio" && <audio controls src={m.adjunto.url} className="mb-1 h-9 w-full max-w-[250px]" />}
                      {m.adjunto?.tipo === "audio" ? <span className="text-[12px] italic text-[#0B2A2E]/70">{m.texto}</span> : m.texto}
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#0B2A2E]/50">
                        {hora(m.ts)}
                        {m.de === "cliente" && (mensajes.some((x) => x.ts > m.ts && x.de !== "cliente") ? <CheckCheck className="h-3 w-3 text-[#2E9BD6]" /> : <Check className="h-3 w-3" />)}
                      </div>
                    </div>
                  </div>
                ),
              )}
              {escribiendo && <div className="self-start rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[#0B2A2E]/60 shadow-sm">escribiendo…</div>}
              <div ref={abajo} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                enviar(texto)
              }}
              className="flex items-center gap-2 bg-[#E3D8C4] px-3 py-2.5"
            >
              <input ref={elegir} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,audio/*" className="hidden" onChange={(e) => { adjuntar(e.target.files?.[0]); e.target.value = "" }} />
              <button type="button" onClick={() => elegir.current?.click()} className="flex h-10 w-9 shrink-0 items-center justify-center text-[#0B2A2E]/70" aria-label="Adjuntar foto, PDF o audio" disabled={subiendo}>
                {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              </button>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe un mensaje"
                aria-label="Mensaje"
                className="h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-[14px] text-[#0B2A2E] outline-none"
              />
              {texto.trim() ? (
                <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B2A2E] text-[#F4ECDF]" aria-label="Enviar">
                  <SendHorizontal className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={grabar} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#F4ECDF] ${grabando ? "animate-pulse bg-[#C8593B]" : "bg-[#0B2A2E]"}`} aria-label={grabando ? "Detener y enviar la nota de voz" : "Grabar nota de voz"}>
                  {grabando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </form>
          </div>
          {error && <p className="mt-3 text-center text-sm text-[#E8866A]">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default function Simulador() {
  return useVertical() === "seguros" ? <SimuladorSeguros /> : <SimuladorRestaurante />
}
