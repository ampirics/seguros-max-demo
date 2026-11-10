import { fechaLocal, hora12, minutosDelDia, sumarDias, tsLocal } from "../local"
import type { Canal, Cliente, Conversacion, EstadoReserva, Mensaje, PasoIA, Reserva, Zona } from "../tipos"
import { codigoReserva } from "./historia"
import { nombreCanal } from "./clientes"

const MIN = 60 * 1000

interface Guion {
  clienteId: string
  canal: Canal
  tema: string
  estado: Conversacion["estado"]
  asignadoA?: string
  resultado?: Conversacion["resultado"]
  etiquetas: string[]
  hace: number
  noLeidos?: number
  reserva?: { dias: number; min: number; personas: number; zona: Zona; mesa?: string; ocasion?: string; estado: EstadoReserva; notas?: string; canal?: Canal }
  mensajes: (reserva?: { hora: string; codigo: string; fecha: string }) => [Mensaje["de"], number, string, (PasoIA[] | { voz: number } | undefined)?][]
}

const p = (herramienta: string, resumen: string, ok = true): PasoIA => ({ herramienta, resumen, ok })

export function guiones(ahora: number): Guion[] {
  const minAhora = minutosDelDia(ahora)
  const base = Math.max(12 * 60 + 30, Math.ceil((minAhora + 20) / 15) * 15)
  return [
    {
      clienteId: "c-laura", canal: "whatsapp", tema: "Propuesta en el gazebo", estado: "ia", resultado: "reserva", etiquetas: ["Reserva", "Ocasión especial"], hace: 3, noLeidos: 1,
      reserva: { dias: 0, min: base + 150, personas: 2, zona: "gazebo", mesa: "G4", ocasion: "Propuesta de matrimonio", estado: "confirmada", notas: "Montaje romántico con pétalos. El anillo lo trae él: que nadie comente nada delante de su pareja." },
      mensajes: (r) => [
        ["cliente", 9, `Hola! Quiero reservar para hoy a las ${r ? hora12(r.hora) : "7"} para 2. Le voy a proponer matrimonio a mi novio`],
        ["ia", 8, `¡Qué emoción, Laura! Tengo el gazebo en la punta del muelle hoy a las ${r ? hora12(r.hora) : ""} para 2, con vista al mar. ¿Te lo reservo con montaje romántico?`, [p("consultar_disponibilidad", "Gazebo libre a esa hora para 2 personas"), p("validar_reglas", "Dentro del horario de reservas y grupo menor de 12")]],
        ["cliente", 6, "Sí!! ¿Y pueden poner pétalos en la mesa?"],
        ["ia", 5, `Listo, quedó reservado: gazebo, hoy a las ${r ? hora12(r.hora) : ""}, 2 personas, código ${r?.codigo}. Dejé anotado el montaje con pétalos y que es una propuesta, para que el equipo lo cuide. Te escribo antes para confirmar.`, [p("crear_reserva", `Reserva ${r?.codigo} en el gazebo`), p("nota_equipo", "Montaje con pétalos: lo confirma la anfitriona", false)]],
        ["cliente", 3, "Gracias!!! Estoy nerviosa jajaja"],
      ],
    },
    {
      clienteId: "c-mark", canal: "whatsapp", tema: "Mesa junto al agua", estado: "ia", resultado: "reserva", etiquetas: ["Reserva", "Inglés"], hace: 14,
      reserva: { dias: 0, min: base + 75, personas: 4, zona: "muelle", mesa: "M3", estado: "confirmada", notas: "Hablan inglés." },
      mensajes: (r) => [
        ["cliente", 22, "Hi! Do you have a table for 4 tonight by the water?"],
        ["ia", 21, `Hi Mark! Yes, I have a table on the pier, right over the water, tonight at ${r ? hora12(r.hora) : ""} for 4. Shall I book it?`, [p("consultar_disponibilidad", "Muelle libre para 4"), p("idioma", "Respondió en inglés")]],
        ["cliente", 16, "Perfect, book it please. Is the lobster available?"],
        ["ia", 14, `Done, your code is ${r?.codigo}. Whole lobster is on the menu at RD$ 1,130 per pound, plus 18% tax and 10% service. Availability depends on the day's catch, so the team confirms it when you arrive.`, [p("crear_reserva", `Reserva ${r?.codigo} en el muelle`), p("consultar_carta", "Langosta entera a la plancha: RD$ 1,130 por libra según la carta")]],
      ],
    },
    {
      clienteId: "c-kevin", canal: "whatsapp", tema: "Cumpleaños de 18 personas", estado: "esperando_equipo", resultado: "evento", etiquetas: ["Evento", "Grupo grande"], hace: 26, noLeidos: 1,
      mensajes: () => [
        ["cliente", 34, "Buenas, quiero celebrar un cumpleaños el sábado, somos como 18 personas"],
        ["ia", 33, "¡Qué bueno, Kevin! Para grupos de más de 12 personas lo manejamos como evento, con menú y espacio a la medida. Te paso con el equipo de eventos para cotizarlo. ¿Qué hora tienes en mente?", [p("validar_reglas", "18 personas: pasa a cotización de eventos", false), p("pasar_a_equipo", "Asignado a eventos")]],
        ["cliente", 26, "Como a las 8 de la noche. Queremos el salón privado si se puede"],
      ],
    },
    {
      clienteId: "c-esther", canal: "instagram", tema: "Platos sin mariscos", estado: "ia", resultado: "consulta", etiquetas: ["Carta", "Alergia"], hace: 41,
      reserva: { dias: 0, min: base + 15, personas: 4, zona: "terraza", mesa: "T5", ocasion: "Cumpleaños", estado: "asistencia_confirmada", canal: "instagram", notas: "Llevan bizcocho propio. Velita al postre. Alergia a mariscos." },
      mensajes: (r) => [
        ["cliente", 70, "Hola, voy hoy con mi reserva pero soy alérgica a los mariscos. ¿Qué me recomiendan?"],
        ["ia", 69, "Hola Esther, gracias por avisar. Sin mariscos tienes el churrasco Angus, el filete mignon, la pechuga de pollo al grill, la pasta bolognesa y la ensalada César con pollo. Dejé tu alergia anotada en la reserva para que cocina la vea en la comanda.", [p("consultar_carta", "Platos de la carta sin el alérgeno mariscos"), p("actualizar_reserva", "Alergia a mariscos en la nota de la reserva")]],
        ["sistema", 50, `Recordatorio enviado: reserva de hoy a las ${r ? hora12(r.hora) : ""} para 4 en la terraza.`],
        ["cliente", 41, "Sí, ahí estaremos. ¡Gracias!"],
      ],
    },
    {
      clienteId: "c-carmen", canal: "whatsapp", tema: "Mover la reserva", estado: "ia", resultado: "cambio", etiquetas: ["Cambio de reserva", "Nota de voz"], hace: 58,
      reserva: { dias: 0, min: base + 105, personas: 5, zona: "muelle", mesa: "M6", estado: "confirmada", canal: "voz" },
      mensajes: (r) => [
        ["cliente", 62, "Nota de voz", { voz: 14 }],
        ["ia", 60, `Entendido, Carmen: moví tu reserva de 5 personas para hoy a las ${r ? hora12(r.hora) : ""}, en la misma mesa del muelle. Tu código sigue siendo ${r?.codigo}.`, [p("transcribir", "\"Hola, soy Carmen, ¿me pueden mover la reserva para un poquito más tarde?\""), p("consultar_disponibilidad", "La mesa M6 sigue libre más tarde"), p("modificar_reserva", `Reserva ${r?.codigo}: nueva hora`)]],
        ["cliente", 58, "Perfecto mi amor, gracias"],
      ],
    },
    {
      clienteId: "c-jose", canal: "whatsapp", tema: "Queja por la espera", estado: "equipo", asignadoA: "carolina", resultado: "queja", etiquetas: ["Queja"], hace: 75,
      mensajes: () => [
        ["cliente", 95, "La vez pasada la comida tardó más de 40 minutos. Quiero hablar con el encargado"],
        ["ia", 94, "Lo siento mucho, José. Te paso con Carolina, nuestra encargada de salón, para atenderte personalmente.", [p("detectar_queja", "Queja por tiempo de espera"), p("pasar_a_equipo", "Asignada a Carolina")]],
        ["equipo", 80, "José, buenas tardes, le habla Carolina. Le pido disculpas. Revisé su visita: la orden tardó 46 minutos un sábado lleno. Su próxima picadera va por la casa.", undefined],
        ["cliente", 75, "Se lo agradezco, así sí"],
      ],
    },
    {
      clienteId: "c-exportadora", canal: "telefono", tema: "Comida de negocios", estado: "cerrada", resultado: "reserva", etiquetas: ["Corporativo", "Reserva"], hace: 190,
      reserva: { dias: 0, min: base + 60, personas: 10, zona: "salon", mesa: "S1", ocasion: "Comida de negocios", estado: "asistencia_confirmada", canal: "telefono", notas: "Necesitan pantalla y factura con RNC." },
      mensajes: (r) => [
        ["cliente", 300, "Llamada de 3:12 min. Reserva para 10 en el salón privado.", { voz: 192 }],
        ["ia", 298, `Resumen de la llamada: Exportadora del Caribe reserva el salón privado para 10 personas hoy a las ${r ? hora12(r.hora) : ""}. Piden pantalla y factura con RNC. Código ${r?.codigo}.`, [p("transcribir", "Llamada transcrita"), p("crear_reserva", `Reserva ${r?.codigo} en el salón A`)]],
        ["sistema", 200, "Recordatorio enviado por correo y WhatsApp."],
        ["cliente", 190, "Confirmado, llegamos puntuales."],
      ],
    },
    {
      clienteId: "c-ana", canal: "whatsapp", tema: "Mesa en la terraza", estado: "esperando_equipo", resultado: "reserva", etiquetas: ["Lista de espera"], hace: 18, noLeidos: 2,
      reserva: { dias: 0, min: base + 120, personas: 3, zona: "terraza", estado: "lista_espera" },
      mensajes: (r) => [
        ["cliente", 24, `Hola, ¿tienen mesa para 3 hoy a las ${r ? hora12(r.hora) : "8"} en la terraza?`],
        ["ia", 23, "A esa hora la terraza está completa. Te puedo poner en lista de espera y avisarte apenas se libere una mesa, o te ofrezco el muelle a la misma hora. ¿Qué prefieres?", [p("consultar_disponibilidad", "Terraza completa a esa hora", false), p("alternativas", "Muelle libre a la misma hora")]],
        ["cliente", 19, "Ponme en lista de espera, prefiero techado"],
        ["ia", 18, "Listo, Ana, estás en la lista de espera para la terraza. Te escribo en cuanto haya mesa.", [p("lista_espera", "Agregada a la lista de espera")]],
      ],
    },
    {
      clienteId: "c-patricia", canal: "web", tema: "Horario y parqueo", estado: "cerrada", resultado: "consulta", etiquetas: ["Información"], hace: 130,
      mensajes: () => [
        ["cliente", 140, "¿A qué hora abren mañana y tienen parqueo?"],
        ["ia", 139, "Abrimos todos los días desde las 9:00 a. m. hasta las 12:30 a. m. Estamos en la calle Prolongación Duarte 12-A, Boca Chica. Sobre el parqueo, el equipo te confirma las opciones; te dejo nuestro WhatsApp 829-642-9442.", [p("info_negocio", "Horario y dirección oficiales"), p("sin_dato", "Parqueo: no está en la información aprobada", false)]],
        ["cliente", 130, "Gracias"],
      ],
    },
    {
      clienteId: "c-marisol", canal: "instagram", tema: "Aniversario mañana", estado: "ia", resultado: "reserva", etiquetas: ["Reserva", "Ocasión especial", "Alergia"], hace: 240,
      reserva: { dias: 1, min: 19 * 60 + 30, personas: 2, zona: "gazebo", mesa: "G2", ocasion: "Aniversario", estado: "confirmada", canal: "instagram", notas: "Alergia a mariscos." },
      mensajes: (r) => [
        ["cliente", 250, "Hola! Mañana es mi aniversario, ¿tienen cama balinesa a las 7:30?"],
        ["ia", 248, `¡Felicidades, Marisol! Te reservé la cama 2 del gazebo mañana a las 7:30 p. m. para 2. Código ${r?.codigo}. Como tienes alergia a los mariscos, ya quedó en tu reserva.`, [p("consultar_disponibilidad", "Cama 2 libre mañana 7:30 p. m."), p("crear_reserva", `Reserva ${r?.codigo}`), p("ficha_cliente", "Alergia a mariscos registrada en su ficha")]],
      ],
    },
    {
      clienteId: "c-hector", canal: "voz", tema: "Reserva por teléfono", estado: "cerrada", resultado: "reserva", etiquetas: ["Llamada", "Reserva"], hace: 30,
      reserva: { dias: 0, min: base + 45, personas: 2, zona: "muelle", mesa: "M4", estado: "asistencia_confirmada", canal: "voz", notas: "Pidió mesa pegada al agua para el atardecer." },
      mensajes: (r) => [
        ["cliente", 400, "Llamada de 1:48 min atendida por el asistente de voz.", { voz: 108 }],
        ["ia", 398, `Reserva por llamada: Héctor Rosario, 2 personas, hoy a las ${r ? hora12(r.hora) : ""} en el muelle, pegado al agua. Código ${r?.codigo}.`, [p("transcribir", "Llamada transcrita"), p("crear_reserva", `Reserva ${r?.codigo} en M4`)]],
        ["sistema", 35, `Recordatorio enviado: hoy a las ${r ? hora12(r.hora) : ""}.`],
        ["cliente", 30, "Sí, ahí estaremos"],
      ],
    },
    {
      clienteId: "c-gina", canal: "instagram", tema: "Cancelación", estado: "cerrada", resultado: "cancelacion", etiquetas: ["Cancelación"], hace: 300,
      reserva: { dias: 0, min: base + 30, personas: 2, zona: "gazebo", mesa: "G1", estado: "cancelada", canal: "instagram" },
      mensajes: (r) => [
        ["cliente", 310, "Hola, no voy a poder ir hoy, ¿pueden cancelar mi reserva?"],
        ["ia", 308, `Claro, Gina. Cancelé tu reserva ${r?.codigo} de hoy. La cama 1 queda libre para otra persona. ¡Te esperamos pronto!`, [p("cancelar_reserva", `Reserva ${r?.codigo} cancelada`), p("liberar_mesa", "Cama 1 disponible")]],
      ],
    },
    {
      clienteId: "c-guzman", canal: "web", tema: "Almuerzo familiar", estado: "ia", resultado: "reserva", etiquetas: ["Reserva", "Recordatorio sin respuesta"], hace: 45,
      reserva: { dias: 0, min: base + 90, personas: 6, zona: "terraza", mesa: "T8", ocasion: "Almuerzo familiar", estado: "recordada", canal: "web", notas: "Silla para bebé. Alergia al maní." },
      mensajes: (r) => [
        ["sistema", 1440, `Reserva hecha en el sitio web: 6 personas hoy a las ${r ? hora12(r.hora) : ""}.`],
        ["ia", 1439, `Hola, familia Guzmán. Su reserva ${r?.codigo} quedó confirmada: hoy a las ${r ? hora12(r.hora) : ""}, 6 personas en la terraza. Tendremos la silla para bebé lista.`, [p("confirmar_reserva", "Confirmación enviada")]],
        ["ia", 45, `Recordatorio: los esperamos hoy a las ${r ? hora12(r.hora) : ""}. ¿Nos confirman que vienen? Respondan SÍ o NO.`, [p("recordatorio", "Enviado 3 horas antes")]],
      ],
    },
    {
      clienteId: "c-luis", canal: "whatsapp", tema: "Montaje romántico", estado: "esperando_equipo", resultado: "reserva", etiquetas: ["Ocasión especial", "Precio por confirmar"], hace: 8, noLeidos: 1,
      reserva: { dias: 3, min: 18 * 60 + 30, personas: 2, zona: "gazebo", mesa: "G4", ocasion: "Montaje romántico", estado: "solicitada" },
      mensajes: (r) => [
        ["cliente", 12, "Buenas, quiero una mesa romántica para el viernes a las 6:30. ¿Cuánto cuesta el montaje?"],
        ["ia", 10, `Te aparté el gazebo el viernes a las 6:30 p. m. para 2 (código ${r?.codigo}). El costo del montaje romántico no está en la carta, así que el equipo te lo confirma por aquí en unos minutos antes de cerrar la reserva.`, [p("consultar_disponibilidad", "Gazebo libre el viernes"), p("sin_precio", "Montaje romántico sin precio aprobado: no lo inventa", false), p("pasar_a_equipo", "Pendiente de precio")]],
        ["cliente", 8, "Ok, quedo atento"],
      ],
    },
  ]
}

