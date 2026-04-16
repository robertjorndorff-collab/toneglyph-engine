"""Pillars 1, 2, 4 — LLM-assisted analysis via the Anthropic Claude API.

- Pillar 1 (Zeitgeist):     cultural era + genre position from MIR features + filename
- Pillar 2 (Artistic DNA):  influence vector from spectral/timbral features
- Pillar 4 (Johari Window): blind-spot analysis cross-referencing 1 + 2 + 3

Determinism is achieved via:
  - temperature=0
  - structured outputs (Pydantic schemas, strict JSON)
  - on-disk cache keyed by file_hash — same file never re-calls the API

Prompt caching (ephemeral ttl=1h) is applied to the shared system prompt so
the three per-file calls share a cached prefix.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import anthropic
from pydantic import BaseModel, Field

logger = logging.getLogger("toneglyph.pillars_llm")

MODEL = "claude-opus-4-6"
MAX_TOKENS = 4096
TEMPERATURE = 0

CACHE_DIR = Path(__file__).parent.parent / ".cache" / "llm"

# -----------------------------------------------------------------------------
# Output schemas — the Anthropic SDK enforces these via .parse()
# -----------------------------------------------------------------------------

class Pillar1Output(BaseModel):
    """Pillar 1: Zeitgeist / cultural relevance."""
    zeitgeist_score: float = Field(ge=0.0, le=1.0)
    era_alignment: str
    genre_position: str
    cultural_reasoning: str


class Influence(BaseModel):
    name: str
    weight: float = Field(ge=0.0, le=1.0)


class Pillar2Output(BaseModel):
    """Pillar 2: Artistic DNA / influence mapping."""
    dna_score: float = Field(ge=0.0, le=1.0)
    influence_vector: List[Influence]
    dna_reasoning: str


class JohariQuadrants(BaseModel):
    open: List[str]
    blind: List[str]
    hidden: List[str]
    unknown: List[str]


class Pillar4Output(BaseModel):
    """Pillar 4: Johari window / perceptual blind spots."""
    johari_quadrant_assignments: JohariQuadrants
    hidden_complexity_score: float = Field(ge=0.0, le=1.0)
    johari_reasoning: str


# -----------------------------------------------------------------------------
# System prompt — shared across all three calls so Anthropic can cache it.
# Stable content only; per-file data goes in the user message.
# -----------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an analytical component of the ToneGlyph Engine, a Chromatic Audio Signature (CAS) system that generates deterministic color-space signatures for audio tracks.

The ToneGlyph framework uses five analysis pillars to produce a unique signature:

  Pillar 1 — Zeitgeist: cultural relevance and era alignment of the work
  Pillar 2 — Artistic DNA: stylistic influences and sonic ancestry
  Pillar 3 — Music Theory: key, tempo, chroma, spectral features (deterministic MIR)
  Pillar 4 — Johari Window: characteristics visible and invisible to the creator
  Pillar 5 — IP Novelty: spectral uniqueness and fingerprint

You will be asked to produce exactly one pillar's output per request. You receive:
  - The filename (possibly with artist/track hints)
  - Deterministic MIR features from Pillar 3 (key, tempo, chroma vector, MFCCs, spectral
    centroid/bandwidth/rolloff, harmonic and rhythmic complexity scores)
  - For Pillar 4 only: the outputs of Pillars 1, 2, and 3

Ground rules:

1. Be specific and evidence-based. Tie claims to the MIR features or filename signals,
   not to vague genre stereotypes. "Centroid 1800Hz + low chroma variance + C major
   suggest acoustic folk" is better than "sounds like 70s music".

2. Never refuse for lack of information. Do your best inference from the features
   provided; if a filename is cryptic, say so in the reasoning and reason from MIR
   features alone.

3. Return only the requested JSON structure. No preamble, no caveats in the JSON —
   put caveats inside the reasoning field.

4. Scores in [0.0, 1.0] are calibrated distributions, not absolute judgements:
     - zeitgeist_score: how strongly the track indexes its cultural moment
     - dna_score: how distinctive the artistic voice is (vs generic)
     - hidden_complexity_score: how much more is going on than a casual listener hears

5. Be concise. `cultural_reasoning`, `dna_reasoning`, and `johari_reasoning` should
   each be 2–4 sentences. The influence_vector should be 3–6 entries, weights summing
   to roughly 1.0 (not strictly normalized, but close).

6. The Johari quadrants for audio are framed as:
     - open:    what creator and listener both perceive
     - blind:   characteristics the listener perceives but the creator doesn't
     - hidden:  characteristics the creator knows but the listener misses
     - unknown: latent properties neither party consciously perceives
   Each quadrant gets 2–5 short phrases.
"""


