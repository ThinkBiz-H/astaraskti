export const formatCurrency = (amount = 0, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

export const formatDate = (date, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-IN', opts).format(new Date(date));

export const slugifyLite = (str = '') =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
