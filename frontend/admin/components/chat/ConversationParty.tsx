"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AlertTriangle, Globe, Instagram, Mail, MessageCircle, PhoneOff, Send } from "lucide-react"

/**
 * Quién escribe en una conversación.
 *
 * Antes se veía solo un nombre, que a veces era la empresa y a veces el número.
 * Ahora se distingue la persona del cliente al que pertenece, y se avisa cuando
 * la identificación no es segura (un mismo número en varias sucursales).
 */

// Agregar un canal es una entrada más en este mapa: ni la lista ni el
// encabezado cambian.
const CANALES: Record<string, { icono: typeof MessageCircle; etiqueta: string; clase: string }> = {
  whatsapp: { icono: MessageCircle, etiqueta: "WhatsApp", clase: "text-success" },
  instagram: { icono: Instagram, etiqueta: "Instagram", clase: "text-muted-foreground" },
  messenger: { icono: Send, etiqueta: "Messenger", clase: "text-blue-600" },
  email: { icono: Mail, etiqueta: "Correo", clase: "text-gray-600" },
  web: { icono: Globe, etiqueta: "Web", clase: "text-gray-600" },
}

export function ChannelIcon({ channel, className = "w-4 h-4" }: { channel?: string | null; className?: string }) {
  const def = CANALES[(channel || "whatsapp").toLowerCase()] ?? CANALES.web
  const Icono = def.icono
  return <Icono className={`${className} ${def.clase}`} aria-label={def.etiqueta} />
}

export function channelLabel(channel?: string | null): string {
  return (CANALES[(channel || "whatsapp").toLowerCase()] ?? CANALES.web).etiqueta
}

export interface ConversationPartyData {
  customer_name?: string | null
  contact_name?: string | null
  customer_display_name?: string | null
  contact_match?: string | null
  channel?: string | null
  customer_phone?: string | null
  cliente_telefono?: string | null
  sin_telefono?: boolean
}

const esIdentificador = (telefono?: string | null) => !!telefono && /[A-Za-z]/.test(telefono)

export function sinTelefono(c: ConversationPartyData): boolean {
  return c.sin_telefono ?? (esIdentificador(c.customer_phone) && !c.cliente_telefono)
}

/** Teléfono que se muestra: el del cliente si ya lo dio; nunca el identificador de usuario de WhatsApp (DO.1617…). */
export function telefonoVisible(c: ConversationPartyData): string {
  if (c.cliente_telefono) return c.cliente_telefono
  if (sinTelefono(c)) return "Sin teléfono"
  return c.customer_phone ?? ""
}

interface Props {
  conversation: ConversationPartyData
  /** El encabezado tiene más sitio que la fila del listado. */
  size?: "list" | "header"
  /** La fila del listado muestra el aviso de número ambiguo en su fila de badges. */
  showAmbiguous?: boolean
}

export function ConversationParty({ conversation, size = "list", showAmbiguous = true }: Props) {
  const sinTel = sinTelefono(conversation)
  const nombre = conversation.contact_name || conversation.customer_name
  const persona = (nombre && !/^WhatsApp \+[A-Za-z]/.test(nombre) ? nombre : null)
    || (sinTel ? "Cliente de WhatsApp" : nombre) || "Sin identificar"
  const soloTelefono = /^[+\d][\d\s()-]{6,}$/.test(persona) || /^(WhatsApp|Cliente) \+?\d/.test(persona)
  const empresa = conversation.customer_display_name
  // Si el contacto y el cliente se llaman igual, repetirlo no aporta nada.
  const mostrarEmpresa = !!empresa && empresa !== persona && !/^(WhatsApp|Cliente) \+?\d|^[+\d][\d\s()-]{6,}$/.test(empresa)
  const ambiguo = conversation.contact_match === "ambiguous"

  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <ChannelIcon channel={conversation.channel} className="w-3.5 h-3.5 shrink-0" />
      <span className={cn(size === "header" ? "font-medium truncate" : "font-medium text-gray-900 truncate", soloTelefono && size === "header" && "shrink-0")}>
        {soloTelefono ? persona.replace(/^(WhatsApp|Cliente) /, "") : persona}
      </span>
      {soloTelefono && size === "header" && <span className="shrink-0 text-xs text-muted-foreground">sin nombre</span>}
      {mostrarEmpresa && (
        <span className="text-xs text-gray-500 truncate" title={empresa!}>· {empresa}</span>
      )}
      {sinTel && (
        <Badge variant="outline" className="shrink-0 gap-1 px-1.5 text-[10px] font-normal text-muted-foreground"
               title="Escribe con nombre de usuario de WhatsApp. La IA le pide el número al cotizar o agendar.">
          <PhoneOff className="h-3 w-3" aria-hidden />{size === "header" ? " sin teléfono" : <span className="sr-only">sin teléfono</span>}
        </Badge>
      )}
      {ambiguo && showAmbiguous && (
        <Badge variant="outline" className="gap-1 shrink-0"
               title="Este número aparece en más de un cliente: confirma con quién hablas">
          <AlertTriangle className="w-3 h-3" /> Número en varios clientes
        </Badge>
      )}
    </span>
  )
}
