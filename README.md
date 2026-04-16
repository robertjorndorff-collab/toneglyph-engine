# ToneGlyph Engine

Chromatic Audio Signature System — generates deterministic audio signatures ("ToneGlyphs") using a five-pillar analysis framework.

## Structure

```
backend/     Python FastAPI — audio analysis API
frontend/    React + Vite — visualization UI
TICKETS/     Project tickets
```

## Quick Start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Deployment

- **Backend:** Railway (see `railway.json`)
- **Frontend:** Vercel (see `vercel.json`)

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, uvicorn |
| Frontend | React 18+, Vite |
| Database | Supabase (PostgreSQL) — not yet connected |
| LLM | Anthropic Claude API |
| Backend Host | Railway |
| Frontend Host | Vercel |
