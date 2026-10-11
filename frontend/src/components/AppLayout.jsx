import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/* ── Nav items with optional role restriction ── */
const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    roles: null, // visible to all
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/assets',
    label: 'Assets',
    roles: null,
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
      </svg>
    ),
  },
  {
    to: '/allocations',
    label: 'Allocations',
    roles: ['admin', 'staff'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/maintenance',
    label: 'Maintenance',
    roles: null,
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const ROLE_BADGE = {
  admin:      { cls: 'badge-blue',   label: 'Admin' },
  staff:      { cls: 'badge-green',  label: 'Staff' },
  technician: { cls: 'badge-yellow', label: 'Tech' },
};

/* ── Breadcrumb helper ── */
function useBreadcrumb() {
  const { pathname } = useLocation();
  const segs = pathname.split('/').filter(Boolean);
  return segs.length === 0
    ? [{ label: 'Dashboard', to: '/' }]
    : segs.map((s, i) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        to: '/' + segs.slice(0, i + 1).join('/'),
      }));
}

/* ── Logout confirmation modal ── */
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="card p-6 w-full max-w-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Sign out</p>
            <p className="text-xs text-slate-400">Are you sure you want to sign out?</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button
            id="logout-confirm"
            onClick={onConfirm}
            className="flex-1 justify-center inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-500/90 hover:bg-red-500 rounded-xl transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumb();
  const [showLogout, setShowLogout] = useState(false);

  const roleBadge = ROLE_BADGE[user?.role] ?? { cls: 'badge-gray', label: user?.role ?? '' };

  // Filter nav items by role
  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-[--color-border]"
        style={{ background: 'var(--color-surface-2)' }}>

        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-[18px] border-b border-[--color-border]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
            flex items-center justify-center shrink-0 shadow shadow-indigo-500/30">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">SAM</p>
            <p className="text-[10px] text-slate-500 leading-tight">Asset Management</p>
          </div>
        </div>

        {/* Role pill */}
        <div className="px-5 pt-3 pb-1">
          <span className={`badge ${roleBadge.cls} text-[10px]`}>{roleBadge.label}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}>
                    {icon}
                  </span>
                  {label}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-[--color-border]" />

        {/* User footer */}
        <div className="p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
            flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.email ?? ''}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role ?? ''}</p>
          </div>
          <button
            id="logout-btn"
            onClick={() => setShowLogout(true)}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center gap-2 px-6 border-b border-[--color-border]"
          style={{ background: 'var(--color-surface-2)' }}>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.to} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-600">/</span>}
                <span className={i === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-slate-500'}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Current user chip */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[--color-border]"
            style={{ background: 'var(--color-surface)' }}>
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
              flex items-center justify-center text-[10px] font-bold text-white">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-xs text-slate-300 font-medium">{user?.email}</span>
            <span className={`badge ${roleBadge.cls} text-[9px] py-0`}>{roleBadge.label}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--color-surface)' }}>
          <Outlet />
        </main>
      </div>

      {/* Logout modal */}
      {showLogout && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}
    </div>
  );
}
