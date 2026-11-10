"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { BadgeCheck, Briefcase, FileStack, LifeBuoy, MessageSquare, ShieldCheck, Sparkles, UserRound } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Aseguradora, Chip, EtapaChip, Encabezado, ICONO_RAMO, Indicador, NotaEjemplo, Persona, RenovacionChip, SiniestroChip, Tarjeta } from "@/components/seguros/comun"
import { NOMBRE_CANAL, NOMBRE_SUCURSAL, PROCEDIMIENTOS, RAMO, RAMOS, dentroDe, fechaCorta, fechaLarga, numero, rd, rdCorto } from "@/lib/seguros/catalogo"
import { segurosApi, useFicha } from "@/lib/seguros/cliente"
import type { PasoRecorrido, Ramo } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"

const ICONO_PASO: Record<PasoRecorrido["tipo"], typeof UserRound> = {
  contacto: UserRound,
  conversacion: MessageSquare,
  oportunidad: Briefcase,
  cotizacion: Briefcase,
  poliza: FileStack,
  renovacion: FileStack,
  siniestro: LifeBuoy,
  pago: ShieldCheck,
  nota: BadgeCheck,
}

const CRUZADA: Record<"persona" | "empresa", Ramo[]> = {
  persona: ["vehiculo", "salud", "vida", "hogar", "viaje"],
  empresa: ["incendio", "responsabilidad_civil", "colectivo", "transporte", "vehiculo", "maquinaria"],
}

export default function AseguradoPage() {
  const { id } = useParams<{ id: string }>()
  const { datos, error } = useFicha(() => segurosApi.cliente(id), [id])

  return (
    <AdminLayout title="Asegurado">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !datos ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Ficha datos={datos} />
      )}
    </AdminLayout>
  )
}

