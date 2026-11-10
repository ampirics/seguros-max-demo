import * as THREE from "three"

const cache = new Map<string, THREE.Texture>()

function lienzo(n: number) {
  const c = document.createElement("canvas")
  c.width = n
  c.height = n
  return [c, c.getContext("2d")!] as const
}

function azar(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function aTextura(c: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (color) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function guardar<T extends THREE.Texture>(clave: string, crear: () => T): T {
  const t = cache.get(clave)
  if (t) return t as T
  const n = crear()
  cache.set(clave, n)
  return n
}

/** Tablas de madera con juntas escalonadas, tonos distintos por tabla y vetas suaves. */
export function texturaTablas(c1: string, c2: string, junta: string, tablas = 8, vetas = 1) {
  return guardar(`tablas-${c1}-${c2}-${junta}-${tablas}-${vetas}`, () => {
    const [c, g] = lienzo(512)
    const r = azar(7)
    const paso = 512 / tablas
    const a = new THREE.Color(c1)
    const b = new THREE.Color(c2)
    for (let i = 0; i < tablas; i++) {
      let y = -r() * 300
      while (y < 512) {
        const largo = 180 + r() * 220
        const tono = a.clone().lerp(b, r())
        g.fillStyle = `#${tono.getHexString()}`
        g.fillRect(i * paso, y, paso, largo)
        if (vetas > 0) {
          g.globalAlpha = 0.07 * vetas
          for (let k = 0; k < 5; k++) {
            g.fillStyle = r() > 0.5 ? "#000" : "#fff"
            const x = i * paso + 3 + r() * (paso - 6)
            g.fillRect(x, y, 1, largo)
          }
          g.globalAlpha = 1
        }
        g.fillStyle = junta
        g.fillRect(i * paso, y + largo - 1.5, paso, 1.5)
        y += largo
      }
      g.fillStyle = junta
      g.fillRect(i * paso + paso - 2, 0, 2, 512)
    }
    return aTextura(c)
  })
}

/** Baldosas grandes con junta fina y una variación leve de tono. */
export function texturaBaldosas(c1: string, c2: string, n = 4) {
  return guardar(`baldosas-${c1}-${c2}-${n}`, () => {
    const [c, g] = lienzo(512)
    const r = azar(11)
    const p = 512 / n
    const a = new THREE.Color(c1)
    const b = new THREE.Color(c2)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = `#${a.clone().lerp(b, r()).getHexString()}`
        g.fillRect(i * p, j * p, p, p)
        g.fillStyle = "rgba(0,0,0,0.10)"
        g.fillRect(i * p, j * p, p, 2)
        g.fillRect(i * p, j * p, 2, p)
      }
    return aTextura(c)
  })
}

/** Grama con ruido fino. */
export function texturaGrama(base: string) {
  return guardar(`grama-${base}`, () => {
    const [c, g] = lienzo(256)
    const r = azar(3)
    g.fillStyle = base
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,255,230,0.07)" : "rgba(0,20,0,0.09)"
      g.fillRect(r() * 256, r() * 256, 1.5, 3)
    }
    return aTextura(c)
  })
}

/** Degradado radial blanco a transparente para brillos aditivos. */
export function texturaBrillo() {
  return guardar("brillo", () => {
    const [c, g] = lienzo(128)
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    d.addColorStop(0, "rgba(255,255,255,1)")
    d.addColorStop(0.18, "rgba(255,255,255,0.55)")
    d.addColorStop(0.45, "rgba(255,255,255,0.14)")
    d.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = d
    g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    return t
  })
}

/** Sombra suave de contacto: negro al centro que se desvanece. */
export function texturaSombra() {
  return guardar("sombra", () => {
    const [c, g] = lienzo(128)
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    d.addColorStop(0, "rgba(0,0,0,0.9)")
    d.addColorStop(0.5, "rgba(0,0,0,0.45)")
    d.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = d
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  })
}

/** Disco de la luna con un poco de textura. */
export function texturaLuna() {
  return guardar("luna", () => {
    const [c, g] = lienzo(128)
    const d = g.createRadialGradient(58, 58, 4, 64, 64, 60)
    d.addColorStop(0, "#fffdf4")
    d.addColorStop(0.85, "#e9e6da")
    d.addColorStop(1, "rgba(233,230,218,0)")
    g.fillStyle = d
    g.beginPath()
    g.arc(64, 64, 60, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = "rgba(160,160,150,0.18)"
    ;[[44, 50, 12], [80, 72, 9], [70, 40, 7], [52, 84, 6]].forEach(([x, y, r]) => {
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    })
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Arena seca arriba que se oscurece hacia la orilla mojada (v = 0 en el agua). */
export function texturaArena(seca: string, mojada: string) {
  return guardar(`arena-${seca}-${mojada}`, () => {
    const [c, g] = lienzo(256)
    const r = azar(17)
    const d = g.createLinearGradient(0, 0, 0, 256)
    d.addColorStop(0, seca)
    d.addColorStop(0.62, seca)
    d.addColorStop(0.84, mojada)
    d.addColorStop(1, mojada)
    g.fillStyle = d
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 3800; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(90,60,20,0.07)"
      g.fillRect(r() * 256, r() * 256, 1.2, 1.2)
    }
    g.fillStyle = "rgba(255,255,255,0.35)"
    for (let x = 0; x < 256; x++) g.fillRect(x, 212 + Math.sin(x * 0.09) * 5 + Math.sin(x * 0.23) * 2, 1, 2)
    const t = aTextura(c)
    t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

/** Terrazo claro con chispas de colores y juntas grandes. */
export function texturaTerrazo(base: string, chispas: string[]) {
  return guardar(`terrazo-${base}-${chispas.join("")}`, () => {
    const [c, g] = lienzo(512)
    const r = azar(23)
    g.fillStyle = base
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = chispas[Math.floor(r() * chispas.length)]
      g.globalAlpha = 0.55 + r() * 0.4
      const x = r() * 512
      const y = r() * 512
      const k = 1.5 + r() * 4.5
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + k, y + r() * k)
      g.lineTo(x + r() * k, y + k)
      g.fill()
    }
    g.globalAlpha = 1
    g.fillStyle = "rgba(0,0,0,0.06)"
    for (let i = 0; i <= 2; i++) {
      g.fillRect(i * 256, 0, 2, 512)
      g.fillRect(0, i * 256, 512, 2)
    }
    return aTextura(c)
  })
}
