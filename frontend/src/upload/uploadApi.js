import { API_URL, UPLOAD_TIMEOUT_MS } from '../shared/constants.js'

export async function analyzeFile(file) {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)

  console.log('[ToneGlyph] uploading:', file.name, `(${(file.size / 1e6).toFixed(1)}MB)`)

  try {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST', body: form, signal: controller.signal,
    })
    clearTimeout(tid)
    const data = await res.json()
    console.log('[ToneGlyph] response:', data)
    if (!res.ok) throw new Error(data.detail || `Upload failed (HTTP ${res.status})`)
    return data
  } catch (e) {
    clearTimeout(tid)
    if (e.name === 'AbortError') throw new Error('Analysis timed out — try a shorter file')
    throw e
  }
}
