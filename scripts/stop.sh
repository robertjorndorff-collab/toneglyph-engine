#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# ToneGlyph Engine — clean shutdown
# Run from ANY directory:  ./scripts/stop.sh
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

for port in 8000 5173 5273 8100; do
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
done

pkill -9 -f "uvicorn app.main:app" 2>/dev/null || true
pkill -9 -f "vite.*--port" 2>/dev/null || true

echo "ToneGlyph stopped."
