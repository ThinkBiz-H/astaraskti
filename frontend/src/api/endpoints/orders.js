import apiClient, { unwrap } from '@/api/axiosClient';

export const ordersApi = {
  // {shippingAddress, paymentMethod, couponCode?, shippingNotes?, items?}
  // `items` is only for "Buy Now" / guest-direct checkout — omit it to use
  // the account cart, exactly as before.
  create: (payload) => apiClient.post('/orders', payload).then(unwrap),
  myOrders: (params) => apiClient.get('/orders/my-orders', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/orders/${id}`).then(unwrap),
  cancel: (id) => apiClient.patch(`/orders/${id}/cancel`).then(unwrap),
  requestReturn: (id, payload) => apiClient.post(`/orders/${id}/return-request`, payload).then(unwrap), // {reason, comment?, items?}
  track: (id) => apiClient.get(`/orders/${id}/track`).then(unwrap),
  // Streams a PDF — blob response, not the usual {success,data} envelope, so this bypasses unwrap().
  downloadInvoice: (id) => apiClient.get(`/orders/${id}/invoice`, { responseType: 'blob' }).then((res) => res.data),
};

export const paymentsApi = {
  verify: (payload) => apiClient.post('/payments/verify', payload).then(unwrap),
  // { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
  failure: (payload) => apiClient.post('/payments/failure', payload).then(unwrap),
  cancelled: (payload) => apiClient.post('/payments/cancelled', payload).then(unwrap),
  retry: (orderId) => apiClient.post(`/payments/${orderId}/retry`).then(unwrap),
  transactions: (orderId) => apiClient.get(`/payments/${orderId}/transactions`).then(unwrap),
};

export const shippingApi = {
  calculate: (payload) => apiClient.post('/shipping/calculate', payload).then(unwrap),
};

// There is no public "list active coupons" endpoint on the backend — coupon
// application is validate-only, via the cart (cartApi.applyCoupon), this
// guest-checkout-safe endpoint, or at order/booking creation time with a
// known code.
export const couponsApi = {
  // { code, subtotal } -> { code, type, discountAmount, subtotal, total }
  // Works for both guests and logged-in users; per-user usage limit is only
  // checked once a user is known (order creation re-validates it either way).
  validate: (payload) => apiClient.post('/coupons/validate', payload).then(unwrap),
};