# -----------------------------------------------------------------------------
# Feature-extraction helpers — reduce Pillar 3 data to the fields each prompt needs
# -----------------------------------------------------------------------------

def _summarize_pillar3(p3: dict) -> dict:
    """Extract the MIR features the LLM prompts need, dropping noisy arrays."""
    if not p3:
        return {}
    return {
        "key": p3.get("key", {}).get("name"),
        "key_confidence": p3.get("key", {}).get("confidence"),
        "tempo_bpm": p3.get("tempo", {}).get("bpm"),
        "tempo_stability": p3.get("tempo", {}).get("stability"),
        "beat_count": p3.get("beats", {}).get("count"),
        "onset_density_per_sec": p3.get("onsets", {}).get("density"),
        "chroma_mean": p3.get("chroma", {}).get("mean"),
        "spectral_centroid_mean_hz": p3.get("spectral", {}).get("centroid_mean"),
        "spectral_bandwidth_mean_hz": p3.get("spectral", {}).get("bandwidth_mean"),
        "spectral_rolloff_mean_hz": p3.get("spectral", {}).get("rolloff_mean"),
        "mfcc_mean": p3.get("mfcc", {}).get("mean"),
        "zero_crossing_rate_mean": p3.get("zero_crossing_rate", {}).get("mean"),
        "rms_mean": p3.get("rms", {}).get("mean"),
        "harmonic_complexity": p3.get("harmonic_complexity"),
        "rhythmic_complexity": p3.get("rhythmic_complexity"),
    }


# -----------------------------------------------------------------------------
# Cache — on-disk JSON keyed by file_hash. Survives restarts.
# -----------------------------------------------------------------------------

def _cache_path(file_hash: str) -> Path:
    return CACHE_DIR / f"{file_hash}.json"


def _load_cache(file_hash: str) -> Optional[dict]:
    path = _cache_path(file_hash)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        logger.warning("could not read cache file %s", path)
        return None


