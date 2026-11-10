"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Minus, Plus } from "lucide-react"
import { hora12, NOMBRE_ZONA } from "@/lib/restaurante/local"
import type { Reserva, Zona } from "@/lib/restaurante/tipos"

const SRV = "/srv/restaurante"
const CLAVE = "bm:reserva"

type Listo =
  | { tipo: "reserva"; nombre: string; hora: string; personas: number; zona: Zona; mesa: string | null }
  | { tipo: "sinReserva"; nombre: string; delante: number }

async function accion<T>(cuerpo: unknown): Promise<T> {
  const r = await fetch(`${SRV}/accion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error ?? "No se pudo")
  return j as T
}

export default function Llegue() {
  const [guardada, setGuardada] = useState<Reserva | null>(null)
  const [modo, setModo] = useState<"reserva" | "sin">("reserva")
  const [dato, setDato] = useState("")
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [personas, setPersonas] = useState(2)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [listo, setListo] = useState<Listo | null>(null)

  useEffect(() => {
    const codigo = new URLSearchParams(window.location.search).get("codigo") ?? (() => {
      try {
        return localStorage.getItem(CLAVE)
      } catch {
        return null
      }
    })()
    if (!codigo) return
    fetch(`${SRV}/reservas/${encodeURIComponent(codigo)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r: Reserva | null) => r && ["confirmada", "recordada", "asistencia_confirmada", "solicitada"].includes(r.estado) && setGuardada(r))
      .catch(() => undefined)
  }, [])

  const llegue = async (cuerpo: { codigo?: string; telefono?: string }) => {
    setOcupado(true)
    setError("")
    try {
      const r = await accion<Omit<Extract<Listo, { tipo: "reserva" }>, "tipo">>({ tipo: "llegue", ...cuerpo })
      setListo({ tipo: "reserva", ...r })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const sinReserva = async () => {
    setOcupado(true)
    setError("")
    try {
      const r = await accion<{ delante: number }>({ tipo: "entradaSinReserva", nombre, telefono, personas })
      setListo({ tipo: "sinReserva", nombre: nombre.trim(), delante: r.delante })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const dePorDato = () => {
    const d = dato.trim()
    return /^bm-?\d+$/i.test(d) ? { codigo: d.toUpperCase().replace(/^BM-?/, "BM-") } : { telefono: d }
  }

  return (
    <div className="min-h-dvh bg-[#F4ECDF] text-[#0B2A2E]">
      <header className="relative h-56 overflow-hidden">
        <img src="/boca-marina/hero-sunset-sm.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#0B2A2E]/55" />
        <div className="relative flex h-full flex-col justify-between p-6 text-[#F4ECDF]">
          <div className="flex items-center gap-3">
            <img src="/marca/logo-boca-marina.png" alt="" className="h-10 w-10 rounded-md" />
            <div>
              <div className="font-display text-2xl leading-none">Boca Marina</div>
              <div className="text-[10px] tracking-[0.3em] text-[#7FCFCB]">RESTAURANT &amp; LOUNGE</div>
            </div>
          </div>
          <h1 className="font-display text-4xl leading-tight">Bienvenidos</h1>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-6">
        {listo ? (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[#E4D8C3] bg-[#FFFCF6] p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0B2A2E] text-[#F4ECDF]">
              <Check className="h-7 w-7" />
            </span>
            <h2 className="font-display text-3xl">Gracias, {listo.nombre.split(" ")[0]}</h2>
            {listo.tipo === "reserva" ? (
              <p className="text-base leading-relaxed">
                Ya le avisamos a la anfitriona que llegaron. Tu reserva es a las {hora12(listo.hora)} para {listo.personas} en {NOMBRE_ZONA[listo.zona]}
                {listo.mesa ? `, mesa ${listo.mesa}` : ""}. En un momento te llevamos a tu mesa.
              </p>
            ) : (
              <p className="text-base leading-relaxed">
                Te anotamos en la entrada{listo.delante ? `: hay ${listo.delante} ${listo.delante === 1 ? "grupo" : "grupos"} antes que ustedes` : ""}. La anfitriona te busca una mesa enseguida.
              </p>
            )}
          </section>
        ) : guardada ? (
          <section className="flex flex-col gap-4 rounded-2xl border border-[#E4D8C3] bg-[#FFFCF6] p-5">
            <div className="text-[11px] tracking-[0.2em] text-[#5E6E6C]">TU RESERVA DE HOY</div>
            <div className="font-display text-3xl">{guardada.nombre}</div>
            <p className="text-sm">
              {hora12(guardada.hora)} · {guardada.personas} personas · {NOMBRE_ZONA[guardada.zona]}
            </p>
            <button disabled={ocupado} onClick={() => llegue({ codigo: guardada.codigo })} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B2A2E] text-base font-medium text-[#F4ECDF] disabled:opacity-60">
              {ocupado && <Loader2 className="h-5 w-5 animate-spin" />} Ya llegué
            </button>
            <button onClick={() => setGuardada(null)} className="text-sm text-[#5E6E6C] underline">
              No soy yo
            </button>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 rounded-full bg-white/70 p-1 text-sm">
              {(["reserva", "sin"] as const).map((m) => (
                <button key={m} onClick={() => setModo(m)} className={`rounded-full py-2.5 font-medium ${modo === m ? "bg-[#0B2A2E] text-[#F4ECDF]" : ""}`}>
                  {m === "reserva" ? "Tengo reserva" : "No tengo reserva"}
                </button>
              ))}
            </div>
            {modo === "reserva" ? (
              <section className="flex flex-col gap-3 rounded-2xl border border-[#E4D8C3] bg-[#FFFCF6] p-5">
                <label htmlFor="ll-dato" className="text-sm font-medium">
                  Tu teléfono o el código de la reserva
                </label>
                <input
                  id="ll-dato"
                  value={dato}
                  onChange={(e) => setDato(e.target.value)}
                  inputMode="tel"
                  placeholder="809-000-0000 o BM-1234"
                  className="h-12 rounded-xl border border-[#E4D8C3] bg-white px-4 text-base outline-none focus:border-[#0B2A2E]"
                />
                <button disabled={ocupado || dato.trim().length < 4} onClick={() => llegue(dePorDato())} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B2A2E] text-base font-medium text-[#F4ECDF] disabled:opacity-50">
                  {ocupado && <Loader2 className="h-5 w-5 animate-spin" />} Ya llegué
                </button>
              </section>
            ) : (
              <section className="flex flex-col gap-3 rounded-2xl border border-[#E4D8C3] bg-[#FFFCF6] p-5">
                <label htmlFor="ll-nombre" className="text-sm font-medium">
                  ¿A nombre de quién?
                </label>
                <input id="ll-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" className="h-12 rounded-xl border border-[#E4D8C3] bg-white px-4 text-base outline-none focus:border-[#0B2A2E]" />
                <label htmlFor="ll-tel" className="text-sm font-medium">
                  Teléfono <span className="font-normal text-[#5E6E6C]">(opcional)</span>
                </label>
                <input id="ll-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="809-000-0000" className="h-12 rounded-xl border border-[#E4D8C3] bg-white px-4 text-base outline-none focus:border-[#0B2A2E]" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">¿Cuántos son?</span>
                  <div className="flex items-center gap-3">
                    <button aria-label="Uno menos" onClick={() => setPersonas((p) => Math.max(1, p - 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E4D8C3] bg-white">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-display text-3xl">{personas}</span>
                    <button aria-label="Uno más" onClick={() => setPersonas((p) => Math.min(30, p + 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E4D8C3] bg-white">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button disabled={ocupado || !nombre.trim()} onClick={sinReserva} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B2A2E] text-base font-medium text-[#F4ECDF] disabled:opacity-50">
                  {ocupado && <Loader2 className="h-5 w-5 animate-spin" />} Avisar que llegamos
                </button>
              </section>
            )}
          </>
        )}
        {error && <p className="rounded-xl bg-[#C8593B]/10 p-3 text-center text-sm text-[#8a3a24]">{error}</p>}
        <p className="text-center text-xs text-[#5E6E6C]">Boca Marina · Prolongación Duarte 12A, Boca Chica</p>
      </main>
    </div>
  )
}
