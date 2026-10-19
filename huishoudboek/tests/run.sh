#!/usr/bin/env bash
# Draait alle browsertests tegen een lokale server. Gebruik: huishoudboek/tests/run.sh [test-nummer…]
# Nodig: Node 18+ en Playwright (npm i -g playwright, of PLAYWRIGHT_MODULE=/pad/naar/playwright/index.mjs).
set -u
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"; OUT="${OUT:-$(mktemp -d)}"; PORT="${PORT:-3123}"; mkdir -p "$OUT"
export APP_URL="http://localhost:$PORT/huishoudboek/"
python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
fail=0
for t in ${@:-*.mjs}; do
  case "$t" in lib.mjs) continue;; esac; f="$t"; [ -f "$f" ] || f=$(ls "$t"-*.mjs 2>/dev/null | head -1)
  printf '%-28s ' "${f%.mjs}"
  if node "$f" "$OUT" > "$OUT/${f%.mjs}.log" 2>&1; then echo "ok"; else echo "MISLUKT (zie $OUT/${f%.mjs}.log)"; grep -E "^FAIL|Error" "$OUT/${f%.mjs}.log" | head -5 | sed 's/^/    /'; fail=1; fi
done
echo "Schermafbeeldingen en logs: $OUT"
exit $fail
