// Mirrors backend/utils/orderStatusMachine.js — kept in sync manually since
// this is UI-only classification (which steps to grey out, whether Cancel
// should show); the backend stays authoritative on every actual mutation.
export const ORDER_STATUSES = [
  'Pending', 'Confirmed', 'Processing', 'Packed', 'Ready To Ship', 'Shipped',
  'Out For Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded',
];

export const TERMINAL_STATUSES = ['Delivered', 'Cancelled', 'Returned', 'Refunded'];

// The "main line" a normal (non-cancelled/returned) order travels through —
// used for the progress bar (PART 8) and to render upcoming/greyed-out
// timeline steps (PART 3) that haven't happened yet.
export const MAIN_SEQUENCE = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Ready To Ship', 'Shipped', 'Out For Delivery', 'Delivered'];

export const STATUS_TONE = {
  Pending: 'warning', Confirmed: 'info', Processing: 'info', Packed: 'info',
  'Ready To Ship': 'info', Shipped: 'gold', 'Out For Delivery': 'gold',
  Delivered: 'success', Cancelled: 'danger', Returned: 'danger', Refunded: 'danger',
};

export const STATUS_ICON = {
  Pending: '🕓', Confirmed: '✅', Processing: '⚙️', Packed: '📦',
  'Ready To Ship': '📦', Shipped: '🚚', 'Out For Delivery': '📍',
  Delivered: '🎉', Cancelled: '❌', Returned: '↩️', Refunded: '💰',
};

export const STATUS_LABEL = {
  Pending: 'Order Placed',
};

export const statusLabel = (status) => STATUS_LABEL[status] || status;

// Order can be cancelled through any pre-Shipped status — matches the
// backend's actual TRANSITIONS graph, not just Pending/Confirmed.
export const CANCELLABLE_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Ready To Ship'];
export const canCancelOrder = (status) => CANCELLABLE_STATUSES.includes(status);

export const canReturnOrder = (order) =>
  order.orderStatus === 'Delivered' && (!order.returnRequest || order.returnRequest.status === 'Rejected');
