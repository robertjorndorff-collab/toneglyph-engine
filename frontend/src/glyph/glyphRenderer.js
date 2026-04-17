import { PITCH_HUES, num, arr } from '../shared/constants.js'

export function getMood(genre, era) {
  const g = (genre || '').toLowerCase(), e = (era || '').toLowerCase()
  let warmth = 0, satMod = 1.0, lightMod = 0

  if (/folk|singer-songwriter|acoustic|country|americana/.test(g)) { warmth = 0.35; satMod = 0.85 }
  else if (/jazz|modal|swing|bebop|big.?band|cool jazz/.test(g)) { warmth = -0.3; satMod = 0.9 }
  else if (/classical|piano|minimalist|impressionist|baroque|proto-minimalist|salon|chamber/.test(g)) { warmth = -0.15; satMod = 0.65; lightMod = 0.15 }
  else if (/rock|hard rock|prog|metal|arena|punk|alternative/.test(g)) { warmth = 0.2; satMod = 1.15 }
  else if (/electronic|ambient|techno|idm/.test(g)) { warmth = -0.2; satMod = 1.1 }
  else if (/r&b|soul|funk|gospel/.test(g)) { warmth = 0.15; satMod = 1.05 }
  else if (/art.?piano|art.?pop/.test(g)) { warmth = -0.05; lightMod = 0.08 }

  if (/1960s|1970s|laurel canyon/.test(e)) { warmth += 0.15; lightMod += 0.05 }
  if (/19th.*century|1800s|impressionist|romantic|1888/.test(e)) { warmth -= 0.1; satMod *= 0.65; lightMod += 0.2 }
  if (/modal.*jazz|1959|kind.*blue|1950s/.test(e)) { warmth -= 0.2; satMod *= 1.05 }

  return { warmth, satMod, lightMod }
}

export function computeShape(chromaMean, mfccMean, complexity, symmetry, nPoints, organic) {
  const maxC = Math.max(...chromaMean, 0.001)
  const points = []
  const nH = organic ? Math.max(2, Math.round(complexity * 10)) : 0

  for (let i = 0; i < nPoints; i++) {
    const angle = (i / nPoints) * Math.PI * 2
    const sf = (angle / (Math.PI * 2)) * 12
    const s0 = Math.floor(sf) % 12, s1 = (s0 + 1) % 12
    const bl = sf - Math.floor(sf)
    const energy = (chromaMean[s0] * (1 - bl) + chromaMean[s1] * bl) / maxC

    let dist = 0
    if (organic) {
      for (let h = 0; h < Math.min(nH, mfccMean.length); h++) {
        dist += (mfccMean[h] / 300) * Math.sin(angle * (h + 2) + h * 1.618) * 0.06
      }
      dist *= (1 - symmetry * 0.7)
    }

    points.push({ angle, r: Math.max(0.12, Math.min(1.0, 0.30 + energy * 0.60 + dist)), energy, sector: s0 })
  }
  return points
}

function hsl(h, s, l, a) { return `hsla(${h},${s}%,${l}%,${a})` }

// ── Kandinsky-quality Chromatic renderer ──────────────────────────────

