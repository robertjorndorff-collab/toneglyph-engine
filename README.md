# ToneGlyph Engine

Chromatic Audio Signature System — generates deterministic audio signatures ("ToneGlyphs") using a five-pillar analysis framework.

## Development

```bash
./scripts/dev.sh     # starts everything, self-heals, one command
./scripts/stop.sh    # stops everything
```

## Structure

```
backend/     Python FastAPI — audio analysis + five-pillar pipeline
frontend/    React + Vite + Three.js — ToneGlyph visualization
scripts/     Dev startup / shutdown
TICKETS/     Project tickets
```

## Deployment

- **Backend:** Railway (`railway.json`, `backend/Dockerfile`)
- **Frontend:** Vercel (`vercel.json`)

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, uvicorn, librosa, pydub |
| LLM | Anthropic Claude API (Pillars 1, 2, 4) |
| Frontend | React 18+, Vite, Three.js |
| Backend Host | Railway |
| Frontend Host | Vercel |
