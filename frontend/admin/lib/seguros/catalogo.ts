import type { Area, Aseguradora, Canal, Etapa, EstadoPoliza, EstadoRenovacion, EstadoSiniestro, Origen, Persona, Ramo, Segmento, Sucursal, TipoSiniestro } from "./tipos"

export const ZONA_HORARIA = "America/Santo_Domingo"

// Datos públicos de max.com.do (consultado el 09-11-2026). Lo que no está aquí no lo afirma la IA.
export const MAX = {
  nombre: "MAX Corredores de Seguros",
  corto: "MAX",
  lema: "Protegemos lo que más te importa",
  experiencia: "Más de 47 años de experiencia",
  direccion: "Av. 27 de Febrero esq. Abraham Lincoln, Unicentro Plaza, 5to. nivel, Rampa H, Ensanche Piantini, Santo Domingo",
  emergencias: [
    { telefono: "(809) 941-2323", para: "Riesgos generales" },
    { telefono: "(809) 519-0655", para: "Seguros de empresas y particulares" },
  ],
  sitio: "https://max.com.do",
  cotizador: "https://services.max.com.do/Cotizador",
  reportarSiniestro: "https://max.com.do/servicios/reportar-siniestro/",
  asistencia: "Asistencia personalizada 24/7: un asesor orienta en cotizaciones, actualización de pólizas, dudas, trámites y seguimiento de siniestros.",
  servicios: ["Solicitud de cotización", "Notificación de siniestro", "Asistencia personalizada", "Notificar pago", "Solicitud de reembolso", "Documentos y formularios", "Preguntas frecuentes"],
}

export const SUCURSALES: { id: Sucursal; nombre: string }[] = [
  { id: "santo_domingo", nombre: "Santo Domingo" },
  { id: "santiago", nombre: "Santiago" },
  { id: "punta_cana", nombre: "Punta Cana" },
]
export const NOMBRE_SUCURSAL = Object.fromEntries(SUCURSALES.map((s) => [s.id, s.nombre])) as Record<Sucursal, string>

export interface InfoRamo {
  id: Ramo
  nombre: string
  segmento: Segmento
  area: Area
  /** Lo mínimo para pasar la oportunidad a un ejecutivo como calificada. */
  requeridos: string[]
  opcionales: string[]
}

export const RAMOS: InfoRamo[] = [
  { id: "vehiculo", nombre: "Vehículo de motor", segmento: "persona", area: "comercial_personas", requeridos: ["marca", "modelo", "anio", "uso", "cobertura"], opcionales: ["valor_aproximado", "ciudad", "financiado"] },
  { id: "salud", nombre: "Salud", segmento: "persona", area: "comercial_personas", requeridos: ["personas", "edades", "alcance"], opcionales: ["seguro_actual", "ciudad", "condiciones_previas"] },
  { id: "vida", nombre: "Vida", segmento: "persona", area: "comercial_personas", requeridos: ["edad", "proposito"], opcionales: ["suma_deseada", "fumador", "dependientes"] },
  { id: "hogar", nombre: "Incendio para vivienda", segmento: "persona", area: "comercial_personas", requeridos: ["tipo_vivienda", "propia_o_alquilada", "ciudad"], opcionales: ["valor_aproximado", "contenido"] },
  { id: "viaje", nombre: "Viaje", segmento: "persona", area: "comercial_personas", requeridos: ["destino", "fechas", "viajeros"], opcionales: ["edades", "motivo"] },
  { id: "accidentes", nombre: "Accidentes personales", segmento: "persona", area: "comercial_personas", requeridos: ["edad", "ocupacion"], opcionales: ["suma_deseada"] },
  { id: "incendio", nombre: "Incendio y líneas aliadas", segmento: "empresa", area: "comercial_empresas", requeridos: ["empresa", "sector", "ubicacion", "valor_aproximado"], opcionales: ["empleados", "inventario"] },
  { id: "responsabilidad_civil", nombre: "Responsabilidad civil", segmento: "empresa", area: "comercial_empresas", requeridos: ["empresa", "sector", "actividad"], opcionales: ["empleados", "facturacion_aproximada"] },
  { id: "transporte", nombre: "Transporte de carga", segmento: "empresa", area: "comercial_empresas", requeridos: ["empresa", "sector", "alcance", "mercancia"], opcionales: ["valor_por_embarque", "flota"] },
  { id: "fianzas", nombre: "Fianzas", segmento: "empresa", area: "comercial_empresas", requeridos: ["empresa", "tipo_fianza", "monto"], opcionales: ["entidad"] },
  { id: "colectivo", nombre: "Salud y vida colectiva", segmento: "empresa", area: "comercial_empresas", requeridos: ["empresa", "sector", "empleados"], opcionales: ["seguro_actual", "alcance"] },
  { id: "maquinaria", nombre: "Maquinaria, equipos y construcción", segmento: "empresa", area: "comercial_empresas", requeridos: ["empresa", "sector", "equipos"], opcionales: ["valor_aproximado", "ubicacion"] },
]
export const RAMO = Object.fromEntries(RAMOS.map((r) => [r.id, r])) as Record<Ramo, InfoRamo>
export const NOMBRE_RAMO = Object.fromEntries(RAMOS.map((r) => [r.id, r.nombre])) as Record<Ramo, string>
export const RAMO_CORTO: Record<Ramo, string> = {
  vehiculo: "Vehículo",
  salud: "Salud",
  vida: "Vida",
  hogar: "Hogar",
  viaje: "Viaje",
  accidentes: "Accidentes",
  incendio: "Incendio",
  responsabilidad_civil: "Resp. civil",
  transporte: "Transporte",
  fianzas: "Fianzas",
  colectivo: "Colectivo",
  maquinaria: "Maquinaria",
}

