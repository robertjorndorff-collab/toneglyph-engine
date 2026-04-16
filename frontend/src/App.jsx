import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const MAX_SIZE = 50 * 1024 * 1024
const ACCEPTED = '.mp3,.wav,.flac,.m4a,.aac'
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

function Pillar1({ data, error }) {
  if (error) {
    return (
      <div className="pillar3-section">
        <h3>Pillar 1 — Zeitgeist</h3>
        <p className="pillar-error">{error}</p>
      </div>
    )
  }
  if (!data) return null
  return (
    <div className="pillar3-section">
      <h3>Pillar 1 — Zeitgeist</h3>
      <table className="result-table">
        <tbody>
          <tr>
            <td>Score</td>
            <td>
              <div className="meter"><div className="meter-fill" style={{ width: `${data.zeitgeist_score * 100}%` }} /></div>
              <span className="muted">{fmt(data.zeitgeist_score, 3)}</span>
            </td>
          </tr>
          <tr><td>Era</td><td>{data.era_alignment}</td></tr>
          <tr><td>Genre</td><td>{data.genre_position}</td></tr>
        </tbody>
      </table>
      <p className="reasoning">{data.cultural_reasoning}</p>
    </div>
  )
}

function Pillar2({ data, error }) {
  if (error) {
    return (
      <div className="pillar3-section">
        <h3>Pillar 2 — Artistic DNA</h3>
        <p className="pillar-error">{error}</p>
      </div>
    )
  }
  if (!data) return null
  return (
    <div className="pillar3-section">
      <h3>Pillar 2 — Artistic DNA</h3>
      <table className="result-table">
        <tbody>
          <tr>
            <td>DNA Score</td>
            <td>
              <div className="meter"><div className="meter-fill" style={{ width: `${data.dna_score * 100}%` }} /></div>
              <span className="muted">{fmt(data.dna_score, 3)}</span>
            </td>
          </tr>
        </tbody>
      </table>
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
  if (error) {
    return (
      <div className="pillar3-section">
        <h3>Pillar 4 — Johari Window</h3>
        <p className="pillar-error">{error}</p>
      </div>
    )
  }
  if (!data) return null
  const q = data.johari_quadrant_assignments
  return (
    <div className="pillar3-section">
      <h3>Pillar 4 — Johari Window</h3>
      <table className="result-table">
        <tbody>
          <tr>
            <td>Hidden Complexity</td>
            <td>
              <div className="meter"><div className="meter-fill" style={{ width: `${data.hidden_complexity_score * 100}%` }} /></div>
              <span className="muted">{fmt(data.hidden_complexity_score, 3)}</span>
            </td>
          </tr>
        </tbody>
      </table>
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

function Pillar5({ data, error, elapsed }) {
  if (error) {
    return (
      <div className="pillar3-section">
        <h3>Pillar 5 — IP Novelty</h3>
        <p className="pillar-error">Analysis failed: {error}</p>
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="pillar3-section">
      <h3>Pillar 5 — IP Novelty <span className="elapsed">{fmt(elapsed, 2)}s</span></h3>
      <table className="result-table">
        <tbody>
          <tr>
            <td>Novelty</td>
            <td>
              <div className="meter"><div className="meter-fill" style={{ width: `${data.novelty_score * 100}%` }} /></div>
              <span className="muted">{fmt(data.novelty_score, 3)}</span>
            </td>
          </tr>
          <tr><td>Fingerprint</td><td className="hash">{data.fingerprint_hash}</td></tr>
          <tr><td>Peaks</td><td>{data.peaks.count} <span className="muted">({fmt(data.peaks.density_per_sec, 1)}/s)</span></td></tr>
          <tr>
            <td>Flatness</td>
            <td className="muted">mean {fmt(data.spectral_flatness.mean, 4)} · std {fmt(data.spectral_flatness.std, 4)}</td>
          </tr>
          <tr>
            <td>Components</td>
            <td className="muted">
              flat {fmt(data.components.norm_flatness, 2)} ·
              contrast {fmt(data.components.norm_contrast, 2)} ·
              chroma {fmt(data.components.norm_chroma, 2)} ·
              density {fmt(data.components.norm_density, 2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Pillar3({ data, error, elapsed }) {
  if (error) {
    return (
      <div className="pillar3-section">
        <h3>Pillar 3 — Music Theory</h3>
        <p className="pillar-error">Analysis failed: {error}</p>
      </div>
    )
  }
  if (!data) return null

  const chromaMax = Math.max(...data.chroma.mean, 1e-9)

  return (
    <div className="pillar3-section">
      <h3>Pillar 3 — Music Theory <span className="elapsed">{fmt(elapsed, 2)}s</span></h3>
      <table className="result-table">
        <tbody>
          <tr><td>Key</td><td>{data.key.name} <span className="muted">(conf {fmt(data.key.confidence, 3)})</span></td></tr>
          <tr><td>Tempo</td><td>{fmt(data.tempo.bpm, 1)} BPM <span className="muted">(stability {fmt(data.tempo.stability, 3)})</span></td></tr>
          <tr><td>Beats</td><td>{data.beats.count}</td></tr>
          <tr><td>Onsets</td><td>{data.onsets.count} <span className="muted">({fmt(data.onsets.density, 2)}/s)</span></td></tr>
          <tr>
            <td>Harmonic</td>
            <td>
              <div className="meter"><div className="meter-fill" style={{ width: `${data.harmonic_complexity * 100}%` }} /></div>
              <span className="muted">{fmt(data.harmonic_complexity, 3)}</span>
            </td>
          </tr>
          <tr>
            <td>Rhythmic</td>
            <td>
              <div className="meter"><div className="meter-fill" style={{ width: `${data.rhythmic_complexity * 100}%` }} /></div>
              <span className="muted">{fmt(data.rhythmic_complexity, 3)}</span>
            </td>
          </tr>
          <tr>
            <td>Spectral</td>
            <td className="muted">
              centroid {fmt(data.spectral.centroid_mean, 0)}Hz · bandwidth {fmt(data.spectral.bandwidth_mean, 0)}Hz · rolloff {fmt(data.spectral.rolloff_mean, 0)}Hz
            </td>
          </tr>
          <tr>
            <td>ZCR / RMS</td>
            <td className="muted">
              zcr {fmt(data.zero_crossing_rate.mean, 4)} · rms {fmt(data.rms.mean, 4)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="chroma-block">
        <p className="chroma-label">Chromagram (mean energy per pitch class)</p>
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

function App() {
  const [health, setHealth] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  async function uploadFile(file) {
    setError(null)
    setResult(null)

    if (file.size > MAX_SIZE) {
      setError('File exceeds 50MB limit')
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Upload failed')
      } else {
        setResult(data)
      }
    } catch {
      setError('Could not reach backend')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function onFileSelect(e) {
    const file = e.target.files[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  return (
    <div className="app">
      <p className="subtitle">Chromatic Audio Signature System</p>
      <h1>ToneGlyph Engine</h1>
      <div className={`status ${health?.status === 'ok' ? 'ok' : 'error'}`}>
        {health ? `Backend: ${health.status}` : 'Connecting...'}
      </div>

      <div
        className={`dropzone${dragging ? ' active' : ''}${uploading ? ' uploading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onFileSelect}
          hidden
        />
        {uploading
          ? <p className="drop-label">Analyzing...</p>
          : <>
              <p className="drop-label">Drop an audio file here</p>
              <p className="drop-hint">or click to browse — MP3, WAV, FLAC, M4A, AAC (max 50MB)</p>
            </>
        }
      </div>

      {error && <div className="result-card error-card">{error}</div>}

      {result && (
        <div className="result-card">
          <h2>Analysis Result</h2>
          <table className="result-table">
            <tbody>
              <tr><td>File</td><td>{result.filename}</td></tr>
              <tr><td>Format</td><td>{result.format.toUpperCase()}</td></tr>
              <tr><td>Duration</td><td>{result.duration}s</td></tr>
              <tr><td>Sample Rate</td><td>{result.sample_rate} Hz</td></tr>
              <tr><td>Channels</td><td>{result.channels}</td></tr>
              <tr><td>SHA-256</td><td className="hash">{result.file_hash}</td></tr>
            </tbody>
          </table>

          <Pillar3
            data={result.pillar3}
            error={result.pillar3_error}
            elapsed={result.pillar3_elapsed_sec}
          />

          <Pillar1 data={result.pillar1} error={result.pillar1_error} />
          <Pillar2 data={result.pillar2} error={result.pillar2_error} />
          <Pillar4 data={result.pillar4} error={result.pillar4_error} />

          <Pillar5
            data={result.pillar5}
            error={result.pillar5_error}
            elapsed={result.pillar5_elapsed_sec}
          />

          {result.llm_cache_hit && (
            <p className="cache-note">LLM pillars served from cache</p>
          )}
        </div>
      )}
    </div>
  )
}

export default App
