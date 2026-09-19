import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Synchronous mount indicator - runs before React renders
console.log('[main.tsx] Creating React root');
const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[main.tsx] ERROR: #root element not found!');
  document.body.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;background:#ef5350;color:#fff;padding:20px;text-align:center;font-family:monospace;font-size:14px;z-index:9999"><h2>ERROR: #root element not found in HTML</h2><p>Check index.html has <div id="root"></div></p></div>';
} else {
  console.log('[main.tsx] #root found, mounting App');
  rootEl.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;background:#ff7043;color:#fff;padding:8px;text-align:center;z-index:9999;font-size:12px;font-family:monospace">⚡ React root mounting…</div>';
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
