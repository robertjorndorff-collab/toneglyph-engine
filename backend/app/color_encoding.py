"""TICKET-006: Color Encoding Module — HSV-bridge CAS color encoding.

Maps all five pillar outputs into a single deterministic Chromatic Audio
Signature (CAS) comprising: HSV → RGB → CMYK color, Pantone-equivalent ID,
PBR lighting (Johari), geometry (Artistic DNA), motion (aggregate), beat-sync
luminance, 3D spatial coords, and a composite hash.

Post-Gemini-review spec:
  - HSV bridge (not direct CMYK)
  - Quantile (rank-based) normalization against a reference corpus
  - Pillar 4 Johari → PBR material properties
  - Pillar 2 DNA → geometry
  - All pillars → motion params
  - Beat-sync chroma → per-beat luminance multiplier

All outputs are deterministic — same pillar inputs produce identical CAS.
"""
from __future__ import annotations

import hashlib
import json
import math
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Reference corpus: sorted metric arrays from the initial 6-song validation
# set.  Quantile normalization ranks each new value against these.  As the
# corpus grows, replace with updated percentile boundaries.
# ---------------------------------------------------------------------------
REFERENCE_CORPUS: Dict[str, List[float]] = {
    "zeitgeist_score": [0.72, 0.82, 0.82, 0.88, 0.92, 0.95],
    "dna_score": [0.72, 0.72, 0.72, 0.82, 0.82, 0.82],
    "harmonic_complexity": [0.7666, 0.7731, 0.8112, 0.8446, 0.8894, 0.9251],
    "rhythmic_complexity": [0.2221, 0.2273, 0.3559, 0.4098, 0.4355, 0.5697],
    "hidden_complexity_score": [0.72, 0.74, 0.78, 0.78, 0.81, 0.82],
    "novelty_score": [0.471, 0.5084, 0.5165, 0.5263, 0.5297, 0.543],
    "tempo_bpm": [73.8281, 83.3543, 129.1992, 135.9992, 151.9991, 161.499],
    "beat_confidence_score": [0.7757, 0.8579, 0.8725, 0.8784, 0.9198, 0.9384],
    "spectral_centroid_mean": [587.1387, 1636.0289, 1644.0301, 1644.5677, 1734.6458, 2308.6804],
    "spectral_bandwidth_mean": [993.6503, 1565.5756, 1894.1483, 2021.5047, 2088.8928, 2585.5495],
}

# ---------------------------------------------------------------------------
# Genre → Hue mapping
# ---------------------------------------------------------------------------
_GENRE_HUE_TABLE = [
    (["jazz", "modal", "bebop", "swing", "big-band", "big band", "cool jazz", "bossa"], 220),
    (["classical", "piano", "minimalist", "impressionist", "baroque", "romantic",
      "chamber", "neo-classical", "proto-minimalist", "salon"], 275),
    (["rock", "hard rock", "prog", "psychedelic", "grunge", "metal",
      "arena rock", "punk", "alternative"], 15),
    (["folk", "acoustic", "singer-songwriter", "americana", "country",
      "bluegrass", "fingerpick"], 120),
    (["pop", "dance", "disco", "synth-pop", "new wave", "art-pop"], 50),
    (["electronic", "ambient", "techno", "house", "idm", "downtempo"], 185),
    (["r&b", "soul", "funk", "gospel", "motown"], 330),
    (["hip-hop", "rap", "trap", "grime"], 35),
]


def _round(v, ndigits=4):
    if isinstance(v, float):
        return round(v, ndigits)
    if isinstance(v, int):
        return v
    if isinstance(v, list):
        return [_round(x, ndigits) for x in v]
    if isinstance(v, dict):
        return {k: _round(x, ndigits) for k, x in v.items()}
    return v


# ---------------------------------------------------------------------------
# Quantile normalization
# ---------------------------------------------------------------------------

def _quantile_rank(value: float, metric: str) -> float:
    """CDF position of *value* within the reference corpus for *metric*.

    Returns 0.0 → 1.0.  Values below/above the reference range clamp to the
    extremes, ensuring no extrapolation.  Ties use the midpoint.

    With n=6 reference values the effective output grid is:
      {0.083, 0.167, 0.250, ..., 0.917}  (plus the clamped extremes).
    As the reference corpus grows, resolution improves automatically.
    """
    ref = REFERENCE_CORPUS.get(metric)
    if not ref:
        return 0.5
    n = len(ref)
    below = sum(1 for v in ref if v < value)
    equal = sum(1 for v in ref if abs(v - value) < 1e-9)
    rank = (below + equal / 2.0) / n
    return max(0.0, min(1.0, rank))


