import { Check } from 'lucide-react';
import clsx from 'clsx';
import { TERMINAL_STATUSES } from './orderStatus';

// A simplified 5-milestone version of the full status sequence — Flipkart's
// top progress bar doesn't show every intermediate status, just the big
// checkpoints. Out For Delivery counts as reached-Shipped for this bar;
// the full detail lives in OrderTimeline below it.
const MILESTONES = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];

const milestoneIndexForStatus = (status) => {
  if (['Cancelled', 'Returned', 'Refunded'].includes(status)) return -1;
  if (status === 'Delivered') return 4;
  if (['Shipped', 'Out For Delivery'].includes(status)) return 3;
  if (['Packed', 'Ready To Ship'].includes(status)) return 2;
  if (status === 'Confirmed') return 1;
  return 0; // Pending / Processing
};

export function OrderProgressBar({ orderStatus }) {
  const isBadTerminal = ['Cancelled', 'Returned', 'Refunded'].includes(orderStatus);

  if (isBadTerminal) {
    return (
      <div className="card flex items-center gap-2 p-4 text-sm">
        <span className="text-lg">{orderStatus === 'Cancelled' ? '❌' : orderStatus === 'Refunded' ? '💰' : '↩️'}</span>
        <span className="font-medium text-night-900">
          This order was {orderStatus.toLowerCase()}
          {TERMINAL_STATUSES.includes(orderStatus) ? '.' : ''}
        </span>
      </div>
    );
  }

  const reachedIndex = milestoneIndexForStatus(orderStatus);

  return (
    <div className="card p-5">
      <div className="flex items-center">
        {MILESTONES.map((label, i) => {
          const done = i < reachedIndex || (i === reachedIndex && orderStatus === 'Delivered');
          const current = i === reachedIndex && orderStatus !== 'Delivered';
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                    done && 'bg-green-600 text-white',
                    current && 'bg-blue-600 text-white',
                    !done && !current && 'bg-night-900/10 text-night-900/40',
                  )}
                >
                  {done ? <Check size={14} /> : i + 1}
                </div>
                <span className={clsx('text-[11px] font-medium', done ? 'text-green-700' : current ? 'text-blue-700' : 'text-night-900/40')}>
                  {label}
                </span>
              </div>
              {i < MILESTONES.length - 1 && (
                <div className={clsx('mx-1 h-0.5 flex-1', i < reachedIndex ? 'bg-green-600' : 'bg-night-900/10')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
