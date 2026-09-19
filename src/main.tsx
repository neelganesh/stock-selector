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

try {
  console.log('[main.tsx] Calling createRoot...');
  const root = createRoot(rootEl);
  console.log('[main.tsx] createRoot succeeded, rendering...');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('[main.tsx] Render call completed');
  // Force a visible indicator that render completed
  setTimeout(() => {
    console.log('[main.tsx] Post-render check');
    const mounted = document.getElementById('root')?.children?.length > 0;
    console.log('[main.tsx] Root has children:', mounted);
    if (!mounted) {
      const el = document.getElementById('js-error');
      if (el) {
        el.style.display = 'block';
        el.textContent = 'WARNING: React render completed but #root has no children!';
      }
    } else {
      console.log('[main.tsx] SUCCESS: React mounted with', rootEl.children.length, 'child elements');
      const banner = document.getElementById('js-status');
      if (banner) {
        banner.textContent = 'JS: module loaded + React mounted ✓';
        banner.style.background = '#22c55e';
      }
    }
  }, 100);
  
  // Force replace loading spinner after 3 seconds regardless
  setTimeout(() => {
    const spinner = document.querySelector('#root > div[style*="Loading Quant Vision"]');
    if (spinner) {
      console.log('[main.tsx] Force replacing loading spinner after 3s');
      const rootEl = document.getElementById('root');
      if (rootEl) {
        rootEl.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;background:#ff7043;color:#fff;padding:20px;text-align:center;font-family:monospace;font-size:14px;z-index:9999"><h2>⚠️ React render completed but spinner not replaced</h2><p>App component may have loading state stuck</p><button onclick="window.location.reload()" style="margin-top:16px;padding:10px 20px;background:#fff;color:#ff7043;border:none;border-radius:4px;cursor:pointer">Reload</button></div>';
      }
    }
  }, 3000);
} catch (e) {
  console.error('[main.tsx] RENDER ERROR:', e);
  const el = document.getElementById('js-error');
  if (el) {
    el.style.display = 'block';
    el.textContent = 'RENDER ERROR: ' + e.message + '\n' + e.stack;
  }
  rootEl.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;background:#ef5350;color:#fff;padding:20px;text-align:center;font-family:monospace;font-size:14px;z-index:9999"><h2>RENDER ERROR</h2><pre style="text-align:left;background:#000;padding:16px;border-radius:8px;color:#fff;font-size:12px;overflow:auto;max-height:60vh">' + e.message + '\n' + e.stack + '</pre></div>';
}
