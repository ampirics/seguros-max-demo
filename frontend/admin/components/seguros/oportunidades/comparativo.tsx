"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { Award, Check, CircleSlash, Loader2, MessageCircle, Minus, Pencil, Plus, RotateCcw, ShieldCheck, Trash2, Wand2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ASEGURADORA, ASEGURADORAS, fechaCorta, hora12, numero, rd, RAMO } from "@/lib/seguros/catalogo"
import { segurosApi } from "@/lib/seguros/cliente"
import type { CotizacionAseguradora, Oportunidad, Poliza } from "@/lib/seguros/tipos"
import { Aseguradora, NotaEjemplo, Tarjeta } from "@/components/seguros/comun"
import { cn } from "@/lib/utils"
import { abierta, COBERTURAS_RAMO, DEDUCIBLES, MOTIVOS_PERDIDA, PRIMA_REFERENCIA } from "./util"

interface Fila {
  clave: number
  aseguradoraId: string
  prima: string
  deducible: string
  coberturas: string[]
  notas: string
}

const soloDigitos = (s: string) => s.replace(/\D/g, "")
const conMiles = (s: string) => (s ? numero(Number(s)) : "")

export function Comparativo({ o, quien, alCambiar }: { o: Oportunidad; quien?: string; alCambiar?: () => void }) {
  const opciones = useMemo(() => ASEGURADORAS.filter((a) => a.ramos.includes(o.ramo)), [o.ramo])
  const sugeridas = COBERTURAS_RAMO[o.ramo]
  const deducibles = o.ramo === "vehiculo" ? DEDUCIBLES.vehiculo : RAMO[o.ramo].segmento === "empresa" ? DEDUCIBLES.empresa : DEDUCIBLES.persona
  const cerrada = !abierta(o.etapa)

  const [editando, setEditando] = useState(false)
  const [filas, setFilas] = useState<Fila[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emitir, setEmitir] = useState<CotizacionAseguradora | null>(null)
  const [perder, setPerder] = useState(false)
  const [motivo, setMotivo] = useState(MOTIVOS_PERDIDA[0])
  const [detalle, setDetalle] = useState("")

  const mostrarFormulario = !cerrada && (editando || !o.cotizaciones.length)

  function filasIniciales(): Fila[] {
    if (o.cotizaciones.length) return o.cotizaciones.map((c, i) => ({ clave: i, aseguradoraId: c.aseguradoraId, prima: String(c.prima), deducible: c.deducible, coberturas: c.coberturas, notas: c.notas ?? "" }))
    return opciones.slice(0, Math.min(3, opciones.length)).map((a, i) => ({ clave: i, aseguradoraId: a.id, prima: "", deducible: deducibles[0], coberturas: sugeridas.slice(0, 3), notas: "" }))
  }

  const lista = mostrarFormulario && !filas.length ? filasIniciales() : filas
  const cambiar = (clave: number, cambio: Partial<Fila>) => setFilas(lista.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)))
  const libres = (actual: string) => opciones.filter((a) => a.id === actual || !lista.some((f) => f.aseguradoraId === a.id))

  function agregar() {
    const a = opciones.find((x) => !lista.some((f) => f.aseguradoraId === x.id))
    if (!a) return
    setFilas([...lista, { clave: Math.max(0, ...lista.map((f) => f.clave)) + 1, aseguradoraId: a.id, prima: "", deducible: deducibles[0], coberturas: sugeridas.slice(0, 3), notas: "" }])
  }

  function rellenar() {
    const valor = Number(o.ficha.valor_aproximado) || 0
    const base = o.ramo === "vehiculo" && valor ? valor * 0.031 : o.ramo === "hogar" && valor ? valor * 0.0042 : PRIMA_REFERENCIA[o.ramo]
    const factores = [0.94, 1.08, 1.0, 1.15]
    setFilas(
      lista.map((f, i) => ({
        ...f,
        prima: f.prima || String(Math.round((base * factores[i % 4]) / 100) * 100),
        deducible: f.deducible || deducibles[i % deducibles.length],
        coberturas: f.coberturas.length ? sugeridas.filter((c, k) => f.coberturas.includes(c) || (k + i) % 3 !== 2) : sugeridas.slice(0, 3),
      })),
    )
  }

  async function correr<T>(clave: string, fn: () => Promise<T>, exito: (r: T) => string) {
    setOcupado(clave)
    setError(null)
    try {
      const r = await fn()
      toast.success(exito(r))
      alCambiar?.()
      return true
    } catch (e) {
      const m = (e as Error).message
      setError(m)
      toast.error(m)
      return false
    } finally {
      setOcupado(null)
    }
  }

  async function guardar() {
    const listas = lista.filter((f) => f.aseguradoraId)
    if (listas.length < 2) return setError("Carga al menos dos aseguradoras para comparar.")
    if (listas.length > 4) return setError("Compara hasta cuatro aseguradoras.")
    const sinPrima = listas.find((f) => !Number(f.prima))
    if (sinPrima) return setError(`Falta la prima de ${ASEGURADORA[sinPrima.aseguradoraId]?.corto}.`)
    const sinDeducible = listas.find((f) => !f.deducible.trim())
    if (sinDeducible) return setError(`Falta el deducible de ${ASEGURADORA[sinDeducible.aseguradoraId]?.corto}.`)
    const cotizaciones: CotizacionAseguradora[] = listas.map((f) => ({ aseguradoraId: f.aseguradoraId, prima: Number(f.prima), deducible: f.deducible.trim(), coberturas: f.coberturas, notas: f.notas.trim() || undefined }))
    const ok = await correr("guardar", () => segurosApi.accion({ tipo: "cotizaciones", oportunidadId: o.id, cotizaciones, quien }), () => `Comparativo listo con ${cotizaciones.length} aseguradoras`)
    if (ok) {
      setEditando(false)
      setFilas([])
    }
  }

  const enviar = () => correr("enviar", () => segurosApi.accion({ tipo: "enviarPropuesta", oportunidadId: o.id, quien }), () => "Comparativo enviado al cliente por WhatsApp")

  async function confirmarEmision() {
    if (!emitir) return
    const ok = await correr(
      "emitir",
      () => segurosApi.accion<{ poliza: Poliza }>({ tipo: "ganar", oportunidadId: o.id, aseguradoraId: emitir.aseguradoraId, prima: emitir.prima, quien }),
      (r) => `Póliza ${r.poliza.numero} emitida con ${ASEGURADORA[emitir.aseguradoraId]?.corto}`,
    )
    if (ok) setEmitir(null)
  }

  async function confirmarPerdida() {
    const texto = detalle.trim() ? `${motivo}. ${detalle.trim()}` : motivo
    const ok = await correr("perder", () => segurosApi.accion({ tipo: "etapa", oportunidadId: o.id, etapa: "perdida", motivo: texto, quien }), () => "Oportunidad marcada como perdida")
    if (ok) {
      setPerder(false)
      setDetalle("")
    }
  }

  const reabrir = () => correr("reabrir", () => segurosApi.accion({ tipo: "etapa", oportunidadId: o.id, etapa: o.cotizaciones.length ? "en_decision" : "calificada", motivo: "reabierta", quien }), () => "Oportunidad reabierta")

  const ordenadas = o.cotizaciones.slice().sort((a, b) => a.prima - b.prima)
  const economica = ordenadas[0]?.aseguradoraId
  const todas = sugeridas.filter((c) => ordenadas.some((x) => x.coberturas.includes(c))).concat(Array.from(new Set(ordenadas.flatMap((x) => x.coberturas))).filter((c) => !sugeridas.includes(c)))

  return (
    <Tarjeta
      titulo={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          Comparativo de aseguradoras
        </span>
      }
      accion={
        !mostrarFormulario &&
        !cerrada &&
        o.cotizaciones.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Editar primas
          </Button>
        )
      }
      className="border-primary/20 shadow-sm"
    >
      {o.etapa === "ganada" && o.elegida && (
        <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success-soft p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-3">
            <Aseguradora id={o.elegida} />
            <span className="text-sm">
              <span className="font-semibold text-success">Póliza emitida</span> con {ASEGURADORA[o.elegida]?.nombre} por <span className="font-semibold tabular-nums">{rd(o.primaGanada ?? 0)}</span> al año.
            </span>
          </span>
          {o.polizaId && (
            <Button asChild size="sm" variant="outline" className="bg-card">
              <Link href={`/admin/cartera/${o.polizaId}`}>Ver póliza</Link>
            </Button>
          )}
        </div>
      )}
      {o.etapa === "perdida" && (
        <div className="flex flex-col gap-2 rounded-lg border bg-secondary p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2 text-sm">
            <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-semibold">Perdida.</span> {o.motivoPerdida}
            </span>
          </span>
          <Button size="sm" variant="outline" className="bg-card" onClick={reabrir} disabled={!!ocupado}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Reabrir
          </Button>
        </div>
      )}

      {mostrarFormulario ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Carga la prima de 2 a 4 aseguradoras que trabajan {RAMO[o.ramo].nombre.toLowerCase()}. El sistema marca la que más conviene por precio y coberturas.
            </p>
            <Button variant="outline" size="sm" onClick={rellenar} className="shrink-0">
              <Wand2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Rellenar con primas de ejemplo
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {lista.map((f, i) => (
              <div key={f.clave} className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3">
                <div className="flex items-center gap-2">
                  <Aseguradora id={f.aseguradoraId} />
                  <Select value={f.aseguradoraId} onValueChange={(v) => cambiar(f.clave, { aseguradoraId: v })}>
                    <SelectTrigger className="h-9 min-w-0 flex-1 text-sm" aria-label={`Aseguradora ${i + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {libres(f.aseguradoraId).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lista.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={() => setFilas(lista.filter((x) => x.clave !== f.clave))} aria-label={`Quitar ${ASEGURADORA[f.aseguradoraId]?.corto}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Prima anual</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">RD$</span>
                      <Input inputMode="numeric" value={conMiles(f.prima)} onChange={(e) => cambiar(f.clave, { prima: soloDigitos(e.target.value) })} placeholder="0" className="h-10 pl-11 text-right font-semibold tabular-nums" />
                    </div>
                    {Number(f.prima) > 0 && <span className="text-[11px] text-muted-foreground">Unos {rd(Number(f.prima) / 12)} al mes</span>}
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Deducible</span>
                    <Input list={`deducibles-${o.id}`} value={f.deducible} onChange={(e) => cambiar(f.clave, { deducible: e.target.value })} className="h-10 text-sm" />
                  </label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Coberturas incluidas</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sugeridas.map((c) => {
                      const si = f.coberturas.includes(c)
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={si}
                          onClick={() => cambiar(f.clave, { coberturas: si ? f.coberturas.filter((x) => x !== c) : [...f.coberturas, c] })}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            si ? "border-primary bg-accent text-primary" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {si ? <Check className="h-3 w-3" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />}
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <Input value={f.notas} onChange={(e) => cambiar(f.clave, { notas: e.target.value })} placeholder="Nota para el cliente (opcional)" className="h-9 text-sm" />
              </div>
            ))}
            {lista.length < 4 && lista.length < opciones.length && (
              <button type="button" onClick={agregar} className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                <Plus className="h-5 w-5" aria-hidden />
                Agregar aseguradora
              </button>
            )}
          </div>
          <datalist id={`deducibles-${o.id}`}>
            {deducibles.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          {error && <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <NotaEjemplo />
            <div className="flex flex-col gap-2 sm:flex-row">
              {o.cotizaciones.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditando(false)
                    setFilas([])
                    setError(null)
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button onClick={guardar} disabled={!!ocupado}>
                {ocupado === "guardar" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Guardar y comparar
              </Button>
            </div>
          </div>
        </div>
      ) : o.cotizaciones.length ? (
        <div className="flex flex-col gap-4">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[36rem] table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col className="w-36 lg:w-44" />
                {ordenadas.map((c) => (
                  <col key={c.aseguradoraId} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th />
                  {ordenadas.map((c) => {
                    const destacada = o.etapa === "ganada" ? o.elegida === c.aseguradoraId : c.recomendada
                    return (
                      <th key={c.aseguradoraId} className={cn("rounded-t-xl border-x border-t px-3 pb-3 pt-3 align-top font-normal", destacada ? "border-primary bg-accent/60" : "border-transparent")}>
                        <div className="flex h-5 justify-center">
                          {destacada ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                              <Award className="h-3 w-3" aria-hidden />
                              {o.etapa === "ganada" ? "Elegida" : "Recomendada"}
                            </span>
                          ) : c.aseguradoraId === economica ? (
                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">Más económica</span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-col items-center gap-1.5">
                          <Aseguradora id={c.aseguradoraId} tamano="lg" />
                          <span className="text-xs font-semibold">{ASEGURADORA[c.aseguradoraId]?.corto}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                <FilaComparativo etiqueta="Prima anual" ordenadas={ordenadas} o={o} render={(c) => <span className="font-display text-xl font-bold tabular-nums">{rd(c.prima)}</span>} />
                <FilaComparativo etiqueta="Al mes, aprox." ordenadas={ordenadas} o={o} render={(c) => <span className="tabular-nums text-muted-foreground">{rd(c.prima / 12)}</span>} />
                <FilaComparativo etiqueta="Deducible" ordenadas={ordenadas} o={o} render={(c) => <span className="text-xs leading-snug">{c.deducible}</span>} />
                {todas.map((cob) => (
                  <FilaComparativo
                    key={cob}
                    etiqueta={cob}
                    ordenadas={ordenadas}
                    o={o}
                    suave
                    render={(c) =>
                      c.coberturas.includes(cob) ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success-soft text-success" aria-label="Incluida">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="No incluida" />
                      )
                    }
                  />
                ))}
                {ordenadas.some((c) => c.notas) && <FilaComparativo etiqueta="Notas" ordenadas={ordenadas} o={o} render={(c) => <span className="text-xs text-muted-foreground">{c.notas ?? ""}</span>} />}
                <tr>
                  <td />
                  {ordenadas.map((c) => {
                    const destacada = o.etapa === "ganada" ? o.elegida === c.aseguradoraId : c.recomendada
                    return (
                      <td key={c.aseguradoraId} className={cn("rounded-b-xl border-x border-b px-3 pb-3 pt-3", destacada ? "border-primary bg-accent/60" : "border-transparent")}>
                        {!cerrada && (
                          <Button size="sm" variant={c.recomendada ? "default" : "outline"} className="w-full" onClick={() => setEmitir(c)} disabled={!!ocupado}>
                            Emitir póliza con esta
                          </Button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {ordenadas.map((c) => {
              const destacada = o.etapa === "ganada" ? o.elegida === c.aseguradoraId : c.recomendada
              return (
                <div key={c.aseguradoraId} className={cn("flex flex-col gap-3 rounded-xl border p-3", destacada && "border-primary bg-accent/50")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Aseguradora id={c.aseguradoraId} />
                      <span className="truncate text-sm font-semibold">{ASEGURADORA[c.aseguradoraId]?.corto}</span>
                    </span>
                    {destacada ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                        <Award className="h-3 w-3" aria-hidden />
                        {o.etapa === "ganada" ? "Elegida" : "Recomendada"}
                      </span>
                    ) : c.aseguradoraId === economica ? (
                      <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-success">Más económica</span>
                    ) : null}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <span className="font-display text-2xl font-bold tabular-nums">{rd(c.prima)}</span>
                    <span className="text-xs text-muted-foreground">unos {rd(c.prima / 12)} al mes</span>
                  </div>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Deducible:</span> {c.deducible}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {todas.map((cob) => (
                      <li key={cob} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", c.coberturas.includes(cob) ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground line-through")}>
                        {c.coberturas.includes(cob) && <Check className="h-3 w-3" aria-hidden />}
                        {cob}
                      </li>
                    ))}
                  </ul>
                  {!cerrada && (
                    <Button size="sm" variant={c.recomendada ? "default" : "outline"} onClick={() => setEmitir(c)} disabled={!!ocupado}>
                      Emitir póliza con esta
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {error && <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              {o.propuestaEnviada ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5 text-success" aria-hidden />
                  Enviado al cliente el {fechaCorta(o.propuestaEnviada)} a las {hora12(o.propuestaEnviada)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">El cliente todavía no ha recibido el comparativo.</p>
              )}
              <NotaEjemplo />
            </div>
            {!cerrada && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setPerder(true)} disabled={!!ocupado}>
                  <XCircle className="mr-1.5 h-4 w-4" aria-hidden />
                  Marcar perdida
                </Button>
                <Button variant={o.propuestaEnviada ? "outline" : "default"} onClick={enviar} disabled={!!ocupado}>
                  {ocupado === "enviar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <MessageCircle className="mr-2 h-4 w-4" aria-hidden />}
                  {o.propuestaEnviada ? "Reenviar por WhatsApp" : "Enviar comparativo por WhatsApp"}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Esta oportunidad se cerró sin comparativo.</p>
      )}

      {mostrarFormulario && !cerrada && (
        <div className="flex justify-end border-t pt-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setPerder(true)} disabled={!!ocupado}>
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden />
            Marcar perdida
          </Button>
        </div>
      )}

      <Dialog open={!!emitir} onOpenChange={(v) => !v && setEmitir(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir la póliza</DialogTitle>
            <DialogDescription>Se crea la póliza en la cartera del cliente y la oportunidad queda ganada.</DialogDescription>
          </DialogHeader>
          {emitir && (
            <div className="flex items-center gap-3 rounded-lg border bg-secondary/50 p-3">
              <Aseguradora id={emitir.aseguradoraId} tamano="lg" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{ASEGURADORA[emitir.aseguradoraId]?.nombre}</span>
                <span className="font-display text-xl font-bold tabular-nums">{rd(emitir.prima)} al año</span>
                <span className="text-xs text-muted-foreground">Deducible: {emitir.deducible}</span>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEmitir(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarEmision} disabled={!!ocupado}>
              {ocupado === "emitir" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Emitir póliza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perder} onOpenChange={setPerder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como perdida</DialogTitle>
            <DialogDescription>El motivo queda en el historial y alimenta los indicadores de cierre.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_PERDIDA.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={motivo === m}
                onClick={() => setMotivo(m)}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", motivo === m ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40")}
              >
                {m}
              </button>
            ))}
          </div>
          <Textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle (opcional)" rows={3} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPerder(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarPerdida} disabled={!!ocupado}>
              {ocupado === "perder" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Marcar perdida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tarjeta>
  )
}

function FilaComparativo({ etiqueta, ordenadas, o, render, suave }: { etiqueta: string; ordenadas: CotizacionAseguradora[]; o: Oportunidad; render: (c: CotizacionAseguradora) => React.ReactNode; suave?: boolean }) {
  return (
    <tr>
      <th scope="row" className={cn("border-t py-2.5 pr-3 text-left text-xs font-medium", suave ? "text-muted-foreground" : "text-foreground")}>
        {etiqueta}
      </th>
      {ordenadas.map((c) => {
        const destacada = o.etapa === "ganada" ? o.elegida === c.aseguradoraId : c.recomendada
        return (
          <td key={c.aseguradoraId} className={cn("border-t px-3 py-2.5 text-center", destacada && "border-x border-x-primary bg-accent/60")}>
            {render(c)}
          </td>
        )
      })}
    </tr>
  )
}
