"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, Check, MessageSquare, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Aseguradora, Encabezado, Historial, NotaEjemplo, Persona, SiniestroChip, Tarjeta } from "@/components/seguros/comun"
import { Cargando, Dato, NotaForm, useAccion } from "@/components/seguros/cartera/util"
import { ICONO_TIPO, MarcaIA, recibidos } from "@/components/seguros/siniestros/comun"
import { ESTADO_SINIESTRO, PROCEDIMIENTOS, RAMO, fechaCorta, hace, hora12, rd } from "@/lib/seguros/catalogo"
import { segurosApi, useFicha } from "@/lib/seguros/cliente"
import type { EstadoSiniestro } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"

const ORDEN: EstadoSiniestro[] = ["reportado", "documentos", "inspeccion", "en_aseguradora", "resuelto", "cerrado"]

export function FichaSiniestro({ id }: { id: string }) {
  const { datos, error } = useFicha(() => segurosApi.siniestro(id), [id])
  const { correr, ocupado } = useAccion()
  const [nuevo, setNuevo] = useState<EstadoSiniestro | "">("")
  const [numero, setNumero] = useState("")
  const [resultado, setResultado] = useState("")
  const [monto, setMonto] = useState("")

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!datos) return <Cargando texto="Cargando el siniestro…" />
  const { siniestro: s, cliente: c, poliza: p, conversacion } = datos
  const pr = PROCEDIMIENTOS[s.tipo]
  const I = ICONO_TIPO[s.tipo]
  const total = s.documentos.length
  const listos = recibidos(s)
  const paso = ORDEN.indexOf(s.estado)

  const guardarEstado = async () => {
    if (!nuevo) return
    const r = await correr(
      "estado",
      { tipo: "siniestroEstado", siniestroId: s.id, estado: nuevo, numeroAseguradora: numero.trim() || undefined, resultado: resultado.trim() || undefined, montoResuelto: monto ? Number(monto.replace(/\D/g, "")) : undefined },
      ["inspeccion", "en_aseguradora", "resuelto"].includes(nuevo) ? `Estado actualizado y aviso enviado a ${c.nombre.split(" ")[0]} por WhatsApp` : "Estado actualizado",
    )
    if (r) {
      setNuevo("")
      setResultado("")
      setMonto("")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Encabezado
        volver={{ href: "/admin/siniestros", texto: "Siniestros" }}
        titulo={`${s.codigo} · ${pr.nombre}`}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <SiniestroChip estado={s.estado} />
            {s.creadoPor === "ia" && <MarcaIA />}
            {s.lesionados && <span className="inline-flex items-center gap-1 rounded-full bg-destructive-soft px-2 py-0.5 text-[11px] font-semibold text-destructive"><AlertTriangle className="h-3 w-3" />Con lesionados</span>}
            <span>Reportado {hace(s.reportado)}</span>
          </span>
        }
        acciones={
          conversacion ? (
            <Button asChild variant="outline">
              <Link href={`/admin/chat?conversacion=${conversacion.id}`}><MessageSquare className="h-4 w-4" />Abrir conversación</Link>
            </Button>
          ) : undefined
        }
      />

      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {ORDEN.map((e, i) => (
          <li key={e} className={cn("rounded-md px-2 py-1.5 text-center text-[11px] font-medium", i < paso ? "bg-primary/15 text-primary" : i === paso ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            {ESTADO_SINIESTRO[e]}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Tarjeta titulo={<span className="flex items-center gap-2"><I className="h-4 w-4 text-primary" aria-hidden />Qué pasó</span>}>
            <p className="text-sm leading-relaxed">{s.descripcion}</p>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Dato etiqueta="Ocurrió">{fechaCorta(s.ocurrido)}, {hora12(s.ocurrido)}</Dato>
              <Dato etiqueta="Lugar">{s.lugar}</Dato>
              <Dato etiqueta="Lesionados">{s.lesionados ? "Sí" : "No"}</Dato>
              <Dato etiqueta="Terceros">{s.terceros ? "Sí" : "No"}</Dato>
            </dl>
          </Tarjeta>

          <Tarjeta titulo={`Documentos (${listos} de ${total})`}>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${total ? (listos / total) * 100 : 0}%` }} />
            </div>
            <ul className="flex flex-col divide-y">
              {s.documentos.map((d, i) => (
                <li key={d.nombre}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={!!d.recibido}
                      disabled={ocupado === `doc-${i}`}
                      onChange={(e) => correr(`doc-${i}`, { tipo: "siniestroDocumento", siniestroId: s.id, indice: i, recibido: e.target.checked }, e.target.checked ? "Documento recibido" : "Documento pendiente de nuevo")}
                    />
                    <span className={cn("flex-1 text-sm", d.recibido && "text-muted-foreground line-through")}>{d.nombre}</span>
                    {d.recibido && <span className="text-[11px] text-muted-foreground">{hace(d.recibido)}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Actualizar con la aseguradora">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={nuevo} onValueChange={(v) => setNuevo(v as EstadoSiniestro)}>
                <SelectTrigger aria-label="Nuevo estado"><SelectValue placeholder="Nuevo estado" /></SelectTrigger>
                <SelectContent>
                  {ORDEN.filter((e) => e !== s.estado).map((e) => <SelectItem key={e} value={e}>{ESTADO_SINIESTRO[e]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder={s.numeroAseguradora ?? "Número de reclamo de la aseguradora"} aria-label="Número de reclamo" />
              {(nuevo === "resuelto" || nuevo === "cerrado") && (
                <>
                  <Input value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Resultado (por ejemplo: pagado por la aseguradora)" aria-label="Resultado" />
                  <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" placeholder="Monto resuelto en RD$" aria-label="Monto resuelto" />
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">En inspección, en la aseguradora y resuelto, el asegurado recibe el aviso por WhatsApp.</p>
              <Button onClick={guardarEstado} disabled={!nuevo || ocupado === "estado"}><Check className="h-4 w-4" />Guardar</Button>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Historial">
            <Historial items={s.historial} />
            <NotaForm destino={{ siniestroId: s.id }} />
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-5">
          <Tarjeta titulo="Asegurado">
            <Link href={`/admin/asegurados/${c.id}`} className="font-medium hover:text-primary">{c.nombre}</Link>
            <p className="text-xs text-muted-foreground">{c.telefono} · {c.ciudad}</p>
            {c.segmento === "empresa" && c.contacto && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Contacto: {c.contacto}</p>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">Responsable <Persona id={s.responsableId} /></div>
          </Tarjeta>

          <Tarjeta titulo="Póliza">
            {p ? (
              <>
                <Aseguradora id={p.aseguradoraId} conNombre />
                <Link href={`/admin/cartera/${p.id}`} className="text-sm font-medium hover:text-primary">{p.numero}</Link>
                <p className="text-xs text-muted-foreground">{RAMO[p.ramo].nombre} · {p.plan}</p>
                <p className="text-xs text-muted-foreground">{p.bien} · vence el {fechaCorta(p.vence)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sin póliza identificada: el analista la confirma con el asegurado.</p>
            )}
            <dl className="grid grid-cols-2 gap-3 border-t pt-3">
              <Dato etiqueta="Reclamo en la aseguradora">{s.numeroAseguradora ?? "Pendiente"}</Dato>
              <Dato etiqueta="Monto estimado">{s.montoEstimado ? rd(s.montoEstimado) : "Sin estimar"}</Dato>
              {s.montoResuelto != null && <Dato etiqueta="Monto resuelto">{rd(s.montoResuelto)}</Dato>}
              {s.resultado && <Dato etiqueta="Resultado">{s.resultado}</Dato>}
            </dl>
            <NotaEjemplo />
          </Tarjeta>

          <Tarjeta titulo="Pasos oficiales de MAX">
            <ol className="flex flex-col gap-2">
              {pr.pasos.map((t, i) => (
                <li key={t} className="flex gap-2 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">Tomados de max.com.do. La IA da estos mismos pasos al asegurado.</p>
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
