import { useState } from 'react'
import { useStudio } from '../studio/StudioContext'
import { MODELS, BINDINGS } from '../glyph/GlyphCanvas'
import { fmt, PITCH_NAMES, resolveBindings } from '../shared/constants.js'
import Tip from '../shared/Tooltip'

const SLIDERS = [
  { key: 'color.saturation', label: 'Saturation', min: 0, max: 1, step: 0.01 },
  { key: 'color.gradient_depth', label: 'Gradient Depth', min: 0, max: 1, step: 0.01 },
  { key: 'shape.complexity', label: 'Complexity', min: 0, max: 1, step: 0.01 },
  { key: 'shape.symmetry', label: 'Symmetry', min: 0, max: 1, step: 0.01 },
  { key: 'lighting.glow', label: 'Glow', min: 0, max: 1, step: 0.01 },
  { key: 'motion.spin', label: 'Rotation', min: 0, max: 2, step: 0.01 },
  { key: '_palette_warmth', label: 'Warmth', min: -1, max: 1, step: 0.01 },
]

const SCORES = [
  { key: 'p1', label: 'Zeitgeist', fn: r => r.pillar1?.zeitgeist_score },
  { key: 'p2', label: 'DNA', fn: r => r.pillar2?.dna_score },
  { key: 'p3h', label: 'Harmonic', fn: r => r.pillar3?.harmonic_complexity },
  { key: 'p3r', label: 'Rhythmic', fn: r => r.pillar3?.rhythmic_complexity },
  { key: 'p4', label: 'Hidden Cx', fn: r => r.pillar4?.hidden_complexity_score },
  { key: 'p5', label: 'Novelty', fn: r => r.pillar5?.novelty_score },
]

const modelNames = Object.keys(MODELS)

export default function TuningPanel({ enhancerUI }) {
  const { activeTab, tuningOpen, dispatch } = useStudio()
  const [addingLayer, setAddingLayer] = useState(false)

  const tab = activeTab
  const binding = tab ? (BINDINGS[tab.bindingName] || BINDINGS['Default']) : null
  const rv = tab?.result ? resolveBindings(binding, tab.result) : {}
  const layers = tab?.layers || []

  return (
    <div className={`tp ${tuningOpen ? 'tp-open' : 'tp-closed'}`}>
      {!tuningOpen ? null : !tab ? (
        <div className="tp-inner"><div className="tp-top"><span className="tp-title">Tuning</span><button className="tp-x" onClick={() => dispatch({ type: 'TOGGLE_TUNING' })}>×</button></div><p className="tp-empty">No song selected</p></div>
      ) : (
        <div className="tp-inner">
          <div className="tp-top">
            <span className="tp-title">Tuning</span>
            <button className="tp-x" onClick={() => dispatch({ type: 'TOGGLE_TUNING' })}>×</button>
          </div>

          {/* ── Layers ── */}
          <div className="tp-group">
            <div className="tp-group-head">
              <h4 className="tp-group-label">Layers</h4>
              {layers.length < 5 && (
                <Tip text="Add Layer"><button className="tp-reset-btn" onClick={() => setAddingLayer(!addingLayer)}>+ Add</button></Tip>
              )}
            </div>

            {addingLayer && (
              <select className="tp-select" value="" onChange={e => {
                if (e.target.value) {
                  dispatch({ type: 'LAYER_ADD', modelName: e.target.value })
                  setAddingLayer(false)
                }
              }}>
                <option value="">Select model…</option>
                {modelNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}

            <div className="tp-layers">
              {layers.map((layer, idx) => (
                <div key={layer.id} className="tp-layer">
                  <button className={`tp-layer-eye ${layer.visible !== false ? 'on' : ''}`}
                    onClick={() => dispatch({ type: 'LAYER_UPDATE', layerId: layer.id, patch: { visible: layer.visible === false ? true : false } })}>
                    {layer.visible !== false ? '●' : '○'}
                  </button>
                  <select className="tp-layer-model" value={layer.modelName}
                    onChange={e => dispatch({ type: 'LAYER_UPDATE', layerId: layer.id, patch: { modelName: e.target.value } })}>
                    {modelNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button className="tp-layer-arrow" disabled={idx === 0}
                    onClick={() => dispatch({ type: 'LAYER_REORDER', from: idx, to: idx - 1 })}>▲</button>
                  <button className="tp-layer-arrow" disabled={idx === layers.length - 1}
                    onClick={() => dispatch({ type: 'LAYER_REORDER', from: idx, to: idx + 1 })}>▼</button>
                  <input className="tp-layer-opacity" type="range" min="0" max="1" step="0.05"
                    value={layer.opacity ?? 1}
                    onChange={e => dispatch({ type: 'LAYER_UPDATE', layerId: layer.id, patch: { opacity: parseFloat(e.target.value) } })} />
                  <span className="tp-layer-pct">{Math.round((layer.opacity ?? 1) * 100)}</span>
                  {layers.length > 1 && (
                    <button className="tp-layer-rm" onClick={() => dispatch({ type: 'LAYER_REMOVE', layerId: layer.id })}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Binding ── */}
          <div className="tp-group">
            <h4 className="tp-group-label">Pillar Binding</h4>
            <select className="tp-select" value={tab.bindingName}
              onChange={e => dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { bindingName: e.target.value } })}>
              {Object.keys(BINDINGS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* ── Live Overrides ── */}
          <div className="tp-group">
            <div className="tp-group-head">
              <h4 className="tp-group-label">Live Overrides</h4>
              <Tip text="Reset All Overrides"><button className="tp-reset-btn" onClick={() => dispatch({ type: 'CLEAR_OVERRIDES' })}>Reset</button></Tip>
            </div>
            {SLIDERS.map(s => {
              const base = typeof rv[s.key] === 'number' ? rv[s.key] : (s.min + s.max) / 2
              const val = tab.overrides[s.key] ?? base
              return (
                <div key={s.key} className="tp-ctrl">
                  <span className="tp-ctrl-label">{s.label}</span>
                  <input className="tp-range" type="range" min={s.min} max={s.max} step={s.step}
                    value={val} onChange={e => dispatch({ type: 'SET_OVERRIDE', key: s.key, value: parseFloat(e.target.value) })} />
                  <span className="tp-ctrl-val">{fmt(val, 2)}</span>
                </div>
              )
            })}
          </div>

          {/* ── Enhancers (injected from parent) ── */}
          {enhancerUI}

          {/* ── Pillar Scores ── */}
          {tab.result && (
            <div className="tp-group">
              <h4 className="tp-group-label">Pillar Scores</h4>
              <div className="tp-scores">
                {SCORES.map(({ key, label, fn }) => {
                  const v = fn(tab.result)
                  return (
                    <div key={key} className="tp-score">
                      <span className="tp-score-name">{label}</span>
                      <div className="tp-score-track"><div className="tp-score-bar" style={{ width: `${(v || 0) * 100}%` }} /></div>
                      <span className="tp-score-val">{fmt(v, 2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
