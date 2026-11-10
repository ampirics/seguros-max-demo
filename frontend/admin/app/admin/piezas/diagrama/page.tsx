"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PiezaFila } from "@/components/admin/piezas/PiezaFila"
import { NOMBRE_CARROCERIA, Silueta, type Carroceria } from "@/components/admin/piezas/Silueta"
import { VehiculoFiltro, filtroDeUrl, type FiltroVehiculo } from "@/components/admin/piezas/VehiculoFiltro"
import { apiClient } from "@/lib/api-client"
import type { BusquedaPiezas } from "@/lib/api-types"
import { aBusqueda } from "@/lib/api/piezas"
import { cn } from "@/lib/utils"

type Zona = { x: number; y: number; w: number; h: number }

interface Sistema {
  clave: string
  nombre: string
  zona: Zona
  total_piezas: number
}

const CARROCERIA: Record<string, Carroceria> = {
  Lancer: "sedan", Galant: "sedan", Accent: "sedan", Elantra: "sedan", Sonata: "sedan",
  L200: "camioneta", "H-1": "van", H100: "van", L300: "van",
}

const ZONAS: Record<Carroceria, Record<string, Zona>> = {
  sedan: {
    motor: { x: 0.052, y: 0.55, w: 0.15, h: 0.13 },
    correas: { x: 0.238, y: 0.55, w: 0.082, h: 0.13 },
    electricidad: { x: 0.238, y: 0.55, w: 0.082, h: 0.13 },
    carroceria: { x: 0.3, y: 0.3, w: 0.08, h: 0.2 },
    tren_delantero: { x: 0.121, y: 0.642, w: 0.165, h: 0.358 },
    tren_trasero: { x: 0.701, y: 0.642, w: 0.165, h: 0.358 },
  },
  yipeta: {
    motor: { x: 0.052, y: 0.446, w: 0.149, h: 0.174 },
    correas: { x: 0.238, y: 0.446, w: 0.086, h: 0.174 },
    electricidad: { x: 0.238, y: 0.446, w: 0.086, h: 0.174 },
    carroceria: { x: 0.3, y: 0.2, w: 0.08, h: 0.2 },
    tren_delantero: { x: 0.117, y: 0.62, w: 0.171, h: 0.38 },
    tren_trasero: { x: 0.673, y: 0.62, w: 0.171, h: 0.38 },
  },
  camioneta: {
    motor: { x: 0.05, y: 0.542, w: 0.128, h: 0.143 },
    correas: { x: 0.209, y: 0.542, w: 0.07, h: 0.143 },
    electricidad: { x: 0.209, y: 0.542, w: 0.07, h: 0.143 },
    carroceria: { x: 0.27, y: 0.3, w: 0.08, h: 0.2 },
    tren_delantero: { x: 0.109, y: 0.685, w: 0.141, h: 0.312 },
    tren_trasero: { x: 0.664, y: 0.685, w: 0.141, h: 0.312 },
  },
  van: {
    motor: { x: 0.051, y: 0.501, w: 0.141, h: 0.157 },
    correas: { x: 0.225, y: 0.501, w: 0.077, h: 0.157 },
    electricidad: { x: 0.225, y: 0.501, w: 0.077, h: 0.157 },
    carroceria: { x: 0.18, y: 0.2, w: 0.08, h: 0.2 },
    tren_delantero: { x: 0.116, y: 0.657, w: 0.154, h: 0.342 },
    tren_trasero: { x: 0.698, y: 0.657, w: 0.154, h: 0.342 },
  },
}

const carroceriaDe = (modelo: string | null) => (modelo && CARROCERIA[modelo]) || "yipeta"

// El dibujo (20:9) va entre dos franjas para etiquetas: arriba lo del capó, abajo las ruedas.
const ALTO = 13
const DIBUJO_Y = 2 / ALTO
const DIBUJO_H = 9 / ALTO

// Centros de etiqueta en una franja, en el orden de sus puntos y sin encimarse.
function repartir(xs: number[], separacion = 0.31, min = 0.15, max = 0.85) {
  const out = xs.map((x) => Math.min(Math.max(x, min), max))
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + separacion)
  const sobra = out.length ? out[out.length - 1] - max : 0
  return sobra > 0 ? out.map((x) => x - sobra) : out
}

