"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, Ban, CheckCircle2, Clock, Loader2, RefreshCw, Search, Zap,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-toastify";

interface SystemEvent {
  id: string;
  company_id: string;
  idempotency_key: string;
  service: string;
  event_type: string;
  reference_type: string;
  reference_id: string;
  status: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  locked_at?: string | null;
  locked_by?: string | null;
  payload?: any;
  last_response?: any;
  last_error?: string | null;
  triggered_by: string;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  total: number;
  page: number;
  page_size: number;
  items: SystemEvent[];
}

const TODOS = "__todos__";

// Mismos estados que declara la máquina en el backend (app/schemas/system_event.py).
const ESTADOS = [
  "pending", "processing", "retrying",
  "completed", "failed", "cancelled", "dead_letter",
];

const SERVICIOS = ["bhd", "sap", "azul", "popular", "whatsapp"];

const ESTADO_ETIQUETA: Record<string, string> = {
  pending: "En cola",
  processing: "Procesando",
  retrying: "Reintentando",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
  dead_letter: "Agotado",
};

const ESTADO_COLOR: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  retrying: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-700",
  dead_letter: "bg-red-600 text-white",
};

// Estados sobre los que ya no se actúa.
const TERMINALES = ["completed", "cancelled"];

function fecha(valor?: string | null): string {
  if (!valor) return "—";
  try {
    return new Date(valor).toLocaleString("es-DO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return valor;
  }
}

function relativo(valor?: string | null): string {
  if (!valor) return "";
  const ms = new Date(valor).getTime() - Date.now();
  const min = Math.round(Math.abs(ms) / 60000);
  if (min < 1) return ms > 0 ? "en menos de 1 min" : "hace instantes";
  if (min < 60) return ms > 0 ? `en ${min} min` : `hace ${min} min`;
  const h = Math.round(min / 60);
  return ms > 0 ? `en ${h} h` : `hace ${h} h`;
}

export function SystemEventsPanel() {
  const [eventos, setEventos] = useState<SystemEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const pageSize = 50;

  const [servicio, setServicio] = useState<string>(TODOS);
  const [estado, setEstado] = useState<string>(TODOS);
  const [referencia, setReferencia] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [detalle, setDetalle] = useState<SystemEvent | null>(null);
  const [enAccion, setEnAccion] = useState<string | null>(null);
  const [confirmarMasivo, setConfirmarMasivo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params: Record<string, unknown> = { page: pagina, page_size: pageSize };
      if (servicio !== TODOS) params.service = servicio;
      if (estado !== TODOS) params.status = estado;
      if (busqueda.trim()) params.reference = busqueda.trim();

      const data = await apiClient.get<ListResponse>("/admin/system-events", params);
      setEventos(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar la bandeja de eventos");
      setEventos([]);
      setTotal(0);
    } finally {
      setCargando(false);
    }
  }, [pagina, servicio, estado, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  // Refresco en vivo: los eventos avanzan solos (el worker corre cada 2 min),
  // así que una vista estática engaña. 20 s es suficiente para seguir el
  // ciclo sin castigar al backend.
  useEffect(() => {
    const t = setInterval(() => { cargar(); }, 20000);
    return () => clearInterval(t);
  }, [cargar]);

  const resumen = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const ev of eventos) acc[ev.status] = (acc[ev.status] || 0) + 1;
    return acc;
  }, [eventos]);

  const pendientesDeAtencion = (resumen.dead_letter || 0) + (resumen.failed || 0);

  async function relanzar(ev: SystemEvent) {
    setEnAccion(ev.id);
    try {
      const r = await apiClient.post<any>(`/admin/system-events/${ev.id}/retry`);
      toast.success(r?.message || "Evento encolado de nuevo");
      await cargar();
    } catch (e: any) {
      // El backend distingue 409 (un worker lo tiene ahora mismo) de 400
      // (ya completado). Ambos mensajes son accionables, se muestran tal cual.
      toast.error(e?.message || "No se pudo relanzar el evento");
    } finally {
      setEnAccion(null);
    }
  }

  async function cancelar(ev: SystemEvent) {
    setEnAccion(ev.id);
    try {
      const r = await apiClient.post<any>(`/admin/system-events/${ev.id}/cancel`);
      toast.success(r?.message || "Evento cancelado");
      await cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cancelar el evento");
    } finally {
      setEnAccion(null);
    }
  }

  async function cancelarMasivo() {
    setConfirmarMasivo(false);
    // El backend no filtra por referencia: con una búsqueda activa, «todos»
    // cancelaría más eventos de los que se ven en pantalla.
    if (busqueda.trim()) {
      toast.error("Quita la búsqueda por referencia para cancelar en bloque (solo filtra por servicio y estado).");
      return;
    }
    try {
      const body: Record<string, string> = {};
      if (servicio !== TODOS) body.service = servicio;
      if (estado !== TODOS) body.status = estado;
      const r = await apiClient.post<any>("/admin/system-events/cancel-all", body);
      toast.success(r?.message || "Eventos cancelados");
      await cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cancelar en bloque");
    }
  }

  const puedeMasivo = servicio !== TODOS || estado !== TODOS;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-600">
            Cada fila es un trabajo pendiente contra un tercero (banco, SAP, WhatsApp).
            Si algo no llegó a su destino, está aquí — no perdido en un log.
            Un evento <strong>Agotado</strong> gastó todos sus intentos y ya no se
            reintenta solo: revísalo y decide si relanzarlo o cerrarlo.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">En esta página</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{eventos.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total filtrado</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(resumen.pending || 0) + (resumen.retrying || 0) + (resumen.processing || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className={pendientesDeAtencion > 0 ? "border-red-300" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Requieren atención</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pendientesDeAtencion > 0 ? "text-red-600" : ""}`}>
              {pendientesDeAtencion}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs text-gray-500 mb-1 block">Referencia</label>
              <div className="flex gap-2">
                <Input
                  placeholder="ORD-65519…"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setPagina(1); setBusqueda(referencia); }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => { setPagina(1); setBusqueda(referencia); }}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-w-[160px]">
              <label className="text-xs text-gray-500 mb-1 block">Servicio</label>
              <Select value={servicio} onValueChange={(v) => { setPagina(1); setServicio(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {SERVICIOS.map((s) => (
                    <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <label className="text-xs text-gray-500 mb-1 block">Estado</label>
              <Select value={estado} onValueChange={(v) => { setPagina(1); setEstado(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {ESTADOS.map((s) => (
                    <SelectItem key={s} value={s}>{ESTADO_ETIQUETA[s] || s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={cargar} disabled={cargando}>
              <RefreshCw className={`h-4 w-4 mr-2 ${cargando ? "animate-spin" : ""}`} />
              Actualizar
            </Button>

            <Button
              variant="destructive"
              disabled={!puedeMasivo || eventos.length === 0}
              onClick={() => setConfirmarMasivo(true)}
              title={puedeMasivo
                ? "Cancela todos los eventos que cumplen el filtro actual"
                : "Elige un servicio o un estado antes de cancelar en bloque"}
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancelar filtrados
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {cargando && eventos.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              No hay eventos con estos filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Intentos</TableHead>
                    <TableHead>Próximo intento</TableHead>
                    <TableHead>Último error</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((ev) => {
                    const terminal = TERMINALES.includes(ev.status);
                    const agotado = ev.status === "dead_letter";
                    return (
                      <TableRow
                        key={ev.id}
                        className={agotado ? "bg-red-50" : undefined}
                      >
                        <TableCell>
                          <button
                            className="font-medium text-blue-600 hover:underline"
                            onClick={() => setDetalle(ev)}
                          >
                            {ev.reference_id}
                          </button>
                          <div className="text-xs text-gray-400">{ev.reference_type}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium uppercase text-xs">{ev.service}</div>
                          <div className="text-xs text-gray-400">{ev.event_type}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ESTADO_COLOR[ev.status] || "bg-gray-100"}>
                            {ESTADO_ETIQUETA[ev.status] || ev.status}
                          </Badge>
                          {ev.status === "processing" && ev.locked_by && (
                            <div className="text-xs text-gray-400 mt-1" title={ev.locked_by}>
                              worker activo
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={agotado ? "text-red-600 font-semibold" : ""}>
                            {ev.retry_count}/{ev.max_retries}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {terminal || agotado ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 inline mr-1 text-gray-400" />
                              {relativo(ev.next_retry_at)}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {ev.last_error ? (
                            <span className="text-xs text-red-700 line-clamp-2" title={ev.last_error}>
                              {ev.last_error}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="mr-2"
                            disabled={enAccion === ev.id || ev.status === "completed"}
                            onClick={() => relanzar(ev)}
                            title={ev.status === "completed"
                              ? "Ya se completó; relanzarlo podría duplicar la operación"
                              : "Volver a encolar ahora"}
                          >
                            {enAccion === ev.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Zap className="h-3 w-3" />}
                            <span className="ml-1">Relanzar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={enAccion === ev.id || terminal}
                            onClick={() => { if (confirm(`¿Cancelar el evento ${ev.reference_type} ${ev.reference_id}? El worker dejará de procesarlo.`)) cancelar(ev) }}
                            aria-label="Cancelar evento"
                            title={terminal
                              ? `Ya está en estado ${ESTADO_ETIQUETA[ev.status]}`
                              : "El worker dejará de considerarlo"}
                          >
                            <Ban className="h-3 w-3" />
                            <span className="ml-1">Cancelar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                Página {pagina} de {Math.ceil(total / pageSize)} · {total} evento(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm"
                  disabled={pagina >= Math.ceil(total / pageSize)}
                  onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detalle?.reference_id}{" "}
              <Badge className={ESTADO_COLOR[detalle?.status || ""] || "bg-gray-100"}>
                {ESTADO_ETIQUETA[detalle?.status || ""] || detalle?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Servicio:</span> {detalle.service}</div>
                <div><span className="text-gray-500">Tipo:</span> {detalle.event_type}</div>
                <div><span className="text-gray-500">Intentos:</span> {detalle.retry_count}/{detalle.max_retries}</div>
                <div><span className="text-gray-500">Origen:</span> {detalle.triggered_by}</div>
                <div><span className="text-gray-500">Creado:</span> {fecha(detalle.created_at)}</div>
                <div><span className="text-gray-500">Actualizado:</span> {fecha(detalle.updated_at)}</div>
                <div><span className="text-gray-500">Próximo intento:</span> {fecha(detalle.next_retry_at)}</div>
                <div><span className="text-gray-500">Worker:</span> {detalle.locked_by || "—"}</div>
              </div>

              {detalle.last_error && (
                <div>
                  <div className="text-gray-500 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-500" /> Último error
                  </div>
                  <pre className="bg-red-50 text-red-800 p-3 rounded text-xs whitespace-pre-wrap">
                    {detalle.last_error}
                  </pre>
                </div>
              )}

              <div>
                <div className="text-gray-500 mb-1">
                  Payload <span className="text-xs">(sanitizado antes de guardarse)</span>
                </div>
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(detalle.payload ?? {}, null, 2)}
                </pre>
              </div>

              {detalle.last_response && (
                <div>
                  <div className="text-gray-500 mb-1">Última respuesta</div>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(detalle.last_response, null, 2)}
                  </pre>
                </div>
              )}

              <div className="text-xs text-gray-400 pt-2 border-t">
                Clave de idempotencia: <code>{detalle.idempotency_key}</code>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarMasivo} onOpenChange={setConfirmarMasivo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar los eventos filtrados?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelarán todos los eventos que cumplan el filtro actual
              {servicio !== TODOS && <> · servicio <strong>{servicio}</strong></>}
              {estado !== TODOS && <> · estado <strong>{ESTADO_ETIQUETA[estado]}</strong></>}
              , no solo los de esta página. Los ya completados o cancelados no se tocan.
              El worker dejará de considerarlos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={cancelarMasivo}>Sí, cancelar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
