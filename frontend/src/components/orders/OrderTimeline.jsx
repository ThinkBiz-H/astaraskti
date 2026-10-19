import { formatDate } from '@/utils/format';
import { MAIN_SEQUENCE, STATUS_ICON, statusLabel } from './orderStatus';

const formatWhen = (date) => formatDate(date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Merges order.statusHistory with order.returnRequest.refund.history into
 * one chronological list — both are real, already-stored audit trails
 * (see backend/models/Order.js statusHistorySchema and the refund.history
 * sub-array), just living in two different places on the document.
 */
function buildTimelineEntries(order) {
  const entries = (order.statusHistory || []).map((h) => ({
    key: `status-${h.status}-${h.changedAt}`,
    status: h.status,
    at: h.changedAt,
    note: h.note,
    who: h.changedBy ? 'Admin' : (order.courier?.courierName || (h.note?.toLowerCase().includes('shiprocket') ? 'Shiprocket' : 'System')),
  }));

  (order.returnRequest?.refund?.history || []).forEach((h) => {
    entries.push({
      key: `refund-${h.status}-${h.at}`,
      status: h.status === 'Completed' ? 'Refund Completed' : 'Refund Initiated',
      at: h.at,
      note: h.note || (h.amount ? `Amount: ₹${h.amount}` : undefined),
      who: 'System',
      icon: '💰',
    });
  });

  return entries.sort((a, b) => new Date(a.at) - new Date(b.at));
}

export function OrderTimeline({ order }) {
  const entries = buildTimelineEntries(order);
  const isBadTerminal = ['Cancelled', 'Returned'].includes(order.orderStatus);

  // Upcoming steps on the normal happy path that haven't happened yet —
  // only shown while the order hasn't been cancelled/returned, so the
  // timeline doesn't dishonestly promise delivery after a cancellation.
  const reachedStatuses = new Set(entries.map((e) => e.status));
  const currentIdx = MAIN_SEQUENCE.indexOf(order.orderStatus);
  const upcoming = isBadTerminal
    ? []
    : MAIN_SEQUENCE.filter((s, i) => i > currentIdx && !reachedStatuses.has(s));

  return (
    <div className="space-y-0">
      {entries.map((e, i) => (
        <div key={e.key} className="relative flex gap-3 pb-6 last:pb-0">
          {i < entries.length - 1 + upcoming.length && (
            <div className="absolute left-[15px] top-8 h-full w-0.5 bg-green-200" />
          )}
          <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm">
            {e.icon || STATUS_ICON[e.status] || '✔'}
          </div>
          <div className="flex-1 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium text-night-900">{statusLabel(e.status)}</p>
              <p className="text-xs text-night-900/40">{formatWhen(e.at)}</p>
            </div>
            {e.note && <p className="mt-0.5 text-xs text-night-900/60">{e.note}</p>}
            <p className="mt-0.5 text-[11px] text-night-900/40">by {e.who}</p>
          </div>
        </div>
      ))}

      {upcoming.map((status, i) => (
        <div key={status} className="relative flex gap-3 pb-6 last:pb-0">
          {i < upcoming.length - 1 && (
            <div className="absolute left-[15px] top-8 h-full w-0.5 bg-night-900/10" />
          )}
          <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night-900/5 text-sm text-night-900/30">
            ○
          </div>
          <div className="flex-1 pt-1.5">
            <p className="text-sm text-night-900/40">{statusLabel(status)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
