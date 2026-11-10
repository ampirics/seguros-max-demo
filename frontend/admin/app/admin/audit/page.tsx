"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/admin-context";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Download, Filter, Search, Clock, User, Activity, Shield, Eye, Edit, Plus, Trash } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/admin-layout';
import { toast } from "react-toastify";

// Tipos de datos
interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  method: string;
  endpoint: string;
  ip_address: string;
  success: boolean;
  error_message?: string;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface AuditStats {
  total_activities: number;
  actions: Array<{
    action: string;
    count: number;
  }>;
  active_users: Array<{
    name: string;
    email: string;
    activity_count: number;
  }>;
  resources: Array<{
    resource_type: string;
    count: number;
  }>;
  success_rate: {
    successful: number;
    failed: number;
  };
  period: {
    start_date: string;
    end_date: string;
  };
}

interface RecentActivity {
  id: string;
  timestamp: string;
  description: string;
  user: string;
  success: boolean;
  resource_name?: string;
}

const AuditLogsPage = () => {
  const { user, isLoading } = useAdmin();
  const router = useRouter();
  
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    resource_type: '',
    success: '',
    user_id: '',
    start_date: '',
    end_date: ''
  });
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 50
  });

  // Cargar datos iniciales
  useEffect(() => {
    if (!isLoading && user) {
      loadAuditData();
      loadStats();
      loadRecentActivity();
    }
  }, [isLoading, user]);

  // Búsqueda con pausa: antes cada tecla lanzaba una petición.
  const [searchDraft, setSearchDraft] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(prev => (prev.search === searchDraft ? prev : { ...prev, search: searchDraft }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchDraft]);

  // Recargar logs cuando cambien filtros o paginación
  useEffect(() => {
    if (!isLoading && user) {
      loadAuditLogs();
    }
  }, [filters, pagination, isLoading, user]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAuditLogs(),
        loadStats(),
        loadRecentActivity()
      ]);
    } catch (error) {
      console.error('Error cargando datos de auditoría:', error);
      toast.error('Error cargando datos de auditoría');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const params = new URLSearchParams();
      params.append('skip', pagination.skip.toString());
      params.append('limit', pagination.limit.toString());
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          params.append(key, value);
        }
      });

      const logs = await apiClient.auditLogs.getAuditLogs(params);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error cargando logs:', error);
      toast.error('Error cargando logs de auditoría');
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await apiClient.auditLogs.getStats(7); // Últimos 7 días
      setStats(statsData);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      toast.error('Error cargando estadísticas');
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activity = await apiClient.auditLogs.getRecentActivity(10);
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error cargando actividad reciente:', error);
      toast.error('Error cargando actividad reciente');
    }
  };

  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          params.append(key, value);
        }
      });

      const blob = await apiClient.auditLogs.exportCSV(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Logs exportados exitosamente');
    } catch (error) {
      console.error('Error exportando CSV:', error);
      toast.error('Error al exportar logs');
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <Plus className="h-4 w-4 text-green-600" />;
      case 'UPDATE': return <Edit className="h-4 w-4 text-blue-600" />;
      case 'DELETE': return <Trash className="h-4 w-4 text-red-600" />;
      case 'READ': return <Eye className="h-4 w-4 text-gray-600" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'READ': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Hora de RD (el backend manda UTC con "Z"; antes se veía 4 h desplazada).
  const formatTimestamp = (timestamp: string) => {
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`;
    return new Date(iso).toLocaleString('es-DO', {
      timeZone: 'America/Santo_Domingo', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  // Mostrar loading mientras se verifica autenticación o cargan datos
  if (isLoading || loading) {
    return (
      <AdminLayout title="Auditoría del Sistema">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Auditoría del Sistema">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Auditoría del Sistema</h1>
            <p className="text-gray-600">Registro completo de actividades administrativas</p>
          </div>
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Actividades</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_activities}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
                  <p className="text-2xl font-bold text-green-600">{(stats.success_rate.successful + stats.success_rate.failed) > 0 ? `${((stats.success_rate.successful / (stats.success_rate.successful + stats.success_rate.failed)) * 100).toFixed(1)}%` : '—'}</p>
                </div>
                <Shield className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Errores</p>
                  <p className="text-2xl font-bold text-red-600">{stats.success_rate.failed}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.active_users.length}</p>
                </div>
                <User className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="logs">Logs de Auditoría</TabsTrigger>
          <TabsTrigger value="activity">Actividad Reciente</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar en logs..."
                      value={searchDraft}
                      onChange={(e) => setSearchDraft(e.target.value)}
                      aria-label="Buscar en auditoría"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Acción</label>
                  <Select
                    value={filters.action}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las acciones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas las acciones</SelectItem>
                      <SelectItem value="CREATE">Crear</SelectItem>
                      <SelectItem value="UPDATE">Actualizar</SelectItem>
                      <SelectItem value="DELETE">Eliminar</SelectItem>
                      <SelectItem value="READ">Leer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Recurso</label>
                  <Select
                    value={filters.resource_type}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, resource_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los recursos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos los recursos</SelectItem>
                      <SelectItem value="customers">Clientes</SelectItem>
                      <SelectItem value="users">Usuarios</SelectItem>
                      <SelectItem value="products">Productos</SelectItem>
                      <SelectItem value="orders">Órdenes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select
                    value={filters.success}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, success: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos los estados</SelectItem>
                      <SelectItem value="true">Exitoso</SelectItem>
                      <SelectItem value="false">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha Inicio</label>
                  <Input
                    type="datetime-local"
                    value={filters.start_date}
                    onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha Fin</label>
                  <Input
                    type="datetime-local"
                    value={filters.end_date}
                    onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de logs */}
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoría</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getActionIcon(log.action)}
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="font-medium">{log.resource_type}</span>
                        {log.resource_name && (
                          <span className="text-gray-600">({log.resource_name})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.success ? "default" : "destructive"}>
                          {log.success ? "Éxito" : "Error"}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Usuario: {log.user?.email || 'Sistema'}</div>
                      <div>Endpoint: {log.method} {log.endpoint}</div>
                      <div>IP: {log.ip_address}</div>
                      {!log.success && log.error_message && (
                        <div className="text-red-600">Error: {log.error_message}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, skip: Math.max(0, prev.skip - prev.limit) }))}
                  disabled={pagination.skip === 0}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Mostrando {pagination.skip + 1} - {pagination.skip + auditLogs.length}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, skip: prev.skip + prev.limit }))}
                  disabled={auditLogs.length < pagination.limit}
                >
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant={activity.success ? "default" : "destructive"}>
                        {activity.success ? "✓" : "✗"}
                      </Badge>
                      <div>
                        <div className="font-medium">{activity.description}</div>
                        <div className="text-sm text-gray-600">por {activity.user}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatTimestamp(activity.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Actividades por acción */}
            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Actividades por Acción</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.actions.map((item) => (
                      <div key={item.action} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getActionIcon(item.action)}
                          <span>{item.action}</span>
                        </div>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usuarios más activos */}
            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Usuarios Más Activos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.active_users.slice(0, 10).map((user) => (
                      <div key={user.email} className="flex items-center justify-between">
                        <span className="truncate">{user.name || user.email}</span>
                        <Badge variant="outline">{user.activity_count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AuditLogsPage;