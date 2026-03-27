import { Navigate, NavLink, Route, Routes } from 'react-router'
import ChatPage from './pages/ChatPage'
import StatsPage from './pages/StatsPage'
import './App.css'

const App = () => {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Agents in Production</p>
          <h1>Troll Control Center</h1>
        </div>

        <nav className="topnav" aria-label="Primary">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Chat
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Stats
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
