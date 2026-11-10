"use client"

import { useEffect, useState } from "react"
import { Car } from "lucide-react"
import { cn } from "@/lib/utils"

type Entrada = { clave: string; marca: string; modelo: string; desde: number; hasta: number; imagen: string; credito: string }

let indice: Promise<Entrada[]> | null = null
const cargarIndice = () => (indice ??= fetch("/colt/vehiculos/indice.json").then((r) => (r.ok ? r.json() : [])).catch(() => []))

const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

export function buscarFoto(lista: Entrada[], v: { marca?: string | null; modelo?: string | null; anio?: number | null }) {
  if (!v.marca || !v.modelo) return null
  const marca = normal(v.marca)
  const modelo = normal(v.modelo)
  const candidatos = lista
    .filter((e) => normal(e.marca) === marca && (modelo === normal(e.modelo) || modelo.startsWith(normal(e.modelo) + " ")))
    .sort((a, b) => b.modelo.length - a.modelo.length)
  if (!candidatos.length) return null
  const largo = candidatos[0].modelo.length
  const mismos = candidatos.filter((e) => e.modelo.length === largo)
  return (v.anio ? mismos.find((e) => v.anio! >= e.desde && v.anio! <= e.hasta) : null) ?? mismos[0]
}

export function fotoDelCliente(archivos: { tipo: string; url: string | null; vehiculo_id: string | null; foto_del_vehiculo?: boolean; eliminado: boolean }[] | null | undefined, vehiculoId?: string | null) {
  if (!archivos || !vehiculoId) return null
  const fotos = archivos.filter((a) => a.tipo === "image" && a.url && !a.eliminado && a.vehiculo_id === vehiculoId)
  return (fotos.find((a) => a.foto_del_vehiculo) ?? null)?.url ?? null
}

export function FotoVehiculo({ vehiculo, className, credito = false, propia }: {
  vehiculo: { marca?: string | null; modelo?: string | null; anio?: number | null }
  className?: string
  credito?: boolean
  propia?: string | null
}) {
  const [foto, setFoto] = useState<Entrada | null | undefined>(undefined)
  const [falla, setFalla] = useState(false)
  useEffect(() => {
    let vigente = true
    setFalla(false)
    cargarIndice().then((l) => { if (vigente) setFoto(buscarFoto(l, vehiculo)) })
    return () => { vigente = false }
  }, [vehiculo.marca, vehiculo.modelo, vehiculo.anio])

  const texto = [vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(" ")
  if (propia) {
    return (
      <div className={cn("relative overflow-hidden bg-secondary", className)}>
        <img src={propia} alt={texto} loading="lazy" draggable={false} className="h-full w-full select-none object-cover" />
        {credito && <span className="absolute bottom-1 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90">Foto del cliente</span>}
      </div>
    )
  }
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      {foto && !falla ? (
        <>
          <img src={`/colt/${foto.imagen}`} alt={texto} loading="lazy" draggable={false} onError={() => setFalla(true)}
            className="h-full w-full select-none object-cover" title={foto.credito} />
          {credito && <span className="absolute bottom-1 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90">{foto.credito}</span>}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-label={texto}>
          <Car className="h-1/3 w-1/3 max-h-10 max-w-10" aria-hidden />
        </div>
      )}
    </div>
  )
}
