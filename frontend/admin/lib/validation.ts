import { z } from "zod";
import type { Product } from "./types";

export const productSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string(),
  price: z.number().positive("El precio debe ser mayor que cero"),
  image: z.string().optional(),
  sku: z.string().optional(),
  external_category_code: z.string().optional(),
  sku_mask: z.string().optional(),
  gallery: z.array(z.string()).optional().default([]),
  colors: z.array(z.object({
    name: z.string(),
    value: z.string()
  })).default([]),
  sizes: z.array(z.string()).default([]),
  details: z.array(z.object({
    label: z.string(),
    value: z.string()
  })).default([]),
  generated_skus: z.array(z.object({
    sku: z.string(),
    size: z.string(),
    color: z.string(),
    combination: z.string()
  })).optional(),
  isVisible: z.boolean().default(true),
  company_id: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export function validateProduct(data: unknown): { valid: boolean; errors?: string[]; data?: Product } {
  const result = productSchema.safeParse(data);
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
    };
  }
  
  return {
    valid: true,
    data: result.data as Product,
  };
}