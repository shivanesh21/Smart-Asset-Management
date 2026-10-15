import { useParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { getAsset } from '../services/assets.service.js';
import { allocationHistory } from '../services/allocations.service.js';
import { listMaintenance } from '../services/maintenance.service.js';

export default function AssetDetailsPage() {
  const { id } = useParams();

  const { data: assetObj, loading: assetLoading, error: assetError } = useFetch(
    () => getAsset(id),
    [id]
  );
  
  // assetObj.data usually contains the actual asset object based on how getAsset might be formatted
  const asset = assetObj?.data || assetObj;

  const { data: allocObj, loading: allocLoading } = useFetch(
    () => allocationHistory(id),
    [id]
  );
  const allocations = allocObj?.data || allocObj || [];

  const { data: maintObj, loading: maintLoading } = useFetch(
    () => listMaintenance({ assetId: asset?.id || id }), // try to use resolved ID
    [asset?.id, id]
  );
  const maintenance = maintObj?.data || maintObj || [];

  if (assetLoading) {
    return <div className="p-4 sm:p-6 lg:p-8 text-slate-400">Loading asset details...</div>;
  }

  if (assetError) {
    return <div className="p-4 sm:p-6 lg:p-8 text-red-400">Error loading asset: {assetError.message}</div>;
  }

  if (!asset) {
    return <div className="p-4 sm:p-6 lg:p-8 text-slate-400">Asset not found.</div>;
  }

  return (
    <div className="page-enter p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 flex-wrap">
          {asset.name}
          <span className="badge badge-gray font-mono text-sm">{asset.assetId}</span>
        </h1>
        <span className={`badge ${asset.status === 'in_stock' ? 'badge-green' : asset.status === 'assigned' ? 'badge-blue' : asset.status === 'in_maintenance' ? 'badge-orange' : 'badge-gray'}`}>
          {asset.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="card p-5 space-y-4 col-span-1">
          <h2 className="text-lg font-semibold text-white border-b border-[--color-border] pb-2">Asset Details</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="block text-slate-500 mb-0.5">Category</span>
              <span className="text-slate-200 capitalize">{asset.category}</span>
            </div>
            <div>
              <span className="block text-slate-500 mb-0.5">Make / Model</span>
              <span className="text-slate-200">{asset.manufacturer || '-'} / {asset.model || '-'}</span>
            </div>
            <div>
              <span className="block text-slate-500 mb-0.5">Serial Number</span>
              <span className="text-slate-200 font-mono text-xs">{asset.serialNumber || '-'}</span>
            </div>
            <div>
              <span className="block text-slate-500 mb-0.5">Department</span>
              <span className="text-slate-200">{asset.department || '-'}</span>
            </div>
            {asset.purchaseDate && (
              <div>
                <span className="block text-slate-500 mb-0.5">Purchase Date</span>
                <span className="text-slate-200">{new Date(asset.purchaseDate).toLocaleDateString()}</span>
              </div>
            )}
            {asset.purchaseCost !== undefined && (
              <div>
                <span className="block text-slate-500 mb-0.5">Purchase Cost</span>
                <span className="text-slate-200">{asset.currency || 'INR'} {asset.purchaseCost}</span>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Allocation History */}
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-[--color-border] pb-2">Allocation History</h2>
            {allocLoading ? (
              <p className="text-slate-400 text-sm">Loading allocations...</p>
            ) : allocations.length === 0 ? (
              <p className="text-slate-500 text-sm">No allocation history found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-slate-400 pb-2">
                    <tr>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">User</th>
                      <th className="pb-2 font-medium">Allocated At</th>
                      <th className="pb-2 font-medium">Returned At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--color-border]">
                    {allocations.map(a => (
                      <tr key={a.id} className="text-slate-300">
                        <td className="py-2">
                          <span className={`badge ${a.status === 'active' ? 'badge-blue' : 'badge-gray'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-2">{a.user?.email || a.user || '-'}</td>
                        <td className="py-2">{new Date(a.allocatedAt).toLocaleDateString()}</td>
                        <td className="py-2">{a.returnedAt ? new Date(a.returnedAt).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Maintenance History */}
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-[--color-border] pb-2">Maintenance History</h2>
            {maintLoading ? (
              <p className="text-slate-400 text-sm">Loading maintenance...</p>
            ) : maintenance.length === 0 ? (
              <p className="text-slate-500 text-sm">No maintenance history found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-slate-400 pb-2">
                    <tr>
                      <th className="pb-2 font-medium">ID</th>
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Priority</th>
                      <th className="pb-2 font-medium">Reported At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--color-border]">
                    {maintenance.map(m => (
                      <tr key={m.id} className="text-slate-300">
                        <td className="py-2 font-mono text-xs">{m.maintenanceId}</td>
                        <td className="py-2">{m.title}</td>
                        <td className="py-2">
                          <span className={`badge ${m.status === 'completed' ? 'badge-green' : m.status === 'in_progress' ? 'badge-blue' : 'badge-orange'}`}>
                            {m.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`badge ${m.priority === 'high' || m.priority === 'critical' ? 'badge-red' : 'badge-gray'}`}>
                            {m.priority}
                          </span>
                        </td>
                        <td className="py-2">{new Date(m.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
