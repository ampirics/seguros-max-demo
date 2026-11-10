# Diseño: Ora

Sistema de diseño del panel (`admin/`) y la tienda (`tienda/`). Lenguaje visual de WhatsApp: superficies gris
azulado, esquinas redondeadas, sombras leves y un solo color de acento. Cada cliente cambia ese
color, su logo y su nombre sin tocar código.

## Cambiar la marca de un cliente

Hay dos caminos. Los dos producen lo mismo.

1. **Pantalla Marca** (`/admin/marca`, solo administradores): nombre, color, logo, modo por defecto y esquinas, con
   vista previa en claro y oscuro. Se guarda con `PUT /marca` (ver `contrato/marca.md`); en modo mock, en el navegador.
2. **Archivo** `frontend/marca/marca.json`, para dejar la marca fija en una instalación:

```json
{
  "nombre": "Ora",
  "color": "#25D366",
  "logo": "/marca/logo.svg",
  "modo": "oscuro",
  "esquinas": "suaves"
}
```

El logo va en `frontend/marca/` (SVG o PNG transparente) y se referencia como `/marca/<archivo>`. Después de editar,
reinicia `npm run dev` (o vuelve a construir): `scripts/sync-colt-assets.mjs` copia la marca a cada app.

Valores por defecto: colores de WhatsApp (`#25D366`) y el logo de Ora.

**Marca propia por app.** Si existe `frontend/marca/<app>/` (por ejemplo `frontend/marca/tienda/`), esa app usa esa
carpeta completa en lugar de la base. Para la demo, el panel (`frontend/marca/admin/`) y la tienda
(`frontend/marca/tienda/`) llevan la marca del cliente (Repuestos La Casa del Colt: rojo `#E8141C`, modo claro, logo
vectorial); sin esas carpetas vuelven a Ora. Si el logo no se lee sobre fondo oscuro, agrega
`"logoOscuro": "/marca/logo-oscuro.svg"` con una versión de letras claras; se muestra en modo oscuro. Si el logo ya
trae el nombre escrito, agrega `"logoConNombre": true` y el panel no lo repite al lado.

## Cómo funciona el color

- Todo color de la interfaz es un token CSS. La marca es uno solo: `--marca`.
- `--primary` se deriva de `--marca`: en claro se oscurece hasta tener contraste sobre blanco; en oscuro se aclara.
  El texto sobre el primario (`--primary-foreground`) es negro o blanco según la luz del color. Un amarillo o un
  verde claro siguen siendo legibles sin configurar nada.
- `blue`, `indigo` y `sky` de Tailwind son la escala de la marca: el código heredado con `bg-blue-600` toma el color
  del cliente.
- `gray`, `red`, `green`, `amber` y demás también son tokens: en oscuro los tintes (50-300) se oscurecen y los tonos
  de texto (700-950) se aclaran. `bg-red-50 text-red-700` funciona en los dos modos.
- `bg-white` pasa a `--card` en oscuro.

Fuente única: `frontend/tema/tailwind.cjs` (preset compartido). Las apps usan una copia en `admin/tema` y
`tienda/tema` que hace el script al arrancar; no la edites ahí.

## Tokens

| Token | Claro | Oscuro | Uso |
|-------|-------|--------|-----|
| `background` | #f0f2f5 | #0b141a | Fondo de página |
| `card` | blanco | #111b21 | Tarjetas, paneles |
| `secondary` / `popover` | gris claro | #202c33 | Chips, menús, elemento elevado |
| `foreground` | #111b21 | #e9edef | Texto |
| `muted-foreground` | #667781 | #8696a0 | Texto secundario |
| `border` | gris azulado claro | gris azulado oscuro | Líneas finas |
| `primary` | marca, L ≤ 0.55 | marca, L ≥ 0.7 | Acción principal, activo, foco |
| `accent` | 10 % de primario | 14 % de primario | Fondo de elemento activo |
| `success` `warning` `info` `destructive` | | | Estados, con su versión `-soft` |
| `chat` | beige claro | azul noche | Fondo del área de mensajes (bandeja, asistente) |
| `foto` | blanco | gris claro | Marco de fotos de producto; en oscuro la foto lleva `dark:brightness-90` |

