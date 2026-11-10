// Sistema de diseño compartido por el panel y la tienda. Guía: frontend/DESIGN.md.
// Lenguaje de WhatsApp: superficies gris azulado, esquinas redondeadas, sombras leves.
// Todo color sale de un token CSS. La marca es un solo color (--marca, de frontend/marca/marca.json)
// y de él se derivan primario, acentos y la escala que reemplaza a blue/indigo/sky de Tailwind.
// Las demás paletas de Tailwind (gray, red, green...) también son tokens: invierten solas en modo oscuro.
// scripts/sync-colt-assets.mjs copia esta carpeta y marca.json a admin/tema y tienda/tema; las apps usan la copia.
const marca = require("./marca.json")
// --radius para tarjetas; --radius-control (= rounded-md de campos y selects) para botones, chips y badges.
const RADIOS = { rectas: ["0px", "0px"], suaves: ["0.75rem", "0.5625rem"] }

const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
// Luz y croma por paso. En oscuro los tintes (50-300) se oscurecen, los acentos (400-600) se quedan
// y los tonos de texto (700-950) se aclaran: bg-red-50 + text-red-700 sigue funcionando en ambos modos.
const ESCALA = {
  claro: {
    l: [0.971, 0.936, 0.885, 0.808, 0.704, 0.637, 0.577, 0.505, 0.444, 0.396, 0.258],
    c: [0.014, 0.032, 0.062, 0.114, 0.17, 0.2, 0.2, 0.18, 0.15, 0.12, 0.08],
    n: [0.975, 0.955, 0.915, 0.86, 0.71, 0.56, 0.45, 0.38, 0.28, 0.21, 0.16],
  },
  oscuro: {
    l: [0.23, 0.27, 0.33, 0.42, 0.68, 0.63, 0.58, 0.76, 0.83, 0.89, 0.94],
    c: [0.04, 0.06, 0.08, 0.11, 0.16, 0.19, 0.18, 0.15, 0.11, 0.08, 0.05],
    n: [0.21, 0.24, 0.28, 0.34, 0.5, 0.62, 0.7, 0.78, 0.87, 0.93, 0.97],
  },
}
// [tono, factor de croma, ajuste de luz]. Amarillos y naranjas necesitan más luz para no verse ocre.
const TONOS = {
  red: [25, 1, 0],
  orange: [50, 0.95, 0.07],
  amber: [75, 0.85, 0.13],
  yellow: [95, 0.8, 0.16],
  lime: [130, 0.85, 0.12],
  green: [150, 0.9, 0.05],
  emerald: [163, 0.8, 0.03],
  teal: [185, 0.6, 0.02],
  cyan: [215, 0.6, 0.06],
  violet: [293, 1, 0],
  purple: [303, 1, 0],
  fuchsia: [322, 1, 0],
  pink: [354, 0.85, 0.02],
  rose: [10, 1, 0],
}
const PESO_AJUSTE = [0, 0.1, 0.3, 0.6, 1, 1, 0.8, 0.3, 0.1, 0, 0]

const escala = (color) => Object.fromEntries(PASOS.map((p, i) => [p, color(p, i)]))
const tono = ([h, f, ajuste]) =>
  escala((p, i) => `oklch(calc(var(--l-${p}) + ${+(ajuste * PESO_AJUSTE[i]).toFixed(3)}) calc(var(--c-${p}) * ${f}) ${h} / <alpha-value>)`)
const marcaEscala = escala((p) => `oklch(from var(--marca) var(--l-${p}) min(c, var(--c-${p})) h / <alpha-value>)`)
const neutro = escala((p) => `oklch(var(--n-${p}) 0.012 235 / <alpha-value>)`)
const varsEscala = (modo) =>
  Object.fromEntries(
    PASOS.flatMap((p, i) => [
      [`--l-${p}`, String(ESCALA[modo].l[i])],
      [`--c-${p}`, String(ESCALA[modo].c[i])],
      [`--n-${p}`, String(ESCALA[modo].n[i])],
    ])
  )

const t = (v) => `color-mix(in oklab, var(--${v}) calc(<alpha-value> * 100%), transparent)`
const suave = (v, pct) => `color-mix(in oklch, var(--${v}) ${pct}%, var(--card))`
// Negro o blanco según la luz del fondo: texto legible sobre cualquier color de marca.
const textoSobre = (v) => `oklch(from var(--${v}) clamp(0, (0.68 - l) * 1000, 1) 0 0)`

