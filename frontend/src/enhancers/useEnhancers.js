import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../shared/constants.js'

export function useEnhancers(result, fileHash) {
  const [lyricsOn, setLyricsOn] = useState(false)
  const [eraOn, setEraOn] = useState(false)
  const [lyrics, setLyrics] = useState(null)
  const [era, setEra] = useState(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [eraLoading, setEraLoading] = useState(false)
  const [manualLyrics, setManualLyrics] = useState('')

  // Fetch lyrics themes when toggled ON
  useEffect(() => {
    if (!lyricsOn || !result || !fileHash) { setLyrics(null); return }
    setLyricsLoading(true)
    fetch(`${API_URL}/api/enhance/lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: result.filename || '',
        file_hash: fileHash,
        pillar1: result.pillar1,
        pillar2: result.pillar2,
        pillar3: result.pillar3,
        lyrics: manualLyrics || undefined,
      }),
    })
      .then(r => r.json())
      .then(d => { setLyrics(d); setLyricsLoading(false) })
      .catch(() => { setLyrics({ mode: 'error', themes: {}, summary: 'Request failed' }); setLyricsLoading(false) })
  }, [lyricsOn, fileHash, manualLyrics])

  // Fetch era style when toggled ON
  useEffect(() => {
    if (!eraOn || !result || !fileHash) { setEra(null); return }
    setEraLoading(true)
    fetch(`${API_URL}/api/enhance/era`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_hash: fileHash,
        pillar1: result.pillar1,
        pillar2: result.pillar2,
      }),
    })
      .then(r => r.json())
      .then(d => { setEra(d); setEraLoading(false) })
      .catch(() => { setEra({ error: 'Request failed' }); setEraLoading(false) })
  }, [eraOn, fileHash])

  return {
    lyricsOn, setLyricsOn,
    eraOn, setEraOn,
    lyrics, era,
    lyricsLoading, eraLoading,
    manualLyrics, setManualLyrics,
  }
}

export function getEraFilter(era) {
  if (!era || era.error) return ''
  const parts = []
  if (era.contrast_level > 0.6) parts.push(`contrast(${1 + (era.contrast_level - 0.5) * 0.4})`)
  if (era.saturation_shift > 0.2) parts.push(`saturate(${1 + era.saturation_shift * 0.5})`)
  if (era.saturation_shift < -0.2) parts.push(`saturate(${1 + era.saturation_shift * 0.5})`)
  if (era.color_temperature > 0.3) parts.push(`sepia(${era.color_temperature * 0.2})`)
  if (era.color_temperature < -0.3) parts.push(`hue-rotate(${era.color_temperature * 15}deg)`)
  if (era.texture_type === 'faded') parts.push('brightness(1.1) contrast(0.9)')
  if (era.texture_type === 'gritty') parts.push('contrast(1.15)')
  return parts.join(' ')
}
