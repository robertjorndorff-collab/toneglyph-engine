# TICKET-002: Audio Ingestion Pipeline

**Priority:** P0  
**Assignee:** Clode  
**Status:** Open  
**Created:** 2026-04-15  
**Depends on:** TICKET-001  

## Summary
Build the audio upload endpoint and preprocessing pipeline. Accept audio files, decode them, normalize, and return basic metadata confirming successful ingestion.

## Acceptance Criteria
- [ ] POST `/api/analyze` endpoint accepts multipart audio file upload
- [ ] Supports MP3, WAV, FLAC, M4A, AAC formats
- [ ] Decodes audio to raw PCM using `pydub` or `soundfile`
- [ ] Normalizes to mono, 44.1kHz sample rate
- [ ] Returns JSON with: `duration`, `sample_rate`, `channels`, `format`, `file_hash` (SHA-256)
- [ ] File size limit: 50MB
- [ ] Temp file cleanup after processing
- [ ] Error handling for corrupt/unsupported files
- [ ] Frontend upload UI connected to this endpoint

## Notes
- `file_hash` is the deterministic anchor — same file always produces same hash
- This is the foundation. Pillar analysis happens downstream.
- Audio files are NOT persisted in MVP — processed and discarded
- CORS configured for frontend origin
