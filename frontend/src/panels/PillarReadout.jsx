import { useState } from 'react'
import { fmt, PITCH_NAMES, resolveBindings } from '../shared/constants.js'
import { BINDINGS } from '../glyph/GlyphCanvas'

export function CasSignature({ cas }) {
  if (!cas) return null
  const { hsv = {}, rgb = {}, cmyk = {}, pantone_id, composite_hash, geometry = {} } = cas
  return (
    <div className="signature-card">
      <div className="sig-color-block" style={{ background: rgb.hex || '#808080' }} />
      <div className="sig-data">
        <div className="sig-row"><span className="sig-label">Pantone</span><span className="sig-value">{pantone_id || '—'}</span></div>
        <div className="sig-row"><span className="sig-label">RGB</span><span className="sig-value">{rgb.hex || '—'} <span className="muted">({rgb.r}, {rgb.g}, {rgb.b})</span></span></div>
        <div className="sig-row"><span className="sig-label">CMYK</span><span className="sig-value muted">C{fmt(cmyk.c)} M{fmt(cmyk.m)} Y{fmt(cmyk.y)} K{fmt(cmyk.k)}</span></div>
        <div className="sig-row"><span className="sig-label">HSV</span><span className="sig-value muted">{fmt(hsv.h, 0)}° S{fmt(hsv.s)} V{fmt(hsv.v)}</span></div>
        <div className="sig-row"><span className="sig-label">Texture</span><span className="sig-value">{geometry.surface_texture || '—'}</span></div>
        <div className="sig-row"><span className="sig-label">Hash</span><span className="sig-value hash">{composite_hash || '—'}</span></div>
      </div>
    </div>
  )
}