function Llamadas({ carroceria, sistemas, activo, onElegir }: {
  carroceria: Carroceria
  sistemas: Sistema[]
  activo: string
  onElegir: (clave: string) => void
}) {
  const puntos = sistemas.map((s) => ({
    ...s,
    px: s.zona.x + s.zona.w / 2,
    py: DIBUJO_Y + (s.zona.y + s.zona.h / 2) * DIBUJO_H,
    arriba: s.zona.y + s.zona.h / 2 < 0.6,
  }))
  const llamadas = [true, false].flatMap((arriba) => {
    const grupo = puntos.filter((p) => p.arriba === arriba).sort((a, b) => a.px - b.px)
    const xs = repartir(grupo.map((p) => p.px))
    return grupo.map((p, i) => ({ ...p, lx: xs[i], ly: arriba ? 0.075 : 0.925 }))
  })
  const W = 1000
  const H = (W * ALTO) / 20
  return (
    <div className="relative mx-auto w-full max-w-3xl" style={{ aspectRatio: `20 / ${ALTO}` }}>
      <div className="absolute inset-x-0" style={{ top: `${DIBUJO_Y * 100}%`, height: `${DIBUJO_H * 100}%` }}>
        <Silueta carroceria={carroceria} />
        {sistemas.map((s) => (
          <button
            key={s.clave}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => onElegir(s.clave)}
            className="absolute cursor-pointer rounded-full"
            style={{ left: `${s.zona.x * 100}%`, top: `${s.zona.y * 100}%`, width: `${s.zona.w * 100}%`, height: `${s.zona.h * 100}%` }}
          />
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {llamadas.map((l) => {
          const on = l.clave === activo
          const finY = (l.arriba ? l.ly + 0.045 : l.ly - 0.045) * H
          return (
            <g key={l.clave} className={cn("transition-colors", on ? "stroke-primary" : "stroke-foreground/45")}>
              <line x1={l.px * W} y1={l.py * H} x2={l.lx * W} y2={finY} strokeWidth={on ? 1.5 : 1} vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
      </svg>
      {llamadas.map((l) => {
        const on = l.clave === activo
        return (
          <span
            key={`p-${l.clave}`}
            aria-hidden
            className={cn("pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card transition-colors",
              on ? "bg-primary" : "bg-foreground/60")}
            style={{ left: `${l.px * 100}%`, top: `${l.py * 100}%` }}
          />
        )
      })}
      {llamadas.map((l) => {
        const on = l.clave === activo
        return (
          <button
            key={`e-${l.clave}`}
            type="button"
            onClick={() => onElegir(l.clave)}
            aria-pressed={on}
            aria-label={`${l.nombre}: ${l.total_piezas} ${l.total_piezas === 1 ? "pieza" : "piezas"}`}
            className={cn(
              "absolute flex max-w-[29%] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-control border px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors sm:text-xs",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:border-primary/60"
            )}
            style={{ left: `${l.lx * 100}%`, top: `${l.ly * 100}%` }}
          >
            <span className="min-w-0 font-medium">{l.nombre}</span>
            <span className={cn("shrink-0 tabular-nums", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{l.total_piezas}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function DiagramaPage() {
  const [vehiculo, setVehiculo] = useState<FiltroVehiculo>({ marca: "Hyundai", modelo: "Tucson", anio: 2012 })
  useEffect(() => { const f = filtroDeUrl(); if (f) setVehiculo(f) }, [])
  const [sistemas, setSistemas] = useState<Sistema[] | null>(null)
  const [carroceria, setCarroceria] = useState<Carroceria>("yipeta")
  const [activo, setActivo] = useState("tren_delantero")
  const [piezas, setPiezas] = useState<BusquedaPiezas | null>(null)
  const [error, setError] = useState(false)

  const filtro = { marca: vehiculo.marca ?? undefined, modelo: vehiculo.modelo ?? undefined, anio: vehiculo.anio ?? undefined }

  useEffect(() => {
    apiClient.get<{ carroceria?: Carroceria; sistemas: (Omit<Sistema, "zona"> & { zona: Zona | null })[] }>("/piezas/diagrama", filtro)
      .then((r) => {
        const c = r.carroceria && r.carroceria in NOMBRE_CARROCERIA ? r.carroceria : carroceriaDe(vehiculo.modelo)
        setCarroceria(c)
        setSistemas(r.sistemas.flatMap((s) => {
          const zona = ZONAS[c][s.clave] ?? s.zona
          return zona ? [{ ...s, zona }] : []
        }))
        setError(false)
      })
      .catch(() => setError(true))
  }, [vehiculo])

  useEffect(() => {
    setPiezas(null)
    apiClient.get<BusquedaPiezas>("/piezas/buscar", { ...filtro, sistema: activo, limit: 50 })
      .then((r) => setPiezas(aBusqueda(r)))
      .catch(() => setError(true))
  }, [vehiculo, activo])

  const actual = sistemas?.find((s) => s.clave === activo)

  return (
    <AdminLayout title="Diagrama del vehículo">
      <div className="space-y-4">
        <Link href="/admin/piezas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Inventario
        </Link>
        <VehiculoFiltro value={vehiculo} onChange={setVehiculo} />

        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Toca un sistema para ver sus piezas. Dibujo de referencia: {NOMBRE_CARROCERIA[carroceria]}.
            </p>
            {sistemas && <Llamadas carroceria={carroceria} sistemas={sistemas} activo={activo} onElegir={setActivo} />}
          </CardContent>
        </Card>

        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold">{actual?.nombre ?? "Piezas"}</h2>
          {piezas && <span className="text-sm text-muted-foreground">{piezas.total} {piezas.total === 1 ? "pieza" : "piezas"}</span>}
        </div>
        {error ? (
          <Card><CardContent className="p-8 text-center text-sm">No se pudo cargar el diagrama.</CardContent></Card>
        ) : !piezas ? (
          <Card className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</Card>
        ) : piezas.items.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <p className="font-medium">Sin piezas de este sistema para el vehículo</p>
            <p className="mt-1 text-sm text-muted-foreground">Prueba otro año o quita el modelo.</p>
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden"><ul className="divide-y">{piezas.items.map((p) => <PiezaFila key={p.id} pieza={p} />)}</ul></Card>
        )}
      </div>
    </AdminLayout>
  )
}
