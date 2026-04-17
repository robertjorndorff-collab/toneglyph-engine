import { useStudio } from '../studio/StudioContext'
import { MODELS, BINDINGS } from '../glyph/GlyphCanvas'
import { fmt, resolveBindings } from '../shared/constants.js'

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
  ['Zeitgeist', r => r.pillar1?.zeitgeist_score],
  ['DNA', r => r.pillar2?.dna_score],
  ['Harmonic', r => r.pillar3?.harmonic_complexity],
  ['Rhythmic', r => r.pillar3?.rhythmic_complexity],
  ['Hidden Cx', r => r.pillar4?.hidden_complexity_score],
  ['Novelty', r => r.pillar5?.novelty_score],
]

export default function TuningPanel() {
  const { activeTab, tuningOpen, dispatch } = useStudio()

  const tab = activeTab
  const binding = tab ? (BINDINGS[tab.bindingName] || BINDINGS['Default']) : null
  const rv = tab?.result ? resolveBindings(binding, tab.result) : {}

  return (
    <div className={`tp ${tuningOpen ? 'tp-open' : 'tp-closed'}`}>
      {!tuningOpen ? null : !tab ? (
        <div className="tp-inner">
          <div className="tp-top">
            <span className="tp-title">Tuning</span>
            <button className="tp-x" onClick={() => dispatch({ type: 'TOGGLE_TUNING' })}>×</button>
          </div>
          <p className="tp-empty">No song selected</p>
        </div>
      ) : (
        <div className="tp-inner">
          <div className="tp-top">
            <span className="tp-title">Tuning</span>
            <button className="tp-x" onClick={() => dispatch({ type: 'TOGGLE_TUNING' })}>×</button>
          </div>

          {/* ── Visual Model ── */}
          <div className="tp-group">
            <h4 className="tp-group-label">Visual Model</h4>
            <select
              className="tp-select"
              value={tab.modelName}
              onChange={e => dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { modelName: e.target.value } })}
            >
              {Object.keys(MODELS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="tp-desc">{MODELS[tab.modelName]?.description?.slice(0, 90)}</p>
          </div>

          {/* ── Binding ── */}
          <div className="tp-group">
            <h4 className="tp-group-label">Pillar Binding</h4>
            <select
              className="tp-select"
              value={tab.bindingName}
              onChange={e => dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { bindingName: e.target.value } })}
            >
              {Object.keys(BINDINGS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* ── Live Overrides ── */}
          <div className="tp-group">
            <div className="tp-group-head">
              <h4 className="tp-group-label">Live Overrides</h4>
              <button className="tp-reset-btn" onClick={() => dispatch({ type: 'CLEAR_OVERRIDES' })}>Reset</button>
            </div>
            {SLIDERS.map(s => {
              const base = typeof rv[s.key] === 'number' ? rv[s.key] : (s.min + s.max) / 2
              const val = tab.overrides[s.key] ?? base
              return (
                <div key={s.key} className="tp-ctrl">
                  <span className="tp-ctrl-label">{s.label}</span>
                  <input
                    className="tp-range"
                    type="range" min={s.min} max={s.max} step={s.step}
                    value={val}
                    onChange={e => dispatch({ type: 'SET_OVERRIDE', key: s.key, value: parseFloat(e.target.value) })}
                  />
                  <span className="tp-ctrl-val">{fmt(val, 2)}</span>
                </div>
              )
            })}
          </div>

          {/* ── Pillar Scores ── */}
          {tab.result && (
            <div className="tp-group">
              <h4 className="tp-group-label">Pillar Scores</h4>
              <div className="tp-scores">
                {SCORES.map(([label, fn]) => {
                  const v = fn(tab.result)
                  return (
                    <div key={label} className="tp-score">
                      <span className="tp-score-name">{label}</span>
                      <div className="tp-score-track">
                        <div className="tp-score-bar" style={{ width: `${(v || 0) * 100}%` }} />
                      </div>
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
