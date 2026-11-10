# Modo mock del panel

Permite trabajar todas las pantallas del panel sin backend ni IA. Los datos son de ejemplo, con el catálogo real de Repuestos La Casa del Colt.

## Cómo correrlo

```bash
cd frontend/admin
npm run dev:mock
```

Abre http://localhost:3000/admin/login y entra con cualquier correo y contraseña. El usuario es Cristian Sánchez (admin) en la empresa Repuestos La Casa del Colt.

`dev:mock` copia antes `frontend/assets/colt` a `public/colt` (lo mismo hacen `predev` y `prebuild`). De ahí sale el catálogo (`/colt/productos.json`) y las fotos.

## Cómo funciona

- `mock-installer.tsx` se carga primero en `app/layout.tsx`. Si `NEXT_PUBLIC_MOCK=1`, `install.ts` carga `runtime.ts`.
- `runtime.ts` envuelve `window.fetch`: toda petición a `/api/...` (al host de la API o al mismo origen) se responde desde `handlers.ts` con ~150 ms de latencia. El resto pasa al fetch real.
- Si una ruta no tiene handler, responde 200 con `[]` (GET que parece listado) o `{}`, y avisa en consola: `[mock] sin handler GET /ruta`.
- Los WebSocket (chat en tiempo real, softphone) quedan simulados: abren y no reciben nada. El de recarga en caliente de Next no se toca.
- Las respuestas de IA (`/ai-assistant/*`, `/mcp/chat`) devuelven siempre el mismo texto genérico.

## Dónde están los datos

- `data/*.ts`: datos semilla (empresa, usuarios, clientes, conversaciones, órdenes, campañas, conocimiento, impuestos, links de pago, descuentos, auditoría). `data/products.ts` convierte el JSON de Colt a la forma de producto del panel y define `REF`, los productos que usan órdenes y conversaciones.
- `data/piezas.ts` normaliza el catálogo de Colt en piezas con vehículo, sistema, OEM y equivalencias, y hace la búsqueda en lenguaje natural. `data/cotizaciones.ts` guarda una fila por versión de cada cotización.
- `store.ts`: base en memoria. Lo que se crea o edita se mantiene mientras no recargues la página; al recargar vuelve a la semilla.

## Agregar un handler

En `handlers.ts`, con la ruta sin `/api/v1`:

```ts
on("GET", "/admin/mi-modulo/:id", ({ params, query, body }) => {
  return getDb().miLista.find((x) => x.id === params.id) ?? notFound("Registro")
})
```

Devuelve el objeto y sale como JSON 200. Para otro estado usa `respond(404, { detail: "..." })`. Pon las rutas fijas (`/algo/stats`) antes de las que tienen parámetros (`/algo/:id`). Si el dato es nuevo, agrégalo en `data/` y en `seed()` de `store.ts`.

## Volver al backend real

Corre `npm run dev` (sin `NEXT_PUBLIC_MOCK`, o con `NEXT_PUBLIC_MOCK=` vacío en `.env.local`) y define `NEXT_PUBLIC_API_URL` con la URL del backend, por ejemplo `http://localhost:8000/api/v1`. Con el flag apagado el código de `mocks/` no se ejecuta.
