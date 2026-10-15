import { useFetch } from '../hooks/useFetch.js';
import { getAssetStats } from '../services/assets.service.js';
import { getMaintenanceStats } from '../services/maintenance.service.js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';

// Helper for a simple loading spinner (Tailwind CSS)
function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Normalises a stats bucket that may be an array of {_id,count} or an object map {key: count}. */
function toBuckets(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => ({
      key: item._id ?? item.status ?? item.category ?? item.department ?? item.assetTag ?? 'unknown',
      count: item.count ?? item.total ?? 0,
    }));
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, count]) => ({ key, count: count ?? 0 }));
  }
  return [];
}

export default function ReportsPage() {
  const { data: assetStatsObj, loading: assetLoading, error: assetError } = useFetch(getAssetStats, []);
  const { data: maintStatsObj, loading: maintLoading, error: maintError } = useFetch(getMaintenanceStats, []);

  const assetStats = assetStatsObj?.data || assetStatsObj || {};
  const maintStats = maintStatsObj?.data || maintStatsObj || {};

  // ---------- Assets by Department ----------
  const deptData = toBuckets(assetStats.departmentCounts ?? assetStats.byDepartment).map((b) => ({
    name: b.key || 'Unassigned',
    value: b.count,
  }));

  // ---------- Assets by Category ----------
  const categoryData = toBuckets(assetStats.categoryCounts ?? assetStats.byCategory).map((b) => ({
    name: String(b.key).toUpperCase(),
    value: b.count,
  }));

  // ---------- Maintenance Frequency (Top assets with most maintenance) ----------
  const maintenanceFreq = toBuckets(maintStats.byAsset ?? maintStats.assetFrequency).map((b) => ({
    name: String(b.key),
    value: b.count,
  }));

  // Sort descending and keep top 10 for readability
  const topMaintenance = [...maintenanceFreq].sort((a, b) => b.value - a.value).slice(0, 10);

  // ---------- Maintenance Status Distribution (pie) ----------
  const maintStatusData = toBuckets(maintStats.statusCounts ?? maintStats.byStatus).map((b) => ({
    name: String(b.key).replace('_', ' '),
    value: b.count,
  }));

  // ----- Render helpers -----
  const renderBarChart = (data, title, xLabel = 'Count') => (
    <div className="card p-4 h-80 flex flex-col">
      <h2 className="text-sm font-semibold text-white mb-2">{title}</h2>
      <div className="flex-1">
        {assetLoading ? (
          <Spinner />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                cursor={{ fill: '#334155', opacity: 0.2 }}
              />
              <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  const renderLineChart = (data, title) => (
    <div className="card p-4 h-80 flex flex-col">
      <h2 className="text-sm font-semibold text-white mb-2">{title}</h2>
      <div className="flex-1">
        {maintLoading ? (
          <Spinner />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                cursor={{ fill: '#334155', opacity: 0.2 }}
              />
              <Line type="monotone" dataKey="value" stroke="#fbbf24" strokeWidth={3} dot={{ fill: '#fbbf24' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  // ----- Overall error handling -----
  if (assetError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          Failed to load report data. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Reports</h1>

      {/* Assets by Department & Category – two charts side‑by‑side on larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderBarChart(deptData, 'Assets by Department')}
        {renderBarChart(categoryData, 'Assets by Category')}
      </div>

      {/* Maintenance Frequency – top 10 assets with most maintenance events */}
      {renderLineChart(topMaintenance, 'Top 10 Assets – Maintenance Frequency')}

      {/* Maintenance Status Distribution – pie chart */}
      <div className="card p-4 h-80 flex flex-col">
        <h2 className="text-sm font-semibold text-white mb-2">Maintenance Status Distribution</h2>
        <div className="flex-1">
          {maintLoading ? (
            <Spinner />
          ) : maintStatusData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintStatusData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  cursor={{ fill: '#334155', opacity: 0.2 }}
                />
                <Bar dataKey="value" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
