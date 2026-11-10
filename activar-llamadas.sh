#!/usr/bin/env bash
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")" && pwd)"
ENV="$RAIZ/frontend/admin/.env.local"
PUERTO="${PUERTO:-3300}"
LOG="$(mktemp -t tunel-max).log"

error() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$ENV" ] || error "falta $ENV (ver README)"
grep -q '^ELEVENLABS_API_KEY=..' "$ENV" || error "falta ELEVENLABS_API_KEY en $ENV: sin ella no hay llamadas"
grep -q '^VOZ_SECRETO=..' "$ENV" || error "falta VOZ_SECRETO en $ENV: vuelve a arrancar la demo con ./preparar-demo.sh"
curl -s -o /dev/null "http://localhost:$PUERTO/admin/login" || error "la demo no está corriendo: primero ./preparar-demo.sh en otra ventana"

if ! command -v cloudflared >/dev/null; then
  command -v brew >/dev/null || error "falta cloudflared. Instálalo: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  echo "Instalando cloudflared..."
  brew install cloudflared
fi

echo "Abriendo el túnel..."
cloudflared tunnel --no-autoupdate --url "http://localhost:$PUERTO" > "$LOG" 2>&1 &
TUNEL=$!
trap 'kill $TUNEL 2>/dev/null' EXIT INT TERM

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  kill -0 $TUNEL 2>/dev/null || error "el túnel no arrancó: $(tail -5 "$LOG")"
  sleep 1
done
[ -n "$URL" ] || error "el túnel no dio una dirección en 60 segundos"

echo "Esperando que $URL responda..."
for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL/admin/login" || true)" = "200" ] && break
  sleep 2
done

node "$RAIZ/frontend/scripts/voz-max.mjs" "$URL" --telefono

SECRETO="$(grep -E '^VOZ_SECRETO=' "$ENV" | cut -d= -f2-)"
PRUEBA="$(curl -s --max-time 30 "$URL/srv/seguros/voz/esquema" -H "X-Ora-Voz: $SECRETO")"
echo "$PRUEBA" | grep -q 'resumen_llamada' || error "las herramientas no responden por el túnel: ${PRUEBA:0:200}"

NUMERO="$(grep -E '^VOZ_NUMERO=' "$ENV" | cut -d= -f2- || true)"
cat <<FIN

LLAMADAS LISTAS
  Llama al ${NUMERO:-+1 754 714 5308}: atiende el asistente de MAX y la llamada aparece en la bandeja del panel.
  Túnel: $URL

Deja esta ventana abierta: si se cierra, el número deja de atender. Ctrl+C para parar.
Si reinicias la demo o esta ventana, vuelve a correr ./activar-llamadas.sh (el túnel cambia de dirección).
FIN

wait $TUNEL
