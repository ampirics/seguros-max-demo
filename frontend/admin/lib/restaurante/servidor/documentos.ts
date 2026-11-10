import fs from "node:fs"
import path from "node:path"
import PDFDocument from "pdfkit"
import QRCode from "qrcode"
import { CARTA, FUENTE_PRECIOS, rd } from "../carta"
import { diaLargo, hora12, NEGOCIO, NOMBRE_ZONA, ZONAS } from "../local"
import type { Reserva } from "../tipos"

const TINTA = "#0B2A2E"
const ARENA = "#F4ECDF"
const MAR = "#7FCFCB"
const CORAL = "#E8866A"
const TENUE = "#5E6E6C"
const PAPEL = "#FFFCF6"
const BORDE = "#E4D8C3"

// A5 en puntos
const W = 419.53
const H = 595.28
const M = 30

export const URL_PUBLICA = process.env.PUBLICO_URL || "http://localhost:3200"

type Doc = PDFKit.PDFDocument

function archivoPublico(...partes: string[]) {
  const p = path.join(process.cwd(), "public", ...partes)
  return fs.existsSync(p) ? fs.readFileSync(p) : null
}
const foto = (nombre: string) => archivoPublico("boca-marina", "pdf", `${nombre}.jpg`)

function aBuffer(dibujar: (d: Doc) => void | Promise<void>, titulo: string) {
  return new Promise<Buffer>(async (ok, mal) => {
    const d = new PDFDocument({ size: "A5", margin: 0, info: { Title: titulo, Author: "Boca Marina" } })
    const partes: Buffer[] = []
    d.on("data", (c: Buffer) => partes.push(c))
    d.on("end", () => ok(Buffer.concat(partes)))
    d.on("error", mal)
    try {
      await dibujar(d)
      d.end()
    } catch (e) {
      mal(e)
    }
  })
}

/** Foto recortada a su caja: PDFKit escala con cover pero no recorta. */
function fotoEn(d: Doc, img: Buffer, x: number, y: number, w: number, h: number, radio = 0) {
  d.save()
  if (radio) d.roundedRect(x, y, w, h, radio).clip()
  else d.rect(x, y, w, h).clip()
  d.image(img, x, y, { cover: [w, h], align: "center", valign: "center" })
  d.restore()
}

const horario = () => NEGOCIO.horario.replace(/\.$/, "").toLowerCase()

function fondo(d: Doc) {
  d.rect(0, 0, W, H).fill(ARENA)
}

function portada(d: Doc, img: Buffer | null, alto: number, eyebrow: string, titulo: string) {
  if (img) fotoEn(d, img, 0, 0, W, alto)
  else d.rect(0, 0, W, alto).fill(TINTA)
  d.save().rect(0, 0, W, alto).fillOpacity(0.5).fill(TINTA).restore()
  const logo = archivoPublico("marca", "logo-boca-marina.png")
  if (logo) d.image(logo, M, 24, { width: 32, height: 32 })
  d.fillColor(ARENA).font("Times-Roman").fontSize(19).text("Boca Marina", M + 42, 25, { lineBreak: false })
  d.fillColor(MAR).font("Helvetica").fontSize(6.5).text("RESTAURANT & LOUNGE", M + 42, 47, { characterSpacing: 2.2, lineBreak: false })
  d.fillColor(MAR).font("Helvetica").fontSize(7.5).text(eyebrow, M, alto - 74, { characterSpacing: 2.2 })
  d.fillColor(ARENA).font("Times-Roman").fontSize(26).text(titulo, M, alto - 60, { width: W - 2 * M, lineGap: -2 })
}

function pie(d: Doc) {
  d.moveTo(M, H - 34).lineTo(W - M, H - 34).lineWidth(0.6).strokeColor(BORDE).stroke()
  d.fillColor(TENUE).font("Helvetica").fontSize(7.5)
  d.text(NEGOCIO.direccion, M, H - 26, { lineBreak: false })
  d.text(`WhatsApp ${NEGOCIO.whatsapp}`, M, H - 26, { width: W - 2 * M, align: "right", lineBreak: false })
}

