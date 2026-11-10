"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Settings, 
  Zap, 
  RefreshCw, 
  Code,
  AlertCircle,
  CheckCircle,
  Copy,
  Play,
  Lock,
  Key,
  Globe,
  FileText,
  Database
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface DynamicHeader {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

interface DynamicQueryParam {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

interface PreAuthConfig {
  enabled: boolean;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
  token_path: string;
  token_variable: string;
  expires_in_path?: string;
  refresh_threshold_minutes: number;
}

interface AuthRefreshConfig {
  enabled: boolean;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
  use_refresh_token: boolean;
  refresh_token_path?: string;
}

interface AuthInterceptor {
  name: string;
  trigger: string;
  script: string;
  enabled: boolean;
}

interface AdvancedAuthConfig {
  auth_type: string;
  auth_credentials: Record<string, any>;
  pre_auth_config?: PreAuthConfig;
  auth_variables: Record<string, string>;
  auth_refresh_config?: AuthRefreshConfig;
  dynamic_headers: DynamicHeader[];
  dynamic_query_params: DynamicQueryParam[];
  auth_interceptors: AuthInterceptor[];
  request_interceptors: AuthInterceptor[];
  response_interceptors: AuthInterceptor[];
}

interface Props {
  config: AdvancedAuthConfig;
  onChangeAction: (config: AdvancedAuthConfig) => void;
  onTestAction?: () => void;
  isTestingAuth?: boolean;
}

const AUTH_TYPES = [
  { value: 'none', label: 'Sin autenticación', icon: '🚫' },
  { value: 'api_key', label: 'API Key', icon: '🔑' },
  { value: 'bearer_token', label: 'Bearer Token', icon: '🎫' },
  { value: 'bearer_with_prefix', label: 'Bearer con Prefijo', icon: '🎯' },
  { value: 'basic_auth', label: 'Basic Auth', icon: '👤' },
  { value: 'custom_header', label: 'Header Personalizado', icon: '📋' },
  { value: 'multiple_headers', label: 'Múltiples Headers', icon: '📚' },
  { value: 'query_params_auth', label: 'Query Parameters', icon: '🔗' },
  { value: 'custom_post_auth', label: 'POST Personalizado', icon: '📤' },
  { value: 'oauth2_client_credentials', label: 'OAuth2 Client Credentials', icon: '🛡️' },
  { value: 'oauth2_authorization_code', label: 'OAuth2 Authorization Code', icon: '🔐' }
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function AdvancedAuthComponent({ config, onChangeAction, onTestAction, isTestingAuth }: Props) {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('basic');
  const { toast } = useToast();

  const updateConfig = (updates: Partial<AdvancedAuthConfig>) => {
    onChangeAction({ ...config, ...updates });
  };

  const updateAuthCredentials = (updates: Record<string, any>) => {
    updateConfig({
      auth_credentials: { ...config.auth_credentials, ...updates }
    });
  };

  const addDynamicHeader = () => {
    const newHeader: DynamicHeader = {
      key: '',
      value: '',
      enabled: true,
      description: ''
    };
    updateConfig({
      dynamic_headers: [...config.dynamic_headers, newHeader]
    });
  };

  const updateDynamicHeader = (index: number, updates: Partial<DynamicHeader>) => {
    const headers = [...config.dynamic_headers];
    headers[index] = { ...headers[index], ...updates };
    updateConfig({ dynamic_headers: headers });
  };

  const removeDynamicHeader = (index: number) => {
    const headers = config.dynamic_headers.filter((_, i) => i !== index);
    updateConfig({ dynamic_headers: headers });
  };

  const addDynamicQueryParam = () => {
    const newParam: DynamicQueryParam = {
      key: '',
      value: '',
      enabled: true,
      description: ''
    };
    updateConfig({
      dynamic_query_params: [...config.dynamic_query_params, newParam]
    });
  };

  const updateDynamicQueryParam = (index: number, updates: Partial<DynamicQueryParam>) => {
    const params = [...config.dynamic_query_params];
    params[index] = { ...params[index], ...updates };
    updateConfig({ dynamic_query_params: params });
  };

  const removeDynamicQueryParam = (index: number) => {
    const params = config.dynamic_query_params.filter((_, i) => i !== index);
    updateConfig({ dynamic_query_params: params });
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyVariableExample = (variable: string) => {
    navigator.clipboard.writeText(`{{${variable}}}`);
    toast({
      title: "Copiado",
      description: `Variable {{${variable}}} copiada al portapapeles`
    });
  };

  const renderBasicAuthConfig = () => (
    <div className="space-y-6">
      {/* Tipo de autenticación */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Tipo de Autenticación</Label>
        <Select
          value={config.auth_type}
          onValueChange={(value) => updateConfig({ 
            auth_type: value,
            auth_credentials: {} // Reset credentials when changing type
          })}
        >
          <SelectTrigger className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center space-x-2">
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Configuración específica por tipo */}
      {config.auth_type === 'api_key' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre del Header</Label>
            <Input
              value={config.auth_credentials.header_name || 'X-API-Key'}
              onChange={(e) => updateAuthCredentials({ header_name: e.target.value })}
              placeholder="X-API-Key"
            />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showSecrets.api_key ? 'text' : 'password'}
                value={config.auth_credentials.api_key || ''}
                onChange={(e) => updateAuthCredentials({ api_key: e.target.value })}
                placeholder="Tu API Key"
              />
              <Button type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => toggleSecret('api_key')}
              >
                {showSecrets.api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {config.auth_type === 'bearer_token' && (
        <div className="space-y-2">
          <Label>Bearer Token</Label>
          <div className="relative">
            <Input
              type={showSecrets.bearer_token ? 'text' : 'password'}
              value={config.auth_credentials.token || ''}
              onChange={(e) => updateAuthCredentials({ token: e.target.value })}
              placeholder="Tu Bearer Token"
            />
            <Button type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-8 w-8 p-0"
              onClick={() => toggleSecret('bearer_token')}
            >
              {showSecrets.bearer_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {config.auth_type === 'bearer_with_prefix' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Prefijo</Label>
            <Input
              value={config.auth_credentials.prefix || 'Bearer'}
              onChange={(e) => updateAuthCredentials({ prefix: e.target.value })}
              placeholder="Bearer"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Token</Label>
            <div className="relative">
              <Input
                type={showSecrets.bearer_prefix_token ? 'text' : 'password'}
                value={config.auth_credentials.token || ''}
                onChange={(e) => updateAuthCredentials({ token: e.target.value })}
                placeholder="Tu Token"
              />
              <Button type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => toggleSecret('bearer_prefix_token')}
              >
                {showSecrets.bearer_prefix_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {config.auth_type === 'basic_auth' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input
              value={config.auth_credentials.username || ''}
              onChange={(e) => updateAuthCredentials({ username: e.target.value })}
              placeholder="Usuario"
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña</Label>
            <div className="relative">
              <Input
                type={showSecrets.basic_password ? 'text' : 'password'}
                value={config.auth_credentials.password || ''}
                onChange={(e) => updateAuthCredentials({ password: e.target.value })}
                placeholder="Contraseña"
              />
              <Button type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => toggleSecret('basic_password')}
              >
                {showSecrets.basic_password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {config.auth_type === 'custom_header' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre del Header</Label>
            <Input
              value={config.auth_credentials.header_name || ''}
              onChange={(e) => updateAuthCredentials({ header_name: e.target.value })}
              placeholder="X-Custom-Auth"
            />
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <div className="relative">
              <Input
                type={showSecrets.custom_header ? 'text' : 'password'}
                value={config.auth_credentials.header_value || ''}
                onChange={(e) => updateAuthCredentials({ header_value: e.target.value })}
                placeholder="Valor del header"
              />
              <Button type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => toggleSecret('custom_header')}
              >
                {showSecrets.custom_header ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Botón de prueba */}
      {onTestAction && (
        <div className="pt-4 border-t">
          <Button type="button" 
            onClick={onTestAction}
            disabled={isTestingAuth}
            className="w-full md:w-auto"
          >
            {isTestingAuth ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Probando autenticación...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Probar Autenticación
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  const renderPreAuthConfig = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.pre_auth_config?.enabled || false}
          onCheckedChange={(enabled) => 
            updateConfig({
              pre_auth_config: { 
                ...config.pre_auth_config,
                enabled,
                method: 'POST',
                url: '',
                headers: {},
                body: {},
                token_path: 'access_token',
                token_variable: 'auth_token',
                refresh_threshold_minutes: 5
              }
            })
          }
        />
        <Label className="text-base font-semibold">Habilitar Pre-Autenticación</Label>
      </div>

      {config.pre_auth_config?.enabled && (
        <div className="space-y-4 pl-6 border-l-2 border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Método</Label>
              <Select
                value={config.pre_auth_config?.method || 'POST'}
                onValueChange={(method) => 
                  updateConfig({
                    pre_auth_config: { ...config.pre_auth_config!, method }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 md:col-span-3">
              <Label>URL de Pre-Auth</Label>
              <Input
                value={config.pre_auth_config?.url || ''}
                onChange={(e) => 
                  updateConfig({
                    pre_auth_config: { ...config.pre_auth_config!, url: e.target.value }
                  })
                }
                placeholder="https://api.ejemplo.com/auth/token"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Path del Token (JSON)</Label>
              <Input
                value={config.pre_auth_config?.token_path || 'access_token'}
                onChange={(e) => 
                  updateConfig({
                    pre_auth_config: { ...config.pre_auth_config!, token_path: e.target.value }
                  })
                }
                placeholder="data.access_token"
              />
              <p className="text-xs text-gray-500">
                Usar notación de punto para objetos anidados
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Variable del Token</Label>
              <Input
                value={config.pre_auth_config?.token_variable || 'auth_token'}
                onChange={(e) => 
                  updateConfig({
                    pre_auth_config: { ...config.pre_auth_config!, token_variable: e.target.value }
                  })
                }
                placeholder="auth_token"
              />
              <p className="text-xs text-gray-500">
                Nombre de la variable para usar como {`{{auth_token}}`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Body (JSON)</Label>
            <Textarea
              value={JSON.stringify(config.pre_auth_config?.body || {}, null, 2)}
              onChange={(e) => {
                try {
                  const body = JSON.parse(e.target.value);
                  updateConfig({
                    pre_auth_config: { ...config.pre_auth_config!, body }
                  });
                } catch (err) {
                  // Ignore invalid JSON while typing
                }
              }}
              placeholder={`{
  "client_id": "tu_client_id",
  "client_secret": "{{client_secret}}",
  "grant_type": "client_credentials"
}`}
              rows={6}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderDynamicHeaders = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-lg font-semibold">Headers Dinámicos</h4>
          <p className="text-sm text-gray-600">Configura headers que soportan variables como {`{{timestamp}}`}</p>
        </div>
        <Button type="button" onClick={addDynamicHeader} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Header
        </Button>
      </div>

      {config.dynamic_headers.map((header, index) => (
        <Card key={index} className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-3">
              <Label>Nombre</Label>
              <Input
                value={header.key}
                onChange={(e) => updateDynamicHeader(index, { key: e.target.value })}
                placeholder="X-Custom-Header"
              />
            </div>
            
            <div className="md:col-span-4">
              <Label>Valor</Label>
              <Input
                value={header.value}
                onChange={(e) => updateDynamicHeader(index, { value: e.target.value })}
                placeholder="Bearer {{auth_token}}"
              />
            </div>
            
            <div className="md:col-span-3">
              <Label>Descripción</Label>
              <Input
                value={header.description || ''}
                onChange={(e) => updateDynamicHeader(index, { description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            
            <div className="md:col-span-1 flex items-center justify-center pt-6">
              <Switch
                checked={header.enabled}
                onCheckedChange={(enabled) => updateDynamicHeader(index, { enabled })}
              />
            </div>
            
            <div className="md:col-span-1 flex items-center justify-center pt-6">
              <Button type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeDynamicHeader(index)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {config.dynamic_headers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No hay headers dinámicos configurados</p>
          <p className="text-sm">Haz clic en "Agregar Header" para comenzar</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>Básico</span>
          </TabsTrigger>
          <TabsTrigger value="preauth" className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Pre-Auth</span>
          </TabsTrigger>
          <TabsTrigger value="headers" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Headers</span>
          </TabsTrigger>
          <TabsTrigger value="variables" className="flex items-center space-x-2">
            <Code className="h-4 w-4" />
            <span>Variables</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración Básica de Autenticación</CardTitle>
              <CardDescription>
                Configura el tipo de autenticación principal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderBasicAuthConfig()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preauth" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pre-Autenticación</CardTitle>
              <CardDescription>
                Configura autenticación previa para obtener tokens dinámicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderPreAuthConfig()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="headers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Headers Dinámicos</CardTitle>
              <CardDescription>
                Configura headers que soportan variables y se evalúan dinámicamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderDynamicHeaders()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variables" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Variables Disponibles</CardTitle>
              <CardDescription>
                Variables que puedes usar en headers, query params y body usando {`{{variable}}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h5 className="font-semibold mb-2">Variables del Sistema</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { name: 'timestamp', desc: 'Timestamp Unix actual' },
                      { name: 'iso_datetime', desc: 'Fecha/hora en formato ISO' },
                      { name: 'random_uuid', desc: 'UUID aleatorio' },
                      { name: 'unix_timestamp', desc: 'Timestamp Unix' }
                    ].map(variable => (
                      <div key={variable.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <code className="text-sm font-mono">{`{{${variable.name}}}`}</code>
                          <p className="text-xs text-gray-600">{variable.desc}</p>
                        </div>
                        <Button type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyVariableExample(variable.name)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {config.pre_auth_config?.enabled && (
                  <div>
                    <h5 className="font-semibold mb-2">Variables de Autenticación</h5>
                    <div className="p-2 bg-blue-50 rounded">
                      <code className="text-sm font-mono">{`{{${config.pre_auth_config.token_variable || 'auth_token'}}}`}</code>
                      <p className="text-xs text-gray-600">Token obtenido de la pre-autenticación</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}