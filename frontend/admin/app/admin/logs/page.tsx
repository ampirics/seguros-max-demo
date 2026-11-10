"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAdmin } from "@/contexts/admin-context";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Download, Search, RefreshCw, Trash2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/admin-layout';
import { toast } from "react-toastify";

interface SystemLog {
  id: string;
  level: string;
  category: string;
  code?: string;
  source: string;
  title: string;
  message?: string;
  suggested_action?: string;
  context?: any;
  entity_type?: string;
  entity_id?: string;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  status: string;
  created_at: string;
}

const LEVEL_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  ERROR: 'bg-red-100 text-red-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  INFO: 'bg-blue-100 text-blue-800',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-orange-100 text-orange-800',
  acknowledged: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  ignored: 'bg-gray-100 text-gray-800',
};

const CATEGORIES = ['SAP_ORDER', 'SAP_PAYMENT', 'SAP_SESSION', 'META_SEND', 'PAYMENT_GATEWAY', 'CONFIG_EXPIRY', 'ORDER_DATA', 'INTERNAL'];
const LEVELS = ['CRITICAL', 'ERROR', 'WARNING', 'INFO'];
const STATUSES = ['open', 'acknowledged', 'resolved', 'ignored'];

export default function SystemLogsPage() {
  const { user } = useAdmin();
  const isSuperAdmin = user?.role === 'super_admin';

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SystemLog | null>(null);

  // Filtros / modo de consulta
  const [hours, setHours] = useState<string>('24');   // '0' = búsqueda absoluta
  const [level, setLevel] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [statusF, setStatusF] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  // Borrador del buscador: la consulta solo se lanza con Enter/Filtrar o tras
  // una pausa (antes: una consulta con ILIKE por cada tecla).
  const [searchDraft, setSearchDraft] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const reqSeq = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => { if (searchDraft !== search) { setSkip(0); setSearch(searchDraft); } }, 500);
    return () => clearTimeout(t);
  }, [searchDraft, search]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [skip, setSkip] = useState(0);
  const limit = 100;

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.append('skip', String(skip));
    p.append('limit', String(limit));
    p.append('hours', hours);
    if (level) p.append('level', level);
    if (category) p.append('category', category);
    if (statusF) p.append('status', statusF);
    if (source) p.append('source', source);
    if (search) p.append('search', search);
    if (hours === '0') {
      if (startDate) p.append('start_date', new Date(startDate).toISOString());
      if (endDate) p.append('end_date', new Date(endDate).toISOString());
    }
    return p;
  }, [skip, hours, level, category, statusF, source, search, startDate, endDate]);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    try {
      setLoading(true);
      setLoadError(null);
      const [logsRes, statsRes] = await Promise.all([
        apiClient.systemLogs.getLogs(buildParams()),
        apiClient.systemLogs.getStats(hours === '0' ? 24 * 90 : Number(hours)),
      ]);
      if (seq !== reqSeq.current) return; // una respuesta vieja no pisa a la nueva
      setLogs(Array.isArray(logsRes) ? logsRes : []);
      setStats(statsRes);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setLoadError(e?.message || 'Error cargando logs del sistema');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [buildParams, hours]);

  useEffect(() => { load(); }, [load]);

  const resolveLog = async (id: string) => {
    try {
      await apiClient.systemLogs.resolve(id, 'resolved');
      toast.success('Marcado como resuelto');
      setSelected(null);
      load();
    } catch {
      toast.error('No se pudo resolver');
    }
  };

  const purge = async () => {
    if (!confirm('¿Purgar los logs vencidos de TODAS las empresas? Se borran definitivamente los registros cuya retención expiró.')) return;
    try {
      const r = await apiClient.systemLogs.purge();
      toast.success(`Purgados: ${r?.deleted ?? 0}`);
      load();
    } catch {
      toast.error('No se pudo purgar (requiere super_admin)');
    }
  };

  const exportCSV = async () => {
    try {
      const blob = await apiClient.systemLogs.exportCSV(buildParams());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'system_logs.csv'; a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo exportar');
    }
  };

  // Hora de República Dominicana (el backend manda UTC con "Z"; antes llegaban
  // sin zona y se mostraban 4 h desplazadas).
  const fmt = (d?: string) => {
    if (!d) return '-';
    try {
      const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`;
      return new Date(iso).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };
  const errorCount = stats?.by_level?.find((l: any) => l.level === 'ERROR')?.count ?? 0;
  const criticalCount = stats?.by_level?.find((l: any) => l.level === 'CRITICAL')?.count ?? 0;
  const warnCount = stats?.by_level?.find((l: any) => l.level === 'WARNING')?.count ?? 0;
  const openCount = stats?.open_vs_resolved?.open ?? 0;

  return (
    <AdminLayout title="Logs del Sistema">
      <div className="space-y-4">
        <Tabs defaultValue="errors">
          <TabsList>
            <TabsTrigger value="errors">Errores del Sistema</TabsTrigger>
            <TabsTrigger value="config">Configuraciones / Vigencia</TabsTrigger>
            <TabsTrigger value="retention">Retención / Purga</TabsTrigger>
          </TabsList>

          {/* ===== ERRORES ===== */}
          <TabsContent value="errors" className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Total ({hours === '0' ? 'histórico' : `${hours}h`})</div><div className="text-2xl font-bold">{stats?.total ?? 0}</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Críticos / Errores</div><div className="text-2xl font-bold text-red-600">{criticalCount + errorCount}</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Warnings</div><div className="text-2xl font-bold text-yellow-600">{warnCount}</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Abiertos</div><div className="text-2xl font-bold text-orange-600">{openCount}</div></CardContent></Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="w-36">
                    <label className="text-xs text-gray-500">Ventana</label>
                    <Select value={hours} onValueChange={(v) => { setSkip(0); setHours(v); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Última hora</SelectItem>
                        <SelectItem value="6">Últimas 6h</SelectItem>
                        <SelectItem value="24">Últimas 24h</SelectItem>
                        <SelectItem value="168">Últimos 7 días</SelectItem>
                        <SelectItem value="0">Búsqueda absoluta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <label className="text-xs text-gray-500">Severidad</label>
                    <Select value={level || 'all'} onValueChange={(v) => { setSkip(0); setLevel(v === 'all' ? '' : v); }}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-44">
                    <label className="text-xs text-gray-500">Categoría</label>
                    <Select value={category || 'all'} onValueChange={(v) => { setSkip(0); setCategory(v === 'all' ? '' : v); }}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <label className="text-xs text-gray-500">Estado</label>
                    <Select value={statusF || 'all'} onValueChange={(v) => { setSkip(0); setStatusF(v === 'all' ? '' : v); }}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-gray-500">Buscar</label>
                    <div className="flex gap-2">
                      <Input placeholder="título, mensaje, orden..." aria-label="Buscar en logs" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSkip(0); setSearch(searchDraft); } }} />
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => { setSkip(0); if (searchDraft !== search) setSearch(searchDraft); else load(); }}><Search className="h-4 w-4 mr-1" />Filtrar</Button>
                  <Button variant="outline" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
                </div>
                {hours === '0' && (
                  <div className="flex gap-2 items-end">
                    <div><label className="text-xs text-gray-500">Desde</label><Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                    <div><label className="text-xs text-gray-500">Hasta</label><Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                    <span className="text-xs text-gray-400 pb-2">Búsqueda absoluta: define un rango.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabla */}
            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="py-10 text-center text-gray-400">Cargando...</div>
                ) : logs.length === 0 ? (
                  <div className="py-10 text-center text-gray-400">{loadError ? <span role="alert" className="text-red-600">{loadError} <button type="button" className="underline" onClick={() => load()}>Reintentar</button></span> : 'Sin eventos en esta ventana.'}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-2">Nivel</th>
                          <th className="py-2 pr-2">Título</th>
                          <th className="py-2 pr-2">Categoría</th>
                          <th className="py-2 pr-2">Origen</th>
                          <th className="py-2 pr-2">Entidad</th>
                          <th className="py-2 pr-2 text-right">Veces</th>
                          <th className="py-2 pr-2">Último</th>
                          <th className="py-2 pr-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((l) => (
                          <tr key={l.id} className="border-b hover:bg-gray-50 cursor-pointer focus:outline-none focus-visible:bg-gray-50" onClick={() => setSelected(l)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(l); } }}>
                            <td className="py-2 pr-2"><Badge className={LEVEL_BADGE[l.level] || ''}>{l.level}</Badge></td>
                            <td className="py-2 pr-2 max-w-[320px] truncate">{l.title}</td>
                            <td className="py-2 pr-2 text-xs text-gray-600">{l.category}</td>
                            <td className="py-2 pr-2 text-xs text-gray-600">{l.source}</td>
                            <td className="py-2 pr-2 text-xs">{l.entity_id || '-'}</td>
                            <td className="py-2 pr-2 text-right font-medium">{l.occurrences}</td>
                            <td className="py-2 pr-2 text-xs">{fmt(l.last_seen)}</td>
                            <td className="py-2 pr-2"><Badge className={STATUS_BADGE[l.status] || ''}>{l.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-400">{logs.length} registros</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={logs.length < limit} onClick={() => setSkip(skip + limit)}>Siguiente</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== CONFIG / VIGENCIA (Fase 2) ===== */}
          <TabsContent value="config">
            <Card><CardContent className="pt-6 text-sm text-gray-500">
              Registro de configuraciones con vigencia (token Meta, tasa de cambio, sesión SAP, API keys).
              Disponible en la siguiente fase: mostrará estado ✅ vigente / ⚠️ por vencer / ❌ vencida.
            </CardContent></Card>
          </TabsContent>

          {/* ===== RETENCIÓN / PURGA ===== */}
          <TabsContent value="retention">
            <Card>
              <CardHeader><CardTitle className="text-base">Política de retención</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="list-disc pl-5 text-gray-600">
                  <li>CRITICAL / ERROR: 90 días</li>
                  <li>WARNING: 30 días</li>
                  <li>INFO: 7 días</li>
                  <li>Resueltos: 7 días tras resolución</li>
                </ul>
                <p className="text-xs text-gray-400">Un cron diario purga los registros vencidos. También puedes purgar manualmente:</p>
                <Button variant="destructive" disabled={!isSuperAdmin} onClick={purge}>
                  <Trash2 className="h-4 w-4 mr-1" />Purgar vencidos {isSuperAdmin ? '' : '(solo super_admin)'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.title}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge className={LEVEL_BADGE[selected.level] || ''}>{selected.level}</Badge>
                <Badge variant="secondary">{selected.category}</Badge>
                {selected.code && <Badge variant="outline">code: {selected.code}</Badge>}
                <Badge className={STATUS_BADGE[selected.status] || ''}>{selected.status}</Badge>
              </div>
              <div className="text-xs text-gray-500">Origen: {selected.source} · Veces: {selected.occurrences} · {fmt(selected.first_seen)} → {fmt(selected.last_seen)}</div>
              {selected.entity_id && <div className="text-xs">Entidad: {selected.entity_type} <b>{selected.entity_id}</b></div>}
              {selected.suggested_action && (
                <div className="bg-blue-50 border border-blue-100 rounded p-2 text-blue-800 text-xs">💡 {selected.suggested_action}</div>
              )}
              {selected.message && (
                <div><div className="text-xs text-gray-500">Mensaje</div><pre className="bg-gray-50 rounded p-2 text-xs whitespace-pre-wrap break-words">{selected.message}</pre></div>
              )}
              {selected.context && (
                <div><div className="text-xs text-gray-500">Contexto</div><pre className="bg-gray-50 rounded p-2 text-xs whitespace-pre-wrap break-words">{JSON.stringify(selected.context, null, 2)}</pre></div>
              )}
              <div className="flex justify-end pt-2">
                {selected.status !== 'resolved' && (
                  <Button size="sm" onClick={() => resolveLog(selected.id)}><CheckCircle className="h-4 w-4 mr-1" />Marcar resuelto</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
