import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { useRole } from '../hooks/useRole.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  getMaintenance,
  assignTechnician,
  updateMaintenanceStatus,
} from '../services/maintenance.service.js';

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

const titleCase = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-');
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

function Field({ label, children }) {
  return (
    <div>
      <span className="block text-slate-500 mb-0.5">{label}</span>
      <span className="text-slate-200">{children}</span>
    </div>
  );
}

/**
 * Full work-order view: details, audit trail and role-aware actions.
 * `id` accepts either a Req ID (MNT-YYYY-NNNN) or a Mongo ObjectId.
 */
export default function MaintenanceWorkOrder({ id }) {
  const { isAdmin, isStaff, isTechnician } = useRole();
  const { addToast } = useToast();

  const { data: resp, loading, error, refetch } = useFetch(() => getMaintenance(id), [id]);
  const job = resp?.data || resp;

  const canAssign = isAdmin;
  const canUpdate = isAdmin || isStaff || isTechnician;
  const isClosed = job?.status === 'completed' || job?.status === 'cancelled';

  const [technicianId, setTechnicianId] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (job?.status) setStatus(job.status);
  }, [job?.status]);

  async function handleAssign(e) {
    e.preventDefault();
    if (!technicianId.trim()) return;
    setBusy(true);
    try {
      await assignTechnician(job.id, { technicianId: technicianId.trim() });
      addToast('Technician assigned.', 'success');
      setTechnicianId('');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to assign technician.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateMaintenanceStatus(job.id, {
        status,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      addToast('Status updated.', 'success');
      setNotes('');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to update status.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-slate-400 py-6">Loading work order…</div>;
  if (error) {
    const notFound = error.status === 404;
    return (
      <div className={`py-6 ${notFound ? 'text-slate-400' : 'text-red-400'}`}>
        {notFound ? `No work order found for "${id}".` : `Error loading work order: ${error.message}`}
      </div>
    );
  }
  if (!job) return <div className="py-6 text-slate-400">Work order not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-white font-mono">{job.maintenanceId}</h1>
        <span className={`badge ${STATUS_BADGE[job.status] || 'badge-gray'}`}>{titleCase(job.status)}</span>
        <span className={`badge ${PRIORITY_BADGE[job.priority] || 'badge-gray'}`}>{job.priority}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: details + audit ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-[--color-border] pb-2">Work order details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="Asset">
                {job.asset?.assetTag ? (
                  <Link to={`/assets/${job.assetId}`} className="text-indigo-400 hover:text-indigo-300 font-mono">
                    {job.asset.assetTag}
                  </Link>
                ) : '—'}
              </Field>
              <Field label="Type">{titleCase(job.type)}</Field>
              <Field label="Reported by"><span className="font-mono text-xs">{job.reportedBy}</span></Field>
              <Field label="Technician">
                {job.technician?.email || <span className="text-slate-500">Unassigned</span>}
              </Field>
              <Field label="Scheduled for">{fmtDate(job.scheduledFor)}</Field>
              <Field label="Created">{fmtDate(job.createdAt)}</Field>
              <Field label="Started">{fmtDate(job.startedAt)}</Field>
              <Field label="Completed">{fmtDate(job.completedAt)}</Field>
            </div>

            <div className="pt-2 border-t border-[--color-border] space-y-3 text-sm">
              <div>
                <span className="block text-slate-500 mb-0.5">Title</span>
                <span className="text-slate-200 font-medium">{job.title}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-0.5">Description</span>
                <p className="text-slate-300 whitespace-pre-wrap">{job.description || '—'}</p>
              </div>
              {job.resolutionNotes && (
                <div>
                  <span className="block text-slate-500 mb-0.5">Resolution notes</span>
                  <p className="text-slate-300 whitespace-pre-wrap">{job.resolutionNotes}</p>
                </div>
              )}
              {job.onHoldReason && (
                <div>
                  <span className="block text-slate-500 mb-0.5">On-hold reason</span>
                  <p className="text-slate-300">{job.onHoldReason}</p>
                </div>
              )}
              {job.cancelledReason && (
                <div>
                  <span className="block text-slate-500 mb-0.5">Cancellation reason</span>
                  <p className="text-slate-300">{job.cancelledReason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Audit trail */}
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-[--color-border] pb-2">Audit trail</h2>
            {(!job.auditTrail || job.auditTrail.length === 0) ? (
              <p className="text-slate-500 text-sm">No activity yet.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {[...job.auditTrail].reverse().map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    <div>
                      <p className="text-slate-200">
                        <span className="font-medium capitalize">{e.action.replace(/_/g, ' ')}</span>
                        {e.fromStatus && e.toStatus && (
                          <span className="text-slate-400"> · {titleCase(e.fromStatus)} → {titleCase(e.toStatus)}</span>
                        )}
                        {e.actorRole && <span className="text-slate-500"> · {e.actorRole}</span>}
                      </p>
                      {e.note && <p className="text-slate-400">{e.note}</p>}
                      <p className="text-xs text-slate-600">{fmtDate(e.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* ── Right: actions ── */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-[--color-border] pb-2">Actions</h2>

            {isClosed && (
              <p className="text-sm text-slate-400">
                This work order is <span className="font-medium">{titleCase(job.status)}</span>. No further actions are available.
              </p>
            )}

            {!isClosed && !canAssign && (
              <p className="text-sm text-slate-400">
                You can change the status of this work order below.
              </p>
            )}

            {/* Assign technician — admin only */}
            {!isClosed && canAssign && (
              <form onSubmit={handleAssign} className="space-y-3">
                <div>
                  <label className="label" htmlFor={`assign-tech-${job.id}`}>Assign technician</label>
                  <input
                    id={`assign-tech-${job.id}`}
                    className="input"
                    placeholder="email or employee code"
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Accepts an email, employee code, or technician id.
                  </p>
                </div>
                <button type="submit" className="btn-primary w-full justify-center" disabled={busy || !technicianId.trim()}>
                  {busy ? 'Assigning…' : 'Assign'}
                </button>
              </form>
            )}

            {!isClosed && canAssign && canUpdate && <div className="border-t border-[--color-border]" />}

            {/* Change status — admin, staff, technician */}
            {!isClosed && canUpdate && (
              <form onSubmit={handleStatus} className="space-y-3">
                <div>
                  <label className="label" htmlFor={`status-select-${job.id}`}>Change status</label>
                  <select
                    id={`status-select-${job.id}`}
                    className="input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{titleCase(s)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`status-notes-${job.id}`}>Notes</label>
                  <textarea
                    id={`status-notes-${job.id}`}
                    className="input"
                    rows="3"
                    placeholder="Describe the work done or reason for the update…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary w-full justify-center" disabled={busy || status === job.status}>
                  {busy ? 'Updating…' : 'Update status'}
                </button>
                {status === job.status && (
                  <p className="text-[11px] text-slate-500">Pick a different status to enable the update.</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
