import { useState, useEffect } from 'react'

const LS_KEY = 'tg-tuning-sections'

function loadSections() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

function saveSections(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

export default function TuningSection({ id, label, defaultOpen = false, alwaysOpen = false, action, children }) {
  const [open, setOpen] = useState(() => {
    if (alwaysOpen) return true
    const saved = loadSections()
    return saved[id] !== undefined ? saved[id] : defaultOpen
  })

  function toggle() {
    if (alwaysOpen) return
    const next = !open
    setOpen(next)
    const all = loadSections()
    all[id] = next
    saveSections(all)
  }

  return (
    <div className="ts">
      <div className="ts-header" onClick={toggle}>
        {!alwaysOpen && <span className={`ts-arrow ${open ? 'open' : ''}`}>▸</span>}
        <span className="ts-label">{label}</span>
        {action && <div className="ts-action" onClick={e => e.stopPropagation()}>{action}</div>}
      </div>
      {(open || alwaysOpen) && <div className="ts-body">{children}</div>}
    </div>
  )
}
