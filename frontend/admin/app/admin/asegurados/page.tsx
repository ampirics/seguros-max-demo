"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, Encabezado, Filtro, ICONO_RAMO, Indicador, NotaEjemplo, Persona } from "@/components/seguros/comun"
import { NOMBRE_SUCURSAL, RAMO, SUCURSALES, numero, rdCorto } from "@/lib/seguros/catalogo"
import { useSeguros } from "@/lib/seguros/cliente"
import type { Segmento, Sucursal } from "@/lib/seguros/tipos"

const POR_PAGINA = 40

export default function AseguradosPage() {
  const { estado } = useSeguros()
  const [q, setQ] = useState("")
  const [segmento, setSegmento] = useState<Segmento | null>(null)
  const [tipo, setTipo] = useState<"asegurados" | "prospectos">("asegurados")
  const [sucursal, setSucursal] = useState<Sucursal | null>(null)
  const [cuantos, setCuantos] = useState(POR_PAGINA)

  const filas = useMemo(() => {
    if (!estado) return []
    const pols = new Map<string, typeof estado.polizas>()
    for (const p of estado.polizas) if (p.estado === "vigente" || p.estado === "por_renovar") pols.set(p.clienteId, [...(pols.get(p.clienteId) ?? []), p])
    const sinAbiertos = new Set(estado.siniestros.filter((s) => !["resuelto", "cerrado"].includes(s.estado)).map((s) => s.clienteId))
    const opAbiertas = new Set(estado.oportunidades.filter((o) => !["ganada", "perdida"].includes(o.etapa)).map((o) => o.clienteId))
    return estado.clientes
      .map((c) => {
        const l = pols.get(c.id) ?? []
        return { c, polizas: l, prima: l.reduce((t, p) => t + p.primaAnual, 0), renovar: l.some((p) => p.estado === "por_renovar"), siniestro: sinAbiertos.has(c.id), oportunidad: opAbiertas.has(c.id) }
      })
      .filter((f) => (tipo === "asegurados" ? f.polizas.length > 0 : f.polizas.length === 0 && f.oportunidad))
  }, [estado, tipo])

  const lista = filas
    .filter((f) => (!segmento || f.c.segmento === segmento) && (!sucursal || f.c.sucursal === sucursal) && (!q || `${f.c.nombre} ${f.c.documento} ${f.c.telefono} ${f.c.contacto ?? ""}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.prima - a.prima || a.c.nombre.localeCompare(b.c.nombre))

  const empresas = filas.filter((f) => f.c.segmento === "empresa")
  return (
    <AdminLayout title="Asegurados">
      <div className="flex flex-col gap-5">
        <Encabezado titulo="Asegurados" detalle="Personas y empresas con su cartera, sus solicitudes y sus siniestros. Cada ficha muestra el recorrido completo, desde la primera conversación." />
        {!estado ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador etiqueta={tipo === "asegurados" ? "Asegurados con póliza vigente" : "Prospectos con solicitud abierta"} valor={numero(filas.length)} />
              <Indicador etiqueta="Empresas" valor={numero(empresas.length)} detalle={tipo === "asegurados" ? `${rdCorto(empresas.reduce((t, f) => t + f.prima, 0))} de prima anual` : undefined} />
              <Indicador etiqueta="Con póliza por renovar" valor={numero(filas.filter((f) => f.renovar).length)} href="/admin/cartera" />
              <Indicador etiqueta="Con siniestro abierto" valor={numero(filas.filter((f) => f.siniestro).length)} href="/admin/siniestros" />
            </div>

            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={q} onChange={(e) => { setQ(e.target.value); setCuantos(POR_PAGINA) }} placeholder="Buscar por nombre, cédula, RNC o teléfono" className="h-11 pl-9" aria-label="Buscar asegurado" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Filtro activo={tipo === "asegurados"} onClick={() => setTipo("asegurados")}>Asegurados</Filtro>
                <Filtro activo={tipo === "prospectos"} onClick={() => setTipo("prospectos")}>Prospectos</Filtro>
                <span className="mx-1 h-5 w-px bg-border" />
                <Filtro activo={!segmento} onClick={() => setSegmento(null)}>Todos</Filtro>
                <Filtro activo={segmento === "persona"} onClick={() => setSegmento("persona")}>Personas</Filtro>
                <Filtro activo={segmento === "empresa"} onClick={() => setSegmento("empresa")}>Empresas</Filtro>
                <span className="mx-1 h-5 w-px bg-border" />
                {SUCURSALES.map((s) => (
                  <Filtro key={s.id} activo={sucursal === s.id} onClick={() => setSucursal(sucursal === s.id ? null : s.id)}>{s.nombre}</Filtro>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              <ul className="divide-y">
                {lista.slice(0, cuantos).map(({ c, polizas, prima, renovar, siniestro, oportunidad }) => (
                  <li key={c.id}>
                    <Link href={`/admin/asegurados/${c.id}`} className="flex flex-col gap-2 p-4 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{c.nombre.split(" ").slice(0, 2).map((x) => x[0]).join("")}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.nombre}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.segmento === "empresa" ? `${c.sector} · ${c.contacto}` : c.ciudad} · {NOMBRE_SUCURSAL[c.sucursal]}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 sm:w-56">
                        {Array.from(new Set(polizas.map((p) => p.ramo))).map((r) => {
                          const I = ICONO_RAMO[r]
                          return <span key={r} title={RAMO[r].nombre} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary"><I className="h-3.5 w-3.5 text-primary" aria-label={RAMO[r].nombre} /></span>
                        })}
                        {renovar && <Chip tono="ambar">Por renovar</Chip>}
                        {siniestro && <Chip tono="rojo">Siniestro</Chip>}
                        {oportunidad && <Chip tono="info">Solicitud</Chip>}
                      </span>
                      <span className="flex items-center justify-between gap-4 sm:w-64">
                        <Persona id={c.ejecutivoId} className="min-w-0" />
                        <span className="text-right">
                          <span className="block font-display text-base font-bold tabular-nums">{prima ? rdCorto(prima) : "Sin póliza"}</span>
                          <span className="block text-[11px] text-muted-foreground">{polizas.length} {polizas.length === 1 ? "póliza" : "pólizas"}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {!lista.length && <li className="p-6 text-center text-sm text-muted-foreground">No hay asegurados con esos filtros.</li>}
              </ul>
              {lista.length > cuantos && (
                <button type="button" onClick={() => setCuantos(cuantos + POR_PAGINA)} className="w-full border-t p-3 text-sm font-medium text-primary hover:bg-accent/40">
                  Ver más ({lista.length - cuantos})
                </button>
              )}
            </div>
            <NotaEjemplo />
          </>
        )}
      </div>
    </AdminLayout>
  )
}
