import { useState, useEffect, useRef, useCallback, Component } from 'react'
import './App.css'
import { StudioProvider, useStudio } from './studio/StudioContext'
import TabBar from './studio/TabBar'
import GlyphCanvas from './glyph/GlyphCanvas'
import AudioPlayer from './audio/AudioPlayer'
import TuningPanel from './tuning/TuningPanel'
import { GlyphDiagnostics, FullPillarReadout } from './panels/PillarReadout'
import { analyzeFile } from './upload/uploadApi'
import { API_URL, MAX_SIZE, ACCEPTED, fmt } from './shared/constants'

class GlyphErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(e, info) { console.error('[GlyphErrorBoundary]', e, info) }
  render() {
    if (this.state.error) return (
      <div className="glyph-fallback">
        <div className="fallback-swatch" style={{ background: this.props.hex || '#808080' }} />
        <p className="fallback-msg">Visualization crashed</p>
      </div>
    )
    return this.props.children
  }
}

function useGlobalToast() {
  const [toast, setToast] = useState(null)
  useEffect(() => {
    const h = (e) => { setToast(e.reason?.message || e.message || 'Error'); setTimeout(() => setToast(null), 8000) }
    window.addEventListener('error', h); window.addEventListener('unhandledrejection', h)
    return () => { window.removeEventListener('error', h); window.removeEventListener('unhandledrejection', h) }
  }, [])
  return toast
}

function ModeSelector({ mode, setMode }) {
  return (
    <div className="mode-selector">
      {['static', 'animated', 'temporal'].map(m => (
        <button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
          {m === 'static' ? 'S' : m === 'animated' ? 'A' : 'T'}
        </button>
      ))}
    </div>
  )
}

function CompareView({ audioRef }) {
  const { tabs, compareTabIds, dispatch } = useStudio()
  if (!compareTabIds || compareTabIds.length !== 2) return null
  const [aTab, bTab] = compareTabIds.map(id => tabs.find(t => t.id === id)).filter(Boolean)
  if (!aTab || !bTab) return null
  const scores = [
    ['Zeitgeist', aTab.result?.pillar1?.zeitgeist_score, bTab.result?.pillar1?.zeitgeist_score],
    ['DNA', aTab.result?.pillar2?.dna_score, bTab.result?.pillar2?.dna_score],
    ['Harmonic', aTab.result?.pillar3?.harmonic_complexity, bTab.result?.pillar3?.harmonic_complexity],
    ['Rhythmic', aTab.result?.pillar3?.rhythmic_complexity, bTab.result?.pillar3?.rhythmic_complexity],
    ['Hidden Cx', aTab.result?.pillar4?.hidden_complexity_score, bTab.result?.pillar4?.hidden_complexity_score],
    ['Novelty', aTab.result?.pillar5?.novelty_score, bTab.result?.pillar5?.novelty_score],
  ].sort((a, b) => Math.abs((b[1] || 0) - (b[2] || 0)) - Math.abs((a[1] || 0) - (a[2] || 0)))

  return (
    <div className="compare-view">
      <div className="compare-header">
        <span>Compare</span>
        <button className="compare-exit" onClick={() => dispatch({ type: 'EXIT_COMPARE' })}>Exit (Esc)</button>
      </div>
      <div className="compare-glyphs">
        <div className="compare-col">
          <GlyphErrorBoundary hex={aTab.result?.cas?.rgb?.hex}>
            <GlyphCanvas result={aTab.result} modelName={aTab.modelName} bindingName={aTab.bindingName}
              glyphMode="animated" overrides={aTab.overrides} audioRef={audioRef} />
          </GlyphErrorBoundary>
          <p className="compare-name">{aTab.filename?.replace(/\.[^.]+$/, '')}</p>
        </div>
        <div className="compare-diff">
          {scores.slice(0, 6).map(([label, a, b]) => (
            <div key={label} className="diff-row">
              <span className="diff-val">{fmt(a, 2)}</span>
              <span className={`diff-label ${Math.abs((a || 0) - (b || 0)) > 0.1 ? 'diff-hi' : ''}`}>{label}</span>
              <span className="diff-val">{fmt(b, 2)}</span>
            </div>
          ))}
        </div>
        <div className="compare-col">
          <GlyphErrorBoundary hex={bTab.result?.cas?.rgb?.hex}>
            <GlyphCanvas result={bTab.result} modelName={bTab.modelName} bindingName={bTab.bindingName}
              glyphMode="animated" overrides={bTab.overrides} audioRef={audioRef} />
          </GlyphErrorBoundary>
          <p className="compare-name">{bTab.filename?.replace(/\.[^.]+$/, '')}</p>
        </div>
      </div>
    </div>
  )
}

function AnalysisSpinner() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500)
    return () => clearInterval(id)
  }, [])
  return <div className="spinner-wrap"><div className="spinner" /><p className="spinner-text">Analyzing… {elapsed}s</p></div>
}

function HowBuiltStrip({ result, bindingName }) {
  const [open, setOpen] = useState(false)
  if (!result) return null
  return (
    <div className="how-built-strip">
      <button className="how-built-toggle" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} How This Glyph Was Built
      </button>
      {open && (
        <div className="how-built-body">
          <GlyphDiagnostics result={result} bindingName={bindingName} inline />
        </div>
      )}
    </div>
  )
}

