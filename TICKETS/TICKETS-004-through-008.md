# TICKET-004: Pillars 1, 2, 4 — LLM-Assisted Analysis

**Priority:** P1  
**Assignee:** Clode  
**Status:** Open  
**Created:** 2026-04-15  
**Depends on:** TICKET-003  

## Summary
Implement the three LLM-assisted pillars using the Anthropic Claude API.

## Pillar 1: Zeitgeist (Cultural Relevance)
- [ ] Send Pillar 3 outputs + audio metadata to Claude API
- [ ] Prompt engineering: cultural relevance scoring, genre-cycle positioning
- [ ] Output: zeitgeist_score (0-1), era_alignment, genre_position
- [ ] Deterministic seeding: use audio hash as seed context for consistency

## Pillar 2: Artistic DNA (Influence Mapping)  
- [ ] Send spectral features (MFCCs, chroma, timbre) to Claude API
- [ ] Prompt engineering: identify stylistic influences, sonic ancestors
- [ ] Output: influence_vector (weighted artist/style list), dna_score (0-1)

## Pillar 4: Johari Window (Blind Spots)
- [ ] Cross-reference outputs of Pillars 1-3
- [ ] Prompt engineering: identify characteristics invisible to creator
- [ ] Output: johari_quadrant_assignments, hidden_complexity_score (0-1)

## Gemini Checkpoint
- Review prompt engineering approach for each pillar
- Ask: "What cultural/musical dimensions am I missing in this analysis framework?"

## Notes
- Claude API costs ~$0.05-0.15 per full analysis (all 3 pillars)
- Temperature = 0 for determinism (or use seed parameter)
- Cache pillar outputs to avoid re-analysis of same file
---

# TICKET-005: Pillar 5 — IP Novelty / Fingerprint

**Priority:** P1  
**Assignee:** Clode  
**Status:** Open  
**Created:** 2026-04-15  
**Depends on:** TICKET-002  

## Summary
Implement deterministic audio fingerprinting and novelty scoring.

## Acceptance Criteria
- [ ] Generate spectral fingerprint hash from audio (SHA-256 of spectral peak data)
- [ ] Compute novelty score from spectral uniqueness metrics
- [ ] Same audio file always produces identical hash and score
- [ ] Output: fingerprint_hash, novelty_score (0-1), spectral_uniqueness_vector

## Notes
- Real IP/copyright detection (against commercial databases) is OUT OF SCOPE for MVP
- Novelty score is relative uniqueness of spectral characteristics, not legal IP assessment
- This is the K (Key/Black) channel anchor in the CMYK encoding

---

# TICKET-006: Color Encoding Module

**Priority:** P0  
**Assignee:** Clode  
**Status:** Open  
**Created:** 2026-04-15  
**Depends on:** TICKET-003, TICKET-004, TICKET-005  

## Summary
The core patented innovation. Map five-pillar outputs to CMYK/RGB/Pantone-equivalent color values.

## Acceptance Criteria
- [ ] Deterministic mathematical function: pillar outputs → CMYK values
- [ ] C channel: composite of Pillars 1 + 3 (cultural + structural)
- [ ] M channel: composite of Pillars 2 + 4 (DNA + Johari)
- [ ] Y channel: composite of Pillars 3 + 1 + 2 (theory + zeitgeist + DNA)
- [ ] K channel: Pillar 5 (novelty/uniqueness anchor)
- [ ] CMYK → RGB conversion (standard formula)
- [ ] RGB Johari overlay: Pillar 4 outputs encoded in additive RGB space
- [ ] Pantone-equivalent: unique identifier derived from combined CMYK + RGB
- [ ] 3D spatial encoding: X (cultural), Y (complexity), Z (influence density)
- [ ] Final composite signature: unique, irreproducible, deterministic
- [ ] Output: full CAS object (CMYK, RGB, Pantone-eq, 3D coords, hash)

## Gemini Checkpoint (CRITICAL)
- Review the mapping math before implementation
- Ask: "Does this CMYK mapping produce sufficient color differentiation across diverse audio inputs?"
- Ask: "What normalization approach prevents clustering in narrow color regions?"

## Notes
- This is the secret sauce. Get the math right.
- Must produce visually distinct signatures for sonically distinct audio
- Must produce similar signatures for sonically similar audio
- Test with minimum 10 diverse audio samples before closing ticket

---

# TICKET-007: ToneGlyph Visualization (Frontend)

**Priority:** P1  
**Assignee:** Clode  
**Status:** Open  
**Created:** 2026-04-15  
**Depends on:** TICKET-006  

## Summary
Render the CAS as a beautiful, unique visual artifact in the browser.

## Acceptance Criteria
- [ ] Canvas or WebGL renderer
- [ ] Shape derived from spectral profile data (organic, radial)
- [ ] Colors from CAS encoding (CMYK/RGB composite)
- [ ] Glyph is visually distinct for different songs
- [ ] Glyph is visually identical for same song (deterministic)
- [ ] Five-pillar readout displayed below glyph
- [ ] Signature data displayed (RGB, CMYK, Hash)
- [ ] Exportable as PNG (download button)
- [ ] Dark background (#080c18), brand-consistent
- [ ] Mobile-responsive (Jerry/Eric will view on phones)

## Design Notes
- This is the thing people screenshot and share
- Premium feel — not a chart, not a dashboard, an ARTIFACT
- Reference: the prototype Clai built (but with real data from backend)

---

# TICKET-008: End-to-End Integration + Deploy

**Priority:** P0  
**Assignee:** Clode + Clai (QA)  
**Status:** Open  
**Created:** 2026-04-15  
**Depends on:** All previous tickets  

## Summary
Wire frontend to backend, deploy, test end-to-end, make it demo-ready.

## Acceptance Criteria
- [ ] Frontend upload → backend analysis → CAS response → visualization renders
- [ ] Full pipeline completes in <60 seconds for a 4-minute song
- [ ] Deployed to shareable URL (demo.toneglyph.com or similar)
- [ ] Works on desktop Chrome, Safari, mobile Safari, mobile Chrome
- [ ] Error handling for all failure modes
- [ ] Loading states during analysis
- [ ] 5 test songs analyzed with visually distinct, stable results
- [ ] Rob signs off on visual quality
- [ ] Clai QA pass: UI, UX, brand consistency, error states

## Notes
- This is the demo for Jerry and Eric
- Must feel premium and effortless
- No rough edges
