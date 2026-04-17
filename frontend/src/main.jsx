import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply theme + font size BEFORE first render to prevent flash
const savedTheme = localStorage.getItem('tg-theme') ||
  (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
document.documentElement.setAttribute('data-theme', savedTheme)

const savedFontSize = localStorage.getItem('tg-fontsize')
if (savedFontSize) document.documentElement.style.fontSize = savedFontSize

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
