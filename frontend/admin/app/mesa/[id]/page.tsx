"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Bell, Check, ChevronDown, Loader2, Receipt, Star, UserRound, UtensilsCrossed } from "lucide-react"
import { CARTA, CATEGORIAS, ITBIS, SERVICIO, PLATOS, rd } from "@/lib/restaurante/carta"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { NOMBRE_ZONA } from "@/lib/restaurante/local"
import type { EstadoItem, MetodoPago, Pedido, SesionMesa } from "@/lib/restaurante/tipos"
import { cantidadTexto, fotoDe } from "@/components/restaurante/operacion/util"
import { cn } from "@/lib/utils"

const PASOS: EstadoItem[] = ["pendiente", "preparando", "listo", "servido"]
const TEXTO: Record<EstadoItem, string> = { pendiente: "Recibido en cocina", preparando: "Preparándose", listo: "Saliendo a tu mesa", servido: "Servido" }
const METODO: Record<MetodoPago, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" }
const SERIF = { fontFamily: "var(--font-cormorant), Georgia, serif" }

type Cuenta = { subtotal: number; itbis: number; servicio: number; propina: number; total: number }
type DatosSesion = {
  sesion: SesionMesa
  estado: "abierta" | "cuenta" | "pagada" | "cerrada"
  cliente: { nombre: string } | null
  pedido: Pedido | null
  cuenta: Cuenta | null
  visita: (Cuenta & { id: string; metodo: MetodoPago; platos: { platoId: string; cantidad: number; importe: number }[]; calificacion: number | null; comentario: string | null }) | null
}

const claveSesion = (mesaId: string) => `bm:sesion:${mesaId.toUpperCase()}`
const leer = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const guardar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {}
}

/** La sesión del QR: se abre al escanear con la mesa abierta y sigue viva hasta la reseña, aunque la mesa ya se haya liberado. */
function useSesion(mesaId: string, pedidoId?: string) {
  const [datos, setDatos] = useState<DatosSesion | null>(null)
  const cargar = useCallback(async (sid: string) => {
    const r = await fetch(`/srv/restaurante/sesion/${sid}`)
    if (r.ok) setDatos(await r.json())
    else setDatos(null)
  }, [])

  useEffect(() => {
    if (!mesaId) return
    const sid = leer(claveSesion(mesaId))
    if (pedidoId) {
      restauranteApi
        .accion<{ sesion: SesionMesa }>({ tipo: "sesionMesa", mesaId, sesionId: sid ?? undefined })
        .then((r) => {
          guardar(claveSesion(mesaId), r.sesion.id)
          return cargar(r.sesion.id)
        })
        .catch(() => undefined)
    } else if (sid) cargar(sid).catch(() => undefined)
  }, [mesaId, pedidoId, cargar])

  useEffect(() => {
    const sid = datos?.sesion.id
    if (!sid || (datos?.estado === "pagada" && datos.visita?.calificacion)) return
    const t = setInterval(() => cargar(sid).catch(() => undefined), 4000)
    return () => clearInterval(t)
  }, [datos?.sesion.id, datos?.estado, datos?.visita?.calificacion, cargar])

  return { datos, recargar: () => (datos ? cargar(datos.sesion.id) : Promise.resolve()) }
}

