"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { AREAS, PUESTOS_COCINA } from "@/lib/restaurante/plano"
import { aX, aZ, M, PISO_MUELLE, PISO_TIERRA } from "./coords"
import type { Fase } from "./Entorno"
import { TEMAS, type EstiloFino, type LuzFina, type Tema } from "./estilos"
import { matColor } from "./figuras"
import { caja, capsulaEntre, cil, esfera, geoGuardada, unir, type Parte } from "./geo"
import { Llama } from "./MesaFina"
import { texturaBaldosas, texturaBrillo, texturaGrama, texturaLuna, texturaTablas, texturaTerrazo } from "./texturas"
import { DecorTropical, GazeboTropical, ORILLA_PLAYA, Playa, reflejosDecor, TechoTropical, Veleros } from "./Tropical"

const r = (a: { x: number; y: number; w: number; h: number }) => ({ w: a.w * M, d: a.h * M, x: aX(a.x + a.w / 2), z: aZ(a.y + a.h / 2) })
const MU = r(AREAS.muelle)
const TE = r(AREAS.terraza)
const ED = r(AREAS.edificio)

const matVerticesDoble = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })
const matVerticesFino = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })

function conRepeticion(t: THREE.Texture, x: number, y: number) {
  const c = t.clone()
  c.repeat.set(x, y)
  c.needsUpdate = true
  return c
}

/* ---------- Cielo, estrellas y luna ---------- */

function Cielo({ l }: { l: LuzFina }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uArriba: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() }, uSol: { value: new THREE.Color() }, uSolDir: { value: new THREE.Vector3() }, uSolF: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uArriba; uniform vec3 uHorizonte; uniform vec3 uSol; uniform vec3 uSolDir; uniform float uSolF; varying vec3 vDir;
          void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(uHorizonte, uArriba, pow(h, 0.5));
            float s = max(dot(d, normalize(uSolDir)), 0.0); c += uSol * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 1.5) * uSolF;
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  mat.uniforms.uArriba.value.set(l.cieloArriba)
  mat.uniforms.uHorizonte.value.set(l.cieloHorizonte)
  mat.uniforms.uSol.value.set(l.sol)
  mat.uniforms.uSolDir.value.set(...l.solPos).normalize()
  mat.uniforms.uSolF.value = l.luna ? 0.3 : 1
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[170, 32, 16]} />
    </mesh>
  )
}

