import { config } from "@/lib/config"
import { MockResponse, matchRoute, type MockContext } from "./handlers"
import { ensureProducts } from "./store"
import { esRestaurante, puenteTiempoReal } from "./restaurante"
import { esSeguros, puenteSeguros } from "./seguros"

const LATENCY_MS = 150
const LIST_HINT = /(s|list|items|logs|history|lite|requests|recipients|contacts|notes|tags)$/

declare global {
  interface Window {
    __coltMockInstalled?: boolean
  }
}

function apiPath(url: URL): string | null {
  let apiOrigin = ""
  try {
    apiOrigin = new URL(config.api.baseUrl, window.location.origin).origin
  } catch {
    apiOrigin = ""
  }
  if (url.origin !== apiOrigin && url.origin !== window.location.origin) return null
  if (!url.pathname.startsWith("/api/")) return null
  const path = url.pathname.replace(/^\/api(\/v\d+)?/, "").replace(/\/+$/, "")
  return path || "/"
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<any> {
  let body: any = init?.body
  if (body == null && input instanceof Request) body = await input.clone().text()
  if (body == null || body === "") return undefined
  if (typeof body === "string") {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  if (body instanceof FormData || body instanceof URLSearchParams) return Object.fromEntries(body.entries())
  return body
}

function toResponse(status: number, body: unknown, contentType = "application/json"): Response {
  if (status === 204 || body == null) return new Response(null, { status: status === 200 ? 204 : status })
  const text = typeof body === "string" && contentType !== "application/json" ? body : JSON.stringify(body)
  return new Response(text, { status, headers: { "content-type": contentType } })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function installFetch() {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    let url: URL
    try {
      url = new URL(rawUrl, window.location.href)
    } catch {
      return originalFetch(input, init)
    }
    const path = apiPath(url)
    if (path === null) return originalFetch(input, init)

    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
    await Promise.all([sleep(LATENCY_MS), ensureProducts(originalFetch)])

    const match = matchRoute(method, path)
    if (!match) {
      console.warn("[mock] sin handler", method, path)
      const last = path.split("/").filter(Boolean).pop() || ""
      return toResponse(200, method === "GET" && LIST_HINT.test(last) ? [] : {})
    }

    const ctx: MockContext = { method, path, params: match.params, query: url.searchParams, body: await readBody(input, init) }
    try {
      const result = await match.handler(ctx)
      if (result instanceof MockResponse) return toResponse(result.status, result.body, result.contentType)
      return toResponse(200, result ?? {})
    } catch (error) {
      console.error("[mock] error en handler", method, path, error)
      return toResponse(500, { detail: "Error en el mock" })
    }
  }
}

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3
  readyState = 0
  protocol = ""
  extensions = ""
  bufferedAmount = 0
  binaryType: BinaryType = "blob"
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  private soltar = () => {}

  constructor(public url: string) {
    super()
    setTimeout(() => {
      if (this.readyState !== 0) return
      this.readyState = 1
      const ev = new Event("open")
      this.onopen?.(ev)
      this.dispatchEvent(ev)
      const emitir = (datos: unknown) => {
        if (this.readyState !== 1) return
        const msg = new MessageEvent("message", { data: JSON.stringify(datos) })
        this.onmessage?.(msg)
        this.dispatchEvent(msg)
      }
      const a = puenteTiempoReal(url, emitir)
      const b = puenteSeguros(url, emitir)
      this.soltar = () => {
        a()
        b()
      }
    }, 50)
  }

  send() {}

  close(code = 1000, reason = "") {
    if (this.readyState >= 2) return
    this.soltar()
    this.readyState = 3
    const ev = new CloseEvent("close", { code, reason, wasClean: true })
    this.onclose?.(ev)
    this.dispatchEvent(ev)
  }
}

function installWebSocket() {
  const RealWebSocket = window.WebSocket
  const Patched = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    const href = String(url)
    if (href.includes("/_next/") || href.includes("turbopack")) return new RealWebSocket(url, protocols)
    return new MockWebSocket(href)
  } as unknown as typeof WebSocket
  Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
  window.WebSocket = Patched
}

export function installMocks() {
  if (window.__coltMockInstalled) return
  window.__coltMockInstalled = true
  installFetch()
  installWebSocket()
  console.info(esSeguros() ? "[mock] Modo demo: MAX Corredores de Seguros, con su servidor en /srv/seguros." : esRestaurante() ? "[mock] Modo demo: Boca Marina, con el servidor del restaurante en /srv/restaurante." : "[mock] Modo mock activo: datos de ejemplo de Repuestos La Casa del Colt, sin backend.")
}
