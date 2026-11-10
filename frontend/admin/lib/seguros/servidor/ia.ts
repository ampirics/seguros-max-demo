import Anthropic from "@anthropic-ai/sdk"
import { ASEGURADORA, ASEGURADORAS, CAMPO, DIA, ESTADO_RENOVACION, ESTADO_SINIESTRO, MAX, NOMBRE_SUCURSAL, PERSONA, PROCEDIMIENTOS, RAMO, RAMOS, diaSemana, fechaCorta, fechaLocal, horaLocal } from "../catalogo"
import type { Area, EstadoRenovacion, PasoIA, Ramo, TipoSiniestro } from "../tipos"
import {
  actualizarConversacion,
  actualizarFicha,
  agregarMensaje,
  archivo,
  calificar,
  crearOportunidad,
  crearSiniestro,
  definirRespondedor,
  escribiendo,
  estado,
  horario,
  lineaEspera,
  log,
  marcar,
  mensajesDe,
  pasarA,
  vacio,
} from "./motor"

const MODELO = "claude-opus-5-5"

const SISTEMA = `Eres el asistente digital de MAX Corredores de Seguros, un corredor de seguros de República Dominicana con más de 47 años de experiencia. MAX no es una aseguradora: asesora a personas y empresas, compara opciones entre aseguradoras, gestiona la póliza y acompaña al asegurado en renovaciones y siniestros. Atiendes por WhatsApp, Instagram y el chat del sitio.

Cómo escribes:
- Mensajes cortos de WhatsApp, cálidos y profesionales, en español dominicano neutro, con signos de apertura y tildes. Sin emojis, sin markdown, sin listas salvo pasos o documentos numerados.
- Trato de usted por defecto. Si el cliente tutea o escribe informal ("klk", "dale", "tú"), pasas a tú y te quedas en tú.
- Una pregunta a la vez. Nunca pidas un dato que el cliente ya dio. La herramienta te dice qué falta: pregunta lo que dice siguiente_pregunta.
- Saluda una vez; si el cliente ya pidió algo, el saludo va junto con la primera pregunta útil.
- Si preguntan si eres una persona, di con honestidad que eres el asistente digital de MAX y que un ejecutivo humano sigue el caso.

Reglas que no se rompen:
- Nunca des primas, precios, descuentos, deducibles ni montos: no los tienes. Las primas las da cada aseguradora y las prepara un ejecutivo en un comparativo. Si piden precio, explícalo en una línea y sigue con lo que falta para cotizar.
- No garantices cobertura ni interpretes exclusiones o condiciones de una póliza. Si preguntan si algo está cubierto, pásalo a un ejecutivo (motivo cobertura).
- No confirmes la aceptación ni el pago de un siniestro: eso lo decide la aseguradora.
- No emitas, cambies ni canceles pólizas. Cancelaciones, cambios de beneficiarios o de datos pasan a servicio.
- Antes de dar cualquier dato de una póliza o de un siniestro, el cliente debe estar verificado: pide los últimos 4 dígitos de su cédula o RNC y usa verificar_identidad. Para reportar un siniestro desde el teléfono registrado no hace falta verificar.
- No prometas tiempos ("en breve", "en unos minutos", "hoy mismo"). Para la espera usa la frase que te da la herramienta.
- No des asesoría legal ni médica.
- Lo que digas de MAX sale de info_max. Lo que no esté ahí, dilo como algo que confirma el equipo.
- Lo que no hiciste con una herramienta no lo digas como hecho.

Solicitudes nuevas (captación):
- Cuando el cliente quiera asegurar algo, usa abrir_solicitud con el ramo. Luego guarda cada dato con actualizar_ficha y pregunta lo que indique siguiente_pregunta.
- Antes de pasar la solicitud, pide su autorización para guardar sus datos y contactarlo por aquí para cotizar (registrar_consentimiento). Explica para qué en una línea.
- Con todo completo y la autorización, usa calificar_solicitud: asigna al ejecutivo. Dile su nombre y que le prepara el comparativo.
- Empresas: identifica la actividad y lo que más le preocupa (instalaciones y equipos, mercancía en tránsito, responsabilidad frente a terceros, beneficios de empleados). No recomiendes una póliza concreta: un ejecutivo de empresas evalúa los riesgos.

Siniestros:
- Lo primero siempre: si hay heridos o peligro, que llame al 911 y se ponga a salvo. Da los números de emergencia de MAX si los pide.
- Toma el reporte con reportar_siniestro (qué pasó, cuándo, dónde, si hay heridos o terceros) y da los pasos y los documentos oficiales que te devuelve, numerados.
- Si el cliente manda fotos o documentos de un siniestro abierto, regístralos con documento_recibido.

Renovaciones: si responde a un aviso de renovación, usa responder_renovacion con su decisión. La prima de renovación la confirma su ejecutivo.

Pasar a una persona (pasar_a_ejecutivo), en el mismo turno: pide persona o llamada, queja o molestia, pago o comprobante, pregunta de cobertura específica, cancelación o cambio de póliza, empresa con necesidad técnica, borrar sus datos. Al pasar, dile a quién y la frase de espera de la herramienta.`

