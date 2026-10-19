import apiClient, { unwrap } from '@/api/axiosClient';

export const consultationServicesApi = {
  // GET /consultations/services
  list: (params) => apiClient.get('/consultations/services', { params }).then(unwrap),
  getByIdOrSlug: (idOrSlug) => apiClient.get(`/consultations/services/${idOrSlug}`).then(unwrap),
};

export const consultationBookingsApi = {
  // POST /consultations/bookings — multipart if Vastu photos are attached,
  // otherwise plain JSON. See pages/consultation/BookingFormPage.jsx.
  create: (formDataOrPayload) =>
    apiClient.post('/consultations/bookings', formDataOrPayload).then(unwrap),
  myBookings: (params) => apiClient.get('/consultations/bookings/my', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/consultations/bookings/${id}`).then(unwrap),
  cancel: (id, reason) => apiClient.post(`/consultations/bookings/${id}/cancel`, { reason }).then(unwrap),
  review: (id, payload) => apiClient.post(`/consultations/bookings/${id}/review`, payload).then(unwrap),

  // Payment (gateway-abstracted on the backend; Razorpay is the only live gateway today)
  createPaymentOrder: (id, gateway = 'razorpay') =>
    apiClient.post(`/consultations/bookings/${id}/pay/create-order`, { gateway }).then(unwrap),
  verifyPayment: (id, payload) => apiClient.post(`/consultations/bookings/${id}/pay/verify`, payload).then(unwrap),
};

// NOTE: The backend does NOT currently auto-generate a Kundli PDF report on
// payment success, and ConsultationBooking has no `reportUrl` field.
// TODO(backend): add PDF generation + a `reportUrl`/`reportFiles[]` field on
// ConsultationBooking (or a dedicated endpoint like
// GET /consultations/bookings/:id/report) once that feature is built. Until
// then, the "Kundli Reports" dashboard section shows a "Report pending" state
// instead of a fabricated download link — see pages/account/KundliReportsPage.jsx.

// Premium AI Kundli purchase system — standalone from the booking flow
// above (self-serve purchase, not a booked reading with an astrologer).
export const premiumKundliApi = {
  getSettings: () => apiClient.get('/kundli/settings').then(unwrap),
  createOrder: (payload) => apiClient.post('/kundli/order', payload).then(unwrap),
  verifyPayment: (payload) => apiClient.post('/kundli/payment/verify', payload).then(unwrap),
  // DEV ONLY — bypasses Razorpay entirely, see PremiumKundliPage.jsx's VITE_SKIP_KUNDLI_PAYMENT check.
  generateDev: (payload) => apiClient.post('/kundli/generate', payload).then(unwrap),
  geocode: (payload) => apiClient.post('/kundli/geocode', payload).then(unwrap),
  myOrders: () => apiClient.get('/kundli/my-orders').then(unwrap),
  getById: (id) => apiClient.get(`/kundli/order/${id}`).then(unwrap),
};

// Premium Horoscope purchase system — cloned from premiumKundliApi above,
// own backend collection/routes. `geocode` deliberately still points at
// /kundli/geocode: that endpoint has no Kundli-specific logic (pure place
// name -> lat/lon/timezone resolution), so this reuses it instead of
// duplicating it.
export const premiumHoroscopeApi = {
  getService: () => apiClient.get('/horoscope/service').then(unwrap),
  getSettings: () => apiClient.get('/horoscope/settings').then(unwrap),
  geocode: (payload) => apiClient.post('/kundli/geocode', payload).then(unwrap),
  createOrder: (payload) => apiClient.post('/horoscope/order', payload).then(unwrap),
  verifyPayment: (payload) => apiClient.post('/horoscope/payment/verify', payload).then(unwrap),
  // DEV ONLY — bypasses Razorpay entirely, see PremiumHoroscopePage.jsx's VITE_TEST_MODE check.
  generateDev: (payload) => apiClient.post('/horoscope/generate', payload).then(unwrap),
};
