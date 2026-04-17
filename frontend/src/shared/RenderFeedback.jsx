import { useState, useRef, useCallback, useEffect } from 'react'

const SHOW_DELAY = 120
const MIN_VISIBLE = 300
const HIDE_AFTER = 150

export function useRenderFeedback() {
  const [visible, setVisible] = useState(false)
  const showTimer = useRef(null)
  const hideTimer = useRef(null)
  const shownAt = useRef(0)

  const notify = useCallback(() => {
    clearTimeout(hideTimer.current)
    if (!visible && !showTimer.current) {
      showTimer.current = setTimeout(() => {
        setVisible(true)
        shownAt.current = Date.now()
        showTimer.current = null
      }, SHOW_DELAY)
    }
  }, [visible])

  const done = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
      return
    }
    if (!visible) return
    const elapsed = Date.now() - shownAt.current
    const remaining = Math.max(0, MIN_VISIBLE - elapsed)
    hideTimer.current = setTimeout(() => setVisible(false), remaining + HIDE_AFTER)
  }, [visible])

  useEffect(() => () => { clearTimeout(showTimer.current); clearTimeout(hideTimer.current) }, [])

  return { isRendering: visible, notify, done }
}

export function RenderPill({ visible }) {
  const [show, setShow] = useState(false)
  const [exit, setExit] = useState(false)

  useEffect(() => {
    if (visible) { setShow(true); setExit(false) }
    else if (show) { setExit(true); const t = setTimeout(() => { setShow(false); setExit(false) }, 200); return () => clearTimeout(t) }
  }, [visible])

  if (!show) return null

  return (
    <div className={`render-pill ${exit ? 'exit' : 'enter'}`} role="status" aria-live="polite">
      <span className="pill-dots"><span /><span /><span /></span>
      <span className="pill-text">Rendering…</span>
    </div>
  )
}
