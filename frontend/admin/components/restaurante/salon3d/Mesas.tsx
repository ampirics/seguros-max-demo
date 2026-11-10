"use client"

import { memo, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"
import { chipMesa, ESTADO_MESA } from "@/components/restaurante/plano/estados"
import type { Estado, Mesa } from "@/lib/restaurante/tipos"
import { aX, aZ, esCama, medidaMesa, pisoDe, puestos } from "./coords"
import { Ancla } from "./Etiquetas"
import { MUEBLES, Mueble, Persona, personaPara } from "./modelos"
import { useEstilo } from "./estilos"
import { semillaDe, Sentado } from "./figuras"
import { ComidaMesa, planComida } from "./Comida"
import { AroFino, CamaFina, CuentaFina, MueblesMesa } from "./MesaFina"

const CON_GENTE = ["ocupada", "en_cocina", "servida", "cuenta"]

function Cama() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.44, 1.5]} />
        <meshStandardMaterial color="#f7f3ea" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -0.55]} castShadow>
        <boxGeometry args={[1.8, 0.35, 0.3]} />
        <meshStandardMaterial color="#e8866a" roughness={0.9} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.5, -0.35]} castShadow>
          <boxGeometry args={[0.45, 0.22, 0.2]} />
          <meshStandardMaterial color="#7fcfcb" roughness={0.9} />
        </mesh>
      ))}
      {[[-0.92, -0.72], [0.92, -0.72], [-0.92, 0.72], [0.92, 0.72]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.1, z]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
          <meshStandardMaterial color="#efe6d4" />
        </mesh>
      ))}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[1.9, 0.03, 1.5]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Aro({ color, ancho, fondo, parpadea, seleccionada }: { color: string; ancho: number; fondo: number; parpadea: boolean; seleccionada: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (!mat.current) return
    mat.current.opacity = parpadea ? 0.45 + Math.sin(clock.getElapsedTime() * 6) * 0.35 : seleccionada ? 0.95 : 0.7
  })
  const r = Math.max(ancho, fondo) / 2 + 0.75
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} scale={[ancho / Math.max(ancho, fondo) * 0.35 + 0.65, fondo / Math.max(ancho, fondo) * 0.35 + 0.65, 1]}>
      <ringGeometry args={[r - (seleccionada ? 0.22 : 0.12), r, 48]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.7} depthWrite={false} />
    </mesh>
  )
}

