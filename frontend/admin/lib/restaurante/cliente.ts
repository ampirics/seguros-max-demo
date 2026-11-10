"use client"

import { useEffect, useState } from "react"
import type { Accion, NuevaReserva } from "./servidor/motor"
import type { Cliente, Conversacion, Estado, Mensaje, Reserva, Visita } from "./tipos"

export type { Accion, NuevaReserva }

const SRV = "/srv/restaurante"

/** Estado del restaurante en vivo (una sola conexión por pestaña) y la hora del servidor, que avanza cada segundo. */
let compartido: { es: EventSource | null; estado: Estado | null; desfase: number; oyentes: Set<() => void> } = {
  es: null,
  estado: null,
  desfase: 0,
  oyentes: new Set(),
}

function conectar() {
  if (compartido.es || typeof window === "undefined") return
  const es = new EventSource(`${SRV}/stream`)
  compartido.es = es
  es.addEventListener("estado", (e) => {
    const est = JSON.parse((e as MessageEvent).data) as Estado
    compartido.estado = est
    compartido.desfase = Date.now() - est.ahora
    compartido.oyentes.forEach((f) => f())
  })
  es.onerror = () => {
    es.close()
    compartido.es = null
    setTimeout(() => compartido.oyentes.size && conectar(), 1500)
  }
}

export function useRestaurante() {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const f = () => setVersion((v) => v + 1)
    compartido.oyentes.add(f)
    conectar()
    const t = setInterval(f, 1000)
    return () => {
      compartido.oyentes.delete(f)
      clearInterval(t)
      if (!compartido.oyentes.size) {
        compartido.es?.close()
        compartido.es = null
      }
    }
  }, [])
  return { estado: compartido.estado, ahora: Date.now() - compartido.desfase }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${SRV}${ruta}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || (j && j.ok === false)) throw new Error(j?.error ?? "No se pudo completar")
  return j as T
}

export const restauranteApi = {
  accion: <T = { ok: true }>(a: Accion) => pedir<T>("/accion", { method: "POST", body: JSON.stringify(a) }),
  metricas: (dias: number, zona?: string) => pedir<import("./servidor/metricas").Metricas>(`/metricas?dias=${dias}${zona ? `&zona=${zona}` : ""}`),
  cliente: (id: string) => pedir<{ cliente: Cliente; reservas: Reserva[]; visitas: Visita[]; favoritos: string[]; conversacion: Conversacion | null }>(`/clientes/${id}`),
  visita: (id: string) => pedir<Visita>(`/visitas/${id}`),
  visitas: (o: { mesa?: string; dias?: number }) => pedir<Visita[]>(`/visitas?${new URLSearchParams(Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))}`),
  reserva: (id: string) => pedir<Reserva>(`/reservas/${id}`),
  reservas: (desde: string, hasta: string) => pedir<Reserva[]>(`/reservas?desde=${desde}&hasta=${hasta}`),
  mensajes: (convId: string) => pedir<Mensaje[]>(`/conversaciones/${convId}/mensajes`),
  escribirComoCliente: (o: { telefono: string; nombre?: string; texto: string; canal?: string }) => pedir("/simulador", { method: "POST", body: JSON.stringify(o) }),
}

export function conError(f: () => Promise<unknown>, avisar: (m: string) => void = (m) => alert(m)) {
  return f().catch((e) => avisar((e as Error).message))
}
