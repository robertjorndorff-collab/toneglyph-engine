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
      presets: s.presets || [],
      tabs: (s.tabs || []).map(t => ({
        ...t,
        file: null,
        fileObjectUrl: null,
        uploading: false,
        layers: (t.layers && t.layers.length > 0) ? t.layers
          : [{ id: crypto.randomUUID(), modelName: t.modelName || 'Frankenthaler', opacity: 1, visible: true }],
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
  tuningOpen: true,
  workspaceMode: 'glyph',
  presets: [],
  theme: document.documentElement.getAttribute('data-theme') || 'dark',
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
        modelName: 'Frankenthaler',
        layers: [{ id: crypto.randomUUID(), modelName: 'Frankenthaler', opacity: 1, visible: true }],
        bindingName: 'Default',
        zoom: 1,
        panX: 0,
        panY: 0,
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
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'PRESET_SAVE': {
      if (state.presets.length >= 100) return state
      const srcTab = state.tabs.find(t => t.id === action.fromTabId)
      if (!srcTab) return state
      let name = action.name
      const existing = state.presets.filter(p => p.name.startsWith(name))
      if (existing.length > 0) name = `${name} (${existing.length + 1})`
      const preset = {
        id: crypto.randomUUID(),
        name,
        created_at: new Date().toISOString(),
        origin_song: { filename: srcTab.filename, file_hash: srcTab.result?.file_hash, pantone_id: srcTab.result?.cas?.pantone_id },
        config: {
          layers: (srcTab.layers || []).map(({ id, ...rest }) => rest),
          bindingName: srcTab.bindingName,
          glyphMode: srcTab.glyphMode,
          overrides: { ...srcTab.overrides },
          zoom: srcTab.zoom || 1, panX: srcTab.panX || 0, panY: srcTab.panY || 0,
        },
      }
      return { ...state, presets: [...state.presets, preset] }
    }
    case 'PRESET_APPLY': {
      const preset = state.presets.find(p => p.id === action.presetId)
      if (!preset) return state
      const tabs = state.tabs.map(t => {
        if (t.id !== action.toTabId) return t
        return {
          ...t,
          layers: preset.config.layers.map(l => ({ ...l, id: crypto.randomUUID() })),
          bindingName: preset.config.bindingName,
          glyphMode: preset.config.glyphMode,
          overrides: { ...preset.config.overrides },
          zoom: preset.config.zoom, panX: preset.config.panX, panY: preset.config.panY,
        }
      })
      return { ...state, tabs }
    }
    case 'PRESET_RENAME': {
      const presets = state.presets.map(p => p.id === action.presetId ? { ...p, name: action.name } : p)
      return { ...state, presets }
    }
    case 'PRESET_DELETE': {
      return { ...state, presets: state.presets.filter(p => p.id !== action.presetId) }
    }
    case 'PRESET_IMPORT': {
      const imported = (action.presets || []).map(p => ({ ...p, id: crypto.randomUUID() }))
      const merged = [...state.presets, ...imported].slice(0, 100)
      return { ...state, presets: merged }
    }
    case 'TAB_REATTACH_FILE': {
      const tabs = state.tabs.map(t => {
        if (t.id !== action.id) return t
        return { ...t, file: action.file, fileObjectUrl: URL.createObjectURL(action.file) }
      })
      return { ...state, tabs }
    }
    case 'LAYER_ADD': {
      const tabs = state.tabs.map(t => {
        if (t.id !== state.activeTabId || (t.layers?.length || 0) >= 5) return t
        return { ...t, layers: [...(t.layers || []), { id: crypto.randomUUID(), modelName: action.modelName, opacity: 1, visible: true }] }
      })
      return { ...state, tabs }
    }
    case 'LAYER_REMOVE': {
      const tabs = state.tabs.map(t => {
        if (t.id !== state.activeTabId) return t
        const layers = (t.layers || []).filter(l => l.id !== action.layerId)
        return { ...t, layers: layers.length ? layers : t.layers }
      })
      return { ...state, tabs }
    }
    case 'LAYER_UPDATE': {
      const tabs = state.tabs.map(t => {
        if (t.id !== state.activeTabId) return t
        return { ...t, layers: (t.layers || []).map(l => l.id === action.layerId ? { ...l, ...action.patch } : l) }
      })
      return { ...state, tabs }
    }
    case 'LAYER_REORDER': {
      const tabs = state.tabs.map(t => {
        if (t.id !== state.activeTabId) return t
        const layers = [...(t.layers || [])]
        const [moved] = layers.splice(action.from, 1)
        layers.splice(action.to, 0, moved)
        return { ...t, layers }
      })
      return { ...state, tabs }
    }
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
