import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { register as apiRegister } from '../services/auth.service.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

const DEMO_ACCOUNTS = [
  { label: 'Admin',      email: 'admin@example.com',      role: 'admin',      autofillPassword: false },
  { label: 'Staff',      email: 'staff@example.com',       role: 'staff',      autofillPassword: true, password: 'Staff@12345' },
  { label: 'Technician', email: 'technician@example.com',  role: 'technician', autofillPassword: false },
];

const EMPTY_SIGNUP = {
  name: '', email: '', password: '', confirmPassword: '',
  department: '', jobTitle: '', phone: '', site: '',
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname ?? '/';

  const [mode, setMode]         = useState('signin'); // 'signin' | 'register'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [signup, setSignup]     = useState(EMPTY_SIGNUP);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSignIn(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateSignup(field, value) {
    setSignup((s) => ({ ...s, [field]: value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (signup.password !== signup.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = signup;
      await apiRegister({
        ...payload,
        department: payload.department || undefined,
        jobTitle: payload.jobTitle || undefined,
        phone: payload.phone || undefined,
        site: payload.site || undefined,
      });
      const createdEmail = signup.email;
      setSignup(EMPTY_SIGNUP);
      setMode('signin');
      setEmail(createdEmail);
      setPassword('');
      setSuccess('Account created! Sign in with your new staff credentials.');
    } catch (err) {
      const detail = err.details?.[0]?.message;
      setError(detail ?? err.message ?? 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(account) {
    setMode('signin');
    setEmail(account.email);
    // Only the staff demo fills the password; admin/technician just fill the email.
    setPassword(account.autofillPassword ? account.password : '');
    setError('');
    setSuccess('');
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setSuccess('');
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--color-surface)' }}>

      {/* ── Animated background orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="card p-8 space-y-6"
          style={{ backdropFilter: 'blur(20px)', background: 'var(--color-surface-glass)' }}>

          {/* Brand */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg className="w-7 h-7 text-on-color" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">Smart Asset Management</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {mode === 'signin' ? 'Sign in to your account' : 'Create a staff account'}
              </p>
            </div>
          </div>

          {/* ── Mode tabs ── */}
          <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--color-surface)' }}>
            <button
              type="button"
              id="tab-signin"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signin' ? 'bg-indigo-500 text-on-color shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              id="tab-register"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'register' ? 'bg-indigo-500 text-on-color shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Demo accounts quick-fill (sign in only) */}
          {mode === 'signin' && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Quick access</p>
              <div className="flex gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.role}
                    type="button"
                    onClick={() => fillDemo(a)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-slate-300 hover:bg-white/8 hover:text-white transition-all"
                    style={{ background: 'var(--color-surface)' }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Sign in form ── */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="label">Email address</label>
                <input
                  id="login-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    className="input pr-10"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    <EyeIcon open={showPw} />
                  </button>
                </div>
              </div>

              {success && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              )}

              <button id="login-submit" type="submit" className="btn-primary w-full justify-center py-2.5 text-base" disabled={loading}>
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign in'}
              </button>
            </form>
          )}

          {/* ── Create account form ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="label">Full name *</label>
                <input
                  id="reg-name"
                  className="input"
                  placeholder="Jane Doe"
                  value={signup.name}
                  onChange={(e) => updateSignup('name', e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="label">Email address *</label>
                <input
                  id="reg-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={signup.email}
                  onChange={(e) => updateSignup('email', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-password" className="label">Password *</label>
                  <input
                    id="reg-password"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={signup.password}
                    onChange={(e) => updateSignup('password', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="label">Confirm *</label>
                  <input
                    id="reg-confirm"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={signup.confirmPassword}
                    onChange={(e) => updateSignup('confirmPassword', e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">
                At least 8 characters with an uppercase letter, a lowercase letter and a number.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-department" className="label">Department</label>
                  <input
                    id="reg-department"
                    className="input"
                    placeholder="e.g. IT"
                    value={signup.department}
                    onChange={(e) => updateSignup('department', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="reg-jobtitle" className="label">Job title</label>
                  <input
                    id="reg-jobtitle"
                    className="input"
                    placeholder="e.g. Analyst"
                    value={signup.jobTitle}
                    onChange={(e) => updateSignup('jobTitle', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="reg-phone" className="label">Phone</label>
                  <input
                    id="reg-phone"
                    className="input"
                    placeholder="+91…"
                    value={signup.phone}
                    onChange={(e) => updateSignup('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="reg-site" className="label">Site</label>
                  <input
                    id="reg-site"
                    className="input"
                    placeholder="e.g. HQ"
                    value={signup.site}
                    onChange={(e) => updateSignup('site', e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              )}

              <button id="register-submit" type="submit" className="btn-primary w-full justify-center py-2.5 text-base" disabled={loading}>
                {loading ? 'Creating account…' : 'Create staff account'}
              </button>

              <p className="text-center text-xs text-slate-500">
                New accounts are created with the <span className="text-slate-300 font-medium">Staff</span> role.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Smart Asset Management · © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        .orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.18;
          animation: float 12s ease-in-out infinite;
        }
        .orb-1 { width: 500px; height: 500px; background: #6366f1; top: -120px; left: -120px; animation-delay: 0s; }
        .orb-2 { width: 400px; height: 400px; background: #8b5cf6; bottom: -100px; right: -80px; animation-delay: 4s; }
        .orb-3 { width: 300px; height: 300px; background: #06b6d4; top: 40%; left: 55%; animation-delay: 8s; }
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-30px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
