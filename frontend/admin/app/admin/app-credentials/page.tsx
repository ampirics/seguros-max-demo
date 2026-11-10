'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiClient } from '@/lib/api-client'
import { useCompany } from '@/contexts/company-context'
import { Eye, EyeOff, Copy, KeyRound, RefreshCw, Trash2, Plus, ShieldAlert } from 'lucide-react'

interface AppCredential {
  id: string
  client_id: string
  name: string
  description?: string | null
  scopes: string[]
  is_active: boolean
  company_id: string
  created_at?: string | null
  last_used_at?: string | null
  revoked_at?: string | null
  secret_prefixes: string[]
}

/** El secreto en claro solo existe en memoria y solo hasta recargar. */
interface SecretoRevelado {
  client_id: string
  client_secret: string
  overlap_until?: string | null
  motivo: 'creada' | 'rotada'
}

export default function AppCredentialsPage() {
  const { activeCompany } = useCompany()
  const [credenciales, setCredenciales] = useState<AppCredential[]>([])
  const [scopesDisponibles, setScopesDisponibles] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [acotar, setAcotar] = useState(false)
  const [scopesElegidos, setScopesElegidos] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  const [secreto, setSecreto] = useState<SecretoRevelado | null>(null)
  const [secretoVisible, setSecretoVisible] = useState(false)

  const cargar = async () => {
    try {
      setCargando(true)
      setError(null)
      const [creds, scopes] = await Promise.all([
        apiClient.listAppCredentials(),
        apiClient.getAvailableScopes().catch(() => [] as string[]),
      ])
      setCredenciales(creds || [])
      setScopesDisponibles(scopes || [])
    } catch (e: any) {
      console.error('Error cargando credenciales:', e)
      setError('No se pudieron cargar las credenciales.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [activeCompany?.id])

  const crear = async () => {
    if (!nombre.trim()) return
    try {
      setGuardando(true)
      const r = await apiClient.createAppCredential({
        name: nombre.trim(),
        description: descripcion.trim() || undefined,
        // Sin scopes = alcance completo de la empresa. Acotar es opcional.
        scopes: acotar && scopesElegidos.length > 0 ? scopesElegidos : undefined,
      })
      setSecreto({ client_id: r.client_id, client_secret: r.client_secret, motivo: 'creada' })
      setSecretoVisible(false)
      setMostrarFormulario(false)
      setNombre(''); setDescripcion(''); setAcotar(false); setScopesElegidos([])
      await cargar()
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la credencial.')
    } finally {
      setGuardando(false)
    }
  }

  const rotar = async (c: AppCredential) => {
    if (!window.confirm(
      `¿Rotar el secreto de "${c.name}"?\n\n` +
      `Se emite uno nuevo y el actual sigue siendo válido durante 72 horas, ` +
      `para que puedas actualizar el consumidor sin cortar el servicio.`
    )) return
    try {
      const r = await apiClient.rotateAppCredential(c.id)
      setSecreto({
        client_id: r.client_id, client_secret: r.client_secret,
        overlap_until: r.overlap_until, motivo: 'rotada',
      })
      setSecretoVisible(false)
      await cargar()
    } catch (e: any) {
      setError(e?.message || 'No se pudo rotar el secreto.')
    }
  }

  const revocar = async (c: AppCredential) => {
    if (!window.confirm(
      `¿Revocar "${c.name}"?\n\nEs inmediato y sin ventana de gracia: ` +
      `cualquier servicio que la use dejará de funcionar al instante.`
    )) return
    try {
      await apiClient.revokeAppCredential(c.id)
      await cargar()
    } catch (e: any) {
      setError(e?.message || 'No se pudo revocar la credencial.')
    }
  }

  const copiar = (t: string) => navigator.clipboard.writeText(t)

  return (
    <AdminLayout title="Credenciales de aplicación">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Credenciales de aplicación</h2>
            <p className="text-gray-600 max-w-3xl">
              Credenciales servidor-a-servidor para que tus integraciones consuman la API
              {activeCompany ? <> de <strong>{activeCompany.name}</strong></> : null}.
              A diferencia de la API key de la tienda —que viaja en el navegador y es
              pública—, estas nunca salen de tu servidor, así que sí pueden llevar permisos.
            </p>
          </div>
          <Button onClick={() => setMostrarFormulario(v => !v)}>
            <Plus className="h-4 w-4 mr-2" />Nueva credencial
          </Button>
        </div>

        {error && (
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        )}

        {/* El secreto se muestra una sola vez */}
        {secreto && (
          <Card className="border-amber-400 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <ShieldAlert className="h-5 w-5" />
                Credencial {secreto.motivo}: guarda el secreto ahora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-900">
                Este es el único momento en que se muestra. No se guarda en claro, así que
                no hay forma de recuperarlo: si lo pierdes, hay que rotar la credencial.
              </p>
              <div>
                <Label className="text-xs">client_id</Label>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white px-2 py-1 rounded border flex-1 break-all">
                    {secreto.client_id}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => copiar(secreto.client_id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">client_secret</Label>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white px-2 py-1 rounded border flex-1 break-all">
                    {secretoVisible ? secreto.client_secret : '•'.repeat(32)}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => setSecretoVisible(v => !v)}>
                    {secretoVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copiar(secreto.client_secret)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {secreto.overlap_until && (
                <p className="text-sm text-amber-900">
                  El secreto anterior sigue válido hasta{' '}
                  <strong>{new Date(secreto.overlap_until).toLocaleString()}</strong>.
                  Actualiza el consumidor antes de esa fecha.
                </p>
              )}
              <Button size="sm" variant="outline" onClick={() => { setSecreto(null); setSecretoVisible(false) }}>
                Ya lo guardé
              </Button>
            </CardContent>
          </Card>
        )}

        {mostrarFormulario && (
          <Card>
            <CardHeader><CardTitle>Nueva credencial</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)}
                       placeholder="Bot de WhatsApp, Integración SAP…" />
              </div>
              <div>
                <Label htmlFor="desc">Descripción (opcional)</Label>
                <Textarea id="desc" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                          placeholder="Para qué se usa y quién la mantiene" />
              </div>

              <div className="rounded border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={acotar} onChange={e => setAcotar(e.target.checked)} />
                  Acotar permisos (opcional)
                </label>
                <p className="text-xs text-gray-600">
                  Por defecto la credencial puede hacer lo mismo que un administrador de
                  esta empresa, y nada fuera de ella: no crea empresas ni actúa sobre otro
                  tenant. Acotar sirve para dar el mínimo imprescindible.
                </p>
                {acotar && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-56 overflow-y-auto pt-2">
                    {scopesDisponibles.map(s => (
                      <label key={s} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={scopesElegidos.includes(s)}
                          onChange={e => setScopesElegidos(prev =>
                            e.target.checked ? [...prev, s] : prev.filter(x => x !== s))}
                        />
                        <code>{s}</code>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={crear} disabled={guardando || !nombre.trim()}>
                  {guardando ? 'Creando…' : 'Crear credencial'}
                </Button>
                <Button variant="outline" onClick={() => setMostrarFormulario(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Credenciales ({credenciales.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargando ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : credenciales.length === 0 ? (
              <p className="text-sm text-gray-500">
                Todavía no hay credenciales para esta empresa.
              </p>
            ) : (
              <div className="space-y-3">
                {credenciales.map(c => (
                  <div key={c.id} className="border rounded p-3 flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <Badge variant={c.is_active ? 'default' : 'secondary'}>
                          {c.is_active ? 'Activa' : 'Revocada'}
                        </Badge>
                        <Badge variant="outline">{c.scopes?.length ?? 0} permisos</Badge>
                      </div>
                      {c.description && <p className="text-sm text-gray-600">{c.description}</p>}
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{c.client_id}</code>
                        <Button size="sm" variant="ghost" onClick={() => copiar(c.client_id)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {c.secret_prefixes?.length > 1
                          ? `${c.secret_prefixes.length} secretos vigentes (rotación en curso)`
                          : `${c.secret_prefixes?.length ?? 0} secreto vigente`}
                        {c.last_used_at
                          ? ` · último uso ${new Date(c.last_used_at).toLocaleString()}`
                          : ' · sin uso registrado'}
                      </p>
                    </div>
                    {c.is_active && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => rotar(c)}>
                          <RefreshCw className="h-4 w-4 mr-1" />Rotar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => revocar(c)}>
                          <Trash2 className="h-4 w-4 mr-1" />Revocar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