export function renderChromatic(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const cx = w / 2, cy = h / 2
  const R = Math.min(w, h) * 0.44
  const maxC = Math.max(...chroma, 0.001)
  const novelty = num(opts.novelty, 0.5)
  const depth = num(opts.depth, 0.5)
  const emissive = num(opts.emissive, 0.3)
  const rimI = num(opts.rim, 0.5)
  const baseSat = 30 + novelty * 55
  const rhythmic = num(opts.rhythmic, 0.3)
  const harmonic = num(opts.harmonic, 0.5)

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(cx, cy)

  // ── Layer 0: Atmospheric glow field ──
  const domIdx = chroma.indexOf(Math.max(...chroma))
  const glowH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
  const gR = R * 1.8
  const gg = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, gR)
  gg.addColorStop(0, hsl(glowH, 50, 35, emissive * 0.3))
  gg.addColorStop(0.4, hsl(glowH, 30, 20, emissive * 0.12))
  gg.addColorStop(1, 'hsla(0,0%,0%,0)')
  ctx.fillStyle = gg
  ctx.beginPath(); ctx.arc(0, 0, gR, 0, Math.PI * 2); ctx.fill()

  // ── Layer 1: Deep translucent orbs (Kandinsky circles-within-circles) ──
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.1) continue
    const angle = (i / 12) * Math.PI * 2
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const orbR = R * energy * 0.55
    const dist = R * (0.15 + energy * 0.35)
    const ox = Math.cos(angle) * dist
    const oy = Math.sin(angle) * dist

    const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, orbR)
    og.addColorStop(0, hsl(baseH, sat, 40 + mood.lightMod * 20, 0.25))
    og.addColorStop(0.6, hsl(baseH, sat * 0.8, 25 + mood.lightMod * 15, 0.12))
    og.addColorStop(1, hsl(baseH, sat, 10, 0))
    ctx.fillStyle = og
    ctx.beginPath(); ctx.arc(ox, oy, orbR, 0, Math.PI * 2); ctx.fill()
  }

  // ── Layer 2: Gestural strokes (Kandinsky bold lines) ──
  ctx.globalCompositeOperation = 'screen'
  const nStrokes = Math.round(3 + depth * 6)
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.15) continue
    const angle = (i / 12) * Math.PI * 2
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const strokeLen = R * energy * 0.9
    const beatB = (beatLum?.[i] ?? 0.5)

    const lineW = 1 + energy * 3 + beatB * 2
    const alpha = 0.15 + energy * 0.25 + beatB * 0.1

    // Angular vs curved strokes based on rhythmic complexity
    ctx.strokeStyle = hsl(baseH, sat, 45 + mood.lightMod * 20 + beatB * 15, alpha)
    ctx.lineWidth = lineW
    ctx.lineCap = 'round'

    ctx.beginPath()
    if (rhythmic > 0.4) {
      // Angular: straight lines with sharp turns
      const x1 = Math.cos(angle) * R * 0.08
      const y1 = Math.sin(angle) * R * 0.08
      const x2 = Math.cos(angle + 0.05) * strokeLen
      const y2 = Math.sin(angle + 0.05) * strokeLen
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
    } else {
      // Fluid: bezier curves
      const cp1x = Math.cos(angle + 0.3) * strokeLen * 0.5
      const cp1y = Math.sin(angle + 0.3) * strokeLen * 0.5
      const x2 = Math.cos(angle - 0.1) * strokeLen
      const y2 = Math.sin(angle - 0.1) * strokeLen
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(cp1x, cp1y, x2, y2)
    }
    ctx.stroke()
  }

  // ── Layer 3: Primary petals (chromatic color fields with bleed) ──
  const layers = model.shape_strategy?.petal_layers || 3
  const stopsMax = model.color_strategy?.gradient_stops_max || 8

  for (let layer = 0; layer < layers; layer++) {
    const layerScale = [1.1, 0.85, 0.55][layer] || 1
    const layerAlpha = [0.25, 0.55, 0.85][layer] || 0.5
    const layerW = [1.8, 1.2, 0.6][layer] || 1

    for (let i = 0; i < 12; i++) {
      const energy = chroma[i] / maxC
      if (energy < 0.05) continue
      const angle = (i / 12) * Math.PI * 2
      const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
      const sat = Math.min(100, baseSat * mood.satMod)
      const baseLight = 22 + energy * 32 + mood.lightMod * 22
      const beatB = (beatLum?.[i] ?? 0.5) * 12

      // Scale variation: dominant bins are DRAMATICALLY larger
      const scalePow = 1 + (energy - 0.5) * 1.5
      const petalR = R * (0.15 + energy * 0.75) * layerScale * Math.max(0.4, scalePow)
      const petalW = R * 0.28 * (0.3 + energy * 0.7) * layerW

      const nStops = Math.max(3, Math.round(depth * stopsMax))
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, petalR)

      for (let s = 0; s <= nStops; s++) {
        const t = s / nStops
        const hShift = (t - 0.5) * 12
        const localH = (baseH + hShift + 360) % 360
        const lt = Math.max(5, baseLight + beatB - t * 28)
        const al = Math.max(0, (layerAlpha - t * 0.5) * (0.3 + energy * 0.7))
        grad.addColorStop(Math.min(t, 0.999), hsl(localH, sat, lt, al))
      }
      grad.addColorStop(1, hsl(baseH, sat, 5, 0))

      ctx.save()
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.ellipse(0, -petalR * 0.3, petalW, petalR * 0.8, 0, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.globalCompositeOperation = 'source-over'

  // ── Layer 4: Inner nested circles (depth/complexity) ──
  const nCircles = Math.round(2 + harmonic * 4)
  for (let c = 0; c < nCircles; c++) {
    const t = (c + 1) / (nCircles + 1)
    const cr = R * t * 0.5
    const idx = (domIdx + c * 3) % 12
    const ch = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
    const csat = Math.min(100, baseSat * mood.satMod * 0.7)
    ctx.beginPath()
    ctx.arc(0, 0, cr, 0, Math.PI * 2)
    ctx.strokeStyle = hsl(ch, csat, 50 + mood.lightMod * 20, 0.08 + depth * 0.08)
    ctx.lineWidth = 0.8 + depth
    ctx.stroke()
  }

  // ── Layer 5: Organic outline with glow ──
  if (shape) {
    const rimH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
    ctx.beginPath()
    for (let i = 0; i <= shape.length; i++) {
      const pt = shape[i % shape.length]
      const x = Math.cos(pt.angle) * pt.r * R
      const y = Math.sin(pt.angle) * pt.r * R
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = hsl(rimH, 30, 70, rimI * 0.3)
    ctx.lineWidth = 1
    ctx.shadowColor = hsl(rimH, 50, 60, rimI * 0.5)
    ctx.shadowBlur = 20
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // ── Layer 6: Center bloom ──
  const bR = R * 0.12
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, bR)
  bg.addColorStop(0, hsl(glowH, 20, 95, 0.5))
  bg.addColorStop(0.3, hsl(glowH, 30, 60, 0.15))
  bg.addColorStop(1, hsl(glowH, 30, 30, 0))
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.arc(0, 0, bR, 0, Math.PI * 2); ctx.fill()

  ctx.restore()
}

// ── Bertin: Tufte-elegant analytical rendering ───────────────────────

export function renderBertin(ctx, w, h, chroma, model, mood, shape, beatLum) {
  const cx = w / 2, cy = h / 2
  const R = Math.min(w, h) * 0.42
  const maxC = Math.max(...chroma, 0.001)
  const domIdx = chroma.indexOf(Math.max(...chroma))
  const baseHue = (PITCH_HUES[domIdx] + mood.warmth * 20 + 360) % 360

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(cx, cy)

  // Subtle radial grid lines (Tufte: light structural ink)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  for (let r = 0.25; r <= 1; r += 0.25) {
    ctx.beginPath(); ctx.arc(0, 0, R * r, 0, Math.PI * 2); ctx.stroke()
  }

  // 12 spoke lines
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(angle) * R, Math.sin(angle) * R)
    ctx.stroke()
  }

  // Data marks: circles at the energy-proportional radius on each spoke
  // Size encodes magnitude, value (lightness) encodes magnitude, position on spoke encodes magnitude
  // Three of Bertin's seven variables encoding the same dimension = maximum perceptual clarity
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    const angle = (i / 12) * Math.PI * 2
    const dist = R * (0.1 + energy * 0.85)
    const px = Math.cos(angle) * dist
    const py = Math.sin(angle) * dist
    const markR = 3 + energy * 10
    const light = 25 + energy * 55
    const beatB = (beatLum?.[i] ?? 0.5) * 10
    const alpha = 0.5 + energy * 0.4

    // Filled circle
    ctx.beginPath(); ctx.arc(px, py, markR, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseHue, 25, light + beatB, alpha)
    ctx.fill()

    // Thin line from center to mark (data-ink connection)
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(px, py)
    ctx.strokeStyle = hsl(baseHue, 15, light, 0.15)
    ctx.lineWidth = 0.5 + energy
    ctx.stroke()
  }

  // Connect the marks with a polygon (the spectral shape)
  ctx.beginPath()
  for (let i = 0; i <= 12; i++) {
    const idx = i % 12
    const energy = chroma[idx] / maxC
    const angle = (idx / 12) * Math.PI * 2
    const dist = R * (0.1 + energy * 0.85)
    const px = Math.cos(angle) * dist
    const py = Math.sin(angle) * dist
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = hsl(baseHue, 20, 40, 0.06)
  ctx.fill()
  ctx.strokeStyle = hsl(baseHue, 20, 55, 0.3)
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

// ── Rothko: soft color fields ────────────────────────────────────────

export function renderRothko(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const emissive = num(opts.emissive, 0.3)
  const novelty = num(opts.novelty, 0.5)
  const baseSat = 25 + novelty * 40

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  // Find top 3 chroma bins
  const ranked = [...chroma.keys()].sort((a, b) => chroma[b] - chroma[a]).slice(0, 3)
  const pad = w * 0.08
  const blockH = (h - pad * 4) / 3
  const blockW = w - pad * 2

  for (let i = 0; i < 3; i++) {
    const idx = ranked[i]
    const energy = chroma[idx] / maxC
    const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const light = 20 + energy * 30 + mood.lightMod * 20
    const beatB = (beatLum?.[idx] ?? 0.5) * 8
    const y = pad * (i + 1) + blockH * i
    const edgeBlur = 20 + (1 - energy) * 30

    // Soft rectangular block with feathered edges
    const grad = ctx.createLinearGradient(pad, y, pad, y + blockH)
    grad.addColorStop(0, hsl(baseH, sat, light + beatB + 5, 0.15))
    grad.addColorStop(0.15, hsl(baseH, sat, light + beatB, 0.7 * energy))
    grad.addColorStop(0.5, hsl(baseH, sat, light + beatB, 0.8 * energy))
    grad.addColorStop(0.85, hsl(baseH, sat, light + beatB, 0.7 * energy))
    grad.addColorStop(1, hsl(baseH, sat, light + beatB + 5, 0.15))

    ctx.fillStyle = grad
    roundRect(ctx, pad, y, blockW, blockH, edgeBlur * 0.5)
    ctx.fill()

    // Side feathering
    const sideGrad = ctx.createLinearGradient(pad, y, pad + blockW, y)
    sideGrad.addColorStop(0, hsl(baseH, sat, light, 0))
    sideGrad.addColorStop(0.05, hsl(baseH, sat, light, 0.3))
    sideGrad.addColorStop(0.95, hsl(baseH, sat, light, 0.3))
    sideGrad.addColorStop(1, hsl(baseH, sat, light, 0))
    ctx.fillStyle = sideGrad
    roundRect(ctx, pad, y, blockW, blockH, edgeBlur * 0.5)
    ctx.fill()
  }

  // Atmospheric glow
  const glowH = (PITCH_HUES[ranked[0]] + mood.warmth * 40 + 360) % 360
  const gg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6)
  gg.addColorStop(0, hsl(glowH, 30, 25, emissive * 0.15))
  gg.addColorStop(1, 'hsla(0,0%,0%,0)')
  ctx.fillStyle = gg
  ctx.fillRect(0, 0, w, h)
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ── Klee: musical notation grid ──────────────────────────────────────

export function renderKlee(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const novelty = num(opts.novelty, 0.5)
  const baseSat = 35 + novelty * 45
  const cols = 12, rows = 8
  const cellW = (w - 40) / cols, cellH = (h - 40) / rows

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = 20 + c * cellW + cellW / 2
      const cy = 20 + r * cellH + cellH / 2
      const pitchIdx = c
      const energy = chroma[pitchIdx] / maxC
      const rowFactor = 1 - Math.abs(r - rows / 2) / (rows / 2)
      const intensity = energy * rowFactor
      if (intensity < 0.1) continue

      const baseH = (PITCH_HUES[pitchIdx] + mood.warmth * 40 + 360) % 360
      const sat = Math.min(100, baseSat * mood.satMod)
      const light = 25 + intensity * 40 + mood.lightMod * 15
      const beatB = (beatLum?.[pitchIdx] ?? 0.5) * 10
      const alpha = 0.3 + intensity * 0.6

      // Varied element types based on position
      const elType = (r + c) % 4
      ctx.fillStyle = hsl(baseH, sat, light + beatB, alpha)
      ctx.strokeStyle = hsl(baseH, sat, light + 15, alpha * 0.7)
      ctx.lineWidth = 1

      if (elType === 0) {
        // Circle
        const rad = 2 + intensity * Math.min(cellW, cellH) * 0.35
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill()
      } else if (elType === 1) {
        // Small rectangle
        const sz = 3 + intensity * Math.min(cellW, cellH) * 0.4
        ctx.fillRect(cx - sz / 2, cy - sz / 3, sz, sz * 0.6)
      } else if (elType === 2) {
        // Horizontal dash
        const dashW = 4 + intensity * cellW * 0.6
        ctx.beginPath(); ctx.moveTo(cx - dashW / 2, cy); ctx.lineTo(cx + dashW / 2, cy)
        ctx.lineWidth = 1 + intensity * 2; ctx.stroke()
      } else {
        // Triangle / diamond
        const sz = 3 + intensity * Math.min(cellW, cellH) * 0.3
        ctx.beginPath(); ctx.moveTo(cx, cy - sz); ctx.lineTo(cx + sz, cy); ctx.lineTo(cx, cy + sz); ctx.lineTo(cx - sz, cy); ctx.closePath(); ctx.fill()
      }
    }
  }
}

