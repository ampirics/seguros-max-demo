'use client'

import { useEffect, useState } from 'react'
import { BellRing, ChevronDown } from 'lucide-react'
import { cn, formatCurrency, nombrePieza } from '@/lib/utils'
import { esperaTexto, estadoAtencion, motivoTexto, type BandejaConversacion } from './bandeja'
import { LADO, calidadTexto, normalizarBrief, skuParaVendedor, type BriefPase } from './caso'
import { SelloVerificado } from './FichaVehiculo'
import { usePalabras } from "@/lib/vertical"

type ConPase = Pick<BandejaConversacion, 'estado_atencion' | 'status' | 'assigned_to_id' | 'agent_requested' | 'agent_requested_at'
  | 'motivo_pase' | 'motivo_pase_texto' | 'esperando_desde' | 'brief_pase'>

export const briefDe = (c: ConPase): BriefPase | null => {
  const estado = estadoAtencion(c)
  if (estado !== 'esperando_vendedor' && estado !== 'vendedor') return null
  const desde = c.esperando_desde ?? c.agent_requested_at ?? null
  const brief = normalizarBrief(c.brief_pase, c.motivo_pase, desde)
  if (brief) return { ...brief, motivo_texto: brief.motivo_texto ?? c.motivo_pase_texto ?? null }
  if (estado !== 'esperando_vendedor') return null
  return {
    motivo: null, motivo_texto: c.motivo_pase_texto ?? null, desde, resumen: null, detalle: null, cotizacion: null, compra_anterior: null,
    nombre: null, vehiculo: null, piezas: [], opciones: [], falta: [], ultima_pregunta: null,
  }
}

const piezaTexto = (p: BriefPase['piezas'][number], nombre = p.nombre) =>
  [nombre, p.posicion, p.lado && (LADO[p.lado.toLowerCase()] ?? p.lado), p.cantidad && p.cantidad > 1 ? `${p.cantidad} unidades` : null]
    .filter(Boolean).join(' · ')

const lugarDe = (p?: BriefPase['piezas'][number]) =>
  p ? [p.posicion, p.lado && (LADO[p.lado.toLowerCase()] ?? p.lado)].filter(Boolean).join(' ') : null

const nombreBase = (n: string) =>
  nombrePieza(n).replace(/\s+-\s+[^-]+$/, '').replace(/\s+[A-Z0-9]*\d[A-Z0-9]*(?:-[A-Z0-9]+)*$/, '').trim() || nombrePieza(n)

const piezasPedidas = (brief: BriefPase) => {
  const vistas = new Map<string, BriefPase['piezas'][number]>()
  for (const p of brief.piezas) {
    const nombre = nombreBase(p.nombre)
    const clave = [nombre.toLowerCase(), p.posicion, p.lado].join('|')
    if (!vistas.has(clave)) vistas.set(clave, { ...p, nombre })
  }
  return [...vistas.values()]
}

