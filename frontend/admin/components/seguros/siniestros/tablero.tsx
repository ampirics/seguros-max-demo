"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Encabezado, Filtro, Indicador, NotaEjemplo, Persona, TONO_SINIESTRO } from "@/components/seguros/comun"
import { Barra } from "@/components/seguros/cartera/util"
import { DIA, PERSONA, PROCEDIMIENTOS, hace, rd, rdCorto } from "@/lib/seguros/catalogo"
import { segurosApi } from "@/lib/seguros/cliente"
import type { Cliente, EstadoSiniestro, Siniestro, TipoSiniestro } from "@/lib/seguros/tipos"
import { cn } from "@/lib/utils"
import { ABIERTOS, ICONO_TIPO, MarcaIA, abierto, recibidos } from "./comun"

const COLUMNAS: { id: string; nombre: string; estados: EstadoSiniestro[] }[] = [
  { id: "reportado", nombre: "Reportados", estados: ["reportado"] },
  { id: "documentos", nombre: "Reuniendo documentos", estados: ["documentos"] },
  { id: "inspeccion", nombre: "En inspección", estados: ["inspeccion"] },
  { id: "en_aseguradora", nombre: "En la aseguradora", estados: ["en_aseguradora"] },
  { id: "final", nombre: "Resueltos y cerrados", estados: ["resuelto", "cerrado"] },
]
const PUNTO: Record<string, string> = { ambar: "bg-warning", info: "bg-info", azul: "bg-primary", verde: "bg-success", gris: "bg-muted-foreground/50", rojo: "bg-destructive" }
const TIPOS = Object.keys(PROCEDIMIENTOS) as TipoSiniestro[]
const MAX_FINAL = 6