// ── Mondrian: primary colors + grid ──────────────────────────────────

export function renderMondrian(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const ranked = [...chroma.keys()].sort((a, b) => chroma[b] - chroma[a])
  const primaries = [
    { h: 5, s: 80, l: 50 },   // red
    { h: 220, s: 75, l: 45 },  // blue
    { h: 50, s: 85, l: 55 },   // yellow
  ]
  const gridLine = 3
  const pad = 12

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  // Generate grid divisions from chroma data
  const xSplits = [0, pad]
  const ySplits = [0, pad]
  const nSplits = 4
  for (let i = 1; i < nSplits; i++) {
    const energy = chroma[ranked[i]] / maxC
    xSplits.push(pad + (w - pad * 2) * (i / nSplits) + (energy - 0.5) * 40)
    ySplits.push(pad + (h - pad * 2) * (i / nSplits) + (energy - 0.5) * 30)
  }
  xSplits.push(w - pad); ySplits.push(h - pad)
  xSplits.sort((a, b) => a - b); ySplits.sort((a, b) => a - b)

  // Fill rectangles
  let cellIdx = 0
  for (let r = 0; r < ySplits.length - 1; r++) {
    for (let c = 0; c < xSplits.length - 1; c++) {
      const x = xSplits[c], y = ySplits[r]
      const rw = xSplits[c + 1] - x, rh = ySplits[r + 1] - y
      if (rw < 4 || rh < 4) continue

      const pitchIdx = ranked[cellIdx % 12]
      const energy = chroma[pitchIdx] / maxC
      const beatB = (beatLum?.[pitchIdx] ?? 0.5) * 8

      if (energy > 0.5) {
        const prim = primaries[cellIdx % 3]
        ctx.fillStyle = hsl(prim.h, prim.s, prim.l + beatB, 0.7 + energy * 0.3)
        ctx.fillRect(x + gridLine, y + gridLine, rw - gridLine * 2, rh - gridLine * 2)
      }
      cellIdx++
    }
  }

  // Black grid lines
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = gridLine
  for (const x of xSplits) { ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke() }
  for (const y of ySplits) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke() }
}