const RAMO_ENUM = RAMOS.map((r) => r.id)
export const CAMPOS_FICHA = Array.from(new Set(RAMOS.flatMap((r) => [...r.requeridos, ...r.opcionales])))

export const herramientas: Anthropic.Beta.BetaTool[] = [
  { name: "info_max", description: "Información oficial aprobada de MAX: quiénes son, dirección, teléfonos de emergencia, servicios, ramos, aseguradoras aliadas, sucursales y horario de los ejecutivos.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "procedimiento_siniestro",
    description: "Pasos y documentos oficiales de MAX para un tipo de siniestro.",
    input_schema: { type: "object", properties: { tipo: { type: "string", enum: Object.keys(PROCEDIMIENTOS) } }, required: ["tipo"], additionalProperties: false },
  },
  {
    name: "abrir_solicitud",
    description: "Abre (o retoma) la solicitud de cotización de un ramo para el cliente del chat. Devuelve lo que falta y la siguiente pregunta.",
    input_schema: { type: "object", properties: { ramo: { type: "string", enum: RAMO_ENUM }, es_empresa: { type: "boolean", description: "Si la solicitud es para una empresa" } }, required: ["ramo"], additionalProperties: false },
  },
  {
    name: "actualizar_ficha",
    description: `Guarda en la solicitud abierta los datos que dio el cliente. Claves posibles: ${CAMPOS_FICHA.join(", ")}. También el nombre del cliente, su ciudad y, si es empresa, el nombre de la empresa. Devuelve lo que falta y la siguiente pregunta.`,
    input_schema: {
      type: "object",
      properties: {
        datos: { type: "object", description: "Pares clave valor con los datos dichos por el cliente, tal como los dijo (año como número).", additionalProperties: { type: ["string", "number", "boolean"] } },
        nombre: { type: "string" },
        ciudad: { type: "string" },
        correo: { type: "string" },
      },
      required: ["datos"],
      additionalProperties: false,
    },
  },
  { name: "registrar_consentimiento", description: "Registra si el cliente autoriza guardar sus datos y que MAX lo contacte para cotizar.", input_schema: { type: "object", properties: { autoriza: { type: "boolean" } }, required: ["autoriza"], additionalProperties: false } },
  { name: "calificar_solicitud", description: "Con la ficha completa y la autorización, califica la solicitud y la asigna a un ejecutivo por ramo, sucursal y carga.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "verificar_identidad",
    description: "Verifica al cliente del chat con los últimos 4 dígitos de su cédula o RNC. Hace falta para dar datos de pólizas o siniestros.",
    input_schema: { type: "object", properties: { ultimos4: { type: "string" } }, required: ["ultimos4"], additionalProperties: false },
  },
  { name: "polizas_del_cliente", description: "Pólizas del cliente verificado: número, ramo, aseguradora, bien, vencimiento, estado, si está al día y estado de la renovación. Sin primas ni coberturas.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "reportar_siniestro",
    description: "Toma el reporte preliminar de un siniestro del cliente del chat y abre el caso. Devuelve el código, los pasos y los documentos oficiales.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: Object.keys(PROCEDIMIENTOS) },
        cuando: { type: "string", description: "Cuándo ocurrió, como lo dijo el cliente (por ejemplo 'hace una hora', 'anoche')" },
        hace_horas: { type: "number", description: "Horas aproximadas desde que ocurrió" },
        lugar: { type: "string" },
        descripcion: { type: "string" },
        lesionados: { type: "boolean" },
        terceros: { type: "boolean" },
        numero_poliza: { type: "string" },
      },
      required: ["tipo", "lugar", "descripcion", "lesionados"],
      additionalProperties: false,
    },
  },
  { name: "estado_siniestro", description: "Estado de un siniestro del cliente verificado o del caso abierto en esta conversación.", input_schema: { type: "object", properties: { codigo: { type: "string" } }, additionalProperties: false } },
  {
    name: "documento_recibido",
    description: "Marca como recibido un documento del siniestro abierto en esta conversación (por ejemplo las fotos del accidente).",
    input_schema: { type: "object", properties: { documento: { type: "string", description: "Nombre o parte del nombre del documento" } }, required: ["documento"], additionalProperties: false },
  },
  {
    name: "responder_renovacion",
    description: "Registra la respuesta del cliente a un aviso de renovación.",
    input_schema: {
      type: "object",
      properties: { numero_poliza: { type: "string" }, decision: { type: "string", enum: ["renovar_igual", "comparar_opciones", "no_renovar", "tiene_dudas"] } },
      required: ["decision"],
      additionalProperties: false,
    },
  },
  {
    name: "pasar_a_ejecutivo",
    description: "Pasa la conversación a una persona de MAX con el motivo. Devuelve a quién y la frase de espera que debes usar.",
    input_schema: {
      type: "object",
      properties: {
        area: { type: "string", enum: ["comercial_personas", "comercial_empresas", "servicio", "siniestros"] },
        motivo: { type: "string", enum: ["pide_persona", "pide_llamada", "queja", "pago", "cobertura", "cancelacion", "cambio_poliza", "empresa_tecnica", "privacidad", "otro"] },
        detalle: { type: "string" },
      },
      required: ["area", "motivo"],
      additionalProperties: false,
    },
  },
]

