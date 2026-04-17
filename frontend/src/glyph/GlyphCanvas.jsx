import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { PITCH_NAMES, PITCH_HUES, num, arr, resolveBindings } from '../shared/constants.js'
import { getBgColor, renderChromatic, renderBertin, renderRothko, renderKlee, renderMondrian, renderAlbers, renderTufte, renderKandinsky, renderPollock, renderRiley, renderHilma, renderTwombly, renderMartin, renderCalder, renderLewitt, renderBasquiat, renderMonet, renderFrankenthaler, computeShape, getMood, getSectorAtPoint, findNearestBeat } from './glyphRenderer.js'

const RENDERERS = {
  chromatic: renderChromatic,
  bertin: renderBertin,
  rothko: renderRothko,
  klee: renderKlee,
  mondrian: renderMondrian,
  albers: renderAlbers,
  tufte: renderTufte,
  kandinsky: renderKandinsky,
  pollock: renderPollock,
  riley: renderRiley,
  hilma: renderHilma,
  twombly: renderTwombly,
  martin: renderMartin,
  calder: renderCalder,
  lewitt: renderLewitt,
  basquiat: renderBasquiat,
  monet: renderMonet,
  frankenthaler: renderFrankenthaler,
}

const modelFiles = import.meta.glob('../models/*.json', { eager: true })
const bindingFiles = import.meta.glob('../bindings/*.json', { eager: true })

export const MODELS = Object.fromEntries(
  Object.entries(modelFiles).map(([, mod]) => { const d = mod.default || mod; return [d.name, d] })
)
export const BINDINGS = Object.fromEntries(
  Object.entries(bindingFiles).map(([, mod]) => { const d = mod.default || mod; return [d.name, d] })
)

