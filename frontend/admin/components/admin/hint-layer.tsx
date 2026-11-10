"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

/**
 * Tooltips del backoffice sin tocar cada pantalla: cualquier elemento con
 * `title` (o `data-hint`) muestra su texto como tooltip con estilo al pasar el
 * mouse o al enfocarlo con teclado. El tooltip nativo tarda ~1 s y casi nadie
 * lo descubre; este aparece rápido y se lee bien.
 *
 * Mientras se muestra, el `title` se mueve a `data-hint-title` para que el
 * navegador no pinte también el suyo, y se restaura al salir.
 */
const SHOW_DELAY_MS = 300
const SELECTOR = "[data-hint], [title]"
const DISABLED_SELECTOR = ":disabled[title], :disabled[data-hint-title], :disabled[data-hint]"

/**
 * El navegador no envía eventos de mouse a controles desactivados, así que su
 * tooltip nunca saldría (p. ej. "Chat"/"WhatsApp" con la caja vacía). Se les
 * quita pointer-events para que el evento llegue al contenedor, y desde ahí se
 * busca por coordenadas qué control desactivado está bajo el puntero.
 */
const DISABLED_CSS = `${DISABLED_SELECTOR} { pointer-events: none; }`

function disabledHintAt(container: EventTarget | null, x: number, y: number): HTMLElement | null {
  if (!(container instanceof Element)) return null
  for (const el of Array.from(container.querySelectorAll<HTMLElement>(DISABLED_SELECTOR))) {
    const r = el.getBoundingClientRect()
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && hintText(el)) return el
  }
  return null
}

interface HintState {
  text: string
  rect: DOMRect
}

function hintText(el: Element) {
  return (el.getAttribute("data-hint") || el.getAttribute("data-hint-title") || el.getAttribute("title") || "").trim()
}

function findHintTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const el = node.closest(SELECTOR) as HTMLElement | null
  // El <title> de un SVG o elementos que piden no tener tooltip quedan fuera
  if (!el || el.closest("[data-hint-ignore]") || el.tagName.toLowerCase() === "svg") return null
  return hintText(el) ? el : null
}

export function HintLayer() {
  const [hint, setHint] = useState<HintState | null>(null)
  const [mounted, setMounted] = useState(false)
  const activeRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    setMounted(true)

    const restoreTitle = (el: HTMLElement) => {
      const saved = el.getAttribute("data-hint-title")
      if (saved !== null) {
        el.setAttribute("title", saved)
        el.removeAttribute("data-hint-title")
      }
    }

    const hide = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      if (activeRef.current) restoreTitle(activeRef.current)
      activeRef.current = null
      setHint(null)
    }

    const activate = (el: HTMLElement, delay: number) => {
      if (activeRef.current === el) return
      hide()
      const title = el.getAttribute("title")
      if (title !== null) {
        el.setAttribute("data-hint-title", title)
        el.removeAttribute("title")
      }
      activeRef.current = el
      timerRef.current = setTimeout(() => {
        if (activeRef.current !== el || !el.isConnected) return
        setHint({ text: hintText(el), rect: el.getBoundingClientRect() })
      }, delay)
    }

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return
      const el = disabledHintAt(e.target, e.clientX, e.clientY) || findHintTarget(e.target)
      if (el) activate(el, SHOW_DELAY_MS)
      else if (activeRef.current && !activeRef.current.contains(e.target as Node)) hide()
    }

    // Dentro del mismo contenedor no hay pointerover al entrar/salir de un control desactivado
    let moveFrame = 0
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || moveFrame) return
      const { clientX, clientY, target } = e
      moveFrame = requestAnimationFrame(() => {
        moveFrame = 0
        const disabled = disabledHintAt(target, clientX, clientY)
        const active = activeRef.current
        if (disabled) {
          activate(disabled, SHOW_DELAY_MS)
        } else if (active?.matches(":disabled")) {
          const target = findHintTarget(e.target)
          if (target) activate(target, SHOW_DELAY_MS)
          else hide()
        }
      })
    }

    const onPointerOut = (e: PointerEvent) => {
      const active = activeRef.current
      // Un control desactivado no recibe pointerout: lo resuelve onPointerMove
      if (active?.matches(":disabled")) return
      if (active && !(e.relatedTarget instanceof Node && active.contains(e.relatedTarget))) hide()
    }

    const onFocusIn = (e: FocusEvent) => {
      const el = findHintTarget(e.target)
      if (el && (e.target as Element).matches?.(":focus-visible")) activate(el, 0)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide()
    }

    const style = document.createElement("style")
    style.setAttribute("data-hint-layer", "")
    style.textContent = DISABLED_CSS
    document.head.appendChild(style)

    document.addEventListener("pointerover", onPointerOver)
    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerout", onPointerOut)
    document.addEventListener("pointerdown", hide, true)
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", hide)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", hide, true)
    window.addEventListener("blur", hide)
    return () => {
      hide()
      cancelAnimationFrame(moveFrame)
      style.remove()
      document.removeEventListener("pointerover", onPointerOver)
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerout", onPointerOut)
      document.removeEventListener("pointerdown", hide, true)
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", hide)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", hide, true)
      window.removeEventListener("blur", hide)
    }
  }, [])

  // Posición: arriba del elemento, o abajo si no cabe; siempre dentro de la ventana
  useEffect(() => {
    if (!hint || !tooltipRef.current) {
      setPosition(null)
      return
    }
    const { rect } = hint
    const tip = tooltipRef.current.getBoundingClientRect()
    const gap = 6
    const margin = 8
    let top = rect.top - tip.height - gap
    if (top < margin) top = rect.bottom + gap
    let left = rect.left + rect.width / 2 - tip.width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin))
    setPosition({ top, left })
  }, [hint])

  if (!mounted || !hint) return null

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      className="pointer-events-none fixed z-[100] max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-snug text-background shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {hint.text}
    </div>,
    document.body
  )
}
