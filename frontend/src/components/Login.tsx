import React, { useState } from 'react';
import { api } from '../utils/api';
import { Key, Mail, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface LoginProps {
  onSuccess: (user: any) => void;
  onToggleRegister: () => void;
}

export default function Login({ onSuccess, onToggleRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login({ email, password });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: string) => {
    let testEmail = '';
    if (role === 'MAKER') testEmail = 'maker@veriledger.com';
    else if (role === 'CHECKER') testEmail = 'checker@veriledger.com';
    else if (role === 'FC') testEmail = 'fc@veriledger.com';
    else if (role === 'CFO') testEmail = 'cfo@veriledger.com';
    
    setEmail(testEmail);
    setPassword('password123');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px', gap: '20px' }}>
      <div className="glass-panel animate-fade" style={{ width: '100%', maxWidth: '480px', padding: '40px', borderRadius: '16px' }}>
        
        {/* Title & Brand */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <ShieldCheck size={32} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2 style={{ fontSize: '2rem', color: '#fff', fontWeight: 700, letterSpacing: '-0.025em' }}>Veriledger Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginTop: '4px' }}>Enterprise Balance Sheet Management System</p>
        </div>

        {/* Corporate Notice */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          borderLeft: '4px solid var(--color-primary)',
          padding: '16px',
          borderRadius: '0 8px 8px 0',
          marginBottom: '24px',
          fontSize: '0.825rem',
          color: '#cbd5e1',
          lineHeight: '1.5'
        }}>
          <div style={{ fontWeight: 'bold', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span>AUTHORIZED USE ONLY</span>
          </div>
          All operations on this system are cryptographically recorded, monitored, and audited in compliance with internal control policies. Unauthorised access attempts are strictly prohibited.
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', color: 'var(--color-danger)', fontSize: '0.9rem' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Single Sign-On Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                placeholder="employee@veriledger.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '48px' }}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Credential Access Code
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '48px' }}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? 'Verifying SSO token...' : 'Sign In with SSO'}
          </button>
        </form>

        {/* Dev Quick-Login Seeding Panel */}
        <div style={{ marginTop: '30px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
          <button
            onClick={() => setShowDevPanel(!showDevPanel)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <span>Developer Sandbox Quick-Login</span>
            {showDevPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showDevPanel && (
            <div className="animate-fade" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
                Select a preset employee profile to auto-fill the SSO credentials:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button type="button" onClick={() => handleQuickLogin('MAKER')} style={{ fontSize: '0.75rem', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
                  Maker Profile
                </button>
                <button type="button" onClick={() => handleQuickLogin('CHECKER')} style={{ fontSize: '0.75rem', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
                  Checker Profile
                </button>
                <button type="button" onClick={() => handleQuickLogin('FC')} style={{ fontSize: '0.75rem', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
                  FC Profile
                </button>
                <button type="button" onClick={() => handleQuickLogin('CFO')} style={{ fontSize: '0.75rem', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
                  CFO Profile
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
                Password for preset accounts is <code>password123</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                <button 
                  onClick={onToggleRegister} 
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Create Custom Sandbox Profile
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
