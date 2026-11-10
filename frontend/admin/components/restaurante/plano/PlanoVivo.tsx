"use client"

import { useEffect, useRef, useState } from "react"
import { minutosDelDia } from "@/lib/restaurante/local"
import { AREAS, PASE, PUERTA, PUESTOS_COCINA, REPOSO } from "@/lib/restaurante/plano"
import type { Estado, Mesa } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"
import {
  bote,
  campana,
  cocinaActiva,
  dibujarAgua,
  escenaEncima,
  escenaFija,
  fasePorMinuto,
  H,
  hash,
  luces,
  mesa as dibujarMesa,
  PELOS,
  persona,
  PIELES,
  ropa,
  sentado,
  sillas,
  sobreMesa,
  tinte,
  W,
  type Fase,
  type Ropa,
} from "./dibujo"
import { ESTADO_MESA, chipMesa } from "./estados"
import { acceso, asientos, direccion, enRuta, esCama, largo, px, ruta, tamMesa, type Punto } from "./rutas"

const VELOCIDAD = 42
const OCUPADA = ["ocupada", "en_cocina", "servida", "cuenta"]

type Caminante = { pos: Punto; ruta: Punto[]; clave: string; paso: number }
type Grupo = { mesaId: string; n: number; ruta: Punto[]; inicio: number; largo: number; saliendo: boolean; ropas: Ropa[] }

function ropaCliente(m: Mesa, i: number) {
  return ropa(`${m.id}-${m.clienteId ?? ""}-${i}-${Math.floor((m.tramos?.llegada ?? m.desde) / 60000)}`)
}

