"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckCircle, Eye, EyeOff, Loader2, Phone, Server, TestTube, XCircle, BrainCircuit } from "lucide-react"

import { testPbxConnection } from "@/lib/pbx/softphone-client"

export interface PBXConfig {
  sip_server: string
  sip_domain: string
  sip_extension: string
  sip_password: string
  // Opciones de Inteligencia Artificial para el Agente
  ai_mode: "general" | "particular"
  ai_anthropic_key?: string
  ai_deepgram_key?: string
  ai_model?: string
  ai_voice?: string
  ai_system_prompt?: string
}

export const EMPTY_PBX_CONFIG: PBXConfig = {
  sip_server: "",
  sip_domain: "",
  sip_extension: "",
  sip_password: "",
  ai_mode: "general",
  ai_model: "claude-haiku-4-5-20251001",
  ai_voice: "es-DO-EmilioNeural"
}

export const isPbxConfigComplete = (config: PBXConfig) =>
  !!(config.sip_server?.trim() && config.sip_domain?.trim() && config.sip_extension?.trim() && config.sip_password)

interface PBXFormProps {
  config: PBXConfig
  onChangeAction: (config: PBXConfig) => void
}

export function PBXForm({ config, onChangeAction }: PBXFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const update = (field: keyof PBXConfig, value: string) => {
    setTestResult(null)
    onChangeAction({ ...config, [field]: value })
  }

  const serverIsWebSocket = !config.sip_server || /^wss?:\/\//i.test(config.sip_server.trim())

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await testPbxConnection({
        sipServer: config.sip_server.trim(),
        sipDomain: config.sip_domain.trim(),
        sipExtension: config.sip_extension.trim(),
        sipPassword: config.sip_password,
      }))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Central telefónica
          </CardTitle>
          <CardDescription>
            Servidor SIP sobre WebSocket al que se conecta el teléfono del chat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sip_server">Servidor WebSocket *</Label>
              <Input
                id="sip_server"
                value={config.sip_server}
                onChange={(e) => update("sip_server", e.target.value)}
                placeholder="wss://"
                autoComplete="off"
                className={!serverIsWebSocket ? "border-red-300" : ""}
              />
              {!serverIsWebSocket && (
                <p className="text-xs text-red-600">Debe empezar por wss:// (o ws:// en pruebas locales)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sip_domain">Dominio SIP *</Label>
              <Input
                id="sip_domain"
                value={config.sip_domain}
                onChange={(e) => update("sip_domain", e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Extensión
          </CardTitle>
          <CardDescription>
            Credenciales con las que el teléfono se registra en la central
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sip_extension">Extensión *</Label>
              <Input
                id="sip_extension"
                value={config.sip_extension}
                onChange={(e) => update("sip_extension", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sip_password">Contraseña *</Label>
              <div className="relative">
                <Input
                  id="sip_password"
                  type={showPassword ? "text" : "password"}
                  value={config.sip_password}
                  onChange={(e) => update("sip_password", e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || !isPbxConfigComplete(config) || !serverIsWebSocket}
            >
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
              {testing ? "Registrando..." : "Probar registro"}
            </Button>
            <p className="text-xs text-muted-foreground">
              La prueba se hace desde este navegador, igual que lo hará el teléfono del chat.
            </p>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5" />
            Inteligencia Artificial del Agente
          </CardTitle>
          <CardDescription>
            Configura qué credenciales usar para que el agente virtual procese la voz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <Label>Modo de Credenciales</Label>
            <RadioGroup
              value={config.ai_mode}
              onValueChange={(v) => update("ai_mode", v as any)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="general" id="general" />
                <Label htmlFor="general" className="font-normal">
                  Usar integración general (La configurada arriba en "Modelos")
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="particular" id="particular" />
                <Label htmlFor="particular" className="font-normal">
                  Usar credenciales particulares para el conector PBX
                </Label>
              </div>
            </RadioGroup>

            {config.ai_mode === "particular" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="ai_anthropic_key">API Key de Anthropic (Claude) *</Label>
                  <Input
                    id="ai_anthropic_key"
                    type="password"
                    value={config.ai_anthropic_key || ""}
                    onChange={(e) => update("ai_anthropic_key", e.target.value)}
                    autoComplete="new-password"
                    placeholder="sk-ant-api03-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai_deepgram_key">API Key de Deepgram (STT) *</Label>
                  <Input
                    id="ai_deepgram_key"
                    type="password"
                    value={config.ai_deepgram_key || ""}
                    onChange={(e) => update("ai_deepgram_key", e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai_model">Modelo de Lenguaje</Label>
                  <Input
                    id="ai_model"
                    value={config.ai_model || "claude-haiku-4-5-20251001"}
                    onChange={(e) => update("ai_model", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai_voice">Voz TTS (Edge)</Label>
                  <Input
                    id="ai_voice"
                    value={config.ai_voice || "es-DO-EmilioNeural"}
                    onChange={(e) => update("ai_voice", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
