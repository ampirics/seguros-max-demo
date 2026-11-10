"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MultiCombobox } from "@/components/ui/multi-combobox"
import { AlertCircle, CheckCircle2, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"

// Espejo de app/schemas/sap_payment_method.py (backend). Cambios ahí deben
// reflejarse aquí — no hay generación automática de tipos en este proyecto.
interface SAPUDFMapping {
  field: string
  value: string
}

export interface SAPPaymentMethodOption {
  code: string
  name: string
  is_active: boolean
  is_default: boolean
  payment_type: "transfer" | "cash" | "card" | "check"
  account_code: string
  account_name?: string | null
  currency?: string | null
  series_id?: number | null
  udfs: SAPUDFMapping[]
  providers: string[]
}

interface SAPPaymentMethodsConfig {
  schema_version: number
  options: SAPPaymentMethodOption[]
}

const PAYMENT_TYPE_OPTIONS: { value: SAPPaymentMethodOption["payment_type"]; label: string }[] = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "check", label: "Cheque" },
]

// Debe coincidir con KNOWN_SAP_PROVIDERS en app/schemas/sap_payment_method.py
const PROVIDER_OPTIONS = [
  { value: "azul", label: "Azul" },
  { value: "popular", label: "Banco Popular" },
  { value: "bpd", label: "Banco Popular (alias BPD)" },
  { value: "bhd", label: "BHD León" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "otro", label: "Otro" },
]

function newOption(): SAPPaymentMethodOption {
  return {
    code: "",
    name: "",
    is_active: true,
    is_default: false,
    payment_type: "transfer",
    account_code: "",
    account_name: null,
    currency: null,
    series_id: null,
    udfs: [],
    providers: [],
  }
}

type ValidationState = { checking: boolean; valid?: boolean; message?: string }

interface SAPPaymentMethodsFormProps {
  /** La sección solo tiene sentido una vez que existe la integración SAP en
   * el backend (los endpoints resuelven "la integración SAP de la empresa
   * activa" — no hay dónde guardar medios de pago sin ella todavía). */
  enabled: boolean
}