export function TarjetaBrief({ brief, compacta = false }: { brief: BriefPase; compacta?: boolean }) {
  const palabras = usePalabras()
  const [abierta, setAbierta] = useState(!compacta)
  useEffect(() => setAbierta(!compacta), [compacta])
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  const espera = esperaTexto(brief.desde, ahora)
  const v = brief.vehiculo
  const vacio = !brief.nombre && !v && !brief.piezas.length && !brief.opciones.length && !brief.falta.length && !brief.ultima_pregunta?.includes('?') && !brief.detalle && !brief.cotizacion && !brief.compra_anterior
  const piezas = piezasPedidas(brief)
  const piezaDeOpcion = new Map(brief.piezas.map((p) => [p.nombre, p]))
  const unaPorOpcion = piezas.length > 1 && piezas.length === brief.opciones.length && brief.opciones.every((o) => piezaDeOpcion.has(o.nombre))
  const resumen = [v?.texto, piezas[0] && piezaTexto(piezas[0])].filter(Boolean).join(' · ') || brief.resumen
  const conSucursales = brief.opciones.some((o) => o.sucursales.length)
  const detalle = (conSucursales ? brief.detalle?.replace(/^Opciones:[^.]*\.\s*/, '') : brief.detalle) || null
  const deEsaPieza = piezas.length === 1 && brief.opciones.length > 1 ? `${brief.opciones.length} opciones de esa pieza` : null
  const tituloOpciones = unaPorOpcion ? 'Piezas que vio' : 'Opciones que vio'

  return (
    <section aria-label="Resumen del pase" className="rounded-lg border border-warning/40 bg-warning-soft/60 text-xs leading-snug">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">
            {brief.motivo_texto || motivoTexto(brief.motivo) || `Espera a ${palabras.unaPersona}`}
            {espera && <span className="font-normal text-muted-foreground"> · espera {espera}</span>}
          </span>
          {!abierta && resumen && <span className="block truncate text-muted-foreground">{resumen}</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', abierta && 'rotate-180')} aria-hidden />
      </button>
      {abierta && (
        <div className="space-y-1 border-t border-warning/30 px-3 py-1.5">
          {vacio && <p className="text-muted-foreground">El pase llegó sin resumen. Lee los últimos mensajes del cliente.</p>}
          {brief.nombre && <p className="font-medium text-foreground">{brief.nombre}</p>}
          {v && (
            <div>
              <p className="text-foreground">
                <span className="text-muted-foreground">Vehículo: </span>
                {v.texto}{v.motor ? ` · ${v.motor}` : ''}
              </p>
              <p className="flex flex-wrap items-center gap-x-2">
                {(v.vin || v.chasis) && <span className="font-mono text-[11px] tracking-wide text-muted-foreground">{v.vin ? `VIN ${v.vin}` : `Chasis ${v.chasis}`}</span>}
                <SelloVerificado vehiculo={v} />
              </p>
            </div>
          )}
          {!unaPorOpcion && piezas.map((p, i) => (
            <p key={i} className="text-foreground"><span className="text-muted-foreground">Pieza: </span>{piezaTexto(p)}{deEsaPieza && <span className="text-muted-foreground"> · {deEsaPieza}</span>}</p>
          ))}
          {brief.opciones.length > 0 && (
            <div>
              {!(deEsaPieza && !unaPorOpcion) && <p className="text-muted-foreground">{tituloOpciones}</p>}
              <ol className="space-y-0.5">
                {brief.opciones.map((o) => (
                  <li key={`${o.numero}-${o.sku ?? o.nombre}`} className="flex gap-1.5">
                    <span className="w-3 shrink-0 tabular-nums text-muted-foreground">{o.numero}.</span>
                    <span className="min-w-0 flex-1 text-foreground">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 break-words">{nombrePieza(o.nombre)}</span>
                        {o.precio_dop != null && <span className="shrink-0 font-medium tabular-nums">{formatCurrency(o.precio_dop)}</span>}
                      </span>
                      <span className="block text-muted-foreground">
                        {[skuParaVendedor(o.sku, o.nombre), calidadTexto(o.calidad), unaPorOpcion && lugarDe(piezaDeOpcion.get(o.nombre)), o.cantidad && o.cantidad > 1 ? `x${o.cantidad}` : null,
                          o.sucursales.length ? `en ${o.sucursales.join(', ')}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {brief.cotizacion && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Cotización: </span>
              {brief.cotizacion.codigo}{brief.cotizacion.version && brief.cotizacion.version > 1 ? ` v${brief.cotizacion.version}` : ''}
              {brief.cotizacion.estado ? ` · ${brief.cotizacion.estado}` : ''}
              {brief.cotizacion.total_dop != null ? ` · ${formatCurrency(brief.cotizacion.total_dop)}` : ''}
            </p>
          )}
          {brief.compra_anterior && (
            <p className="text-foreground">
              <span className="text-muted-foreground">{brief.compra_anterior.tipo === 'orden' ? 'Última compra: ' : 'Última cotización: '}</span>
              {[brief.compra_anterior.codigo,
                brief.compra_anterior.fecha && new Date(brief.compra_anterior.fecha).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }),
                brief.compra_anterior.piezas.map((p) => nombrePieza(p)).join(', '),
                brief.compra_anterior.total_dop != null && formatCurrency(brief.compra_anterior.total_dop)].filter(Boolean).join(' · ')}
            </p>
          )}
          {detalle && <p className="text-foreground"><span className="text-muted-foreground">Detalle: </span>{detalle}</p>}
          {brief.falta.length > 0 && (
            <p className="text-foreground"><span className="text-muted-foreground">Falta: </span>{brief.falta.join('; ')}</p>
          )}
          {brief.ultima_pregunta?.includes('?') && (
            <p className="text-foreground"><span className="text-muted-foreground">Última pregunta del bot: </span>“{brief.ultima_pregunta}”</p>
          )}
        </div>
      )}
    </section>
  )
}
