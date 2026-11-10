'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Download, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  reporteConciliacionApi,
  type ReporteConciliacion,
  type ReporteConciliacionFiltros,
} from '@/lib/payment-links-api';

const PASARELAS = [
  { valor: 'todos', etiqueta: 'Todos los medios' },
  { valor: 'azul', etiqueta: 'Azul (Tarjetas)' },
  { valor: 'bhd', etiqueta: 'Banco BHD' },
  { valor: 'popular', etiqueta: 'Banco Popular' },
];

const ESTADOS = [
  { valor: 'todos', etiqueta: 'Todos los estados' },
  { valor: 'pagados', etiqueta: 'Pagados / Cobrados' },
  // "Sometidos" va aparte de "pendientes": es el pago que ya ejecutó el cliente
  // y espera aprobación del banco (perfil empresarial de BHD). Mezclarlo con lo
  // que aún no se ha pagado esconde justo lo que hay que vigilar.
  { valor: 'sometidos', etiqueta: 'Sometidos a aprobación' },
  { valor: 'pendientes', etiqueta: 'Pendientes de pago' },
  { valor: 'fallidos', etiqueta: 'Fallidos / Cancelados' },
];

// Etiquetas legibles del bloque de discrepancias. Se muestran solo las que
// tienen filas: una tarjeta en cero es ruido, y esconde las que sí importan.
const DISCREPANCIAS: Record<string, { titulo: string; explicacion: string }> = {
  pagadas_sin_documento_sap: {
    titulo: 'Cobradas sin documento en SAP',
    explicacion: 'Se cobró pero no hay documento en el ERP. El evento pudo perderse en la cola.',
  },
  monto_no_coincide_con_banco: {
    titulo: 'Monto distinto al del banco',
    explicacion: 'Lo que reporta el banco no coincide con lo registrado.',
  },
  cobradas_sobre_orden_cancelada: {
    titulo: 'Cobradas sobre orden cancelada',
    explicacion: 'Llegó el pago cuando la orden ya estaba cancelada. Requiere revisión manual.',
  },
  atascadas_en_aprobacion: {
    titulo: 'Atascadas en aprobación',
    explicacion: 'Enviadas al banco y aún sin resolver.',
  },
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

const desplazarDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const inicioDeMes = (desplazamiento = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + desplazamiento, 1);
  return d.toISOString().slice(0, 10);
};

const finDeMesAnterior = () => {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().slice(0, 10);
};

const COLOR_PASARELA: Record<string, string> = {
  azul: 'bg-secondary text-foreground',
  bhd: 'bg-secondary text-foreground',
  popular: 'bg-secondary text-foreground',
};

const NOMBRE_PASARELA: Record<string, string> = { azul: 'Azul', bhd: 'BHD', popular: 'Popular' };

const NOMBRE_ESTADO: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  submitted: 'En proceso',
  failed: 'Fallido',
  error: 'Error',
  cancelled: 'Cancelado',
};

const COLOR_ESTADO: Record<string, string> = {
  paid: 'bg-success-soft text-success',
  pending: 'bg-warning-soft text-warning',
  submitted: 'bg-warning-soft text-warning',
  failed: 'bg-destructive-soft text-destructive',
  error: 'bg-destructive-soft text-destructive',
  cancelled: 'bg-secondary text-muted-foreground',
};

const POR_PAGINA = 50;

