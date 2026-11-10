'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { casoApi, fuenteTexto, vehiculoCorto, type ModeloCatalogo, type VehiculoCaso, type VehiculoEditable } from './caso'

type DatosVehiculo = Partial<Pick<VehiculoCaso,
  'motor' | 'version' | 'carroceria' | 'traccion' | 'transmision' | 'combustible' | 'vin' | 'chasis' | 'placa'
  | 'fuente_identificacion' | 'verificado' | 'confirmado_por_cliente'>>

// `verificado` sale de la fuente (VIN, chasis, plaquita, pieza vieja o un vendedor), no del "sí" del cliente.
export function SelloVerificado({ vehiculo, className }: { vehiculo: DatosVehiculo; className?: string }) {
  const fuente = fuenteTexto(vehiculo.fuente_identificacion)
  const verificado = !!vehiculo.verificado
  const texto = verificado ? 'Verificado'
    : vehiculo.confirmado_por_cliente ? 'Sin verificar · el cliente lo confirmó'
    : 'Sin verificar'
  const Icono = verificado ? ShieldCheck : ShieldAlert
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1 text-[11px] font-medium', verificado ? 'text-success' : 'text-warning', className)}>
      <Icono className="h-3 w-3 shrink-0" aria-hidden />
      {texto}
      {fuente && <span className="font-normal text-muted-foreground">· fuente: {fuente}</span>}
    </span>
  )
}

