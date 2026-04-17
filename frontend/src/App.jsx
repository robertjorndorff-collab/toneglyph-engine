import { useState, useEffect, useRef, useCallback, Component } from 'react'
import './App.css'
import { StudioProvider, useStudio } from './studio/StudioContext'
import TabBar from './studio/TabBar'
import GlyphCanvas from './glyph/GlyphCanvas'
import AudioPlayer from './audio/AudioPlayer'
import TuningPanel from './tuning/TuningPanel'
import { FullPillarReadout } from './panels/PillarReadout'
import PillarGrid from './panels/PillarGrid'
import { analyzeFile } from './upload/uploadApi'
import { API_URL, MAX_SIZE, ACCEPTED, fmt, resolvePath as resolvePathFn } from './shared/constants'
import { BINDINGS } from './glyph/GlyphCanvas'
import { useEnhancers, getEraFilter } from './enhancers/useEnhancers'
import Tip from './shared/Tooltip'
const BINDINGS_REF = BINDINGS

class GlyphErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(e, info) { console.error('[GlyphErrorBoundary]', e, info) }
  render() {
    if (this.state.error) return <div className="glyph-fallback"><div className="fallback-swatch" style={{ background: this.props.hex || '#808080' }} /><p className="fallback-msg">Visualization crashed</p></div>
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

function GlyphModeSelector({ mode, setMode, audioRef, fileObjectUrl }) {
  function handleClick(m) {
    if (m === 'temporal') {
      if (!fileObjectUrl) {
        alert('Temporal mode needs audio. Re-attach or upload a file.')
        return
      }
      if (audioRef?.current?.paused) {
        audioRef.current.play().catch(() => {})
      }
    }
    setMode(m)
  }
  return (
    <div className="mode-selector">
      {[['static','Static'],['animated','Animated'],['temporal','Temporal']].map(([m,l]) => (
        <button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`} onClick={() => handleClick(m)}>{l}</button>
      ))}
    </div>
  )
}

function WorkspaceModeSelector({ mode, setMode }) {
  return (
    <div className="mode-selector ws-mode">
      {[['glyph','Glyph'],['detail','Detail'],['split','Split']].map(([m,l]) => (
        <button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>{l}</button>
      ))}
    </div>
  )
}

function SongInfoBar({ tab, cas, dispatch, setShowHowBuilt, wsm, audioRef }) {
  return (
    <div className="info-row">
      <span className="song-title">{tab.filename?.replace(/\.[^.]+$/, '')}</span>
      <span className="pantone-badge" style={{ background: cas.rgb?.hex }}>{cas.pantone_id}</span>
      <span className="hex-badge">{cas.rgb?.hex}</span>
      <span className="info-sep" />
      <GlyphModeSelector mode={tab.glyphMode} setMode={m => dispatch({ type: 'SET_GLYPH_MODE', mode: m })} audioRef={audioRef} fileObjectUrl={tab.fileObjectUrl} />
      <span className="info-sep" />
      <WorkspaceModeSelector mode={wsm} setMode={m => dispatch({ type: 'SET_WORKSPACE_MODE', mode: m })} />
      <div className="info-bar-right">
        <Tip text="Export PNG" shortcut="E"><button className="icon-btn" onClick={() => { const c = document.querySelector('.glyph-canvas canvas'); if (c) { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'toneglyph.png'; a.click() } }}>⬇</button></Tip>
        <Tip text="Export CAS JSON"><button className="icon-btn" onClick={() => { if (tab.result?.cas) { const b = new Blob([JSON.stringify(tab.result.cas, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'toneglyph.json'; a.click() } }}>{ '{' }</button></Tip>
        <Tip text="How This Glyph Was Built"><button className="icon-btn" onClick={() => setShowHowBuilt(true)}>?</button></Tip>
      </div>
    </div>
  )
}

function ReattachAudio({ tab, dispatch }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState(null)

  async function handleFile(file) {
    if (!file) return
    // Compute SHA-256 and compare to tab's file_hash
    try {
      const buf = await file.arrayBuffer()
      const hashBuf = await crypto.subtle.digest('SHA-256', buf)
      const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      if (hash === tab.result?.file_hash) {
        dispatch({ type: 'TAB_REATTACH_FILE', id: tab.id, file })
        setStatus(null)
      } else {
        setStatus('Hash does not match — use the original file')
      }
    } catch {
      // If crypto.subtle unavailable (HTTP), skip hash check and attach anyway
      dispatch({ type: 'TAB_REATTACH_FILE', id: tab.id, file })
    }
  }

  return (
    <div className="reattach"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept={ACCEPTED} onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} hidden />
      <span className="reattach-text">Drop audio file to re-attach playback</span>
      {status && <span className="reattach-warn">{status}</span>}
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
      <div className="compare-header"><span>Compare</span><button className="compare-exit" onClick={() => dispatch({ type: 'EXIT_COMPARE' })}>Exit (Esc)</button></div>
      <div className="compare-glyphs">
        <div className="compare-col">
          <GlyphErrorBoundary hex={aTab.result?.cas?.rgb?.hex}><GlyphCanvas result={aTab.result} modelName={aTab.modelName} layers={aTab.layers} bindingName={aTab.bindingName} glyphMode="animated" overrides={aTab.overrides} audioRef={audioRef} /></GlyphErrorBoundary>
          <p className="compare-name">{aTab.filename?.replace(/\.[^.]+$/, '')}</p>
        </div>
        <div className="compare-diff">
          {scores.slice(0, 6).map(([label, a, b]) => <div key={label} className="diff-row"><span className="diff-val">{fmt(a, 2)}</span><span className={`diff-label ${Math.abs((a||0)-(b||0))>0.1?'diff-hi':''}`}>{label}</span><span className="diff-val">{fmt(b, 2)}</span></div>)}
        </div>
        <div className="compare-col">
          <GlyphErrorBoundary hex={bTab.result?.cas?.rgb?.hex}><GlyphCanvas result={bTab.result} modelName={bTab.modelName} layers={bTab.layers} bindingName={bTab.bindingName} glyphMode="animated" overrides={bTab.overrides} audioRef={audioRef} /></GlyphErrorBoundary>
          <p className="compare-name">{bTab.filename?.replace(/\.[^.]+$/, '')}</p>
        </div>
      </div>
    </div>
  )
}

function AnalysisSpinner() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => { const t0 = Date.now(); const id = setInterval(() => setElapsed(Math.round((Date.now()-t0)/1000)),500); return ()=>clearInterval(id) }, [])
  return <div className="spinner-wrap"><div className="spinner"/><p className="spinner-text">Analyzing… {elapsed}s</p></div>
}

function HowBuiltOverlay({ result, bindingName, onClose }) {
  const binding = result && bindingName ? (BINDINGS_REF[bindingName] || null) : null
  if (!binding) return null
  const rv = {}; for (const [vp,dp] of Object.entries(binding.mappings||{})) { rv[vp]=resolvePathFn(result,dp) }
  const categories = { Color:['color.sector_hues','color.saturation','color.palette_warmth','color.gradient_depth','color.mood_era'], Shape:['shape.complexity','shape.symmetry','shape.texture','shape.mfcc'], Lighting:['lighting.glow','lighting.transmission','lighting.rim'], Motion:['motion.spin','motion.pulse','motion.flutter'], 'Beat Sync':['beat_sync.chroma','beat_sync.luminance','beat_sync.tempo'], Scale:['scale.size'] }
  const [cat, setCat] = useState('Color')
  const entries = (categories[cat]||[]).filter(k=>k in binding.mappings)
  function fv(v) { if(v==null) return '—'; if(typeof v==='number') return Number.isFinite(v)?v.toFixed(4):'NaN'; if(typeof v==='string') return v.length>50?v.slice(0,47)+'…':v; if(Array.isArray(v)) return `[${v.length}]`; return String(v).slice(0,30) }
  useEffect(() => { function k(e){if(e.key==='Escape')onClose()}; window.addEventListener('keydown',k); return ()=>window.removeEventListener('keydown',k) }, [onClose])
  return (
    <div className="hb-overlay" onClick={onClose}><div className="hb-panel" onClick={e=>e.stopPropagation()}>
      <div className="hb-header"><span className="hb-title">How This Glyph Was Built</span><span className="hb-meta">Binding: {bindingName}</span><button className="hb-close" onClick={onClose}>×</button></div>
      <div className="hb-tabs">{Object.keys(categories).map(c=><button key={c} className={`hb-tab ${cat===c?'active':''}`} onClick={()=>setCat(c)}>{c}</button>)}</div>
      <div className="hb-table-wrap"><table className="hb-table"><thead><tr><th>Property</th><th>Source</th><th>Value</th></tr></thead><tbody>{entries.map(vp=><tr key={vp}><td className="hb-prop">{vp.split('.').pop()}</td><td className="hb-src">{binding.mappings[vp]}</td><td className="hb-val">{fv(rv[vp])}</td></tr>)}</tbody></table></div>
    </div></div>
  )
}

function Studio() {
  const { tabs, activeTabId, activeTab, compareTabIds, tuningOpen, workspaceMode, dispatch } = useStudio()
  const audioRef = useRef(null)
  const toast = useGlobalToast()
  const [showHowBuilt, setShowHowBuilt] = useState(false)
  const enh = useEnhancers(activeTab?.result, activeTab?.result?.file_hash)
  const eraFilter = enh.eraOn && enh.era && !enh.era.error ? getEraFilter(enh.era) : ''

  const showUpload = tabs.length === 0 || activeTabId === '__new__'
  const showCompare = compareTabIds && compareTabIds.length === 2
  const tab = activeTab
  const cas = tab?.result?.cas
  const wsm = workspaceMode || 'glyph'

  const handleFile = useCallback((file) => { if (!file||file.size>MAX_SIZE) return; dispatch({type:'TAB_CREATE',filename:file.name,file}) }, [dispatch])

  useEffect(() => {
    const u = tabs.find(t=>t.uploading&&t.file&&!t.result&&!t.error)
    if (!u) return
    analyzeFile(u.file).then(result=>dispatch({type:'TAB_UPDATE',id:u.id,patch:{result,uploading:false}})).catch(err=>dispatch({type:'TAB_UPDATE',id:u.id,patch:{error:err.message,uploading:false}}))
  }, [tabs.map(t=>t.id+t.uploading).join()])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return
      const ti = tabs.findIndex(t=>t.id===activeTabId)
      if (e.key==='ArrowLeft'&&ti>0) { e.preventDefault(); dispatch({type:'TAB_SELECT',id:tabs[ti-1].id}) }
      if (e.key==='ArrowRight'&&ti<tabs.length-1) { e.preventDefault(); dispatch({type:'TAB_SELECT',id:tabs[ti+1].id}) }
      if (e.key==='c'||e.key==='C') { if(compareTabIds) dispatch({type:'EXIT_COMPARE'}) }
      if (e.key==='t'||e.key==='T') dispatch({type:'TOGGLE_TUNING'})
      if (e.key==='g') dispatch({type:'SET_WORKSPACE_MODE',mode:'glyph'})
      if (e.key==='d') dispatch({type:'SET_WORKSPACE_MODE',mode:'detail'})
      if (e.key==='s'&&!e.metaKey&&!e.ctrlKey) { e.preventDefault(); dispatch({type:'SET_WORKSPACE_MODE',mode:'split'}) }
      if (e.key==='e'||e.key==='E') { const c=document.querySelector('.glyph-canvas canvas'); if(c){const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='toneglyph.png';a.click()} }
      if (e.key===' '&&tab?.file) { e.preventDefault(); dispatch({type:'TAB_UPDATE',id:tab.id,patch:{result:null,error:null,uploading:true}}) }
      if (e.key==='Escape') { if(showHowBuilt) setShowHowBuilt(false); else if(compareTabIds) dispatch({type:'EXIT_COMPARE'}); else if(tuningOpen) dispatch({type:'TOGGLE_TUNING'}) }
    }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  }, [tabs,activeTabId,compareTabIds,tuningOpen,tab,showHowBuilt,wsm,dispatch])

  const [health, setHealth] = useState(null)
  useEffect(() => { let r; function c(){fetch(`${API_URL}/health`).then(r=>r.json()).then(d=>setHealth(d)).catch(()=>{setHealth({status:'unreachable'});r=setTimeout(c,5000)})}; c(); return ()=>clearTimeout(r) }, [])

  const glyphEl = cas && (
    <div style={{ filter: eraFilter || undefined, position: 'relative', width: '100%', height: '100%' }}>
      <GlyphErrorBoundary hex={cas.rgb?.hex}>
        <GlyphCanvas result={tab.result} modelName={tab.modelName} layers={tab.layers} bindingName={tab.bindingName}
          glyphMode={tab.glyphMode} overrides={tab.overrides} audioRef={audioRef} />
      </GlyphErrorBoundary>
      {(enh.lyricsOn || enh.eraOn) && (
        <div className="enhancer-badges">
          {enh.lyricsOn && <span className="enh-badge" title={enh.lyrics?.summary || 'Loading...'}>L</span>}
          {enh.eraOn && <span className="enh-badge" title={enh.era?.dominant_visual_movement || 'Loading...'}>E</span>}
        </div>
      )}
    </div>
  )

  const enhancerUI = cas && (
    <div className="tp-group">
      <h4 className="tp-group-label">Enhancers <span style={{fontSize:'0.5rem',opacity:0.5}}>beta</span></h4>
      <div className="enh-toggle">
        <label><input type="checkbox" checked={enh.lyricsOn} onChange={e => enh.setLyricsOn(e.target.checked)} /> Lyric Themes</label>
        {enh.lyricsOn && <span className="enh-status">{enh.lyricsLoading ? '…' : enh.lyrics?.mode || ''}</span>}
      </div>
      {enh.lyricsOn && enh.lyrics?.themes && (
        <div className="enh-themes">
          {Object.entries(enh.lyrics.themes).sort(([,a],[,b]) => b - a).slice(0, 5).map(([theme, conf]) => (
            <span key={theme} className="enh-theme" style={{ opacity: 0.4 + conf * 0.6 }}>{theme} {(conf * 100).toFixed(0)}%</span>
          ))}
        </div>
      )}
      {enh.lyricsOn && (
        <details className="enh-manual"><summary>paste lyrics (override)</summary>
          <textarea rows="3" value={enh.manualLyrics} onChange={e => enh.setManualLyrics(e.target.value)} placeholder="Paste lyrics here…" />
        </details>
      )}
      <div className="enh-toggle">
        <label><input type="checkbox" checked={enh.eraOn} onChange={e => enh.setEraOn(e.target.checked)} /> Era Style</label>
        {enh.eraOn && <span className="enh-status">{enh.eraLoading ? '…' : enh.era?.dominant_visual_movement || ''}</span>}
      </div>
      {enh.eraOn && enh.era && !enh.era.error && (
        <div className="enh-era-info">
          <span>temp {enh.era.color_temperature > 0 ? 'warm' : 'cool'} · {enh.era.texture_type} · {enh.era.edge_quality}</span>
        </div>
      )}
    </div>
  )

  const audioEl = tab?.fileObjectUrl
    ? <AudioPlayer ref={audioRef} src={tab.fileObjectUrl} />
    : (tab?.result ? <ReattachAudio tab={tab} dispatch={dispatch} /> : null)

  return (
    <div className="studio">
      {toast && <div className="toast">{toast}</div>}
      <TabBar />

      {showUpload ? (
        <div className="upload-view">
          <img src="/logo.png" alt="ToneGlyph" className="home-logo" />
          <h1 className="home-title">Studio</h1>
          {health?.status==='unreachable'&&<div className="status error">Backend disconnected — retrying...</div>}
          <div className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0])}} onClick={()=>document.getElementById('file-input')?.click()}>
            <input id="file-input" type="file" accept={ACCEPTED} onChange={e=>{handleFile(e.target.files[0]);e.target.value=''}} hidden />
            <p className="drop-label">Drop an audio file here</p>
            <p className="drop-hint">MP3, WAV, FLAC, M4A, AAC (max 50MB)</p>
          </div>
        </div>
      ) : showCompare ? (
        <CompareView audioRef={audioRef} />
      ) : wsm === 'detail' ? (
        /* ── D MODE: small glyph + pillar grid ── */
        <div className="workspace ws-detail">
          <div className="ws-detail-main">
            <div className="ws-detail-header">
              <div className="ws-detail-glyph">{glyphEl}</div>
              {cas && <SongInfoBar tab={tab} cas={cas} dispatch={dispatch} setShowHowBuilt={setShowHowBuilt} wsm={wsm} audioRef={audioRef} />}
              {audioEl}
            </div>
            {tab?.result && <PillarGrid result={tab.result} />}
          </div>
          <TuningPanel enhancerUI={enhancerUI} />
        </div>
      ) : wsm === 'split' ? (
        /* ── S MODE: left glyph + right pillar scroll ── */
        <div className="workspace ws-split">
          <div className="ws-split-left">
            <div className="ws-split-glyph">{glyphEl}</div>
            {cas && <SongInfoBar tab={tab} cas={cas} dispatch={dispatch} setShowHowBuilt={setShowHowBuilt} wsm={wsm} audioRef={audioRef} />}
            {audioEl}
          </div>
          <div className="ws-split-right">
            {tab?.result && <FullPillarReadout result={tab.result} />}
          </div>
          {tuningOpen && <TuningPanel enhancerUI={enhancerUI} />}
        </div>
      ) : (
        /* ── G MODE: glyph hero (default) ── */
        <div className="workspace">
          <div className="workspace-center">
            {tab?.uploading && <AnalysisSpinner />}
            {tab?.error && <div className="error-card">{tab.error}</div>}
            {cas && (
              <>
                <div className="glyph-hero">{glyphEl}</div>
                <SongInfoBar tab={tab} cas={cas} dispatch={dispatch} setShowHowBuilt={setShowHowBuilt} wsm={wsm} audioRef={audioRef} />
                {audioEl}
              </>
            )}
          </div>
          <TuningPanel enhancerUI={enhancerUI} />
          {tab?.result && <Tip text="Toggle Tuning Panel" shortcut="T"><button className="tuning-toggle" onClick={()=>dispatch({type:'TOGGLE_TUNING'})}>{tuningOpen ? '▶' : '◀'}</button></Tip>}
        </div>
      )}

      {showHowBuilt && <HowBuiltOverlay result={tab?.result} bindingName={tab?.bindingName} onClose={()=>setShowHowBuilt(false)} />}
    </div>
  )
}

export default function App() { return <StudioProvider><Studio /></StudioProvider> }