function etiqueta(d: Doc, t: string, x: number, y: number) {
  d.fillColor(TENUE).font("Helvetica").fontSize(6.5).text(t, x, y, { characterSpacing: 1.6, lineBreak: false })
}

function fotoDeReserva(r: Reserva) {
  const o = (r.ocasion ?? "").toLowerCase()
  if (/propuesta|aniversario|rom/.test(o) || r.zona === "gazebo") return foto("propuesta-sm")
  if (r.zona === "terraza") return foto("terrace-sm")
  if (r.zona === "salon") return foto("deck-golden-sm")
  return foto("sea-view-sm")
}

export async function pdfReserva(r: Reserva) {
  const qr = await QRCode.toBuffer(`${URL_PUBLICA}/reserva/${r.codigo}`, { margin: 1, width: 300, color: { dark: TINTA, light: PAPEL } })
  return aBuffer((d) => {
    fondo(d)
    portada(d, fotoDeReserva(r), 236, r.estado === "lista_espera" ? "LISTA DE ESPERA" : "RESERVA CONFIRMADA", `${r.nombre.split(" ")[0]}, te esperamos frente al mar.`)
    const x = M
    let y = 256
    const ancho = W - 2 * M
    const alto = r.notas ? 238 : 200
    d.roundedRect(x, y, ancho, alto, 10).fillAndStroke(PAPEL, BORDE)
    const ix = x + 18
    etiqueta(d, "CUÁNDO", ix, y + 18)
    d.fillColor(TINTA).font("Times-Roman").fontSize(20).text(diaLargo(r.fecha).replace(/^./, (c) => c.toUpperCase()), ix, y + 30, { width: ancho - 140 })
    d.fillColor(CORAL).font("Times-Roman").fontSize(22).text(hora12(r.hora), ix, y + 74, { lineBreak: false })
    d.image(qr, x + ancho - 104, y + 16, { width: 88 })
    y += 112
    etiqueta(d, "DÓNDE", ix, y)
    etiqueta(d, "PERSONAS", ix + 190, y)
    d.fillColor(TINTA).font("Helvetica").fontSize(10.5)
    d.text(`${NOMBRE_ZONA[r.zona]}${r.mesaId ? ` · mesa ${r.mesaId}` : ""}`, ix, y + 11, { width: 180 })
    d.text(String(r.personas), ix + 190, y + 11, { lineBreak: false })
    y += 38
    etiqueta(d, "A NOMBRE DE", ix, y)
    etiqueta(d, "CÓDIGO", ix + 190, y)
    d.fillColor(TINTA).font("Helvetica").fontSize(10.5).text(r.nombre, ix, y + 11, { width: 180 })
    d.fillColor(CORAL).font("Courier-Bold").fontSize(14).text(r.codigo, ix + 190, y + 10, { lineBreak: false })
    if (r.ocasion || r.notas) {
      y += 38
      etiqueta(d, r.ocasion ? "OCASIÓN" : "LO QUE NOS PEDISTE", ix, y)
      d.fillColor(TINTA).font("Helvetica").fontSize(9.5).text([r.ocasion, r.notas].filter(Boolean).join(". "), ix, y + 11, { width: ancho - 36 })
    }
    d.fillColor(TENUE).font("Helvetica").fontSize(8.5).text(
      `Escanea el código para ver o confirmar tu reserva. Para cambiarla o cancelarla, escríbenos por WhatsApp al ${NEGOCIO.whatsapp}. Abrimos ${horario()}.`,
      M,
      256 + alto + 14,
      { width: W - 2 * M, lineGap: 1.5 },
    )
    pie(d)
  }, `Reserva ${r.codigo} · Boca Marina`)
}