export default function PlanoVivo({
  estado,
  ahora,
  seleccion,
  onMesa,
}: {
  estado: Estado
  ahora: number
  seleccion?: string
  onMesa: (id: string) => void
}) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const datos = useRef({ estado, ahora, seleccion })
  const caminantes = useRef(new Map<string, Caminante>())
  const grupos = useRef<Grupo[]>([])
  const previo = useRef(new Map<string, Mesa["estado"]>())
  const capas = useRef<{ fase?: Fase; fija?: HTMLCanvasElement; encima?: HTMLCanvasElement }>({})
  const dibujarRef = useRef<(t: number) => void>(() => {})
  const [quieto, setQuieto] = useState(false)
  datos.current = { estado, ahora, seleccion }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const f = () => setQuieto(mq.matches)
    f()
    mq.addEventListener("change", f)
    return () => mq.removeEventListener("change", f)
  }, [])

  useEffect(() => {
    const t = performance.now()
    for (const m of estado.mesas) {
      const antes = previo.current.get(m.id)
      if (antes && antes !== m.estado && !quieto) {
        const n = Math.max(1, m.comensales ?? 2)
        const ropas = Array.from({ length: n }, (_, i) => ropaCliente(m, i))
        const puerta = { x: px(PUERTA.x), y: px(PUERTA.y + 0.6) }
        if ((antes === "libre" || antes === "reservada") && m.estado === "ocupada") {
          const rt = [...ruta(puerta, acceso(m)), asientos(m)[0].p]
          grupos.current.push({ mesaId: m.id, n, ruta: rt, inicio: t, largo: largo(rt), saliendo: false, ropas })
        }
        if (antes === "cuenta" && m.estado === "limpieza") {
          const rt = [asientos(m)[0].p, ...ruta(acceso(m), puerta)]
          grupos.current.push({ mesaId: m.id, n, ruta: rt, inicio: t, largo: largo(rt), saliendo: true, ropas })
        }
      }
      previo.current.set(m.id, m.estado)
    }
    if (grupos.current.length > 40) grupos.current = grupos.current.slice(-40)
    if (quieto) dibujarRef.current(t)
  }, [estado, quieto])

  useEffect(() => {
    if (quieto) dibujarRef.current(performance.now())
  }, [seleccion, quieto])

  useEffect(() => {
    const c = lienzo.current?.getContext("2d")
    if (!c) return
    c.imageSmoothingEnabled = false
    let ultimo = performance.now()

    const capa = () => {
      const cv = document.createElement("canvas")
      cv.width = W
      cv.height = H
      const cx = cv.getContext("2d")!
      cx.imageSmoothingEnabled = false
      return { cv, cx }
    }

    const dibujar = (t: number) => {
      const dt = Math.min(0.1, (t - ultimo) / 1000)
      ultimo = t
      const { estado: est, ahora: ah, seleccion: sel } = datos.current
      const fase = fasePorMinuto(minutosDelDia(ah))
      if (!capas.current.fija) {
        const a = capa()
        escenaFija(a.cx, est.mesas)
        const b = capa()
        escenaEncima(b.cx)
        capas.current = { fase, fija: a.cv, encima: b.cv }
      }
      const frame = Math.floor(t / 130)

      dibujarAgua(c, quieto ? 0 : t)
      bote(c, quieto ? 9000 : t)
      c.drawImage(capas.current.fija!, 0, 0)

      const llegando = new Set(
        grupos.current
          .filter((g) => !g.saliendo && t - g.inicio < (g.largo / VELOCIDAD) * 1000 + g.n * 320)
          .map((g) => g.mesaId),
      )
      const pedidos = new Map(est.pedidos.map((p) => [p.id, p]))

      for (const m of est.mesas) sillas(c, m)
      for (const m of est.mesas) {
        if (!OCUPADA.includes(m.estado) || llegando.has(m.id)) continue
        asientos(m).forEach((a, i) => {
          if (i < (m.comensales ?? 2) && a.lado === "arriba") sentado(c, a.p, ropaCliente(m, i), "arriba", frame, i)
        })
      }
      for (const m of est.mesas) {
        const p = m.pedidoId ? pedidos.get(m.pedidoId) : undefined
        const servidos = p ? p.items.filter((x) => x.estado === "servido").length : 0
        const parpadeo = !!m.llamado && Math.floor(t / 420) % 2 === 0
        dibujarMesa(c, m, ESTADO_MESA[m.estado].color, sel === m.id, parpadeo)
        sobreMesa(c, m, servidos, llegando.has(m.id) ? 0 : m.comensales ?? 0, m.estado)
      }
      for (const m of est.mesas) {
        if (!OCUPADA.includes(m.estado) || llegando.has(m.id)) continue
        asientos(m).forEach((a, i) => {
          if (i < (m.comensales ?? 2) && a.lado === "abajo") sentado(c, a.p, ropaCliente(m, i), "abajo", frame, i)
        })
      }

      const sprites: { y: number; draw: () => void }[] = []
      grupos.current = grupos.current.filter((g) => {
        const pasado = t - g.inicio
        if (pasado > (g.largo / VELOCIDAD) * 1000 + g.n * 320) return false
        for (let i = 0; i < g.n; i++) {
          const d = ((pasado - i * 320) / 1000) * VELOCIDAD
          if (d < 0 || d > g.largo) continue
          const p = enRuta(g.ruta, d)
          const mira = direccion(g.ruta, d)
          sprites.push({ y: p.y, draw: () => persona(c, p.x + (i % 2) * 3, p.y, g.ropas[i % g.ropas.length], frame + i, { andando: true, mira }) })
        }
        return true
      })

      const mesas = new Map(est.mesas.map((m) => [m.id, m]))
      for (const q of est.equipo) {
        if (q.rol === "dueno" || q.rol === "gerente") continue
        const piel = PIELES[hash(q.id) % PIELES.length]
        if (q.rol === "cocina") {
          const k = PUESTOS_COCINA[q.estacion ?? "caliente"]
          const activo = est.pedidos.some((p) => p.items.some((it) => it.estacion === q.estacion && it.estado === "preparando"))
          const kp = { x: px(k.x), y: px(k.y) }
          if (activo) cocinaActiva(c, kp, frame)
          const vaiven = activo && !quieto ? Math.round(Math.sin(t / 260) * 3) : 0
          sprites.push({
            y: kp.y + 12,
            draw: () => persona(c, kp.x + vaiven, kp.y + 12, { piel, pelo: "#2A1A11", camisa: "#FFFFFF", pantalon: "#3B3B3B" }, activo ? frame : 0, { gorro: true }),
          })
          continue
        }
        let destino: Punto
        let clave: string
        const m = q.tarea.mesaId ? mesas.get(q.tarea.mesaId) : undefined
        if (q.tarea.tipo !== "reposo" && m) {
          destino = acceso(m)
          clave = `${q.tarea.tipo}-${m.id}`
        } else if (q.tarea.tipo === "tomar" || q.tarea.tipo === "servir") {
          destino = { x: px(PASE.x), y: px(12.2) }
          clave = "pase"
        } else {
          const rp = REPOSO[q.id] ?? { x: 30, y: 12 }
          destino = { x: px(rp.x), y: px(rp.y) }
          clave = "reposo"
        }
        let cam = caminantes.current.get(q.id)
        if (!cam) {
          cam = { pos: { ...destino }, ruta: [destino], clave, paso: 0 }
          caminantes.current.set(q.id, cam)
        }
        if (cam.clave !== clave) {
          cam.clave = clave
          cam.ruta = quieto ? [destino] : ruta(cam.pos, destino)
          cam.paso = 0
          if (quieto) cam.pos = destino
        }
        let andando = false
        let mira = 0
        if (cam.ruta.length > 1) {
          cam.paso += dt * VELOCIDAD * 1.5
          const total = largo(cam.ruta)
          if (cam.paso >= total) {
            cam.pos = cam.ruta[cam.ruta.length - 1]
            cam.ruta = [cam.pos]
          } else {
            cam.pos = enRuta(cam.ruta, cam.paso)
            mira = direccion(cam.ruta, cam.paso)
            andando = true
          }
        }
        const pos = cam.pos
        const ro: Ropa = { piel, pelo: PELOS[hash(q.id) % PELOS.length], camisa: "#0B2A2E", pantalon: "#1F2F3A" }
        const ocupado = q.tarea.tipo !== "reposo" && !andando
        sprites.push({
          y: pos.y,
          draw: () => {
            persona(c, pos.x, pos.y, ro, frame, { andando, delantal: q.color, mira, bandeja: q.tarea.tipo === "servir" })
            if (ocupado) {
              r2(c, pos.x + 5, pos.y - 26, 9, 9, "#1C1A1A")
              r2(c, pos.x + 6, pos.y - 25, 7, 7, "#FFFFFF")
              r2(c, pos.x + 8, pos.y - 23, 3, 3, q.color)
            }
          },
        })
      }
      sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw())
      for (const m of est.mesas) if (m.llamado?.tipo === "mesero" && Math.floor(t / 420) % 2 === 0) campana(c, m)

      c.drawImage(capas.current.encima!, 0, 0)
      tinte(c, fase)
      luces(c, fase, quieto ? 0 : t)
    }
    dibujarRef.current = dibujar

    if (quieto) {
      dibujar(performance.now())
      return
    }
    let raf = 0
    const bucle = (t: number) => {
      dibujar(t)
      raf = requestAnimationFrame(bucle)
    }
    raf = requestAnimationFrame(bucle)
    return () => cancelAnimationFrame(raf)
  }, [quieto])

  const pct = (v: number, total: number) => `${(v / total) * 100}%`

  return (
    <div className="relative w-full overflow-hidden rounded-xl border bg-[#1BB0A9] shadow-sm" style={{ aspectRatio: `${W} / ${H}` }}>
      <canvas
        ref={lienzo}
        width={W}
        height={H}
        className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
        role="img"
        aria-label="Plano en vivo de Boca Marina: cocina, salón privado, bar, terraza techada, muelle y gazebo"
      />
      <div className="pointer-events-none absolute inset-0 text-[clamp(8px,0.8vw,11px)] font-medium uppercase tracking-[0.12em] text-white">
        {(
          [
            ["Cocina", AREAS.cocina.x + 0.6, AREAS.cocina.y + 6.6],
            ["Salón privado", AREAS.salon.x + 0.8, AREAS.salon.y + 6.6],
            ["Bar y caja", AREAS.bar.x + 0.8, AREAS.bar.y + 6.6],
            ["Terraza techada", AREAS.terraza.x + 0.7, AREAS.terraza.y + 0.6],
            ["Muelle", AREAS.muelle.x + 0.7, 23.6],
            ["Gazebo y camas balinesas", AREAS.punta.x + 0.7, AREAS.punta.y + 0.5],
            ["Entrada", PUERTA.x + 1.2, PUERTA.y - 0.6],
          ] as const
        ).map(([t, x, y]) => (
          <span
            key={t}
            className="absolute whitespace-nowrap rounded-sm bg-black/35 px-1.5 py-0.5 backdrop-blur-[1px]"
            style={{ left: pct(x, 64), top: pct(y, 46) }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="absolute inset-0">
        {estado.mesas.map((m) => {
          const { w, h } = tamMesa(m.capacidad)
          const bw = esCama(m) ? 44 : w + 16
          const bh = esCama(m) ? 40 : h + 22
          const chip = chipMesa(m, estado, ahora)
          const nombre = m.nombre.replace("Cama ", "C").replace("Salón ", "S")
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onMesa(m.id)}
              aria-label={`Mesa ${m.nombre}, ${ESTADO_MESA[m.estado].nombre}`}
              aria-pressed={seleccion === m.id}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                seleccion === m.id ? "ring-2 ring-white/90" : "hover:ring-2 hover:ring-white/50",
              )}
              style={{ left: pct(px(m.x), W), top: pct(px(m.y), H), width: pct(bw, W), height: pct(bh, H) }}
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-0.5 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap text-[clamp(8px,0.78vw,11px)] font-semibold leading-none">
                <span className="rounded bg-[#0B2A2E]/90 px-1.5 py-[3px] text-[#F4ECDF] shadow-sm">{nombre}</span>
                {chip && (
                  <span
                    className={cn("rounded px-1.5 py-[3px] tabular-nums text-[#0B2A2E] shadow-sm", chip.parpadea && "motion-safe:animate-pulse")}
                    style={{ background: chip.fondo }}
                  >
                    {chip.texto}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function r2(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col
  c.fillRect(Math.round(x), Math.round(y), w, h)
}
