# TONEGLYPH ENGINE — PROJECT BRIEF
## Chromatic Audio Signature System

**Project:** toneglyph-engine  
**Owner:** Rob Orndorff / R.J. Orndorff LLC  
**Created:** April 15, 2026  
**Governance:** AXIS PRAXIS  
**Orchestration:** Wandr (prefix: `toneglyph`)  

---

## WHAT WE'RE BUILDING

A web-based application that accepts audio input and generates a unique, deterministic Chromatic Audio Signature (CAS) — a "ToneGlyph" — using the five-pillar analysis framework described in USPTO Application #64/040,266.

**MVP Scope:** Audio → Color Signature (forward direction only)  
**Demo Target:** Shareable web URL that Jerry and Eric can use  

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────┐
│  FRONTEND (React/Vite)                          │
│  - Audio upload UI                              │
│  - ToneGlyph visualization (Canvas/WebGL)       │
│  - Five-pillar readout                          │
│  - Signature display (RGB/CMYK/Hash)            │
│  Deploy: Vercel (toneglyph.com/demo or subdomain)│
└────────────────────┬────────────────────────────┘
                     │ REST API
┌────────────────────┴────────────────────────────┐
│  BACKEND (Python / FastAPI)                     │
│  - Audio ingestion + preprocessing              │
│  - Pillar 1: Zeitgeist (LLM-assisted)           │
│  - Pillar 2: Artistic DNA (LLM + MIR)           │
│  - Pillar 3: Music Theory (librosa/essentia)    │
│  - Pillar 4: Johari (LLM cross-reference)       │
│  - Pillar 5: IP Novelty (fingerprint + hash)    │
│  - Color Encoding Module (CMYK/RGB/Pantone)     │
│  - CAS Storage + Retrieval                      │
│  Deploy: Railway or Render                      │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│  DATA LAYER                                     │
│  - Supabase (CAS records, user data, metadata)  │
│  - Vector DB (Pinecone/pgvector for proximity)  │
│  - File storage (audio uploads, temp)           │
└─────────────────────────────────────────────────┘
```

---

## STACK DECISIONS

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite | Fast, modern, Vercel-native. Same stack as Last/JobScout. |
| Backend | Python + FastAPI | Required for librosa, essentia, madmom. No JS equivalent for serious audio analysis. |
| LLM | Anthropic Claude API | Pillars 1, 2, 4 require reasoning over cultural context, influence, blind spots. |
| Audio MIR | librosa + essentia | Industry standard. Key detection, tempo, chord progression, spectral analysis. |
| Database | Supabase (PostgreSQL) | Proven, known stack. pgvector extension for CAS proximity search. |
| Backend Host | Railway | Python-native, GPU-optional, scales simply. |
| Frontend Host | Vercel | Already deployed there. |
| Gemini | Second opinion on analysis | Cross-reference audio analysis approaches, color encoding math. |

---

## FIVE-PILLAR IMPLEMENTATION PLAN

### Pillar 1: Zeitgeist (Cultural Relevance)
- **MVP approach:** Send audio metadata + extracted features to Claude API with cultural context prompt
- **Input:** Genre classification (from essentia), tempo, energy, spectral characteristics
- **Output:** Cultural relevance score (0-1), genre-cycle position, era alignment
- **Cost per analysis:** ~$0.02-0.05 (Claude API tokens)
- **Limitation:** Quality depends on prompt engineering. No trained temporal model in MVP.

### Pillar 2: Artistic DNA (Influence Mapping)
- **MVP approach:** Spectral fingerprint similarity against reference corpus + Claude reasoning
- **Input:** Spectral centroid, MFCC features, rhythmic patterns, timbral analysis
- **Output:** Influence vector (weighted list of reference artists/styles)
- **Cost per analysis:** ~$0.02-0.05 (Claude API) + compute for feature extraction
- **Limitation:** Reference corpus size limits influence mapping depth. Need curated training data.

### Pillar 3: Music Theory (Compositional Structure)
- **MVP approach:** librosa + essentia — this is the most mature pillar
- **Input:** Raw audio
- **Output:** Key signature, chord progression, tempo, time signature, structural sections, harmonic complexity score
- **Cost per analysis:** Compute only (~$0.001)
- **Limitation:** None significant. These are solved problems.

### Pillar 4: Johari Window (Perceptual Blind Spots)
- **MVP approach:** Claude API cross-references outputs of Pillars 1-3 to identify blind spots
- **Input:** All pillar outputs + audio features
- **Output:** Johari quadrant assignments per characteristic
- **Cost per analysis:** ~$0.03-0.08 (Claude API, larger context)
- **Limitation:** Most experimental pillar. Quality is speculative until tested.

### Pillar 5: IP Novelty (Uniqueness/Fingerprint)
- **MVP approach:** Spectral fingerprint hash (deterministic) + optional similarity check
- **Input:** Raw audio spectral data
- **Output:** Novelty score (0-1), unique hash, flagged similarities
- **Cost per analysis:** Compute only (~$0.001)
- **Limitation:** Real IP/copyright detection requires a reference database (Audible Magic, etc.). MVP uses uniqueness scoring only.

---

## HONEST COST ASSESSMENT

### Development Costs
| Item | Estimate | Notes |
|------|----------|-------|
| Backend scaffolding + API | 2-3 days (Clode) | FastAPI + audio pipeline |
| Pillar 3 (Music Theory) | 2-3 days (Clode) | librosa/essentia integration |
| Pillar 1,2,4 (LLM pillars) | 3-5 days (Clode) | Prompt engineering + iteration |
| Pillar 5 (Fingerprint) | 1-2 days (Clode) | Spectral hash + scoring |
| Color Encoding Module | 1-2 days (Clode) | CMYK/RGB mapping math |
| Frontend demo UI | 2-3 days (Clode) | React app with visualization |
| Integration + QA | 2-3 days (Clode + Clai) | End-to-end testing |
| **Total dev time** | **~15-25 working days** | Clode execution, Clai QA |

### Monthly Operational Costs
| Item | Estimate/month | Notes |
|------|----------------|-------|
| Railway (Python backend) | $5-20 | Starter tier, scales with usage |
| Vercel (Frontend) | $0 (free tier) | Static + API routes |
| Supabase | $0-25 | Free tier may suffice for MVP |
| Claude API | $5-50 | Depends on analysis volume |
| Gemini API (second opinion) | $5-20 | Optional, for cross-reference |
| **Total monthly** | **~$15-115** | Scales with usage |

### One-Time Costs Already Incurred
| Item | Cost |
|------|------|
| Patent #1 filing | $65 |
| Patent #2 filing | $65 |
| 5 domain registrations | $75 |
| **Total** | **$205** |

### Future Costs (Not MVP)
| Item | Estimate | When |
|------|----------|------|
| Patent attorney (non-provisional) | $5K-15K per patent | By April 2027 |
| Trademark filing | $700-1000 | 60-90 days pre-launch |
| Reference audio corpus | $0-5K | If licensing needed |
| GPU compute (if ML models) | $50-200/month | Post-MVP scaling |
| Vector DB (Pinecone) | $70/month | If pgvector insufficient |

---

## AGENT TEAM

| Role | Agent | Responsibility |
|------|-------|----------------|
| CSO / Architect / QA | Clai (Claude.ai) | Architecture, product decisions, UI/CSS, QA review |
| Engineering Execution | Clode (Claude Code) | All code, backend, frontend, deployment |
| Second Opinion | Gemini | Audio analysis validation, color encoding math review |
| Orchestration | Wandr | Task dispatch, observability |

**Wandr prefix:** `toneglyph`  
**Ticket dispatch:** `~/Desktop/CASS/toneglyph-engine/TICKETS/*.md`  

---

## GOVERNANCE (AXIS PRAXIS)

1. No fire-and-forget — every ticket has acceptance criteria
2. No phantom endpoints — backend APIs are documented before implementation
3. User-scoped queries — all DB access is scoped
4. State sync before deploy — no blind pushes
5. Escalation from Rob = reset signal
6. All Supabase mutations via dashboard (Clode is READ-ONLY on DB)
7. Gemini consulted on analysis algorithm decisions before implementation

---

## PHASE 1 MILESTONES (MVP)

| # | Milestone | Definition of Done |
|---|-----------|-------------------|
| 1 | Project scaffold | Git repo, CI, backend + frontend structure, deployed to staging |
| 2 | Audio ingestion | Upload MP3/WAV → backend processes → returns features |
| 3 | Pillar 3 working | Key, tempo, chords, structure extracted from any audio file |
| 4 | Pillars 1,2,4 working | LLM-assisted analysis returning structured scores |
| 5 | Pillar 5 working | Deterministic fingerprint hash + novelty score |
| 6 | Color encoding | Five pillar outputs → CMYK/RGB/Pantone-equivalent mapping |
| 7 | Visualization | Beautiful ToneGlyph rendered in browser from CAS data |
| 8 | End-to-end demo | Upload song → see your ToneGlyph on a shareable URL |

---

## WHAT THIS DOCUMENT IS NOT

This is not a spec for the consumer platform (Jerry's vision).  
This is not a spec for the reverse lookup system (Patent #2).  
This is not a spec for 3D artifact generation.  

This is the engine. Everything else is built on top of it.