export function sembrarConversaciones(ahora: number, clientes: Cliente[]) {
  const hoy = fechaLocal(ahora)
  const conversaciones: Conversacion[] = []
  const mensajes = new Map<string, Mensaje[]>()
  const reservas: Reserva[] = []
  guiones(ahora).forEach((g, i) => {
    const c = clientes.find((x) => x.id === g.clienteId)!
    const convId = `conv-${i + 1}`
    let r: Reserva | undefined
    if (g.reserva) {
      let fecha = sumarDias(hoy, g.reserva.dias)
      let min = g.reserva.min
      if (min >= 24 * 60) {
        fecha = sumarDias(fecha, 1)
        min -= 24 * 60
      }
      const hora = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
      const canal = g.reserva.canal ?? g.canal
      const creada = ahora - (g.hace + 10) * MIN
      r = {
        id: `r-hoy-${i + 1}`,
        codigo: codigoReserva(),
        clienteId: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        fecha,
        hora,
        personas: g.reserva.personas,
        zona: g.reserva.zona,
        mesaId: g.reserva.mesa,
        ocasion: g.reserva.ocasion,
        canal,
        estado: g.reserva.estado,
        notas: g.reserva.notas,
        creada,
        conversacionId: convId,
        avisos: [],
      }
      if (g.reserva.estado !== "solicitada" && g.reserva.estado !== "lista_espera")
        r.avisos.push({ ts: creada + MIN, tipo: "confirmacion", texto: `Confirmación enviada por ${nombreCanal(canal === "voz" || canal === "telefono" ? "whatsapp" : canal)}`, canal, quien: "Asistente" })
      if (["recordada", "asistencia_confirmada"].includes(g.reserva.estado))
        r.avisos.push({ ts: Math.min(ahora - 30 * MIN, tsLocal(fecha, hora) - 3 * 60 * MIN), tipo: "recordatorio", texto: "Recordatorio enviado por WhatsApp", canal: "whatsapp", quien: "Asistente" })
      if (g.reserva.estado === "asistencia_confirmada")
        r.avisos.push({ ts: ahora - g.hace * MIN, tipo: "respuesta", texto: "El cliente confirmó que asiste", canal: g.canal, quien: c.nombre })
      if (g.reserva.estado === "cancelada")
        r.avisos.push({ ts: ahora - g.hace * MIN, tipo: "cancelacion", texto: "El cliente canceló", canal: g.canal, quien: c.nombre })
      reservas.push(r)
      c.recorrido.push({ ts: creada, tipo: "reserva", canal, texto: `Reservó para ${r.personas} el ${fecha} a las ${hora} por ${nombreCanal(canal)}`, enlace: `/admin/reservaciones/${r.id}` })
    }
    const lista: Mensaje[] = g.mensajes(r ? { hora: r.hora, codigo: r.codigo, fecha: r.fecha } : undefined).map(([de, minutos, texto, extra], k) => ({
      id: `${convId}-m${k + 1}`,
      conversacionId: convId,
      ts: ahora - minutos * MIN,
      de,
      texto,
      autor: de === "equipo" ? "Carolina" : de === "ia" ? "Asistente de Boca Marina" : undefined,
      voz: extra && "voz" in extra ? { segundos: extra.voz } : undefined,
      pasos: Array.isArray(extra) ? extra : undefined,
      reservaId: de === "ia" && r ? r.id : undefined,
    }))
    mensajes.set(convId, lista)
    conversaciones.push({
      id: convId,
      clienteId: c.id,
      canal: g.canal,
      tema: g.tema,
      estado: g.estado,
      asignadoA: g.asignadoA,
      noLeidos: g.noLeidos ?? 0,
      etiquetas: g.etiquetas,
      reservaIds: r ? [r.id] : [],
      creada: lista[0].ts,
      actualizada: lista[lista.length - 1].ts,
      resultado: g.resultado,
    })
    c.conversacionId = convId
    c.recorrido.push({ ts: lista[0].ts, tipo: "conversacion", canal: g.canal, texto: `Conversación por ${nombreCanal(g.canal)}: ${g.tema}`, enlace: `/admin/chat?conversacion=${convId}` })
    c.recorrido.sort((a, b) => a.ts - b.ts)
  })
  return { conversaciones, mensajes, reservas }
}
