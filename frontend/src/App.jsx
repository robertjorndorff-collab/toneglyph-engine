import { useState, useEffect, useRef, Component } from 'react'
import './App.css'
import ToneGlyph, { MODELS, BINDINGS, resolveBindings } from './ToneGlyph'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const MAX_SIZE = 50 * 1024 * 1024
const ACCEPTED = '.mp3,.wav,.flac,.m4a,.aac'
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const UPLOAD_TIMEOUT_MS = 120_000

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

/* ── Error Boundary ──────────────────────────────────────────────── */

class GlyphErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(e, info) { console.error('[GlyphErrorBoundary]', e, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="glyph-fallback">
          <div className="fallback-swatch" style={{ background: this.props.hex || '#808080' }} />
          <p className="fallback-msg">3D visualization crashed — data readout below</p>
        </div>
      )
    }
    return this.props.children
  }
}

/* ── Global Toast ────────────────────────────────────────────────── */

function useGlobalErrorToast() {
  const [toast, setToast] = useState(null)
  useEffect(() => {
    function handler(event) {
      const msg = event.reason?.message || event.message || 'Unexpected error'
      console.error('[global]', msg)
      setToast(msg)
      setTimeout(() => setToast(null), 8000)
    }
    window.addEventListener('error', handler)
    window.addEventListener('unhandledrejection', handler)
    return () => { window.removeEventListener('error', handler); window.removeEventListener('unhandledrejection', handler) }
  }, [])
  return toast
}

/* ── Settings Panel ──────────────────────────────────────────────── */