function Estrellas() {
  const geo = useMemo(() => {
    const n = 500
    const p = new Float32Array(n * 3)
    let s = 5
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const y = 0.08 + rnd() * 0.92
      const k = Math.sqrt(1 - y * y)
      p.set([Math.cos(a) * k * 160, y * 160, Math.sin(a) * k * 160], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  return (
    <points geometry={geo}>
      <pointsMaterial color="#e8eeff" size={1.6} sizeAttenuation={false} transparent opacity={0.75} fog={false} depthWrite={false} />
    </points>
  )
}

function Luna({ l }: { l: LuzFina }) {
  const dir = new THREE.Vector3(l.solPos[0], 0, l.solPos[2]).normalize()
  return (
    <group position={[dir.x * 140, 34, dir.z * 140]}>
      <sprite scale={9}>
        <spriteMaterial map={texturaLuna()} fog={false} toneMapped={false} depthWrite={false} />
      </sprite>
      <sprite scale={42}>
        <spriteMaterial map={texturaBrillo()} color="#7f95c9" blending={THREE.AdditiveBlending} transparent opacity={0.35} fog={false} depthWrite={false} />
      </sprite>
    </group>
  )
}

/* ---------- Agua con caminos de luz y reflejos ---------- */

const MAX_REFLEJOS = 40

function AguaFina({ l, reflejos, calidas, orilla = -3.2 }: { l: LuzFina; reflejos: THREE.Vector3[]; calidas: number; orilla?: number }) {
  const mat = useMemo(() => {
    const luces = Array.from({ length: MAX_REFLEJOS }, () => new THREE.Vector3())
    return new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 },
        uProf: { value: new THREE.Color() },
        uSom: { value: new THREE.Color() },
        uRefl: { value: new THREE.Color() },
        uHoriz: { value: new THREE.Color() },
        uBrillo: { value: new THREE.Color() },
        uBrilloF: { value: 0 },
        uLuz: { value: new THREE.Color("#ffb860") },
        uLuzF: { value: 0 },
        uSolXZ: { value: new THREE.Vector2(1, 0) },
        uLuces: { value: luces },
        uN: { value: 0 },
        uMuelle: { value: new THREE.Vector4(MU.x - MU.w / 2, MU.x + MU.w / 2, MU.z - MU.d / 2, MU.z + MU.d / 2) },
        uTierra: { value: new THREE.Vector4(-19.5, 19.5, -20, -3.2) },
        uClara: { value: new THREE.Color() },
        uClaraF: { value: 0 },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform float uT; uniform vec3 uProf; uniform vec3 uSom; uniform vec3 uRefl; uniform vec3 uHoriz; uniform vec3 uBrillo; uniform float uBrilloF;
        uniform vec3 uLuz; uniform float uLuzF; uniform vec2 uSolXZ; uniform vec3 uLuces[${MAX_REFLEJOS}]; uniform int uN; uniform vec4 uMuelle; uniform vec4 uTierra; uniform vec3 uClara; uniform float uClaraF;
        varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float ruido(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
        float rect(vec2 p, vec4 r){ vec2 d = max(vec2(r.x - p.x, r.z - p.y), vec2(p.x - r.y, p.y - r.w)); return length(max(d, 0.0)); }
        void main(){
          vec2 p = vW.xz;
          float n1 = ruido(p * 0.35 + vec2(uT * 0.05, uT * 0.03));
          float n2 = ruido(vec2(p.x * 1.6 + p.y * 0.4, p.y * 3.2) + vec2(uT * 0.35, -uT * 0.22));
          float n3 = ruido(vec2(p.x * 4.5, p.y * 9.0 + p.x * 1.5) + vec2(uT * 0.8, uT * 0.5));
          float n4 = ruido(vec2(p.x * 11.0 - p.y * 2.0, p.y * 22.0) - vec2(uT * 1.1, uT * 0.4));
          vec3 nrm = normalize(vec3((n2 - 0.5) * 0.14 + (n3 - 0.5) * 0.08, 1.0, (n2 - 0.5) * 0.22 + (n3 - 0.5) * 0.12));
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(V, nrm), 0.0), 3.0);
          float dr = min(rect(p, uMuelle), rect(p, uTierra));
          float som = 1.0 - smoothstep(0.0, 9.0, dr);
          vec3 col = mix(uProf, uSom, som * 0.8);
          col *= 0.95 + n1 * 0.1;
          if (uClaraF > 0.0) {
            float cl = 1.0 - smoothstep(0.0, 3.4, dr);
            float caus = smoothstep(0.6, 0.95, ruido(p * 2.4 + vec2(uT * 0.22, -uT * 0.17)) * 0.6 + ruido(p * 4.7 - vec2(uT * 0.3, uT * 0.21)) * 0.5);
            col = mix(col, uClara, cl * 0.88 * uClaraF);
            col += uClara * cl * caus * 0.22 * uClaraF;
          }
          col = mix(col, uRefl, clamp(fres * 1.4 + 0.05, 0.0, 0.7));
          float olas = smoothstep(0.62, 0.9, n3 * 0.6 + n4 * 0.5);
          col = mix(col, uRefl, olas * 0.12);
          float espuma = (1.0 - smoothstep(0.0, 0.35, dr)) * smoothstep(0.45, 0.8, n3 * 0.6 + n4 * 0.5);
          col = mix(col, uRefl * 1.1 + 0.04, espuma * 0.35);
          vec2 C = cameraPosition.xz; vec2 ax = normalize(uSolXZ); vec2 rel = p - C;
          float al = dot(rel, ax); float ac = dot(rel, vec2(-ax.y, ax.x));
          float ancho = 0.9 + max(al, 0.0) * 0.08;
          float camino = exp(-ac * ac / (2.0 * ancho * ancho)) * smoothstep(2.0, 18.0, al);
          float destello = smoothstep(0.78, 0.98, n4 * 0.7 + n3 * 0.35);
          col += uBrillo * uBrilloF * camino * (0.12 + destello * 0.9);
          col += uBrillo * uBrilloF * 0.06 * smoothstep(0.9, 0.99, n4 * 0.75 + n3 * 0.3);
          if (uLuzF > 0.0) {
            for (int i = 0; i < ${MAX_REFLEJOS}; i++) {
              if (i >= uN) break;
              vec3 L = uLuces[i];
              vec2 a = normalize(L.xz - C + vec2(0.0001));
              vec2 d = p - L.xz;
              float lal = dot(d, a); float lac = dot(d, vec2(-a.y, a.x));
              float w = 0.16 + max(-lal, 0.0) * 0.06;
              float k = exp(-lac * lac / (w * w)) * smoothstep(-4.5, -0.8, lal) * (1.0 - smoothstep(-0.2, 0.6, lal));
              float tiras = 0.3 + 0.9 * smoothstep(0.3, 0.8, ruido(vec2(lac * 6.0, lal * 5.0 + uT * 1.6)));
              col += uLuz * uLuzF * k * tiras * L.y;
            }
          }
          float dist = length(vW - cameraPosition);
          col = mix(col, uHoriz, smoothstep(50.0, 125.0, dist));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  }, [])
  const u = mat.uniforms
  u.uProf.value.set(l.aguaProfunda)
  u.uSom.value.set(l.aguaSomera)
  u.uRefl.value.set(l.aguaReflejo)
  u.uHoriz.value.set(l.cieloHorizonte)
  u.uBrillo.value.set(l.brillo)
  u.uBrilloF.value = l.brilloF
  u.uSolXZ.value.set(l.solPos[0], l.solPos[2]).normalize()
  u.uLuzF.value = Math.min(1.6, calidas * 0.9)
  u.uClara.value.set(l.aguaClara ?? l.aguaSomera)
  u.uClaraF.value = l.aguaClara ? 1 : 0
  ;(u.uTierra.value as THREE.Vector4).w = orilla
  const n = Math.min(MAX_REFLEJOS, reflejos.length)
  for (let i = 0; i < n; i++) (u.uLuces.value as THREE.Vector3[])[i].copy(reflejos[i])
  u.uN.value = n
  useFrame((_, dt) => {
    u.uT.value += dt
  })
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat} receiveShadow={false}>
      <planeGeometry args={[340, 340]} />
    </mesh>
  )
}

/* ---------- Edificio ---------- */

