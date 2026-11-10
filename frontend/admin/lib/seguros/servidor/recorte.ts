import { DIA } from "../catalogo"
import type { Estado } from "../tipos"

/** Lo que viaja al navegador en cada cambio: sin historiales ni recorridos, sin lo cerrado de hace meses y solo los asegurados que aparecen. */
export function recorte(e: Estado): Estado {
  const ahora = Date.now()
  const oportunidades = e.oportunidades.filter((o) => o.creada >= ahora - 120 * DIA || !["ganada", "perdida"].includes(o.etapa)).map((o) => ({ ...o, historial: [] }))
  const polizas = e.polizas.filter((p) => p.estado !== "renovada").map((p) => ({ ...p, historial: [] }))
  const siniestros = e.siniestros.filter((s) => s.reportado >= ahora - 200 * DIA || !["cerrado", "resuelto"].includes(s.estado)).map((s) => ({ ...s, historial: [] }))
  const usados = new Set<string>([...oportunidades.map((o) => o.clienteId), ...polizas.map((p) => p.clienteId), ...siniestros.map((s) => s.clienteId), ...e.conversaciones.map((c) => c.clienteId)])
  return {
    ...e,
    ahora,
    eventos: e.eventos.slice(0, 80),
    clientes: e.clientes.filter((c) => usados.has(c.id)).map((c) => ({ ...c, recorrido: [] })),
    oportunidades,
    polizas,
    siniestros,
  }
}
