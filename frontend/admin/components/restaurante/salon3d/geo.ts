import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

// Piezas sueltas que se funden en una sola geometría con color por vértice: una llamada de dibujo por objeto.
export type Parte = { g: THREE.BufferGeometry; c: string }
type V3 = [number, number, number]

const cache = new Map<string, THREE.BufferGeometry>()
export function geoGuardada(clave: string, crear: () => THREE.BufferGeometry) {
  const g = cache.get(clave)
  if (g) return g
  const n = crear()
  cache.set(clave, n)
  return n
}

export function unir(partes: Parte[]) {
  const gs = partes.map(({ g, c }) => {
    const n = g.index ? g.toNonIndexed() : g.clone()
    n.deleteAttribute("uv")
    const col = new THREE.Color(c)
    const arr = new Float32Array(n.attributes.position.count * 3)
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = col.r
      arr[i + 1] = col.g
      arr[i + 2] = col.b
    }
    n.setAttribute("color", new THREE.BufferAttribute(arr, 3))
    return n
  })
  const r = mergeGeometries(gs) ?? new THREE.BufferGeometry()
  r.computeBoundingSphere()
  return r
}

export function colocar(g: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], esc: V3 = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...esc))
  return g.applyMatrix4(m)
}

export const caja = (w: number, h: number, d: number, pos: V3, rot?: V3) => colocar(new THREE.BoxGeometry(w, h, d), pos, rot)
export const cil = (rt: number, rb: number, h: number, pos: V3, seg = 12, rot?: V3) => colocar(new THREE.CylinderGeometry(rt, rb, h, seg), pos, rot)
export const esfera = (r: number, pos: V3, esc: V3 = [1, 1, 1], seg = 12) => colocar(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75)), pos, [0, 0, 0], esc)

/** Cápsula entre dos puntos. */
export function capsulaEntre(a: V3, b: V3, r: number, seg = 8) {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const dir = vb.clone().sub(va)
  const largo = Math.max(0.001, dir.length())
  const g = new THREE.CapsuleGeometry(r, largo, 3, seg)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  const mid = va.add(vb).multiplyScalar(0.5)
  return g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)))
}

/** Prisma de base rectangular con caída: sirve de mantel largo o de cuerpo de mueble. */
export function faldon(w: number, d: number, h: number, abajo: number, y: number) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * abajo, h, 4, 1).toNonIndexed()
  g.rotateY(Math.PI / 4)
  g.scale(w, 1, d)
  g.translate(0, y, 0)
  g.computeVertexNormals()
  return g
}
