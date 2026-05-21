import { useState } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import { getStoredUser } from './utils/api';
import { Landmark } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(getStoredUser());
  const [authView, setAuthView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthView('LOGIN');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Decorative Glow Elements */}
      <div
        style={{
          position: 'fixed',
          top: '-10%',
          left: '-5%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.05) 0%, rgba(0,0,0,0) 70%)',
          zIndex: -1,
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '10%',
          right: '5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, rgba(0,0,0,0) 70%)',
          zIndex: -1,
          filter: 'blur(50px)',
          pointerEvents: 'none'
        }}
      />

      {/* Corporate Header */}
      <header
        style={{
          padding: '20px 40px',
          borderBottom: '1px solid var(--border-light)',
          background: 'rgba(10, 12, 20, 0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center' }}>
            <Landmark size={26} />
          </div>
          <span
            style={{
              fontFamily: 'Outfit',
              fontSize: '1.4rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(to right, #ffffff, #9ca3af)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Veriledger
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SECURE AUDIT CHAIN
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '0 40px' }}>
        {currentUser ? (
          <Dashboard currentUser={currentUser} onLogout={handleLogout} />
        ) : authView === 'LOGIN' ? (
          <Login onSuccess={handleLoginSuccess} onToggleRegister={() => setAuthView('REGISTER')} />
        ) : (
          <Register onSuccess={() => setAuthView('LOGIN')} onToggleLogin={() => setAuthView('LOGIN')} />
        )}
      </main>

      {/* Footer */}
      <footer style={{ padding: '24px 40px', borderTop: '1px solid var(--border-light)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div>Veriledger © 2026. Python-based Balance Sheet Management & Linear Sign-off Ledger.</div>
        <div style={{ marginTop: '4px', opacity: 0.7 }}>Cryptographically signed actions & immutable archival records.</div>
      </footer>

    </div>
  );
}
