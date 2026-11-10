import type { Product } from "./types"
import { apiClient } from "./api-client"
import { validateProduct } from "./validation"
import DOMPurify from "dompurify"
import { useCompany } from "@/contexts/company-context"

// Función auxiliar para sanitizar texto
function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text)
}

// Versión para hooks/componentes: pasar company_id explícitamente
export async function getAdminProducts(company_id?: string, limit: number = 100): Promise<Product[]> {
  try {
    const products = await apiClient.getAdminProducts({ visible_only: false, company_id, limit })
    // Sanitizamos los datos sensibles al recibirlos
    return products.map(product => ({
      ...product,
      name: sanitizeText(product.name),
      description: sanitizeText(product.description || '')
    }))
  } catch (error) {
    console.error('Error fetching admin products:', error)
    return []
  }
}

export async function createProduct(productData: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
  try {
    // Validar datos antes de enviar
    const { valid, errors, data } = validateProduct(productData)
    if (!valid) {
      throw new Error(`Datos de producto inválidos: ${errors?.join(', ')}`)
    }

    // Sanitizar campos de texto
    const sanitizedData = {
      ...data!,
      name: sanitizeText(data!.name),
      description: data!.description ? sanitizeText(data!.description) : ''
    }

    // Usar apiClient para crear el producto (debe implementar el endpoint en backend)
    const created = await apiClient.createProduct(sanitizedData)
    return created
  } catch (error) {
    console.error('Error creating product:', error)
    throw error
  }
}

export async function importProductsFromCSV(csvFile: File, dryRun = false): Promise<any> {
  try {
    // dryRun=true: el backend valida todas las filas sin guardar nada
    const result = await apiClient.importProductsFromCSV(csvFile, dryRun)
    return result
  } catch (error) {
    console.error('Error importing products from CSV:', error)
    throw error
  }
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  try {
    // Sanitizar campos de texto en las actualizaciones
    const sanitizedUpdates = { ...updates }
    if ('name' in sanitizedUpdates && sanitizedUpdates.name) {
      sanitizedUpdates.name = sanitizeText(sanitizedUpdates.name)
    }
    if ('description' in sanitizedUpdates && sanitizedUpdates.description) {
      sanitizedUpdates.description = sanitizeText(sanitizedUpdates.description)
    }
    // Asegurarse de que gallery se envía como array de strings
    if ('gallery' in sanitizedUpdates && Array.isArray(sanitizedUpdates.gallery)) {
      // Si las imágenes están en formato de objeto, extraer solo las URLs
      if (sanitizedUpdates.gallery.length > 0 && typeof sanitizedUpdates.gallery[0] === 'object') {
        sanitizedUpdates.gallery = sanitizedUpdates.gallery.map((img: any) => 
          typeof img === 'string' ? img : (img.url || img.src || '')
        ).filter(Boolean);
      }
      
      // Limitar a 10 imágenes como máximo (para coincidir con la validación del backend)
      if (sanitizedUpdates.gallery.length > 10) {
        sanitizedUpdates.gallery = sanitizedUpdates.gallery.slice(0, 10);
      }
    }
    return await apiClient.updateProduct(id, sanitizedUpdates)
  } catch (error) {
    console.error('Error updating product:', error)
    throw error
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await apiClient.deleteProduct(id)
  } catch (error) {
    console.error('Error deleting product:', error)
    throw error
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    return await apiClient.getProduct(id)
  } catch (error) {
    console.error('Error fetching product by ID:', error)
    return null
  }
}

export function initializeProducts(): void {
  // Ya no necesario - los productos vienen de la API
}

export interface BestSellerProduct {
  id: string
  name: string
  image: string
  price: number
  unit_quantity: number
  unit_type: string
  total_sold: number
  total_revenue: number
  order_count: number
}

export interface BestSellersResponse {
  best_sellers: BestSellerProduct[]
  period_days: number
  total_products: number
}

export async function getBestSellingProducts(
  limit: number = 10, 
  days: number = 30
): Promise<BestSellersResponse> {
  try {
    // Usar apiClient para llamar al backend real
    const data = await apiClient.request<BestSellersResponse>(`/admin/products/stats/best-sellers?limit=${limit}&days=${days}`);
    // Sanitizar los datos de respuesta
    return {
      ...data,
      best_sellers: data.best_sellers.map((product: BestSellerProduct) => ({
        ...product,
        name: sanitizeText(product.name)
      }))
    }
  } catch (error) {
    // Se propaga: antes un fallo se veía como «No hay datos de ventas».
    console.error('Error fetching best selling products:', error)
    throw error
  }
}
