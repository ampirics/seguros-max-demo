import Anthropic from "@anthropic-ai/sdk"
import { CARTA, ITBIS, SERVICIO } from "../carta"
import { platosAgotados } from "../inventario"
import { fechaLocal, hora12, horaLocal, NEGOCIO, NOMBRE_ZONA, sumarDias, tsLocal, ZONAS } from "../local"
import type { Estado, PasoIA, Reserva, Zona } from "../tipos"
import { enviarBienvenida, enviarFotoPlato, enviarPdfReserva } from "./avisos"
import {
  actualizarConversacion,
  archivo,
  agregarMensaje,
  definirRespondedor,
  ejecutar,
  escribiendo,
  estado,
  mensajesDe,
  mesasDisponibles,
  platosFavoritos,
} from "./motor"

const MODELO = "claude-opus-5-5"
const MIN = 60 * 1000

const SISTEMA = `Eres el asistente de WhatsApp de Boca Marina Restaurant & Lounge, un restaurante sobre el muelle de Boca Chica, República Dominicana, frente al mar Caribe. Atiendes reservas, cambios, cancelaciones y preguntas de los clientes en nombre del restaurante.

Cómo escribes:
- Mensajes cortos de WhatsApp, cálidos y profesionales, en español dominicano neutro. Si el cliente escribe en inglés, respondes en inglés.
- Sin emojis, sin listas largas, sin markdown. Usa el primer nombre del cliente cuando lo sepas.
- Una pregunta a la vez cuando te falte un dato.
- Trata al cliente de tú, con calidez, salvo que él use usted; no cambies de trato en la misma conversación.

Reglas que no se rompen:
- Nunca confirmes disponibilidad ni crees, muevas o canceles una reserva sin usar la herramienta correspondiente. Lo que digas sobre mesas sale de la herramienta.
- Nunca inventes precios. Los precios salen solo de consultar_carta y van en pesos dominicanos, sin incluir el 18 % de ITBIS ni el 10 % de servicio de ley; dilo cuando des un precio. Si algo no tiene precio en la carta (montajes, decoración, bebidas, eventos), di que el equipo lo confirma y usa pasar_a_equipo.
- Lo que no esté en info_restaurante o en la carta no lo afirmes: di que el equipo lo confirma.
- Grupos de más de 12 personas, bodas y eventos privados se cotizan aparte: explícalo y usa pasar_a_equipo con area eventos.
- Si el cliente se queja, está molesto o pide hablar con una persona, discúlpate y usa pasar_a_equipo con area salon.
- Para reservar necesitas fecha, hora y cantidad de personas. Zona y ocasión son opcionales: ofrécelas. El nombre y el teléfono ya los tienes del chat.
- Cuando el cliente mencione una alergia, una preferencia o una ocasión especial, guárdala con actualizar_ficha y en las notas de la reserva.
- Después de crear o cambiar una reserva, confirma en un solo mensaje: zona, día, hora, personas y el código. El sistema le envía solo el PDF de la reserva y la guía de bienvenida por aquí y por correo: no los vuelvas a mandar en ese momento.
- Al reservar, si no tienes su correo, pídelo una vez y de forma opcional para mandarle la confirmación; si lo da, guárdalo en crear_reserva o actualizar_ficha.
- Si el cliente manda una foto o un PDF, míralo y responde sobre lo que ves (por ejemplo una captura de una reserva, un comprobante o una foto de una ocasión). Si manda una nota de voz, te llega transcrita.
- Si pide ver un plato, usa enviar_foto_plato. Si pide la carta, la guía o su reserva en PDF, usa enviar_documento.`

