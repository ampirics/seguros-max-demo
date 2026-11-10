"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, ChevronRight, Phone, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Aseguradora, Chip, Encabezado, Historial, NotaEjemplo, Persona, Ramo, RenovacionChip, SiniestroChip, Tarjeta } from "@/components/seguros/comun"
import { ASEGURADORA, ESTADO_POLIZA, ESTADO_RENOVACION, NOMBRE_RAMO, NOMBRE_SUCURSAL, PERSONA, PROCEDIMIENTOS, dentroDe, fechaCorta, fechaLarga, rd } from "@/lib/seguros/catalogo"
import { segurosApi, useFicha, useSeguros } from "@/lib/seguros/cliente"
import type { EstadoRenovacion, Poliza } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"
import { Barra, Cargando, Dato, NotaForm, activa, diasPara, useAccion } from "./util"

const FORMA: Record<Poliza["formaPago"], { nombre: string; cuotas: number }> = {
  anual: { nombre: "Pago anual", cuotas: 1 },
  semestral: { nombre: "Pago semestral", cuotas: 2 },
  trimestral: { nombre: "Pago trimestral", cuotas: 4 },
  mensual: { nombre: "Pago mensual", cuotas: 12 },
}

const PASOS_RENOVACION: EstadoRenovacion[] = ["quiere_renovar", "cotizando", "confirmada", "no_renueva"]