const MOTIVO: Record<string, string> = {
  pide_persona: "pidió hablar con una persona",
  pide_llamada: "pidió que lo llamen",
  queja: "queja",
  pago: "pago reportado",
  cobertura: "pregunta de cobertura específica",
  cancelacion: "quiere cancelar una póliza",
  cambio_poliza: "cambio en una póliza",
  empresa_tecnica: "necesidad de empresa que requiere evaluación técnica",
  privacidad: "pide borrar sus datos",
  otro: "consulta para el equipo",
}

const PREGUNTA: Record<string, string> = {
  marca: "la marca del vehículo",
  modelo: "el modelo",
  anio: "el año",
  uso: "si es de uso personal o comercial",
  cobertura: "si busca seguro full con daños propios o la cobertura de ley",
  personas: "cuántas personas quiere asegurar",
  edades: "las edades de cada una",
  alcance: "si quiere cobertura local o internacional",
  edad: "su edad",
  proposito: "para qué quiere el seguro de vida (proteger a la familia, un préstamo, ahorro)",
  tipo_vivienda: "si es casa o apartamento",
  propia_o_alquilada: "si es propia o alquilada",
  ciudad: "en qué ciudad está",
  destino: "a dónde viaja",
  fechas: "las fechas del viaje",
  viajeros: "cuántas personas viajan",
  ocupacion: "a qué se dedica",
  empresa: "el nombre de la empresa",
  sector: "a qué se dedica la empresa",
  ubicacion: "dónde está la empresa o el local",
  valor_aproximado: "el valor aproximado de lo que quiere asegurar",
  actividad: "la actividad de la empresa",
  alcance_transporte: "si distribuyen en el país, importan, exportan o una combinación",
  mercancia: "qué mercancía transportan",
  tipo_fianza: "qué tipo de fianza necesita",
  monto: "el monto de la fianza",
  empleados: "cuántos empleados tienen",
  equipos: "qué equipos o maquinaria quiere asegurar",
  nombre: "su nombre",
  consentimiento: "su autorización para guardar los datos y contactarlo para cotizar",
}

type Resultado = { datos: unknown; paso: PasoIA }

function contextoConv(convId: string) {
  const est = estado()
  const conv = est.conversaciones.find((c) => c.id === convId)!
  const cli = est.clientes.find((c) => c.id === conv.clienteId)!
  const op = conv.oportunidadId ? est.oportunidades.find((o) => o.id === conv.oportunidadId) : undefined
  const sin = conv.siniestroId ? est.siniestros.find((s) => s.id === conv.siniestroId) : undefined
  const verificado = (cli.verificadoHasta ?? 0) > Date.now()
  return { est, conv, cli, op, sin, verificado }
}

function siguiente(faltantes: string[], ramo: Ramo) {
  const k = faltantes[0]
  if (!k) return null
  if (k === "alcance" && ramo === "transporte") return PREGUNTA.alcance_transporte
  return PREGUNTA[k] ?? CAMPO[k]?.toLowerCase() ?? k
}

