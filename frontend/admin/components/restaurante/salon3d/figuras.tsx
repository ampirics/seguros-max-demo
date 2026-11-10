"use client"

import { useMemo, useRef } from "react"
import { useFrame, type ThreeElements } from "@react-three/fiber"
import * as THREE from "three"
import { caja, capsulaEntre, cil, esfera, geoGuardada, unir, type Parte } from "./geo"
import { TEMAS, type EstiloFino } from "./estilos"
import { texturaSombra } from "./texturas"

export function semillaDe(texto: string) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  return Math.abs(h)
}

const elegir = <T,>(lista: T[], s: number, k: number) => lista[Math.floor(s / k) % lista.length]

function cabeza(piel: string, pelo: string, peinado: number, y: number, z: number): Parte[] {
  const p: Parte[] = [{ g: esfera(0.1, [0, y, z], [0.92, 1.05, 0.98], 14), c: piel }]
  p.push({ g: esfera(0.104, [0, y + 0.03, z - 0.012], [0.96, 0.82, 1], 14), c: pelo })
  if (peinado === 1) p.push({ g: esfera(0.055, [0, y + 0.06, z - 0.1], [1, 1, 1], 10), c: pelo })
  if (peinado === 2) p.push({ g: capsulaEntre([0, y + 0.02, z - 0.06], [0, y - 0.16, z - 0.08], 0.085, 10), c: pelo })
  return p
}

/** Comensal sentado mirando hacia +z, en el sitio de la silla. Una sola geometría por variante. */
export function geoSentado(estilo: EstiloFino, semilla: number) {
  const f = TEMAS[estilo].figura
  const piel = elegir(f.piel, semilla, 1)
  const ropa = elegir(f.ropa, semilla, 7)
  const abajo = elegir([f.pantalon, ...f.ropa], semilla, 53)
  const pelo = elegir(f.pelo, semilla, 13)
  const peinado = Math.floor(semilla / 29) % 3
  const clave = `sentado-${estilo}-${piel}-${ropa}-${abajo}-${pelo}-${peinado}`
  return geoGuardada(clave, () => {
    const p: Parte[] = []
    for (const x of [-0.085, 0.085]) {
      p.push({ g: capsulaEntre([x, 0.5, -0.04], [x, 0.5, 0.3], 0.068), c: abajo })
      p.push({ g: capsulaEntre([x, 0.49, 0.32], [x, 0.08, 0.34], 0.055), c: abajo })
      p.push({ g: esfera(0.05, [x, 0.04, 0.38], [1, 0.6, 1.5], 8), c: "#2a2420" })
    }
    p.push({ g: capsulaEntre([0, 0.6, -0.07], [0, 0.88, -0.03], 0.155, 12), c: ropa })
    p.push({ g: esfera(0.05, [0, 1.02, -0.03], [1, 1, 1], 8), c: piel })
    for (const s of [-1, 1]) {
      p.push({ g: capsulaEntre([s * 0.2, 0.94, -0.04], [s * 0.21, 0.78, 0.1], 0.045), c: ropa })
      p.push({ g: capsulaEntre([s * 0.21, 0.78, 0.1], [s * 0.14, 0.8, 0.3], 0.038), c: piel })
    }
    p.push(...cabeza(piel, pelo, peinado, 1.13, -0.02))
    const g = unir(p)
    g.scale(1, 1, 0.92)
    return g
  })
}

const materiales = new Map<string, THREE.MeshStandardMaterial>()
export function matColor(color: string, rugoso = 0.75) {
  const k = `${color}-${rugoso}`
  let m = materiales.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rugoso })
    materiales.set(k, m)
  }
  return m
}

export const matVertices = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 })

export function Sentado({ estilo, semilla, ...props }: { estilo: EstiloFino; semilla: number } & ThreeElements["group"]) {
  const g = useMemo(() => geoSentado(estilo, semilla), [estilo, semilla])
  return (
    <group {...props}>
      <mesh geometry={g} material={matVertices} castShadow />
    </group>
  )
}