export const CAMPO: Record<string, string> = {
  marca: "Marca",
  modelo: "Modelo",
  anio: "Año",
  uso: "Uso",
  cobertura: "Cobertura de interés",
  valor_aproximado: "Valor aproximado",
  ciudad: "Ciudad",
  financiado: "Financiado",
  personas: "Personas a asegurar",
  edades: "Edades",
  alcance: "Alcance",
  seguro_actual: "Seguro actual",
  condiciones_previas: "Condiciones previas",
  edad: "Edad",
  proposito: "Propósito",
  suma_deseada: "Suma deseada",
  fumador: "Fumador",
  dependientes: "Dependientes",
  tipo_vivienda: "Vivienda",
  propia_o_alquilada: "Propia o alquilada",
  contenido: "Asegurar contenido",
  destino: "Destino",
  fechas: "Fechas",
  viajeros: "Viajeros",
  motivo: "Motivo del viaje",
  ocupacion: "Ocupación",
  empresa: "Empresa",
  sector: "Sector",
  ubicacion: "Ubicación",
  inventario: "Inventario",
  empleados: "Empleados",
  actividad: "Actividad",
  facturacion_aproximada: "Facturación aproximada",
  mercancia: "Mercancía",
  valor_por_embarque: "Valor por embarque",
  flota: "Flota propia",
  tipo_fianza: "Tipo de fianza",
  monto: "Monto",
  entidad: "Entidad",
  equipos: "Equipos",
  nombre: "Nombre",
  contacto: "Contacto",
  consentimiento: "Autorización de datos",
}