function geoEdificio(estilo: EstiloFino) {
  return geoGuardada(`edificio-${estilo}`, () => {
    const t = TEMAS[estilo]
    const p: Parte[] = []
    const co = r(AREAS.cocina)
    const sa = r(AREAS.salon)
    const ba = r(AREAS.bar)
    const alto = 1.0
    const y = PISO_TIERRA
    const muroH = (x: number, z: number, w: number) => {
      p.push({ g: caja(w, alto, 0.18, [x, y + alto / 2, z]), c: t.muro })
      p.push({ g: caja(w + 0.04, 0.05, 0.24, [x, y + alto + 0.025, z]), c: t.remate })
    }
    const muroV = (x: number, z: number, d: number) => {
      p.push({ g: caja(0.18, alto, d, [x, y + alto / 2, z]), c: t.muro })
      p.push({ g: caja(0.24, 0.05, d + 0.04, [x, y + alto + 0.025, z]), c: t.remate })
    }
    muroH(ED.x, ED.z - ED.d / 2, ED.w)
    muroV(ED.x - ED.w / 2, ED.z, ED.d)
    muroV(ED.x + ED.w / 2, ED.z, ED.d)
    muroV(co.x + co.w / 2 + 0.25, ED.z, ED.d)
    muroV(sa.x + sa.w / 2 + 0.25, ED.z, ED.d)
    muroH(co.x - co.w / 4, ED.z + ED.d / 2, co.w / 2)
    muroH(sa.x - sa.w / 3, ED.z + ED.d / 2, sa.w / 3)
    muroH(sa.x + sa.w / 3, ED.z + ED.d / 2, sa.w / 3)
    muroH(ba.x - ba.w / 3, ED.z + ED.d / 2, ba.w / 3)
    const zc = aZ(AREAS.cocina.y) + 0.45
    for (const k of ["caliente", "fria", "postres"] as const) {
      const x = aX(PUESTOS_COCINA[k].x)
      p.push({ g: caja(1.4, 0.9, 0.7, [x, y + 0.45, zc]), c: t.cocina.mueble })
      p.push({ g: caja(1.46, 0.04, 0.74, [x, y + 0.92, zc]), c: t.cocina.tope })
      if (k === "caliente") for (const [dx, dz] of [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.15], [0.3, 0.15]]) p.push({ g: cil(0.11, 0.11, 0.02, [x + dx, y + 0.95, zc + dz], 16), c: "#2b2b2b" })
      if (k === "fria") for (let i = 0; i < 4; i++) p.push({ g: caja(0.26, 0.05, 0.4, [x - 0.45 + i * 0.3, y + 0.96, zc]), c: ["#e8866a", "#7da35a", "#f1e6cf", "#e9b949"][i] })
    }
    p.push({ g: caja(0.9, 1.9, 0.75, [aX(AREAS.cocina.x) + 0.6, y + 0.95, aZ(AREAS.cocina.y) + 0.5]), c: t.cocina.tope })
    p.push({ g: caja(5.5, 0.9, 0.65, [aX(12), y + 0.45, aZ(AREAS.cocina.y + 6.2)]), c: t.cocina.mueble })
    p.push({ g: caja(5.6, 0.05, 0.75, [aX(12), y + 0.93, aZ(AREAS.cocina.y + 6.2)]), c: t.cocina.tope })
    const xb = ba.x - 0.5
    p.push({ g: caja(7.2, 1.0, 0.6, [xb, y + 0.5, ba.z - 0.2]), c: t.barra.base })
    p.push({ g: caja(7.4, 0.06, 0.78, [xb, y + 1.03, ba.z - 0.18]), c: t.barra.tope })
    if (estilo !== "maqueta") p.push({ g: caja(7.22, 0.04, 0.02, [xb, y + 0.12, ba.z + 0.105]), c: "#b8955a" })
    for (let i = 0; i < 6; i++) {
      const x = ba.x - 3.5 + i * 1.2
      p.push({ g: cil(0.022, 0.022, 0.72, [x, y + 0.36, ba.z + 0.75], 8), c: estilo === "maqueta" ? t.barra.base : "#9a7a4a" })
      p.push({ g: cil(0.17, 0.15, 0.06, [x, y + 0.75, ba.z + 0.75], 18), c: estilo === "maqueta" ? t.barra.tope : t.silla.cojin })
      p.push({ g: cil(0.13, 0.13, 0.015, [x, y + 0.3, ba.z + 0.75], 16), c: estilo === "maqueta" ? t.barra.base : "#9a7a4a" })
    }
    const zs = ED.z - ED.d / 2 + 0.3
    p.push({ g: caja(7, 0.05, 0.3, [ba.x, y + 1.3, zs]), c: t.barra.estante })
    p.push({ g: caja(7, 0.05, 0.3, [ba.x, y + 1.75, zs]), c: t.barra.estante })
    const botellas = estilo === "maqueta" ? ["#f4f1eb", "#e9e4da"] : ["#2f6b4f", "#7a2b2b", "#d8b35a", "#3b5a7a", "#e9e2d0"]
    for (let i = 0; i < 22; i++) {
      for (const yy of [1.33, 1.78]) {
        const x = ba.x - 3.3 + i * 0.31 + (yy > 1.5 ? 0.12 : 0)
        p.push({ g: cil(0.035, 0.04, 0.24, [x, y + yy + 0.12, zs], 8), c: botellas[(i + (yy > 1.5 ? 2 : 0)) % botellas.length] })
        p.push({ g: cil(0.012, 0.016, 0.08, [x, y + yy + 0.28, zs], 6), c: botellas[(i + (yy > 1.5 ? 2 : 0)) % botellas.length] })
      }
    }
    for (const x of [sa.x - sa.w / 2 + 0.6, sa.x + sa.w / 2 - 0.6, ba.x + ba.w / 2 - 0.6]) {
      const z = ED.z + ED.d / 2 - 0.6
      p.push({ g: cil(0.24, 0.18, 0.5, [x, y + 0.25, z], 16), c: estilo === "maqueta" ? "#ffffff" : estilo === "noche" ? "#2a2420" : "#d9c3a0" })
      p.push({ g: esfera(0.36, [x, y + 0.85, z], [1, 1.15, 1], 12), c: t.palma.hoja })
      p.push({ g: esfera(0.26, [x + 0.12, y + 1.15, z - 0.05], [1, 1, 1], 10), c: t.palma.hoja2 })
    }
    return unir(p)
  })
}

