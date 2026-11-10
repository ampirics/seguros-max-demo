/**
 * Configuración de debugging para autenticación
 */

export const authDebug = {
  // Activar/desactivar logs detallados
  enabled: process.env.NODE_ENV === 'development',
  
  // Configuraciones específicas
  logTokenChecks: true,
  logApiRequests: true,
  logAuthFlow: true,
  
  // Intervalos de verificación (en milisegundos)
  tokenCheckInterval: 5 * 60 * 1000, // 5 minutos
  
  // Buffer de expiración de token (en segundos)
  tokenExpirationBuffer: 60, // 1 minuto
}

/**
 * Función helper para logs condicionales
 */
export function debugLog(category: keyof typeof authDebug, message: string, ...args: any[]) {
  if (!authDebug.enabled) return
  
  const shouldLog = authDebug[category as keyof typeof authDebug]
  if (shouldLog) {
  }
}

/**
 * Función para verificar si un token JWT está cerca de expirar
 */
export function isTokenNearExpiration(token: string, bufferSeconds: number = authDebug.tokenExpirationBuffer): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    const timeToExpire = payload.exp - currentTime
    
    debugLog('logTokenChecks', `Token expira en ${timeToExpire} segundos`)
    
    return timeToExpire <= bufferSeconds
  } catch (error) {
    debugLog('logTokenChecks', 'Error verificando expiración de token:', error)
    return true // Asumir expirado si no se puede verificar
  }
}

/**
 * Función para obtener información del token para debugging
 */
export function getTokenInfo(token: string): any {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    const timeToExpire = payload.exp - currentTime
    
    return {
      userId: payload.sub,
      email: payload.email || payload.user_email,
      role: payload.user_role,
      issuedAt: new Date(payload.iat * 1000).toISOString(),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      timeToExpire: timeToExpire,
      isExpired: timeToExpire <= 0,
      isNearExpiration: timeToExpire <= authDebug.tokenExpirationBuffer
    }
  } catch (error) {
    return { error: 'Invalid token format' }
  }
}