export default function MesaQR() {
  const id = useParams<{ id: string }>()?.id ?? ""
  const { estado } = useRestaurante()
  const [verCarta, setVerCarta] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const mesa = estado?.mesas.find((m) => m.id.toLowerCase() === String(id).toLowerCase())
  const { datos, recargar } = useSesion(mesa?.id ?? "", mesa?.pedidoId)
  const pagada = datos?.estado === "pagada" && datos.visita
  const abierta = datos && (datos.estado === "abierta" || datos.estado === "cuenta") && datos.pedido

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const llamar = async (llamado: "mesero" | "cuenta") => {
    if (!mesa) return
    setEnviando(true)
    try {
      await restauranteApi.accion({ tipo: "llamar", mesaId: mesa.id, llamado, origen: "qr" })
      setAviso(llamado === "mesero" ? "Listo, tu mesero ya viene." : "Listo, te traemos la cuenta.")
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#F4ECDF] text-[#0B2A2E]" style={{ colorScheme: "light" }}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <header className="relative h-56 overflow-hidden">
          <img src="/boca-marina/hero-sunset-sm.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B2A2E]/30 via-[#0B2A2E]/20 to-[#0B2A2E]/80" />
          <div className="relative flex h-full flex-col justify-between p-5 text-[#F4ECDF]">
            <div className="flex items-center gap-2.5">
              <img src="/marca/logo-boca-marina.png" alt="" className="h-9 w-9 rounded-md" />
              <div className="leading-none">
                <p className="font-display text-xl" style={SERIF}>Boca Marina</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.3em] text-[#7FCFCB]">Restaurant &amp; Lounge</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#F4ECDF]/80">{mesa ? NOMBRE_ZONA[mesa.zona] : "Boca Chica"}</p>
              <h1 className="text-5xl leading-none" style={SERIF}>{mesa ? `Mesa ${mesa.nombre}` : "Bienvenidos"}</h1>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-5 px-4 py-5">
          {!estado ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#0B2A2E]/60"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando…</div>
          ) : !mesa ? (
            <p className="rounded-xl bg-white/70 p-5 text-center text-sm">No encontramos esta mesa. Pídele ayuda a tu mesero.</p>
          ) : pagada ? (
            <Resena datos={datos} onEnviada={recargar} />
          ) : (
            <>
              {abierta ? (
                <section className="flex flex-col gap-3">
                  <p className="text-sm text-[#0B2A2E]/70">{datos.cliente ? `Hola, ${datos.cliente.nombre.split(" ")[0]}. Estamos para servirte.` : "Estamos para servirte. Desde aquí sigues tu pedido y tu cuenta."}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => llamar("mesero")}
                      disabled={enviando || mesa.llamado?.tipo === "mesero"}
                      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-[#0B2A2E] px-3 text-base font-medium text-[#F4ECDF] shadow-sm transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <Bell className="h-6 w-6" aria-hidden />
                      {mesa.llamado?.tipo === "mesero" ? "Ya viene tu mesero" : "Llamar al mesero"}
                    </button>
                    <button
                      onClick={() => llamar("cuenta")}
                      disabled={enviando || mesa.estado === "cuenta"}
                      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-[#E8866A] px-3 text-base font-medium text-[#0B2A2E] shadow-sm transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <Receipt className="h-6 w-6" aria-hidden />
                      {mesa.estado === "cuenta" ? "Cuenta en camino" : "Pedir la cuenta"}
                    </button>
                  </div>
                  {aviso && <p role="status" className="rounded-xl bg-[#7FCFCB]/40 px-4 py-2.5 text-center text-sm font-medium">{aviso}</p>}
                  {!datos.cliente && <Identificarse mesaId={mesa.id} sesionId={datos.sesion.id} onListo={recargar} />}
                </section>
              ) : (
                <section className="rounded-2xl bg-white/80 p-5 shadow-sm">
                  <p className="text-3xl leading-tight" style={SERIF}>Bienvenidos a Boca Marina</p>
                  <p className="mt-2 text-sm text-[#0B2A2E]/70">
                    {mesa.estado === "reservada" ? "Esta mesa está reservada. Tu anfitriona te acompaña en un momento." : "Mientras te atienden, mira la carta. Cuando tu mesero abra la mesa, desde aquí puedes llamarlo, pedir la cuenta y seguir tu pedido."}
                  </p>
                </section>
              )}

              {abierta && datos.pedido && (
                <section className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <h2 className="mb-3 text-2xl" style={SERIF}>Tu pedido</h2>
                  {datos.pedido.items.length ? (
                    <ul className="flex flex-col gap-3">
                      {datos.pedido.items.map((i) => {
                        const paso = PASOS.indexOf(i.estado)
                        return (
                          <li key={i.id}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="min-w-0 font-medium">{cantidadTexto(i.cantidad, PLATOS.get(i.platoId)?.porLibra)} {i.nombre}</span>
                              <span className={cn("shrink-0 text-xs font-semibold", i.estado === "listo" ? "text-[#2F7D4F]" : "text-[#0B2A2E]/60")}>{TEXTO[i.estado]}</span>
                            </div>
                            <div className="mt-1.5 grid grid-cols-4 gap-1" aria-hidden>
                              {PASOS.map((p, k) => (
                                <span key={p} className={cn("h-1.5 rounded-full", k <= paso ? (k === 3 ? "bg-[#7FCFCB]" : "bg-[#E8866A]") : "bg-[#0B2A2E]/10")} />
                              ))}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#0B2A2E]/60">Todavía no han ordenado. Mira la carta mientras tanto.</p>
                  )}
                  {datos.pedido.items.length > 0 && datos.pedido.items.every((i) => i.estado === "servido") && (
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-[#2F7D4F]"><Check className="h-4 w-4" /> Todo servido. Buen provecho.</p>
                  )}
                  {datos.cuenta && datos.cuenta.subtotal > 0 && (
                    <dl className="mt-4 grid grid-cols-2 gap-y-1 border-t border-[#0B2A2E]/10 pt-3 text-sm">
                      <dt className="text-[#0B2A2E]/60">Subtotal</dt>
                      <dd className="text-right tabular-nums">{rd(datos.cuenta.subtotal)}</dd>
                      <dt className="text-[#0B2A2E]/60">ITBIS {ITBIS * 100} %</dt>
                      <dd className="text-right tabular-nums">{rd(datos.cuenta.itbis)}</dd>
                      <dt className="text-[#0B2A2E]/60">Servicio de ley {SERVICIO * 100} %</dt>
                      <dd className="text-right tabular-nums">{rd(datos.cuenta.servicio)}</dd>
                      <dt className="font-semibold">Total hasta ahora</dt>
                      <dd className="text-right font-semibold tabular-nums">{rd(datos.cuenta.total)}</dd>
                    </dl>
                  )}
                </section>
              )}
            </>
          )}

          <section className="rounded-2xl bg-white/80 shadow-sm">
            <button onClick={() => setVerCarta((v) => !v)} aria-expanded={verCarta} className="flex w-full items-center justify-between gap-3 p-4 text-left">
              <span className="flex items-center gap-2 text-2xl" style={SERIF}>
                <UtensilsCrossed className="h-5 w-5" aria-hidden /> Ver la carta
              </span>
              <ChevronDown className={cn("h-5 w-5 transition-transform", verCarta && "rotate-180")} />
            </button>
            {verCarta && (
              <div className="flex flex-col gap-5 px-4 pb-5">
                <p className="text-xs text-[#0B2A2E]/60">Precios en pesos dominicanos. No incluyen {ITBIS * 100} % de ITBIS ni {SERVICIO * 100} % de servicio de ley.</p>
                {CATEGORIAS.map((c) => (
                  <div key={c}>
                    <h3 className="mb-2 border-b border-[#0B2A2E]/15 pb-1 text-xl" style={SERIF}>{c}</h3>
                    <ul className="flex flex-col gap-2.5">
                      {CARTA.filter((p) => p.categoria === c).map((p) => {
                        const foto = fotoDe(p)
                        return (
                          <li key={p.id} className="flex items-center gap-3">
                            {foto && <img src={foto} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug">{p.nombre}</p>
                              {p.descripcion && <p className="text-xs text-[#0B2A2E]/60">{p.descripcion}</p>}
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">{rd(p.precio)}{p.porLibra ? "/lb" : ""}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
        <footer className="px-4 pb-6 text-center text-xs text-[#0B2A2E]/50">Calle Prolongación Duarte 12-A, Boca Chica · WhatsApp 829-642-9442</footer>
      </div>
    </div>
  )
}

function Identificarse({ mesaId, sesionId, onListo }: { mesaId: string; sesionId: string; onListo: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [enviando, setEnviando] = useState(false)
  const enviar = async () => {
    setEnviando(true)
    try {
      await restauranteApi.accion({ tipo: "sesionMesa", mesaId, sesionId, nombre, telefono })
      onListo()
    } finally {
      setEnviando(false)
    }
  }
  if (!abierto)
    return (
      <button onClick={() => setAbierto(true)} className="flex items-center justify-center gap-2 rounded-xl border border-[#0B2A2E]/15 bg-white/60 px-4 py-3 text-sm">
        <UserRound className="h-4 w-4" /> ¿Te reconocemos? Deja tu nombre y teléfono (opcional)
      </button>
    )
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/80 p-4 shadow-sm">
      <p className="text-sm text-[#0B2A2E]/70">Así guardamos tu visita, tus platos favoritos y tus puntos.</p>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" className="h-12 rounded-xl border border-[#E4D8C3] bg-white px-4 text-base outline-none focus:border-[#0B2A2E]" />
      <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="809-000-0000" className="h-12 rounded-xl border border-[#E4D8C3] bg-white px-4 text-base outline-none focus:border-[#0B2A2E]" />
      <button disabled={enviando || telefono.replace(/\D/g, "").length < 7} onClick={enviar} className="h-12 rounded-xl bg-[#0B2A2E] text-sm font-medium text-[#F4ECDF] disabled:opacity-50">
        Guardar
      </button>
    </div>
  )
}

function Resena({ datos, onEnviada }: { datos: DatosSesion; onEnviada: () => void }) {
  const v = datos.visita!
  const [estrellas, setEstrellas] = useState(v.calificacion ?? 0)
  const [comentario, setComentario] = useState("")
  const [enviando, setEnviando] = useState(false)
  const lista = v.calificacion != null

  const enviar = async () => {
    if (!estrellas) return
    setEnviando(true)
    try {
      await restauranteApi.accion({ tipo: "calificar", visitaId: v.id, estrellas, comentario })
      onEnviada()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 p-6 text-center shadow-sm">
        <p className="text-4xl" style={SERIF}>Gracias por venir{datos.cliente ? `, ${datos.cliente.nombre.split(" ")[0]}` : ""}</p>
        {lista ? (
          <>
            <div className="flex gap-1" aria-label={`${v.calificacion} de 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn("h-7 w-7", n <= (v.calificacion ?? 0) ? "fill-[#E8866A] text-[#E8866A]" : "text-[#0B2A2E]/30")} />
              ))}
            </div>
            {v.comentario && <p className="text-sm italic text-[#0B2A2E]/70">“{v.comentario}”</p>}
            <p className="text-sm font-medium">Recibimos tu reseña. Te esperamos pronto frente al mar.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-[#0B2A2E]/70">Tu cuenta quedó pagada. ¿Cómo estuvo todo hoy?</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Calificación">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} role="radio" aria-checked={estrellas === n} aria-label={`${n} de 5`} onClick={() => setEstrellas(n)} className="p-1">
                  <Star className={cn("h-9 w-9", n <= estrellas ? "fill-[#E8866A] text-[#E8866A]" : "text-[#0B2A2E]/30")} />
                </button>
              ))}
            </div>
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Cuéntanos qué te gustó o qué mejorarías (opcional)" className="w-full rounded-xl border border-[#E4D8C3] bg-white p-3 text-sm outline-none focus:border-[#0B2A2E]" />
            <button disabled={!estrellas || enviando} onClick={enviar} className="h-12 w-full rounded-xl bg-[#0B2A2E] text-sm font-medium text-[#F4ECDF] disabled:opacity-50">
              Enviar reseña
            </button>
          </>
        )}
      </section>
      <section className="rounded-2xl bg-white/80 p-4 shadow-sm">
        <h2 className="mb-2 text-2xl" style={SERIF}>Tu cuenta</h2>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {v.platos.map((p, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {cantidadTexto(p.cantidad, PLATOS.get(p.platoId)?.porLibra)} {PLATOS.get(p.platoId)?.nombre ?? p.platoId}
              </span>
              <span className="tabular-nums">{rd(p.importe)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-y-1 border-t border-[#0B2A2E]/10 pt-3 text-sm">
          <dt className="text-[#0B2A2E]/60">ITBIS y servicio</dt>
          <dd className="text-right tabular-nums">{rd(v.itbis + v.servicio)}</dd>
          <dt className="text-[#0B2A2E]/60">Propina</dt>
          <dd className="text-right tabular-nums">{rd(v.propina)}</dd>
          <dt className="font-semibold">Pagado con {METODO[v.metodo].toLowerCase()}</dt>
          <dd className="text-right font-semibold tabular-nums">{rd(v.total)}</dd>
        </dl>
      </section>
    </>
  )
}
