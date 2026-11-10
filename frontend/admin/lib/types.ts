export interface Company {
  id: string
  name: string
  description?: string
  logoUrl?: string
  isActive: boolean
}
export interface Product {
  id: string
  name: string
  description: string
  price: number
  // Nuevos campos para descuentos y ofertas
  original_price?: number
  discount_percentage?: number
  is_on_sale?: boolean
  // Nuevos campos para unidades de presentación
  unit_quantity?: number
  unit_type?: string
  // SKU y campos de categoría
  sku?: string
  external_category_code?: string
  sku_mask?: string
  // Múltiples SKUs generados
  generated_skus?: Array<{ sku: string, size: string, color: string, combination: string, active?: boolean, price?: number }>
  // Imagen principal (existente)
  image?: string
  // Array de imágenes adicionales (nueva propiedad)
  images?: string[]
  gallery?: string[]
  colors: Color[]
  sizes: string[]
  details: ProductDetail[];  // Array de detalles personalizados
  isVisible: boolean
  is_visible?: boolean  // Para compatibilidad con backend
  company_id?: string  // ID de la empresa (multi-tenant)
}

export interface Color {
  name: string
  value: string
}

export interface ProductDetail {
  label: string;  // Etiqueta (ej: "Tipo de tejido")
  value: string;  // Valor (ej: "100% algodón")
}

export interface CartItem {
  id: string
  name: string
  price: number
  color: string
  size: string
  quantity: number
  image: string
  sku?: string  // SKU específico para la variedad (color + talla)
  // Nuevos campos para descuentos y ofertas
  original_price?: number
  discount_percentage?: number
  is_on_sale?: boolean
  // Nuevos campos para unidades de presentación
  unit_quantity?: number
  unit_type?: string
  unit_measurement_id?: string  // ID de unidad de medida para agrupación
  // Campos para cálculo de impuestos
  external_category_code?: string
  category_code?: string
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user' | 'customer' | 'super_admin' | 'manager' | 'supervisor' | 'viewer' | 'editor' | 'agent';
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  must_change_password?: boolean;
  permissions?: {
    users?: { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean };
    products?: { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean };
    orders?: { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean; export?: boolean };
    dashboard?: { view?: boolean };
    [key: string]: Record<string, boolean | undefined> | undefined;
  };
}

export interface UserCreate {
  email: string;
  name?: string;
  password: string;
  role?: 'admin' | 'user' | 'customer' | 'super_admin';
  is_active?: boolean;
}

export interface UserUpdate {
  email?: string;
  name?: string;
  password?: string;
  role?: 'admin' | 'user' | 'customer' | 'super_admin';
  is_active?: boolean;
}
