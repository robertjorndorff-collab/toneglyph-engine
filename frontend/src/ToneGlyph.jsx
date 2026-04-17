import { useRef, useEffect, useCallback, useState } from 'react'

// Standard pitch-class → hue mapping (chromatic circle)
const PITCH_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

// ── Data validation ──────────────────────────────────────────────────

function num(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb }
function arr(v, fb = []) { return Array.isArray(v) ? v : fb }

function safeData(result) {
  if (!result) return null
  const cas = result.cas || {}
  const p1 = result.pillar1 || {}
  const p3 = result.pillar3 || {}
  const p4 = result.pillar4 || {}
  const p5 = result.pillar5 || {}
  const geo = cas.geometry || {}
  const lighting = cas.lighting || {}
  const motion = cas.motion || {}
  const beatSync = cas.beat_sync || {}

  const chromaMean = arr(p3.chroma?.mean).map(v => num(v))
  if (chromaMean.length !== 12) return null

  return {
    chromaMean,
    chromaBeatSync: arr(p3.chroma?.beat_sync),
    mfccMean: arr(p3.mfcc?.mean).map(v => num(v)),
    tempoBpm: num(p3.tempo?.bpm, 120),
    genrePosition: p1.genre_position || '',
    eraAlignment: p1.era_alignment || '',
    noveltyScore: num(p5.novelty_score, 0.5),
    hiddenComplexity: num(p4.hidden_complexity_score, 0.5),
    shapeComplexity: num(geo.shape_complexity, 0.5),
    shapeSymmetry: num(geo.shape_symmetry, 0.5),
    emissivePower: num(lighting.emissive_power, 0.3),
    transmission: num(lighting.transmission, 0.3),
    rimLight: num(lighting.rim_light_intensity, 0.5),
    spinRate: num(motion.spin_rate, 0.3),
    pulseAmplitude: num(motion.pulse_amplitude, 0.2),
    lumMultiplier: arr(beatSync.luminance_multiplier).filter(v => Number.isFinite(v)),
    rgbHex: cas.rgb?.hex || '#808080',
  }
}

// ── Mood palette ─────────────────────────────────────────────────────

function getMood(genre, era) {
  const g = genre.toLowerCase()
  const e = era.toLowerCase()
  let warmth = 0, satMod = 1.0, lightMod = 0

  if (/folk|singer-songwriter|acoustic|country|americana/.test(g)) { warmth = 0.35; satMod = 0.85 }
  else if (/jazz|modal|swing|bebop|big.?band|cool jazz/.test(g)) { warmth = -0.3; satMod = 0.9 }
  else if (/classical|piano|minimalist|impressionist|baroque|proto-minimalist|salon|chamber/.test(g)) { warmth = -0.15; satMod = 0.65; lightMod = 0.15 }
  else if (/rock|hard rock|prog|metal|arena|punk|alternative/.test(g)) { warmth = 0.2; satMod = 1.15 }
  else if (/electronic|ambient|techno|idm/.test(g)) { warmth = -0.2; satMod = 1.1 }
  else if (/r&b|soul|funk|gospel/.test(g)) { warmth = 0.15; satMod = 1.05 }

  if (/1960s|1970s|laurel canyon|singer-songwriter/.test(e)) { warmth += 0.15; lightMod += 0.05 }
  if (/19th.*century|1800s|impressionist|romantic|1888/.test(e)) { warmth -= 0.1; satMod *= 0.65; lightMod += 0.2 }
  if (/modal.*jazz|1959|kind.*blue|1950s/.test(e)) { warmth -= 0.2; satMod *= 1.05 }
  if (/art.?piano|reinterpretation/.test(g)) { warmth -= 0.05; lightMod += 0.08 }

  return { warmth, satMod, lightMod }
}

// ── Shape computation ────────────────────────────────────────────────

