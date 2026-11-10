// Aviso de pase a vendedor: "{nombre}: {motivo}", con la etiqueta que manda el servidor (app/services/pase.py).
const SIN_MOTIVO = 'Espera un vendedor'

export function nombreVisible(nombre?: string | null, telefono?: string | null) {
  const n = (nombre ?? '').trim()
  return !n || n.startsWith('WhatsApp') ? `Cliente ${telefono ?? ''}`.trim() : n
}

export function textoAvisoPase(nombre?: string | null, telefono?: string | null, motivoTexto?: string | null) {
  const motivo = motivoTexto?.trim() || SIN_MOTIVO
  return `${nombreVisible(nombre, telefono)}: ${motivo[0].toLowerCase()}${motivo.slice(1)}`
}
