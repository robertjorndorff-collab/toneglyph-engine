# TICKET-001: Project Scaffold

**Priority:** P0  
**Assignee:** Clode  
**Status:** Open  
**Created:** 2026-04-15  

## Summary
Initialize the toneglyph-engine project with proper structure, git, and deployment pipeline.

## Acceptance Criteria
- [ ] Create `~/Desktop/CASS/toneglyph-engine/` directory structure
- [ ] `backend/` — Python FastAPI project with pyproject.toml or requirements.txt
- [ ] `frontend/` — React + Vite project (plain CSS, no Tailwind, matches ToneGlyph brand)
- [ ] `TICKETS/` — ticket directory
- [ ] `KANBAN.md` — project tracking
- [ ] `PROJECT.md` — copy from PROJECT-TONEGLYPH.md
- [ ] `README.md` — project overview
- [ ] `.gitignore` — Python + Node + .env
- [ ] Git init + first commit
- [ ] GitHub repo created at `robertjorndorff-collab/toneglyph-engine`
- [ ] Backend deployable to Railway (Dockerfile or railway.json)
- [ ] Frontend deployable to Vercel
- [ ] `.env.example` for both backend and frontend

## Stack
- Backend: Python 3.11+, FastAPI, uvicorn
- Frontend: React 18+, Vite
- No CSS frameworks. Plain CSS. Dark theme. Brand: #080c18 background, white text, chromatic accents.

## Notes
- Do NOT install librosa/essentia yet — just scaffold the structure
- Do NOT connect to Supabase yet
- First commit should be scaffold only — no features
