import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import { Loader2, X } from 'lucide-react';
import clsx from 'clsx';

export function ProtectedRoute() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin text-gold-500" />;
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={30} /></div>;
}

export function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-night-900/10 text-night-900',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    gold: 'bg-gold-50 text-gold-600',
  };
  return <span className={clsx('badge', tones[tone])}>{children}</span>;
}

export function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm font-medium text-night-900/70">{title}</p>
      {description && <p className="max-w-sm text-xs text-night-900/40">{description}</p>}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-night-900/10 px-4 py-3 text-sm">
      <span className="text-night-900/50">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="btn-outline px-3 py-1.5 disabled:opacity-30">Previous</button>
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="btn-outline px-3 py-1.5 disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl">{title}</h1>
        {description && <p className="text-sm text-night-900/50">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Generic centered modal — click backdrop or the X to close. */
export function Modal({ title, onClose, children, maxWidth = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/40 p-4" onClick={onClose}>
      <div className={`card w-full ${maxWidth} max-h-[85vh] overflow-y-auto p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg">{title}</h3>
          <button onClick={onClose} className="text-night-900/40 hover:text-night-900"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for destructive actions — no such component existed
 * anywhere in the admin before this; deletes used to fire immediately.
 * Usage: const [pending, setPending] = useState(null); ... setPending(item)
 * on the trigger, then <ConfirmDialog open={!!pending} onConfirm={...} onCancel={() => setPending(null)} />
 */
export function ConfirmDialog({ open, title = 'Are you sure?', description, confirmLabel = 'Delete', danger = true, onConfirm, onCancel, loading = false }) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel} maxWidth="max-w-sm">
      {description && <p className="mb-5 text-sm text-night-900/60">{description}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={clsx('btn-primary', danger && '!bg-red-600 hover:!bg-red-700')}
        >
          {loading ? <Spinner size={16} /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Tab strip — same look as SettingsPage.jsx's tab switcher, extracted for reuse. */
export function TabStrip({ tabs, active, onChange }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-night-900/10">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={clsx(
            'shrink-0 border-b-2 px-4 py-2.5 text-sm',
            active === t ? 'border-gold-500 font-medium text-night-950' : 'border-transparent text-night-900/50',
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
