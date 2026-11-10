'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import type { BloqueAgenda, Cita, VendedorAgenda } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { horaCita, TIPO_CITA } from './CitaFicha'
import { aCita } from '@/lib/api/agenda'
import { inventarioApi, type Sucursal } from '@/lib/api/inventario'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoyISO = () => iso(new Date())
// El domingo la tienda cierra: la fecha sugerida es el próximo día abierto.
const proximoAbierto = () => {
  const d = new Date()
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return iso(d)
}

export function NuevaCita({
  abierta,
  vendedores,
  vendedorInicial,
  onCerrar,
  onCreada,
  clienteInicial,
}: {
  abierta: boolean
  vendedores: VendedorAgenda[]
  vendedorInicial: string | null
  onCerrar: () => void
  onCreada: (c: Cita) => void
  clienteInicial?: { id: string; name: string; phone: string }
}) {
  const [tipo, setTipo] = useState<Cita['tipo']>('visita')
  const [clientes, setClientes] = useState<{ id: string; name: string; phone: string }[]>([])
  const [cliente, setCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [fecha, setFecha] = useState(proximoAbierto)
  const [bloques, setBloques] = useState<BloqueAgenda[] | null>(null)
  const [inicio, setInicio] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId] = useState('')

  useEffect(() => {
    if (!abierta) return
    setVendedor(vendedorInicial ?? vendedores[0]?.id ?? '')
    setFecha(proximoAbierto())
    setError(null)
    if (clienteInicial) setCliente(clienteInicial.name)
    if (sucursales.length === 0) inventarioApi.sucursales().then(setSucursales).catch(() => setSucursales([]))
    if (clientes.length === 0) apiClient.getCustomers({ limit: 100 }).then((r: any) => setClientes(r.data ?? [])).catch(() => setClientes([]))
  }, [abierta])

  useEffect(() => {
    if (!abierta || !vendedor || !fecha) return
    setBloques(null)
    setInicio('')
    apiClient
      .get<{ bloques: BloqueAgenda[] }>('/agenda/disponibilidad', { vendedor_id: vendedor, desde: fecha, hasta: fecha })
      .then((r) => setBloques(r.bloques.filter((b) => b.libre)))
      .catch(() => setBloques([]))
  }, [abierta, vendedor, fecha, recarga])

  const existente = (clienteInicial && clienteInicial.name === cliente.trim() ? clienteInicial : null)
    ?? clientes.find((c) => c.name.toLowerCase() === cliente.trim().toLowerCase())

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const cita = aCita(await apiClient.post<Cita>('/agenda/citas', {
        tipo,
        cliente_id: existente?.id,
        cliente_nombre: cliente.trim(),
        cliente_telefono: existente?.phone || telefono.trim() || undefined,
        vendedor_id: vendedor,
        inicio,
        notas: motivo.trim() || undefined,
        sucursal_id: tipo === 'visita' && sucursalId ? sucursalId : undefined,
      }))
      toast.success(cita.vendedor ? `Cita agendada con ${cita.vendedor}` : 'Cita agendada')
      onCreada(cita)
      setCliente('')
      setTelefono('')
      setMotivo('')
    } catch (err: any) {
      setError(err?.message || 'No se pudo agendar. Intenta de nuevo.')
      setRecarga((n) => n + 1)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierta} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription>Solo se ofrecen las horas libres del vendedor.</DialogDescription>
        </DialogHeader>
        <form onSubmit={crear} className="space-y-4">
          <div role="radiogroup" aria-label="Tipo de cita" className="grid grid-cols-2 gap-1 rounded-control bg-secondary p-1">
            {(Object.keys(TIPO_CITA) as Cita['tipo'][]).map((t) => {
              const Icon = TIPO_CITA[t].icon
              return (
                <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)}
                  className={cn('flex h-9 items-center justify-center gap-2 rounded-control text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tipo === t ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon className="h-4 w-4" aria-hidden /> {TIPO_CITA[t].label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cita-cliente">Cliente</Label>
              <Input id="cita-cliente" list="cita-clientes" value={cliente} onChange={(e) => setCliente(e.target.value)} required placeholder="Nombre del cliente" autoComplete="off" />
              <datalist id="cita-clientes">{clientes.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cita-telefono">Teléfono</Label>
              <Input id="cita-telefono" type="tel" value={existente?.phone ?? telefono} onChange={(e) => setTelefono(e.target.value)} disabled={!!existente} placeholder="809-555-0000" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cita-vendedor">Vendedor</Label>
              <Select value={vendedor} onValueChange={setVendedor}>
                <SelectTrigger id="cita-vendedor"><SelectValue placeholder="Elige un vendedor" /></SelectTrigger>
                <SelectContent>{vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cita-fecha">Fecha</Label>
              <Input id="cita-fecha" type="date" min={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
          </div>

          {tipo === 'visita' && sucursales.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="cita-sucursal">Sucursal</Label>
              <Select value={sucursalId || 'horario'} onValueChange={(v) => setSucursalId(v === 'horario' ? '' : v)}>
                <SelectTrigger id="cita-sucursal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horario">La del horario del vendedor</SelectItem>
                  {sucursales.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Los vendedores de esa sucursal reciben el aviso con lo que busca el cliente.</p>
            </div>
          )}

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Hora</legend>
            {!bloques ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando horas libres…</p>
            ) : bloques.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quedan horas libres ese día. Prueba otra fecha u otro vendedor.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {bloques.map((b) => (
                  <button key={b.inicio} type="button" aria-pressed={inicio === b.inicio} onClick={() => setInicio(b.inicio)}
                    className={cn('h-8 rounded-control border text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      inicio === b.inicio ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/60')}>
                    {horaCita(b.inicio)}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="cita-motivo">Motivo</Label>
            <Textarea id="cita-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ej.: retirar amortiguadores separados" />
          </div>

          {error && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
            <Button type="submit" disabled={!inicio || !cliente.trim() || guardando} className="gap-2">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
