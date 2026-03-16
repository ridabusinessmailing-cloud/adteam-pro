import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import LoginPage  from './pages/LoginPage.jsx'
import Dashboard  from './pages/Dashboard.jsx'
import IdeasDB    from './pages/IdeasDB.jsx'
import ProductPipeline from './pages/ProductPipeline.jsx'
import CreativeBoard   from './pages/CreativeBoard.jsx'
import AdsTracker      from './pages/AdsTracker.jsx'
import TaskManager     from './pages/TaskManager.jsx'
import TaskBoard       from './pages/TaskBoard.jsx'
import ProductAssetsPage from './pages/ProductAssetsPage.jsx'
import CalendarView    from './pages/CalendarView.jsx'
import { Avatar, Spinner } from './components/ui.jsx'

const C = {
  bg: '#F7F6F3', text: '#1A1714', textLight: '#9B9589',
  accent: '#D4521A', navy: '#1C2B4A', border: '#E8E5DF',
}

// ── Visible sidebar modules (hidden ones kept in views but not shown) ────────
const MODULES = [
  { id: 'dashboard', label: 'Dashboard',  icon: '🏠' },
  { id: 'products',  label: 'Products',   icon: '📦' },
  { id: 'board',     label: 'Task Board', icon: '🗂' },
]

// ── Inner app (authenticated) ────────────────────────────
function AppShell() {
  const { session, profile, userName, isAdmin, signOut } = useAuth()
  const [mod, setMod]             = useState('dashboard')
  const [sidebarOpen, setSidebar] = useState(true)

  // Still loading session
  if (session === undefined) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <Spinner />
      </div>
    )
  }

  // Not logged in
  if (!session) return <LoginPage />

  // Session exists but profile not yet loaded
  if (!profile) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: 12 }}>
        <Spinner />
        <p style={{ color: C.textLight, fontSize: 14 }}>Loading your profile…</p>
      </div>
    )
  }

  const views = {
    dashboard:  <Dashboard />,
    ideas:      <IdeasDB />,
    products:   <ProductPipeline />,
    creatives:  <CreativeBoard />,
    ads:        <AdsTracker />,
    tasks:      <TaskManager />,
    board:      <TaskBoard />,
    assets:     <ProductAssetsPage />,
    calendar:   <CalendarView />,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: "'Sora', system-ui, sans-serif", overflow: 'hidden' }}>

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <div style={{ width: sidebarOpen ? 220 : 64, background: C.navy, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.2s', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A3D5E' }}>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.03em' }}>
                AdTeam <span style={{ color: C.accent }}>Pro</span>
              </div>
              <div style={{ fontSize: 10.5, color: '#4A6080', marginTop: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Internal Platform</div>
            </div>
          )}
          <button onClick={() => setSidebar(o => !o)} style={{ background: 'transparent', border: 'none', color: '#4A6080', cursor: 'pointer', fontSize: 16, padding: 4 }}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
          {MODULES.map(m => (
            <button key={m.id} onClick={() => setMod(m.id)} title={!sidebarOpen ? m.label : undefined} style={{
              width: '100%', padding: sidebarOpen ? '10px 12px' : '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: mod === m.id ? '#243350' : 'transparent',
              color: mod === m.id ? '#FFFFFF' : '#4A6080', textAlign: 'left', fontSize: 13.5,
              fontWeight: mod === m.id ? 700 : 500, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 1,
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
            }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{m.icon}</span>
              {sidebarOpen && <span style={{ flex: 1 }}>{m.label}</span>}
            </button>
          ))}
        </nav>

        {/* User footer */}
        {sidebarOpen && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #2A3D5E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={userName} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{userName}</div>
                <div style={{ fontSize: 10.5, color: '#4A6080', fontWeight: 600 }}>{isAdmin ? 'Admin 👑' : 'Team Member'}</div>
              </div>
              <button onClick={signOut} title="Sign out"
                style={{ background: 'transparent', border: 'none', color: '#4A6080', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                ↩
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {views[mod]}
      </div>
    </div>
  )
}

// ── Root with AuthProvider ───────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
