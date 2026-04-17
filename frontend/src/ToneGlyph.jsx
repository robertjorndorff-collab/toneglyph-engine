import { useRef, useEffect, useCallback, useState } from 'react'
import * as THREE from 'three'

const TEXTURE_ROUGHNESS = { crystalline: 0.05, smooth: 0.15, rough: 0.5, granular: 0.8 }
const BG = 0x080c18

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v, fallback = 'smooth') {
  return typeof v === 'string' && v.length > 0 ? v : fallback
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback
}

function safeCas(raw) {
  if (!raw || typeof raw !== 'object') return null
  const hsv = raw.hsv || {}
  const rgb = raw.rgb || {}
  const lighting = raw.lighting || {}
  const geometry = raw.geometry || {}
  const motion = raw.motion || {}
  const beat_sync = raw.beat_sync || {}

  return {
    hsv: { h: num(hsv.h, 180), s: num(hsv.s, 0.5), v: num(hsv.v, 0.7) },
    rgb: { r: num(rgb.r, 128), g: num(rgb.g, 128), b: num(rgb.b, 128), hex: str(rgb.hex, '#808080') },
    cmyk: raw.cmyk || { c: 0, m: 0, y: 0, k: 0 },
    pantone_id: str(raw.pantone_id, 'TG-UNK-000-S5V5-0000'),
    composite_hash: str(raw.composite_hash, ''),
    lighting: {
      transmission: num(lighting.transmission, 0.3),
      key_light_intensity: num(lighting.key_light_intensity, 0.8),
      rim_light_intensity: num(lighting.rim_light_intensity, 0.5),
      emissive_power: num(lighting.emissive_power, 0.3),
      ambient_occlusion: num(lighting.ambient_occlusion, 0.5),
    },
    geometry: {
      shape_complexity: num(geometry.shape_complexity, 0.5),
      shape_symmetry: num(geometry.shape_symmetry, 0.5),
      surface_texture: str(geometry.surface_texture, 'smooth'),
    },
    motion: {
      spin_rate: num(motion.spin_rate, 0.3),
      pulse_amplitude: num(motion.pulse_amplitude, 0.2),
      flutter_frequency: num(motion.flutter_frequency, 0.5),
      flutter_complexity: num(motion.flutter_complexity, 0.5),
    },
    beat_sync: {
      beat_count: num(beat_sync.beat_count, 0),
      luminance_multiplier: arr(beat_sync.luminance_multiplier).filter(v => Number.isFinite(v)),
    },
    coords_3d: raw.coords_3d || { x: 0, y: 0, z: 0 },
  }
}

function WebGLFallback({ hex }) {
  return (
    <div className="glyph-fallback">
      <div className="fallback-swatch" style={{ background: hex }} />
      <p className="fallback-msg">3D visualization unavailable — WebGL not supported</p>
    </div>
  )
}

