"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { AlertTriangle, CalendarCheck, Clock, DoorOpen, Minus, Plus, QrCode, ScanLine, Sparkles, UserPlus, Users, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EscanerQR } from "@/components/restaurante/EscanerQR"
import { EstadoReservaChip } from "@/components/restaurante/reservas/comun"
import { restauranteApi, useRestaurante } from "@/lib/restaurante/cliente"
import { fechaLocal, hora12, NOMBRE_ZONA, tsLocal, ZONAS } from "@/lib/restaurante/local"
import type { Entrada, Estado, Mesa, Reserva, Zona } from "@/lib/restaurante/tipos"
import { cn } from "@/lib/utils"

const MIN = 60_000
const POR_LLEGAR = ["confirmada", "recordada", "asistencia_confirmada", "solicitada"]

type Recibir = { reserva?: Reserva; entrada?: Entrada }

function minutos(ms: number) {
  const m = Math.round(Math.abs(ms) / MIN)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

/** Un timbre corto cuando alguien avisa desde la entrada. */
function timbre() {
  try {
    const ctx = new AudioContext()
    ;[880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.18)
      o.stop(ctx.currentTime + i * 0.18 + 0.4)
    })
  } catch {}
}

function meseroSugerido(estado: Estado, zona: Zona) {
  const carga = (id: string) => estado.mesas.filter((m) => m.meseroId === id && m.estado !== "libre").length
  const meseros = estado.equipo.filter((x) => x.rol === "mesero")
  return meseros.filter((x) => x.zonas.includes(zona)).sort((a, b) => carga(a.id) - carga(b.id))[0] ?? meseros[0]
}