function SettingsPanel({ modelName, setModelName, bindingName, setBindingName }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`settings-panel ${open ? 'open' : ''}`}>
      <button className="settings-toggle" onClick={() => setOpen(!open)}>
        {open ? '✕' : '⚙'}
      </button>
      {open && (
        <div className="settings-body">
          <label>
            <span className="settings-label">Visual Model</span>
            <select value={modelName} onChange={e => setModelName(e.target.value)}>
              {Object.keys(MODELS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            <span className="settings-label">Pillar Binding</span>
            <select value={bindingName} onChange={e => setBindingName(e.target.value)}>
              {Object.keys(BINDINGS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <p className="settings-hint">{MODELS[modelName]?.description}</p>
        </div>
      )}
    </div>
  )
}

/* ── How This Glyph Was Built ────────────────────────────────────── */

function GlyphDiagnostics({ result, modelName, bindingName }) {
  const [open, setOpen] = useState(false)
  const binding = BINDINGS[bindingName]
  if (!result || !binding) return null

  const rv = resolveBindings(binding, result)

  function fmtVal(v) {
    if (v === undefined || v === null) return '—'
    if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(4) : 'NaN'
    if (typeof v === 'string') return v.length > 60 ? v.slice(0, 57) + '…' : v
    if (Array.isArray(v)) return `[${v.length} items]`
    return String(v).slice(0, 40)
  }

  return (
    <div className="diagnostics">
      <button className="diag-toggle" onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'}: How This Glyph Was Built
      </button>
      {open && (
        <div className="diag-body">
          <p className="diag-meta">Model: <strong>{modelName}</strong> · Binding: <strong>{bindingName}</strong></p>
          <table className="diag-table">
            <thead><tr><th>Visual Property</th><th>Data Source</th><th>Resolved Value</th></tr></thead>
            <tbody>
              {Object.entries(binding.mappings).map(([vp, dp]) => (
                <tr key={vp}>
                  <td>{vp}</td>
                  <td className="muted">{dp}</td>
                  <td>{fmtVal(rv[vp])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── CAS Signature card ──────────────────────────────────────────── */

function CasSignature({ cas }) {
  if (!cas) return null
  const { hsv = {}, rgb = {}, cmyk = {}, pantone_id, composite_hash, geometry = {} } = cas
  return (
    <div className="signature-card">
      <div className="sig-color-block" style={{ background: rgb.hex || '#808080' }} />
      <div className="sig-data">
        <div className="sig-row"><span className="sig-label">Pantone</span><span className="sig-value">{pantone_id || '—'}</span></div>
        <div className="sig-row"><span className="sig-label">RGB</span><span className="sig-value">{rgb.hex || '—'} <span className="muted">({rgb.r ?? '?'}, {rgb.g ?? '?'}, {rgb.b ?? '?'})</span></span></div>
        <div className="sig-row"><span className="sig-label">CMYK</span><span className="sig-value muted">C{fmt(cmyk.c)} M{fmt(cmyk.m)} Y{fmt(cmyk.y)} K{fmt(cmyk.k)}</span></div>
        <div className="sig-row"><span className="sig-label">HSV</span><span className="sig-value muted">{fmt(hsv.h, 0)}° S{fmt(hsv.s)} V{fmt(hsv.v)}</span></div>
        <div className="sig-row"><span className="sig-label">Texture</span><span className="sig-value">{geometry.surface_texture || '—'}</span></div>
        <div className="sig-row"><span className="sig-label">Hash</span><span className="sig-value hash">{composite_hash || '—'}</span></div>
      </div>
    </div>
  )
}

/* ── Pillar sub-components ───────────────────────────────────────── */

function Pillar1({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 1 — Zeitgeist</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  return (
    <div className="pillar-section">
      <h3>Pillar 1 — Zeitgeist</h3>
      <table className="result-table"><tbody>
        <tr><td>Score</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(data.zeitgeist_score || 0) * 100}%` }} /></div><span className="muted">{fmt(data.zeitgeist_score, 3)}</span></td></tr>
        <tr><td>Era</td><td>{data.era_alignment || '—'}</td></tr>
        <tr><td>Genre</td><td>{data.genre_position || '—'}</td></tr>
      </tbody></table>
      {data.cultural_reasoning && <p className="reasoning">{data.cultural_reasoning}</p>}
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
        <tr><td>DNA Score</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(data.dna_score || 0) * 100}%` }} /></div><span className="muted">{fmt(data.dna_score, 3)}</span></td></tr>
      </tbody></table>
      {data.influence_vector?.length > 0 && (
        <div className="influence-block">
          <p className="chroma-label">Influence Vector</p>
          {data.influence_vector.map((inf, i) => (
            <div key={i} className="influence-row">
              <span className="influence-name">{inf.name}</span>
              <div className="meter small"><div className="meter-fill" style={{ width: `${(inf.weight || 0) * 100}%` }} /></div>
              <span className="muted">{fmt(inf.weight, 2)}</span>
            </div>
          ))}
        </div>
      )}
      {data.dna_reasoning && <p className="reasoning">{data.dna_reasoning}</p>}
    </div>
  )
}

function Pillar4({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 4 — Johari Window</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  const q = data.johari_quadrant_assignments || {}
  return (
    <div className="pillar-section">
      <h3>Pillar 4 — Johari Window</h3>
      <table className="result-table"><tbody>
        <tr><td>Hidden Complexity</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(data.hidden_complexity_score || 0) * 100}%` }} /></div><span className="muted">{fmt(data.hidden_complexity_score, 3)}</span></td></tr>
      </tbody></table>
      {(q.open || q.blind || q.hidden || q.unknown) && (
        <div className="johari-grid">
          {q.open && <div className="johari-cell"><span className="johari-label">Open</span><ul>{q.open.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {q.blind && <div className="johari-cell"><span className="johari-label">Blind</span><ul>{q.blind.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {q.hidden && <div className="johari-cell"><span className="johari-label">Hidden</span><ul>{q.hidden.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {q.unknown && <div className="johari-cell"><span className="johari-label">Unknown</span><ul>{q.unknown.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        </div>
      )}
      {data.johari_reasoning && <p className="reasoning">{data.johari_reasoning}</p>}
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
        <tr><td>Novelty</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(data.novelty_score || 0) * 100}%` }} /></div><span className="muted">{fmt(data.novelty_score, 3)}</span></td></tr>
        <tr><td>Fingerprint</td><td className="hash">{data.fingerprint_hash || '—'}</td></tr>
      </tbody></table>
    </div>
  )
}

function Pillar3({ data, error }) {
  if (error) return <div className="pillar-section"><h3>Pillar 3 — Music Theory</h3><p className="pillar-error">{error}</p></div>
  if (!data) return null
  const cm = data.chroma?.mean || []
  const mx = Math.max(...cm, 1e-9)
  return (
    <div className="pillar-section">
      <h3>Pillar 3 — Music Theory</h3>
      <table className="result-table"><tbody>
        <tr><td>Key</td><td>{data.key?.name || '—'} <span className="muted">(conf {fmt(data.key?.confidence, 3)})</span></td></tr>
        <tr><td>Tempo</td><td>{fmt(data.tempo?.bpm, 1)} BPM <span className="muted">(stability {fmt(data.tempo?.stability, 3)})</span></td></tr>
        <tr><td>Beats</td><td>{data.beats?.count ?? '—'}</td></tr>
        <tr><td>Harmonic</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(data.harmonic_complexity || 0) * 100}%` }} /></div><span className="muted">{fmt(data.harmonic_complexity, 3)}</span></td></tr>
        <tr><td>Rhythmic</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(data.rhythmic_complexity || 0) * 100}%` }} /></div><span className="muted">{fmt(data.rhythmic_complexity, 3)}</span></td></tr>
      </tbody></table>
      {cm.length === 12 && (
        <div className="chroma-block">
          <p className="chroma-label">Chromagram</p>
          <div className="chroma-bars">
            {cm.map((v, i) => (
              <div key={i} className="chroma-col">
                <div className="chroma-bar-wrap"><div className="chroma-bar" style={{ height: `${(v / mx) * 100}%` }} /></div>
                <span className="chroma-tick">{PITCH_NAMES[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Loading spinner ─────────────────────────────────────────────── */

function AnalysisSpinner() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500)
    return () => clearInterval(id)
  }, [])
  return <div className="spinner-wrap"><div className="spinner" /><p className="spinner-text">Analyzing… {elapsed}s</p></div>
}

/* ── App ─────────────────────────────────────────────────────────── */

function App() {
  const [health, setHealth] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [modelName, setModelName] = useState('Chromatic')
  const [bindingName, setBindingName] = useState('Default')
  const inputRef = useRef(null)
  const toast = useGlobalErrorToast()

  useEffect(() => {
    let retryId
    function check() {
      fetch(`${API_URL}/health`).then(r => r.json()).then(d => { setHealth(d); retryId = null })
        .catch(() => { setHealth({ status: 'unreachable' }); retryId = setTimeout(check, 5000) })
    }
    check()
    return () => { if (retryId) clearTimeout(retryId) }
  }, [])

  async function uploadFile(file) {
    setError(null); setResult(null)
    if (file.size > MAX_SIZE) { setError('File exceeds 50MB limit'); return }
    setUploading(true)
    console.log('[ToneGlyph] uploading:', file.name, `(${(file.size / 1e6).toFixed(1)}MB)`)
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: form, signal: ctrl.signal })
      clearTimeout(tid)
      const data = await res.json()
      console.log('[ToneGlyph] response:', data)
      if (!res.ok) { setError(data.detail || `Upload failed (HTTP ${res.status})`); return }
      setResult(data)
    } catch (e) {
      clearTimeout(tid)
      setError(e.name === 'AbortError' ? 'Analysis timed out — try a shorter file' : 'Could not reach backend — is it running?')
      if (e.name !== 'AbortError') setHealth({ status: 'unreachable' })
    } finally { setUploading(false) }
  }

  function onDrop(e) { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }
  function onFileSelect(e) { const f = e.target.files[0]; if (f) uploadFile(f); e.target.value = '' }

  const cas = result?.cas
  const backendDown = health?.status === 'unreachable'

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      <SettingsPanel modelName={modelName} setModelName={setModelName} bindingName={bindingName} setBindingName={setBindingName} />

      {!result && (
        <>
          <p className="subtitle">Chromatic Audio Signature System</p>
          <h1>ToneGlyph Engine</h1>
          <div className={`status ${backendDown ? 'error' : health?.status === 'ok' ? 'ok' : ''}`}>
            {backendDown ? 'Backend disconnected — retrying...' : health ? `Backend: ${health.status}` : 'Connecting...'}
          </div>
        </>
      )}

      {!uploading && (
        <div className={`dropzone${dragging ? ' active' : ''}${result ? ' compact' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)} onDrop={onDrop}
          onClick={() => inputRef.current?.click()}>
          <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onFileSelect} hidden />
          {result ? <p className="drop-label drop-compact">Upload another file</p>
            : <><p className="drop-label">Drop an audio file here</p><p className="drop-hint">or click to browse — MP3, WAV, FLAC, M4A, AAC (max 50MB)</p></>}
        </div>
      )}

      {uploading && <AnalysisSpinner />}
      {error && <div className="result-card error-card">{error}</div>}

      {cas && (
        <GlyphErrorBoundary hex={cas.rgb?.hex}>
          <ToneGlyph result={result} activeModel={modelName} activeBinding={bindingName} />
        </GlyphErrorBoundary>
      )}

      {cas && <CasSignature cas={cas} />}

      {result && <GlyphDiagnostics result={result} modelName={modelName} bindingName={bindingName} />}

      {result && (
        <div className="result-card">
          <h2>{result.filename || 'Analysis Result'}</h2>
          <table className="result-table"><tbody>
            <tr><td>Duration</td><td>{result.duration}s</td></tr>
            <tr><td>Format</td><td>{(result.format || '').toUpperCase()} · {result.channels}ch · {result.sample_rate}Hz</td></tr>
            <tr><td>SHA-256</td><td className="hash">{result.file_hash}</td></tr>
          </tbody></table>
          <Pillar3 data={result.pillar3} error={result.pillar3_error} />
          <Pillar1 data={result.pillar1} error={result.pillar1_error} />
          <Pillar2 data={result.pillar2} error={result.pillar2_error} />
          <Pillar4 data={result.pillar4} error={result.pillar4_error} />
          <Pillar5 data={result.pillar5} error={result.pillar5_error} />
          {result.cas_error && <div className="pillar-section"><h3>Color Encoding</h3><p className="pillar-error">{result.cas_error}</p></div>}
        </div>
      )}
    </div>
  )
}

export default App
