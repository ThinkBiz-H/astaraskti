// "Buy Now" carries a single product straight to checkout without ever
// touching the account cart (Add to Cart's existing behavior is untouched).
// sessionStorage (not localStorage) is deliberate: this is a one-off,
// per-tab checkout intent that shouldn't linger across browser sessions.
const KEY = 'ass_buy_now';

export const setBuyNowItem = (item) => {
  sessionStorage.setItem(KEY, JSON.stringify(item));
};

export const getBuyNowItem = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearBuyNowItem = () => {
  sessionStorage.removeItem(KEY);
};
