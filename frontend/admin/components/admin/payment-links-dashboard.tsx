"use client"

import { useState, useEffect } from 'react';
import { useAdmin } from "@/contexts/admin-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  ExternalLink,
  Clock,
  XCircle,
  AlertCircle,
  Plus,
  Edit,
  RotateCcw,
  RefreshCw,
  Search,
  DollarSign,
  Link,
  TrendingUp,
  X,
  MessageCircle,
  MoreHorizontal,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/** Fecha y hora en República Dominicana (antes: solo el día, en la zona del navegador). */
const formatRD = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return d.toLocaleString('es-DO', {
    timeZone: 'America/Santo_Domingo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};
import { useToast } from "@/components/ui/use-toast";
import { paymentLinksAdminApi } from "@/lib/payment-links-api";
import { 
  PaymentLink, 
  PaymentLinkCreate, 
  PaymentLinkUpdate, 
  PaymentLinkStats 
} from "@/lib/payment-links-types";

export default function PaymentLinksDashboard({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  // Hooks de React y estado
  const { user, isLoading: authLoading } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PaymentLinkStats | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [limit, setLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Espera al dejar de teclear y vuelve a la página 1 (antes cada tecla
  // recargaba estadísticas y lista, y se podía quedar en una página vacía).
  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput.trim()); setCurrentPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: '',
    includeAllDates: false
  });
  // El botón «Crear link de pago» está en la cabecera de la página, fuera de las pestañas.
  const showCreateModal = createOpen;
  const setShowCreateModal = onCreateOpenChange;
  const [total, setTotal] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [searchingOrder, setSearchingOrder] = useState(false);
  const { toast } = useToast();

  // Formulario para crear/editar
  const [formData, setFormData] = useState<PaymentLinkCreate>({
    order_id: undefined, // Campo opcional
    amount: 0,
    currency: 'DOP',
    description: '',
    recipient_name: '',
    recipient_email: '',
    reference: '',
    custom_message: '',
    expires_in_hours: undefined,
    auto_capture: true,
    allowed_providers: []
  });

  // Funciones auxiliares
  const resetForm = () => {
    setFormData({
      order_id: undefined, // Campo opcional
      amount: 0,
      currency: 'DOP',
      description: '',
      recipient_name: '',
      recipient_email: '',
      reference: '',
      custom_message: '',
      expires_in_hours: undefined,
      auto_capture: true,
      allowed_providers: []
    });
  };

  // Funciones para manejar filtros de fecha
  const handleDateFilter = (dateFrom: string, dateTo: string, includeAllDates: boolean = false) => {
    setDateFilter({ from: dateFrom, to: dateTo, includeAllDates });
    setCurrentPage(1);
  };

  const handleOrderSearch = async (orderId: string) => {
    if (!orderId.trim()) {
      setOrderSearch('');
      return;
    }

    try {
      setSearchingOrder(true);
      setOrderSearch(orderId);
      
      // Obtener el token de autenticación
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast({
          title: "Error de autenticación",
          description: "No hay sesión activa. Por favor, inicia sesión nuevamente.",
          variant: "destructive",
        });
        return;
      }
      
      // Buscar la orden en el backend usando la ruta correcta
      const response = await fetch(`/api/v1/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        toast({
          title: "Orden no encontrada",
          description: `No se encontró la orden ${orderId}`,
          variant: "destructive",
        });
        return;
      }
      
      const order = await response.json();
      
      // Autocompletar el formulario con los datos de la orden
      setFormData({
        ...formData,
        order_id: order.order_number || order.id,
        amount: order.total || 0,
        description: `Pago para orden ${order.order_number || order.id}`,
        recipient_name: order.customer?.name || order.customer_info?.name || '',
        recipient_email: order.customer?.email || order.customer_info?.email || '',
        reference: order.order_number || order.id,
      });
      
      toast({
        title: "Orden encontrada",
        description: `Datos autocompletados desde orden ${order.order_number || order.id}`,
      });
      
    } catch (error) {
      console.error('Error buscando orden:', error);
      toast({
        title: "Error",
        description: "Error buscando la orden",
        variant: "destructive",
      });
    } finally {
      setSearchingOrder(false);
    }
  };

  const clearDateFilter = () => {
    setDateFilter({ from: '', to: '', includeAllDates: false });
    setCurrentPage(1);
  };

  const setLast30Days = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];
    
    handleDateFilter(dateFrom, dateTo, false);
  };

  const setLast7Days = () => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const dateFrom = sevenDaysAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];
    
    handleDateFilter(dateFrom, dateTo, false);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar estadísticas
      const statsData = await paymentLinksAdminApi.getStats();
      setStats(statsData);
      
      // Cargar payment links
      const params = {
        page: currentPage,
        limit,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateFilter.from && { date_from: dateFilter.from }),
        ...(dateFilter.to && { date_to: dateFilter.to }),
        ...(dateFilter.includeAllDates && { include_all_dates: true })
      };

  const linksData = await paymentLinksAdminApi.list(params);
      // Backend returns { payment_links, total, page, limit, total_pages, has_next, has_prev }
      // Support both backend shapes: { items: [...], ... } and { payment_links: [...], ... }
      const anyData = linksData as any;
  setPaymentLinks(anyData.payment_links ?? anyData.items ?? []);
      setTotalPages(linksData.total_pages ?? Math.ceil((linksData.total || 0) / (linksData.limit || limit)));
      setTotal(linksData.total || 0);
      setHasNext(Boolean(linksData.has_next));
      setHasPrev(Boolean(linksData.has_prev));
  // Sync current page/limit from backend in case it normalizes values
  if (linksData.page) setCurrentPage(linksData.page);
  if (linksData.limit) setLimit(linksData.limit);

      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Error cargando los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setActionLoading('create');
      // Solo lo que el backend guarda. Sin plazo manual manda la configuración
      // de la empresa (antes se enviaba 24 h siempre y la ignoraba).
      const payload: any = {
        amount: formData.amount,
        currency: formData.currency || 'DOP',
        description: formData.description,
        custom_message: formData.custom_message,
      };
      if (formData.order_id) payload.order_id = formData.order_id;
      if (formData.expires_in_hours && formData.expires_in_hours > 0) payload.expires_in_hours = formData.expires_in_hours;
      await paymentLinksAdminApi.create(payload);
      setShowCreateModal(false);
      resetForm();
      await loadData();
      
      toast({
        title: "Éxito",
        description: "Link de pago creado",
      });
    } catch (error: any) {
      console.error('Error creating payment link:', error);
      
      // El error viene del apiClient como Error con message del backend
      const errorMessage = error?.message || "Error creando el link de pago";
      const isPaidOrder = errorMessage.includes("ya está pagada") || errorMessage.includes("already paid");
      
      toast({
        title: isPaidOrder ? "Orden ya pagada" : "Error",
        description: errorMessage,
        variant: isPaidOrder ? "default" : "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async () => {
    if (!selectedLink) return;
    
    try {
      setActionLoading('update');
      // El vencimiento no se edita aquí: va firmado en el enlace y cambiarlo
      // exige un enlace nuevo («Extender»).
      const updateData: PaymentLinkUpdate = {
        description: formData.description,
        custom_message: formData.custom_message,
      };
      
      await paymentLinksAdminApi.update(selectedLink.id, updateData);
      setShowEditModal(false);
      resetForm();
      setSelectedLink(null);
      await loadData();
      
      toast({
        title: "Éxito",
        description: "Link de pago actualizado",
      });
    } catch (error) {
      console.error('Error updating payment link:', error);
      toast({
        title: "Error",
        description: "Error actualizando el link de pago",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    const paymentLink = paymentLinks.find(link => link.id === id);
    const linkInfo = paymentLink ? `#${paymentLink.id} (${paymentLink.amount} ${paymentLink.currency})` : `#${id}`;
    
    const confirmed = confirm(
      `¿Eliminar el link de pago ${linkInfo}?\n\n` +
      `Esta acción NO se puede deshacer.\n` +
      `El enlace dejará de funcionar inmediatamente.`
    );
    if (!confirmed) return;
    
    try {
      setActionLoading(`delete-${id}`);
      await paymentLinksAdminApi.delete(id);
      await loadData();
      
      toast({
        title: "Link de pago eliminado",
        description: `Link de pago ${linkInfo} eliminado`,
      });
    } catch (error) {
      console.error('Error deleting payment link:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el link de pago. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    const paymentLink = paymentLinks.find(link => link.id === id);
    const linkInfo = paymentLink ? `#${paymentLink.id} (${paymentLink.amount} ${paymentLink.currency})` : `#${id}`;
    
    const confirmed = confirm(
      `¿Anular el link de pago ${linkInfo}?\n\n` +
      `El enlace dejará de funcionar inmediatamente.\n` +
      `Podrás reactivarlo posteriormente si lo necesitas.`
    );
    if (!confirmed) return;
    
    try {
      setActionLoading(`cancel-${id}`);
      await paymentLinksAdminApi.cancel(id);
      await loadData();
      
      toast({
        title: "Link de pago anulado",
        description: `Link de pago ${linkInfo} anulado`,
      });
    } catch (error) {
      console.error('Error cancelling payment link:', error);
      toast({
        title: "Error",
        description: "No se pudo anular el link de pago. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (id: string) => {
    const paymentLink = paymentLinks.find(link => link.id === id);
    const linkInfo = paymentLink ? `#${paymentLink.id} (${paymentLink.amount} ${paymentLink.currency})` : `#${id}`;
    
    const confirmed = confirm(
      `¿Reactivar el link de pago ${linkInfo}?\n\n` +
      `El enlace volverá a funcionar.\n` +
      `Se extenderá por 24 horas desde ahora.`
    );
    if (!confirmed) return;
    
    try {
      setActionLoading(`reactivate-${id}`);
      await paymentLinksAdminApi.reactivate(id);
      await loadData();
      
      toast({
        title: "Link de pago reactivado",
        description: `Link de pago ${linkInfo} reactivado por 24 horas`,
      });
    } catch (error: any) {
      console.error('Error reactivating payment link:', error);
      const errorMessage = error?.message || "No se pudo reactivar el link de pago. Intenta nuevamente.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerateToken = async (id: string) => {
    const paymentLink = paymentLinks.find(link => link.id === id);
    const linkInfo = paymentLink ? `#${paymentLink.id}` : `#${id}`;
    
    const confirmed = confirm(
      `¿Regenerar el token de seguridad del link de pago ${linkInfo}?\n\n` +
      `Importante:\n` +
      `• El token actual dejará de funcionar\n` +
      `• Se generará un nuevo enlace de pago\n` +
      `• Tendrás que compartir el nuevo enlace`
    );
    if (!confirmed) return;
    
    try {
      setActionLoading(`regenerate-${id}`);
      await paymentLinksAdminApi.regenerateToken(id);
      await loadData();
      
      toast({
        title: "Token regenerado",
        description: `Token de seguridad regenerado para el link de pago ${linkInfo}`,
      });
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast({
        title: "Error",
        description: "No se pudo regenerar el token. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenewPaymentLink = async (id: string, hoursToExtend: number = 24) => {
    // Calcular nueva fecha de expiración para mostrar en confirmación
    const now = new Date();
    const newExpirationDate = new Date(now.getTime() + hoursToExtend * 60 * 60 * 1000);
    const formattedDate = formatRD(newExpirationDate.toISOString());
    
    const durationText = hoursToExtend === 1 ? '1 hora' : 
                        hoursToExtend === 24 ? '1 día' : 
                        hoursToExtend === 72 ? '3 días' : 
                        hoursToExtend === 168 ? '1 semana' : 
                        `${hoursToExtend} horas`;
    
    const confirmed = confirm(
      `¿Extender este enlace por ${durationText}?\n\n` +
      `Vencerá el ${formattedDate}.\n` +
      `Se genera un enlace NUEVO: el anterior deja de funcionar y hay que reenviarlo al cliente.`
    );
    if (!confirmed) return;
    
    try {
      setActionLoading(`renew-${id}`);
      await paymentLinksAdminApi.renew(id, hoursToExtend);
      await loadData();
      
      toast({
        title: "Enlace extendido",
        description: `Vence el ${formattedDate}. Copia o comparte el enlace nuevo con el cliente.`,
      });
    } catch (error) {
      console.error('Error renewing payment link:', error);
      toast({
        title: "Error",
        description: "No se pudo renovar el link de pago. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (link: PaymentLink) => {
    setSelectedLink(link);
    setFormData({
      order_id: link.order_number || link.order_id,
      amount: link.amount,
      currency: link.currency,
      description: link.description || '',
      recipient_name: link.recipient_name || '',
      recipient_email: link.recipient_email || '',
      reference: link.reference || '',
      custom_message: link.custom_message || '',
      expires_in_hours: link.expires_in_hours || 24,
      auto_capture: link.auto_capture,
      allowed_providers: link.allowed_providers || []
    });
    setShowEditModal(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado",
        description: "URL copiada al portapapeles",
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "Error copiando al portapapeles",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    // El backend devuelve ACTIVE, PAID…: antes se buscaba en minúscula y todas
    // las etiquetas salían en inglés y sin color.
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: 'Activo', className: 'bg-info-soft text-info' },
      paid: { label: 'Pagado', className: 'bg-success-soft text-success' },
      used: { label: 'Usado', className: 'bg-success-soft text-success' },
      pending: { label: 'Pago en proceso', className: 'bg-warning-soft text-warning' },
      failed: { label: 'Pago fallido', className: 'bg-destructive-soft text-destructive' },
      expired: { label: 'Vencido', className: 'bg-secondary text-muted-foreground' },
      cancelled: { label: 'Anulado', className: 'bg-secondary text-muted-foreground' },
    };
    const key = String(status || '').toLowerCase();
    const config = statusConfig[key] || { label: status, className: 'bg-secondary text-muted-foreground' };
    return <Badge variant="outline" className={`border-transparent font-medium ${config.className}`}>{config.label}</Badge>;
  };

  const linkUrl = (link: PaymentLink) =>
    (link as any).payment_url || `${window.location.origin}/pay/${link.token}`;

  const whatsappShareUrl = (link: PaymentLink) => {
    const text = `Hola, este es tu enlace de pago${link.order_number ? ` de la orden ${link.order_number}` : ''} por ${formatCurrency(link.amount)}` +
      `${link.expires_at ? ` (vence el ${formatRD(link.expires_at)})` : ''}: ${linkUrl(link)}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Effect para cargar datos
  useEffect(() => {
    if (user && !authLoading) {
      loadData();
    }
  }, [currentPage, searchTerm, statusFilter, dateFilter, user, authLoading, limit]);

  // Renders condicionales
  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Verificando autenticación…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Debes iniciar sesión como administrador para acceder a esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando links de pago…
      </div>
    );
  }

  const hasDateFilter = !!(dateFilter.from || dateFilter.to || dateFilter.includeAllDates);
  const hasFilters = !!searchTerm || statusFilter !== 'all' || hasDateFilter;

  // Acciones de cada enlace. Copiar queda fuera del menú por ser la más usada.
  const acciones = (link: PaymentLink) => {
    const status = link.status?.toLowerCase();
    const isActive = status === 'active';
    // Reactivar: el backend expone `can_reactivate` (true sólo si el status del link lo
    // permite Y la orden subyacente sigue siendo pagable). Mientras un backend viejo no
    // lo envíe, caemos al comportamiento anterior por compatibilidad.
    const canReactivate = ((link as any).can_reactivate !== undefined)
      ? (link as any).can_reactivate
      : (status === 'expired' || status === 'cancelled');
    const busy = !!actionLoading && actionLoading.endsWith(`-${link.id}`);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones del link ${link.order_number || link.id}`} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Abrir con la URL de la tienda que da el backend (antes se armaba con el dominio del backoffice). */}
          <DropdownMenuItem onClick={() => window.open(linkUrl(link), '_blank', 'noopener')}>
            <ExternalLink aria-hidden /> Abrir enlace
          </DropdownMenuItem>
          {isActive && (
            <DropdownMenuItem onClick={() => window.open(whatsappShareUrl(link), '_blank', 'noopener')}>
              <MessageCircle aria-hidden /> Compartir por WhatsApp
            </DropdownMenuItem>
          )}
          {isActive && (
            <DropdownMenuItem onClick={() => openEditModal(link)}>
              <Edit aria-hidden /> Editar descripción y mensaje
            </DropdownMenuItem>
          )}
          {canReactivate && (
            <DropdownMenuItem onClick={() => handleReactivate(link.id)}>
              <RotateCcw aria-hidden /> Reactivar
            </DropdownMenuItem>
          )}
          {isActive && (
            <>
              <DropdownMenuSeparator />
              {/* Extender genera un enlace nuevo: el anterior deja de funcionar. */}
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Extender vencimiento</DropdownMenuLabel>
              {([[1, '1 hora'], [24, '24 horas'], [72, '3 días'], [168, '1 semana']] as const).map(([horas, texto]) => (
                <DropdownMenuItem key={horas} onClick={() => handleRenewPaymentLink(link.id, horas)}>
                  <RefreshCw aria-hidden /> {texto}
                </DropdownMenuItem>
              ))}
              {/* Sin «Regenerar token»: rompía el enlace que el cliente ya tiene. */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleCancel(link.id)} className="text-destructive focus:text-destructive">
                <XCircle aria-hidden /> Anular
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const statCards = stats ? [
    { label: 'Total links', value: String(stats.total_links), hint: `${stats.active_links} activos`, Icon: Link },
    // Cobrado (enlaces pagados), no la suma de todos los enlaces emitidos.
    { label: 'Ingresos generados', value: formatCurrency(stats.used_amount ?? 0), hint: `de ${stats.used_links} pagos`, Icon: DollarSign },
    { label: 'Tasa de conversión', value: `${stats.conversion_rate.toFixed(1)}%`, hint: 'de visitas a pagos', Icon: TrendingUp },
    { label: 'Links expirados', value: String(stats.expired_links), hint: 'requieren atención', Icon: Clock },
  ] : [];

  // Render principal
  return (
    <div className="space-y-5">
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map(({ label, value, hint, Icon }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <p className="mt-1 truncate font-display text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div className="relative flex-1 md:min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="search"
            placeholder="Buscar por orden, cliente o descripción"
            aria-label="Buscar links de pago"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 bg-card pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger id="status" className="h-10 w-auto min-w-36 bg-card" aria-label="Estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              {/* PAID es el estado real de un link cobrado (118 en dev).
                  Antes aquí ponía "Usados" (USED), que no lo escribe nadie
                  —mark_as_used no tiene llamadores— y devolvía siempre 0. */}
              <SelectItem value="paid">Pagados</SelectItem>
              <SelectItem value="pending">Sometidos / pendientes</SelectItem>
              <SelectItem value="failed">Fallidos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Input
            id="date_from"
            type="date"
            aria-label="Desde"
            title="Desde"
            value={dateFilter.from}
            onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
            className="h-10 w-auto bg-card"
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            id="date_to"
            type="date"
            aria-label="Hasta"
            title="Hasta"
            value={dateFilter.to}
            onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
            className="h-10 w-auto bg-card"
          />
          <Button variant="outline" size="sm" onClick={setLast7Days}>Últimos 7 días</Button>
          <Button variant="outline" size="sm" onClick={setLast30Days}>Últimos 30 días</Button>
          <label htmlFor="include_all" className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              id="include_all"
              checked={dateFilter.includeAllDates}
              onChange={(e) => setDateFilter(prev => ({ ...prev, includeAllDates: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
            Todos los registros
          </label>
          {hasDateFilter && (
            <Button variant="ghost" size="sm" onClick={clearDateFilter}>
              <X className="mr-1 h-3 w-3" aria-hidden />
              Limpiar fechas
            </Button>
          )}
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {loading ? '…' : `${total.toLocaleString('es-DO')} link${total !== 1 ? 's' : ''}`}
            {!hasDateFilter && ' · últimos 30 días'}
          </span>
        </div>
      </div>

      <Card className="overflow-hidden" aria-busy={loading}>
        {loading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando…
          </div>
        ) : !paymentLinks || paymentLinks.length === 0 ? (
          <div className="p-10 text-center">
            <Link className="mx-auto mb-3 h-12 w-12 text-muted-foreground" aria-hidden />
            <h3 className="mb-1 font-medium">{hasFilters ? 'Ningún link coincide' : 'No hay links de pago'}</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {hasFilters ? 'Prueba con otros filtros o fechas.' : 'Crea tu primer link de pago para empezar.'}
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Crear link de pago
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {(paymentLinks || []).map((link) => {
              const status = link.status?.toLowerCase();
              return (
                <div key={link.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/50">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Orden {link.order_number || '—'}</span>
                      {getStatusBadge(link.status)}
                    </div>
                    {link.description && <p className="truncate text-sm text-muted-foreground" title={link.description}>{link.description}</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Creado: {formatRD(link.created_at)}</span>
                      {link.expires_at && <span>Vence: {formatRD(link.expires_at)}</span>}
                      {/* El link está en estado reactivable pero la orden ya no es pagable:
                          se dice por qué, en vez de ofrecer una acción que el backend rechaza. */}
                      {((status === 'expired' || status === 'cancelled') && (link as any).can_reactivate === false) && (
                        <span title={`La orden está en estado ${(link as any).order_status || 'no pagable'} y ya no se puede reabrir el cobro.`}>
                          Orden no pagable
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(link.amount)}</span>
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(linkUrl(link))}
                      title="Copiar enlace de pago"
                      aria-label="Copiar enlace de pago"
                    >
                      <Copy className="h-4 w-4" aria-hidden />
                    </Button>
                    {acciones(link)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {paymentLinks.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Por página</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(parseInt(v)); setCurrentPage(1); }}>
              <SelectTrigger id="page_size" className="h-8 w-20 bg-card" aria-label="Tamaño de página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(totalPages > 1 || hasNext || hasPrev) && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { if (hasPrev) setCurrentPage(p => Math.max(1, p - 1)) }}
                disabled={!hasPrev}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Anterior
              </Button>
              <span className="text-sm font-medium">Página {currentPage} de {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { if (hasNext) setCurrentPage(p => p + 1) }}
                disabled={!hasNext}
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal Crear */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear link de pago</DialogTitle>
            <DialogDescription>
              Crea un nuevo enlace de pago para una orden específica
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="order_search">Buscar orden (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="order_search"
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Ingresa ID o número de orden (ORD-2025-000001)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleOrderSearch(orderSearch);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => handleOrderSearch(orderSearch)}
                    disabled={searchingOrder || !orderSearch.trim()}
                    className="flex items-center gap-2"
                  >
                    {searchingOrder ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Busca una orden existente para autocompletar los datos del link de pago
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="order_id">Número de orden (opcional)</Label>
                <Input
                  id="order_id"
                  type="text"
                  value={formData.order_id || ''}
                  onChange={(e) => setFormData({...formData, order_id: e.target.value || undefined})}
                  placeholder="Ej: PL-12345 o déjalo vacío para auto-generar"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Si no especificas uno, se generará automáticamente
                </p>
              </div>
              <div>
                <Label htmlFor="amount">Monto (DOP)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                  placeholder="Ej: 1500.00"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descripción del link de pago"
              />
            </div>
            <div>
              <Label htmlFor="custom_message">Mensaje personalizado</Label>
              <Textarea
                id="custom_message"
                value={formData.custom_message}
                onChange={(e) => setFormData({...formData, custom_message: e.target.value})}
                placeholder="Mensaje que verá el cliente"
              />
            </div>
            <div>
              <Label htmlFor="expires_in_hours">Vence en (horas) — opcional</Label>
              <Input
                id="expires_in_hours"
                type="number"
                min={1}
                value={formData.expires_in_hours ?? ''}
                placeholder="Según la configuración de enlaces de pago"
                onChange={(e) => setFormData({...formData, expires_in_hours: e.target.value ? Math.max(1, parseInt(e.target.value)) : undefined})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={actionLoading === 'create'}>
              {actionLoading === 'create' ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar link de pago</DialogTitle>
            <DialogDescription>
              Modifica los detalles del link de pago
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="edit_description">Descripción</Label>
              <Input
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descripción del link de pago"
              />
            </div>
            <div>
              <Label htmlFor="edit_custom_message">Mensaje personalizado</Label>
              <Textarea
                id="edit_custom_message"
                value={formData.custom_message}
                onChange={(e) => setFormData({...formData, custom_message: e.target.value})}
                placeholder="Mensaje que verá el cliente"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Para cambiar el vencimiento usa «Extender»: genera un enlace nuevo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={actionLoading === 'update'}>
              {actionLoading === 'update' ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}