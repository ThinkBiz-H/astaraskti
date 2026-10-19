// Guest wishlist — same pattern as guestCart.js (utils/guestCart.js), but
// simpler: just a set of product ids, no quantity/variant. Lives in
// localStorage until the customer logs in, at which point useWishlist.js
// switches to the server-backed account wishlist (no merge — the account
// cart isn't merged with the guest cart either, see useCart.js, so this
// stays consistent with that existing behavior rather than inventing a new
// pattern).
const KEY = 'ass_guest_wishlist';

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

const write = (ids) => {
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable (private mode, quota) — wishlist just won't persist */
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

export const guestWishlistStore = {
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => cache,

  add: (productId) => {
    const ids = read();
    if (!ids.includes(productId)) write([...ids, productId]);
  },

  remove: (productId) => {
    write(read().filter((id) => id !== productId));
  },

  clear: () => write([]),
};