function EdificioFino({ t, estilo, calidas }: { t: Tema; estilo: EstiloFino; calidas: number }) {
  const sa = r(AREAS.salon)
  const ba = r(AREAS.bar)
  const co = r(AREAS.cocina)
  const pisos = useMemo(() => {
    const vet = t.vetas
    return {
      salon: conRepeticion(texturaTablas(t.pisoSalon[0], t.pisoSalon[1], "rgba(0,0,0,0.25)", 8, vet), 3, 1.5),
      cocina: conRepeticion(texturaBaldosas(t.pisoCocina[0], t.pisoCocina[1], 4), 6, 2.5),
      bar: conRepeticion(texturaBaldosas(t.pisoBar[0], t.pisoBar[1], 3), 4, 1.5),
    }
  }, [t])
  const geo = useMemo(() => geoEdificio(estilo), [estilo])
  const matRetro = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffb357", toneMapped: false, transparent: true, opacity: 0.85 }), [])
  return (
    <group>
      <mesh position={[0, PISO_TIERRA / 2, ED.z - 1]} receiveShadow>
        <boxGeometry args={[ED.w + 8, PISO_TIERRA, ED.d + 6]} />
        <meshStandardMaterial color={t.piedra} roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, -3.2]} receiveShadow>
        <boxGeometry args={[ED.w + 8, 0.24, 1.2]} />
        <meshStandardMaterial color={t.arena} roughness={1} />
      </mesh>
      <mesh position={[co.x, PISO_TIERRA + 0.005, co.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[co.w, co.d]} />
        <meshStandardMaterial map={pisos.cocina} roughness={0.55} />
      </mesh>
      <mesh position={[sa.x, PISO_TIERRA + 0.005, sa.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[sa.w, sa.d]} />
        <meshStandardMaterial map={pisos.salon} roughness={0.6} />
      </mesh>
      <mesh position={[ba.x, PISO_TIERRA + 0.005, ba.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ba.w, ba.d]} />
        <meshStandardMaterial map={pisos.bar} roughness={0.5} />
      </mesh>
      <mesh geometry={geo} material={matVerticesFino} castShadow receiveShadow />
      {calidas > 0 && (
        <mesh position={[ba.x, PISO_TIERRA + 1.55, ED.z - ED.d / 2 + 0.12]} material={matRetro}>
          <planeGeometry args={[7, 0.9]} />
        </mesh>
      )}
    </group>
  )
}

/* ---------- Muelle, terraza, grama y baranda ---------- */

