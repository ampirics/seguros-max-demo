"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CalendarCheck, DoorOpen, Loader2 } from "lucide-react"
import { diaLargo, fechaLocal, hora12, NEGOCIO, NOMBRE_ZONA } from "@/lib/restaurante/local"
import type { Reserva } from "@/lib/restaurante/tipos"

const SRV = "/srv/restaurante"

export default function MiReserva() {
  const codigo = useParams<{ codigo: string }>()?.codigo ?? ""
  const [r, setR] = useState<Reserva | null>(null)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [cancelar, setCancelar] = useState(false)

  const cargar = () =>
    fetch(`${SRV}/reservas/${encodeURIComponent(codigo)}`)
      .then(async (x) => (x.ok ? setR(await x.json()) : setError("No encontramos esa reserva.")))
      .catch(() => setError("No pudimos cargar la reserva."))

  useEffect(() => {
    if (codigo) cargar()
  }, [codigo])

  // Para que el QR de la entrada lo reconozca sin escribir nada.
  useEffect(() => {
    if (!r) return
    try {
      localStorage.setItem("bm:reserva", r.codigo)
    } catch {}
  }, [r])

  const llegue = async () => {
    if (!r) return
    setOcupado(true)
    await fetch(`${SRV}/accion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "llegue", codigo: r.codigo }) })
    await cargar()
    setOcupado(false)
  }

  const cambiar = async (estado: Reserva["estado"], nota: string) => {
    if (!r) return
    setOcupado(true)
    await fetch(`${SRV}/accion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "reservaEstado", reservaId: r.id, estado, nota }) })
    await cargar()
    setOcupado(false)
    setCancelar(false)
  }

  const activa = r && ["confirmada", "recordada", "asistencia_confirmada", "solicitada", "lista_espera"].includes(r.estado)
  const hoy = !!r && r.fecha === fechaLocal(Date.now()) && activa && r.estado !== "lista_espera"

  return (
    <div className="min-h-dvh bg-[#F4ECDF] text-[#0B2A2E]">
      <header className="relative h-64 overflow-hidden">
        <img src="/boca-marina/sea-view-sm.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#0B2A2E]/55" />
        <div className="relative flex h-full flex-col justify-between p-6 text-[#F4ECDF]">
          <div className="flex items-center gap-3">
            <img src="/marca/logo-boca-marina.png" alt="" className="h-10 w-10 rounded-md" />
            <div>
              <div className="font-display text-2xl leading-none">Boca Marina</div>
              <div className="text-[10px] tracking-[0.3em] text-[#7FCFCB]">RESTAURANT &amp; LOUNGE</div>
            </div>
          </div>
          <h1 className="font-display text-4xl leading-tight">Tu reserva</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-6">
        {error ? (
          <p className="rounded-xl bg-white/70 p-5 text-center">{error}</p>
        ) : !r ? (
          <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-[#0B2A2E]/50" />
        ) : (
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-[#E4D8C3] bg-[#FFFCF6] p-5">
              <div className="text-[11px] tracking-[0.2em] text-[#5E6E6C]">
                {r.estado === "cancelada" ? "CANCELADA" : r.estado === "asistencia_confirmada" ? "CONFIRMASTE QUE VIENES" : r.estado === "lista_espera" ? "LISTA DE ESPERA" : "CONFIRMADA"}
              </div>
              <div className="mt-2 font-display text-3xl first-letter:uppercase">{diaLargo(r.fecha)}</div>
              <div className="font-display text-3xl text-[#C8593B]">{hora12(r.hora)}</div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] text-[#5E6E6C]">Dónde</dt>
                  <dd>{NOMBRE_ZONA[r.zona]}{r.mesaId ? ` · ${r.mesaId}` : ""}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[#5E6E6C]">Personas</dt>
                  <dd>{r.personas}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[#5E6E6C]">A nombre de</dt>
                  <dd>{r.nombre}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[#5E6E6C]">Código</dt>
                  <dd className="font-mono font-semibold text-[#C8593B]">{r.codigo}</dd>
                </div>
              </dl>
              {r.ocasion && <p className="mt-3 text-sm">{r.ocasion}</p>}
            </section>
            {hoy &&
              (r.llegoEn ? (
                <p className="flex items-center justify-center gap-2 rounded-2xl bg-[#7FCFCB]/30 p-4 text-sm font-medium">
                  <DoorOpen className="h-5 w-5" /> Ya avisamos a la anfitriona que llegaste
                </p>
              ) : (
                <button disabled={ocupado} onClick={llegue} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#C8593B] text-base font-medium text-white disabled:opacity-60">
                  <DoorOpen className="h-5 w-5" /> Ya llegué
                </button>
              ))}
            {activa && !hoy && r.estado !== "asistencia_confirmada" && (
              <button disabled={ocupado} onClick={() => cambiar("asistencia_confirmada", "Confirmó desde su reserva en línea")} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B2A2E] text-base font-medium text-[#F4ECDF] disabled:opacity-60">
                <CalendarCheck className="h-5 w-5" /> Confirmo que voy
              </button>
            )}
            {activa &&
              (cancelar ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-4 text-sm">
                  <span>¿Seguro que quieres cancelarla?</span>
                  <div className="flex gap-2">
                    <button onClick={() => setCancelar(false)} className="rounded-full px-3 py-2">No</button>
                    <button disabled={ocupado} onClick={() => cambiar("cancelada", "Cancelada por el cliente desde su reserva en línea")} className="rounded-full bg-[#C8593B] px-4 py-2 text-white">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setCancelar(true)} className="h-12 rounded-2xl border border-[#E4D8C3] text-sm">Cancelar mi reserva</button>
              ))}
            <p className="text-center text-xs text-[#5E6E6C]">Para cambiar la hora o las personas escríbenos por WhatsApp al {NEGOCIO.whatsapp}. {NEGOCIO.direccion}.</p>
          </div>
        )}
      </main>
    </div>
  )
}
