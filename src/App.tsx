import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  BookOpen, Calendar as CalendarIcon, LayoutDashboard, 
  User as UserIcon, LogOut, LogIn, Home 
} from 'lucide-react';
import { useEffect } from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ParentDashboard from './pages/ParentDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Profile from './pages/Profile';
import CalendarPage from './pages/Calendar';
import useAuthStore from './store/authStore';
import { isSupabaseConfigured } from './lib/supabase';

function AppContent() {
  const checkSession = useAuthStore(state => state.checkSession);
  const isLoading = useAuthStore(state => state.isLoading);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const location = useLocation();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const currentPath = location.pathname;
  const dashboardPath = user ? `/${user.role}/dashboard` : '/';

  return (
    <div className="flex flex-col min-h-screen" style={{ minHeight: '100dvh' }}>
      {!isSupabaseConfigured && (
        <div style={{
          background: '#FEF3C7',
          color: '#92400E',
          padding: '0.6rem 1rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 500,
          borderBottom: '1px solid #FCD34D'
        }}>
          ⚠️ Supabase environment variables are missing. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel Project Settings &amp; redeploy.
        </div>
      )}

      {/* App Top Bar */}
      <header className="glass-panel" style={{ 
        padding: 'max(0.75rem, env(safe-area-inset-top, 0px)) 1rem 0.75rem', 
        borderBottom: '1px solid var(--border)', 
        position: 'sticky', 
        top: 0, 
        zIndex: 50 
      }}>
        <div className="container flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 700 }}>
            <div style={{ background: 'var(--primary)', padding: '0.45rem', borderRadius: 'var(--radius-sm)', color: 'white', display: 'flex', alignItems: 'center' }}>
              <BookOpen size={18} />
            </div>
            <span>HomeTutor</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="desktop-only items-center gap-3">
            {user ? (
              <>
                <Link 
                  to={dashboardPath} 
                  className="btn" 
                  style={{ 
                    padding: '0.45rem 0.85rem', 
                    background: currentPath.includes('/dashboard') ? 'rgba(79, 70, 229, 0.1)' : 'transparent', 
                    color: currentPath.includes('/dashboard') ? 'var(--primary)' : 'var(--text-main)',
                    border: '1px solid var(--border)' 
                  }}
                >
                  Dashboard
                </Link>
                <Link 
                  to="/calendar" 
                  className="btn" 
                  style={{ 
                    padding: '0.45rem 0.85rem', 
                    background: currentPath === '/calendar' ? 'rgba(79, 70, 229, 0.1)' : 'transparent', 
                    color: currentPath === '/calendar' ? 'var(--primary)' : 'var(--text-main)',
                    border: '1px solid var(--border)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem' 
                  }}
                >
                  <CalendarIcon size={16} /> Calendar
                </Link>
                <Link 
                  to="/profile" 
                  className="btn" 
                  style={{ 
                    padding: '0.45rem 0.85rem', 
                    background: currentPath === '/profile' ? 'rgba(79, 70, 229, 0.1)' : 'transparent', 
                    color: currentPath === '/profile' ? 'var(--primary)' : 'var(--text-main)',
                    border: '1px solid var(--border)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem' 
                  }}
                >
                  {user.avatarUrl ? <span style={{ fontSize: '1.1rem' }}>{user.avatarUrl}</span> : <UserIcon size={16} />} 
                  Profile
                </Link>
                <button onClick={() => logout()} className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem' }}>Log Out</button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Get Started</Link>
            )}
          </nav>

          {/* Mobile Top Header Action / Profile Pill */}
          <div className="mobile-only items-center gap-2">
            {user ? (
              <Link 
                to="/profile" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  padding: '0.35rem 0.75rem', 
                  borderRadius: '2rem', 
                  background: 'var(--surface-hover)', 
                  border: '1px solid var(--border)', 
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                {user.avatarUrl ? (
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{user.avatarUrl}</span>
                ) : (
                  <UserIcon size={15} color="var(--primary)" />
                )}
                <span>{user.name ? user.name.split(' ')[0] : 'Me'}</span>
                <span style={{ 
                  fontSize: '0.68rem', 
                  padding: '0.1rem 0.45rem', 
                  borderRadius: '1rem', 
                  background: user.role === 'parent' ? 'rgba(79,70,229,0.12)' : 'rgba(16,185,129,0.12)',
                  color: user.role === 'parent' ? 'var(--primary)' : 'var(--secondary)',
                  textTransform: 'uppercase',
                  fontWeight: 700
                }}>
                  {user.role}
                </span>
              </Link>
            ) : (
              <Link 
                to="/login" 
                className="btn btn-primary" 
                style={{ 
                  padding: '0.4rem 0.9rem', 
                  fontSize: '0.85rem', 
                  minHeight: '36px' 
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '1.5rem 0' }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/parent/dashboard" element={<ParentDashboard />} />
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </main>

      {/* Native App-Style Bottom Tab Bar (Mobile Only) */}
      <nav className="mobile-tab-bar" aria-label="Mobile Navigation">
        {user ? (
          <>
            <Link 
              to={dashboardPath} 
              className={`mobile-tab-item ${currentPath.includes('/dashboard') ? 'active' : ''}`}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </Link>

            <Link 
              to="/calendar" 
              className={`mobile-tab-item ${currentPath === '/calendar' ? 'active' : ''}`}
            >
              <CalendarIcon size={20} />
              <span>Calendar</span>
            </Link>

            <Link 
              to="/profile" 
              className={`mobile-tab-item ${currentPath === '/profile' ? 'active' : ''}`}
            >
              <UserIcon size={20} />
              <span>Profile</span>
            </Link>

            <button 
              type="button"
              onClick={() => logout()} 
              className="mobile-tab-item"
              title="Log Out"
            >
              <LogOut size={20} />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <>
            <Link 
              to="/" 
              className={`mobile-tab-item ${currentPath === '/' ? 'active' : ''}`}
            >
              <Home size={20} />
              <span>Home</span>
            </Link>

            <Link 
              to="/login" 
              className={`mobile-tab-item ${currentPath === '/login' ? 'active' : ''}`}
            >
              <LogIn size={20} />
              <span>Get Started</span>
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
