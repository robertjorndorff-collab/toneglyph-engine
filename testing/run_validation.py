"""Validation run: send 6 audio files to /api/analyze and summarize results."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

API_URL = os.environ.get("TONEGLYPH_API", "http://localhost:8100")
ENDPOINT = f"{API_URL}/api/analyze"

MP3_DIR = "/Users/robertorndorff/Desktop/CASS/toneglyph-engine/testing/mp3s"

FILES = [
    f"{MP3_DIR}/01 - Gymnop\u00e9dies, 1. Lent et douloureux.mp3",
    f"{MP3_DIR}/04 Stairway To Heaven.mp3",
    f"{MP3_DIR}/19 So What.mp3",
    f"{MP3_DIR}/The Lady is a Tramp_Frank.mp3",
    f"{MP3_DIR}/Tori Amos - Purple Rain.mp3",
    f"{MP3_DIR}/D2 -02 - James Taylor - Fire And Rain .mp3",
]


def analyze(path: str) -> dict:
    filename = os.path.basename(path)
    if not os.path.exists(path):
        return {"filename": filename, "_path": path, "error": "file not found"}

    t0 = time.perf_counter()
    try:
        with open(path, "rb") as f:
            resp = requests.post(
                ENDPOINT,
                files={"file": (filename, f, "audio/mpeg")},
                timeout=300,
            )
        elapsed = time.perf_counter() - t0
        data = resp.json()
        data["_client_elapsed_sec"] = round(elapsed, 3)
        data["_http_status"] = resp.status_code
        data["_path"] = path
        return data
    except PermissionError as exc:
        return {
            "filename": filename,
            "_path": path,
            "error": f"permission denied (macOS Full Disk Access?): {exc}",
            "_client_elapsed_sec": round(time.perf_counter() - t0, 3),
        }
    except OSError as exc:
        return {
            "filename": filename,
            "_path": path,
            "error": f"read failed: {exc}",
            "_client_elapsed_sec": round(time.perf_counter() - t0, 3),
        }
    except requests.RequestException as exc:
        return {
            "filename": filename,
            "_path": path,
            "error": f"request failed: {exc}",
            "_client_elapsed_sec": round(time.perf_counter() - t0, 3),
        }


def summarize(r: dict) -> str:
    name = r.get("filename") or os.path.basename(r.get("_path", r.get("path", "?")))
    if "error" in r:
        return f"{name}\n  ERROR: {r['error']}"
    p3 = r.get("pillar3") or {}
    if not p3:
        err = r.get("pillar3_error") or r.get("detail") or "no pillar3"
        return f"{name}\n  ERROR: {err}"
    key = p3.get("key", {})
    tempo = p3.get("tempo", {})
    return (
        f"{name}\n"
        f"  key               : {key.get('name')}  (conf {key.get('confidence')})\n"
        f"  tempo             : {tempo.get('bpm')} BPM  (stability {tempo.get('stability')})\n"
        f"  harmonic_complexity: {p3.get('harmonic_complexity')}\n"
        f"  rhythmic_complexity: {p3.get('rhythmic_complexity')}\n"
        f"  pillar3 time      : {r.get('pillar3_elapsed_sec')}s"
        f"  (end-to-end {r.get('_client_elapsed_sec')}s)"
    )


def main() -> int:
    print(f"Endpoint: {ENDPOINT}")
    try:
        h = requests.get(f"{API_URL}/health", timeout=5).json()
        print(f"Backend: {h}")
    except requests.RequestException as exc:
        print(f"Backend unreachable: {exc}", file=sys.stderr)
        return 1
    print()

    results = []
    for i, path in enumerate(FILES, 1):
        print(f"[{i}/{len(FILES)}] {os.path.basename(path)}")
        r = analyze(path)
        results.append(r)
        print(summarize(r))
        print()

    out = Path(__file__).parent / "validation_results.json"
    out.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"Full results saved to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