export const ASEGURADORAS: Aseguradora[] = [
  { id: "reservas", nombre: "Seguros Reservas", corto: "Reservas", logo: "/max/aseguradoras/reservas.png", ramos: ["vehiculo", "hogar", "vida", "incendio", "responsabilidad_civil", "transporte", "fianzas", "maquinaria", "accidentes"] },
  { id: "mapfre", nombre: "MAPFRE BHD Seguros", corto: "MAPFRE BHD", logo: "/max/aseguradoras/mapfre-bhd.png", ramos: ["vehiculo", "hogar", "vida", "viaje", "incendio", "responsabilidad_civil", "transporte", "accidentes", "maquinaria"] },
  { id: "universal", nombre: "Seguros Universal", corto: "Universal", logo: "/max/aseguradoras/universal.png", ramos: ["vehiculo", "hogar", "vida", "salud", "viaje", "incendio", "responsabilidad_civil", "transporte", "fianzas", "colectivo", "maquinaria", "accidentes"] },
  { id: "colonial", nombre: "La Colonial de Seguros", corto: "La Colonial", logo: "/max/aseguradoras/la-colonial.jpg", ramos: ["vehiculo", "hogar", "incendio", "fianzas", "transporte", "responsabilidad_civil", "maquinaria"] },
  { id: "humano", nombre: "Humano Seguros", corto: "Humano", logo: "/max/aseguradoras/humano.png", ramos: ["vehiculo", "salud", "vida", "colectivo", "hogar", "accidentes"] },
  { id: "sura", nombre: "Seguros SURA", corto: "SURA", logo: "/max/aseguradoras/sura.png", ramos: ["vehiculo", "hogar", "vida", "incendio", "responsabilidad_civil", "transporte", "accidentes"] },
  { id: "bmi", nombre: "BMI", corto: "BMI", logo: "/max/aseguradoras/bmi.png", ramos: ["salud", "vida", "viaje", "colectivo"] },
  { id: "banesco", nombre: "Banesco Seguros", corto: "Banesco", logo: "/max/aseguradoras/banesco.png", ramos: ["vehiculo", "hogar", "vida", "incendio"] },
  { id: "palic", nombre: "ARS Palic", corto: "ARS Palic", logo: "/max/aseguradoras/ars-palic.png", ramos: ["salud", "colectivo"] },
  { id: "primera", nombre: "Primera ARS Humano", corto: "Primera ARS", logo: "/max/aseguradoras/primera-humano.png", ramos: ["salud", "colectivo"] },
]
export const ASEGURADORA = Object.fromEntries(ASEGURADORAS.map((a) => [a.id, a])) as Record<string, Aseguradora>

export const EQUIPO: Persona[] = [
  { id: "ricardo", nombre: "Ricardo Almánzar", cargo: "Director comercial", area: "direccion", sucursal: "santo_domingo", correo: "direccion@max.demo", iniciales: "RA" },
  { id: "patricia", nombre: "Patricia Gómez", cargo: "Ejecutiva de personas", area: "comercial_personas", sucursal: "santo_domingo", correo: "patricia@max.demo", iniciales: "PG" },
  { id: "eduardo", nombre: "Eduardo Méndez", cargo: "Ejecutivo de personas", area: "comercial_personas", sucursal: "santo_domingo", correo: "eduardo@max.demo", iniciales: "EM" },
  { id: "luis", nombre: "Luis Fernández", cargo: "Ejecutivo de personas", area: "comercial_personas", sucursal: "santiago", correo: "luis@max.demo", iniciales: "LF" },
  { id: "nicole", nombre: "Nicole Batista", cargo: "Ejecutiva de personas", area: "comercial_personas", sucursal: "punta_cana", correo: "nicole@max.demo", iniciales: "NB" },
  { id: "manuel", nombre: "Manuel Ortega", cargo: "Ejecutivo de empresas", area: "comercial_empresas", sucursal: "santo_domingo", correo: "manuel@max.demo", iniciales: "MO" },
  { id: "gabriela", nombre: "Gabriela Sosa", cargo: "Ejecutiva de empresas", area: "comercial_empresas", sucursal: "santiago", correo: "gabriela@max.demo", iniciales: "GS" },
  { id: "yesenia", nombre: "Yesenia Marte", cargo: "Servicio al cliente", area: "servicio", sucursal: "santo_domingo", correo: "servicio@max.demo", iniciales: "YM" },
  { id: "julio", nombre: "Julio Pichardo", cargo: "Analista de siniestros", area: "siniestros", sucursal: "santo_domingo", correo: "siniestros@max.demo", iniciales: "JP" },
  { id: "ana", nombre: "Ana Luisa Peña", cargo: "Analista de siniestros", area: "siniestros", sucursal: "santiago", correo: "ana@max.demo", iniciales: "AP" },
]
export const PERSONA = Object.fromEntries(EQUIPO.map((p) => [p.id, p])) as Record<string, Persona>
export const NOMBRE_AREA: Record<Area, string> = {
  comercial_personas: "Comercial personas",
  comercial_empresas: "Comercial empresas",
  servicio: "Servicio al cliente",
  siniestros: "Siniestros",
  direccion: "Dirección",
}