export async function pdfBienvenida() {
  const destacados = CARTA.filter((p) => p.destacado && p.foto).slice(0, 6)
  return aBuffer((d) => {
    fondo(d)
    portada(d, foto("hero-sunset"), 300, "BIENVENIDO", "Sobre el muelle de Boca Chica, frente al mar Caribe.")
    let y = 322
    d.fillColor(TINTA).font("Times-Roman").fontSize(17).text("Dónde te vas a sentar", M, y)
    y += 26
    for (const z of ZONAS) {
      d.fillColor(TINTA).font("Helvetica-Bold").fontSize(9.5).text(z.nombre, M, y)
      d.fillColor(TENUE).font("Helvetica").fontSize(8.5).text(z.descripcion, M, y + 12, { width: W - 2 * M })
      y += 38
    }
    pie(d)

    d.addPage({ size: "A5", margin: 0 })
    fondo(d)
    d.fillColor(MAR).font("Helvetica").fontSize(7.5).text("LA COCINA DEL MAR", M, 32, { characterSpacing: 2.2 })
    d.fillColor(TINTA).font("Times-Roman").fontSize(21).text("Lo que se pide una y otra vez", M, 46)
    const col = (W - 2 * M - 14) / 2
    destacados.forEach((p, i) => {
      const cx = M + (i % 2) * (col + 14)
      const cy = 84 + Math.floor(i / 2) * 122
      const img = foto(p.foto!.replace(".webp", ""))
      if (img) fotoEn(d, img, cx, cy, col, 78, 6)
      d.fillColor(TINTA).font("Helvetica").fontSize(9.5).text(p.nombre, cx, cy + 84, { width: col })
      d.fillColor(TENUE).fontSize(8.5).text(`${rd(p.precio)}${p.porLibra ? " la libra" : ""}`, cx, cy + 97, { width: col })
    })
    const y2 = 84 + 3 * 122
    d.fillColor(TENUE).font("Helvetica").fontSize(7.5).text(
      `Precios en pesos dominicanos de la ${FUENTE_PRECIOS.replace(/^Carta/, "carta")}; no incluyen 18 % de ITBIS ni 10 % de servicio de ley. La pesca del día y la disponibilidad se confirman en el restaurante.`,
      M,
      y2,
      { width: W - 2 * M },
    )
    d.roundedRect(M, y2 + 30, W - 2 * M, 58, 8).fillAndStroke(PAPEL, BORDE)
    etiqueta(d, "CÓMO LLEGAR", M + 14, y2 + 40)
    d.fillColor(TINTA).font("Helvetica").fontSize(9.5).text(NEGOCIO.direccion, M + 14, y2 + 52)
    d.fillColor(TENUE).fontSize(8).text(`Abrimos ${horario()}. Reservas y eventos por WhatsApp al ${NEGOCIO.whatsapp}.`, M + 14, y2 + 66, { width: W - 2 * M - 28 })
    pie(d)
  }, "Bienvenido a Boca Marina")
}

/** Invitación de calendario (RFC 5545) con alarma 2 horas antes. */
export function ics(r: Reserva, metodo: "REQUEST" | "CANCEL" = "REQUEST") {
  const inicio = new Date(`${r.fecha}T${r.hora}:00-04:00`)
  const fin = new Date(inicio.getTime() + 2 * 3600 * 1000)
  const f = (x: Date) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Boca Marina//Reservas//ES",
    `METHOD:${metodo}`,
    "BEGIN:VEVENT",
    `UID:reserva-${r.codigo}@bocamarina`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(inicio)}`,
    `DTEND:${f(fin)}`,
    `SUMMARY:Reserva en Boca Marina · ${r.personas} personas`,
    `LOCATION:${NEGOCIO.direccion}`,
    `DESCRIPTION:Código ${r.codigo}. ${NOMBRE_ZONA[r.zona]}${r.mesaId ? `, mesa ${r.mesaId}` : ""}. WhatsApp ${NEGOCIO.whatsapp}.`,
    `SEQUENCE:${metodo === "CANCEL" ? 1 : 0}`,
    `STATUS:${metodo === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tu reserva en Boca Marina",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}