const herramientas: Anthropic.Beta.BetaTool[] = [
  {
    name: "info_restaurante",
    description: "Información oficial aprobada del restaurante: dirección, horario, zonas, contacto, reglas de reserva e impuestos.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "consultar_disponibilidad",
    description: "Revisa si hay mesa para una fecha, hora y cantidad de personas. Valida el horario de reservas y el tamaño del grupo, y devuelve mesas libres por zona y horas alternativas.",
    input_schema: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "AAAA-MM-DD" },
        hora: { type: "string", description: "HH:MM en 24 horas" },
        personas: { type: "integer" },
        zona: { type: "string", enum: ["terraza", "muelle", "gazebo", "salon"] },
      },
      required: ["fecha", "hora", "personas"],
      additionalProperties: false,
    },
  },
  {
    name: "crear_reserva",
    description: "Crea la reserva cuando el cliente ya aceptó fecha, hora y personas. Asigna la mejor mesa libre y envía la confirmación. Si no hay mesa, lo pone en lista de espera.",
    input_schema: {
      type: "object",
      properties: {
        fecha: { type: "string" },
        hora: { type: "string" },
        personas: { type: "integer" },
        zona: { type: "string", enum: ["terraza", "muelle", "gazebo", "salon"] },
        ocasion: { type: "string", description: "Cumpleaños, aniversario, propuesta de matrimonio, comida de negocios, montaje romántico..." },
        notas: { type: "string", description: "Pedidos especiales, alergias, silla para bebé..." },
        correo: { type: "string", description: "Correo del cliente para la confirmación, si lo dio" },
      },
      required: ["fecha", "hora", "personas"],
      additionalProperties: false,
    },
  },
  {
    name: "reservas_del_cliente",
    description: "Lista las reservas activas del cliente de este chat, con su código.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "modificar_reserva",
    description: "Cambia fecha, hora, personas, zona o notas de una reserva existente del cliente. Revisa disponibilidad antes de mover.",
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string" },
        fecha: { type: "string" },
        hora: { type: "string" },
        personas: { type: "integer" },
        zona: { type: "string", enum: ["terraza", "muelle", "gazebo", "salon"] },
        notas: { type: "string" },
      },
      required: ["codigo"],
      additionalProperties: false,
    },
  },
  {
    name: "cancelar_reserva",
    description: "Cancela una reserva del cliente y libera la mesa.",
    input_schema: { type: "object", properties: { codigo: { type: "string" } }, required: ["codigo"], additionalProperties: false },
  },
  {
    name: "confirmar_asistencia",
    description: "Solo para cuando el cliente responde SÍ a un recordatorio ya enviado de una reserva del mismo día. No lo uses para confirmar una reserva recién creada: crear_reserva ya la deja confirmada.",
    input_schema: { type: "object", properties: { codigo: { type: "string" } }, required: ["codigo"], additionalProperties: false },
  },
  {
    name: "consultar_carta",
    description: "Busca platos de la carta oficial con su precio, categoría y alérgenos. Puede filtrar por texto, categoría o excluir un alérgeno.",
    input_schema: {
      type: "object",
      properties: {
        buscar: { type: "string" },
        categoria: { type: "string" },
        sin_alergeno: { type: "string", description: "mariscos, pescado, moluscos, gluten, lácteos, huevo, frutos secos, soya" },
        recomendados: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "actualizar_ficha",
    description: "Guarda en la ficha del cliente su nombre, alergias, preferencias u ocasiones especiales.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        alergias: { type: "array", items: { type: "string" } },
        preferencias: { type: "array", items: { type: "string" } },
        ocasion: { type: "string", description: "Una a tres palabras: Cumpleaños, Aniversario, Propuesta de matrimonio, Comida de negocios" },
        correo: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "enviar_documento",
    description: "Envía por el chat un PDF: la guía de bienvenida (zonas, platos de la casa, cómo llegar) o la reserva del cliente con su código y QR.",
    input_schema: {
      type: "object",
      properties: { documento: { type: "string", enum: ["bienvenida", "reserva"] }, codigo: { type: "string", description: "Código de la reserva, si es la reserva" } },
      required: ["documento"],
      additionalProperties: false,
    },
  },
  {
    name: "enviar_foto_plato",
    description: "Envía por el chat la foto de un plato de la carta que la tenga.",
    input_schema: { type: "object", properties: { plato: { type: "string", description: "Nombre del plato como sale en la carta" } }, required: ["plato"], additionalProperties: false },
  },
  {
    name: "pasar_a_equipo",
    description: "Pasa la conversación a una persona del equipo. Úsalo para eventos y grupos grandes, quejas, precios que no están en la carta o cuando el cliente pide una persona.",
    input_schema: {
      type: "object",
      properties: { area: { type: "string", enum: ["eventos", "salon", "general"] }, motivo: { type: "string" } },
      required: ["area", "motivo"],
      additionalProperties: false,
    },
  },
]

type Resultado = { datos: unknown; paso: PasoIA; pendiente?: Promise<unknown> }

function validar(fecha: string, hora: string, personas: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return "Fecha u hora con formato inválido"
  const t = tsLocal(fecha, hora)
  if (Number.isNaN(t)) return "Fecha u hora inválida"
  if (t < Date.now() - 5 * MIN) return "La hora ya pasó"
  if (t > Date.now() + 90 * 24 * 60 * MIN) return "Solo se reserva con hasta 90 días de anticipación"
  if (hora < NEGOCIO.primeraReserva || hora > NEGOCIO.ultimaReserva) return `Fuera del horario de reservas (de ${hora12(NEGOCIO.primeraReserva)} a ${hora12(NEGOCIO.ultimaReserva)})`
  if (personas < 1) return "Cantidad de personas inválida"
  if (personas > NEGOCIO.grupoMaximo) return `Más de ${NEGOCIO.grupoMaximo} personas: va por cotización de eventos`
  return null
}

function sumarMinutos(hora: string, m: number) {
  const [h, mm] = hora.split(":").map(Number)
  const t = h * 60 + mm + m
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}

function reservasActivas(est: Estado, clienteId: string) {
  return est.reservas.filter((r) => r.clienteId === clienteId && ["solicitada", "confirmada", "recordada", "asistencia_confirmada", "lista_espera"].includes(r.estado))
}

const resumenReserva = (r: Reserva) => ({
  codigo: r.codigo,
  fecha: r.fecha,
  hora: r.hora,
  personas: r.personas,
  zona: NOMBRE_ZONA[r.zona],
  mesa: r.mesaId ?? null,
  estado: r.estado,
  ocasion: r.ocasion ?? null,
  notas: r.notas ?? null,
})

export function ejecutarHerramienta(nombre: string, e: Record<string, any>, convId: string): Resultado {
  const est = estado()
  const conv = est.conversaciones.find((c) => c.id === convId)!
  const cli = est.clientes.find((c) => c.id === conv.clienteId)!
  const delCliente = (codigo: string) => {
    const r = est.reservas.find((x) => x.codigo.toUpperCase() === String(codigo).toUpperCase())
    if (!r || r.clienteId !== cli.id) throw new Error(`No encontré la reserva ${codigo} de este cliente`)
    return r
  }
  switch (nombre) {
    case "info_restaurante":
      return {
        datos: {
          ...NEGOCIO,
          zonas: ZONAS,
          impuestos: `Los precios de la carta no incluyen ${ITBIS * 100} % de ITBIS ni ${SERVICIO * 100} % de servicio de ley`,
          reservas: `Se reservan de ${hora12(NEGOCIO.primeraReserva)} a ${hora12(NEGOCIO.ultimaReserva)}. Grupos de más de ${NEGOCIO.grupoMaximo} van por eventos.`,
          sin_dato: "Parqueo, código de vestimenta, mascotas, precios de montajes, bebidas y eventos: los confirma el equipo",
        },
        paso: { herramienta: "info_restaurante", resumen: "Información oficial del restaurante", ok: true },
      }
    case "consultar_disponibilidad": {
      const error = validar(e.fecha, e.hora, e.personas)
      if (error) return { datos: { disponible: false, motivo: error }, paso: { herramienta: "validar_reglas", resumen: error, ok: false } }
      const libres = mesasDisponibles(est, e.fecha, e.hora, e.personas, e.zona as Zona | undefined)
      const porZona = Object.fromEntries(ZONAS.map((z) => [z.nombre, libres.filter((m) => m.zona === z.id).length]))
      const alternativas = libres.length
        ? []
        : [-60, -30, 30, 60]
            .map((d) => sumarMinutos(e.hora, d))
            .filter((h) => !validar(e.fecha, h, e.personas) && mesasDisponibles(est, e.fecha, h, e.personas, e.zona).length)
      const otrasZonas = e.zona && !libres.length ? ZONAS.filter((z) => mesasDisponibles(est, e.fecha, e.hora, e.personas, z.id).length).map((z) => z.nombre) : []
      return {
        datos: { disponible: libres.length > 0, mesas_libres_por_zona: porZona, horas_alternativas: alternativas, otras_zonas_libres: otrasZonas },
        paso: {
          herramienta: "consultar_disponibilidad",
          resumen: libres.length
            ? `${libres.length} mesas libres para ${e.personas} el ${e.fecha} a las ${hora12(e.hora)}${e.zona ? ` en ${NOMBRE_ZONA[e.zona as Zona]}` : ""}`
            : `Sin mesa a las ${hora12(e.hora)}${alternativas.length ? `; alternativas ${alternativas.map(hora12).join(", ")}` : ""}`,
          ok: libres.length > 0,
        },
      }
    }
    case "crear_reserva": {
      const error = validar(e.fecha, e.hora, e.personas)
      if (error) return { datos: { creada: false, motivo: error }, paso: { herramienta: "validar_reglas", resumen: error, ok: false } }
      const dup = reservasActivas(est, cli.id).find((r) => r.fecha === e.fecha && Math.abs(tsLocal(r.fecha, r.hora) - tsLocal(e.fecha, e.hora)) < 3 * 60 * MIN)
      if (dup) return { datos: { creada: false, motivo: "El cliente ya tiene una reserva cerca de esa hora", reserva: resumenReserva(dup) }, paso: { herramienta: "validar_reglas", resumen: `Ya existe la reserva ${dup.codigo}`, ok: false } }
      const r = ejecutar({
        tipo: "reserva",
        reserva: { nombre: cli.nombre, telefono: cli.telefono, fecha: e.fecha, hora: e.hora, personas: e.personas, zona: e.zona, ocasion: e.ocasion, notas: e.notas, canal: conv.canal, conversacionId: convId, correo: e.correo, creadaPor: "ia" },
      }) as { reserva: Reserva; mesa: { nombre: string; zona: string } | null }
      return {
        datos: { creada: true, ...resumenReserva(r.reserva), mesa: r.mesa?.nombre ?? null, en_lista_de_espera: !r.mesa },
        paso: { herramienta: "crear_reserva", resumen: r.mesa ? `Reserva ${r.reserva.codigo}: ${r.mesa.nombre}, ${r.mesa.zona}` : `Reserva ${r.reserva.codigo} en lista de espera`, ok: !!r.mesa },
      }
    }
    case "reservas_del_cliente": {
      const lista = reservasActivas(est, cli.id).map(resumenReserva)
      return { datos: { reservas: lista }, paso: { herramienta: "reservas_del_cliente", resumen: `${lista.length} reservas activas`, ok: true } }
    }
    case "modificar_reserva": {
      const r = delCliente(e.codigo)
      const fecha = e.fecha ?? r.fecha
      const hora = e.hora ?? r.hora
      const personas = e.personas ?? r.personas
      const error = validar(fecha, hora, personas)
      if (error) return { datos: { modificada: false, motivo: error }, paso: { herramienta: "validar_reglas", resumen: error, ok: false } }
      const cambios = Object.fromEntries(Object.entries({ fecha: e.fecha, hora: e.hora, personas: e.personas, zona: e.zona, notas: e.notas }).filter(([, v]) => v !== undefined))
      const res = ejecutar({ tipo: "reservaCambiar", reservaId: r.id, cambios }) as { reserva: Reserva }
      return {
        datos: { modificada: true, ...resumenReserva(res.reserva) },
        paso: { herramienta: "modificar_reserva", resumen: `Reserva ${r.codigo}: ${res.reserva.fecha} ${hora12(res.reserva.hora)}, ${res.reserva.personas} personas${res.reserva.mesaId ? `, ${res.reserva.mesaId}` : ", lista de espera"}`, ok: !!res.reserva.mesaId },
      }
    }
    case "cancelar_reserva": {
      const r = delCliente(e.codigo)
      ejecutar({ tipo: "reservaEstado", reservaId: r.id, estado: "cancelada", nota: "Cancelada por el cliente desde el chat" })
      return { datos: { cancelada: true, codigo: r.codigo }, paso: { herramienta: "cancelar_reserva", resumen: `Reserva ${r.codigo} cancelada, mesa liberada`, ok: true } }
    }
    case "confirmar_asistencia": {
      const r = delCliente(e.codigo)
      ejecutar({ tipo: "reservaEstado", reservaId: r.id, estado: "asistencia_confirmada", nota: "Confirmó por el chat" })
      return { datos: { confirmada: true, codigo: r.codigo }, paso: { herramienta: "confirmar_asistencia", resumen: `${r.codigo}: asistencia confirmada`, ok: true } }
    }
    case "consultar_carta": {
      const q = (e.buscar ?? "").toLowerCase()
      let lista = CARTA.filter((p) => (!q || p.nombre.toLowerCase().includes(q) || (p.descripcion ?? "").toLowerCase().includes(q)) && (!e.categoria || p.categoria.toLowerCase().includes(String(e.categoria).toLowerCase())))
      if (e.sin_alergeno) lista = lista.filter((p) => !(p.alergenos ?? []).some((a) => a.includes(String(e.sin_alergeno).toLowerCase())))
      if (e.recomendados) lista = lista.filter((p) => p.destacado)
      lista = lista.slice(0, 15)
      const agotados = platosAgotados(estado().insumos)
      return {
        datos: {
          platos: lista.map((p) => ({ nombre: p.nombre, categoria: p.categoria, precio_rd: p.precio, por_libra: !!p.porLibra, descripcion: p.descripcion ?? null, alergenos: p.alergenos ?? [], agotado_hoy: agotados.has(p.id) })),
          nota: "Precios sin ITBIS ni 10 % de servicio. La carta no incluye bebidas. Los platos con agotado_hoy no se ofrecen hoy: si el cliente pregunta, dile que hoy se agotó y sugiere otro parecido.",
        },
        paso: { herramienta: "consultar_carta", resumen: `${lista.length} platos de la carta${e.sin_alergeno ? ` sin ${e.sin_alergeno}` : ""}${q ? ` con "${q}"` : ""}`, ok: lista.length > 0 },
      }
    }
    case "actualizar_ficha": {
      if (e.nombre && (cli.nombre === "Cliente nuevo" || cli.nombre.startsWith("+"))) cli.nombre = e.nombre
      for (const a of e.alergias ?? []) if (!(cli.alergias ?? []).includes(a)) cli.alergias = [...(cli.alergias ?? []), a]
      for (const p of e.preferencias ?? []) if (!cli.preferencias.includes(p)) cli.preferencias.push(p)
      if (e.ocasion && !cli.ocasiones.includes(e.ocasion)) cli.ocasiones.push(e.ocasion)
      if (e.correo) cli.correo = e.correo
      return { datos: { guardado: true }, paso: { herramienta: "actualizar_ficha", resumen: [e.nombre && `nombre ${e.nombre}`, e.alergias?.length && `alergias: ${e.alergias.join(", ")}`, e.preferencias?.length && `preferencias: ${e.preferencias.join(", ")}`, e.ocasion].filter(Boolean).join("; ") || "Ficha actualizada", ok: true } }
    }
    case "enviar_documento": {
      if (e.documento === "reserva") {
        const r = e.codigo ? delCliente(e.codigo) : reservasActivas(est, cli.id)[0]
        if (!r) throw new Error("El cliente no tiene reservas activas")
        return { datos: { enviado: true }, paso: { herramienta: "enviar_documento", resumen: `PDF de la reserva ${r.codigo}`, ok: true }, pendiente: enviarPdfReserva(convId, r) }
      }
      return { datos: { enviado: true }, paso: { herramienta: "enviar_documento", resumen: "Guía de bienvenida en PDF", ok: true }, pendiente: enviarBienvenida(convId) }
    }
    case "enviar_foto_plato": {
      const q = String(e.plato).toLowerCase()
      const p = CARTA.find((x) => x.foto && x.nombre.toLowerCase().includes(q)) ?? CARTA.find((x) => x.foto && q.split(" ").some((w) => w.length > 3 && x.nombre.toLowerCase().includes(w)))
      if (!p) return { datos: { enviado: false, motivo: "No tenemos foto de ese plato" }, paso: { herramienta: "enviar_foto_plato", resumen: `Sin foto de "${e.plato}"`, ok: false } }
      enviarFotoPlato(convId, p.id)
      return { datos: { enviado: true, plato: p.nombre }, paso: { herramienta: "enviar_foto_plato", resumen: `Foto de ${p.nombre}`, ok: true } }
    }
    case "pasar_a_equipo": {
      actualizarConversacion(convId, {
        estado: "esperando_equipo",
        asignadoA: e.area === "salon" ? "carolina" : undefined,
        etiquetas: Array.from(new Set([...conv.etiquetas, e.area === "eventos" ? "Evento" : e.area === "salon" ? "Atención" : "Equipo"])),
      })
      return { datos: { pasado: true, mensaje_para_el_cliente: "Avisa que una persona del equipo le escribe por aquí en unos minutos." }, paso: { herramienta: "pasar_a_equipo", resumen: `A ${e.area}: ${e.motivo}`, ok: false } }
    }
  }
  throw new Error(`Herramienta desconocida: ${nombre}`)
}

function contexto(convId: string) {
  const est = estado()
  const conv = est.conversaciones.find((c) => c.id === convId)!
  const c = est.clientes.find((x) => x.id === conv.clienteId)!
  const ahora = Date.now()
  const hoy = fechaLocal(ahora)
  const dias = Array.from({ length: 8 }, (_, i) => {
    const f = sumarDias(hoy, i)
    return `${f} (${new Intl.DateTimeFormat("es-DO", { weekday: "long", timeZone: "America/Santo_Domingo" }).format(new Date(`${f}T12:00:00-04:00`))})`
  })
  const favoritos = platosFavoritos(c.id)
  return [
    `Hoy es ${dias[0]}, son las ${horaLocal(ahora)} en Santo Domingo. Próximos días: ${dias.slice(1).join(", ")}.`,
    `Cliente del chat: ${c.nombre}, teléfono ${c.telefono}${c.idioma === "en" ? ", habla inglés" : ""}. Canal: ${conv.canal}.`,
    c.visitas ? `Ha venido ${c.visitas} veces.` : "Es un cliente nuevo.",
    c.alergias?.length ? `Alergias registradas: ${c.alergias.join(", ")}.` : "",
    c.preferencias.length ? `Preferencias: ${c.preferencias.join(", ")}.` : "",
    favoritos.length ? `Suele pedir: ${favoritos.map((f) => CARTA.find((p) => p.id === f)?.nombre).filter(Boolean).join(", ")}.` : "",
    `Reservas activas: ${JSON.stringify(reservasActivas(est, c.id).map(resumenReserva))}.`,
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
      const texto = m.adjunto ? `${m.texto} [envió ${m.adjunto.tipo === "pdf" ? "el PDF" : "la foto"} ${m.adjunto.nombre}]` : m.texto
      return { role: "assistant", content: m.de === "equipo" ? `[${m.autor ?? "Equipo"}] ${texto}` : texto }
    })
    while (mensajes.length && mensajes[0].role !== "user") mensajes.shift()
    if (!mensajes.length || mensajes[mensajes.length - 1].role !== "user") return
    mensajes.push({ role: "system", content: contexto(convId) } as unknown as Anthropic.Beta.BetaMessageParam)
    const pasos: PasoIA[] = []
    let reservaId: string | undefined
    for (let vuelta = 0; vuelta < 8; vuelta++) {
      const r = await cliente.beta.messages.create({
        model: MODELO,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        tools: herramientas,
        messages: mensajes,
      } as Anthropic.Beta.MessageCreateParamsNonStreaming)
      if (r.stop_reason === "refusal") throw new Error("el modelo declinó la respuesta")
      const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      if (r.stop_reason !== "tool_use" || !usos.length) {
        const texto = r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim()
        if (texto) agregarMensaje(convId, { de: "ia", texto, pasos: pasos.length ? pasos : undefined, reservaId })
        return
      }
      mensajes.push({ role: "assistant", content: r.content as Anthropic.Beta.BetaContentBlockParam[] })
      const pendientes: Promise<unknown>[] = []
      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = usos.map((u) => {
        try {
          const res = ejecutarHerramienta(u.name, (u.input ?? {}) as Record<string, any>, convId)
          if (res.pendiente) pendientes.push(res.pendiente)
          pasos.push(res.paso)
          const rid = (res.datos as { codigo?: string })?.codigo
          if (rid) reservaId = estado().reservas.find((x) => x.codigo === rid)?.id ?? reservaId
          return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(res.datos) }
        } catch (err) {
          pasos.push({ herramienta: u.name, resumen: (err as Error).message, ok: false })
          return { type: "tool_result", tool_use_id: u.id, content: (err as Error).message, is_error: true }
        }
      })
      await Promise.all(pendientes)
      mensajes.push({ role: "user", content: resultados })
    }
    throw new Error("demasiadas vueltas de herramientas")
  } finally {
    escribiendo(convId, false)
  }
}

definirRespondedor(responder)
