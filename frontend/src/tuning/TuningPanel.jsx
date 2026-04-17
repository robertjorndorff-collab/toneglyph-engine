import { useState } from 'react'
import { useStudio } from '../studio/StudioContext'
import { MODELS, BINDINGS } from '../glyph/GlyphCanvas'
import { fmt, PITCH_NAMES, resolveBindings } from '../shared/constants.js'

const SLIDERS = [
  { key: 'color.saturation', label: 'Saturation', min: 0, max: 1, step: 0.01 },
  { key: 'color.gradient_depth', label: 'Gradient Depth', min: 0, max: 1, step: 0.01 },
  { key: 'shape.complexity', label: 'Complexity', min: 0, max: 1, step: 0.01 },
  { key: 'shape.symmetry', label: 'Symmetry', min: 0, max: 1, step: 0.01 },
  { key: 'lighting.glow', label: 'Glow', min: 0, max: 1, step: 0.01 },
  { key: 'motion.spin', label: 'Rotation', min: 0, max: 2, step: 0.01 },
  { key: '_palette_warmth', label: 'Warmth', min: -1, max: 1, step: 0.01 },
]

const SCORE_DEFS = [
  { key: 'p1', label: 'P1 Zeitgeist', fn: r => r.pillar1?.zeitgeist_score, pillar: 'pillar1' },
  { key: 'p2', label: 'P2 DNA', fn: r => r.pillar2?.dna_score, pillar: 'pillar2' },
  { key: 'p3h', label: 'P3 Harmonic', fn: r => r.pillar3?.harmonic_complexity, pillar: 'pillar3' },
  { key: 'p3r', label: 'P3 Rhythmic', fn: r => r.pillar3?.rhythmic_complexity, pillar: null },
  { key: 'p4', label: 'P4 Hidden Cx', fn: r => r.pillar4?.hidden_complexity_score, pillar: 'pillar4' },
  { key: 'p5', label: 'P5 Novelty', fn: r => r.pillar5?.novelty_score, pillar: 'pillar5' },
]

