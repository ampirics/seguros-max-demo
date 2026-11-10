import { apiClient } from './api-client';
import {
  PaymentLink,
  PaymentLinkCreate,
  PaymentLinkUpdate,
  PaymentLinkStats,
  PaymentLinkListResponse,
  PaymentProvidersResponse,
  PaymentProcessingRequest,
  PaymentProcessingResponse,
  PaymentLinkValidation
} from './payment-links-types';

// Payment Links Admin API
export const paymentLinksAdminApi = {
  // Obtener estadísticas del dashboard
  getStats: async (): Promise<PaymentLinkStats> => {
    return apiClient.request<PaymentLinkStats>('/admin/payment-links/dashboard/stats');
  },

  // Listar payment links con paginación
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    order_id?: number;
    date_from?: string;
    date_to?: string;
    include_all_dates?: boolean;
  }): Promise<PaymentLinkListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.order_id) queryParams.set('order_id', params.order_id.toString());
    if (params?.date_from) queryParams.set('date_from', params.date_from);
    if (params?.date_to) queryParams.set('date_to', params.date_to);
    if (params?.include_all_dates) queryParams.set('include_all_dates', 'true');

    const query = queryParams.toString() ? `?${queryParams}` : '';
    return apiClient.request<PaymentLinkListResponse>(`/admin/payment-links/list${query}`);
  },

  // Crear payment link
  create: async (data: PaymentLinkCreate): Promise<PaymentLink> => {
    return apiClient.request<PaymentLink>('/admin/payment-links/create', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Obtener detalles de payment link
  getDetails: async (id: string): Promise<PaymentLink> => {
    return apiClient.request<PaymentLink>(`/admin/payment-links/${id}`);
  },

  // Actualizar payment link
  update: async (id: string, data: PaymentLinkUpdate): Promise<PaymentLink> => {
    return apiClient.request<PaymentLink>(`/admin/payment-links/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Eliminar payment link
  delete: async (id: string): Promise<{ message: string }> => {
    return apiClient.request<{ message: string }>(`/admin/payment-links/${id}`, {
      method: 'DELETE'
    });
  },

  // Regenerar token
  regenerateToken: async (id: string): Promise<PaymentLink> => {
    return apiClient.request<PaymentLink>(`/admin/payment-links/${id}/regenerate-token`, {
      method: 'POST'
    });
  },

  // Renovar payment link expirado
  renew: async (id: string, hoursToExtend: number = 24): Promise<PaymentLink> => {
    return apiClient.request<PaymentLink>(`/admin/payment-links/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify({ hours_to_extend: hoursToExtend })
    });
  },

  // Reactivar payment link cancelado o expirado
  reactivate: async (id: string): Promise<PaymentLink> => {
    return apiClient.request<PaymentLink>(`/admin/payment-links/${id}/reactivate`, {
      method: 'POST'
    });
  },

  // Anular (cancelar) payment link activo
  cancel: async (id: string): Promise<{ message: string; status: string }> => {
    return apiClient.request<{ message: string; status: string }>(`/admin/payment-links/${id}/cancel`, {
      method: 'POST'
    });
  },

  // Obtener proveedores disponibles
  getProviders: async (): Promise<PaymentProvidersResponse> => {
    return apiClient.request<PaymentProvidersResponse>('/admin/payment-links/config/providers');
  }
};

// Payment Links Public API
export interface ReporteConciliacionFiltros {
  date_from?: string;
  date_to?: string;
  provider?: string;
  customer_id?: string;
  customer_search?: string;
  estado?: string;
  limit?: number;
  offset?: number;
}

