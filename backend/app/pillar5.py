"""Pillar 5: IP Novelty / Spectral Fingerprint.

Deterministic constellation-style audio fingerprint + novelty score.
Same audio file always produces identical outputs.
"""
from __future__ import annotations

import hashlib
from typing import Optional

import numpy as np
import librosa
from scipy.ndimage import maximum_filter


# Fixed parameters for deterministic fingerprinting across runs
SR = 22050
N_FFT = 2048
HOP_LENGTH = 512
N_MELS = 128

# Peak-finding parameters
PEAK_NEIGHBORHOOD = (10, 10)   # (freq_bins, time_bins) local-max window
PEAK_PERCENTILE = 85           # only peaks above this energy percentile are kept


def _round(v, ndigits=4):
    if isinstance(v, float):
        return round(v, ndigits)
    if isinstance(v, list):
        return [_round(x, ndigits) for x in v]
    if isinstance(v, dict):
        return {k: _round(x, ndigits) for k, x in v.items()}
    return v


def _spectral_peaks(log_mel: np.ndarray) -> np.ndarray:
    """Return an (N, 2) array of (mel_bin, time_bin) peak coordinates.

    Finds local maxima in a log-mel spectrogram using a max filter; keeps
    only peaks above a global percentile threshold.
    """
    local_max = maximum_filter(log_mel, size=PEAK_NEIGHBORHOOD, mode="constant")
    is_peak = (log_mel == local_max)
    threshold = np.percentile(log_mel, PEAK_PERCENTILE)
    is_peak &= log_mel >= threshold
    coords = np.argwhere(is_peak)  # rows = (mel_bin, time_bin)
    # Sort for deterministic serialization order
    if coords.size > 0:
        order = np.lexsort((coords[:, 1], coords[:, 0]))
        coords = coords[order]
    return coords


def _fingerprint_hash(peaks: np.ndarray) -> str:
    """SHA-256 of the spectral peak constellation."""
    # Use bytes view for speed; np.int32 is deterministic across platforms
    payload = peaks.astype(np.int32).tobytes()
    return hashlib.sha256(payload).hexdigest()


def analyze(path: str) -> dict:
    """Run Pillar 5 novelty/fingerprint analysis on an audio file."""
    np.random.seed(0)

    y, sr = librosa.load(path, sr=SR, mono=True)
    if y.size == 0:
        raise ValueError("audio is empty after decoding")
    duration = float(y.size) / sr

    # Log-mel spectrogram — basis for both fingerprint and novelty metrics
    mel = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)

    # --- Fingerprint hash via constellation-style peaks ---
    peaks = _spectral_peaks(log_mel)
    fingerprint_hash = _fingerprint_hash(peaks)
    peak_count = int(peaks.shape[0])
    peak_density = float(peak_count / duration) if duration > 0 else 0.0

    # --- Novelty score components ---
    # Spectral flatness: noise-like = 1, tonal = 0. Mean over frames.
    flatness = librosa.feature.spectral_flatness(
        y=y, n_fft=N_FFT, hop_length=HOP_LENGTH
    )[0]
    flatness_mean = float(flatness.mean())
    flatness_std = float(flatness.std())

    # 7-band spectral contrast: valley-to-peak ratio per band (timbral uniqueness)
    contrast = librosa.feature.spectral_contrast(
        y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH
    )
    contrast_mean = contrast.mean(axis=1)
    contrast_std_overall = float(contrast.std())

    # Chromagram variance — harmonic uniqueness
    chroma = librosa.feature.chroma_stft(
        y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH
    )
    chroma_var = float(chroma.var(axis=1).mean())

    # MFCC means — timbral fingerprint component
    mfcc = librosa.feature.mfcc(
        y=y, sr=sr, n_mfcc=13, n_fft=N_FFT, hop_length=HOP_LENGTH
    )
    mfcc_mean = mfcc.mean(axis=1)

    # Tonnetz means — tonal centroid position
    tonnetz = librosa.feature.tonnetz(y=y, sr=sr)
    tonnetz_mean = tonnetz.mean(axis=1)

    # --- Novelty score: weighted blend, clamped to [0,1] ---
    # Each component is normalized to a rough 0-1 range based on observed
    # distributions for musical content.
    norm_flatness = min(flatness_mean / 0.25, 1.0)
    norm_contrast = min(float(contrast_mean.mean()) / 25.0, 1.0)
    norm_chroma = min(chroma_var / 0.1, 1.0)
    norm_density = min(peak_density / 50.0, 1.0)

    novelty_score = float(
        0.30 * norm_flatness
        + 0.25 * norm_contrast
        + 0.25 * norm_chroma
        + 0.20 * norm_density
    )
    novelty_score = max(0.0, min(1.0, novelty_score))

    # Spectral uniqueness vector — 26-dim summary for future similarity search
    uniqueness_vector = np.concatenate([
        contrast_mean,      # 7 dims (spectral contrast)
        mfcc_mean,          # 13 dims (timbral)
        tonnetz_mean,       # 6 dims (tonal centroid)
    ]).tolist()

    result = {
        "fingerprint_hash": fingerprint_hash,
        "novelty_score": novelty_score,
        "spectral_uniqueness_vector": uniqueness_vector,
        "peaks": {
            "count": peak_count,
            "density_per_sec": peak_density,
        },
        "spectral_flatness": {
            "mean": flatness_mean,
            "std": flatness_std,
        },
        "spectral_contrast": {
            "per_band_mean": contrast_mean.tolist(),
            "overall_std": contrast_std_overall,
        },
        "components": {
            "norm_flatness": norm_flatness,
            "norm_contrast": norm_contrast,
            "norm_chroma": norm_chroma,
            "norm_density": norm_density,
        },
        "analysis_sample_rate": SR,
    }

    return _round(result, ndigits=6)