function MuelleFino({ t, estilo }: { t: Tema; estilo: EstiloFino }) {
  const gr = r(AREAS.grama)
  const pu = r(AREAS.punta)
  const tex = useMemo(
    () => ({
      muelle: conRepeticion(texturaTablas(t.muelle[0], t.muelle[1], t.muelle[2], 8, t.vetas), 5, 4),
      punta: (() => {
        const x = conRepeticion(texturaTablas(t.punta[0], t.punta[1], t.punta[2], 8, t.vetas), 2, 6)
        x.rotation = Math.PI / 2
        return x
      })(),
      terraza:
        t.deco?.pisoTerraza === "terrazo"
          ? conRepeticion(texturaTerrazo(t.terraza[0], ["#f2b8a2", "#a8e0cf", "#e9dccb", "#d9c3a0", "#ffffff"]), 5, 1.4)
          : t.deco?.pisoTerraza === "tablas"
            ? conRepeticion(texturaTablas(t.terraza[0], t.terraza[1], "rgba(29,53,87,0.35)", 10, 0.4), 5, 1.4)
            : conRepeticion(texturaBaldosas(t.terraza[0], t.terraza[1], 4), 9, 2.5),
      grama: conRepeticion(texturaGrama(t.grama), 3, 2),
    }),
    [t],
  )
  const postes = useRef<THREE.InstancedMesh>(null)
  const pilotes = useRef<THREE.InstancedMesh>(null)
  const pos = useMemo(() => {
    const p: [number, number][] = []
    const z0 = TE.z + TE.d / 2
    const z1 = MU.z + MU.d / 2 - 0.08
    const n = Math.round((z1 - z0) / 1.2)
    for (let i = 0; i <= n; i++) {
      p.push([MU.x - MU.w / 2 + 0.08, z0 + ((z1 - z0) * i) / n], [MU.x + MU.w / 2 - 0.08, z0 + ((z1 - z0) * i) / n])
    }
    const m = Math.round(MU.w / 1.2)
    for (let i = 1; i < m; i++) p.push([MU.x - MU.w / 2 + (MU.w * i) / m, z1])
    return p
  }, [])
  const posPil = useMemo(() => {
    const p: [number, number][] = []
    for (let i = 0; i <= 8; i++) {
      const z = MU.z - MU.d / 2 + 0.4 + (i * (MU.d - 0.8)) / 8
      p.push([MU.x - MU.w / 2 - 0.12, z], [MU.x + MU.w / 2 + 0.12, z])
    }
    for (let i = 1; i < 9; i++) p.push([MU.x - MU.w / 2 + (i * MU.w) / 9, MU.z + MU.d / 2 + 0.12])
    return p
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    pos.forEach(([x, z], i) => postes.current?.setMatrixAt(i, m.makeTranslation(x, PISO_MUELLE + 0.5, z)))
    if (postes.current) postes.current.instanceMatrix.needsUpdate = true
    posPil.forEach(([x, z], i) => pilotes.current?.setMatrixAt(i, m.makeTranslation(x, -0.2, z)))
    if (pilotes.current) pilotes.current.instanceMatrix.needsUpdate = true
  }, [pos, posPil])
  const z0 = TE.z + TE.d / 2
  const z1 = MU.z + MU.d / 2 - 0.08
  const largoLado = z1 - z0
  const barandaMat = matColor(t.baranda, estilo === "noche" ? 0.4 : 0.6)
  return (
    <group>
      <mesh position={[MU.x, PISO_MUELLE / 2 - 0.02, MU.z]} castShadow receiveShadow>
        <boxGeometry args={[MU.w, PISO_MUELLE - 0.04, MU.d]} />
        <meshStandardMaterial color={t.canto} roughness={0.9} />
      </mesh>
      <mesh position={[MU.x, PISO_MUELLE, MU.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[MU.w, MU.d]} />
        <meshStandardMaterial map={tex.muelle} roughness={0.8} />
      </mesh>
      <mesh position={[TE.x, PISO_MUELLE + 0.004, TE.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[TE.w, TE.d]} />
        <meshStandardMaterial map={tex.terraza} roughness={0.6} />
      </mesh>
      <mesh position={[pu.x, PISO_MUELLE + 0.004, pu.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[pu.w, pu.d]} />
        <meshStandardMaterial map={tex.punta} roughness={0.8} />
      </mesh>
      <mesh position={[gr.x, PISO_MUELLE + 0.05, gr.z]} receiveShadow>
        <boxGeometry args={[gr.w + 0.3, 0.1, gr.d + 0.3]} />
        <meshStandardMaterial color={t.borde} roughness={0.8} />
      </mesh>
      <mesh position={[gr.x, PISO_MUELLE + 0.105, gr.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[gr.w, gr.d]} />
        <meshStandardMaterial map={tex.grama} roughness={1} />
      </mesh>
      <instancedMesh ref={postes} args={[undefined, undefined, pos.length]} material={barandaMat} castShadow>
        <boxGeometry args={[0.05, 1.0, 0.05]} />
      </instancedMesh>
      <instancedMesh ref={pilotes} args={[undefined, undefined, posPil.length]} material={matColor(t.pilote, 0.95)}>
        <cylinderGeometry args={[0.13, 0.15, 1.2, 10]} />
      </instancedMesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[MU.x + s * (MU.w / 2 - 0.08), PISO_MUELLE + 1.0, z0 + largoLado / 2]} material={barandaMat}>
            <boxGeometry args={[0.08, 0.04, largoLado]} />
          </mesh>
          {[0.4, 0.7].map((h) => (
            <mesh key={h} position={[MU.x + s * (MU.w / 2 - 0.08), PISO_MUELLE + h, z0 + largoLado / 2]} material={matColor(estilo === "maqueta" ? "#ffffff" : "#a7adb0", 0.3)}>
              <boxGeometry args={[0.012, 0.012, largoLado]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[MU.x, PISO_MUELLE + 1.0, z1]} material={barandaMat}>
        <boxGeometry args={[MU.w, 0.04, 0.08]} />
      </mesh>
      {[0.4, 0.7].map((h) => (
        <mesh key={h} position={[MU.x, PISO_MUELLE + h, z1]} material={matColor(estilo === "maqueta" ? "#ffffff" : "#a7adb0", 0.3)}>
          <boxGeometry args={[MU.w, 0.012, 0.012]} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- Pérgola de la terraza ---------- */

const POSTES_TERRAZA: [number, number][] = (() => {
  const p: [number, number][] = []
  for (let i = 0; i <= 6; i++) {
    const x = TE.x - TE.w / 2 + 0.2 + (i * (TE.w - 0.4)) / 6
    p.push([x, TE.z - TE.d / 2 + 0.2], [x, TE.z + TE.d / 2 - 0.2])
  }
  return p
})()

function Pergola({ t, oculto, sombras }: { t: Tema; oculto: boolean; sombras: boolean }) {
  const alto = 3
  const postes = useRef<THREE.InstancedMesh>(null)
  const listones = useRef<THREE.InstancedMesh>(null)
  const nListones = 34
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    POSTES_TERRAZA.forEach(([x, z], i) => postes.current?.setMatrixAt(i, m.makeTranslation(x, PISO_MUELLE + alto / 2, z)))
    if (postes.current) postes.current.instanceMatrix.needsUpdate = true
    for (let i = 0; i < nListones; i++) listones.current?.setMatrixAt(i, m.makeTranslation(TE.x - TE.w / 2 + 0.3 + (i * (TE.w - 0.6)) / (nListones - 1), PISO_MUELLE + alto + 0.16, TE.z))
    if (listones.current) listones.current.instanceMatrix.needsUpdate = true
  }, [oculto])
  const mat = matColor(t.pergola, 0.7)
  return (
    <group>
      <instancedMesh ref={postes} args={[undefined, undefined, POSTES_TERRAZA.length]} material={mat} castShadow={sombras}>
        <boxGeometry args={[0.14, alto, 0.14]} />
      </instancedMesh>
      {!oculto && (
        <>
          {[TE.z - TE.d / 2 + 0.2, TE.z + TE.d / 2 - 0.2].map((z) => (
            <mesh key={z} position={[TE.x, PISO_MUELLE + alto + 0.05, z]} material={mat} castShadow={sombras}>
              <boxGeometry args={[TE.w, 0.16, 0.12]} />
            </mesh>
          ))}
          <instancedMesh ref={listones} args={[undefined, undefined, nListones]} material={mat} castShadow={sombras}>
            <boxGeometry args={[0.05, 0.12, TE.d]} />
          </instancedMesh>
        </>
      )}
    </group>
  )
}

/* ---------- Gazebo ---------- */

function GazeboFino({ t, calidas }: { t: Tema; calidas: number }) {
  const x = aX(32)
  const z = aZ(38)
  const lado = 3.2
  const alto = 2.6
  const cortina = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.7, alto - 0.15, 10, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 18) * 0.04)
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group position={[x, PISO_MUELLE, z]}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
        <group key={i}>
          <mesh position={[(a * lado) / 2, alto / 2, (b * lado) / 2]} material={matColor(t.gazebo, 0.5)} castShadow>
            <cylinderGeometry args={[0.06, 0.07, alto, 14]} />
          </mesh>
          <mesh geometry={cortina} position={[(a * lado) / 2 - a * 0.28, alto / 2 + 0.05, (b * lado) / 2]} rotation-y={Math.PI / 2}>
            <meshStandardMaterial color={t.tela} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`a${i}`} position={[Math.sin((i * Math.PI) / 2) * (lado / 2), alto, Math.cos((i * Math.PI) / 2) * (lado / 2)]} rotation-y={(i * Math.PI) / 2} material={matColor(t.gazebo, 0.5)}>
          <boxGeometry args={[lado + 0.1, 0.1, 0.1]} />
        </mesh>
      ))}
      <mesh position={[0, alto + 0.45, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[lado * 0.76, 0.9, 4, 1, true]} />
        <meshStandardMaterial color={t.tela} roughness={0.7} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, alto + 0.95, 0]} material={matColor(t.gazebo, 0.5)}>
        <sphereGeometry args={[0.07, 12, 8]} />
      </mesh>
      {calidas > 0 && <Llama x={0} y={alto - 0.25} z={0} fuerza={calidas * 1.4} charco={0.01} />}
    </group>
  )
}

/* ---------- Bombillos en cuerda ---------- */

type Tramo = { a: [number, number, number]; b: [number, number, number]; caida: number }

const POSTES_MUELLE: [number, number][] = [-1, 1].flatMap((s) => [0.3, 2.9, 5.6, 10.2].map((z) => [s * 9.25, z] as [number, number]))

const TRAMOS: Tramo[] = (() => {
  const t: Tramo[] = []
  const atras = POSTES_TERRAZA.filter((_, i) => i % 2 === 0)
  const frente = POSTES_TERRAZA.filter((_, i) => i % 2 === 1)
  for (let i = 0; i < 6; i++) {
    t.push({ a: [atras[i][0], 2.85, atras[i][1]], b: [frente[i + 1][0], 2.85, frente[i + 1][1]], caida: 0.35 })
    t.push({ a: [frente[i][0], 2.75, frente[i][1]], b: [frente[i + 1][0], 2.75, frente[i + 1][1]], caida: 0.25 })
  }
  for (const s of [-1, 1]) {
    const zs = [0.3, 2.9, 5.6, 10.2]
    t.push({ a: [s * 8.8 + s * 0.05, 2.75, frente[s < 0 ? 0 : 6][1]], b: [s * 9.25, 3.0, zs[0]], caida: 0.1 })
    for (let i = 0; i < zs.length - 1; i++) t.push({ a: [s * 9.25, 3.0, zs[i]], b: [s * 9.25, 3.0, zs[i + 1]], caida: 0.35 })
  }
  t.push({ a: [-9.25, 3.0, 2.9], b: [9.25, 3.0, 2.9], caida: 0.85 })
  t.push({ a: [-9.25, 3.0, 5.6], b: [9.25, 3.0, 5.6], caida: 0.85 })
  t.push({ a: [-9.25, 3.0, 10.2], b: [9.25, 3.0, 10.2], caida: 0.7 })
  return t
})()

function trazar() {
  const bombillos: THREE.Vector3[] = []
  const cable: number[] = []
  for (const tr of TRAMOS) {
    const a = new THREE.Vector3(...tr.a)
    const b = new THREE.Vector3(...tr.b)
    const en = (k: number) => a.clone().lerp(b, k).add(new THREE.Vector3(0, -tr.caida * 4 * k * (1 - k), 0))
    const largo = a.distanceTo(b)
    const seg = Math.max(6, Math.round(largo * 2))
    for (let i = 0; i < seg; i++) cable.push(...en(i / seg).toArray(), ...en((i + 1) / seg).toArray())
    const n = Math.max(2, Math.round(largo / 0.45))
    for (let i = 1; i < n; i++) bombillos.push(en(i / n).add(new THREE.Vector3(0, -0.06, 0)))
  }
  const reflejos = bombillos
    .filter((p) => Math.abs(p.x) > 9 || p.z > 10)
    .filter((_, i) => i % 2 === 0)
    .map((p) => new THREE.Vector3(p.x + Math.sign(p.x) * (Math.abs(p.x) > 9 ? 0.6 : 0), 0.9, p.z + (p.z > 10 ? 0.6 : 0)))
  return { bombillos, cable: new Float32Array(cable), reflejos }
}
const LUCES = trazar()

function Guirnaldas({ estilo, calidas }: { estilo: EstiloFino; calidas: number }) {
  const bombillos = useRef<THREE.InstancedMesh>(null)
  const postes = useRef<THREE.InstancedMesh>(null)
  const geoCable = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(LUCES.cable, 3))
    return g
  }, [])
  const geoPuntos = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LUCES.bombillos.flatMap((p) => p.toArray())), 3))
    return g
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    LUCES.bombillos.forEach((p, i) => bombillos.current?.setMatrixAt(i, m.makeTranslation(p.x, p.y + PISO_MUELLE, p.z)))
    if (bombillos.current) bombillos.current.instanceMatrix.needsUpdate = true
    POSTES_MUELLE.forEach(([x, z], i) => postes.current?.setMatrixAt(i, m.makeTranslation(x, PISO_MUELLE + 1.55, z)))
    if (postes.current) postes.current.instanceMatrix.needsUpdate = true
  }, [])
  const encendido = calidas > 0
  const matBombillo = useMemo(
    () => (encendido ? new THREE.MeshBasicMaterial({ color: "#fff1cc", toneMapped: false }) : new THREE.MeshStandardMaterial({ color: "#efeadf", roughness: 0.2 })),
    [encendido],
  )
  const halo = useRef<THREE.PointsMaterial>(null)
  useFrame(({ clock }) => {
    if (halo.current) halo.current.opacity = Math.min(1, 0.6 * calidas) * (0.94 + Math.sin(clock.getElapsedTime() * 1.3) * 0.06)
  })
  return (
    <group>
      <instancedMesh ref={postes} args={[undefined, undefined, POSTES_MUELLE.length]} material={matColor(TEMAS[estilo].deco?.poste ?? (estilo === "maqueta" ? "#ffffff" : estilo === "noche" ? "#1d2a2c" : "#6e5038"), 0.6)} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 3.1, 8]} />
      </instancedMesh>
      <lineSegments geometry={geoCable} position-y={PISO_MUELLE}>
        <lineBasicMaterial color={estilo === "maqueta" ? "#bdb5a6" : "#2a2420"} transparent opacity={0.55} />
      </lineSegments>
      <instancedMesh ref={bombillos} args={[undefined, undefined, LUCES.bombillos.length]} material={matBombillo}>
        <sphereGeometry args={[0.04, 8, 6]} />
      </instancedMesh>
      {encendido && (
        <points geometry={geoPuntos} position-y={PISO_MUELLE}>
          <pointsMaterial ref={halo} map={texturaBrillo()} color="#ffb35c" size={estilo === "noche" ? 1.15 : 0.85} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
      )}
    </group>
  )
}

