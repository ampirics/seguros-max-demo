import { ASEGURADORAS, DIA, EQUIPO, PROCEDIMIENTOS, RAMO, RAMOS } from "../catalogo"
import type { Cliente, CotizacionAseguradora, Etapa, Oportunidad, Origen, Poliza, Ramo, Segmento, Siniestro, Sucursal, TipoSiniestro } from "../tipos"
import { crearAzar, type Azar } from "./azar"

// Historia de ejemplo con semilla fija: los mismos asegurados, pólizas y números en cada arranque.
// Primas y montos son de ejemplo; no salen de ninguna aseguradora.

export const INICIO_ORA_DIAS = 92

const NOMBRES_H = ["José", "Luis", "Juan Carlos", "Miguel", "Rafael", "Pedro", "Francisco", "Carlos", "Ramón", "Manuel", "Héctor", "Félix", "Víctor", "Andrés", "Julio", "Rubén", "Alexis", "Wilson", "Starlin", "Frank", "Eddy", "Kelvin", "Darío", "Joel", "Rolando", "Ernesto", "Domingo", "Ángel"]
const NOMBRES_M = ["María", "Ana", "Carmen", "Rosa", "Yolanda", "Altagracia", "Patricia", "Yokasta", "Ramona", "Mercedes", "Cristina", "Wendy", "Yudelka", "Paola", "Laura", "Margarita", "Isabel", "Lourdes", "Daniela", "Gabriela", "Mariel", "Nathalie", "Yesica", "Esther", "Rocío", "Johanna", "Francia", "Leidy"]
const APELLIDOS = ["Pérez", "Rodríguez", "Martínez", "García", "Hernández", "Gómez", "Díaz", "Reyes", "Santana", "Jiménez", "Peña", "Rosario", "Cruz", "Castillo", "Ramírez", "Batista", "Núñez", "Guzmán", "Tavárez", "Almonte", "Polanco", "Vásquez", "Encarnación", "Féliz", "Mejía", "De los Santos", "Paulino", "Valdez", "Rosa", "Abreu", "Ureña", "Taveras", "Liriano", "Bautista", "Medina", "Sánchez", "Mota", "Brito", "Matos", "Capellán"]

