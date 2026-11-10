"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { ArrowRight, Loader2, PhoneCall, RefreshCw } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  MODOS, esFicticio, filasDe, nombreTabla, normalizarTelefono, pruebasApi, textoTelefonoLibre,
  type EstadoPruebas, type ModoReinicio, type Reinicio,
} from "./api"

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" }) : "—"

function minutosHasta(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
}

function Conteos({ titulo, conteos }: { titulo: string; conteos: Record<string, unknown> | null | undefined }) {
  const filas = filasDe(conteos)
  return (
    <div className="min-w-0 flex-1">
      <h3 className="text-sm font-medium">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Nada que borrar.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm">
          {filas.map(([tabla, n]) => (
            <li key={tabla} className="flex justify-between gap-3">
              <span className="truncate text-muted-foreground" title={tabla}>{nombreTabla(tabla)}</span>
              <span className="tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Resultado({ r }: { r: Reinicio }) {
  const coincide = r.existencias?.coincide
  return (
    <div className="mt-4 rounded-md border p-4" aria-live="polite">
      <p className="text-sm font-medium">
        {r.simulado ? "Esto es lo que se borraría (no se borró nada)" : "Reinicio hecho"}: {r.telefonos.join(", ")}
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        <Conteos titulo="Panel (MG)" conteos={r.mg} />
        <Conteos titulo="Asistente (ORA)" conteos={r.ora} />
      </div>
      {r.ora_error && <p className="mt-3 text-sm text-destructive">ORA no respondió: {r.ora_error}</p>}
      <p className={cn("mt-3 text-sm", coincide === false ? "text-destructive" : "text-muted-foreground")}>
        Existencias: {coincide === true ? "iguales que en el reinicio anterior" : coincide === false
          ? "distintas del reinicio anterior; revisa qué cambió antes de correr el caso" : "sin reinicio anterior para comparar"}
      </p>
      {r.perfil && <p className="mt-1 text-sm text-muted-foreground">Perfil sembrado: {String(r.perfil.vehiculos ?? 0)} vehículos, {Array.isArray(r.perfil.cotizaciones) ? r.perfil.cotizaciones.length : 0} cotizaciones.</p>}
    </div>
  )
}

export default function PruebasPage() {
  const [estado, setEstado] = useState<EstadoPruebas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [confirmarReal, setConfirmarReal] = useState(false)

  const [telefono, setTelefono] = useState("")
  const [modo, setModo] = useState<ModoReinicio>("nuevo")
  const [perfil, setPerfil] = useState("")
  const [previa, setPrevia] = useState<Reinicio | null>(null)
  const [hecho, setHecho] = useState<Reinicio | null>(null)
  const [confirmacion, setConfirmacion] = useState("")

  const [fechaReloj, setFechaReloj] = useState("")
  const [horaReloj, setHoraReloj] = useState("")

  const cargar = useCallback(() => {
    pruebasApi.estado()
      .then((e) => { setEstado(e); setError(null) })
      .catch((e: any) => setError(e?.message || "No se pudo leer el estado"))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const normalizado = normalizarTelefono(telefono)
  const enLista = !!normalizado && !!estado?.telefonos.includes(normalizado)
  const permitido = !!normalizado && !!estado && (enLista || esFicticio(normalizado, estado.rango_ficticio))

  const perfilObjeto = (): Record<string, unknown> | undefined | null => {
    if (modo !== "conocido") return undefined
    try {
      const valor = JSON.parse(perfil)
      return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : null
    } catch {
      return null
    }
  }

  const cambiarCanal = async (canal: "simulado" | "real") => {
    setOcupado("canal")
    try {
      setEstado(await pruebasApi.canal(canal))
      toast.success(canal === "real" ? "WhatsApp real encendido por 2 horas" : "Canal simulado: nada sale por WhatsApp real")
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar el canal")
    } finally {
      setOcupado(null)
      setConfirmarReal(false)
    }
  }

  const numeroNuevo = async () => {
    setOcupado("numero")
    try {
      const t = await pruebasApi.telefonoLibre()
      setTelefono(t.telefono)
      setModo("nuevo")
      setPrevia(null)
      setHecho(null)
      toast.success(textoTelefonoLibre(t))
    } catch (e: any) {
      toast.error(e?.message || "No se pudo buscar un número libre")
    } finally {
      setOcupado(null)
    }
  }

  const revisar = async () => {
    const datos = perfilObjeto()
    if (!normalizado || datos === null) return
    setOcupado("revisar")
    setHecho(null)
    setConfirmacion("")
    try {
      setPrevia(await pruebasApi.reiniciar({ telefono: normalizado, modo, perfil: datos, simular: true }))
    } catch (e: any) {
      setPrevia(null)
      toast.error(e?.message || "No se pudo revisar el teléfono")
    } finally {
      setOcupado(null)
    }
  }

  const reiniciar = async () => {
    const datos = perfilObjeto()
    if (!normalizado || datos === null) return
    setOcupado("reiniciar")
    try {
      const r = await pruebasApi.reiniciar({ telefono: normalizado, modo, perfil: datos, confirmar_reales: true })
      setHecho(r)
      setPrevia(null)
      setConfirmacion("")
      toast.success("Teléfono reiniciado")
      cargar()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo reiniciar")
    } finally {
      setOcupado(null)
    }
  }

  const fijarReloj = async (soltar: boolean) => {
    setOcupado("reloj")
    try {
      const r = await pruebasApi.reloj(soltar ? null : fechaReloj, soltar ? null : horaReloj)
      if (r.ora_error) toast.error(`ORA no respondió: ${r.ora_error}`)
      else toast.success(soltar ? "Reloj de vuelta a la hora real" : "Reloj de prueba fijado")
      cargar()
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar el reloj")
    } finally {
      setOcupado(null)
    }
  }

  const real = estado?.canal_activo === "real"
  const restan = minutosHasta(estado?.canal_real_vence ?? null)
  const perfilInvalido = modo === "conocido" && perfilObjeto() === null

  return (
    <AdminLayout title="Pruebas">
      <Link href="/admin/pruebas/casos"
        className="mb-6 flex max-w-3xl items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 p-5 hover:bg-primary/10">
        <span className="min-w-0">
          <span className="block text-base font-semibold">Consola de casos</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Elige un caso del banco, inícialo, manda cada paso y mira en vivo si el bot cumple cada regla.
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
      </Link>
      {error ? (
        <div className="max-w-2xl rounded-lg border bg-card p-5">
          <h2 className="text-base font-semibold">Las pruebas están apagadas en este servidor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Se encienden con PRUEBAS_REINICIO=true en MG y en ORA, nunca en producción. Respuesta del servidor: {error}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={cargar}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Volver a intentar
          </Button>
        </div>
      ) : !estado ? <Skeleton className="h-64 w-full max-w-3xl" /> : (
        <div className="flex max-w-3xl flex-col gap-6">
          <section className="rounded-lg border bg-card p-5" aria-labelledby="canal-titulo">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="canal-titulo" className="text-base font-semibold">Canal de salida</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  En simulado nada sale por WhatsApp real: el bot y el vendedor solo le escriben al simulador.
                </p>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium",
                estado.canal_activo === null ? "bg-secondary text-muted-foreground" : real ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                {estado.canal_activo === null ? "ORA no responde" : real ? "WhatsApp real" : "Simulador"}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
              <div className="min-w-0">
                <Label htmlFor="canal-real" className="text-sm font-medium">Usar WhatsApp real</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {real
                    ? `Se apaga solo en ${restan ?? 0} min (${fecha(estado.canal_real_vence)}). Solo a ${estado.telefonos.join(", ") || "los números de la lista"}.`
                    : "Se apaga solo a las 2 horas. Solo escribe a los números de la lista de prueba."}
                </p>
              </div>
              <Switch id="canal-real" checked={real} disabled={ocupado === "canal" || estado.canal_activo === null}
                onCheckedChange={(v) => (v ? setConfirmarReal(true) : cambiarCanal("simulado"))} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Llamadas a Graph API</dt><dd className="tabular-nums">{estado.llamadas_graph ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Bloqueadas</dt><dd className="tabular-nums">{estado.bloqueadas_graph ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Contando desde</dt><dd>{fecha(estado.contador_desde)}</dd></div>
            </dl>
            {!estado.ora.disponible && <p className="mt-3 text-sm text-destructive">ORA no responde: {estado.ora.error}</p>}
          </section>

          <section className="rounded-lg border bg-card p-5" aria-labelledby="reiniciar-titulo">
            <h2 id="reiniciar-titulo" className="text-base font-semibold">Reiniciar un teléfono</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Solo números de la lista ({estado.telefonos.join(", ") || "vacía"}) o del rango ficticio {estado.rango_ficticio.desde} a {estado.rango_ficticio.hasta.slice(-4)}.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <div className="flex gap-2">
                  <Input id="telefono" inputMode="tel" placeholder="+1 809 555 0142" value={telefono} maxLength={20}
                    onChange={(e) => { setTelefono(e.target.value); setPrevia(null); setHecho(null) }} />
                  <Button type="button" variant="outline" className="shrink-0 gap-1.5" disabled={!!ocupado} onClick={numeroNuevo}>
                    {ocupado === "numero" ? <Loader2 className="animate-spin" aria-hidden /> : <PhoneCall aria-hidden />} Número nuevo
                  </Button>
                </div>
                {telefono && !permitido && <p className="text-xs text-destructive">No es un teléfono de prueba.</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modo">Modo</Label>
                <Select value={modo} onValueChange={(v) => { setModo(v as ModoReinicio); setPrevia(null); setHecho(null) }}>
                  <SelectTrigger id="modo"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODOS.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.texto}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{MODOS.find((m) => m.valor === modo)?.detalle}</p>
              </div>
            </div>
            {modo === "conocido" && (
              <div className="mt-4 flex flex-col gap-1.5">
                <Label htmlFor="perfil">Perfil (JSON, sin precios)</Label>
                <Textarea id="perfil" rows={6} className="font-mono text-xs" value={perfil}
                  placeholder='{"nombre": "Carlos Prueba", "vehiculos": [{"marca": "Hyundai", "modelo": "Tucson", "anio": 2012}]}'
                  onChange={(e) => { setPerfil(e.target.value); setPrevia(null) }} />
                {perfil && perfilInvalido && <p className="text-xs text-destructive">El perfil no es un objeto JSON válido.</p>}
              </div>
            )}
            <div className="mt-4">
              <Button type="button" variant="outline" disabled={!permitido || perfilInvalido || !!ocupado} onClick={revisar}>
                {ocupado === "revisar" && <Loader2 className="animate-spin" aria-hidden />} Revisar qué se borra
              </Button>
            </div>
            {previa && (
              <>
                <Resultado r={previa} />
                <div className="mt-4 flex flex-col gap-1.5 sm:max-w-sm">
                  <Label htmlFor="confirmacion">Escribe el teléfono para confirmar{enLista ? " (es un número real)" : ""}</Label>
                  <Input id="confirmacion" inputMode="tel" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
                  <Button type="button" variant="destructive" className="mt-1"
                    disabled={normalizarTelefono(confirmacion) !== normalizado || !!ocupado} onClick={reiniciar}>
                    {ocupado === "reiniciar" && <Loader2 className="animate-spin" aria-hidden />} Reiniciar de verdad
                  </Button>
                </div>
              </>
            )}
            {hecho && <Resultado r={hecho} />}
          </section>

          <section className="rounded-lg border bg-card p-5" aria-labelledby="reloj-titulo">
            <h2 id="reloj-titulo" className="text-base font-semibold">Reloj de prueba</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {estado.reloj
                ? `Fijado: ${estado.reloj.fecha_local} ${estado.reloj.hora_local} de Santo Domingo (corre desde ahí). Ahora marca ${fecha(estado.reloj.ahora)}.`
                : "Hora real de Santo Domingo. Fíjalo para probar el saludo, la agenda y los avisos a otra hora."}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reloj-fecha">Fecha</Label>
                <Input id="reloj-fecha" type="date" value={fechaReloj} onChange={(e) => setFechaReloj(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reloj-hora">Hora</Label>
                <Input id="reloj-hora" type="time" value={horaReloj} onChange={(e) => setHoraReloj(e.target.value)} />
              </div>
              <Button type="button" disabled={!fechaReloj || !horaReloj || !!ocupado} onClick={() => fijarReloj(false)}>Fijar</Button>
              {estado.reloj && <Button type="button" variant="outline" disabled={!!ocupado} onClick={() => fijarReloj(true)}>Volver a la hora real</Button>}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5" aria-labelledby="estado-titulo">
            <div className="flex items-center justify-between gap-3">
              <h2 id="estado-titulo" className="text-base font-semibold">Estado</h2>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={cargar}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Actualizar
              </Button>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Entorno</dt><dd>{estado.entorno}</dd></div>
              <div><dt className="text-muted-foreground">Asistente (ORA)</dt><dd>{estado.ora.disponible ? "Responde" : "No responde"}</dd></div>
              <div>
                <dt className="text-muted-foreground">Último reinicio</dt>
                <dd>{estado.ultimo_reinicio
                  ? `${fecha(estado.ultimo_reinicio.fecha)}: ${estado.ultimo_reinicio.telefonos.join(", ")} (${MODOS.find((m) => m.valor === estado.ultimo_reinicio?.modo)?.texto ?? estado.ultimo_reinicio.modo})`
                  : "Ninguno"}</dd>
              </div>
              <div><dt className="text-muted-foreground">Huella de existencias</dt><dd className="font-mono text-xs">{estado.existencias.slice(0, 12)}</dd></div>
            </dl>
          </section>
        </div>
      )}

      <Dialog open={confirmarReal} onOpenChange={setConfirmarReal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Pasar a WhatsApp real?</DialogTitle>
            <DialogDescription>
              Las respuestas saldrán por el número real de Meta, solo a {estado?.telefonos.join(", ") || "los números de la lista"}.
              Se apaga solo a las 2 horas y vuelve al simulador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarReal(false)}>Seguir en simulado</Button>
            <Button type="button" disabled={ocupado === "canal"} onClick={() => cambiarCanal("real")}>
              {ocupado === "canal" && <Loader2 className="animate-spin" aria-hidden />} Pasar a real
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
