import apiClient, { unwrap } from '@/api/axiosClient';

export const ordersApi = {
  list: (params) => apiClient.get('/orders', { params }).then(unwrap), // status, paymentStatus, paymentMethod, page, limit, from, to
  getById: (id) => apiClient.get(`/orders/${id}`).then(unwrap),
  updateStatus: (id, payload) => apiClient.patch(`/orders/${id}/status`, payload).then(unwrap),
  createShipment: (id, payload) => apiClient.post(`/orders/${id}/shipment`, payload).then(unwrap),
  requestPickup: (id) => apiClient.post(`/orders/${id}/shipment/pickup`).then(unwrap),
  cancelShipment: (id) => apiClient.post(`/orders/${id}/shipment/cancel`).then(unwrap),
  generateManifest: (id) => apiClient.post(`/orders/${id}/shipment/manifest`).then(unwrap),
  generateShiprocketInvoice: (id) => apiClient.post(`/orders/${id}/shipment/invoice`).then(unwrap),
  resendEmail: (id) => apiClient.post(`/orders/${id}/resend-email`).then(unwrap),
  track: (id) => apiClient.get(`/orders/${id}/track`).then(unwrap),
  downloadInvoice: (id) => apiClient.get(`/orders/${id}/invoice`, { responseType: 'blob' }),
  reviewReturnRequest: (id, payload) => apiClient.patch(`/orders/${id}/return-request`, payload).then(unwrap),
  ndrAction: (id, payload) => apiClient.post(`/orders/${id}/ndr-action`, payload).then(unwrap),
};

export const paymentsAdminApi = {
  refund: (orderId, payload) => apiClient.post(`/payments/${orderId}/refund`, payload).then(unwrap),
  transactions: (orderId) => apiClient.get(`/payments/${orderId}/transactions`).then(unwrap),
};

// Consultation Booking admin management (mounted under /admin, see backend
// routes/admin.routes.js — kept separate from the public consultation
// services catalog CRUD, which lives under /consultations/services).
export const consultationBookingsAdminApi = {
  list: (params) => apiClient.get('/admin/consultation-bookings', { params }).then(unwrap),
  updateStatus: (id, payload) => apiClient.put(`/admin/consultation-bookings/${id}/status`, payload).then(unwrap),
  updatePayment: (id, payload) => apiClient.put(`/admin/consultation-bookings/${id}/payment`, payload).then(unwrap),
};

export const consultationServicesAdminApi = {
  list: (params) => apiClient.get('/consultations/services', { params: { ...params, all: 'true' } }).then(unwrap),
  getById: (id) => apiClient.get(`/consultations/services/${id}`).then(unwrap),
  create: (formData) => apiClient.post('/consultations/services', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/consultations/services/${id}`, formData).then(unwrap),
  toggleStatus: (id) => apiClient.patch(`/consultations/services/${id}/status`).then(unwrap),
  remove: (id) => apiClient.delete(`/consultations/services/${id}`).then(unwrap),
};

// Premium AI Kundli purchase system — standalone from the Consultation
// booking module above. Order management + settings.
export const premiumKundliAdminApi = {
  list: (params) => apiClient.get('/kundli/orders', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/kundli/order/${id}`).then(unwrap),
  updateStatus: (payload) => {
    // payload may include a File under `file` (PDF/image/audio/video report)
    if (payload.file instanceof File) {
      const formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') formData.append(k, v); });
      return apiClient.patch('/kundli/status', formData).then(unwrap);
    }
    return apiClient.patch('/kundli/status', payload).then(unwrap);
  },
  getSettings: () => apiClient.get('/kundli/settings').then(unwrap),
  updateSettings: (formData) => apiClient.put('/admin/premium-kundli/settings', formData).then(unwrap),
  regenerate: (id) => apiClient.post(`/kundli/orders/${id}/regenerate`).then(unwrap),
  resendEmail: (id) => apiClient.post(`/kundli/orders/${id}/resend-email`).then(unwrap),
  exportCsv: () => apiClient.get('/kundli/orders/export', { responseType: 'blob' }),
};

// Premium AI Horoscope — same GET/UPDATE settings pattern as
// premiumKundliAdminApi above (orders module intentionally left alone).
export const premiumHoroscopeAdminApi = {
  getSettings: () => apiClient.get('/horoscope/settings').then(unwrap),
  updateSettings: (formData) => apiClient.put('/admin/premium-horoscope/settings', formData).then(unwrap),
};

export const couponsApi = {
  list: (params) => apiClient.get('/coupons', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/coupons/${id}`).then(unwrap),
  create: (payload) => apiClient.post('/coupons', payload).then(unwrap),
  update: (id, payload) => apiClient.put(`/coupons/${id}`, payload).then(unwrap),
  remove: (id) => apiClient.delete(`/coupons/${id}`).then(unwrap),
  analytics: (id) => apiClient.get(`/coupons/${id}/analytics`).then(unwrap),
  overview: () => apiClient.get('/coupons/analytics/overview').then(unwrap),
};
