'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inventarioApi, type FilaImportacion, type ResultadoImportacion } from '@/lib/api/inventario'
import { cn } from '@/lib/utils'

const ACCION: Record<FilaImportacion['accion'], string> = {
  nueva: 'Nueva',
  cambio: 'Cambia',
  sin_cambio: 'Igual',
  error: 'Error',
}

export function ImportarExistencias({ abierto, onClose, onAplicado }: { abierto: boolean; onClose: () => void; onAplicado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<ResultadoImportacion | null>(null)
  const [estado, setEstado] = useState<'normal' | 'revisando' | 'aplicando'>('normal')

  useEffect(() => {
    if (abierto) { setArchivo(null); setVista(null); setEstado('normal') }
  }, [abierto])

  const revisar = async (f: File | null) => {
    setArchivo(f)
    setVista(null)
    if (!f) return
    setEstado('revisando')
    try {
      setVista(await inventarioApi.importar(f, false))
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo leer el archivo.')
    } finally {
      setEstado('normal')
    }
  }

  const aplicar = async () => {
    if (!archivo) return
    setEstado('aplicando')
    try {
      const r = await inventarioApi.importar(archivo, true)
      toast.success(`${r.cambios} ${r.cambios === 1 ? 'existencia actualizada' : 'existencias actualizadas'}`)
      onAplicado()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo aplicar el archivo.')
      setEstado('normal')
    }
  }

  const visibles = vista?.filas.filter((f) => f.accion !== 'sin_cambio') ?? []

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar existencias</DialogTitle>
          <DialogDescription>
            Excel (.xlsx) o CSV con las columnas sku, sucursal, cantidad, ubicacion y, si quieres, minimo. La cantidad del
            archivo reemplaza la actual y cada diferencia queda como un ajuste. Una ubicación o un mínimo vacíos dejan lo que
            había. Puedes partir de la exportación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="importar-archivo">Archivo</Label>
          <Input id="importar-archivo" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => revisar(e.target.files?.[0] ?? null)} />
        </div>
        {estado === 'revisando' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Revisando…</p>
        )}
        {vista && (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm">
              {vista.total} filas · <span className="font-medium">{vista.cambios} con cambios</span> · {vista.sin_cambio} iguales
              {vista.errores > 0 && <> · <span className="font-medium text-destructive">{vista.errores} con errores</span></>}
            </p>
            {visibles.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-secondary text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Fila</th>
                      <th className="px-2 py-1.5 font-medium">Pieza</th>
                      <th className="px-2 py-1.5 font-medium">Sucursal</th>
                      <th className="px-2 py-1.5 text-right font-medium">Antes</th>
                      <th className="px-2 py-1.5 text-right font-medium">Después</th>
                      <th className="px-2 py-1.5 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibles.map((f) => (
                      <tr key={f.fila} className={cn(f.accion === 'error' && 'bg-destructive-soft')}>
                        <td className="px-2 py-1.5 tabular-nums">{f.fila}</td>
                        <td className="max-w-[200px] px-2 py-1.5"><span className="block truncate">{f.pieza ?? f.sku ?? '—'}</span>{f.pieza && <span className="text-muted-foreground">{f.sku}</span>}</td>
                        <td className="px-2 py-1.5">{f.sucursal ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{f.actual ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{f.cantidad ?? '—'}</td>
                        <td className="px-2 py-1.5">{f.accion === 'error' ? <span className="text-destructive">{f.errores.join('; ')}</span> : ACCION[f.accion]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={aplicar} disabled={!vista || vista.errores > 0 || vista.cambios === 0 || estado !== 'normal'}>
            {estado === 'aplicando' && <Loader2 className="animate-spin" aria-hidden />}
            {vista && vista.errores > 0 ? 'Corrige los errores para aplicar' : `Aplicar ${vista?.cambios ?? 0} cambios`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