/* ---------- Palmas ---------- */

function geoPalma(estilo: EstiloFino) {
  return geoGuardada(`palma-${estilo}`, () => {
    const t = TEMAS[estilo]
    const p: Parte[] = []
    const alto = 4.2
    const curva = (k: number): [number, number, number] => [Math.sin(k * 1.2) * 0.45, k * alto, 0]
    const nT = 9
    for (let i = 0; i < nT; i++) {
      const a = curva(i / nT)
      const b = curva((i + 1) / nT)
      p.push({ g: capsulaEntre(a, b, 0.13 - i * 0.006, 8), c: i % 2 ? t.palma.tronco : new THREE.Color(t.palma.tronco).multiplyScalar(0.88).getStyle() })
    }
    const copa = curva(1)
    const hojas = 11
    for (let h = 0; h < hojas; h++) {
      const L = 2.0 + ((h * 37) % 5) * 0.12
      const ang = (h / hojas) * Math.PI * 2 + (h % 2) * 0.2
      const alza = h % 3 === 0 ? 0.55 : h % 3 === 1 ? 0.2 : -0.05
      const N = 10
      const pos: number[] = []
      const idx: number[] = []
      for (let i = 0; i <= N; i++) {
        const k = i / N
        const cx = L * k
        const cy = L * (alza * k - 0.55 * k * k)
        const w = 0.42 * Math.pow(1 - k, 0.7) * Math.min(1, k * 5 + 0.15)
        pos.push(cx, cy - w * 0.25, -w / 2, cx, cy + 0.02, 0, cx, cy - w * 0.25, w / 2)
        if (i < N) {
          const o = i * 3
          idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length).fill(0), 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      g.rotateY(ang)
      g.translate(copa[0], copa[1], copa[2])
      p.push({ g, c: h % 2 ? t.palma.hoja : t.palma.hoja2 })
    }
    if (estilo !== "maqueta") for (let i = 0; i < 3; i++) p.push({ g: esfera(0.08, [copa[0] + Math.cos(i * 2.1) * 0.12, copa[1] - 0.12, Math.sin(i * 2.1) * 0.12], [1, 1, 1], 8), c: "#6b4a2b" })
    return unir(p)
  })
}

function Palmas({ estilo }: { estilo: EstiloFino }) {
  const g = useMemo(() => geoPalma(estilo), [estilo])
  const lugares: [number, number, number, number][] = [
    [-14, -4.6, 0.95, 0.3],
    [-11.5, -5.1, 1.1, 2.4],
    [11, -4.6, 1.0, 3.6],
    [13.5, -5.1, 0.9, 1.2],
    [-15.5, -6.2, 1.15, 4.4],
    [15.5, -6.0, 1.05, 5.5],
    [-17.5, -4.4, 0.85, 1.9],
    [17.5, -4.8, 0.95, 0.8],
  ]
  return (
    <>
      {lugares.map(([x, z, s, rot], i) => (
        <mesh key={i} geometry={g} material={matVerticesDoble} position={[x, PISO_TIERRA, z]} rotation-y={rot} scale={s} castShadow />
      ))}
    </>
  )
}

/* ---------- Bote ---------- */

function BoteFino({ t, calidas }: { t: Tema; calidas: number }) {
  const ref = useRef<THREE.Group>(null)
  const casco = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-1.3, -0.45)
    s.lineTo(0.6, -0.45)
    s.quadraticCurveTo(1.35, -0.3, 1.6, 0)
    s.quadraticCurveTo(1.35, 0.3, 0.6, 0.45)
    s.lineTo(-1.3, 0.45)
    s.lineTo(-1.3, -0.45)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const k = clock.getElapsedTime() * 0.25
    ref.current.position.x = ((k * 6) % 80) - 40
    ref.current.position.y = 0.02 + Math.sin(k * 6) * 0.03
    ref.current.rotation.z = Math.sin(k * 5) * 0.02
  })
  return (
    <group ref={ref} position={[-40, 0.02, 18]}>
      <mesh geometry={casco} material={matColor(t.bote.casco, 0.35)} castShadow />
      <mesh position={[-0.2, 0.62, 0]} material={matColor(t.bote.cabina, 0.4)} castShadow>
        <boxGeometry args={[0.9, 0.42, 0.66]} />
      </mesh>
      {calidas > 0 && (
        <>
          <mesh position={[0.26, 0.64, 0]}>
            <boxGeometry args={[0.02, 0.18, 0.5]} />
            <meshBasicMaterial color="#ffcf85" toneMapped={false} />
          </mesh>
          <sprite position={[-0.2, 1.4, 0]} scale={0.6}>
            <spriteMaterial map={texturaBrillo()} color="#ffffff" blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </>
      )}
      <mesh position={[-0.2, 1.15, 0]} material={matColor(t.bote.casco)}>
        <cylinderGeometry args={[0.015, 0.015, 0.7, 6]} />
      </mesh>
    </group>
  )
}

