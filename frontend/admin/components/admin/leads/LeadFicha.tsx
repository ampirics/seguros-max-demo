'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { EstadoCotizacion } from '@/components/admin/cotizaciones/EstadoCotizacion'
import { ESTADO_CITA, TIPO_CITA, horaCita } from '@/components/admin/agenda/CitaFicha'
import { PiezaEnContexto } from '@/components/admin/crm/PiezaEnContexto'
import { apiClient } from '@/lib/api-client'
import type { EtapaLead, Lead, MotivoPerdida } from '@/lib/api-types'
import { aLead } from '@/lib/api/leads'
import { cn, formatCurrency } from '@/lib/utils'

export const ETAPAS: { clave: EtapaLead; label: string }[] = [
  { clave: 'nueva', label: 'Nuevo' },
  { clave: 'en_atencion', label: 'En atención' },
  { clave: 'pendiente_datos', label: 'Pendiente de datos' },
  { clave: 'cotizada', label: 'Cotizado' },
  { clave: 'ganada', label: 'Ganado' },
  { clave: 'perdida', label: 'Perdido' },
]
export const ETAPA_LABEL = Object.fromEntries(ETAPAS.map((e) => [e.clave, e.label])) as Record<EtapaLead, string>

export const MOTIVOS: Record<MotivoPerdida, string> = {
  precio: 'Precio',
  sin_existencia: 'Sin existencia',
  tiempo_entrega: 'Tiempo de entrega',
  compro_en_otro_lado: 'Compró en otro lado',
  no_responde: 'No respondió',
  otro: 'Otro',
}

export const ORIGEN: Record<Lead['origen'], string> = {
  whatsapp: 'WhatsApp',
  llamada: 'Llamada',
  mostrador: 'Mostrador',
  tienda_web: 'Tienda web',
  panel: 'Panel',
}

const ABIERTAS: EtapaLead[] = ['nueva', 'en_atencion', 'pendiente_datos']

// Tiempo para la primera respuesta; solo cuenta mientras nadie la ha trabajado a fondo.
export function sla(lead: Lead, ahora: number) {
  if (!ABIERTAS.includes(lead.etapa) || !lead.sla_vence) return null
  const min = Math.round((new Date(lead.sla_vence).getTime() - ahora) / 60000)
  const texto = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)
  return min < 0
    ? { vencido: true, texto: `SLA vencido hace ${texto(-min)}` }
    : { vencido: false, texto: `Responder en ${texto(min)}` }
}

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  )
}

const enlace = 'font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none'

