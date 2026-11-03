import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { takeSnapshot } from './lib/backup'
import { initSync } from './lib/sync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Cloud auto-sync (only when configured)
initSync()

// Ask the browser not to evict our data, then take the daily safety snapshot.
navigator.storage?.persist?.().catch(() => {})
setTimeout(() => takeSnapshot('Daily automatic').catch((e) => console.warn('Snapshot failed', e)), 3000)

// Offline support (only in the hosted PWA build).
if (import.meta.env.VITE_PWA === '1' && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {})
}
