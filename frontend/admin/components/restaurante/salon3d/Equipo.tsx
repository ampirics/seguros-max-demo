"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { acceso, enRuta, largo, ruta, U, type Punto } from "@/components/restaurante/plano/rutas"
import { PASE, PUESTOS_COCINA, REPOSO } from "@/lib/restaurante/plano"
import type { Estado, Persona as PersonaT } from "@/lib/restaurante/tipos"
import { aX, aZ, PISO_MUELLE, PISO_TIERRA } from "./coords"
import { Ancla } from "./Etiquetas"
import { Persona, PERSONAS, type Animacion } from "./modelos"
import { useEstilo } from "./estilos"
import { FiguraDePie, semillaDe } from "./figuras"

const VELOCIDAD = 1.6 // metros por segundo
const TAREA: Record<string, string> = {
  reposo: "",
  recibir: "Recibiendo",
  tomar: "Toma la orden",
  servir: "Sirviendo",
  atender: "Atendiendo",
  cobrar: "Cobrando",
  limpiar: "Recogiendo",
}

// Las rutas del plano están en píxeles de 16 por casilla; la escena trabaja en metros.
const aEscena = (p: Punto) => new THREE.Vector3(aX(p.x / U), 0, aZ(p.y / U))
const pisoEn = (z: number) => (z < aZ(12.6) ? PISO_TIERRA : PISO_MUELLE)

function Etiqueta({ q, detalle }: { q: PersonaT; detalle: string }) {
  return <Ancla id={`persona-${q.id}`} y={1.85} datos={{ tipo: "persona", nombre: q.nombre, color: q.rol === "cocina" ? "#0B2A2E" : q.color, detalle }} />
}

function Mesero({ q, estado, indice }: { q: PersonaT; estado: Estado; indice: number }) {
  const grupo = useRef<THREE.Group>(null)
  const camino = useRef<{ puntos: Punto[]; d: number; total: number; clave: string } | null>(null)
  const posPx = useRef<Punto>({ x: (REPOSO[q.id]?.x ?? 30) * U, y: (REPOSO[q.id]?.y ?? 12) * U })
  const [andando, setAndando] = useState(false)

  const m = q.tarea.mesaId ? estado.mesas.find((x) => x.id === q.tarea.mesaId) : undefined
  let destino: Punto
  let clave: string
  if (q.tarea.tipo !== "reposo" && m) {
    destino = acceso(m)
    clave = `${q.tarea.tipo}-${m.id}-${m.x}-${m.y}`
  } else if (q.tarea.tipo === "tomar" || q.tarea.tipo === "servir") {
    destino = { x: PASE.x * U, y: 12.2 * U }
    clave = "pase"
  } else {
    const r = REPOSO[q.id] ?? { x: 30, y: 12 }
    destino = { x: r.x * U, y: r.y * U }
    clave = "reposo"
  }

  useEffect(() => {
    if (camino.current?.clave === clave) return
    const pts = ruta(posPx.current, destino)
    camino.current = { puntos: pts, d: 0, total: largo(pts), clave }
    setAndando(true)
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const c = camino.current
    const g = grupo.current
    if (!c || !g) return
    if (c.d < c.total) {
      c.d = Math.min(c.total, c.d + dt * VELOCIDAD * 2 * U)
      const p = enRuta(c.puntos, c.d)
      const antes = posPx.current
      posPx.current = p
      const v = aEscena(p)
      g.position.set(v.x, pisoEn(v.z), v.z)
      const dx = p.x - antes.x
      const dz = p.y - antes.y
      if (Math.abs(dx) + Math.abs(dz) > 0.01) g.rotation.y = Math.atan2(dx, dz)
      if (c.d >= c.total) setAndando(false)
    } else if (g.position.lengthSq() === 0) {
      const v = aEscena(posPx.current)
      g.position.set(v.x, pisoEn(v.z), v.z)
    }
  })

  const { estilo } = useEstilo()
  const anim: Animacion = andando ? "walk" : q.tarea.tipo === "servir" ? "holding-both" : q.tarea.tipo === "reposo" ? "idle" : "interact-right"
  return (
    <group ref={grupo}>
      {estilo === "actual" ? (
        <>
          <Persona url={PERSONAS[(indice * 3 + 1) % PERSONAS.length]} animacion={anim} altura={1.45} />
          <mesh position={[0, 0.62, 0.13]}>
            <boxGeometry args={[0.32, 0.36, 0.04]} />
            <meshStandardMaterial color={q.color} roughness={0.8} />
          </mesh>
        </>
      ) : (
        <FiguraDePie
          estilo={estilo}
          semilla={semillaDe(q.id)}
          acento={q.color}
          pose={q.tarea.tipo === "servir" ? "bandeja" : andando ? "andando" : q.tarea.tipo === "reposo" ? "quieto" : "atiende"}
        />
      )}
      <Etiqueta q={q} detalle={TAREA[q.tarea.tipo] + (m && q.tarea.tipo !== "reposo" ? ` · ${m.nombre}` : "")} />
    </group>
  )
}

function Cocinero({ q, estado, indice }: { q: PersonaT; estado: Estado; indice: number }) {
  const k = PUESTOS_COCINA[q.estacion ?? "caliente"]
  const ocupado = estado.pedidos.some((p) => p.items.some((i) => i.estacion === q.estacion && i.estado === "preparando"))
  const fuego = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (fuego.current) fuego.current.scale.y = 0.7 + Math.abs(Math.sin(clock.getElapsedTime() * 9 + indice)) * 0.6
  })
  const { estilo } = useEstilo()
  return (
    <group position={[aX(k.x), PISO_TIERRA, aZ(k.y) - 0.3]} rotation-y={Math.PI}>
      {estilo === "actual" ? (
        <>
          <Persona url={PERSONAS[(indice * 5 + 2) % PERSONAS.length]} animacion={ocupado ? "interact-right" : "idle"} altura={1.45} />
          <mesh position={[0, 1.52, 0]}>
            <cylinderGeometry args={[0.15, 0.13, 0.22, 14]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </>
      ) : (
        <FiguraDePie estilo={estilo} semilla={semillaDe(q.id)} acento={q.color} cocinero pose={ocupado ? "cocina" : "quieto"} altura={1.55} />
      )}
      {ocupado && (
        <mesh ref={fuego} position={[0, 1.0, 0.7]}>
          <coneGeometry args={[0.12, 0.3, 10]} />
          <meshStandardMaterial color="#ff9a3c" emissive="#ff7a1a" emissiveIntensity={2} transparent opacity={0.85} />
        </mesh>
      )}
      <Etiqueta q={q} detalle={ocupado ? "Cocinando" : ""} />
    </group>
  )
}

export function Equipo({ estado }: { estado: Estado }) {
  return (
    <>
      {estado.equipo.map((q, i) =>
        q.rol === "cocina" ? <Cocinero key={q.id} q={q} estado={estado} indice={i} /> : <Mesero key={q.id} q={q} estado={estado} indice={i} />,
      )}
    </>
  )
}
