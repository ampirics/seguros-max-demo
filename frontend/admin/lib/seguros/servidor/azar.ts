// Azar con semilla: la historia sale igual en cada arranque, así los números de la demo no cambian.
export function crearAzar(semilla: number) {
  let a = semilla >>> 0
  const sig = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const entre = (x: number, y: number) => x + sig() * (y - x)
  const entero = (x: number, y: number) => Math.floor(entre(x, y + 1))
  const elegir = <T,>(xs: T[]): T => xs[Math.floor(sig() * xs.length)]
  const pesado = <T,>(xs: [T, number][]): T => {
    const total = xs.reduce((s, [, p]) => s + p, 0)
    let r = sig() * total
    for (const [x, p] of xs) {
      r -= p
      if (r <= 0) return x
    }
    return xs[xs.length - 1][0]
  }
  return { sig, entre, entero, elegir, pesado }
}

export type Azar = ReturnType<typeof crearAzar>

export const azarLibre = crearAzar(Date.now() % 2147483647)
