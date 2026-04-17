import { useStudio } from '../studio/StudioContext'
import { MODELS, BINDINGS } from '../glyph/GlyphCanvas'
import { fmt, resolveBindings } from '../shared/constants.js'

const SLIDERS = [
  { key: 'color.saturation', label: 'Saturation', min: 0, max: 1, step: 0.01 },
  { key: 'color.gradient_depth', label: 'Gradient Depth', min: 0, max: 1, step: 0.01 },
  { key: 'shape.complexity', label: 'Shape Complexity', min: 0, max: 1, step: 0.01 },
  { key: 'shape.symmetry', label: 'Shape Symmetry', min: 0, max: 1, step: 0.01 },
  { key: 'lighting.glow', label: 'Glow', min: 0, max: 1, step: 0.01 },
  { key: 'motion.spin', label: 'Rotation Speed', min: 0, max: 2, step: 0.01 },
]

export default function TuningPanel() {
  const { activeTab, tuningOpen, dispatch } = useStudio()
  if (!tuningOpen || !activeTab) return null

  const tab = activeTab
  const binding = BINDINGS[tab.bindingName] || BINDINGS['Default']
  const rv = resolveBindings(binding, tab.result)

  function setModel(n) { dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { modelName: n } }) }
  function setBinding(n) { dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { bindingName: n } }) }
  function setOverride(key, val) { dispatch({ type: 'SET_OVERRIDE', key, value: val }) }
  function clearAll() { dispatch({ type: 'CLEAR_OVERRIDES' }) }

  return (
    <div className="tuning-panel">
      <div className="tp-header">
        <span>Tuning</span>
        <button className="tp-close" onClick={() => dispatch({ type: 'TOGGLE_TUNING' })}>×</button>
      </div>

      <div className="tp-section">
        <label className="tp-label">Visual Model</label>
        <select value={tab.modelName} onChange={e => setModel(e.target.value)}>
          {Object.keys(MODELS).map(n => <option key={n}>{n}</option>)}
        </select>
        <p className="tp-hint">{MODELS[tab.modelName]?.description?.slice(0, 100)}</p>
      </div>

      <div className="tp-section">
        <label className="tp-label">Pillar Binding</label>
        <select value={tab.bindingName} onChange={e => setBinding(e.target.value)}>
          {Object.keys(BINDINGS).map(n => <option key={n}>{n}</option>)}
        </select>
      </div>

      <div className="tp-section">
        <div className="tp-section-head">
          <label className="tp-label">Live Overrides</label>
          <button className="tp-reset" onClick={clearAll}>Reset</button>
        </div>
        {SLIDERS.map(s => {
          const base = typeof rv[s.key] === 'number' ? rv[s.key] : 0.5
          const current = tab.overrides[s.key] ?? base
          return (
            <div key={s.key} className="tp-slider">
              <span className="tp-slider-label">{s.label}</span>
              <input type="range" min={s.min} max={s.max} step={s.step}
                value={current} onChange={e => setOverride(s.key, parseFloat(e.target.value))} />
              <span className="tp-slider-val">{fmt(current, 2)}</span>
            </div>
          )
        })}
      </div>

      {tab.result && (
        <div className="tp-section">
          <label className="tp-label">Pillar Scores</label>
          <PillarMiniReadout result={tab.result} />
        </div>
      )}
    </div>
  )
}

function PillarMiniReadout({ result }) {
  const scores = [
    ['P1 Zeitgeist', result.pillar1?.zeitgeist_score],
    ['P2 DNA', result.pillar2?.dna_score],
    ['P3 Harmonic', result.pillar3?.harmonic_complexity],
    ['P3 Rhythmic', result.pillar3?.rhythmic_complexity],
    ['P4 Hidden Cx', result.pillar4?.hidden_complexity_score],
    ['P5 Novelty', result.pillar5?.novelty_score],
  ]
  return (
    <div className="tp-mini-scores">
      {scores.map(([label, val]) => (
        <div key={label} className="tp-score-row">
          <span>{label}</span>
          <div className="tp-score-bar"><div className="tp-score-fill" style={{ width: `${(val || 0) * 100}%` }} /></div>
          <span>{fmt(val, 2)}</span>
        </div>
      ))}
    </div>
  )
}