export default function GlyphCanvas({ result, modelName, layers, bindingName, glyphMode, overrides, audioRef, zoom: zoomProp, panX: panXProp, panY: panYProp, onZoomChange }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const staticRenderRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const layersRef = useRef(null)
  const zoomRef = useRef({ zoom: zoomProp || 1, panX: panXProp || 0, panY: panYProp || 0, dragging: false, dragStart: null })

  const activeLayers = useMemo(() => {
    if (layers && layers.length > 0) return layers.filter(l => l.visible !== false)
    const name = modelName || 'Chromatic'
    return [{ id: '_default', modelName: name, opacity: 1, visible: true }]
  }, [layers, modelName])

  // Keep a live ref so the animation loop always reads current layers
  layersRef.current = activeLayers

  const primaryModel = MODELS[activeLayers[0]?.modelName] || MODELS['Frankenthaler'] || MODELS['Chromatic'] || Object.values(MODELS)[0]
  const model = primaryModel
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

  // Keep zoom ref in sync with props
  zoomRef.current.zoom = zoomProp || 1
  zoomRef.current.panX = panXProp || 0
  zoomRef.current.panY = panYProp || 0

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const z = zoomRef.current
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.25, Math.min(4, z.zoom * delta))
    if (onZoomChange) onZoomChange({ zoom: newZoom, panX: z.panX, panY: z.panY })
  }, [onZoomChange])

  const handlePanStart = useCallback((e) => {
    if (zoomRef.current.zoom <= 1.05) return
    zoomRef.current.dragging = true
    zoomRef.current.dragStart = { x: e.clientX, y: e.clientY, px: zoomRef.current.panX, py: zoomRef.current.panY }
  }, [])

  const handlePanMove = useCallback((e) => {
    const z = zoomRef.current
    if (!z.dragging || !z.dragStart) return
    const dx = e.clientX - z.dragStart.x
    const dy = e.clientY - z.dragStart.y
    if (onZoomChange) onZoomChange({ zoom: z.zoom, panX: z.dragStart.px + dx, panY: z.dragStart.py + dy })
  }, [onZoomChange])

  const handlePanEnd = useCallback(() => {
    zoomRef.current.dragging = false
    zoomRef.current.dragStart = null
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    console.debug('[GlyphCanvas]', {
      chromaLen: chroma.length,
      rvSectorHues: rv['color.sector_hues'],
      modelName: activeLayers[0]?.modelName,
      renderer: model?.renderer,
      layerCount: activeLayers.length,
      hasCanvas: !!canvas,
      parentH: canvas?.parentElement?.clientHeight,
    })
    if (!canvas || chroma.length !== 12) return

    const dpr = Math.min(window.devicePixelRatio, 2)
    const sizeRef = { w: 0, h: 0 }
    const resize = () => {
      const parent = canvas.parentElement
      sizeRef.w = parent.clientWidth || 400
      sizeRef.h = parent.clientHeight || Math.min(sizeRef.w, 400)
      canvas.width = sizeRef.w * dpr; canvas.height = sizeRef.h * dpr
      canvas.style.width = sizeRef.w + 'px'; canvas.style.height = sizeRef.h + 'px'
    }
    resize()
    let cssW = sizeRef.w, cssH = sizeRef.h
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

    const bpm = num(rv['beat_sync.tempo'], 120)
    const beatPeriod = 60 / Math.max(bpm, 30)
    const BEATS_PER_ROTATION = 32
    const rotationSpeed = (2 * Math.PI) / (BEATS_PER_ROTATION * beatPeriod)
    const isStatic = glyphMode === 'static'
    const doRotate = primaryModel.animation_strategy?.rotation !== false && !isStatic
    const doPulse = primaryModel.animation_strategy?.pulse !== false && !isStatic
    const pulseAmp = num(rv['motion.pulse'], 0.2) * (primaryModel.animation_strategy?.pulse_factor || 0.06)
    const spinMul = num(rv['motion.spin'], 1.0)

    const opts = {
      novelty: num(rv['color.saturation'], 0.5),
      depth: num(rv['color.gradient_depth'], 0.5),
      emissive: num(rv['lighting.glow'], 0.3),
      rim: num(rv['lighting.rim'], 0.5),
      rhythmic: num(result?.pillar3?.rhythmic_complexity, 0.3),
      harmonic: num(result?.pillar3?.harmonic_complexity, 0.5),
      seed: result?.cas?.pantone_id || result?.cas?.file_hash || 'default',  // RC#2: stable seed
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
      if (chromaBS.length > 0) {
        const bi = Math.floor((t / beatInterval) % chromaBS.length)
        const vec = chromaBS[bi]
        if (Array.isArray(vec) && vec.length === 12) return vec
      }
      return chroma
    }

    function getBeatLum(ac) { const mx = Math.max(...ac, 0.001); return ac.map(v => num(v) / mx) }

    // Oversized offscreen canvas — shapes extend beyond viewport edges
    const OVERSCAN = 1.5
    const offW = Math.round(cssW * OVERSCAN)
    const offH = Math.round(cssH * OVERSCAN)
    const offsetX = (offW - cssW) / 2
    const offsetY = (offH - cssH) / 2
    const offscreen = document.createElement('canvas')
    offscreen.width = offW; offscreen.height = offH
    const offCtx = offscreen.getContext('2d')

    function renderAllLayers(activeChroma, beatLum, rotation, pulse) {
      const curLayers = layersRef.current || activeLayers

      // Background on main canvas — always fills viewport, pre-transform
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)
      ctx.fillStyle = getBgColor()
      ctx.fillRect(0, 0, cssW, cssH)

      // Apply zoom + pan + rotation + pulse
      const z = zoomRef.current
      ctx.save()
      ctx.translate(cssW / 2 + z.panX, cssH / 2 + z.panY)
      ctx.scale(z.zoom, z.zoom)
      ctx.rotate(rotation); ctx.scale(pulse, pulse)
      ctx.translate(-cssW / 2, -cssH / 2)

      for (let li = 0; li < curLayers.length; li++) {
        const layer = curLayers[li]
        const lModel = MODELS[layer.modelName] || MODELS['Frankenthaler'] || MODELS['Chromatic']
        const lRenderFn = RENDERERS[lModel?.renderer] || renderChromatic
        const lShape = computeShape(chroma, mfcc, complexity, symmetry,
          lModel?.shape_strategy?.vertex_count || 720,
          lModel?.shape_strategy?.organic_distortion !== false)

        // Render layer to oversized offscreen (no background — just shapes)
        offCtx.clearRect(0, 0, offW, offH)
        lRenderFn(offCtx, offW, offH, activeChroma, lModel, mood, lShape, beatLum, opts)

        // Composite: first layer with source-over, additional layers with screen
        ctx.globalAlpha = num(layer.opacity, 1)
        ctx.globalCompositeOperation = li === 0 ? 'source-over' : 'screen'
        ctx.drawImage(offscreen, -offsetX, -offsetY)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()
    }

    let lastFrameTime = performance.now()
    let smoothPulse = 1, smoothRotation = 0
    let elapsed = 0  // RC#5: accumulate clamped dt, not wall-clock
    const smoothedChroma = [...chroma]  // RC#3: smoothed chroma array
    const smoothedBeatLum = getBeatLum(chroma).slice()

    function frame() {
      cssW = sizeRef.w; cssH = sizeRef.h
      if (offscreen.width !== cssW || offscreen.height !== cssH) {
        offscreen.width = Math.round(cssW * OVERSCAN); offscreen.height = Math.round(cssH * OVERSCAN)
      }

      const now = performance.now()
      const dt = Math.min(0.1, (now - lastFrameTime) / 1000)
      lastFrameTime = now
      elapsed += dt  // RC#5: no wall-clock jump on tab return

      // RC#1: raised-cosine envelope (no sawtooth discontinuity)
      const phase = (elapsed % beatPeriod) / beatPeriod
      const attackRatio = 0.15
      let envelope
      if (phase < attackRatio) {
        envelope = phase / attackRatio
      } else {
        const decayPhase = (phase - attackRatio) / (1 - attackRatio)
        envelope = 0.5 * (1 + Math.cos(decayPhase * Math.PI))
      }
      const targetPulse = doPulse ? 1 + envelope * pulseAmp : 1

      const targetRotation = doRotate ? elapsed * rotationSpeed * spinMul : 0

      // Smoothing alphas (frame-rate independent)
      const alphaPulse = 1 - Math.exp(-dt / 0.12)
      const alphaChroma = 1 - Math.exp(-dt / 0.25)  // RC#3: longer tau for color

      smoothPulse += (targetPulse - smoothPulse) * alphaPulse
      smoothRotation += (targetRotation - smoothRotation) * alphaPulse  // RC#4: lerp rotation too

      // RC#3: smooth chroma and beatLum toward per-beat targets
      const targetChroma = getActiveChroma(elapsed)
      const targetLum = getBeatLum(targetChroma)
      for (let i = 0; i < 12; i++) {
        smoothedChroma[i] += (targetChroma[i] - smoothedChroma[i]) * alphaChroma
        smoothedBeatLum[i] += (targetLum[i] - smoothedBeatLum[i]) * alphaChroma
      }

      renderAllLayers(smoothedChroma, smoothedBeatLum, smoothRotation, smoothPulse)
      if (isStatic) return
      animRef.current = requestAnimationFrame(frame)
    }

    staticRenderRef.current = () => renderAllLayers(chroma, getBeatLum(chroma), 0, 1)

    if (glyphMode === 'static') {
      staticRenderRef.current()
    } else {
      animRef.current = requestAnimationFrame(frame)
    }

    // Wheel zoom listener (passive: false to allow preventDefault)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    const ro = new ResizeObserver(() => {
      resize()
      cssW = sizeRef.w; cssH = sizeRef.h
      offscreen.width = Math.round(cssW * OVERSCAN); offscreen.height = Math.round(cssH * OVERSCAN)
      if (glyphMode === 'static') {
        renderAllLayers(chroma, getBeatLum(chroma), 0, 1)
      }
    })
    ro.observe(canvas.parentElement)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      if (animRef.current) cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [result?.cas?.composite_hash, modelName, bindingName, glyphMode, JSON.stringify(overrides)])

  // Static mode: redraw when zoom/pan changes (no rAF loop to pick it up)
  useEffect(() => {
    if (glyphMode !== 'static') return
    if (staticRenderRef.current) staticRenderRef.current()
  }, [zoomProp, panXProp, panYProp, glyphMode])

  if (chroma.length !== 12) return null

  return (
    <div className="glyph-wrap">
      <div className="glyph-canvas" style={{ position: 'relative', cursor: (zoomProp || 1) > 1.05 ? 'grab' : 'default' }}>
        <canvas ref={canvasRef}
          onMouseMove={handleMouseMove} onMouseLeave={() => { setTooltip(null); handlePanEnd() }}
          onMouseDown={handlePanStart} onMouseUp={handlePanEnd}
          onMouseMoveCapture={handlePanMove} />
        {tooltip && <div className="glyph-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>}
        <div className="zoom-ui">
          <button className="zoom-btn" onClick={() => onZoomChange?.({ zoom: Math.min(4, (zoomProp || 1) * 1.2), panX: panXProp || 0, panY: panYProp || 0 })}>+</button>
          <span className="zoom-pct">{Math.round((zoomProp || 1) * 100)}%</span>
          <button className="zoom-btn" onClick={() => onZoomChange?.({ zoom: Math.max(0.25, (zoomProp || 1) * 0.8), panX: panXProp || 0, panY: panYProp || 0 })}>−</button>
          <button className="zoom-btn zoom-reset" onClick={() => onZoomChange?.({ zoom: 1, panX: 0, panY: 0 })}>Fit</button>
        </div>
      </div>
    </div>
  )
}