export function FichaPoliza({ id }: { id: string }) {
  const { ahora } = useSeguros()
  const { datos, error } = useFicha(() => segurosApi.poliza(id), [id])
  const { correr, ocupado } = useAccion()

  if (error) return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{error}</p>
  if (!datos) return <Cargando texto="Cargando la póliza…" />

  const { poliza: p, cliente: c, anteriores, siniestros } = datos
  const total = p.vence - p.inicio
  const avance = Math.max(0, Math.min(1, (ahora - p.inicio) / total))
  const dias = diasPara(p.vence, ahora)
  const forma = FORMA[p.formaPago]
  const aseg = ASEGURADORA[p.aseguradoraId]
  const cambiar = (r: EstadoRenovacion) => correr(r, { tipo: "renovacion", polizaId: p.id, renovacion: r }, `Renovación: ${ESTADO_RENOVACION[r].toLowerCase()}`)

  return (
    <div className="flex flex-col gap-6">
      <Encabezado
        volver={{ href: "/admin/cartera", texto: "Cartera y renovaciones" }}
        titulo={p.numero}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {NOMBRE_RAMO[p.ramo]} con {aseg?.nombre ?? "la aseguradora"} para{" "}
              <Link href={`/admin/asegurados/${c.id}`} className="font-medium text-foreground hover:text-primary">
                {c.nombre}
              </Link>
            </span>
            <Chip tono={p.estado === "vigente" ? "verde" : p.estado === "por_renovar" ? "ambar" : "gris"}>{ESTADO_POLIZA[p.estado]}</Chip>
            {!p.pagoAlDia && <Chip tono="rojo">Pago atrasado</Chip>}
          </span>
        }
        acciones={<Aseguradora id={p.aseguradoraId} tamano="lg" />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Tarjeta titulo="La póliza">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Dato etiqueta="Ramo">
                <Ramo ramo={p.ramo} className="text-sm text-foreground" />
              </Dato>
              <Dato etiqueta="Plan">{p.plan}</Dato>
              <Dato etiqueta="Bien asegurado">{p.bien}</Dato>
              <Dato etiqueta="Aseguradora">{aseg?.nombre}</Dato>
              <Dato etiqueta="Suma asegurada">{rd(p.sumaAsegurada)}</Dato>
              <Dato etiqueta="Prima anual">
                <span className="font-display text-lg font-bold tabular-nums">{rd(p.primaAnual)}</span>
              </Dato>
              <Dato etiqueta="Forma de pago">
                {forma.nombre}
                {forma.cuotas > 1 && <span className="block text-xs font-normal text-muted-foreground">{forma.cuotas} cuotas de {rd(p.primaAnual / forma.cuotas)}</span>}
              </Dato>
              <Dato etiqueta="Pagos">
                {p.pagoAlDia ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Al día
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" aria-hidden /> Cuota atrasada
                  </span>
                )}
              </Dato>
              <Dato etiqueta="Ejecutivo">
                <Persona id={p.ejecutivoId} />
              </Dato>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Vigencia" accion={<span className={cn("text-sm font-semibold", dias <= 15 ? "text-destructive" : dias <= 60 ? "text-warning" : "text-muted-foreground")}>{dentroDe(p.vence, ahora)}</span>}>
            <div className="flex flex-col gap-2">
              <div className="relative pt-1">
                <Barra valor={avance} className="h-2.5" tono={dias <= 30 ? "warning" : "primary"} />
                <span className="absolute top-0 w-0.5 -translate-x-1/2 rounded bg-foreground" style={{ left: `${avance * 100}%`, height: 18 }} aria-hidden />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Desde <span className="font-medium text-foreground">{fechaLarga(p.inicio)}</span>
                </span>
                <span>
                  Hasta <span className="font-medium text-foreground">{fechaLarga(p.vence)}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Ha transcurrido el {Math.round(avance * 100)} % de la vigencia.</p>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Siniestros de esta póliza" accion={<span className="text-xs text-muted-foreground">{siniestros.length || "Ninguno"}</span>}>
            {siniestros.length ? (
              <ul className="-mx-2 flex flex-col">
                {siniestros
                  .slice()
                  .sort((a, b) => b.reportado - a.reportado)
                  .map((s) => (
                    <li key={s.id}>
                      <Link href={`/admin/siniestros/${s.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {s.codigo} · {PROCEDIMIENTOS[s.tipo].nombre}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {fechaCorta(s.ocurrido)} · {s.descripcion}
                          </p>
                        </div>
                        <SiniestroChip estado={s.estado} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Esta póliza no tiene siniestros reportados.</p>
            )}
          </Tarjeta>

          {anteriores.length > 0 && (
            <Tarjeta titulo="Pólizas anteriores del mismo ramo">
              <ul className="-mx-2 flex flex-col">
                {anteriores
                  .slice()
                  .sort((a, b) => b.inicio - a.inicio)
                  .map((a) => (
                    <li key={a.id}>
                      <Link href={`/admin/cartera/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 hover:bg-accent/50">
                        <Aseguradora id={a.aseguradoraId} tamano="sm" />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-semibold">{a.numero}</span>
                          <span className="block text-xs text-muted-foreground">
                            {fechaCorta(a.inicio)} a {fechaLarga(a.vence)}
                          </span>
                        </span>
                        <span className="text-sm tabular-nums">{rd(a.primaAnual)}</span>
                        <Chip>{ESTADO_POLIZA[a.estado]}</Chip>
                      </Link>
                    </li>
                  ))}
              </ul>
            </Tarjeta>
          )}
          <NotaEjemplo />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Tarjeta titulo="Asegurado">
            <Link href={`/admin/asegurados/${c.id}`} className="group flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-display text-base font-bold text-accent-foreground">
                {c.nombre
                  .split(" ")
                  .slice(0, 2)
                  .map((x) => x[0])
                  .join("")}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold group-hover:text-primary">{c.nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.segmento === "empresa" ? (c.sector ?? "Empresa") : "Persona"} · {c.documento}
                </span>
              </span>
            </Link>
            <dl className="grid grid-cols-2 gap-3">
              <Dato etiqueta="Teléfono">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {c.telefono}
                </span>
              </Dato>
              <Dato etiqueta="Sucursal">{NOMBRE_SUCURSAL[c.sucursal]}</Dato>
            </dl>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/asegurados/${c.id}`}>Ver ficha del asegurado</Link>
            </Button>
          </Tarjeta>

          <Tarjeta titulo="Renovación" accion={<RenovacionChip estado={p.renovacion} />}>
            {activa(p) ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {dias <= 60 ? `La póliza ${dentroDe(p.vence, ahora)}.` : `Faltan ${dias} días para el vencimiento; el aviso se envía 60 días antes.`} {PERSONA[p.ejecutivoId] ? `La lleva ${PERSONA[p.ejecutivoId].nombre}.` : ""}
                </p>
                {p.renovacion === "sin_iniciar" && (
                  <Button onClick={() => correr("aviso", { tipo: "avisoRenovacion", polizaIds: [p.id] }, "Aviso de renovación enviado por WhatsApp")} disabled={!!ocupado}>
                    <Send aria-hidden /> Enviar aviso de renovación
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {PASOS_RENOVACION.map((r) => (
                    <Button key={r} variant={p.renovacion === r ? "default" : "outline"} size="sm" className="h-auto min-h-9 whitespace-normal py-1.5 text-xs" disabled={p.renovacion === r || !!ocupado} onClick={() => cambiar(r)}>
                      {ESTADO_RENOVACION[r]}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Esta póliza ya no está activa.</p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Historial">
            <NotaForm destino={{ polizaId: p.id }} />
            {p.historial.length ? <Historial items={p.historial} /> : <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>}
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
