import { useState, useCallback } from 'react'
import { useStudio } from './StudioContext'
import Tip from '../shared/Tooltip'

const FONT_SIZES = ['14px', '16px', '18px', '20px']
const FONT_LABELS = ['S', 'M', 'L', 'XL']

function getCurrentFontIdx() {
  const cur = document.documentElement.style.fontSize || '16px'
  const idx = FONT_SIZES.indexOf(cur)
  return idx >= 0 ? idx : 1
}

export default function TabBar() {
  const { tabs, activeTabId, compareTabIds, dispatch } = useStudio()
  const [theme, setThemeState] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  const [fontIdx, setFontIdx] = useState(getCurrentFontIdx)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('tg-theme', next)
    setThemeState(next)
    dispatch({ type: 'SET_THEME', theme: next })
  }

  function setFontSize(idx) {
    const clamped = Math.max(0, Math.min(FONT_SIZES.length - 1, idx))
    document.documentElement.style.fontSize = FONT_SIZES[clamped]
    localStorage.setItem('tg-fontsize', FONT_SIZES[clamped])
    setFontIdx(clamped)
  }

  function onTabClick(id, e) {
    if (e.metaKey || e.ctrlKey) dispatch({ type: 'TAB_COMPARE', id })
    else dispatch({ type: 'TAB_SELECT', id })
  }

  return (
    <div className="tab-bar">
      <img src="/icon.png" alt="ToneGlyph" className="tab-logo" onClick={() => dispatch({ type: 'TAB_SELECT', id: '__new__' })} />
      <div className="tab-list">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId
          const isCompare = compareTabIds?.includes(tab.id)
          const hexDot = tab.result?.cas?.rgb?.hex || '#555'
          const name = tab.uploading ? 'Analyzing...' : (tab.filename || 'New').replace(/\.[^.]+$/, '').slice(0, 30)
          return (
            <div key={tab.id}
              className={`tab ${isActive ? 'active' : ''} ${isCompare ? 'compare' : ''}`}
              onClick={e => onTabClick(tab.id, e)}>
              <span className="tab-dot" style={{ background: hexDot }} />
              <span className="tab-name">{name}</span>
              <Tip text="Close Tab">
                <button className="tab-close" onClick={e => { e.stopPropagation(); dispatch({ type: 'TAB_CLOSE', id: tab.id }) }}>×</button>
              </Tip>
            </div>
          )
        })}
        {tabs.length > 0 && (
          <Tip text="New Song" shortcut="+">
            <button className="tab-new" onClick={() => dispatch({ type: 'TAB_SELECT', id: '__new__' })}>+</button>
          </Tip>
        )}
      </div>
      <div className="header-controls">
        <Tip text="Smaller text"><button className="hc-btn" onClick={() => setFontSize(fontIdx - 1)} disabled={fontIdx === 0}>A−</button></Tip>
        <Tip text="Reset text size"><button className={`hc-btn ${fontIdx === 1 ? 'hc-active' : ''}`} onClick={() => setFontSize(1)}>A</button></Tip>
        <Tip text="Larger text"><button className="hc-btn" onClick={() => setFontSize(fontIdx + 1)} disabled={fontIdx === FONT_SIZES.length - 1}>A+</button></Tip>
        <span className="hc-sep" />
        <Tip text={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
          <button className="hc-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
        </Tip>
      </div>
    </div>
  )
}