function Studio() {
  const { tabs, activeTabId, activeTab, compareTabIds, tuningOpen, dispatch } = useStudio()
  const audioRef = useRef(null)
  const toast = useGlobalToast()

  const showUpload = tabs.length === 0 || activeTabId === '__new__'
  const showCompare = compareTabIds && compareTabIds.length === 2
  const tab = activeTab
  const cas = tab?.result?.cas

  const handleFile = useCallback((file) => {
    if (!file || file.size > MAX_SIZE) return
    dispatch({ type: 'TAB_CREATE', filename: file.name, file })
  }, [dispatch])

  useEffect(() => {
    const uploading = tabs.find(t => t.uploading && t.file && !t.result && !t.error)
    if (!uploading) return
    analyzeFile(uploading.file)
      .then(result => dispatch({ type: 'TAB_UPDATE', id: uploading.id, patch: { result, uploading: false } }))
      .catch(err => dispatch({ type: 'TAB_UPDATE', id: uploading.id, patch: { error: err.message, uploading: false } }))
  }, [tabs.map(t => t.id + t.uploading).join()])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      const tabIdx = tabs.findIndex(t => t.id === activeTabId)
      if (e.key === 'ArrowLeft' && tabIdx > 0) { e.preventDefault(); dispatch({ type: 'TAB_SELECT', id: tabs[tabIdx - 1].id }) }
      if (e.key === 'ArrowRight' && tabIdx < tabs.length - 1) { e.preventDefault(); dispatch({ type: 'TAB_SELECT', id: tabs[tabIdx + 1].id }) }
      if (e.key === 'c' || e.key === 'C') { if (compareTabIds) dispatch({ type: 'EXIT_COMPARE' }) }
      if (e.key === 't' || e.key === 'T') dispatch({ type: 'TOGGLE_TUNING' })
      if (e.key === 'e' || e.key === 'E') {
        const canvas = document.querySelector('.glyph-canvas canvas')
        if (canvas) { const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `toneglyph.png`; a.click() }
      }
      if (e.key === ' ' && tab?.file) { e.preventDefault(); dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { result: null, error: null, uploading: true } }) }
      if (e.key === 'Escape') { if (compareTabIds) dispatch({ type: 'EXIT_COMPARE' }); else if (tuningOpen) dispatch({ type: 'TOGGLE_TUNING' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabs, activeTabId, compareTabIds, tuningOpen, tab, dispatch])

  const [health, setHealth] = useState(null)
  useEffect(() => {
    let rid
    function check() {
      fetch(`${API_URL}/health`).then(r => r.json()).then(d => setHealth(d))
        .catch(() => { setHealth({ status: 'unreachable' }); rid = setTimeout(check, 5000) })
    }
    check()
    return () => clearTimeout(rid)
  }, [])

  return (
    <div className="studio">
      {toast && <div className="toast">{toast}</div>}
      <TabBar />

      {showUpload ? (
        <div className="upload-view">
          <p className="subtitle">Chromatic Audio Signature System</p>
          <h1>ToneGlyph Studio</h1>
          {health?.status === 'unreachable' && <div className="status error">Backend disconnected — retrying...</div>}
          <div className="dropzone"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => document.getElementById('file-input')?.click()}>
            <input id="file-input" type="file" accept={ACCEPTED} onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} hidden />
            <p className="drop-label">Drop an audio file here</p>
            <p className="drop-hint">MP3, WAV, FLAC, M4A, AAC (max 50MB)</p>
          </div>
        </div>
      ) : showCompare ? (
        <CompareView audioRef={audioRef} />
      ) : (
        <div className="workspace">
          <div className="workspace-center">
            {tab?.uploading && <AnalysisSpinner />}
            {tab?.error && <div className="error-card">{tab.error}</div>}

            {cas && (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <ModeSelector mode={tab.glyphMode} setMode={m => dispatch({ type: 'SET_GLYPH_MODE', mode: m })} />
                </div>

                <div className="glyph-area">
                  <GlyphErrorBoundary hex={cas.rgb?.hex}>
                    <GlyphCanvas result={tab.result} modelName={tab.modelName} bindingName={tab.bindingName}
                      glyphMode={tab.glyphMode} overrides={tab.overrides} audioRef={audioRef} />
                  </GlyphErrorBoundary>
                </div>

                <div className="song-info">
                  <span className="song-title">{tab.filename?.replace(/\.[^.]+$/, '')}</span>
                  <span className="pantone-badge" style={{ background: cas.rgb?.hex }}>{cas.pantone_id}</span>
                  <span className="hex-badge">{cas.rgb?.hex}</span>
                  <span className="hash-small">{cas.composite_hash?.slice(0, 10)}…</span>
                </div>

                {tab.fileObjectUrl && <AudioPlayer ref={audioRef} src={tab.fileObjectUrl} />}

                <HowBuiltStrip result={tab.result} bindingName={tab.bindingName} />
              </>
            )}
          </div>

          {tuningOpen && <TuningPanel />}

          {!tuningOpen && tab?.result && (
            <button className="tuning-toggle" onClick={() => dispatch({ type: 'TOGGLE_TUNING' })} title="Tuning Panel (T)">⚙</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return <StudioProvider><Studio /></StudioProvider>
}
