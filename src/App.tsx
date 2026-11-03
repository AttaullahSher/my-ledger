import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './components/AppContext'
import { AppLock } from './components/AppLock'
import { AuthGate } from './components/AuthGate'
import { InstallPrompt } from './components/InstallPrompt'
import { Layout } from './components/Layout'
import { PinGuardProvider } from './components/PinGuard'
import { HomePage } from './pages/Home'
import { PersonDetailPage } from './pages/PersonDetail'
import { SettingsPage } from './pages/Settings'

// Order: install hint → account sign-in → PIN / Face ID lock → the ledger.
// HashRouter works on any static host (GitHub Pages) and offline without server rewrites.
export default function App() {
  return (
    <AppProvider>
      <PinGuardProvider>
        <InstallPrompt />
        <AuthGate>
          <AppLock>
            <HashRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="people/:id" element={<PersonDetailPage />} />
                </Route>
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </HashRouter>
          </AppLock>
        </AuthGate>
      </PinGuardProvider>
    </AppProvider>
  )
}
