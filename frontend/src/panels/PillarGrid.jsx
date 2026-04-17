import { fmt, PITCH_NAMES } from '../shared/constants.js'

export default function PillarGrid({ result }) {
  if (!result) return null
  const p1 = result.pillar1, p2 = result.pillar2, p3 = result.pillar3
  const p4 = result.pillar4, p5 = result.pillar5

  return (
    <div className="pg-grid">
      <div className="pg-cell">
        <h4 className="pg-h">P1 — Zeitgeist</h4>
        {p1 ? <>
          <PgRow l="Score" v={fmt(p1.zeitgeist_score, 3)} bar={p1.zeitgeist_score} />
          <PgRow l="Era" v={p1.era_alignment} />
          <PgRow l="Genre" v={p1.genre_position} />
          {p1.cultural_reasoning && <p className="pg-reason">{p1.cultural_reasoning}</p>}
        </> : <p className="pg-err">{result.pillar1_error || 'No data'}</p>}
      </div>

      <div className="pg-cell">
        <h4 className="pg-h">P2 — Artistic DNA</h4>
        {p2 ? <>
          <PgRow l="DNA" v={fmt(p2.dna_score, 3)} bar={p2.dna_score} />
          {p2.influence_vector?.map((inf, i) => (
            <div key={i} className="pg-inf">
              <span className="pg-inf-name">{inf.name}</span>
              <div className="pg-bar-track"><div className="pg-bar-fill" style={{ width: `${(inf.weight || 0) * 100}%` }} /></div>
              <span className="pg-inf-w">{fmt(inf.weight, 2)}</span>
            </div>
          ))}
          {p2.dna_reasoning && <p className="pg-reason">{p2.dna_reasoning}</p>}
        </> : <p className="pg-err">{result.pillar2_error || 'No data'}</p>}
      </div>

      <div className="pg-cell">
        <h4 className="pg-h">P3 — Music Theory</h4>
        {p3 ? <>
          <PgRow l="Key" v={`${p3.key?.name} (${fmt(p3.key?.confidence, 2)})`} />
          <PgRow l="Tempo" v={`${fmt(p3.tempo?.bpm, 1)} BPM`} />
          <PgRow l="Beats" v={p3.beats?.count} />
          <PgRow l="Harmonic" v={fmt(p3.harmonic_complexity, 3)} bar={p3.harmonic_complexity} />
          <PgRow l="Rhythmic" v={fmt(p3.rhythmic_complexity, 3)} bar={p3.rhythmic_complexity} />
          <Chromagram chroma={p3.chroma?.mean} />
        </> : <p className="pg-err">{result.pillar3_error || 'No data'}</p>}
      </div>

      <div className="pg-cell">
        <h4 className="pg-h">P4 — Johari Window</h4>
        {p4 ? <>
          <PgRow l="Hidden Cx" v={fmt(p4.hidden_complexity_score, 3)} bar={p4.hidden_complexity_score} />
          <JohariQuads q={p4.johari_quadrant_assignments} />
          {p4.johari_reasoning && <p className="pg-reason">{p4.johari_reasoning}</p>}
        </> : <p className="pg-err">{result.pillar4_error || 'No data'}</p>}
      </div>

      <div className="pg-cell pg-cell-wide">
        <h4 className="pg-h">P5 — IP Novelty</h4>
        {p5 ? <>
          <PgRow l="Novelty" v={fmt(p5.novelty_score, 3)} bar={p5.novelty_score} />
          <PgRow l="Fingerprint" v={p5.fingerprint_hash?.slice(0, 32) + '…'} mono />
          <PgRow l="Peaks" v={`${p5.peaks?.count} (${fmt(p5.peaks?.density_per_sec, 1)}/s)`} />
          <PgRow l="Flatness" v={fmt(p5.spectral_flatness?.mean, 4)} />
        </> : <p className="pg-err">{result.pillar5_error || 'No data'}</p>}
      </div>
    </div>
  )
}

function PgRow({ l, v, bar, mono }) {
  return (
    <div className="pg-row">
      <span className="pg-label">{l}</span>
      {bar !== undefined && <div className="pg-bar-track"><div className="pg-bar-fill" style={{ width: `${(bar || 0) * 100}%` }} /></div>}
      <span className={`pg-val ${mono ? 'pg-mono' : ''}`}>{v ?? '—'}</span>
    </div>
  )
}

function Chromagram({ chroma }) {
  if (!chroma || chroma.length !== 12) return null
  const mx = Math.max(...chroma, 1e-9)
  return (
    <div className="pg-chroma">
      {chroma.map((v, i) => (
        <div key={i} className="pg-chroma-col">
          <div className="pg-chroma-bar-w"><div className="pg-chroma-bar" style={{ height: `${(v / mx) * 100}%` }} /></div>
          <span>{PITCH_NAMES[i]}</span>
        </div>
      ))}
    </div>
  )
}

function JohariQuads({ q }) {
  if (!q) return null
  return (
    <div className="pg-johari">
      {['open', 'blind', 'hidden', 'unknown'].map(quad => q[quad] && (
        <div key={quad} className="pg-jq">
          <span className="pg-jq-label">{quad}</span>
          <ul>{q[quad].map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      ))}
    </div>
  )
}