# ---------------------------------------------------------------------------
# HSV computation
# ---------------------------------------------------------------------------

def _detect_genre_hue(genre_position: str) -> float:
    """Map genre_position text → base hue (0-360°) via keyword matching."""
    text = genre_position.lower()
    scores: Dict[float, int] = {}
    for keywords, hue in _GENRE_HUE_TABLE:
        hits = sum(1 for kw in keywords if kw in text)
        if hits > 0:
            scores[hue] = scores.get(hue, 0) + hits
    if not scores:
        return 180.0  # teal fallback
    return max(scores, key=scores.get)


def _compute_hsv(
    genre_position: str,
    zeitgeist_score: float,
    novelty_score: float,
    harmonic_complexity: float,
    rhythmic_complexity: float,
    hidden_complexity_score: float,
) -> dict:
    # --- Hue ---
    base_hue = _detect_genre_hue(genre_position)
    zeit_q = _quantile_rank(zeitgeist_score, "zeitgeist_score")
    hue_shift = (zeit_q - 0.5) * 20  # ±10° warm/cool shift
    hue = (base_hue + hue_shift) % 360

    # --- Saturation ---
    nov_q = _quantile_rank(novelty_score, "novelty_score")
    harm_q = _quantile_rank(harmonic_complexity, "harmonic_complexity")
    raw_sat = 0.5 * nov_q + 0.5 * harm_q
    saturation = 0.30 + raw_sat * 0.70  # floor at 0.30

    # --- Value ---
    rhy_q = _quantile_rank(rhythmic_complexity, "rhythmic_complexity")
    hid_q = _quantile_rank(hidden_complexity_score, "hidden_complexity_score")
    raw_val = 0.5 * rhy_q + 0.5 * hid_q
    # Invert: dense/complex = deep (lower V), simple = light (higher V)
    value = 0.95 - raw_val * 0.65  # range [0.30, 0.95]

    return {"h": round(hue, 2), "s": round(saturation, 4), "v": round(value, 4)}


# ---------------------------------------------------------------------------
# Color space conversions
# ---------------------------------------------------------------------------

def _hsv_to_rgb(h: float, s: float, v: float) -> dict:
    """Standard HSV → RGB (0-255 integer)."""
    h_norm = (h % 360) / 60.0
    c = v * s
    x = c * (1 - abs(h_norm % 2 - 1))
    m = v - c
    i = int(h_norm) % 6
    r1, g1, b1 = [
        (c, x, 0), (x, c, 0), (0, c, x),
        (0, x, c), (x, 0, c), (c, 0, x),
    ][i]
    r = int(round((r1 + m) * 255))
    g = int(round((g1 + m) * 255))
    b = int(round((b1 + m) * 255))
    return {"r": r, "g": g, "b": b, "hex": f"#{r:02x}{g:02x}{b:02x}"}


def _rgb_to_cmyk(r: int, g: int, b: int) -> dict:
    """Standard RGB → CMYK (0.0-1.0)."""
    r_f, g_f, b_f = r / 255.0, g / 255.0, b / 255.0
    k = 1.0 - max(r_f, g_f, b_f)
    if k >= 1.0:
        return {"c": 0.0, "m": 0.0, "y": 0.0, "k": 1.0}
    c = (1.0 - r_f - k) / (1.0 - k)
    m = (1.0 - g_f - k) / (1.0 - k)
    y = (1.0 - b_f - k) / (1.0 - k)
    return {"c": round(c, 4), "m": round(m, 4), "y": round(y, 4), "k": round(k, 4)}


# ---------------------------------------------------------------------------
# Pantone-equivalent ID
# ---------------------------------------------------------------------------

_HUE_FAMILIES = [
    (0, "RED"), (30, "ORN"), (60, "YEL"), (90, "CHR"), (120, "GRN"),
    (150, "TEA"), (180, "CYN"), (210, "SKY"), (240, "BLU"), (270, "IND"),
    (300, "VIO"), (330, "MAG"), (360, "RED"),
]


def _pantone_id(h: float, s: float, v: float, file_hash: str) -> str:
    """Generate a deterministic ToneGlyph color ID (Pantone-equivalent)."""
    fam = "UNK"
    for lo, name in _HUE_FAMILIES:
        if h >= lo:
            fam = name
    s_int = int(round(s * 9))  # 0-9
    v_int = int(round(v * 9))  # 0-9
    suffix = file_hash[:4].upper()
    return f"TG-{fam}-{int(round(h)):03d}-S{s_int}V{v_int}-{suffix}"