export function TableroSiniestros({ siniestros, clientes, ahora }: { siniestros: Siniestro[]; clientes: Map<string, Cliente>; ahora: number }) {
  const [q, setQ] = useState("")
  const [tipo, setTipo] = useState<TipoSiniestro | "">("")
  const [resp, setResp] = useState("")
  const [col, setCol] = useState("")
  const [verTodos, setVerTodos] = useState(false)
  const [diasCierre, setDiasCierre] = useState<number | null>(null)

  useEffect(() => {
    segurosApi
      .metricas(365)
      .then((m) => setDiasCierre(m.resumen.diasCierreSiniestro))
      .catch(() => setDiasCierre(null))
  }, [])

  const abiertos = siniestros.filter(abierto)
  const ia30 = siniestros.filter((s) => s.creadoPor === "ia" && s.reportado >= ahora - 30 * DIA)
  const todos30 = siniestros.filter((s) => s.reportado >= ahora - 30 * DIA)
  const conPendientes = abiertos.filter((s) => recibidos(s) < s.documentos.length)
  const enTramite = abiertos.reduce((t, s) => t + (s.montoEstimado ?? 0), 0)
  const edades = abiertos.map((s) => (ahora - s.reportado) / DIA).sort((a, b) => a - b)
  const medianaAbiertos = edades.length ? edades[Math.floor(edades.length / 2)] : 0
  const cierreValido = diasCierre !== null && diasCierre > 0
  const responsables = [...new Set(siniestros.map((s) => s.responsableId))]

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return siniestros
      .filter((s) => (!tipo || s.tipo === tipo) && (!resp || s.responsableId === resp))
      .filter((s) => {
        if (!t) return true
        const c = clientes.get(s.clienteId)
        return [s.codigo, s.lugar, s.descripcion, c?.nombre, s.numeroAseguradora].some((x) => x?.toLowerCase().includes(t))
      })
      .sort((a, b) => b.reportado - a.reportado)
  }, [siniestros, q, tipo, resp, clientes])

  const columnas = COLUMNAS.filter((c) => !col || c.id === col)

  return (
    <div className="flex flex-col gap-6">
      <Encabezado
        titulo="Siniestros"
        detalle={`${abiertos.length} casos abiertos. ${ia30.length} de los ${todos30.length} reportados en los últimos 30 días llegaron por la IA, de día o de noche, con los datos y los documentos que pide MAX.`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Indicador etiqueta="Abiertos" valor={abiertos.length} detalle={`${abiertos.filter((s) => s.lesionados).length} con lesionados`} />
        <Indicador etiqueta="Reportados por la IA" valor={ia30.length} detalle={`De ${todos30.length} en los últimos 30 días`} tono="bien" />
        <Indicador etiqueta="Con documentos pendientes" valor={conPendientes.length} detalle={`${conPendientes.reduce((t, s) => t + s.documentos.length - recibidos(s), 0)} documentos por recibir`} tono={conPendientes.length ? "alerta" : undefined} />
        {cierreValido ? (
          <Indicador etiqueta="Días hasta resolverse" valor={diasCierre!.toFixed(diasCierre! < 10 ? 1 : 0)} detalle="Mediana del último año" />
        ) : (
          <Indicador etiqueta="Días abiertos" valor={medianaAbiertos.toFixed(medianaAbiertos < 10 ? 1 : 0)} detalle="Mediana de los casos abiertos" />
        )}
        <Indicador etiqueta="Montos en trámite" valor={rdCorto(enTramite)} detalle="Estimado de los casos abiertos" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, asegurado, lugar o número de reclamo" className="h-10 pl-9" aria-label="Buscar siniestro" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Estado</span>
          <Filtro activo={!col} onClick={() => setCol("")}>
            Todos
          </Filtro>
          {COLUMNAS.map((c) => (
            <Filtro key={c.id} activo={col === c.id} onClick={() => setCol(col === c.id ? "" : c.id)}>
              {c.nombre}
            </Filtro>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Tipo</span>
          <Filtro activo={!tipo} onClick={() => setTipo("")}>
            Todos
          </Filtro>
          {TIPOS.filter((t) => siniestros.some((s) => s.tipo === t)).map((t) => (
            <Filtro key={t} activo={tipo === t} onClick={() => setTipo(tipo === t ? "" : t)}>
              {PROCEDIMIENTOS[t].nombre}
            </Filtro>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Responsable</span>
          <Filtro activo={!resp} onClick={() => setResp("")}>
            Todos
          </Filtro>
          {responsables.map((r) => (
            <Filtro key={r} activo={resp === r} onClick={() => setResp(resp === r ? "" : r)}>
              {PERSONA[r]?.nombre ?? r}
            </Filtro>
          ))}
        </div>
      </div>

      <div className={cn("grid gap-4", col ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-5")}>
        {columnas.map((c) => {
          const todos = filtrados.filter((s) => c.estados.includes(s.estado))
          const lista = c.id === "final" && !verTodos && !col ? todos.slice(0, MAX_FINAL) : todos
          const tono = TONO_SINIESTRO[c.estados[0]]
          return (
            <section key={c.id} className="flex min-w-0 flex-col gap-2 rounded-xl bg-secondary/50 p-2.5">
              <header className="flex items-center justify-between px-1.5 py-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("h-2 w-2 rounded-full", PUNTO[tono])} aria-hidden />
                  {c.nombre}
                </h3>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">{todos.length}</span>
              </header>
              <div className={cn("flex flex-col gap-2", col && "sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
                {lista.map((s) => (
                  <TarjetaSiniestro key={s.id} s={s} cliente={clientes.get(s.clienteId)} ahora={ahora} />
                ))}
              </div>
              {!todos.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">{ABIERTOS.includes(c.estados[0]) ? "Ningún caso aquí." : "Sin casos."}</p>}
              {todos.length > lista.length && (
                <Button variant="ghost" size="sm" onClick={() => setVerTodos(true)}>
                  Ver {todos.length - lista.length} más
                </Button>
              )}
            </section>
          )
        })}
      </div>
      <NotaEjemplo />
    </div>
  )
}

function TarjetaSiniestro({ s, cliente, ahora }: { s: Siniestro; cliente?: Cliente; ahora: number }) {
  const I = ICONO_TIPO[s.tipo]
  const r = recibidos(s)
  const n = s.documentos.length
  const cerrado = !abierto(s)
  return (
    <Link
      href={`/admin/siniestros/${s.id}`}
      className={cn("flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md", s.lesionados && !cerrado && "border-destructive/40")}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold tabular-nums text-muted-foreground">{s.codigo}</span>
        {s.creadoPor === "ia" && <MarcaIA />}
        <span className="ml-auto text-[11px] text-muted-foreground">{hace(s.reportado, ahora)}</span>
      </div>
      {s.lesionados && !cerrado && (
        <span className="inline-flex items-center gap-1 self-start rounded-md bg-destructive-soft px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Hay lesionados
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{cliente?.nombre ?? "Asegurado"}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <I className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{PROCEDIMIENTOS[s.tipo].nombre}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{s.lugar}</span>
        </p>
      </div>
      {cerrado ? (
        <p className="text-xs">
          <span className="font-medium">{s.resultado ?? "Cerrado"}</span>
          {s.montoResuelto ? <span className="block tabular-nums text-muted-foreground">{rd(s.montoResuelto)}</span> : null}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Documentos</span>
            <span className={cn("font-semibold tabular-nums", r === n ? "text-success" : "text-foreground")}>
              {r} de {n}
            </span>
          </div>
          <Barra valor={n ? r / n : 0} tono={r === n ? "success" : "primary"} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <Persona id={s.responsableId} className="[&>span:last-child]:text-xs" />
        {s.montoEstimado && !cerrado ? <span className="shrink-0 text-xs font-semibold tabular-nums">{rdCorto(s.montoEstimado)}</span> : null}
      </div>
    </Link>
  )
}
