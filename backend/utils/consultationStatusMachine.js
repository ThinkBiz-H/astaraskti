/**
 * Centralized consultation booking status transition rules — mirrors
 * utils/orderStatusMachine.js exactly (same shape: statuses list, terminal
 * list, transitions map, canTransition/isTerminal/assertTransition), so
 * illegal jumps (e.g. Pending -> Completed) are rejected the same way
 * order status changes already are.
 */

const BOOKING_STATUSES = [
  'Pending',
  'Confirmed',
  'Accepted',
  'Rejected',
  'Rescheduled',
  'Waiting',
  'Started',
  'Completed',
  'Cancelled',
  'Refunded',
  'No Show',
];

// "Terminal" here means no further action is expected by default — mirrors
// orderStatusMachine.js's use of the term, which still allows Cancelled to
// move on to Refunded below (terminal ≠ dead end).
const TERMINAL_STATUSES = ['Completed', 'Cancelled', 'Rejected', 'Refunded', 'No Show'];

const TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Accepted', 'Rejected', 'Rescheduled', 'Cancelled'],
  Accepted: ['Waiting', 'Started', 'Rescheduled', 'Cancelled'],
  Rejected: ['Refunded', 'Cancelled'],
  Rescheduled: ['Confirmed', 'Accepted', 'Cancelled'],
  Waiting: ['Started', 'No Show', 'Cancelled'],
  Started: ['Completed', 'No Show'],
  Completed: ['Refunded'],
  Cancelled: ['Refunded'],
  Refunded: [],
  'No Show': ['Refunded', 'Cancelled'],
};

const canTransition = (from, to) => {
  if (!BOOKING_STATUSES.includes(to)) return false;
  if (from === to) return false; // no self-loop concept for consultations (unlike Orders' "Out For Delivery" repeat-attempt case)
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
};

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

const assertTransition = (from, to) => {
  if (!canTransition(from, to)) {
    const err = new Error(
      `Invalid consultation booking status transition: "${from}" -> "${to}"`,
    );
    err.statusCode = 400;
    throw err;
  }
};

module.exports = {
  BOOKING_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  canTransition,
  isTerminal,
  assertTransition,
};
