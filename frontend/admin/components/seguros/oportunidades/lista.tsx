"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ASEGURADORA, fechaCorta, NOMBRE_ORIGEN, rd } from "@/lib/seguros/catalogo"
import type { Cliente, Oportunidad } from "@/lib/seguros/tipos"
import { EsEmpresa, EtapaChip, Persona, PrioridadPunto, Ramo } from "@/components/seguros/comun"
import { cn } from "@/lib/utils"
import { MarcaIA, Puntuacion } from "./tablero"
import { primaPotencial, vencida } from "./util"

export function ListaOportunidades({ lista, clientes, ahora }: { lista: Oportunidad[]; clientes: Map<string, Cliente>; ahora: number }) {
  const router = useRouter()
  const filas = [...lista].sort((a, b) => b.actualizada - a.actualizada)
  if (!filas.length) return <p className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">Ninguna oportunidad cumple esos filtros.</p>
  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {filas.slice(0, 120).map((o) => {
          const prima = o.primaGanada ?? primaPotencial(o)
          return (
            <li key={o.id}>
              <Link href={`/admin/oportunidades/${o.id}`} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <PrioridadPunto prioridad={o.prioridad} />
                    <span className="font-mono text-[11px] text-muted-foreground">{o.codigo}</span>
                    {o.creadaPor === "ia" && <MarcaIA />}
                  </span>
                  <EtapaChip etapa={o.etapa} />
                </div>
                <p className="truncate text-sm font-semibold">{clientes.get(o.clienteId)?.nombre ?? "Cliente"}</p>
                <div className="flex items-center justify-between gap-2">
                  <Ramo ramo={o.ramo} />
                  {prima > 0 && <span className="text-xs font-semibold tabular-nums">{rd(prima)}</span>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card text-left text-xs text-muted-foreground shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Oportunidad</th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Etapa</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Origen</th>
                <th className="px-3 py-3 font-medium">Ejecutivo</th>
                <th className="hidden px-3 py-3 font-medium xl:table-cell">Puntuación</th>
                <th className="px-3 py-3 text-right font-medium">Prima</th>
                <th className="px-4 py-3 text-right font-medium">Actualizada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map((o) => {
                const c = clientes.get(o.clienteId)
                const prima = o.primaGanada ?? primaPotencial(o)
                return (
                  <tr key={o.id} onClick={() => router.push(`/admin/oportunidades/${o.id}`)} className="cursor-pointer transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/oportunidades/${o.id}`} className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="flex items-center gap-1.5">
                          <PrioridadPunto prioridad={o.prioridad} />
                          <span className="font-mono text-xs font-medium">{o.codigo}</span>
                          {o.creadaPor === "ia" && <MarcaIA />}
                        </span>
                        <Ramo ramo={o.ramo} />
                      </Link>
                    </td>
                    <td className="max-w-[16rem] px-3 py-3">
                      <span className="flex items-center gap-1.5 truncate font-medium">
                        <span className="truncate">{c?.nombre ?? "Cliente"}</span>
                        <EsEmpresa si={o.segmento === "empresa"} />
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{o.resumen.split(": ").slice(1).join(": ") || o.resumen}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <EtapaChip etapa={o.etapa} />
                        {o.etapa === "perdida" && o.motivoPerdida && <span className="line-clamp-1 text-[11px] text-muted-foreground">{o.motivoPerdida}</span>}
                        {o.etapa === "ganada" && o.elegida && <span className="text-[11px] text-muted-foreground">{ASEGURADORA[o.elegida]?.corto}</span>}
                        {vencida(o, ahora) && <span className="text-[11px] font-medium text-destructive">Seguimiento vencido</span>}
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">{NOMBRE_ORIGEN[o.origen]}</td>
                    <td className="px-3 py-3">
                      <Persona id={o.ejecutivoId} className="max-w-[10rem]" />
                    </td>
                    <td className="hidden px-3 py-3 xl:table-cell">
                      <Puntuacion valor={o.puntuacion} />
                    </td>
                    <td className={cn("whitespace-nowrap px-3 py-3 text-right tabular-nums", o.etapa === "ganada" && "font-semibold text-success")}>{prima > 0 ? rd(prima) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground">{fechaCorta(o.actualizada)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
