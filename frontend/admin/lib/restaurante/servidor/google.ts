import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { NEGOCIO, NOMBRE_ZONA, tsLocal } from "../local"
import type { Reserva } from "../tipos"
import { URL_PUBLICA } from "./documentos"

// Misma app de Google que el panel de repuestos (GOOGLE_OAUTH_CLIENT_ID/SECRET). La cuenta que se conecta envía los
// correos desde su Gmail y lleva las reservas en su Google Calendar; Google le manda la invitación al cliente.
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ")

const ARCHIVO = path.join(process.cwd(), ".google-conexion.json")

type Conexion = { refresh: string; correo: string; desde: number }

// La dirección de vuelta es la registrada en Google Cloud: no cambia aunque el panel se abra por un túnel.
export const redireccion = () => process.env.GOOGLE_REDIRECT_BOCA_MARINA || "http://localhost:3200/srv/restaurante/google/callback"
const configurado = () => !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)

function leer(): Conexion | null {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, "utf8")) as Conexion
  } catch {
    return null
  }
}

export function estadoGoogle() {
  const c = leer()
  return { configurado: configurado(), conectado: !!c, correo: c?.correo ?? null, desde: c?.desde ?? null, redireccion: redireccion() }
}

const firma = (s: string) => crypto.createHmac("sha256", process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").update(s).digest("hex").slice(0, 24)

export function urlConectar(volver: string) {
  if (!configurado()) throw new Error("Falta GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en .env.local")
  const datos = Buffer.from(JSON.stringify({ volver, t: Date.now() })).toString("base64url")
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redireccion(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: `${datos}.${firma(datos)}`,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

export async function terminarConexion(code: string, state: string) {
  const [datos, f] = state.split(".")
  if (!datos || f !== firma(datos)) throw new Error("La respuesta de Google no es válida")
  const { volver } = JSON.parse(Buffer.from(datos, "base64url").toString()) as { volver: string }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redireccion(),
      grant_type: "authorization_code",
    }),
  })
  const j = (await r.json()) as { refresh_token?: string; id_token?: string; error_description?: string }
  if (!r.ok || !j.refresh_token) throw new Error(j.error_description ?? "Google no devolvió el permiso sin conexión")
  const correo = j.id_token ? (JSON.parse(Buffer.from(j.id_token.split(".")[1], "base64url").toString()).email as string) : ""
  fs.writeFileSync(ARCHIVO, JSON.stringify({ refresh: j.refresh_token, correo, desde: Date.now() } satisfies Conexion), { mode: 0o600 })
  acceso = null
  return volver.startsWith("/") ? volver : "/admin/conectores"
}

export function desconectar() {
  fs.rmSync(ARCHIVO, { force: true })
  acceso = null
}

let acceso: { token: string; vence: number } | null = null
async function token() {
  const c = leer()
  if (!c) return null
  if (acceso && acceso.vence > Date.now() + 60_000) return acceso.token
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: c.refresh,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  })
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string }
  if (!r.ok || !j.access_token) throw new Error(`Google rechazó la conexión (${j.error ?? r.status}): vuelve a conectar la cuenta`)
  acceso = { token: j.access_token, vence: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return acceso.token
}

export const googleConectado = () => !!leer()
export const correoGoogle = () => leer()?.correo ?? null

async function pedir(url: string, init: RequestInit) {
  const t = await token()
  if (!t) throw new Error("Google no está conectado")
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers ?? {}) } })
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.status === 204 ? null : r.json()
}

/** Envía un mensaje MIME ya armado desde el Gmail conectado. */
export async function enviarGmail(mime: Buffer) {
  await pedir("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", body: JSON.stringify({ raw: mime.toString("base64url") }) })
}

/** Crea, mueve o cancela el evento de la reserva en el calendario conectado; Google avisa al invitado. */
export async function eventoReserva(r: Reserva & { eventoGoogle?: string }, accion: "crear" | "cambiar" | "cancelar", invitado?: string) {
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  const avisar = invitado ? "?sendUpdates=all" : "?sendUpdates=none"
  if (accion === "cancelar") {
    if (r.eventoGoogle) await pedir(`${base}/${r.eventoGoogle}${avisar}`, { method: "DELETE" })
    return null
  }
  const inicio = tsLocal(r.fecha, r.hora)
  const cuerpo = {
    summary: `Boca Marina · ${r.nombre} (${r.personas})`,
    location: NEGOCIO.direccion,
    description: `Reserva ${r.codigo}\n${NOMBRE_ZONA[r.zona]}${r.mesaId ? `, mesa ${r.mesaId}` : ""} · ${r.personas} personas${r.ocasion ? `\n${r.ocasion}` : ""}\n\nVer la reserva: ${URL_PUBLICA}/reserva/${r.codigo}\nWhatsApp: ${NEGOCIO.whatsapp}`,
    start: { dateTime: new Date(inicio).toISOString(), timeZone: "America/Santo_Domingo" },
    end: { dateTime: new Date(inicio + 2 * 3600_000).toISOString(), timeZone: "America/Santo_Domingo" },
    attendees: invitado ? [{ email: invitado, displayName: r.nombre }] : undefined,
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 120 }] },
  }
  if (accion === "cambiar" && r.eventoGoogle) {
    await pedir(`${base}/${r.eventoGoogle}${avisar}`, { method: "PATCH", body: JSON.stringify(cuerpo) })
    return r.eventoGoogle
  }
  const e = (await pedir(`${base}${avisar}`, { method: "POST", body: JSON.stringify(cuerpo) })) as { id: string }
  return e.id
}
