import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { login as apiLogin, me as apiMe } from '../services/auth.service.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'sam_token';

/** Decode JWT payload without verifying signature (client-side only). */
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** Returns milliseconds until the JWT expires, or 0 if already expired/invalid. */
function msUntilExpiry(token) {
  const claims = decodeJwt(token);
  if (!claims?.exp) return 0;
  return Math.max(0, claims.exp * 1000 - Date.now());
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const expiryTimerRef        = useRef(null);

  /* ── Schedule auto-logout when token expires ── */
  const scheduleExpiry = useCallback((token, onExpire) => {
    clearTimeout(expiryTimerRef.current);
    const ms = msUntilExpiry(token);
    if (ms > 0) {
      expiryTimerRef.current = setTimeout(onExpire, ms);
    }
  }, []);

  /* ── Logout ── */
  const logout = useCallback(() => {
    clearTimeout(expiryTimerRef.current);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  /* ── Login ── */
  const login = useCallback(async (email, password) => {
    const data  = await apiLogin(email, password);
    const token = data.accessToken ?? data.token ?? data.data?.accessToken ?? data.data?.token;
    if (!token) throw new Error('No token returned from server');

    localStorage.setItem(TOKEN_KEY, token);
    const userData = data.user ?? data.data?.user ?? data.data;
    setUser(userData);
    scheduleExpiry(token, logout);
    return data;
  }, [logout, scheduleExpiry]);

  /* ── Restore session on mount ── */
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);

    if (!stored || msUntilExpiry(stored) <= 0) {
      // Token missing or already expired — clear and skip
      localStorage.removeItem(TOKEN_KEY);
      setLoading(false);
      return;
    }

    apiMe()
      .then((data) => {
        setUser(data.data ?? data);
        scheduleExpiry(stored, logout);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));

    return () => clearTimeout(expiryTimerRef.current);
  }, [logout, scheduleExpiry]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(user),
      isAdmin:      user?.role === 'admin',
      isStaff:      user?.role === 'staff',
      isTechnician: user?.role === 'technician',
      /** Returns true if user has at least one of the given roles */
      hasRole: (...roles) => roles.flat().includes(user?.role),
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
