// Copia a cada app (admin y tienda), antes de `npm run dev` y `npm run build`:
// - frontend/assets/colt -> public/colt (fotos y catálogo).
// - frontend/marca -> public/marca (nombre, color y logo). Si existe frontend/marca/<app>, esa app usa
//   esa carpeta en vez de la base: el panel lleva la marca del producto y la tienda la del cliente.
// - frontend/tema + marca.json -> tema/ (preset de Tailwind). Dentro de la app para que Turbopack
//   lo vigile: cambiar el color en marca.json recompila el CSS sin borrar .next.
// Las copias están en .gitignore: la fuente única está en frontend/. Marca y tema siempre se sobrescriben.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const APPS = ['admin', 'tienda']
const app = process.argv[2]
const targets = app ? [app] : APPS
const marcaBase = join(here, '..', 'marca')
// Las subcarpetas con nombre de app son marcas propias de esa app: no se copian a las demás.
const sinSubmarcas = (src) => !APPS.some((a) => src === join(marcaBase, a))

for (const t of targets) {
  const marca = existsSync(join(marcaBase, t)) ? join(marcaBase, t) : marcaBase
  const copias = [
    { src: join(here, '..', 'assets', 'colt'), dir: join('public', 'colt'), force: false },
    { src: join(here, '..', 'assets', 'boca-marina'), dir: join('public', 'boca-marina'), force: true },
    { src: join(here, '..', 'assets', 'max'), dir: join('public', 'max'), force: true },
    { src: marca, dir: join('public', 'marca'), force: true, filter: marca === marcaBase ? sinSubmarcas : undefined },
    { src: join(here, '..', 'tema'), dir: 'tema', force: true },
    { src: join(marca, 'marca.json'), dir: join('tema', 'marca.json'), force: true },
  ]
  for (const { src, dir, force, filter } of copias) {
    if (!existsSync(src)) {
      console.error(`[sync-colt-assets] No existe ${src}`)
      process.exit(1)
    }
    const dest = join(here, '..', t, dir)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(src, dest, { recursive: true, force, errorOnExist: false, filter })
    console.log(`[sync-colt-assets] ${src} -> ${dest}`)
  }
}
