"use client"

import { useNegocio } from "@/lib/api/negocio"

export type Vertical = "repuestos" | "restaurante" | "seguros"

/** Vertical con la que arranca una empresa sin configuración guardada (modo demo). */
export const VERTICAL_INICIAL: Vertical = process.env.NEXT_PUBLIC_VERTICAL === "repuestos" ? "repuestos" : process.env.NEXT_PUBLIC_VERTICAL === "restaurante" ? "restaurante" : "seguros"

export function useVertical(): Vertical {
  const negocio = useNegocio()
  if (!negocio) return VERTICAL_INICIAL
  return negocio.tipo === "restaurante" || negocio.tipo === "seguros" ? negocio.tipo : "repuestos"
}

const PALABRAS = {
  repuestos: {
    persona: "vendedor",
    personas: "vendedores",
    unaPersona: "un vendedor",
    Persona: "Vendedor",
    lema: "Ventas por WhatsApp",
    descripcion: "Bandeja con asistente de IA, clientes, cotizaciones e inventario en un solo panel.",
  },
  restaurante: {
    persona: "persona del equipo",
    personas: "personas del equipo",
    unaPersona: "alguien del equipo",
    Persona: "Equipo",
    lema: "Reservas, salón y clientes con IA",
    descripcion: "El asistente atiende WhatsApp y llamadas, reserva y valida; el equipo ve el salón, la cocina y las métricas en vivo.",
  },
  seguros: {
    persona: "ejecutivo",
    personas: "ejecutivos",
    unaPersona: "un ejecutivo",
    Persona: "Ejecutivo",
    lema: "Más oportunidades, mejor servicio",
    descripcion: "El asistente atiende WhatsApp, Instagram y el sitio las 24 horas, precalifica y pasa cada caso al ejecutivo correcto con su ficha. El equipo ve oportunidades, cartera, renovaciones y siniestros en vivo.",
  },
} as const

export function usePalabras() {
  return PALABRAS[useVertical()]
}
