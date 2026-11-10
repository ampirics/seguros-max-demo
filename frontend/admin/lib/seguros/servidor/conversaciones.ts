import { ASEGURADORA, DIA, PROCEDIMIENTOS, RAMO, fechaCorta, rd } from "../catalogo"
import type { Canal, Cliente, Conversacion, Estado, Mensaje, Oportunidad, PasoIA, Pase, Ramo, Siniestro } from "../tipos"
import { bienDe } from "./historia"

const MIN = 60 * 1000
const p = (herramienta: string, resumen: string, ok = true): PasoIA => ({ herramienta, resumen, ok })
type Linea = [Mensaje["de"], number, string, (PasoIA[] | { autor: string })?]

interface Semilla {
  conversaciones: Conversacion[]
  mensajes: Map<string, Mensaje[]>
}

export function sembrarConversaciones(ahora: number, est: Estado, n: { nuevoCodigoOp: () => number; nuevoCodigoSin: () => number }): Semilla {
  const conversaciones: Conversacion[] = []
  const mensajes = new Map<string, Mensaje[]>()
  let k = 0

  const cliente = (c: Partial<Cliente> & { nombre: string; telefono: string }): Cliente => {
    const nuevo: Cliente = { id: `cl-g${++k}`, segmento: "persona", documento: "", ciudad: "Santo Domingo", sucursal: "santo_domingo", ejecutivoId: "patricia", desde: ahora, etiquetas: ["Prospecto"], recorrido: [], ...c }
    est.clientes.unshift(nuevo)
    return nuevo
  }

  const conv = (c: Cliente, o: { canal: Canal; tema: string; estado: Conversacion["estado"]; asignadoA?: string; etiquetas: string[]; noLeidos?: number; lineas: Linea[]; pase?: Omit<Pase, "desde">; oportunidad?: Oportunidad; siniestro?: Siniestro; trato?: "usted" | "tu" }) => {
    const id = `conv-g${conversaciones.length + 1}`
    const lista: Mensaje[] = o.lineas.map(([de, hace, texto, extra], i) => ({
      id: `${id}-m${i}`,
      conversacionId: id,
      ts: ahora - hace * MIN,
      de,
      texto,
      autor: de === "ia" ? "Asistente de MAX" : extra && !Array.isArray(extra) ? extra.autor : undefined,
      pasos: Array.isArray(extra) ? extra : undefined,
    }))
    const primeroCliente = lista.find((m) => m.de === "cliente")
    const primeraIa = lista.find((m) => m.de === "ia")
    const ultimo = lista[lista.length - 1]
    const cv: Conversacion = {
      id,
      clienteId: c.id,
      canal: o.canal,
      tema: o.tema,
      estado: o.estado,
      asignadoA: o.asignadoA,
      noLeidos: o.noLeidos ?? 0,
      etiquetas: o.etiquetas,
      creada: lista[0].ts,
      actualizada: ultimo.ts,
      oportunidadId: o.oportunidad?.id,
      siniestroId: o.siniestro?.id,
      pase: o.pase ? { ...o.pase, desde: ultimo.ts } : undefined,
      trato: o.trato ?? "usted",
      primeraRespuestaSeg: primeroCliente && primeraIa ? Math.max(3, Math.round((primeraIa.ts - primeroCliente.ts) / 1000)) : undefined,
    }
    conversaciones.push(cv)
    mensajes.set(id, lista)
    c.conversacionId = id
    c.recorrido.push({ ts: lista[0].ts, tipo: "conversacion", texto: `Conversación por ${o.canal === "instagram" ? "Instagram" : o.canal === "web" ? "el chat del sitio" : "WhatsApp"}: ${o.tema}`, enlace: `/admin/chat?conversacion=${id}` })
    if (o.oportunidad) o.oportunidad.conversacionId = id
    if (o.siniestro) o.siniestro.conversacionId = id
    return cv
  }

  const oportunidad = (c: Cliente, ramo: Ramo, ficha: Oportunidad["ficha"], o: { hace: number; etapa: Oportunidad["etapa"]; ejecutivoId?: string; origen: Oportunidad["origen"]; puntuacion: number; faltantes?: string[] }): Oportunidad => {
    const num = n.nuevoCodigoOp()
    const creada = ahora - o.hace * MIN
    const op: Oportunidad = {
      id: `op-g${num}`,
      codigo: `OP-${String(num).padStart(4, "0")}`,
      clienteId: c.id,
      segmento: RAMO[ramo].segmento === "empresa" || c.segmento === "empresa" ? "empresa" : "persona",
      ramo,
      origen: o.origen,
      etapa: o.etapa,
      prioridad: RAMO[ramo].segmento === "empresa" ? "alta" : "media",
      puntuacion: o.puntuacion,
      ejecutivoId: o.ejecutivoId,
      sucursal: c.sucursal,
      creada,
      actualizada: creada + 4 * MIN,
      primerContacto: creada + 8000,
      ficha,
      faltantes: o.faltantes ?? [],
      resumen: `${RAMO[ramo].nombre}: ${bienDe(ramo, ficha)}`,
      cotizaciones: [],
      historial: [{ ts: creada, texto: "La IA abrió la solicitud desde la conversación", quien: "IA" }],
      creadaPor: "ia",
      siguiente: o.etapa === "calificada" ? { texto: "Validar datos y pedir primas a las aseguradoras", vence: ahora + 3 * 3600000 } : undefined,
    }
    if (o.ejecutivoId) op.historial.push({ ts: creada + 4 * MIN, texto: "Calificada y asignada por la IA", quien: "IA" })
    est.oportunidades.unshift(op)
    c.recorrido.push({ ts: creada, tipo: "oportunidad", texto: `Solicitud de ${RAMO[ramo].nombre.toLowerCase()} (${op.codigo})`, enlace: `/admin/oportunidades/${op.id}` })
    return op
  }

  const conPoliza = (ramo: Ramo, filtro: (c: Cliente) => boolean = () => true, estadoPol: string[] = ["vigente"]) => {
    const pol = est.polizas.find((x) => x.ramo === ramo && estadoPol.includes(x.estado) && filtro(est.clientes.find((c) => c.id === x.clienteId)!) && !est.clientes.find((c) => c.id === x.clienteId)!.conversacionId)!
    return { pol, c: est.clientes.find((c) => c.id === pol.clienteId)! }
  }

  // 1. Vehículo nuevo, del guion de MAX: Kia Sonet 2025, quiere comparar.
  {
    const c = cliente({ nombre: "Carlos Manuel Tejada", telefono: "829-555-4127", ciudad: "Santo Domingo", consentimiento: { ts: ahora - 3 * MIN, canal: "whatsapp" } })
    const o = oportunidad(c, "vehiculo", { marca: "Kia", modelo: "Sonet", anio: 2025, uso: "Personal", cobertura: "Full con daños propios", ciudad: "Santo Domingo", financiado: "Sí, con el Banco Popular" }, { hace: 9, etapa: "calificada", ejecutivoId: "patricia", origen: "whatsapp", puntuacion: 86 })
    conv(c, {
      canal: "whatsapp",
      tema: "Seguro full para Kia Sonet 2025",
      estado: "ia",
      etiquetas: ["Vehículo", "Calificada"],
      noLeidos: 1,
      oportunidad: o,
      trato: "tu",
      lineas: [
        ["cliente", 9, "Buenas, quiero asegurar mi carro. Es un Kia Sonet 2025"],
        ["ia", 9, "¡Buenas! Con gusto te ayudo con el seguro de tu Kia Sonet 2025. ¿Buscas un seguro full, con daños propios, o la cobertura de ley?", [p("info_max", "Ramos y servicios aprobados de MAX"), p("abrir_solicitud", "Vehículo: Kia Sonet 2025")]],
        ["cliente", 8, "Full, pero quiero comparar precios y coberturas"],
        ["ia", 8, "Perfecto, en MAX te comparamos entre varias aseguradoras. ¿Es de uso personal o lo usas para trabajar?", [p("actualizar_ficha", "Cobertura: full con daños propios")]],
        ["cliente", 7, "Personal. Está financiado con el Popular"],
        ["ia", 7, "Anotado. Para que un ejecutivo te prepare el comparativo necesito tu autorización para guardar estos datos y contactarte por aquí. Solo los usamos para cotizar tu seguro. ¿Me autorizas?", [p("actualizar_ficha", "Uso personal, financiado con el Banco Popular")]],
        ["cliente", 5, "Sí, dale. Me llamo Carlos Manuel Tejada"],
        ["ia", 5, "Gracias, Carlos Manuel. Listo: Patricia Gómez, tu ejecutiva, te prepara el comparativo de un seguro full para tu Kia Sonet 2025 y te escribe por aquí. Las primas las da cada aseguradora; no te voy a adelantar un precio que no sea el real. ¿Algo más que quieras que ella sepa?", [p("registrar_consentimiento", "Autorizó el uso de sus datos para cotizar"), p("calificar_solicitud", "OP lista: asignada a Patricia Gómez por ramo y carga"), p("guardia", "Sin montos ni tiempos prometidos")]],
        ["cliente", 1, "Que el banco me pide endoso a favor de ellos"],
      ],
    })
  }

  // 2. Empresa: distribución y mercancía en tránsito, del guion de MAX. Pasa a comercial empresas.
  {
    const c = est.clientes.find((x) => x.nombre === "Distribuidora Caribe Sur")!
    const o = oportunidad(c, "transporte", { empresa: c.nombre, sector: c.sector!, alcance: "Importación y distribución local", mercancia: "Alimentos secos y enlatados", flota: "Sí, 6 camiones", empleados: c.empleados!, valor_por_embarque: 4800000 }, { hace: 31, etapa: "calificada", ejecutivoId: "manuel", origen: "whatsapp", puntuacion: 91 })
    conv(c, {
      canal: "whatsapp",
      tema: "Mercancía en tránsito y flota",
      estado: "esperando_equipo",
      asignadoA: "manuel",
      etiquetas: ["Empresa", "Transporte", "Comercial empresas"],
      noLeidos: 1,
      oportunidad: o,
      pase: { motivo: "necesidad de empresa que requiere evaluación técnica", area: "comercial_empresas", brief: [] },
      lineas: [
        ["cliente", 31, `Buenas tardes, soy ${c.contacto}, de ${c.nombre}. Tenemos una empresa de distribución y quiero saber qué seguros necesitamos`],
        ["ia", 31, `Buenas tardes, ${c.contacto?.split(" ")[0]}. Con gusto le ayudo a preparar la conversación con un ejecutivo de empresas. ¿Qué le preocupa más: instalaciones y equipos, la mercancía en tránsito, la responsabilidad frente a terceros o los beneficios de los empleados?`, [p("info_max", "Seguros de empresas aprobados"), p("ficha_cliente", `${c.nombre}: cliente de MAX con pólizas vigentes`)]],
        ["cliente", 29, "Transporte y mercancía"],
        ["ia", 29, "Entendido. ¿Distribuyen solo dentro del país, importan, exportan o una combinación?", [p("abrir_solicitud", "Transporte de carga")]],
        ["cliente", 27, "Importamos alimentos secos por Haina y los distribuimos en todo el país con 6 camiones propios. Cada contenedor anda por 4.8 millones"],
        ["ia", 26, "Gracias, eso ayuda mucho. Con importación, carga terrestre y flota propia conviene que un ejecutivo revise los riesgos con usted antes de proponer una póliza. Le paso el caso a Manuel Ortega, de empresas, con todo lo que me contó, para que no tenga que repetirlo. En cuanto se desocupe le escribe por aquí.", [p("actualizar_ficha", "Importación y distribución, 6 camiones, RD$ 4.8 M por contenedor"), p("calificar_solicitud", "Asignada a Manuel Ortega (empresas)"), p("pasar_a_ejecutivo", "Comercial empresas: requiere evaluación técnica", false)]],
        ["cliente", 22, "Perfecto. Mañana estoy en la oficina desde las 9"],
      ],
    })
  }

  // 3. Choque, del guion de MAX: asegurado con póliza de vehículo. La IA toma el reporte preliminar.
  {
    const { pol, c } = conPoliza("vehiculo", (x) => x.segmento === "persona" && x.sucursal === "santo_domingo")
    c.verificadoHasta = ahora + DIA
    const num = n.nuevoCodigoSin()
    const s: Siniestro = {
      id: `sin-g${num}`,
      codigo: `SIN-${num}`,
      clienteId: c.id,
      polizaId: pol.id,
      tipo: "automovil",
      ocurrido: ahora - 52 * MIN,
      reportado: ahora - 44 * MIN,
      lugar: "Av. Winston Churchill esq. Gustavo Mejía Ricart, Santo Domingo",
      descripcion: "Le dieron por detrás en un semáforo. El otro conductor admite la culpa. Sin heridos.",
      lesionados: false,
      terceros: true,
      estado: "documentos",
      documentos: PROCEDIMIENTOS.automovil.documentos.map((nombre, i) => ({ nombre, recibido: i === 3 ? ahora - 40 * MIN : undefined })),
      responsableId: "julio",
      montoEstimado: undefined,
      creadoPor: "ia",
      historial: [
        { ts: ahora - 44 * MIN, texto: "Reporte preliminar tomado por la IA en la conversación", quien: "IA" },
        { ts: ahora - 40 * MIN, texto: "Recibido: Fotos del accidente y de los daños", quien: "IA" },
      ],
    }
    est.siniestros.unshift(s)
    c.recorrido.push({ ts: s.reportado, tipo: "siniestro", texto: `Accidente de vehículo (${s.codigo})`, enlace: `/admin/siniestros/${s.id}` })
    const nombre = c.nombre.split(" ")[0]
    conv(c, {
      canal: "whatsapp",
      tema: "Choque en la Churchill",
      estado: "ia",
      etiquetas: ["Siniestro", "Vehículo"],
      siniestro: s,
      lineas: [
        ["cliente", 46, "Tuve un choque, qué hago?"],
        ["ia", 46, `${nombre}, lo primero: ¿hay alguien herido o está en un lugar peligroso ahora mismo? Si hay heridos, llame al 911.`, [p("ficha_cliente", `Asegurado de MAX: ${pol.numero} (${pol.bien})`), p("procedimiento_siniestro", "Accidente de vehículo: pasos oficiales de MAX")]],
        ["cliente", 45, "No, estamos bien. Me dieron por detrás en el semáforo de la Churchill con Gustavo Mejía Ricart. El otro dice que fue su culpa"],
        ["ia", 45, `Qué bueno que están bien. Ya tomé el reporte de su ${pol.bien} con la póliza ${pol.numero}. Pasos ahora:\n1. Llame a la DIGESETT para el acta, porque hay un tercero involucrado.\n2. No repare nada hasta que la aseguradora lo autorice.\n3. Tome fotos de los dos vehículos, las placas y el lugar.\nSu número de caso es ${s.codigo}. ¿Me manda las fotos por aquí?`, [p("reportar_siniestro", `${s.codigo} abierto con la póliza ${pol.numero}`), p("guardia", "No confirma cobertura ni pago: lo decide la aseguradora")]],
        ["cliente", 41, "Ahí van las fotos"],
        ["ia", 40, `Recibidas, gracias. Le faltan: el formulario de la aseguradora, la matrícula y la licencia, el acta de la DIGESETT y la copia del seguro. Julio Pichardo, de siniestros, lleva su caso y le avisa cuando la aseguradora coordine la inspección.`, [p("documento_recibido", "Fotos del accidente y de los daños"), p("asignar_siniestro", "Julio Pichardo, analista de siniestros")]],
        ["cliente", 3, "Ok. El acta me la dan mañana, se la mando"],
      ],
    })
  }

  // 4. Salud familiar, por Instagram.
  {
    const c = cliente({ nombre: "Mariel Encarnación", telefono: "849-555-2290", ciudad: "Santo Domingo Este", consentimiento: { ts: ahora - 61 * MIN, canal: "instagram" } })
    const o = oportunidad(c, "salud", { personas: 4, edades: "38, 41, 9, 6", alcance: "Internacional", seguro_actual: "Solo el de la empresa del esposo", ciudad: "Santo Domingo Este" }, { hace: 66, etapa: "calificada", ejecutivoId: "eduardo", origen: "instagram", puntuacion: 82 })
    conv(c, {
      canal: "instagram",
      tema: "Salud internacional para la familia",
      estado: "ia",
      etiquetas: ["Salud", "Familia"],
      oportunidad: o,
      lineas: [
        ["cliente", 66, "Hola! Quisiera un seguro médico para mi familia, que cubra en el extranjero"],
        ["ia", 66, "¡Hola! Con gusto. ¿Cuántas personas serían y qué edades tienen?", [p("abrir_solicitud", "Salud: cobertura internacional")]],
        ["cliente", 65, "Somos 4. Mi esposo 41, yo 38 y los niños 9 y 6"],
        ["ia", 65, "Gracias. ¿Tienen algún seguro ahora mismo?", [p("actualizar_ficha", "4 personas: 41, 38, 9 y 6 años")]],
        ["cliente", 63, "Solo el de la empresa de mi esposo, pero es básico"],
        ["ia", 63, "Entendido. Un ejecutivo le compara planes internacionales familiares de varias aseguradoras. Los beneficios y exclusiones de cada plan se los explica él con el documento de la aseguradora, para que no haya sorpresas. ¿Me autoriza a guardar estos datos y que la contacten por aquí?", [p("actualizar_ficha", "Seguro actual: el de la empresa del esposo"), p("guardia", "No promete beneficios ni coberturas")]],
        ["cliente", 61, "Sí claro. Mariel Encarnación"],
        ["ia", 61, "Gracias, Mariel. Eduardo Méndez queda con su solicitud y le escribe por aquí con el comparativo.", [p("registrar_consentimiento", "Autorizó el uso de sus datos"), p("calificar_solicitud", "Asignada a Eduardo Méndez")]],
      ],
    })
  }

  // 5. Renovación: respondió al aviso.
  {
    const pol = est.polizas.find((x) => x.estado === "por_renovar" && x.ramo === "vehiculo" && x.renovacion === "aviso_enviado" && est.clientes.find((c) => c.id === x.clienteId)?.segmento === "persona")!
    const c = est.clientes.find((x) => x.id === pol.clienteId)!
    pol.renovacion = "quiere_renovar"
    pol.historial.push({ ts: ahora - 77 * MIN, texto: "El asegurado pidió renovar en las mismas condiciones (por WhatsApp)", quien: "IA" })
    const nombre = c.nombre.split(" ")[0]
    conv(c, {
      canal: "whatsapp",
      tema: "Renovación de su póliza de vehículo",
      estado: "ia",
      etiquetas: ["Renovación"],
      lineas: [
        ["equipo", 26 * 60, `Hola, ${nombre}. Le escribe MAX Corredores de Seguros: su póliza de vehículo de motor ${pol.numero} (${pol.bien}) vence el ${fechaCorta(pol.vence)}. ¿Desea que la renovemos en las mismas condiciones o prefiere que le comparemos opciones con otras aseguradoras?`, { autor: "Renovaciones MAX" }],
        ["cliente", 78, "Buenas, sí, renuévenla igual"],
        ["ia", 77, `Perfecto, ${nombre}. Anoté que desea renovar la ${pol.numero} en las mismas condiciones. Su ejecutivo confirma la prima de renovación con la aseguradora y le escribe por aquí antes del ${fechaCorta(pol.vence)}.`, [p("polizas_del_cliente", `${pol.numero}: vence el ${fechaCorta(pol.vence)}`), p("responder_renovacion", "Quiere renovar en las mismas condiciones"), p("guardia", "No adelanta la prima de renovación")]],
        ["cliente", 76, "Gracias"],
      ],
    })
  }

  // 6. Pago reportado: pasa a servicio.
  {
    const { pol, c } = conPoliza("salud", (x) => x.segmento === "persona")
    const nombre = c.nombre.split(" ")[0]
    conv(c, {
      canal: "whatsapp",
      tema: "Reporta transferencia de la cuota",
      estado: "esperando_equipo",
      asignadoA: "yesenia",
      etiquetas: ["Pago", "Servicio al cliente"],
      noLeidos: 1,
      pase: { motivo: "pago reportado por el asegurado", area: "servicio", brief: [] },
      lineas: [
        ["cliente", 14, "Hola, ya hice la transferencia de la cuota del seguro médico. Les mando el comprobante?"],
        ["ia", 14, `Hola, ${nombre}. Sí, mándelo por aquí. Se lo paso a servicio al cliente para que lo apliquen a su póliza ${pol.numero}; el pago lo confirma una persona del equipo.`, [p("ficha_cliente", `Asegurado: ${pol.numero} (${RAMO[pol.ramo].nombre})`), p("pasar_a_ejecutivo", "Servicio al cliente: pago reportado", false)]],
        ["cliente", 12, "Listo, enviado. Fue por el BHD"],
      ],
    })
  }

  // 7. Pide precio directo por Instagram y deja de responder: queda a medias.
  {
    const c = cliente({ nombre: "Starlin Mota", telefono: "809-555-7713", ciudad: "Santiago", sucursal: "santiago", ejecutivoId: "luis" })
    const o = oportunidad(c, "vehiculo", { marca: "Toyota", modelo: "Corolla", anio: 2020, ciudad: "Santiago" }, { hace: 190, etapa: "nueva", origen: "instagram", puntuacion: 48, faltantes: ["uso", "cobertura", "consentimiento"] })
    conv(c, {
      canal: "instagram",
      tema: "Cuánto cuesta el full de un Corolla",
      estado: "ia",
      etiquetas: ["Vehículo", "Sin responder"],
      oportunidad: o,
      trato: "tu",
      lineas: [
        ["cliente", 191, "Klk, cuánto es el seguro full de un Corolla 2020?"],
        ["ia", 190, "¡Saludos, Starlin! El precio depende de la aseguradora, del valor del carro y de la cobertura, así que te lo comparamos entre varias para que veas el real. ¿Es de uso personal o lo trabajas?", [p("abrir_solicitud", "Vehículo: Toyota Corolla 2020"), p("guardia", "Pide prima sin datos: no se inventa un monto")]],
      ],
    })
  }

  // 8. Queja: su siniestro está tardando. Pasa a siniestros.
  {
    const s = est.siniestros.find((x) => x.estado === "en_aseguradora" && x.tipo === "automovil" && !est.clientes.find((c) => c.id === x.clienteId)?.conversacionId)!
    const c = est.clientes.find((x) => x.id === s.clienteId)!
    const nombre = c.segmento === "empresa" ? (c.contacto ?? c.nombre).split(" ")[0] : c.nombre.split(" ")[0]
    conv(c, {
      canal: "whatsapp",
      tema: "Molesto por la demora de su reclamo",
      estado: "esperando_equipo",
      asignadoA: s.responsableId,
      etiquetas: ["Queja", "Siniestro"],
      noLeidos: 2,
      siniestro: s,
      pase: { motivo: "queja por la demora del reclamo", area: "siniestros", brief: [] },
      lineas: [
        ["cliente", 43, `Tengo ${Math.round((ahora - s.reportado) / DIA)} días esperando por el reclamo del carro y nadie me dice nada. Esto es un abuso`],
        ["ia", 43, `${nombre}, le pido disculpas por la espera. Veo su caso ${s.codigo}: está en la aseguradora${s.numeroAseguradora ? ` con el número ${s.numeroAseguradora}` : ""}. Le paso con el analista que lo lleva para que le dé la respuesta directo.`, [p("verificar_identidad", "Teléfono registrado del asegurado"), p("estado_siniestro", `${s.codigo}: en la aseguradora`), p("pasar_a_ejecutivo", "Siniestros: queja por demora", false)]],
        ["cliente", 41, "Ok pero que sea hoy"],
        ["cliente", 40, "Necesito el carro para trabajar"],
      ],
    })
  }

  // 9. Viaje con visa Schengen, Punta Cana.
  {
    const c = cliente({ nombre: "Daniela Liriano", telefono: "829-555-3381", ciudad: "Punta Cana", sucursal: "punta_cana", ejecutivoId: "nicole", consentimiento: { ts: ahora - 128 * MIN, canal: "web" } })
    const o = oportunidad(c, "viaje", { destino: "Europa (Schengen)", fechas: "Del 12 al 28 de diciembre", viajeros: 2, edades: "34, 36", motivo: "Vacaciones" }, { hace: 135, etapa: "calificada", ejecutivoId: "nicole", origen: "web", puntuacion: 79 })
    conv(c, {
      canal: "web",
      tema: "Seguro de viaje para la visa Schengen",
      estado: "cerrada",
      etiquetas: ["Viaje"],
      oportunidad: o,
      lineas: [
        ["cliente", 135, "Necesito el seguro de viaje que piden para la visa de España"],
        ["ia", 135, "Con gusto. ¿Para cuántas personas y en qué fechas viajan?", [p("abrir_solicitud", "Viaje: Europa (Schengen)")]],
        ["cliente", 132, "Somos 2, mi esposo y yo, del 12 al 28 de diciembre. 34 y 36 años"],
        ["ia", 131, "Perfecto. La embajada pide un seguro de asistencia en viaje que cubra todo el espacio Schengen durante la estadía; su ejecutiva le confirma qué plan cumple ese requisito. ¿Me autoriza a guardar estos datos y que la contacten?", [p("actualizar_ficha", "2 viajeros, 12 al 28 de diciembre"), p("info_max", "Seguro de viaje: ramo aprobado")]],
        ["cliente", 128, "Sí. Daniela Liriano"],
        ["ia", 128, "Gracias, Daniela. Nicole Batista, de Punta Cana, le escribe con las opciones.", [p("registrar_consentimiento", "Autorizó el uso de sus datos"), p("calificar_solicitud", "Asignada a Nicole Batista")]],
        ["equipo", 96, `Hola, Daniela. Soy Nicole, de MAX. Ya tengo dos opciones que cumplen con el requisito de la embajada; se las mando en un momento.`, { autor: "Nicole Batista" }],
      ],
    })
  }

  // 10. Reembolso de salud: la IA da los pasos y documentos oficiales.
  {
    const { pol, c } = conPoliza("salud", (x) => x.segmento === "persona" && x.sucursal === "santiago")
    const proc = PROCEDIMIENTOS.salud
    conv(c, {
      canal: "whatsapp",
      tema: "Cómo pedir un reembolso",
      estado: "cerrada",
      etiquetas: ["Reembolso", "Resuelta por la IA"],
      lineas: [
        ["cliente", 5 * 60, "Buenas, fui a un especialista que no está en la red. Cómo pido el reembolso?"],
        ["ia", 5 * 60 - 1, `Buenas. Para el reembolso de su póliza ${pol.numero} necesita:\n${proc.documentos.map((d, i) => `${i + 1}. ${d}`).join("\n")}\nMe los puede mandar por aquí o por la solicitud de reembolso del sitio de MAX. La aseguradora revisa el monto según las condiciones de su plan.`, [p("verificar_identidad", "Teléfono registrado del asegurado"), p("procedimiento_siniestro", "Reembolso de salud: documentos oficiales"), p("guardia", "No promete monto ni aprobación")]],
        ["cliente", 5 * 60 - 4, "Perfecto, gracias"],
      ],
    })
  }

  // 11. ¿Mi póliza está al día? Pide verificación antes de dar datos.
  {
    const { pol, c } = conPoliza("hogar", (x) => x.segmento === "persona")
    c.verificadoHasta = ahora + 20 * 3600000
    const nombre = c.nombre.split(" ")[0]
    conv(c, {
      canal: "whatsapp",
      tema: "Consulta si su póliza está al día",
      estado: "cerrada",
      etiquetas: ["Póliza", "Resuelta por la IA"],
      lineas: [
        ["cliente", 22 * 60, "Hola, quiero saber si mi seguro de la casa está al día"],
        ["ia", 22 * 60 - 1, `Hola, ${nombre}. Para darle datos de su póliza necesito confirmar que es usted: ¿me dice los últimos 4 dígitos de su cédula?`, [p("guardia", "Datos de póliza: primero verificar identidad")]],
        ["cliente", 22 * 60 - 3, c.documento.replace(/\D/g, "").slice(-4)],
        ["ia", 22 * 60 - 4, `Gracias, ${nombre}. Su póliza ${pol.numero} (${pol.plan}) con ${ASEGURADORA[pol.aseguradoraId]?.nombre ?? "la aseguradora"} está vigente hasta el ${fechaCorta(pol.vence)} y ${pol.pagoAlDia ? "sus pagos están al día" : "tiene una cuota pendiente; servicio al cliente le puede ayudar con eso"}.`, [p("verificar_identidad", "Últimos 4 dígitos de la cédula correctos"), p("polizas_del_cliente", `${pol.numero}: vigente, ${pol.pagoAlDia ? "al día" : "cuota pendiente"}`)]],
        ["cliente", 22 * 60 - 6, "Excelente, gracias"],
      ],
    })
  }

  // 12. Prima del año: una empresa pregunta si su colectivo cubre maternidad (no se interpreta cobertura).
  {
    const { pol, c } = conPoliza("colectivo", (x) => x.segmento === "empresa")
    const nombre = (c.contacto ?? c.nombre).split(" ")[0]
    conv(c, {
      canal: "correo",
      tema: "Pregunta si el colectivo cubre maternidad",
      estado: "equipo",
      asignadoA: c.ejecutivoId,
      etiquetas: ["Empresa", "Cobertura"],
      pase: { motivo: "pregunta de cobertura específica", area: "comercial_empresas", brief: [] },
      lineas: [
        ["cliente", 3 * 60, `Saludos. Una empleada nuestra está embarazada, ¿el seguro colectivo ${pol.numero} le cubre el parto?`],
        ["ia", 3 * 60 - 1, `Saludos, ${nombre}. Lo que cubre el plan para maternidad depende de las condiciones de la póliza ${pol.numero} y de la fecha de inclusión de la empleada; eso lo confirma su ejecutivo con la aseguradora para no darle una respuesta equivocada. Ya le pasé la consulta.`, [p("polizas_del_cliente", `${pol.numero}: ${pol.plan}`), p("guardia", "No interpreta coberturas ni exclusiones"), p("pasar_a_ejecutivo", "Comercial empresas: cobertura específica", false)]],
        ["equipo", 2 * 60, `${nombre}, buenas tardes. Ya lo estoy revisando con la aseguradora; le confirmo hoy mismo con el documento del plan.`, { autor: "Ejecutivo de empresas" }],
      ],
    })
  }

  for (const cv of conversaciones) {
    if (cv.pase && !cv.pase.brief.length) cv.pase.brief = briefSemilla(est, cv)
  }
  return { conversaciones, mensajes }
}

