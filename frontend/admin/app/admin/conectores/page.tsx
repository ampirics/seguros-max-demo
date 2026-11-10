"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { ArrowUpRight, CheckCircle2, CircleDashed, Loader2, Mail, PlugZap, Send, XCircle } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { inventarioApi, type EstadoSap } from "@/lib/api/inventario"
import { odooApi, type EstadoOdoo, type QueOdoo } from "@/lib/api/odoo"
import { cn } from "@/lib/utils"
import { useVertical } from "@/lib/vertical"

type Estado = "conectado" | "configurado" | "sin_configurar" | "error"

const ESTADO: Record<Estado, { texto: string; clase: string; icono: typeof CheckCircle2 }> = {
  conectado: { texto: "Conectado", clase: "bg-success-soft text-success", icono: CheckCircle2 },
  configurado: { texto: "Configurado", clase: "bg-secondary text-foreground", icono: CircleDashed },
  sin_configurar: { texto: "Sin configurar", clase: "bg-secondary text-muted-foreground", icono: CircleDashed },
  error: { texto: "Con error", clase: "bg-destructive-soft text-destructive", icono: XCircle },
}

const EXPORTAR: { que: QueOdoo; texto: string }[] = [
  { que: "productos", texto: "Productos" },
  { que: "clientes", texto: "Clientes" },
  { que: "ordenes", texto: "Órdenes" },
  { que: "pagos", texto: "Pagos" },
]

function Fuente({ nombre, estado, datos, children }: { nombre: string; estado: Estado; datos: string; children?: React.ReactNode }) {
  const e = ESTADO[estado]
  return (
    <section className="rounded-lg border bg-card p-5" aria-label={nombre}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{nombre}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{datos}</p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", e.clase)}>
          <e.icono className="h-3.5 w-3.5" aria-hidden /> {e.texto}
        </span>
      </div>
      {children && <div className="mt-4 space-y-3 border-t pt-4 text-sm">{children}</div>}
    </section>
  )
}

type EstadoGoogle = { configurado: boolean; conectado: boolean; correo: string | null; desde: number | null; redireccion: string }

function ConectorGoogle() {
  const [g, setG] = useState<EstadoGoogle | null>(null)
  const cargar = () => fetch("/srv/restaurante/google").then((r) => r.json()).then(setG).catch(() => setG(null))
  useEffect(() => {
    cargar()
    const q = new URLSearchParams(window.location.search)
    const r = q.get("google")
    if (r === "conectado") toast.success("Google quedó conectado: los correos y el calendario de las reservas salen desde esa cuenta")
    if (r === "cancelado") toast.error("No se conectó Google")
    if (r === "error") toast.error(`Google no se conectó: ${q.get("detalle") ?? "error desconocido"}`)
    if (r) window.history.replaceState(null, "", window.location.pathname)
  }, [])
  const quitar = async () => {
    await fetch("/srv/restaurante/google", { method: "DELETE" })
    toast.success("Google desconectado")
    cargar()
  }
  const estado: Estado = !g?.configurado ? "sin_configurar" : g.conectado ? "conectado" : "configurado"
  return (
    <Fuente nombre="Google: Gmail y Calendar" estado={estado} datos="Los correos de las reservas (confirmación con los PDF, recordatorio, cambio y cancelación) salen desde esta cuenta de Gmail, y cada reserva queda en su Google Calendar con la invitación al cliente.">
      {!g ? (
        <Skeleton className="h-9 w-48" />
      ) : !g.configurado ? (
        <p className="text-muted-foreground">Falta GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en el servidor.</p>
      ) : g.conectado ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden /> <span className="font-medium">{g.correo}</span>
            {g.desde && <span className="text-muted-foreground">desde {new Date(g.desde).toLocaleDateString("es-DO")}</span>}
          </p>
          <Button variant="ghost" size="sm" onClick={quitar}>Desconectar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button asChild className="w-fit gap-2">
            <a href="/srv/restaurante/google/conectar?volver=/admin/conectores"><Mail className="h-4 w-4" aria-hidden /> Conectar con Google</a>
          </Button>
          <p className="text-xs text-muted-foreground">Google pide entrar con la cuenta y aceptar enviar correos y crear eventos. Mientras no se conecte, los correos quedan en vista previa en la ficha de cada reserva.</p>
        </div>
      )}
    </Fuente>
  )
}

function ConectorWhatsApp() {
  const [w, setW] = useState<{ listo: boolean; webhook: string } | null>(null)
  useEffect(() => {
    fetch("/srv/restaurante/whatsapp-estado").then((r) => r.json()).then(setW).catch(() => setW(null))
  }, [])
  return (
    <Fuente nombre="WhatsApp (Meta)" estado={w?.listo ? "configurado" : "sin_configurar"} datos="Los clientes escriben al número de WhatsApp y la IA responde por ahí mismo, con los PDF y las fotos. Mientras no esté, se prueba con el simulador.">
      {!w ? (
        <Skeleton className="h-9 w-48" />
      ) : w.listo ? (
        <p className="text-muted-foreground">
          Webhook para Meta: <span className="font-mono text-foreground">{w.webhook}</span>
        </p>
      ) : (
        <p className="text-muted-foreground">Falta en el servidor WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_APP_SECRET. Mientras tanto: <a className="underline" href="/simulador">simulador</a>.</p>
      )}
    </Fuente>
  )
}