const geoPierna = new THREE.CapsuleGeometry(0.075, 0.68, 3, 8).translate(0, -0.41, 0)
const geoBrazo = new THREE.CapsuleGeometry(0.045, 0.48, 3, 8).translate(0, -0.27, 0)
const geoTorso = new THREE.CapsuleGeometry(0.16, 0.34, 4, 12).scale(1, 1, 0.72)
const geoCabeza = new THREE.SphereGeometry(0.1, 14, 10).scale(0.92, 1.05, 0.98)
const geoPelo = new THREE.SphereGeometry(0.104, 14, 10).scale(0.96, 0.82, 1)
const geoDelantal = new THREE.BoxGeometry(0.3, 0.46, 0.02)
const geoBandeja = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20)
const geoGorro = new THREE.CylinderGeometry(0.095, 0.085, 0.16, 14)
const geoGorroCopa = new THREE.SphereGeometry(0.12, 14, 8)
const geoSombra = new THREE.PlaneGeometry(0.85, 0.85).rotateX(-Math.PI / 2)

export function SombraBlob({ ancho, fondo, opacidad, y = 0.006 }: { ancho: number; fondo: number; opacidad: number; y?: number }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, opacity: opacidad, depthWrite: false, color: "#000" }), [opacidad])
  return <mesh geometry={geoSombra} material={mat} position={[0, y, 0]} scale={[ancho / 0.85, 1, fondo / 0.85]} renderOrder={-1} />
}

export type Pose = "quieto" | "andando" | "bandeja" | "atiende" | "cocina"

