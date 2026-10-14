import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { useRole } from '../hooks/useRole.js';
import { useToast } from '../context/ToastContext.jsx';
import { listMaintenance, createMaintenance } from '../services/maintenance.service.js';
import { listAssets } from '../services/assets.service.js';
import MaintenanceWorkOrder from '../components/MaintenanceWorkOrder.jsx';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['requested', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'];

const STATUS_BADGE = {
  requested:   'badge-gray',
  scheduled:   'badge-yellow',
  in_progress: 'badge-blue',
  on_hold:     'badge-orange',
  completed:   'badge-green',
  cancelled:   'badge-red',
};

const PRIORITY_BADGE = {
  low:      'badge-gray',
  medium:   'badge-blue',
  high:     'badge-orange',
  critical: 'badge-red',
};

const label = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-');

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center border-b border-[--color-border] pb-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReportIssueModal({ onClose, onSuccess }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ assetId: '', title: '', description: '', priority: 'medium' });

  // Fetch assets so staff/technicians can pick the affected one.
  const { data: assetsObj, loading: assetsLoading } = useFetch(() => listAssets({ limit: 100 }), []);
  const assets = assetsObj?.data || assetsObj || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createMaintenance(formData);
      addToast('Issue reported successfully.', 'success');
      onSuccess();
    } catch (err) {
      addToast(err.message || 'Failed to report issue.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Asset</label>
        <select
          className="input"
          value={formData.assetId}
          onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
          required
        >
          <option value="">-- Select Asset --</option>
          {assetsLoading ? <option disabled>Loading...</option> : assets.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.assetId})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Title / Summary</label>
        <input
          className="input"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="input"
          rows="3"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="label">Priority</label>
        <select
          className="input"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-[--color-border]">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </form>
  );
}

const TAB_CLS = (active) =>
  `flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
    active ? 'bg-indigo-500 text-on-color shadow' : 'text-slate-400 hover:text-white'
  }`;

export default function MaintenancePage() {
  const { isAdmin, isStaff } = useRole();
  const [tab, setTab] = useState('list'); // 'list' | 'lookup'
  const [params, setParams] = useState({ page: 1, limit: 10, status: '', priority: '' });
  const [reqId, setReqId] = useState('');       // raw input
  const [lookupId, setLookupId] = useState(''); // submitted Req ID

  const { data: result, loading, error, refetch } = useFetch(
    () => listMaintenance(params),
    [params]
  );

  const maintenanceList = result?.data || result || [];
  const pagination = result?.meta;

  const [showReport, setShowReport] = useState(false);

  function handleLookup(e) {
    e.preventDefault();
    const value = reqId.trim();
    if (value) setLookupId(value);
  }

  return (
    <div className="page-enter p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Maintenance</h1>
        {(isAdmin || isStaff) && (
          <button className="btn-primary" onClick={() => setShowReport(true)}>
            + Report Issue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 rounded-xl gap-1 w-full sm:w-80" style={{ background: 'var(--color-surface)' }}>
        <button type="button" id="tab-all-requests" className={TAB_CLS(tab === 'list')} onClick={() => setTab('list')}>
          All Requests
        </button>
        <button type="button" id="tab-lookup" className={TAB_CLS(tab === 'lookup')} onClick={() => setTab('lookup')}>
          Find by Req ID
        </button>
      </div>

      {/* ── Tab: all requests ── */}
      {tab === 'list' && (
        <>
          <p className="text-sm text-slate-400">
            Select a <span className="text-slate-300 font-medium">Req ID</span> to open the work order,
            or use the <span className="text-slate-300 font-medium">Find by Req ID</span> tab.
          </p>

          {/* Filters */}
          <div className="card p-4 flex gap-4">
            <select
              className="input w-full md:w-48"
              value={params.status}
              onChange={(e) => setParams({ ...params, status: e.target.value, page: 1 })}
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{label(s).toUpperCase()}</option>)}
            </select>
            <select
              className="input w-full md:w-48"
              value={params.priority}
              onChange={(e) => setParams({ ...params, priority: e.target.value, page: 1 })}
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--color-surface-3] text-slate-300">
                <tr>
                  <th className="px-6 py-3 font-medium">Req ID</th>
                  <th className="px-6 py-3 font-medium">Asset</th>
                  <th className="px-6 py-3 font-medium">Issue</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Priority</th>
                  <th className="px-6 py-3 font-medium">Technician</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--color-border]">
                {loading && <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading maintenance records...</td></tr>}
                {error && <tr><td colSpan="6" className="px-6 py-8 text-center text-red-400">Failed to load maintenance records.</td></tr>}
                {!loading && !error && maintenanceList.length === 0 && (
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No maintenance records found.</td></tr>
                )}
                {!loading && maintenanceList.map(req => (
                  <tr key={req.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">
                      <Link
                        to={`/maintenance/${req.maintenanceId || req.id}`}
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                        title="Open work order"
                      >
                        {req.maintenanceId || req.id.substring(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-indigo-400">{req.asset?.assetTag || req.assetId}</td>
                    <td className="px-6 py-4 text-white font-medium truncate max-w-[200px]" title={req.title}>{req.title}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${STATUS_BADGE[req.status] || 'badge-gray'}`}>
                        {label(req.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${PRIORITY_BADGE[req.priority] || 'badge-gray'}`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{req.technician?.email || req.technicianId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && pagination && (
            <div className="flex justify-between items-center text-sm text-slate-400">
              <div>
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-ghost py-1 px-3 text-xs"
                  disabled={pagination.page === 1}
                  onClick={() => setParams({ ...params, page: pagination.page - 1 })}
                >
                  Previous
                </button>
                <button
                  className="btn-ghost py-1 px-3 text-xs"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setParams({ ...params, page: pagination.page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: find by Req ID ── */}
      {tab === 'lookup' && (
        <div className="space-y-6">
          <form onSubmit={handleLookup} className="card p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="label" htmlFor="req-lookup">Enter Req ID</label>
              <input
                id="req-lookup"
                className="input"
                placeholder="e.g. MNT-2026-0001"
                value={reqId}
                onChange={(e) => setReqId(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!reqId.trim()}>Find</button>
            {lookupId && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setReqId(''); setLookupId(''); }}
              >
                Clear
              </button>
            )}
          </form>

          {lookupId ? (
            <MaintenanceWorkOrder id={lookupId} />
          ) : (
            <p className="text-slate-500 text-sm">
              Enter a Req ID (e.g. <span className="font-mono text-slate-400">MNT-2026-0001</span>) and press
              Find to view the full work order and change its status.
            </p>
          )}
        </div>
      )}

      {/* Report Issue modal */}
      {showReport && (
        <Modal title="Report Issue" onClose={() => setShowReport(false)}>
          <ReportIssueModal
            onClose={() => setShowReport(false)}
            onSuccess={() => { setShowReport(false); refetch(); }}
          />
        </Modal>
      )}
    </div>
  );
}