const EMPRESAS: { nombre: string; sector: string; ciudad: string; sucursal: Sucursal }[] = [
  { nombre: "Distribuidora Caribe Sur", sector: "Distribución de alimentos", ciudad: "Santo Domingo Oeste", sucursal: "santo_domingo" },
  { nombre: "Constructora Bisonó & Asociados", sector: "Construcción", ciudad: "Santiago", sucursal: "santiago" },
  { nombre: "Ferretería El Cibao", sector: "Comercio minorista", ciudad: "Santiago", sucursal: "santiago" },
  { nombre: "Transporte Ozama Cargo", sector: "Transporte de carga", ciudad: "Santo Domingo Este", sucursal: "santo_domingo" },
  { nombre: "Clínica Dental Sonrisa Plena", sector: "Salud", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Hotel Brisas de Bávaro", sector: "Turismo y hotelería", ciudad: "Punta Cana", sucursal: "punta_cana" },
  { nombre: "Agroindustrial Valle Verde", sector: "Agroindustria", ciudad: "La Vega", sucursal: "santiago" },
  { nombre: "Importadora Tecnomundo", sector: "Importación de electrónica", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Colegio Nuevo Horizonte", sector: "Educación", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Panadería La Espiga Dorada", sector: "Alimentos", ciudad: "San Cristóbal", sucursal: "santo_domingo" },
  { nombre: "Textiles del Norte", sector: "Zona franca textil", ciudad: "Santiago", sucursal: "santiago" },
  { nombre: "Marina Cap Cana Charters", sector: "Turismo náutico", ciudad: "Punta Cana", sucursal: "punta_cana" },
  { nombre: "Farmacia Popular Los Prados", sector: "Farmacia", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Grupo Logístico Haina", sector: "Logística portuaria", ciudad: "Bajos de Haina", sucursal: "santo_domingo" },
  { nombre: "Restaurante El Conuco Gourmet", sector: "Restaurantes", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Taller Industrial Hermanos Peña", sector: "Metalmecánica", ciudad: "Santiago", sucursal: "santiago" },
  { nombre: "Inmobiliaria Torres del Mar", sector: "Bienes raíces", ciudad: "Punta Cana", sucursal: "punta_cana" },
  { nombre: "Laboratorio Clínico Bioanálisis", sector: "Salud", ciudad: "Santiago", sucursal: "santiago" },
  { nombre: "Cooperativa Agropecuaria Mao", sector: "Agropecuaria", ciudad: "Mao", sucursal: "santiago" },
  { nombre: "Software Quisqueya", sector: "Tecnología", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Embotelladora Agua Cristal", sector: "Bebidas", ciudad: "Santo Domingo Norte", sucursal: "santo_domingo" },
  { nombre: "Excursiones Saona Tours", sector: "Turismo", ciudad: "La Romana", sucursal: "punta_cana" },
  { nombre: "Gasolinera El Puerto", sector: "Combustibles", ciudad: "Puerto Plata", sucursal: "santiago" },
  { nombre: "Centro Médico Higüey", sector: "Salud", ciudad: "Higüey", sucursal: "punta_cana" },
  { nombre: "Muebles Caoba Fina", sector: "Manufactura", ciudad: "Moca", sucursal: "santiago" },
  { nombre: "Seguridad Privada Centinela", sector: "Seguridad", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Imprenta Gráfica Moderna", sector: "Artes gráficas", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Supermercado La Cadena del Este", sector: "Supermercados", ciudad: "San Pedro de Macorís", sucursal: "santo_domingo" },
  { nombre: "Clínica Veterinaria Patitas", sector: "Veterinaria", ciudad: "Santiago", sucursal: "santiago" },
  { nombre: "Fábrica de Bloques Duarte", sector: "Materiales de construcción", ciudad: "San Francisco de Macorís", sucursal: "santiago" },
  { nombre: "Villa Real Resort Management", sector: "Administración de villas", ciudad: "Punta Cana", sucursal: "punta_cana" },
  { nombre: "Academia de Idiomas Global", sector: "Educación", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Distribuidora Farmacéutica Salud+", sector: "Distribución farmacéutica", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Exportadora de Cacao Yuna", sector: "Exportación agrícola", ciudad: "San Francisco de Macorís", sucursal: "santiago" },
  { nombre: "Car Wash & Lube Express", sector: "Servicios automotrices", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Estudio de Arquitectura Línea", sector: "Arquitectura", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Granja Avícola La Pollera", sector: "Avícola", ciudad: "Moca", sucursal: "santiago" },
  { nombre: "Óptica Visión Clara", sector: "Comercio minorista", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Transportes Turísticos Bávaro", sector: "Transporte turístico", ciudad: "Punta Cana", sucursal: "punta_cana" },
  { nombre: "Almacenes El Gran Ahorro", sector: "Comercio mayorista", ciudad: "Santiago", sucursal: "santiago" },
  { nombre: "Consultorio Jurídico Pimentel", sector: "Servicios legales", ciudad: "Santo Domingo", sucursal: "santo_domingo" },
  { nombre: "Planta Eléctrica Solar Sur", sector: "Energía", ciudad: "Baní", sucursal: "santo_domingo" },
]

const CIUDADES: [string, Sucursal, number][] = [
  ["Santo Domingo", "santo_domingo", 9],
  ["Santo Domingo Este", "santo_domingo", 4],
  ["Santo Domingo Norte", "santo_domingo", 2],
  ["San Cristóbal", "santo_domingo", 1.5],
  ["Santiago", "santiago", 5],
  ["La Vega", "santiago", 1.2],
  ["Puerto Plata", "santiago", 1],
  ["Moca", "santiago", 0.8],
  ["Punta Cana", "punta_cana", 2.5],
  ["La Romana", "punta_cana", 1],
  ["Higüey", "punta_cana", 0.8],
]

export const VEHICULOS: [string, string, number][] = [
  ["Toyota", "Corolla", 3], ["Toyota", "RAV4", 2.5], ["Toyota", "Hilux", 2], ["Toyota", "Land Cruiser Prado", 1],
  ["Honda", "CR-V", 2.5], ["Honda", "Civic", 1.5], ["Hyundai", "Tucson", 2.5], ["Hyundai", "Santa Fe", 1.5], ["Hyundai", "Accent", 1.5],
  ["Kia", "Sportage", 2], ["Kia", "Sonet", 1.2], ["Kia", "Picanto", 1], ["Mitsubishi", "L200", 1.2], ["Mitsubishi", "Outlander", 1],
  ["Nissan", "Frontier", 1.2], ["Jeep", "Wrangler", 0.8], ["Suzuki", "Swift", 0.8], ["Mazda", "CX-5", 1], ["Chevrolet", "Colorado", 0.6], ["Mercedes-Benz", "GLC 300", 0.5],
]

const PLAN: Record<Ramo, string[]> = {
  vehiculo: ["Full con daños propios", "Full con daños propios y auto sustituto", "Ley (responsabilidad civil obligatoria)", "Plus con rotura de cristales"],
  salud: ["Plan local familiar", "Plan local individual", "Plan internacional familiar", "Plan internacional individual"],
  vida: ["Vida a término 20 años", "Vida entera", "Vida para crédito hipotecario"],
  hogar: ["Incendio y líneas aliadas para vivienda", "Vivienda con contenido", "Vivienda y artículos valiosos"],
  viaje: ["Asistencia en viaje multiviaje", "Asistencia en viaje por evento", "Estudiante en el exterior"],
  accidentes: ["Accidentes personales individual", "Accidentes personales familiar"],
  incendio: ["Incendio y líneas aliadas", "Todo riesgo de propiedad", "Incendio con interrupción de negocio"],
  responsabilidad_civil: ["Responsabilidad civil general", "Responsabilidad civil profesional", "Responsabilidad civil de productos"],
  transporte: ["Transporte de mercancía terrestre", "Carga marítima de importación", "Póliza flotante de embarques"],
  fianzas: ["Fianza de fiel cumplimiento", "Fianza de anticipo", "Fianza judicial"],
  colectivo: ["Salud colectiva de empleados", "Vida colectiva de empleados", "Salud y vida colectiva"],
  maquinaria: ["Rotura de maquinaria", "Equipos electrónicos", "Todo riesgo de construcción y montaje"],
}

const PRIMA: Record<Ramo, [number, number]> = {
  vehiculo: [26000, 98000],
  salud: [48000, 420000],
  vida: [18000, 95000],
  hogar: [9500, 46000],
  viaje: [3800, 14500],
  accidentes: [5200, 21000],
  incendio: [140000, 1650000],
  responsabilidad_civil: [62000, 540000],
  transporte: [95000, 880000],
  fianzas: [28000, 310000],
  colectivo: [420000, 5800000],
  maquinaria: [85000, 1150000],
}

const COBERTURAS: Record<Ramo, string[]> = {
  vehiculo: ["Daños propios", "Responsabilidad civil", "Robo", "Rotura de cristales", "Asistencia vial", "Auto sustituto", "Fianza judicial"],
  salud: ["Hospitalización", "Consultas", "Emergencias", "Maternidad", "Medicamentos ambulatorios", "Cobertura internacional"],
  vida: ["Muerte por cualquier causa", "Invalidez total y permanente", "Enfermedades graves", "Gastos funerarios"],
  hogar: ["Incendio", "Terremoto", "Huracán", "Inundación", "Robo de contenido", "Responsabilidad civil familiar"],
  viaje: ["Gastos médicos", "Equipaje", "Cancelación de viaje", "Repatriación"],
  accidentes: ["Muerte accidental", "Incapacidad", "Gastos médicos por accidente"],
  incendio: ["Incendio", "Terremoto", "Huracán", "Interrupción de negocio", "Remoción de escombros"],
  responsabilidad_civil: ["Daños a terceros", "Gastos de defensa", "Responsabilidad de productos"],
  transporte: ["Pérdida total", "Avería particular", "Robo en tránsito", "Carga y descarga"],
  fianzas: ["Cumplimiento", "Anticipo", "Calidad de obra"],
  colectivo: ["Salud local", "Salud internacional", "Vida colectiva", "Maternidad"],
  maquinaria: ["Rotura de maquinaria", "Daño eléctrico", "Equipos móviles", "Montaje"],
}

const MOTIVOS_PERDIDA = ["Eligió otra opción por precio", "Renovó con su corredor anterior", "Dejó de responder", "Pospuso la compra", "No calificaba para el producto", "Lo resolvió con el banco del préstamo"]

export const prefijoPoliza: Record<Ramo, string> = {
  vehiculo: "AUT", salud: "SAL", vida: "VID", hogar: "HOG", viaje: "VIA", accidentes: "ACP", incendio: "INC", responsabilidad_civil: "RCG", transporte: "TRA", fianzas: "FIA", colectivo: "COL", maquinaria: "MAQ",
}

export interface Historia {
  clientes: Cliente[]
  polizas: Poliza[]
  oportunidades: Oportunidad[]
  siniestros: Siniestro[]
  contadores: { op: number; sin: number; pol: number }
}

const PREFIJOS_EMPRESA = ["Ferretería", "Distribuidora", "Comercial", "Inversiones", "Constructora", "Transporte", "Clínica", "Colegio", "Farmacia", "Importadora", "Agroindustrial", "Servicios Técnicos", "Panificadora", "Taller"]
const NOMBRES_EMPRESA = ["Los Ríos", "Hermanos Polanco", "El Progreso", "Caribe Norte", "Del Este", "La Esperanza", "Bisonó", "Quisqueya", "Santa Ana", "Mella", "Las Américas", "Cibao Central", "Bávaro", "Ozama", "Duarte", "Higüey Mar", "Los Alcarrizos", "Naco"]
const SECTOR_PREFIJO: Record<string, string> = { Ferretería: "Comercio minorista", Distribuidora: "Distribución", Comercial: "Comercio", Inversiones: "Bienes raíces", Constructora: "Construcción", Transporte: "Transporte de carga", Clínica: "Salud", Colegio: "Educación", Farmacia: "Farmacia", Importadora: "Importación", Agroindustrial: "Agroindustria", "Servicios Técnicos": "Servicios", Panificadora: "Alimentos", Taller: "Metalmecánica" }

const tel = (az: Azar) => `${az.elegir(["809", "829", "849"])}-555-${String(az.entero(1000, 9999))}`
const cedula = (az: Azar) => `${az.elegir(["001", "402", "031", "223", "047"])}-${String(az.entero(1000000, 9999999))}-${az.entero(0, 9)}`
const rnc = (az: Azar) => `1-${az.entero(30, 33)}-${String(az.entero(10000, 99999))}-${az.entero(1, 9)}`
const redondear = (n: number, a = 100) => Math.round(n / a) * a

export function ejecutivoPara(ramo: Ramo, sucursal: Sucursal, az: Azar | null, carga?: Map<string, number>, segmento?: Segmento) {
  const area = segmento === "empresa" ? "comercial_empresas" : RAMO[ramo].area
  let lista = EQUIPO.filter((p) => p.area === area && p.sucursal === sucursal)
  if (!lista.length) lista = EQUIPO.filter((p) => p.area === area)
  if (carga) return lista.slice().sort((a, b) => (carga.get(a.id) ?? 0) - (carga.get(b.id) ?? 0))[0].id
  return (az ? az.elegir(lista) : lista[0]).id
}

export function fichaDe(az: Azar, ramo: Ramo, c: Cliente): Record<string, string | number | boolean | null> {
  const ciudad = c.ciudad
  switch (ramo) {
    case "vehiculo": {
      const [marca, modelo] = az.pesado(VEHICULOS.map((v) => [v, v[2]] as [[string, string, number], number]))
      const anio = az.entero(2014, 2026)
      return { marca, modelo, anio, uso: az.sig() < 0.86 ? "Personal" : "Comercial", cobertura: anio > 2018 ? "Full con daños propios" : az.elegir(["Full con daños propios", "Ley"]), ciudad, valor_aproximado: anio > 2018 ? redondear(az.entre(900000, 3600000), 50000) : null }
    }
    case "salud": {
      const personas = az.entero(1, 5)
      const edades = Array.from({ length: personas }, (_, i) => (i < 2 ? az.entero(28, 62) : az.entero(1, 17))).join(", ")
      return { personas, edades, alcance: az.sig() < 0.32 ? "Internacional" : "Local", seguro_actual: az.sig() < 0.5 ? "Solo el de la empresa" : "No tiene", ciudad }
    }
    case "vida":
      return { edad: az.entero(26, 58), proposito: az.elegir(["Proteger a la familia", "Garantía de préstamo hipotecario", "Ahorro y protección"]), suma_deseada: redondear(az.entre(2000000, 15000000), 500000), fumador: az.sig() < 0.12 }
    case "hogar":
      return { tipo_vivienda: az.elegir(["Apartamento", "Casa"]), propia_o_alquilada: az.sig() < 0.75 ? "Propia" : "Alquilada", ciudad, valor_aproximado: redondear(az.entre(3500000, 22000000), 250000), contenido: az.sig() < 0.6 }
    case "viaje":
      return { destino: az.elegir(["Estados Unidos", "España", "Europa (Schengen)", "Panamá", "Colombia", "Canadá"]), fechas: "Próximo mes", viajeros: az.entero(1, 4), motivo: az.elegir(["Vacaciones", "Trabajo", "Estudios"]) }
    case "accidentes":
      return { edad: az.entero(22, 60), ocupacion: az.elegir(["Ingeniero civil", "Motoconchista", "Contadora", "Médico", "Vendedor"]) }
    default:
      return {
        empresa: c.nombre,
        sector: c.sector ?? "Comercio",
        empleados: c.empleados ?? az.entero(8, 240),
        ubicacion: ciudad,
        ...(ramo === "transporte" ? { alcance: az.elegir(["Distribución local", "Importación", "Importación y distribución local"]), mercancia: az.elegir(["Alimentos secos", "Electrodomésticos", "Materiales de construcción", "Medicamentos"]) } : {}),
        ...(ramo === "incendio" ? { valor_aproximado: redondear(az.entre(15000000, 180000000), 1000000) } : {}),
        ...(ramo === "responsabilidad_civil" ? { actividad: c.sector ?? "Servicios" } : {}),
        ...(ramo === "fianzas" ? { tipo_fianza: az.elegir(["Fiel cumplimiento", "Anticipo"]), monto: redondear(az.entre(2000000, 40000000), 500000) } : {}),
        ...(ramo === "maquinaria" ? { equipos: az.elegir(["Montacargas y generadores", "Excavadoras y retro", "Equipos de laboratorio", "Servidores y equipos electrónicos"]) } : {}),
      }
  }
}

export function bienDe(ramo: Ramo, f: Record<string, unknown>) {
  if (ramo === "vehiculo") return `${f.marca} ${f.modelo} ${f.anio}`
  if (ramo === "salud") return `${f.personas} ${Number(f.personas) === 1 ? "persona" : "personas"}, ${String(f.alcance).toLowerCase()}`
  if (ramo === "hogar") return `${f.tipo_vivienda} en ${f.ciudad}`
  if (ramo === "viaje") return `${f.viajeros ?? 1} ${Number(f.viajeros ?? 1) === 1 ? "viajero" : "viajeros"} a ${f.destino}`
  if (ramo === "colectivo") return `${f.empleados} empleados`
  if (ramo === "transporte") return String(f.mercancia ?? "Mercancía")
  if (ramo === "maquinaria") return String(f.equipos ?? "Equipos")
  if (RAMO[ramo].segmento === "empresa") return String(f.ubicacion ?? "Local principal")
  return "Asegurado titular"
}

export function cotizacionesDe(az: Azar, ramo: Ramo, base: number): CotizacionAseguradora[] {
  const opciones = ASEGURADORAS.filter((a) => a.ramos.includes(ramo))
  const tomadas = opciones.slice().sort(() => az.sig() - 0.5).slice(0, Math.min(3, opciones.length))
  const lista = tomadas.map((a) => {
    const prima = redondear(base * az.entre(0.86, 1.18))
    const cob = COBERTURAS[ramo]
    return {
      aseguradoraId: a.id,
      prima,
      deducible: ramo === "vehiculo" ? az.elegir(["1 % del valor, mínimo RD$ 10,000", "RD$ 15,000 por evento", "2 % del valor asegurado"]) : RAMO[ramo].segmento === "empresa" ? az.elegir(["2 % de la pérdida, mínimo RD$ 50,000", "RD$ 75,000 por evento"]) : az.elegir(["RD$ 5,000 por evento", "Sin deducible en red", "10 % por reclamación"]),
      coberturas: cob.filter(() => az.sig() < 0.8).slice(0, 5),
    }
  })
  const mejor = lista.slice().sort((a, b) => b.coberturas.length * 9000 - b.prima - (a.coberturas.length * 9000 - a.prima))[0]
  if (mejor) mejor.recomendada = true
  return lista
}

function crearProspectoEmpresa(az: Azar, i: number, ahora: number): Cliente {
  const pre = az.elegir(PREFIJOS_EMPRESA)
  const [ciudad, sucursal] = az.pesado(CIUDADES.map((c) => [c, c[2]] as [[string, Sucursal, number], number]))
  return {
    id: `cl-${i}`,
    segmento: "empresa",
    nombre: `${pre} ${az.elegir(NOMBRES_EMPRESA)}${az.sig() < 0.4 ? ", SRL" : ""}`,
    documento: rnc(az),
    telefono: tel(az),
    ciudad,
    sucursal,
    ejecutivoId: ejecutivoPara("incendio", sucursal, az, undefined, "empresa"),
    desde: ahora,
    sector: SECTOR_PREFIJO[pre],
    empleados: az.entero(6, 160),
    contacto: `${az.elegir([...NOMBRES_H, ...NOMBRES_M])} ${az.elegir(APELLIDOS)}`,
    etiquetas: ["Prospecto"],
    recorrido: [],
  }
}

function crearCliente(az: Azar, i: number, ahora: number): Cliente {
  const empresa = i % 5 === 0 && i / 5 < EMPRESAS.length
  if (empresa) {
    const e = EMPRESAS[i / 5]
    const contacto = `${az.elegir([...NOMBRES_H, ...NOMBRES_M])} ${az.elegir(APELLIDOS)}`
    return {
      id: `cl-${i}`,
      segmento: "empresa",
      nombre: e.nombre,
      documento: rnc(az),
      telefono: tel(az),
      correo: `${contacto.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@${e.nombre.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.demo`,
      ciudad: e.ciudad,
      sucursal: e.sucursal,
      ejecutivoId: ejecutivoPara("incendio", e.sucursal, az),
      desde: ahora - az.entero(200, 4800) * DIA,
      sector: e.sector,
      empleados: az.entero(12, 380),
      contacto,
      etiquetas: [],
      recorrido: [],
    }
  }
  const mujer = az.sig() < 0.5
  const nombre = `${az.elegir(mujer ? NOMBRES_M : NOMBRES_H)} ${az.elegir(APELLIDOS)} ${az.elegir(APELLIDOS)}`
  const [ciudad, sucursal] = az.pesado(CIUDADES.map((c) => [c, c[2]] as [[string, Sucursal, number], number]))
  return {
    id: `cl-${i}`,
    segmento: "persona",
    nombre,
    documento: cedula(az),
    telefono: tel(az),
    correo: az.sig() < 0.7 ? `${nombre.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${nombre.split(" ")[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@correo.demo` : undefined,
    ciudad,
    sucursal,
    ejecutivoId: ejecutivoPara("vehiculo", sucursal, az),
    desde: ahora - az.entero(30, 6500) * DIA,
    etiquetas: [],
    recorrido: [],
  }
}

const RAMOS_PERSONA: [Ramo, number][] = [["vehiculo", 10], ["salud", 4], ["vida", 2.4], ["hogar", 2.2], ["viaje", 1], ["accidentes", 0.6]]
const RAMOS_EMPRESA: [Ramo, number][] = [["incendio", 3], ["responsabilidad_civil", 2], ["colectivo", 2.4], ["transporte", 1.4], ["vehiculo", 2.2], ["maquinaria", 1.2], ["fianzas", 0.8]]

export function crearHistoria(ahora: number): Historia {
  const az = crearAzar(20261109)
  const clientes: Cliente[] = Array.from({ length: 215 }, (_, i) => crearCliente(az, i, ahora))
  const polizas: Poliza[] = []
  const oportunidades: Oportunidad[] = []
  const siniestros: Siniestro[] = []
  let nPol = 4100
  let nOp = 100
  let nSin = 300

  const nuevaPoliza = (c: Cliente, ramo: Ramo, inicio: number, ficha?: Record<string, unknown>, prima?: number, aseguradoraId?: string): Poliza => {
    const f = ficha ?? fichaDe(az, ramo, c)
    const [a, b] = PRIMA[ramo]
    const base = prima ?? redondear(c.segmento === "empresa" && ramo === "vehiculo" ? az.entre(a, b) * az.entero(2, 9) : az.entre(a, b))
    const aseg = aseguradoraId ?? az.elegir(ASEGURADORAS.filter((x) => x.ramos.includes(ramo))).id
    const vence = inicio + 365 * DIA
    const dias = (vence - ahora) / DIA
    const p: Poliza = {
      id: `pol-${++nPol}`,
      numero: `${prefijoPoliza[ramo]}-${new Date(inicio).getFullYear()}-${String(nPol * 7 + 13).padStart(6, "0")}`,
      clienteId: c.id,
      ramo,
      aseguradoraId: aseg,
      plan: ramo === "vehiculo" && f.cobertura === "Ley" ? PLAN.vehiculo[2] : az.elegir(PLAN[ramo]),
      bien: bienDe(ramo, f),
      sumaAsegurada: ramo === "vehiculo" ? Number(f.valor_aproximado ?? redondear(az.entre(700000, 2600000), 50000)) : redondear(base * az.entre(18, 60), 100000),
      primaAnual: base,
      formaPago: c.segmento === "empresa" ? az.elegir(["anual", "trimestral", "mensual"]) : az.elegir(["anual", "mensual", "mensual", "trimestral"]),
      inicio,
      vence,
      estado: dias < 0 ? "vencida" : dias <= 60 ? "por_renovar" : "vigente",
      renovacion: "sin_iniciar",
      ejecutivoId: ejecutivoPara(ramo, c.sucursal, az, undefined, c.segmento),
      pagoAlDia: az.sig() > 0.07,
      historial: [{ ts: inicio, texto: `Póliza emitida por ${ASEGURADORAS.find((x) => x.id === aseg)?.nombre}` }],
    }
    if (p.estado === "por_renovar") {
      p.renovacion = dias <= 15 ? az.pesado([["confirmada", 3], ["aviso_enviado", 3], ["cotizando", 2], ["quiere_renovar", 1.5], ["no_renueva", 0.5]]) : dias <= 30 ? az.pesado([["aviso_enviado", 4], ["quiere_renovar", 2], ["sin_iniciar", 1], ["cotizando", 1]]) : az.pesado([["sin_iniciar", 4], ["aviso_enviado", 2]])
      if (p.renovacion !== "sin_iniciar") p.historial.push({ ts: vence - az.entero(30, 45) * DIA, texto: "Aviso de renovación enviado por WhatsApp y correo" })
    }
    polizas.push(p)
    return p
  }

  // Cartera: cada asegurado con sus pólizas; las del año pasado que se renovaron quedan como historia.
  for (const c of clientes) {
    const cuantas = c.segmento === "empresa" ? az.entero(2, 5) : az.pesado([[1, 6], [2, 3], [3, 1]])
    const ramos = new Set<Ramo>()
    for (let k = 0; k < cuantas; k++) ramos.add(az.pesado(c.segmento === "empresa" ? RAMOS_EMPRESA : RAMOS_PERSONA))
    for (const ramo of ramos) {
      const inicio = ahora - az.entero(-10, 360) * DIA + az.entero(0, 600) * 60000
      if (inicio > ahora) continue
      const desdeAntes = c.desde < inicio - 365 * DIA
      if (desdeAntes) {
        const anterior = nuevaPoliza(c, ramo, inicio - 365 * DIA)
        anterior.estado = "renovada"
        anterior.renovacion = "confirmada"
        anterior.historial.push({ ts: anterior.vence - 20 * DIA, texto: "Renovación confirmada por el asegurado" })
        nuevaPoliza(c, ramo, inicio, undefined, redondear(anterior.primaAnual * az.entre(1.02, 1.09)), anterior.aseguradoraId)
      } else nuevaPoliza(c, ramo, inicio)
    }
    c.recorrido.push({ ts: c.desde, tipo: "contacto", texto: c.segmento === "empresa" ? "Cliente corporativo desde" : "Asegurado desde" })
  }

  // Oportunidades de 12 meses. Desde INICIO_ORA_DIAS las atiende la IA primero.
  const inicioOra = ahora - INICIO_ORA_DIAS * DIA
  for (let d = 365; d >= 0; d--) {
    const dia = ahora - d * DIA
    const semana = new Date(dia).getUTCDay()
    const cuantas = semana === 0 ? az.entero(0, 2) : semana === 6 ? az.entero(1, 4) : az.entero(2, 6) + (dia > inicioOra ? az.entero(0, 2) : 0)
    for (let k = 0; k < cuantas; k++) {
      const creada = dia - az.entero(0, 13 * 60) * 60000 - 2 * 3600000
      if (creada > ahora - 20 * 60000) continue
      const conOra = creada > inicioOra
      const existente = az.sig() < 0.3
      let c: Cliente
      if (existente) c = az.elegir(clientes)
      else {
        c = az.sig() < 0.22 ? crearProspectoEmpresa(az, clientes.length + 1000, ahora) : crearCliente(az, clientes.length + 1000, ahora)
        c.id = `cl-p${clientes.length}`
        c.desde = creada
        clientes.push(c)
      }
      const ramo: Ramo = existente && az.sig() < 0.4 ? az.pesado(c.segmento === "empresa" ? RAMOS_EMPRESA : RAMOS_PERSONA) : az.pesado(c.segmento === "empresa" ? RAMOS_EMPRESA : RAMOS_PERSONA)
      const origen: Origen = conOra
        ? az.pesado([["whatsapp", 9], ["web", 3.2], ["instagram", 2], ["telefono", 1.5], ["referido", 1.2], ["cotizador_web", 1.4], ["venta_cruzada", existente ? 1.5 : 0]])
        : az.pesado([["telefono", 5], ["whatsapp", 4], ["correo", 2], ["referido", 1.6], ["cotizador_web", 2], ["presencial", 1], ["venta_cruzada", existente ? 1 : 0]])
      const espera = conOra
        ? origen === "whatsapp" || origen === "web" || origen === "instagram"
          ? az.entre(4, 70)
          : az.entre(600, 9000)
        : az.pesado([[az.entre(900, 5400), 4], [az.entre(5400, 28800), 4], [az.entre(28800, 86400), 2.5], [az.entre(86400, 200000), 1.2]])
      const edad = (ahora - creada) / DIA
      const ganar = az.sig() < (conOra ? 0.31 : 0.24)
      let etapa: Etapa
      if (edad < 2) etapa = az.pesado([["nueva", 1.2], ["calificada", 2.4], ["en_cotizacion", 0.8]])
      else if (edad < 9) etapa = az.pesado([["calificada", 1], ["en_cotizacion", 2.2], ["propuesta_enviada", 1.8], ["en_decision", 0.8], ["ganada", ganar ? 0.8 : 0], ["perdida", 0.3]])
      else if (edad < 24) etapa = az.pesado([["en_cotizacion", 0.4], ["propuesta_enviada", 0.8], ["en_decision", 0.9], ["ganada", ganar ? 2.5 : 0], ["perdida", ganar ? 0.2 : 1.6]])
      else etapa = ganar ? "ganada" : "perdida"
      const ficha = fichaDe(az, ramo, c)
      const [a, b] = PRIMA[ramo]
      const base = redondear(az.entre(a, b))
      const sucursal = c.sucursal
      const o: Oportunidad = {
        id: `op-${++nOp}`,
        codigo: `OP-${String(nOp).padStart(4, "0")}`,
        clienteId: c.id,
        segmento: c.segmento,
        ramo,
        origen,
        etapa,
        prioridad: RAMO[ramo].segmento === "empresa" || base > 150000 ? "alta" : base > 60000 ? "media" : "baja",
        puntuacion: Math.round(az.entre(45, 96)),
        ejecutivoId: etapa === "nueva" ? undefined : ejecutivoPara(ramo, sucursal, az, undefined, c.segmento),
        sucursal,
        creada,
        actualizada: Math.min(ahora, creada + az.entre(0.2, Math.max(0.3, Math.min(edad, 20))) * DIA),
        primerContacto: creada + espera * 1000,
        ficha,
        faltantes: [],
        resumen: "",
        cotizaciones: ["propuesta_enviada", "en_decision", "ganada", "perdida"].includes(etapa) ? cotizacionesDe(az, ramo, base) : etapa === "en_cotizacion" && az.sig() < 0.5 ? cotizacionesDe(az, ramo, base).slice(0, 2) : [],
        historial: [{ ts: creada, texto: conOra && ["whatsapp", "web", "instagram"].includes(origen) ? "La IA atendió y calificó la solicitud" : "Solicitud registrada por el equipo" }],
        creadaPor: conOra && ["whatsapp", "web", "instagram"].includes(origen) ? "ia" : "equipo",
      }
      o.resumen = `${RAMO[ramo].nombre}: ${bienDe(ramo, ficha)}`
      if (o.cotizaciones.length && etapa !== "en_cotizacion") o.propuestaEnviada = creada + az.entre(0.5, 4) * DIA
      if (etapa === "ganada") {
        const elegida = o.cotizaciones.find((x) => x.recomendada) ?? o.cotizaciones[0]
        o.elegida = elegida?.aseguradoraId
        o.primaGanada = elegida?.prima ?? base
        const p = nuevaPoliza(c, ramo, o.actualizada, ficha, o.primaGanada, o.elegida)
        o.polizaId = p.id
        o.historial.push({ ts: o.actualizada, texto: `Póliza ${p.numero} emitida` })
      }
      if (etapa === "perdida") {
        o.motivoPerdida = az.elegir(MOTIVOS_PERDIDA)
        if (az.sig() < 0.42) {
          o.cotizaciones = []
          o.propuestaEnviada = undefined
          o.motivoPerdida = az.elegir(["Dejó de responder", "No calificaba para el producto", "Solo quería un precio de referencia", "Pospuso la compra"])
          if (az.sig() < 0.45) o.ejecutivoId = undefined
        }
      }
      if (["calificada", "en_cotizacion", "propuesta_enviada", "en_decision"].includes(etapa))
        o.siguiente = {
          texto: etapa === "calificada" ? "Llamar y validar datos" : etapa === "en_cotizacion" ? "Pedir primas a las aseguradoras" : etapa === "propuesta_enviada" ? "Dar seguimiento a la propuesta" : "Confirmar decisión y forma de pago",
          vence: ahora + az.entre(-0.6, 3) * DIA,
        }
      oportunidades.push(o)
      c.recorrido.push({ ts: creada, tipo: "oportunidad", texto: `Solicitud de ${RAMO[ramo].nombre.toLowerCase()} (${o.codigo})`, enlace: `/admin/oportunidades/${o.id}` })
    }
  }

  // Siniestros de 12 meses sobre pólizas reales de la cartera.
  const conSiniestro = polizas.filter((p) => p.estado !== "renovada" && ["vehiculo", "hogar", "incendio", "maquinaria", "salud", "transporte"].includes(p.ramo))
  for (let k = 0; k < 74; k++) {
    const p = az.elegir(conSiniestro)
    const c = clientes.find((x) => x.id === p.clienteId)!
    const tipo: TipoSiniestro = p.ramo === "vehiculo" ? az.pesado([["automovil", 9], ["robo", 1]]) : p.ramo === "hogar" ? az.pesado([["inundacion", 2], ["robo", 2], ["incendio", 1]]) : p.ramo === "incendio" ? az.pesado([["incendio", 2], ["inundacion", 1.5], ["robo", 1]]) : p.ramo === "maquinaria" ? "averia" : p.ramo === "salud" ? "salud" : "otros"
    const ocurrido = Math.max(p.inicio + DIA, ahora - az.entero(0, 340) * DIA - az.entero(0, 1200) * 60000)
    if (ocurrido > ahora - 3600000) continue
    const edad = (ahora - ocurrido) / DIA
    const estado = edad < 3 ? az.pesado([["reportado", 2], ["documentos", 3]] as const) : edad < 12 ? az.pesado([["documentos", 2], ["inspeccion", 2], ["en_aseguradora", 3]] as const) : edad < 35 ? az.pesado([["en_aseguradora", 2], ["resuelto", 3], ["cerrado", 2]] as const) : az.pesado([["resuelto", 1], ["cerrado", 6]] as const)
    const proc = PROCEDIMIENTOS[tipo]
    const recibidos = estado === "reportado" ? 0 : estado === "documentos" ? az.entero(1, proc.documentos.length - 1) : proc.documentos.length
    const monto = tipo === "salud" ? redondear(az.entre(8000, 160000)) : tipo === "automovil" ? redondear(az.entre(35000, 420000)) : redondear(az.entre(60000, 2400000), 1000)
    const s: Siniestro = {
      id: `sin-${++nSin}`,
      codigo: `SIN-${nSin}`,
      clienteId: c.id,
      polizaId: p.id,
      tipo,
      ocurrido,
      reportado: ocurrido + az.entre(0.3, 20) * 3600000,
      lugar: c.ciudad,
      descripcion: tipo === "automovil" ? az.elegir(["Choque por detrás en un semáforo", "Colisión lateral en una intersección", "Golpe en el parqueo de un centro comercial", "Choque con un motor que se cruzó"]) : tipo === "robo" ? az.elegir(["Robo de equipos por la ventana trasera", "Le forzaron la puerta del vehículo y se llevaron el radio"]) : tipo === "inundacion" ? "Entrada de agua por lluvias intensas" : tipo === "incendio" ? "Conato de incendio en el área eléctrica" : tipo === "averia" ? "Daño eléctrico en un equipo por una subida de voltaje" : tipo === "salud" ? "Reembolso de consulta y estudios fuera de la red" : "Daño en la mercancía durante el traslado",
      lesionados: tipo === "automovil" && az.sig() < 0.08,
      terceros: tipo === "automovil" && az.sig() < 0.55,
      estado,
      resultado: estado === "resuelto" || estado === "cerrado" ? az.pesado([["Pagado por la aseguradora", 7], ["Reparación autorizada en taller", 3], ["Declinado por la aseguradora", 1]]) : undefined,
      documentos: proc.documentos.map((nombre, i) => ({ nombre, recibido: i < recibidos ? ocurrido + az.entre(0.2, 3) * DIA : undefined })),
      responsableId: c.sucursal === "santiago" ? "ana" : "julio",
      numeroAseguradora: ["en_aseguradora", "resuelto", "cerrado", "inspeccion"].includes(estado) ? `R-${az.entero(100000, 999999)}` : undefined,
      montoEstimado: monto,
      montoResuelto: estado === "resuelto" || estado === "cerrado" ? redondear(monto * az.entre(0.7, 1)) : undefined,
      creadoPor: ocurrido > inicioOra && az.sig() < 0.6 ? "ia" : "equipo",
      historial: [{ ts: ocurrido + 3600000, texto: "Siniestro reportado" }],
    }
    if (s.resultado) {
      const fin = Math.min(ahora - 3600000, s.reportado + az.entre(6, 32) * DIA)
      s.historial.push({ ts: s.reportado + (fin - s.reportado) * 0.4, texto: `Entregado a la aseguradora con el reclamo ${s.numeroAseguradora}` }, { ts: fin, texto: s.resultado })
    }
    siniestros.push(s)
    c.recorrido.push({ ts: s.reportado, tipo: "siniestro", texto: `${proc.nombre} (${s.codigo})`, enlace: `/admin/siniestros/${s.id}` })
  }

  for (const p of polizas) {
    const c = clientes.find((x) => x.id === p.clienteId)
    c?.recorrido.push({ ts: p.inicio, tipo: "poliza", texto: `Póliza ${p.numero} de ${RAMO[p.ramo].nombre.toLowerCase()}`, enlace: `/admin/cartera/${p.id}` })
  }
  for (const c of clientes) c.recorrido.sort((a, b) => a.ts - b.ts)

  return { clientes, polizas, oportunidades, siniestros, contadores: { op: nOp, sin: nSin, pol: nPol } }
}

export const RAMOS_DE: Record<Segmento, Ramo[]> = {
  persona: RAMOS.filter((r) => r.segmento === "persona").map((r) => r.id),
  empresa: RAMOS.filter((r) => r.segmento === "empresa").map((r) => r.id),
}
