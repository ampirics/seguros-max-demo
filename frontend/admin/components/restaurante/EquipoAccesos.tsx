"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { KeyRound, Plus, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api-client"
import { allowedSections } from "@/lib/permissions"
import { cn } from "@/lib/utils"

type Usuario = { id: string; name: string; email: string; role: string; perfil?: string; secciones?: string[]; is_active?: boolean }

const GRUPOS: { grupo: string; secciones: [string, string][] }[] = [
  { grupo: "General", secciones: [["/admin", "Inicio"], ["/admin/chat", "Bandeja"], ["/admin/dashboard", "Asistente"]] },
  {
    grupo: "Restaurante",
    secciones: [["/admin/salon", "Salón en vivo"], ["/admin/llegadas", "Llegadas"], ["/admin/reservaciones", "Reservas"], ["/admin/ordenes", "Órdenes"], ["/admin/cocina", "Cocina"], ["/admin/carta", "Carta"], ["/admin/clientes", "Clientes"], ["/admin/metricas", "Métricas"]],
  },
  { grupo: "Administración", secciones: [["/admin/caja", "Caja"], ["/admin/inventario", "Inventario"], ["/admin/compras", "Compras"], ["/admin/gastos", "Gastos"], ["/admin/finanzas", "Finanzas"]] },
  { grupo: "Equipo y comunicación", secciones: [["/admin/campaigns", "Campañas"], ["/admin/knowledge", "Conocimiento"], ["/admin/memoria", "Memoria colectiva"], ["/admin/users", "Usuarios y accesos"]] },
]

const PERFILES: { role: string; perfil: string; detalle: string }[] = [
  { role: "admin", perfil: "Dueño", detalle: "Todo" },
  { role: "gerente", perfil: "Gerente", detalle: "Operación, administración y métricas" },
  { role: "supervisor", perfil: "Supervisor", detalle: "Salón, caja, inventario y compras" },
  { role: "anfitriona", perfil: "Anfitriona", detalle: "Llegadas, reservas y bandeja" },
  { role: "mesero", perfil: "Mesero", detalle: "Órdenes y salón" },
  { role: "cocina", perfil: "Cocina", detalle: "Cocina, carta e inventario" },
  { role: "cajero", perfil: "Cajera", detalle: "Caja, órdenes y gastos" },
  { role: "compras", perfil: "Compras", detalle: "Inventario, compras y gastos" },
]

const deRol = (role: string) => allowedSections(role === "supervisor" ? "supervisor_restaurante" : role).filter((s) => GRUPOS.some((g) => g.secciones.some(([r]) => r === s)))

/** Equipo del restaurante: cada persona entra con un perfil y se le puede abrir o cerrar cada sección. */
export function EquipoAccesos() {
  const [lista, setLista] = useState<Usuario[] | null>(null)
  const [editar, setEditar] = useState<Usuario | "nuevo" | null>(null)

  const cargar = () => apiClient.get<Usuario[]>("/users").then(setLista).catch(() => setLista([]))
  useEffect(() => {
    cargar()
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="etiqueta">Equipo de Boca Marina</p>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Usuarios y accesos</h1>
          <p className="text-sm text-muted-foreground">Cada persona entra con un perfil. Abre o cierra secciones a la medida: un supervisor puede ver caja e inventario sin ver las finanzas.</p>
        </div>
        <Button onClick={() => setEditar("nuevo")} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </header>

      {!lista ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {lista.map((u) => {
            const secciones = u.role === "admin" ? null : u.secciones ?? deRol(u.role)
            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.email} · {u.perfil ?? u.role}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs", u.secciones ? "bg-[#E8866A]/15 text-[#8a3a24]" : "bg-muted text-muted-foreground")}>
                    {secciones ? `${secciones.length} secciones${u.secciones ? " a la medida" : ""}` : "Acceso total"}
                  </span>
                  <Button variant="outline" className="h-10 gap-2" onClick={() => setEditar(u)} disabled={u.role === "admin"}>
                    <KeyRound className="h-4 w-4" /> Accesos
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {editar && (
        <DialogoAccesos
          usuario={editar === "nuevo" ? null : editar}
          onCerrar={() => setEditar(null)}
          onGuardado={() => {
            setEditar(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}

function DialogoAccesos({ usuario, onCerrar, onGuardado }: { usuario: Usuario | null; onCerrar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(usuario?.name ?? "")
  const [correo, setCorreo] = useState(usuario?.email ?? "")
  const [role, setRole] = useState(usuario?.role ?? "supervisor")
  const [secciones, setSecciones] = useState<string[]>(usuario?.secciones ?? deRol(usuario?.role ?? "supervisor"))
  const [enviando, setEnviando] = useState(false)

  const elegirPerfil = (r: string) => {
    setRole(r)
    setSecciones(deRol(r))
  }
  const alternar = (s: string) => setSecciones((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))

  const guardar = async () => {
    if (!nombre.trim() || !correo.trim()) return toast.error("Falta el nombre o el correo")
    if (!secciones.length) return toast.error("Elige al menos una sección")
    setEnviando(true)
    const perfil = PERFILES.find((p) => p.role === role)?.perfil ?? role
    const cuerpo = { name: nombre.trim(), email: correo.trim().toLowerCase(), role, perfil, secciones: [...secciones, "/admin/notificaciones"] }
    try {
      if (usuario) await apiClient.put(`/users/${usuario.id}`, cuerpo)
      else await apiClient.post("/users", cuerpo)
      toast.success(usuario ? `Accesos de ${nombre.split(" ")[0]} guardados` : `${nombre.split(" ")[0]} puede entrar con ${cuerpo.email}`)
      onGuardado()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{usuario ? `Accesos de ${usuario.name}` : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>Elige un perfil para empezar y ajusta las secciones una por una.</DialogDescription>
        </DialogHeader>
        {!usuario && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="eq-nombre">Nombre</Label>
              <Input id="eq-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="eq-correo">Correo para entrar</Label>
              <Input id="eq-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@bocamarina.demo" />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="font-medium">Perfil</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PERFILES.filter((p) => p.role !== "admin").map((p) => (
              <button key={p.role} onClick={() => elegirPerfil(p.role)} className={cn("rounded-xl border p-2.5 text-left", role === p.role ? "border-[#0B2A2E] bg-[#0B2A2E] text-[#F4ECDF]" : "hover:bg-muted")}>
                <div className="text-sm font-semibold">{p.perfil}</div>
                <div className="text-[11px] opacity-75">{p.detalle}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" /> Lo que puede ver y usar
          </div>
          {GRUPOS.map((g) => (
            <div key={g.grupo}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.grupo}</div>
              <div className="flex flex-wrap gap-2">
                {g.secciones.map(([ruta, nombre]) => {
                  const activo = secciones.includes(ruta)
                  return (
                    <button
                      key={ruta}
                      onClick={() => alternar(ruta)}
                      aria-pressed={activo}
                      className={cn("h-10 rounded-full border px-3.5 text-sm", activo ? "border-[#7FCFCB] bg-[#7FCFCB]/25 font-medium" : "text-muted-foreground hover:bg-muted")}
                    >
                      {nombre}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={enviando}>
            {usuario ? "Guardar accesos" : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
