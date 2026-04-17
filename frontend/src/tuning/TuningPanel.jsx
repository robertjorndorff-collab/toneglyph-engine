import { useState, useRef, useEffect } from 'react'
import { useStudio } from '../studio/StudioContext'
import { MODELS, BINDINGS } from '../glyph/GlyphCanvas'
import { fmt, resolveBindings } from '../shared/constants.js'
import Tip from '../shared/Tooltip'
import TuningSection from './TuningSection'

const SLIDERS = [
  { key: 'color.saturation', label: 'Saturation' },
  { key: 'color.gradient_depth', label: 'Gradient' },
  { key: 'shape.complexity', label: 'Complexity' },
  { key: 'shape.symmetry', label: 'Symmetry' },
  { key: 'lighting.glow', label: 'Glow' },
  { key: 'motion.spin', label: 'Rotation', max: 2 },
  { key: '_palette_warmth', label: 'Warmth', min: -1 },
]

const SCORES = [
  { label: 'Zeitgeist', fn: r => r.pillar1?.zeitgeist_score },
  { label: 'DNA', fn: r => r.pillar2?.dna_score },
  { label: 'Harmonic', fn: r => r.pillar3?.harmonic_complexity },
  { label: 'Rhythmic', fn: r => r.pillar3?.rhythmic_complexity },
  { label: 'Hidden Cx', fn: r => r.pillar4?.hidden_complexity_score },
  { label: 'Novelty', fn: r => r.pillar5?.novelty_score },
]

const modelNames = Object.keys(MODELS)

