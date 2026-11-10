"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { AREAS, PUESTOS_COCINA } from "@/lib/restaurante/plano"
import { aX, aZ, M, PISO_MUELLE, PISO_TIERRA } from "./coords"
import { MUEBLES, Mueble } from "./modelos"

export type Fase = "dia" | "dorada" | "noche"

export function fasePorMinuto(min: number): Fase {
  if (min >= 17 * 60 + 30 && min < 18 * 60 + 50) return "dorada"
  if (min >= 18 * 60 + 50 || min < 6 * 60 + 15) return "noche"
  return "dia"
}

const LUZ: Record<Fase, { cielo: string; sol: string; solI: number; amb: number; hemiCielo: string; hemiSuelo: string; agua: string; niebla: string }> = {
  dia: { cielo: "#cfeef0", sol: "#fff4e0", solI: 2.4, amb: 0.55, hemiCielo: "#dff6ff", hemiSuelo: "#c2a27a", agua: "#1fb3ad", niebla: "#cfeef0" },
  dorada: { cielo: "#f6c79a", sol: "#ffb36b", solI: 1.9, amb: 0.45, hemiCielo: "#ffd7b0", hemiSuelo: "#9a6f4c", agua: "#2f9fa4", niebla: "#f3c6a0" },
  noche: { cielo: "#0b1c27", sol: "#8fb4ff", solI: 0.35, amb: 0.22, hemiCielo: "#25456b", hemiSuelo: "#1b1410", agua: "#0d3d47", niebla: "#0b1c27" },
}

// Rectángulo del plano (en casillas) a un tamaño y centro en metros.
const r = (a: { x: number; y: number; w: number; h: number }) => ({ w: a.w * M, d: a.h * M, x: aX(a.x + a.w / 2), z: aZ(a.y + a.h / 2) })

