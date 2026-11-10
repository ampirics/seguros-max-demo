import "@/lib/restaurante/servidor/ia"
import "@/lib/restaurante/servidor/avisos"
import "@/lib/restaurante/servidor/whatsapp"
import { recibirMensajeCliente } from "@/lib/restaurante/servidor/entrada"
import { desconectar, estadoGoogle, terminarConexion, urlConectar } from "@/lib/restaurante/servidor/google"
import { URL_PUBLICA } from "@/lib/restaurante/servidor/documentos"
import { whatsappListo } from "@/lib/restaurante/servidor/whatsapp"
import QRCode from "qrcode"
import {
  actualizarConversacion,
  agregarMensaje,
  ejecutar,
  estado,
  mensajesDe,
  archivo,
  platosFavoritos,
  todasLasReservas,
  todasLasVisitas,
  sesionMesa,
  todosLosGastos,
  librosNegocio,
  type Accion,
} from "@/lib/restaurante/servidor/motor"
import { metricas } from "@/lib/restaurante/servidor/metricas"
import { finanzas } from "@/lib/restaurante/servidor/negocio"
import { PROVEEDORES, RECETAS } from "@/lib/restaurante/inventario"
import { PLATOS, totales } from "@/lib/restaurante/carta"
import { recorte } from "@/lib/restaurante/servidor/recorte"
import type { Zona } from "@/lib/restaurante/tipos"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ ruta: string[] }> }

const json = (datos: unknown, status = 200) => Response.json(datos, { status })
const error = (e: unknown, status = 400) => json({ ok: false, error: (e as Error).message ?? String(e) }, status)