export default function LlegadasPage() {
  const { estado, ahora } = useRestaurante()
  const [recibir, setRecibir] = useState<Recibir | null>(null)
  const [escanear, setEscanear] = useState(false)
  const hoy = fechaLocal(ahora)

  const grupos = useMemo(() => {
    if (!estado) return null
    const delDia = estado.reservas.filter((r) => r.fecha === hoy)
    const puerta = delDia.filter((r) => r.llegoEn && POR_LLEGAR.includes(r.estado)).sort((a, b) => (a.llegoEn ?? 0) - (b.llegoEn ?? 0))
    const proximas = delDia
      .filter((r) => !r.llegoEn && POR_LLEGAR.includes(r.estado))
      .sort((a, b) => tsLocal(a.fecha, a.hora) - tsLocal(b.fecha, b.hora))
    const sentados = delDia
      .filter((r) => r.estado === "sentada")
      .sort((a, b) => tsLocal(b.fecha, b.hora) - tsLocal(a.fecha, a.hora))
    const noVinieron = delDia.filter((r) => r.estado === "no_show").length
    return { puerta, proximas, sentados, noVinieron, sinReserva: estado.entrada ?? [] }
  }, [estado, hoy])

  // Aviso cuando alguien llega por el QR de la entrada.
  const vistos = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!grupos) return
    const ahoraVistos = new Set([...grupos.puerta.map((r) => r.id), ...grupos.sinReserva.map((e) => e.id)])
    if (vistos.current) {
      const nuevos = [...grupos.puerta.filter((r) => !vistos.current!.has(r.id)).map((r) => r.nombre), ...grupos.sinReserva.filter((e) => !vistos.current!.has(e.id)).map((e) => `${e.nombre} (sin reserva)`)]
      if (nuevos.length) {
        timbre()
        toast(`Llegó ${nuevos.join(", ")}`, { icon: <DoorOpen className="h-5 w-5 text-[#E8866A]" />, duration: 6000 })
      }
    }
    vistos.current = ahoraVistos
  }, [grupos])

  const leido = async (texto: string) => {
    setEscanear(false)
    const codigo = texto.match(/BM-\d+/i)?.[0]?.toUpperCase()
    const r = codigo && estado?.reservas.find((x) => x.codigo === codigo)
    if (!r) return toast.error(codigo ? `No encontré la reserva ${codigo} para hoy` : "Ese QR no es de una reserva de Boca Marina")
    if (r.fecha !== hoy) return toast.error(`La reserva ${r.codigo} es para otro día`)
    if (r.estado === "sentada") return toast(`${r.nombre} ya está sentado`)
    try {
      if (!r.llegoEn) await restauranteApi.accion({ tipo: "reservaLlego", reservaId: r.id })
      setRecibir({ reserva: { ...r, llegoEn: r.llegoEn ?? Date.now() } })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const marcar = async (r: Reserva, cual: "llego" | "no_vino") => {
    try {
      if (cual === "llego") {
        await restauranteApi.accion({ tipo: "reservaLlego", reservaId: r.id })
        setRecibir({ reserva: { ...r, llegoEn: Date.now() } })
      } else {
        await restauranteApi.accion({ tipo: "reservaEstado", reservaId: r.id, estado: "no_show", nota: "La anfitriona la marcó: no vino" })
        toast.success(`${r.nombre}: no vino. La mesa queda libre`)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <AdminLayout title="Llegadas">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="etiqueta">La puerta del restaurante</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Llegadas</h1>
            <p className="text-sm text-muted-foreground">Recibe a cada cliente, confirma con cuántos llegó y en qué mesa se sienta. El mesero lo ve al momento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" className="gap-2">
              <a href="/llegue/cartel" target="_blank" rel="noreferrer">
                <QrCode className="h-4 w-4" /> QR de la entrada
              </a>
            </Button>
            <Button variant="outline" onClick={() => setEscanear(true)} className="gap-2">
              <ScanLine className="h-4 w-4" /> Escanear
            </Button>
            <Button onClick={() => setRecibir({})} className="gap-2">
              <UserPlus className="h-4 w-4" /> Llegó sin reserva
            </Button>
          </div>
        </header>

        {!estado || !grupos ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Contador titulo="En la entrada" valor={grupos.puerta.length + grupos.sinReserva.length} icono={DoorOpen} resaltar={grupos.puerta.length + grupos.sinReserva.length > 0} />
              <Contador titulo="Por llegar hoy" valor={grupos.proximas.length} icono={Clock} />
              <Contador titulo="Sentados" valor={grupos.sentados.length} icono={Users} />
              <Contador titulo="No vinieron" valor={grupos.noVinieron} icono={AlertTriangle} />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <Columna titulo="En la entrada" vacio="Nadie esperando. Cuando llegue alguien con reserva, márcalo aquí.">
                {[
                  ...grupos.puerta.map((r) => (
                    <Tarjeta key={r.id} r={r} estado={estado} ahora={ahora} enPuerta>
                      <Button className="h-11 flex-1" onClick={() => setRecibir({ reserva: r })}>
                        Sentar
                      </Button>
                    </Tarjeta>
                  )),
                  ...grupos.sinReserva.map((e) => (
                    <article key={e.id} className="flex flex-col gap-3 rounded-xl border border-[#E8866A] bg-card p-4 shadow-[0_0_0_1px_#E8866A]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold">{e.nombre}</div>
                          <div className="text-sm text-muted-foreground">Sin reserva · esperando hace {minutos(ahora - e.ts)}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                          <Users className="h-4 w-4" /> {e.personas}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button className="h-11 flex-1" onClick={() => setRecibir({ entrada: e })}>
                          Sentar
                        </Button>
                        <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Se fue" onClick={() => restauranteApi.accion({ tipo: "quitarEntrada", entradaId: e.id }).catch((x) => toast.error(x.message))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  )),
                ]}
              </Columna>
              <Columna titulo="Por llegar" vacio="No quedan reservas por llegar hoy.">
                {grupos.proximas.map((r) => (
                  <Tarjeta key={r.id} r={r} estado={estado} ahora={ahora}>
                    <Button className="h-11 flex-1" onClick={() => marcar(r, "llego")}>
                      Llegó
                    </Button>
                    {tsLocal(r.fecha, r.hora) - ahora < -10 * MIN && (
                      <Button variant="outline" className="h-11" onClick={() => marcar(r, "no_vino")}>
                        No vino
                      </Button>
                    )}
                  </Tarjeta>
                ))}
              </Columna>
              <Columna titulo="Ya sentados" vacio="Todavía no se ha sentado nadie con reserva.">
                {grupos.sentados.slice(0, 12).map((r) => {
                  const m = estado.mesas.find((x) => x.id === r.mesaId)
                  const mesero = estado.equipo.find((x) => x.id === m?.meseroId)
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.personas} personas · {hora12(r.hora)}
                        </div>
                      </div>
                      {m && (
                        <Link href={`/admin/salon/mesas/${m.id}`} className="shrink-0 text-right">
                          <div className="font-semibold">{m.nombre}</div>
                          {mesero && (
                            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                              <span className="h-2 w-2 rounded-full" style={{ background: mesero.color }} /> {mesero.nombre}
                            </div>
                          )}
                        </Link>
                      )}
                    </div>
                  )
                })}
              </Columna>
            </div>
          </>
        )}
      </div>
      {estado && recibir && <DialogoRecibir estado={estado} reserva={recibir.reserva} entrada={recibir.entrada} onCerrar={() => setRecibir(null)} />}
      <EscanerQR abierto={escanear} onCerrar={() => setEscanear(false)} onLeido={leido} />
    </AdminLayout>
  )
}

function Contador({ titulo, valor, icono: Icono, resaltar }: { titulo: string; valor: number; icono: typeof Clock; resaltar?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", resaltar && "border-[#E8866A] bg-[#E8866A]/10")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icono className="h-4 w-4" /> {titulo}
      </div>
      <div className="mt-1 font-display text-3xl">{valor}</div>
    </div>
  )
}

function Columna({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo} <span className="font-normal">({children.length})</span>
      </h2>
      {children.length ? children : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{vacio}</p>}
    </section>
  )
}

function Tarjeta({ r, estado, ahora, enPuerta, children }: { r: Reserva; estado: Estado; ahora: number; enPuerta?: boolean; children: React.ReactNode }) {
  const c = estado.clientes.find((x) => x.id === r.clienteId)
  const m = estado.mesas.find((x) => x.id === r.mesaId)
  const falta = tsLocal(r.fecha, r.hora) - ahora
  const tarde = falta < -15 * MIN ? "rojo" : falta < -10 * MIN ? "naranja" : null
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        enPuerta && "border-[#E8866A] shadow-[0_0_0_1px_#E8866A]",
        tarde === "naranja" && "border-amber-400",
        tarde === "rojo" && "border-red-400",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{r.nombre}</div>
          <div className="text-sm text-muted-foreground">
            {hora12(r.hora)} ·{" "}
            {enPuerta
              ? `esperando hace ${minutos(ahora - (r.llegoEn ?? ahora))}`
              : falta >= 0
                ? `en ${minutos(falta)}`
                : <span className={cn(tarde === "rojo" ? "text-red-600" : tarde ? "text-amber-600" : "")}>{minutos(falta)} tarde</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
          <Users className="h-4 w-4" /> {r.personas}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-muted px-2 py-1">{NOMBRE_ZONA[r.zona]}{m ? ` · ${m.nombre}` : ""}</span>
        <EstadoReservaChip estado={r.estado} />
        {c && c.visitas > 1 && (
          <span className="flex items-center gap-1 rounded-full bg-[#7FCFCB]/25 px-2 py-1">
            <Sparkles className="h-3 w-3" /> {c.visitas} visitas
          </span>
        )}
        {r.ocasion && <span className="rounded-full bg-[#E8866A]/15 px-2 py-1">{r.ocasion}</span>}
        {c?.alergias?.map((a) => (
          <span key={a} className="rounded-full bg-red-100 px-2 py-1 text-red-800">
            Alergia: {a}
          </span>
        ))}
      </div>
      {r.notas && <p className="text-sm text-muted-foreground">{r.notas}</p>}
      <div className="flex gap-2">{children}</div>
    </article>
  )
}

function DialogoRecibir({ estado, reserva, entrada, onCerrar }: { estado: Estado; reserva?: Reserva; entrada?: Entrada; onCerrar: () => void }) {
  const [personas, setPersonas] = useState(reserva?.personas ?? entrada?.personas ?? 2)
  const [nombre, setNombre] = useState(entrada?.nombre ?? "")
  const [telefono, setTelefono] = useState(entrada?.telefono ?? "")
  const [zona, setZona] = useState<Zona | "todas">("todas")
  const reservada = reserva?.mesaId ? estado.mesas.find((x) => x.id === reserva.mesaId) : undefined
  const disponibles = estado.mesas
    .filter((m) => m.estado === "libre" || (m.estado === "reservada" && m.reservaId === reserva?.id))
    .filter((m) => m.capacidad >= personas)
    .filter((m) => zona === "todas" || m.zona === zona)
    .sort((a, b) => Number(b.id === reservada?.id) - Number(a.id === reservada?.id) || Number(b.zona === reserva?.zona) - Number(a.zona === reserva?.zona) || a.capacidad - b.capacidad)
  const sugerida = reservada && reservada.capacidad >= personas && ["libre", "reservada"].includes(reservada.estado) ? reservada : disponibles[0]
  const [mesaId, setMesaId] = useState<string | undefined>(sugerida?.id)
  const mesa: Mesa | undefined = estado.mesas.find((x) => x.id === mesaId) ?? sugerida
  const [meseroId, setMeseroId] = useState<string>()
  const sugeridoId = useMemo(() => (mesa ? meseroSugerido(estado, mesa.zona)?.id : undefined), [mesa?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const mesero = estado.equipo.find((x) => x.id === (meseroId ?? sugeridoId))
  const [enviando, setEnviando] = useState(false)

  const sentar = async () => {
    if (!mesa) return
    setEnviando(true)
    try {
      const res = await restauranteApi.accion<{ mesa: { nombre: string }; mesero: { nombre: string } | null }>({
        tipo: "recibir",
        reservaId: reserva?.id,
        entradaId: entrada?.id,
        nombre: reserva ? undefined : nombre,
        telefono: reserva ? undefined : telefono,
        personas,
        mesaId: mesa.id,
        meseroId: mesero?.id,
      })
      toast.success(`${res.mesa.nombre} abierta${res.mesero ? `: la atiende ${res.mesero.nombre}` : ""}`)
      onCerrar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{reserva ? `Recibir a ${reserva.nombre}` : entrada ? `Recibir a ${entrada.nombre}` : "Llegó sin reserva"}</DialogTitle>
          <DialogDescription>
            {reserva ? `Reservó para ${reserva.personas} a las ${hora12(reserva.hora)} en ${NOMBRE_ZONA[reserva.zona]}${reservada ? `, mesa ${reservada.nombre}` : ""}.` : "Anota el nombre, cuántos son y dónde se sientan."}
          </DialogDescription>
        </DialogHeader>

        {!reserva && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ll-nombre">Nombre</Label>
              <Input id="ll-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ll-tel">Teléfono</Label>
              <Input id="ll-tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Para su ficha (opcional)" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
          <div>
            <div className="font-medium">¿Cuántos llegaron?</div>
            {reserva && personas !== reserva.personas && <div className="text-xs text-amber-700">Reservaron para {reserva.personas}</div>}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Uno menos" onClick={() => setPersonas((p) => Math.max(1, p - 1))}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center font-display text-3xl" aria-live="polite">
              {personas}
            </span>
            <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Uno más" onClick={() => setPersonas((p) => Math.min(30, p + 1))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">¿En qué mesa?</div>
            <div className="flex flex-wrap gap-1">
              {(["todas", ...ZONAS.map((z) => z.id)] as const).map((z) => (
                <button key={z} onClick={() => setZona(z)} className={cn("rounded-full border px-3 py-1 text-xs", zona === z && "border-foreground bg-foreground text-background")}>
                  {z === "todas" ? "Todas" : NOMBRE_ZONA[z]}
                </button>
              ))}
            </div>
          </div>
          {reservada && (reservada.capacidad < personas || !(reservada.estado === "libre" || (reservada.estado === "reservada" && reservada.reservaId === reserva?.id))) && (
            <p className="text-xs text-amber-700">
              {reservada.capacidad < personas ? `Su mesa ${reservada.nombre} es para ${reservada.capacidad}: elige una más grande.` : `Su mesa ${reservada.nombre} está ocupada ahora: elige otra.`}
            </p>
          )}
          {disponibles.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {disponibles.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMesaId(m.id)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border p-2.5 text-left transition-colors",
                    mesa?.id === m.id ? "border-[#0B2A2E] bg-[#0B2A2E] text-[#F4ECDF]" : "hover:bg-muted",
                  )}
                >
                  <span className="font-semibold">{m.nombre}</span>
                  <span className="text-[11px] opacity-75">
                    {NOMBRE_ZONA[m.zona]} · {m.capacidad}
                  </span>
                  {m.id === reservada?.id && <span className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-90">Su reserva</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No hay mesas libres para {personas} {zona === "todas" ? "" : `en ${NOMBRE_ZONA[zona]}`}. Prueba otra zona.</p>
          )}
        </div>

        {mesa && (
          <div className="flex flex-col gap-2">
            <div className="font-medium">¿Quién la atiende?</div>
            <div className="flex flex-wrap gap-2">
              {estado.equipo
                .filter((x) => x.rol === "mesero")
                .map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setMeseroId(q.id)}
                    className={cn("flex items-center gap-2 rounded-full border px-3 py-2 text-sm", mesero?.id === q.id && "border-[#0B2A2E] bg-[#0B2A2E] text-[#F4ECDF]")}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: q.color }} />
                    {q.nombre}
                    {q.zonas.includes(mesa.zona) && <span className="text-[10px] opacity-70">{NOMBRE_ZONA[mesa.zona]}</span>}
                  </button>
                ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>
            Después
          </Button>
          <Button disabled={!mesa || enviando} onClick={sentar} className="gap-2">
            <CalendarCheck className="h-4 w-4" /> Sentar en {mesa?.nombre ?? "…"}
            {mesero ? ` con ${mesero.nombre}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
