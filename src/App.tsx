import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './components/AppContext'
import { AppLock } from './components/AppLock'
import { Layout } from './components/Layout'
import { PinGuardProvider } from './components/PinGuard'
import { HomePage } from './pages/Home'
import { PersonDetailPage } from './pages/PersonDetail'
import { SettingsPage } from './pages/Settings'

// HashRouter works on any static host (GitHub Pages) and offline without server rewrites.
export default function App() {
  return (
    <AppProvider>
      <PinGuardProvider>
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
      </PinGuardProvider>
    </AppProvider>
  )
}
