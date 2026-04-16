"""Pillar 3: Music Theory analysis using librosa.

All outputs are deterministic — same audio file always produces identical values.
"""
from __future__ import annotations

import logging

import numpy as np
import librosa
from scipy.signal import find_peaks

logger = logging.getLogger("toneglyph.pillar3")


# Krumhansl-Schmuckler key profiles for major/minor key estimation
_MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
_MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)
_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Fixed analysis sample rate — chosen for determinism and standard MIR throughput
SR = 22050
N_MFCC = 13
RMS_CURVE_POINTS = 200


def _round(v, ndigits=4):
    """Recursively round numbers in nested structures for stable JSON output."""
    if isinstance(v, float):
        return round(v, ndigits)
    if isinstance(v, list):
        return [_round(x, ndigits) for x in v]
    if isinstance(v, dict):
        return {k: _round(x, ndigits) for k, x in v.items()}
    return v


def _downsample(arr: np.ndarray, n: int) -> list:
    """Downsample a 1-D array to ~n points by uniform index sampling."""
    if len(arr) <= n:
        return arr.tolist()
    idx = np.linspace(0, len(arr) - 1, n).astype(int)
    return arr[idx].tolist()


def _estimate_key(chroma_mean: np.ndarray) -> dict:
    """Krumhansl-Schmuckler key estimation against the mean chroma vector."""
    best_score = -np.inf
    best_label = "C major"
    second_score = -np.inf

    for tonic in range(12):
        for mode_name, profile in (("major", _MAJOR_PROFILE), ("minor", _MINOR_PROFILE)):
            rotated = np.roll(profile, tonic)
            score = float(np.corrcoef(chroma_mean, rotated)[0, 1])
            if score > best_score:
                second_score = best_score
                best_score = score
                best_label = f"{_PITCH_NAMES[tonic]} {mode_name}"
            elif score > second_score:
                second_score = score

    margin = best_score - second_score if second_score > -np.inf else best_score
    return {
        "name": best_label,
        "confidence": float(best_score),
        "margin": float(margin),
    }


def _scalar_tempo(tempo) -> float:
    """librosa returns tempo as scalar or 1-element ndarray depending on version."""
    arr = np.asarray(tempo).ravel()
    return float(arr[0]) if arr.size else 0.0


def _beat_confidence(
    onset_env: np.ndarray, beat_frames: np.ndarray, tempo_stability: float
) -> dict:
    """Confidence the beat tracker locked onto real onsets.

    Combines:
      - peak sharpness: mean onset-strength at beat frames vs overall mean.
        A beat tracker hitting strong onsets gives a ratio > 1.
      - tempo stability: 1 - std/mean of dynamic tempo (already computed).
    """
    if beat_frames.size == 0 or onset_env.size == 0:
        return {"score": 0.0, "peak_sharpness_ratio": 0.0, "tempo_stability": float(tempo_stability)}

    valid = beat_frames[beat_frames < onset_env.size]
    if valid.size == 0:
        return {"score": 0.0, "peak_sharpness_ratio": 0.0, "tempo_stability": float(tempo_stability)}

    onset_mean = float(onset_env.mean())
    if onset_mean <= 1e-9:
        ratio = 0.0
    else:
        ratio = float(onset_env[valid].mean() / onset_mean)

    # 3x mean = saturation: strong onsets land squarely on beats
    norm_sharpness = min(ratio / 3.0, 1.0)
    score = 0.5 * norm_sharpness + 0.5 * float(tempo_stability)
    return {
        "score": float(max(0.0, min(1.0, score))),
        "peak_sharpness_ratio": ratio,
        "tempo_stability": float(tempo_stability),
    }


def _structure_confidence(
    chroma_cqt: np.ndarray, beat_chroma: np.ndarray, chroma_var: float
) -> dict:
    """Confidence that the track has clear structural sections.

    Combines:
      - chroma variance: flat chroma → no structure; varying chroma → some structure
      - boundary clarity: peak prominence of the beat-sync chroma novelty curve.
        A song with clear section changes (verse → chorus → bridge) has sharp,
        prominent novelty peaks. A drone or single-chord vamp has none.
    """
    norm_chroma_var = min(float(chroma_var) / 0.1, 1.0)

    # Frame-to-frame chroma distance, computed on the beat-sync grid for stability.
    # Falls back to frame-level if there are too few beats.
    if beat_chroma.shape[1] >= 4:
        novelty = np.linalg.norm(np.diff(beat_chroma, axis=1), axis=0)
    elif chroma_cqt.shape[1] >= 4:
        novelty = np.linalg.norm(np.diff(chroma_cqt, axis=1), axis=0)
    else:
        novelty = np.array([])

    mean_prominence = 0.0
    boundary_count = 0
    if novelty.size >= 4:
        peaks, props = find_peaks(novelty, prominence=0.05)
        boundary_count = int(peaks.size)
        if boundary_count > 0:
            mean_prominence = float(np.mean(props["prominences"]))

    # Empirical: prominence of ~0.5 on a beat-sync chroma novelty curve is "clearly
    # sectional"; scale to saturation at 1.0.
    norm_boundary = min(mean_prominence / 0.5, 1.0)
    score = 0.5 * norm_chroma_var + 0.5 * norm_boundary
    return {
        "score": float(max(0.0, min(1.0, score))),
        "chroma_variance": float(chroma_var),
        "boundary_mean_prominence": mean_prominence,
        "boundary_count": boundary_count,
    }


