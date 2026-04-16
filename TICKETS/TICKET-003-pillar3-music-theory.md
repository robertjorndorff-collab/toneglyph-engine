# TICKET-003: Pillar 3 — Music Theory Analysis

**Priority:** P0  
**Assignee:** Clode  
**Status:** Open  
**Created:** 2026-04-15  
**Depends on:** TICKET-002  

## Summary
Implement the Music Theory pillar using librosa and/or essentia. This is the most mature and deterministic pillar — build it first.

## Acceptance Criteria
- [ ] Install librosa (+ dependencies) in backend
- [ ] Extract from audio: key signature, estimated tempo (BPM), beat positions
- [ ] Extract: spectral centroid, spectral bandwidth, spectral rolloff, MFCCs
- [ ] Extract: zero crossing rate, RMS energy curve
- [ ] Extract: chroma features (12-bin chromagram)
- [ ] Compute: harmonic complexity score (derived from chroma variance)
- [ ] Compute: rhythmic complexity score (derived from onset detection + tempo stability)
- [ ] Return structured JSON with all Pillar 3 outputs
- [ ] All outputs are deterministic — same file always produces identical values
- [ ] Processing time target: <30 seconds for a 4-minute song

## Gemini Checkpoint
Before finalizing feature extraction approach, ask Gemini:
- "Given these librosa features [list], what additional MIR features would strengthen a compositional complexity score?"
- "Is essentia's key detection more accurate than librosa's for pop/rock music?"

## Notes
- This pillar is pure computation — no LLM needed
- Output feeds into Color Encoding Module (TICKET-006)
- Also used as input to Pillar 4 (Johari cross-reference)
