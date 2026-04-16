import { useState, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  return (
    <div className="app">
      <p className="subtitle">Chromatic Audio Signature System</p>
      <h1>ToneGlyph Engine</h1>
      <div className={`status ${health?.status === 'ok' ? 'ok' : 'error'}`}>
        {health
          ? `Backend: ${health.status}`
          : 'Connecting...'}
      </div>
    </div>
  )
}

export default App
