import { useStudio } from './StudioContext'

export default function TabBar() {
  const { tabs, activeTabId, compareTabIds, dispatch } = useStudio()

  function onTabClick(id, e) {
    if (e.metaKey || e.ctrlKey) {
      dispatch({ type: 'TAB_COMPARE', id })
    } else {
      dispatch({ type: 'TAB_SELECT', id })
    }
  }

  function onDragStart(e, idx) { e.dataTransfer.setData('text/plain', String(idx)) }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e, toIdx) {
    e.preventDefault()
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(fromIdx) && fromIdx !== toIdx) dispatch({ type: 'TAB_REORDER', from: fromIdx, to: toIdx })
  }

  return (
    <div className="tab-bar">
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTabId
        const isCompare = compareTabIds?.includes(tab.id)
        const hexDot = tab.result?.cas?.rgb?.hex || '#555'
        return (
          <div
            key={tab.id}
            className={`tab ${isActive ? 'active' : ''} ${isCompare ? 'compare' : ''}`}
            onClick={e => onTabClick(tab.id, e)}
            draggable
            onDragStart={e => onDragStart(e, idx)}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, idx)}
          >
            <span className="tab-dot" style={{ background: hexDot }} />
            <span className="tab-name">
              {tab.uploading ? 'Analyzing...' : (tab.filename || 'New').replace(/\.[^.]+$/, '').slice(0, 30)}
            </span>
            <button className="tab-close" onClick={e => { e.stopPropagation(); dispatch({ type: 'TAB_CLOSE', id: tab.id }) }}>×</button>
          </div>
        )
      })}
      <button className="tab-new" onClick={() => dispatch({ type: 'TAB_SELECT', id: '__new__' })} title="Analyze a new song">+</button>
    </div>
  )
}