def analyze(path: str) -> dict:
    """Run Pillar 3 music theory analysis on an audio file.

    Args:
        path: filesystem path to an audio file readable by librosa.

    Returns:
        Dict of extracted features and complexity scores.
    """
    np.random.seed(0)

    # Load mono at fixed sample rate for deterministic resampling
    y, sr = librosa.load(path, sr=SR, mono=True)

    if y.size == 0:
        raise ValueError("audio is empty after decoding")

    duration = float(y.size) / sr

    # Chromagram (12-bin) — STFT for key estimation, CQT for beat-sync structure.
    # CQT chroma is more harmonically accurate (constant-Q over musical pitch),
    # which is what we want for chord/section work.
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    chroma_std = chroma.std(axis=1)

    chroma_cqt = librosa.feature.chroma_cqt(y=y, sr=sr)

    # Key estimation via Krumhansl-Schmuckler (uses STFT chroma for parity with prior runs)
    key = _estimate_key(chroma_mean)

    # Tempo + beats
    tempo_est, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo_bpm = _scalar_tempo(tempo_est)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # Beat-synced chroma: collapse frame-level CQT chroma to one 12-vector per beat
    # by taking the median over each inter-beat interval. Median is more robust than
    # mean against transient onsets within a beat.
    if beat_frames.size > 0:
        beat_chroma = librosa.util.sync(
            chroma_cqt, beat_frames, aggregate=np.median
        )
    else:
        beat_chroma = np.empty((12, 0))

    # Per-beat chroma vectors as a list of 12-element lists (one entry per beat)
    chroma_beat_sync = beat_chroma.T.tolist() if beat_chroma.size > 0 else []

    # Dynamic tempo for stability score
    try:
        dyn_tempo = librosa.feature.rhythm.tempo(y=y, sr=sr, aggregate=None)
    except AttributeError:
        dyn_tempo = librosa.beat.tempo(y=y, sr=sr, aggregate=None)
    dyn_tempo = np.asarray(dyn_tempo).ravel()
    if dyn_tempo.size > 0:
        dt_mean = float(dyn_tempo.mean())
        dt_std = float(dyn_tempo.std())
        tempo_stability = max(0.0, 1.0 - (dt_std / max(dt_mean, 1e-6)))
    else:
        dt_mean, dt_std, tempo_stability = tempo_bpm, 0.0, 1.0

    # Onset detection
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
    onset_density = float(len(onset_frames) / duration) if duration > 0 else 0.0

    # Spectral features
    cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    bw = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    rms = librosa.feature.rms(y=y)[0]

    # MFCCs (13 coefficients)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)

    # Harmonic complexity: mean variance across chroma bins (0..~0.25 typical)
    # Normalized so a flat chromagram → 0, highly varying → ~1
    chroma_var = float(chroma.var(axis=1).mean())
    harmonic_complexity = float(min(chroma_var / 0.1, 1.0))

    # Rhythmic complexity: blend onset density (capped at 5/s) with tempo instability
    norm_density = min(onset_density / 5.0, 1.0)
    rhythmic_complexity = float((norm_density + (1.0 - tempo_stability)) / 2.0)

    # Diagnostic confidence scores — LOG ONLY. These are observability signals for
    # tuning the analysis, NOT inputs to the color encoding (TICKET-006). Do not
    # wire into harmonic_complexity, rhythmic_complexity, or any downstream pillar
    # composition without an explicit ticket.
    beat_conf = _beat_confidence(onset_env, beat_frames, tempo_stability)
    structure_conf = _structure_confidence(chroma_cqt, beat_chroma, chroma_var)
    logger.info(
        "pillar3 confidence — beat=%.3f (sharpness=%.2f, stability=%.2f) "
        "structure=%.3f (chroma_var=%.3f, boundaries=%d, mean_prominence=%.3f)",
        beat_conf["score"], beat_conf["peak_sharpness_ratio"], beat_conf["tempo_stability"],
        structure_conf["score"], structure_conf["chroma_variance"],
        structure_conf["boundary_count"], structure_conf["boundary_mean_prominence"],
    )

    result = {
        "key": key,
        "tempo": {
            "bpm": tempo_bpm,
            "dynamic_mean": dt_mean,
            "dynamic_std": dt_std,
            "stability": tempo_stability,
        },
        "beats": {
            "count": int(len(beat_times)),
            "times": beat_times.tolist(),
        },
        "onsets": {
            "count": int(len(onset_frames)),
            "density": onset_density,
        },
        "chroma": {
            "mean": chroma_mean.tolist(),
            "std": chroma_std.tolist(),
            "beat_sync": chroma_beat_sync,
        },
        "spectral": {
            "centroid_mean": float(cent.mean()),
            "centroid_std": float(cent.std()),
            "bandwidth_mean": float(bw.mean()),
            "bandwidth_std": float(bw.std()),
            "rolloff_mean": float(rolloff.mean()),
            "rolloff_std": float(rolloff.std()),
        },
        "zero_crossing_rate": {
            "mean": float(zcr.mean()),
            "std": float(zcr.std()),
        },
        "rms": {
            "mean": float(rms.mean()),
            "std": float(rms.std()),
            "curve": _downsample(rms, RMS_CURVE_POINTS),
        },
        "mfcc": {
            "n_coeffs": N_MFCC,
            "mean": mfccs.mean(axis=1).tolist(),
            "std": mfccs.std(axis=1).tolist(),
        },
        "harmonic_complexity": harmonic_complexity,
        "rhythmic_complexity": rhythmic_complexity,
        # Diagnostic — observability only. NOT consumed by color encoding.
        "beat_confidence": beat_conf,
        "structure_confidence": structure_conf,
        "analysis_sample_rate": SR,
    }

    return _round(result, ndigits=4)
