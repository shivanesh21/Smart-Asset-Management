import { useAuth } from '../context/AuthContext.jsx';

/**
 * Convenience hook — returns a `can(role)` helper and individual flags.
 *
 * @example
 * const { isAdmin, can } = useRole();
 * if (can('admin', 'staff')) { ... }
 */
export function useRole() {
  const { user, isAdmin, isStaff, isTechnician, hasRole } = useAuth();
  return {
    role: user?.role ?? null,
    isAdmin,
    isStaff,
    isTechnician,
    can: (...roles) => hasRole(...roles),
  };
}