// Pasos y documentos de max.com.do/servicios/reportar-siniestro (texto oficial).
export const PROCEDIMIENTOS: Record<TipoSiniestro, { nombre: string; pasos: string[]; documentos: string[] }> = {
  automovil: {
    nombre: "Accidente de vehículo",
    pasos: [
      "Comunicar el accidente al corredor o a la aseguradora dentro de las primeras 24 horas.",
      "Llamar a la DIGESETT o a la autoridad competente si hay lesiones, fallecimientos o daños a terceros.",
      "No realizar reparaciones hasta recibir autorización de la aseguradora.",
      "Coordinar la inspección del vehículo si aplica.",
    ],
    documentos: ["Formulario de notificación de siniestro de la aseguradora", "Copia de la matrícula y la licencia de conducir", "Acta de la DIGESETT o informe policial", "Fotos del accidente y de los daños", "Copia del seguro vigente"],
  },
  incendio: {
    nombre: "Incendio",
    pasos: ["Informar de inmediato al corredor o a la aseguradora y a los bomberos.", "Tomar medidas para evitar que el fuego se propague, si es seguro hacerlo.", "No remover escombros hasta recibir autorización."],
    documentos: ["Formulario de reclamo", "Informe de los bomberos o de la autoridad competente", "Inventario de los bienes afectados", "Fotos del daño", "Copia de la póliza vigente"],
  },
  inundacion: {
    nombre: "Inundación",
    pasos: ["Reportar el evento tan pronto ocurra.", "Tomar fotos y videos de los daños antes de limpiar.", "Proteger los bienes que no hayan sido afectados."],
    documentos: ["Informe de la autoridad local, si aplica", "Evidencia fotográfica y listado de los bienes dañados", "Copia de la póliza"],
  },
  robo: {
    nombre: "Robo",
    pasos: ["Notificar inmediatamente a la policía.", "Informar al corredor o a la aseguradora en menos de 24 horas.", "Evitar alterar la escena del robo hasta que sea inspeccionada."],
    documentos: ["Denuncia policial", "Lista de los bienes robados con facturas o pruebas de propiedad", "Fotos del lugar (puertas, ventanas, accesos forzados)"],
  },
  averia: {
    nombre: "Avería de equipos",
    pasos: ["Reportar inmediatamente el incidente.", "Suspender el uso del equipo dañado.", "Coordinar la inspección técnica con la aseguradora."],
    documentos: ["Informe técnico o de mantenimiento", "Facturas de compra o de reparación, si aplica"],
  },
  salud: {
    nombre: "Reembolso de salud",
    pasos: ["Reunir las facturas y los soportes médicos del servicio.", "Enviar la solicitud de reembolso por los canales de MAX.", "La aseguradora revisa la solicitud según las condiciones de la póliza."],
    documentos: ["Formulario de solicitud de reembolso", "Facturas originales con número de comprobante", "Indicación o informe médico", "Resultados de estudios, si aplica"],
  },
  otros: {
    nombre: "Otro siniestro",
    pasos: ["Notificar a la aseguradora tan pronto ocurra el evento.", "Dar toda la información posible: fecha, hora, lugar y descripción.", "Evitar modificar la escena o los bienes hasta tener autorización."],
    documentos: ["Informe de la autoridad competente, si aplica", "Evidencias fotográficas o videos", "Facturas o pruebas de propiedad"],
  },
}

export const ETAPAS: { id: Etapa; nombre: string; abierta: boolean }[] = [
  { id: "nueva", nombre: "Nueva", abierta: true },
  { id: "calificada", nombre: "Calificada", abierta: true },
  { id: "en_cotizacion", nombre: "En cotización", abierta: true },
  { id: "propuesta_enviada", nombre: "Propuesta enviada", abierta: true },
  { id: "en_decision", nombre: "En decisión", abierta: true },
  { id: "ganada", nombre: "Póliza emitida", abierta: false },
  { id: "perdida", nombre: "Perdida", abierta: false },
]
export const NOMBRE_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e.nombre])) as Record<Etapa, string>

