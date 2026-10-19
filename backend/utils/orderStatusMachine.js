/**
 * Centralized order status transition rules.
 * Prevents invalid status jumps (e.g. Pending -> Delivered) from either
 * the admin panel or automated Shiprocket webhook updates.
 */

const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Ready To Ship',
  'Shipped',
  'Out For Delivery',
  'Delivered',
  'Cancelled',
  'Returned',
  'Refunded',
];

// Terminal states cannot transition anywhere further.
const TERMINAL_STATUSES = ['Cancelled', 'Refunded'];

// Map of currentStatus -> allowed next statuses
const TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Packed', 'Cancelled'],
  Packed: ['Ready To Ship', 'Cancelled'],
  'Ready To Ship': ['Shipped', 'Cancelled'],
  Shipped: ['Out For Delivery', 'Returned', 'Cancelled'],
  'Out For Delivery': ['Delivered', 'Out For Delivery', 'Returned'],
  Delivered: ['Returned'],
  Cancelled: ['Refunded'],
  Returned: ['Refunded'],
  Refunded: [],
};

/**
 * Checks whether a transition from `from` to `to` is allowed.
 * A no-op (from === to) is only allowed for "Out For Delivery" to represent
 * an additional delivery attempt without changing overall status.
 */
const canTransition = (from, to) => {
  if (!ORDER_STATUSES.includes(to)) return false;
  if (from === to) return from === 'Out For Delivery';
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
};

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

const assertTransition = (from, to) => {
  if (!canTransition(from, to)) {
    const err = new Error(
      `Invalid order status transition: "${from}" -> "${to}"`,
    );
    err.statusCode = 400;
    throw err;
  }
};

module.exports = {
  ORDER_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  canTransition,
  isTerminal,
  assertTransition,
};
