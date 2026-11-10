import base from "@/public/marca/marca.json"

// Marca del cliente: nombre, un color, logo, modo y esquinas. La base sale de frontend/marca/marca.json
// (copiado a public/marca al arrancar); lo que se guarda en la pantalla Marca la reemplaza.
export interface Marca {
  nombre: string
  color: string
  logo: string
  /** Versión del logo para fondo oscuro, si el logo normal no se lee sobre oscuro. */
  logoOscuro?: string
  /** El logo ya trae el nombre escrito: no se repite al lado. */
  logoConNombre?: boolean
  modo: "oscuro" | "claro"
  esquinas: "rectas" | "suaves"
}

export const MARCA_BASE = base as Marca
export const CLAVE_MARCA = "marca"
// [tarjetas y campos, botones y chips]; igual que en frontend/tema/tailwind.cjs
const RADIOS: Record<Marca["esquinas"], [string, string]> = { rectas: ["0px", "0px"], suaves: ["0.75rem", "0.5625rem"] }

export function aplicarMarca(m: Marca) {
  const s = document.documentElement.style
  s.setProperty("--marca", m.color)
  const [radio, control] = RADIOS[m.esquinas] ?? RADIOS.suaves
  s.setProperty("--radius", radio)
  s.setProperty("--radius-control", control)
}

// Corre en <head> antes de pintar, con la última marca guardada: evita el destello del color base.
export const SCRIPT_MARCA = `try{var m=JSON.parse(localStorage.getItem("${CLAVE_MARCA}")||"null");if(m){var s=document.documentElement.style;if(m.color)s.setProperty("--marca",m.color);if(m.esquinas){var r=m.esquinas==="rectas";s.setProperty("--radius",r?"0px":"0.75rem");s.setProperty("--radius-control",r?"0px":"0.5625rem")}}}catch(e){}`

export const temaPorDefecto = (m: Marca) => (m.modo === "claro" ? "light" : "dark")