export const NOMBRE_ORIGEN: Record<Origen, string> = {
  whatsapp: "WhatsApp",
  web: "Chat del sitio",
  instagram: "Instagram",
  telefono: "Teléfono",
  correo: "Correo",
  presencial: "En oficina",
  referido: "Referido",
  renovacion: "Renovación",
  venta_cruzada: "Venta cruzada",
  cotizador_web: "Cotizador web",
}
export const NOMBRE_CANAL: Record<Canal, string> = { whatsapp: "WhatsApp", web: "Chat del sitio", instagram: "Instagram", telefono: "Teléfono", correo: "Correo", presencial: "En oficina" }

export const ESTADO_POLIZA: Record<EstadoPoliza, string> = { vigente: "Vigente", por_renovar: "Por renovar", renovada: "Renovada", vencida: "Vencida", cancelada: "Cancelada" }
export const ESTADO_RENOVACION: Record<EstadoRenovacion, string> = {
  sin_iniciar: "Sin aviso",
  aviso_enviado: "Aviso enviado",
  quiere_renovar: "Quiere renovar",
  cotizando: "Cotizando opciones",
  confirmada: "Renovación confirmada",
  no_renueva: "No renueva",
}
export const ESTADO_SINIESTRO: Record<EstadoSiniestro, string> = {
  reportado: "Reportado",
  documentos: "Reuniendo documentos",
  inspeccion: "En inspección",
  en_aseguradora: "En la aseguradora",
  resuelto: "Resuelto por la aseguradora",
  cerrado: "Cerrado",
}

const rdFmt = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 })
export const rd = (n: number) => `RD$ ${rdFmt.format(Math.round(n))}`
export const rdCorto = (n: number) => (n >= 1_000_000 ? `RD$ ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} M` : n >= 1000 ? `RD$ ${Math.round(n / 1000)} mil` : rd(n))
export const numero = (n: number) => rdFmt.format(n)

const fmtFecha = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit" })
const fmtHora = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit", hour12: false })
const fmtCorta = new Intl.DateTimeFormat("es-DO", { timeZone: ZONA_HORARIA, day: "numeric", month: "short" })
const fmtLarga = new Intl.DateTimeFormat("es-DO", { timeZone: ZONA_HORARIA, day: "numeric", month: "long", year: "numeric" })
const fmtDia = new Intl.DateTimeFormat("es-DO", { timeZone: ZONA_HORARIA, weekday: "long" })

export const fechaLocal = (ts: number) => fmtFecha.format(new Date(ts))
export const horaLocal = (ts: number) => fmtHora.format(new Date(ts))
export const fechaCorta = (ts: number) => fmtCorta.format(new Date(ts)).replace(".", "")
export const fechaLarga = (ts: number) => fmtLarga.format(new Date(ts))
export const diaSemana = (ts: number) => fmtDia.format(new Date(ts))
export const DIA = 24 * 3600 * 1000

export function hora12(ts: number) {
  const [h, m] = horaLocal(ts).split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`
}

export function hace(ts: number, ahora = Date.now()) {
  const s = Math.max(0, Math.round((ahora - ts) / 1000))
  if (s < 60) return "ahora"
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? "ayer" : `hace ${d} días`
}

export function dentroDe(ts: number, ahora = Date.now()) {
  const d = Math.round((ts - ahora) / DIA)
  if (d < 0) return d === -1 ? "venció ayer" : `venció hace ${-d} días`
  if (d === 0) return "vence hoy"
  if (d === 1) return "vence mañana"
  return `vence en ${d} días`
}

export function duracion(seg: number) {
  if (seg < 60) return `${Math.round(seg)} s`
  const m = seg / 60
  if (m < 60) return `${Math.round(m)} min`
  const h = m / 60
  if (h < 24) return `${h.toFixed(h < 10 ? 1 : 0)} h`
  return `${(h / 24).toFixed(1)} días`
}

export const primerNombre = (n: string) => n.split(" ")[0]
