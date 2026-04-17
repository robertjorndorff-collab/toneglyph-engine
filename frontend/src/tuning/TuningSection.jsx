import { useState } from 'react'

const LS_KEY = 'tg-tuning-sections'
function loadSections() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} } }
function saveSections(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {} }

function Chevron({ open }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className={`tp-chevron ${open ? 'open' : ''}`}>
      <path d="M 2 1 L 6 4 L 2 7" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function TuningSection({ id, label, defaultOpen = false, action, children }) {
  const [open, setOpen] = useState(() => {
    const saved = loadSections()
    return saved[id] !== undefined ? saved[id] : defaultOpen
  })

  function toggle() {
    const next = !open
    setOpen(next)
    const all = loadSections()
    all[id] = next
    saveSections(all)
  }

  return (
    <div className="ts">
      <div className="ts-header" onClick={toggle} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
        <Chevron open={open} />
        <span className="ts-label">{label}</span>
        {action && <div className="ts-action" onClick={e => e.stopPropagation()}>{action}</div>}
      </div>
      {open && <div className="ts-body">{children}</div>}
    </div>
  )
}