export interface ReporteConciliacion {
  resumen: {
    total_cobrado: number;
    transacciones_pagadas: number;
    links_en_rango: number;
    ticket_promedio: number;
    pendiente_por_cobrar: number;
    tasa_conversion: number;
    por_pasarela: { pasarela: string; monto: number; transacciones: number }[];
  };
  discrepancias: Record<string, number>;
  detalle: {
    fecha: string | null;
    orden: string;
    cliente: string | null;
    documento: string | null;
    telefono: string | null;
    pasarela: string;
    referencia_bancaria: string | null;
    monto: number;
    monto_banco: number | null;
    estado_pago: string | null;
    estado_link: string;
    documento_sap: string | null;
    token: string;
  }[];
  paginacion: { total: number; limit: number; offset: number };
  aviso: string;
}

const construirQuery = (f: ReporteConciliacionFiltros): string => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'todos') p.append(k, String(v));
  });
  return p.toString();
};

export const reporteConciliacionApi = {
  obtener: async (filtros: ReporteConciliacionFiltros = {}): Promise<ReporteConciliacion> => {
    const qs = construirQuery(filtros);
    return apiClient.request<ReporteConciliacion>(
      `/admin/payment-links/reports${qs ? `?${qs}` : ''}`
    );
  },

  // El CSV no pasa por apiClient.request porque ese devuelve JSON; aquí hace
  // falta el cuerpo crudo para convertirlo en descarga.
  descargarCsv: async (filtros: ReporteConciliacionFiltros = {}): Promise<void> => {
    const qs = construirQuery({ ...filtros, limit: undefined, offset: undefined });
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const resp = await fetch(
      `${base}/api/v1/admin/payment-links/reports?formato=csv${qs ? `&${qs}` : ''}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!resp.ok) throw new Error(`No se pudo exportar (HTTP ${resp.status})`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conciliacion_${filtros.date_from || 'inicio'}_${filtros.date_to || 'hoy'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const paymentLinksPublicApi = {
  // Validar payment link (endpoint público)
  validate: async (token: string): Promise<PaymentLinkValidation> => {
    return apiClient.request<PaymentLinkValidation>(`/public/payment-links/validate/${token}`);
  },

  // Validar payment link con POST (alternativo)
  validatePost: async (token: string): Promise<PaymentLinkValidation> => {
    return apiClient.request<PaymentLinkValidation>('/public/payment-links/validate', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }
};

// Payment Processing API
export const paymentProcessingApi = {
  // Procesar pago desde payment link
  processPayment: async (token: string, data: PaymentProcessingRequest): Promise<PaymentProcessingResponse> => {
    return apiClient.request<PaymentProcessingResponse>(`/payment-links/${token}/process`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Obtener formulario de pago
  getPaymentForm: async (token: string, provider: string): Promise<string> => {
    return apiClient.request<string>(`/payment-links/${token}/payment-form?provider=${provider}`);
  },

  // Obtener estado de pago
  getPaymentStatus: async (token: string): Promise<PaymentLinkValidation> => {
    return apiClient.request<PaymentLinkValidation>(`/payment-links/${token}/status`);
  }
};

// Utilidades
export const paymentLinksUtils = {
  // Formatear monto
  formatAmount: (amount: number, currency: string = 'DOP'): string => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  // Formatear fecha
  formatDate: (date: string): string => {
    return new Date(date).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Generar URL completa del payment link
  generatePaymentUrl: (token: string, baseUrl?: string): string => {
    const base = baseUrl || window.location.origin;
    return `${base}/payment/${token}`;
  },

  // Validar si payment link está activo
  isActive: (paymentLink: PaymentLink): boolean => {
    if (paymentLink.status !== 'active') return false;
    return new Date(paymentLink.expires_at) > new Date();
  },

  // Calcular tiempo restante
  getTimeRemaining: (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return 'Expirado';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  // Obtener color del estado
  getStatusColor: (status: PaymentLink['status']): string => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'used': return 'text-blue-600 bg-blue-100';
      case 'expired': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  },

  // Obtener texto del estado
  getStatusText: (status: PaymentLink['status']): string => {
    switch (status) {
      case 'active': return 'Activo';
      case 'used': return 'Utilizado';
      case 'expired': return 'Expirado';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconocido';
    }
  }
};