export default function ToneGlyph({ cas: rawCas, onExport }) {
  const mountRef = useRef(null)
  const internals = useRef(null)
  const [renderError, setRenderError] = useState(null)

  const cas = safeCas(rawCas)

  const handleExport = useCallback(() => {
    if (!internals.current) return
    const { renderer, scene, camera } = internals.current
    try {
      renderer.render(scene, camera)
      const url = renderer.domElement.toDataURL('image/png')
      if (onExport) { onExport(url); return }
      const a = document.createElement('a')
      a.href = url
      a.download = `toneglyph-${cas?.pantone_id || 'export'}.png`
      a.click()
    } catch (e) {
      console.error('[ToneGlyph] export failed:', e)
    }
  }, [cas, onExport])

  useEffect(() => {
    const container = mountRef.current
    if (!container || !cas) return
    setRenderError(null)

    let animId
    const disposables = []

    try {
      // WebGL support check
      const testCanvas = document.createElement('canvas')
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
      if (!gl) {
        setRenderError('webgl')
        return
      }

      const w = container.clientWidth
      const h = Math.min(w, 560)

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(BG)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      container.innerHTML = ''
      container.appendChild(renderer.domElement)
      disposables.push(() => renderer.dispose())

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(BG)

      const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
      camera.position.set(0, 0, 5.5)

      const { hsv, rgb, lighting, geometry: geo, motion, beat_sync } = cas
      const baseColor = new THREE.Color(rgb.hex)

      // TorusKnot
      const complexity = geo.shape_complexity
      const symmetry = geo.shape_symmetry
      const p = symmetry > 0.5 ? 2 : 3
      const q = symmetry > 0.5 ? 3 : 5
      const tubeSeg = Math.max(32, Math.round(64 + complexity * 192))
      const radSeg = Math.max(4, Math.round(8 + complexity * 16))
      const knotGeo = new THREE.TorusKnotGeometry(1.2, 0.35, tubeSeg, radSeg, p, q)
      disposables.push(() => knotGeo.dispose())

      const roughness = TEXTURE_ROUGHNESS[geo.surface_texture] ?? 0.15
      const metalness = Math.max(0, Math.min(1, 1 - hsv.v))
      const clearcoat = Math.max(0, Math.min(1, hsv.v))

      const knotMat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness,
        metalness,
        clearcoat,
        clearcoatRoughness: roughness * 0.5,
        transmission: Math.max(0, Math.min(1, lighting.transmission * 0.6)),
        thickness: 1.5,
        ior: 1.5,
        emissive: baseColor,
        emissiveIntensity: lighting.emissive_power * 0.4,
      })
      disposables.push(() => knotMat.dispose())

      const knot = new THREE.Mesh(knotGeo, knotMat)
      scene.add(knot)

      // 12 chroma radial sectors
      const sectorMeshes = []
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2
        const sGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4)
        sGeo.rotateZ(Math.PI / 2)
        const sMat = new THREE.MeshBasicMaterial({
          color: baseColor.clone(),
          transparent: true,
          opacity: 0.6,
        })
        const sMesh = new THREE.Mesh(sGeo, sMat)
        sMesh.position.set(Math.cos(angle) * 2.0, Math.sin(angle) * 2.0, 0)
        sMesh.rotation.z = angle
        scene.add(sMesh)
        sectorMeshes.push(sMesh)
        disposables.push(() => { sGeo.dispose(); sMat.dispose() })
      }

      // Lights
      const keyLight = new THREE.DirectionalLight(0xffffff, lighting.key_light_intensity * 2.5)
      keyLight.position.set(3, 4, 5)
      scene.add(keyLight)

      const rimColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.5)
      const rimLight = new THREE.DirectionalLight(rimColor, lighting.rim_light_intensity * 1.8)
      rimLight.position.set(-3, -1, -4)
      scene.add(rimLight)

      const innerLight = new THREE.PointLight(baseColor, lighting.emissive_power * 3, 4)
      scene.add(innerLight)

      const ambientI = 0.15 + (1 - lighting.ambient_occlusion) * 0.35
      scene.add(new THREE.AmbientLight(0xffffff, ambientI))

      // Beat sync
      const lumArray = beat_sync.luminance_multiplier
      const hasBeatSync = lumArray.length > 0
      const beatCount = lumArray.length || 1
      const bpmEst = motion.spin_rate > 0.01 ? (motion.spin_rate / 0.7) * 140 + 60 : 120
      const beatInterval = Math.max(0.05, 60 / bpmEst)

      const clock = new THREE.Clock()

      function animate() {
        animId = requestAnimationFrame(animate)
        const t = clock.getElapsedTime()

        const spinSpeed = motion.spin_rate * 0.8
        knot.rotation.y = t * spinSpeed
        knot.rotation.x = t * spinSpeed * 0.3

        const flutter = Math.sin(t * motion.flutter_frequency * 20) *
                         motion.flutter_complexity * 0.03
        knot.rotation.z = flutter

        const pulse = 1 + Math.sin(t * 3) * motion.pulse_amplitude * 0.15
        knot.scale.setScalar(pulse)

        if (hasBeatSync) {
          const beatPos = (t / beatInterval) % beatCount
          const idx = Math.floor(beatPos)
          const frac = beatPos - idx
          const cur = lumArray[idx % lumArray.length] || 0.5
          const nxt = lumArray[(idx + 1) % lumArray.length] || 0.5
          const lum = cur + (nxt - cur) * frac
          knotMat.emissiveIntensity = lighting.emissive_power * 0.2 + lum * 0.6

          for (let i = 0; i < 12; i++) {
            const base = 0.15
            sectorMeshes[i].material.opacity = base + lum * 0.7 * ((i % 3 === 0) ? 1 : 0.5)
          }
        }

        renderer.render(scene, camera)
      }
      animate()

      internals.current = { renderer, scene, camera }

      function onResize() {
        const nw = container.clientWidth
        if (nw < 1) return
        const nh = Math.min(nw, 560)
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
        renderer.setSize(nw, nh)
      }
      window.addEventListener('resize', onResize)
      disposables.push(() => window.removeEventListener('resize', onResize))

    } catch (e) {
      console.error('[ToneGlyph] render init failed:', e)
      setRenderError('crash')
    }

    return () => {
      if (animId) cancelAnimationFrame(animId)
      disposables.forEach(fn => { try { fn() } catch {} })
      internals.current = null
    }
  }, [cas ? cas.composite_hash : null])

  if (!cas) return null

  if (renderError === 'webgl') {
    return <WebGLFallback hex={cas.rgb.hex} />
  }

  if (renderError === 'crash') {
    return (
      <div className="glyph-fallback">
        <div className="fallback-swatch" style={{ background: cas.rgb.hex }} />
        <p className="fallback-msg">3D visualization unavailable</p>
      </div>
    )
  }

  return (
    <div className="glyph-wrap">
      <div ref={mountRef} className="glyph-canvas" />
      <button className="export-btn" onClick={handleExport}>Export PNG</button>
    </div>
  )
}
