"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMarca } from "@/contexts/marca-context"
import { MARCA_BASE, aplicarMarca, type Marca } from "@/lib/marca"
import { cn } from "@/lib/utils"
import { Check, Loader2, RotateCcw, Upload } from "lucide-react"
import { useVertical } from "@/lib/vertical"

const MUESTRAS = [
  { nombre: "WhatsApp", color: "#25D366" },
  { nombre: "Azul", color: "#005EFF" },
  { nombre: "Rojo", color: "#E8141C" },
  { nombre: "Naranja", color: "#F97316" },
  { nombre: "Morado", color: "#7C3AED" },
  { nombre: "Grafito", color: "#52525B" },
]
const HEX = /^#[0-9a-f]{6}$/i
const LOGO_MAX = 512 * 1024

function Opciones<T extends string>({
  id,
  valor,
  opciones,
  onChange,
}: {
  id: string
  valor: T
  opciones: { valor: T; texto: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-2 gap-1 rounded-control bg-secondary p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "h-9 truncate rounded-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            valor === o.valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

function Vista({ modo, m }: { modo: "light" | "dark"; m: Marca }) {
  const restaurante = useVertical() === "restaurante"
  return (
    <div className={cn(modo, "rounded-lg border bg-background p-4 text-foreground")}>
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <span className="flex min-w-0 items-center gap-2">
          <img src={modo === "dark" && m.logoOscuro ? m.logoOscuro : m.logo} alt="" className={cn("w-auto shrink-0", m.logoConNombre ? "h-8" : "h-6")} />
          {!m.logoConNombre && <span className="truncate font-display text-sm font-semibold">{m.nombre || "Sin nombre"}</span>}
        </span>
        <span className="etiqueta shrink-0">{modo === "dark" ? "Oscuro" : "Claro"}</span>
      </div>
      <div className="mt-4 flex flex-col gap-2 text-sm">
        <p className="max-w-[85%] rounded-lg rounded-tl-sm bg-card px-3 py-2 shadow-sm">{restaurante ? "Hola, ¿tienen mesa para 2 esta noche?" : "Hola, ¿lo tienen disponible?"}</p>
        <p className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-accent px-3 py-2 shadow-sm">{restaurante ? "Sí, en el muelle a las 8:00 p. m. Te envío la reserva por aquí." : "Sí. Te envío la cotización por aquí."}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" type="button" tabIndex={-1}>{restaurante ? "Confirmar reserva" : "Enviar cotización"}</Button>
        <Button size="sm" type="button" variant="outline" tabIndex={-1}>Ver detalle</Button>
        <Badge>Nuevo</Badge>
        <span className="text-sm font-medium text-primary underline underline-offset-4">Enlace</span>
      </div>
    </div>
  )
}

export default function MarcaPage() {
  const { marca, guardar } = useMarca()
  const [borrador, setBorrador] = useState<Marca>(marca)
  const [hex, setHex] = useState(marca.color)
  const [estado, setEstado] = useState<"normal" | "guardando" | "guardado" | "error">("normal")
  const [errorLogo, setErrorLogo] = useState("")
  const guardada = useRef(marca)
  const archivo = useRef<HTMLInputElement>(null)

  const cambios = JSON.stringify(borrador) !== JSON.stringify(marca)

  // Si la marca guardada llega después (GET /marca), el formulario parte de ella.
  useEffect(() => {
    guardada.current = marca
    setBorrador(marca)
    setHex(marca.color)
  }, [marca])

  // Vista previa en vivo en todo el panel; al salir sin guardar vuelve la marca guardada.
  useEffect(() => aplicarMarca(borrador), [borrador])
  useEffect(() => () => aplicarMarca(guardada.current), [])

  const cambiar = (parcial: Partial<Marca>) => {
    setBorrador((b) => ({ ...b, ...parcial }))
    setEstado("normal")
  }

  const elegirColor = (color: string) => {
    setHex(color.toUpperCase())
    cambiar({ color: color.toUpperCase() })
  }

  const escribirHex = (v: string) => {
    const valor = v.startsWith("#") ? v : `#${v}`
    setHex(valor)
    if (HEX.test(valor)) cambiar({ color: valor.toUpperCase() })
  }

  const subirLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    if (!f.type.startsWith("image/")) return setErrorLogo("El archivo debe ser una imagen (SVG, PNG, JPG o WebP).")
    if (f.size > LOGO_MAX) return setErrorLogo("El logo pesa más de 512 KB. Usa un SVG o un PNG más pequeño.")
    setErrorLogo("")
    const lector = new FileReader()
    lector.onload = () => cambiar({ logo: String(lector.result), logoOscuro: undefined, logoConNombre: false })
    lector.readAsDataURL(f)
  }

  const onGuardar = async () => {
    setEstado("guardando")
    try {
      await guardar({ ...borrador, nombre: borrador.nombre.trim() || MARCA_BASE.nombre })
      setEstado("guardado")
    } catch {
      setEstado("error")
    }
  }

  return (
    <AdminLayout title="Marca">
      <div className="grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-sm text-muted-foreground">
              Nombre, color y logo que ven tu equipo en el panel y tus clientes en la tienda. Los cambios se ven al
              instante; se aplican a todos al guardar.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="marca-nombre" className="etiqueta">Nombre</Label>
            <Input
              id="marca-nombre"
              value={borrador.nombre}
              maxLength={40}
              onChange={(e) => cambiar({ nombre: e.target.value })}
              placeholder={MARCA_BASE.nombre}
              className="h-11"
            />
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="etiqueta mb-2">Color principal</legend>
            <div className="flex flex-wrap gap-2">
              {MUESTRAS.map((m) => {
                const activa = borrador.color.toUpperCase() === m.color
                return (
                  <button
                    key={m.color}
                    type="button"
                    onClick={() => elegirColor(m.color)}
                    aria-pressed={activa}
                    title={m.nombre}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      activa ? "border-foreground" : "border-transparent"
                    )}
                    style={{ backgroundColor: m.color }}
                  >
                    <span className="sr-only">{m.nombre}</span>
                    {activa && <Check className="h-4 w-4 text-white mix-blend-difference" aria-hidden />}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border" title="Elegir otro color">
                <span className="absolute inset-0" style={{ backgroundColor: borrador.color }} aria-hidden />
                <input
                  type="color"
                  value={borrador.color}
                  onChange={(e) => elegirColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Elegir otro color"
                />
              </label>
              <Input
                value={hex}
                onChange={(e) => escribirHex(e.target.value.trim())}
                maxLength={7}
                aria-label="Color en hexadecimal"
                aria-invalid={!HEX.test(hex)}
                className={cn("h-11 w-32 font-mono uppercase", !HEX.test(hex) && "border-destructive focus-visible:ring-destructive")}
              />
              {!HEX.test(hex) && <span className="text-xs text-destructive">Usa el formato #25D366</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Un solo color basta: los tonos, el modo oscuro y el color del texto sobre botones se calculan solos.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="etiqueta mb-2">Logo</legend>
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border bg-card p-2">
                <img src={borrador.logo} alt="Logo actual" className="max-h-full max-w-full object-contain" />
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => archivo.current?.click()}>
                  <Upload aria-hidden />
                  Subir logo
                </Button>
                {borrador.logo !== MARCA_BASE.logo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => cambiar({ logo: MARCA_BASE.logo, logoOscuro: MARCA_BASE.logoOscuro, logoConNombre: MARCA_BASE.logoConNombre })}>
                    Logo por defecto
                  </Button>
                )}
              </div>
              <input ref={archivo} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="hidden" onChange={subirLogo} />
            </div>
            {errorLogo ? (
              <p role="alert" className="text-xs text-destructive">{errorLogo}</p>
            ) : (
              <p className="text-xs text-muted-foreground">SVG o PNG con fondo transparente, hasta 512 KB. Se ve bien sobre claro y oscuro.</p>
            )}
          </fieldset>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span id="marca-modo" className="etiqueta">Modo por defecto</span>
              <Opciones
                id="marca-modo"
                valor={borrador.modo}
                onChange={(modo) => cambiar({ modo })}
                opciones={[
                  { valor: "oscuro", texto: "Oscuro" },
                  { valor: "claro", texto: "Claro" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span id="marca-esquinas" className="etiqueta">Esquinas</span>
              <Opciones
                id="marca-esquinas"
                valor={borrador.esquinas}
                onChange={(esquinas) => cambiar({ esquinas })}
                opciones={[
                  { valor: "suaves", texto: "Redondas" },
                  { valor: "rectas", texto: "Rectas" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t pt-6">
            <Button type="button" onClick={onGuardar} disabled={!cambios || estado === "guardando" || !HEX.test(hex)}>
              {estado === "guardando" && <Loader2 className="animate-spin" aria-hidden />}
              {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
            </Button>
            {cambios && (
              <Button type="button" variant="ghost" onClick={() => { setBorrador(marca); setHex(marca.color) }}>
                Descartar
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              onClick={() => { setBorrador(MARCA_BASE); setHex(MARCA_BASE.color); setEstado("normal") }}
            >
              <RotateCcw aria-hidden />
              Restablecer
            </Button>
            <p aria-live="polite" className="w-full text-sm">
              {estado === "guardado" && !cambios && <span className="text-success">Marca guardada.</span>}
              {estado === "error" && <span className="text-destructive">No se pudo guardar. Intenta de nuevo.</span>}
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start" aria-label="Vista previa">
          <p className="etiqueta">Vista previa</p>
          <Vista modo="dark" m={borrador} />
          <Vista modo="light" m={borrador} />
        </aside>
      </div>
    </AdminLayout>
  )
}
