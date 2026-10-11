import { useFetch } from '../hooks/useFetch.js';
import { getAssetStats } from '../services/assets.service.js';
import { getMaintenanceStats } from '../services/maintenance.service.js';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';

const COLORS = {
  in_stock: '#4ade80',       // green
  assigned: '#818cf8',       // indigo
  in_maintenance: '#fbbf24', // yellow
  retired: '#94a3b8',        // slate
  disposed: '#f87171',       // red
  lost: '#fb923c',           // orange
  default: '#c084fc',        // purple
};

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/** Normalises a stats bucket that may be an array of {_id,count} or an object map {key: count}. */
function toBuckets(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => ({
      key: item._id ?? item.status ?? item.category ?? item.department ?? 'unknown',
      count: item.count ?? item.total ?? 0,
    }));
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, count]) => ({ key, count: count ?? 0 }));
  }
  return [];
}

export default function DashboardPage() {
  const { data: assetStatsObj, loading: assetLoading, error: assetError } = useFetch(getAssetStats, []);
  const { data: maintStatsObj, loading: maintLoading, error: maintError } = useFetch(getMaintenanceStats, []);

  const assetStats = assetStatsObj?.data || assetStatsObj || {};
  const maintStats = maintStatsObj?.data || maintStatsObj || {};

  // Extract arrays for charts — handles both array-of-counts and object-map responses
  const statusData = toBuckets(assetStats.statusCounts ?? assetStats.byStatus).map((b) => ({
    name: formatStatus(b.key),
    value: b.count,
    originalKey: b.key,
  }));

  const categoryData = toBuckets(assetStats.categoryCounts ?? assetStats.byCategory).map((b) => ({
    name: String(b.key).toUpperCase(),
    value: b.count,
  }));

  const deptData = toBuckets(assetStats.departmentCounts ?? assetStats.byDepartment).map((b) => ({
    name: b.key,
    value: b.count,
  }));

  const maintData = toBuckets(maintStats.statusCounts ?? maintStats.byStatus).map((b) => ({
    name: formatStatus(b.key),
    value: b.count,
  }));

  // KPI Calculations
  const totalAssets = assetStats.totalAssets ?? statusData.reduce((acc, curr) => acc + curr.value, 0);
  const available = statusData.find(s => s.originalKey === 'in_stock')?.value || 0;
  const allocated = statusData.find(s => s.originalKey === 'assigned')?.value || 0;
  const maintenance = statusData.find(s => s.originalKey === 'in_maintenance')?.value || 0;
  const retired = statusData.find(s => s.originalKey === 'retired')?.value || 0;

  if (assetError) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          Failed to load dashboard statistics.
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard Overview</h1>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Assets', value: totalAssets, color: 'text-white' },
          { label: 'Available', value: available, color: 'text-green-400' },
          { label: 'Allocated', value: allocated, color: 'text-indigo-400' },
          { label: 'In Maintenance', value: maintenance, color: 'text-yellow-400' },
          { label: 'Retired', value: retired, color: 'text-slate-400' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-5 flex flex-col justify-center items-center text-center space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
            {assetLoading ? (
              <div className="h-8 w-16 bg-slate-700/50 rounded animate-pulse mt-1" />
            ) : (
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Asset Status (Pie) */}
        <div className="card p-5 h-80 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-4">Assets by Status</h2>
          <div className="flex-1">
            {assetLoading ? (
              <div className="h-full w-full bg-slate-700/30 rounded animate-pulse" />
            ) : statusData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={statusData} 
                    cx="50%" cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={5} 
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.originalKey] || COLORS.default} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Assets by Category (Bar) */}
        <div className="card p-5 h-80 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-4">Assets by Category</h2>
          <div className="flex-1">
            {assetLoading ? (
              <div className="h-full w-full bg-slate-700/30 rounded animate-pulse" />
            ) : categoryData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ left: -20, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#334155', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                  />
                  <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Assets by Department (Bar) */}
        <div className="card p-5 h-80 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-4">Assets by Department</h2>
          <div className="flex-1">
            {assetLoading ? (
              <div className="h-full w-full bg-slate-700/30 rounded animate-pulse" />
            ) : deptData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip 
                    cursor={{ fill: '#334155', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                  />
                  <Bar dataKey="value" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Maintenance Overview (Bar) */}
        <div className="card p-5 h-80 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-4">Maintenance Overview</h2>
          <div className="flex-1">
            {maintLoading ? (
              <div className="h-full w-full bg-slate-700/30 rounded animate-pulse" />
            ) : maintData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintData} margin={{ left: -20, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#334155', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                  />
                  <Bar dataKey="value" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
