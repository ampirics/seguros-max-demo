import { DIA, ETAPAS, RAMOS, fechaLocal } from "../catalogo"
import type { Estado, Origen, Ramo } from "../tipos"
import { INICIO_ORA_DIAS } from "./historia"

const mediana = (xs: number[]) => {
  if (!xs.length) return null
  const s = xs.slice().sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export function metricas(est: Estado, dias: number) {
  const ahora = Date.now()
  const desde = ahora - dias * DIA
  const inicioOra = ahora - INICIO_ORA_DIAS * DIA
  const ops = est.oportunidades.filter((o) => o.creada >= desde)
  const cerradas = ops.filter((o) => o.etapa === "ganada" || o.etapa === "perdida")
  const ganadas = ops.filter((o) => o.etapa === "ganada")
  const conCotizacion = ops.filter((o) => o.cotizaciones.length || ["propuesta_enviada", "en_decision", "ganada"].includes(o.etapa))
  const calificadas = ops.filter((o) => o.etapa !== "nueva" && o.ejecutivoId)
  const espera = (lista: typeof ops) => mediana(lista.filter((o) => o.primerContacto).map((o) => (o.primerContacto! - o.creada) / 1000))

  const mensual = Array.from({ length: 12 }, (_, i) => {
    const fin = new Date(ahora)
    fin.setUTCDate(1)
    fin.setUTCMonth(fin.getUTCMonth() - (11 - i) + 1)
    const ini = new Date(fin)
    ini.setUTCMonth(ini.getUTCMonth() - 1)
    const mes = est.oportunidades.filter((o) => o.creada >= ini.getTime() && o.creada < fin.getTime())
    const g = mes.filter((o) => o.etapa === "ganada")
    return {
      mes: ini.toLocaleDateString("es-DO", { month: "short", timeZone: "UTC" }).replace(".", ""),
      oportunidades: mes.length,
      ganadas: g.length,
      prima: g.reduce((t, o) => t + (o.primaGanada ?? 0), 0),
      primeraRespuestaMin: Math.round((espera(mes) ?? 0) / 60),
      conOra: ini.getTime() >= inicioOra - 15 * DIA,
    }
  })

  const porOrigen = new Map<Origen, { total: number; ganadas: number }>()
  for (const o of ops) {
    const x = porOrigen.get(o.origen) ?? { total: 0, ganadas: 0 }
    x.total++
    if (o.etapa === "ganada") x.ganadas++
    porOrigen.set(o.origen, x)
  }
  const porRamo = RAMOS.map((r) => {
    const l = ops.filter((o) => o.ramo === r.id)
    const g = l.filter((o) => o.etapa === "ganada")
    return { ramo: r.id as Ramo, total: l.length, ganadas: g.length, prima: g.reduce((t, o) => t + (o.primaGanada ?? 0), 0) }
  }).filter((x) => x.total)

  const ejecutivos = est.equipo
    .filter((p) => p.area.startsWith("comercial"))
    .map((p) => {
      const l = ops.filter((o) => o.ejecutivoId === p.id)
      const g = l.filter((o) => o.etapa === "ganada")
      const abiertas = est.oportunidades.filter((o) => o.ejecutivoId === p.id && ETAPAS.find((e) => e.id === o.etapa)?.abierta).length
      return { id: p.id, nombre: p.nombre, sucursal: p.sucursal, asignadas: l.length, ganadas: g.length, prima: g.reduce((t, o) => t + (o.primaGanada ?? 0), 0), abiertas, cierre: l.length ? g.length / Math.max(1, l.filter((o) => o.etapa === "ganada" || o.etapa === "perdida").length) : 0 }
    })

  const motivos = new Map<string, number>()
  for (const o of ops.filter((x) => x.etapa === "perdida")) motivos.set(o.motivoPerdida ?? "Sin motivo", (motivos.get(o.motivoPerdida ?? "Sin motivo") ?? 0) + 1)

  const convs = est.conversaciones
  const pasos = convs.length
  const resueltasIa = convs.filter((c) => c.estado !== "esperando_equipo" && c.estado !== "equipo" && !c.pase).length
  const sins = est.siniestros.filter((s) => s.reportado >= desde)
  const cerradosSin = sins.filter((s) => s.estado === "resuelto" || s.estado === "cerrado")
  const diasCierre = mediana(cerradosSin.map((s) => ((s.historial[s.historial.length - 1]?.ts ?? s.reportado) - s.reportado) / DIA))

  const enOra = ops.filter((o) => o.creada >= inicioOra)
  const antes = est.oportunidades.filter((o) => o.creada < inicioOra && o.creada >= inicioOra - INICIO_ORA_DIAS * DIA)
  const tasa = (l: typeof ops) => {
    const c = l.filter((o) => o.etapa === "ganada" || o.etapa === "perdida")
    return c.length ? l.filter((o) => o.etapa === "ganada").length / c.length : 0
  }

  return {
    dias,
    resumen: {
      oportunidades: ops.length,
      calificadas: calificadas.length,
      tasaCalificacion: ops.length ? calificadas.length / ops.length : 0,
      conCotizacion: conCotizacion.length,
      conversionCotizacion: calificadas.length ? conCotizacion.length / calificadas.length : 0,
      ganadas: ganadas.length,
      conversionPoliza: cerradas.length ? ganadas.length / cerradas.length : 0,
      primaNueva: ganadas.reduce((t, o) => t + (o.primaGanada ?? 0), 0),
      primeraRespuestaSeg: espera(ops),
      atendidasPorIa: ops.filter((o) => o.creadaPor === "ia").length,
      fueraDeHorario: ops.filter((o) => {
        const h = new Date(o.creada - 4 * 3600000)
        const hh = h.getUTCHours()
        return hh < 8 || hh >= 18 || h.getUTCDay() === 0
      }).length,
      siniestros: sins.length,
      siniestrosAbiertos: est.siniestros.filter((s) => s.estado !== "cerrado" && s.estado !== "resuelto").length,
      diasCierreSiniestro: diasCierre,
      conversaciones: pasos,
      contencion: pasos ? resueltasIa / pasos : 0,
    },
    comparacion: {
      inicioOra: fechaLocal(inicioOra),
      antes: { primeraRespuestaSeg: espera(antes), conversion: tasa(antes), oportunidades: antes.length },
      conOra: { primeraRespuestaSeg: espera(enOra), conversion: tasa(enOra), oportunidades: enOra.length },
    },
    mensual,
    embudo: ETAPAS.filter((e) => e.id !== "perdida").map((e, i, l) => ({
      etapa: e.id,
      nombre: e.nombre,
      cantidad: ops.filter((o) => {
        const idx = l.findIndex((x) => x.id === o.etapa)
        return o.etapa === "perdida" ? false : idx >= i
      }).length,
    })),
    porOrigen: [...porOrigen.entries()].map(([origen, v]) => ({ origen, ...v })).sort((a, b) => b.total - a.total),
    porRamo: porRamo.sort((a, b) => b.total - a.total),
    ejecutivos: ejecutivos.sort((a, b) => b.prima - a.prima),
    motivosPerdida: [...motivos.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
  }
}

export type Metricas = ReturnType<typeof metricas>
