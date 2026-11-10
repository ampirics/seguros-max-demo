import "@/lib/seguros/servidor/ia"
import { recibirMensajeCliente } from "@/lib/seguros/servidor/entrada"
import { actualizarConversacion, agregarMensaje, archivo, ejecutar, estado, mensajesDe, type Accion } from "@/lib/seguros/servidor/motor"
import { metricas } from "@/lib/seguros/servidor/metricas"
import { recorte } from "@/lib/seguros/servidor/recorte"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ ruta: string[] }> }

const json = (datos: unknown, status = 200) => Response.json(datos, { status })
const error = (e: unknown, status = 400) => json({ ok: false, error: (e as Error).message ?? String(e) }, status)

export async function GET(req: Request, { params }: Ctx) {
  const ruta = (await params).ruta
  const q = new URL(req.url).searchParams
  try {
    const est = estado()
    switch (ruta[0]) {
      case "estado":
        return json(recorte(est))
      case "archivos": {
        const a = archivo(ruta[1])
        if (!a) return error(new Error("No existe el archivo"), 404)
        return new Response(new Uint8Array(a.datos), { headers: { "Content-Type": a.mime, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`, "Cache-Control": "private, max-age=3600" } })
      }
      case "metricas":
        return json(metricas(est, Math.min(365, Math.max(7, Number(q.get("dias") ?? 90)))))
      case "conversaciones":
        if (ruta[2] === "mensajes") return json(mensajesDe(ruta[1]))
        return json(
          est.conversaciones.map((c) => {
            const cli = est.clientes.find((x) => x.id === c.clienteId)
            return { ...c, cliente: cli ? { nombre: cli.nombre, telefono: cli.telefono } : null, ultimo: mensajesDe(c.id).at(-1) ?? null }
          }),
        )
      case "clientes": {
        const c = est.clientes.find((x) => x.id === ruta[1])
        if (!c) return error(new Error("No existe el asegurado"), 404)
        return json({
          cliente: c,
          polizas: est.polizas.filter((p) => p.clienteId === c.id).sort((a, b) => b.inicio - a.inicio),
          oportunidades: est.oportunidades.filter((o) => o.clienteId === c.id).sort((a, b) => b.creada - a.creada),
          siniestros: est.siniestros.filter((s) => s.clienteId === c.id).sort((a, b) => b.reportado - a.reportado),
          conversacion: c.conversacionId ? est.conversaciones.find((x) => x.id === c.conversacionId) ?? null : null,
        })
      }
      case "oportunidades": {
        if (!ruta[1]) {
          const desde = Date.now() - Math.min(400, Number(q.get("dias") ?? 365)) * 86400000
          return json(est.oportunidades.filter((o) => o.creada >= desde).map(({ historial: _h, ...o }) => o))
        }
        const o = est.oportunidades.find((x) => x.id === ruta[1] || x.codigo === ruta[1])
        if (!o) return error(new Error("No existe la oportunidad"), 404)
        const c = est.clientes.find((x) => x.id === o.clienteId)!
        return json({ oportunidad: o, cliente: c, polizas: est.polizas.filter((p) => p.clienteId === c.id && p.estado !== "renovada"), conversacion: o.conversacionId ? est.conversaciones.find((x) => x.id === o.conversacionId) ?? null : null })
      }
      case "siniestros": {
        const s = est.siniestros.find((x) => x.id === ruta[1] || x.codigo === ruta[1])
        if (!s) return error(new Error("No existe el siniestro"), 404)
        return json({ siniestro: s, cliente: est.clientes.find((x) => x.id === s.clienteId), poliza: s.polizaId ? est.polizas.find((p) => p.id === s.polizaId) ?? null : null, conversacion: s.conversacionId ? est.conversaciones.find((x) => x.id === s.conversacionId) ?? null : null })
      }
      case "polizas": {
        const p = est.polizas.find((x) => x.id === ruta[1] || x.numero === ruta[1])
        if (!p) return error(new Error("No existe la póliza"), 404)
        return json({
          poliza: p,
          cliente: est.clientes.find((x) => x.id === p.clienteId),
          anteriores: est.polizas.filter((x) => x.clienteId === p.clienteId && x.ramo === p.ramo && x.id !== p.id),
          siniestros: est.siniestros.filter((s) => s.polizaId === p.id),
        })
      }
    }
    return error(new Error("Ruta desconocida"), 404)
  } catch (e) {
    return error(e, 500)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const ruta = (await params).ruta
  try {
    const cuerpo = await req.json().catch(() => ({}))
    switch (ruta[0]) {
      case "accion":
        return json(ejecutar(cuerpo as Accion) ?? { ok: true })
      case "simulador":
        if (!cuerpo.telefono || (!cuerpo.texto && !cuerpo.adjunto)) throw new Error("Falta el teléfono, el texto o el archivo")
        return json(await recibirMensajeCliente({ telefono: String(cuerpo.telefono), nombre: cuerpo.nombre, texto: cuerpo.texto, canal: cuerpo.canal, adjunto: cuerpo.adjunto }))
      case "conversaciones":
        if (ruta[2] === "mensajes") {
          const m = agregarMensaje(ruta[1], { de: cuerpo.de === "sistema" ? "sistema" : "equipo", texto: String(cuerpo.texto ?? ""), autor: cuerpo.autor })
          if (cuerpo.tomar !== false) {
            const conv = estado().conversaciones.find((c) => c.id === ruta[1])
            if (conv && conv.estado !== "equipo") actualizarConversacion(ruta[1], { estado: "equipo", asignadoA: cuerpo.autorId ?? conv.asignadoA })
          }
          return json(m)
        }
    }
    return error(new Error("Ruta desconocida"), 404)
  } catch (e) {
    return error(e)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ruta = (await params).ruta
  try {
    const cuerpo = await req.json()
    if (ruta[0] === "conversaciones" && ruta[1]) return json(actualizarConversacion(ruta[1], cuerpo))
    return error(new Error("Ruta desconocida"), 404)
  } catch (e) {
    return error(e)
  }
}
