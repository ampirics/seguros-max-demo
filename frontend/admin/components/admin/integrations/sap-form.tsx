"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SyncScheduleRows, type SyncConfig } from "./sync-schedule-rows"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  TestTube,
  RefreshCw,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  Building2,
  Database,
  Key,
  Settings,
  ArrowDownUp,
  XIcon
} from "lucide-react"

interface SAPConfig {
  // Conexión
  service_layer_url: string
  CompanyDB: string
  UserName: string
  Password: string
  verify_ssl: boolean
  timeout: number

  // Sincronización
  price_list: number
  use_generated_skus: boolean
  unmatched_action: string  // skip, mark_invisible, log_only
  sync_frequency: string        // formato viejo; se conserva como respaldo
  auto_update_enabled: boolean  // idem
  warehouse_id?: string  // ID del almacén en SAP

  // Horarios por proceso (fuente de verdad; ver SyncScheduleRows)
  sync?: SyncConfig

  // Performance (sync_settings — persistidos en integration.config.sync_settings)
  chunk_size?: number
  connection_timeout?: number
  query_timeout?: number
  max_retries?: number
  retry_backoff?: number
  rate_limit?: number
  max_concurrent_syncs?: number
}

// Defaults espejo de SAP_SYNC_DEFAULTS en el backend
// (app/services/sap/sap_sync_config.py).
const SAP_SYNC_PERF_DEFAULTS = {
  chunk_size: 300,
  connection_timeout: 45,
  query_timeout: 60,
  max_retries: 2,
  retry_backoff: 5,
  rate_limit: 80,
  max_concurrent_syncs: 2,
}

interface SAPFormProps {
  config: SAPConfig
  onChangeAction: (config: SAPConfig) => void
  onTestAction?: () => Promise<{ success: boolean; message: string; details?: any }>
  onPreviewSyncAction?: () => Promise<any>
  onSyncAction?: () => Promise<any>
  syncProgress?: { current: number; total: number; message?: string | null } | null
}

const defaultConfig: SAPConfig = {
  service_layer_url: '',
  CompanyDB: '',
  UserName: '',
  Password: '',
  verify_ssl: false,
  timeout: 30,
  price_list: 1,
  use_generated_skus: true,
  unmatched_action: 'skip',
  sync_frequency: 'manual',
  auto_update_enabled: false,
  warehouse_id: 'WH001',
  ...SAP_SYNC_PERF_DEFAULTS,
}

// El backend prefiere config.sync, pero el formato viejo sigue siendo el
// respaldo: se deja coherente para que nadie lea un horario que ya no existe.
function legacyFrequency(sync: SyncConfig): string {
  const f = sync.prices?.frequency
  if (f === 'daily' || f === 'weekly' || f === 'manual') return f
  if (f === 'minutes' || f === 'hourly') return 'hourly'
  return 'manual'
}