export default function TuningPanel() {
  const { activeTab, tuningOpen, dispatch } = useStudio()
  const [expanded, setExpanded] = useState(null)

  const tab = activeTab
  const binding = tab ? (BINDINGS[tab.bindingName] || BINDINGS['Default']) : null
  const rv = tab?.result ? resolveBindings(binding, tab.result) : {}

  function toggleExpand(key) { setExpanded(expanded === key ? null : key) }

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

          <div className="tp-group">
            <h4 className="tp-group-label">Visual Model</h4>
            <select className="tp-select" value={tab.modelName}
              onChange={e => dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { modelName: e.target.value } })}>
              {Object.keys(MODELS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="tp-desc">{MODELS[tab.modelName]?.description?.slice(0, 90)}</p>
          </div>

          <div className="tp-group">
            <h4 className="tp-group-label">Pillar Binding</h4>
            <select className="tp-select" value={tab.bindingName}
              onChange={e => dispatch({ type: 'TAB_UPDATE', id: tab.id, patch: { bindingName: e.target.value } })}>
              {Object.keys(BINDINGS).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

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
                  <input className="tp-range" type="range" min={s.min} max={s.max} step={s.step}
                    value={val} onChange={e => dispatch({ type: 'SET_OVERRIDE', key: s.key, value: parseFloat(e.target.value) })} />
                  <span className="tp-ctrl-val">{fmt(val, 2)}</span>
                </div>
              )
            })}
          </div>

          {tab.result && (
            <div className="tp-group tp-pillars">
              <h4 className="tp-group-label">Pillar Scores</h4>
              {SCORE_DEFS.map(({ key, label, fn, pillar }) => {
                const v = fn(tab.result)
                const isOpen = expanded === key
                return (
                  <div key={key}>
                    <div className="tp-score" onClick={() => pillar && toggleExpand(key)} style={{ cursor: pillar ? 'pointer' : 'default' }}>
                      <span className="tp-score-name">{label} {pillar && (isOpen ? '▾' : '▸')}</span>
                      <div className="tp-score-track"><div className="tp-score-bar" style={{ width: `${(v || 0) * 100}%` }} /></div>
                      <span className="tp-score-val">{fmt(v, 2)}</span>
                    </div>
                    {isOpen && pillar && <PillarDetail pillar={pillar} result={tab.result} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PillarDetail({ pillar, result }) {
  const data = result[pillar]
  if (!data) return <p className="tp-detail-err">No data</p>

  if (pillar === 'pillar1') {
    return (
      <div className="tp-detail">
        <Row label="Era" val={data.era_alignment} />
        <Row label="Genre" val={data.genre_position} />
        <Row label="Score" val={fmt(data.zeitgeist_score, 3)} />
        {data.cultural_reasoning && <p className="tp-reasoning">{data.cultural_reasoning}</p>}
      </div>
    )
  }

  if (pillar === 'pillar2') {
    return (
      <div className="tp-detail">
        <Row label="DNA Score" val={fmt(data.dna_score, 3)} />
        {data.influence_vector?.map((inf, i) => (
          <div key={i} className="tp-influence">
            <span className="tp-inf-name">{inf.name}</span>
            <div className="tp-score-track"><div className="tp-score-bar" style={{ width: `${(inf.weight || 0) * 100}%` }} /></div>
            <span className="tp-inf-w">{fmt(inf.weight, 2)}</span>
          </div>
        ))}
        {data.dna_reasoning && <p className="tp-reasoning">{data.dna_reasoning}</p>}
      </div>
    )
  }

  if (pillar === 'pillar3') {
    const cm = data.chroma?.mean || []
    const mx = Math.max(...cm, 1e-9)
    return (
      <div className="tp-detail">
        <Row label="Key" val={`${data.key?.name} (${fmt(data.key?.confidence, 2)})`} />
        <Row label="Tempo" val={`${fmt(data.tempo?.bpm, 1)} BPM (stab ${fmt(data.tempo?.stability, 2)})`} />
        <Row label="Beats" val={data.beats?.count} />
        <Row label="Harmonic" val={fmt(data.harmonic_complexity, 3)} />
        <Row label="Rhythmic" val={fmt(data.rhythmic_complexity, 3)} />
        {cm.length === 12 && (
          <div className="tp-chroma">
            {cm.map((v, i) => (
              <div key={i} className="tp-chroma-col">
                <div className="tp-chroma-bar" style={{ height: `${(v / mx) * 100}%` }} />
                <span>{PITCH_NAMES[i]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (pillar === 'pillar4') {
    const q = data.johari_quadrant_assignments || {}
    return (
      <div className="tp-detail">
        <Row label="Hidden Cx" val={fmt(data.hidden_complexity_score, 3)} />
        {['open', 'blind', 'hidden', 'unknown'].map(quad => q[quad] && (
          <div key={quad} className="tp-quad">
            <span className="tp-quad-label">{quad}</span>
            <ul>{q[quad].map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
        {data.johari_reasoning && <p className="tp-reasoning">{data.johari_reasoning}</p>}
      </div>
    )
  }

  if (pillar === 'pillar5') {
    return (
      <div className="tp-detail">
        <Row label="Novelty" val={fmt(data.novelty_score, 3)} />
        <Row label="Fingerprint" val={data.fingerprint_hash?.slice(0, 24) + '…'} mono />
        <Row label="Peaks" val={`${data.peaks?.count} (${fmt(data.peaks?.density_per_sec, 1)}/s)`} />
      </div>
    )
  }

  return null
}

function Row({ label, val, mono }) {
  return (
    <div className="tp-row">
      <span className="tp-row-label">{label}</span>
      <span className={`tp-row-val ${mono ? 'mono' : ''}`}>{val ?? '—'}</span>
    </div>
  )
}
