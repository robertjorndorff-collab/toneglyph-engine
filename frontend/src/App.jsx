import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const MAX_SIZE = 50 * 1024 * 1024
const ACCEPTED = '.mp3,.wav,.flac,.m4a,.aac'

function App() {
  const [health, setHealth] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  async function uploadFile(file) {
    setError(null)
    setResult(null)

    if (file.size > MAX_SIZE) {
      setError('File exceeds 50MB limit')
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Upload failed')
      } else {
        setResult(data)
      }
    } catch {
      setError('Could not reach backend')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function onFileSelect(e) {
    const file = e.target.files[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  return (
    <div className="app">
      <p className="subtitle">Chromatic Audio Signature System</p>
      <h1>ToneGlyph Engine</h1>
      <div className={`status ${health?.status === 'ok' ? 'ok' : 'error'}`}>
        {health ? `Backend: ${health.status}` : 'Connecting...'}
      </div>

      <div
        className={`dropzone${dragging ? ' active' : ''}${uploading ? ' uploading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onFileSelect}
          hidden
        />
        {uploading
          ? <p className="drop-label">Analyzing...</p>
          : <>
              <p className="drop-label">Drop an audio file here</p>
              <p className="drop-hint">or click to browse — MP3, WAV, FLAC, M4A, AAC (max 50MB)</p>
            </>
        }
      </div>

      {error && <div className="result-card error-card">{error}</div>}

      {result && (
        <div className="result-card">
          <h2>Analysis Result</h2>
          <table className="result-table">
            <tbody>
              <tr><td>File</td><td>{result.filename}</td></tr>
              <tr><td>Format</td><td>{result.format.toUpperCase()}</td></tr>
              <tr><td>Duration</td><td>{result.duration}s</td></tr>
              <tr><td>Sample Rate</td><td>{result.sample_rate} Hz</td></tr>
              <tr><td>Channels</td><td>{result.channels}</td></tr>
              <tr><td>SHA-256</td><td className="hash">{result.file_hash}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App
