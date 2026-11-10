import "@/lib/restaurante/servidor/ia"
import "@/lib/restaurante/servidor/avisos"
import { estado, suscribir, type Aviso } from "@/lib/restaurante/servidor/motor"
import { recorte } from "@/lib/restaurante/servidor/recorte"

export const dynamic = "force-dynamic"

// Tiempo real del restaurante: el estado del salón (como mucho una vez por segundo) y cada mensaje al instante.
export function GET(req: Request) {
  const cod = new TextEncoder()
  let cerrar = () => {}
  const flujo = new ReadableStream({
    start(ctrl) {
      const enviar = (evento: string, datos: unknown) => {
        try {
          ctrl.enqueue(cod.encode(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`))
        } catch {
          cerrar()
        }
      }
      enviar("estado", recorte(estado()))
      const quitar = suscribir((a: Aviso) => {
        if (a.tipo === "estado") enviar("estado", recorte(a.estado))
        else enviar(a.tipo, a)
      })
      const latido = setInterval(() => {
        try {
          ctrl.enqueue(cod.encode(`: latido\n\n`))
        } catch {
          cerrar()
        }
      }, 15000)
      cerrar = () => {
        quitar()
        clearInterval(latido)
        try {
          ctrl.close()
        } catch {}
      }
      req.signal.addEventListener("abort", cerrar)
    },
    cancel() {
      cerrar()
    },
  })
  return new Response(flujo, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  })
}
