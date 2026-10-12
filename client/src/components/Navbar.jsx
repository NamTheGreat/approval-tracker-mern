import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout, login } = useAuth();

  if (!user) return null;

  async function handleRoleSwitch(email) {
    try {
      await login(email, 'Password123!');
    } catch (err) {
      console.error('Failed to switch role:', err);
    }
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <div className="brand-icon">AT</div>
          <div>
            <div>Approval Tracker</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>
              2-Stage Sequential Workflow
            </div>
          </div>
        </div>

        <div className="nav-user">
          {/* Quick Demo Switcher in Header for Instant Testing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Switch Role:
            </span>
            {[
              { role: 'employee', email: 'employee@startupmeu.local' },
              { role: 'manager', email: 'manager@startupmeu.local' },
              { role: 'hr', email: 'hr@startupmeu.local' },
              { role: 'admin', email: 'admin@startupmeu.local' },
            ].map((item) => (
              <button
                key={item.role}
                type="button"
                onClick={() => handleRoleSwitch(item.email)}
                className="btn btn-sm btn-outline"
                style={{
                  padding: '0.22rem 0.5rem',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  borderColor: user.role === item.role ? 'var(--primary)' : 'var(--border)',
                  background: user.role === item.role ? '#eef2ff' : 'white',
                  color: user.role === item.role ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {item.role}
              </button>
            ))}
          </div>

          <div
            style={{
              height: '24px',
              width: '1px',
              background: 'var(--border)',
            }}
          />

          <div className="user-info">
            <div className="user-name">
              {user.name}{' '}
              <span className={`role-badge role-${user.role}`} style={{ marginLeft: '0.3rem' }}>
                {user.role}
              </span>
            </div>
            <div className="user-email">{user.email}</div>
          </div>

          <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
