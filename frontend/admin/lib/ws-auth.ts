/**
 * Autenticación de WebSockets sin poner el token en la URL.
 *
 * El JWT RS256 mide ~2 KB: en la URL (?token=…) superaba el límite de ~2048
 * caracteres del WAF del ALB, que respondía 403 (el navegador solo ve un 1006)
 * y el tiempo real quedaba caído. Además el token acababa en los logs de acceso.
 * Ahora viaja como subprotocolo ("jwt.<token>") en Sec-WebSocket-Protocol.
 */
import { apiClient } from "./api-client"
import { decodeJWT, setAuthToken } from "./auth"

export const WS_AUTH_SUBPROTOCOL = "wacommerce.auth"

/** Cierre del servidor por empresa no autorizada en el socket. */
export const WS_CLOSE_EMPRESA = 1008

/**
 * URL ws(s):// de una ruta del tiempo real: host de NEXT_PUBLIC_WS_HOST, si no el de NEXT_PUBLIC_API_URL (si es
 * absoluta), si no el del panel (que lo pasa al backend con los rewrites de next.config.mjs).
 */
export function urlTiempoReal(ruta: string): string {
  if (typeof window === "undefined") return ""
  let host = process.env.NEXT_PUBLIC_WS_HOST || ""
  let seguro = window.location.protocol === "https:"
  const api = process.env.NEXT_PUBLIC_API_URL
  if (!host && api && /^https?:\/\//.test(api)) {
    try {
      const url = new URL(api)
      host = url.host
      seguro = url.protocol === "https:"
    } catch { /* URL mal escrita: se usa el host del panel */ }
  }
  return `${seguro ? "wss" : "ws"}://${host || window.location.host}${ruta.startsWith("/") ? ruta : `/${ruta}`}`
}

export function wsAuthProtocols(tokenKey = "auth_token"): string[] | undefined {
  if (typeof window === "undefined") return undefined
  const token = localStorage.getItem(tokenKey)
  return token ? [WS_AUTH_SUBPROTOCOL, `jwt.${token}`] : undefined
}

let pendiente: Promise<boolean> | null = null
const rechazadas = new Set<string>()

/**
 * Si el token no trae la empresa activa del panel, pide uno con /auth/select-company.
 * Un intento por token y empresa: si falla no se repite hasta que cambie el token.
 */
export function asegurarEmpresaEnToken(companyId?: string | null): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  let token: string | null = null
  let empresa: string | null = companyId ?? null
  try {
    token = localStorage.getItem("auth_token")
    empresa = empresa || localStorage.getItem("active_company_id")
  } catch {
    return Promise.resolve(false)
  }
  if (!token || !empresa) return Promise.resolve(false)
  if (String(decodeJWT(token)?.active_company_id ?? "") === empresa) return Promise.resolve(true)
  const clave = `${empresa}:${token.slice(-24)}`
  if (rechazadas.has(clave)) return Promise.resolve(false)
  if (!pendiente) {
    pendiente = apiClient
      .selectCompany({ company_id: empresa })
      .then((r) => {
        if (!r?.access_token) throw new Error("sin token")
        setAuthToken(r.access_token)
        return true
      })
      .catch(() => {
        rechazadas.add(clave)
        return false
      })
      .finally(() => {
        pendiente = null
      })
  }
  return pendiente
}