/* ---------- Luz y tono ---------- */

function Tono({ exposicion }: { exposicion: number }) {
  const { gl, scene } = useThree()
  useLayoutEffect(() => {
    const antes = { t: gl.toneMapping, e: gl.toneMappingExposure }
    gl.toneMapping = THREE.NeutralToneMapping
    gl.toneMappingExposure = exposicion
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      ;(Array.isArray(m) ? m : m ? [m] : []).forEach((x) => (x.needsUpdate = true))
    })
    return () => {
      gl.toneMapping = antes.t
      gl.toneMappingExposure = antes.e
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        ;(Array.isArray(m) ? m : m ? [m] : []).forEach((x) => (x.needsUpdate = true))
      })
    }
  }, [gl, scene, exposicion])
  return null
}

const LAMPARAS: [number, number, number][] = [
  [-5.5, 2.5, -2.5],
  [0, 2.5, -2.5],
  [5.5, 2.5, -2.5],
  [0, 2.3, 7.5],
  [-3, 2.4, 3.6],
  [4, 2.4, 3.6],
  [-0.5, 1.9, -8],
  [9, 1.9, -8.5],
]

export function EntornoFino({
  estilo,
  fase,
  techoOculto = false,
  sombras,
  liviano,
}: {
  estilo: EstiloFino
  fase: Fase
  techoOculto?: boolean
  sombras: boolean
  liviano: boolean
}) {
  const t = TEMAS[estilo]
  const l = t.luz[fase]
  const lamparas = liviano ? LAMPARAS.slice(0, 4) : LAMPARAS
  const d = t.deco
  const reflejos = useMemo(() => (d ? [...reflejosDecor(estilo), ...(d.luces.guirnalda ? LUCES.reflejos : [])].slice(0, 40) : LUCES.reflejos), [d, estilo])
  return (
    <>
      <Tono exposicion={l.exposicion} />
      <color attach="background" args={[l.cieloHorizonte]} />
      <fog attach="fog" args={[l.cieloHorizonte, 50, 125]} />
      <Cielo l={l} />
      {l.estrellas && !liviano && <Estrellas />}
      {l.luna && <Luna l={l} />}
      <hemisphereLight args={[l.hemiCielo, l.hemiSuelo, l.hemi]} />
      <directionalLight
        position={l.solPos}
        intensity={l.solI}
        color={l.sol}
        castShadow={sombras}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-far={90}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-radius={estilo === "maqueta" ? 6 : 3}
      />
      {l.calidas > 0 &&
        lamparas.map((p, i) => <pointLight key={i} position={p} intensity={(estilo === "noche" ? 3.6 : 5) * l.calidas} distance={9} decay={1.6} color="#ffc27a" />)}
      {l.calidas > 0 && !liviano && <pointLight position={[-10, 2.2, -8.6]} intensity={4 * l.calidas} distance={10} decay={1.6} color="#fff1dc" />}
      <AguaFina l={l} reflejos={reflejos} calidas={l.calidas} orilla={d?.playa ? ORILLA_PLAYA : -3.2} />
      <EdificioFino t={t} estilo={estilo} calidas={l.calidas} />
      <MuelleFino t={t} estilo={estilo} />
      {d ? <TechoTropical estilo={estilo} oculto={techoOculto} sombras={sombras} calidas={l.calidas} /> : <Pergola t={t} oculto={techoOculto} sombras={sombras} />}
      {d && d.gazebo !== "tela" ? <GazeboTropical estilo={estilo} calidas={l.calidas} sombras={sombras} /> : <GazeboFino t={t} calidas={l.calidas} />}
      {(!d || d.luces.guirnalda) && <Guirnaldas estilo={estilo} calidas={l.calidas} />}
      {d ? <DecorTropical estilo={estilo} calidas={l.calidas} sombras={sombras} /> : <Palmas estilo={estilo} />}
      {d?.playa && <Playa t={t} />}
      {d?.botes === "veleros" && <Veleros sombras={sombras} />}
      <BoteFino t={t} calidas={l.calidas} />
    </>
  )
}