export function SAPForm({
  config = defaultConfig,
  onChangeAction,
  onTestAction,
  onPreviewSyncAction,
  onSyncAction,
  syncProgress,
}: SAPFormProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [syncPreview, setSyncPreview] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const updateConfig = (updates: Partial<SAPConfig>) => {
    onChangeAction({ ...config, ...updates })
  }

  const handleTestConnection = async () => {
    if (!onTestAction) return
    
    setTestStatus('testing')
    setTestMessage('')
    
    try {
      const result = await onTestAction()
      if (result.success) {
        setTestStatus('success')
        setTestMessage(result.message + (result.details?.sample_item ? ` (Sample: ${result.details.sample_item})` : ''))
      } else {
        setTestStatus('error')
        setTestMessage(result.message)
      }
    } catch (error: any) {
      setTestStatus('error')
      setTestMessage(error.message || 'Error de conexión')
    }
  }

  const handlePreviewSync = async () => {
    if (!onPreviewSyncAction) return
    
    setIsPreviewing(true)
    try {
      const result = await onPreviewSyncAction()
      setSyncPreview(result)
    } catch (error: any) {
      console.error('Preview error:', error)
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleSync = async () => {
    if (!onSyncAction) return
    
    setIsSyncing(true)
    try {
      await onSyncAction()
      setSyncPreview(null)
    } catch (error: any) {
      console.error('Sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Conexión SAP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Conexión SAP Business One
          </CardTitle>
          <CardDescription>
            Configura la conexión directa a SAP Service Layer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="service_layer_url">URL Service Layer *</Label>
              <Input
                id="service_layer_url"
                value={config.service_layer_url}
                onChange={(e) => updateConfig({ service_layer_url: e.target.value })}
                placeholder="https://sap-server:50000/b1s/v1"
                type="url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL completa del Service Layer incluyendo /b1s/v1
              </p>
            </div>
            
            <div>
              <Label htmlFor="company_db">
                <Database className="h-4 w-4 inline mr-1" />
                Base de Datos *
              </Label>
              <Input
                id="company_db"
                value={config.CompanyDB}
                onChange={(e) => updateConfig({ CompanyDB: e.target.value })}
                placeholder="COMPANY_DB_NAME"
              />
            </div>
            
            <div>
              <Label htmlFor="timeout">Timeout (segundos)</Label>
              <Input
                id="timeout"
                type="number"
                value={config.timeout}
                onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) || 30 })}
                min={5}
                max={120}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credenciales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Credenciales
          </CardTitle>
          <CardDescription>
            Usuario y contraseña de SAP Service Layer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Usuario *</Label>
              <Input
                id="username"
                value={config.UserName}
                onChange={(e) => updateConfig({ UserName: e.target.value })}
                placeholder="manager"
              />
            </div>
            
            <div>
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                value={config.Password}
                onChange={(e) => updateConfig({ Password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="verify_ssl"
              checked={config.verify_ssl}
              onCheckedChange={(checked) => updateConfig({ verify_ssl: checked })}
            />
            <Label htmlFor="verify_ssl" className="text-sm">
              Verificar certificado SSL
            </Label>
            <span className="text-xs text-muted-foreground">
              (Desactivar para certificados self-signed)
            </span>
          </div>

          {/* Test Connection Button */}
          <div className="pt-4 border-t">
            <Button type="button" 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !config.service_layer_url || !config.CompanyDB || !config.UserName}
              className="w-full md:w-auto"
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Probando conexión...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Probar Conexión
                </>
              )}
            </Button>
            
            {testStatus === 'success' && (
              <Alert className="mt-3 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  {testMessage}
                </AlertDescription>
              </Alert>
            )}
            
            {testStatus === 'error' && (
              <Alert className="mt-3 border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {testMessage}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuración de Sincronización */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Sincronización
          </CardTitle>
          <CardDescription>
            Opciones para sincronizar precios e inventario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price_list">Lista de Precios SAP</Label>
              <Input
                id="price_list"
                type="number"
                value={config.price_list}
                onChange={(e) => updateConfig({ price_list: parseInt(e.target.value) || 1 })}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                ID de la lista de precios a usar (default: 1)
              </p>
            </div>
            
            <div>
              <Label htmlFor="warehouse_id">ID del Almacén</Label>
              <Input
                id="warehouse_id"
                type="text"
                value={config.warehouse_id || 'WH001'}
                onChange={(e) => updateConfig({ warehouse_id: e.target.value })}
                placeholder="WH001"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ID del almacén SAP a usar (default: WH001)
              </p>
            </div>
            
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use_generated_skus" className="text-sm font-medium">
                  Usar SKUs Generados
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mapear usando generated_skus en lugar de SKU base
                </p>
              </div>
              <Switch
                id="use_generated_skus"
                checked={config.use_generated_skus}
                onCheckedChange={(checked) => updateConfig({ use_generated_skus: checked })}
              />
            </div>
            
            <div className="pt-2 space-y-3">
              <div>
                <Label className="text-sm font-medium">Sincronización automática</Label>
                <p className="text-xs text-muted-foreground">
                  Cada proceso corre por su cuenta. Este es el único lugar donde se
                  configura su horario.
                </p>
              </div>
              <SyncScheduleRows
                value={config.sync}
                onChange={(sync) => updateConfig({
                  sync,
                  // Se mantiene el formato viejo al día por si algo más lo lee.
                  sync_frequency: legacyFrequency(sync),
                  auto_update_enabled: !!sync.prices?.enabled && sync.prices?.frequency !== 'manual',
                })}
              />
            </div>
          </div>

          <div className="pt-2">
            <Label htmlFor="unmatched_action">Acción para Productos sin Match</Label>
            <Select
              value={config.unmatched_action}
              onValueChange={(value) => updateConfig({ unmatched_action: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">
                  <span className="flex items-center gap-2">
                    Omitir - No hacer nada
                  </span>
                </SelectItem>
                <SelectItem value="mark_invisible">
                  <span className="flex items-center gap-2">
                    Ocultar - Marcar como no visible
                  </span>
                </SelectItem>
                <SelectItem value="log_only">
                  <span className="flex items-center gap-2">
                    Solo registrar en logs
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Qué hacer con productos locales que no existen en SAP
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance (sync_settings) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Performance
          </CardTitle>
          <CardDescription>
            Parámetros de chunking, timeouts y reintentos para cargas pesadas. Los valores por defecto sirven para la mayoría de los casos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="chunk_size">Tamaño de chunk</Label>
              <Input
                id="chunk_size"
                type="number"
                min={1}
                value={config.chunk_size ?? SAP_SYNC_PERF_DEFAULTS.chunk_size}
                onChange={(e) => updateConfig({ chunk_size: parseInt(e.target.value || '0') || SAP_SYNC_PERF_DEFAULTS.chunk_size })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cada cuántos productos se emite progreso (default {SAP_SYNC_PERF_DEFAULTS.chunk_size}).
              </p>
            </div>
            <div>
              <Label htmlFor="connection_timeout">Timeout de conexión (s)</Label>
              <Input
                id="connection_timeout"
                type="number"
                min={1}
                value={config.connection_timeout ?? SAP_SYNC_PERF_DEFAULTS.connection_timeout}
                onChange={(e) => updateConfig({ connection_timeout: parseInt(e.target.value || '0') || SAP_SYNC_PERF_DEFAULTS.connection_timeout })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tiempo máximo para login a SAP (default {SAP_SYNC_PERF_DEFAULTS.connection_timeout}s).
              </p>
            </div>
            <div>
              <Label htmlFor="query_timeout">Timeout de query (s)</Label>
              <Input
                id="query_timeout"
                type="number"
                min={1}
                value={config.query_timeout ?? SAP_SYNC_PERF_DEFAULTS.query_timeout}
                onChange={(e) => updateConfig({ query_timeout: parseInt(e.target.value || '0') || SAP_SYNC_PERF_DEFAULTS.query_timeout })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tiempo máximo por request HTTP a SAP (default {SAP_SYNC_PERF_DEFAULTS.query_timeout}s).
              </p>
            </div>
            <div>
              <Label htmlFor="max_retries">Máximo de reintentos</Label>
              <Input
                id="max_retries"
                type="number"
                min={0}
                value={config.max_retries ?? SAP_SYNC_PERF_DEFAULTS.max_retries}
                onChange={(e) => updateConfig({ max_retries: parseInt(e.target.value || '0') })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Reintentos en errores transitorios 5xx/timeouts (default {SAP_SYNC_PERF_DEFAULTS.max_retries}).
              </p>
            </div>
            <div>
              <Label htmlFor="retry_backoff">Backoff entre reintentos (s)</Label>
              <Input
                id="retry_backoff"
                type="number"
                min={0}
                value={config.retry_backoff ?? SAP_SYNC_PERF_DEFAULTS.retry_backoff}
                onChange={(e) => updateConfig({ retry_backoff: parseInt(e.target.value || '0') })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Espera lineal entre intentos (default {SAP_SYNC_PERF_DEFAULTS.retry_backoff}s).
              </p>
            </div>
            <div>
              <Label htmlFor="rate_limit">Rate limit (req/min)</Label>
              <Input
                id="rate_limit"
                type="number"
                min={1}
                value={config.rate_limit ?? SAP_SYNC_PERF_DEFAULTS.rate_limit}
                onChange={(e) => updateConfig({ rate_limit: parseInt(e.target.value || '0') || SAP_SYNC_PERF_DEFAULTS.rate_limit })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo de requests por minuto al Service Layer (default {SAP_SYNC_PERF_DEFAULTS.rate_limit}).
              </p>
            </div>
            <div>
              <Label htmlFor="max_concurrent_syncs">Syncs simultáneas por empresa</Label>
              <Input
                id="max_concurrent_syncs"
                type="number"
                min={1}
                value={config.max_concurrent_syncs ?? SAP_SYNC_PERF_DEFAULTS.max_concurrent_syncs}
                onChange={(e) => updateConfig({ max_concurrent_syncs: parseInt(e.target.value || '0') || SAP_SYNC_PERF_DEFAULTS.max_concurrent_syncs })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Jobs de sync que pueden correr en paralelo (default {SAP_SYNC_PERF_DEFAULTS.max_concurrent_syncs}).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones de Sincronización */}
      {(onPreviewSyncAction || onSyncAction) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownUp className="h-5 w-5" />
              Sincronización de Precios
            </CardTitle>
            <CardDescription>
              Vista previa y ejecución de sincronización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {onPreviewSyncAction && (
                <Button type="button" 
                  variant="outline" 
                  onClick={handlePreviewSync}
                  disabled={isPreviewing || testStatus !== 'success'}
                >
                  {isPreviewing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Vista Previa
                    </>
                  )}
                </Button>
              )}
              
              {onSyncAction && (
                <Button type="button"
                  onClick={handleSync}
                  disabled={isSyncing || testStatus !== 'success'}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Sincronizar Ahora
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Live progress */}
            {(isPreviewing || isSyncing) && syncProgress && (
              <div className="mt-2 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{syncProgress.message || 'Sincronizando con SAP...'}</span>
                  {syncProgress.total > 0 && (
                    <span>{syncProgress.current} / {syncProgress.total}</span>
                  )}
                </div>
                <Progress
                  value={
                    syncProgress.total > 0
                      ? Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100))
                      : undefined
                  }
                />
              </div>
            )}

            {/* Preview Results */}
            {syncPreview && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                <h4 className="font-medium">Resultado del Análisis</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-2xl font-bold">{syncPreview.summary?.total_skus || 0}</div>
                    <div className="text-xs text-muted-foreground">Total SKUs</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-2xl font-bold text-green-600">{syncPreview.summary?.matched_count || 0}</div>
                    <div className="text-xs text-muted-foreground">Con Match</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-2xl font-bold text-amber-600">{syncPreview.summary?.unmatched_count || 0}</div>
                    <div className="text-xs text-muted-foreground">Sin Match</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-2xl font-bold text-blue-600">{syncPreview.summary?.price_changes_count || 0}</div>
                    <div className="text-xs text-muted-foreground">Cambios Precio</div>
                  </div>
                </div>

                {/* Price Changes */}
                {syncPreview.price_changes && syncPreview.price_changes.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium mb-2">Cambios de Precio Detectados:</h5>
                    <div className="max-h-48 overflow-auto space-y-1">
                      {syncPreview.price_changes.slice(0, 10).map((change: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 bg-background rounded">
                          <span className="font-mono">{change.sku}</span>
                          <span>
                            <span className="text-muted-foreground line-through">${change.old_price}</span>
                            {' → '}
                            <span className="text-green-600 font-medium">${change.new_price}</span>
                          </span>
                        </div>
                      ))}
                      {syncPreview.price_changes.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center">
                          ... y {syncPreview.price_changes.length - 10} más
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Unmatched Products */}
                {syncPreview.unmatched && syncPreview.unmatched.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium mb-2">
                      Productos sin Match en SAP:
                      <Badge variant="secondary" className="ml-2">
                        {config.unmatched_action === 'mark_invisible' ? 'Se ocultarán' : 
                         config.unmatched_action === 'log_only' ? 'Se registrarán' : 'Se omitirán'}
                      </Badge>
                    </h5>
                    <div className="max-h-32 overflow-auto space-y-1">
                      {syncPreview.unmatched.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 bg-amber-50 dark:bg-amber-950 rounded">
                          <span className="font-mono">{item.sku}</span>
                          <span className="text-muted-foreground ml-2">({item.product_name})</span>
                        </div>
                      ))}
                      {syncPreview.unmatched.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          ... y {syncPreview.unmatched.length - 5} más
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}

export default SAPForm