// ── Albers: nested concentric forms ──────────────────────────────────

export function renderAlbers(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const cx = w / 2, cy = h / 2
  const R = Math.min(w, h) * 0.42
  const maxC = Math.max(...chroma, 0.001)
  const novelty = num(opts.novelty, 0.5)
  const depth = num(opts.depth, 0.5)
  const baseSat = 30 + novelty * 50

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(cx, cy)

  // Sort bins by energy — outermost ring = weakest, inner = strongest
  const ranked = [...chroma.keys()].sort((a, b) => chroma[a] - chroma[b])
  const nRings = Math.min(7, Math.round(3 + depth * 4))

  for (let ring = 0; ring < nRings; ring++) {
    const idx = ranked[12 - 1 - ring] || ranked[0]
    const energy = chroma[idx] / maxC
    const t = (ring + 1) / (nRings + 1)
    const ringR = R * (1 - t * 0.85)
    const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const light = 20 + energy * 35 + mood.lightMod * 15
    const beatB = (beatLum?.[idx] ?? 0.5) * 8
    const alpha = 0.5 + energy * 0.4

    // Use squares for even rings, circles for odd (Albers alternation)
    if (ring % 2 === 0) {
      ctx.fillStyle = hsl(baseH, sat, light + beatB, alpha)
      ctx.fillRect(-ringR, -ringR, ringR * 2, ringR * 2)
    } else {
      ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2)
      ctx.fillStyle = hsl(baseH, sat, light + beatB, alpha)
      ctx.fill()
    }
  }

  ctx.restore()
}

// ── Tufte: sparkline radial, pure data ───────────────────────────────

