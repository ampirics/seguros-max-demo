# MAX Corredores de Seguros: vertical seguros de ORA

Demo para MAX Corredores de Seguros (Santo Domingo, Santiago y Punta Cana), noviembre de 2026. Es el mismo ORA de La Casa del
Colt y Boca Marina con una vertical nueva, **Corredor de seguros**, y la línea gráfica de MAX: logo, azul `#0047BB`, azul
claro `#6691D6`, fondo `#E9F1FF`, League Spartan y Roboto, y fotos de max.com.do.

Rama: `client/max`, sale de `client/boca-marina`. Las verticales de repuestos y restaurante siguen igual: el tipo de negocio
decide qué módulos se ven.

MAX es un **corredor**, no una aseguradora: asesora, compara entre aseguradoras, coloca la póliza y acompaña al asegurado en
renovaciones y siniestros. La demo vende eso: captar y precalificar, comparar, renovar y acompañar el siniestro, sin que la
IA dé primas ni interprete coberturas (punto 5.3 de la propuesta).

## Cómo correrla

```bash
cd frontend/admin && npm ci --legacy-peer-deps && node ../scripts/sync-colt-assets.mjs admin
```

`frontend/admin/.env.local` (no se sube), el mismo de Boca Marina:

```
ANTHROPIC_API_KEY=...        # sin ella la IA no responde
NEXT_PUBLIC_MOCK=1
GROQ_API_KEY=...             # transcribe las notas de voz del simulador
```

```bash
cd frontend/admin && NEXT_PUBLIC_MOCK=1 npx next dev -p 3300
```

O la configuración `max` de `.claude/launch.json`.

- Panel: http://localhost:3300/admin/login y "Demostración: entra con un perfil" (Dirección, Ejecutiva de personas,
  Ejecutivo de empresas, Servicio, Siniestros).
- Simulador de WhatsApp para escribirle a la IA como cliente: http://localhost:3300/simulador

Para volver a otra vertical: Configuración > Tipo de negocio, o `NEXT_PUBLIC_VERTICAL=repuestos` / `restaurante`.

## Qué hay

| Módulo | Ruta | Qué hace |
|---|---|---|
| Inicio | `/admin` | Cómo va MAX hoy: lo que requiere atención, primera respuesta, solicitudes, prima nueva, cartera, bandeja en vivo, embudo, renovaciones, siniestros, carga de los ejecutivos y actividad. |
| Bandeja (núcleo ORA) | `/admin/chat` | Conversaciones de WhatsApp, Instagram, sitio y correo. Al lado, el caso: motivo y resumen del pase, lo que hizo la IA, la solicitud con lo que falta, el siniestro con sus documentos, las pólizas y respuestas sugeridas. |
| Oportunidades | `/admin/oportunidades` | Embudo por etapa (tablero y lista) con filtros por ramo, segmento, ejecutivo, sucursal y origen. |
| Ficha de la oportunidad | `/admin/oportunidades/[id]` | Ficha del prospecto, **comparativo de aseguradoras** (primas, deducibles y coberturas con logos), enviarlo por WhatsApp, emitir la póliza o marcarla perdida. |
| Cartera y renovaciones | `/admin/cartera` | Renovaciones a 15, 30 y 60 días con aviso por WhatsApp en lote; cartera con filtros y prima por ramo y por aseguradora. |
| Ficha de la póliza | `/admin/cartera/[id]` | Vigencia, pago, renovación, siniestros y pólizas anteriores. |
| Siniestros | `/admin/siniestros` | Tablero por estado: reportado, documentos, inspección, en la aseguradora, resuelto. |
| Ficha del siniestro | `/admin/siniestros/[id]` | Documentos con casillas, pasos oficiales de MAX, número de reclamo y estado; el asegurado recibe cada cambio por WhatsApp. |
| Asegurados | `/admin/asegurados` | Personas y empresas, asegurados y prospectos. Ficha 360 con pólizas, solicitudes, siniestros, recorrido y venta cruzada. |
| Indicadores | `/admin/indicadores` | Los indicadores del punto 10 de la propuesta: primera respuesta, calificación, conversión a cotización y a póliza, contención, fuera de horario, siniestros; antes y con ORA; por mes, canal, ramo y ejecutivo; motivos de pérdida. |
| Llamadas | +1 754 714 5308 | El asistente de voz de MAX atiende por teléfono con las mismas reglas y herramientas que WhatsApp; cada llamada entra a la bandeja como Llamada, con lo que hizo y el resumen. |
| Simulador | `/simulador` | Escenarios de captación, siniestro y servicio, y escribir como un asegurado real de la cartera de ejemplo (con los últimos 4 de su cédula para verificar). |

## Cómo funciona

