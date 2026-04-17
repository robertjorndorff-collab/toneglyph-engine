import { useState, useRef, useCallback, useEffect } from 'react'

export default function Tip({ text, children, shortcut, position = 'above' }) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState(null)
  const timerRef = useRef(null)
  const elRef = useRef(null)

  const enter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = elRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const above = position === 'above' && rect.top > 50
      setCoords({
        left: rect.left + rect.width / 2,
        top: above ? rect.top - 6 : rect.bottom + 6,
        above,
      })
      setShow(true)
    }, 400)
  }, [position])

  const leave = useCallback(() => {
    clearTimeout(timerRef.current)
    setShow(false)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const label = shortcut ? `${text} (${shortcut})` : text

  return (
    <span ref={elRef} onMouseEnter={enter} onMouseLeave={leave} style={{ cursor: 'pointer' }}>
      {children}
      {show && coords && (
        <span className={`tip ${coords.above ? 'tip-above' : 'tip-below'}`} style={{
          position: 'fixed', left: coords.left, top: coords.top,
          transform: coords.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          zIndex: 9999,
        }}>
          {label}
          <span className="tip-arrow" />
        </span>
      )}
    </span>
  )
}
