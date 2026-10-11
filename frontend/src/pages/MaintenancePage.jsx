import { useState } from 'react';
import { useFetch } from '../hooks/useFetch.js';
import { useRole } from '../hooks/useRole.js';
import { useToast } from '../context/ToastContext.jsx';
import { 
  listMaintenance, 
  createMaintenance, 
  assignTechnician, 
  updateMaintenanceStatus 
} from '../services/maintenance.service.js';
import { listAssets } from '../services/assets.service.js';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['requested', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'];

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

  // Fetch active/allocated assets (or we can just fetch all and let staff search)
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

function AssignTechnicianModal({ request, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [technicianId, setTechnicianId] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await assignTechnician(request.id, { technicianId });
      addToast('Technician assigned successfully.', 'success');
      onSuccess();
    } catch (err) {
      addToast(err.message || 'Failed to assign technician.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-300">
        Assigning technician to issue: <span className="font-semibold text-white">{request.title}</span>
      </p>
      <div>
        <label className="label">Technician ID / Email</label>
        <input 
          className="input" 
          value={technicianId} 
          onChange={(e) => setTechnicianId(e.target.value)} 
          required 
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-[--color-border]">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </div>
    </form>
  );
}

function UpdateStatusModal({ request, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    status: request.status || 'in_progress', 
    notes: '' 
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateMaintenanceStatus(request.id, formData);
      addToast('Status updated successfully.', 'success');
      onSuccess();
    } catch (err) {
      addToast(err.message || 'Failed to update status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-300">
        Updating status for: <span className="font-semibold text-white">{request.title}</span>
      </p>
      <div>
        <label className="label">New Status</label>
        <select 
          className="input" 
          value={formData.status} 
          onChange={(e) => setFormData({ ...formData, status: e.target.value })} 
        >
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Update Notes / Resolution</label>
        <textarea 
          className="input" 
          rows="3" 
          value={formData.notes} 
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
          placeholder="Briefly describe the work done or reason for update..."
          required={formData.status === 'completed'}
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-[--color-border]">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Updating...' : 'Update Status'}
        </button>
      </div>
    </form>
  );
}

export default function MaintenancePage() {
  const { isAdmin, isStaff, isTechnician } = useRole();
  const [params, setParams] = useState({ page: 1, limit: 10, status: '', priority: '' });
  
  const { data: result, loading, error, refetch } = useFetch(
    () => listMaintenance(params),
    [params]
  );
  
  const maintenanceList = result?.data || result || [];
  const pagination = result?.meta;

  const [modalType, setModalType] = useState(null); // 'report', 'assign', 'update'
  const [selectedReq, setSelectedReq] = useState(null);

  const closeModals = () => {
    setModalType(null);
    setSelectedReq(null);
  };

  const handleSuccess = () => {
    closeModals();
    refetch();
  };

  return (
    <div className="page-enter p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Maintenance</h1>
        {(isAdmin || isStaff) && (
          <button className="btn-primary" onClick={() => setModalType('report')}>
            + Report Issue
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex gap-4">
        <select 
          className="input w-full md:w-48" 
          value={params.status} 
          onChange={(e) => setParams({ ...params, status: e.target.value, page: 1 })}
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
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
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {loading && <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">Loading maintenance records...</td></tr>}
            {error && <tr><td colSpan="7" className="px-6 py-8 text-center text-red-400">Failed to load maintenance records.</td></tr>}
            {!loading && !error && maintenanceList.length === 0 && (
              <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">No maintenance records found.</td></tr>
            )}
            {!loading && maintenanceList.map(req => (
              <tr key={req.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-400">{req.maintenanceId || req.id.substring(0,8)}</td>
                <td className="px-6 py-4 font-mono text-indigo-400">{req.asset?.assetTag || req.assetId}</td>
                <td className="px-6 py-4 text-white font-medium truncate max-w-[200px]" title={req.title}>{req.title}</td>
                <td className="px-6 py-4">
                  <span className={`badge ${req.status === 'completed' ? 'badge-green' : req.status === 'in_progress' ? 'badge-blue' : req.status === 'requested' ? 'badge-gray' : 'badge-orange'}`}>
                    {req.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${req.priority === 'critical' ? 'badge-red' : req.priority === 'high' ? 'badge-orange' : req.priority === 'medium' ? 'badge-blue' : 'badge-gray'}`}>
                    {req.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-300">{req.technician?.email || req.technicianId || '-'}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  {isAdmin && req.status === 'requested' && (
                    <button 
                      className="text-indigo-400 hover:text-indigo-300 font-medium"
                      onClick={() => { setSelectedReq(req); setModalType('assign'); }}
                    >
                      Assign
                    </button>
                  )}
                  {(isTechnician || isAdmin) && req.status !== 'completed' && (
                    <button 
                      className="text-emerald-400 hover:text-emerald-300 font-medium"
                      onClick={() => { setSelectedReq(req); setModalType('update'); }}
                    >
                      Update
                    </button>
                  )}
                </td>
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

      {/* Modals */}
      {modalType === 'report' && (
        <Modal title="Report Issue" onClose={closeModals}>
          <ReportIssueModal onClose={closeModals} onSuccess={handleSuccess} />
        </Modal>
      )}
      
      {modalType === 'assign' && selectedReq && (
        <Modal title="Assign Technician" onClose={closeModals}>
          <AssignTechnicianModal request={selectedReq} onClose={closeModals} onSuccess={handleSuccess} />
        </Modal>
      )}

      {modalType === 'update' && selectedReq && (
        <Modal title="Update Maintenance Status" onClose={closeModals}>
          <UpdateStatusModal request={selectedReq} onClose={closeModals} onSuccess={handleSuccess} />
        </Modal>
      )}
    </div>
  );
}
