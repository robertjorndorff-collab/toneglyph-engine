import { useState, useRef, useCallback, useEffect } from 'react'

export default function Tip({ text, children, shortcut, position = 'auto' }) {
  const [show, setShow] = useState(false)
  const [style, setStyle] = useState(null)
  const [placement, setPlacement] = useState('above')
  const timerRef = useRef(null)
  const elRef = useRef(null)

  const enter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = elRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const tipW = 160

      // Vertical: prefer above, flip below if near top
      let above = rect.top > 60
      if (position === 'below') above = false
      if (position === 'above') above = rect.top > 60

      // Horizontal: clamp so tooltip doesn't fall off left/right edge
      let left = cx
      if (left - tipW / 2 < 8) left = tipW / 2 + 8
      if (left + tipW / 2 > window.innerWidth - 8) left = window.innerWidth - tipW / 2 - 8

      setPlacement(above ? 'above' : 'below')
      setStyle({
        position: 'fixed',
        left,
        top: above ? rect.top - 8 : rect.bottom + 8,
        transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 9999,
        maxWidth: tipW,
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
      {show && style && (
        <span className={`tip tip-${placement}`} style={style}>
          {label}
          <span className="tip-arrow" />
        </span>
      )}
    </span>
  )
}
