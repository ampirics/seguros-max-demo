import "@/lib/seguros/servidor/ia"
import { claveVozValida, esquemaVoz, herramientaVoz, HERRAMIENTAS_VOZ } from "@/lib/seguros/servidor/voz"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ herramienta: string }> }

const noAutorizado = () => Response.json({ ok: false, error: "No autorizado" }, { status: 401 })

export async function GET(req: Request, { params }: Ctx) {
  if (!claveVozValida(req.headers.get("x-ora-voz"))) return noAutorizado()
  const { herramienta } = await params
  if (herramienta !== "esquema") return Response.json({ ok: false, error: "No existe" }, { status: 404 })
  return Response.json(esquemaVoz())
}

export async function POST(req: Request, { params }: Ctx) {
  if (!claveVozValida(req.headers.get("x-ora-voz"))) return noAutorizado()
  const { herramienta } = await params
  if (herramienta !== "resumen_llamada" && !HERRAMIENTAS_VOZ.includes(herramienta)) return Response.json({ ok: false, error: "Herramienta desconocida" }, { status: 404 })
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>
  return Response.json(herramientaVoz(herramienta, cuerpo))
}