- **Servidor de MAX dentro del panel** (`frontend/admin/lib/seguros/servidor/`, rutas en `app/srv/seguros`): mismo patrón que
  Boca Marina. `historia.ts` siembra con semilla fija 12 meses: unos 1.300 casos, unas 620 pólizas activas, unos 70 siniestros y los
  números no cambian entre arranques. `conversaciones.ts` siembra las 12 conversaciones de la bandeja (los cuatro escenarios
  de la propuesta más renovación, pago, queja, reembolso, verificación, viaje y cobertura de un colectivo). `motor.ts`
  guarda el estado, avisa por SSE y ejecuta las acciones del panel.
- **IA** (`servidor/ia.ts`): Claude Opus 5.5 con herramientas. Las reglas van en código, como en el core de repuestos:
  - El modelo entiende; el código decide qué falta (`faltantesDe`, por ramo) y la IA pregunta lo que dice `siguiente_pregunta`.
  - No da primas, deducibles ni montos: una guardia bloquea cualquier monto que no dijo el cliente.
  - No interpreta coberturas: pasa al equipo con motivo "cobertura".
  - No da datos de pólizas ni siniestros sin verificar los últimos 4 de la cédula o RNC.
  - Pide autorización para guardar datos antes de pasar la solicitud (Ley 172-13).
  - Asigna por ramo, sucursal y carga; el asegurado vuelve con su ejecutivo de siempre.
  - Todo pase lleva motivo y un resumen armado desde el estado, sin LLM; la frase de espera depende del horario y no promete minutos.
  - Trato de usted; pasa a tú si el cliente tutea. Si preguntan, dice que es el asistente digital de MAX.
- **Bandeja de ORA sin cambios de fondo:** `mocks/seguros.ts` traduce las rutas del chat al servidor de MAX.

## Llamadas

Agente "MAX Seguros" en ElevenLabs (voz de Boca Marina, Claude Haiku 4.5). Sus herramientas son las mismas de la IA de
WhatsApp (`servidor/voz.ts`) y llaman al panel por un túnel de Cloudflare con la clave `VOZ_SECRETO` en `X-Ora-Voz`.
El prompt y las herramientas salen del panel (`GET /srv/seguros/voz/esquema`): `frontend/scripts/voz-max.mjs` los sube.

```bash
./activar-llamadas.sh     # con la demo corriendo; abre el túnel, actualiza el agente y le asigna el número
```

`.env.local` necesita `ELEVENLABS_API_KEY` y `VOZ_SECRETO` (el script de preparación lo genera). El túnel cambia de
dirección en cada arranque: si se reinicia la demo o el túnel, se vuelve a correr. El número es el mismo de Colt y Boca
Marina: al activarlo para MAX deja de atender a Boca Marina.

- Quien llama se identifica por su número. Si llama desde otro, dice con qué número está registrado y verifica igual
  con los últimos 4 de la cédula.
- Para reportar un siniestro no pide verificación; para dar datos de pólizas, sí.
- Probado con simulaciones de ElevenLabs contra el túnel: cotización de punta a punta, siniestro desde un número no
  registrado y verificación con dígitos equivocados y correctos.

## Datos

- **Reales, de max.com.do (09-11-2026):** logo, colores, fotos, ramos de personas y empresas, aseguradoras aliadas con su
  logo, dirección, teléfonos de emergencia y los pasos y documentos de siniestro por tipo.
- **De ejemplo:** asegurados, equipo, conversaciones, primas, sumas y montos (teléfonos 809/829/849-555). Cada pantalla con
  montos lo dice una vez.
- **Horario de los ejecutivos** (lunes a viernes de 8:30 a 5:30, sábado de 9:00 a 1:00) es configuración de la demo:
  MAX no lo publica.

## Pruebas hechas (09-11-2026)

- `npx tsc --noEmit` sin errores.
- 13 pantallas a 1440 y 375 px sin errores de consola ni scroll horizontal.
- Acciones contra el servidor: cargar primas (marca la recomendada), enviar el comparativo (llega a la conversación),
  emitir la póliza, avisos de renovación, documentos y estados de siniestro (avisan al asegurado).
- IA en vivo: cotización de vehículo de punta a punta, siniestro de asegurado, empresa nueva, verificación con dígitos
  equivocados y correctos, respuesta a renovación, pregunta de cobertura, cancelación, precio aproximado e identidad.

## Pendiente

- Revisión visual de las pantallas en el navegador antes de la reunión.
- WhatsApp real de MAX (Meta) en lugar del simulador.
- Número dominicano propio para MAX y transferencia de la llamada a un ejecutivo en horario.
- Integración con el cotizador (`services.max.com.do/Cotizador`) y su CRM: según lo que diga MAX en la reunión.
- Pasar el servidor de MAX al backend (Roylin) siguiendo el contrato.
