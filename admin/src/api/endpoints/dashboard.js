import apiClient, { unwrap } from '@/api/axiosClient';

export const dashboardApi = {
  stats: () => apiClient.get('/admin/dashboard/stats').then(unwrap),
  recentOrders: () => apiClient.get('/admin/dashboard/recent-orders').then(unwrap),
  recentConsultationBookings: () => apiClient.get('/admin/dashboard/recent-consultation-bookings').then(unwrap),
  topProducts: () => apiClient.get('/admin/dashboard/top-products').then(unwrap),
  lowStock: (params) => apiClient.get('/admin/dashboard/low-stock', { params }).then(unwrap),
  inventoryStats: () => apiClient.get('/admin/dashboard/inventory-stats').then(unwrap),
  salesChart: (range = 7) => apiClient.get('/admin/dashboard/charts', { params: { range } }).then(unwrap),
  topCustomers: () => apiClient.get('/admin/dashboard/top-customers').then(unwrap),
  categoryAnalytics: () => apiClient.get('/admin/dashboard/category-analytics').then(unwrap),
  monthlyRevenue: (months = 12) => apiClient.get('/admin/dashboard/monthly-revenue', { params: { months } }).then(unwrap),
};

export const reportsApi = {
  // These routes require the admin's Bearer token, so a plain `window.open`
  // navigation would 401 (no access-token cookie exists in this app — see
  // frontend/src/api/axiosClient.js). Fetch as a blob through apiClient
  // instead, so the request carries the same Authorization header as every
  // other admin call, then hand the caller the blob + a suggested filename.
  download: async (name, params = {}) => {
    const res = await apiClient.get(`/admin/reports/${name}`, { params, responseType: 'blob' });
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `${name}-report.${params.format === 'excel' ? 'xlsx' : 'csv'}`;
    return { blob: res.data, filename };
  },
};
