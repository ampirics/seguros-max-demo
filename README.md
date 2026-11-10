# MAX Corredores de Seguros: demo de ORA

Demo de ORA (Ampirics) para MAX Corredores de Seguros: un asistente de IA por WhatsApp que capta y precalifica
solicitudes, abre siniestros y atiende servicio, y un CRM donde el equipo de MAX ve todo en vivo: bandeja,
oportunidades con comparativo de aseguradoras, cartera y renovaciones, siniestros, asegurados e indicadores.

Corre completa en una sola laptop. No necesita base de datos, backend ni WhatsApp real: el servidor de la demo vive
dentro del panel y los datos de ejemplo se generan al arrancar (siempre los mismos).

## Lo que necesitas

- macOS, Linux o Windows con WSL.
- Node.js 20 o más nuevo (`node -v`). Probado con Node 24.
- Git.
- Internet durante la demo (la IA usa la API de Claude).
- El archivo `.env.local` que te pasa Cristian. Tiene las llaves y **no se sube a GitHub**.

## Instalar

```bash
git clone https://github.com/ampirics/seguros-max-demo.git
cd seguros-max-demo
```

Copia el `.env.local` que te pasó Cristian a `frontend/admin/.env.local`, exactamente con ese nombre:

```bash
cp ~/Downloads/.env.local frontend/admin/.env.local
```

Si no lo tienes, crea ese archivo con estas tres líneas:

```
ANTHROPIC_API_KEY=...   # obligatoria: sin ella la IA no responde
GROQ_API_KEY=...        # opcional: transcribe las notas de voz del simulador
NEXT_PUBLIC_MOCK=1      # obligatoria: modo demo, sin backend
```

Luego:

```bash
./preparar-demo.sh
```

El script instala todo, arranca la demo en el puerto 3300, reinicia los datos y comprueba que cada pantalla responde.
La primera vez tarda unos minutos (instala dependencias). Al final dice `LISTO` con los enlaces. Para pararla: `Ctrl+C`.

### Si prefieres hacerlo a mano

```bash
cd frontend/admin
npm ci --legacy-peer-deps
node ../scripts/sync-colt-assets.mjs admin
npx next dev -p 3300
```

## Usarla

- **Panel de MAX:** http://localhost:3300/admin/login, botón **Dirección** (en "Demostración: entra con un perfil"). No
  pide contraseña. Hay perfiles de ejecutiva, servicio y siniestros.
- **WhatsApp simulado:** http://localhost:3300/simulador en otra pestaña o en el celular (en la misma red:
  `http://<ip-de-la-laptop>:3300/simulador`). Lo que escribas ahí le llega a la IA y aparece solo en la bandeja del
  panel.
- **Reiniciar los datos** antes de presentar o después de practicar:

  ```bash
  curl -X POST http://localhost:3300/srv/seguros/accion -H 'Content-Type: application/json' -d '{"tipo":"reiniciar"}'
  ```

El guion de la reunión, paso a paso y con qué escribir en cada momento, está en [docs/max/guion-demo.md](docs/max/guion-demo.md).
El detalle de qué hace cada pantalla y cómo funciona por dentro, en [docs/max/README.md](docs/max/README.md).

## Antes de la reunión

1. `./preparar-demo.sh` y esperar `LISTO`.
2. Entrar al panel con Dirección y recorrer una vez Inicio, Bandeja, Oportunidades, Cartera, Siniestros, Asegurados e
   Indicadores (la primera visita a cada pantalla compila y tarda unos segundos; después es instantánea).
3. En el simulador escribir "Buenas, ¿cuánto me sale asegurar mi Toyota RAV4 2023?" y comprobar que la IA contesta.
4. Reiniciar los datos con el `curl` de arriba.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| La IA no contesta en el simulador | Falta `ANTHROPIC_API_KEY` en `frontend/admin/.env.local` o no hay internet. Corregir y volver a arrancar. Mientras tanto, las 12 conversaciones sembradas en la bandeja muestran los mismos casos. |
| `npm ci` falla con ERESOLVE | Usar `npm ci --legacy-peer-deps` (el script ya lo hace). |
| Puerto 3300 ocupado | `lsof -ti:3300 \| xargs kill` o arrancar con `PUERTO=3400 ./preparar-demo.sh`. |
| Se ven datos raros por las pruebas | Reiniciar con el `curl`. |
| Sale la marca de otro cliente | Falta `NEXT_PUBLIC_MOCK=1` o hay un `NEXT_PUBLIC_VERTICAL` distinto de `seguros`. |

## Qué es real y qué es de ejemplo

- Real, tomado de max.com.do: logo, colores, fotos, ramos, aseguradoras aliadas, dirección, teléfonos de emergencia y los
  pasos y documentos de siniestro.
- De ejemplo: asegurados, equipo, conversaciones, primas y montos. Los teléfonos son 809/829/849-555.

## Con Claude Code

Este repositorio trae un `CLAUDE.md` con los pasos. Abre Claude Code en la carpeta del repositorio y dile:

> Instala esto y prepáralo para la demostración.
