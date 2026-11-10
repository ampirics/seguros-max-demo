// Payment Links API Types
export interface PaymentLink {
  id: string;  // UUID
  token: string;
  order_id?: string; // UUID como string
  company_id: number;
  amount: number;
  currency: string;
  description?: string;
  recipient_name?: string;
  recipient_email?: string;
  reference?: string;
  custom_message?: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  expires_in_hours: number;
  payment_url: string;
  auto_capture: boolean;
  allowed_providers: string[];
  expires_at: string;
  used_at?: string;
  created_at: string;
  updated_at: string;
  order_number?: string; // Número de orden para mostrar
}

export interface PaymentLinkCreate {
  order_id?: string; // Cambiado a string opcional
  amount: number;
  currency?: string;
  description?: string;
  recipient_name?: string;
  recipient_email?: string;
  reference?: string;
  custom_message?: string;
  expires_in_hours?: number;  // sin valor: manda la configuración de la empresa
  auto_capture?: boolean;
  allowed_providers?: string[];
}

export interface PaymentLinkUpdate {
  status?: PaymentLink['status'];
  description?: string;
  custom_message?: string;
  expires_in_hours?: number;
  auto_capture?: boolean;
  allowed_providers?: string[];
}

export interface PaymentLinkStats {
  total_links: number;
  active_links: number;
  used_links: number;
  expired_links: number;
  recent_links_30d: number;
  recent_used_30d: number;
  total_amount: number;
  used_amount: number;
  conversion_rate: number;
  successful_payments?: number; // Opcional para compatibilidad
}

export interface PaymentLinkListResponse {
  payment_links: PaymentLink[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaymentProvider {
  key: string;
  name: string;
  enabled: boolean;
}

export interface PaymentProvidersResponse {
  providers: PaymentProvider[];
  total: number;
  company_id?: number;
}

export interface PaymentProcessingRequest {
  provider: string;
  customer_info: {
    name: string;
    email: string;
    phone?: string;
    document_type?: string;
    document_number?: string;
  };
  payment_method?: string;
  card_number?: string;
  expiry_month?: string;
  expiry_year?: string;
  cvv?: string;
  cardholder_name?: string;
  return_url?: string;
  cancel_url?: string;
  metadata?: Record<string, any>;
}

export interface PaymentProcessingResponse {
  success: boolean;
  status: string;
  redirect_url?: string;
  form_html?: string;
  payment_link_id?: string;
  payment_id?: string;
  transaction_id?: string;
  message?: string;
  error?: string;
}

export interface CompanyTheme {
  name: string;
  logo_url?: string | null;
  primary_color: string;
  accent_color: string;
  background?: string | null;
  background_color?: string | null;
  support_phone?: string | null;
  support_email?: string | null;
}

export interface PaymentLinkValidation {
  valid: boolean; // Cambiado de is_valid a valid para coincidir con el backend
  token: string;
  reason?: string;
  amount?: number; // Datos del payment link vienen directamente aquí
  currency?: string;
  description?: string;
  expires_at?: string;
  order_id?: string;
  payment_link?: PaymentLink; // Mantenemos por compatibilidad
  order?: {
    id: string | number;
    order_number: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    total: number;
    status?: string;
  };
  company_theme?: CompanyTheme;
  message?: string;
  error?: string;
}
