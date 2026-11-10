"use client"

import { Suspense, useEffect, useMemo, useRef } from "react"
import { useAnimations, useGLTF } from "@react-three/drei"
import type { ThreeElements } from "@react-three/fiber"
import * as THREE from "three"
import { clone as clonarEsqueleto } from "three/examples/jsm/utils/SkeletonUtils.js"

const BASE = "/boca-marina/3d"

export const MUEBLES = {
  mesa: `${BASE}/muebles/tableCloth.glb`,
  mesaRedonda: `${BASE}/muebles/tableRound.glb`,
  silla: `${BASE}/muebles/chairCushion.glb`,
  estufa: `${BASE}/muebles/kitchenStove.glb`,
  gabinete: `${BASE}/muebles/kitchenCabinet.glb`,
  nevera: `${BASE}/muebles/kitchenFridgeLarge.glb`,
  barra: `${BASE}/muebles/kitchenBar.glb`,
  barraFin: `${BASE}/muebles/kitchenBarEnd.glb`,
  taburete: `${BASE}/muebles/stoolBar.glb`,
  planta: `${BASE}/muebles/pottedPlant.glb`,
  lampara: `${BASE}/muebles/lampRoundFloor.glb`,
} as const

export const PERSONAS = ["female-a", "male-a", "female-b", "male-b", "female-c", "male-c", "female-d", "male-d"].map(
  (n) => `${BASE}/personas/character-${n}.glb`,
)

Object.values(MUEBLES).forEach((u) => useGLTF.preload(u))
PERSONAS.forEach((u) => useGLTF.preload(u))

type PropsMueble = { url: string; medida: [number | null, number | null, number | null]; sombras?: boolean } & ThreeElements["group"]
type PropsPersona = { url: string; animacion: Animacion; altura?: number; sombras?: boolean } & ThreeElements["group"]

// Cada modelo carga en su propia espera: así un modelo nuevo no desmonta el resto de la escena ni sus etiquetas.
export function Mueble(props: PropsMueble) {
  return (
    <Suspense fallback={null}>
      <MuebleCargado {...props} />
    </Suspense>
  )
}

export function Persona(props: PropsPersona) {
  return (
    <Suspense fallback={null}>
      <PersonaCargada {...props} />
    </Suspense>
  )
}

/** Copia de un mueble escalado a una medida en metros (ancho, alto, fondo) y centrado en su base. */
function MuebleCargado({
  url,
  medida,
  sombras = true,
  ...props
}: PropsMueble) {
  const { scene } = useGLTF(url)
  const objeto = useMemo(() => {
    const c = scene.clone(true)
    const caja = new THREE.Box3().setFromObject(c)
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const [w, h, d] = medida
    const base = h != null ? h / tam.y : w != null ? w / tam.x : 1
    const sx = w != null ? w / tam.x : base
    const sy = h != null ? h / tam.y : base
    const sz = d != null ? d / tam.z : base
    c.position.set(-centro.x, -caja.min.y, -centro.z)
    const g = new THREE.Group()
    g.add(c)
    g.scale.set(sx, sy, sz)
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = sombras
        o.receiveShadow = sombras
      }
    })
    return g
  }, [scene, medida[0], medida[1], medida[2], sombras])
  return <primitive object={objeto} {...props} />
}

export type Animacion = "idle" | "walk" | "sit" | "holding-both" | "interact-right" | "emote-yes"

/** Una persona animada. Cada copia lleva su propio esqueleto y su propio mezclador. */
function PersonaCargada({ url, animacion, altura = 1.65, sombras = true, ...props }: PropsPersona) {
  const { scene, animations } = useGLTF(url)
  const raiz = useRef<THREE.Group>(null)
  const objeto = useMemo(() => {
    const c = clonarEsqueleto(scene) as THREE.Object3D
    const caja = new THREE.Box3().setFromObject(c)
    const s = altura / Math.max(0.01, caja.getSize(new THREE.Vector3()).y)
    c.scale.setScalar(s)
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = sombras
        o.frustumCulled = false
      }
    })
    return c
  }, [scene, altura, sombras])
  const { actions } = useAnimations(animations, raiz)
  useEffect(() => {
    const a = actions[animacion] ?? actions.idle
    a?.reset().fadeIn(0.25).play()
    return () => {
      a?.fadeOut(0.25)
    }
  }, [actions, animacion])
  return (
    <group ref={raiz} {...props}>
      <primitive object={objeto} />
    </group>
  )
}

export function personaPara(semilla: string) {
  let h = 2166136261
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619)
  return PERSONAS[Math.abs(h) % PERSONAS.length]
}
