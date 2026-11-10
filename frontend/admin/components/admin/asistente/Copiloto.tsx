'use client'

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, RotateCcw, Send, Sparkles } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { AIAssistantResponse } from "@/lib/api-types"
import { cn } from "@/lib/utils"
import { useVertical } from "@/lib/vertical"
import { Markdown } from "./Markdown"

// Copiloto interno: preguntas en lenguaje natural sobre los datos de la empresa.

interface Message {
  id: string
  content: string
  isUser: boolean
  at: Date
}

interface ResumenRestaurante {
  ventas_hoy: number
  mesas_ocupadas: number
  reservas_hoy: number
  conversaciones: number
}

interface Resumen {
  total_orders?: number
  new_orders?: number
  active_conversations?: number
  total_users?: number
}

const BIENVENIDA = "Hola, soy el asistente de La Casa del Colt. Pregúntame por pedidos, clientes, piezas o conversaciones."
const BIENVENIDA_RESTAURANTE = "Hola, soy el asistente de Boca Marina. Pregúntame por ventas, mesas, reservas, platos, meseros o clientes."
const SRV_COPILOTO = "/srv/restaurante/copiloto"
const hora = (d: Date) => d.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" })

export function Copiloto() {
  const restaurante = useVertical() === "restaurante"
  const bienvenida = restaurante ? BIENVENIDA_RESTAURANTE : BIENVENIDA
  const [messages, setMessages] = useState<Message[]>(() => [{ id: "welcome", content: bienvenida, isUser: false, at: new Date() }])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [resumenRestaurante, setResumenRestaurante] = useState<ResumenRestaurante | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const preguntó = messages.some((m) => m.isUser)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isLoading])

  useEffect(() => {
    setMessages((prev) => (prev.length === 1 && !prev[0].isUser ? [{ ...prev[0], content: bienvenida }] : prev))
  }, [bienvenida])

  useEffect(() => {
    if (!restaurante) return
    let active = true
    fetch(SRV_COPILOTO).then((r) => r.json()).then((d) => {
      if (!active) return
      setSuggestions(d.sugerencias ?? [])
      setResumenRestaurante(d.resumen ?? null)
    }).catch(() => {})
    return () => { active = false }
  }, [restaurante])

  useEffect(() => {
    if (restaurante) return
    let active = true
    Promise.allSettled([apiClient.getAISuggestions(), apiClient.getBusinessStats()]).then(([sug, st]) => {
      if (!active) return
      if (sug.status === "fulfilled") setSuggestions(sug.value?.suggestions || [])
      if (st.status === "fulfilled" && st.value?.stats) setResumen(st.value.stats)
    })
    return () => { active = false }
  }, [restaurante])

  const send = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || isLoading) return
    const ts = Date.now()
    setMessages((prev) => [...prev, { id: `u-${ts}`, content: question, isUser: true, at: new Date() }])
    setInput("")
    setIsLoading(true)
    try {
      if (restaurante) {
        const historial = messages.filter((m) => m.id !== "welcome" && !m.id.startsWith("welcome-")).map((m) => ({ de: m.isUser ? "usuario" : "asistente", texto: m.content }))
        const r = await fetch(SRV_COPILOTO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta: question, historial }) })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? "Error del asistente")
        setMessages((prev) => [...prev, { id: `a-${ts}`, content: d.respuesta, isUser: false, at: new Date() }])
        if (d.sugerencias?.length) setSuggestions(d.sugerencias)
      } else {
        const response: AIAssistantResponse = await apiClient.chatWithAssistant(question)
        setMessages((prev) => [...prev, { id: `a-${ts}`, content: response.response, isUser: false, at: new Date() }])
        if (response.suggestions?.length) setSuggestions(response.suggestions)
      }
    } catch (error) {
      console.error("Error sending message to AI:", error)
      setMessages((prev) => [...prev, { id: `e-${ts}`, content: "No pude procesar la pregunta. Inténtalo de nuevo.", isUser: false, at: new Date() }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const reiniciar = () => {
    setMessages([{ id: `welcome-${Date.now()}`, content: bienvenida, isUser: false, at: new Date() }])
    setInput("")
    inputRef.current?.focus()
  }

  const rdCorto = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M` : n >= 10_000 ? `${Math.round(n / 1000)} mil` : n.toLocaleString("es-DO"))
  const datos = restaurante ? resumenRestaurante && [
    { valor: rdCorto(resumenRestaurante.ventas_hoy), texto: "RD$ vendidos hoy" },
    { valor: resumenRestaurante.mesas_ocupadas, texto: "mesas ocupadas" },
    { valor: resumenRestaurante.reservas_hoy, texto: "reservas de hoy" },
    { valor: resumenRestaurante.conversaciones, texto: "conversaciones abiertas" },
  ] : resumen && [
    { valor: resumen.total_orders ?? 0, texto: "pedidos en total" },
    { valor: resumen.new_orders ?? 0, texto: "nuevos esta semana" },
    { valor: resumen.active_conversations ?? 0, texto: "conversaciones activas" },
    { valor: resumen.total_users ?? 0, texto: "usuarios del equipo" },
  ]

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] min-h-[480px] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:h-[calc(100dvh-12rem)]">
        {/* Encabezado como el de un chat */}
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden>
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold">Asistente de negocio</h2>
            <p className="truncate text-xs text-muted-foreground">{restaurante ? "Responde con los datos de Boca Marina en vivo" : "Responde con los datos de la empresa activa"}</p>
          </div>
          {preguntó && (
            <Button variant="ghost" size="sm" onClick={reiniciar} disabled={isLoading} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Nueva conversación
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-chat px-3 py-4 [scrollbar-width:thin] md:px-[6%]" aria-live="polite">
          <div className="space-y-1.5">
            {messages.map((m, i) => (
              <div key={m.id}>
                <div className={cn("flex", m.isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm shadow-sm",
                      m.isUser ? "max-w-[80%] whitespace-pre-wrap rounded-tr-sm bg-primary text-primary-foreground" : "max-w-[92%] rounded-tl-sm bg-card dark:bg-secondary"
                    )}
                  >
                    {m.isUser ? m.content : <Markdown texto={m.content} />}
                    <span className={cn("mt-0.5 block text-right text-[11px]", m.isUser ? "text-primary-foreground/75" : "text-muted-foreground")}>
                      {hora(m.at)}
                    </span>
                  </div>
                </div>
                {/* Resumen de la empresa, en cifras, justo después de la bienvenida */}
                {i === 0 && datos && (
                  <div className="mt-1.5 flex justify-start">
                    <div className="w-full max-w-[80%] rounded-lg rounded-tl-sm bg-card px-3 py-2.5 shadow-sm dark:bg-secondary">
                      <p className="text-xs text-muted-foreground">{restaurante ? "Así va el restaurante ahora" : "Resumen rápido de tu empresa"}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {datos.map((d) => (
                          <div key={d.texto} className="rounded-md bg-background/70 px-2.5 py-2">
                            <dt className="sr-only">{d.texto}</dt>
                            <dd className="font-display text-xl font-semibold tabular-nums">{typeof d.valor === "number" ? d.valor.toLocaleString("es-DO") : d.valor}</dd>
                            <dd className="text-[11px] leading-tight text-muted-foreground">{d.texto}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start" role="status" aria-label="El asistente está pensando">
                <div className="flex items-center gap-1 rounded-lg rounded-tl-sm bg-card px-3 py-3 shadow-sm dark:bg-secondary">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Antes de la primera pregunta, las sugerencias van al centro como punto de partida */}
            {!preguntó && suggestions.length > 0 && (
              <div className="pt-6">
                <p className="mb-2 text-center text-xs text-muted-foreground">Prueba con una de estas preguntas</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {suggestions.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={isLoading}
                      className="rounded-lg border bg-card/80 px-3 py-2.5 text-left text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t bg-card px-3 pb-3 pt-2">
          {preguntó && suggestions.length > 0 && (
            <div className="scrollbar-hide -mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={isLoading}
                  className="h-7 shrink-0 rounded-control bg-secondary px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form className="flex items-end gap-1.5" onSubmit={(e) => { e.preventDefault(); send() }}>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={restaurante ? "Pregunta por ventas, mesas, reservas o platos" : "Pregunta por pedidos, clientes o productos"}
              aria-label="Pregunta para el asistente"
              disabled={isLoading}
              className="h-10 flex-1 rounded-control border-transparent bg-secondary"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isLoading || !input.trim()} aria-label="Enviar pregunta">
              {isLoading ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            </Button>
          </form>
        </div>
    </div>
  )
}
