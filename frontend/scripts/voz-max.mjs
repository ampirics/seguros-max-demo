// Crea o actualiza en ElevenLabs el agente de voz de MAX y le asigna el número. Idempotente.
// Uso: node frontend/scripts/voz-max.mjs <url-publica> [--telefono]
// Lee ELEVENLABS_API_KEY y VOZ_SECRETO de frontend/admin/.env.local y toma el prompt y las herramientas del panel
// (GET /srv/seguros/voz/esquema), que tiene que estar corriendo en PUERTO (3300 por defecto).
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "admin", ".env.local")
const env = {}
if (existsSync(envPath)) {
  for (const linea of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/\s+#.*$/, "").trim()
  }
}
const falla = (m) => { console.error(`ERROR: ${m}`); process.exit(1) }
const necesito = (k) => env[k] || process.env[k] || falla(`falta ${k} en frontend/admin/.env.local`)

const LLAVE = necesito("ELEVENLABS_API_KEY")
const SECRETO = necesito("VOZ_SECRETO")
const NUMERO = env.VOZ_NUMERO || process.env.VOZ_NUMERO || "+17547145308"
const PUERTO = process.env.PUERTO || "3300"
const NOMBRE = "MAX Seguros"
const VOZ = "matPJjeuu5MgFjRpMGfZ"
const base = (process.argv[2] || "").replace(/\/+$/, "")
if (!/^https:\/\//.test(base)) falla("falta la URL pública (https://...) como primer argumento")
const log = (m) => console.log(m)

async function api(metodo, ruta, cuerpo) {
  const headers = { "xi-api-key": LLAVE }
  if (cuerpo) headers["content-type"] = "application/json"
  const r = await fetch("https://api.elevenlabs.io" + ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  const texto = await r.text()
  let json
  try { json = texto ? JSON.parse(texto) : null } catch { json = texto }
  if (!r.ok) throw new Error(`${metodo} ${ruta} -> ${r.status} ${typeof json === "string" ? json : JSON.stringify(json)}`)
  return json
}

const r = await fetch(`http://localhost:${PUERTO}/srv/seguros/voz/esquema`, { headers: { "x-ora-voz": SECRETO } }).catch(() => null)
if (!r) falla(`la demo no está corriendo en el puerto ${PUERTO}: arráncala con ./preparar-demo.sh`)
if (r.status === 401) falla("el panel no tiene el mismo VOZ_SECRETO: vuelve a arrancar la demo con ./preparar-demo.sh")
if (!r.ok) falla(`el panel respondió ${r.status} al pedir el esquema de voz`)
const esquema = await r.json()

const MARCA = "/srv/seguros/voz/"
const existentes = []
for (let cursor = null, i = 0; i < 20; i++) {
  const p = await api("GET", `/v1/convai/tools?page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`)
  existentes.push(...(p.tools ?? []))
  if (!p.has_more || !p.next_cursor) break
  cursor = p.next_cursor
}
const ids = []
for (const h of esquema.herramientas) {
  const config = {
    type: "webhook",
    name: h.nombre,
    description: h.descripcion,
    response_timeout_secs: 20,
    api_schema: {
      url: `${base}${MARCA}${h.nombre}`,
      method: "POST",
      request_headers: { "X-Ora-Voz": SECRETO },
      content_type: "application/json",
      request_body_schema: {
        type: "object",
        description: h.descripcion.slice(0, 200),
        required: h.required,
        properties: {
          ...h.properties,
          telefono_llamada: { type: "string", dynamic_variable: "system__caller_id" },
          llamada_id: { type: "string", dynamic_variable: "system__conversation_id" },
          telefono_cliente: { type: "string", description: "Número con el que la persona dice estar registrada en MAX, solo si no es el número desde el que llama." },
        },
      },
    },
  }
  const previa = existentes.find((t) => (t.tool_config?.name ?? t.name) === h.nombre && String(t.tool_config?.api_schema?.url ?? "").includes(MARCA))
  if (previa) {
    await api("PATCH", `/v1/convai/tools/${previa.id}`, { tool_config: config })
    ids.push(previa.id)
  } else {
    ids.push((await api("POST", "/v1/convai/tools", { tool_config: config })).id)
    log(`herramienta + ${h.nombre}`)
  }
}
log(`herramientas: ${ids.length} apuntando a ${base}`)

const agente = {
  name: NOMBRE,
  tags: ["MAX", "Seguros", "Demo"],
  conversation_config: {
    agent: {
      language: "es",
      first_message: esquema.primer_mensaje,
      prompt: {
        prompt: esquema.prompt,
        llm: "claude-haiku-4-5",
        temperature: 0.3,
        timezone: "America/Santo_Domingo",
        tool_ids: ids,
        built_in_tools: { end_call: { type: "system", name: "end_call", description: "Termina la llamada cuando la conversación concluyó.", params: { system_tool_type: "end_call" } } },
      },
    },
    tts: { voice_id: VOZ, model_id: "eleven_v4_turbo", speed: 1.0, stability: 0.5, similarity_boost: 0.75 },
    turn: { silence_end_call_timeout: 25 },
    conversation: { max_duration_seconds: 900 },
    asr: { keywords: ["MAX", "corredor", "póliza", "siniestro", "marbete", "cédula", "RNC", "Reservas", "Mapfre", "BHD", "Universal", "La Colonial", "Humano", "Sura", "BMI", "Banesco", "Palic", "ARS", "Kia", "Toyota", "Hyundai", "Honda", "Santiago", "Punta Cana"] },
  },
  platform_settings: { privacy: { record_voice: false, retention_days: 30 } },
}

let agenteId = env.VOZ_AGENTE_ID
if (!agenteId) {
  const l = await api("GET", `/v1/convai/agents?search=${encodeURIComponent(NOMBRE)}&page_size=30`)
  agenteId = l.agents.find((a) => a.name === NOMBRE)?.agent_id
}
if (agenteId) {
  await api("PATCH", `/v1/convai/agents/${agenteId}`, agente)
  log(`agente = ${NOMBRE} (${agenteId})`)
} else {
  agenteId = (await api("POST", "/v1/convai/agents/create", agente)).agent_id
  log(`agente + ${NOMBRE} (${agenteId})`)
}

if (process.argv.includes("--telefono")) {
  const nums = await api("GET", "/v1/convai/phone-numbers")
  const n = nums.find((x) => x.phone_number === NUMERO)
  if (!n) falla(`el número ${NUMERO} no está en ElevenLabs`)
  if (n.assigned_agent?.agent_id !== agenteId) {
    await api("PATCH", `/v1/convai/phone-numbers/${n.phone_number_id}`, { agent_id: agenteId })
    log(`número ${NUMERO}: antes atendía ${n.assigned_agent?.agent_name ?? "nadie"}, ahora atiende ${NOMBRE}`)
  } else log(`número ${NUMERO}: ya atiende ${NOMBRE}`)
}
log("voz ok")
