#!/bin/bash
set -e

echo "════════════════════════════════════════════"
echo "  MEXERP Bot - Iniciando..."
echo "════════════════════════════════════════════"

# ─── Instalar dependencias ─────────────────────────────────────────────────────
echo "[STARTUP] Instalando dependencias (npm install)..."
npm install 2>&1

# ─── Compilar TypeScript a dist/ ──────────────────────────────────────────────
echo "[STARTUP] Compilando TypeScript (npm run build)..."
npm run build 2>&1

# ─── Iniciar el bot con Node.js ───────────────────────────────────────────────
echo "[STARTUP] Iniciando el bot con Node.js..."
exec node dist/index.js