export default function ConectoresPage() {
  const restaurante = useVertical() === "restaurante"
  const [sap, setSap] = useState<EstadoSap | null>(null)
  const [odoo, setOdoo] = useState<EstadoOdoo | null>(null)
  const [error, setError] = useState(false)
  const [prueba, setPrueba] = useState<{ ok: boolean; detalle: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [enviados, setEnviados] = useState<Partial<Record<QueOdoo, string>>>({})

  useEffect(() => {
    Promise.all([inventarioApi.sap().catch(() => null), odooApi.estado()])
      .then(([s, o]) => { setSap(s); setOdoo(o) })
      .catch(() => setError(true))
  }, [])

  const probar = async () => {
    setOcupado("probar")
    try {
      const r = await odooApi.probar()
      setPrueba({ ok: true, detalle: `Respondió y entró como usuario ${r.uid}.` })
    } catch (e: any) {
      setPrueba({ ok: false, detalle: e?.message || "Odoo no respondió." })
    } finally {
      setOcupado(null)
    }
  }

  const exportar = async (que: QueOdoo, texto: string) => {
    setOcupado(que)
    try {
      const r = await odooApi.exportar(que)
      const resumen = [`${r.creados} nuevos`, r.actualizados != null && `${r.actualizados} actualizados`, r.omitidas != null && `${r.omitidas} ya estaban`].filter(Boolean).join(", ")
      setEnviados((x) => ({ ...x, [que]: resumen }))
      toast.success(`${texto} enviados a Odoo: ${resumen}`)
    } catch (e: any) {
      toast.error(e?.message || `No se pudieron enviar ${texto.toLowerCase()} a Odoo`)
    } finally {
      setOcupado(null)
    }
  }

  const estadoOdoo: Estado = !odoo?.configurado ? "sin_configurar" : prueba ? (prueba.ok ? "conectado" : "error") : "configurado"

  return (
    <AdminLayout title="Conectores">
      <div className="flex max-w-3xl flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {restaurante
            ? "De dónde salen la carta, las mesas, las reservas y los clientes que usan el panel y el asistente. Las claves de cada sistema se guardan en el servidor; aquí no se piden ni se muestran."
            : "De dónde salen los productos, las existencias y los clientes que usan el panel y el asistente. Las claves de cada sistema se guardan en el servidor; aquí no se piden ni se muestran."}
        </p>

        {error ? (
          <p className="rounded-md bg-destructive-soft px-4 py-3 text-sm text-destructive" role="alert">No se pudo cargar el estado de los conectores.</p>
        ) : !odoo ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : (
          <>
            {restaurante ? (
              <>
                <Fuente nombre="Boca Marina (este sistema)" estado="conectado" datos="Carta, mesas, órdenes, reservas, clientes, conversaciones y visitas. Es el sistema de registro del restaurante." />
                <ConectorGoogle />
                <ConectorWhatsApp />
              </>
            ) : (
              <Fuente nombre="Trama" estado="conectado" datos="Productos, existencias por sucursal, clientes, oportunidades, cotizaciones y citas. Es el sistema de registro de la demo." />
            )}

            {!restaurante && <Fuente nombre="SAP Business One" estado={sap?.conexion ? "conectado" : "sin_configurar"} datos="Existencias, precios y clientes. Solo lectura: el panel nunca escribe en SAP.">
              <p className="text-muted-foreground">{sap?.conexion ? `Última sincronización: ${sap.ultima_ejecucion ? new Date(sap.ultima_ejecucion).toLocaleString("es-DO") : "todavía no"}.` : sap?.mensaje ?? "Sin conexión configurada."}</p>
            </Fuente>}

            <Fuente nombre="Odoo" estado={estadoOdoo} datos={restaurante ? "Contabilidad y CRM. Recibe los platos de la carta, los clientes, las órdenes cerradas y los pagos del restaurante." : "Contabilidad y CRM para negocios medianos y grandes. Recibe productos, clientes, órdenes y pagos de Trama."}>
              {!odoo.configurado ? (
                <p className="text-muted-foreground">Falta configurar en el servidor la dirección, la base, el usuario y la clave API de Odoo (ODOO_URL, ODOO_DB, ODOO_USUARIO, ODOO_CLAVE).</p>
              ) : (
                <>
                  <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div className="flex justify-between gap-3 sm:block"><dt className="text-muted-foreground">Dirección</dt><dd className="font-medium">{odoo.url}</dd></div>
                    <div className="flex justify-between gap-3 sm:block"><dt className="text-muted-foreground">Base</dt><dd className="font-medium">{odoo.base}</dd></div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={probar} disabled={!!ocupado}>
                      {ocupado === "probar" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PlugZap className="h-4 w-4" aria-hidden />}
                      Probar conexión
                    </Button>
                    {odoo.url && (
                      <Button asChild variant="ghost" size="sm" className="gap-1.5">
                        <a href={`${odoo.url}/odoo/crm`} target="_blank" rel="noreferrer">Abrir Odoo <ArrowUpRight className="h-4 w-4" aria-hidden /></a>
                      </Button>
                    )}
                  </div>
                  {prueba && (
                    <p className={cn("rounded-md px-3 py-2", prueba.ok ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")} role="status">{prueba.detalle}</p>
                  )}
                  <div>
                    <h3 className="mb-2 font-medium">Enviar a Odoo</h3>
                    <p className="mb-3 text-muted-foreground">Repetir un envío no duplica: Odoo busca primero por SKU, referencia del cliente o número de orden.</p>
                    <ul className="divide-y rounded-md border">
                      {EXPORTAR.map((x) => (
                        <li key={x.que} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0">
                            <span className="block font-medium">{x.texto}</span>
                            {enviados[x.que] && <span className="block text-xs text-muted-foreground">{enviados[x.que]}</span>}
                          </span>
                          <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => exportar(x.que, x.texto)} disabled={!!ocupado}>
                            {ocupado === x.que ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
                            Enviar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </Fuente>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
