"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber"
import { CameraControls, CameraControlsImpl, PerformanceMonitor } from "@react-three/drei"
import * as THREE from "three"
import { minutosDelDia } from "@/lib/restaurante/local"
import type { Estado, Zona } from "@/lib/restaurante/tipos"
import { deX, deZ, limitar, pisoDe, VISTAS } from "./coords"
import { Entorno, fasePorMinuto, type Fase } from "./Entorno"
import { EntornoFino } from "./EntornoFino"
import { EstiloCtx, type Estilo } from "./estilos"
import { Equipo } from "./Equipo"
import { CapaEtiquetas, Proyector } from "./Etiquetas"
import { MesaObj } from "./Mesas"

export type VistaZona = "todo" | Zona

export interface PropsEscena {
  estado: Estado
  ahora: number
  compacto?: boolean
  organizar?: boolean
  zona: VistaZona
  seleccion?: string
  estilo?: Estilo
  hora?: Fase
  onMesa: (id: string) => void
  onMover: (id: string, x: number, y: number) => void
}

const ACCION = CameraControlsImpl.ACTION

/** Arrastrar gira alrededor del salón, clic derecho o tres dedos desplazan, dos dedos o el panel táctil desplazan y pellizcar acerca. */
function useMoverComoMapa(controles: React.MutableRefObject<CameraControls | null>) {
  const { gl } = useThree()
  useEffect(() => {
    const c = controles.current
    if (!c) return
    c.mouseButtons.left = ACCION.ROTATE
    c.azimuthRotateSpeed = 0.45
    c.polarRotateSpeed = 0.45
    c.mouseButtons.right = ACCION.SCREEN_PAN
    c.mouseButtons.middle = ACCION.DOLLY
    c.mouseButtons.wheel = ACCION.NONE
    c.touches.one = ACCION.TOUCH_ROTATE
    c.touches.two = ACCION.TOUCH_DOLLY_TRUCK
    c.touches.three = ACCION.TOUCH_SCREEN_PAN
    c.dollyToCursor = true
    const rueda = (e: WheelEvent) => {
      e.preventDefault()
      const paso = Math.max(0.004, c.distance * 0.0016)
      if (e.ctrlKey) {
        void c.dolly(-e.deltaY * 0.06 * Math.max(1, c.distance / 12), true)
      } else if (e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || Math.abs(e.deltaY) < 40)) {
        void c.truck(e.deltaX * paso, 0, true)
        void c.forward(-e.deltaY * paso, true)
      } else {
        void c.dolly(-Math.sign(e.deltaY) * Math.max(1, c.distance * 0.12), true)
      }
    }
    gl.domElement.addEventListener("wheel", rueda, { passive: false })
    return () => gl.domElement.removeEventListener("wheel", rueda)
  }, [controles, gl])
}

function Camara({ zona, compacto, controles }: { zona: VistaZona; compacto?: boolean; controles: React.MutableRefObject<CameraControls | null> }) {
  useMoverComoMapa(controles)
  useEffect(() => {
    const v = VISTAS[zona]
    const lejos = compacto && zona === "todo" ? 1.08 : 1
    controles.current?.setLookAt(v.pos[0] * lejos, v.pos[1] * lejos, v.pos[2] * lejos, ...v.mira, true)
  }, [zona, compacto, controles])
  return (
    <CameraControls
      ref={controles}
      makeDefault
      minDistance={4}
      maxDistance={38}
      minPolarAngle={0.15}
      maxPolarAngle={1.22}
      dollySpeed={0.6}
      smoothTime={0.35}
    />
  )
}