export function renderTufte(ctx, w, h, chroma, model, mood, shape, beatLum) {
  const cx = w / 2, cy = h / 2
  const R = Math.min(w, h) * 0.40
  const maxC = Math.max(...chroma, 0.001)

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(cx, cy)

  const textColor = 'rgba(255,255,255,0.3)'

  // Data polygon — the only decoration allowed
  ctx.beginPath()
  for (let i = 0; i <= 12; i++) {
    const idx = i % 12
    const energy = chroma[idx] / maxC
    const angle = (idx / 12) * Math.PI * 2 - Math.PI / 2
    const dist = R * (0.05 + energy * 0.95)
    const px = Math.cos(angle) * dist, py = Math.sin(angle) * dist
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(192,132,252,0.06)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(192,132,252,0.4)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Data points — size encodes value (Bertin: size variable)
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
    const dist = R * (0.05 + energy * 0.95)
    const px = Math.cos(angle) * dist, py = Math.sin(angle) * dist
    const dotR = 1.5 + energy * 4
    const beatB = (beatLum?.[i] ?? 0.5) * 10

    ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(192,132,252,${0.4 + energy * 0.5 + beatB * 0.02})`
    ctx.fill()
  }

  // Minimal axis ticks
  ctx.strokeStyle = textColor
  ctx.lineWidth = 0.5
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
    const x1 = Math.cos(angle) * (R + 4), y1 = Math.sin(angle) * (R + 4)
    const x2 = Math.cos(angle) * (R + 10), y2 = Math.sin(angle) * (R + 10)
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }

  ctx.restore()
}

// ── Seeded PRNG (deterministic per song) ─────────────────────────────

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function chromaSeed(chroma) {
  return chroma.reduce((a, v, i) => a + Math.round(v * 1000) * (i + 1), 0) | 0
}

// ── Kandinsky: asymmetric composition (NOT centered radial) ──────────

export function renderKandinsky(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const rand = mulberry32(chromaSeed(chroma))
  const novelty = num(opts.novelty, 0.5)
  const depth = num(opts.depth, 0.5)
  const emissive = num(opts.emissive, 0.3)
  const rhythmic = num(opts.rhythmic, 0.3)
  const baseSat = 30 + novelty * 55

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  // Glow
  const domIdx = chroma.indexOf(Math.max(...chroma))
  const glowH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
  const gg = ctx.createRadialGradient(w * 0.4, h * 0.5, 0, w * 0.4, h * 0.5, Math.max(w, h) * 0.7)
  gg.addColorStop(0, hsl(glowH, 40, 25, emissive * 0.2))
  gg.addColorStop(1, 'hsla(0,0%,0%,0)')
  ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'screen'

  // Scattered circles (multiple focal points)
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.1) continue
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const cx = w * (0.15 + rand() * 0.7)
    const cy = h * (0.15 + rand() * 0.7)
    const r = Math.min(w, h) * energy * 0.18
    const beatB = (beatLum?.[i] ?? 0.5) * 10

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, hsl(baseH, sat, 40 + mood.lightMod * 20 + beatB, 0.5 * energy))
    g.addColorStop(0.7, hsl(baseH, sat * 0.8, 25, 0.2 * energy))
    g.addColorStop(1, hsl(baseH, sat, 10, 0))
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  }

  // Bold intersecting lines
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.15) continue
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const beatB = (beatLum?.[i] ?? 0.5)

    ctx.strokeStyle = hsl(baseH, sat, 45 + mood.lightMod * 20 + beatB * 15, 0.2 + energy * 0.3)
    ctx.lineWidth = 1 + energy * 4
    ctx.lineCap = 'round'

    const x1 = w * rand(), y1 = h * rand()
    const x2 = w * rand(), y2 = h * rand()

    ctx.beginPath()
    if (rhythmic > 0.4) {
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
    } else {
      const cpx = w * rand(), cpy = h * rand()
      ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpx, cpy, x2, y2)
    }
    ctx.stroke()
  }

  // Hard geometric shapes contrasting soft circles
  ctx.globalCompositeOperation = 'source-over'
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(rand() * 12)
    const energy = chroma[idx] / maxC
    if (energy < 0.2) continue
    const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod * 0.6)
    const cx = w * (0.1 + rand() * 0.8), cy = h * (0.1 + rand() * 0.8)
    const sz = Math.min(w, h) * energy * 0.08

    ctx.strokeStyle = hsl(baseH, sat, 50 + mood.lightMod * 15, 0.15 + energy * 0.15)
    ctx.lineWidth = 1
    if (rand() > 0.5) {
      ctx.beginPath(); ctx.moveTo(cx, cy - sz); ctx.lineTo(cx + sz, cy + sz); ctx.lineTo(cx - sz, cy + sz); ctx.closePath(); ctx.stroke()
    } else {
      ctx.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz)
    }
  }
}

// ── Pollock: drip/splatter ───────────────────────────────────────────

export function renderPollock(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const rand = mulberry32(chromaSeed(chroma))
  const novelty = num(opts.novelty, 0.5)
  const baseSat = 25 + novelty * 50
  const density = 80 + num(opts.rhythmic, 0.3) * 300

  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#080c18'; ctx.fillRect(0, 0, w, h)

  for (let d = 0; d < density; d++) {
    const idx = Math.floor(rand() * 12)
    const energy = chroma[idx] / maxC
    if (energy < 0.1 && rand() > 0.3) continue
    const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const light = 25 + energy * 40 + mood.lightMod * 15
    const beatB = (beatLum?.[idx] ?? 0.5)

    const x = w * rand(), y = h * rand()
    const type = rand()

    if (type < 0.4) {
      // Splatter dot
      const r = 1 + energy * 8 * rand()
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = hsl(baseH, sat, light + beatB * 8, 0.3 + energy * 0.5)
      ctx.fill()
    } else if (type < 0.7) {
      // Drip line
      const len = 10 + energy * 60 * rand()
      const angle = Math.PI / 2 + (rand() - 0.5) * 0.5
      ctx.beginPath(); ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
      ctx.strokeStyle = hsl(baseH, sat, light, 0.15 + energy * 0.3)
      ctx.lineWidth = 0.5 + energy * 2 * rand()
      ctx.stroke()
    } else {
      // Flung arc
      const cp1x = x + (rand() - 0.5) * 80, cp1y = y + (rand() - 0.5) * 80
      const x2 = x + (rand() - 0.5) * 120, y2 = y + (rand() - 0.5) * 120
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(cp1x, cp1y, x2, y2)
      ctx.strokeStyle = hsl(baseH, sat, light, 0.1 + energy * 0.2)
      ctx.lineWidth = 0.3 + energy * 1.5
      ctx.stroke()
    }
  }
}

// ── Riley: Op Art moiré ──────────────────────────────────────────────

export function renderRiley(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const novelty = num(opts.novelty, 0.5)
  const harmonic = num(opts.harmonic, 0.5)
  const baseSat = 30 + novelty * 50
  const tempo = num(opts.rhythmic, 0.3)
  const freq = 8 + tempo * 30

  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#080c18'; ctx.fillRect(0, 0, w, h)

  const domIdx = chroma.indexOf(Math.max(...chroma))
  const baseH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
  const sat = Math.min(100, baseSat * mood.satMod)

  // Horizontal wave lines
  for (let y = 0; y < h; y += 4) {
    const pitchIdx = Math.floor((y / h) * 12) % 12
    const energy = chroma[pitchIdx] / maxC
    const lH = (PITCH_HUES[pitchIdx] + mood.warmth * 40 + 360) % 360
    const amp = harmonic * 25 * energy
    const beatB = (beatLum?.[pitchIdx] ?? 0.5)

    ctx.beginPath()
    for (let x = 0; x <= w; x += 2) {
      const wave = Math.sin(x / w * freq + y * 0.02) * amp
      const py = y + wave
      x === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py)
    }
    ctx.strokeStyle = hsl(lH, sat, 30 + energy * 30 + beatB * 10 + mood.lightMod * 15, 0.15 + energy * 0.35)
    ctx.lineWidth = 1 + energy
    ctx.stroke()
  }
}

// ── Hilma af Klint: spiritual diagrams ───────────────────────────────

export function renderHilma(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const cx = w / 2, cy = h / 2
  const R = Math.min(w, h) * 0.42
  const maxC = Math.max(...chroma, 0.001)
  const novelty = num(opts.novelty, 0.5)
  const depth = num(opts.depth, 0.5)
  const baseSat = 25 + novelty * 45

  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#080c18'; ctx.fillRect(0, 0, w, h)
  ctx.save(); ctx.translate(cx, cy)

  // Concentric rings with petal divisions
  const nRings = 5 + Math.round(depth * 4)
  for (let ring = nRings - 1; ring >= 0; ring--) {
    const t = (ring + 1) / (nRings + 1)
    const r = R * t
    const idx = ring % 12
    const energy = chroma[idx] / maxC
    const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const light = 20 + energy * 30 + mood.lightMod * 20
    const beatB = (beatLum?.[idx] ?? 0.5) * 8

    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, sat, light + beatB, 0.15 + energy * 0.2)
    ctx.fill()
    ctx.strokeStyle = hsl(baseH, sat * 0.7, light + 15, 0.2)
    ctx.lineWidth = 0.8; ctx.stroke()
  }

  // Petal/sectional dividers
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const energy = chroma[i] / maxC
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    ctx.beginPath(); ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(angle) * R, Math.sin(angle) * R)
    ctx.strokeStyle = hsl(baseH, 20, 50, 0.1 + energy * 0.1)
    ctx.lineWidth = 0.5; ctx.stroke()
  }

  // Central flower
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.2) continue
    const angle = (i / 12) * Math.PI * 2
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const petalR = R * 0.25 * energy

    ctx.save(); ctx.rotate(angle)
    ctx.beginPath(); ctx.ellipse(0, -petalR * 0.6, petalR * 0.3, petalR * 0.7, 0, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, sat, 35 + mood.lightMod * 15, 0.2 + energy * 0.2)
    ctx.fill(); ctx.restore()
  }

  ctx.restore()
}

// ── Twombly: gestural scrawl ─────────────────────────────────────────

export function renderTwombly(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const rand = mulberry32(chromaSeed(chroma))
  const nMarks = 30 + Math.round(num(opts.rhythmic, 0.3) * 80)
  const baseSat = 15 + num(opts.novelty, 0.5) * 25

  ctx.clearRect(0, 0, w, h)
  // Muted warm ground
  const domIdx = chroma.indexOf(Math.max(...chroma))
  const groundH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
  ctx.fillStyle = hsl(groundH, 8, 10 + mood.lightMod * 5, 1)
  ctx.fillRect(0, 0, w, h)

  for (let m = 0; m < nMarks; m++) {
    const idx = Math.floor(rand() * 12)
    const energy = chroma[idx] / maxC
    const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const beatB = (beatLum?.[idx] ?? 0.5)

    const x = w * rand(), y = h * rand()
    const len = 20 + energy * 100 * rand()

    ctx.beginPath(); ctx.moveTo(x, y)
    // Scratchy loops
    for (let s = 0; s < 3 + Math.round(energy * 4); s++) {
      const nx = x + (rand() - 0.5) * len, ny = y + (rand() - 0.5) * len * 0.6
      const cpx = x + (rand() - 0.5) * len * 0.8, cpy = y + (rand() - 0.5) * len * 0.5
      ctx.quadraticCurveTo(cpx, cpy, nx, ny)
    }
    ctx.strokeStyle = hsl(baseH, sat, 35 + energy * 25 + beatB * 8 + mood.lightMod * 10, 0.1 + energy * 0.25)
    ctx.lineWidth = 0.5 + energy * 2
    ctx.lineCap = 'round'; ctx.stroke()
  }
}

// ── Agnes Martin: grid minimalism ────────────────────────────────────

export function renderMartin(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const harmonic = num(opts.harmonic, 0.5)
  const novelty = num(opts.novelty, 0.5)
  const gridSize = Math.max(8, 60 - Math.round(harmonic * 40))

  ctx.clearRect(0, 0, w, h)
  // Very subtle warm/cool ground
  const domIdx = chroma.indexOf(Math.max(...chroma))
  const groundH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
  ctx.fillStyle = hsl(groundH, 5 * mood.satMod, 6 + mood.lightMod * 3, 1)
  ctx.fillRect(0, 0, w, h)

  // Color wash — barely visible
  const washG = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.5)
  washG.addColorStop(0, hsl(groundH, 15, 15, novelty * 0.08))
  washG.addColorStop(1, 'hsla(0,0%,0%,0)')
  ctx.fillStyle = washG; ctx.fillRect(0, 0, w, h)

  // Grid lines — pencil thin
  ctx.strokeStyle = `rgba(255,255,255,0.04)`
  ctx.lineWidth = 0.5
  for (let x = gridSize; x < w; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = gridSize; y < h; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // At intersections: tiny dots for dominant chroma bins
  for (let x = gridSize; x < w; x += gridSize) {
    for (let y = gridSize; y < h; y += gridSize) {
      const idx = Math.floor(((x / w) * 12 + (y / h) * 3)) % 12
      const energy = chroma[idx] / maxC
      if (energy < 0.4) continue
      const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
      const beatB = (beatLum?.[idx] ?? 0.5)
      ctx.beginPath(); ctx.arc(x, y, 0.8 + energy, 0, Math.PI * 2)
      ctx.fillStyle = hsl(baseH, 20 * mood.satMod, 30 + energy * 20 + beatB * 5, 0.06 + energy * 0.06)
      ctx.fill()
    }
  }
}

// ── Calder: mobile balanced shapes ───────────────────────────────────

export function renderCalder(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const rand = mulberry32(chromaSeed(chroma))
  const baseSat = 35 + num(opts.novelty, 0.5) * 45

  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#080c18'; ctx.fillRect(0, 0, w, h)

  // Balanced asymmetric shapes
  const elements = []
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.1) continue
    elements.push({
      x: w * (0.15 + rand() * 0.7),
      y: h * (0.15 + rand() * 0.7),
      r: 8 + energy * Math.min(w, h) * 0.08,
      hue: (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360,
      energy, idx: i,
    })
  }

  // Wire lines connecting elements
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  for (let i = 1; i < elements.length; i++) {
    const a = elements[i - 1], b = elements[i]
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }

  // Shapes
  for (const el of elements) {
    const sat = Math.min(100, baseSat * mood.satMod)
    const light = 30 + el.energy * 30 + mood.lightMod * 15
    const beatB = (beatLum?.[el.idx] ?? 0.5) * 8
    ctx.fillStyle = hsl(el.hue, sat, light + beatB, 0.5 + el.energy * 0.4)

    if (rand() > 0.5) {
      ctx.beginPath(); ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillRect(el.x - el.r, el.y - el.r * 0.6, el.r * 2, el.r * 1.2)
    }
  }
}

// ── Sol LeWitt: algorithmic wall drawings ─────────────────────────────

export function renderLewitt(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const baseSat = 20 + num(opts.novelty, 0.5) * 30

  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h)

  const pad = 20

  // Instruction 1: arcs from each corner (P1 zeitgeist)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5
  const nArcs = Math.round(3 + num(opts.depth, 0.5) * 8)
  for (let i = 1; i <= nArcs; i++) {
    const r = (Math.min(w, h) / nArcs) * i
    ;[[0,0],[w,0],[0,h],[w,h]].forEach(([ox, oy]) => {
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.stroke()
    })
  }

  // Instruction 2: lines from each chroma bin (P3)
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.15) continue
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const beatB = (beatLum?.[i] ?? 0.5)

    const angle = (i / 12) * Math.PI * 2
    const x1 = w / 2 + Math.cos(angle) * pad
    const y1 = h / 2 + Math.sin(angle) * pad
    const x2 = w / 2 + Math.cos(angle) * Math.min(w, h) * 0.45
    const y2 = h / 2 + Math.sin(angle) * Math.min(w, h) * 0.45

    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
    ctx.strokeStyle = hsl(baseH, sat, 40 + beatB * 10 + mood.lightMod * 15, 0.15 + energy * 0.3)
    ctx.lineWidth = 1 + energy * 2; ctx.stroke()

    // Mark at endpoint
    ctx.beginPath(); ctx.arc(x2, y2, 2 + energy * 4, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, sat, 50, 0.2 + energy * 0.3); ctx.fill()
  }
}

// ── Basquiat: raw dense layered ──────────────────────────────────────

export function renderBasquiat(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const rand = mulberry32(chromaSeed(chroma))
  const novelty = num(opts.novelty, 0.5)
  const baseSat = 40 + novelty * 40

  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0a0808'; ctx.fillRect(0, 0, w, h)

  // Dense grid underlay
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5
  for (let x = 0; x < w; x += 30 + rand() * 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y < h; y += 25 + rand() * 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // Aggressive marks
  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    if (energy < 0.1) continue
    const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const beatB = (beatLum?.[i] ?? 0.5)

    for (let m = 0; m < Math.round(energy * 6); m++) {
      const x = w * rand(), y = h * rand()
      const sz = 5 + energy * 25 * rand()

      ctx.fillStyle = hsl(baseH, sat, 35 + energy * 25 + beatB * 8, 0.3 + energy * 0.4)
      ctx.fillRect(x - sz / 2, y - sz / 3, sz, sz * 0.6)

      // Crown motif for dominant bins
      if (energy > 0.7 && rand() > 0.6) {
        const crSz = sz * 0.5
        ctx.strokeStyle = hsl(50, 80, 60, 0.4)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x - crSz, y - sz)
        ctx.lineTo(x - crSz * 0.5, y - sz - crSz)
        ctx.lineTo(x, y - sz)
        ctx.lineTo(x + crSz * 0.5, y - sz - crSz)
        ctx.lineTo(x + crSz, y - sz)
        ctx.stroke()
      }
    }
  }
}

// ── Monet: impressionist brushstrokes ─────────────────────────────────

export function renderMonet(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const rand = mulberry32(chromaSeed(chroma))
  const novelty = num(opts.novelty, 0.5)
  const baseSat = 25 + novelty * 40
  const nStrokes = 400 + Math.round(num(opts.harmonic, 0.5) * 600)

  ctx.clearRect(0, 0, w, h)
  // Atmospheric ground
  const domIdx = chroma.indexOf(Math.max(...chroma))
  const groundH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
  ctx.fillStyle = hsl(groundH, 10 * mood.satMod, 8 + mood.lightMod * 5, 1)
  ctx.fillRect(0, 0, w, h)

  // Tiny dappled brushstrokes
  for (let s = 0; s < nStrokes; s++) {
    const idx = Math.floor(rand() * 12)
    const energy = chroma[idx] / maxC
    const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + (rand() - 0.5) * 15 + 360) % 360
    const sat = Math.min(100, baseSat * mood.satMod)
    const light = 20 + energy * 35 + mood.lightMod * 15
    const beatB = (beatLum?.[idx] ?? 0.5)

    const x = w * rand(), y = h * rand()
    const sw = 3 + energy * 8 * rand()
    const sh = 2 + energy * 4 * rand()
    const angle = (rand() - 0.5) * 0.8

    ctx.save()
    ctx.translate(x, y); ctx.rotate(angle)
    ctx.fillStyle = hsl(baseH, sat, light + beatB * 6, 0.08 + energy * 0.15)
    ctx.beginPath(); ctx.ellipse(0, 0, sw, sh, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
}

// ── Frankenthaler: color field soak-stain ─────────────────────────────

export function renderFrankenthaler(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const maxC = Math.max(...chroma, 0.001)
  const rand = mulberry32(chromaSeed(chroma))
  const novelty = num(opts.novelty, 0.5)
  const baseSat = 30 + novelty * 45

  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#080c18'; ctx.fillRect(0, 0, w, h)

  // Rank chroma bins by energy
  const ranked = [...chroma.keys()].sort((a, b) => chroma[b] - chroma[a])

  // Large organic color regions that bleed into each other
  for (let pass = 0; pass < 3; pass++) {
    ctx.globalCompositeOperation = pass === 0 ? 'source-over' : 'screen'

    for (let r = 0; r < Math.min(8, ranked.length); r++) {
      const idx = ranked[r]
      const energy = chroma[idx] / maxC
      if (energy < 0.1) continue
      const baseH = (PITCH_HUES[idx] + mood.warmth * 40 + 360) % 360
      const sat = Math.min(100, baseSat * mood.satMod)
      const light = 18 + energy * 28 + mood.lightMod * 18
      const beatB = (beatLum?.[idx] ?? 0.5) * 6

      // Position biased by rank (dominant = more central territory)
      const cx = w * (0.2 + rand() * 0.6)
      const cy = h * (0.2 + rand() * 0.6)
      const rx = w * (0.15 + energy * 0.25) * (0.7 + rand() * 0.6)
      const ry = h * (0.12 + energy * 0.22) * (0.7 + rand() * 0.6)

      // Organic blob via multi-stop radial gradient
      const g = ctx.createRadialGradient(cx, cy, 0, cx + (rand() - 0.5) * 20, cy + (rand() - 0.5) * 20, Math.max(rx, ry))
      const alpha = (pass === 0 ? 0.25 : 0.12) * (0.5 + energy * 0.5)
      g.addColorStop(0, hsl(baseH, sat, light + beatB + 10, alpha))
      g.addColorStop(0.4, hsl(baseH, sat * 0.9, light + beatB, alpha * 0.8))
      g.addColorStop(0.7, hsl((baseH + 8) % 360, sat * 0.7, light - 5, alpha * 0.4))
      g.addColorStop(1, hsl(baseH, sat, light - 10, 0))

      ctx.fillStyle = g
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

export function getSectorAtPoint(mx, my, cx, cy, maxR) {
  const dx = mx - cx, dy = my - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > maxR * 1.3 || dist < 5) return null
  let angle = Math.atan2(dy, dx)
  if (angle < 0) angle += Math.PI * 2
  return Math.floor((angle / (Math.PI * 2)) * 12) % 12
}

export function findNearestBeat(beatTimes, t) {
  if (!beatTimes || beatTimes.length === 0) return 0
  let lo = 0, hi = beatTimes.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (beatTimes[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}
