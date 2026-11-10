import "@/lib/restaurante/servidor/ia"
import "@/lib/restaurante/servidor/avisos"
import { claveVozValida, herramientaVoz, HERRAMIENTAS_VOZ } from "@/lib/restaurante/servidor/voz"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ herramienta: string }> }

// Lo llama el agente de voz de ElevenLabs (herramientas webhook) con la clave en X-Ora-Voz.
export async function POST(req: Request, { params }: Ctx) {
  if (!claveVozValida(req.headers.get("x-ora-voz"))) return Response.json({ ok: false, error: "No autorizado" }, { status: 401 })
  const { herramienta } = await params
  if (!HERRAMIENTAS_VOZ.has(herramienta)) return Response.json({ ok: false, error: "Herramienta desconocida" }, { status: 404 })
  try {
    const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return Response.json(herramientaVoz(herramienta, cuerpo))
  } catch (e) {
    return Response.json({ ok: false, motivo: (e as Error).message })
  }
}
