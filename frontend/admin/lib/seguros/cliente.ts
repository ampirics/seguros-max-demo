"use client"

import { useEffect, useState } from "react"
import type { Accion } from "./servidor/motor"
import type { Metricas } from "./servidor/metricas"
import type { Cliente, Conversacion, Estado, Mensaje, Oportunidad, Poliza, Siniestro } from "./tipos"

export type { Accion, Metricas }

const SRV = "/srv/seguros"

const compartido: { es: EventSource | null; estado: Estado | null; desfase: number; oyentes: Set<() => void> } = { es: null, estado: null, desfase: 0, oyentes: new Set() }

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

/** Estado del corredor en vivo, una sola conexión por pestaña. */
export function useSeguros() {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const f = () => setVersion((v) => v + 1)
    compartido.oyentes.add(f)
    conectar()
    const t = setInterval(f, 15000)
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

export const segurosApi = {
  accion: <T = { ok: true }>(a: Accion) => pedir<T>("/accion", { method: "POST", body: JSON.stringify(a) }),
  metricas: (dias: number) => pedir<Metricas>(`/metricas?dias=${dias}`),
  cliente: (id: string) => pedir<{ cliente: Cliente; polizas: Poliza[]; oportunidades: Oportunidad[]; siniestros: Siniestro[]; conversacion: Conversacion | null }>(`/clientes/${id}`),
  oportunidad: (id: string) => pedir<{ oportunidad: Oportunidad; cliente: Cliente; polizas: Poliza[]; conversacion: Conversacion | null }>(`/oportunidades/${id}`),
  oportunidades: (dias = 365) => pedir<Oportunidad[]>(`/oportunidades?dias=${dias}`),
  siniestro: (id: string) => pedir<{ siniestro: Siniestro; cliente: Cliente; poliza: Poliza | null; conversacion: Conversacion | null }>(`/siniestros/${id}`),
  poliza: (id: string) => pedir<{ poliza: Poliza; cliente: Cliente; anteriores: Poliza[]; siniestros: Siniestro[] }>(`/polizas/${id}`),
  mensajes: (convId: string) => pedir<Mensaje[]>(`/conversaciones/${convId}/mensajes`),
  escribirComoCliente: (o: { telefono: string; nombre?: string; texto?: string; canal?: string; adjunto?: unknown }) => pedir("/simulador", { method: "POST", body: JSON.stringify(o) }),
}

/** Recarga una ficha cuando cambia la versión del estado en vivo. */
export function useFicha<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const { estado } = useSeguros()
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    cargar()
      .then((d) => vivo && (setDatos(d), setError(null)))
      .catch((e) => vivo && setError((e as Error).message))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, estado?.version])
  return { datos, error }
}
