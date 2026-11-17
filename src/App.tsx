import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { BookOpen, Calendar as CalendarIcon } from 'lucide-react';
import { useEffect } from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ParentDashboard from './pages/ParentDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Profile from './pages/Profile';
import CalendarPage from './pages/Calendar';
import useAuthStore from './store/authStore';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  const checkSession = useAuthStore(state => state.checkSession);
  const isLoading = useAuthStore(state => state.isLoading);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  return (
    <Router>
      <div className="flex flex-col min-h-screen" style={{ minHeight: '100vh' }}>
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
        <header className="glass-panel" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div className="container flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 700 }}>
              <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'white' }}>
                <BookOpen size={20} />
              </div>
              TutorFlow
            </Link>
            <nav className="flex gap-4">
              {user ? (
                <>
                  <Link to={`/${user.role}/dashboard`} className="btn" style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border)' }}>Dashboard</Link>
                  <Link to="/calendar" className="btn" style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CalendarIcon size={16} /> Calendar
                  </Link>
                  <button onClick={() => logout()} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Log Out</button>
                </>
              ) : (
                <Link to="/login" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Get Started</Link>
              )}
            </nav>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem 0' }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/parent/dashboard" element={<ParentDashboard />} />
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/calendar" element={<CalendarPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
