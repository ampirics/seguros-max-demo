"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { useProgress } from "@react-three/drei"
import PlanoLimpio from "@/components/restaurante/plano/PlanoLimpio"
import { restauranteApi } from "@/lib/restaurante/cliente"
import type { Estado } from "@/lib/restaurante/tipos"
import type { Fase } from "./Entorno"
import type { VistaZona } from "./Escena"
import type { Estilo } from "./estilos"
import { VentanaMesa } from "./VentanaMesa"

const Escena3D = dynamic(() => import("./Escena"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando el salón en 3D…
    </div>
  ),
})

function hayWebGL() {
  try {
    const c = document.createElement("canvas")
    return !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

function Progreso() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-full bg-[#0B2A2E]/85 px-4 py-2 text-sm text-[#F4ECDF] shadow-lg">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando el salón… {Math.round(progress)} %
      </div>
    </div>
  )
}

/** Salón en 3D con la ventana emergente de cada mesa. Sin WebGL cae al plano de trabajo. */
export function Salon3D({
  estado,
  ahora,
  zona,
  organizar = false,
  compacto = false,
  estilo,
  hora,
}: {
  estado: Estado
  ahora: number
  zona: VistaZona
  organizar?: boolean
  compacto?: boolean
  estilo?: Estilo
  hora?: Fase
}) {
  const [sel, setSel] = useState<string>()
  const [webgl, setWebgl] = useState<boolean | null>(null)
  useEffect(() => setWebgl(hayWebGL()), [])

  const mover = (id: string, x: number, y: number) => {
    const m = estado.mesas.find((z) => z.id === id)
    restauranteApi.accion({ tipo: "moverMesa", mesaId: id, x, y, rot: m?.rot }).catch((e) => toast.error((e as Error).message))
  }

  return (
    <>
      {webgl === false ? (
        <PlanoLimpio estado={estado} ahora={ahora} seleccion={sel} onMesa={setSel} />
      ) : webgl === null ? null : (
        <>
          <Escena3D estado={estado} ahora={ahora} zona={zona} organizar={organizar} compacto={compacto} estilo={estilo} hora={hora} seleccion={sel} onMesa={setSel} onMover={mover} />
          <Progreso />
        </>
      )}
      <VentanaMesa key={sel} estado={estado} ahora={ahora} mesaId={sel} organizar={organizar} onCerrar={() => setSel(undefined)} />
    </>
  )
}
