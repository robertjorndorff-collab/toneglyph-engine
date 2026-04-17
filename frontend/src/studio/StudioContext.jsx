import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'

const StudioCtx = createContext(null)
export const useStudio = () => useContext(StudioCtx)

const LS_KEY = 'tg-studio'

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return {
      ...s,
      tabs: (s.tabs || []).map(t => ({
        ...t,
        file: null,
        fileObjectUrl: null,
        uploading: false,
      })),
    }
  } catch { return null }
}

function persistState(state) {
  try {
    const s = {
      ...state,
      tabs: state.tabs.map(({ file, fileObjectUrl, uploading, ...rest }) => rest),
    }
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {}
}

const initialState = {
  tabs: [],
  activeTabId: null,
  compareTabIds: null,
  tuningOpen: false,
  workspaceMode: 'glyph',
}

function reducer(state, action) {
  switch (action.type) {
    case 'TAB_CREATE': {
      if (state.tabs.length >= 20) return state
      const tab = {
        id: crypto.randomUUID(),
        filename: action.filename,
        file: action.file,
        fileObjectUrl: action.file ? URL.createObjectURL(action.file) : null,
        result: null,
        error: null,
        uploading: true,
        modelName: 'Chromatic',
        bindingName: 'Default',
        glyphMode: 'animated',
        overrides: {},
      }
      return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id, compareTabIds: null }
    }
    case 'TAB_CLOSE': {
      const tab = state.tabs.find(t => t.id === action.id)
      if (tab?.fileObjectUrl) URL.revokeObjectURL(tab.fileObjectUrl)
      const tabs = state.tabs.filter(t => t.id !== action.id)
      let activeTabId = state.activeTabId
      if (activeTabId === action.id) {
        const idx = state.tabs.findIndex(t => t.id === action.id)
        activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id || null
      }
      const compareTabIds = state.compareTabIds?.includes(action.id) ? null : state.compareTabIds
      return { ...state, tabs, activeTabId, compareTabIds }
    }
    case 'TAB_SELECT':
      return { ...state, activeTabId: action.id, compareTabIds: null }
    case 'TAB_COMPARE': {
      const cur = state.compareTabIds
      if (!cur) return { ...state, compareTabIds: [state.activeTabId, action.id] }
      if (cur.includes(action.id)) return { ...state, compareTabIds: null }
      return { ...state, compareTabIds: [cur[0], action.id] }
    }
    case 'TAB_REORDER': {
      const tabs = [...state.tabs]
      const [moved] = tabs.splice(action.from, 1)
      tabs.splice(action.to, 0, moved)
      return { ...state, tabs }
    }
    case 'TAB_UPDATE': {
      const tabs = state.tabs.map(t => t.id === action.id ? { ...t, ...action.patch } : t)
      return { ...state, tabs }
    }
    case 'SET_GLYPH_MODE': {
      const tabs = state.tabs.map(t => t.id === state.activeTabId ? { ...t, glyphMode: action.mode } : t)
      return { ...state, tabs }
    }
    case 'SET_OVERRIDE': {
      const tabs = state.tabs.map(t => {
        if (t.id !== state.activeTabId) return t
        return { ...t, overrides: { ...t.overrides, [action.key]: action.value } }
      })
      return { ...state, tabs }
    }
    case 'CLEAR_OVERRIDES': {
      const tabs = state.tabs.map(t => t.id === state.activeTabId ? { ...t, overrides: {} } : t)
      return { ...state, tabs }
    }
    case 'TOGGLE_TUNING':
      return { ...state, tuningOpen: !state.tuningOpen }
    case 'EXIT_COMPARE':
      return { ...state, compareTabIds: null }
    case 'SET_WORKSPACE_MODE':
      return { ...state, workspaceMode: action.mode }
    default:
      return state
  }
}

export function StudioProvider({ children }) {
  const persisted = loadPersistedState()
  const [state, dispatch] = useReducer(reducer, persisted || initialState)

  useEffect(() => { persistState(state) }, [state])

  const activeTab = state.tabs.find(t => t.id === state.activeTabId) || null

  return (
    <StudioCtx.Provider value={{ ...state, activeTab, dispatch }}>
      {children}
    </StudioCtx.Provider>
  )
}
