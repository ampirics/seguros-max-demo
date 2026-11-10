"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Bug, ChevronLeft, Send } from 'lucide-react'
import { toast } from 'react-toastify'
import { bugReportsAPI, type BugReport } from '@/lib/bug-reports'
import apiClient from '@/lib/api-client'

interface ReportBugButtonProps {
  triggerButton?: React.ReactNode
  className?: string
}

export function ReportBugButton({ triggerButton, className }: ReportBugButtonProps) {
  const [loading, setLoading] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'bug' as BugReport['type'],
    priority: 'medium' as BugReport['priority'],
    user_email: '',
    user_name: '',
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: ''
  })

  // Cargar configuración del botón desde la BD
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await apiClient.getStoreConfig()
        if (response?.data) {
          // Fase 1 Security: Leemos la llave ofuscada. Si no existe, el default es false.
          setIsEnabled(response.data._feat_br === true)
        }
      } catch (error) {
        console.error('Error loading bug report config:', error)
        // Por defecto apagado
        setIsEnabled(false)
      }
    }
    loadConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await bugReportsAPI.createReport({
        ...formData,
        ...(formData.type === 'bug' && {
          steps_to_reproduce: formData.steps_to_reproduce,
          expected_behavior: formData.expected_behavior,
          actual_behavior: formData.actual_behavior
        })
      })

      toast.success('¡Reporte enviado exitosamente! Gracias por tu colaboración.')
      setIsExpanded(false)
      
      // Resetear formulario
      setFormData({
        title: '',
        description: '',
        type: 'bug',
        priority: 'medium',
        user_email: '',
        user_name: '',
        steps_to_reproduce: '',
        expected_behavior: '',
        actual_behavior: ''
      })
    } catch (error) {
      console.error('Error sending report:', error)
      toast.error('Error al enviar el reporte. Por favor, inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!isEnabled) return null

  return (
    <>
      {/* Pestaña flotante - Siempre visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`fixed right-0 top-1/2 transform -translate-y-1/2 z-40 flex items-center gap-2 bg-primary hover:bg-primary/85 text-primary-foreground px-4 py-3 rounded-l-lg shadow-2xl transition-all duration-300 group hover:px-5 ${
          isExpanded ? 'opacity-60 hover:opacity-100' : 'opacity-100'
        }`}
        title={isExpanded ? "Minimizar" : "Reportar Error"}
      >
        <Bug className="h-5 w-5 flex-shrink-0" />
        <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${
          isExpanded ? 'max-w-0 overflow-hidden' : 'max-w-xs'
        }`}>
          Reportar
        </span>
      </button>

      {/* Panel lateral expandible - Responsive */}
      {isExpanded && (
        <div className="fixed right-0 top-0 h-screen w-full md:w-96 bg-white shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right-0">
          {/* Header */}
          <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-lg">Reportar Error</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="hover:bg-gray-100 p-2 rounded transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-medium">Tipo</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: BugReport['type']) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="type" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Error/Bug</SelectItem>
                  <SelectItem value="feature_request">Nueva Funcionalidad</SelectItem>
                  <SelectItem value="improvement">Mejora</SelectItem>
                  <SelectItem value="question">Pregunta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioridad */}
            <div className="space-y-2">
              <Label htmlFor="priority" className="text-sm font-medium">Prioridad</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value: BugReport['priority']) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger id="priority" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Título *</Label>
              <Input
                id="title"
                placeholder="Describe brevemente..."
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="text-sm"
                required
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Descripción *</Label>
              <Textarea
                id="description"
                placeholder="Detalles del problema..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="text-sm resize-none h-24"
                required
              />
            </div>

            {/* Pasos para reproducir (solo si es bug) */}
            {formData.type === 'bug' && (
              <div className="space-y-2">
                <Label htmlFor="steps" className="text-sm font-medium">Pasos para reproducir</Label>
                <Textarea
                  id="steps"
                  placeholder="1. Voy a...&#10;2. Hago clic...&#10;3. Veo que..."
                  value={formData.steps_to_reproduce}
                  onChange={(e) => setFormData(prev => ({ ...prev, steps_to_reproduce: e.target.value }))}
                  className="text-sm resize-none h-20"
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={formData.user_email}
                onChange={(e) => setFormData(prev => ({ ...prev, user_email: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Botón enviar */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/85 text-primary-foreground text-sm"
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Enviando...' : 'Enviar Reporte'}
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
