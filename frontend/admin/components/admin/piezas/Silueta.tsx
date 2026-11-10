// Dibujo lateral de referencia por tipo de carrocería (public/vehiculos), recortado a 20:9 con el frente a la izquierda.
// Las zonas del backend van en fracciones de este mismo recorte.

export type Carroceria = 'sedan' | 'yipeta' | 'camioneta' | 'van'

export const NOMBRE_CARROCERIA: Record<Carroceria, string> = {
  sedan: 'sedán',
  yipeta: 'yipeta',
  camioneta: 'camioneta',
  van: 'van',
}

export function Silueta({ carroceria }: { carroceria: Carroceria }) {
  return (
    <img
      src={`/vehiculos/${carroceria}.svg`}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-contain opacity-80 dark:invert"
    />
  )
}
