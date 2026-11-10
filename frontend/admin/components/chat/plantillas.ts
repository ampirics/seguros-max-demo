export const MOTIVOS_CORRECCION: { valor: string; texto: string }[] = [
  { valor: 'lado_equivocado', texto: 'Lado equivocado' },
  { valor: 'pieza_equivocada', texto: 'Pieza equivocada' },
  { valor: 'vehiculo_equivocado', texto: 'Vehículo equivocado' },
  { valor: 'cantidad', texto: 'Cantidad' },
  { valor: 'precio', texto: 'Precio' },
  { valor: 'sin_existencia', texto: 'Sin existencia' },
  { valor: 'otro', texto: 'Otro' },
]

export const motivoCorreccionTexto = (motivo: string) =>
  MOTIVOS_CORRECCION.find((m) => m.valor === motivo)?.texto.toLowerCase() ?? motivo

// Mismos textos que envía el backend al rechazar o corregir una cotización (contrato/cotizaciones.md).
export const plantillaRechazo = (codigo: string, nombre?: string | null) =>
  `Hola${nombre ? `, ${nombre}` : ''}. Revisamos tu cotización ${codigo} y no está correcta, así que no la uses. Te preparo una nueva y te la mando por aquí.`

export const plantillaCorreccion = (codigo: string, version: number, motivo: string, nombre?: string | null) =>
  `Hola${nombre ? `, ${nombre}` : ''}. Corregimos tu cotización ${codigo} (${motivoCorreccionTexto(motivo)}). Te mando la versión ${version}, que reemplaza a la anterior.`
