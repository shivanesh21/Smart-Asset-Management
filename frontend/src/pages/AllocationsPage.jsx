import { useState } from 'react';
import { useFetch } from '../hooks/useFetch.js';
import { useRole } from '../hooks/useRole.js';
import { useToast } from '../context/ToastContext.jsx';
import { 
  listAllocations, 
  createAllocation, 
  returnAllocation, 
  transferAllocation 
} from '../services/allocations.service.js';
import { listAssets } from '../services/assets.service.js';

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

function AssignModal({ onClose, onSuccess }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ assetId: '', userId: '', department: '' });

  // Fetch only in_stock assets
  const { data: assetsObj, loading: assetsLoading } = useFetch(() => listAssets({ status: 'in_stock' }), []);
  const assets = assetsObj?.data || assetsObj || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createAllocation(formData);
      addToast('Asset assigned successfully.', 'success');
      onSuccess();
    } catch (err) {
      addToast(err.message || 'Failed to assign asset.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Select Asset</label>
        <select 
          className="input" 
          value={formData.assetId} 
          onChange={(e) => setFormData({ ...formData, assetId: e.target.value })} 
          required
        >
          <option value="">-- Choose Asset --</option>
          {assetsLoading ? <option disabled>Loading...</option> : assets.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.assetId})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">User ID / Email</label>
        <input 
          className="input" 
          value={formData.userId} 
          onChange={(e) => setFormData({ ...formData, userId: e.target.value })} 
          required 
        />
      </div>
      <div>
        <label className="label">Department</label>
        <input 
          className="input" 
          value={formData.department} 
          onChange={(e) => setFormData({ ...formData, department: e.target.value })} 
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

function ReturnModal({ allocation, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await returnAllocation(allocation.id, { notes });
      addToast('Asset returned successfully.', 'success');
      onSuccess();
    } catch (err) {
      addToast(err.message || 'Failed to return asset.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-300">
        Returning asset <span className="font-mono text-indigo-400">{allocation.asset?.assetTag || allocation.assetId}</span> from user <span className="font-semibold text-white">{allocation.user?.email || allocation.userId}</span>.
      </p>
      <div>
        <label className="label">Return Notes (Optional)</label>
        <textarea className="input" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-[--color-border]">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Returning...' : 'Confirm Return'}
        </button>
      </div>
    </form>
  );
}

function TransferModal({ allocation, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ newUserId: '', newDepartment: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await transferAllocation(allocation.id, formData);
      addToast('Asset transferred successfully.', 'success');
      onSuccess();
    } catch (err) {
      addToast(err.message || 'Failed to transfer asset.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-300">
        Transferring asset <span className="font-mono text-indigo-400">{allocation.asset?.assetTag || allocation.assetId}</span> to a new user.
      </p>
      <div>
        <label className="label">New User ID / Email</label>
        <input 
          className="input" 
          value={formData.newUserId} 
          onChange={(e) => setFormData({ ...formData, newUserId: e.target.value })} 
          required 
        />
      </div>
      <div>
        <label className="label">New Department</label>
        <input 
          className="input" 
          value={formData.newDepartment} 
          onChange={(e) => setFormData({ ...formData, newDepartment: e.target.value })} 
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-[--color-border]">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Transferring...' : 'Confirm Transfer'}
        </button>
      </div>
    </form>
  );
}

export default function AllocationsPage() {
  const { isAdmin, isStaff } = useRole();
  const [params, setParams] = useState({ page: 1, limit: 10, status: '' });
  
  const { data: result, loading, error, refetch } = useFetch(
    () => listAllocations(params),
    [params]
  );
  
  const allocations = result?.data || result || [];
  const pagination = result?.meta;

  const [modalType, setModalType] = useState(null); // 'assign', 'return', 'transfer'
  const [selectedAlloc, setSelectedAlloc] = useState(null);

  const closeModals = () => {
    setModalType(null);
    setSelectedAlloc(null);
  };

  const handleSuccess = () => {
    closeModals();
    refetch();
  };

  return (
    <div className="page-enter p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Allocations</h1>
        {(isAdmin || isStaff) && (
          <button className="btn-primary" onClick={() => setModalType('assign')}>
            + Assign Asset
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="card p-4 flex gap-4">
        <select 
          className="input w-full md:w-48" 
          value={params.status} 
          onChange={(e) => setParams({ ...params, status: e.target.value, page: 1 })}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[--color-surface-3] text-slate-300">
            <tr>
              <th className="px-4 sm:px-6 py-3 font-medium">Asset ID/Tag</th>
              <th className="px-4 sm:px-6 py-3 font-medium">User</th>
              <th className="px-4 sm:px-6 py-3 font-medium">Department</th>
              <th className="px-4 sm:px-6 py-3 font-medium">Status</th>
              <th className="px-4 sm:px-6 py-3 font-medium">Allocated At</th>
              <th className="px-4 sm:px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {loading && <tr><td colSpan="6" className="px-4 sm:px-6 py-8 text-center text-slate-500">Loading allocations...</td></tr>}
            {error && <tr><td colSpan="6" className="px-4 sm:px-6 py-8 text-center text-red-400">Failed to load allocations.</td></tr>}
            {!loading && !error && allocations.length === 0 && (
              <tr><td colSpan="6" className="px-4 sm:px-6 py-8 text-center text-slate-500">No allocations found.</td></tr>
            )}
            {!loading && allocations.map(alloc => (
              <tr key={alloc.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 sm:px-6 py-4 font-mono text-indigo-400">{alloc.asset?.assetTag || alloc.assetId}</td>
                <td className="px-4 sm:px-6 py-4 text-white font-medium">{alloc.user?.email || alloc.userId}</td>
                <td className="px-4 sm:px-6 py-4 text-slate-300">{alloc.department || '-'}</td>
                <td className="px-4 sm:px-6 py-4">
                  <span className={`badge ${alloc.status === 'active' ? 'badge-blue' : 'badge-gray'}`}>
                    {alloc.status}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-4 text-slate-300">
                  {new Date(alloc.allocatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 sm:px-6 py-4 text-right space-x-3">
                  {alloc.status === 'active' && (isAdmin || isStaff) && (
                    <>
                      <button 
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                        onClick={() => { setSelectedAlloc(alloc); setModalType('transfer'); }}
                      >
                        Transfer
                      </button>
                      <button 
                        className="text-orange-400 hover:text-orange-300 font-medium"
                        onClick={() => { setSelectedAlloc(alloc); setModalType('return'); }}
                      >
                        Return
                      </button>
                    </>
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
      {modalType === 'assign' && (
        <Modal title="Assign Asset" onClose={closeModals}>
          <AssignModal onClose={closeModals} onSuccess={handleSuccess} />
        </Modal>
      )}
      
      {modalType === 'return' && selectedAlloc && (
        <Modal title="Return Asset" onClose={closeModals}>
          <ReturnModal allocation={selectedAlloc} onClose={closeModals} onSuccess={handleSuccess} />
        </Modal>
      )}

      {modalType === 'transfer' && selectedAlloc && (
        <Modal title="Transfer Asset" onClose={closeModals}>
          <TransferModal allocation={selectedAlloc} onClose={closeModals} onSuccess={handleSuccess} />
        </Modal>
      )}
    </div>
  );
}