/** Arrastre de mesas en modo organizar: se proyecta el puntero sobre el piso de la zona de la mesa. */
function useArrastre(props: PropsEscena, controles: React.MutableRefObject<CameraControls | null>) {
  const { camera, gl } = useThree()
  const [temporal, setTemporal] = useState<Record<string, { x: number; y: number }>>({})
  const [arrastrando, setArrastrando] = useState<string>()
  const vivo = useRef(props)
  vivo.current = props

  const presionar = useCallback(
    (mesaId: string, e: ThreeEvent<PointerEvent>) => {
      const p = vivo.current
      const mesa = p.estado.mesas.find((m) => m.id === mesaId)
      if (!mesa) return
      if (!p.organizar) {
        const x0 = e.nativeEvent.clientX
        const y0 = e.nativeEvent.clientY
        const soltar = (ev: PointerEvent) => {
          window.removeEventListener("pointerup", soltar)
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) vivo.current.onMesa(mesaId)
        }
        window.addEventListener("pointerup", soltar)
        return
      }
      if (controles.current) controles.current.enabled = false
      setArrastrando(mesaId)
      const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -pisoDe(mesa.zona))
      const rayo = new THREE.Raycaster()
      const punto = new THREE.Vector3()
      const x0 = e.nativeEvent.clientX
      const y0 = e.nativeEvent.clientY
      let movio = false
      let ultimo = { x: mesa.x, y: mesa.y }
      const mover = (ev: PointerEvent) => {
        if (!movio && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
        movio = true
        const r = gl.domElement.getBoundingClientRect()
        rayo.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
        if (!rayo.ray.intersectPlane(plano, punto)) return
        ultimo = limitar(mesa.zona, deX(punto.x), deZ(punto.z))
        setTemporal((t) => ({ ...t, [mesaId]: ultimo }))
      }
      const soltar = () => {
        window.removeEventListener("pointermove", mover)
        window.removeEventListener("pointerup", soltar)
        if (controles.current) controles.current.enabled = true
        setArrastrando(undefined)
        if (movio) vivo.current.onMover(mesaId, ultimo.x, ultimo.y)
        else vivo.current.onMesa(mesaId)
      }
      window.addEventListener("pointermove", mover)
      window.addEventListener("pointerup", soltar)
    },
    [camera, gl, controles],
  )

  // Cuando el servidor ya trae la posición nueva, se suelta la temporal.
  useEffect(() => {
    setTemporal((t) => {
      const llegaron = Object.keys(t).filter((id) => {
        if (id === arrastrando) return false
        const m = props.estado.mesas.find((x) => x.id === id)
        return !m || (Math.abs(m.x - t[id].x) < 0.2 && Math.abs(m.y - t[id].y) < 0.2)
      })
      if (!llegaron.length) return t
      const sig = { ...t }
      llegaron.forEach((id) => delete sig[id])
      return sig
    })
  }, [props.estado.mesas, arrastrando])

  return { temporal, arrastrando, presionar }
}

function Contenido(props: PropsEscena & { liviano: boolean }) {
  const controles = useRef<CameraControls | null>(null)
  const { temporal, arrastrando, presionar } = useArrastre(props, controles)
  const fase = props.hora ?? fasePorMinuto(minutosDelDia(props.ahora))
  const estilo = props.estilo ?? "actual"
  const techoOculto = props.zona === "terraza" || !!props.organizar
  const sombras = !props.compacto && !props.liviano
  const ctx = useMemo(() => ({ estilo, fase }), [estilo, fase])
  return (
    <EstiloCtx.Provider value={ctx}>
      <Camara zona={props.zona} compacto={props.compacto} controles={controles} />
      <Suspense fallback={null}>
        {estilo === "actual" ? (
          <Entorno fase={fase} techoTransparente techoOculto={techoOculto} sombras={sombras} />
        ) : (
          <EntornoFino estilo={estilo} fase={fase} techoOculto={techoOculto} sombras={sombras} liviano={props.liviano} />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {props.estado.mesas.map((m) => (
          <MesaObj
            key={m.id}
            mesa={m}
            estado={props.estado}
            ahora={props.ahora}
            seleccionada={props.seleccion === m.id}
            atenuada={props.zona !== "todo" && m.zona !== props.zona}
            organizar={!!props.organizar}
            arrastrando={arrastrando === m.id}
            posicion={temporal[m.id]}
            onPresionar={presionar}
          />
        ))}
      </Suspense>
      <Suspense fallback={null}>
        <Equipo estado={props.estado} />
      </Suspense>
    </EstiloCtx.Provider>
  )
}

export default function Escena3D(props: PropsEscena) {
  const [liviano, setLiviano] = useState(false)
  const [dpr, setDpr] = useState(props.compacto ? 1.25 : 1.5)
  return (
    <div className="relative isolate h-full w-full">
      <Canvas
        shadows={!props.compacto && !liviano}
        dpr={dpr}
        camera={{ position: VISTAS.todo.pos, fov: 38, near: 0.1, far: 220 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => (document.body.style.cursor = "")}
        style={{ touchAction: "none" }}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1)
            setLiviano(true)
          }}
          flipflops={2}
          onFallback={() => {
            setDpr(1)
            setLiviano(true)
          }}
        />
        <Contenido {...props} liviano={liviano} />
        <Proyector />
      </Canvas>
      <CapaEtiquetas />
    </div>
  )
}