function Ficha({ datos }: { datos: Awaited<ReturnType<typeof segurosApi.cliente>> }) {
  const { cliente: c, polizas, oportunidades, siniestros, conversacion } = datos
  const ahora = Date.now()
  const vigentes = polizas.filter((p) => p.estado === "vigente" || p.estado === "por_renovar")
  const prima = vigentes.reduce((t, p) => t + p.primaAnual, 0)
  const abiertas = oportunidades.filter((o) => !["ganada", "perdida"].includes(o.etapa))
  const sinAbiertos = siniestros.filter((s) => !["resuelto", "cerrado"].includes(s.estado))
  const tiene = new Set([...vigentes.map((p) => p.ramo), ...abiertas.map((o) => o.ramo)])
  const cruzada = CRUZADA[c.segmento].filter((r) => !tiene.has(r))
  const doc = c.documento ? `${c.documento.slice(0, 4)}•••••${c.documento.slice(-3)}` : "Sin registrar"

  return (
    <div className="flex flex-col gap-5">
      <Encabezado
        volver={{ href: "/admin/asegurados", texto: "Asegurados" }}
        titulo={c.nombre}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            {c.segmento === "empresa" ? <Chip tono="azul">Empresa · {c.sector}</Chip> : <Chip tono="gris">Persona</Chip>}
            {vigentes.length ? <Chip tono="verde">Asegurado de MAX desde {new Date(c.desde).getFullYear()}</Chip> : <Chip tono="ambar">Prospecto</Chip>}
            {c.consentimiento && <Chip tono="info">Autorizó sus datos por {NOMBRE_CANAL[c.consentimiento.canal]}</Chip>}
          </span>
        }
        acciones={
          conversacion ? (
            <Button asChild>
              <Link href={`/admin/chat?conversacion=${conversacion.id}`}><MessageSquare className="h-4 w-4" />Abrir conversación</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador etiqueta="Pólizas vigentes" valor={numero(vigentes.length)} detalle={vigentes.length ? Array.from(new Set(vigentes.map((p) => RAMO[p.ramo].nombre))).join(", ") : "Ninguna todavía"} />
        <Indicador etiqueta="Prima anual" valor={prima ? rdCorto(prima) : "RD$ 0"} />
        <Indicador etiqueta="Solicitudes abiertas" valor={numero(abiertas.length)} />
        <Indicador etiqueta="Siniestros abiertos" valor={numero(sinAbiertos.length)} detalle={`${siniestros.length} en total`} tono={sinAbiertos.length ? "alerta" : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Tarjeta titulo="Pólizas">
            {polizas.filter((p) => p.estado !== "renovada").length ? (
              <ul className="flex flex-col divide-y">
                {polizas.filter((p) => p.estado !== "renovada").map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/cartera/${p.id}`} className="flex flex-col gap-2 py-3 hover:text-primary sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <Aseguradora id={p.aseguradoraId} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{RAMO[p.ramo].nombre}: {p.bien}</span>
                          <span className="block text-xs text-muted-foreground">{p.numero} · {p.plan}</span>
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-3 sm:w-72">
                        <span className="text-xs text-muted-foreground">{p.estado === "por_renovar" ? dentroDe(p.vence, ahora) : `Vence el ${fechaCorta(p.vence)}`}{p.pagoAlDia ? "" : " · cuota pendiente"}</span>
                        {p.estado === "por_renovar" ? <RenovacionChip estado={p.renovacion} /> : <span className="font-display text-sm font-bold tabular-nums">{rd(p.primaAnual)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no tiene pólizas con MAX.</p>
            )}
          </Tarjeta>

          <div className="grid gap-5 md:grid-cols-2">
            <Tarjeta titulo="Solicitudes">
              {oportunidades.length ? (
                <ul className="flex flex-col divide-y">
                  {oportunidades.slice(0, 6).map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/oportunidades/${o.id}`} className="flex items-center gap-2 py-2.5 hover:text-primary">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{o.codigo} · {RAMO[o.ramo].nombre}</span>
                          <span className="block text-xs text-muted-foreground">{fechaCorta(o.creada)}{o.primaGanada ? ` · ${rd(o.primaGanada)}` : ""}</span>
                        </span>
                        <EtapaChip etapa={o.etapa} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin solicitudes.</p>
              )}
            </Tarjeta>
            <Tarjeta titulo="Siniestros">
              {siniestros.length ? (
                <ul className="flex flex-col divide-y">
                  {siniestros.slice(0, 6).map((s) => (
                    <li key={s.id}>
                      <Link href={`/admin/siniestros/${s.id}`} className="flex items-center gap-2 py-2.5 hover:text-primary">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{s.codigo} · {PROCEDIMIENTOS[s.tipo].nombre}</span>
                          <span className="block text-xs text-muted-foreground">{fechaCorta(s.ocurrido)} · {s.lugar}</span>
                        </span>
                        <SiniestroChip estado={s.estado} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin siniestros.</p>
              )}
            </Tarjeta>
          </div>

          <Tarjeta titulo="Recorrido">
            <ol className="relative flex flex-col gap-3 border-l pl-5">
              {[...c.recorrido].reverse().slice(0, 25).map((r, i) => {
                const I = ICONO_PASO[r.tipo]
                const cuerpo = (
                  <>
                    <span className="block text-sm">{r.texto}</span>
                    <span className="block text-xs text-muted-foreground">{fechaLarga(r.ts)}</span>
                  </>
                )
                return (
                  <li key={i} className="relative">
                    <span className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full border bg-card"><I className="h-3 w-3 text-primary" aria-hidden /></span>
                    {r.enlace ? <Link href={r.enlace} className="hover:text-primary">{cuerpo}</Link> : cuerpo}
                  </li>
                )
              })}
            </ol>
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-5">
          <Tarjeta titulo="Datos">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{c.segmento === "empresa" ? "RNC" : "Cédula"}</dt><dd>{doc}</dd>
              <dt className="text-muted-foreground">Teléfono</dt><dd>{c.telefono}</dd>
              {c.correo && <><dt className="text-muted-foreground">Correo</dt><dd className="break-all">{c.correo}</dd></>}
              {c.contacto && <><dt className="text-muted-foreground">Contacto</dt><dd>{c.contacto}</dd></>}
              {c.empleados && <><dt className="text-muted-foreground">Empleados</dt><dd>{c.empleados}</dd></>}
              <dt className="text-muted-foreground">Ciudad</dt><dd>{c.ciudad || "Sin dato"}</dd>
              <dt className="text-muted-foreground">Sucursal</dt><dd>{NOMBRE_SUCURSAL[c.sucursal]}</dd>
            </dl>
            <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">Ejecutivo <Persona id={c.ejecutivoId} /></div>
          </Tarjeta>

          {cruzada.length > 0 && (
            <Tarjeta titulo={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" aria-hidden />Venta cruzada</span>}>
              <p className="text-xs text-muted-foreground">Ramos que {c.segmento === "empresa" ? "la empresa" : "el asegurado"} todavía no tiene con MAX. El ejecutivo decide si conviene conversarlo; la IA no recomienda pólizas.</p>
              <ul className="flex flex-wrap gap-2">
                {cruzada.map((r) => {
                  const I = ICONO_RAMO[r]
                  return (
                    <li key={r} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium")}>
                      <I className="h-3.5 w-3.5 text-primary" aria-hidden />
                      {RAMOS.find((x) => x.id === r)?.nombre}
                    </li>
                  )
                })}
              </ul>
            </Tarjeta>
          )}
          <NotaEjemplo />
        </div>
      </div>
    </div>
  )
}