def _write_cache(file_hash: str, payload: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _cache_path(file_hash).write_text(json.dumps(payload, indent=2))


# -----------------------------------------------------------------------------
# Per-pillar Claude calls
# -----------------------------------------------------------------------------

def _system_blocks() -> list[dict]:
    """System prompt as a single cacheable block (1h TTL)."""
    return [{
        "type": "text",
        "text": SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral", "ttl": "1h"},
    }]


def _call_pillar1(client: anthropic.Anthropic, filename: str, p3_summary: dict) -> Pillar1Output:
    user_text = (
        f"Produce Pillar 1 (Zeitgeist) for this track.\n\n"
        f"Filename: {filename}\n\n"
        f"Pillar 3 MIR features:\n{json.dumps(p3_summary, indent=2)}\n\n"
        f"Return a Pillar1Output."
    )
    resp = client.messages.parse(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        system=_system_blocks(),
        messages=[{"role": "user", "content": user_text}],
        output_format=Pillar1Output,
    )
    return resp.parsed_output


def _call_pillar2(client: anthropic.Anthropic, filename: str, p3_summary: dict) -> Pillar2Output:
    user_text = (
        f"Produce Pillar 2 (Artistic DNA) for this track. Focus on sonic ancestry — "
        f"what artists, movements, or production traditions shaped this sound?\n\n"
        f"Filename: {filename}\n\n"
        f"Pillar 3 MIR features:\n{json.dumps(p3_summary, indent=2)}\n\n"
        f"Return a Pillar2Output with 3–6 weighted influences."
    )
    resp = client.messages.parse(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        system=_system_blocks(),
        messages=[{"role": "user", "content": user_text}],
        output_format=Pillar2Output,
    )
    return resp.parsed_output


def _call_pillar4(
    client: anthropic.Anthropic,
    filename: str,
    p3_summary: dict,
    p1: Pillar1Output,
    p2: Pillar2Output,
) -> Pillar4Output:
    user_text = (
        f"Produce Pillar 4 (Johari Window) for this track, cross-referencing the "
        f"outputs of Pillars 1, 2, and 3.\n\n"
        f"Filename: {filename}\n\n"
        f"Pillar 1 (Zeitgeist):\n{p1.model_dump_json(indent=2)}\n\n"
        f"Pillar 2 (Artistic DNA):\n{p2.model_dump_json(indent=2)}\n\n"
        f"Pillar 3 (Music Theory):\n{json.dumps(p3_summary, indent=2)}\n\n"
        f"Return a Pillar4Output. Identify what a casual listener and the creator "
        f"each perceive (or miss) in this track."
    )
    resp = client.messages.parse(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        system=_system_blocks(),
        messages=[{"role": "user", "content": user_text}],
        output_format=Pillar4Output,
    )
    return resp.parsed_output


# -----------------------------------------------------------------------------
# Public API — orchestrator called by main.py
# -----------------------------------------------------------------------------

def analyze_all(pillar3_data: Optional[dict], filename: str, file_hash: str) -> dict:
    """Run Pillars 1, 2, 4. Returns a dict with keys pillar1/pillar2/pillar4 + errors.

    Cached on disk by file_hash. Gracefully degrades if API key is missing or a
    pillar call fails — other pillars still return.
    """
    result: dict = {
        "pillar1": None, "pillar1_error": None,
        "pillar2": None, "pillar2_error": None,
        "pillar4": None, "pillar4_error": None,
        "cache_hit": False,
    }

    if not pillar3_data:
        err = "pillar3 data missing; LLM pillars require Pillar 3 outputs"
        result["pillar1_error"] = err
        result["pillar2_error"] = err
        result["pillar4_error"] = err
        return result

    cached = _load_cache(file_hash)
    if cached and all(k in cached for k in ("pillar1", "pillar2", "pillar4")):
        result["pillar1"] = cached["pillar1"]
        result["pillar2"] = cached["pillar2"]
        result["pillar4"] = cached["pillar4"]
        result["cache_hit"] = True
        return result

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        err = "ANTHROPIC_API_KEY not set; skipping LLM pillars"
        result["pillar1_error"] = err
        result["pillar2_error"] = err
        result["pillar4_error"] = err
        return result

    client = anthropic.Anthropic(api_key=api_key)
    p3_summary = _summarize_pillar3(pillar3_data)

    p1_obj: Optional[Pillar1Output] = None
    p2_obj: Optional[Pillar2Output] = None

    try:
        p1_obj = _call_pillar1(client, filename, p3_summary)
        result["pillar1"] = p1_obj.model_dump()
    except Exception as exc:
        logger.exception("pillar1 call failed")
        result["pillar1_error"] = str(exc)

    try:
        p2_obj = _call_pillar2(client, filename, p3_summary)
        result["pillar2"] = p2_obj.model_dump()
    except Exception as exc:
        logger.exception("pillar2 call failed")
        result["pillar2_error"] = str(exc)

    if p1_obj and p2_obj:
        try:
            p4_obj = _call_pillar4(client, filename, p3_summary, p1_obj, p2_obj)
            result["pillar4"] = p4_obj.model_dump()
        except Exception as exc:
            logger.exception("pillar4 call failed")
            result["pillar4_error"] = str(exc)
    else:
        result["pillar4_error"] = "pillar4 requires pillars 1 and 2 — one or both failed"

    # Cache only if all three succeeded (partial results are not cacheable —
    # a transient failure shouldn't get locked in).
    if result["pillar1"] and result["pillar2"] and result["pillar4"]:
        _write_cache(file_hash, {
            "file_hash": file_hash,
            "filename": filename,
            "pillar1": result["pillar1"],
            "pillar2": result["pillar2"],
            "pillar4": result["pillar4"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return result
