"use client"

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { rd, rdCorto } from "@/lib/seguros/catalogo"

export interface Barra {
  id: string
  nombre: string
  prima: number
  polizas: number
}

export function BarrasPrima({ datos, activo, onElegir }: { datos: Barra[]; activo?: string; onElegir: (id: string) => void }) {
  const alto = Math.max(120, datos.length * 34 + 8)
  if (!datos.length) return <p className="py-8 text-center text-sm text-muted-foreground">Sin pólizas con esos filtros.</p>
  return (
    <div style={{ height: alto }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="nombre" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <Tooltip
            cursor={{ fill: "var(--secondary)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as Barra
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold">{d.nombre}</p>
                  <p className="tabular-nums">{rd(d.prima)} en prima anual</p>
                  <p className="text-muted-foreground">
                    {d.polizas} {d.polizas === 1 ? "póliza" : "pólizas"}
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="prima" radius={[0, 6, 6, 0]} onClick={(d) => onElegir((d as unknown as Barra).id)} className="cursor-pointer">
            {datos.map((d) => (
              <Cell key={d.id} fill={!activo || activo === d.id ? "var(--primary)" : "color-mix(in oklab, var(--primary) 25%, transparent)"} />
            ))}
            <LabelList dataKey="prima" position="right" formatter={(v: number) => rdCorto(v)} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
