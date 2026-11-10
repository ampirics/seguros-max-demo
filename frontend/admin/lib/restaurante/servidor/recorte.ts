import type { Estado } from "../tipos"

/** Lo que viaja al navegador en cada actualización: sin la historia larga de eventos. */
export function recorte(e: Estado): Estado {
  return { ...e, ahora: Date.now(), eventos: e.eventos.slice(0, 80) }
}
