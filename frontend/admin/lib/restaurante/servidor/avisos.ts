import fs from "node:fs"
import path from "node:path"
import nodemailer from "nodemailer"
import { PLATOS } from "../carta"
import { diaLargo, hora12, NEGOCIO, NOMBRE_ZONA } from "../local"
import type { AvisoReserva, Reserva } from "../tipos"
import { ics, pdfBienvenida, pdfReserva, URL_PUBLICA } from "./documentos"
import { correoGoogle, enviarGmail, eventoReserva, googleConectado } from "./google"
import { agregarMensaje, asegurarConversacion, definirAvisos, estado, guardarArchivo, mensajesDe, registrarEvento } from "./motor"

const remitente = (cuenta = process.env.SMTP_USER) => `"${process.env.CORREO_NOMBRE_REMITENTE || "Boca Marina"}" <${cuenta}>`
const armador = nodemailer.createTransport({ streamTransport: true, buffer: true })

let transporte: ReturnType<typeof nodemailer.createTransport> | null = null
function correoListo() {
  const u = process.env.SMTP_USER ?? ""
  if (!process.env.SMTP_HOST || !u || !process.env.SMTP_PASS || /your|example|tu-correo/i.test(u)) return null
  transporte ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return transporte
}

/** En la demo todo correo va a la casilla de pruebas; el destinatario real queda en el asunto y en el texto. */
function destino(r: Reserva) {
  const pruebas = process.env.CORREO_DESTINO_PRUEBAS
  const cliente = r.correo ?? estado().clientes.find((c) => c.id === r.clienteId)?.correo
  return { para: pruebas || cliente, original: cliente }
}

let bienvenida: Buffer | null = null
async function pdfDeBienvenida() {
  bienvenida ??= await pdfBienvenida()
  return bienvenida
}

function anotar(r: Reserva, a: Omit<AvisoReserva, "ts" | "quien">) {
  r.avisos.push({ ts: Date.now(), quien: "Sistema", ...a })
}

function html(titulo: string, cuerpo: string, r: Reserva) {
  return `<!doctype html><html><body style="margin:0;background:#F4ECDF;font-family:Helvetica,Arial,sans-serif;color:#0B2A2E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4ECDF"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFCF6;border-radius:14px;overflow:hidden;border:1px solid #E4D8C3">
<tr><td style="background:#0B2A2E;padding:22px 28px">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#F4ECDF">Boca Marina</div>
<div style="font-size:10px;letter-spacing:3px;color:#7FCFCB">RESTAURANT &amp; LOUNGE</div></td></tr>
<tr><td><img src="cid:portada" width="560" alt="" style="display:block;width:100%;height:auto"></td></tr>
<tr><td style="padding:26px 28px">
<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.15">${titulo}</h1>
${cuerpo}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#F4ECDF;border-radius:10px"><tr><td style="padding:16px 18px;font-size:14px;line-height:1.7">
<b>${diaLargo(r.fecha).replace(/^./, (c) => c.toUpperCase())}, ${hora12(r.hora)}</b><br>
${NOMBRE_ZONA[r.zona]}${r.mesaId ? ` · mesa ${r.mesaId}` : ""} · ${r.personas} personas<br>
Código <b style="color:#C8593B">${r.codigo}</b>${r.ocasion ? `<br>${r.ocasion}` : ""}</td></tr></table>
<p style="font-size:13px;line-height:1.6;color:#5E6E6C;margin:0">Para cambiarla o cancelarla escríbenos por WhatsApp al ${NEGOCIO.whatsapp}. ${NEGOCIO.direccion}.</p>
<p style="margin:18px 0 0"><a href="${URL_PUBLICA}/reserva/${r.codigo}" style="display:inline-block;background:#0B2A2E;color:#F4ECDF;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Ver mi reserva</a></p>
</td></tr></table></td></tr></table></body></html>`
}

