'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export type Periodo = 'todo' | 'hoy' | 'semana' | 'mes' | 'rango'

export interface FiltroFecha {
  periodo: Periodo
  desde: string
  hasta: string
  ocultarCerradas: boolean
}

export const FILTRO_INICIAL: FiltroFecha = { periodo: 'todo', desde: '', hasta: '', ocultarCerradas: true }

const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: 'todo', texto: 'Todo' },
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'semana', texto: 'Esta semana' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'rango', texto: 'Rango' },
]

const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function rangoDe(f: FiltroFecha, hoy = new Date()): { desde?: string; hasta?: string } {
  if (f.periodo === 'hoy') return { desde: dia(hoy), hasta: dia(hoy) }
  if (f.periodo === 'semana') {
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    return { desde: dia(lunes), hasta: dia(hoy) }
  }
  if (f.periodo === 'mes') return { desde: dia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: dia(hoy) }
  if (f.periodo === 'rango') return { desde: f.desde || undefined, hasta: f.hasta || undefined }
  return {}
}

export function FiltroPeriodo({ value, onChange, cerradasTexto = 'Ocultar cerradas' }: {
  value: FiltroFecha
  onChange: (f: FiltroFecha) => void
  cerradasTexto?: string
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Periodo">
        {PERIODOS.map((p) => (
          <button key={p.valor} type="button" aria-pressed={value.periodo === p.valor} onClick={() => onChange({ ...value, periodo: p.valor })}
            className={cn('h-8 shrink-0 rounded-control px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value.periodo === p.valor ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}>
            {p.texto}
          </button>
        ))}
      </div>
      {value.periodo === 'rango' && (
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="Desde" value={value.desde} max={value.hasta || undefined} className="h-8 w-auto bg-card text-xs"
            onChange={(e) => onChange({ ...value, desde: e.target.value })} />
          <span className="text-xs text-muted-foreground">a</span>
          <Input type="date" aria-label="Hasta" value={value.hasta} min={value.desde || undefined} className="h-8 w-auto bg-card text-xs"
            onChange={(e) => onChange({ ...value, hasta: e.target.value })} />
        </div>
      )}
      <div className="flex items-center gap-2 sm:ml-auto">
        <Switch id="ocultar-cerradas" checked={value.ocultarCerradas} onCheckedChange={(ocultarCerradas) => onChange({ ...value, ocultarCerradas })} />
        <Label htmlFor="ocultar-cerradas" className="text-sm">{cerradasTexto}</Label>
      </div>
    </div>
  )
}
