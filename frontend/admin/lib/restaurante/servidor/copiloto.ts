import Anthropic from "@anthropic-ai/sdk"
import { totales } from "../carta"
import { fechaLocal, horaLocal, NOMBRE_CANAL, NOMBRE_ZONA, sumarDias, tsLocal } from "../local"
import type { Zona } from "../tipos"
import { metricas } from "./metricas"
import { estado } from "./motor"

const MODELO = "claude-opus-5-5"
const MIN = 60 * 1000

const SISTEMA = `Eres el asistente interno de Boca Marina Restaurant & Lounge (Boca Chica). Respondes al dueño y al equipo preguntas sobre la operación y el negocio: ventas, mesas, reservas, cocina, platos, meseros, clientes y canales.

Reglas:
- Usa siempre las herramientas para sacar los datos. No inventes cifras ni nombres.
- Respuestas cortas y directas, en español, con la cifra primero. Montos en RD$ con separador de miles. Duraciones en minutos.
- Sin tablas grandes ni markdown pesado: frases o una lista corta de hasta 6 líneas.
- Si un dato no está en las herramientas, dilo en una frase.
- Los precios de la carta no incluyen 18 % de ITBIS ni 10 % de servicio; las ventas sí los incluyen.`

const herramientas: Anthropic.Beta.BetaTool[] = [
  { name: "resumen_hoy", description: "Cómo va el restaurante hoy: ventas cerradas, cuentas, comensales, mesas ocupadas, platos en cocina, llamados abiertos, reservas de hoy por estado y conversaciones esperando al equipo.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "mesas_ahora", description: "Las mesas en este momento: estado, minutos que llevan, comensales, mesero, consumo abierto, cliente y si llamaron.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "reservas",
    description: "Reservas de un día: nombre, hora, personas, zona, mesa, estado (confirmada, recordatorio enviado, confirmó que viene, en lista de espera...), canal y último aviso.",
    input_schema: { type: "object", properties: { fecha: { type: "string", description: "AAAA-MM-DD; por defecto hoy" } }, additionalProperties: false },
  },
  {
    name: "metricas",
    description: "Métricas de un periodo: ventas, visitas, ticket, duración de mesa por zona y por tamaño de grupo, tramos de la visita, platos más y menos vendidos, combinaciones, cocina por estación, meseros (ventas, propinas, respuesta a llamados), canales y reservas (no-show, cancelación, respuesta al recordatorio).",
    input_schema: {
      type: "object",
      properties: { dias: { type: "integer", description: "1 = hoy, 7, 30 o 60" }, zona: { type: "string", enum: ["terraza", "muelle", "gazebo", "salon"] } },
      required: ["dias"],
      additionalProperties: false,
    },
  },
  { name: "buscar_cliente", description: "Busca un cliente por nombre o teléfono: visitas, gasto, puntos, preferencias, alergias y reservas.", input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"], additionalProperties: false } },
]

function ejecutar(nombre: string, e: Record<string, any>) {
  const est = estado()
  const ahora = Date.now()
  const hoy = fechaLocal(ahora)
  switch (nombre) {
    case "resumen_hoy": {
      const ocupadas = est.mesas.filter((m) => !["libre", "reservada", "limpieza"].includes(m.estado))
      const reservas = est.reservas.filter((r) => r.fecha === hoy)
      const porEstado: Record<string, number> = {}
      for (const r of reservas) porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1
      return {
        hora: horaLocal(ahora),
        ventas_cerradas_rd: est.visitasHoy.reduce((s, v) => s + v.total, 0),
        cuentas_cerradas: est.visitasHoy.length,
        consumo_abierto_rd: est.pedidos.reduce((s, p) => s + totales(p.items.reduce((x, i) => x + i.precio, 0)).total, 0),
        comensales_en_salon: ocupadas.reduce((s, m) => s + (m.comensales ?? 0), 0),
        mesas_ocupadas: `${ocupadas.length} de ${est.mesas.length}`,
        platos_en_cocina: est.pedidos.flatMap((p) => p.items).filter((i) => i.estado === "pendiente" || i.estado === "preparando").length,
        llamados_abiertos: est.mesas.filter((m) => m.llamado).map((m) => `${m.nombre}: ${m.llamado!.tipo === "cuenta" ? "pidió la cuenta" : "llama al mesero"}`),
        reservas_hoy: { total: reservas.length, personas: reservas.reduce((s, r) => s + r.personas, 0), por_estado: porEstado },
        conversaciones_esperando_equipo: est.conversaciones.filter((c) => c.estado === "esperando_equipo").length,
      }
    }
    case "mesas_ahora":
      return est.mesas.map((m) => {
        const p = m.pedidoId ? est.pedidos.find((x) => x.id === m.pedidoId) : undefined
        return {
          mesa: m.nombre,
          zona: NOMBRE_ZONA[m.zona],
          estado: m.estado,
          minutos_en_mesa: m.tramos ? Math.round((ahora - m.tramos.llegada) / MIN) : Math.round((ahora - m.desde) / MIN),
          comensales: m.comensales ?? 0,
          mesero: est.equipo.find((q) => q.id === m.meseroId)?.nombre ?? null,
          consumo_rd: p ? totales(p.items.reduce((s, i) => s + i.precio, 0)).total : 0,
          cliente: est.clientes.find((c) => c.id === m.clienteId)?.nombre ?? null,
          llamado: m.llamado ? m.llamado.tipo : null,
        }
      })
    case "reservas": {
      const fecha = e.fecha ?? hoy
      return est.reservas
        .filter((r) => r.fecha === fecha)
        .sort((a, b) => a.hora.localeCompare(b.hora))
        .map((r) => ({
          codigo: r.codigo,
          nombre: r.nombre,
          hora: r.hora,
          personas: r.personas,
          zona: NOMBRE_ZONA[r.zona],
          mesa: r.mesaId ?? null,
          estado: r.estado,
          canal: NOMBRE_CANAL[r.canal],
          ocasion: r.ocasion ?? null,
          ultimo_aviso: r.avisos.at(-1)?.texto ?? null,
          falta_minutos: Math.round((tsLocal(r.fecha, r.hora) - ahora) / MIN),
        }))
    }
    case "metricas": {
      const m = metricas({ dias: Math.min(90, Math.max(1, Number(e.dias) || 30)), zona: e.zona as Zona | undefined })
      return {
        periodo: `${m.desde} a ${m.hasta}`,
        resumen: m.resumen,
        tramos_minutos: m.tramos,
        por_zona: m.porZona,
        por_tamano_grupo: m.porPersonas,
        platos_mas_vendidos: m.platos.slice(0, 8).map((p) => ({ plato: p.nombre, unidades: p.cantidad, ventas_rd: p.importe, mesas_pct: p.mesasPct })),
        platos_menos_vendidos: m.platos.filter((p) => p.cantidad > 0).slice(-6).map((p) => ({ plato: p.nombre, unidades: p.cantidad })),
        platos_sin_venta: m.platos.filter((p) => p.cantidad === 0).map((p) => p.nombre),
        se_piden_juntos: m.combos.slice(0, 5),
        cocina: m.estaciones,
        meseros: m.equipo,
        canales: m.canales,
        reservas: m.reservas,
        dia_semana: m.porDiaSemana,
        horas: m.porHora.filter((h) => h.llegadas > 0),
      }
    }
    case "buscar_cliente": {
      const q = String(e.texto ?? "").toLowerCase()
      const d = q.replace(/\D/g, "")
      return est.clientes
        .filter((c) => c.nombre.toLowerCase().includes(q) || (d.length >= 4 && c.telefono.replace(/\D/g, "").includes(d)))
        .slice(0, 5)
        .map((c) => ({
          nombre: c.nombre,
          telefono: c.telefono,
          visitas: c.visitas,
          gasto_rd: c.gasto,
          puntos: c.puntos,
          ultima_visita: c.ultimaVisita ? fechaLocal(c.ultimaVisita) : null,
          preferencias: c.preferencias,
          alergias: c.alergias ?? [],
          ocasiones: c.ocasiones,
          etiqueta: c.etiqueta ?? null,
          reservas_proximas: est.reservas.filter((r) => r.clienteId === c.id && r.fecha >= hoy && r.fecha <= sumarDias(hoy, 30)).map((r) => `${r.fecha} ${r.hora}, ${r.personas} personas, ${r.estado}`),
        }))
    }
  }
  throw new Error(`Herramienta desconocida: ${nombre}`)
}

let cliente: Anthropic | null = null

export async function preguntarCopiloto(pregunta: string, historial: { de: "usuario" | "asistente"; texto: string }[] = []) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY en frontend/admin/.env.local")
  cliente ??= new Anthropic()
  const mensajes: Anthropic.Beta.BetaMessageParam[] = historial.slice(-10).map((m) => ({ role: m.de === "usuario" ? "user" : "assistant", content: m.texto }))
  while (mensajes.length && mensajes[0].role !== "user") mensajes.shift()
  mensajes.push({ role: "user", content: pregunta })
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const r = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
      tools: herramientas,
      messages: mensajes,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming)
    if (r.stop_reason === "refusal") return "No puedo responder esa pregunta."
    const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
    if (r.stop_reason !== "tool_use" || !usos.length) {
      return r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim()
    }
    mensajes.push({ role: "assistant", content: r.content as Anthropic.Beta.BetaContentBlockParam[] })
    mensajes.push({
      role: "user",
      content: usos.map((u) => {
        try {
          return { type: "tool_result" as const, tool_use_id: u.id, content: JSON.stringify(ejecutar(u.name, (u.input ?? {}) as Record<string, any>)) }
        } catch (err) {
          return { type: "tool_result" as const, tool_use_id: u.id, content: (err as Error).message, is_error: true }
        }
      }),
    })
  }
  return "La pregunta necesitó demasiadas consultas. Prueba a hacerla más concreta."
}

export const SUGERENCIAS_COPILOTO = [
  "¿Cuánto vendimos hoy?",
  "¿Qué mesas llevan más tiempo?",
  "¿Quién no ha confirmado su reserva de hoy?",
  "¿Qué plato se vende menos?",
  "¿Qué mesero responde más rápido los llamados?",
  "¿Qué zona deja más por persona este mes?",
]

export function resumenCopiloto() {
  const est = estado()
  const hoy = fechaLocal(Date.now())
  return {
    ventas_hoy: est.visitasHoy.reduce((s, v) => s + v.total, 0),
    mesas_ocupadas: est.mesas.filter((m) => !["libre", "reservada", "limpieza"].includes(m.estado)).length,
    reservas_hoy: est.reservas.filter((r) => r.fecha === hoy && r.estado !== "cancelada").length,
    conversaciones: est.conversaciones.filter((c) => c.estado !== "cerrada").length,
  }
}

