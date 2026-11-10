"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Check, Loader2, RefreshCw, Search, Trash2, X } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { hace } from "@/components/admin/customers/perfil-secciones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/contexts/admin-context"
import { apiClient } from "@/lib/api-client"
import {
  memoriaApi, type NoEntendida, type Propuesta, type PropuestaCompatibilidad, type PropuestaFaq, type Sinonimo,
} from "@/lib/api/memoria"
import { canAccessSection } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useVertical } from "@/lib/vertical"

type PiezaBusqueda = { id: string; nombre: string }

const ESTADO: Record<Propuesta["estado"], { texto: string; clase: string }> = {
  propuesto: { texto: "Por revisar", clase: "bg-accent text-accent-foreground" },
  revisar: { texto: "Revisar: hubo devolución", clase: "bg-warning-soft text-warning" },
  aprobado: { texto: "Aprobada", clase: "bg-success-soft text-success" },
  rechazado: { texto: "Rechazada", clase: "bg-secondary text-muted-foreground" },
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p>
}

function EnsenarDialog({ texto, onClose, onHecho }: { texto: NoEntendida | null; onClose: () => void; onHecho: () => void }) {
  const [palabra, setPalabra] = useState("")
  const [significa, setSignifica] = useState("")
  const [pieza, setPieza] = useState<PiezaBusqueda | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [piezas, setPiezas] = useState<PiezaBusqueda[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const restaurante = useVertical() === "restaurante"

  useEffect(() => {
    if (!texto) return
    setPalabra(texto.texto); setSignifica(""); setPieza(null); setBusqueda(""); setPiezas(null)
  }, [texto])

  useEffect(() => {
    const q = busqueda.trim()
    if (q.length < 3 || restaurante) { setPiezas(null); return }
    let vigente = true
    const t = setTimeout(() => {
      apiClient.get<{ items: PiezaBusqueda[] }>("/piezas/buscar", { q, limit: 5 })
        .then((r) => { if (vigente) setPiezas(r.items ?? []) }).catch(() => { if (vigente) setPiezas([]) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await memoriaApi.guardarSinonimo({ palabra: palabra.trim(), significa: significa.trim() || undefined, pieza_id: pieza?.id, aprobar: true })
      toast.success("Aprobado: el bot lo entiende desde la próxima conversación")
      onHecho()
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!texto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Enseñarle al bot</DialogTitle>
            <DialogDescription>{restaurante ? "Di qué quiso decir el cliente: un plato, una zona o una ocasión. Se comparte la palabra, nunca quién la escribió." : "Di a qué pieza o palabra se refiere. Se comparte la palabra, nunca quién la escribió."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mem-palabra">Lo que escribió el cliente</Label>
            <Input id="mem-palabra" required maxLength={120} value={palabra} onChange={(e) => setPalabra(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mem-significa">Significa</Label>
            <Input id="mem-significa" maxLength={200} value={significa} placeholder={restaurante ? "Ej.: cama balinesa del gazebo" : "Ej.: banda de freno"}
              onChange={(e) => { setSignifica(e.target.value); setPieza(null) }} />
          </div>
          {!restaurante && <div className="space-y-1.5">
            <Label htmlFor="mem-pieza">O elige la pieza</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="mem-pieza" className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en el catálogo" />
            </div>
            {piezas && (piezas.length === 0 ? <p className="text-xs text-muted-foreground">Sin resultados.</p> : (
              <ul className="divide-y rounded-lg border">
                {piezas.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setPieza(p); setSignifica(p.nombre) }}
                      className={cn("w-full truncate px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        pieza?.id === p.id && "bg-secondary font-medium")}>
                      {p.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </div>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando || !palabra.trim() || !significa.trim()}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Aprobar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Palabras() {
  const [pendientes, setPendientes] = useState<NoEntendida[] | null>(null)
  const [aprobados, setAprobados] = useState<Sinonimo[] | null>(null)
  const [ensenar, setEnsenar] = useState<NoEntendida | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const cargar = useCallback(() => {
    memoriaApi.noEntendidas().then(setPendientes).catch(() => setPendientes([]))
    memoriaApi.sinonimos("aprobado").then(setAprobados).catch(() => setAprobados([]))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const correr = async (clave: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupado(clave)
    try { await fn(); toast.success(ok); cargar() } catch (e: any) { toast.error(e?.message || "No se pudo completar") } finally { setOcupado(null) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-labelledby="titulo-no-entendidas" className="min-w-0 space-y-3">
        <h2 id="titulo-no-entendidas" className="font-display text-base font-semibold">Lo que el bot no entendió</h2>
        <p className="text-sm text-muted-foreground">Consultas sin resultados de los últimos 30 días, agrupadas.</p>
        {!pendientes ? <Skeleton className="h-40 w-full" /> : pendientes.length === 0 ? <Vacio>Nada pendiente.</Vacio> : (
          <ul className="divide-y rounded-lg border bg-card">
            {pendientes.map((p) => (
              <li key={p.texto} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.ejemplo}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.veces} {p.veces === 1 ? "vez" : "veces"} · {hace(p.ultima)}{(p.vehiculos?.length ?? 0) > 0 && ` · ${p.vehiculos.join(", ")}`}
                  </p>
                </div>
                <Button size="sm" onClick={() => setEnsenar(p)}>Enseñar</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Ignorar ${p.ejemplo}`} disabled={ocupado === p.texto}
                  onClick={() => correr(p.texto, () => memoriaApi.ignorar(p.texto), "Ignorada")}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="titulo-sinonimos" className="min-w-0 space-y-3">
        <h2 id="titulo-sinonimos" className="font-display text-base font-semibold">Palabras aprobadas</h2>
        <p className="text-sm text-muted-foreground">El bot las entiende en todas las conversaciones.</p>
        {!aprobados ? <Skeleton className="h-40 w-full" /> : aprobados.length === 0 ? <Vacio>Todavía no hay palabras aprobadas.</Vacio> : (
          <ul className="divide-y rounded-lg border bg-card">
            {aprobados.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate"><span className="font-medium">{s.palabra}</span> <span className="text-muted-foreground">significa</span> {s.significa}</p>
                  <p className="text-xs text-muted-foreground">{s.aprobado_por ? `Aprobó ${s.aprobado_por}` : "Aprobada"} {hace(s.aprobado_en)}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Quitar ${s.palabra}`} disabled={ocupado === s.id}
                  onClick={() => correr(s.id, () => memoriaApi.eliminarSinonimo(s.id), "Palabra quitada")}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <EnsenarDialog texto={ensenar} onClose={() => setEnsenar(null)} onHecho={() => { setEnsenar(null); cargar() }} />
    </div>
  )
}

function Propuestas({ tipo, puedeAprobar }: { tipo: Propuesta["tipo"]; puedeAprobar: boolean }) {
  const [items, setItems] = useState<Propuesta[] | null>(null)
  const [estado, setEstado] = useState("propuesto,revisar")
  const restaurante = useVertical() === "restaurante"
  const [editando, setEditando] = useState<Propuesta | null>(null)
  const [pregunta, setPregunta] = useState("")
  const [respuesta, setRespuesta] = useState("")
  const [ocupado, setOcupado] = useState<string | null>(null)

  const cargar = useCallback(() => {
    memoriaApi.propuestas(tipo, estado).then(setItems).catch(() => setItems([]))
  }, [tipo, estado])
  useEffect(() => { setItems(null); cargar() }, [cargar])

  const correr = async (clave: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupado(clave)
    try { await fn(); toast.success(ok); cargar() } catch (e: any) { toast.error(e?.message || "No se pudo completar") } finally { setOcupado(null) }
  }

  const buscar = async () => {
    setOcupado("generar")
    try {
      const r = await memoriaApi.generar()
      const nuevas = tipo === "faq" ? r.faq : r.compatibilidades
      toast.success(nuevas ? `${nuevas} ${nuevas === 1 ? "propuesta nueva" : "propuestas nuevas"}` : "No hay propuestas nuevas")
      cargar()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo revisar")
    } finally {
      setOcupado(null)
    }
  }

  const abrir = (p: Propuesta) => {
    const d = p.datos as PropuestaFaq
    setEditando(p); setPregunta(d.pregunta); setRespuesta(d.respuesta)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {tipo === "faq"
            ? restaurante
              ? "Respuestas del equipo que se repiten en varias conversaciones. Al aprobarlas quedan en Conocimiento y el asistente las usa."
              : "Respuestas de vendedores que se repiten en varias conversaciones. Al aprobarlas quedan en Conocimiento y el bot las usa."
            : "Ventas de una pieza a un vehículo que su ficha no cubre. Una venta es una pista, no una prueba; una devolución la manda a revisar."}
        </p>
        <div className="flex gap-2">
          <div role="radiogroup" aria-label="Estado" className="flex gap-1 rounded-control bg-secondary p-1">
            {[["propuesto,revisar", "Por revisar"], ["aprobado", "Aprobadas"], ["rechazado", "Rechazadas"]].map(([v, t]) => (
              <button key={v} type="button" role="radio" aria-checked={estado === v} onClick={() => setEstado(v)}
                className={cn("h-8 rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  estado === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={buscar} disabled={ocupado === "generar"}>
            {ocupado === "generar" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />} Buscar nuevas
          </Button>
        </div>
      </div>
      {!items ? <Skeleton className="h-40 w-full" /> : items.length === 0 ? <Vacio>No hay propuestas aquí.</Vacio> : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((p) => {
            const faq = p.datos as PropuestaFaq
            const compat = p.datos as PropuestaCompatibilidad
            const abierta = p.estado === "propuesto" || p.estado === "revisar"
            return (
              <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ESTADO[p.estado].clase)}>{ESTADO[p.estado].texto}</span>
                    <span className="text-xs text-muted-foreground">
                      {tipo === "faq" ? `${p.veces} conversaciones` : `${compat.ventas} ${compat.ventas === 1 ? "venta" : "ventas"}${compat.devoluciones ? ` · ${compat.devoluciones} con devolución` : ""}`}
                    </span>
                  </div>
                  {tipo === "faq" ? (
                    <>
                      <p className="mt-1.5 font-medium">{faq.pregunta}</p>
                      <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{faq.respuesta}</p>
                    </>
                  ) : (
                    <p className="mt-1.5">
                      <Link href={`/admin/piezas/${compat.pieza_id}`} className="font-medium hover:underline">{compat.pieza}</Link>
                      <span className="text-muted-foreground"> para </span>
                      {compat.marca} {compat.modelo} {compat.anio ?? ""}{compat.motor ? ` · ${compat.motor}` : ""}
                    </p>
                  )}
                  {p.nota && <p className="mt-1 text-xs text-muted-foreground">{p.nota}</p>}
                  {p.revisado_por && <p className="mt-1 text-xs text-muted-foreground">Revisó {p.revisado_por} {hace(p.revisado_en)}</p>}
                </div>
                {abierta && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" className="gap-1.5" disabled={!puedeAprobar || ocupado === p.id}
                      title={puedeAprobar ? undefined : "La aprueba el experto de piezas"}
                      onClick={() => (tipo === "faq" ? abrir(p) : correr(p.id, () => memoriaApi.aprobar(p.id), "Compatibilidad agregada a la pieza"))}>
                      <Check className="h-4 w-4" aria-hidden /> Aprobar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={ocupado === p.id}
                      onClick={() => correr(p.id, () => memoriaApi.rechazar(p.id), "Rechazada")}>Rechazar</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprobar respuesta</DialogTitle>
            <DialogDescription>Revísala antes: no debe llevar nombres, teléfonos ni precios, que cambian.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="faq-pregunta">Pregunta</Label>
              <Input id="faq-pregunta" maxLength={300} value={pregunta} onChange={(e) => setPregunta(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-respuesta">Respuesta</Label>
              <Textarea id="faq-respuesta" rows={4} maxLength={1000} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={!pregunta.trim() || !respuesta.trim() || !!ocupado} onClick={() => editando && correr(editando.id, async () => {
              await memoriaApi.aprobar(editando.id, { pregunta: pregunta.trim(), respuesta: respuesta.trim() })
              setEditando(null)
            }, "Agregada a Conocimiento")}>
              {ocupado && <Loader2 className="animate-spin" aria-hidden />} Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default function MemoriaPage() {
  const { user } = useAdmin()
  const expertoPiezas = canAccessSection(user?.role, "/admin/vehiculos-catalogo")
  const restaurante = useVertical() === "restaurante"
  return (
    <AdminLayout title="Memoria colectiva">
      <div className="space-y-5">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Lo que el sistema aprende de todas las conversaciones, siempre con la aprobación de una persona. Se comparte lo
          aprendido, nunca los datos de un cliente.
        </p>
        <Tabs defaultValue="palabras">
          <TabsList>
            <TabsTrigger value="palabras">Palabras</TabsTrigger>
            <TabsTrigger value="respuestas">Respuestas</TabsTrigger>
            {!restaurante && <TabsTrigger value="compatibilidades">Compatibilidades</TabsTrigger>}
          </TabsList>
          <TabsContent value="palabras" className="mt-4"><Palabras /></TabsContent>
          <TabsContent value="respuestas" className="mt-4"><Propuestas tipo="faq" puedeAprobar /></TabsContent>
          {!restaurante && <TabsContent value="compatibilidades" className="mt-4"><Propuestas tipo="compatibilidad" puedeAprobar={expertoPiezas} /></TabsContent>}
        </Tabs>
      </div>
    </AdminLayout>
  )
}
