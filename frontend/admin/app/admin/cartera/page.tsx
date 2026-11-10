"use client"

import { useMemo, useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Encabezado, Indicador, NotaEjemplo } from "@/components/seguros/comun"
import { Renovaciones } from "@/components/seguros/cartera/renovaciones"
import { TablaCartera } from "@/components/seguros/cartera/tabla"
import { activa, Cargando, diasPara } from "@/components/seguros/cartera/util"
import { numero, rdCorto } from "@/lib/seguros/catalogo"
import { useSeguros } from "@/lib/seguros/cliente"
import type { Cliente } from "@/lib/seguros/tipos"

export default function CarteraPage() {
  const { estado, ahora } = useSeguros()
  const [pestana, setPestana] = useState("renovaciones")

  const clientes = useMemo(() => new Map<string, Cliente>((estado?.clientes ?? []).map((c) => [c.id, c])), [estado?.clientes])
  const ind = useMemo(() => {
    const vig = (estado?.polizas ?? []).filter(activa)
    const en = (d: number) => vig.filter((p) => diasPara(p.vence, ahora) <= d)
    const r30 = en(30)
    const r60 = en(60)
    const suma = (l: typeof vig) => l.reduce((t, p) => t + p.primaAnual, 0)
    const atrasados = vig.filter((p) => !p.pagoAlDia)
    return {
      vigentes: vig.length,
      asegurados: new Set(vig.map((p) => p.clienteId)).size,
      prima: suma(vig),
      r30,
      r60,
      prima30: suma(r30),
      prima60: suma(r60),
      confirmadas: r30.filter((p) => p.renovacion === "confirmada").length,
      sinAviso: r60.filter((p) => p.renovacion === "sin_iniciar").length,
      atrasados: atrasados.length,
      primaAtrasada: suma(atrasados),
    }
  }, [estado?.polizas, ahora])

  return (
    <AdminLayout title="Cartera y renovaciones">
      {!estado ? (
        <Cargando texto="Cargando la cartera…" />
      ) : (
        <div className="flex flex-col gap-6">
          <Encabezado
            titulo="Cartera y renovaciones"
            detalle={`${numero(ind.vigentes)} pólizas activas de ${numero(ind.asegurados)} asegurados. ${ind.sinAviso ? `${ind.sinAviso} vencen en los próximos 60 días y todavía no tienen aviso de renovación.` : "Todas las que vencen en 60 días ya tienen aviso de renovación."}`}
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Indicador etiqueta="Pólizas vigentes" valor={numero(ind.vigentes)} detalle={`${numero(ind.asegurados)} asegurados`} />
            <Indicador etiqueta="Prima anual en cartera" valor={rdCorto(ind.prima)} detalle="Suma de las pólizas activas" />
            <Indicador etiqueta="Por renovar en 30 días" valor={ind.r30.length} detalle={`${rdCorto(ind.prima30)} en prima`} tono={ind.r30.some((p) => p.renovacion === "sin_iniciar") ? "alerta" : undefined} />
            <Indicador etiqueta="Por renovar en 60 días" valor={ind.r60.length} detalle={`${rdCorto(ind.prima60)} en prima`} />
            <Indicador etiqueta="Renovaciones confirmadas" valor={ind.confirmadas} detalle={`De ${ind.r30.length} que vencen este mes`} tono="bien" />
            <Indicador etiqueta="Pagos atrasados" valor={ind.atrasados} detalle={`${rdCorto(ind.primaAtrasada)} en prima`} tono={ind.atrasados ? "alerta" : undefined} />
          </div>

          <Tabs value={pestana} onValueChange={setPestana} className="flex flex-col gap-2">
            <TabsList>
              <TabsTrigger value="renovaciones">Renovaciones</TabsTrigger>
              <TabsTrigger value="cartera">Cartera</TabsTrigger>
            </TabsList>
            <TabsContent value="renovaciones">
              <Renovaciones polizas={estado.polizas} clientes={clientes} ahora={ahora} />
            </TabsContent>
            <TabsContent value="cartera">
              <TablaCartera polizas={estado.polizas} clientes={clientes} ahora={ahora} />
            </TabsContent>
          </Tabs>

          <NotaEjemplo />
        </div>
      )}
    </AdminLayout>
  )
}