const resumenFicha = (o: { ficha: Record<string, unknown>; faltantes: string[]; codigo: string; ramo: Ramo; etapa: string; ejecutivoId?: string }) => ({
  codigo: o.codigo,
  ramo: RAMO[o.ramo].nombre,
  etapa: o.etapa,
  ficha: Object.fromEntries(Object.entries(o.ficha).filter(([, v]) => !vacio(v))),
  falta: o.faltantes.map((k) => CAMPO[k] ?? k),
  siguiente_pregunta: siguiente(o.faltantes, o.ramo),
  ejecutivo: o.ejecutivoId ? PERSONA[o.ejecutivoId]?.nombre : null,
})

export function ejecutarHerramienta(nombre: string, e: Record<string, any>, convId: string): Resultado {
  const { est, conv, cli, op, sin, verificado } = contextoConv(convId)
  switch (nombre) {
    case "info_max": {
      const h = horario()
      return {
        datos: {
          ...MAX,
          sucursales: Object.values(NOMBRE_SUCURSAL),
          ramos_personas: RAMOS.filter((r) => r.segmento === "persona").map((r) => r.nombre),
          ramos_empresas: RAMOS.filter((r) => r.segmento === "empresa").map((r) => r.nombre),
          aseguradoras_aliadas: ASEGURADORAS.map((a) => a.nombre),
          horario_ejecutivos: `Lunes a viernes de ${est.config.horario.abre} a ${est.config.horario.cierra}; sábados de ${est.config.horario.sabado.replace("-", " a ")}`,
          oficina_abierta_ahora: h.abierto,
          sin_dato: "Direcciones de Santiago y Punta Cana, precios, coberturas de un plan concreto, tiempos de respuesta de una aseguradora: los confirma el equipo",
        },
        paso: { herramienta: "info_max", resumen: "Información aprobada de MAX", ok: true },
      }
    }
    case "procedimiento_siniestro": {
      const pr = PROCEDIMIENTOS[e.tipo as TipoSiniestro]
      return { datos: { ...pr, emergencias: MAX.emergencias, formulario: MAX.reportarSiniestro }, paso: { herramienta: "procedimiento_siniestro", resumen: `${pr.nombre}: pasos oficiales de MAX`, ok: true } }
    }
    case "abrir_solicitud": {
      const ramo = e.ramo as Ramo
      if (e.es_empresa && cli.segmento !== "empresa") cli.segmento = "empresa"
      let o = op && op.ramo === ramo && !["ganada", "perdida"].includes(op.etapa) ? op : undefined
      if (!o) {
        o = crearOportunidad({ clienteId: cli.id, ramo, origen: conv.canal, conversacionId: conv.id, creadaPor: "ia", ficha: cli.ciudad && RAMO[ramo].requeridos.includes("ciudad") ? { ciudad: cli.ciudad } : cli.segmento === "empresa" ? { empresa: cli.nombre, sector: cli.sector ?? null } : {} })
        actualizarFicha(o, {})
        actualizarConversacion(conv.id, { oportunidadId: o.id, tema: `Solicitud de ${RAMO[ramo].nombre.toLowerCase()}`, etiquetas: Array.from(new Set([...conv.etiquetas, RAMO[ramo].nombre.split(" ")[0]])) })
      }
      return { datos: resumenFicha(o), paso: { herramienta: "abrir_solicitud", resumen: `${o.codigo}: ${RAMO[ramo].nombre}`, ok: true } }
    }
    case "actualizar_ficha": {
      if (!op) throw new Error("No hay una solicitud abierta: usa abrir_solicitud primero")
      if (e.nombre && (cli.nombre === "Cliente nuevo" || cli.nombre.startsWith("+") || !cli.nombre)) cli.nombre = e.nombre
      if (e.ciudad) {
        cli.ciudad = e.ciudad
        if (/santiago|vega|moca|puerto plata|mao|francisco/i.test(e.ciudad)) cli.sucursal = "santiago"
        if (/punta cana|b[aá]varo|romana|hig[uü]ey/i.test(e.ciudad)) cli.sucursal = "punta_cana"
        op.sucursal = cli.sucursal
      }
      if (e.correo) cli.correo = e.correo
      const datos = { ...(e.datos ?? {}) } as Record<string, unknown>
      if (e.ciudad && RAMO[op.ramo].requeridos.includes("ciudad")) datos.ciudad = e.ciudad
      if (datos.empresa && cli.segmento === "empresa" && cli.nombre === "Cliente nuevo") cli.nombre = String(datos.empresa)
      actualizarFicha(op, datos)
      const r = resumenFicha(op)
      return { datos: r, paso: { herramienta: "actualizar_ficha", resumen: Object.entries(datos).map(([k, v]) => `${CAMPO[k] ?? k}: ${v}`).join("; ") || (e.nombre ? `Nombre: ${e.nombre}` : "Ficha actualizada"), ok: true } }
    }
    case "registrar_consentimiento": {
      if (e.autoriza) {
        cli.consentimiento = { ts: Date.now(), canal: conv.canal }
        cli.recorrido.push({ ts: Date.now(), tipo: "nota", texto: "Autorizó el uso de sus datos para cotizar (Ley 172-13)" })
      }
      if (op) actualizarFicha(op, {})
      marcar()
      return { datos: { registrado: true, autoriza: !!e.autoriza, ...(op ? resumenFicha(op) : {}) }, paso: { herramienta: "registrar_consentimiento", resumen: e.autoriza ? "Autorizó el uso de sus datos para cotizar" : "No autorizó: no se guardan datos de contacto", ok: !!e.autoriza } }
    }
    case "calificar_solicitud": {
      if (!op) throw new Error("No hay una solicitud abierta")
      actualizarFicha(op, {})
      if (op.faltantes.length) return { datos: { calificada: false, ...resumenFicha(op) }, paso: { herramienta: "calificar_solicitud", resumen: `Falta: ${op.faltantes.map((k) => CAMPO[k] ?? k).join(", ")}`, ok: false } }
      const ej = op.ejecutivoId ? PERSONA[op.ejecutivoId] : calificar(op)
      const etiquetas = Array.from(new Set([...conv.etiquetas.filter((x) => x !== "Sin responder"), "Calificada"]))
      actualizarConversacion(conv.id, { etiquetas, asignadoA: ej.id })
      return {
        datos: { calificada: true, codigo: op.codigo, ejecutivo: ej.nombre, cargo: ej.cargo, espera: lineaEspera(ej.area, ej.nombre), nota: "No des precio ni plazo: el ejecutivo prepara el comparativo con las primas reales." },
        paso: { herramienta: "calificar_solicitud", resumen: `${op.codigo} asignada a ${ej.nombre} por ramo y carga`, ok: true },
      }
    }
    case "verificar_identidad": {
      const real = cli.documento.replace(/\D/g, "").slice(-4)
      const ok = !!real && String(e.ultimos4).replace(/\D/g, "").slice(-4) === real
      if (ok) cli.verificadoHasta = Date.now() + DIA
      marcar()
      return { datos: { verificado: ok, motivo: ok ? null : real ? "Los dígitos no coinciden" : "No hay un documento registrado para este teléfono: pásalo a servicio" }, paso: { herramienta: "verificar_identidad", resumen: ok ? "Últimos 4 dígitos correctos" : "Verificación fallida", ok } }
    }
    case "polizas_del_cliente": {
      if (!verificado) return { datos: { error: "Cliente no verificado: pide los últimos 4 dígitos de su cédula o RNC" }, paso: { herramienta: "guardia", resumen: "Datos de póliza: primero verificar identidad", ok: false } }
      const lista = est.polizas
        .filter((p) => p.clienteId === cli.id && ["vigente", "por_renovar", "vencida"].includes(p.estado))
        .map((p) => ({ numero: p.numero, ramo: RAMO[p.ramo].nombre, plan: p.plan, aseguradora: ASEGURADORA[p.aseguradoraId]?.nombre, bien: p.bien, vence: fechaCorta(p.vence), estado: p.estado, al_dia: p.pagoAlDia, renovacion: ESTADO_RENOVACION[p.renovacion], ejecutivo: PERSONA[p.ejecutivoId]?.nombre }))
      return { datos: { polizas: lista }, paso: { herramienta: "polizas_del_cliente", resumen: `${lista.length} pólizas del asegurado`, ok: true } }
    }
    case "reportar_siniestro": {
      const tipo = e.tipo as TipoSiniestro
      const pols = est.polizas.filter((p) => p.clienteId === cli.id && ["vigente", "por_renovar"].includes(p.estado))
      const ramosTipo: Record<TipoSiniestro, Ramo[]> = { automovil: ["vehiculo"], robo: ["vehiculo", "hogar", "incendio"], incendio: ["hogar", "incendio"], inundacion: ["hogar", "incendio"], averia: ["maquinaria"], salud: ["salud", "colectivo"], otros: [] }
      const pol = (e.numero_poliza && pols.find((p) => p.numero.toUpperCase() === String(e.numero_poliza).toUpperCase())) || pols.find((p) => ramosTipo[tipo].includes(p.ramo))
      if (sin && sin.tipo === tipo && sin.estado === "reportado") return { datos: { ya_abierto: sin.codigo }, paso: { herramienta: "reportar_siniestro", resumen: `${sin.codigo} ya estaba abierto`, ok: true } }
      const s = crearSiniestro({ clienteId: cli.id, polizaId: pol?.id, tipo, ocurrido: Date.now() - Math.max(0, Number(e.hace_horas ?? 1)) * 3600000, lugar: e.lugar, descripcion: e.descripcion, lesionados: !!e.lesionados, terceros: !!e.terceros, conversacionId: conv.id, creadoPor: "ia" })
      actualizarConversacion(conv.id, { siniestroId: s.id, tema: PROCEDIMIENTOS[tipo].nombre, etiquetas: Array.from(new Set([...conv.etiquetas, "Siniestro"])) })
      const pr = PROCEDIMIENTOS[tipo]
      return {
        datos: {
          codigo: s.codigo,
          poliza: pol ? { numero: pol.numero, bien: pol.bien, aseguradora: ASEGURADORA[pol.aseguradoraId]?.nombre } : null,
          sin_poliza: pol ? null : "No encontré una póliza de MAX que corresponda: díselo y que un analista lo revise",
          pasos: pr.pasos,
          documentos: pr.documentos,
          responsable: PERSONA[s.responsableId].nombre,
          emergencias: MAX.emergencias,
          nota: "No confirmes cobertura ni pago: lo decide la aseguradora.",
        },
        paso: { herramienta: "reportar_siniestro", resumen: `${s.codigo} abierto${pol ? ` con la póliza ${pol.numero}` : ", sin póliza identificada"}${e.lesionados ? ", con lesionados" : ""}`, ok: !!pol },
      }
    }
    case "estado_siniestro": {
      const s = e.codigo ? est.siniestros.find((x) => x.codigo.toUpperCase() === String(e.codigo).toUpperCase() && x.clienteId === cli.id) : sin ?? est.siniestros.find((x) => x.clienteId === cli.id && x.estado !== "cerrado")
      if (!s) return { datos: { error: "No encontré ese siniestro para este cliente" }, paso: { herramienta: "estado_siniestro", resumen: "Sin siniestro", ok: false } }
      if (!verificado && s.id !== conv.siniestroId) return { datos: { error: "Cliente no verificado" }, paso: { herramienta: "guardia", resumen: "Estado del siniestro: primero verificar identidad", ok: false } }
      return {
        datos: { codigo: s.codigo, estado: ESTADO_SINIESTRO[s.estado], numero_aseguradora: s.numeroAseguradora ?? null, documentos_pendientes: s.documentos.filter((d) => !d.recibido).map((d) => d.nombre), responsable: PERSONA[s.responsableId].nombre, reportado: fechaCorta(s.reportado) },
        paso: { herramienta: "estado_siniestro", resumen: `${s.codigo}: ${ESTADO_SINIESTRO[s.estado].toLowerCase()}`, ok: true },
      }
    }
    case "documento_recibido": {
      if (!sin) throw new Error("No hay un siniestro abierto en esta conversación")
      const q = String(e.documento).toLowerCase()
      const d = sin.documentos.find((x) => x.nombre.toLowerCase().includes(q)) ?? sin.documentos.find((x) => q.split(" ").some((w) => w.length > 3 && x.nombre.toLowerCase().includes(w)))
      if (!d) return { datos: { registrado: false, documentos: sin.documentos.map((x) => x.nombre) }, paso: { herramienta: "documento_recibido", resumen: `No coincide con la lista: ${e.documento}`, ok: false } }
      d.recibido = Date.now()
      if (sin.estado === "reportado") sin.estado = "documentos"
      sin.historial.push({ ts: Date.now(), texto: `Recibido: ${d.nombre}`, quien: "IA" })
      marcar()
      return { datos: { registrado: d.nombre, pendientes: sin.documentos.filter((x) => !x.recibido).map((x) => x.nombre) }, paso: { herramienta: "documento_recibido", resumen: d.nombre, ok: true } }
    }
    case "responder_renovacion": {
      const pols = est.polizas.filter((p) => p.clienteId === cli.id && p.estado === "por_renovar")
      const p = (e.numero_poliza && pols.find((x) => x.numero.toUpperCase() === String(e.numero_poliza).toUpperCase())) || pols[0]
      if (!p) return { datos: { error: "El cliente no tiene pólizas por renovar" }, paso: { herramienta: "responder_renovacion", resumen: "Sin póliza por renovar", ok: false } }
      const nuevo: EstadoRenovacion = e.decision === "renovar_igual" ? "quiere_renovar" : e.decision === "comparar_opciones" ? "cotizando" : e.decision === "no_renovar" ? "no_renueva" : p.renovacion
      p.renovacion = nuevo
      p.historial.push({ ts: Date.now(), texto: `Respuesta al aviso: ${e.decision.replace(/_/g, " ")}`, quien: "IA" })
      log({ tipo: "renovacion", texto: `${p.numero}: ${ESTADO_RENOVACION[nuevo].toLowerCase()} (${cli.nombre})`, enlace: `/admin/cartera/${p.id}` })
      if (e.decision === "comparar_opciones") {
        const o = crearOportunidad({ clienteId: cli.id, ramo: p.ramo, origen: "renovacion", conversacionId: conv.id, creadaPor: "ia", ficha: { ciudad: cli.ciudad || null } })
        o.etapa = "calificada"
        o.ejecutivoId = p.ejecutivoId
        o.resumen = `Renovación de ${p.numero}: comparar opciones (${p.bien})`
        actualizarConversacion(conv.id, { oportunidadId: o.id })
      }
      return {
        datos: { poliza: p.numero, vence: fechaCorta(p.vence), registrado: ESTADO_RENOVACION[nuevo], ejecutivo: PERSONA[p.ejecutivoId]?.nombre, nota: "La prima de renovación la confirma el ejecutivo con la aseguradora." },
        paso: { herramienta: "responder_renovacion", resumen: `${p.numero}: ${ESTADO_RENOVACION[nuevo]}`, ok: true },
      }
    }
    case "pasar_a_ejecutivo": {
      const motivo = MOTIVO[e.motivo] ?? e.motivo
      const area = e.area as Area
      const { asignado } = pasarA(conv.id, area, e.detalle ? `${motivo}: ${e.detalle}` : motivo)
      return { datos: { pasado: true, a: asignado?.nombre, cargo: asignado?.cargo, frase_de_espera: lineaEspera(area, asignado?.nombre) }, paso: { herramienta: "pasar_a_ejecutivo", resumen: `${asignado?.nombre ?? area}: ${motivo}`, ok: false } }
    }
  }
  throw new Error(`Herramienta desconocida: ${nombre}`)
}