export default function TuningPanel({ enhancerUI }) {
  const { activeTab, tuningOpen, presets = [], dispatch } = useStudio()
  const [addingLayer, setAddingLayer] = useState(false)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)

  const tab = activeTab
  const binding = tab ? (BINDINGS[tab.bindingName] || BINDINGS['Default']) : null
  const rv = tab?.result ? resolveBindings(binding, tab.result) : {}
  const layers = tab?.layers || []

  if (!tuningOpen) return <div className="tp tp-closed" />
  if (!tab) return <div className="tp tp-open"><div className="tp-inner"><p className="tp-empty">No song selected</p></div></div>

  return (
    <div className="tp tp-open">
      <div className="tp-inner">

        {/* ── LAYERS (with nested Binding) ── */}
        <TuningSection id="layers" label="LAYERS" defaultOpen action={
          <div className="ts-icons">
            {layers.length < 5 && <Tip text="Add Layer"><button className="ts-icon" onClick={e => { e.stopPropagation(); setAddingLayer(!addingLayer) }}>+</button></Tip>}
            <Tip text="Save Preset"><button className="ts-icon" onClick={e => { e.stopPropagation(); setSavingPreset(true) }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1h7l2 2v7a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1" fill="none"/><rect x="4" y="7" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.4"/></svg>
            </button></Tip>
          </div>
        }>
          {addingLayer && (
            <select className="tp-select-full" value="" autoFocus onChange={e => { if (e.target.value) { dispatch({ type: 'LAYER_ADD', modelName: e.target.value }); setAddingLayer(false) } }}>
              <option value="">Select model…</option>
              {modelNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {savingPreset && (
            <div className="tp-save-row">
              <input className="tp-select-full" value={presetName} onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && presetName.trim()) { dispatch({ type: 'PRESET_SAVE', name: presetName.trim(), fromTabId: tab.id }); setSavingPreset(false); setPresetName('') } if (e.key === 'Escape') setSavingPreset(false) }}
                placeholder="Preset name…" autoFocus />
              <button className="ts-icon" onClick={() => { if (presetName.trim()) dispatch({ type: 'PRESET_SAVE', name: presetName.trim(), fromTabId: tab.id }); setSavingPreset(false); setPresetName('') }}>✓</button>
            </div>
          )}
          <div className="tp-layer-list">
            {layers.map((layer, idx) => (
              <div key={layer.id} className="tp-layer-row">
                <button className={`tp-vis ${layer.visible !== false ? 'on' : ''}`}
                  onClick={() => dispatch({ type: 'LAYER_UPDATE', layerId: layer.id, patch: { visible: layer.visible === false } })}>●</button>
                <select className="tp-layer-dd" value={layer.modelName}
                  onChange={e => dispatch({ type: 'LAYER_UPDATE', layerId: layer.id, patch: { modelName: e.target.value } })}>
                  {modelNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {layers.length > 1 && idx > 0 && <button className="ts-icon" onClick={() => dispatch({ type: 'LAYER_REORDER', from: idx, to: idx - 1 })}>▲</button>}
                {layers.length > 1 && idx < layers.length - 1 && <button className="ts-icon" onClick={() => dispatch({ type: 'LAYER_REORDER', from: idx, to: idx + 1 })}>▼</button>}
                <input className="tp-opacity" type="range" min="0" max="1" step="0.05" value={layer.opacity ?? 1}
                  onChange={e => dispatch({ type: 'LAYER_UPDATE', layerId: layer.id, patch: { opacity: parseFloat(e.target.value) } })} />
                <span className="tp-val">{Math.round((layer.opacity ?? 1) * 100)}</span>
                {layers.length > 1 && <button className="ts-icon tp-rm" onClick={() => dispatch({ type: 'LAYER_REMOVE', layerId: layer.id })}>×</button>}
              </div>
            ))}
          </div>
          {/* Binding nested under layers */}
          <div className="tp-grid-row" style={{ marginTop: 4 }}>
            <span className="tp-lbl">Binding</span>
            <select className="tp-layer-dd" value={tab.bindingName}
              onChange={e => dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { bindingName: e.target.value } })}>
              {Object.keys(BINDINGS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="tp-val" />
          </div>
        </TuningSection>

        {/* ── PRESETS (opens modal) ── */}
        <div className="ts">
          <div className="ts-header" onClick={() => setShowLibrary(true)} role="button" tabIndex={0}>
            <svg width="8" height="8" viewBox="0 0 8 8" className="tp-chevron"><path d="M 2 1 L 6 4 L 2 7" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="ts-label">PRESETS ({presets.length})</span>
          </div>
        </div>

        {showLibrary && <PresetLibraryModal dispatch={dispatch} tabId={tab.id} presets={presets} onClose={() => setShowLibrary(false)} />}

        {/* ── LIVE OVERRIDES ── */}
        <TuningSection id="overrides" label="LIVE OVERRIDES" defaultOpen action={
          <Tip text="Reset All"><button className="ts-icon ts-accent" onClick={e => { e.stopPropagation(); dispatch({ type: 'CLEAR_OVERRIDES' }) }}>Reset</button></Tip>
        }>
          {SLIDERS.map(s => {
            const base = typeof rv[s.key] === 'number' ? rv[s.key] : ((s.min || 0) + (s.max || 1)) / 2
            const val = tab.overrides[s.key] ?? base
            return (
              <div key={s.key} className="tp-grid-row">
                <span className="tp-lbl">{s.label}</span>
                <input className="tp-slider" type="range" min={s.min || 0} max={s.max || 1} step="0.01" value={val}
                  onChange={e => dispatch({ type: 'SET_OVERRIDE', key: s.key, value: parseFloat(e.target.value) })} />
                <span className="tp-val">{fmt(val, 2)}</span>
              </div>
            )
          })}
        </TuningSection>

        {/* ── ENHANCERS ── */}
        {enhancerUI && <TuningSection id="enhancers" label="ENHANCERS" action={<span className="ts-badge">beta</span>}>{enhancerUI}</TuningSection>}

        {/* ── PILLAR SCORES ── */}
        {tab.result && (
          <TuningSection id="scores" label="PILLAR SCORES">
            {SCORES.map(({ label, fn }) => {
              const v = fn(tab.result)
              return (
                <div key={label} className="tp-grid-row">
                  <span className="tp-lbl">{label}</span>
                  <div className="tp-score-track"><div className="tp-score-bar" style={{ width: `${(v || 0) * 100}%` }} /></div>
                  <span className="tp-val">{fmt(v, 2)}</span>
                </div>
              )
            })}
          </TuningSection>
        )}
      </div>
    </div>
  )
}

function PresetLibraryModal({ dispatch, tabId, presets, onClose }) {
  const importRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Preset Library</span>
          <div className="modal-actions">
            <button className="ts-icon" onClick={() => { const blob = new Blob([JSON.stringify(presets, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'toneglyph-presets.json'; a.click() }}>Export All</button>
            <button className="ts-icon" onClick={() => importRef.current?.click()}>Import</button>
            <input ref={importRef} type="file" accept=".json" hidden onChange={e => {
              const f = e.target.files?.[0]; if (!f) return
              f.text().then(t => { try { let d = JSON.parse(t); if (!Array.isArray(d)) d = [d]; dispatch({ type: 'PRESET_IMPORT', presets: d.filter(p=>p.config?.layers) }) } catch { alert('Invalid JSON') } })
              e.target.value = ''
            }} />
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body">
          {presets.length === 0 ? (
            <p className="tp-empty">No presets saved yet. Tune a glyph you love, then click the save icon in the Layers header.</p>
          ) : presets.map(p => (
            <div key={p.id} className="preset-lib-row">
              <div className="preset-lib-info">
                <span className="preset-lib-name">{p.name}</span>
                <span className="preset-lib-meta">{p.config?.layers?.length || 0} layers · {p.config?.bindingName} · {p.origin_song?.filename?.replace(/\.[^.]+$/, '') || '?'}</span>
              </div>
              <button className="ts-icon ts-accent" onClick={() => { dispatch({ type: 'PRESET_APPLY', presetId: p.id, toTabId: tabId }); onClose() }}>Apply</button>
              <button className="ts-icon" onClick={() => { const blob = new Blob([JSON.stringify(p, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `preset-${p.name.replace(/\s/g,'-')}.json`; a.click() }}>↓</button>
              <button className="ts-icon tp-rm" onClick={() => { if (confirm(`Delete "${p.name}"?`)) dispatch({ type: 'PRESET_DELETE', presetId: p.id }) }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