export function LeadFicha({
  lead,
  usuario,
  onCerrar,
  onCambio,
}: {
  lead: Lead | null
  usuario: string
  onCerrar: () => void
  onCambio: (lead: Lead) => void
}) {
  const [perdiendo, setPerdiendo] = useState(false)
  const [motivo, setMotivo] = useState<MotivoPerdida | ''>('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (cambio: Record<string, unknown>, aviso: string) => {
    if (!lead) return
    setGuardando(true)
    try {
      const actualizado = await apiClient.request<Lead>(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(cambio) })
      onCambio(aLead(actualizado))
      toast.success(aviso)
      setPerdiendo(false)
      setMotivo('')
      setNota('')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const tomar = async () => {
    if (!lead) return
    setGuardando(true)
    try {
      await apiClient.post(`/chat/conversations/${lead.conversacion_id ?? lead.id}/tomar`)
      onCambio(aLead(await apiClient.get<Lead>(`/leads/${lead.id}`)))
      toast.success('Ahora atiendes esta conversación')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo tomar el lead. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const s = lead ? sla(lead, Date.now()) : null

  return (
    <Sheet open={!!lead} onOpenChange={(abierta) => { if (!abierta) { setPerdiendo(false); onCerrar() } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {lead && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>{lead.cliente}</SheetTitle>
              <SheetDescription>{lead.interes ?? 'Sin mensaje del cliente todavía'}</SheetDescription>
            </SheetHeader>

            {s && (
              <p className={cn('mt-3 rounded-md px-3 py-2 text-sm font-medium', s.vencido ? 'bg-destructive-soft text-destructive' : 'bg-warning-soft text-warning')}>
                {s.texto}
              </p>
            )}

            <dl className="mt-4 divide-y">
              <Fila label="Etapa">{ETAPA_LABEL[lead.etapa]}</Fila>
              {lead.motivo_perdida && <Fila label="Motivo">{MOTIVOS[lead.motivo_perdida]}</Fila>}
              {lead.nota_perdida && <Fila label="Nota">{lead.nota_perdida}</Fila>}
              <Fila label="Origen">{ORIGEN[lead.origen] ?? lead.origen}</Fila>
              <Fila label="Responsable">{lead.responsable}</Fila>
              <Fila label="Vendedor de cierre">{lead.vendedor_cierre ?? '—'}</Fila>
              <Fila label="Monto">{lead.monto_dop != null ? formatCurrency(lead.monto_dop) : '—'}</Fila>
              <Fila label="Teléfono">{lead.telefono ?? '—'}</Fila>
              {lead.vehiculo && (
                <Fila label="Vehículo">
                  <Link href={`/admin/vehiculos/${lead.vehiculo.id}`} className={enlace}>{[lead.vehiculo.marca, lead.vehiculo.modelo, lead.vehiculo.anio].filter(Boolean).join(' ')}</Link>
                </Fila>
              )}
              <Fila label="Creada">{new Date(lead.creado).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Fila>
            </dl>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {lead.conversacion_id && <Link href={`/admin/chat?conversation=${lead.conversacion_id}`} className={enlace}>Ver conversación</Link>}
              {lead.cotizacion_codigo && (
                <span className="inline-flex items-center gap-1.5">
                  <Link href={`/admin/cotizaciones/${lead.cotizacion_codigo}`} className={enlace}>{lead.cotizacion_codigo}</Link>
                  {lead.cotizacion_estado && <EstadoCotizacion estado={lead.cotizacion_estado} />}
                </span>
              )}
              {lead.orden_id && <Link href={`/admin/orders?orden=${lead.orden_id}`} className={enlace}>Orden {lead.orden_numero}</Link>}
            </div>

            {(lead.citas ?? []).length > 0 && (
              <section className="mt-4">
                <h3 className="mb-1.5 text-sm font-semibold">Citas</h3>
                <ul className="divide-y rounded-md border">
                  {(lead.citas ?? []).map((c) => {
                    const Icon = TIPO_CITA[c.tipo].icon
                    return (
                      <li key={c.id}>
                        <Link href="/admin/calendario" className="flex items-center gap-2.5 px-3 py-2 text-sm outline-none hover:bg-secondary/60 focus-visible:bg-secondary">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block first-letter:uppercase">{new Date(c.inicio).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })}, {horaCita(c.inicio)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{TIPO_CITA[c.tipo].label}{c.vendedor ? ` con ${c.vendedor}` : ''}</span>
                          </span>
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', ESTADO_CITA[c.estado]?.clase)}>{ESTADO_CITA[c.estado]?.label ?? c.estado}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {!['ganada', 'perdida'].includes(lead.etapa) && (
              <div className="mt-5 border-t pt-4">
                <PiezaEnContexto
                  key={lead.id}
                  contexto={{ leadId: lead.id, clienteId: lead.cliente_id, conversacionId: lead.conversacion_id, vehiculo: lead.vehiculo, cotizacionCodigo: lead.cotizacion_codigo }}
                  onCambio={async () => onCambio(aLead(await apiClient.get<Lead>(`/leads/${lead.id}`)))}
                />
              </div>
            )}

            <div className="mt-6 space-y-3 border-t pt-4">
              {lead.responsable !== usuario && !['ganada', 'perdida'].includes(lead.etapa) && (
                <Button variant="outline" className="w-full" disabled={guardando} onClick={tomar}>
                  Tomar lead
                </Button>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="etapa-lead">Mover a</Label>
                <Select value={lead.etapa === 'perdida' ? undefined : lead.etapa} disabled={guardando}
                  onValueChange={(v) => guardar({ etapa: v }, `Movido a ${ETAPA_LABEL[v as EtapaLead]}`)}>
                  <SelectTrigger id="etapa-lead"><SelectValue placeholder="Elige una etapa" /></SelectTrigger>
                  <SelectContent>
                    {ETAPAS.filter((e) => e.clave !== 'perdida').map((e) => <SelectItem key={e.clave} value={e.clave}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {lead.etapa !== 'perdida' && !perdiendo && (
                <Button variant="ghost" className="w-full text-destructive hover:bg-destructive-soft hover:text-destructive" onClick={() => setPerdiendo(true)}>
                  Marcar como perdido
                </Button>
              )}

              {perdiendo && (
                <form
                  className="space-y-3 rounded-md border border-destructive/30 p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (motivo) guardar({ etapa: 'perdida', motivo_perdida: motivo, nota_perdida: nota.trim() || null }, 'Lead marcado como perdido')
                  }}
                >
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">¿Por qué se perdió? <span className="text-destructive">*</span></legend>
                    <RadioGroup value={motivo} onValueChange={(v) => setMotivo(v as MotivoPerdida)} className="grid grid-cols-2 gap-2">
                      {Object.entries(MOTIVOS).map(([clave, label]) => (
                        <Label key={clave} htmlFor={`motivo-${clave}`} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-normal has-[:checked]:border-destructive">
                          <RadioGroupItem id={`motivo-${clave}`} value={clave} /> {label}
                        </Label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                  <div className="space-y-1.5">
                    <Label htmlFor="nota-perdida">Nota (opcional)</Label>
                    <Textarea id="nota-perdida" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Ej.: consiguió unos alternos más baratos" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPerdiendo(false)} disabled={guardando}>Cancelar</Button>
                    <Button type="submit" variant="destructive" className="flex-1 gap-2" disabled={!motivo || guardando}>
                      {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Marcar perdido
                    </Button>
                  </div>
                  {!motivo && <p className="text-xs text-muted-foreground">Elige un motivo para poder marcarlo perdido.</p>}
                </form>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
