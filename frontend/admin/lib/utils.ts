import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import DOMPurify from "dompurify";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// En lib/utils.ts - Agrega una función de sanitización
export function sanitizeHtml(content: string = ''): string {
  return DOMPurify.sanitize(content || '', {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

export function sanitizeText(text: string = ''): string {
  return DOMPurify.sanitize(text || '', { ALLOWED_TAGS: [] });
}

// Formateo de números y monedas centralizado
export function formatNumber(
  value: number | string | null | undefined,
  opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number; locale?: string }
) {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2, locale = 'es-DO' } = opts || {};
  if (value === null || value === undefined) return '';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!isFinite(num)) return String(value);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num as number);
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency = 'DOP',
  opts?: { locale?: string }
) {
  const { locale = 'es-DO' } = opts || {};
  if (value === null || value === undefined) return '';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!isFinite(num)) return String(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num as number);
}

export function formatWhatsappUrl(phone?: string, text?: string): string {
  const defaultPhone = "18096841243";
  let clean = (phone || "").replace(/[^0-9]/g, "");
  if (!clean) {
    clean = defaultPhone;
  } else if (clean.length === 10 && ["809", "829", "849"].some(p => clean.startsWith(p))) {
    clean = "1" + clean;
  }
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${clean}${encodedText}`;
}

export const nombrePieza = (nombre?: string | null) =>
  (nombre ?? '').replace(/\s*\bCC-[A-Z0-9]+(?:-[A-Z0-9]+)*/g, '').replace(/\s{2,}/g, ' ').trim();