function computeShape(chromaMean, mfccMean, complexity, symmetry, nPoints) {
  const maxC = Math.max(...chromaMean, 0.001)
  const points = []

  const nHarmonics = Math.max(2, Math.round(complexity * 8))

  for (let i = 0; i < nPoints; i++) {
    const angle = (i / nPoints) * Math.PI * 2
    const sf = (angle / (Math.PI * 2)) * 12
    const s0 = Math.floor(sf) % 12
    const s1 = (s0 + 1) % 12
    const bl = sf - Math.floor(sf)
    const energy = (chromaMean[s0] * (1 - bl) + chromaMean[s1] * bl) / maxC

    let distortion = 0
    for (let h = 0; h < Math.min(nHarmonics, mfccMean.length); h++) {
      const mn = mfccMean[h] / 300
      distortion += mn * Math.sin(angle * (h + 2) + h * 1.618) * 0.08
    }
    distortion *= (1 - symmetry * 0.7)

    const r = 0.35 + energy * 0.55 + distortion
    points.push({ angle, r: Math.max(0.15, Math.min(1.0, r)), energy })
  }
  return points
}

// ── Rendering ────────────────────────────────────────────────────────

function renderGlyph(ctx, w, h, data, rotation, beatLum) {
  const cx = w / 2, cy = h / 2
  const maxR = Math.min(w, h) * 0.42
  const { chromaMean, mfccMean, shapeComplexity, shapeSymmetry,
          noveltyScore, hiddenComplexity, emissivePower, transmission,
          rimLight } = data
  const mood = getMood(data.genrePosition, data.eraAlignment)
  const maxC = Math.max(...chromaMean, 0.001)

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  const shape = computeShape(chromaMean, mfccMean, shapeComplexity, shapeSymmetry, 360)

  // ── Layer 1: Glow backdrop ──
  const glowR = maxR * 1.6
  const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
  const dominantIdx = chromaMean.indexOf(Math.max(...chromaMean))
  const glowHue = (PITCH_HUES[dominantIdx] + mood.warmth * 40 + 360) % 360
  glowGrad.addColorStop(0, `hsla(${glowHue}, 40%, 30%, ${emissivePower * 0.25})`)
  glowGrad.addColorStop(0.5, `hsla(${glowHue}, 30%, 20%, ${emissivePower * 0.1})`)
  glowGrad.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, w, h)

  // ── Layer 2: Petal fills (screen blended) ──
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotation)
  ctx.globalCompositeOperation = 'screen'

  const baseSat = 35 + noveltyScore * 50
  const gradientStops = Math.max(2, Math.round(hiddenComplexity * 5))

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const energy = chromaMean[i] / maxC
    if (energy < 0.08) continue

    const petalR = maxR * (0.25 + energy * 0.75)
    const petalW = maxR * 0.32 * (0.5 + energy * 0.5)
    const hue = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const baseLight = 25 + energy * 30 + mood.lightMod * 20
    const beatBoost = (beatLum && beatLum[i] !== undefined) ? beatLum[i] * 15 : 0

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, petalR)
    for (let s = 0; s <= gradientStops; s++) {
      const t = s / gradientStops
      const lightAtT = baseLight + beatBoost - t * 20
      const alphaAtT = (0.85 - t * 0.6) * (0.5 + energy * 0.5) * (0.7 + transmission * 0.3)
      grad.addColorStop(Math.min(t, 1), `hsla(${hue}, ${sat}%, ${Math.max(5, lightAtT)}%, ${Math.max(0, alphaAtT)})`)
    }
    grad.addColorStop(1, `hsla(${hue}, ${sat}%, 5%, 0)`)

    ctx.save()
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.ellipse(0, -petalR * 0.35, petalW, petalR * 0.85, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
  }

  ctx.globalCompositeOperation = 'source-over'

  // ── Layer 3: Organic outline ──
  ctx.beginPath()
  for (let i = 0; i <= shape.length; i++) {
    const pt = shape[i % shape.length]
    const r = pt.r * maxR
    const x = Math.cos(pt.angle) * r
    const y = Math.sin(pt.angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()

  ctx.strokeStyle = `hsla(${glowHue}, 30%, 70%, ${rimLight * 0.4})`
  ctx.lineWidth = 1.5
  ctx.shadowColor = `hsla(${glowHue}, 50%, 60%, ${rimLight * 0.6})`
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowBlur = 0

  // ── Layer 4: Center bloom ──
  const bloomR = maxR * 0.18
  const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, bloomR)
  bloom.addColorStop(0, `hsla(${glowHue}, 20%, 90%, 0.6)`)
  bloom.addColorStop(0.4, `hsla(${glowHue}, 30%, 60%, 0.2)`)
  bloom.addColorStop(1, `hsla(${glowHue}, 30%, 30%, 0)`)
  ctx.fillStyle = bloom
  ctx.beginPath()
  ctx.arc(0, 0, bloomR, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ── Component ────────────────────────────────────────────────────────

export default function ToneGlyph({ result, onExport }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const dataRef = useRef(null)
  const [renderError, setRenderError] = useState(null)

  const data = safeData(result)
  dataRef.current = data

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `toneglyph-${result?.cas?.pantone_id || 'export'}.png`
      a.click()
    } catch (e) { console.error('[ToneGlyph] export failed:', e) }
  }, [result])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data) return
    setRenderError(null)

    try {
      const dpr = Math.min(window.devicePixelRatio, 2)
      const cssW = canvas.parentElement.clientWidth
      const cssH = Math.min(cssW, 560)
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      canvas.style.width = cssW + 'px'
      canvas.style.height = cssH + 'px'

      const ctx = canvas.getContext('2d')
      if (!ctx) { setRenderError('no-ctx'); return }
      ctx.scale(dpr, dpr)

      const lumArr = data.lumMultiplier
      const hasBeatSync = lumArr.length > 0
      const beatCount = lumArr.length || 1
      const beatInterval = Math.max(0.05, 60 / data.tempoBpm)
      const chromaBS = data.chromaBeatSync

      let rotation = 0
      const startTime = performance.now()

      function frame() {
        const d = dataRef.current
        if (!d) return

        const t = (performance.now() - startTime) / 1000
        rotation = t * d.spinRate * 0.15

        const pulse = 1 + Math.sin(t * 3) * d.pulseAmplitude * 0.06

        // Beat sync: per-sector luminance
        let beatLum = null
        if (hasBeatSync && chromaBS.length > 0) {
          const beatIdx = Math.floor((t / beatInterval) % beatCount)
          const beatVec = chromaBS[beatIdx % chromaBS.length]
          if (Array.isArray(beatVec) && beatVec.length === 12) {
            const maxE = Math.max(...beatVec, 0.001)
            beatLum = beatVec.map(v => num(v) / maxE)
          }
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // Apply pulse as a slight scale transform
        const w = cssW, h = cssH
        ctx.save()
        ctx.translate(w / 2, h / 2)
        ctx.scale(pulse, pulse)
        ctx.translate(-w / 2, -h / 2)

        renderGlyph(ctx, w, h, d, rotation, beatLum)
        ctx.restore()

        animRef.current = requestAnimationFrame(frame)
      }

      animRef.current = requestAnimationFrame(frame)

      function onResize() {
        const nw = canvas.parentElement.clientWidth
        const nh = Math.min(nw, 560)
        canvas.width = nw * dpr
        canvas.height = nh * dpr
        canvas.style.width = nw + 'px'
        canvas.style.height = nh + 'px'
      }
      window.addEventListener('resize', onResize)

      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current)
        window.removeEventListener('resize', onResize)
      }
    } catch (e) {
      console.error('[ToneGlyph] render init failed:', e)
      setRenderError('crash')
    }
  }, [result?.cas?.composite_hash])

  if (!data) return null

  if (renderError) {
    return (
      <div className="glyph-fallback">
        <div className="fallback-swatch" style={{ background: data.rgbHex }} />
        <p className="fallback-msg">Visualization unavailable</p>
      </div>
    )
  }

  return (
    <div className="glyph-wrap">
      <div className="glyph-canvas">
        <canvas ref={canvasRef} />
      </div>
      <button className="export-btn" onClick={handleExport}>Export PNG</button>
    </div>
  )
}