# ---------------------------------------------------------------------------
# PBR Lighting (Pillar 4 Johari)
# ---------------------------------------------------------------------------

def _compute_lighting(pillar4: dict) -> dict:
    hc = pillar4.get("hidden_complexity_score", 0.5)
    q = pillar4.get("johari_quadrant_assignments", {})
    open_n = len(q.get("open", []))
    blind_n = len(q.get("blind", []))
    hidden_n = len(q.get("hidden", []))
    unknown_n = len(q.get("unknown", []))
    max_phrases = 5.0
    return {
        "transmission": round(hc, 4),
        "key_light_intensity": round(min(open_n / max_phrases, 1.0), 4),
        "rim_light_intensity": round(min(blind_n / max_phrases, 1.0), 4),
        "emissive_power": round(min(hidden_n / max_phrases, 1.0), 4),
        "ambient_occlusion": round(min(unknown_n / max_phrases, 1.0), 4),
    }


# ---------------------------------------------------------------------------
# Geometry (Pillar 2 Artistic DNA)
# ---------------------------------------------------------------------------

def _compute_geometry(pillar2: dict, pillar3: dict) -> dict:
    iv = pillar2.get("influence_vector", [])
    dna = pillar2.get("dna_score", 0.5)

    # Shape complexity: entropy of influence weights (more diverse = more complex)
    weights = [i.get("weight", 0) for i in iv]
    w_sum = sum(weights) or 1.0
    probs = [w / w_sum for w in weights]
    entropy = -sum(p * math.log2(p + 1e-12) for p in probs if p > 0)
    max_entropy = math.log2(max(len(probs), 1) + 1e-12)
    shape_complexity = round(entropy / max(max_entropy, 1e-12), 4)

    # Shape symmetry: inverted dna_score (high DNA distinctiveness = organic/asymmetric)
    shape_symmetry = round(1.0 - dna, 4)

    # Surface texture from spectral centroid + bandwidth
    centroid = pillar3.get("spectral", {}).get("centroid_mean", 1500)
    bandwidth = pillar3.get("spectral", {}).get("bandwidth_mean", 2000)
    centroid_q = _quantile_rank(centroid, "spectral_centroid_mean")
    bandwidth_q = _quantile_rank(bandwidth, "spectral_bandwidth_mean")
    if centroid_q >= 0.5 and bandwidth_q < 0.5:
        texture = "crystalline"
    elif centroid_q >= 0.5 and bandwidth_q >= 0.5:
        texture = "rough"
    elif centroid_q < 0.5 and bandwidth_q < 0.5:
        texture = "smooth"
    else:
        texture = "granular"

    return {
        "shape_complexity": shape_complexity,
        "shape_symmetry": shape_symmetry,
        "surface_texture": texture,
    }


# ---------------------------------------------------------------------------
# Motion (aggregate all pillars)
# ---------------------------------------------------------------------------

def _compute_motion(
    pillar2: dict, pillar3: dict, pillar4: dict, pillar5: dict,
) -> dict:
    tempo = pillar3.get("tempo", {}).get("bpm", 120)
    bc = pillar3.get("beat_confidence", {}).get("score", 0.5)
    iv = pillar2.get("influence_vector", [])
    nov = pillar5.get("novelty_score", 0.5)
    hc = pillar4.get("hidden_complexity_score", 0.5)

    # Spin rate: tempo normalized to 0-1 range (60-200 BPM band) + beat_confidence weight
    norm_tempo = max(0.0, min(1.0, (tempo - 60) / 140))
    spin_rate = 0.7 * norm_tempo + 0.3 * bc

    # Pulse amplitude: influence density × tempo
    influence_density = min(len(iv) / 6.0, 1.0)
    pulse_amplitude = influence_density * norm_tempo

    # Flutter frequency: novelty_score (already 0-1)
    flutter_frequency = nov

    # Flutter complexity: hidden_complexity_score (already 0-1)
    flutter_complexity = hc

    return {
        "spin_rate": round(spin_rate, 4),
        "pulse_amplitude": round(pulse_amplitude, 4),
        "flutter_frequency": round(flutter_frequency, 4),
        "flutter_complexity": round(flutter_complexity, 4),
    }


# ---------------------------------------------------------------------------
# Beat sync → per-beat luminance multiplier
# ---------------------------------------------------------------------------