async function enviarCorreo(r: Reserva, tipo: AvisoReserva["tipo"], asunto: string, titulo: string, cuerpo: string, adjuntos: { filename: string; content: Buffer | string; contentType: string }[]) {
  const t = correoListo()
  const gmail = googleConectado()
  const { para, original } = destino(r)
  if (!t && !gmail) {
    // Sin cuenta de correo configurada: el correo se arma igual y queda para verlo tal cual le llegaría.
    const a = guardarArchivo(Buffer.from(html(titulo, cuerpo, r).replace("cid:portada", "/boca-marina/pdf/sea-view-sm.jpg")), "text/html; charset=utf-8", `${asunto}.html`)
    anotar(r, { tipo, canal: "correo", texto: `Correo listo para ${original ?? "el cliente"} (vista previa: falta la cuenta de correo)`, estado: "vista_previa", enlace: a.url })
    return
  }
  if (!para) {
    anotar(r, { tipo, canal: "correo", texto: "El cliente no tiene correo", estado: "fallido" })
    return
  }
  // Con Google conectado la invitación la manda Google Calendar: el correo no lleva el .ics para no duplicarla.
  if (gmail) adjuntos = adjuntos.filter((a) => !a.filename.endsWith(".ics"))
  try {
    const opciones = {
      from: remitente(gmail ? correoGoogle() ?? undefined : undefined),
      to: para,
      subject: process.env.CORREO_DESTINO_PRUEBAS ? `${asunto} · para ${r.nombre}${original ? ` <${original}>` : ""}` : asunto,
      html: html(titulo, cuerpo, r),
      attachments: [...adjuntos, { filename: "boca-marina.jpg", path: path.join(process.cwd(), "public", "boca-marina", "pdf", "sea-view-sm.jpg"), cid: "portada" }],
      icalEvent: adjuntos.some((a) => a.filename.endsWith(".ics")) ? { method: tipo === "cancelacion" ? "CANCEL" : "REQUEST", content: ics(r, tipo === "cancelacion" ? "CANCEL" : "REQUEST") } : undefined,
    }
    if (gmail) await enviarGmail((await armador.sendMail(opciones)).message as Buffer)
    else await t!.sendMail(opciones)
    anotar(r, { tipo, canal: "correo", texto: `Correo enviado a ${para}${gmail ? ` desde ${correoGoogle()}` : ""}`, estado: "enviado" })
  } catch (e) {
    anotar(r, { tipo, canal: "correo", texto: `El correo falló: ${(e as Error).message.slice(0, 120)}`, estado: "fallido" })
    registrarEvento({ tipo: "sistema", reservaId: r.id, texto: `No salió el correo de la reserva ${r.codigo}` })
  }
}

async function calendario(r: Reserva, accion: "crear" | "cambiar" | "cancelar") {
  if (!googleConectado()) return
  const { para } = destino(r)
  try {
    const id = await eventoReserva(r, accion, para)
    if (id) r.eventoGoogle = id
    const texto =
      accion === "cancelar" ? "Evento quitado de Google Calendar" : `${accion === "crear" ? "Evento en" : "Evento movido en"} Google Calendar${para ? `: Google le envió la invitación a ${para}` : ""}`
    anotar(r, { tipo: accion === "cancelar" ? "cancelacion" : accion === "crear" ? "confirmacion" : "cambio", canal: "correo", texto, estado: "enviado" })
  } catch (e) {
    anotar(r, { tipo: "nota", canal: "correo", texto: `Google Calendar falló: ${(e as Error).message.slice(0, 120)}`, estado: "fallido" })
  }
}

function conversacionDe(r: Reserva) {
  if (r.conversacionId) return r.conversacionId
  const c = asegurarConversacion(r.clienteId, "whatsapp", "Reserva")
  r.conversacionId = c.id
  return c.id
}

export async function enviarPdfReserva(convId: string, r: Reserva) {
  const pdf = await pdfReserva(r)
  const a = guardarArchivo(pdf, "application/pdf", `Reserva ${r.codigo}.pdf`)
  agregarMensaje(convId, { de: "ia", texto: `Aquí tienes tu reserva ${r.codigo}.`, adjunto: { tipo: "pdf", url: a.url, nombre: a.nombre, mime: "application/pdf" }, reservaId: r.id })
}

export async function enviarBienvenida(convId: string) {
  const a = guardarArchivo(await pdfDeBienvenida(), "application/pdf", "Bienvenido a Boca Marina.pdf")
  agregarMensaje(convId, { de: "ia", texto: "Te comparto nuestra guía de bienvenida: las zonas, los platos de la casa y cómo llegar.", adjunto: { tipo: "pdf", url: a.url, nombre: a.nombre, mime: "application/pdf" } })
}

export function enviarFotoPlato(convId: string, platoId: string) {
  const p = PLATOS.get(platoId)
  if (!p?.foto) throw new Error("Ese plato no tiene foto")
  const ruta = path.join(process.cwd(), "public", "boca-marina", p.foto)
  const a = guardarArchivo(fs.readFileSync(ruta), "image/webp", `${p.nombre}.webp`)
  agregarMensaje(convId, { de: "ia", texto: p.nombre, adjunto: { tipo: "imagen", url: a.url, nombre: a.nombre, mime: "image/webp" } })
}

/** Cuando la reserva la hizo la IA, espera a que ella confirme en el chat para que los PDF lleguen después de su mensaje. */
async function esperarConfirmacionIA(convId: string, r: Reserva) {
  for (let i = 0; i < 60; i++) {
    if (mensajesDe(convId).some((m) => m.de === "ia" && m.ts >= r.creada && m.texto.includes(r.codigo) && !m.adjunto)) return
    await new Promise((ok) => setTimeout(ok, 500))
  }
}

