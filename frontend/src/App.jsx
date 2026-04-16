import { useState, useEffect, useRef } from 'react'
import './App.css'
import ToneGlyph from './ToneGlyph'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const MAX_SIZE = 50 * 1024 * 1024
const ACCEPTED = '.mp3,.wav,.flac,.m4a,.aac'
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

/* ── CAS Signature card (RGB / CMYK / Pantone / hash) ───────────── */

function CasSignature({ cas }) {
  if (!cas) return null
  const { hsv, rgb, cmyk, pantone_id, composite_hash, lighting, geometry, motion } = cas
  return (
    <div className="signature-card">
      <div className="sig-color-block" style={{ background: rgb.hex }} />
      <div className="sig-data">
        <div className="sig-row">
          <span className="sig-label">Pantone</span>
          <span className="sig-value">{pantone_id}</span>
        </div>
        <div className="sig-row">
          <span className="sig-label">RGB</span>
          <span className="sig-value">{rgb.hex} <span className="muted">({rgb.r}, {rgb.g}, {rgb.b})</span></span>
        </div>
        <div className="sig-row">
          <span className="sig-label">CMYK</span>
          <span className="sig-value muted">C{fmt(cmyk.c,2)} M{fmt(cmyk.m,2)} Y{fmt(cmyk.y,2)} K{fmt(cmyk.k,2)}</span>
        </div>
        <div className="sig-row">
          <span className="sig-label">HSV</span>
          <span className="sig-value muted">{fmt(hsv.h,0)}° S{fmt(hsv.s,2)} V{fmt(hsv.v,2)}</span>
        </div>
        <div className="sig-row">
          <span className="sig-label">Texture</span>
          <span className="sig-value">{geometry.surface_texture}</span>
        </div>
        <div className="sig-row">
          <span className="sig-label">Hash</span>
          <span className="sig-value hash">{composite_hash}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Pillar sub-components (unchanged) ──────────────────────────── */

function Pillar1({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 1 — Zeitgeist</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  return (
    <div className="pillar-section">
      <h3>Pillar 1 — Zeitgeist</h3>
      <table className="result-table"><tbody>
        <tr><td>Score</td><td><div className="meter"><div className="meter-fill" style={{ width: `${data.zeitgeist_score * 100}%` }} /></div><span className="muted">{fmt(data.zeitgeist_score, 3)}</span></td></tr>
        <tr><td>Era</td><td>{data.era_alignment}</td></tr>
        <tr><td>Genre</td><td>{data.genre_position}</td></tr>
      </tbody></table>
      <p className="reasoning">{data.cultural_reasoning}</p>
    </div>
  )
}

function Pillar2({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 2 — Artistic DNA</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  return (
    <div className="pillar-section">
      <h3>Pillar 2 — Artistic DNA</h3>
      <table className="result-table"><tbody>
        <tr><td>DNA Score</td><td><div className="meter"><div className="meter-fill" style={{ width: `${data.dna_score * 100}%` }} /></div><span className="muted">{fmt(data.dna_score, 3)}</span></td></tr>
      </tbody></table>
      <div className="influence-block">
        <p className="chroma-label">Influence Vector</p>
        {data.influence_vector.map((inf, i) => (
          <div key={i} className="influence-row">
            <span className="influence-name">{inf.name}</span>
            <div className="meter small"><div className="meter-fill" style={{ width: `${inf.weight * 100}%` }} /></div>
            <span className="muted">{fmt(inf.weight, 2)}</span>
          </div>
        ))}
      </div>
      <p className="reasoning">{data.dna_reasoning}</p>
    </div>
  )
}

function Pillar4({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 4 — Johari Window</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  const q = data.johari_quadrant_assignments
  return (
    <div className="pillar-section">
      <h3>Pillar 4 — Johari Window</h3>
      <table className="result-table"><tbody>
        <tr><td>Hidden Complexity</td><td><div className="meter"><div className="meter-fill" style={{ width: `${data.hidden_complexity_score * 100}%` }} /></div><span className="muted">{fmt(data.hidden_complexity_score, 3)}</span></td></tr>
      </tbody></table>
      <div className="johari-grid">
        <div className="johari-cell"><span className="johari-label">Open</span><ul>{q.open.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="johari-cell"><span className="johari-label">Blind</span><ul>{q.blind.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="johari-cell"><span className="johari-label">Hidden</span><ul>{q.hidden.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="johari-cell"><span className="johari-label">Unknown</span><ul>{q.unknown.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      </div>
      <p className="reasoning">{data.johari_reasoning}</p>
    </div>
  )
}

function Pillar5({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 5 — IP Novelty</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  return (
    <div className="pillar-section">
      <h3>Pillar 5 — IP Novelty</h3>
      <table className="result-table"><tbody>
        <tr><td>Novelty</td><td><div className="meter"><div className="meter-fill" style={{ width: `${data.novelty_score * 100}%` }} /></div><span className="muted">{fmt(data.novelty_score, 3)}</span></td></tr>
        <tr><td>Fingerprint</td><td className="hash">{data.fingerprint_hash}</td></tr>
        <tr><td>Peaks</td><td>{data.peaks.count} <span className="muted">({fmt(data.peaks.density_per_sec, 1)}/s)</span></td></tr>
      </tbody></table>
    </div>
  )
}

function Pillar3({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 3 — Music Theory</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  const chromaMax = Math.max(...data.chroma.mean, 1e-9)
  return (
    <div className="pillar-section">
      <h3>Pillar 3 — Music Theory</h3>
      <table className="result-table"><tbody>
        <tr><td>Key</td><td>{data.key.name} <span className="muted">(conf {fmt(data.key.confidence, 3)})</span></td></tr>
        <tr><td>Tempo</td><td>{fmt(data.tempo.bpm, 1)} BPM <span className="muted">(stability {fmt(data.tempo.stability, 3)})</span></td></tr>
        <tr><td>Beats</td><td>{data.beats.count}</td></tr>
        <tr><td>Harmonic</td><td><div className="meter"><div className="meter-fill" style={{ width: `${data.harmonic_complexity * 100}%` }} /></div><span className="muted">{fmt(data.harmonic_complexity, 3)}</span></td></tr>
        <tr><td>Rhythmic</td><td><div className="meter"><div className="meter-fill" style={{ width: `${data.rhythmic_complexity * 100}%` }} /></div><span className="muted">{fmt(data.rhythmic_complexity, 3)}</span></td></tr>
      </tbody></table>
      <div className="chroma-block">
        <p className="chroma-label">Chromagram</p>
        <div className="chroma-bars">
          {data.chroma.mean.map((v, i) => (
            <div key={i} className="chroma-col">
              <div className="chroma-bar-wrap">
                <div className="chroma-bar" style={{ height: `${(v / chromaMax) * 100}%` }} />
              </div>
              <span className="chroma-tick">{PITCH_NAMES[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── App ────────────────────────────────────────────────────────── */

function App() {
  const [health, setHealth] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json()).then(d => setHealth(d))
      .catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  async function uploadFile(file) {
    setError(null); setResult(null)
    if (file.size > MAX_SIZE) { setError('File exceeds 50MB limit'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) setError(data.detail || 'Upload failed')
      else setResult(data)
    } catch { setError('Could not reach backend') }
    finally { setUploading(false) }
  }

  function onDrop(e) { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }
  function onFileSelect(e) { const f = e.target.files[0]; if (f) uploadFile(f); e.target.value = '' }

  const cas = result?.cas

  return (
    <div className="app">
      {/* Header — only show when no result */}
      {!result && (
        <>
          <p className="subtitle">Chromatic Audio Signature System</p>
          <h1>ToneGlyph Engine</h1>
          <div className={`status ${health?.status === 'ok' ? 'ok' : 'error'}`}>
            {health ? `Backend: ${health.status}` : 'Connecting...'}
          </div>
        </>
      )}

      {/* Upload zone */}
      <div
        className={`dropzone${dragging ? ' active' : ''}${uploading ? ' uploading' : ''}${result ? ' compact' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onFileSelect} hidden />
        {uploading
          ? <p className="drop-label">Analyzing...</p>
          : result
            ? <p className="drop-label drop-compact">Upload another file</p>
            : <>
                <p className="drop-label">Drop an audio file here</p>
                <p className="drop-hint">or click to browse — MP3, WAV, FLAC, M4A, AAC (max 50MB)</p>
              </>
        }
      </div>

      {error && <div className="result-card error-card">{error}</div>}

      {/* The Artifact */}
      {cas && <ToneGlyph cas={cas} />}

      {/* CAS Signature */}
      {cas && <CasSignature cas={cas} />}

      {/* Metadata + Pillar Readout */}
      {result && (
        <div className="result-card">
          <h2>{result.filename}</h2>
          <table className="result-table"><tbody>
            <tr><td>Duration</td><td>{result.duration}s</td></tr>
            <tr><td>Format</td><td>{result.format.toUpperCase()} · {result.channels}ch · {result.sample_rate}Hz</td></tr>
            <tr><td>SHA-256</td><td className="hash">{result.file_hash}</td></tr>
          </tbody></table>

          <Pillar3 data={result.pillar3} error={result.pillar3_error} />
          <Pillar1 data={result.pillar1} error={result.pillar1_error} />
          <Pillar2 data={result.pillar2} error={result.pillar2_error} />
          <Pillar4 data={result.pillar4} error={result.pillar4_error} />
          <Pillar5 data={result.pillar5} error={result.pillar5_error} />
        </div>
      )}
    </div>
  )
}

export default App