def _compute_beat_sync(pillar3: dict) -> dict:
    beat_sync = pillar3.get("chroma", {}).get("beat_sync", [])
    if not beat_sync:
        return {"beat_count": 0, "luminance_multiplier": []}

    energies = [sum(vec) for vec in beat_sync]
    max_e = max(energies) if energies else 1.0
    if max_e < 1e-9:
        max_e = 1.0
    multipliers = [round(e / max_e, 4) for e in energies]
    return {
        "beat_count": len(beat_sync),
        "luminance_multiplier": multipliers,
    }


# ---------------------------------------------------------------------------
# 3D spatial encoding (nonlinear)
# ---------------------------------------------------------------------------

def _sigmoid(x: float) -> float:
    """Sigmoid squash to (0, 1)."""
    return 1.0 / (1.0 + math.exp(-x))


def _compute_3d(
    genre_position: str,
    harmonic_complexity: float,
    rhythmic_complexity: float,
    influence_vector: list,
) -> dict:
    # X (cultural): genre hue mapped to unit-circle position
    hue = _detect_genre_hue(genre_position)
    x = math.cos(math.radians(hue))

    # Y (complexity): gamma-compressed sum of harmonic + rhythmic
    raw_y = (harmonic_complexity + rhythmic_complexity) / 2.0
    gamma = 0.6
    y = math.pow(max(raw_y, 0.0), gamma)

    # Z (influence density): sigmoid of total influence weight
    total_weight = sum(i.get("weight", 0) for i in influence_vector)
    z = _sigmoid(total_weight - 1.0)  # centered around weight-sum=1

    return {"x": round(x, 4), "y": round(y, 4), "z": round(z, 4)}


# ---------------------------------------------------------------------------
# Composite hash
# ---------------------------------------------------------------------------

def _composite_hash(cas: dict) -> str:
    """SHA-256 of the deterministic JSON encoding of all CAS fields except
    the hash itself.  Ensures the signature is tamper-evident."""
    payload = json.dumps(cas, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def encode(
    pillar1: Optional[dict],
    pillar2: Optional[dict],
    pillar3: Optional[dict],
    pillar4: Optional[dict],
    pillar5: Optional[dict],
    file_hash: str,
) -> dict:
    """Produce the full CAS object from all five pillar outputs.

    Requires all five pillars.  Returns a dict ready for JSON serialization.
    All outputs are deterministic.
    """
    if not all([pillar1, pillar2, pillar3, pillar4, pillar5]):
        missing = []
        for name, val in [("pillar1", pillar1), ("pillar2", pillar2),
                          ("pillar3", pillar3), ("pillar4", pillar4),
                          ("pillar5", pillar5)]:
            if not val:
                missing.append(name)
        raise ValueError(f"CAS encoding requires all 5 pillars; missing: {missing}")

    # ---- HSV ----
    hsv = _compute_hsv(
        genre_position=pillar1["genre_position"],
        zeitgeist_score=pillar1["zeitgeist_score"],
        novelty_score=pillar5["novelty_score"],
        harmonic_complexity=pillar3["harmonic_complexity"],
        rhythmic_complexity=pillar3["rhythmic_complexity"],
        hidden_complexity_score=pillar4["hidden_complexity_score"],
    )

    # ---- RGB / CMYK ----
    rgb = _hsv_to_rgb(hsv["h"], hsv["s"], hsv["v"])
    cmyk = _rgb_to_cmyk(rgb["r"], rgb["g"], rgb["b"])
    pantone = _pantone_id(hsv["h"], hsv["s"], hsv["v"], file_hash)

    # ---- PBR Lighting (Johari) ----
    lighting = _compute_lighting(pillar4)

    # ---- Geometry (Artistic DNA) ----
    geometry = _compute_geometry(pillar2, pillar3)

    # ---- Motion (aggregate) ----
    motion = _compute_motion(pillar2, pillar3, pillar4, pillar5)

    # ---- Beat sync ----
    beat_sync = _compute_beat_sync(pillar3)

    # ---- 3D spatial ----
    coords_3d = _compute_3d(
        genre_position=pillar1["genre_position"],
        harmonic_complexity=pillar3["harmonic_complexity"],
        rhythmic_complexity=pillar3["rhythmic_complexity"],
        influence_vector=pillar2.get("influence_vector", []),
    )

    # ---- Assemble CAS (without hash) ----
    cas = {
        "hsv": hsv,
        "rgb": rgb,
        "cmyk": cmyk,
        "pantone_id": pantone,
        "lighting": lighting,
        "geometry": geometry,
        "motion": motion,
        "beat_sync": beat_sync,
        "coords_3d": coords_3d,
        "file_hash": file_hash,
    }

    # ---- Composite hash ----
    cas["composite_hash"] = _composite_hash(cas)

    return _round(cas, ndigits=4)
