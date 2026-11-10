'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { CalendarClock, ChevronDown, FilePlus2, ListChecks, Loader2, Minus, PenLine, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Cotizacion, PiezaSugerida } from '@/lib/api-types'
import { cotizacionesApi } from '@/lib/api/cotizaciones'
import { conversacionesApi, ETAPAS, type Etapa, type Solicitud } from '@/lib/api/conversaciones'
import { cn, formatCurrency, nombrePieza } from '@/lib/utils'
import { Existencia, PiezaFoto } from './PiezaCards'
import { PerfilCliente, usePerfil } from './PerfilCliente'
import { TarjetaBrief, briefDe } from './TarjetaBrief'
import { DatosDelVehiculo, DialogoCorregirVehiculo } from './FichaVehiculo'
import { CotizacionCaso } from './CotizacionCaso'
import { calidadTexto, casoApi, esPiezaDemo, skuParaVendedor, vehiculoCorto, type FichaPieza, type VehiculoCaso } from './caso'
import type { BandejaConversacion } from './bandeja'
import { FotoVehiculo, fotoDelCliente } from '@/components/admin/vehiculos/FotoVehiculo'
import { perfilApi, type ArchivoCliente } from '@/lib/api/perfil'
import { PipelineCliente, usePipeline } from '@/components/admin/customers/PipelineCliente'

export type CasoConversacion = Pick<BandejaConversacion,
  'id' | 'customer_name' | 'customer_phone' | 'etapa' | 'codigo_solicitud' | 'vehiculo_id' | 'vehiculo'
  | 'estado_atencion' | 'status' | 'assigned_to_id' | 'agent_requested' | 'agent_requested_at' | 'motivo_pase' | 'motivo_pase_texto'
  | 'esperando_desde' | 'brief_pase'>

function Seccion({ titulo, accion, abierta = true, children }: { titulo: string; accion?: React.ReactNode; abierta?: boolean; children: React.ReactNode }) {
  const clave = `caso-seccion-${titulo}`
  const [abrir, setAbrir] = useState(abierta)
  useEffect(() => { if (abierta) setAbrir(true) }, [abierta])
  useEffect(() => { try { const v = localStorage.getItem(clave); if (v) setAbrir(v === '1') } catch {} }, [clave])
  const alternar = () => setAbrir((v) => { try { localStorage.setItem(clave, v ? '0' : '1') } catch {} return !v })
  return (
    <section className="border-b py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={alternar} aria-expanded={abrir}
          className="-ml-1 flex min-w-0 flex-1 items-center gap-1 rounded-control px-1 py-0.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !abrir && '-rotate-90')} aria-hidden />
          <span className="truncate">{titulo}</span>
        </button>
        {abrir && accion}
      </div>
      {abrir && <div className="mt-1.5">{children}</div>}
    </section>
  )
}

const inicioCita = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// La conversación puede tener varios vehículos (garaje): primero el de la conversación.
const vehiculoDeLaConversacion = (lista: VehiculoCaso[], conv: CasoConversacion) => {
  const id = conv.vehiculo_id ?? conv.vehiculo?.id ?? null
  return (id && lista.find((v) => v.id === id))
    || lista.find((v) => v.conversation_id === conv.id)
    || (lista.length === 1 ? lista[0] : null)
}

