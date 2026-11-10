'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiClient } from '@/lib/api-client'
import type { ActividadIA } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { useVertical } from '@/lib/vertical'

const duracion = (seg: number | null) => (seg == null ? '—' : seg < 60 ? `${seg} s` : `${Math.floor(seg / 60)} min${seg % 60 ? ` ${seg % 60} s` : ''}`)
const hace = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: es })

const ESTADO: Record<string, string> = {
  ia: 'IA atendiendo',
  esperando_vendedor: 'Esperando vendedor',
  vendedor: 'Con vendedor',
  cerrada: 'Cerrada',
}
const ESTADO_RESTAURANTE: Record<string, string> = { ia: 'IA atendiendo', esperando_vendedor: 'Espera al equipo', vendedor: 'Con el equipo', cerrada: 'Cerrada' }

function Tile({ label, valor, detalle }: { label: string; valor: string; detalle: string }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{detalle}</p>
    </CardContent></Card>
  )
}

export function Actividad() {
  const [dias, setDias] = useState(30)
  const [a, setA] = useState<ActividadIA | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const r = useVertical() === 'restaurante'
  const estados = r ? ESTADO_RESTAURANTE : ESTADO

  useEffect(() => {
    setA(null)
    apiClient
      .get<ActividadIA>('/ia/actividad', { desde: new Date(Date.now() - dias * 86_400_000).toISOString() })
      .then((r) => { setA(r); setError(false) })
      .catch(() => setError(true))
  }, [dias, intento])

  if (error) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="font-medium">No se pudo cargar la actividad de la IA</p>
        <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Periodo" className="inline-flex gap-0.5 rounded-control bg-secondary p-0.5">
        {[7, 30, 90].map((d) => (
          <button key={d} type="button" role="radio" aria-checked={dias === d} onClick={() => setDias(d)}
            className={cn('h-8 rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              dias === d ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            Últimos {d} días
          </button>
        ))}
      </div>

      {!a ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile label="Conversaciones atendidas" valor={String(a.resumen.conversaciones)} detalle="la IA respondió al menos una vez" />
            <Tile label="Sin intervención humana" valor={String(a.resumen.sin_humano)} detalle={r ? 'nadie del equipo tuvo que entrar' : 'ningún vendedor tuvo que entrar'} />
            <Tile label={r ? 'Pasadas al equipo' : 'Pasadas a un vendedor'} valor={String(a.resumen.pasadas_a_vendedor)} detalle="ver detalle abajo" />
            <Tile label="Primera respuesta" valor={duracion(a.resumen.primera_respuesta_mediana_seg)} detalle="mediana" />
            <Tile label={r ? 'Reservas creadas' : 'Cotizaciones armadas'} valor={String(a.resumen.cotizaciones_armadas)} detalle={r ? 'con la disponibilidad real de las mesas' : 'con precios del catálogo'} />
            <Tile label={r ? 'Fuera de las reglas' : 'Piezas sin existencia'} valor={String(a.resumen.sin_existencia)} detalle={r ? 'grupos grandes, horarios o precios sin aprobar' : 'avisadas al equipo'} />
          </div>

          <p className="flex items-start gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <span>
              La IA hizo <strong className="font-semibold">{a.resumen.consultas_herramientas} consultas</strong> {r ? 'a la agenda y la carta y' : 'al catálogo y'}{' '}
              <strong className="font-semibold">{a.resumen.escrituras} escrituras</strong>{r ? ': las reservas pasan por las reglas del restaurante y los precios salen de la carta.' : ': solo lee, con filtros y límite, y los precios salen de la base.'}
            </span>
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="p-4">
              <h2 className="font-display text-base font-semibold">{r ? 'Pasadas al equipo' : 'Pasadas a un vendedor'}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Cuándo y por qué la conversación salió de la IA.</p>
              {a.pasadas.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Ninguna en este periodo.</p>
              ) : (
                <ul className="-mx-4 mt-3 divide-y border-y">
                  {a.pasadas.map((p) => (
                    <li key={p.conversacion_id}>
                      <Link href={`/admin/chat?conversation=${p.conversacion_id}`}
                        className="flex items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.cliente}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.motivo}{p.a ? ` · ${p.a}` : ''}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted-foreground">
                          <span className="block">{estados[p.estado_atencion] ?? p.estado_atencion}</span>
                          {p.fecha && <span className="block">{hace(p.fecha)}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <h2 className="font-display text-base font-semibold">Consultas de la IA</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{r ? 'Cada herramienta que usó para responder, con su resultado.' : 'Cada llamada que hizo para responder. Todas son de lectura.'}</p>
              {a.herramientas.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Sin consultas en este periodo.</p>
              ) : (
                <ul className="-mx-4 mt-3 max-h-[28rem] divide-y overflow-y-auto border-y">
                  {a.herramientas.map((h, i) => (
                    <li key={`${h.fecha}-${i}`} className="space-y-1 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium">{h.herramienta.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted-foreground">· {h.cliente}</span>
                        {h.resultados != null && (
                          <span className={cn('ml-auto rounded px-1.5 text-[11px] font-medium leading-5', h.resultados ? 'bg-secondary' : 'bg-warning-soft text-warning')}>
                            {h.resultados} {h.resultados === 1 ? 'resultado' : 'resultados'}
                          </span>
                        )}
                      </div>
                      {r ? (
                        <p className="text-xs text-muted-foreground">{h.ruta}</p>
                      ) : (
                        <code className="block overflow-x-auto whitespace-nowrap rounded bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground">
                          {h.metodo} {h.ruta}?{Object.entries(h.parametros).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${v}`).join('&')}
                        </code>
                      )}
                      <p className="text-[11px] text-muted-foreground">{hace(h.fecha)}{h.ms != null && ` · ${h.ms} ms`}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card>
          </div>
        </>
      )}
    </div>
  )
}
