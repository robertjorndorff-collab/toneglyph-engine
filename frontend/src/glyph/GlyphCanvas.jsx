import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { PITCH_NAMES, PITCH_HUES, num, arr, resolveBindings } from '../shared/constants.js'
import { renderChromatic, renderBertin, computeShape, getMood, getSectorAtPoint, findNearestBeat } from './glyphRenderer.js'

const modelFiles = import.meta.glob('../models/*.json', { eager: true })
const bindingFiles = import.meta.glob('../bindings/*.json', { eager: true })

export const MODELS = Object.fromEntries(
  Object.entries(modelFiles).map(([, mod]) => { const d = mod.default || mod; return [d.name, d] })
)
export const BINDINGS = Object.fromEntries(
  Object.entries(bindingFiles).map(([, mod]) => { const d = mod.default || mod; return [d.name, d] })
)

export default function GlyphCanvas({ result, modelName, bindingName, glyphMode, overrides, audioRef }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const model = MODELS[modelName] || MODELS['Chromatic'] || Object.values(MODELS)[0]
  const binding = BINDINGS[bindingName] || BINDINGS['Default'] || Object.values(BINDINGS)[0]

  const baseRv = useMemo(() => resolveBindings(binding, result), [binding, result])
  const rv = useMemo(() => overrides ? { ...baseRv, ...overrides } : baseRv, [baseRv, overrides])

  const chroma = arr(rv['color.sector_hues']).map(v => num(v))
  const mfcc = arr(rv['shape.mfcc']).map(v => num(v))
  const complexity = num(rv['shape.complexity'], 0.5)
  const symmetry = num(rv['shape.symmetry'], 0.5)

  const mood = useMemo(
    () => model.color_strategy?.mood_tinting !== false
      ? getMood(rv['color.palette_warmth'], rv['color.mood_era'])
      : { warmth: 0, satMod: 1, lightMod: 0 },
    [model, rv['color.palette_warmth'], rv['color.mood_era']]
  )

  const pantoneId = result?.cas?.pantone_id || 'export'

  const exportPng = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `toneglyph-${pantoneId}.png`
    a.click()
  }, [pantoneId])

  const exportJson = useCallback(() => {
    if (!result?.cas) return
    const blob = new Blob([JSON.stringify(result.cas, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `toneglyph-${pantoneId}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [result, pantoneId])

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas || chroma.length !== 12) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const cx = rect.width / 2, cy = rect.height / 2
    const maxR = Math.min(rect.width, rect.height) * (model.shape_strategy?.base_radius || 0.42)
    const sector = getSectorAtPoint(mx, my, cx, cy, maxR)
    if (sector !== null) {
      const maxC = Math.max(...chroma, 0.001)
      const hue = (PITCH_HUES[sector] + mood.warmth * 40 + 360) % 360
      setTooltip({
        x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 30,
        text: `${PITCH_NAMES[sector]} — energy ${(chroma[sector] / maxC * 100).toFixed(0)}% — hue ${hue.toFixed(0)}° — Pillar 3`,
      })
    } else {
      setTooltip(null)
    }
  }, [chroma, mood, model])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || chroma.length !== 12) return

    const dpr = Math.min(window.devicePixelRatio, 2)
    const resize = () => {
      const parent = canvas.parentElement
      const cssW = parent.clientWidth
      const cssH = parent.clientHeight || Math.min(cssW, 560)
      canvas.width = cssW * dpr; canvas.height = cssH * dpr
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'
      return { cssW, cssH }
    }
    let { cssW, cssH } = resize()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const organic = model.shape_strategy?.organic_distortion !== false
    const nPts = model.shape_strategy?.vertex_count || 720
    const shape = computeShape(chroma, mfcc, complexity, symmetry, nPts, organic)

    const chromaBS = arr(result?.pillar3?.chroma?.beat_sync)
    const beatTimes = arr(result?.pillar3?.beats?.times)
    const lumArr = arr(rv['beat_sync.luminance']).filter(v => Number.isFinite(v))
    const beatCount = lumArr.length || 1
    const tempo = num(rv['beat_sync.tempo'], 120)
    const beatInterval = Math.max(0.05, 60 / tempo)

    const isChromatic = model.color_strategy?.type !== 'single_hue_value'
    const doRotate = model.animation_strategy?.rotation !== false && glyphMode !== 'static'
    const doPulse = model.animation_strategy?.pulse !== false && glyphMode !== 'static'
    const spinFactor = model.animation_strategy?.rotation_speed_factor || 0.15
    const pulseFactor = model.animation_strategy?.pulse_factor || 0.06

    const opts = {
      novelty: num(rv['color.saturation'], 0.5),
      depth: num(rv['color.gradient_depth'], 0.5),
      emissive: num(rv['lighting.glow'], 0.3),
      rim: num(rv['lighting.rim'], 0.5),
      rhythmic: num(result?.pillar3?.rhythmic_complexity, 0.3),
      harmonic: num(result?.pillar3?.harmonic_complexity, 0.5),
    }

    const startTime = performance.now()

    function getActiveChroma(t) {
      if (glyphMode === 'static') return chroma

      if (glyphMode === 'temporal' && audioRef?.current && !audioRef.current.paused) {
        const ct = audioRef.current.currentTime
        const bi = findNearestBeat(beatTimes, ct)
        const vec = chromaBS[bi]
        if (Array.isArray(vec) && vec.length === 12) return vec
      }

      // animated: cycle through beat_sync at tempo
      if (chromaBS.length > 0) {
        const bi = Math.floor((t / beatInterval) % chromaBS.length)
        const vec = chromaBS[bi]
        if (Array.isArray(vec) && vec.length === 12) return vec
      }
      return chroma
    }

    function getBeatLum(activeChroma) {
      const mx = Math.max(...activeChroma, 0.001)
      return activeChroma.map(v => num(v) / mx)
    }

    function frame() {
      const t = (performance.now() - startTime) / 1000
      const rotation = doRotate ? t * num(rv['motion.spin'], 0.3) * spinFactor : 0
      const pulse = doPulse ? 1 + Math.sin(t * 3) * num(rv['motion.pulse'], 0.2) * pulseFactor : 1

      const activeChroma = getActiveChroma(t)
      const beatLum = getBeatLum(activeChroma)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.save()
      ctx.translate(cssW / 2, cssH / 2)
      ctx.rotate(rotation)
      ctx.scale(pulse, pulse)
      ctx.translate(-cssW / 2, -cssH / 2)

      if (isChromatic) renderChromatic(ctx, cssW, cssH, activeChroma, model, mood, shape, beatLum, opts)
      else renderBertin(ctx, cssW, cssH, activeChroma, model, shape, beatLum)

      ctx.restore()

      if (glyphMode === 'static') return
      animRef.current = requestAnimationFrame(frame)
    }

    if (glyphMode === 'static') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (isChromatic) renderChromatic(ctx, cssW, cssH, chroma, model, mood, shape, getBeatLum(chroma), opts)
      else renderBertin(ctx, cssW, cssH, chroma, model, shape, getBeatLum(chroma))
    } else {
      animRef.current = requestAnimationFrame(frame)
    }

    const ro = new ResizeObserver(() => {
      const s = resize()
      cssW = s.cssW; cssH = s.cssH
      if (glyphMode === 'static') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        if (isChromatic) renderChromatic(ctx, cssW, cssH, chroma, model, mood, shape, getBeatLum(chroma), opts)
        else renderBertin(ctx, cssW, cssH, chroma, model, shape, getBeatLum(chroma))
      }
    })
    ro.observe(canvas.parentElement)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [result?.cas?.composite_hash, modelName, bindingName, glyphMode, JSON.stringify(overrides)])

  if (chroma.length !== 12) return null

  return (
    <div className="glyph-wrap">
      <div className="glyph-canvas" style={{ position: 'relative' }}>
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} />
        {tooltip && <div className="glyph-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>}
      </div>
    </div>
  )
}