export const MesaObj = memo(function MesaObj({
  mesa,
  estado,
  ahora,
  seleccionada,
  atenuada,
  organizar,
  arrastrando,
  posicion,
  onPresionar,
}: {
  mesa: Mesa
  estado: Estado
  ahora: number
  seleccionada: boolean
  atenuada: boolean
  organizar: boolean
  arrastrando: boolean
  posicion?: { x: number; y: number }
  onPresionar: (mesaId: string, e: ThreeEvent<PointerEvent>) => void
}) {
  const cama = esCama(mesa)
  const { w, d } = medidaMesa(mesa.capacidad)
  const sitios = puestos(mesa.capacidad, cama)
  const p = mesa.pedidoId ? estado.pedidos.find((x) => x.id === mesa.pedidoId) : undefined
  const servidos = p ? p.items.filter((i) => i.estado === "servido").length : 0
  const sentados = CON_GENTE.includes(mesa.estado) ? Math.min(sitios.length, mesa.comensales ?? 2) : 0
  const color = ESTADO_MESA[mesa.estado].color
  const chip = chipMesa(mesa, estado, ahora)
  const x = aX(posicion?.x ?? mesa.x)
  const z = aZ(posicion?.y ?? mesa.y)
  const y = pisoDe(mesa.zona)
  const redonda = mesa.id === "G4"
  const { estilo } = useEstilo()
  const servidosClave = p ? p.items.filter((i) => i.estado === "servido").map((i) => `${i.platoId}x${i.cantidad}`).join(",") : ""
  const comida = useMemo(
    () => (cama || !p ? { unidades: [], huecos: [] } : planComida(p.items, sitios, sentados, redonda ? 1 : w, redonda ? 1 : d)),
    [servidosClave, cama, mesa.capacidad, sentados, redonda],
  )
  const semillaGente = `${mesa.id}-${mesa.clienteId ?? ""}-${Math.floor(mesa.desde / 60000)}`

  return (
    <group position={[x, y, z]} rotation-y={((mesa.rot ?? 0) * Math.PI) / 180}>
      <group
        onPointerDown={(e) => {
          e.stopPropagation()
          onPresionar(mesa.id, e)
        }}
        onPointerOver={() => (document.body.style.cursor = organizar ? "grab" : "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <mesh position={[0, 0.5, 0]} visible={false}>
          <boxGeometry args={[(cama ? 2 : w) + 0.9, 1, (cama ? 1.6 : d) + 0.9]} />
        </mesh>
        {estilo === "actual" ? (
          <>
            {cama ? (
              <Cama />
            ) : redonda ? (
              <Mueble url={MUEBLES.mesaRedonda} medida={[1.0, 0.76, 1.0]} />
            ) : (
              <Mueble url={MUEBLES.mesa} medida={[w, 0.76, d]} />
            )}
            {!cama &&
              sitios.map((s, i) => (
                <Mueble key={i} url={MUEBLES.silla} medida={[null, 0.9, null]} position={[s.x, 0, s.z]} rotation-y={s.rot} />
              ))}
            {Array.from({ length: Math.min(servidos, sitios.length) }, (_, i) => {
              const s = sitios[i]
              if (cama) return null
              return (
                <group key={`pl${i}`} position={[s.x * 0.62, 0.77, s.z * 0.55]}>
                  <mesh>
                    <cylinderGeometry args={[0.13, 0.11, 0.025, 20]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.3} />
                  </mesh>
                  <mesh position={[0, 0.03, 0]}>
                    <sphereGeometry args={[0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <meshStandardMaterial color={["#e8866a", "#f2c14e", "#6bbf8a", "#d9774f"][i % 4]} roughness={0.7} />
                  </mesh>
                </group>
              )
            })}
            {mesa.estado === "cuenta" && !cama && (
              <mesh position={[w * 0.2, 0.78, 0]}>
                <boxGeometry args={[0.12, 0.02, 0.2]} />
                <meshStandardMaterial color="#0b2a2e" />
              </mesh>
            )}
            {sitios.slice(0, sentados).map((s, i) => (
              <Persona
                key={`p${i}`}
                url={personaPara(`${mesa.id}-${mesa.clienteId ?? ""}-${Math.floor(mesa.desde / 60000)}-${i}`)}
                animacion="sit"
                altura={1.3}
                sombras={false}
                position={[s.x, cama ? 0.42 : 0.02, s.z]}
                rotation-y={s.rot}
              />
            ))}
            <Aro color={color} ancho={cama ? 2 : w} fondo={cama ? 1.6 : d} parpadea={!!mesa.llamado} seleccionada={seleccionada || arrastrando} />
          </>
        ) : (
          <>
            {cama ? <CamaFina /> : <MueblesMesa w={redonda ? 1 : w} d={redonda ? 1 : d} redonda={redonda} sitios={sitios} huecos={comida.huecos} />}
            {!cama && <ComidaMesa unidades={comida.unidades} />}
            {mesa.estado === "cuenta" && !cama && <CuentaFina w={redonda ? 1 : w} />}
            {sitios.slice(0, sentados).map((s, i) => (
              <Sentado key={`p${i}`} estilo={estilo} semilla={semillaDe(`${semillaGente}-${i}`)} position={[s.x, cama ? -0.04 : 0, s.z]} rotation-y={s.rot} />
            ))}
            <AroFino color={color} ancho={cama ? 2 : w} fondo={cama ? 1.6 : d} parpadea={!!mesa.llamado} seleccionada={seleccionada || arrastrando} />
          </>
        )}
      </group>
      {!atenuada && <Ancla id={`mesa-${mesa.id}`} y={cama ? 2.6 : 1.55} datos={{ tipo: "mesa", nombre: mesa.nombre, chip: chip ?? undefined }} />}
    </group>
  )
})
