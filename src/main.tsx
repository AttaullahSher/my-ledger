import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initSync } from './lib/sync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Cloud auto-sync (only when configured)
initSync()

// Ask the browser not to evict our data.
navigator.storage?.persist?.().catch(() => {})

// Offline support (only in the hosted PWA build).
if (import.meta.env.VITE_PWA === '1' && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {})
}