function briefSemilla(est: Estado, cv: Conversacion): string[] {
  const c = est.clientes.find((x) => x.id === cv.clienteId)!
  const pols = est.polizas.filter((x) => x.clienteId === c.id && ["vigente", "por_renovar"].includes(x.estado))
  const o = cv.oportunidadId ? est.oportunidades.find((x) => x.id === cv.oportunidadId) : undefined
  const s = cv.siniestroId ? est.siniestros.find((x) => x.id === cv.siniestroId) : undefined
  return [
    `${c.nombre}${c.segmento === "empresa" ? ` (${c.sector})` : ""}, ${c.telefono}.`,
    pols.length ? `Asegurado de MAX: ${pols.length} ${pols.length === 1 ? "póliza vigente" : "pólizas vigentes"}, prima anual ${rd(pols.reduce((t, x) => t + x.primaAnual, 0))}.` : "Prospecto nuevo.",
    ...(o ? [`${o.codigo}: ${o.resumen}.`] : []),
    ...(s ? [`${s.codigo}: ${PROCEDIMIENTOS[s.tipo].nombre.toLowerCase()}, ${s.documentos.filter((d) => !d.recibido).length} documentos pendientes.`] : []),
    `Motivo: ${cv.pase?.motivo}.`,
  ]
}
