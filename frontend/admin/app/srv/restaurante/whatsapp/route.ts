import "@/lib/restaurante/servidor/ia"
import "@/lib/restaurante/servidor/avisos"
import { firmaValida, procesarWebhook, tokenVerificacion, whatsappListo } from "@/lib/restaurante/servidor/whatsapp"

export const dynamic = "force-dynamic"

// Verificación del webhook en Meta (Configuration > Webhook): devuelve el challenge si el token coincide.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") && q.get("hub.verify_token") === tokenVerificacion()) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 })
  }
  return new Response("Token de verificación incorrecto", { status: 403 })
}

export async function POST(req: Request) {
  const crudo = await req.text()
  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"))) return new Response("Firma inválida", { status: 401 })
  if (!whatsappListo()) return new Response("WhatsApp no configurado", { status: 503 })
  // Meta reintenta si no recibe 200 rápido: se procesa en segundo plano.
  void procesarWebhook(JSON.parse(crudo)).catch((e) => console.error("[whatsapp]", e))
  return new Response("ok", { status: 200 })
}
