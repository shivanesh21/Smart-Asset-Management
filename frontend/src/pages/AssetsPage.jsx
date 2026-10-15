import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { useRole } from '../hooks/useRole.js';
import { listAssets, deleteAsset, createAsset, updateAsset } from '../services/assets.service.js';

const ASSET_STATUSES = ['draft', 'in_stock', 'assigned', 'in_maintenance', 'returned', 'lost', 'retired', 'disposed'];
const ASSET_CATEGORIES = ['laptop', 'desktop', 'monitor', 'mobile', 'printer', 'network', 'peripheral', 'vehicle', 'tool', 'other'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-lg space-y-4">
        <div className="flex justify-between items-center border-b border-[--color-border] pb-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel, loading }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-300">{message}</p>
      <div className="flex gap-3 justify-end mt-6">
        <button className="btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
        <button className="btn-primary bg-red-600 hover:bg-red-500" onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}

function AssetForm({ asset, onSubmit, onCancel, loading, error }) {
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    category: asset?.category || 'laptop',
    manufacturer: asset?.manufacturer || '',
    model: asset?.model || '',
    serialNumber: asset?.serialNumber || '',
    department: asset?.department || '',
    status: asset?.status || 'draft',
    purchaseDate: asset?.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
    purchaseCost: asset?.purchaseCost || '',
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (payload.purchaseCost) payload.purchaseCost = Number(payload.purchaseCost);
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name *</label>
          <input className="input" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div>
          <label className="label">Category *</label>
          <select className="input" name="category" value={formData.category} onChange={handleChange} required>
            {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Manufacturer</label>
          <input className="input" name="manufacturer" value={formData.manufacturer} onChange={handleChange} />
        </div>
        <div>
          <label className="label">Model</label>
          <input className="input" name="model" value={formData.model} onChange={handleChange} />
        </div>
        <div>
          <label className="label">Serial Number</label>
          <input className="input" name="serialNumber" value={formData.serialNumber} onChange={handleChange} />
        </div>
        <div>
          <label className="label">Department</label>
          <input className="input" name="department" value={formData.department} onChange={handleChange} />
        </div>
         {!asset && (
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" value={formData.status} onChange={handleChange}>
              {ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Purchase Date</label>
          <input className="input" type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleChange} />
        </div>
        <div>
          <label className="label">Purchase Cost</label>
          <input className="input" type="number" step="0.01" name="purchaseCost" value={formData.purchaseCost} onChange={handleChange} />
        </div>
      </div>
      {error && <div className="text-red-400 text-sm mt-2">{error.message || 'Error saving asset'}</div>}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[--color-border]">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Asset'}
        </button>
      </div>
    </form>
  );
}

export default function AssetsPage() {
  const { isAdmin } = useRole();
  const [params, setParams] = useState({ page: 1, limit: 10, search: '', status: '', category: '' });
  
  // Custom fetch hook using our useFetch from Day 18
  const { data, loading, error, refetch } = useFetch(
    () => listAssets(params),
    [params]
  );

  const [formModal, setFormModal] = useState({ show: false, asset: null });
  const [deleteModal, setDeleteModal] = useState({ show: false, asset: null });
  
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const handlePageChange = (newPage) => {
    setParams(p => ({ ...p, page: newPage }));
  };

  const handleFilterChange = (e) => {
    setParams(p => ({ ...p, [e.target.name]: e.target.value, page: 1 }));
  };

  const handleSave = async (payload) => {
    setActionLoading(true);
    setActionError(null);
    try {
      if (formModal.asset) {
        await updateAsset(formModal.asset.id, payload);
      } else {
        await createAsset(payload);
      }
      setFormModal({ show: false, asset: null });
      refetch();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.asset) return;
    setActionLoading(true);
    try {
      await deleteAsset(deleteModal.asset.id);
      setDeleteModal({ show: false, asset: null });
      refetch();
    } catch (err) {
      alert(err.message || 'Failed to delete asset'); // simple alert for now
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-enter p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Assets</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setFormModal({ show: true, asset: null })}>
            + Add Asset
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex gap-4 flex-wrap">
        <input 
          className="input w-full md:w-64" 
          placeholder="Search by tag, name, model..." 
          name="search" 
          value={params.search} 
          onChange={handleFilterChange} 
        />
        <select className="input w-full md:w-48" name="status" value={params.status} onChange={handleFilterChange}>
          <option value="">All Statuses</option>
          {ASSET_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="input w-full md:w-48" name="category" value={params.category} onChange={handleFilterChange}>
          <option value="">All Categories</option>
          {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[--color-surface-3] text-slate-300">
            <tr>
              <th className="px-4 sm:px-6 py-3 font-medium">Tag</th>
              <th className="px-4 sm:px-6 py-3 font-medium">Name</th>
              <th className="px-4 sm:px-6 py-3 font-medium">Category</th>
              <th className="px-4 sm:px-6 py-3 font-medium">Status</th>
              <th className="px-4 sm:px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {loading && <tr><td colSpan="5" className="px-4 sm:px-6 py-8 text-center text-slate-500">Loading assets...</td></tr>}
            {error && <tr><td colSpan="5" className="px-4 sm:px-6 py-8 text-center text-red-400">Error loading assets.</td></tr>}
            {!loading && !error && data?.data?.length === 0 && (
              <tr><td colSpan="5" className="px-4 sm:px-6 py-8 text-center text-slate-500">No assets found.</td></tr>
            )}
            {!loading && data?.data?.map(asset => (
              <tr key={asset.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 sm:px-6 py-4 font-mono text-indigo-400 hover:text-indigo-300">
                  <Link to={`/assets/${asset.id}`}>{asset.assetId}</Link>
                </td>
                <td className="px-4 sm:px-6 py-4 text-white font-medium">{asset.name}</td>
                <td className="px-4 sm:px-6 py-4 capitalize">{asset.category}</td>
                <td className="px-4 sm:px-6 py-4">
                  <span className={`badge ${asset.status === 'in_stock' ? 'badge-green' : asset.status === 'assigned' ? 'badge-blue' : asset.status === 'in_maintenance' ? 'badge-orange' : 'badge-gray'}`}>
                    {asset.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-4 text-right space-x-3">
                  {isAdmin && (
                    <>
                      <button 
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                        onClick={() => setFormModal({ show: true, asset })}
                      >
                        Edit
                      </button>
                      <button 
                        className="text-red-400 hover:text-red-300 font-medium"
                        onClick={() => setDeleteModal({ show: true, asset })}
                      >
                        Delete
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
      {!loading && data?.meta && (
        <div className="flex justify-between items-center text-sm text-slate-400">
          <div>
            Showing {(data.meta.page - 1) * data.meta.limit + 1} to {Math.min(data.meta.page * data.meta.limit, data.meta.total)} of {data.meta.total} entries
          </div>
          <div className="flex gap-2">
            <button 
              className="btn-ghost py-1 px-3 text-xs" 
              disabled={data.meta.page === 1}
              onClick={() => handlePageChange(data.meta.page - 1)}
            >
              Previous
            </button>
            <button 
              className="btn-ghost py-1 px-3 text-xs" 
              disabled={data.meta.page >= data.meta.totalPages}
              onClick={() => handlePageChange(data.meta.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {formModal.show && (
        <Modal 
          title={formModal.asset ? `Edit Asset: ${formModal.asset.assetId}` : 'Add New Asset'} 
          onClose={() => setFormModal({ show: false, asset: null })}
        >
          <AssetForm 
            asset={formModal.asset} 
            onSubmit={handleSave} 
            onCancel={() => setFormModal({ show: false, asset: null })} 
            loading={actionLoading}
            error={actionError}
          />
        </Modal>
      )}

      {deleteModal.show && (
        <ConfirmModal 
          title="Delete Asset"
          message={`Are you sure you want to delete ${deleteModal.asset.assetId} (${deleteModal.asset.name})? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal({ show: false, asset: null })}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
