"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { caja, cil, esfera, faldon, geoGuardada, unir, type Parte } from "./geo"
import { TEMAS, useEstilo, type EstiloFino } from "./estilos"
import { matVertices, partesSilla, SombraBlob } from "./figuras"
import { texturaBrillo } from "./texturas"
import { matDoble } from "./Tropical"
import type { Hueco } from "./Comida"

type Sitio = { x: number; z: number; rot: number }

const matCopa = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.1, depthWrite: false })

const frente = (s: Sitio) => [Math.sin(s.rot), Math.cos(s.rot)] as const

function velasDe(w: number, redonda: boolean, cama: boolean): [number, number][] {
  if (cama) return [[0.7, 0.45]]
  if (redonda || w < 1.5) return [[0, 0]]
  if (w < 2.2) return [[-w * 0.22, 0], [w * 0.22, 0]]
  const n = w > 3 ? 4 : 3
  return Array.from({ length: n }, (_, i) => [-w / 2 + ((i + 0.5) * w) / n, 0] as [number, number])
}

function velasLibres(w: number, d: number, redonda: boolean, sitios: Sitio[], huecos: Hueco[]): [number, number][] {
  const base = velasDe(w, redonda, false)
  if (!huecos.length) return base
  const platos = sitios.map((s) => [s.x + Math.sin(s.rot) * 0.52, s.z + Math.cos(s.rot) * 0.52])
  const libre = (x: number, z: number) =>
    Math.abs(x) <= w / 2 - 0.08 && Math.abs(z) <= d / 2 - 0.06 && huecos.every((h) => Math.hypot(x - h.x, z - h.z) > h.r + 0.07) && platos.every(([px, pz]) => Math.hypot(x - px, z - pz) > 0.19)
  const res: [number, number][] = []
  for (const [x, z] of base) {
    if (libre(x, z)) {
      res.push([x, z])
      continue
    }
    const h = huecos.find((h) => Math.hypot(x - h.x, z - h.z) <= h.r + 0.07)!
    const opciones: [number, number][] = [[h.x - h.r - 0.09, z], [h.x + h.r + 0.09, z], [-(w / 2 - 0.12), z], [w / 2 - 0.12, z]]
    const otra = opciones.find(([a, b]) => libre(a, b))
    if (otra) res.push(otra)
  }
  return res
}