const raiz = {
  "--marca": marca.color,
  "--radius": (RADIOS[marca.esquinas] ?? RADIOS.suaves)[0],
  "--radius-control": (RADIOS[marca.esquinas] ?? RADIOS.suaves)[1],
  "--font-sans": "var(--font-geist), ui-sans-serif, system-ui, sans-serif",
  "--font-display": "var(--font-lexend), var(--font-geist), ui-sans-serif, sans-serif",
  "--font-mono": "var(--font-geist-mono), ui-monospace, monospace",
}

// Un var() se resuelve donde se declara: lo derivado va en cada modo para que .dark/.light
// funcionen también en un bloque suelto (vista previa de la pantalla Marca).
const comunes = {
  "--card-foreground": "var(--foreground)",
  "--popover-foreground": "var(--foreground)",
  "--secondary-foreground": "var(--foreground)",
  "--primary-foreground": textoSobre("primary"),
  "--destructive-foreground": textoSobre("destructive"),
  "--brand": "var(--primary)",
  "--ring": "var(--primary)",
  "--chart-1": "var(--primary)",
  "--chart-2": "var(--info)",
  "--chart-3": "var(--warning)",
  "--chart-4": "var(--muted-foreground)",
  "--chart-5": "var(--destructive)",
}

const claro = {
  colorScheme: "light",
  ...comunes,
  ...varsEscala("claro"),
  "--background": "oklch(0.962 0.004 250)",
  "--foreground": "oklch(0.21 0.017 235)",
  "--card": "oklch(1 0 0)",
  "--popover": "oklch(1 0 0)",
  "--primary": "oklch(from var(--marca) min(l, 0.55) c h)",
  "--secondary": "oklch(0.955 0.004 235)",
  "--muted": "oklch(0.955 0.004 235)",
  "--muted-foreground": "oklch(0.5 0.022 235)",
  "--accent": suave("primary", 10),
  "--accent-foreground": "oklch(from var(--primary) min(l, 0.45) c h)",
  "--destructive": "oklch(0.55 0.2 27)",
  "--success": "oklch(0.52 0.13 150)",
  "--warning": "oklch(0.56 0.12 70)",
  "--info": "oklch(0.5 0.14 250)",
  "--chat": "oklch(0.94 0.012 80)",
  "--foto": "oklch(1 0 0)",
  "--border": "oklch(0.92 0.006 235)",
  "--input": "oklch(0.88 0.008 235)",
  "--success-soft": suave("success", 12),
  "--warning-soft": suave("warning", 12),
  "--info-soft": suave("info", 12),
  "--destructive-soft": suave("destructive", 12),
}

const oscuro = {
  colorScheme: "dark",
  ...comunes,
  ...varsEscala("oscuro"),
  "--background": "oklch(0.18 0.015 235)",
  "--foreground": "oklch(0.94 0.005 235)",
  "--card": "oklch(0.215 0.017 235)",
  "--popover": "oklch(0.28 0.018 235)",
  "--primary": "oklch(from var(--marca) max(l, 0.7) c h)",
  "--secondary": "oklch(0.28 0.018 235)",
  "--muted": "oklch(0.28 0.018 235)",
  "--muted-foreground": "oklch(0.68 0.02 235)",
  "--accent": suave("primary", 14),
  "--accent-foreground": "var(--primary)",
  "--destructive": "oklch(0.6 0.2 25)",
  "--success": "oklch(0.72 0.17 150)",
  "--warning": "oklch(0.8 0.14 80)",
  "--info": "oklch(0.72 0.12 245)",
  "--chat": "oklch(0.165 0.014 235)",
  // Igual al blanco de las fotos con brightness-90: marco y foto sin costura y sin deslumbrar.
  "--foto": "oklch(0.925 0 0)",
  "--border": "oklch(0.29 0.016 235)",
  "--input": "oklch(0.34 0.018 235)",
  "--success-soft": suave("success", 16),
  "--warning-soft": suave("warning", 16),
  "--info-soft": suave("info", 16),
  "--destructive-soft": suave("destructive", 16),
}

