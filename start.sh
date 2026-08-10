#!/bin/bash
set -e

echo "════════════════════════════════════════════"
echo "  MEXERP Bot - Iniciando..."
echo "════════════════════════════════════════════"

# ─── Instalar dependencias Node primero ───────────────────────────────────────
echo "[STARTUP] Instalando dependencias (npm install)..."
npm install --production=false 2>&1 || true

# ─── Verificar si Bun está disponible ────────────────────────────────────────
if command -v bun &> /dev/null; then
  echo "[STARTUP] Bun encontrado: $(bun --version)"
  echo "[STARTUP] Iniciando con: bun run src/index.ts"
  exec bun run src/index.ts

# ─── Verificar si tsx está disponible (segunda opción) ───────────────────────
elif command -v tsx &> /dev/null || [ -f "./node_modules/.bin/tsx" ]; then
  echo "[STARTUP] tsx encontrado, usando tsx..."
  echo "[STARTUP] Iniciando con: npx tsx src/index.ts"
  exec npx tsx src/index.ts

# ─── Fallback: Node.js con dist/ compilado ────────────────────────────────────
elif [ -f "./dist/index.js" ]; then
  echo "[STARTUP] Usando dist/ compilado con Node.js..."
  exec node dist/index.js

# ─── Último recurso: Instalar Bun desde internet ─────────────────────────────
else
  echo "[STARTUP] Bun no encontrado. Instalando Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  echo "[STARTUP] Bun instalado: $(bun --version)"
  echo "[STARTUP] Iniciando con: bun run src/index.ts"
  exec bun run src/index.ts
fi