function geoMesa(estilo: EstiloFino, w: number, d: number, redonda: boolean, sitios: Sitio[], velas: [number, number][]) {
  return geoGuardada(`mesa-${estilo}-${w}-${d}-${redonda}-${sitios.length}-${velas.join(";")}`, () => {
    const t = TEMAS[estilo]
    const p: Parte[] = []
    const dc = t.deco
    const largo = estilo !== "maqueta" && dc?.mesa !== "madera"
    const oscuro = (c: string, k: number) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`
    if (dc?.alfombra) {
      if (redonda) p.push({ g: cil(1.45, 1.45, 0.006, [0, 0.003, 0], 40), c: oscuro(dc.alfombra, 0.82) }, { g: cil(1.32, 1.32, 0.008, [0, 0.005, 0], 40), c: dc.alfombra })
      else p.push({ g: caja(w + 1.9, 0.006, d + 1.9, [0, 0.003, 0]), c: oscuro(dc.alfombra, 0.82) }, { g: caja(w + 1.7, 0.008, d + 1.7, [0, 0.005, 0]), c: dc.alfombra })
    }
    if (dc?.mesa === "madera") {
      if (redonda) {
        p.push({ g: cil(0.52, 0.52, 0.05, [0, 0.745, 0], 32), c: t.mantel }, { g: cil(0.06, 0.06, 0.7, [0, 0.37, 0], 12), c: oscuro(t.mantel, 0.8) }, { g: cil(0.26, 0.3, 0.04, [0, 0.02, 0], 20), c: oscuro(t.mantel, 0.8) })
      } else {
        p.push({ g: caja(w, 0.05, d, [0, 0.745, 0]), c: t.mantel })
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push({ g: caja(0.07, 0.72, 0.07, [x * (w / 2 - 0.08), 0.36, z * (d / 2 - 0.08)]), c: oscuro(t.mantel, 0.82) })
        if (dc.camino) p.push({ g: caja(w + 0.08, 0.006, 0.34, [0, 0.773, 0]), c: dc.camino })
      }
    } else if (redonda) {
      p.push({ g: cil(0.52, 0.52, 0.03, [0, 0.76, 0], 32), c: t.mantel })
      if (largo) {
        p.push({ g: cil(0.52, 0.57, 0.3, [0, 0.61, 0], 32), c: t.mantel })
        p.push({ g: cil(0.05, 0.22, 0.47, [0, 0.235, 0], 16), c: t.silla.marco })
      }
      else p.push({ g: cil(0.04, 0.2, 0.74, [0, 0.37, 0], 16), c: t.mantel })
    } else if (largo) {
      p.push({ g: faldon(w + 0.06, d + 0.06, 0.03, 1, 0.76), c: t.mantel })
      p.push({ g: faldon(w + 0.06, d + 0.06, 0.3, 1.07, 0.61), c: t.mantel })
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push({ g: caja(0.05, 0.5, 0.05, [x * (w / 2 - 0.08), 0.25, z * (d / 2 - 0.08)]), c: t.silla.marco })
    } else {
      p.push({ g: caja(w, 0.035, d, [0, 0.755, 0]), c: t.mantel })
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push({ g: caja(0.035, 0.74, 0.035, [x * (w / 2 - 0.06), 0.37, z * (d / 2 - 0.06)]), c: t.mantel })
    }
    for (const s of sitios) {
      p.push(...partesSilla(estilo, [s.x, 0, s.z], s.rot))
      const [fx, fz] = frente(s)
      const px = s.x + fx * 0.52
      const pz = s.z + fz * 0.52
      const lx = fz
      const lz = -fx
      p.push({ g: cil(0.12, 0.1, 0.014, [px, 0.783, pz], 24), c: t.plato })
      p.push({ g: cil(0.075, 0.075, 0.004, [px, 0.792, pz], 20), c: estilo === "maqueta" ? "#f1ede6" : "#f4f1ea" })
      p.push({ g: caja(0.07, 0.012, 0.16, [px + lx * 0.17, 0.782, pz + lz * 0.17], [0, s.rot, 0]), c: t.servilleta })
      p.push({ g: caja(0.012, 0.006, 0.17, [px - lx * 0.15, 0.78, pz - lz * 0.15], [0, s.rot, 0]), c: "#c8c6c0" })
    }
    for (const [x, z] of velas) {
      p.push({ g: cil(0.06, 0.065, 0.016, [x, 0.784, z], 16), c: estilo === "maqueta" ? "#ffffff" : "#b8955a" })
      p.push({ g: cil(0.026, 0.026, 0.07, [x, 0.827, z], 12), c: t.vela })
      if (dc?.flor)
        for (const [fx, fz] of [[0.11, 0.05], [-0.09, 0.08], [0.02, -0.11]]) {
          p.push({ g: esfera(0.034, [x + fx, 0.785, z + fz], [1, 0.32, 1], 10), c: dc.flor }, { g: esfera(0.012, [x + fx, 0.792, z + fz], [1, 0.6, 1], 6), c: "#f2c14e" })
        }
    }
    return unir(p)
  })
}

function geoCopas(estilo: EstiloFino, w: number, redonda: boolean, sitios: Sitio[], velas: [number, number][]) {
  return geoGuardada(`copas-${estilo}-${w}-${redonda}-${sitios.length}-${velas.join(";")}`, () => {
    const t = TEMAS[estilo]
    const p: Parte[] = []
    for (const s of sitios) {
      const [fx, fz] = frente(s)
      const px = s.x + fx * 0.6
      const pz = s.z + fz * 0.6
      p.push({ g: cil(0.032, 0.026, 0.1, [px + fz * -0.16, 0.83, pz - fx * -0.16], 12), c: t.copa })
    }
    for (const [x, z] of velas) p.push({ g: cil(0.05, 0.055, 0.15, [x, 0.87, z], 16), c: t.copa })
    return unir(p)
  })
}

const geoLlama = new THREE.SphereGeometry(0.016, 8, 6).scale(1, 2.2, 1)
const matLlama = new THREE.MeshBasicMaterial({ color: "#ffd38a", toneMapped: false })
const geoCharco = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

/** Vela encendida: llama, halo y el charco de luz cálida sobre el mantel. */
export function Llama({ x, y, z, fuerza, charco = 1.3 }: { x: number; y: number; z: number; fuerza: number; charco?: number }) {
  const halo = useRef<THREE.Sprite>(null)
  const llama = useRef<THREE.Mesh>(null)
  const semilla = useMemo(() => Math.random() * 10, [])
  const matHalo = useMemo(
    () => new THREE.SpriteMaterial({ map: texturaBrillo(), color: "#ffb45c", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: Math.min(1, 0.55 * fuerza) }),
    [fuerza],
  )
  const matCharco = useMemo(
    () => new THREE.MeshBasicMaterial({ map: texturaBrillo(), color: "#ffad55", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: Math.min(0.85, 0.42 * fuerza) }),
    [fuerza],
  )
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 9 + semilla
    const v = 1 + Math.sin(t) * 0.05 + Math.sin(t * 2.3) * 0.04
    if (halo.current) halo.current.scale.setScalar(0.42 * v)
    if (llama.current) llama.current.scale.set(1, v, 1)
  })
  return (
    <group position={[x, y, z]}>
      <mesh ref={llama} geometry={geoLlama} material={matLlama} position={[0, 0.03, 0]} />
      <sprite ref={halo} material={matHalo} position={[0, 0.04, 0]} />
      <mesh geometry={geoCharco} material={matCharco} position={[0, -0.075, 0]} scale={charco} />
    </group>
  )
}

export function MueblesMesa({ w, d, redonda, sitios, huecos }: { w: number; d: number; redonda: boolean; sitios: Sitio[]; huecos: Hueco[] }) {
  const { estilo, fase } = useEstilo()
  const e = estilo as EstiloFino
  const t = TEMAS[e]
  const claveHuecos = huecos.map((h) => `${h.x.toFixed(2)},${h.r.toFixed(2)}`).join(";")
  const velas = useMemo(() => velasLibres(w, d, redonda, sitios, huecos), [w, d, redonda, sitios, claveHuecos])
  const g = useMemo(() => geoMesa(e, w, d, redonda, sitios, velas), [e, w, d, redonda, sitios, velas])
  const mat = t.deco ? matDoble : matVertices
  const copas = useMemo(() => geoCopas(e, w, redonda, sitios, velas), [e, w, redonda, sitios, velas])
  const calidas = t.luz[fase].calidas
  return (
    <>
      <SombraBlob ancho={(redonda ? 1 : w) + 1.3} fondo={(redonda ? 1 : d) + 1.3} opacidad={t.sombraBlob} />
      <mesh geometry={g} material={mat} castShadow receiveShadow />
      <mesh geometry={copas} material={matCopa} renderOrder={2} />
      {calidas > 0 && velas.map(([x, z], i) => <Llama key={i} x={x} y={0.86} z={z} fuerza={calidas} />)}
    </>
  )
}

const geoAro = new THREE.RingGeometry(0.94, 1, 72)
const geoDisco = new THREE.CircleGeometry(1, 72)

/** Estado de la mesa: un aro fino del color del estado y un velo muy suave por dentro. */
export function AroFino({ color, ancho, fondo, parpadea, seleccionada }: { color: string; ancho: number; fondo: number; parpadea: boolean; seleccionada: boolean }) {
  const { estilo } = useEstilo()
  const t = TEMAS[estilo as EstiloFino]
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const velo = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const o = parpadea ? 0.5 + Math.sin(clock.getElapsedTime() * 6) * 0.45 : seleccionada ? 1 : 0.85
    if (mat.current) mat.current.opacity = o
    if (velo.current) velo.current.opacity = (parpadea ? 0.1 + Math.sin(clock.getElapsedTime() * 6) * 0.08 : seleccionada ? 0.2 : 0.09)
  })
  const r = Math.max(ancho, fondo) / 2 + 0.75
  const sx = (ancho / Math.max(ancho, fondo)) * 0.35 + 0.65
  const sz = (fondo / Math.max(ancho, fondo)) * 0.35 + 0.65
  const grosor = (seleccionada ? t.aro * 2.4 : t.aro) / r
  const geo = useMemo(() => new THREE.RingGeometry(1 - grosor, 1, 72), [grosor])
  return (
    <group rotation-x={-Math.PI / 2} position={[0, 0.014, 0]} scale={[r * sx, r * sz, 1]}>
      <mesh geometry={geo ?? geoAro}>
        <meshBasicMaterial ref={mat} color={color} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={geoDisco} position={[0, 0, -0.002]}>
        <meshBasicMaterial ref={velo} color={color} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function geoCama(estilo: EstiloFino) {
  return geoGuardada(`cama-${estilo}`, () => {
    const t = TEMAS[estilo]
    const p: Parte[] = []
    const dc = t.deco
    if (dc?.cama === "sofa") {
      p.push({ g: cil(1.02, 0.96, 0.28, [0, 0.14, 0], 40), c: t.cama.base })
      p.push({ g: cil(0.96, 0.96, 0.13, [0, 0.34, 0], 40), c: t.cama.cojin })
      const respaldo = new THREE.CylinderGeometry(1.0, 1.0, 0.46, 36, 1, true, Math.PI * 0.62, Math.PI * 0.76)
      respaldo.translate(0, 0.5, 0)
      const interior = new THREE.CylinderGeometry(0.9, 0.9, 0.46, 36, 1, true, Math.PI * 0.62, Math.PI * 0.76)
      interior.translate(0, 0.5, 0)
      p.push({ g: respaldo, c: t.silla.marco }, { g: interior, c: t.silla.marco })
      for (const [x, c] of [[-0.45, t.cama.acento], [0, t.cama.base], [0.45, t.cama.acento]] as [number, string][]) p.push({ g: caja(0.4, 0.26, 0.13, [x, 0.52, -0.66 + Math.abs(x) * 0.18], [-0.25, x * 0.6, 0]), c })
      const arco = new THREE.TorusGeometry(1.05, 0.03, 6, 36, Math.PI)
      arco.scale(1, 1.75, 1)
      arco.translate(0, 0.28, -0.35)
      p.push({ g: arco, c: t.gazebo })
      p.push({ g: cil(0.2, 0.22, 0.32, [0.75, 0.16, 1.05], 18), c: t.silla.marco })
      p.push({ g: cil(0.06, 0.065, 0.016, [0.7, 0.33, 1.05], 16), c: "#d9b98a" }, { g: cil(0.026, 0.026, 0.07, [0.7, 0.37, 1.05], 12), c: t.vela })
      return unir(p)
    }
    const teca = dc?.cama === "teca"
    p.push({ g: caja(1.95, 0.26, 1.55, [0, 0.13, 0]), c: estilo === "maqueta" ? t.cama.base : t.silla.marco })
    p.push({ g: caja(1.85, 0.16, 1.45, [0, 0.33, 0]), c: t.cama.base })
    p.push({ g: caja(1.75, 0.34, 0.22, [0, 0.55, -0.58], [-0.25, 0, 0]), c: t.cama.cojin })
    for (const x of [-0.55, 0.55]) p.push({ g: caja(0.42, 0.24, 0.12, [x, 0.53, -0.4], [-0.3, 0, 0]), c: t.cama.acento })
    const g = teca ? 0.1 : 0.04
    for (const [x, z] of [[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.75], [0.95, 0.75]]) p.push({ g: teca ? caja(g, 2.25, g, [x, 1.125, z]) : cil(0.025, 0.025, 2.2, [x, 1.1, z], 8), c: t.gazebo })
    for (const z of [-0.75, 0.75]) p.push({ g: caja(1.95 + g, teca ? 0.12 : 0.04, g, [0, 2.2, z]), c: t.gazebo })
    for (const x of [-0.95, 0.95]) p.push({ g: caja(g, teca ? 0.12 : 0.04, 1.55, [x, 2.2, 0]), c: t.gazebo })
    if (teca) for (const [x, z] of [[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.75], [0.95, 0.75]]) p.push({ g: cil(0.03, 0.08, 0.16, [x, 2.34, z], 8), c: "#c9a35c" })
    p.push({ g: caja(0.42, 0.3, 0.42, [0.75, 0.15, 1.05]), c: estilo === "maqueta" ? t.cama.base : t.silla.marco })
    p.push({ g: cil(0.06, 0.065, 0.016, [0.7, 0.31, 1.05], 16), c: estilo === "maqueta" ? "#ffffff" : "#b8955a" })
    p.push({ g: cil(0.026, 0.026, 0.07, [0.7, 0.35, 1.05], 12), c: t.vela })
    return unir(p)
  })
}

const geoVelo = new THREE.PlaneGeometry(1.95, 1.55).rotateX(-Math.PI / 2)
const geoCortina = (() => {
  const g = new THREE.PlaneGeometry(0.5, 2.1, 8, 1)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.035)
  g.computeVertexNormals()
  return g
})()

export function CamaFina() {
  const { estilo, fase } = useEstilo()
  const e = estilo as EstiloFino
  const t = TEMAS[e]
  const g = useMemo(() => geoCama(e), [e])
  const calidas = t.luz[fase].calidas
  const sofa = t.deco?.cama === "sofa"
  return (
    <group>
      <SombraBlob ancho={2.8} fondo={2.4} opacidad={t.sombraBlob} />
      <mesh geometry={g} material={t.deco ? matDoble : matVertices} castShadow receiveShadow />
      {!sofa && (
        <>
      <mesh geometry={geoVelo} position={[0, 2.22, 0]}>
        <meshStandardMaterial color={t.tela} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[[-0.82, -0.75], [0.82, -0.75]].map(([x, z], i) => (
        <mesh key={i} geometry={geoCortina} position={[x, 1.1, z]}>
          <meshStandardMaterial color={t.tela} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
        </>
      )}
      {calidas > 0 && <Llama x={0.7} y={0.39} z={1.05} fuerza={calidas} charco={1.6} />}
    </group>
  )
}

export function CuentaFina({ w }: { w: number }) {
  return (
    <mesh position={[w * 0.2, 0.79, 0.05]} rotation-y={0.3}>
      <boxGeometry args={[0.11, 0.018, 0.2]} />
      <meshStandardMaterial color="#0b2a2e" roughness={0.5} />
    </mesh>
  )
}
