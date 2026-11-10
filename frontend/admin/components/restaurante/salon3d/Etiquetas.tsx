"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

// Las etiquetas viven en una sola capa HTML sobre el lienzo: cada mesa y cada persona solo deja un ancla en la escena.
export type DatosEtiqueta =
  | { tipo: "mesa"; nombre: string; chip?: { texto: string; fondo: string; parpadea?: boolean } }
  | { tipo: "persona"; nombre: string; color: string; detalle: string }

const datos = new Map<string, DatosEtiqueta>()
const anclas = new Map<string, THREE.Object3D>()
const elementos = new Map<string, HTMLDivElement>()
const oyentes = new Set<() => void>()
let version = 0

const avisar = () => {
  version++
  oyentes.forEach((o) => o())
}
const suscribir = (o: () => void) => {
  oyentes.add(o)
  return () => oyentes.delete(o)
}

export function Ancla({ id, y, datos: d }: { id: string; y: number; datos: DatosEtiqueta }) {
  const ref = useRef<THREE.Object3D>(null)
  const clave = JSON.stringify(d)
  useEffect(() => {
    if (ref.current) anclas.set(id, ref.current)
    return () => {
      anclas.delete(id)
      datos.delete(id)
      avisar()
    }
  }, [id])
  useEffect(() => {
    datos.set(id, d)
    avisar()
  }, [id, clave]) // eslint-disable-line react-hooks/exhaustive-deps
  return <object3D ref={ref} position={[0, y, 0]} />
}

const v = new THREE.Vector3()
const c = new THREE.Vector3()

export function Proyector({ factor = 12 }: { factor?: number }) {
  const { camera, size } = useThree()
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.getWorldPosition(c)
    const alto = 2 * Math.tan(((cam.fov ?? 38) * Math.PI) / 360)
    anclas.forEach((obj, id) => {
      const el = elementos.get(id)
      if (!el) return
      obj.getWorldPosition(v)
      const dist = v.distanceTo(c)
      v.project(cam)
      if (v.z > 1 || v.z < -1) {
        el.style.display = "none"
        return
      }
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      const s = factor / (alto * dist)
      el.style.display = ""
      el.style.zIndex = String(Math.round(1000 - dist * 10))
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${s})`
    })
  })
  return null
}

export function CapaEtiquetas() {
  useSyncExternalStore(suscribir, () => version, () => 0)
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {[...datos.entries()].map(([id, d]) => (
        <div
          key={id}
          ref={(el) => {
            if (el) elementos.set(id, el)
            else elementos.delete(id)
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ display: "none" }}
        >
          {d.tipo === "mesa" ? (
            <div className="flex items-center gap-1 whitespace-nowrap font-sans text-[13px] font-medium leading-none">
              <span className="rounded-md bg-[#0B2A2E]/90 px-1.5 py-1 text-[#F4ECDF] shadow">{d.nombre}</span>
              {d.chip && (
                <span className={`rounded-md px-1.5 py-1 text-[#0B2A2E] shadow ${d.chip.parpadea ? "animate-pulse" : ""}`} style={{ background: d.chip.fondo }}>
                  {d.chip.texto}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center whitespace-nowrap font-sans leading-none">
              <span className="flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[12px] font-semibold text-[#0B2A2E] shadow">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                {d.nombre}
              </span>
              {d.detalle && <span className="mt-0.5 rounded-full bg-[#0B2A2E]/80 px-1.5 py-0.5 text-[10px] text-[#F4ECDF]">{d.detalle}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
