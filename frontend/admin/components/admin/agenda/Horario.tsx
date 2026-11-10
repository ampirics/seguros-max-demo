'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api-client'
import type { TurnoAgenda, VendedorAgenda } from '@/lib/api-types'

const DIAS: { dia: TurnoAgenda['dia']; nombre: string }[] = [
  { dia: 1, nombre: 'Lunes' }, { dia: 2, nombre: 'Martes' }, { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' }, { dia: 5, nombre: 'Viernes' }, { dia: 6, nombre: 'Sábado' },
]

type Fila = { activo: boolean; desde: string; hasta: string }

export function Horario({
  abierta,
  vendedores,
  vendedorInicial,
  onCerrar,
  onGuardado,
}: {
  abierta: boolean
  vendedores: VendedorAgenda[]
  vendedorInicial: string | null
  onCerrar: () => void
  onGuardado: (v: VendedorAgenda) => void
}) {
  const [vendedorId, setVendedorId] = useState('')
  const [filas, setFilas] = useState<Record<number, Fila>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (abierta) setVendedorId(vendedorInicial ?? vendedores[0]?.id ?? '')
  }, [abierta])

  useEffect(() => {
    const v = vendedores.find((x) => x.id === vendedorId)
    if (!v) return
    setError(null)
    setFilas(Object.fromEntries(DIAS.map(({ dia }) => {
      const t = v.horario.find((x) => x.dia === dia)
      return [dia, t ? { activo: true, desde: t.desde, hasta: t.hasta } : { activo: false, desde: '08:00', hasta: '17:00' }]
    })))
  }, [vendedorId, vendedores])

  const cambiar = (dia: number, cambio: Partial<Fila>) => setFilas((f) => ({ ...f, [dia]: { ...f[dia], ...cambio } }))

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const horario = DIAS.filter(({ dia }) => filas[dia]?.activo).map(({ dia }) => ({ dia, desde: filas[dia].desde, hasta: filas[dia].hasta }))
    if (horario.some((t) => t.desde >= t.hasta)) return setError('Cada día tiene que abrir antes de cerrar.')
    setGuardando(true)
    setError(null)
    try {
      const v = await apiClient.put<VendedorAgenda>(`/agenda/vendedores/${vendedorId}/horario`, { horario })
      toast.success(`Horario de ${v.nombre} guardado`)
      onGuardado(v)
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el horario.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierta} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disponibilidad</DialogTitle>
          <DialogDescription>Las citas solo se pueden agendar dentro de este horario, en bloques de 30 minutos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="horario-vendedor">Vendedor</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger id="horario-vendedor"><SelectValue /></SelectTrigger>
              <SelectContent>{vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <ul className="divide-y rounded-md border">
            {DIAS.map(({ dia, nombre }) => {
              const f = filas[dia]
              if (!f) return null
              return (
                <li key={dia} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <Label htmlFor={`dia-${dia}`} className="flex w-28 cursor-pointer items-center gap-2 font-normal">
                    <Checkbox id={`dia-${dia}`} checked={f.activo} onCheckedChange={(v) => cambiar(dia, { activo: v === true })} /> {nombre}
                  </Label>
                  {f.activo ? (
                    <span className="flex items-center gap-1.5 text-sm">
                      <Input type="time" step={1800} min="07:00" max="19:00" value={f.desde} onChange={(e) => cambiar(dia, { desde: e.target.value })} className="h-8 w-[6.5rem]" aria-label={`${nombre}: desde`} />
                      a
                      <Input type="time" step={1800} min="07:00" max="19:00" value={f.hasta} onChange={(e) => cambiar(dia, { hasta: e.target.value })} className="h-8 w-[6.5rem]" aria-label={`${nombre}: hasta`} />
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">No trabaja</span>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Domingo cerrado. Las citas ya agendadas no se mueven al cambiar el horario.</p>
          {error && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
            <Button type="submit" disabled={guardando} className="gap-2">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar horario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