export function DatosDelVehiculo({ vehiculo, className }: { vehiculo: DatosVehiculo; className?: string }) {
  const filas = ([
    ['Motor', vehiculo.motor],
    ['Versión', vehiculo.version],
    ['Carrocería', vehiculo.carroceria],
    ['Tracción', vehiculo.traccion],
  ] as [string, string | null | undefined][]).filter(([, valor]) => !!valor?.trim())
  const identificador = vehiculo.vin ? `VIN ${vehiculo.vin}` : vehiculo.chasis ? `Chasis ${vehiculo.chasis}` : null
  return (
    <div className={cn('space-y-1', className)}>
      {filas.length > 0 && (
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-x-3 gap-y-0.5 text-xs">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex min-w-0 gap-1">
              <dt className="shrink-0 text-muted-foreground">{etiqueta}:</dt>
              <dd className="min-w-0 truncate" title={valor ?? undefined}>{valor}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className={cn('font-mono text-[11px] tracking-wide', identificador ? 'text-foreground' : 'text-muted-foreground')}>
        {identificador ?? 'Sin VIN ni chasis'}
        {vehiculo.placa ? <span className="font-sans tracking-normal text-muted-foreground"> · Placa {vehiculo.placa}</span> : null}
      </p>
      <SelloVerificado vehiculo={vehiculo} />
    </div>
  )
}

const vacio = (v: VehiculoCaso | null): Record<keyof VehiculoEditable, string> => ({
  marca: v?.marca ?? '',
  modelo: v?.modelo ?? '',
  anio: v?.anio ? String(v.anio) : '',
  motor: v?.motor ?? '',
  version: v?.version ?? '',
  carroceria: v?.carroceria ?? '',
  traccion: v?.traccion ?? '',
  vin: v?.vin ?? '',
  chasis: v?.chasis ?? '',
})

const ANIO_MAXIMO = new Date().getFullYear() + 1

const nombreMotor = (m: string | { motor?: string | null }) => (typeof m === 'string' ? m : m?.motor ?? '')

// La corrección del vendedor gana sobre todo: queda con fuente_identificacion = vendedor.
export function DialogoCorregirVehiculo({
  abierto,
  onAbierto,
  vehiculo,
  conversationId,
  onGuardado,
}: {
  abierto: boolean
  onAbierto: (abierto: boolean) => void
  vehiculo: VehiculoCaso | null
  conversationId: string
  onGuardado: (v: VehiculoCaso, anterior: VehiculoCaso | null) => void
}) {
  const [campos, setCampos] = useState(() => vacio(vehiculo))
  const [identificador, setIdentificador] = useState('')
  const [modelos, setModelos] = useState<ModeloCatalogo[]>([])
  const [guardando, setGuardando] = useState(false)
  const [intentado, setIntentado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setIntentado(false)
    setCampos(vacio(vehiculo))
    setIdentificador(vehiculo?.vin || vehiculo?.chasis || '')
    if (!modelos.length) casoApi.modelos().then((m) => setModelos(Array.isArray(m) ? m : [])).catch(() => setModelos([]))
  }, [abierto, vehiculo])

  const marcas = useMemo(() => [...new Set(modelos.map((m) => m.marca))], [modelos])
  const delaMarca = modelos.filter((m) => !campos.marca || m.marca.toLowerCase() === campos.marca.toLowerCase())
  const motores = [...new Set(delaMarca
    .filter((m) => !campos.modelo || m.modelo.toLowerCase() === campos.modelo.toLowerCase())
    .flatMap((m) => (m.motores ?? []).map(nombreMotor)).filter(Boolean))]

  const anio = campos.anio ? Number(campos.anio) : null
  const id = identificador.trim().toUpperCase()
  const errores = [
    !campos.marca.trim() && 'Falta la marca',
    !campos.modelo.trim() && 'Falta el modelo',
    anio !== null && (!Number.isInteger(anio) || anio < 1950 || anio > ANIO_MAXIMO) && `El año va de 1950 a ${ANIO_MAXIMO}`,
    id.length === 17 && /[IOQ]/.test(id) && 'Un VIN no lleva las letras I, O ni Q',
  ].filter(Boolean) as string[]

  const set = (campo: keyof VehiculoEditable) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCampos((c) => ({ ...c, [campo]: e.target.value }))

  const guardar = async () => {
    setIntentado(true)
    if (errores.length) return
    const datos: VehiculoEditable = {
      marca: campos.marca.trim(),
      modelo: campos.modelo.trim(),
      anio,
      motor: campos.motor.trim() || null,
      version: campos.version.trim() || null,
      carroceria: campos.carroceria.trim() || null,
      traccion: campos.traccion || null,
      vin: id.length === 17 ? id : null,
      chasis: id && id.length !== 17 ? id : null,
    }
    setGuardando(true)
    try {
      const v = vehiculo ? await casoApi.corregirVehiculo(vehiculo.id, datos) : await casoApi.registrarVehiculo(conversationId, datos)
      onGuardado({ ...(vehiculo ?? {}), ...datos, fuente_identificacion: null, verificado: false, ...v } as VehiculoCaso, vehiculo)
      onAbierto(false)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el vehículo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbierto}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vehiculo ? 'Corregir vehículo' : 'Registrar vehículo'}</DialogTitle>
          <DialogDescription>
            {vehiculo ? `Ahora: ${vehiculoCorto(vehiculo)}${vehiculo.motor ? ` ${vehiculo.motor}` : ''}. ` : ''}
            Tu corrección queda como verificada por un vendedor y la IA la usa para buscar piezas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="veh-marca">Marca</Label>
            <Input id="veh-marca" list="veh-marcas" value={campos.marca} onChange={set('marca')} autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="veh-modelo">Modelo</Label>
            <Input id="veh-modelo" list="veh-modelos" value={campos.modelo} onChange={set('modelo')} autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="veh-anio">Año</Label>
            <Input id="veh-anio" inputMode="numeric" value={campos.anio} onChange={set('anio')} placeholder="2012" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="veh-motor">Motor</Label>
            <Input id="veh-motor" list="veh-motores" value={campos.motor} onChange={set('motor')} placeholder="2.0 Litros - 4G63" autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="veh-version">Versión</Label>
            <Input id="veh-version" value={campos.version} onChange={set('version')} placeholder="GLS" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="veh-carroceria">Carrocería</Label>
            <Input id="veh-carroceria" value={campos.carroceria} onChange={set('carroceria')} placeholder="Doble cabina" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="veh-traccion">Tracción</Label>
            <select id="veh-traccion" value={campos.traccion} onChange={set('traccion')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Sin dato</option>
              <option value="4x2">4x2</option>
              <option value="4x4">4x4</option>
              <option value="AWD">AWD</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="veh-id">VIN o chasis</Label>
            <Input id="veh-id" value={identificador} onChange={(e) => setIdentificador(e.target.value)} className="font-mono uppercase" placeholder="K74T-0012345" autoComplete="off" />
          </div>
        </div>
        <datalist id="veh-marcas">{marcas.map((m) => <option key={m} value={m} />)}</datalist>
        <datalist id="veh-modelos">{[...new Set(delaMarca.map((m) => m.modelo))].map((m) => <option key={m} value={m} />)}</datalist>
        <datalist id="veh-motores">{motores.map((m) => <option key={m} value={m} />)}</datalist>
        {intentado && errores.length > 0 && <p className="text-xs text-destructive" role="alert">{errores.join('. ')}.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onAbierto(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando} className="gap-1.5">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
