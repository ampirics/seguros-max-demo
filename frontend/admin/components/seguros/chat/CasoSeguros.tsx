"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, BadgeCheck, Bot, Check, FileText, Loader2, MessageSquareText, ShieldAlert, X } from "lucide-react"
import { Aseguradora, Chip, EtapaChip, Persona, Ramo, RenovacionChip, SiniestroChip } from "@/components/seguros/comun"
import { CAMPO, NOMBRE_AREA, PROCEDIMIENTOS, RAMO, dentroDe, fechaCorta, hace, primerNombre, rdCorto } from "@/lib/seguros/catalogo"
import { segurosApi, useSeguros } from "@/lib/seguros/cliente"
import type { Mensaje } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"

const valor = (v: unknown) => (typeof v === "boolean" ? (v ? "Sí" : "No") : typeof v === "number" && v > 9999 ? rdCorto(v) : String(v))

export function CasoSeguros({ conversacionId, onSugerencia }: { conversacionId: string; onSugerencia: (texto: string) => void }) {
  const { estado, ahora } = useSeguros()
  const conv = estado?.conversaciones.find((c) => c.id === conversacionId)
  const cli = conv ? estado?.clientes.find((c) => c.id === conv.clienteId) : undefined
  const [mensajes, setMensajes] = useState<Mensaje[]>([])

  useEffect(() => {
    segurosApi.mensajes(conversacionId).then(setMensajes).catch(() => setMensajes([]))
  }, [conversacionId, conv?.actualizada])

  if (!estado) return <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-muted-foreground" />
  if (!conv || !cli) return <p className="text-sm text-muted-foreground">Esta conversación no tiene ficha en MAX.</p>

  const op = conv.oportunidadId ? estado.oportunidades.find((o) => o.id === conv.oportunidadId) : undefined
  const sin = conv.siniestroId ? estado.siniestros.find((s) => s.id === conv.siniestroId) : undefined
  const polizas = estado.polizas.filter((p) => p.clienteId === cli.id).sort((a, b) => a.vence - b.vence)
  const pasos = [...mensajes].reverse().find((m) => m.de === "ia" && m.pasos?.length)?.pasos ?? []
  const verificado = (cli.verificadoHasta ?? 0) > ahora
  const nombre = cli.segmento === "empresa" ? primerNombre(cli.contacto ?? cli.nombre) : primerNombre(cli.nombre)
  const tu = conv.trato === "tu"

  const sugerencias: string[] = []
  if (op && op.faltantes.length) sugerencias.push(`${nombre}, para completar su solicitud me falta ${(CAMPO[op.faltantes[0]] ?? op.faltantes[0]).toLowerCase()}. ¿Me lo ${tu ? "dices" : "indica"}?`)
  if (op && op.etapa === "calificada") sugerencias.push(`${nombre}, ${tu ? "te" : "le"} escribe ${op.ejecutivoId ? primerNombre(estado.equipo.find((p) => p.id === op.ejecutivoId)?.nombre ?? "") : "su ejecutivo"}, de MAX. Ya estoy pidiendo las primas a las aseguradoras para ${tu ? "tu" : "su"} ${RAMO[op.ramo].nombre.toLowerCase()}.`)
  if (sin) {
    const falta = sin.documentos.filter((d) => !d.recibido).map((d) => d.nombre.toLowerCase())
    if (falta.length) sugerencias.push(`${nombre}, para avanzar con ${tu ? "tu" : "su"} caso ${sin.codigo} me ${falta.length === 1 ? "falta" : "faltan"}: ${falta.slice(0, 3).join("; ")}.`)
    sugerencias.push(`${nombre}, ${tu ? "tu" : "su"} caso ${sin.codigo} está ${sin.estado === "en_aseguradora" ? "en la aseguradora" : "en proceso"}. ${tu ? "Te" : "Le"} aviso por aquí en cuanto tenga respuesta.`)
  }
  if (conv.pase?.motivo.includes("pago")) sugerencias.push(`Gracias, ${nombre}. Ya aplicamos el pago a ${tu ? "tu" : "su"} póliza. Cualquier cosa, por aquí ${tu ? "estoy" : "estamos"}.`)
  if (conv.pase?.motivo.includes("queja")) sugerencias.push(`${nombre}, ${tu ? "te" : "le"} pido disculpas por la espera. Ya hablé con la aseguradora y ${tu ? "te" : "le"} confirmo el estado hoy por aquí.`)
  if (!sugerencias.length) sugerencias.push(`Hola, ${nombre}. ${tu ? "Te" : "Le"} escribe el equipo de MAX. ¿En qué ${tu ? "te" : "le"} puedo ayudar?`)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex flex-col gap-1">
        <Link href={`/admin/asegurados/${cli.id}`} className="font-display text-lg font-semibold hover:text-primary">{cli.nombre}</Link>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{cli.telefono}</span>
          {cli.segmento === "empresa" && <Chip tono="azul">Empresa</Chip>}
          {polizas.some((p) => ["vigente", "por_renovar"].includes(p.estado)) ? <Chip tono="verde">Asegurado de MAX</Chip> : <Chip tono="ambar">Prospecto</Chip>}
          {verificado && <Chip tono="info"><BadgeCheck className="mr-1 h-3 w-3" />Verificado</Chip>}
          {cli.consentimiento && <Chip tono="gris">Autorizó sus datos</Chip>}
        </div>
        {cli.segmento === "empresa" && cli.contacto && <p className="text-xs text-muted-foreground">{cli.sector} · contacto: {cli.contacto}</p>}
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">Ejecutivo: <Persona id={cli.ejecutivoId} /></div>
      </div>

      {conv.pase && conv.estado !== "ia" && (
        <section className={cn("flex flex-col gap-2 rounded-lg border p-3", conv.estado === "esperando_equipo" ? "border-destructive/30 bg-destructive-soft" : "bg-secondary")}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className={cn("h-4 w-4", conv.estado === "esperando_equipo" ? "text-destructive" : "text-muted-foreground")} aria-hidden />
            {conv.estado === "esperando_equipo" ? `Espera a ${NOMBRE_AREA[conv.pase.area].toLowerCase()} ${hace(conv.pase.desde, ahora)}` : `Pasó a ${NOMBRE_AREA[conv.pase.area].toLowerCase()}`}
          </div>
          <p className="text-xs"><span className="font-medium">Motivo:</span> {conv.pase.motivo}</p>
          <ul className="flex flex-col gap-1 text-xs text-foreground/80">
            {conv.pase.brief.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </section>
      )}

      {pasos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="etiqueta flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-primary" aria-hidden />Lo que hizo la IA en el último mensaje</h3>
          <ul className="flex flex-col gap-1.5">
            {pasos.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {p.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-label="Hecho" /> : p.herramienta === "guardia" ? <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-label="Guardia" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-label="Pendiente" />}
                <span>{p.resumen}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {op && (
        <section className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/admin/oportunidades/${op.id}`} className="text-sm font-semibold hover:text-primary">{op.codigo}</Link>
            <EtapaChip etapa={op.etapa} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Ramo ramo={op.ramo} />
            <span className="text-[11px] text-muted-foreground">Puntuación {op.puntuacion}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {Object.entries(op.ficha).filter(([, v]) => v !== null && v !== "").map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{CAMPO[k] ?? k}</dt>
                <dd className="font-medium">{valor(v)}</dd>
              </div>
            ))}
          </dl>
          {op.faltantes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted-foreground">Falta:</span>
              {op.faltantes.map((k) => <Chip key={k} tono="ambar">{CAMPO[k] ?? k}</Chip>)}
            </div>
          ) : (
            <p className="flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" />Lista para cotizar</p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Asignada a <Persona id={op.ejecutivoId} /></div>
        </section>
      )}

      {sin && (
        <section className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/admin/siniestros/${sin.id}`} className="text-sm font-semibold hover:text-primary">{sin.codigo}</Link>
            <SiniestroChip estado={sin.estado} />
          </div>
          <p className="text-xs">{PROCEDIMIENTOS[sin.tipo].nombre} · {sin.lugar}</p>
          {sin.lesionados && <Chip tono="rojo">Con lesionados</Chip>}
          <ul className="flex flex-col gap-1">
            {sin.documentos.map((d) => (
              <li key={d.nombre} className="flex items-start gap-2 text-xs">
                {d.recibido ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className={cn(!d.recibido && "text-muted-foreground")}>{d.nombre}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Responsable <Persona id={sin.responsableId} /></div>
        </section>
      )}

      {polizas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="etiqueta flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" aria-hidden />Pólizas ({polizas.length})</h3>
          {!verificado && <p className="text-[11px] text-muted-foreground">La IA no da estos datos al cliente hasta verificar su identidad.</p>}
          <ul className="flex flex-col gap-2">
            {polizas.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link href={`/admin/cartera/${p.id}`} className="flex items-center gap-2 rounded-lg border p-2 hover:border-primary/40">
                  <Aseguradora id={p.aseguradoraId} tamano="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{RAMO[p.ramo].nombre}: {p.bien}</span>
                    <span className="block text-[11px] text-muted-foreground">{p.numero} · {p.estado === "por_renovar" ? dentroDe(p.vence, ahora) : `vence el ${fechaCorta(p.vence)}`}{p.pagoAlDia ? "" : " · cuota pendiente"}</span>
                  </span>
                  {p.estado === "por_renovar" && <RenovacionChip estado={p.renovacion} />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="etiqueta flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5 text-primary" aria-hidden />Respuestas sugeridas</h3>
        {sugerencias.slice(0, 3).map((t) => (
          <button key={t} type="button" onClick={() => onSugerencia(t)} className="rounded-lg border bg-card p-2.5 text-left text-xs leading-relaxed transition-colors hover:border-primary/40 hover:bg-accent/40">
            {t}
          </button>
        ))}
      </section>
    </div>
  )
}
