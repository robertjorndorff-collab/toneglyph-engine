"""TICKET-016: AI-driven literal enhancers.

Two enhancers that use Claude to extract extra-musical visual context:
  A) Lyric themes — inferred from song metadata or explicit lyrics
  B) Era style — visual aesthetic parameters from cultural era

Both cached on disk by file_hash. Both return structured JSON that
the frontend applies as visual overlays AFTER layer compositing.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

import anthropic
from pydantic import BaseModel, Field

logger = logging.getLogger("toneglyph.enhancers")

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048
TEMPERATURE = 0

CACHE_DIR = Path(__file__).parent.parent / ".cache" / "enhancers"


# ── Output schemas ────────────────────────────────────────────────

class LyricThemes(BaseModel):
    mode: str = Field(description="'explicit', 'inferred', or 'manual'")
    themes: dict = Field(description="Theme name → confidence 0-1, e.g. {'water': 0.8, 'loss': 0.9}")
    summary: str = Field(description="One-sentence theme summary")


class EraStyle(BaseModel):
    color_temperature: float = Field(ge=-1, le=1)
    saturation_shift: float = Field(ge=-1, le=1)
    contrast_level: float = Field(ge=0, le=1)
    texture_type: str
    edge_quality: str
    ornamentation_level: float = Field(ge=0, le=1)
    dominant_visual_movement: str
    filter_description: str


# ── Cache helpers ─────────────────────────────────────────────────

def _cache_path(file_hash: str, enhancer: str) -> Path:
    return CACHE_DIR / f"{file_hash}_{enhancer}.json"


def _load_cache(file_hash: str, enhancer: str) -> Optional[dict]:
    p = _cache_path(file_hash, enhancer)
    if not p.exists(): return None
    try: return json.loads(p.read_text())
    except Exception: return None


def _write_cache(file_hash: str, enhancer: str, data: dict):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _cache_path(file_hash, enhancer).write_text(json.dumps(data, indent=2))


# ── System prompt (shared, cacheable) ─────────────────────────────

SYSTEM = """You are an analytical component of the ToneGlyph Engine. You extract
structured visual parameters from musical context. Return ONLY the requested JSON.
No preamble, no caveats outside the JSON fields."""


# ── Lyric Theme Enhancer ─────────────────────────────────────────

def analyze_lyrics(
    filename: str,
    file_hash: str,
    pillar1: Optional[dict] = None,
    pillar2: Optional[dict] = None,
    pillar3: Optional[dict] = None,
    lyrics: Optional[str] = None,
) -> dict:
    """Extract lyric themes. Modes: explicit (lyrics provided), inferred (from metadata)."""

    cached = _load_cache(file_hash, "lyrics")
    if cached: return cached

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"mode": "error", "themes": {}, "summary": "ANTHROPIC_API_KEY not set"}

    client = anthropic.Anthropic(api_key=api_key)

    if lyrics and lyrics.strip():
        mode = "manual"
        user_msg = (
            f"Extract the dominant lyrical THEMES from these lyrics. "
            f"Return a LyricThemes JSON with theme names as keys and confidence 0-1 as values.\n"
            f"Common themes: water, fire, loss, love, death, nature, urban, spiritual, protest, "
            f"journey, isolation, hope, nostalgia, rebellion, freedom, desire, betrayal.\n\n"
            f"Song: {filename}\n\nLyrics:\n{lyrics[:3000]}"
        )
    else:
        mode = "inferred"
        context_parts = [f"Filename: {filename}"]
        if pillar1:
            context_parts.append(f"Era: {pillar1.get('era_alignment', '')}")
            context_parts.append(f"Genre: {pillar1.get('genre_position', '')}")
        if pillar2:
            influences = pillar2.get('influence_vector', [])
            if influences:
                context_parts.append(f"Influences: {', '.join(i.get('name','') for i in influences[:5])}")
        if pillar3:
            context_parts.append(f"Key: {pillar3.get('key', {}).get('name', '')}")
            context_parts.append(f"Tempo: {pillar3.get('tempo', {}).get('bpm', '')} BPM")

        user_msg = (
            f"INFER the likely lyrical themes of this song from its metadata and audio characteristics. "
            f"Even for instrumentals, infer the emotional/thematic content the music evokes.\n"
            f"Return a LyricThemes JSON with theme names and confidence scores.\n\n"
            + "\n".join(context_parts)
        )

    try:
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_msg}],
            output_format=LyricThemes,
        )
        result = resp.parsed_output.model_dump()
        result["mode"] = mode
        _write_cache(file_hash, "lyrics", result)
        return result
    except Exception as exc:
        logger.exception("lyrics enhancer failed")
        return {"mode": "error", "themes": {}, "summary": str(exc)}


# ── Era Style Enhancer ────────────────────────────────────────────

def analyze_era(
    file_hash: str,
    pillar1: Optional[dict] = None,
    pillar2: Optional[dict] = None,
) -> dict:
    """Extract visual aesthetic parameters from cultural era context."""

    cached = _load_cache(file_hash, "era")
    if cached: return cached

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"error": "ANTHROPIC_API_KEY not set"}

    client = anthropic.Anthropic(api_key=api_key)

    context_parts = []
    if pillar1:
        context_parts.append(f"Era: {pillar1.get('era_alignment', '')}")
        context_parts.append(f"Genre: {pillar1.get('genre_position', '')}")
        context_parts.append(f"Zeitgeist score: {pillar1.get('zeitgeist_score', '')}")
    if pillar2:
        context_parts.append(f"DNA reasoning: {pillar2.get('dna_reasoning', '')}")
        influences = pillar2.get('influence_vector', [])
        if influences:
            context_parts.append(f"Influences: {', '.join(i.get('name','') for i in influences[:5])}")

    user_msg = (
        f"Given this musical era and these influences, describe the dominant VISUAL AESTHETIC "
        f"of this cultural moment. Return an EraStyle JSON.\n\n"
        f"texture_type must be one of: clean, gritty, faded, glossy, raw\n"
        f"edge_quality must be one of: sharp, soft, torn, jagged\n"
        f"filter_description should be a one-line CSS/SVG filter suggestion\n\n"
        + "\n".join(context_parts)
    )

    try:
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_msg}],
            output_format=EraStyle,
        )
        result = resp.parsed_output.model_dump()
        _write_cache(file_hash, "era", result)
        return result
    except Exception as exc:
        logger.exception("era enhancer failed")
        return {"error": str(exc)}
