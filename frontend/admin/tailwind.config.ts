import type { Config } from "tailwindcss"

// Colores, tipografía y radios salen del sistema compartido (frontend/tema, guía en frontend/DESIGN.md).
// ./tema es una copia que hace scripts/sync-colt-assets.mjs al arrancar.
const config: Config = {
  presets: [require("./tema/tailwind.cjs")],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [require("tailwindcss-animate")],
}

export default config
