"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Check, CheckCheck, FileText, Loader2, Mic, Paperclip, RotateCcw, SendHorizontal, Square } from "lucide-react"
import type { Adjunto, Conversacion, Estado, Mensaje } from "@/lib/seguros/tipos"

const SRV = "/srv/seguros"

const GRUPOS: { titulo: string; mensajes: string[] }[] = [
  {
    titulo: "Captación",
    mensajes: [
      "Buenas, ¿cuánto me sale asegurar mi Toyota RAV4 2023?",
      "Quiero un seguro médico para mi familia, somos 4",
      "Tengo una ferretería en Santiago y quiero asegurar el local y la mercancía",
      "Necesito el seguro de viaje para la visa de España",
      "Klk, ¿ustedes aseguran motores?",
    ],
  },
  {
    titulo: "Siniestros",
    mensajes: [
      "Tuve un choque, ¿qué hago?",
      "Se me metieron a la casa anoche y se llevaron la tele y la laptop",
      "¿Cómo va mi reclamo?",
    ],
  },
  {
    titulo: "Servicio",
    mensajes: [
      "¿Mi póliza está al día?",
      "Sí, renuévenla igual",
      "¿El seguro me cubre si choco fuera del país?",
      "Ya hice la transferencia de la cuota, ¿a dónde mando el comprobante?",
      "Quiero cancelar mi póliza",
      "Pásame con una persona por favor",
      "¿Ustedes son una aseguradora?",
      "¿Eres un robot?",
    ],
  },
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

export function SimuladorSeguros() {
  const [telefono, setTelefono] = useState("")
  const [nombre, setNombre] = useState("")
  const [perfiles, setPerfiles] = useState<{ etiqueta: string; nombre: string; telefono: string; pista: string }[]>([])
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
    fetch(`${SRV}/estado`)
      .then((r) => r.json())
      .then((e: Estado) => {
        const libres = e.clientes.filter((c) => c.segmento === "persona" && c.documento && !c.conversacionId)
        const conPol = (f: (p: Estado["polizas"][number]) => boolean) => libres.find((c) => e.polizas.some((p) => p.clienteId === c.id && f(p)))
        const lista = [
          { etiqueta: "Asegurado con vehículo", c: conPol((p) => p.ramo === "vehiculo" && p.estado === "vigente" && p.pagoAlDia) },
          { etiqueta: "Póliza por renovar", c: conPol((p) => p.estado === "por_renovar" && p.renovacion === "aviso_enviado") },
          { etiqueta: "Asegurado de hogar", c: conPol((p) => p.ramo === "hogar" && p.estado === "vigente") },
        ]
        setPerfiles(lista.filter((x) => x.c).map((x) => ({ etiqueta: x.etiqueta, nombre: x.c!.nombre, telefono: x.c!.telefono, pista: x.c!.documento.replace(/\D/g, "").slice(-4) })))
      })
      .catch(() => {})
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
      const r = await fetch(`${SRV}/simulador`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono, nombre: nombre.trim() || undefined, texto: limpio, canal: "whatsapp", adjunto }) })
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
    setNombre("")
    setTelefono(telefonoNuevo())
  }

  const comoAsegurado = (p: { nombre: string; telefono: string }) => {
    setConv(null)
    setMensajes([])
    setNombre(p.nombre)
    setTelefono(p.telefono)
  }

  return (
    <div className="min-h-dvh bg-[#06193f] text-[#F2F6FC]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1fr_400px] lg:py-10">
        <div className="flex flex-col gap-5">
          <Link href="/admin/chat" className="inline-flex items-center gap-1 text-sm text-[#F2F6FC]/70 hover:text-[#F2F6FC]">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Ir a la bandeja del equipo
          </Link>
          <div>
            <img src="/marca/logo-max.png" alt="MAX Corredores de Seguros" className="mb-4 h-12 w-auto" />
            <div className="text-xs uppercase tracking-[0.25em] text-[#9fbcf0]">Prueba del asistente</div>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">Escríbele a MAX como si fueras un cliente.</h1>
            <p className="mt-3 max-w-xl text-[#F2F6FC]/75">
              El asistente precalifica, toma reportes de siniestro y atiende renovaciones con las reglas de MAX: no da primas, no promete coberturas y pide verificación antes de dar datos de una póliza. Lo que registra aparece al instante en la bandeja, en oportunidades y en siniestros.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[#F2F6FC]/70">Tu nombre (opcional)</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="La IA te lo pregunta si no lo pones" className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 outline-none focus:border-[#9fbcf0]" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[#F2F6FC]/70">Tu teléfono</span>
              <div className="flex gap-2">
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 outline-none focus:border-[#9fbcf0]" />
                <button onClick={reiniciar} className="inline-flex h-10 items-center gap-1 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/10" title="Empezar con otro número">
                  <RotateCcw className="h-4 w-4" aria-hidden /> Nuevo
                </button>
              </div>
            </label>
          </div>
          {perfiles.length > 0 && (
            <div>
              <div className="mb-2 text-sm text-[#F2F6FC]/70">Escribir como un asegurado de la cartera</div>
              <div className="flex flex-wrap gap-2">
                {perfiles.map((p) => (
                  <button key={p.telefono} onClick={() => comoAsegurado(p)} className={`rounded-lg border px-3 py-2 text-left text-sm hover:bg-white/10 ${telefono === p.telefono ? "border-[#9fbcf0] bg-white/10" : "border-white/15 bg-white/5"}`}>
                    <span className="block font-medium">{p.etiqueta}</span>
                    <span className="block text-xs text-[#F2F6FC]/60">{p.nombre} · cédula termina en {p.pista}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <div className="mb-2 text-sm text-[#F2F6FC]/70">{g.titulo}</div>
              <div className="flex flex-wrap gap-2">
                {g.mensajes.map((p) => (
                  <button key={p} onClick={() => enviar(p)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-left text-sm hover:border-[#9fbcf0] hover:bg-white/10">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto w-full max-w-[400px]">
          <div className="overflow-hidden rounded-[2.2rem] border-[10px] border-[#030c22] bg-[#E8EFF9] shadow-2xl">
            <div className="flex items-center gap-3 bg-[#06193f] px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"><img src="/marca/logo-max.png" alt="" className="h-6 w-auto" /></span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">MAX Corredores de Seguros</div>
                <div className="text-[11px] text-[#9fbcf0]">{escribiendo ? "escribiendo…" : "Cuenta de empresa"}</div>
              </div>
            </div>
            <div className="flex h-[560px] flex-col gap-2 overflow-y-auto px-3 py-4 text-[14px] text-[#06193f]">
              {mensajes.length === 0 && (
                <p className="mx-auto mt-6 max-w-[80%] rounded-lg bg-white/70 px-3 py-2 text-center text-xs text-[#06193f]/70">
                  Escribe abajo o toca un mensaje de prueba para empezar.
                </p>
              )}
              {mensajes.map((m) =>
                m.de === "sistema" ? (
                  <p key={m.id} className="mx-auto max-w-[85%] rounded-lg bg-[#F2F6FC] px-3 py-1.5 text-center text-[11px] text-[#06193f]/70">{m.texto}</p>
                ) : (
                  <div key={m.id} className={m.de === "cliente" ? "self-end" : "self-start"}>
                    <div className={`max-w-[290px] whitespace-pre-wrap rounded-xl px-3 py-2 shadow-sm ${m.de === "cliente" ? "rounded-tr-sm bg-[#D7F2DA]" : "rounded-tl-sm bg-white"}`}>
                      {m.de === "equipo" && <div className="mb-0.5 text-[11px] font-semibold text-[#0047BB]">{m.autor}</div>}
                      {m.adjunto?.tipo === "imagen" && <img src={m.adjunto.url} alt={m.adjunto.nombre} className="mb-1.5 max-h-56 w-full rounded-lg object-cover" />}
                      {m.adjunto?.tipo === "pdf" && (
                        <a href={m.adjunto.url} target="_blank" rel="noreferrer" className="mb-1.5 flex items-center gap-2 rounded-lg bg-[#F2F6FC] px-3 py-2 text-[13px] font-medium text-[#06193f]">
                          <FileText className="h-8 w-8 shrink-0 text-[#0047BB]" aria-hidden />
                          <span className="min-w-0"><span className="block truncate">{m.adjunto.nombre}</span><span className="text-[11px] font-normal text-[#06193f]/60">PDF · tocar para abrir</span></span>
                        </a>
                      )}
                      {m.adjunto?.tipo === "audio" && <audio controls src={m.adjunto.url} className="mb-1 h-9 w-full max-w-[250px]" />}
                      {m.adjunto?.tipo === "audio" ? <span className="text-[12px] italic text-[#06193f]/70">{m.texto}</span> : m.texto}
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#06193f]/50">
                        {hora(m.ts)}
                        {m.de === "cliente" && (mensajes.some((x) => x.ts > m.ts && x.de !== "cliente") ? <CheckCheck className="h-3 w-3 text-[#2E9BD6]" /> : <Check className="h-3 w-3" />)}
                      </div>
                    </div>
                  </div>
                ),
              )}
              {escribiendo && <div className="self-start rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[#06193f]/60 shadow-sm">escribiendo…</div>}
              <div ref={abajo} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                enviar(texto)
              }}
              className="flex items-center gap-2 bg-[#D6E2F5] px-3 py-2.5"
            >
              <input ref={elegir} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,audio/*" className="hidden" onChange={(e) => { adjuntar(e.target.files?.[0]); e.target.value = "" }} />
              <button type="button" onClick={() => elegir.current?.click()} className="flex h-10 w-9 shrink-0 items-center justify-center text-[#06193f]/70" aria-label="Adjuntar foto, PDF o audio" disabled={subiendo}>
                {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              </button>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe un mensaje"
                aria-label="Mensaje"
                className="h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-[14px] text-[#06193f] outline-none"
              />
              {texto.trim() ? (
                <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06193f] text-[#F2F6FC]" aria-label="Enviar">
                  <SendHorizontal className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={grabar} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#F2F6FC] ${grabando ? "animate-pulse bg-[#0047BB]" : "bg-[#06193f]"}`} aria-label={grabando ? "Detener y enviar la nota de voz" : "Grabar nota de voz"}>
                  {grabando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </form>
          </div>
          {error && <p className="mt-3 text-center text-sm text-[#9fbcf0]">{error}</p>}
        </div>
      </div>
    </div>
  )
}