// Opcional en marca.json: letras propias, superficies del cliente (fondo, tarjeta, borde...) y un color de acento.
const FUENTES = {
  cormorant: '"Cormorant Garamond", var(--font-cormorant), Georgia, serif',
  jost: 'var(--font-jost), ui-sans-serif, system-ui, sans-serif',
  spartan: 'var(--font-spartan), var(--font-geist), ui-sans-serif, sans-serif',
  roboto: 'var(--font-roboto), ui-sans-serif, system-ui, sans-serif',
}
if (marca.fuentes?.titulo && FUENTES[marca.fuentes.titulo]) raiz["--font-display"] = FUENTES[marca.fuentes.titulo]
if (marca.fuentes?.texto && FUENTES[marca.fuentes.texto]) raiz["--font-sans"] = FUENTES[marca.fuentes.texto]
raiz["--acento"] = marca.acento ?? marca.color
const superficies = (modo, s) => {
  if (!s) return
  const destino = modo === "claro" ? claro : oscuro
  Object.assign(destino, {
    "--background": s.fondo,
    "--card": s.tarjeta,
    "--popover": s.tarjeta,
    "--secondary": s.suave,
    "--muted": s.suave,
    "--border": s.borde,
    "--input": s.campo,
    "--chat": s.chat,
    "--foreground": s.texto,
    "--muted-foreground": s.tenue,
  })
}
superficies("claro", marca.superficies?.claro)
superficies("oscuro", marca.superficies?.oscuro)

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        ...Object.fromEntries(Object.entries(TONOS).map(([nombre, def]) => [nombre, tono(def)])),
        blue: marcaEscala,
        indigo: marcaEscala,
        sky: marcaEscala,
        gray: neutro,
        slate: neutro,
        zinc: neutro,
        neutral: neutro,
        stone: neutro,
        marca: marcaEscala,
        brand: t("brand"),
        acento: t("acento"),
        background: t("background"),
        foreground: t("foreground"),
        border: t("border"),
        input: t("input"),
        ring: t("ring"),
        card: { DEFAULT: t("card"), foreground: t("card-foreground") },
        popover: { DEFAULT: t("popover"), foreground: t("popover-foreground") },
        primary: { DEFAULT: t("primary"), foreground: t("primary-foreground") },
        secondary: { DEFAULT: t("secondary"), foreground: t("secondary-foreground") },
        muted: { DEFAULT: t("muted"), foreground: t("muted-foreground") },
        accent: { DEFAULT: t("accent"), foreground: t("accent-foreground") },
        destructive: { DEFAULT: t("destructive"), foreground: t("destructive-foreground"), soft: t("destructive-soft") },
        success: { DEFAULT: t("success"), soft: t("success-soft") },
        warning: { DEFAULT: t("warning"), soft: t("warning-soft") },
        info: { DEFAULT: t("info"), soft: t("info-soft") },
        // Fondo del área de mensajes, como el papel tapiz de WhatsApp.
        chat: t("chat"),
        // Marco de fotos de producto (vienen con fondo blanco).
        foto: t("foto"),
        chart: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, t(`chart-${n}`)])),
      },
      borderRadius: {
        sm: "calc(var(--radius) * 0.5)",
        DEFAULT: "calc(var(--radius) * 0.75)",
        md: "calc(var(--radius) * 0.75)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) * 1.5)",
        "2xl": "calc(var(--radius) * 2)",
        "3xl": "calc(var(--radius) * 3)",
        control: "var(--radius-control)",
      },
      // Sombras leves como las burbujas de WhatsApp; en oscuro casi no se ven y manda el borde.
      boxShadow: {
        sm: "0 1px 0.5px rgb(11 20 26 / 0.1)",
        DEFAULT: "0 1px 3px rgb(11 20 26 / 0.08)",
        md: "0 8px 24px -8px rgb(11 20 26 / 0.22)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    {
      handler: ({ addBase, addComponents }) => {
        addBase({
          ":root": { ...raiz, ...claro },
          ".light": claro,
          ".dark": oscuro,
          "*": { borderColor: "var(--border)" },
          "html, body": { overflowX: "clip" },
          body: {
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            fontFamily: "var(--font-sans)",
            WebkitFontSmoothing: "antialiased",
          },
          "h1, h2, h3": { fontFamily: "var(--font-display)" },
          "::selection": { backgroundColor: "color-mix(in oklab, var(--primary) 35%, transparent)" },
          // Superficies blancas heredadas (bg-white) pasan a tarjeta en oscuro.
          ".dark .bg-white, .dark .hover\\:bg-white:hover": { backgroundColor: "var(--card)" },
        })
        addComponents({
          // Rótulo de sección, campo o grupo del menú.
          ".etiqueta": {
            fontSize: "0.8125rem",
            lineHeight: "1.25rem",
            fontWeight: "500",
            color: "var(--muted-foreground)",
          },
        })
      },
    },
  ],
}
