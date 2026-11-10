import type { Product } from "./types"
import { apiClient } from "./api-client"

export async function getStoreProducts(): Promise<Product[]> {
  try {
    const result = await apiClient.getProducts({})
    return result
  } catch (error) {
    console.error('getStoreProducts: Error fetching products:', error)
    return []
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    return await apiClient.getProduct(id)
  } catch (error) {
    console.error('Error fetching product:', error)
    return null
  }
}
