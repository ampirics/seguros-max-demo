# CLAUDE.md: demo de ORA para MAX Corredores de Seguros

Lee `README.md`. Este repositorio es una demo que corre local: panel Next.js 16 en `frontend/admin` en modo mock, con el
servidor de MAX dentro del propio panel (`frontend/admin/lib/seguros/servidor/`, rutas en `app/srv/seguros`).

## "Instala esto y prepáralo para la demostración"

1. Comprueba `node -v` (20 o más). Si no hay Node, dile a la persona cómo instalarlo (https://nodejs.org, versión LTS) y espera.
2. Comprueba que existe `frontend/admin/.env.local` con `ANTHROPIC_API_KEY` y `NEXT_PUBLIC_MOCK=1`. Si falta, pídele a la
   persona el archivo que le pasó Cristian y que lo copie ahí. **Nunca** muestres el valor de las llaves, nunca las
   escribas en otro archivo y nunca subas `.env.local`.
3. Corre `./preparar-demo.sh` en segundo plano y espera la línea `LISTO` (o un `ERROR`, que dice qué falló).
4. Cuando diga `LISTO`, prueba la IA de punta a punta:

   ```bash
   curl -s -X POST http://localhost:3300/srv/seguros/simulador -H 'Content-Type: application/json' \
     -d '{"telefono":"809-555-0999","texto":"Buenas, cuánto me sale asegurar mi Toyota RAV4 2023?","canal":"whatsapp"}'
   ```

   Toma el `conversacion.id` de la respuesta, espera unos 15 segundos y lee
   `http://localhost:3300/srv/seguros/conversaciones/<id>/mensajes`: tiene que haber un mensaje con `"de":"ia"` que no
   dé una prima y pregunte lo que falta. Si en su lugar llega un mensaje de sistema de que la IA no está disponible, la
   llave falta o es inválida.
5. Reinicia los datos para dejar la demo limpia:

   ```bash
   curl -s -X POST http://localhost:3300/srv/seguros/accion -H 'Content-Type: application/json' -d '{"tipo":"reiniciar"}'
   ```

6. Llamadas: si `.env.local` tiene `ELEVENLABS_API_KEY`, corre `./activar-llamadas.sh` **en segundo plano** y espera
   `LLAMADAS LISTAS` (o `ERROR:`). Abre un túnel de Cloudflare, actualiza el agente de voz y le asigna el número
   +1 754 714 5308. Si falta `cloudflared` y no hay Homebrew, explícale a la persona cómo instalarlo. Si no hay llave de
   ElevenLabs, sáltate este paso y díselo.
7. Dile a la persona, corto: el panel en http://localhost:3300/admin/login (botón Dirección), el simulador en
   http://localhost:3300/simulador, el número para llamar (+1 754 714 5308) si se activó, y que el guion está en
   `docs/max/guion-demo.md`. Deja el servidor y el túnel corriendo. Si la persona reinicia algo, vuelve a correr
   `./activar-llamadas.sh`.

## Reglas

- Español, sin emojis.
- No cambies el código para "arreglar" la demo sin decírselo antes a la persona: la demo ya está probada. Si algo falla,
  diagnostica (versión de Node, `.env.local`, puerto, red) y explica.
- Precios, primas y montos de la demo son de ejemplo y salen de los datos sembrados. La IA nunca da primas ni interpreta
  coberturas: es a propósito, no es un error.
- El código de otras verticales (repuestos, restaurante) está en el panel pero no se ve en la vertical de seguros. No lo borres.
- Next 16 tiene cambios grandes: si hace falta tocar código, revisa `frontend/admin/node_modules/next/dist/docs/` primero.
