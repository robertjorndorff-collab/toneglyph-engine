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

export function renderChromatic(ctx, w, h, chroma, model, mood, shape, beatLum, opts = {}) {
  const cx = w / 2, cy = h / 2
  const maxR = Math.min(w, h) * (model.shape_strategy?.base_radius || 0.42)
  const maxC = Math.max(...chroma, 0.001)
  const novelty = num(opts.novelty, 0.5)
  const depth = num(opts.depth, 0.5)
  const emissive = num(opts.emissive, 0.3)
  const rimI = num(opts.rim, 0.5)
  const layers = model.shape_strategy?.petal_layers || 3
  const stopsMax = model.color_strategy?.gradient_stops_max || 8

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  // Glow backdrop
  if (model.lighting_strategy?.glow_backdrop !== false) {
    const glowR = maxR * (model.lighting_strategy?.glow_radius_factor || 1.6)
    const domIdx = chroma.indexOf(Math.max(...chroma))
    const glowH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
    g.addColorStop(0, `hsla(${glowH}, 40%, 30%, ${emissive * 0.25})`)
    g.addColorStop(0.5, `hsla(${glowH}, 25%, 18%, ${emissive * 0.1})`)
    g.addColorStop(1, 'hsla(0,0%,0%,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }

  ctx.save()
  ctx.translate(cx, cy)

  const baseSat = 30 + novelty * 55

  for (let layer = 0; layer < layers; layer++) {
    const layerScale = 1 - layer * 0.18
    const layerAlpha = layer === 0 ? 0.35 : layer === 1 ? 0.7 : 0.9
    const layerWidthMod = layer === 0 ? 1.5 : layer === 1 ? 1.0 : 0.6
    ctx.globalCompositeOperation = model.color_strategy?.blend_mode || 'screen'

    for (let i = 0; i < 12; i++) {
      const energy = chroma[i] / maxC
      if (energy < 0.05) continue

      const angle = (i / 12) * Math.PI * 2
      const baseH = (PITCH_HUES[i] + mood.warmth * 40 + 360) % 360
      const sat = Math.min(100, baseSat * mood.satMod)
      const baseLight = 22 + energy * 32 + mood.lightMod * 22
      const beatB = (beatLum?.[i] ?? 0.5) * 12

      const petalR = maxR * (0.20 + energy * 0.80) * layerScale
      const petalW = maxR * 0.30 * (0.4 + energy * 0.6) * layerWidthMod
      const nStops = Math.max(3, Math.round(depth * stopsMax))
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, petalR)

      for (let s = 0; s <= nStops; s++) {
        const t = s / nStops
        const hShift = (t - 0.5) * 8
        const localH = (baseH + hShift + 360) % 360
        const lt = Math.max(5, baseLight + beatB - t * 25)
        const al = Math.max(0, (layerAlpha - t * 0.55) * (0.4 + energy * 0.6))
        grad.addColorStop(Math.min(t, 0.999), `hsla(${localH},${sat}%,${lt}%,${al})`)
      }
      grad.addColorStop(1, `hsla(${baseH},${sat}%,5%,0)`)

      ctx.save()
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.ellipse(0, -petalR * 0.35, petalW, petalR * 0.85, 0, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.globalCompositeOperation = 'source-over'

  // Organic outline
  if (model.lighting_strategy?.rim_outline !== false && shape) {
    const domIdx = chroma.indexOf(Math.max(...chroma))
    const rimH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
    ctx.beginPath()
    for (let i = 0; i <= shape.length; i++) {
      const pt = shape[i % shape.length]
      const x = Math.cos(pt.angle) * pt.r * maxR
      const y = Math.sin(pt.angle) * pt.r * maxR
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = `hsla(${rimH},30%,70%,${rimI * 0.35})`
    ctx.lineWidth = 1.2
    ctx.shadowColor = `hsla(${rimH},50%,60%,${rimI * 0.5})`
    ctx.shadowBlur = 15
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Center bloom
  if (model.lighting_strategy?.center_bloom !== false) {
    const domIdx = chroma.indexOf(Math.max(...chroma))
    const bH = (PITCH_HUES[domIdx] + mood.warmth * 40 + 360) % 360
    const bR = maxR * 0.15
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, bR)
    bg.addColorStop(0, `hsla(${bH},20%,90%,0.5)`)
    bg.addColorStop(0.4, `hsla(${bH},30%,55%,0.15)`)
    bg.addColorStop(1, `hsla(${bH},30%,30%,0)`)
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc(0, 0, bR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export function renderBertin(ctx, w, h, chroma, model, shape, beatLum) {
  const cx = w / 2, cy = h / 2
  const maxR = Math.min(w, h) * (model.shape_strategy?.base_radius || 0.38)
  const maxC = Math.max(...chroma, 0.001)
  const domIdx = chroma.indexOf(Math.max(...chroma))
  const baseHue = PITCH_HUES[domIdx]

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(cx, cy)

  for (let i = 0; i < 12; i++) {
    const energy = chroma[i] / maxC
    const angle0 = (i / 12) * Math.PI * 2 - Math.PI / 12
    const angle1 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 12
    const r = maxR * (0.15 + energy * 0.85)
    const light = 20 + energy * 50 + ((beatLum?.[i] ?? 0.5) * 10)

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r, angle0, angle1)
    ctx.closePath()
    ctx.fillStyle = `hsla(${baseHue},30%,${light}%,${0.4 + energy * 0.5})`
    ctx.fill()
    ctx.strokeStyle = `hsla(${baseHue},20%,60%,0.3)`
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  if (model.lighting_strategy?.rim_outline !== false && shape) {
    ctx.beginPath()
    for (let i = 0; i <= shape.length; i++) {
      const pt = shape[i % shape.length]
      const x = Math.cos(pt.angle) * pt.r * maxR
      const y = Math.sin(pt.angle) * pt.r * maxR
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = `hsla(${baseHue},20%,60%,0.4)`
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  ctx.restore()
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
