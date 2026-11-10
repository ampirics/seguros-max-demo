import type { Adjunto, Canal } from "../tipos"
import { guardarArchivo, recibirDeCliente } from "./motor"

export interface AdjuntoEntrante {
  tipo: Adjunto["tipo"]
  nombre: string
  mime: string
  /** Contenido en base64, sin el prefijo data:. */
  datos: string
  segundos?: number
}

/** Nota de voz a texto con Whisper en Groq (la misma llave del núcleo de ORA). */
async function transcribir(audio: Buffer, mime: string, nombre: string) {
  const llave = process.env.GROQ_API_KEY
  if (!llave) throw new Error("Falta GROQ_API_KEY para transcribir notas de voz")
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), nombre)
  form.append("model", "whisper-large-v3-turbo")
  form.append("language", "es")
  form.append("response_format", "json")
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${llave}` }, body: form })
  if (!r.ok) throw new Error(`No se pudo transcribir la nota de voz (${r.status})`)
  const j = (await r.json()) as { text?: string }
  return (j.text ?? "").trim()
}

export async function recibirMensajeCliente(o: { telefono: string; nombre?: string; texto?: string; canal?: Canal; adjunto?: AdjuntoEntrante; externo?: "meta" }) {
  let texto = (o.texto ?? "").trim()
  let adjunto: Adjunto | undefined
  let voz: { segundos: number } | undefined
  if (o.adjunto) {
    const datos = Buffer.from(o.adjunto.datos, "base64")
    if (datos.length > 12 * 1024 * 1024) throw new Error("El archivo pasa de 12 MB")
    const a = guardarArchivo(datos, o.adjunto.mime, o.adjunto.nombre)
    adjunto = { tipo: o.adjunto.tipo, url: a.url, nombre: a.nombre, mime: o.adjunto.mime, segundos: o.adjunto.segundos }
    if (o.adjunto.tipo === "audio") {
      voz = { segundos: Math.max(1, Math.round(o.adjunto.segundos ?? 0)) }
      const transcripcion = await transcribir(datos, o.adjunto.mime, o.adjunto.nombre).catch(() => "")
      texto = transcripcion || texto || "Nota de voz"
    }
    if (!texto) texto = o.adjunto.tipo === "imagen" ? "Foto" : o.adjunto.nombre
  }
  if (!texto) throw new Error("Falta el texto o el archivo")
  return recibirDeCliente({ telefono: o.telefono, nombre: o.nombre, texto, canal: o.canal, adjunto, voz })
}
