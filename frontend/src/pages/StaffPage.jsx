import { useMemo, useState } from 'react';
import { useFetch } from '../hooks/useFetch.js';
import { useRole } from '../hooks/useRole.js';
import { listUsers, listActivity } from '../services/users.service.js';

const ROLE_BADGE = {
  admin:      { cls: 'badge-blue',   label: 'Admin' },
  staff:      { cls: 'badge-green',  label: 'Staff' },
  technician: { cls: 'badge-yellow', label: 'Tech' },
};

const RESOURCES = ['asset', 'allocation', 'maintenance', 'user', 'auth'];

const RESOURCE_BADGE = {
  asset:       'badge-blue',
  allocation:  'badge-green',
  maintenance: 'badge-orange',
  user:        'badge-purple',
  auth:        'badge-gray',
};

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function ActionBadge({ action, resource }) {
  const cls = RESOURCE_BADGE[resource] ?? 'badge-gray';
  return <span className={`badge ${cls} text-[10px]`}>{action}</span>;
}

export default function StaffPage() {
  const { isAdmin } = useRole();

  const [staffParams, setStaffParams] = useState({ page: 1, limit: 50, role: '', search: '' });
  const [activityParams, setActivityParams] = useState({
    page: 1, limit: 20, actorEmail: '', resource: '', search: '',
  });

  const {
    data: usersData, loading: usersLoading, error: usersError,
  } = useFetch(() => listUsers(staffParams), [staffParams]);

  const {
    data: activityData, loading: activityLoading, error: activityError, refetch: refetchActivity,
  } = useFetch(() => listActivity(activityParams), [activityParams]);

  const users = usersData?.data ?? [];
  const usersMeta = usersData?.meta;
  const activities = activityData?.data ?? [];
  const activityMeta = activityData?.meta;

  // Staff who have signed in at least once (used for the user filter dropdown).
  const signedInUsers = useMemo(
    () => users.filter((u) => u.lastLoginAt).sort((a, b) =>
      new Date(b.lastLoginAt) - new Date(a.lastLoginAt)),
    [users]
  );

  function setStaffFilter(patch) {
    setStaffParams((p) => ({ ...p, ...patch, page: patch.page ?? 1 }));
  }
  function setActivityFilter(patch) {
    setActivityParams((p) => ({ ...p, ...patch, page: patch.page ?? 1 }));
  }

  if (!isAdmin) {
    return (
      <div className="page-enter p-4 sm:p-6 lg:p-8">
        <div className="card p-6 sm:p-8 text-center text-slate-400">
          You need an administrator account to view staff activity.
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Staff & Activity</h1>
        <p className="text-sm text-slate-400 mt-1">
          Everyone who has signed in, and a record of what they did.
        </p>
      </div>

      {/* ── Staff accounts ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-white">Staff accounts</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              className="input w-full sm:w-56"
              placeholder="Search name / email…"
              value={staffParams.search}
              onChange={(e) => setStaffFilter({ search: e.target.value })}
            />
            <select
              className="input w-full sm:w-40"
              value={staffParams.role}
              onChange={(e) => setStaffFilter({ role: e.target.value })}
            >
              <option value="">All roles</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="technician">Technician</option>
            </select>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[--color-surface-3] text-slate-300">
              <tr>
                <th className="px-4 sm:px-6 py-3 font-medium">Name</th>
                <th className="px-4 sm:px-6 py-3 font-medium">Email</th>
                <th className="px-4 sm:px-6 py-3 font-medium">Role</th>
                <th className="px-4 sm:px-6 py-3 font-medium">Department</th>
                <th className="px-4 sm:px-6 py-3 font-medium">Last login</th>
                <th className="px-4 sm:px-6 py-3 font-medium">Status</th>
                <th className="px-4 sm:px-6 py-3 font-medium text-right">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {usersLoading && (
                <tr><td colSpan="7" className="px-4 sm:px-6 py-8 text-center text-slate-500">Loading staff…</td></tr>
              )}
              {usersError && (
                <tr><td colSpan="7" className="px-4 sm:px-6 py-8 text-center text-red-400">Could not load staff.</td></tr>
              )}
              {!usersLoading && !usersError && users.length === 0 && (
                <tr><td colSpan="7" className="px-4 sm:px-6 py-8 text-center text-slate-500">No users found.</td></tr>
              )}
              {!usersLoading && users.map((u) => {
                const badge = ROLE_BADGE[u.role] ?? { cls: 'badge-gray', label: u.role };
                return (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 sm:px-6 py-4 text-white font-medium">{u.name ?? '—'}</td>
                    <td className="px-4 sm:px-6 py-4 text-slate-300">{u.email}</td>
                    <td className="px-4 sm:px-6 py-4"><span className={`badge ${badge.cls} text-[10px]`}>{badge.label}</span></td>
                    <td className="px-4 sm:px-6 py-4 text-slate-400">{u.department ?? '—'}</td>
                    <td className="px-4 sm:px-6 py-4 text-slate-400">{fmt(u.lastLoginAt)}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`badge ${u.isActive ? 'badge-green' : 'badge-gray'} text-[10px]`}>
                        {u.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <button
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                        onClick={() => setActivityFilter({ actorEmail: u.email, page: 1 })}
                      >
                        View activity
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!usersLoading && usersMeta && usersMeta.total > usersMeta.limit && (
          <div className="flex justify-between items-center text-sm text-slate-400">
            <span>{usersMeta.total} users</span>
            <div className="flex gap-2">
              <button className="btn-ghost py-1 px-3 text-xs" disabled={usersMeta.page === 1}
                onClick={() => setStaffFilter({ page: usersMeta.page - 1 })}>Previous</button>
              <button className="btn-ghost py-1 px-3 text-xs" disabled={usersMeta.page >= usersMeta.totalPages}
                onClick={() => setStaffFilter({ page: usersMeta.page + 1 })}>Next</button>
            </div>
          </div>
        )}
      </section>

      {/* ── Activity feed ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-white">Activity log</h2>
          <div className="flex gap-3 flex-wrap items-center">
            <select
              className="input w-full sm:w-56"
              value={activityParams.actorEmail}
              onChange={(e) => setActivityFilter({ actorEmail: e.target.value })}
            >
              <option value="">All users</option>
              {signedInUsers.map((u) => (
                <option key={u.id} value={u.email}>{u.email}</option>
              ))}
            </select>
            <select
              className="input w-full sm:w-40"
              value={activityParams.resource}
              onChange={(e) => setActivityFilter({ resource: e.target.value })}
            >
              <option value="">All areas</option>
              {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              className="input w-full sm:w-56"
              placeholder="Search summary / email…"
              value={activityParams.search}
              onChange={(e) => setActivityFilter({ search: e.target.value })}
            />
            <button className="btn-ghost py-2 px-3 text-xs" onClick={() => refetchActivity()}>Refresh</button>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[--color-surface-3] text-slate-300">
              <tr>
                <th className="px-4 sm:px-6 py-3 font-medium">When</th>
                <th className="px-4 sm:px-6 py-3 font-medium">User</th>
                <th className="px-4 sm:px-6 py-3 font-medium">Action</th>
                <th className="px-4 sm:px-6 py-3 font-medium">What happened</th>
                <th className="px-4 sm:px-6 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {activityLoading && (
                <tr><td colSpan="5" className="px-4 sm:px-6 py-8 text-center text-slate-500">Loading activity…</td></tr>
              )}
              {activityError && (
                <tr><td colSpan="5" className="px-4 sm:px-6 py-8 text-center text-red-400">Could not load activity.</td></tr>
              )}
              {!activityLoading && !activityError && activities.length === 0 && (
                <tr><td colSpan="5" className="px-4 sm:px-6 py-8 text-center text-slate-500">No activity recorded yet.</td></tr>
              )}
              {!activityLoading && activities.map((a) => (
                <tr key={a.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 sm:px-6 py-4 text-slate-400">{fmt(a.createdAt)}</td>
                  <td className="px-4 sm:px-6 py-4 text-slate-300">
                    {a.actorEmail ?? '—'}
                    {a.actorRole && <span className="ml-2 text-[10px] text-slate-500 uppercase">{a.actorRole}</span>}
                  </td>
                  <td className="px-4 sm:px-6 py-4"><ActionBadge action={a.action} resource={a.resource} /></td>
                  <td className="px-4 sm:px-6 py-4 text-white">{a.summary ?? a.action}</td>
                  <td className="px-4 sm:px-6 py-4 text-slate-500 text-xs">{a.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!activityLoading && activityMeta && activityMeta.total > 0 && (
          <div className="flex justify-between items-center text-sm text-slate-400">
            <span>
              Showing {((activityMeta.page - 1) * activityMeta.limit) + 1} to{' '}
              {Math.min(activityMeta.page * activityMeta.limit, activityMeta.total)} of {activityMeta.total}
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost py-1 px-3 text-xs" disabled={activityMeta.page === 1}
                onClick={() => setActivityFilter({ page: activityMeta.page - 1 })}>Previous</button>
              <button className="btn-ghost py-1 px-3 text-xs" disabled={activityMeta.page >= activityMeta.totalPages}
                onClick={() => setActivityFilter({ page: activityMeta.page + 1 })}>Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
