import { preguntarCopiloto, resumenCopiloto, SUGERENCIAS_COPILOTO } from "@/lib/restaurante/servidor/copiloto"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ sugerencias: SUGERENCIAS_COPILOTO, resumen: resumenCopiloto() })
}

export async function POST(req: Request) {
  try {
    const { pregunta, historial } = await req.json()
    if (!pregunta || typeof pregunta !== "string") return Response.json({ ok: false, error: "Falta la pregunta" }, { status: 400 })
    return Response.json({ respuesta: await preguntarCopiloto(pregunta, Array.isArray(historial) ? historial : []), sugerencias: SUGERENCIAS_COPILOTO.slice(0, 4) })
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
