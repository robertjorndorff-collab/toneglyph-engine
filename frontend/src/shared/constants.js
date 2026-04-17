export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const MAX_SIZE = 50 * 1024 * 1024
export const ACCEPTED = '.mp3,.wav,.flac,.m4a,.aac'
export const UPLOAD_TIMEOUT_MS = 120_000
export const MAX_TABS = 20

export const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const PITCH_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

export function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

export function num(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

export function arr(v) {
  return Array.isArray(v) ? v : []
}

export function resolvePath(obj, dotPath) {
  if (!obj || !dotPath) return undefined
  return dotPath.split('.').reduce((o, k) => o?.[k], obj)
}

export function resolveBindings(binding, result) {
  const r = {}
  if (!binding?.mappings) return r
  for (const [vp, dp] of Object.entries(binding.mappings)) {
    r[vp] = resolvePath(result, dp)
  }
  return r
}