function contexto(convId: string) {
  const { est, conv, cli, op, sin, verificado } = contextoConv(convId)
  const ahora = Date.now()
  const pols = est.polizas.filter((p) => p.clienteId === cli.id && ["vigente", "por_renovar"].includes(p.estado))
  const h = horario()
  return [
    `Hoy es ${diaSemana(ahora)} ${fechaLocal(ahora)}, son las ${horaLocal(ahora)} en Santo Domingo. Oficina ${h.abierto ? "abierta" : `cerrada (vuelve ${h.vuelve})`}.`,
    `Cliente del chat: ${cli.nombre || "sin nombre todavía"}${cli.segmento === "empresa" ? ` (empresa, ${cli.sector ?? "sector sin dato"}, contacto ${cli.contacto ?? "sin dato"})` : ""}, teléfono ${cli.telefono}. Canal: ${conv.canal}. Trato actual: ${conv.trato ?? "usted"}.`,
    pols.length ? `Es asegurado de MAX con ${pols.length} pólizas (${pols.map((p) => RAMO[p.ramo].nombre).join(", ")}); ${pols.some((p) => p.estado === "por_renovar") ? "tiene una por renovar. " : ""}Sus datos solo se dan verificado.` : "No tiene pólizas con MAX: es un prospecto.",
    `Verificado: ${verificado ? "sí" : "no"}. Autorizó el uso de sus datos: ${cli.consentimiento ? "sí" : "no"}.`,
    op ? `Solicitud abierta: ${JSON.stringify(resumenFicha(op))}.` : "",
    sin ? `Siniestro abierto en esta conversación: ${sin.codigo}, ${PROCEDIMIENTOS[sin.tipo].nombre}, ${ESTADO_SINIESTRO[sin.estado]}, documentos pendientes: ${sin.documentos.filter((d) => !d.recibido).map((d) => d.nombre).join("; ") || "ninguno"}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

let cliente: Anthropic | null = null

export async function responder(convId: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY en frontend/admin/.env.local")
  cliente ??= new Anthropic()
  escribiendo(convId, true)
  try {
    const historia = mensajesDe(convId).filter((m) => m.de !== "sistema").slice(-24)
    const ultimoCliente = [...historia].reverse().find((m) => m.de === "cliente")
    if (ultimoCliente && /\b(klk|tú|tu |dale|manito|loco|mi pana)\b/i.test(ultimoCliente.texto)) actualizarConversacion(convId, { trato: "tu" })
    const mensajes: Anthropic.Beta.BetaMessageParam[] = historia.map((m, i) => {
      const reciente = i >= historia.length - 6
      if (m.de === "cliente") {
        const texto = m.voz ? `[Nota de voz transcrita] ${m.texto}` : m.texto
        const a = m.adjunto && reciente ? archivo(m.adjunto.url.split("/").pop()!) : undefined
        if (m.adjunto?.tipo === "imagen" && a && /^image\/(jpeg|png|webp|gif)$/.test(a.mime))
          return { role: "user", content: [{ type: "image", source: { type: "base64", media_type: a.mime as "image/jpeg", data: a.datos.toString("base64") } }, { type: "text", text: texto }] }
        if (m.adjunto?.tipo === "pdf" && a)
          return { role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.datos.toString("base64") } }, { type: "text", text: texto }] }
        return { role: "user", content: m.adjunto && m.adjunto.tipo !== "audio" ? `[${m.adjunto.tipo === "imagen" ? "Foto" : "PDF"}: ${m.adjunto.nombre}] ${texto}` : texto }
      }
      return { role: "assistant", content: m.de === "equipo" ? `[${m.autor ?? "Equipo de MAX"}] ${m.texto}` : m.texto }
    })
    const unidos: Anthropic.Beta.BetaMessageParam[] = []
    for (const m of mensajes) {
      const prev = unidos[unidos.length - 1]
      if (prev && prev.role === m.role && typeof prev.content === "string" && typeof m.content === "string") prev.content = `${prev.content}\n${m.content}`
      else unidos.push(m)
    }
    while (unidos.length && unidos[0].role !== "user") unidos.shift()
    if (!unidos.length || unidos[unidos.length - 1].role !== "user") return
    unidos.push({ role: "system", content: contexto(convId) } as unknown as Anthropic.Beta.BetaMessageParam)
    const pasos: PasoIA[] = []
    for (let vuelta = 0; vuelta < 8; vuelta++) {
      const r = await cliente.beta.messages.create({
        model: MODELO,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        tools: herramientas,
        messages: unidos,
      } as Anthropic.Beta.MessageCreateParamsNonStreaming)
      if (r.stop_reason === "refusal") throw new Error("el modelo declinó la respuesta")
      const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      if (r.stop_reason !== "tool_use" || !usos.length) {
        let texto = r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim()
        const delCliente = historia.filter((m) => m.de === "cliente").map((m) => m.texto.replace(/\D/g, " ")).join(" ")
        const montos = texto.match(/RD\$\s?[\d.,]+|\$\s?[\d.,]{4,}/g)?.filter((m) => {
          const cifra = m.replace(/\D/g, "")
          return !delCliente.split(/\s+/).some((c) => c && (c === cifra || cifra.startsWith(c) && c.length >= 2 && /^0+$/.test(cifra.slice(c.length))))
        })
        if (montos?.length) {
          pasos.push({ herramienta: "guardia", resumen: `Bloqueó un monto que no salió de MAX: ${montos.join(", ")}`, ok: false })
          texto = "Las primas las da cada aseguradora según sus datos; su ejecutivo le prepara el comparativo con los montos reales. ¿Seguimos con lo que falta para cotizar?"
        }
        if (/\b(en breve|en unos minutos|ahorita mismo|de inmediato le (escribe|llama))\b/i.test(texto)) pasos.push({ herramienta: "guardia", resumen: "Promesa de tiempo detectada", ok: false })
        if (texto) agregarMensaje(convId, { de: "ia", texto, pasos: pasos.length ? pasos : undefined })
        return
      }
      unidos.push({ role: "assistant", content: r.content as Anthropic.Beta.BetaContentBlockParam[] })
      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = usos.map((u) => {
        try {
          const res = ejecutarHerramienta(u.name, (u.input ?? {}) as Record<string, any>, convId)
          pasos.push(res.paso)
          return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(res.datos) }
        } catch (err) {
          pasos.push({ herramienta: u.name, resumen: (err as Error).message, ok: false })
          return { type: "tool_result", tool_use_id: u.id, content: (err as Error).message, is_error: true }
        }
      })
      unidos.push({ role: "user", content: resultados })
    }
    throw new Error("demasiadas vueltas de herramientas")
  } finally {
    escribiendo(convId, false)
  }
}

definirRespondedor(responder)