export async function GET(req: Request, { params }: Ctx) {
  const ruta = (await params).ruta
  const q = new URL(req.url).searchParams
  try {
    switch (ruta[0]) {
      case "estado":
        return json(recorte(estado()))
      case "archivos": {
        const a = archivo(ruta[1])
        if (!a) return error(new Error("No existe el archivo"), 404)
        return new Response(new Uint8Array(a.datos), {
          headers: { "Content-Type": a.mime, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`, "Cache-Control": "private, max-age=3600" },
        })
      }
      case "qr": {
        const destino = q.get("ruta") ?? "/llegue"
        if (!destino.startsWith("/")) return error(new Error("Ruta inválida"))
        const png = await QRCode.toBuffer(`${URL_PUBLICA}${destino}`, { margin: 1, width: Math.min(1200, Number(q.get("ancho") ?? 600)), color: { dark: "#0B2A2E", light: "#FFFFFF" } })
        return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } })
      }
      case "finanzas": {
        const dias = Math.min(90, Math.max(1, Number(q.get("dias") ?? 30)))
        return json(finanzas([...todasLasVisitas(), ...estado().visitasHoy.filter((v) => !todasLasVisitas().includes(v))], todosLosGastos(), estado().insumos ?? [], dias))
      }
      case "sesion": {
        const s = sesionMesa(ruta[1] ?? "")
        if (!s) return error(new Error("Esta sesión ya no existe: escanea el QR de nuevo"), 404)
        const e = estado()
        const m = e.mesas.find((x) => x.id === s.mesaId)
        const p = e.pedidos.find((x) => x.id === s.pedidoId)
        const v = s.visitaId ? todasLasVisitas().find((x) => x.id === s.visitaId) : undefined
        const c = s.clienteId ? e.clientes.find((x) => x.id === s.clienteId) : undefined
        const sub = p ? p.items.reduce((t, i) => t + i.precio, 0) : 0
        return json({
          sesion: s,
          estado: v ? "pagada" : p ? (m?.estado === "cuenta" ? "cuenta" : "abierta") : "cerrada",
          mesa: m ? { id: m.id, nombre: m.nombre, zona: m.zona } : null,
          cliente: c ? { nombre: c.nombre } : null,
          pedido: p ?? null,
          cuenta: p ? totales(sub, 0) : null,
          visita: v ? { id: v.id, total: v.total, subtotal: v.subtotal, itbis: v.itbis, servicio: v.servicio, propina: v.propina, metodo: v.metodo, platos: v.platos, calificacion: v.calificacion ?? null, comentario: v.comentario ?? null } : null,
        })
      }
      case "insumos": {
        const i = (estado().insumos ?? []).find((x) => x.id === ruta[1])
        if (!i) return error(new Error("No existe el insumo"), 404)
        const libros = librosNegocio()
        const todas = [...(estado().compras ?? []), ...libros.historicas]
        const movimientos = libros.movimientos.filter((m) => m.insumoId === i.id)
        const hace = (d: number) => Date.now() - d * 24 * 3600 * 1000
        const consumo14 = -movimientos.filter((m) => m.tipo === "consumo" && m.ts >= hace(14)).reduce((s2, m) => s2 + m.cantidad, 0)
        return json({
          insumo: i,
          proveedor: PROVEEDORES.find((p) => p.id === i.proveedorId) ?? null,
          movimientos: movimientos.slice(-80).reverse(),
          consumoDiario: Math.round((consumo14 / 14) * 100) / 100,
          platos: Object.entries(RECETAS)
            .filter(([, r]) => (r[i.id] ?? 0) > 0)
            .map(([platoId, r]) => ({ platoId, nombre: PLATOS.get(platoId)?.nombre ?? platoId, cantidad: r[i.id] })),
          compras: todas.filter((c) => c.lineas.some((l) => l.insumoId === i.id)).sort((a, b) => b.creada - a.creada).slice(0, 10),
        })
      }
      case "compras": {
        const libros = librosNegocio()
        const todas = [...(estado().compras ?? []), ...libros.historicas]
        if (ruta[1]) {
          const c = todas.find((x) => x.id === ruta[1] || x.codigo === ruta[1])
          if (!c) return error(new Error("No existe la orden de compra"), 404)
          return json({ compra: c, proveedor: PROVEEDORES.find((p) => p.id === c.proveedorId) ?? null, gasto: libros.gastos.find((g) => g.compraId === c.id) ?? null, insumos: (estado().insumos ?? []).filter((x) => c.lineas.some((l) => l.insumoId === x.id)) })
        }
        const proveedor = q.get("proveedor")
        return json(todas.filter((c) => !proveedor || c.proveedorId === proveedor).sort((a, b) => b.creada - a.creada).slice(0, Number(q.get("limite") ?? 60)))
      }
      case "gastos": {
        if (ruta[1]) {
          const libros = librosNegocio()
          const g = libros.gastos.find((x) => x.id === ruta[1])
          if (!g) return error(new Error("No existe el gasto"), 404)
          const compra = g.compraId ? [...(estado().compras ?? []), ...libros.historicas].find((c) => c.id === g.compraId) ?? null : null
          return json({ gasto: g, compra, proveedor: PROVEEDORES.find((p) => p.id === (g.proveedorId ?? compra?.proveedorId)) ?? null, insumos: compra ? (estado().insumos ?? []).filter((x) => compra.lineas.some((l) => l.insumoId === x.id)) : [] })
        }
        const desde = Date.now() - Math.min(90, Number(q.get("dias") ?? 30)) * 24 * 3600 * 1000
        return json(todosLosGastos().filter((g) => g.ts >= desde).slice().reverse())
      }
      case "publico":
        return json({ url: URL_PUBLICA })
      case "whatsapp-estado":
        return json({ listo: whatsappListo(), webhook: `${URL_PUBLICA}/srv/restaurante/whatsapp` })
      case "google": {
        if (ruta[1] === "conectar") return Response.redirect(urlConectar(q.get("volver") ?? "/admin/conectores"), 302)
        if (ruta[1] === "callback") {
          const base = new URL(req.url).origin
          if (q.get("error") || !q.get("code")) return Response.redirect(`${base}/admin/conectores?google=cancelado`, 302)
          try {
            const volver = await terminarConexion(q.get("code")!, q.get("state") ?? "")
            return Response.redirect(`${base}${volver}${volver.includes("?") ? "&" : "?"}google=conectado`, 302)
          } catch (e) {
            return Response.redirect(`${base}/admin/conectores?google=error&detalle=${encodeURIComponent((e as Error).message.slice(0, 160))}`, 302)
          }
        }
        return json(estadoGoogle())
      }
      case "metricas":
        return json(metricas({ dias: Math.min(90, Math.max(1, Number(q.get("dias") ?? 30))), zona: (q.get("zona") as Zona) || undefined }))
      case "conversaciones":
        if (ruta[2] === "mensajes") return json(mensajesDe(ruta[1]))
        return json(
          estado().conversaciones.map((c) => {
            const cli = estado().clientes.find((x) => x.id === c.clienteId)
            return { ...c, cliente: cli ? { nombre: cli.nombre, telefono: cli.telefono } : null, ultimo: mensajesDe(c.id).at(-1) ?? null }
          }),
        )
      case "clientes": {
        const c = estado().clientes.find((x) => x.id === ruta[1])
        if (!c) return error(new Error("No existe el cliente"), 404)
        return json({
          cliente: c,
          reservas: todasLasReservas().filter((r) => r.clienteId === c.id).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)),
          visitas: todasLasVisitas().filter((v) => v.clienteId === c.id).sort((a, b) => b.llegada - a.llegada),
          favoritos: platosFavoritos(c.id),
          conversacion: c.conversacionId ? estado().conversaciones.find((x) => x.id === c.conversacionId) ?? null : null,
        })
      }
      case "visitas": {
        if (ruta[1]) {
          const v = todasLasVisitas().find((x) => x.id === ruta[1])
          return v ? json(v) : error(new Error("No existe la visita"), 404)
        }
        const mesa = q.get("mesa")
        const dias = Number(q.get("dias") ?? 1)
        const desde = Date.now() - dias * 24 * 3600 * 1000
        return json(todasLasVisitas().filter((v) => v.llegada >= desde && (!mesa || v.mesaId === mesa)).sort((a, b) => b.llegada - a.llegada))
      }
      case "reservas": {
        if (ruta[1]) {
          const r = todasLasReservas().find((x) => x.id === ruta[1] || x.codigo === ruta[1])
          return r ? json(r) : error(new Error("No existe la reserva"), 404)
        }
        const desde = q.get("desde") ?? "0000"
        const hasta = q.get("hasta") ?? "9999"
        return json(todasLasReservas().filter((r) => r.fecha >= desde && r.fecha <= hasta))
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

export async function DELETE(_req: Request, { params }: Ctx) {
  const ruta = (await params).ruta
  if (ruta[0] !== "google") return error(new Error("Ruta desconocida"), 404)
  desconectar()
  return json(estadoGoogle())
}
