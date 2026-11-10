'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

export type Modulo = 'vehiculos' | 'piezas' | 'ventas' | 'salon' | 'reservaciones' | 'carta' | 'comensales' | 'metricas' | 'administracion' | 'corretaje'

export interface Negocio {
  tipo: string
  tipos: { valor: string; nombre: string }[]
  modulos: Record<Modulo, boolean>
  modulos_propios: Partial<Record<Modulo, boolean>>
  catalogos_oficiales: { marca: string; url: string }[]
}

export const MODULOS: { valor: Modulo; texto: string; detalle: string; rutas: string[] }[] = [
  { valor: 'vehiculos', texto: 'Vehículos', detalle: 'Vehículos de los clientes y catálogo de vehículos.', rutas: ['/admin/vehiculos', '/admin/vehiculos-catalogo'] },
  { valor: 'piezas', texto: 'Piezas', detalle: 'Búsqueda de piezas, diagrama, piezas externas y búsqueda externa.', rutas: ['/admin/piezas', '/admin/piezas-externas', '/admin/busqueda-externa'] },
  { valor: 'ventas', texto: 'Ventas e inventario', detalle: 'Cotizaciones, órdenes, inventario, clientes con vehículo, calendario y reportes de comercio.', rutas: ['/admin/leads', '/admin/cotizaciones', '/admin/orders', '/admin/payment-links', '/admin/products', '/admin/existencias', '/admin/reservas', '/admin/sucursales', '/admin/vehiculos-catalogo', '/admin/customers', '/admin/calendario', '/admin/reportes', '/admin/estadisticas', '/admin/seguridad', '/admin/pruebas'] },
  { valor: 'salon', texto: 'Salón y órdenes', detalle: 'Operación en vivo, página de cada mesa, toma de órdenes, cobro y pantalla de cocina.', rutas: ['/admin/salon', '/admin/ordenes', '/admin/cocina', '/admin/visitas'] },
  { valor: 'reservaciones', texto: 'Reservas de mesa', detalle: 'Agenda por zona, confirmaciones, recordatorios y lista de espera.', rutas: ['/admin/reservaciones', '/admin/llegadas'] },
  { valor: 'carta', texto: 'Carta', detalle: 'Platos, precios, estación, tiempos, alérgenos y disponibilidad.', rutas: ['/admin/carta'] },
  { valor: 'comensales', texto: 'Clientes del restaurante', detalle: 'Ficha con el recorrido de punta a punta, visitas, consumo y preferencias.', rutas: ['/admin/clientes'] },
  { valor: 'administracion', texto: 'Caja, inventario y compras', detalle: 'Apertura y cierre de caja, gastos, inventario por receta, platos agotados, proveedores, órdenes de compra y finanzas.', rutas: ['/admin/caja', '/admin/gastos', '/admin/inventario', '/admin/compras', '/admin/finanzas'] },
  { valor: 'corretaje', texto: 'Corretaje de seguros', detalle: 'Oportunidades por ramo, comparativo de aseguradoras, cartera y renovaciones, siniestros, asegurados e indicadores.', rutas: ['/admin/oportunidades', '/admin/cartera', '/admin/siniestros', '/admin/asegurados', '/admin/indicadores'] },
  { valor: 'metricas', texto: 'Métricas del restaurante', detalle: 'Duración de mesa, tiempos de cocina, platos, meseros, canales y reservas.', rutas: ['/admin/metricas'] },
]

/** Módulos que trae cada tipo de negocio antes de que la empresa los cambie. */
export function modulosPorTipo(tipo: string): Record<Modulo, boolean> {
  const repuestos = tipo === 'repuestos'
  const restaurante = tipo === 'restaurante'
  const seguros = tipo === 'seguros'
  return {
    vehiculos: repuestos, piezas: repuestos, ventas: !restaurante && !seguros, corretaje: seguros,
    salon: restaurante, reservaciones: restaurante, carta: restaurante, comensales: restaurante, metricas: restaurante, administracion: restaurante,
  }
}

export const negocioApi = {
  ver: () => apiClient.get<Negocio>('/empresa/negocio'),
  guardar: (datos: { tipo?: string; modulos?: Partial<Record<Modulo, boolean>>; catalogos_oficiales?: Negocio['catalogos_oficiales'] }) =>
    apiClient.put<Negocio>('/empresa/negocio', datos),
}

let cache: Negocio | null = null
let pendiente: Promise<Negocio | null> | null = null
const oyentes = new Set<(n: Negocio | null) => void>()

export function recargarNegocio(nuevo?: Negocio) {
  if (nuevo) {
    cache = nuevo
    oyentes.forEach((f) => f(nuevo))
    return
  }
  pendiente = negocioApi.ver().then((n) => { cache = n; oyentes.forEach((f) => f(n)); return n }).catch(() => { pendiente = null; return null })
}

export function useNegocio(): Negocio | null {
  const [negocio, setNegocio] = useState<Negocio | null>(cache)
  useEffect(() => {
    oyentes.add(setNegocio)
    if (!cache) {
      if (!pendiente) recargarNegocio()
      pendiente?.then((n) => setNegocio(n))
    }
    return () => { oyentes.delete(setNegocio) }
  }, [])
  return negocio
}

/** ¿La ruta pertenece a un módulo apagado para el tipo de negocio de la empresa? Sin datos, se ve todo. */
export function rutaOculta(href: string, negocio: Negocio | null): boolean {
  if (!negocio) return false
  const modulos = { ...modulosPorTipo(negocio.tipo), ...negocio.modulos }
  return MODULOS.some((m) => !modulos[m.valor] && m.rutas.some((r) => href === r || href.startsWith(`${r}/`)))
}

export function enlaceCatalogo(negocio: Negocio | null, marca: string | null | undefined, oem: string | null | undefined): string | null {
  if (!negocio || !oem) return null
  const lista = negocio.catalogos_oficiales
  const elegido = lista.find((c) => c.marca.toLowerCase() === (marca ?? '').trim().toLowerCase()) ?? lista[0]
  return elegido ? elegido.url.replace('{oem}', encodeURIComponent(oem.trim())) : null
}
