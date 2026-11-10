"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, Eye, EyeOff, AlertCircle, Loader2, Lock, Mail, ShieldCheck } from "lucide-react"
import { Logo } from "@/components/marca/logo"
import { useMarca } from "@/contexts/marca-context"
import { cn } from "@/lib/utils"
import { usePalabras, useVertical } from "@/lib/vertical"
import { MOCK_MODE } from "@/mocks/install"

const PERFILES_MAX = [
  { email: "direccion@max.demo", nombre: "Dirección" },
  { email: "patricia@max.demo", nombre: "Ejecutiva de personas" },
  { email: "manuel@max.demo", nombre: "Ejecutivo de empresas" },
  { email: "servicio@max.demo", nombre: "Servicio" },
  { email: "siniestros@max.demo", nombre: "Siniestros" },
]

const PERFILES = [
  { email: "dueno@bocamarina.demo", nombre: "Dueño" },
  { email: "gerente@bocamarina.demo", nombre: "Gerente" },
  { email: "supervisor@bocamarina.demo", nombre: "Supervisor" },
  { email: "anfitriona@bocamarina.demo", nombre: "Anfitriona" },
  { email: "mesero@bocamarina.demo", nombre: "Mesera" },
  { email: "cocina@bocamarina.demo", nombre: "Cocina" },
  { email: "caja@bocamarina.demo", nombre: "Cajera" },
  { email: "compras@bocamarina.demo", nombre: "Compras" },
]

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAdmin()
  const { marca } = useMarca()
  const router = useRouter()
  const vertical = useVertical()
  const palabras = usePalabras()

  const entrarComo = async (correo: string) => {
    setError("")
    setIsLoading(true)
    try {
      if (await login(correo, "demo")) router.push(correo.startsWith("anfitriona@") ? "/admin/llegadas" : "/admin")
    } catch (error: any) {
      setError(error?.message || "Error al iniciar sesión")
    } finally {
      setIsLoading(false)
    }
  }

  // Verificar si llegamos aquí por token expirado
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tokenExpired = localStorage.getItem('tokenExpired')
      if (tokenExpired === 'true') {
        setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
        localStorage.removeItem('tokenExpired')
      }
      if (localStorage.getItem('passwordChanged') === 'true') {
        setNotice('Contraseña actualizada. Inicia sesión con la nueva.')
        localStorage.removeItem('passwordChanged')
      }
    }
  }, [])

  // Un solo POST /auth/login por intento (antes eran dos: loginAdmin + login()).
  // La selección de empresa, si hace falta, la muestra el layout del panel.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setNotice("")
    setIsLoading(true)
    try {
      if (await login(email, password)) {
        router.push("/admin")
      } else {
        setError("Credenciales incorrectas")
      }
    } catch (error: any) {
      setError(error?.message || "Error al iniciar sesión")
    } finally {
      setIsLoading(false)
    }
  }

  const nombreLargo = marca.nombre.length > 10

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Panel de marca */}
      <aside className={cn("relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16", vertical === "restaurante" ? "bg-[#0B2A2E] text-[#F4ECDF]" : vertical === "seguros" ? "bg-[#06193f] text-white" : "bg-accent")}>
        {vertical === "restaurante" && (
          <>
            <img src="/boca-marina/hero-sunset.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B2A2E] via-[#0B2A2E]/60 to-[#0B2A2E]/20" />
          </>
        )}
        {vertical === "seguros" && (
          <>
            <img src="/max/fotos/portada-max-corredores-seguros-empresas-personas.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06193f] via-[#0a2a6b]/80 to-[#0047BB]/30" />
          </>
        )}
        <div className="relative">{vertical === "seguros" ? <img src="/marca/logo-max.png" alt="MAX Corredores de Seguros" className="h-16 w-auto" /> : <Logo conNombre={false} className="h-12" />}</div>
        <div className="relative flex min-w-0 flex-col gap-6">
          <h2
            className={cn(
              "font-display font-bold leading-none [overflow-wrap:anywhere]",
              nombreLargo ? "text-5xl xl:text-6xl" : "text-7xl xl:text-8xl"
            )}
          >
            {vertical === "seguros" ? "MAX Corredores de Seguros" : marca.nombre}
          </h2>
          <p className={cn("font-display text-2xl font-semibold xl:text-3xl", vertical === "restaurante" ? "italic text-[#E8866A]" : vertical === "seguros" ? "text-[#9fbcf0]" : "text-primary")}>{palabras.lema}</p>
          <p className={cn("max-w-md text-base leading-relaxed", vertical === "restaurante" ? "text-[#F4ECDF]/80" : vertical === "seguros" ? "text-white/80" : "text-muted-foreground")}>
            {palabras.descripcion}
          </p>
        </div>
        <p className={cn("etiqueta relative", vertical === "restaurante" && "text-[#F4ECDF]/70", vertical === "seguros" && "text-white/70")}>© {new Date().getFullYear()} {vertical === "seguros" ? "MAX Corredores de Seguros" : marca.nombre}{vertical !== "repuestos" ? " · con ORA de Ampirics" : ""}</p>
      </aside>

      {/* Formulario */}
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="flex w-full max-w-sm flex-col gap-10">
          <div className="lg:hidden">
            <Logo className="h-9" />
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-semibold">Iniciar sesión</h1>
            <p className="text-sm text-muted-foreground">Entra con tu cuenta de {vertical === "seguros" ? "MAX Corredores de Seguros" : marca.nombre}.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {notice && !error && (
              <div role="status" className="flex items-start gap-2.5 rounded-md border border-success/30 bg-success-soft px-3.5 py-3 text-sm text-success">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="font-medium">{notice}</span>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  disabled={isLoading}
                  className="h-12 pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  disabled={isLoading}
                  className="h-12 pl-10 pr-12"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="group mt-2 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </>
              )}
            </Button>
          </form>

          {MOCK_MODE && vertical !== "repuestos" && (
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">Demostración: entra con un perfil</p>
              <p className="text-xs text-muted-foreground">Cada perfil ve solo lo suyo.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(vertical === "seguros" ? PERFILES_MAX : PERFILES).map((p) => (
                  <Button key={p.email} type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => entrarComo(p.email)}>
                    {p.nombre}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            Conexión cifrada
          </p>
        </div>
      </main>
    </div>
  )
}