export default function PaymentLinksReport() {
  const { toast } = useToast();
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [datos, setDatos] = useState<ReporteConciliacion | null>(null);
  const [pagina, setPagina] = useState(0);

  const [filtros, setFiltros] = useState<ReporteConciliacionFiltros>({
    date_from: inicioDeMes(),
    date_to: hoyISO(),
    provider: 'todos',
    estado: 'todos',
    customer_search: '',
  });

  const cargar = useCallback(async (offsetPagina: number) => {
    setCargando(true);
    try {
      const resp = await reporteConciliacionApi.obtener({
        ...filtros,
        limit: POR_PAGINA,
        offset: offsetPagina * POR_PAGINA,
      });
      setDatos(resp);
    } catch (e: any) {
      toast({
        title: 'No se pudo cargar el reporte',
        description: e?.message || 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setCargando(false);
    }
  }, [filtros, toast]);

  useEffect(() => { cargar(pagina); }, [cargar, pagina]);

  const aplicarFiltros = () => {
    setPagina(0);
    cargar(0);
  };

  const atajo = (desde: string, hasta: string) => {
    setFiltros((f) => ({ ...f, date_from: desde, date_to: hasta }));
    setPagina(0);
  };

  const exportar = async () => {
    setExportando(true);
    try {
      await reporteConciliacionApi.descargarCsv(filtros);
      toast({ title: 'Exportación lista', description: 'Se descargó el CSV con los filtros aplicados.' });
    } catch (e: any) {
      toast({ title: 'No se pudo exportar', description: e?.message, variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  };

  const r = datos?.resumen;
  const discrepanciasConFilas = Object.entries(datos?.discrepancias || {})
    .filter(([, n]) => n > 0);
  const totalPaginas = datos ? Math.ceil(datos.paginacion.total / POR_PAGINA) : 0;

  return (
    <div className="space-y-6">
      {/* ---------- Filtros ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" type="date" value={filtros.date_from || ''}
                onChange={(e) => setFiltros((f) => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" type="date" value={filtros.date_to || ''}
                onChange={(e) => setFiltros((f) => ({ ...f, date_to: e.target.value }))} />
            </div>
            <div>
              <Label>Medio de pago</Label>
              <Select value={filtros.provider}
                onValueChange={(v) => setFiltros((f) => ({ ...f, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PASARELAS.map((p) => (
                    <SelectItem key={p.valor} value={p.valor}>{p.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={filtros.estado}
                onValueChange={(v) => setFiltros((f) => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e.valor} value={e.valor}>{e.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cliente">Cliente</Label>
              <Input id="cliente" placeholder="Nombre, RNC/cédula o teléfono"
                value={filtros.customer_search || ''}
                onChange={(e) => setFiltros((f) => ({ ...f, customer_search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-1">Atajos:</span>
            <Button variant="outline" size="sm" onClick={() => atajo(hoyISO(), hoyISO())}>Hoy</Button>
            <Button variant="outline" size="sm" onClick={() => atajo(desplazarDias(-1), desplazarDias(-1))}>Ayer</Button>
            <Button variant="outline" size="sm" onClick={() => atajo(desplazarDias(-7), hoyISO())}>Últimos 7 días</Button>
            <Button variant="outline" size="sm" onClick={() => atajo(inicioDeMes(), hoyISO())}>Este mes</Button>
            <Button variant="outline" size="sm" onClick={() => atajo(inicioDeMes(-1), finDeMesAnterior())}>Mes anterior</Button>

            <div className="ml-auto flex gap-2">
              <Button onClick={aplicarFiltros} disabled={cargando}>
                <RefreshCw className={`h-4 w-4 mr-2 ${cargando ? 'animate-spin' : ''}`} />
                Aplicar
              </Button>
              <Button variant="outline" onClick={exportar} disabled={exportando || !datos?.detalle.length}>
                <Download className="h-4 w-4 mr-2" />
                {exportando ? 'Exportando…' : 'Exportar CSV'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- KPIs ---------- */}
      {r && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total cobrado</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{formatCurrency(r.total_cobrado)}</p>
              <p className="text-xs text-muted-foreground mt-1">{r.transacciones_pagadas} transacciones</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Ticket promedio</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{formatCurrency(r.ticket_promedio)}</p>
              <p className="text-xs text-muted-foreground mt-1">Conversión {r.tasa_conversion}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pendiente por cobrar</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{formatCurrency(r.pendiente_por_cobrar)}</p>
              <p className="text-xs text-muted-foreground mt-1">Solo enlaces activos sin vencer</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Desglose por pasarela</p>
              <div className="space-y-1">
                {r.por_pasarela.filter((p) => p.transacciones > 0).map((p) => (
                  <div key={p.pasarela} className="flex items-center justify-between text-sm">
                    <Badge variant="secondary" className={`border-transparent ${COLOR_PASARELA[p.pasarela] || ''}`}>
                      {NOMBRE_PASARELA[p.pasarela] || p.pasarela}
                    </Badge>
                    <span className="font-semibold tabular-nums">{formatCurrency(p.monto)}</span>
                  </div>
                ))}
                {!r.por_pasarela.some((p) => p.transacciones > 0) && (
                  <p className="text-sm text-muted-foreground">Sin cobros en el rango</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------- Discrepancias ---------- */}
      {discrepanciasConFilas.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
              Requieren revisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {discrepanciasConFilas.map(([clave, n]) => (
                <div key={clave} className="flex items-start gap-3 rounded-md bg-warning-soft p-3">
                  <span className="font-display text-xl font-semibold tabular-nums text-warning">{n}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {DISCREPANCIAS[clave]?.titulo || clave}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {DISCREPANCIAS[clave]?.explicacion || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------- Aviso de fiabilidad ---------- */}
      {datos?.aviso && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">{datos.aviso}</AlertDescription>
        </Alert>
      )}

      {/* ---------- Detalle ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Detalle {datos ? `(${datos.paginacion.total})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Orden</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">RNC / Tel.</th>
                  <th className="py-2 pr-3 font-medium">Medio</th>
                  <th className="py-2 pr-3 font-medium">Ref. banco</th>
                  <th className="py-2 pr-3 font-medium text-right">Monto</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">SAP</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Cargando…</td></tr>
                )}
                {!cargando && !datos?.detalle.length && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No hay movimientos con estos filtros.
                  </td></tr>
                )}
                {!cargando && datos?.detalle.map((f) => (
                  <tr key={f.token} className="border-b last:border-0 hover:bg-secondary/50">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {f.fecha ? new Date(f.fecha).toLocaleString('es-DO', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }) : '—'}
                    </td>
                    <td className="py-2 pr-3 font-medium">{f.orden}</td>
                    <td className="py-2 pr-3">{f.cliente || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {f.documento || f.telefono || '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className={`border-transparent ${COLOR_PASARELA[f.pasarela] || ''}`}>
                        {NOMBRE_PASARELA[f.pasarela] || f.pasarela}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.referencia_bancaria || '—'}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatCurrency(f.monto)}
                      {/* Solo se señala cuando el banco reporta algo distinto. */}
                      {f.monto_banco !== null && Math.abs(f.monto_banco - f.monto) > 0.01 && (
                        <span className="block text-xs font-normal text-destructive">
                          banco: {formatCurrency(f.monto_banco)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className={'border-transparent ' + (COLOR_ESTADO[f.estado_pago || ''] || 'bg-secondary text-muted-foreground')}>
                        {NOMBRE_ESTADO[f.estado_pago || ''] || f.estado_pago || '—'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.documento_sap || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Página {pagina + 1} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagina === 0 || cargando}
                  onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={pagina + 1 >= totalPaginas || cargando}
                  onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
