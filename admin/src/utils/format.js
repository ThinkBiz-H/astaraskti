export const formatCurrency = (amount = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

export const formatDate = (date, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  date ? new Intl.DateTimeFormat('en-IN', opts).format(new Date(date)) : '—';