export function CasoPanel({
  conversation,
  pieza,
  recarga,
  onSugerencia,
  onCambio,
}: {
  conversation: CasoConversacion
  pieza: PiezaSugerida | null
  recarga: string
  onSugerencia: (texto: string) => void
  onCambio: () => void
}) {
  const convId = conversation.id
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null)
  const [vehiculo, setVehiculo] = useState<VehiculoCaso | null>(null)
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[] | null>(null)
  const [resumen, setResumen] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [vehiculoAnterior, setVehiculoAnterior] = useState<string | null>(null)
  const [ficha, setFicha] = useState<FichaPieza | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const ocupadoRef = useRef(false)
  const contenedor = useRef<HTMLDivElement>(null)

  const actual = useRef(convId)
  actual.current = convId
  const cargar = () => {
    const id = convId
    const si = <T,>(fn: (v: T) => void) => (v: T) => { if (actual.current === id) fn(v) }
    conversacionesApi.solicitud(id).then(si(setSolicitud)).catch(() => si(setSolicitud)(null))
    conversacionesApi.vehiculos(id)
      .then((v) => si(setVehiculo)(vehiculoDeLaConversacion(v as VehiculoCaso[], conversation)))
      .catch(() => si(setVehiculo)(null))
    cotizacionesApi.listar({ conversation_id: id }).then(si(setCotizaciones)).catch(() => si(setCotizaciones)([]))
  }

  useEffect(() => {
    setSolicitud(null); setVehiculo(null); setCotizaciones(null); setResumen(null); setVehiculoAnterior(null); setCorrigiendo(false)
    contenedor.current?.scrollTo({ top: 0 })
  }, [convId])

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [convId, recarga])

  useEffect(() => {
    setFicha(null)
    setCantidad(1)
    if (!pieza) return
    let vigente = true
    casoApi.ficha(pieza.product_id).then((f) => { if (vigente && f?.nombre) setFicha(f) }).catch(() => {})
    return () => { vigente = false }
  }, [pieza?.product_id])

  const correr = async (clave: string, fn: () => Promise<void>) => {
    if (ocupadoRef.current) return
    ocupadoRef.current = true
    setOcupado(clave)
    try { await fn() } catch (e: any) { toast.error(e?.message || 'No se pudo completar la acción') } finally { ocupadoRef.current = false; setOcupado(null) }
  }

  const sugerir = () => correr('sugerencia', async () => {
    const id = convId
    const r = await conversacionesApi.sugerencia(id)
    if (actual.current !== id) return
    onSugerencia(r.texto)
    toast.success(r.fuente === 'ia' ? 'Sugerencia lista en la caja de mensaje. Revísala y envíala.' : 'Sugerencia de plantilla en la caja de mensaje. Revísala antes de enviar.')
  })
  const resumir = () => correr('resumen', async () => {
    const id = convId
    const r = await conversacionesApi.resumen(id)
    if (actual.current === id) setResumen(r.texto)
  })
  const cambiarEtapa = (etapa: Etapa) => correr(`etapa-${etapa}`, async () => {
    await conversacionesApi.cambiarEtapa(convId, etapa)
    setSolicitud((s) => (s ? { ...s, etapa } : s))
    toast.success(`Solicitud marcada como ${ETAPAS.find((e) => e.valor === etapa)?.label.toLowerCase()}`)
  })

  const borrador = (cotizaciones ?? []).find((c) => c.estado === 'borrador' && !c.orden) ?? null
  // Un clic agrega al borrador vigente con la cantidad elegida; no se crea una cotización por pieza.
  const cotizarPieza = () => pieza && correr('cotizar', async () => {
    const piezaId = String(pieza.product_id)
    if (borrador) {
      const items = borrador.items.map((i) => ({ pieza_id: String(i.pieza_id), cantidad: i.cantidad, ...(i.precio_lista_dop != null && i.precio_lista_dop !== i.precio_dop ? { precio_dop: i.precio_dop } : {}) }))
      const existente = items.find((i) => i.pieza_id === piezaId)
      if (existente) existente.cantidad += cantidad
      else items.push({ pieza_id: piezaId, cantidad })
      const c = await cotizacionesApi.nuevaVersion(borrador.codigo, items, borrador.vehiculo)
      toast.success(`Agregada a ${c.codigo}`)
    } else {
      const c = await cotizacionesApi.crear({
        items: [{ pieza_id: piezaId, cantidad }],
        conversation_id: convId,
        vehiculo_id: vehiculo?.id ?? conversation.vehiculo_id ?? null,
        vehiculo: vehiculo ? vehiculoCorto(vehiculo) : null,
      })
      toast.success(`Cotización ${c.codigo} creada en borrador`)
    }
    setCantidad(1)
    cargar()
  })
  const enviar = (c: Cotizacion) => correr(`enviar-${c.codigo}`, async () => {
    const r = await cotizacionesApi.enviarWhatsApp(c.codigo)
    if (r.enviada) toast.success(`${c.codigo} enviada por WhatsApp`)
    else toast.error(r.error || 'WhatsApp no entregó la cotización')
    cargar(); onCambio()
  })
  const validar = (c: Cotizacion) => correr(`validar-${c.codigo}`, async () => {
    const r = await cotizacionesApi.validar(c.codigo)
    if (r.mensaje && !r.mensaje.enviada) toast.error(`Validada, pero el aviso no llegó: ${r.mensaje.error || 'error de WhatsApp'}`)
    else toast.success(`${c.codigo} validada. El cliente recibió el aviso.`)
    cargar(); onCambio()
  })

  const { perfil } = usePerfil(`/perfil/conversacion/${convId}`, recarga)
  const pipeline = usePipeline(null, convId, recarga)
  const clienteId = perfil?.cliente.id
  const [archivos, setArchivos] = useState<ArchivoCliente[] | null>(null)
  useEffect(() => {
    if (!clienteId) return
    let vigente = true
    perfilApi.archivos(clienteId).then((a) => { if (vigente) setArchivos(a) }).catch(() => {})
    return () => { vigente = false }
  }, [clienteId, recarga])
  const etapa = (solicitud?.etapa ?? conversation.etapa ?? 'recibida') as Etapa
  const paso = ETAPAS.findIndex((e) => e.valor === etapa)
  const brief = briefDe(conversation)
  const delPerfil = vehiculo ? perfil?.vehiculos.find((v) => v.id === vehiculo.id) : null
  const vehiculoVisto: VehiculoCaso | null = vehiculo && delPerfil
    ? { ...vehiculo, ...Object.fromEntries(Object.entries(delPerfil).filter(([, x]) => x != null)) }
    : vehiculo
  const nombre = perfil?.cliente.nombre ?? brief?.nombre ?? conversation.customer_name ?? null
  const existencias = ficha?.existencia?.length
    ? ficha.existencia.map((e) => ({ sucursal: e.sucursal, disponible: e.disponible ?? e.cantidad ?? 0 }))
    : ficha?.existencias ?? pieza?.existencias
  const piezaDemo = !!pieza && (esPiezaDemo({ ...pieza, sku: ficha?.sku ?? pieza.sku }) || !!ficha?.existencia?.some((e) => /^demo/i.test(e.ubicacion ?? '')))
  const calidad = ficha?.calidad ?? pieza?.calidad

  return (
    <div ref={contenedor} className="-mr-6 -mt-3 flex-1 overflow-y-auto pr-4 text-sm">
      {brief && (
        <div className="pt-3">
          <TarjetaBrief brief={brief} />
        </div>
      )}

      <Seccion titulo="Detalle del cliente" accion={perfil ? (
        <Link href={`/admin/customers/${perfil.cliente.id}`} className="text-xs text-primary hover:underline">Ver perfil</Link>
      ) : undefined}>
        {perfil ? <PerfilCliente perfil={perfil} compacto /> : (
          <p className="text-xs text-muted-foreground">El perfil se arma solo cuando el cliente pregunta por una pieza o un vehículo.</p>
        )}
      </Seccion>

      <Seccion titulo="Vehículo" accion={
        <button type="button" onClick={() => setCorrigiendo(true)}
          className="inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <PenLine className="h-3 w-3" aria-hidden /> {vehiculo ? 'Corregir vehículo' : 'Registrar vehículo'}
        </button>
      }>
        {vehiculoVisto ? (
          <div className="space-y-1">
            <FotoVehiculo vehiculo={vehiculoVisto} propia={fotoDelCliente(archivos, vehiculoVisto.id)} className="mb-2 aspect-[16/9] w-full rounded-md" />
            <Link href={`/admin/vehiculos/${vehiculoVisto.id}`} className="font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
              {vehiculoCorto(vehiculoVisto) || 'Vehículo sin marca'}
            </Link>
            <DatosDelVehiculo vehiculo={vehiculoVisto} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin vehículo identificado. Sin vehículo no se ofrecen piezas.</p>
        )}
      </Seccion>
      <DialogoCorregirVehiculo
        abierto={corrigiendo}
        onAbierto={setCorrigiendo}
        vehiculo={vehiculoVisto}
        conversationId={convId}
        onGuardado={(v, anterior) => {
          setVehiculo(v)
          const antes = anterior ? `${vehiculoCorto(anterior)}${anterior.motor ? ` ${anterior.motor}` : ''}` : null
          const despues = `${vehiculoCorto(v)}${v.motor ? ` ${v.motor}` : ''}`
          if (antes && antes !== despues) setVehiculoAnterior(antes)
          toast.success('Vehículo corregido. La IA usa este vehículo desde ahora.')
          cargar(); onCambio()
        }}
      />

      <Seccion titulo="Pieza seleccionada" abierta={!!pieza}>
        {pieza ? (
          <div className="space-y-2">
            <div className="flex gap-2.5">
              <PiezaFoto pieza={{ ...pieza, sku: ficha?.sku ?? pieza.sku, demo: piezaDemo }} className="h-20 w-20" />
              <div className="min-w-0">
                <p className="break-words text-[13px] font-medium leading-tight">{nombrePieza(pieza.nombre)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[skuParaVendedor(ficha?.sku ?? pieza.sku, pieza.mpn || pieza.nombre), pieza.mpn && `Ref. ${pieza.mpn}`, calidad && calidadTexto(calidad)].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 font-semibold tabular-nums">{formatCurrency(ficha?.precio_dop ?? pieza.precio_dop)}</p>
                <Existencia disponible={ficha?.disponible ?? pieza.disponible} existencias={existencias} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-8 shrink-0 items-center rounded-control border">
                <button type="button" className="px-2 py-1 hover:bg-secondary disabled:opacity-40" onClick={() => setCantidad((n) => Math.max(1, n - 1))} disabled={cantidad <= 1} aria-label="Una unidad menos">
                  <Minus className="h-3 w-3" aria-hidden />
                </button>
                <span className="w-7 text-center text-xs tabular-nums" aria-label="Cantidad">{cantidad}</span>
                <button type="button" className="px-2 py-1 hover:bg-secondary" onClick={() => setCantidad((n) => Math.min(99, n + 1))} aria-label="Una unidad más">
                  <Plus className="h-3 w-3" aria-hidden />
                </button>
              </span>
              <Button size="sm" variant="outline" className="h-8 min-w-0 flex-1 gap-1.5" onClick={cotizarPieza} disabled={!!ocupado}>
                {ocupado === 'cotizar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FilePlus2 className="h-3.5 w-3.5" aria-hidden />}
                <span className="truncate">{borrador ? `Agregar a ${borrador.codigo}` : 'Cotizar esta pieza'}</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Toca una pieza en la conversación para verla aquí y cotizarla.</p>
        )}
      </Seccion>

      <Seccion titulo="Cotizaciones">
        {!cotizaciones ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Cargando…</p>
        ) : cotizaciones.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin cotizaciones todavía.</p>
        ) : (
          <ul className="space-y-3">
            {cotizaciones.map((c) => (
              <CotizacionCaso
                key={c.codigo}
                cotizacion={c}
                vehiculo={vehiculoVisto}
                vehiculoAnterior={vehiculoAnterior}
                nombreCliente={nombre}
                pieza={pieza}
                ocupado={ocupado}
                onEnviar={() => enviar(c)}
                onValidar={() => validar(c)}
                onCambio={() => { cargar(); onCambio() }}
              />
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Solicitud" abierta={false} accion={solicitud?.codigo_solicitud || conversation.codigo_solicitud ? (
        <span className="font-mono text-[11px] text-muted-foreground">{solicitud?.codigo_solicitud || conversation.codigo_solicitud}</span>
      ) : null}>
        <ol className="flex items-start" aria-label="Etapa de la solicitud">
          {ETAPAS.map((e, i) => {
            const hecho = i <= paso
            return (
              <li key={e.valor} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <span className={cn('h-0.5 flex-1', i === 0 ? 'invisible' : i <= paso ? 'bg-primary' : 'bg-border')} />
                  <button type="button" onClick={() => e.valor !== etapa && cambiarEtapa(e.valor)} disabled={!!ocupado}
                    title={e.valor === etapa ? `Etapa actual: ${e.label}` : `Corregir a ${e.label}`} aria-current={e.valor === etapa ? 'step' : undefined}
                    className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      hecho ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50')}>
                    {ocupado === `etapa-${e.valor}` ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : i + 1}
                  </button>
                  <span className={cn('h-0.5 flex-1', i === ETAPAS.length - 1 ? 'invisible' : i < paso ? 'bg-primary' : 'bg-border')} />
                </div>
              </li>
            )
          })}
        </ol>
        <p className="mt-1.5 text-xs">
          <span className="font-medium">{ETAPAS[paso]?.label ?? etapa}</span>
          <span className="text-muted-foreground"> · paso {paso + 1} de {ETAPAS.length}</span>
        </p>
        {solicitud?.cita && (
          <p className="mt-2 flex items-center gap-1.5 text-xs">
            <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden />
            {solicitud.cita.tipo === 'visita' ? 'Visita a la tienda' : 'Llamada'} · {inicioCita(solicitud.cita.inicio)}
          </p>
        )}
      </Seccion>

      <Seccion titulo="Recorrido del cliente" abierta={false}>
        <PipelineCliente datos={pipeline.datos} error={pipeline.error} compacto />
      </Seccion>


      <Seccion titulo="Copiloto" abierta={false}>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-8 min-w-[9rem] flex-1 gap-1.5" onClick={sugerir} disabled={!!ocupado}
            title="La IA redacta una respuesta y la pone en la caja de mensaje para que la revises">
            {ocupado === 'sugerencia' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            Sugerir respuesta
          </Button>
          <Button size="sm" variant="outline" className="h-8 min-w-[6rem] flex-1 gap-1.5" onClick={resumir} disabled={!!ocupado}>
            {ocupado === 'resumen' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ListChecks className="h-3.5 w-3.5" aria-hidden />}
            Resumen
          </Button>
        </div>
        {resumen && <p className="mt-2 whitespace-pre-line rounded-md bg-secondary px-2.5 py-2 text-[13px] leading-snug">{resumen}</p>}
      </Seccion>
    </div>
  )
}
