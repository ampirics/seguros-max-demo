"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Loader2, RefreshCw } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Barras, CajaTooltip, COLORES, EJE, Kpi, Lectura, minutos, pct, Seccion, Tarjeta, Vacio, ZONA_COLOR, rdCorto } from "@/components/restaurante/metricas/piezas"
import { rd } from "@/lib/restaurante/carta"
import { restauranteApi } from "@/lib/restaurante/cliente"
import { ZONAS } from "@/lib/restaurante/local"
import type { Metricas } from "@/lib/restaurante/servidor/metricas"
import { cn } from "@/lib/utils"

const PERIODOS = [
  { dias: 1, nombre: "Hoy" },
  { dias: 7, nombre: "7 días" },
  { dias: 30, nombre: "30 días" },
  { dias: 60, nombre: "60 días" },
]

const INDICE = [
  ["duracion", "Duración de mesa"],
  ["tramos", "Tramos"],
  ["ventas", "Lo que se vende"],
  ["cocina", "Cocina"],
  ["llegadas", "Cuándo llegan"],
  ["meseros", "Meseros"],
  ["canales", "Canales y reservas"],
] as const

const miles = (n: number) => (n >= 1000000 ? `${(n / 1000000).toFixed(1)} M` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(Math.round(n)))
const diaCorto = (f: string) => new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${f}T12:00:00Z`))

export default function MetricasPage() {
  const [dias, setDias] = useState(30)
  const [zona, setZona] = useState("")
  const [datos, setDatos] = useState<Metricas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")

  const cargar = () => {
    setCargando(true)
    setError("")
    restauranteApi
      .metricas(dias, zona || undefined)
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [dias, zona])

  return (
    <AdminLayout title="Métricas">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 pb-16">
        <header className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-acento">Boca Marina</p>
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Cómo va el restaurante</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Cada visita deja su rastro: cuándo llegó, cuánto tardó en ordenar, qué pidió, cuánto duró la mesa y cómo pagó. De ahí salen estas cifras.
            </p>
          </div>
          <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3">
            <div className="flex rounded-control bg-muted p-0.5" role="group" aria-label="Periodo">
              {PERIODOS.map((p) => (
                <button
                  key={p.dias}
                  onClick={() => setDias(p.dias)}
                  aria-pressed={dias === p.dias}
                  className={cn("rounded-control px-3 py-1.5 text-sm font-medium transition-colors", dias === p.dias ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              aria-label="Zona"
              className="h-9 rounded-control border bg-card px-3 text-sm"
            >
              <option value="">Todas las zonas</option>
              {ZONAS.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={cargar} disabled={cargando} className="ml-auto gap-1.5">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Actualizar
            </Button>
            <nav className="hidden w-full gap-1 overflow-x-auto pt-1 text-xs lg:flex" aria-label="Secciones">
              {INDICE.map(([id, nombre]) => (
                <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {nombre}
                </a>
              ))}
            </nav>
          </div>
        </header>

        {error ? (
          <Vacio texto={`No se pudieron cargar las métricas: ${error}`} />
        ) : !datos ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
            <Skeleton className="h-80 rounded-xl sm:col-span-3 lg:col-span-6" />
          </div>
        ) : datos.resumen.visitas === 0 ? (
          <Vacio texto={dias === 1 ? "Todavía no hay visitas cerradas hoy. Las cifras aparecen cuando la primera mesa paga." : "No hay visitas en este periodo."} />
        ) : (
          <div className={cn("flex flex-col gap-14 transition-opacity", cargando && "opacity-60")}>
            <Resumen m={datos} />
            <Duracion m={datos} />
            <Tramos m={datos} />
            <Ventas m={datos} />
            <Cocina m={datos} />
            <Llegadas m={datos} />
            <Meseros m={datos} />
            <Canales m={datos} />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function Resumen({ m }: { m: Metricas }) {
  const r = m.resumen
  const periodo = m.dias === 1 ? "hoy" : `los últimos ${m.dias} días`
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Ventas" valor={rdCorto(r.ventas)} variacion={r.variacionVentas} detalle={m.dias === 1 ? "contra ayer" : "contra el periodo anterior"} />
        <Kpi titulo="Visitas" valor={r.visitas.toLocaleString("es-DO")} detalle={`${(r.visitas / Math.max(1, m.dias)).toFixed(1)} por día`} />
        <Kpi titulo="Comensales" valor={r.comensales.toLocaleString("es-DO")} detalle={`${(r.comensales / Math.max(1, r.visitas)).toFixed(1)} por mesa`} />
        <Kpi titulo="Ticket por persona" valor={rd(r.ticketPersona)} detalle={`${rd(r.ticketMesa)} por mesa`} />
        <Kpi titulo="Duración de la mesa" valor={minutos(r.duracion)} detalle="de la llegada a la salida" />
        <Kpi titulo="Calificación" valor={r.calificacion ? `${r.calificacion} de 5` : "-"} detalle={`${r.calificaciones} opiniones`} />
      </div>
      <Lectura>
        En {periodo} Boca Marina atendió {r.comensales.toLocaleString("es-DO")} personas en {r.visitas.toLocaleString("es-DO")} mesas y vendió {rd(r.ventas)}
        {r.variacionVentas != null && `, un ${pct(Math.abs(r.variacionVentas))} ${r.variacionVentas >= 0 ? "más" : "menos"} que el periodo anterior`}. Cada
        persona deja en promedio {rd(r.ticketPersona)} antes de impuestos y {rd(r.propinas)} se fueron en propinas.
      </Lectura>
    </section>
  )
}

function Duracion({ m }: { m: Metricas }) {
  const zonas = [...m.porZona].sort((a, b) => b.duracion - a.duracion)
  const terraza = m.porZona.find((z) => z.zona === "terraza")
  const larga = zonas[0]
  const horas = m.porHora.filter((h) => h.llegadas > 0)
  const masLarga = [...m.porDiaSemana].sort((a, b) => b.duracion - a.duracion)[0]
  return (
    <Seccion id="duracion" titulo="Cuánto dura una mesa" descripcion="De que el cliente se sienta a que se levanta. Es lo que decide cuántas veces gira cada mesa en el día.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Por zona">
          <Barras
            filas={zonas.map((z) => ({ etiqueta: z.nombre, valor: z.duracion, color: ZONA_COLOR[z.zona], detalle: `${z.visitas} visitas · ${rd(z.ticketPersona)} por persona` }))}
            formato={minutos}
          />
        </Tarjeta>
        <Tarjeta titulo="Por tamaño del grupo">
          <Barras
            filas={m.porPersonas.map((p) => ({ etiqueta: `${p.etiqueta} ${p.personas === 1 ? "persona" : "personas"}`, valor: p.duracion, detalle: `${p.visitas} visitas · cuenta promedio ${rd(p.ticket)}` }))}
            formato={minutos}
            color={COLORES.mar}
          />
        </Tarjeta>
        <Tarjeta titulo="Por hora de llegada">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={horas} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={EJE} tickLine={false} axisLine={false} unit=" m" />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={({ payload, label }) => (payload?.length ? <CajaTooltip titulo={String(label)} filas={[{ nombre: "Duración", valor: minutos(Number(payload[0].value)) }]} /> : null)} />
                <Bar dataKey="duracion" fill={COLORES.lila} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Por día de la semana">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.porDiaSemana} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} />
                <YAxis tick={EJE} tickLine={false} axisLine={false} unit=" m" />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={({ payload }) => (payload?.length ? <CajaTooltip titulo={String(payload[0].payload.nombre)} filas={[{ nombre: "Duración", valor: minutos(Number(payload[0].value)) }]} /> : null)} />
                <Bar dataKey="duracion" fill={COLORES.coral} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      </div>
      {larga && terraza && larga.zona !== "terraza" ? (
        <Lectura>
          {larga.nombre} retiene la mesa {minutos(larga.duracion - terraza.duracion)} más que la terraza
          {larga.ticketPersona > terraza.ticketPersona ? ` y vende ${pct(Math.round(((larga.ticketPersona - terraza.ticketPersona) / terraza.ticketPersona) * 100))} más por persona` : ""}.
          {masLarga ? ` Los ${masLarga.nombre.toLowerCase()} son los días de sobremesa más larga (${minutos(masLarga.duracion)}).` : ""}
        </Lectura>
      ) : null}
    </Seccion>
  )
}

function Tramos({ m }: { m: Metricas }) {
  const t = m.tramos
  const partes = [
    { nombre: "Llega y ordena", valor: t.aOrdenar, color: COLORES.oro },
    { nombre: "Espera el primer plato", valor: t.primerPlato, color: COLORES.coral },
    { nombre: "Come y conversa", valor: t.comiendo, color: COLORES.mar },
    { nombre: "Pide la cuenta y paga", valor: t.cuentaAPago, color: COLORES.rosa },
    { nombre: "Se levanta", valor: t.salida, color: COLORES.gris },
  ]
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1
  const espera = t.aOrdenar + t.primerPlato
  const lentaZona = [...m.porZona].sort((a, b) => b.aOrdenar - a.aOrdenar)[0]
  return (
    <Seccion id="tramos" titulo="Los tramos de la visita" descripcion="En qué se va el tiempo de una mesa, en promedio.">
      <Tarjeta>
        <div className="flex h-10 w-full overflow-hidden rounded-lg" role="img" aria-label="Duración de cada tramo de la visita">
          {partes.map((p) => (
            <div key={p.nombre} className="h-full" style={{ width: `${(p.valor / total) * 100}%`, background: p.color }} title={`${p.nombre}: ${minutos(p.valor)}`} />
          ))}
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {partes.map((p, i) => (
            <li key={p.nombre} className="flex gap-2.5">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {i + 1}. {p.nombre}
                </p>
                <p className="font-display text-2xl font-semibold tabular-nums">{minutos(p.valor)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>
      <Lectura>
        Desde que se sientan hasta que llega el primer plato pasan {minutos(espera)}: es la espera que el cliente siente. {lentaZona ? `Donde más tardan en tomar la orden es en ${lentaZona.nombre.toLowerCase()} (${minutos(lentaZona.aOrdenar)}).` : ""} Cobrar
        toma {minutos(t.cuentaAPago)} desde que piden la cuenta.
      </Lectura>
    </Seccion>
  )
}

function Ventas({ m }: { m: Metricas }) {
  const vendidos = m.platos.filter((p) => p.cantidad > 0)
  const top = vendidos.slice(0, 8)
  const menos = vendidos.slice(-6).reverse()
  const sinVenta = m.platos.filter((p) => p.cantidad === 0)
  const totalCat = m.categorias.reduce((s, c) => s + c.importe, 0) || 1
  const estrella = top[0]
  const combo = m.combos[0]
  const ultimoTop = m.categorias.slice(0, 2)
  return (
    <Seccion id="ventas" titulo="Lo que se vende" descripcion="Platos por unidades vendidas en el periodo. Los pescados y langostas por libra cuentan una unidad por pedido.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Los más pedidos">
          <ol className="divide-y">
            {top.map((p, i) => (
              <li key={p.platoId} className="flex items-center gap-3 py-2.5">
                <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                {p.foto ? (
                  <img src={`/boca-marina/${p.foto}`} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted font-display text-lg text-muted-foreground">{p.nombre[0]}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.categoria} · en {pct(p.mesasPct)} de las mesas
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums">{p.cantidad.toLocaleString("es-DO")}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{rd(p.importe)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Tarjeta>
        <div className="flex min-w-0 flex-col gap-4">
          <Tarjeta titulo="Ventas por categoría">
            <Barras filas={m.categorias.slice(0, 8).map((c) => ({ etiqueta: c.categoria, valor: c.importe, detalle: `${pct(Math.round((c.importe / totalCat) * 1000) / 10)} de lo vendido` }))} formato={(n) => rd(n)} color={COLORES.mar} />
          </Tarjeta>
          <Tarjeta titulo="Se piden juntos">
            {m.combos.length ? (
              <ul className="space-y-2 text-sm">
                {m.combos.slice(0, 6).map((c) => (
                  <li key={c.a + c.b} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      {c.a} <span className="text-muted-foreground">con</span> {c.b}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{c.veces} mesas</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio texto="Sin combinaciones repetidas en el periodo." />
            )}
          </Tarjeta>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Los que menos salen">
          <ul className="divide-y text-sm">
            {menos.map((p) => (
              <li key={p.platoId} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{p.nombre}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.cantidad} · {rd(p.importe)}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Sin ninguna venta">
          {sinVenta.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {sinVenta.map((p) => (
                <li key={p.platoId} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                  {p.nombre}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Todos los platos de la carta se vendieron al menos una vez.</p>
          )}
        </Tarjeta>
      </div>
      {estrella && (
        <Lectura>
          {estrella.nombre} es el plato estrella: sale en {pct(estrella.mesasPct)} de las mesas y dejó {rd(estrella.importe)}.
          {combo ? ` ${combo.a} y ${combo.b} van juntos en ${combo.veces} mesas: buen candidato para un combo.` : ""}
          {ultimoTop.length === 2 ? ` ${ultimoTop[0].categoria} y ${ultimoTop[1].categoria} hacen ${pct(Math.round(((ultimoTop[0].importe + ultimoTop[1].importe) / totalCat) * 100))} de las ventas.` : ""}
          {menos[0] ? ` ${menos[0].nombre} casi no sale: vale la pena revisar si sigue en la carta.` : ""}
        </Lectura>
      )}
    </Seccion>
  )
}

function Cocina({ m }: { m: Metricas }) {
  const lentos = m.platos
    .filter((p) => p.cantidad >= 5 && p.cocina > 0)
    .map((p) => ({ ...p, exceso: p.cocina - p.objetivo }))
    .sort((a, b) => b.exceso - a.exceso)
    .slice(0, 6)
  const peor = [...m.estaciones].sort((a, b) => b.fueraDeTiempo - a.fueraDeTiempo)[0]
  const horaPico = [...m.porHora].sort((a, b) => b.cocina - a.cocina)[0]
  return (
    <Seccion id="cocina" titulo="Cocina" descripcion="Minutos desde que la orden llega a cocina hasta que el plato está listo. Fuera de tiempo es cuando pasa 30 % del tiempo de la carta.">
      <div className="grid gap-3 sm:grid-cols-3">
        {m.estaciones.map((e) => (
          <div key={e.estacion} className="rounded-xl border bg-card px-4 py-3.5">
            <p className="text-xs font-medium text-muted-foreground">{e.nombre}</p>
            <p className="mt-1 font-display text-[1.9rem] font-semibold leading-none tabular-nums">{minutos(e.minutos)}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {e.platos.toLocaleString("es-DO")} platos ·{" "}
              <span className={cn("font-medium", e.fueraDeTiempo > 30 ? "text-destructive" : "text-success")}>{pct(e.fueraDeTiempo)} fuera de tiempo</span>
            </p>
          </div>
        ))}
      </div>
      <Tarjeta titulo="Platos que más se pasan de su tiempo" accion={<span className="text-xs text-muted-foreground">La raya marca el tiempo de la carta</span>}>
        {lentos.length ? (
          <Barras
            filas={lentos.map((p) => ({ etiqueta: p.nombre, valor: p.cocina, marca: p.objetivo, color: p.exceso > p.objetivo * 0.3 ? COLORES.coral : COLORES.mar, detalle: `Objetivo ${minutos(p.objetivo)} · ${p.exceso > 0 ? `${minutos(p.exceso)} de más` : "a tiempo"}` }))}
            formato={minutos}
          />
        ) : (
          <Vacio texto="No hay suficientes platos para comparar." />
        )}
      </Tarjeta>
      {peor && (
        <Lectura>
          {peor.nombre} entrega {pct(peor.fueraDeTiempo)} de sus platos fuera de tiempo.
          {lentos[0] ? ` El que más se atrasa es ${lentos[0].nombre}: ${minutos(lentos[0].cocina)} contra ${minutos(lentos[0].objetivo)} de la carta.` : ""}
          {horaPico ? ` La cocina va más lenta a las ${horaPico.etiqueta} (${minutos(horaPico.cocina)} por plato).` : ""}
        </Lectura>
      )}
    </Seccion>
  )
}

function Llegadas({ m }: { m: Metricas }) {
  const horas = m.porHora
  const pico = [...horas].sort((a, b) => b.llegadas - a.llegadas)[0]
  const mejorDia = [...m.porDiaSemana].sort((a, b) => b.ventas - a.ventas)[0]
  const peorDia = [...m.porDiaSemana].sort((a, b) => a.ventas - b.ventas)[0]
  return (
    <Seccion id="llegadas" titulo="Cuándo llega la gente" descripcion="Promedio por día del periodo. Sirve para armar turnos y preparar compras de frescos.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Llegadas y ventas por hora">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={horas} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="l" tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="v" orientation="right" hide />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ payload, label }) =>
                    payload?.length ? (
                      <CajaTooltip
                        titulo={String(label)}
                        filas={[
                          { nombre: "Mesas que llegan", valor: String(payload[0].payload.llegadas), color: COLORES.mar },
                          { nombre: "Ventas", valor: rd(payload[0].payload.ventas), color: COLORES.coral },
                        ]}
                      />
                    ) : null
                  }
                />
                <Bar yAxisId="l" dataKey="llegadas" fill={COLORES.mar} radius={[4, 4, 0, 0]} />
                <Line yAxisId="v" dataKey="ventas" stroke={COLORES.coral} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Ventas promedio por día de la semana">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.porDiaSemana} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} />
                <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={miles} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ payload }) =>
                    payload?.length ? (
                      <CajaTooltip titulo={payload[0].payload.nombre} filas={[{ nombre: "Ventas", valor: rd(Number(payload[0].value)) }, { nombre: "Visitas", valor: String(payload[0].payload.visitas) }]} />
                    ) : null
                  }
                />
                <Bar dataKey="ventas" fill={COLORES.oro} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      </div>
      {m.dias > 1 && (
        <Tarjeta titulo="Ventas por día">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.serie} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
                <defs>
                  <linearGradient id="relleno-ventas" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={COLORES.mar} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={COLORES.mar} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="fecha" tick={EJE} tickLine={false} axisLine={false} tickFormatter={diaCorto} minTickGap={24} />
                <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={miles} />
                <Tooltip content={({ payload }) => (payload?.length ? <CajaTooltip titulo={diaCorto(payload[0].payload.fecha)} filas={[{ nombre: "Ventas", valor: rd(Number(payload[0].value)) }, { nombre: "Visitas", valor: String(payload[0].payload.visitas) }]} /> : null)} />
                <Area dataKey="ventas" stroke={COLORES.mar} strokeWidth={2} fill="url(#relleno-ventas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      )}
      {pico && mejorDia && peorDia && (
        <Lectura>
          La hora de más llegadas es a las {pico.etiqueta}, con {pico.llegadas} mesas por día. {mejorDia.nombre} vende {rd(mejorDia.ventas)} en promedio, {Math.round(mejorDia.ventas / Math.max(1, peorDia.ventas) * 10) / 10} veces lo de un {peorDia.nombre.toLowerCase()}: conviene reforzar meseros y compras de frescos para el fin de semana.
        </Lectura>
      )}
    </Seccion>
  )
}

function Meseros({ m }: { m: Metricas }) {
  const equipo = [...m.equipo].sort((a, b) => b.ventas - a.ventas)
  const rapido = [...m.equipo].filter((e) => e.esperaLlamado).sort((a, b) => a.esperaLlamado - b.esperaLlamado)[0]
  const lento = [...m.equipo].filter((e) => e.esperaLlamado).sort((a, b) => b.esperaLlamado - a.esperaLlamado)[0]
  return (
    <Seccion id="meseros" titulo="Meseros" descripcion="Lo que atendió cada persona del salón en el periodo.">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Mesero</th>
              <th className="px-3 py-3 text-right font-medium">Mesas</th>
              <th className="px-3 py-3 text-right font-medium">Ventas</th>
              <th className="px-3 py-3 text-right font-medium">Cuenta promedio</th>
              <th className="px-3 py-3 text-right font-medium">Propinas</th>
              <th className="px-3 py-3 text-right font-medium">Hasta ordenar</th>
              <th className="px-3 py-3 text-right font-medium">Respuesta a llamados</th>
              <th className="px-4 py-3 text-right font-medium">Calificación</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {equipo.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                    {e.nombre}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">{e.mesas}</td>
                <td className="px-3 py-3 text-right">{rd(e.ventas)}</td>
                <td className="px-3 py-3 text-right">{rd(e.ticket)}</td>
                <td className="px-3 py-3 text-right">{rd(e.propinas)}</td>
                <td className="px-3 py-3 text-right">{minutos(e.aOrdenar)}</td>
                <td className={cn("px-3 py-3 text-right", e.esperaLlamado > 100 && "font-medium text-destructive")}>{e.esperaLlamado ? `${e.esperaLlamado} s` : "-"}</td>
                <td className="px-4 py-3 text-right">{e.calificacion || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rapido && lento && rapido.id !== lento.id && (
        <Lectura>
          {rapido.nombre} responde un llamado del QR en {rapido.esperaLlamado} segundos; {lento.nombre} tarda {lento.esperaLlamado}. {equipo[0].nombre} es quien más vende ({rd(equipo[0].ventas)}).
        </Lectura>
      )}
    </Seccion>
  )
}

function Canales({ m }: { m: Metricas }) {
  const r = m.reservas
  const total = m.canales.reduce((s, c) => s + c.visitas, 0) || 1
  const digitales = m.canales.filter((c) => c.canal !== "presencial").reduce((s, c) => s + c.visitas, 0)
  return (
    <Seccion id="canales" titulo="Canales y reservas" descripcion="Por dónde llegan los clientes y qué pasa con las reservas.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Reservas" valor={r.total.toLocaleString("es-DO")} detalle={`${pct(r.conReserva)} de las mesas llegan con reserva`} />
        <Kpi titulo="No se presentan" valor={pct(r.noShow)} detalle={`${pct(r.noShowSinRespuesta)} si no responden el recordatorio`} invertir />
        <Kpi titulo="Responden el recordatorio" valor={pct(r.respondenRecordatorio)} detalle="confirman por WhatsApp" />
        <Kpi titulo="Cancelan" valor={pct(r.cancelacion)} detalle={`reservan con ${Math.round(r.anticipacionHoras)} h de anticipación`} invertir />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Visitas por canal de origen">
          <Barras filas={m.canales.map((c) => ({ etiqueta: c.nombre, valor: c.visitas, detalle: `${pct(Math.round((c.visitas / total) * 1000) / 10)} · ${rd(c.ventas)}` }))} formato={(n) => n.toLocaleString("es-DO")} color={COLORES.lila} />
        </Tarjeta>
        <Tarjeta titulo="Reservas por canal">
          <ul className="divide-y text-sm">
            {r.porCanal.map((c) => (
              <li key={c.canal} className="flex items-baseline justify-between gap-3 py-2.5">
                <span>{c.nombre}</span>
                <span className="tabular-nums text-muted-foreground">
                  {c.reservas} reservas · <span className={cn(c.noShow > 6 && "font-medium text-destructive")}>{pct(c.noShow)} no-show</span>
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <Lectura>
        {pct(Math.round((digitales / total) * 100))} de las mesas llegaron por un canal digital o por teléfono. Quien no responde el recordatorio falla {Math.round((r.noShowSinRespuesta / Math.max(0.1, r.noShow)) * 10) / 10} veces más que el promedio: a esas reservas conviene llamarlas o liberar la mesa a tiempo.{" "}
        <Link href="/admin/reservaciones" className="font-medium text-primary underline-offset-2 hover:underline">
          Ver las reservas
        </Link>
      </Lectura>
    </Seccion>
  )
}
