#!/usr/bin/env bash
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")" && pwd)"
APP="$RAIZ/frontend/admin"
PUERTO="${PUERTO:-3300}"
BASE="http://localhost:$PUERTO"

error() { echo "ERROR: $*" >&2; exit 1; }

command -v node >/dev/null || error "no hay Node.js. Instala la versión LTS de https://nodejs.org"
MAYOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$MAYOR" -ge 20 ] || error "Node $MAYOR es muy viejo: hace falta 20 o más"

ENV="$APP/.env.local"
[ -f "$ENV" ] || error "falta $ENV (el archivo que pasa Cristian; ver README)"
grep -q '^ANTHROPIC_API_KEY=..' "$ENV" || error "falta ANTHROPIC_API_KEY en $ENV: sin ella la IA no responde"
grep -q '^NEXT_PUBLIC_MOCK=1' "$ENV" || error "falta NEXT_PUBLIC_MOCK=1 en $ENV"
grep -q '^NEXT_PUBLIC_VERTICAL=' "$ENV" && ! grep -q '^NEXT_PUBLIC_VERTICAL=seguros' "$ENV" \
  && error "NEXT_PUBLIC_VERTICAL en $ENV tiene que ser seguros o no estar"

if lsof -ti:"$PUERTO" >/dev/null 2>&1; then
  error "el puerto $PUERTO está ocupado. Ciérralo (lsof -ti:$PUERTO | xargs kill) o usa PUERTO=3400 ./preparar-demo.sh"
fi

cd "$APP"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "Instalando dependencias (unos minutos la primera vez)..."
  npm ci --legacy-peer-deps --no-audit --no-fund
fi
node ../scripts/sync-colt-assets.mjs admin >/dev/null

echo "Arrancando la demo en $BASE ..."
NEXT_PUBLIC_MOCK=1 npx next dev -p "$PUERTO" &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 90); do
  curl -s -o /dev/null "$BASE/admin/login" && break
  kill -0 $SERVIDOR 2>/dev/null || error "el servidor se cayó al arrancar (mira el mensaje de arriba)"
  sleep 2
done

echo "Compilando las pantallas (la primera vez tarda)..."
FALLAS=0
for ruta in /admin/login /admin /admin/chat /admin/oportunidades /admin/cartera /admin/siniestros \
            /admin/asegurados /admin/indicadores /simulador /srv/seguros/estado; do
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 180 "$BASE$ruta" || true)"
  printf '  %-28s %s\n' "$ruta" "$codigo"
  [ "$codigo" = "200" ] || FALLAS=$((FALLAS + 1))
done
[ "$FALLAS" -eq 0 ] || error "$FALLAS pantallas no respondieron 200"

curl -s -o /dev/null -X POST "$BASE/srv/seguros/accion" -H 'Content-Type: application/json' -d '{"tipo":"reiniciar"}'

cat <<FIN

LISTO
  Panel:      $BASE/admin/login   (botón Dirección)
  Simulador:  $BASE/simulador
  Guion:      docs/max/guion-demo.md
  Reiniciar:  curl -X POST $BASE/srv/seguros/accion -H 'Content-Type: application/json' -d '{"tipo":"reiniciar"}'

Deja esta ventana abierta. Ctrl+C para parar.
FIN

wait $SERVIDOR