async function confirmada(r: Reserva) {
  const convId = conversacionDe(r)
  if (r.creadaPor === "ia") await esperarConfirmacionIA(convId, r)
  if (r.creadaPor === "panel") agregarMensaje(convId, {
    de: "ia",
    texto: `Tu reserva quedó confirmada: ${NOMBRE_ZONA[r.zona]}, ${diaLargo(r.fecha)} a las ${hora12(r.hora)}, ${r.personas} personas. Código ${r.codigo}. Te escribimos antes de la hora para recordártela.`,
    reservaId: r.id,
  })
  await enviarPdfReserva(convId, r)
  await enviarBienvenida(convId)
  anotar(r, { tipo: "confirmacion", canal: "whatsapp", texto: "WhatsApp con la reserva en PDF y la guía de bienvenida", estado: "enviado" })
  await enviarCorreo(
    r,
    "confirmacion",
    `Tu reserva en Boca Marina está confirmada · ${hora12(r.hora)}`,
    `${r.nombre.split(" ")[0]}, tu mesa frente al mar te espera.`,
    `<p style="font-size:15px;line-height:1.6;margin:0">Gracias por reservar con nosotros. Te dejamos los datos de tu reserva, el PDF para tenerla a mano, nuestra guía de bienvenida y la invitación para tu calendario.</p>`,
    [
      { filename: `Reserva ${r.codigo}.pdf`, content: await pdfReserva(r), contentType: "application/pdf" },
      { filename: "Bienvenido a Boca Marina.pdf", content: await pdfDeBienvenida(), contentType: "application/pdf" },
      { filename: "invitacion.ics", content: ics(r), contentType: "text/calendar" },
    ],
  )
  await calendario(r, "crear")
}

async function recordatorio(r: Reserva) {
  const convId = conversacionDe(r)
  agregarMensaje(convId, {
    de: "ia",
    texto: `Hola, ${r.nombre.split(" ")[0]}. Te recordamos que tienes tu reserva con nosotros hoy a las ${hora12(r.hora)} para ${r.personas} en ${NOMBRE_ZONA[r.zona]}. ¿Nos confirmas que vienen? Responde SÍ o NO.`,
    pasos: [{ herramienta: "recordatorio", resumen: `Reserva ${r.codigo}`, ok: true }],
    reservaId: r.id,
  })
  await enviarPdfReserva(convId, r)
  anotar(r, { tipo: "recordatorio", canal: "whatsapp", texto: "Recordatorio por WhatsApp con la reserva en PDF", estado: "enviado" })
  await enviarCorreo(
    r,
    "recordatorio",
    `Te esperamos hoy a las ${hora12(r.hora)} · Boca Marina`,
    "Hoy nos vemos frente al mar.",
    `<p style="font-size:15px;line-height:1.6;margin:0">Te recordamos tu reserva de hoy. Si algo cambió, responde por WhatsApp y te ayudamos a moverla.</p>`,
    [{ filename: `Reserva ${r.codigo}.pdf`, content: await pdfReserva(r), contentType: "application/pdf" }],
  )
}

async function cambio(r: Reserva) {
  const convId = conversacionDe(r)
  await enviarPdfReserva(convId, r)
  await enviarCorreo(
    r,
    "cambio",
    `Tu reserva en Boca Marina cambió · ${hora12(r.hora)}`,
    "Listo, movimos tu reserva.",
    `<p style="font-size:15px;line-height:1.6;margin:0">Estos son los nuevos datos. Te dejamos el PDF actualizado y la invitación de calendario.</p>`,
    [
      { filename: `Reserva ${r.codigo}.pdf`, content: await pdfReserva(r), contentType: "application/pdf" },
      { filename: "invitacion.ics", content: ics(r), contentType: "text/calendar" },
    ],
  )
  await calendario(r, r.eventoGoogle ? "cambiar" : "crear")
}

async function cancelada(r: Reserva) {
  await enviarCorreo(
    r,
    "cancelacion",
    "Tu reserva en Boca Marina fue cancelada",
    "Cancelamos tu reserva.",
    `<p style="font-size:15px;line-height:1.6;margin:0">Esperamos verte pronto. Cuando quieras volver, escríbenos y te buscamos mesa.</p>`,
    [{ filename: "invitacion.ics", content: ics(r, "CANCEL"), contentType: "text/calendar" }],
  )
  await calendario(r, "cancelar")
}

definirAvisos({ confirmada, recordatorio, cambio, cancelada })
