// Types para sistema de impuestos

export interface Tax {
  id: string
  name: string
  description?: string
  percentage: number
  is_active: boolean
  is_compound: boolean
  category_codes: string[]
  created_at: string
  updated_at: string
}

export interface TaxCalculationDetail {
  tax_id: string
  name: string
  percentage: number
  subtotal_used: number
  amount: number
}

export interface TaxCalculationResponse {
  subtotal: number
  taxes: TaxCalculationDetail[]
  total_taxes: number
  total: number
}

export interface OrderItemForTaxCalculation {
  product_id?: string
  category_code?: string
  quantity: number
  unit_price: number
  unit_quantity: number
  subtotal: number
}

export interface CategoryCode {
  code: string
  product_name?: string
  name?: string
  label?: string
}

export interface TaxFormData {
  name: string
  description?: string
  percentage: number
  category_codes: string[]
  is_active: boolean
  is_compound: boolean
}