export function SAPPaymentMethodsForm({ enabled }: SAPPaymentMethodsFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [options, setOptions] = useState<SAPPaymentMethodOption[]>([])
  const [accountValidation, setAccountValidation] = useState<Record<number, ValidationState>>({})

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const config = await apiClient.get<SAPPaymentMethodsConfig>("/sap-config/payment-methods")
        if (!cancelled) setOptions(config.options || [])
      } catch (error: any) {
        if (!cancelled) setLoadError(error?.message || "No se pudieron cargar los medios de pago SAP")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  const updateOption = (index: number, updates: Partial<SAPPaymentMethodOption>) => {
    setOptions((prev) => prev.map((opt, i) => (i === index ? { ...opt, ...updates } : opt)))
  }

  const setAsDefault = (index: number) => {
    setOptions((prev) => prev.map((opt, i) => ({ ...opt, is_default: i === index })))
  }

  const addOption = () => {
    setOptions((prev) => [...prev, newOption()])
  }

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index))
    setAccountValidation((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const addUdf = (index: number) => {
    updateOption(index, { udfs: [...options[index].udfs, { field: "U_", value: "" }] })
  }

  const updateUdf = (optIndex: number, udfIndex: number, updates: Partial<SAPUDFMapping>) => {
    const udfs = options[optIndex].udfs.map((u, i) => (i === udfIndex ? { ...u, ...updates } : u))
    updateOption(optIndex, { udfs })
  }

  const removeUdf = (optIndex: number, udfIndex: number) => {
    updateOption(optIndex, { udfs: options[optIndex].udfs.filter((_, i) => i !== udfIndex) })
  }

  const validateAccount = async (index: number) => {
    const accountCode = options[index].account_code?.trim()
    if (!accountCode) return
    setAccountValidation((prev) => ({ ...prev, [index]: { checking: true } }))
    try {
      const result = await apiClient.post<{ valid: boolean; account_name?: string; message: string }>(
        "/sap-config/payment-methods/validate-account",
        { account_code: accountCode },
      )
      setAccountValidation((prev) => ({ ...prev, [index]: { checking: false, valid: result.valid, message: result.message } }))
      if (result.valid && result.account_name) {
        updateOption(index, { account_name: result.account_name })
      }
    } catch (error: any) {
      setAccountValidation((prev) => ({
        ...prev,
        [index]: { checking: false, valid: false, message: error?.message || "No se pudo validar la cuenta" },
      }))
    }
  }

  // Validaciones cliente mínimas — la validación fuerte vive en el backend
  // (Pydantic), esto solo evita un viaje de red para los dos errores más
  // comunes al editar.
  const duplicateCodes = React.useMemo(() => {
    const codes = options.map((o) => o.code.trim().toLowerCase()).filter(Boolean)
    return new Set(codes.filter((c, i) => codes.indexOf(c) !== i))
  }, [options])
  const tooManyDefaults = options.filter((o) => o.is_active && o.is_default).length > 1
  const hasClientErrors = duplicateCodes.size > 0 || tooManyDefaults || options.some((o) => !o.code.trim() || !o.name.trim() || !o.account_code.trim())

  const handleSave = async () => {
    if (hasClientErrors) {
      toast({ title: "Revisa los medios de pago", description: "Hay campos obligatorios vacíos, códigos duplicados o más de una opción predeterminada.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload: SAPPaymentMethodsConfig = { schema_version: 1, options }
      const result = await apiClient.put<SAPPaymentMethodsConfig>("/sap-config/payment-methods", payload)
      setOptions(result.options || [])
      toast({ title: "Medios de pago SAP guardados" })
    } catch (error: any) {
      toast({ title: "Error guardando medios de pago", description: error?.message || "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Medios de pago SAP
          </CardTitle>
          <CardDescription>
            Guarda la integración SAP primero (pestaña Conexión) para poder configurar cuentas contables por medio de pago.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Medios de pago SAP
        </CardTitle>
        <CardDescription>
          Cuentas contables y mapeo de proveedores para órdenes, facturas de anticipo y pagos. Reemplaza los valores fijos que antes vivían en el código.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando medios de pago...
          </div>
        )}

        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!loading && !loadError && (
          <>
            {options.map((option, index) => {
              const validation = accountValidation[index]
              const isDuplicate = option.code.trim() && duplicateCodes.has(option.code.trim().toLowerCase())
              return (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      Medio de pago {index + 1}
                      {option.is_default && <Badge className="bg-blue-100 text-blue-800">Predeterminado</Badge>}
                      {!option.is_active && <Badge variant="secondary">Inactivo</Badge>}
                    </h4>
                    <Button onClick={() => removeOption(index)} size="sm" variant="ghost" className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="flex items-center">
                        Código interno *
                        {(!option.code.trim() || isDuplicate) && <AlertCircle className="h-3 w-3 ml-1 text-red-500" />}
                      </Label>
                      <Input
                        value={option.code}
                        onChange={(e) => updateOption(index, { code: e.target.value })}
                        placeholder="azul, transferencia_default..."
                        className={!option.code.trim() || isDuplicate ? "border-red-300" : ""}
                      />
                      {isDuplicate && <p className="text-xs text-red-500 mt-1">Código duplicado</p>}
                    </div>
                    <div>
                      <Label className="flex items-center">
                        Nombre visible *
                        {!option.name.trim() && <AlertCircle className="h-3 w-3 ml-1 text-red-500" />}
                      </Label>
                      <Input
                        value={option.name}
                        onChange={(e) => updateOption(index, { name: e.target.value })}
                        placeholder="Azul (tarjeta)"
                        className={!option.name.trim() ? "border-red-300" : ""}
                      />
                    </div>
                    <div>
                      <Label>Medio de pago SAP *</Label>
                      <Select value={option.payment_type} onValueChange={(value) => updateOption(index, { payment_type: value as SAPPaymentMethodOption["payment_type"] })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label className="flex items-center">
                        Cuenta contable SAP *
                        {!option.account_code.trim() && <AlertCircle className="h-3 w-3 ml-1 text-red-500" />}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={option.account_code}
                          onChange={(e) => updateOption(index, { account_code: e.target.value, account_name: null })}
                          placeholder="_SYS00000000007"
                          className={!option.account_code.trim() ? "border-red-300" : ""}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!option.account_code.trim() || validation?.checking}
                          onClick={() => validateAccount(index)}
                        >
                          {validation?.checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
                        </Button>
                      </div>
                      {validation && !validation.checking && (
                        <p className={`text-xs mt-1 flex items-center gap-1 ${validation.valid ? "text-green-600" : "text-amber-600"}`}>
                          {validation.valid ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          {option.account_name ? `${option.account_name} — ` : ""}{validation.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Moneda (opcional)</Label>
                      <Input
                        value={option.currency || ""}
                        onChange={(e) => updateOption(index, { currency: e.target.value || null })}
                        placeholder="DOP"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Serie SAP (opcional)</Label>
                      <Input
                        type="number"
                        value={option.series_id ?? ""}
                        onChange={(e) => updateOption(index, { series_id: e.target.value ? Number(e.target.value) : null })}
                        placeholder="92"
                      />
                    </div>
                    <div className="flex items-center gap-6 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <Switch checked={option.is_active} onCheckedChange={(checked) => updateOption(index, { is_active: checked })} />
                        <Label>Activo</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={option.is_default} onCheckedChange={() => setAsDefault(index)} />
                        <Label>Predeterminado</Label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Proveedores asociados</Label>
                    <MultiCombobox
                      options={PROVIDER_OPTIONS}
                      value={option.providers}
                      onChange={(value) => updateOption(index, { providers: value })}
                      placeholder="Asociar proveedores (azul, popular, bhd...)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>UDFs (opcional)</Label>
                      <Button type="button" size="sm" variant="ghost" onClick={() => addUdf(index)}>
                        <Plus className="h-3 w-3 mr-1" /> Agregar UDF
                      </Button>
                    </div>
                    {option.udfs.map((udf, udfIndex) => (
                      <div key={udfIndex} className="flex gap-2 items-center">
                        <Input
                          value={udf.field}
                          onChange={(e) => updateUdf(index, udfIndex, { field: e.target.value })}
                          placeholder="U_norecibo"
                          className="w-1/2"
                        />
                        <Input
                          value={udf.value}
                          onChange={(e) => updateUdf(index, udfIndex, { value: e.target.value })}
                          placeholder="AZUL"
                          className="w-1/2"
                        />
                        <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => removeUdf(index, udfIndex)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {options.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay medios de pago configurados todavía. Agrega al menos uno (marca uno como predeterminado) antes de recibir pagos.
              </div>
            )}

            {tooManyDefaults && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Solo puede haber un medio de pago activo marcado como predeterminado.</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" onClick={addOption}>
                <Plus className="h-4 w-4 mr-2" /> Agregar medio de pago
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving || hasClientErrors}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Guardar medios de pago
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
