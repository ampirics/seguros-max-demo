"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Shield, Users, Building2, Key, Clock, Copy, Eye, EyeOff, CheckCircle, Download, Phone } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { MultiCombobox } from "../ui/multi-combobox"
import { apiClient } from "@/lib/api-client"
import type { User } from "@/lib/types"

type UserRole = 'super_admin' | 'admin' | 'agent' | 'almacen' | 'manager' | 'editor' | 'supervisor' | 'user' | 'customer' | 'viewer'

interface UserCreationResponse {
  user: any
  temporary_password?: string
  message?: string
}

interface Company {
  id: string
  name: string
  description?: string
  logo_url?: string
  is_active: boolean
}

interface UserFormEnhancedProps {
  user?: User
  currentUser?: User
  onSubmitAction: (userData: any) => void
  onCancelAction: () => void
  isLoading?: boolean
}

export function UserFormEnhanced({ user, currentUser, onSubmitAction, onCancelAction, isLoading }: UserFormEnhancedProps) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    is_active: user?.is_active ?? true,
  })
  
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) || "user")
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [sipExtension, setSipExtension] = useState((user as any)?.sip_extension || "")
  const [sipPassword, setSipPassword] = useState("")
  const [showSipPassword, setShowSipPassword] = useState(false)
  const [pbxError, setPbxError] = useState<string | null>(null)
  
  // Estados para gestión de contraseñas
  const [passwordConfig, setPasswordConfig] = useState({
    generateTempPassword: !user, // True para usuarios nuevos
    mustChangePassword: !user,   // True para usuarios nuevos
    passwordExpiryEnabled: false,
    passwordExpiryDays: "90"
  })
  
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [createdUserData, setCreatedUserData] = useState<any>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  // Definir roles con descripciones mejoradas
  const roleDefinitions: { value: UserRole; label: string; description: string; permissions: string[] }[] = [
    {
      value: "super_admin",
      label: "Super Administrador",
      description: "Acceso completo al sistema, gestión de empresas y usuarios",
      permissions: ["Gestión completa", "Todas las empresas", "Administración de usuarios"]
    },
    {
      value: "admin",
      label: "Administrador",
      description: "Administrador de empresa con acceso completo excepto gestión de empresas",
      permissions: ["Inventario", "Usuarios", "Órdenes", "Reportes", "Media"]
    },
    {
      value: "agent",
      label: "Agente",
      description: "Atiende las conversaciones de chat (WhatsApp) y los clientes asignados",
      permissions: ["Chat / conversaciones", "Piezas y cotizaciones", "Atención al cliente"]
    },
    {
      value: "almacen",
      label: "Almacén",
      description: "Mantiene el inventario: precios, fotos, existencia y visibilidad en la tienda",
      permissions: ["Inventario", "Piezas"]
    },
    {
      value: "manager",
      label: "Gerente",
      description: "Enfoque en negocio: cotizaciones, órdenes y reportes",
      permissions: ["Piezas y cotizaciones", "Órdenes", "Reportes", "Vista de usuarios"]
    },
    {
      value: "editor",
      label: "Editor",
      description: "Gestión del contenido de la tienda, sin acceso a órdenes",
      permissions: ["Contenido de la tienda", "Media", "Sin órdenes ni usuarios"]
    },
    {
      value: "supervisor",
      label: "Supervisor",
      description: "Supervisión de cotizaciones y órdenes, sin administración",
      permissions: ["Piezas y cotizaciones", "Edición órdenes", "Reportes básicos"]
    },
    {
      value: "user",
      label: "Usuario",
      description: "Acceso básico de solo lectura",
      permissions: ["Piezas", "Dashboard básico"]
    },
    {
      value: "viewer",
      label: "Visor",
      description: "Solo lectura de piezas, órdenes y reportes",
      permissions: ["Solo lectura", "Piezas", "Órdenes", "Reportes"]
    },
    {
      value: "customer",
      label: "Cliente",
      description: "Acceso muy limitado para clientes externos",
      permissions: ["Vista productos limitada"]
    }
  ]

  // Filtrar roles permitidos según el usuario actual
  const allowedRoles = roleDefinitions.filter(roleDef => {
    if (currentUser?.role === "super_admin") return true
    if (currentUser?.role === "admin") return roleDef.value !== "super_admin"
    return ["user", "customer", "viewer"].includes(roleDef.value)
  })

  useEffect(() => {
    async function fetchCompanies() {
      if (role === "customer") return // Los clientes no necesitan empresas
      
      setLoadingCompanies(true)
      try {
        const result = await apiClient.getCompanies()
        setCompanies(result)
      } catch (e) {
        setCompanies([])
      } finally {
        setLoadingCompanies(false)
      }
    }
    fetchCompanies()
  }, [role])

  // Preseleccionar empresas: al editar usa las del usuario; si solo hay una empresa,
  // la marca por defecto. No pisa una selección manual existente.
  useEffect(() => {
    if (companies.length === 0) return
    setSelectedCompanyIds(prev => {
      if (prev.length > 0) return prev
      const fromUser: string[] =
        (user as any)?.company_ids ??
        (user as any)?.companies?.map((c: any) => c.id) ??
        ((user as any)?.company_id ? [(user as any).company_id] : [])
      const valid = (fromUser || []).filter((id: string) => companies.some(c => c.id === id))
      if (valid.length > 0) return valid
      // Si solo existe una empresa, seleccionarla por defecto
      if (companies.length === 1) return [companies[0].id]
      return prev
    })
  }, [companies, user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const normalizedExtension = sipExtension.trim()
    if ((!user && Boolean(normalizedExtension) !== Boolean(sipPassword)) || (user && sipPassword && !normalizedExtension)) {
      setPbxError("La extensión y la contraseña SIP deben configurarse juntas.")
      return
    }
    if (sipPassword && sipPassword.length < 12) {
      setPbxError("La contraseña SIP debe tener al menos 12 caracteres.")
      return
    }
    setPbxError(null)
    
    const submitData = {
      ...formData,
      role,
      company_ids: selectedCompanyIds,
      sip_extension: normalizedExtension || null,
      sip_password: sipPassword || null,
      // El backend espera snake_case: en camelCase se descartaban en silencio.
      generate_temp_password: passwordConfig.generateTempPassword,
      must_change_password: passwordConfig.mustChangePassword,
      password_expiry_enabled: passwordConfig.passwordExpiryEnabled,
      password_expiry_days: String(passwordConfig.passwordExpiryDays || "90"),
    }
    
    
    // Modificar para manejar la respuesta
    if (onSubmitAction && typeof onSubmitAction === 'function') {
      Promise.resolve(onSubmitAction(submitData))
        .then((result: any) => {
          // Verificar si hay contraseña temporal en la respuesta
          if (result && typeof result === 'object' && result.temporary_password) {
            setGeneratedPassword(result.temporary_password)
            setCreatedUserData({
              ...submitData,
              ...result.user,
              temporary_password: result.temporary_password
            })
            setShowSuccessDialog(true)
          }
        })
        .catch((error) => {
          console.error('Error al crear usuario:', error)
        })
    }
  }
  
  const downloadCredentials = (userData: any, tempPassword: string) => {
    // Crear CSV con las credenciales
    const csvContent = [
      ['Nombre', 'Email', 'Contraseña Temporal', 'Rol', 'Debe Cambiar Contraseña', 'Fecha Creación'],
      [
        userData.name || formData.name,
        userData.email || formData.email,
        tempPassword,
        role,
        passwordConfig.mustChangePassword ? 'Sí' : 'No',
        new Date().toISOString()
      ]
    ].map(row => row.join(',')).join('\n')
    
    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `credenciales_${userData.email || formData.email}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const copyPasswordToClipboard = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    }
  }

  const selectedRole = roleDefinitions.find(r => r.value === role)

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Básico
            </TabsTrigger>
            <TabsTrigger value="role" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Rol y permisos
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Teléfono
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Seguridad
            </TabsTrigger>
          </TabsList>

        {/* Pestaña Básico */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="juan@empresa.com"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Usuario activo</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.is_active
                  ? "El usuario puede iniciar sesión y acceder al sistema"
                  : "El usuario no podrá iniciar sesión"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Rol y Permisos */}
        <TabsContent value="role" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selección de rol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allowedRoles.map((roleDef) => (
                  <div
                    key={roleDef.value}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      role === roleDef.value
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/40"
                    }`}
                    onClick={() => setRole(roleDef.value)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        name="role"
                        value={roleDef.value}
                        checked={role === roleDef.value}
                        onChange={() => setRole(roleDef.value)}
                        className="accent-primary"
                      />
                      <label className="font-medium">{roleDef.label}</label>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">{roleDef.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {roleDef.permissions.map((permission, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {selectedRole && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{selectedRole.label}:</strong> {selectedRole.description}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Empresas */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Asignación de empresas</CardTitle>
            </CardHeader>
            <CardContent>
              {role === "customer" ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Los clientes no requieren asignación a empresas específicas.
                  </AlertDescription>
                </Alert>
              ) : loadingCompanies ? (
                <div className="text-sm text-muted-foreground">Cargando empresas…</div>
              ) : (
                <div className="space-y-4">
                  <MultiCombobox
                    options={companies.map((c: Company) => ({ value: c.id, label: c.name }))}
                    value={selectedCompanyIds}
                    onChange={setSelectedCompanyIds}
                    placeholder="Buscar empresa..."
                    label="Selecciona una o más empresas"
                  />
                  
                  {selectedCompanyIds.length > 0 && (
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="mb-2 text-sm text-muted-foreground">
                        Empresas seleccionadas: {selectedCompanyIds.length}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCompanyIds.map(id => {
                          const company = companies.find(c => c.id === id)
                          return company ? (
                            <Badge key={id} variant="outline">
                              {company.name}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phone" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Teléfono PBX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Asigna una extensión SIP al agente. Déjala vacía si no utilizará el teléfono.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sipExtension">Extensión SIP</Label>
                  <Input
                    id="sipExtension"
                    value={sipExtension}
                    onChange={(event) => {
                      setSipExtension(event.target.value)
                      setPbxError(null)
                    }}
                    placeholder="Ej: 101"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sipPassword">Contraseña SIP</Label>
                  <div className="relative">
                    <Input
                      id="sipPassword"
                      type={showSipPassword ? "text" : "password"}
                      value={sipPassword}
                      onChange={(event) => {
                        setSipPassword(event.target.value)
                        setPbxError(null)
                      }}
                      placeholder={user ? "Dejar en blanco para conservar" : "Mínimo 12 caracteres"}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSipPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={showSipPassword ? "Ocultar contraseña SIP" : "Mostrar contraseña SIP"}
                      title={showSipPassword ? "Ocultar contraseña SIP" : "Mostrar contraseña SIP"}
                    >
                      {showSipPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              {pbxError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{pbxError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Seguridad */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Gestión de contraseñas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!user && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="generateTempPassword"
                      checked={passwordConfig.generateTempPassword}
                      onCheckedChange={(checked) => 
                        setPasswordConfig(prev => ({ ...prev, generateTempPassword: checked }))
                      }
                    />
                    <Label htmlFor="generateTempPassword">Generar contraseña temporal</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Si está habilitado, se generará automáticamente una contraseña segura que se mostrará una vez.
                  </p>

                  {generatedPassword && (
                    <Alert>
                      <Key className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium">Contraseña temporal generada:</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={generatedPassword}
                              readOnly
                              className="font-mono"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={copyPasswordToClipboard}
                            >
                              <Copy className="w-4 h-4" />
                              {passwordCopied ? "¡Copiado!" : "Copiar"}
                            </Button>
                          </div>
                          <p className="text-xs text-warning">
                            Guarda esta contraseña de forma segura. No se volverá a mostrar.
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="mustChangePassword"
                    checked={passwordConfig.mustChangePassword}
                    onCheckedChange={(checked) => 
                      setPasswordConfig(prev => ({ ...prev, mustChangePassword: checked }))
                    }
                  />
                  <Label htmlFor="mustChangePassword">Forzar cambio de contraseña en primer login</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  El usuario deberá cambiar su contraseña la primera vez que inicie sesión.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="passwordExpiryEnabled"
                    checked={passwordConfig.passwordExpiryEnabled}
                    onCheckedChange={(checked) => 
                      setPasswordConfig(prev => ({ ...prev, passwordExpiryEnabled: checked }))
                    }
                  />
                  <Label htmlFor="passwordExpiryEnabled">Habilitar expiración de contraseñas</Label>
                </div>

                {passwordConfig.passwordExpiryEnabled && (
                  <div className="pl-6 space-y-2">
                    <Label htmlFor="passwordExpiryDays">Días hasta expiración</Label>
                    <select
                      id="passwordExpiryDays"
                      value={passwordConfig.passwordExpiryDays}
                      onChange={(e) => 
                        setPasswordConfig(prev => ({ ...prev, passwordExpiryDays: e.target.value }))
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="30">30 días</option>
                      <option value="60">60 días</option>
                      <option value="90">90 días</option>
                      <option value="180">180 días</option>
                      <option value="365">1 año</option>
                      <option value="never">Nunca</option>
                    </select>
                  </div>
                )}
              </div>

              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Política de contraseñas:</p>
                    <ul className="text-sm list-disc pl-4 space-y-1">
                      <li>Mínimo 8 caracteres, máximo 20</li>
                      <li>Debe incluir mayúsculas y minúsculas</li>
                      <li>Debe incluir al menos un número</li>
                      <li>Debe incluir caracteres especiales (!@#$%^&*)</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botones de acción */}
      <div className="flex space-x-4 pt-6">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Guardando..." : user ? "Actualizar usuario" : "Crear usuario"}
        </Button>
        <Button type="button" onClick={onCancelAction} variant="outline" className="flex-1">
          Cancelar
        </Button>
        </div>
      </form>

      {/* Diálogo de éxito con contraseña temporal */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                ¡Usuario creado exitosamente!
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Se ha generado una contraseña temporal para el usuario.
              </p>
            </div>
            
            {generatedPassword && (
              <div className="w-full rounded-lg bg-secondary p-4">
                <label className="text-sm font-medium text-foreground">
                  Contraseña temporal:
                </label>
                <div className="mt-1 flex items-center space-x-2">
                  <code className="flex-1 rounded border bg-card px-3 py-2 font-mono text-sm">
                    {generatedPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (generatedPassword) {
                        navigator.clipboard.writeText(generatedPassword)
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                </p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (createdUserData && generatedPassword) {
                    downloadCredentials(createdUserData, generatedPassword)
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar credenciales
              </Button>
              <Button
                onClick={() => {
                  setShowSuccessDialog(false)
                  setGeneratedPassword(null)
                  setCreatedUserData(null)
                  // Resetear formulario
                  setFormData({
                    name: '',
                    email: '',
                    is_active: true,
                  })
                  setRole('user')
                  setSelectedCompanyIds([])
                  setSipExtension('')
                  setSipPassword('')
                }}
              >
                Crear otro usuario
              </Button>
              <Button variant="outline" onClick={() => { setShowSuccessDialog(false); onCancelAction() }}>
                Volver a usuarios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