function texturaRayas(c1: string, c2: string, rayas: number, vertical = false) {
  const lienzo = document.createElement("canvas")
  lienzo.width = 256
  lienzo.height = 256
  const g = lienzo.getContext("2d")!
  g.fillStyle = c1
  g.fillRect(0, 0, 256, 256)
  const paso = 256 / rayas
  for (let i = 0; i < rayas; i++) {
    g.fillStyle = i % 2 ? c2 : c1
    if (vertical) g.fillRect(i * paso, 0, paso - 1, 256)
    else g.fillRect(0, i * paso, 256, paso - 1)
    g.fillStyle = "rgba(0,0,0,0.12)"
    if (vertical) g.fillRect(i * paso + paso - 1, 0, 1, 256)
    else g.fillRect(0, i * paso + paso - 1, 256, 1)
  }
  const t = new THREE.CanvasTexture(lienzo)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function texturaCuadros(c1: string, c2: string, n: number) {
  const lienzo = document.createElement("canvas")
  lienzo.width = 128
  lienzo.height = 128
  const g = lienzo.getContext("2d")!
  const p = 128 / n
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? c1 : c2
    g.fillRect(i * p, j * p, p, p)
  }
  const t = new THREE.CanvasTexture(lienzo)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function texturaBrillo() {
  const lienzo = document.createElement("canvas")
  lienzo.width = 256
  lienzo.height = 256
  const g = lienzo.getContext("2d")!
  g.clearRect(0, 0, 256, 256)
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`
    g.fillRect(x, y, 6 + Math.random() * 14, 1.2)
  }
  const t = new THREE.CanvasTexture(lienzo)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(14, 14)
  return t
}

function Agua({ fase }: { fase: Fase }) {
  const brillo = useMemo(texturaBrillo, [])
  const ref = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((_, dt) => {
    brillo.offset.x += dt * 0.006
    brillo.offset.y += dt * 0.003
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={LUZ[fase].agua} roughness={0.25} metalness={0.15} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <planeGeometry args={[220, 220]} />
        <meshBasicMaterial ref={ref} map={brillo} transparent opacity={fase === "noche" ? 0.12 : 0.35} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Palmera({ x, z, alto = 4.2, giro = 0 }: { x: number; z: number; alto?: number; giro?: number }) {
  const hojas = 7
  return (
    <group position={[x, PISO_TIERRA, z]} rotation-y={giro}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[Math.sin(i * 0.25) * 0.18, (i + 0.5) * (alto / 6), 0]} castShadow>
          <cylinderGeometry args={[0.11 - i * 0.008, 0.13 - i * 0.008, alto / 6, 8]} />
          <meshStandardMaterial color={i % 2 ? "#7a5b3e" : "#8a6847"} roughness={0.9} />
        </mesh>
      ))}
      {Array.from({ length: hojas }, (_, i) => (
        <mesh key={`h${i}`} position={[Math.sin(1.5) * 0.18, alto, 0]} rotation={[0.9, (i / hojas) * Math.PI * 2, 0]} castShadow>
          <coneGeometry args={[0.32, 2.1, 4, 1, true]} />
          <meshStandardMaterial color={i % 2 ? "#2f7a3d" : "#3b8f48"} side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Edificio({ fase }: { fase: Fase }) {
  const cocinaPiso = useMemo(() => texturaCuadros("#e7ebea", "#cfd6d5", 8), [])
  const madera = useMemo(() => {
    const t = texturaRayas("#8a5f3f", "#7c5436", 10)
    t.repeat.set(3, 2)
    return t
  }, [])
  const barra = useMemo(() => {
    const t = texturaCuadros("#d2a17d", "#c48f69", 6)
    t.repeat.set(5, 2)
    return t
  }, [])
  cocinaPiso.repeat.set(5, 2)
  const ed = r(AREAS.edificio)
  const co = r(AREAS.cocina)
  const sa = r(AREAS.salon)
  const ba = r(AREAS.bar)
  const muro = fase === "noche" ? "#d9d1c3" : "#f4ecdf"
  const alto = 1.0
  const muroH = (x: number, z: number, w: number) => (
    <mesh position={[x, PISO_TIERRA + alto / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, alto, 0.18]} />
      <meshStandardMaterial color={muro} roughness={0.85} />
    </mesh>
  )
  const muroV = (x: number, z: number, d: number) => (
    <mesh position={[x, PISO_TIERRA + alto / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[0.18, alto, d]} />
      <meshStandardMaterial color={muro} roughness={0.85} />
    </mesh>
  )
  return (
    <group>
      <mesh position={[0, PISO_TIERRA / 2, ed.z - 1]} receiveShadow>
        <boxGeometry args={[ed.w + 8, PISO_TIERRA, ed.d + 6]} />
        <meshStandardMaterial color="#d8c39a" roughness={1} />
      </mesh>
      <mesh position={[co.x, PISO_TIERRA + 0.005, co.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[co.w, co.d]} />
        <meshStandardMaterial map={cocinaPiso} roughness={0.6} />
      </mesh>
      <mesh position={[sa.x, PISO_TIERRA + 0.005, sa.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[sa.w, sa.d]} />
        <meshStandardMaterial map={madera} roughness={0.7} />
      </mesh>
      <mesh position={[ba.x, PISO_TIERRA + 0.005, ba.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ba.w, ba.d]} />
        <meshStandardMaterial map={barra} roughness={0.7} />
      </mesh>
      {muroH(ed.x, ed.z - ed.d / 2, ed.w)}
      {muroV(ed.x - ed.w / 2, ed.z, ed.d)}
      {muroV(ed.x + ed.w / 2, ed.z, ed.d)}
      {muroV(co.x + co.w / 2 + 0.25, ed.z, ed.d)}
      {muroV(sa.x + sa.w / 2 + 0.25, ed.z, ed.d)}
      {muroH(co.x - co.w / 4, ed.z + ed.d / 2, co.w / 2)}
      {muroH(sa.x - sa.w / 3, ed.z + ed.d / 2, sa.w / 3)}
      {muroH(sa.x + sa.w / 3, ed.z + ed.d / 2, sa.w / 3)}
      {muroH(ba.x - ba.w / 3, ed.z + ed.d / 2, ba.w / 3)}
      {(["caliente", "fria", "postres"] as const).map((k) => (
        <Mueble key={k} url={k === "fria" ? MUEBLES.gabinete : MUEBLES.estufa} medida={[1.4, 0.95, 0.75]} position={[aX(PUESTOS_COCINA[k].x), PISO_TIERRA, aZ(AREAS.cocina.y) + 0.45]} />
      ))}
      <Mueble url={MUEBLES.nevera} medida={[0.9, 1.9, 0.8]} position={[aX(AREAS.cocina.x) + 0.6, PISO_TIERRA, aZ(AREAS.cocina.y) + 0.5]} />
      <mesh position={[aX(12), PISO_TIERRA + 0.48, aZ(AREAS.cocina.y + 6.2)]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.96, 0.7]} />
        <meshStandardMaterial color="#b9c3c6" metalness={0.6} roughness={0.35} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <Mueble key={`b${i}`} url={i === 5 ? MUEBLES.barraFin : MUEBLES.barra} medida={[1.2, 1.05, 0.7]} position={[ba.x - 3.5 + i * 1.2, PISO_TIERRA, ba.z - 0.2]} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <Mueble key={`t${i}`} url={MUEBLES.taburete} medida={[null, 0.8, null]} position={[ba.x - 3.5 + i * 1.2, PISO_TIERRA, ba.z + 0.75]} />
      ))}
      <mesh position={[ba.x, PISO_TIERRA + 1.15, ed.z - ed.d / 2 + 0.35]}>
        <boxGeometry args={[7, 0.6, 0.3]} />
        <meshStandardMaterial color="#5a3b28" roughness={0.6} />
      </mesh>
      {Array.from({ length: 22 }, (_, i) => (
        <mesh key={`bo${i}`} position={[ba.x - 3.3 + i * 0.31, PISO_TIERRA + 1.6, ed.z - ed.d / 2 + 0.35]}>
          <cylinderGeometry args={[0.05, 0.05, 0.32, 8]} />
          <meshStandardMaterial color={["#2f6b4f", "#7a2b2b", "#d8b35a", "#3b5a7a"][i % 4]} roughness={0.2} metalness={0.2} />
        </mesh>
      ))}
      <Mueble url={MUEBLES.planta} medida={[null, 1.3, null]} position={[sa.x - sa.w / 2 + 0.6, PISO_TIERRA, ed.z + ed.d / 2 - 0.6]} />
      <Mueble url={MUEBLES.planta} medida={[null, 1.3, null]} position={[sa.x + sa.w / 2 - 0.6, PISO_TIERRA, ed.z + ed.d / 2 - 0.6]} />
    </group>
  )
}

function Muelle() {
  const tablas = useMemo(() => {
    const t = texturaRayas("#b88c5e", "#a97f53", 16)
    t.repeat.set(1, 8)
    return t
  }, [])
  const tablasPunta = useMemo(() => {
    const t = texturaRayas("#9a6a41", "#8c5f39", 16, true)
    t.repeat.set(10, 1)
    return t
  }, [])
  const terrazaPiso = useMemo(() => {
    const t = texturaCuadros("#efe3cb", "#e3d4b6", 10)
    t.repeat.set(4, 1.2)
    return t
  }, [])
  const mu = r(AREAS.muelle)
  const te = r(AREAS.terraza)
  const gr = r(AREAS.grama)
  const pu = r(AREAS.punta)
  return (
    <group>
      <mesh position={[mu.x, PISO_MUELLE / 2, mu.z]} castShadow receiveShadow>
        <boxGeometry args={[mu.w, PISO_MUELLE, mu.d]} />
        <meshStandardMaterial map={tablas} roughness={0.85} />
      </mesh>
      <mesh position={[te.x, PISO_MUELLE + 0.004, te.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[te.w, te.d]} />
        <meshStandardMaterial map={terrazaPiso} roughness={0.7} />
      </mesh>
      <mesh position={[pu.x, PISO_MUELLE + 0.004, pu.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[pu.w, pu.d]} />
        <meshStandardMaterial map={tablasPunta} roughness={0.85} />
      </mesh>
      <mesh position={[gr.x, PISO_MUELLE + 0.06, gr.z]} receiveShadow castShadow>
        <boxGeometry args={[gr.w, 0.12, gr.d]} />
        <meshStandardMaterial color="#5c9f45" roughness={1} />
      </mesh>
      <mesh position={[gr.x, PISO_MUELLE + 0.01, gr.z]}>
        <boxGeometry args={[gr.w + 0.25, 0.02, gr.d + 0.25]} />
        <meshStandardMaterial color="#efe6d4" />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => (
        <group key={i}>
          <mesh position={[mu.x - mu.w / 2 + 0.08, PISO_MUELLE + 0.35, mu.z - mu.d / 2 + 2 + i * 2.3]} castShadow>
            <boxGeometry args={[0.08, 0.7, 0.08]} />
            <meshStandardMaterial color="#f4ecdf" />
          </mesh>
          <mesh position={[mu.x + mu.w / 2 - 0.08, PISO_MUELLE + 0.35, mu.z - mu.d / 2 + 2 + i * 2.3]} castShadow>
            <boxGeometry args={[0.08, 0.7, 0.08]} />
            <meshStandardMaterial color="#f4ecdf" />
          </mesh>
        </group>
      ))}
      <mesh position={[mu.x - mu.w / 2 + 0.08, PISO_MUELLE + 0.7, mu.z + 1]}>
        <boxGeometry args={[0.06, 0.05, mu.d - 2]} />
        <meshStandardMaterial color="#f4ecdf" />
      </mesh>
      <mesh position={[mu.x + mu.w / 2 - 0.08, PISO_MUELLE + 0.7, mu.z + 1]}>
        <boxGeometry args={[0.06, 0.05, mu.d - 2]} />
        <meshStandardMaterial color="#f4ecdf" />
      </mesh>
      <mesh position={[mu.x, PISO_MUELLE + 0.7, mu.z + mu.d / 2 - 0.08]}>
        <boxGeometry args={[mu.w, 0.05, 0.06]} />
        <meshStandardMaterial color="#f4ecdf" />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={`p${i}`} position={[mu.x - mu.w / 2 + (i * mu.w) / 9, -0.6, mu.z + mu.d / 2 - 0.2]}>
          <cylinderGeometry args={[0.14, 0.14, 1.3, 8]} />
          <meshStandardMaterial color="#5a3d26" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function TechoTerraza({ transparente, oculto }: { transparente: boolean; oculto: boolean }) {
  const te = r(AREAS.terraza)
  const alto = 3
  const postes: [number, number][] = []
  for (let i = 0; i <= 6; i++) postes.push([te.x - te.w / 2 + 0.2 + (i * (te.w - 0.4)) / 6, te.z - te.d / 2 + 0.2], [te.x - te.w / 2 + 0.2 + (i * (te.w - 0.4)) / 6, te.z + te.d / 2 - 0.2])
  return (
    <group>
      {postes.map(([x, z], i) => (
        <mesh key={i} position={[x, PISO_MUELLE + alto / 2, z]} castShadow>
          <boxGeometry args={[0.16, alto, 0.16]} />
          <meshStandardMaterial color="#3d3530" roughness={0.6} />
        </mesh>
      ))}
      {!oculto && Array.from({ length: 9 }, (_, i) => (
        <mesh key={`v${i}`} position={[te.x, PISO_MUELLE + alto + 0.05, te.z - te.d / 2 + (i * te.d) / 8]}>
          <boxGeometry args={[te.w, 0.06, 0.06]} />
          <meshStandardMaterial color="#6d5f53" transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh visible={!oculto} position={[te.x + te.w / 4, PISO_MUELLE + alto + 0.12, te.z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[te.w / 2 - 0.4, te.d - 0.4]} />
        <meshStandardMaterial color="#1d3550" metalness={0.5} roughness={0.25} transparent opacity={transparente ? 0.12 : 0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh visible={!oculto} position={[te.x - te.w / 4, PISO_MUELLE + alto + 0.12, te.z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[te.w / 2 - 0.4, te.d - 0.4]} />
        <meshStandardMaterial color="#e8e1d2" transparent opacity={transparente ? 0.08 : 0.32} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Gazebo() {
  const x = aX(32)
  const z = aZ(38)
  const lado = 3.2
  const alto = 2.6
  return (
    <group position={[x, PISO_MUELLE, z]}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
        <mesh key={i} position={[(a * lado) / 2, alto / 2, (b * lado) / 2]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, alto, 10]} />
          <meshStandardMaterial color="#fbf8f2" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, alto + 0.35, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[lado * 0.78, 0.8, 4, 1, true]} />
        <meshStandardMaterial color="#fbf8f2" roughness={0.5} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`a${i}`} position={[0, alto, 0]} rotation-y={(i * Math.PI) / 2}>
          <boxGeometry args={[lado, 0.08, 0.08]} />
          <meshStandardMaterial color="#fbf8f2" />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`c${i}`} position={[Math.sin((i * Math.PI) / 2) * (lado / 2), alto / 2 + 0.2, Math.cos((i * Math.PI) / 2) * (lado / 2)]} rotation-y={(i * Math.PI) / 2}>
          <planeGeometry args={[0.6, alto - 0.4]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Luces de cuerda sobre la terraza y el muelle: bombillos que se encienden al caer la tarde. */
function Bombillos({ encendidos }: { encendidos: boolean }) {
  const mu = r(AREAS.muelle)
  const puntos = useMemo(() => {
    const p: [number, number, number][] = []
    for (let i = 0; i < 26; i++) p.push([mu.x - mu.w / 2 + 0.1, PISO_MUELLE + 1.35, mu.z - mu.d / 2 + 0.5 + (i * (mu.d - 1)) / 25])
    for (let i = 0; i < 26; i++) p.push([mu.x + mu.w / 2 - 0.1, PISO_MUELLE + 1.35, mu.z - mu.d / 2 + 0.5 + (i * (mu.d - 1)) / 25])
    for (let i = 0; i < 24; i++) p.push([mu.x - mu.w / 2 + (i * mu.w) / 23, PISO_MUELLE + 1.6, aZ(23.5)])
    for (let i = 0; i < 24; i++) p.push([mu.x - mu.w / 2 + (i * mu.w) / 23, PISO_MUELLE + 1.6, aZ(34.5)])
    return p
  }, [mu.x, mu.w, mu.z, mu.d])
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    puntos.forEach((p, i) => ref.current?.setMatrixAt(i, m.makeTranslation(...p)))
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  }, [puntos])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, puntos.length]}>
      <sphereGeometry args={[0.055, 8, 8]} />
      <meshStandardMaterial color={encendidos ? "#ffd889" : "#d8d2c4"} emissive={encendidos ? "#ffbf55" : "#000000"} emissiveIntensity={encendidos ? 2.2 : 0} />
    </instancedMesh>
  )
}

function Bote({ fase }: { fase: Fase }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() * 0.25
    ref.current.position.x = ((t * 6) % 70) - 35
    ref.current.position.y = 0.05 + Math.sin(t * 6) * 0.04
  })
  return (
    <group ref={ref} position={[-35, 0.05, 19]}>
      <mesh castShadow>
        <boxGeometry args={[2.6, 0.35, 0.9]} />
        <meshStandardMaterial color="#f7f5ef" />
      </mesh>
      <mesh position={[0.2, 0.45, 0]} castShadow>
        <boxGeometry args={[0.9, 0.5, 0.7]} />
        <meshStandardMaterial color={fase === "noche" ? "#ffd889" : "#1f4f6b"} emissive={fase === "noche" ? "#ffb347" : "#000"} emissiveIntensity={fase === "noche" ? 0.6 : 0} />
      </mesh>
    </group>
  )
}

export function Entorno({ fase, techoTransparente, techoOculto = false, sombras }: { fase: Fase; techoTransparente: boolean; techoOculto?: boolean; sombras: boolean }) {
  const l = LUZ[fase]
  return (
    <>
      <color attach="background" args={[l.cielo]} />
      <fog attach="fog" args={[l.niebla, 45, 110]} />
      <hemisphereLight args={[l.hemiCielo, l.hemiSuelo, l.amb]} />
      <ambientLight intensity={l.amb * 0.4} />
      <directionalLight
        position={fase === "dorada" ? [-22, 10, 14] : [14, 26, 12]}
        intensity={l.solI}
        color={l.sol}
        castShadow={sombras}
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0004}
      />
      {fase !== "dia" &&
        [
          [-5, 2.6, -2.5],
          [5, 2.6, -2.5],
          [-4, 2.2, 2.5],
          [5, 2.2, 3],
          [0, 2.2, 8],
          [0, 2.2, -8],
        ].map((p, i) => <pointLight key={i} position={p as [number, number, number]} intensity={fase === "noche" ? 9 : 4} distance={9} color="#ffc977" />)}
      <Agua fase={fase} />
      <Edificio fase={fase} />
      <Muelle />
      <TechoTerraza transparente={techoTransparente} oculto={techoOculto} />
      <Gazebo />
      <Bombillos encendidos={fase !== "dia"} />
      <Bote fase={fase} />
      {[-14, -11.5, 11, 13.5, -15.5, 15.5].map((x, i) => (
        <Palmera key={i} x={x} z={-4.6 - (i % 2) * 0.5} alto={3.8 + (i % 3) * 0.5} giro={i} />
      ))}
    </>
  )
}
