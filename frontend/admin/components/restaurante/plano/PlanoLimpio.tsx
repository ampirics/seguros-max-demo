"use client"

import { ALTO, ANCHO, AREAS, PUERTA } from "@/lib/restaurante/plano"
import type { Estado, Mesa } from "@/lib/restaurante/tipos"
import { ESTADO_MESA, chipMesa } from "./estados"
import { esCama, tamMesa } from "./rutas"

const E = 10
const VW = ANCHO * E
const VH = ALTO * E

function forma(m: Mesa) {
  if (esCama(m)) return { w: 34, h: 28, rx: 6 }
  const { w, h } = tamMesa(m.capacidad)
  const k = 0.95
  return { w: Math.max(26, w * k), h: Math.max(22, h * k), rx: m.capacidad <= 2 ? 11 : 5 }
}

export default function PlanoLimpio({
  estado,
  ahora,
  seleccion,
  onMesa,
}: {
  estado: Estado
  ahora: number
  seleccion?: string
  onMesa: (id: string) => void
}) {
  const zona = (a: { x: number; y: number; w: number; h: number }) => ({ x: a.x * E, y: a.y * E, width: a.w * E, height: a.h * E })
  const rotulo = (t: string, x: number, y: number) => (
    <text x={x * E} y={y * E} fontSize={11} letterSpacing={1.6} fill="var(--muted-foreground)" style={{ textTransform: "uppercase", fontWeight: 600 }}>
      {t}
    </text>
  )
  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card shadow-sm">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full" role="group" aria-label="Plano de trabajo del salón">
        <defs>
          <pattern id="plano-agua" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 10 Q3.5 7 7 10 T14 10" fill="none" stroke="var(--border)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x={0} y={12 * E} width={VW} height={VH - 12 * E} fill="var(--muted)" />
        <rect x={0} y={12 * E} width={VW} height={VH - 12 * E} fill="url(#plano-agua)" opacity={0.7} />
        <rect {...zona(AREAS.edificio)} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={2} />
        {[AREAS.cocina, AREAS.salon, AREAS.bar].map((a, i) => (
          <rect key={i} {...zona(a)} rx={6} fill="var(--card)" stroke="var(--border)" />
        ))}
        <rect {...zona(AREAS.muelle)} rx={10} fill="var(--card)" stroke="var(--border)" strokeWidth={2} />
        <rect {...zona(AREAS.terraza)} rx={8} fill="var(--background)" stroke="var(--border)" strokeDasharray="6 5" />
        <rect {...zona(AREAS.grama)} rx={6} fill="#6BBF8A" opacity={0.28} />
        <rect {...zona(AREAS.punta)} rx={8} fill="var(--background)" stroke="var(--border)" strokeDasharray="6 5" />
        {rotulo("Cocina", AREAS.cocina.x + 0.8, AREAS.cocina.y + 1.6)}
        {rotulo("Salón privado", AREAS.salon.x + 0.8, AREAS.salon.y + 1.6)}
        {rotulo("Bar y caja", AREAS.bar.x + 0.8, AREAS.bar.y + 1.6)}
        {rotulo("Terraza techada", AREAS.terraza.x + 0.8, AREAS.terraza.y + 1.5)}
        {rotulo("Muelle", AREAS.muelle.x + 0.8, 24.4)}
        {rotulo("Gazebo y camas", AREAS.punta.x + 0.8, AREAS.punta.y + 1.4)}
        <g>
          <rect x={PUERTA.x * E - 22} y={(PUERTA.y + 0.3) * E} width={44} height={12} rx={6} fill="var(--foreground)" opacity={0.85} />
          <text x={PUERTA.x * E} y={(PUERTA.y + 0.3) * E + 9} fontSize={8} textAnchor="middle" fill="var(--background)" style={{ fontWeight: 600, letterSpacing: 1 }}>
            ENTRADA
          </text>
        </g>

        {estado.mesas.map((m) => {
          const f = forma(m)
          const cx = m.x * E
          const cy = m.y * E
          const est = ESTADO_MESA[m.estado]
          const chip = chipMesa(m, estado, ahora)
          const sel = seleccion === m.id
          const ocupada = !["libre", "reservada", "limpieza"].includes(m.estado)
          return (
            <g
              key={m.id}
              role="button"
              tabIndex={0}
              aria-label={`Mesa ${m.nombre}, ${est.nombre}`}
              aria-pressed={sel}
              onClick={() => onMesa(m.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onMesa(m.id)
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[var(--foreground)]"
            >
              <rect
                x={cx - f.w / 2 - 4}
                y={cy - f.h / 2 - 4}
                width={f.w + 8}
                height={f.h + 8}
                rx={f.rx + 3}
                fill="none"
                stroke={sel ? "var(--foreground)" : "transparent"}
                strokeWidth={2}
              />
              <rect x={cx - f.w / 2} y={cy - f.h / 2} width={f.w} height={f.h} rx={f.rx} fill={est.color} fillOpacity={m.estado === "libre" ? 0.22 : 0.9} stroke={est.color} strokeWidth={1.5} />
              <text x={cx} y={cy - 1} textAnchor="middle" fontSize={10} fill={m.estado === "libre" ? "var(--foreground)" : est.texto} style={{ fontWeight: 700 }}>
                {m.nombre.replace("Cama ", "C").replace("Salón ", "S")}
              </text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={8} fill={m.estado === "libre" ? "var(--muted-foreground)" : est.texto} opacity={0.85}>
                {ocupada ? `${m.comensales ?? 0}/${m.capacidad}` : `${m.capacidad} p.`}
              </text>
              {chip && (
                <g>
                  <rect x={cx - 17} y={cy - f.h / 2 - 15} width={34} height={12} rx={6} fill={chip.fondo} stroke="var(--border)" strokeWidth={0.5} />
                  <text x={cx} y={cy - f.h / 2 - 6} textAnchor="middle" fontSize={8} fill="#0B2A2E" style={{ fontWeight: 700 }} className={chip.parpadea ? "motion-safe:animate-pulse" : undefined}>
                    {chip.texto}
                  </text>
                </g>
              )}
              {m.llamado && <circle cx={cx + f.w / 2} cy={cy - f.h / 2} r={4} fill={m.llamado.tipo === "cuenta" ? "#E86A9B" : "#F2C14E"} stroke="var(--card)" strokeWidth={1.5} />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
