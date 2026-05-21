import React, { useState } from 'react';
import { api } from '../utils/api';
import { UserPlus, User, Mail, Lock, UserCheck, CheckCircle } from 'lucide-react';

interface RegisterProps {
  onSuccess: () => void;
  onToggleLogin: () => void;
}

export default function Register({ onSuccess, onToggleLogin }: RegisterProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('MAKER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.register({ name, email, password, role });
      setRegisteredUser(res);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  if (registeredUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
        <div className="glass-panel animate-fade" style={{ width: '100%', maxWidth: '480px', padding: '40px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', marginBottom: '20px', color: 'var(--color-success)' }}>
            <CheckCircle size={48} />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '8px' }}>Registration Complete</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Your Veriledger identity has been created successfully.</p>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', marginBottom: '32px', textAlign: 'left' }}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Assigned Employee ID</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                {registeredUser.emp_id}
              </span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Name & Access Role</span>
              <span style={{ fontSize: '1rem', color: '#fff', fontWeight: '500' }}>
                {registeredUser.name} ({registeredUser.role})
              </span>
            </div>
          </div>

          <button onClick={() => { onSuccess(); onToggleLogin(); }} className="btn-primary" style={{ width: '100%' }}>
            Proceed to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
      <div className="glass-panel animate-fade" style={{ width: '100%', maxWidth: '480px', padding: '40px' }}>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '12px', marginBottom: '16px' }}>
            <UserPlus size={32} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#fff' }}>Access Enrollment</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Register to join the Veriledger workflow</p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', color: 'var(--color-danger)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ paddingLeft: '48px' }}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Corporate Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '48px' }}
                required
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Workflow Role
            </label>
            <div style={{ position: 'relative' }}>
              <UserCheck size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ paddingLeft: '48px' }}
              >
                <option value="MAKER">MAKER (Prepare Balance Sheets)</option>
                <option value="CHECKER">CHECKER (First Level Audit)</option>
                <option value="FC">FC (Financial Controller - Review)</option>
                <option value="CFO">CFO (Chief Financial Officer - Approval)</option>
              </select>
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Access Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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

          <button type="submit" className="btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
            {loading ? 'Processing...' : 'Register Identity'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Already registered? </span>
          <button 
            onClick={onToggleLogin} 
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', padding: 0, fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Sign In Here
          </button>
        </div>

      </div>
    </div>
  );
}
