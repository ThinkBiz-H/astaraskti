import apiClient, { unwrap } from '@/api/axiosClient';

export const cartApi = {
  get: () => apiClient.get('/cart').then(unwrap),
  add: (payload) => apiClient.post('/cart', payload).then(unwrap), // {productId, variantId?, quantity, color?, size?}
  updateQuantity: (productId, payload) => apiClient.put(`/cart/${productId}`, payload).then(unwrap),
  remove: (productId) => apiClient.delete(`/cart/${productId}`).then(unwrap),
  clear: () => apiClient.delete('/cart').then(unwrap),
  applyCoupon: (code) => apiClient.post('/cart/apply-coupon', { code }).then(unwrap),
  removeCoupon: () => apiClient.delete('/cart/remove-coupon').then(unwrap),
};

export const wishlistApi = {
  get: () => apiClient.get('/wishlist').then(unwrap),
  add: (productId) => apiClient.post(`/wishlist/${productId}`).then(unwrap),
  remove: (productId) => apiClient.delete(`/wishlist/${productId}`).then(unwrap),
  moveToCart: (productId, payload) => apiClient.post(`/wishlist/${productId}/move-to-cart`, payload).then(unwrap),
};
