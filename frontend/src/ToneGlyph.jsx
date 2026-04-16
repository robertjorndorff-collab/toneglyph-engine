import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'

const TEXTURE_ROUGHNESS = { crystalline: 0.05, smooth: 0.15, rough: 0.5, granular: 0.8 }
const BG = 0x080c18

export default function ToneGlyph({ cas, onExport }) {
  const mountRef = useRef(null)
  const internals = useRef(null)

  const handleExport = useCallback(() => {
    if (!internals.current) return
    const { renderer, scene, camera } = internals.current
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/png')
    if (onExport) onExport(url)
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = `toneglyph-${cas.pantone_id}.png`
      a.click()
    }
  }, [cas, onExport])

  useEffect(() => {
    const container = mountRef.current
    if (!container || !cas) return
    const w = container.clientWidth
    const h = Math.min(w, 560)

    // --- Renderer ---
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

    // --- Scene ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(BG)

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
    camera.position.set(0, 0, 5.5)

    // --- CAS-driven params ---
    const { hsv, rgb, lighting, geometry: geo, motion, beat_sync } = cas
    const baseColor = new THREE.Color(rgb.hex)

    // --- Main glyph: TorusKnot ---
    const complexity = geo.shape_complexity
    const symmetry = geo.shape_symmetry
    const p = symmetry > 0.5 ? 2 : 3
    const q = symmetry > 0.5 ? 3 : 5
    const tubeSeg = Math.round(64 + complexity * 192)
    const radSeg = Math.round(8 + complexity * 16)
    const knotGeo = new THREE.TorusKnotGeometry(1.2, 0.35, tubeSeg, radSeg, p, q)

    const roughness = TEXTURE_ROUGHNESS[geo.surface_texture] ?? 0.3
    const metalness = Math.max(0, 1 - hsv.v)
    const clearcoat = hsv.v

    const knotMat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness,
      metalness,
      clearcoat,
      clearcoatRoughness: roughness * 0.5,
      transmission: lighting.transmission * 0.6,
      thickness: 1.5,
      ior: 1.5,
      emissive: baseColor,
      emissiveIntensity: lighting.emissive_power * 0.4,
    })

    const knot = new THREE.Mesh(knotGeo, knotMat)
    scene.add(knot)

    // --- 12 chroma radial sectors ---
    const sectorGroup = new THREE.Group()
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
      sMesh.position.set(
        Math.cos(angle) * 2.0,
        Math.sin(angle) * 2.0,
        0
      )
      sMesh.rotation.z = angle
      sectorGroup.add(sMesh)
      sectorMeshes.push(sMesh)
    }
    scene.add(sectorGroup)

    // --- Lights ---
    const keyLight = new THREE.DirectionalLight(0xffffff, lighting.key_light_intensity * 2.5)
    keyLight.position.set(3, 4, 5)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(
      baseColor.clone().lerp(new THREE.Color(0xffffff), 0.5),
      lighting.rim_light_intensity * 1.8
    )
    rimLight.position.set(-3, -1, -4)
    scene.add(rimLight)

    const innerLight = new THREE.PointLight(baseColor, lighting.emissive_power * 3, 4)
    innerLight.position.set(0, 0, 0)
    scene.add(innerLight)

    const ambientIntensity = 0.15 + (1 - lighting.ambient_occlusion) * 0.35
    scene.add(new THREE.AmbientLight(0xffffff, ambientIntensity))

    // --- Beat sync data ---
    const lumArray = beat_sync?.luminance_multiplier || []
    const beatInterval = 60 / (cas.motion?.spin_rate > 0.01
      ? (cas.motion.spin_rate / 0.7) * 140 + 60
      : 120)
    const beatCount = lumArray.length || 1
    const chromaBeats = []
    const rawBeats = (function () {
      try {
        return cas._pillar3_chroma_beat_sync || []
      } catch { return [] }
    })()

    // --- Animation ---
    const clock = new THREE.Clock()
    let animId

    function animate() {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Rotation
      const spinSpeed = motion.spin_rate * 0.8
      knot.rotation.y = t * spinSpeed
      knot.rotation.x = t * spinSpeed * 0.3

      // Flutter: micro-jitter via high-freq sin overlay
      const flutter = Math.sin(t * motion.flutter_frequency * 20) *
                       motion.flutter_complexity * 0.03
      knot.rotation.z = flutter

      // Pulse: scale oscillation
      const pulse = 1 + Math.sin(t * 3) * motion.pulse_amplitude * 0.15
      knot.scale.setScalar(pulse)

      // Beat sync: modulate emissive intensity
      if (lumArray.length > 0) {
        const beatPos = (t / beatInterval) % beatCount
        const idx = Math.floor(beatPos)
        const frac = beatPos - idx
        const cur = lumArray[idx % lumArray.length]
        const nxt = lumArray[(idx + 1) % lumArray.length]
        const lum = cur + (nxt - cur) * frac
        knotMat.emissiveIntensity = lighting.emissive_power * 0.2 + lum * 0.6
      }

      // Chroma sectors: gentle rotation + per-sector alpha blink from beat chroma
      sectorGroup.rotation.z = t * 0.1
      if (lumArray.length > 0) {
        const beatIdx = Math.floor((t / beatInterval) % beatCount)
        for (let i = 0; i < 12; i++) {
          const base = 0.15
          const energy = lumArray.length > 0 ? lumArray[beatIdx % lumArray.length] : 0.5
          sectorMeshes[i].material.opacity = base + energy * 0.7 * ((i % 3 === 0) ? 1 : 0.5)
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    internals.current = { renderer, scene, camera }

    // --- Resize ---
    function onResize() {
      const nw = container.clientWidth
      const nh = Math.min(nw, 560)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(animId)
      renderer.dispose()
      knotGeo.dispose()
      knotMat.dispose()
      sectorMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose() })
    }
  }, [cas, lighting])

  return (
    <div className="glyph-wrap">
      <div ref={mountRef} className="glyph-canvas" />
      <button className="export-btn" onClick={handleExport}>Export PNG</button>
    </div>
  )
}