/** Persona de pie para el equipo: cuerpo de cápsulas, uniforme y un acento de color. */
export function FiguraDePie({
  estilo,
  semilla,
  pose,
  acento,
  cocinero = false,
  altura = 1.62,
}: {
  estilo: EstiloFino
  semilla: number
  pose: Pose
  acento: string
  cocinero?: boolean
  altura?: number
}) {
  const t = TEMAS[estilo]
  const f = t.figura
  const piel = elegir(f.piel, semilla, 1)
  const pelo = elegir(f.pelo, semilla, 13)
  const camisa = cocinero ? f.cocina : estilo === "noche" ? "#f5efe4" : f.uniforme
  const chaleco = cocinero ? f.cocina : estilo === "noche" ? f.uniforme : camisa
  const piernaI = useRef<THREE.Group>(null)
  const piernaD = useRef<THREE.Group>(null)
  const brazoI = useRef<THREE.Group>(null)
  const brazoD = useRef<THREE.Group>(null)
  const cuerpo = useRef<THREE.Group>(null)
  const fase = (semilla % 100) / 16

  useFrame(({ clock }) => {
    const tt = clock.getElapsedTime() + fase
    const andar = pose === "andando"
    const a = andar ? Math.sin(tt * 7.5) * 0.38 : 0
    if (piernaI.current) piernaI.current.rotation.x = a
    if (piernaD.current) piernaD.current.rotation.x = -a
    if (brazoI.current) brazoI.current.rotation.x = -a * 0.7
    if (brazoD.current) {
      if (pose === "bandeja") brazoD.current.rotation.set(-1.45, 0, -0.15)
      else if (pose === "atiende") brazoD.current.rotation.set(-0.95 + Math.sin(tt * 2) * 0.12, 0, 0.1)
      else if (pose === "cocina") brazoD.current.rotation.set(-1.05 + Math.sin(tt * 6) * 0.25, 0, 0.15)
      else brazoD.current.rotation.set(a * 0.7, 0, 0)
    }
    if (brazoI.current && pose === "cocina") brazoI.current.rotation.set(-0.9 + Math.sin(tt * 6 + 1) * 0.15, 0, -0.1)
    if (cuerpo.current) cuerpo.current.position.y = andar ? Math.abs(Math.sin(tt * 7.5)) * 0.03 : Math.sin(tt * 1.4) * 0.006
  })

  const s = altura / 1.62
  return (
    <group scale={s}>
      <SombraBlob ancho={0.75} fondo={0.75} opacidad={t.sombraBlob * 1.4} />
      <group ref={cuerpo}>
        <group ref={piernaI} position={[-0.09, 0.88, 0]}>
          <mesh geometry={geoPierna} material={matColor(f.pantalon)} castShadow />
        </group>
        <group ref={piernaD} position={[0.09, 0.88, 0]}>
          <mesh geometry={geoPierna} material={matColor(f.pantalon)} castShadow />
        </group>
        <mesh geometry={geoTorso} material={matColor(chaleco)} position={[0, 1.18, 0]} castShadow />
        {estilo === "noche" && !cocinero && <mesh geometry={geoTorso} material={matColor(camisa)} position={[0, 1.24, 0.012]} scale={[0.45, 0.62, 1.01]} />}
        <mesh geometry={geoDelantal} material={matColor(cocinero ? "#ffffff" : acento, 0.9)} position={[0, 0.72, 0.125]} rotation-x={-0.05} />
        <mesh position={[0, 1.44, 0]} material={matColor(piel)} geometry={geoCabeza} scale={[0.5, 0.6, 0.5]} />
        <mesh position={[0, 1.55, 0]} material={matColor(piel)} geometry={geoCabeza} castShadow />
        {cocinero ? (
          <>
            <mesh geometry={geoGorro} material={matColor("#ffffff")} position={[0, 1.7, 0]} />
            <mesh geometry={geoGorroCopa} material={matColor("#ffffff")} position={[0, 1.79, 0]} scale={[1, 0.6, 1]} />
          </>
        ) : (
          <mesh geometry={geoPelo} material={matColor(pelo)} position={[0, 1.58, -0.012]} />
        )}
        <group ref={brazoI} position={[-0.215, 1.37, 0]}>
          <mesh geometry={geoBrazo} material={matColor(chaleco)} castShadow />
        </group>
        <group ref={brazoD} position={[0.215, 1.37, 0]}>
          <mesh geometry={geoBrazo} material={matColor(chaleco)} castShadow />
          {pose === "bandeja" && (
            <group position={[0, -0.56, 0]}>
              <mesh geometry={geoBandeja} material={matColor("#d9d4cb", 0.35)} rotation-x={1.45} />
              <mesh position={[0, 0, -0.06]} rotation-x={1.45} material={matColor("#ffffff", 0.3)}>
                <cylinderGeometry args={[0.09, 0.07, 0.04, 16]} />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </group>
  )
}

/** Silla fina con el respaldo hacia -z (el comensal mira a +z). */
export function partesSilla(estilo: EstiloFino, pos: [number, number, number], rot: number): Parte[] {
  const t = TEMAS[estilo]
  const marco = t.silla.marco
  const cojin = t.silla.cojin
  const p: Parte[] = []
  const tipo = t.deco?.silla
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1))
  const listo = () => {
    p.forEach((x) => x.g.applyMatrix4(m))
    return p
  }
  if (tipo === "ratan") {
    p.push({ g: cil(0.25, 0.21, 0.42, [0, 0.21, 0], 18), c: marco }, { g: cil(0.235, 0.235, 0.07, [0, 0.46, 0], 18), c: cojin })
    for (const r of [0.27, 0.245]) {
      const g = new THREE.CylinderGeometry(r, r - 0.02, 0.38, 20, 1, true, Math.PI * 0.5, Math.PI)
      g.translate(0, 0.62, 0)
      p.push({ g, c: marco })
    }
    p.push({ g: new THREE.TorusGeometry(0.258, 0.018, 5, 20, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI).translate(0, 0.81, 0), c: marco })
    return listo()
  }
  if (tipo === "director") {
    const madera = "#9a6a42"
    for (const s of [-1, 1]) {
      for (const g of [0.62, -0.62]) p.push({ g: caja(0.03, 0.56, 0.03, [s * 0.21, 0.23, 0], [g, 0, 0]), c: madera })
      p.push({ g: caja(0.035, 0.5, 0.035, [s * 0.21, 0.68, -0.19]), c: madera }, { g: caja(0.04, 0.03, 0.44, [s * 0.215, 0.66, 0.0]), c: madera }, { g: caja(0.03, 0.2, 0.03, [s * 0.21, 0.56, 0.2]), c: madera })
    }
    p.push({ g: caja(0.42, 0.02, 0.4, [0, 0.47, 0]), c: marco }, { g: caja(0.44, 0.2, 0.015, [0, 0.8, -0.2]), c: marco }, { g: caja(0.445, 0.02, 0.02, [0, 0.9, -0.2]), c: cojin })
    return listo()
  }
  if (tipo === "teca") {
    for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) p.push({ g: caja(0.06, 0.44, 0.06, [x, 0.22, z]), c: marco })
    p.push({ g: caja(0.5, 0.05, 0.5, [0, 0.45, 0]), c: marco }, { g: caja(0.44, 0.08, 0.44, [0, 0.51, 0.01]), c: cojin })
    for (const x of [-0.21, 0.21]) p.push({ g: caja(0.06, 0.52, 0.06, [x, 0.72, -0.22]), c: marco }, { g: caja(0.05, 0.04, 0.5, [x * 1.12, 0.66, 0]), c: marco }, { g: caja(0.045, 0.2, 0.045, [x * 1.12, 0.56, 0.21]), c: marco })
    for (const y of [0.66, 0.78, 0.9]) p.push({ g: caja(0.42, 0.06, 0.03, [0, y, -0.22]), c: marco })
    return listo()
  }
  if (tipo === "concha") {
    p.push({ g: cil(0.18, 0.2, 0.02, [0, 0.01, 0], 18), c: "#d9b98a" }, { g: cil(0.025, 0.025, 0.42, [0, 0.22, 0], 8), c: "#d9b98a" }, { g: cil(0.25, 0.24, 0.09, [0, 0.47, 0], 22), c: cojin })
    for (const r of [0.29, 0.265]) {
      const g = new THREE.CylinderGeometry(r + 0.04, r, 0.42, 22, 1, true, Math.PI * 0.45, Math.PI * 1.1)
      g.translate(0, 0.66, 0)
      p.push({ g, c: marco })
    }
    return listo()
  }
  const pata = 0.022
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) p.push({ g: caja(pata * 2, 0.44, pata * 2, [x, 0.22, z]), c: marco })
  p.push({ g: caja(0.44, 0.035, 0.44, [0, 0.45, 0]), c: marco })
  p.push({ g: caja(0.4, 0.045, 0.4, [0, 0.49, 0.01]), c: cojin })
  for (const x of [-0.19, 0.19]) p.push({ g: caja(0.035, 0.42, 0.035, [x, 0.68, -0.2], [-0.12, 0, 0]), c: marco })
  if (estilo === "atardecer" || tipo === "listones") {
    for (const y of [0.62, 0.72, 0.82]) p.push({ g: caja(0.38, 0.045, 0.02, [0, y, -0.21 - (y - 0.6) * 0.12], [-0.12, 0, 0]), c: marco })
  } else if (estilo === "noche") {
    p.push({ g: caja(0.4, 0.3, 0.035, [0, 0.74, -0.215], [-0.12, 0, 0]), c: marco })
    for (const x of [-0.2, 0.2]) p.push({ g: caja(0.03, 0.03, 0.4, [x, 0.66, 0]), c: marco })
  } else {
    p.push({ g: caja(0.4, 0.22, 0.03, [0, 0.78, -0.215], [-0.12, 0, 0]), c: marco })
  }
  return listo()
}

