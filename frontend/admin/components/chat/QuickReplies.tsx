"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, ChevronDown, ChevronUp } from "lucide-react"

interface QuickReply {
  id: string
  text: string
  category: string
  emoji?: string
}

interface QuickRepliesProps {
  onSelectReply: (text: string) => void
  disabled?: boolean
}

const QUICK_REPLIES: QuickReply[] = [
  // Saludos
  { id: '1', text: '¡Hola! ¿Cómo puedo ayudarte hoy?', category: 'saludo', emoji: '👋' },
  { id: '2', text: 'Buenos días, ¿en qué puedo asistirte?', category: 'saludo', emoji: '🌅' },
  { id: '3', text: 'Buenas tardes, ¿cómo estás?', category: 'saludo', emoji: '🌇' },
  
  // Productos
  { id: '4', text: 'Te comparto información sobre nuestros productos...', category: 'productos', emoji: '🛍️' },
  { id: '5', text: '¿Qué tipo de producto te interesa?', category: 'productos', emoji: '❓' },
  { id: '6', text: 'Tenemos disponibilidad de ese producto', category: 'productos', emoji: '✅' },
  
  // Precios
  { id: '7', text: 'El precio de ese producto es...', category: 'precios', emoji: '💰' },
  { id: '8', text: '¿Te gustaría conocer nuestras ofertas especiales?', category: 'precios', emoji: '🎯' },
  
  // Entrega
  { id: '9', text: 'El tiempo de entrega es de 2-3 días hábiles', category: 'entrega', emoji: '🚚' },
  { id: '10', text: '¿Necesitas entrega a domicilio?', category: 'entrega', emoji: '🏠' },
  
  // Soporte
  { id: '11', text: 'Entiendo tu situación, vamos a solucionarlo', category: 'soporte', emoji: '🤝' },
  { id: '12', text: '¿Podrías darme más detalles sobre el problema?', category: 'soporte', emoji: '🔍' },
  { id: '13', text: 'Voy a verificar esa información para ti', category: 'soporte', emoji: '🔎' },
  
  // Despedida
  { id: '14', text: '¡Gracias por contactarnos! ¿Algo más en lo que pueda ayudarte?', category: 'despedida', emoji: '🙏' },
  { id: '15', text: 'Que tengas un excelente día', category: 'despedida', emoji: '😊' },
]

const QuickReplies = ({ onSelectReply, disabled = false }: QuickRepliesProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = Array.from(new Set(QUICK_REPLIES.map(reply => reply.category)))
  
  const filteredReplies = selectedCategory
    ? QUICK_REPLIES.filter(reply => reply.category === selectedCategory)
    : QUICK_REPLIES

  const getCategoryColor = (category: string) => {
    const colors = {
      'saludo': 'bg-success-soft text-success',
      'productos': 'bg-blue-100 text-blue-800',
      'precios': 'bg-warning-soft text-warning',
      'entrega': 'bg-secondary text-muted-foreground',
      'soporte': 'bg-destructive-soft text-destructive',
      'despedida': 'bg-gray-100 text-gray-800'
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryLabel = (category: string) => {
    const labels = {
      'saludo': 'Saludos',
      'productos': 'Productos',
      'precios': 'Precios',
      'entrega': 'Entrega',
      'soporte': 'Soporte',
      'despedida': 'Despedida'
    }
    return labels[category as keyof typeof labels] || category
  }

  if (disabled) return null

  return (
    <div>
      {/* Header: barra fina, click para abrir/cerrar. Colapsado por defecto
          para no robarle espacio al feed de mensajes. */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center space-x-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Respuestas rápidas</span>
        </span>
        {isExpanded
          ? <ChevronUp className="h-4 w-4 text-gray-500" />
          : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {/* Contenido expandible con tope de altura + scroll propio, para que
          nunca aplaste el feed de mensajes. */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 max-h-56 overflow-y-auto">
          {/* Filtros por categoría */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedCategory === null ? "default" : "secondary"}
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => setSelectedCategory(null)}
            >
              Todas
            </Badge>
            {categories.map(category => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "secondary"}
                className={`cursor-pointer hover:bg-primary hover:text-primary-foreground ${
                  selectedCategory === category ? '' : getCategoryColor(category)
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {getCategoryLabel(category)}
              </Badge>
            ))}
          </div>

          {/* Respuestas */}
          <div className="grid grid-cols-1 gap-2">
            {filteredReplies.map(reply => (
              <Button
                key={reply.id}
                variant="outline"
                size="sm"
                className="h-auto justify-start p-3 text-left"
                onClick={() => {
                  onSelectReply(reply.text)
                  setIsExpanded(false) // colapsar tras elegir para volver al feed
                }}
              >
                <div className="flex items-start space-x-2 w-full">
                  {reply.emoji && (
                    <span className="text-lg flex-shrink-0">{reply.emoji}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{reply.text}</p>
                    <Badge variant="secondary" className={`text-xs mt-1 ${getCategoryColor(reply.category)}`}>
                      {getCategoryLabel(reply.category)}
                    </Badge>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickReplies