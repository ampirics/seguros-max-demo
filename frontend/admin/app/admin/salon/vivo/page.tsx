"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { ArrowLeft, Check, Move, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ESTADO_MESA, ORDEN_ESTADOS } from "@/components/restaurante/plano/estados"
import { centroZona } from "@/components/restaurante/salon3d/coords"
import type { Fase } from "@/components/restaurante/salon3d/Entorno"
import type { VistaZona } from "@/components/restaurante/salon3d/Escena"
import { esEstilo, esFase, ESTILO_INICIAL, type Estilo } from "@/components/restaurante/salon3d/estilos"
import { Salon3D } from "@/components/restaurante/salon3d/Salon3D"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { fechaLocal, horaLocal, tsLocal, ZONAS } from "@/lib/restaurante/local"
import type { Estado, Zona } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const VISTAS: { id: VistaZona; nombre: string }[] = [
  { id: "todo", nombre: "Todo" },
  { id: "terraza", nombre: "Terraza" },
  { id: "muelle", nombre: "Muelle" },
  { id: "gazebo", nombre: "Gazebo" },
  { id: "salon", nombre: "Salón" },
]

export default function SalonVivo() {
  const { estado, ahora } = useRestaurante()
  const [zona, setZona] = useState<VistaZona>("todo")
  const [organizar, setOrganizar] = useState(false)
  const [agregar, setAgregar] = useState(false)
  const { estilo, hora, setHora } = useEstilo3D()

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0B2A2E] text-[#F4ECDF]">
      <header className="z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 bg-[#0B2A2E]/95 px-4 py-2.5 backdrop-blur">
        <Link href="/admin/salon" className="flex items-center gap-2.5" aria-label="Volver al panel">
          <ArrowLeft className="h-4 w-4 text-[#F4ECDF]/60" aria-hidden />
          <img src="/marca/logo-boca-marina.png" alt="" className="h-8 w-8 rounded-md" />
          <span className="leading-none">
            <span className="block font-display text-xl font-semibold">Boca Marina</span>
            <span className="text-[9px] uppercase tracking-[0.3em] text-[#7FCFCB]">Salón en vivo</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm text-[#F4ECDF]/75">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6BBF8A] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#6BBF8A]" />
          </span>
          {horaLocal(ahora)}
        </div>
        {estado && <Contadores estado={estado} ahora={ahora} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-white/5 p-1" role="group" aria-label="Zona">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                onClick={() => setZona(v.id)}
                aria-pressed={zona === v.id}
                className={cn("h-10 rounded-lg px-3.5 text-sm font-medium transition", zona === v.id ? "bg-[#F4ECDF] text-[#0B2A2E]" : "text-[#F4ECDF]/75 hover:text-[#F4ECDF]")}
              >
                {v.nombre}
              </button>
            ))}
          </div>
          {estilo !== "actual" && (
            <div className="flex rounded-xl bg-white/5 p-1" role="group" aria-label="Momento del día">
              {([[undefined, "Ahora"], ["dia", "Día"], ["dorada", "Atardecer"], ["noche", "Noche"]] as const).map(([f, nombre]) => (
                <button
                  key={nombre}
                  onClick={() => setHora(f)}
                  aria-pressed={hora === f}
                  className={cn("h-10 rounded-lg px-3 text-sm font-medium transition", hora === f ? "bg-[#E8866A] text-[#0B2A2E]" : "text-[#F4ECDF]/75 hover:text-[#F4ECDF]")}
                >
                  {nombre}
                </button>
              ))}
            </div>
          )}
          {organizar && (
            <Button className="h-11 gap-1.5 bg-[#7FCFCB] text-[#0B2A2E] hover:bg-[#7FCFCB]/90" onClick={() => setAgregar(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Agregar mesa
            </Button>
          )}
          <Button
            className={cn("h-11 gap-1.5", organizar ? "bg-[#E8866A] text-[#0B2A2E] hover:bg-[#E8866A]/90" : "bg-white/10 text-[#F4ECDF] hover:bg-white/15")}
            onClick={() => setOrganizar((v) => !v)}
            aria-pressed={organizar}
          >
            {organizar ? <Check className="h-4 w-4" aria-hidden /> : <Move className="h-4 w-4" aria-hidden />}
            {organizar ? "Listo" : "Organizar mesas"}
          </Button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {estado ? <Salon3D estado={estado} ahora={ahora} zona={zona} organizar={organizar} estilo={estilo} hora={hora} /> : <div className="grid h-full place-items-center text-sm text-[#F4ECDF]/60">Conectando con el restaurante…</div>}
        {organizar && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-[#E8866A] px-4 py-2 text-sm font-medium text-[#0B2A2E] shadow-lg">
            Arrastra una mesa para moverla. Tócala para girarla, cambiar sus puestos o quitarla.
          </div>
        )}
        {estado && <Leyenda estado={estado} />}
      </main>

      <AgregarMesa abierto={agregar} onCerrar={() => setAgregar(false)} zonaInicial={zona === "todo" ? "terraza" : zona} />
    </div>
  )
}

/** El estilo es Caribe; ?estilo= en la dirección permite ver otro. ?hora= fuerza el momento del día. */
function useEstilo3D() {
  const [estilo, setEstilo] = useState<Estilo>(ESTILO_INICIAL)
  const [hora, setHora] = useState<Fase | undefined>("dia")
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const deUrl = q.get("estilo")
    if (esEstilo(deUrl)) setEstilo(deUrl)
    const h = q.get("hora")
    if (esFase(h)) setHora(h)
  }, [])
  return { estilo, hora, setHora }
}

function Contadores({ estado, ahora }: { estado: Estado; ahora: number }) {
  const hoy = fechaLocal(ahora)
  const ocupadas = estado.mesas.filter((m) => !["libre", "reservada", "limpieza"].includes(m.estado)).length
  const cocina = estado.pedidos.flatMap((p) => p.items).filter((i) => i.estado === "pendiente" || i.estado === "preparando").length
  const llamados = estado.mesas.filter((m) => m.llamado).length
  const llegan = estado.reservas.filter((r) => r.fecha === hoy && ["confirmada", "recordada", "asistencia_confirmada"].includes(r.estado) && tsLocal(r.fecha, r.hora) > ahora - 30 * 60000).length
  const items = [
    { t: "Ocupadas", v: `${ocupadas}/${estado.mesas.length}` },
    { t: "En cocina", v: String(cocina) },
    { t: "Llamados", v: String(llamados), alerta: llamados > 0 },
    { t: "Por llegar", v: String(llegan) },
  ]
  return (
    <div className="flex gap-4">
      {items.map((x) => (
        <div key={x.t} className="leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-[#F4ECDF]/55">{x.t}</div>
          <div className={cn("font-display text-xl font-semibold tabular-nums", x.alerta && "text-[#E8866A]")}>{x.v}</div>
        </div>
      ))}
    </div>
  )
}

function Leyenda({ estado }: { estado: Estado }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-xl bg-[#0B2A2E]/85 px-3.5 py-2.5 text-xs backdrop-blur">
      {ORDEN_ESTADOS.map((e) => (
        <span key={e} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ESTADO_MESA[e].color }} />
          {ESTADO_MESA[e].nombre}
          <span className="tabular-nums text-[#F4ECDF]/50">{estado.mesas.filter((m) => m.estado === e).length}</span>
        </span>
      ))}
    </div>
  )
}

function AgregarMesa({ abierto, onCerrar, zonaInicial }: { abierto: boolean; onCerrar: () => void; zonaInicial: Zona }) {
  const [zona, setZona] = useState<Zona>(zonaInicial)
  const [capacidad, setCapacidad] = useState(4)
  const [nombre, setNombre] = useState("")
  const crear = async () => {
    const c = centroZona(zona)
    try {
      await restauranteApi.accion({ tipo: "agregarMesa", zona, capacidad, x: c.x, y: c.y, nombre: nombre.trim() || undefined })
      toast.success("Mesa agregada en el centro de la zona: arrástrala a su lugar")
      setNombre("")
      onCerrar()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Agregar mesa</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <div className="grid gap-1.5">
            <span className="text-muted-foreground">Zona</span>
            <div className="grid grid-cols-2 gap-2">
              {ZONAS.map((z) => (
                <button key={z.id} onClick={() => setZona(z.id)} className={cn("h-11 rounded-lg border px-3 text-left", zona === z.id && "border-primary bg-accent font-medium")}>
                  {z.nombre}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-muted-foreground">Puestos</span>
            <div className="flex flex-wrap gap-2">
              {[2, 4, 6, 8, 10, 12].map((n) => (
                <button key={n} onClick={() => setCapacidad(n)} className={cn("h-11 w-14 rounded-lg border", capacidad === n && "border-primary bg-accent font-medium")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">Nombre (opcional)</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Esquina del muelle" className="h-11 rounded-lg border bg-background px-3" />
          </label>
          <Button className="h-11" onClick={crear}>Agregar al plano</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
