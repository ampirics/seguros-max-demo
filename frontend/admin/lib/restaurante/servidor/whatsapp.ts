import crypto from "node:crypto"
import sharp from "sharp"
import type { Adjunto, Conversacion, Mensaje } from "../tipos"
import { recibirMensajeCliente, type AdjuntoEntrante } from "./entrada"
import { archivo, definirSalida, estado, registrarEvento } from "./motor"

// WhatsApp Cloud API de Meta. Con WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID las conversaciones que entran por
// el webhook salen por el mismo número; el simulador sigue igual.
const VERSION = () => process.env.META_GRAPH_VERSION || "v21.0"
const GRAPH = () => `https://graph.facebook.com/${VERSION()}`
const secreto = () => process.env.WHATSAPP_APP_SECRET ?? ""
export const tokenVerificacion = () => process.env.WHATSAPP_VERIFY_TOKEN || secreto()
export const whatsappListo = () => !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && secreto())

const auth = () => ({ Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` })

/** Firma de Meta sobre el cuerpo crudo, antes de leer nada. */
export function firmaValida(crudo: string, firma: string | null) {
  if (!firma?.startsWith("sha256=") || !secreto()) return false
  const esperada = crypto.createHmac("sha256", secreto()).update(crudo, "utf8").digest("hex")
  const a = Buffer.from(firma.slice(7), "hex")
  const b = Buffer.from(esperada, "hex")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function bajarMedio(id: string) {
  const meta = await fetch(`${GRAPH()}/${id}`, { headers: auth() })
  if (!meta.ok) throw new Error(`Meta no dio el archivo (${meta.status})`)
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string }
  const r = await fetch(url, { headers: auth() })
  if (!r.ok) throw new Error(`No se pudo bajar el archivo (${r.status})`)
  return { datos: Buffer.from(await r.arrayBuffer()), mime: mime_type }
}

type MensajeMeta = {
  from: string
  type: string
  text?: { body: string }
  image?: { id: string; caption?: string }
  audio?: { id: string; voice?: boolean }
  document?: { id: string; filename?: string; caption?: string }
  button?: { text: string }
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }
}

export async function procesarWebhook(cuerpo: {
  entry?: { changes?: { value?: { messages?: MensajeMeta[]; contacts?: { wa_id: string; profile?: { name?: string } }[] } }[] }[]
}) {
  for (const e of cuerpo.entry ?? [])
    for (const c of e.changes ?? []) {
      const v = c.value
      for (const m of v?.messages ?? []) {
        const nombre = v?.contacts?.find((x) => x.wa_id === m.from)?.profile?.name
        let texto = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? ""
        let adjunto: AdjuntoEntrante | undefined
        try {
          if (m.image) {
            const f = await bajarMedio(m.image.id)
            adjunto = { tipo: "imagen", nombre: "foto.jpg", mime: f.mime, datos: f.datos.toString("base64") }
            texto = m.image.caption ?? ""
          } else if (m.audio) {
            const f = await bajarMedio(m.audio.id)
            adjunto = { tipo: "audio", nombre: "nota.ogg", mime: f.mime.split(";")[0], datos: f.datos.toString("base64"), segundos: Math.round(f.datos.length / 2000) }
          } else if (m.document) {
            const f = await bajarMedio(m.document.id)
            adjunto = { tipo: f.mime === "application/pdf" ? "pdf" : "imagen", nombre: m.document.filename ?? "documento.pdf", mime: f.mime, datos: f.datos.toString("base64") }
            texto = m.document.caption ?? ""
          }
        } catch (err) {
          registrarEvento({ tipo: "sistema", texto: `WhatsApp: ${(err as Error).message}` })
        }
        if (!texto && !adjunto) continue
        await recibirMensajeCliente({ telefono: `+${m.from}`, nombre, texto, canal: "whatsapp", adjunto, externo: "meta" })
      }
    }
}

async function enviar(cuerpo: Record<string, unknown>) {
  const r = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...cuerpo }),
  })
  if (!r.ok) throw new Error(`Meta ${r.status}: ${(await r.text()).slice(0, 160)}`)
}

async function subir(datos: Buffer, mime: string, nombre: string) {
  const form = new FormData()
  form.append("messaging_product", "whatsapp")
  form.append("type", mime)
  form.append("file", new Blob([new Uint8Array(datos)], { type: mime }), nombre)
  const r = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`, { method: "POST", headers: auth(), body: form })
  if (!r.ok) throw new Error(`Meta no aceptó el archivo (${r.status}): ${(await r.text()).slice(0, 120)}`)
  return ((await r.json()) as { id: string }).id
}

async function enviarAdjunto(para: string, a: Adjunto, texto: string) {
  const id = a.url.split("/").pop() ?? ""
  const f = archivo(id)
  if (!f) throw new Error("No encontré el archivo para enviarlo")
  if (a.tipo === "imagen") {
    // WhatsApp no acepta webp como foto: se manda en jpg.
    const jpg = f.mime === "image/jpeg" ? f.datos : await sharp(f.datos).jpeg({ quality: 85 }).toBuffer()
    const media = await subir(jpg, "image/jpeg", a.nombre.replace(/\.\w+$/, ".jpg"))
    return enviar({ to: para, type: "image", image: { id: media, caption: texto || undefined } })
  }
  const media = await subir(f.datos, f.mime, a.nombre)
  return enviar({ to: para, type: "document", document: { id: media, filename: a.nombre, caption: texto || undefined } })
}

async function salida(conv: Conversacion, msg: Mensaje) {
  if (!whatsappListo()) return
  const c = estado().clientes.find((x) => x.id === conv.clienteId)
  const para = c?.telefono.replace(/\D/g, "")
  if (!para) return
  const firma = msg.de === "equipo" && msg.autor ? `*${msg.autor}:* ` : ""
  if (msg.adjunto && msg.adjunto.tipo !== "audio") await enviarAdjunto(para, msg.adjunto, firma + msg.texto)
  else await enviar({ to: para, type: "text", text: { body: firma + msg.texto, preview_url: true } })
}

// Una cola por conversación: el texto y los PDF llegan en el orden en que se escribieron.
const colas = new Map<string, Promise<void>>()
definirSalida((conv, msg) => {
  const sig = (colas.get(conv.id) ?? Promise.resolve()).then(() => salida(conv, msg))
  colas.set(conv.id, sig.catch(() => undefined))
  return sig
})