export function GlyphDiagnostics({ result, bindingName, inline }) {
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
          <p className="diag-meta">Binding: <strong>{bindingName}</strong></p>
          <table className="diag-table">
            <thead><tr><th>Visual Property</th><th>Data Source</th><th>Value</th></tr></thead>
            <tbody>
              {Object.entries(binding.mappings).map(([vp, dp]) => (
                <tr key={vp}><td>{vp}</td><td className="muted">{dp}</td><td>{fmtVal(rv[vp])}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PillarSection({ title, children, error }) {
  if (error) return <div className="pillar-section"><h3>{title}</h3><p className="pillar-error">{error}</p></div>
  if (!children) return null
  return <div className="pillar-section"><h3>{title}</h3>{children}</div>
}

export function FullPillarReadout({ result }) {
  if (!result) return null
  const p1 = result.pillar1, p2 = result.pillar2, p3 = result.pillar3, p4 = result.pillar4, p5 = result.pillar5
  const cm = p3?.chroma?.mean || []
  const mx = Math.max(...cm, 1e-9)

  return (
    <div className="result-card">
      <h2>{result.filename?.replace(/\.[^.]+$/, '') || 'Analysis'}</h2>
      <table className="result-table"><tbody>
        <tr><td>Duration</td><td>{result.duration}s</td></tr>
        <tr><td>Format</td><td>{(result.format || '').toUpperCase()} · {result.channels}ch · {result.sample_rate}Hz</td></tr>
        <tr><td>SHA-256</td><td className="hash">{result.file_hash}</td></tr>
      </tbody></table>

      <PillarSection title="Pillar 3 — Music Theory" error={result.pillar3_error}>
        {p3 && <table className="result-table"><tbody>
          <tr><td>Key</td><td>{p3.key?.name} <span className="muted">(conf {fmt(p3.key?.confidence, 3)})</span></td></tr>
          <tr><td>Tempo</td><td>{fmt(p3.tempo?.bpm, 1)} BPM <span className="muted">(stability {fmt(p3.tempo?.stability, 3)})</span></td></tr>
          <tr><td>Harmonic</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(p3.harmonic_complexity || 0) * 100}%` }} /></div><span className="muted">{fmt(p3.harmonic_complexity, 3)}</span></td></tr>
          <tr><td>Rhythmic</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(p3.rhythmic_complexity || 0) * 100}%` }} /></div><span className="muted">{fmt(p3.rhythmic_complexity, 3)}</span></td></tr>
        </tbody></table>}
        {cm.length === 12 && <div className="chroma-block"><p className="chroma-label">Chromagram</p><div className="chroma-bars">{cm.map((v, i) => <div key={i} className="chroma-col"><div className="chroma-bar-wrap"><div className="chroma-bar" style={{ height: `${(v / mx) * 100}%` }} /></div><span className="chroma-tick">{PITCH_NAMES[i]}</span></div>)}</div></div>}
      </PillarSection>

      <PillarSection title="Pillar 1 — Zeitgeist" error={result.pillar1_error}>
        {p1 && <>
          <table className="result-table"><tbody>
            <tr><td>Score</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(p1.zeitgeist_score || 0) * 100}%` }} /></div><span className="muted">{fmt(p1.zeitgeist_score, 3)}</span></td></tr>
            <tr><td>Era</td><td>{p1.era_alignment || '—'}</td></tr>
            <tr><td>Genre</td><td>{p1.genre_position || '—'}</td></tr>
          </tbody></table>
          {p1.cultural_reasoning && <p className="reasoning">{p1.cultural_reasoning}</p>}
        </>}
      </PillarSection>

      <PillarSection title="Pillar 2 — Artistic DNA" error={result.pillar2_error}>
        {p2 && <>
          <table className="result-table"><tbody>
            <tr><td>DNA Score</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(p2.dna_score || 0) * 100}%` }} /></div><span className="muted">{fmt(p2.dna_score, 3)}</span></td></tr>
          </tbody></table>
          {p2.influence_vector?.length > 0 && <div className="influence-block"><p className="chroma-label">Influence Vector</p>{p2.influence_vector.map((inf, i) => <div key={i} className="influence-row"><span className="influence-name">{inf.name}</span><div className="meter small"><div className="meter-fill" style={{ width: `${(inf.weight || 0) * 100}%` }} /></div><span className="muted">{fmt(inf.weight, 2)}</span></div>)}</div>}
          {p2.dna_reasoning && <p className="reasoning">{p2.dna_reasoning}</p>}
        </>}
      </PillarSection>

      <PillarSection title="Pillar 4 — Johari Window" error={result.pillar4_error}>
        {p4 && (() => { const q = p4.johari_quadrant_assignments || {}; return <>
          <table className="result-table"><tbody><tr><td>Hidden Cx</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(p4.hidden_complexity_score || 0) * 100}%` }} /></div><span className="muted">{fmt(p4.hidden_complexity_score, 3)}</span></td></tr></tbody></table>
          {(q.open || q.blind) && <div className="johari-grid">
            {q.open && <div className="johari-cell"><span className="johari-label">Open</span><ul>{q.open.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {q.blind && <div className="johari-cell"><span className="johari-label">Blind</span><ul>{q.blind.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {q.hidden && <div className="johari-cell"><span className="johari-label">Hidden</span><ul>{q.hidden.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {q.unknown && <div className="johari-cell"><span className="johari-label">Unknown</span><ul>{q.unknown.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          </div>}
          {p4.johari_reasoning && <p className="reasoning">{p4.johari_reasoning}</p>}
        </> })()}
      </PillarSection>

      <PillarSection title="Pillar 5 — IP Novelty" error={result.pillar5_error}>
        {p5 && <table className="result-table"><tbody>
          <tr><td>Novelty</td><td><div className="meter"><div className="meter-fill" style={{ width: `${(p5.novelty_score || 0) * 100}%` }} /></div><span className="muted">{fmt(p5.novelty_score, 3)}</span></td></tr>
          <tr><td>Fingerprint</td><td className="hash">{p5.fingerprint_hash || '—'}</td></tr>
        </tbody></table>}
      </PillarSection>
    </div>
  )
}
