'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { fechaHora } from '@/components/admin/inventario/ExistenciasPieza'
import { inventarioApi, type EstadoSap, type ResultadoSap } from '@/lib/api/inventario'

export function SapExistencias({ abierto, onClose, onAplicado }: { abierto: boolean; onClose: () => void; onAplicado: () => void }) {
  const [estado, setEstado] = useState<EstadoSap | null>(null)
  const [almacenes, setAlmacenes] = useState<Record<string, string>>({})
  const [intervalo, setIntervalo] = useState('60')
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState<ResultadoSap | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [error, setError] = useState(false)

  const cargar = (e: EstadoSap) => {
    setEstado(e)
    setAlmacenes(Object.fromEntries(e.almacenes.map((a) => [a.sucursal_id, a.almacen_sap ?? ''])))
    setIntervalo(String(e.intervalo_minutos))
  }

  useEffect(() => {
    if (!abierto) return
    setEstado(null); setVista(null); setError(false)
    inventarioApi.sap().then(cargar).catch(() => setError(true))
  }, [abierto])

  const guardar = async (activo?: boolean) => {
    setGuardando(true)
    try {
      cargar(await inventarioApi.configurarSap({ almacenes, intervalo_minutos: Number(intervalo) || 60, ...(activo === undefined ? {} : { activo }) }))
      toast.success(activo === undefined ? 'Configuración guardada' : activo ? 'Sincronización activada' : 'Sincronización desactivada')
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const sincronizar = async (aplicar: boolean) => {
    setRevisando(true)
    try {
      const r = await inventarioApi.sincronizarSap(aplicar)
      setVista(r)
      if (aplicar) { toast.success(`${r.cambios.length} existencias actualizadas desde SAP`); onAplicado() }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo leer SAP.')
    } finally {
      setRevisando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Existencias desde SAP</DialogTitle>
          <DialogDescription>
            Solo lectura: lee la existencia de cada almacén en SAP y la deja en la sucursal que tiene ese almacén. Nunca escribe en SAP.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-muted-foreground">No se pudo cargar la configuración.</p>
        ) : !estado ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando…</p>
        ) : (
          <div className="space-y-4">
            <div className={estado.conexion ? 'rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground' : 'rounded-md bg-warning-soft px-3 py-2 text-sm text-warning'} role="status">
              {estado.conexion ? 'Conexión con SAP configurada.' : estado.mensaje ?? 'Sin conexión configurada.'}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Almacén SAP de cada sucursal</p>
              {estado.almacenes.map((a) => (
                <div key={a.sucursal_id} className="flex items-center gap-3">
                  <Label htmlFor={`alm-${a.sucursal_id}`} className="min-w-0 flex-1 truncate text-sm font-normal">{a.sucursal}{!a.activa && ' (inactiva)'}</Label>
                  <Input id={`alm-${a.sucursal_id}`} className="w-28" maxLength={40} placeholder="Ej.: 01" value={almacenes[a.sucursal_id] ?? ''}
                    onChange={(e) => setAlmacenes({ ...almacenes, [a.sucursal_id]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sap-intervalo">Cada (minutos)</Label>
                <Input id="sap-intervalo" type="number" min={5} max={1440} className="w-28" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch id="sap-activo" checked={estado.activo} disabled={guardando} onCheckedChange={(v) => guardar(v)} />
                <Label htmlFor="sap-activo" className="text-sm">Sincronizar automáticamente</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {estado.activo ? `Próxima lectura: ${fechaHora(estado.proxima)}.` : 'Desactivada.'}
              {estado.ultima_ejecucion && ` Última: ${fechaHora(estado.ultima_ejecucion)} (${estado.ultimo_estado ?? '—'}).`}
              {estado.ultimo_error && ` ${estado.ultimo_error}`}
            </p>
            {vista && (
              <div className="space-y-1 rounded-md border p-3 text-sm" aria-live="polite">
                <p>{vista.items_leidos} artículos leídos · <span className="font-medium">{vista.cambios.length} con cambios</span> · {vista.sin_cambio} iguales</p>
                {vista.almacenes_sin_sucursal.length > 0 && <p className="text-xs text-muted-foreground">Almacenes sin sucursal: {vista.almacenes_sin_sucursal.join(', ')}</p>}
                {vista.skus_no_encontrados.length > 0 && <p className="text-xs text-muted-foreground">Artículos que no están en el catálogo: {vista.skus_no_encontrados.slice(0, 10).join(', ')}</p>}
                {vista.cambios.slice(0, 8).map((c) => (
                  <p key={`${c.pieza_id}-${c.sucursal_id}`} className="truncate text-xs">{c.sku} · {c.sucursal}: {c.actual ?? '—'} → {c.cantidad}</p>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose}>Cerrar</Button>
          {estado && <Button type="button" variant="outline" disabled={guardando} onClick={() => guardar()}>Guardar</Button>}
          {estado?.conexion && (
            <>
              <Button type="button" variant="outline" disabled={revisando} onClick={() => sincronizar(false)}>Vista previa</Button>
              <Button type="button" disabled={revisando || !vista || vista.cambios.length === 0} onClick={() => sincronizar(true)}>
                {revisando && <Loader2 className="animate-spin" aria-hidden />} Aplicar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
