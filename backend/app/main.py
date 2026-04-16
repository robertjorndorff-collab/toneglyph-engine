import hashlib
import logging
import os
import tempfile
import time
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment

# Load backend/.env (e.g. ANTHROPIC_API_KEY) before submodule imports read os.environ
load_dotenv()

from app import pillar3, pillar5, pillars_llm  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("toneglyph")

app = FastAPI(title="ToneGlyph Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

ALLOWED_FORMATS = {
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/aac": "aac",
}

EXTENSION_MAP = {
    ".mp3": "mp3",
    ".wav": "wav",
    ".flac": "flac",
    ".m4a": "m4a",
    ".aac": "aac",
}


def detect_format(content_type: Optional[str], filename: Optional[str]) -> str:
    if content_type and content_type in ALLOWED_FORMATS:
        return ALLOWED_FORMATS[content_type]
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        if ext in EXTENSION_MAP:
            return EXTENSION_MAP[ext]
    raise HTTPException(
        status_code=415,
        detail=f"Unsupported format. Accepted: MP3, WAV, FLAC, M4A, AAC",
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "toneglyph-engine"}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    fmt = detect_format(file.content_type, file.filename)

    tmp_path = None
    try:
        data = await file.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 50MB limit")

        file_hash = hashlib.sha256(data).hexdigest()

        suffix = f".{fmt}"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        with open(tmp_path, "wb") as f:
            f.write(data)

        try:
            audio = AudioSegment.from_file(tmp_path, format=fmt)
        except Exception:
            raise HTTPException(status_code=422, detail="Could not decode audio file")

        original_channels = audio.channels
        audio = audio.set_channels(1).set_frame_rate(44100)

        duration_sec = round(audio.duration_seconds, 3)

        # Pillar 3: Music theory analysis (operates directly on the temp file —
        # librosa handles its own resampling deterministically at SR=22050)
        pillar3_start = time.perf_counter()
        try:
            pillar3_data = pillar3.analyze(tmp_path)
            pillar3_error = None
        except Exception as exc:
            logger.exception("pillar3 analysis failed")
            pillar3_data = None
            pillar3_error = str(exc)
        pillar3_elapsed = round(time.perf_counter() - pillar3_start, 3)

        # Pillar 5: IP novelty / spectral fingerprint
        pillar5_start = time.perf_counter()
        try:
            pillar5_data = pillar5.analyze(tmp_path)
            pillar5_error = None
        except Exception as exc:
            logger.exception("pillar5 analysis failed")
            pillar5_data = None
            pillar5_error = str(exc)
        pillar5_elapsed = round(time.perf_counter() - pillar5_start, 3)

        # Pillars 1, 2, 4: LLM-assisted analysis (cached by file_hash)
        llm_start = time.perf_counter()
        llm_out = pillars_llm.analyze_all(
            pillar3_data=pillar3_data,
            filename=file.filename or "",
            file_hash=file_hash,
        )
        llm_elapsed = round(time.perf_counter() - llm_start, 3)

        return {
            "status": "ok",
            "file_hash": file_hash,
            "duration": duration_sec,
            "sample_rate": 44100,
            "channels": original_channels,
            "format": fmt,
            "filename": file.filename,
            "pillar3": pillar3_data,
            "pillar3_error": pillar3_error,
            "pillar3_elapsed_sec": pillar3_elapsed,
            "pillar5": pillar5_data,
            "pillar5_error": pillar5_error,
            "pillar5_elapsed_sec": pillar5_elapsed,
            "pillar1": llm_out["pillar1"],
            "pillar1_error": llm_out["pillar1_error"],
            "pillar2": llm_out["pillar2"],
            "pillar2_error": llm_out["pillar2_error"],
            "pillar4": llm_out["pillar4"],
            "pillar4_error": llm_out["pillar4_error"],
            "llm_cache_hit": llm_out["cache_hit"],
            "llm_elapsed_sec": llm_elapsed,
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
