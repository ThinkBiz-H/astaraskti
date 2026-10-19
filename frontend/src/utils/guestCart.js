// Guest cart — works exactly like the account cart (add/remove/qty/coupon/
// shipping) but lives entirely in localStorage until the customer verifies
// OTP at "Place Order" and an account exists to persist it to. localStorage
// (not sessionStorage) is deliberate: a real cart is expected to survive
// closing the tab, same as Amazon/Flipkart/Myntra.
//
// A tiny external store (subscribe/getSnapshot) so `useSyncExternalStore`
// in useCart.js can react to changes from anywhere — including another
// browser tab, via the `storage` event.
const KEY = 'ass_guest_cart';

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

let cache = read();
const listeners = new Set();

const notify = () => listeners.forEach((l) => l());

const write = (items) => {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode, quota) — cart just won't persist */
  }
  notify();
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = read();
      notify();
    }
  });
}

const sameLine = (line, productId, variantId, color, size) =>
  line.productId === productId &&
  (line.variantId || null) === (variantId || null) &&
  (line.color || null) === (color || null) &&
  (line.size || null) === (size || null);

export const guestCartStore = {
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => cache,

  add: ({ productId, variantId = null, quantity = 1, color, size }) => {
    const items = read();
    const idx = items.findIndex((l) => sameLine(l, productId, variantId, color, size));
    if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + Number(quantity) };
    else items.push({ productId, variantId, quantity: Number(quantity), color, size });
    write(items);
  },

  updateQuantity: (productId, variantId, quantity) => {
    const items = read().map((l) =>
      l.productId === productId && (l.variantId || null) === (variantId || null)
        ? { ...l, quantity: Number(quantity) }
        : l,
    );
    write(items);
  },

  remove: (productId) => {
    write(read().filter((l) => l.productId !== productId));
  },

  clear: () => write([]),
};
