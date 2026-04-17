#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# ToneGlyph Engine — self-healing dev startup
# Run from ANY directory:  ./scripts/dev.sh  or  bash scripts/dev.sh
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Resolve project root regardless of where the script is invoked ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

BACKEND_PORT=8000
FRONTEND_PORT=5173
BACKEND_LOG="/tmp/toneglyph-backend.log"

RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[0;33m'
CYN='\033[0;36m'
RST='\033[0m'

info()  { echo -e "${CYN}[info]${RST}  $*"; }
ok()    { echo -e "${GRN}[ok]${RST}    $*"; }
warn()  { echo -e "${YEL}[warn]${RST}  $*"; }
fail()  { echo -e "${RED}[FAIL]${RST}  $*"; }

# ── 1. Kill stale processes ─────────────────────────────────────────
info "Cleaning up stale processes…"
for port in $BACKEND_PORT $FRONTEND_PORT 5273 8100; do
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
done
# Orphaned uvicorn / vite by name
pkill -9 -f "uvicorn app.main:app" 2>/dev/null || true
pkill -9 -f "vite.*--port" 2>/dev/null || true
sleep 1
ok "Ports $BACKEND_PORT / $FRONTEND_PORT clear"

# ── 2. Redis (optional) ─────────────────────────────────────────────
if command -v redis-cli &>/dev/null; then
    if redis-cli ping &>/dev/null; then
        ok "Redis: running"
    else
        if command -v redis-server &>/dev/null; then
            redis-server --daemonize yes &>/dev/null
            ok "Redis: started"
        else
            warn "redis-server not found — skipping"
        fi
    fi
else
    info "Redis not installed — skipping (not required for MVP)"
fi

# ── 3. Backend venv ──────────────────────────────────────────────────
if [ ! -d backend/venv ]; then
    info "Creating backend virtualenv…"
    python3 -m venv backend/venv
    ok "Virtualenv created"
fi

# Activate
# shellcheck disable=SC1091
source backend/venv/bin/activate

# Check deps
if ! python -c "import fastapi, pydub, librosa, anthropic" &>/dev/null; then
    info "Installing backend dependencies…"
    pip install -q -r backend/requirements.txt
    ok "Backend deps installed"
else
    ok "Backend deps: up to date"
fi

# ── 4. Frontend node_modules ─────────────────────────────────────────
if [ ! -d frontend/node_modules ]; then
    info "Installing frontend dependencies…"
    (cd frontend && npm install --silent)
    ok "Frontend deps installed"
else
    ok "Frontend deps: present"
fi

# ── 5. Env files ─────────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    warn "Created backend/.env from .env.example — add your ANTHROPIC_API_KEY"
else
    # Check for API key
    if grep -q "ANTHROPIC_API_KEY=.\+" backend/.env 2>/dev/null; then
        ok "Backend .env: ANTHROPIC_API_KEY set"
    else
        warn "ANTHROPIC_API_KEY not set in backend/.env — Pillars 1/2/4 will degrade gracefully"
    fi
fi

if [ ! -f frontend/.env ]; then
    echo "VITE_API_URL=http://localhost:$BACKEND_PORT" > frontend/.env
    ok "Created frontend/.env (VITE_API_URL=http://localhost:$BACKEND_PORT)"
else
    ok "Frontend .env: present"
fi

# ── 6. Start backend ─────────────────────────────────────────────────
info "Starting backend on :$BACKEND_PORT …"
cd backend
nohup python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "$BACKEND_PORT" \
    > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
cd "$ROOT"

# Health poll — 1s intervals, 30s timeout
TRIES=0
MAX_TRIES=30
while [ $TRIES -lt $MAX_TRIES ]; do
    if curl -sf "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        ok "Backend: OK  (PID $BACKEND_PID)"
        break
    fi
    TRIES=$((TRIES + 1))
    sleep 1
done

if [ $TRIES -eq $MAX_TRIES ]; then
    fail "Backend failed to start after ${MAX_TRIES}s"
    echo ""
    echo "Last 20 lines of $BACKEND_LOG:"
    tail -20 "$BACKEND_LOG"
    echo ""
    fail "Fix the error above, then run ./scripts/dev.sh again"
    exit 1
fi

# ── 7. Banner + frontend in foreground ───────────────────────────────
echo ""
echo -e "${CYN}╔══════════════════════════════════════════════╗${RST}"
echo -e "${CYN}║${RST}  ToneGlyph Engine running                    ${CYN}║${RST}"
echo -e "${CYN}║${RST}  → ${GRN}http://localhost:$FRONTEND_PORT${RST}                   ${CYN}║${RST}"
echo -e "${CYN}║${RST}  Backend log: $BACKEND_LOG  ${CYN}║${RST}"
echo -e "${CYN}║${RST}  Stop: ${YEL}./scripts/stop.sh${RST}                      ${CYN}║${RST}"
echo -e "${CYN}╚══════════════════════════════════════════════╝${RST}"
echo ""

cd frontend
exec npx vite --port "$FRONTEND_PORT" --host