Esquinas: `esquinas: "suaves"` (por defecto) da `--radius` de 12 px para tarjetas y campos y `--radius-control` en
9 px para botones, chips y badges (`rounded-control`), la misma forma que campos y selects. `"rectas"` pone ambos en 0. Todas las clases `rounded-*`
salen de `--radius`, salvo `rounded-full`. Los grises (`gray`, `slate`...) llevan el mismo tinte azulado.

## Tipografía

- **Lexend** (`font-display`), 600: títulos, nombres, cifras grandes. `h1`, `h2` y `h3` la usan por defecto.
- **Geist** (`font-sans`): texto e interfaz.
- **Geist Mono** (`font-mono`): códigos.
- Texto en mayúscula inicial, sin mayúsculas forzadas ni itálica en títulos.
- `.etiqueta`: rótulo de 13 px en gris para secciones y grupos del menú.

## Componentes

- **Botones** (`components/ui/button.tsx`): esquinas de 9 px como los selects, 14 px, peso medio. Al presionar bajan 1 px.
- **Tarjetas**: borde fino y sombra leve (`shadow-sm`). Menús, diálogos y popovers usan `shadow-md`.
- **Pestañas**: chips como los filtros de WhatsApp; la activa se tiñe con la marca (`accent`).
- **Elemento activo** (menú lateral, selección): fondo `accent` y texto `accent-foreground`.
- **Burbujas de chat**: cliente en `card`, bot en `accent`, agente en `primary`; todas con `shadow-sm`.
- **Badges**: esquinas de 9 px, 12 px.

## Patrones de pantalla

Referencia: `admin/app/admin/products/page.tsx`, `orders/page.tsx`, `chat/page.tsx`.

- **Título**: el del encabezado (`AdminLayout title`) es el nombre del menú. La página no repite un h1; arriba va una
  fila con la descripción en gris y las acciones principales a la derecha.
- **Barra de búsqueda y filtros**: en línea, sin tarjeta alrededor. El total va en gris al final ("641 productos").
- **Estadísticas**: solo las que aportan (dinero, conversión, lo que pide atención). Número grande neutro, sin íconos
  de colores. Nada de tarjetas que repiten el conteo de la lista.
- **Listas**: una tarjeta con filas divididas (`divide-y`). Clic en la fila abre el detalle. Las acciones van en un
  menú ⋯; eliminar va al final, en rojo, después de un separador. Nunca botones rellenos rojos o verdes por fila.
- **Badges**: solo para excepciones o estados ("Oculto", "Sin precio", "Inactivo", "Pendiente"). Lo normal no se marca.
  Valores del backend siempre traducidos.
- **Dinero**: color de texto normal, `tabular-nums`. El verde es para la marca y los estados de éxito.

## Tienda: estilo Taller

La tienda usa el mismo preset con una capa propia en `tienda/app/globals.css` (maqueta en
`design/tienda-taller-claro.html`): tienda de repuestos de barrio, no plantilla de ropa.

- **Tipografía**: Anton (`font-display`) en `h1`, `h2` y precios, en mayúsculas; Hanken Grotesk (`font-sans`) para
  texto. Los `h3` van en `font-sans`.
- **Neutros**: papel hueso y tinta negra en claro; en oscuro, negro neutro sin el tinte azul de WhatsApp.
- **Esquinas rectas** (`esquinas: "rectas"` en `marca/tienda/marca.json`) y bordes de 2 px en tinta
  (`border-2 border-foreground`) para tarjetas, encabezado y separadores de sección.
- **Franjas negras**: aviso superior, buscador por vehículo y pie, con `class="dark"` sobre `bg-background`.
- **Rojo**: botón principal, la palabra entre `*asteriscos*` del titular y las líneas de velocidad (`.velocidad`).
- **Tarjeta de pieza**: toda la tarjeta es el enlace; número de parte y fabricante en mono, vehículo y motor en gris,
  precio en Anton. Sin descripción ni etiquetas de relleno.

## Reglas

- Nunca un color fijo (`#4273c4`, `text-[#1e1e1e]`): usa un token. Si falta, agrégalo al preset.
- Texto sobre primario: `text-primary-foreground`, nunca `text-white`.
- Un solo acento por pantalla: el primario. Los colores de estado solo para estados.
- Modo claro y oscuro: revisa cada pantalla nueva en los dos (botón sol/luna del encabezado).
- 375 px sin desplazamiento horizontal.
